// Central discovery engine: ONE retrieval + ranking implementation used by the AI assistant,
// homepage search, trip discovery and budget search. Reads only; never modifies data.
import { db } from '../../database/db.js';
import { buildLexicon, norm, RELATED, type Intent, type Lexicon } from '../ai/nlp.js';
import { listPublicTrips } from './tripService.js';

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
}
export interface DestSuggestion { id: number; name: string; slug: string; region: string; image_path: string | null; categories: string[]; link: string; reason: string }
export interface DiscoveryResult {
  trips: Rec[]; alternatives: Rec[]; destinations: DestSuggestion[];
  hints: { key: string; params?: Record<string, unknown> }[];
  totalOpen: number;
}

let lexCache: { at: number; lex: Lexicon } | null = null;
export function getLexicon(): Lexicon {
  if (lexCache && Date.now() - lexCache.at < 30_000) return lexCache.lex;
  const cats = db.prepare('SELECT * FROM categories WHERE is_active=1').all();
  const dests = db.prepare('SELECT name,region FROM destinations WHERE is_published=1').all();
  const trips = db.prepare("SELECT DISTINCT starting_location, meeting_point FROM trips WHERE status='published'").all() as any[];
  const lex = buildLexicon(cats, dests, trips);
  lexCache = { at: Date.now(), lex };
  return lex;
}
export function invalidateLexicon() { lexCache = null; }

const locMatches = (t: any, term: string) => {
  const n = norm(term);
  return [t.destination.name, t.destination.region, t.starting_location, t.meeting_point, t.title].some((f: string) => norm(f).includes(n));
};

export function discover(intent: Intent, limit = 6): DiscoveryResult {
  const hints: DiscoveryResult['hints'] = [];
  const people = intent.people ?? 1;
  const dateFilter = intent.date ? { dateFrom: intent.date.dateFrom, dateTo: intent.date.dateTo, weekdays: intent.date.weekdays } : {};

  // 1) Hard filters in the DB layer: published, not started, organizer approved, date window.
  const pool = listPublicTrips({ ...dateFilter, limit: 100, sort: 'date' }).items;
  const open = pool.filter((t) => t.is_open); // registration deadline not passed, not full
  const withSeats = open.filter((t) => t.remaining_spaces >= people);

  const actMatch = (t: any): 'exact' | 'related' | 'none' => {
    if (!intent.category) return 'exact';
    if (t.category.slug === intent.category) return 'exact';
    if ((RELATED[intent.category] || []).includes(t.category.slug) && intent.category === 'nature') return 'related';
    return 'none';
  };

  const extra = db.prepare("SELECT cost_type,label,amount,source_type FROM cost_records WHERE trip_id=? AND cost_type!='package'");
  const score = (t: any): Rec => {
    const reasons: Rec['reasons'] = [];
    let s = 0;
    const am = actMatch(t);
    if (intent.category) {
      if (am === 'exact') { s += 35; reasons.push({ key: 'r_activity', params: { name_en: t.category.name_en, name_rw: t.category.name_rw } }); }
      else if (am === 'related') { s += 14; reasons.push({ key: 'r_related', params: { name_en: t.category.name_en, name_rw: t.category.name_rw } }); }
    } else s += 10;
    if (intent.location) {
      if (locMatches(t, intent.location)) { s += 25; reasons.push({ key: 'r_location', params: { place: intent.location } }); }
    }
    if (intent.origin && norm(t.starting_location).includes(norm(intent.origin))) { s += 10; reasons.push({ key: 'r_origin', params: { place: intent.origin } }); }
    if (intent.date) {
      const days = (Date.parse(t.trip_date) - Date.parse(intent.date.dateFrom)) / 86400000;
      s += Math.max(0, 10 - Math.max(0, days));
      reasons.push({ key: 'r_date', params: { date: t.trip_date } });
    }
    if (intent.budget !== undefined) {
      if (t.price <= intent.budget) {
        s += 20 + Math.round(5 * (1 - t.price / Math.max(intent.budget, 1)));
        reasons.push({ key: 'r_budget', params: { price: t.price, budget: intent.budget, left: intent.budget - t.price } });
      }
    }
    if (intent.lowCost) { s += Math.max(0, 10 - Math.floor(t.price / 2000)); reasons.push({ key: 'r_lowcost', params: { price: t.price } }); }
    const ratio = t.remaining_spaces / t.capacity;
    s += Math.round(10 * ratio);
    reasons.push({ key: t.remaining_spaces <= 3 ? 'r_few_spaces' : 'r_spaces', params: { n: t.remaining_spaces } });
    if (intent.people && intent.people > 1) reasons.push({ key: 'r_people', params: { n: intent.people } });
    if (intent.easy && t.difficulty === 'easy') { s += 5; reasons.push({ key: 'r_easy' }); }
    if (intent.challenging && t.difficulty === 'challenging') { s += 5; reasons.push({ key: 'r_challenging' }); }
    if (t.avg_rating) s += Math.min(5, t.avg_rating);
    return {
      id: t.id, title: t.title, link: `/trips/${t.id}`,
      destination: t.destination.name, destination_id: t.destination.id, region: t.destination.region,
      category_slug: t.category.slug, category_name_rw: t.category.name_rw, category_name_en: t.category.name_en,
      trip_date: t.trip_date, start_time: t.start_time, price: t.price, currency: t.currency,
      remaining_spaces: t.remaining_spaces, capacity: t.capacity, organizer: t.organizer.display_name, verified: t.organizer.verified,
      cover_image: t.cover_image, difficulty: t.difficulty, avg_rating: t.avg_rating, review_count: t.review_count,
      starting_location: t.starting_location, meeting_point: t.meeting_point,
      score: Math.round(s), reasons, alternative: false,
      extra_costs: extra.all(t.id) as any,
    };
  };

  const passSoft = (t: any, ignoreBudget: boolean) => {
    if (actMatch(t) === 'none') return false;
    if (intent.location && !locMatches(t, intent.location)) return false;
    if (!ignoreBudget && intent.budget !== undefined && t.price > intent.budget) return false;
    return true;
  };

  const primary = withSeats.filter((t) => passSoft(t, false)).map(score);
  const sortFn = (a: Rec, b: Rec) => (intent.lowCost ? a.price - b.price || b.score - a.score : b.score - a.score || a.trip_date.localeCompare(b.trip_date));
  primary.sort(sortFn);

  // Over-budget alternatives (clearly labelled); only when a budget exists.
  let alternatives: Rec[] = [];
  if (intent.budget !== undefined) {
    alternatives = withSeats.filter((t) => passSoft(t, true) && t.price > intent.budget!).map((t) => {
      const r = score(t); r.alternative = true; r.over_budget_by = t.price - intent.budget!; return r;
    }).sort((a, b) => a.price - b.price).slice(0, 3);
  }

  // Hints with facts (counts) for the empty-result explanation
  if (primary.length === 0) {
    const allOpen = listPublicTrips({ limit: 100 }).items.filter((t) => t.is_open);
    if (intent.category && !allOpen.some((t) => actMatch(t) !== 'none')) {
      hints.push({ key: 'h_no_activity', params: { name: intent.category } });
    } else {
      const otherDates = allOpen.filter((t) => t.remaining_spaces >= people && passSoft(t, false));
      if (intent.date && otherDates.length) hints.push({ key: 'h_other_dates', params: { n: otherDates.length, first: otherDates[0].trip_date } });
      if (intent.budget !== undefined && alternatives.length) hints.push({ key: 'h_raise_budget', params: { price: alternatives[0].price } });
      if (intent.people && intent.people > 1 && open.filter((t) => passSoft(t, false)).length && !withSeats.length) hints.push({ key: 'h_fewer_people' });
    }
    hints.push({ key: 'h_broaden' });
  }

  // General destination suggestions (NOT organized trips) when nothing matches or a place/activity was asked
  let destinations: DestSuggestion[] = [];
  if (primary.length === 0 || intent.location) {
    const rows = db.prepare('SELECT * FROM destinations WHERE is_published=1').all() as any[];
    const catQ = db.prepare('SELECT c.slug,c.name_en,c.name_rw FROM destination_categories dc JOIN categories c ON c.id=dc.category_id WHERE dc.destination_id=?');
    destinations = rows.map((d) => {
      const cats = catQ.all(d.id) as any[];
      const byLoc = intent.location && [d.name, d.region].some((f: string) => norm(f).includes(norm(intent.location!)) || norm(intent.location!).includes(norm(f)));
      const byCat = intent.category && (cats.some((c) => c.slug === intent.category) || (intent.category === 'nature' && cats.length));
      return { d, cats, byLoc, byCat, rank: (byLoc ? 2 : 0) + (byCat ? 1 : 0) };
    }).filter((x) => x.rank > 0 || (!intent.location && !intent.category))
      .sort((a, b) => b.rank - a.rank).slice(0, 4)
      .map((x) => ({ id: x.d.id, name: x.d.name, slug: x.d.slug, region: x.d.region, image_path: x.d.image_path,
        categories: x.cats.map((c) => c.slug), link: `/destinations/${x.d.id}`, reason: x.byLoc ? 'location' : x.byCat ? 'activity' : 'general' }));
  }

  return { trips: primary.slice(0, limit), alternatives, destinations, hints, totalOpen: open.length };
}
