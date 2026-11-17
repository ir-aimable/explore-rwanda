// Public transport journeys on the RURA 2026 inter-city fare network.
// The fare table lists direct routes between stops; a journey is the cheapest chain of those routes
// (at most 3 buses), plus a short local ride when the start or end is not itself a stop.
// Pure data + pure functions: no database access.
import { fareForKm, findPlace, roadKm, type Place, type Point } from '../rwanda.js';
import { RURA_DIRECTIONS, RURA_FARES, RURA_TARIFF } from './fares.data.js';

export { RURA_DIRECTIONS, RURA_TARIFF };

export interface FareLeg { from: string; to: string; via?: string; fare: number; direction: number }
export interface Access { stop: string; km: number; fare: number }
export interface Journey {
  from: string; to: string;          // place names as asked
  board: Access; alight: Access;     // local ride to the first stop / from the last stop (fare 0 when not needed)
  legs: FareLeg[];                   // official RURA fares, in travel order
  bus_fare: number;                  // sum of the official fares
  one_way: number;                   // bus_fare + local rides
  official: boolean;                 // true when no local-ride estimate was needed
  km?: number;                       // approximate road distance between the two places
}

/** Ride to/from a stop shorter than this is walking distance or included (no extra fare). */
const WALK_KM = 4;
/** Stops considered around a place that is not itself a stop. */
const ORIGIN_RADIUS_KM = 20, DEST_RADIUS_KM = 30;
/** Ranking penalty per change of bus, so a direct route wins over a marginally cheaper connection. */
const TRANSFER_PENALTY = 300;
/** Ranking cost per km of local ride (not added to the fare): prefer a stop near the place over a far one
 *  whose bus is slightly cheaper. Local rides have no official tariff, so a long one is the least reliable part. */
const LOCAL_KM_PENALTY = 80;
/** Kigali's inter-city bus parks: anyone "in Kigali" can board at any of them. */
export const KIGALI_TERMINALS = ['Nyabugogo', 'Nyanza (Kicukiro)', 'Kabuga'];

// ---- stops and the fare graph
const STOP_PLACE = new Map<string, Place>();
for (const [a, b, via] of RURA_FARES) for (const n of [a, b, via]) {
  if (!n || STOP_PLACE.has(n)) continue;
  const p = findPlace(n);
  if (p && p.name === n) STOP_PLACE.set(n, p);
}
/** Stop names in the fare table that are missing from the map (should be empty; checked by tests). */
export const UNMAPPED_STOPS = [...new Set(RURA_FARES.flatMap(([a, b, v]) => [a, b, v]).filter((n) => n && !STOP_PLACE.has(n)))];
export const STOPS = [...STOP_PLACE.values()];

const ADJ = new Map<string, Map<string, FareLeg>>();
function link(from: string, to: string, fare: number, via: string, direction: number) {
  if (!ADJ.has(from)) ADJ.set(from, new Map());
  const cur = ADJ.get(from)!.get(to);
  // Keep the cheapest fare for a pair; on a tie prefer the direct (no "via") route.
  if (!cur || fare < cur.fare || (fare === cur.fare && cur.via && !via)) ADJ.get(from)!.set(to, { from, to, via: via || undefined, fare, direction });
}
for (const [a, b, via, fare, d] of RURA_FARES) { link(a, b, fare, via, d); link(b, a, fare, via, d); }

/** The RURA corridors ("directions") a stop is on. */
export function directionsOf(stop: string): number[] {
  return [...new Set(RURA_FARES.filter(([a, b, v]) => a === stop || b === stop || v === stop).map((f) => f[4]))];
}
/** The stop a place name refers to, if it is one. */
export function stopOf(name?: string | null): string | undefined {
  const p = findPlace(name);
  return p && STOP_PLACE.get(p.name) === p ? p.name : undefined;
}
/** Stops nearest to a point (road distance), closest first. */
export function nearestStops(point: Point, max = 3, radiusKm = Infinity): Access[] {
  return STOPS.map((s) => ({ stop: s.name, km: roadKm(point, s) })).filter((s) => s.km <= radiusKm)
    .sort((a, b) => a.km - b.km).slice(0, max).map((s) => ({ ...s, fare: localFare(s.km) }));
}
const localFare = (km: number) => (km <= WALK_KM ? 0 : fareForKm(km));

// ---- cheapest chain of official fares between two stops
const routeCache = new Map<string, { fare: number; legs: FareLeg[] } | null>();
export function cheapestRoute(a: string, b: string, maxLegs = 3): { fare: number; legs: FareLeg[] } | undefined {
  if (a === b) return { fare: 0, legs: [] };
  const ck = `${a}>${b}>${maxLegs}`;
  if (routeCache.has(ck)) return routeCache.get(ck) ?? undefined;
  // Dijkstra over (stop, buses used); rank = fare + transfer penalty.
  type S = { stop: string; legs: FareLeg[]; fare: number; rank: number };
  const best = new Map<string, number>();
  const open: S[] = [{ stop: a, legs: [], fare: 0, rank: 0 }];
  let found: S | undefined;
  while (open.length) {
    open.sort((x, y) => x.rank - y.rank);
    const cur = open.shift()!;
    if (cur.stop === b) { found = cur; break; }
    const sk = `${cur.stop}#${cur.legs.length}`;
    if ((best.get(sk) ?? Infinity) < cur.rank) continue;
    if (cur.legs.length >= maxLegs) continue;
    for (const leg of ADJ.get(cur.stop)?.values() ?? []) {
      if (cur.legs.some((l) => l.from === leg.to)) continue; // no loops
      const legs = [...cur.legs, leg];
      const fare = cur.fare + leg.fare, rank = fare + TRANSFER_PENALTY * (legs.length - 1);
      const nk = `${leg.to}#${legs.length}`;
      if (rank < (best.get(nk) ?? Infinity)) { best.set(nk, rank); open.push({ stop: leg.to, legs, fare, rank }); }
    }
  }
  const out = found ? { fare: found.fare, legs: found.legs } : undefined;
  routeCache.set(ck, out ?? null);
  return out;
}

export interface Endpoint { name: string; point?: Point }

/** Where a traveller can board (or alight) for a place: the stop itself, Kigali's bus parks, or nearby stops. */
function accessPoints(e: Endpoint, radiusKm: number): Access[] {
  const stop = stopOf(e.name);
  if (stop) return [{ stop, km: 0, fare: 0 }];
  const place = findPlace(e.name);
  const point = e.point ?? (place ? { lat: place.lat, lng: place.lng } : undefined);
  if (!point) return [];
  const out = nearestStops(point, 4, radiusKm);
  if (place?.province === 'Kigali') {
    // "Kigali" as a whole: board at whichever bus park serves the route, no extra ride assumed.
    const generic = place.name === 'Kigali';
    for (const t of KIGALI_TERMINALS) {
      if (out.some((o) => o.stop === t)) { if (generic) out.find((o) => o.stop === t)!.fare = 0; continue; }
      const km = roadKm(point, STOP_PLACE.get(t)!);
      out.push({ stop: t, km: generic ? 0 : km, fare: generic ? 0 : localFare(km) });
    }
    if (generic) out.forEach((o) => { if (KIGALI_TERMINALS.includes(o.stop)) { o.km = 0; o.fare = 0; } });
  }
  return out;
}

/** Cheapest public transport journey between two places, one way per person. */
export function planJourney(from: Endpoint, to: Endpoint): Journey | undefined {
  const starts = accessPoints(from, ORIGIN_RADIUS_KM), ends = accessPoints(to, DEST_RADIUS_KM);
  let best: (Journey & { rank: number }) | undefined;
  for (const s of starts) for (const e of ends) {
    const r = cheapestRoute(s.stop, e.stop);
    if (!r) continue;
    const one_way = s.fare + r.fare + e.fare;
    const rank = one_way + TRANSFER_PENALTY * Math.max(0, r.legs.length - 1) + LOCAL_KM_PENALTY * ((s.fare ? s.km : 0) + (e.fare ? e.km : 0));
    if (!best || rank < best.rank) best = { from: from.name, to: to.name, board: s, alight: e, legs: r.legs, bus_fare: r.fare, one_way, official: s.fare === 0 && e.fare === 0, rank };
  }
  if (!best) return undefined;
  const pf = from.point ?? findPlace(from.name), pt = to.point ?? findPlace(to.name);
  const { rank: _r, ...j } = best;
  return { ...j, km: pf && pt ? roadKm(pf, pt) : undefined };
}

/** Stop names in travel order: Nyabugogo → Musanze → Kinigi. */
export const routeStops = (j: Pick<Journey, 'legs' | 'board'>) => (j.legs.length ? [j.legs[0].from, ...j.legs.map((l) => l.to)] : [j.board.stop]);
