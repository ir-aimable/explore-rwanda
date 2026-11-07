import { db } from '../../database/db.js';
import { nowStr, todayStr } from '../../lib/time.js';

const BASE = `
SELECT t.*, d.name AS destination_name, d.slug AS destination_slug, d.region AS destination_region,
  d.latitude AS dest_lat, d.longitude AS dest_lng,
  c.slug AS category_slug, c.name_rw AS category_name_rw, c.name_en AS category_name_en,
  o.display_name AS organizer_name, o.status AS organizer_status, o.user_id AS organizer_user_id,
  COALESCE((SELECT SUM(seats) FROM registrations r WHERE r.trip_id=t.id AND r.status='approved'),0) AS approved_seats,
  COALESCE((SELECT SUM(seats) FROM registrations r WHERE r.trip_id=t.id AND r.status='pending'),0) AS pending_seats,
  (SELECT ROUND(AVG(rating),1) FROM reviews rv WHERE rv.trip_id=t.id AND rv.status='visible') AS avg_rating,
  (SELECT COUNT(*) FROM reviews rv WHERE rv.trip_id=t.id AND rv.status='visible') AS review_count
FROM trips t
JOIN destinations d ON d.id=t.destination_id
JOIN categories c ON c.id=t.category_id
JOIN organizers o ON o.id=t.organizer_id`;

export type EffectiveStatus = 'draft' | 'published' | 'fully_booked' | 'registration_closed' | 'cancelled' | 'completed';

/** Stored status can be draft/published/cancelled/completed. fully_booked / registration_closed / completed
 *  are derived from live data so they can never go stale. */
export function effectiveStatus(row: any): EffectiveStatus {
  if (row.status === 'draft') return 'draft';
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'completed') return 'completed';
  if (`${row.trip_date}T${row.start_time}` <= nowStr()) return 'completed';
  if (row.registration_deadline < nowStr()) return 'registration_closed';
  if (row.capacity - row.approved_seats <= 0) return 'fully_booked';
  return 'published';
}

export function shapeTrip(row: any, opts: { includePrivate?: boolean } = {}) {
  const j = (s: string) => { try { return JSON.parse(s); } catch { return []; } };
  const eff = effectiveStatus(row);
  const remaining = Math.max(0, row.capacity - row.approved_seats);
  const out: any = {
    id: row.id, title: row.title, description: row.description, cover_image: row.cover_image,
    destination: { id: row.destination_id, name: row.destination_name, slug: row.destination_slug, region: row.destination_region },
    category: { id: row.category_id, slug: row.category_slug, name_rw: row.category_name_rw, name_en: row.category_name_en },
    organizer: { id: row.organizer_id, display_name: row.organizer_name, verified: row.organizer_status === 'approved' },
    starting_location: row.starting_location, meeting_point: row.meeting_point,
    latitude: row.latitude ?? row.dest_lat, longitude: row.longitude ?? row.dest_lng,
    coords_source: row.latitude != null ? 'trip' : row.dest_lat != null ? 'destination' : null,
    trip_date: row.trip_date, start_time: row.start_time, duration_hours: row.duration_hours,
    price: row.price, currency: row.currency,
    included_services: j(row.included_services), excluded_services: j(row.excluded_services),
    transport_info: row.transport_info, food_info: row.food_info, bring_items: row.bring_items,
    difficulty: row.difficulty, capacity: row.capacity, remaining_spaces: remaining,
    registration_deadline: row.registration_deadline, cancellation_policy: row.cancellation_policy,
    status: row.status, effective_status: eff, is_open: eff === 'published',
    avg_rating: row.avg_rating, review_count: row.review_count,
    is_demo: !!row.is_demo, created_at: row.created_at, updated_at: row.updated_at,
  };
  if (opts.includePrivate) { out.approved_seats = row.approved_seats; out.pending_seats = row.pending_seats; }
  return out;
}

export interface TripFilters {
  q?: string; category?: string; destinationId?: number; destination?: string;
  maxPrice?: number; minPrice?: number; date?: string; dateFrom?: string; dateTo?: string;
  weekdays?: number[]; minSeats?: number; availableOnly?: boolean; organizerId?: number;
  sort?: 'date' | 'price_asc' | 'price_desc'; limit?: number; offset?: number;
}

/** PUBLIC listing: only published trips of approved organizers that have not started. */
export function listPublicTrips(f: TripFilters) {
  const where = [`t.status='published'`, `o.status='approved'`, `(t.trip_date || 'T' || t.start_time) > ?`];
  const args: any[] = [nowStr()];
  const add = (sql: string, ...a: any[]) => { where.push(sql); args.push(...a); };
  if (f.category) add('c.slug=?', f.category);
  if (f.destinationId) add('t.destination_id=?', f.destinationId);
  if (f.destination) add('(d.slug=? OR d.name LIKE ? OR d.region LIKE ?)', f.destination, `%${f.destination}%`, `%${f.destination}%`);
  if (f.maxPrice != null) add('t.price<=?', f.maxPrice);
  if (f.minPrice != null) add('t.price>=?', f.minPrice);
  if (f.date) add('t.trip_date=?', f.date);
  if (f.dateFrom) add('t.trip_date>=?', f.dateFrom);
  if (f.dateTo) add('t.trip_date<=?', f.dateTo);
  if (f.organizerId) add('t.organizer_id=?', f.organizerId);
  if (f.q) {
    const like = `%${f.q}%`;
    add(`(t.title LIKE ? OR t.description LIKE ? OR d.name LIKE ? OR d.region LIKE ? OR o.display_name LIKE ? OR c.name_en LIKE ? OR c.name_rw LIKE ? OR t.meeting_point LIKE ?)`,
      like, like, like, like, like, like, like, like);
  }
  const order = f.sort === 'price_asc' ? 't.price ASC, t.trip_date ASC'
    : f.sort === 'price_desc' ? 't.price DESC' : 't.trip_date ASC, t.start_time ASC';
  let rows = db.prepare(`${BASE} WHERE ${where.join(' AND ')} ORDER BY ${order}`).all(...args) as any[];
  let shaped = rows.map((r) => shapeTrip(r));
  if (f.weekdays?.length) {
    shaped = shaped.filter((t) => f.weekdays!.includes(new Date(t.trip_date + 'T00:00:00Z').getUTCDay()));
  }
  if (f.availableOnly) shaped = shaped.filter((t) => t.is_open);
  if (f.minSeats) shaped = shaped.filter((t) => t.is_open && t.remaining_spaces >= f.minSeats!);
  const total = shaped.length;
  const offset = f.offset ?? 0;
  const limit = Math.min(f.limit ?? 24, 100);
  return { total, items: shaped.slice(offset, offset + limit) };
}

export function getTripRow(id: number) {
  return db.prepare(`${BASE} WHERE t.id=?`).get(id) as any | undefined;
}
export function getTrip(id: number, opts: { includePrivate?: boolean } = {}) {
  const r = getTripRow(id);
  return r ? shapeTrip(r, opts) : undefined;
}
export function listTripsRaw(where: string, ...args: any[]) {
  return (db.prepare(`${BASE} ${where}`).all(...args) as any[]);
}
export function tripImages(tripId: number) {
  return (db.prepare('SELECT id,path FROM trip_images WHERE trip_id=? ORDER BY id').all(tripId) as any[]);
}
export function tripCosts(tripId: number, destinationId: number) {
  return db.prepare(`SELECT id,cost_type,label,amount,currency,source_type,source_note,
      CASE WHEN trip_id IS NULL THEN 'destination' ELSE 'trip' END AS scope
    FROM cost_records WHERE trip_id=? OR (trip_id IS NULL AND destination_id=?) ORDER BY scope DESC, id`).all(tripId, destinationId);
}
export { todayStr };
