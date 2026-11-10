// Central discovery engine: ONE retrieval + ranking implementation used by the AI assistant,
// homepage search, trip discovery and budget search. Reads only; never modifies data.
import { db } from '../../database/db.js';
import { buildLexicon, norm, RELATED, type Intent, type Lexicon } from '../ai/nlp.js';
import { listPublicTrips } from './tripService.js';
import { findPlace, roadKm } from '../geo/rwanda.js';
import { estimateFare, HUB_RADIUS_KM, loadTransport, resolveOrigin, type TransportData, type TransportEstimate } from '../geo/transport.js';

export interface Rec {
  id: number; title: string; link: string;
  destination: string; destination_id: number; region: string;
  category_slug: string; category_name_rw: string; category_name_en: string;
  trip_date: string; start_time: string; price: number; currency: string;
  remaining_spaces: number; capacity: number; organizer: string; verified: boolean;
  cover_image: string | null; difficulty: string; avg_rating: number | null; review_count: number;
  starting_location: string; meeting_point: string;
  score: number; reasons: { key: string; params?: Record<string, unknown> }[];
  over_budget_by?: number; alternative: boolean;
  extra_costs: { cost_type: string; label: string | null; amount: number | null; source_type: string }[];
  // Four independent statuses: never collapsed into one "match" boolean.
  tripAvailabilityStatus: TripAvailability;
  budgetEligibilityStatus: BudgetEligibility;
  costCompletenessStatus: CostCompleteness;
  recommendationStatus: RecommendationStatus;
  cost: CostSummary;
}
export type TripAvailability = 'available' | 'full' | 'registration_closed' | 'date_mismatch' | 'not_enough_spaces';
export type BudgetEligibility = 'no_budget' | 'within_budget' | 'unconfirmed' | 'above_budget';
export type CostCompleteness = 'complete' | 'incomplete';
export type RecommendationStatus = 'recommended' | 'recommended_unconfirmed' | 'alternative_above_budget' | 'not_bookable';
export interface CostLine {
  type: string; label: string | null; amount: number | null; status: 'known' | 'included' | 'unknown' | 'estimated'; source_type: string | null;
  /** Estimated public transport: where from, how it was worked out, and whether the starting point was assumed. */
  estimate?: { from: string; basis: 'table' | 'distance'; via?: string; km?: number; one_way: number; assumed: boolean;
    /** The organizer prices transport from a starting point far from the traveller: public transport from where they are replaces it. */
    instead_of?: { start: string; amount: number } };
}
export interface CostSummary {
  activity_price: number;
  lines: CostLine[];        // transport, food, entry fees… each known, included in the package, or unknown
  known_total: number;      // activity price + every KNOWN extra (unknown amounts are not counted as zero: see complete)
  complete: boolean;
  estimated: boolean;       // the total includes an estimated public transport fare
}
export type ResultState =
  | 'NO_MATCHING_TRIPS'
  | 'MATCHED_AVAILABLE_AFFORDABILITY_CONFIRMED'
  | 'MATCHED_AVAILABLE_AFFORDABILITY_UNCONFIRMED'
  | 'MATCHED_ABOVE_BUDGET'
  | 'MATCHED_BUT_FULL'
  | 'MATCHED_BUT_REGISTRATION_CLOSED'
  | 'MATCHED_BUT_DATE_MISMATCH'
  | 'DESTINATION_SUGGESTIONS_ONLY';
export interface DestSuggestion { id: number; name: string; slug: string; region: string; image_path: string | null; categories: string[]; link: string; reason: string }
export interface DiscoveryResult {
  state: ResultState;
  trips: Rec[];          // available and not above budget (affordability confirmed or unconfirmed)
  alternatives: Rec[];   // available but above budget
  unavailable: Rec[];    // matching trips that cannot be booked (full / registration closed / other date)
  destinations: DestSuggestion[];
  hints: { key: string; params?: Record<string, unknown> }[];
  totalOpen: number;
  /** Closest bookable options when nothing matches: which criteria were relaxed, and the trips found. */
  nearby?: Nearby;
}
export type Relaxed = 'category' | 'location' | 'transportIncluded' | 'date';
export interface Nearby { relaxed: Relaxed[]; trips: Rec[] }

/** Relaxation order: drop the fewest, least important criteria first. */
/** A town or area matches destinations up to this road distance. */
export const NEAR_KM = 45;
const RELAX: Relaxed[][] = [['category'], ['location'], ['transportIncluded'], ['category', 'location'], ['date'], ['category', 'date'], ['category', 'location', 'date', 'transportIncluded']];

/** When nothing bookable matches, find the closest open trips by dropping one criterion at a time
 *  (the starting location, budget and group size are always kept). */
export async function findNearby(intent: Intent, limit = 3, snap?: Snapshot): Promise<Nearby | undefined> {
  snap ??= await loadSnapshot();
  for (const keys of RELAX) {
    if (!keys.every((k) => intent[k] !== undefined)) continue;
    const relaxed: Intent = { ...intent };
    for (const k of keys) (relaxed as any)[k] = undefined;
    if (keys.includes('location')) relaxed.near = intent.location;
    const r = await discover(relaxed, limit, false, snap);
    if (r.trips.length) return { relaxed: keys, trips: r.trips };
  }
  return undefined;
}

let lexCache: { at: number; lex: Lexicon } | null = null;
export async function getLexicon(): Promise<Lexicon> {
  if (lexCache && Date.now() - lexCache.at < 30_000) return lexCache.lex;
  const cats = await db.prepare('SELECT * FROM categories WHERE is_active=1').all();
  const dests = await db.prepare('SELECT name,region FROM destinations WHERE is_published=1').all();
  const trips = await db.prepare("SELECT DISTINCT starting_location, meeting_point FROM trips WHERE status='published'").all() as any[];
  // Starting locations added by admins in the transport table are places too
  for (const h of await db.prepare('SELECT name FROM transport_hubs').all() as any[]) trips.push({ starting_location: h.name, meeting_point: '' });
  const lex = buildLexicon(cats, dests, trips);
  lexCache = { at: Date.now(), lex };
  return lex;
}
export function invalidateLexicon() { lexCache = null; }

const locMatches = (t: any, term: string) => {
  const n = norm(term);
  return [t.destination.name, t.destination.region, t.starting_location, t.meeting_point, t.title].some((f: string) => norm(f).includes(n));
};

const INCLUDED: Record<string, RegExp> = {
  transport: /transport|bus\b|minibus|shuttle|pick ?-?up|vehicle|imodoka/i,
  food: /lunch|food|meal|snack|breakfast|dinner|ibiryo|amafunguro/i,
  entry_fee: /entry|entrance|park fee|admission|permit/i,
};

/** What the trip will really cost, as far as the records say. Missing amounts stay unknown, never zero. */
export function costSummary(t: any, extras: Rec['extra_costs'], destExtras: Rec['extra_costs'], transport?: TransportEstimate & { assumed: boolean; replaceOrganizer?: boolean }): CostSummary {
  const inc = (k: string) => (t.included_services || []).some((x: string) => INCLUDED[k]?.test(x));
  const exc = (k: string) => (t.excluded_services || []).some((x: string) => INCLUDED[k]?.test(x));
  const lines: CostLine[] = [];
  const fromRecords = (type: string, recs: Rec['extra_costs']) => recs.filter((r) => r.cost_type === type)
    .forEach((r) => lines.push({ type, label: r.label, amount: r.amount, status: r.amount == null ? 'unknown' : 'known', source_type: r.source_type }));
  // Transport is always part of a journey: included in the package, recorded, or unknown.
  if (inc('transport')) lines.push({ type: 'transport', label: null, amount: 0, status: 'included', source_type: 'organizer' });
  else if (extras.some((r) => r.cost_type === 'transport' && r.amount != null) && !transport?.replaceOrganizer) fromRecords('transport', extras);
  // Not included and not priced by the organizer (or priced from a far-away starting point):
  // public transport from where the traveller starts.
  else if (transport) {
    const org = extras.filter((r) => r.cost_type === 'transport' && r.amount != null).reduce((a, r) => a + r.amount!, 0);
    lines.push({ type: 'transport', label: null, amount: transport.amount, status: 'estimated', source_type: transport.basis === 'table' ? 'transport_table' : 'system_estimate',
      estimate: { from: transport.from, basis: transport.basis, via: transport.via, km: transport.km, one_way: transport.one_way, assumed: transport.assumed,
        instead_of: transport.replaceOrganizer ? { start: t.starting_location, amount: org } : undefined } });
  }
  else lines.push({ type: 'transport', label: null, amount: null, status: 'unknown', source_type: null });
  // Food, entry fees and other costs: when included, recorded, or listed by the organizer as not included.
  for (const type of ['food', 'entry_fee']) {
    if (inc(type)) lines.push({ type, label: null, amount: 0, status: 'included', source_type: 'organizer' });
    else if (extras.some((r) => r.cost_type === type)) fromRecords(type, extras);
    else if (destExtras.some((r) => r.cost_type === type)) fromRecords(type, destExtras);
    else if (exc(type)) lines.push({ type, label: null, amount: null, status: 'unknown', source_type: null });
  }
  for (const type of ['accommodation', 'activity', 'other']) fromRecords(type, extras);
  const known_total = t.price + lines.reduce((a, l) => a + (l.amount || 0), 0);
  return { activity_price: t.price, lines, known_total, complete: lines.every((l) => l.status !== 'unknown'), estimated: lines.some((l) => l.status === 'estimated') };
}

/** Everything one search needs, loaded in a few queries (a hosted database is reached over the network,
 *  so per-trip queries would be slow). Reused by the closest-option search. */
export interface Snapshot { all: any[]; costs: any[]; transport: TransportData; dests?: { rows: any[]; cats: any[] } }
export async function loadSnapshot(): Promise<Snapshot> {
  const all = (await listPublicTrips({ limit: 200, sort: 'date' })).items;
  const costs = await db.prepare("SELECT trip_id,destination_id,cost_type,label,amount,source_type FROM cost_records WHERE cost_type!='package'").all();
  return { all, costs, transport: await loadTransport() };
}
async function destinationsOf(snap: Snapshot) {
  snap.dests ??= {
    rows: await db.prepare('SELECT * FROM destinations WHERE is_published=1').all(),
    cats: await db.prepare('SELECT dc.destination_id,c.slug,c.name_en,c.name_rw FROM destination_categories dc JOIN categories c ON c.id=dc.category_id').all(),
  };
  return snap.dests;
}

export async function discover(intent: Intent, limit = 6, withNearby = true, snap?: Snapshot): Promise<DiscoveryResult> {
  snap ??= await loadSnapshot();
  const hints: DiscoveryResult['hints'] = [];
  const people = intent.people ?? 1;
  const inWindow = (t: any) => !intent.date || (t.trip_date >= intent.date.dateFrom && t.trip_date <= intent.date.dateTo
    && (!intent.date.weekdays || intent.date.weekdays.includes(new Date(t.trip_date + 'T12:00:00Z').getUTCDay())));

  // 1) Retrieval: published trips of approved organizers that have not started (any date, any capacity).
  const all = snap.all;

  const actMatch = (t: any): 'exact' | 'related' | 'none' => {
    if (!intent.category) return 'exact';
    if (t.category.slug === intent.category) return 'exact';
    if ((RELATED[intent.category] || []).includes(t.category.slug) && intent.category === 'nature') return 'related';
    return 'none';
  };
  // Place: by name first; a town or area with no trip of that name also matches destinations near it on the map
  // ("near Musanze" finds Bigogwe and the Volcanoes).
  const tp = snap.transport;
  const locPlace = intent.location ? findPlace(intent.location) : undefined;
  const byName = !!intent.location && all.some((t: any) => locMatches(t, intent.location!));
  const nearKm = (t: any): number | undefined => {
    if (!intent.location || byName || !locPlace) return undefined;
    const p = tp.dests.get(t.destination.id)?.point;
    return p ? roadKm({ lat: locPlace.lat, lng: locPlace.lng }, p) : undefined;
  };
  const nearPlace = intent.near ? findPlace(intent.near) : undefined;
  const locOk = (t: any) => !intent.location || locMatches(t, intent.location) || (nearKm(t) ?? Infinity) <= NEAR_KM;
  // Where the traveller starts (their own starting location, else the trip's) for transport estimates
  const origin = intent.origin ? resolveOrigin(intent.origin, tp) : undefined;

  // 2) Criteria match (activity, place, transport) — independent of availability and budget.
  const matches = (t: any) => actMatch(t) !== 'none'
    && locOk(t)
    && (!intent.transportIncluded || (t.included_services || []).some((x: string) => INCLUDED.transport.test(x)));

  const strip = ({ cost_type, label, amount, source_type }: any) => ({ cost_type, label, amount, source_type });
  const tripCostsOf = (id: number) => snap!.costs.filter((c) => c.trip_id === id).map(strip) as Rec['extra_costs'];
  const destCostsOf = (id: number) => snap!.costs.filter((c) => c.trip_id == null && c.destination_id === id).map(strip) as Rec['extra_costs'];

  const availability = (t: any): TripAvailability => {
    if (t.effective_status === 'registration_closed') return 'registration_closed';
    if (t.effective_status === 'fully_booked') return 'full';
    if (t.remaining_spaces < people) return 'not_enough_spaces';
    if (!inWindow(t)) return 'date_mismatch';
    return 'available';
  };
  const budgetType = intent.budgetType ?? 'total';
  const eligibility = (c: CostSummary): BudgetEligibility => {
    if (intent.budget === undefined) return 'no_budget';
    if (budgetType === 'activity') return c.activity_price <= intent.budget ? 'within_budget' : 'above_budget';
    if (c.known_total > intent.budget) return 'above_budget';  // already over even before the unknown costs
    return c.complete ? 'within_budget' : 'unconfirmed';
  };

  const score = (t: any): Rec => {
    const extras = tripCostsOf(t.id);
    const est = estimateFare(tp, t.destination.id, intent.origin || t.starting_location);
    // A traveller far from the trip's starting point travels to the destination directly by public transport,
    // instead of paying the organizer's separately priced transport from that starting point.
    const startPt = origin?.point ? resolveOrigin(t.starting_location, tp).point : undefined;
    const farFromStart = !!origin?.point && !!startPt && roadKm(origin.point, startPt) > HUB_RADIUS_KM;
    const cost = costSummary(t, extras, destCostsOf(t.destination.id), est && { ...est, assumed: !intent.origin, replaceOrganizer: farFromStart && extras.some((r) => r.cost_type === 'transport' && r.amount != null) });
    const avail = availability(t);
    const budget = eligibility(cost);
    const reasons: Rec['reasons'] = [];
    let s = 0;
    const am = actMatch(t);
    if (intent.category) {
      if (am === 'exact') { s += 35; reasons.push({ key: 'r_activity', params: { name_en: t.category.name_en, name_rw: t.category.name_rw } }); }
      else if (am === 'related') { s += 14; reasons.push({ key: 'r_related', params: { name_en: t.category.name_en, name_rw: t.category.name_rw } }); }
    } else s += 10;
    if (intent.location && locMatches(t, intent.location)) { s += 25; reasons.push({ key: 'r_location', params: { place: intent.location } }); }
    else if (!intent.location && nearPlace) {
      const p = tp.dests.get(t.destination.id)?.point;
      if (p) { const km = roadKm({ lat: nearPlace.lat, lng: nearPlace.lng }, p); s += Math.max(0, 15 - Math.round(km / 10)); reasons.push({ key: 'r_near', params: { place: intent.near, km } }); }
    }
    else if (intent.location && (nearKm(t) ?? Infinity) <= NEAR_KM) { s += 18 - Math.round(nearKm(t)! / 10); reasons.push({ key: 'r_near', params: { place: intent.location, km: nearKm(t) } }); }
    if (intent.origin && norm(t.starting_location).includes(norm(intent.origin))) { s += 10; reasons.push({ key: 'r_origin', params: { place: intent.origin } }); }
    else if (origin?.point) {
      // The traveller is somewhere else: say how far the trip's starting point is, unless transport was estimated from them.
      const start = resolveOrigin(t.starting_location, tp).point;
      const km = start ? roadKm(origin.point, start) : undefined;
      const tl = cost.lines.find((l) => l.type === 'transport');
      if (km !== undefined && km > HUB_RADIUS_KM && tl?.status !== 'estimated') reasons.push({ key: 'r_start_far', params: { start: t.starting_location, from: origin.name, km, included: tl?.status === 'included' } });
      const dk = tp.dests.get(t.destination.id)?.point ? roadKm(origin.point, tp.dests.get(t.destination.id)!.point!) : undefined;
      if (dk !== undefined) s += Math.max(0, 8 - Math.round(dk / 25)); // closer to the traveller ranks a little higher
    }
    if (intent.date) {
      const days = (Date.parse(t.trip_date) - Date.parse(intent.date.dateFrom)) / 86400000;
      s += Math.max(0, 10 - Math.max(0, days));
      reasons.push({ key: 'r_date', params: { date: t.trip_date } });
    }
    if (budget === 'within_budget') {
      const spend = budgetType === 'activity' ? cost.activity_price : cost.known_total;
      s += 25 + Math.round(5 * (1 - spend / Math.max(intent.budget!, 1)));
      reasons.push({ key: budgetType === 'activity' ? 'r_budget' : 'r_budget_total', params: { price: spend, budget: intent.budget, left: intent.budget! - spend } });
    } else if (budget === 'unconfirmed') {
      s += 12;
      reasons.push({ key: 'r_budget_unconfirmed', params: { price: cost.known_total, budget: intent.budget, missing: cost.lines.filter((l) => l.status === 'unknown').map((l) => l.type) } });
    }
    if (intent.transportIncluded) reasons.push({ key: 'r_transport_included' });
    if (intent.lowCost) { s += Math.max(0, 10 - Math.floor(t.price / 2000)); reasons.push({ key: 'r_lowcost', params: { price: t.price } }); }
    s += Math.round(10 * (t.remaining_spaces / t.capacity));
    reasons.push({ key: t.remaining_spaces <= 3 ? 'r_few_spaces' : 'r_spaces', params: { n: t.remaining_spaces } });
    if (intent.people && intent.people > 1) reasons.push({ key: 'r_people', params: { n: intent.people } });
    if (intent.easy && t.difficulty === 'easy') { s += 5; reasons.push({ key: 'r_easy' }); }
    if (intent.challenging && t.difficulty === 'challenging') { s += 5; reasons.push({ key: 'r_challenging' }); }
    if (t.avg_rating) s += Math.min(5, t.avg_rating);
    const recommendationStatus: RecommendationStatus = avail !== 'available' ? 'not_bookable'
      : budget === 'above_budget' ? 'alternative_above_budget'
      : budget === 'within_budget' || (budget === 'no_budget' && cost.complete) ? 'recommended' : 'recommended_unconfirmed';
    const over = budget === 'above_budget' ? (budgetType === 'activity' ? cost.activity_price : cost.known_total) - intent.budget! : undefined;
    return {
      id: t.id, title: t.title, link: `/trips/${t.id}`,
      destination: t.destination.name, destination_id: t.destination.id, region: t.destination.region,
      category_slug: t.category.slug, category_name_rw: t.category.name_rw, category_name_en: t.category.name_en,
      trip_date: t.trip_date, start_time: t.start_time, price: t.price, currency: t.currency,
      remaining_spaces: t.remaining_spaces, capacity: t.capacity, organizer: t.organizer.display_name, verified: t.organizer.verified,
      cover_image: t.cover_image, difficulty: t.difficulty, avg_rating: t.avg_rating, review_count: t.review_count,
      starting_location: t.starting_location, meeting_point: t.meeting_point,
      score: Math.round(s), reasons, alternative: recommendationStatus === 'alternative_above_budget', over_budget_by: over,
      extra_costs: extras,
      tripAvailabilityStatus: avail, budgetEligibilityStatus: budget, costCompletenessStatus: cost.complete ? 'complete' : 'incomplete',
      recommendationStatus, cost,
    };
  };

  const matched = all.filter(matches).map(score);
  const available = matched.filter((r) => r.tripAvailabilityStatus === 'available');
  // Confirmed affordability first, then unconfirmed; within each, best score.
  const rank = (r: Rec) => (r.recommendationStatus === 'recommended' ? 0 : 1);
  const primary = available.filter((r) => r.recommendationStatus === 'recommended' || r.recommendationStatus === 'recommended_unconfirmed')
    .sort((a, b) => rank(a) - rank(b) || (intent.lowCost ? a.price - b.price : 0) || b.score - a.score || a.trip_date.localeCompare(b.trip_date));
  const alternatives = available.filter((r) => r.recommendationStatus === 'alternative_above_budget')
    .sort((a, b) => (a.over_budget_by ?? 0) - (b.over_budget_by ?? 0)).slice(0, 3);
  const inDate = matched.filter((r) => r.tripAvailabilityStatus !== 'date_mismatch' && inWindow(r));
  const full = inDate.filter((r) => r.tripAvailabilityStatus === 'full' || r.tripAvailabilityStatus === 'not_enough_spaces');
  const closed = inDate.filter((r) => r.tripAvailabilityStatus === 'registration_closed');
  const otherDates = matched.filter((r) => r.tripAvailabilityStatus === 'date_mismatch');

  // 3) Overall state, decided from the actual results (most useful first)
  let state: ResultState;
  let unavailable: Rec[] = [];
  if (primary.length) state = primary[0].recommendationStatus === 'recommended' ? 'MATCHED_AVAILABLE_AFFORDABILITY_CONFIRMED' : 'MATCHED_AVAILABLE_AFFORDABILITY_UNCONFIRMED';
  else if (alternatives.length) state = 'MATCHED_ABOVE_BUDGET';
  else if (full.length) { state = 'MATCHED_BUT_FULL'; unavailable = full.slice(0, 3); }
  else if (closed.length) { state = 'MATCHED_BUT_REGISTRATION_CLOSED'; unavailable = closed.slice(0, 3); }
  else if (otherDates.length) { state = 'MATCHED_BUT_DATE_MISMATCH'; unavailable = otherDates.slice(0, 3); }
  else state = 'NO_MATCHING_TRIPS';

  // Hints with facts for anything short of a confirmed match
  if (!primary.length) {
    const openAll = all.filter((t) => t.is_open);
    if (intent.category && !openAll.some((t) => actMatch(t) !== 'none')) hints.push({ key: 'h_no_activity', params: { name: intent.category } });
    else {
      if (intent.date && otherDates.length) hints.push({ key: 'h_other_dates', params: { n: otherDates.length, first: otherDates[0].trip_date } });
      if (alternatives.length) hints.push({ key: 'h_raise_budget', params: { price: alternatives[0].cost.known_total } });
      if (intent.people && intent.people > 1 && full.some((r) => r.tripAvailabilityStatus === 'not_enough_spaces')) hints.push({ key: 'h_fewer_people' });
    }
    hints.push({ key: 'h_broaden' });
  }

  // General destination ideas (NOT organized trips) when nothing is bookable or a place was asked
  let destinations: DestSuggestion[] = [];
  if (primary.length === 0 || intent.location) {
    const { rows, cats: allCats } = await destinationsOf(snap);
    destinations = rows.map((d) => {
      const cats = allCats.filter((c) => c.destination_id === d.id);
      const byLoc = intent.location && [d.name, d.region].some((f: string) => norm(f).includes(norm(intent.location!)) || norm(intent.location!).includes(norm(f)));
      const byCat = intent.category && (cats.some((c) => c.slug === intent.category) || (intent.category === 'nature' && cats.length));
      return { d, cats, byLoc, byCat, rank: (byLoc ? 2 : 0) + (byCat ? 1 : 0) };
    }).filter((x) => x.rank > 0 || (!intent.location && !intent.category))
      .sort((a, b) => b.rank - a.rank).slice(0, 4)
      .map((x) => ({ id: x.d.id, name: x.d.name, slug: x.d.slug, region: x.d.region, image_path: x.d.image_path,
        categories: x.cats.map((c) => c.slug), link: `/destinations/${x.d.id}`, reason: x.byLoc ? 'location' : x.byCat ? 'activity' : 'general' }));
  }
  if (state === 'NO_MATCHING_TRIPS' && destinations.length) state = 'DESTINATION_SUGGESTIONS_ONLY';

  // Nothing bookable within budget: look for the closest open trips instead of stopping at "no match".
  // When only over-budget trips match, this also finds the closest option that fits the budget.
  const nearby = withNearby && !primary.length ? await findNearby(intent, 3, snap) : undefined;
  return { state, trips: primary.slice(0, limit), alternatives, unavailable, destinations, hints, totalOpen: all.filter((t) => t.is_open).length, nearby };
}
