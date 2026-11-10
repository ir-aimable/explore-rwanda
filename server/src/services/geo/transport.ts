// Public transport between starting locations and destinations.
// Admins fill a fare table (one-way fare per person); where a cell is empty, the fare is estimated from the
// road distance on the built-in map. The assistant uses this to complete a trip's total cost when the
// trip price does not include transport, starting from where the traveller actually is.
import { db } from '../../database/db.js';
import { byDistance, fareForKm, findPlace, locate, roadKm, type Point } from './rwanda.js';

export interface Hub { id: number; name: string; is_default: boolean; point?: Point }
export interface DestPoint { id: number; name: string; region: string; point?: Point }
export interface TransportData { hubs: Hub[]; fares: Map<string, number>; dests: Map<number, DestPoint> }
export interface TransportEstimate {
  one_way: number; amount: number;      // amount = return journey (there and back), per person
  from: string;                         // where the traveller starts (display name)
  basis: 'table' | 'distance';          // admin fare table, or road-distance estimate
  via?: string;                         // table fare of a nearby starting location (e.g. Kinigi -> via Musanze)
  km?: number;                          // road distance used or known
}

const k = (destId: number, hubId: number) => `${destId}:${hubId}`;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** A traveller this close to a starting location uses its fares (plus a short local ride). */
export const HUB_RADIUS_KM = 15;

export async function loadTransport(): Promise<TransportData> {
  const hubs = (await db.prepare('SELECT id,name,latitude,longitude,is_default FROM transport_hubs ORDER BY sort_order,id').all()).map((h: any) => ({
    id: h.id, name: h.name, is_default: !!h.is_default,
    point: h.latitude != null && h.longitude != null ? { lat: h.latitude, lng: h.longitude } : locate({ name: h.name }),
  }));
  const fares = new Map<string, number>();
  for (const f of await db.prepare('SELECT destination_id,hub_id,amount FROM hub_fares').all() as any[]) fares.set(k(f.destination_id, f.hub_id), f.amount);
  const dests = new Map<number, DestPoint>();
  for (const d of await db.prepare('SELECT id,name,region,latitude,longitude FROM destinations').all() as any[]) dests.set(d.id, { id: d.id, name: d.name, region: d.region, point: locate(d) });
  return { hubs, fares, dests };
}

/** Where a traveller starts: a starting location from the table, or any place on the map ("Ruhengeri" -> Musanze). */
export function resolveOrigin(name: string, data: TransportData): { name: string; point?: Point; hub?: Hub } {
  let hub = data.hubs.find((h) => same(h.name, name));
  const place = findPlace(name);
  if (!hub && place) hub = data.hubs.find((h) => same(h.name, place.name));
  return { name: hub?.name ?? place?.name ?? name, point: hub?.point ?? (place ? { lat: place.lat, lng: place.lng } : undefined), hub };
}

/** Return-trip public transport per person from `from` to a destination, or undefined when it cannot be known. */
export function estimateFare(data: TransportData, destId: number, from: string): TransportEstimate | undefined {
  const dest = data.dests.get(destId);
  if (!dest) return undefined;
  const o = resolveOrigin(from, data);
  const km = o.point && dest.point ? roadKm(o.point, dest.point) : undefined;
  const out = (one_way: number, basis: TransportEstimate['basis'], via?: string): TransportEstimate => ({ one_way, amount: one_way * 2, from: o.name, basis, via, km });
  // 1) The admin's fare from this starting location
  if (o.hub && data.fares.has(k(destId, o.hub.id))) return out(data.fares.get(k(destId, o.hub.id))!, 'table');
  // 2) A starting location next to the traveller that has a fare (plus a short local ride to it)
  if (o.point) {
    const near = byDistance(o.point, data.hubs.filter((h) => data.fares.has(k(destId, h.id))))[0];
    if (near && near.km <= HUB_RADIUS_KM) return out(data.fares.get(k(destId, near.id))! + (near.km > 3 ? fareForKm(near.km) : 0), 'table', near.name);
  }
  // 3) Road distance on the map
  if (km !== undefined) return out(fareForKm(km), 'distance');
  return undefined;
}

/** Starting locations ordered from closest to farthest from a destination. */
export function closestHubs(data: TransportData, destId: number) {
  const p = data.dests.get(destId)?.point;
  return p ? byDistance(p, data.hubs) : [];
}
