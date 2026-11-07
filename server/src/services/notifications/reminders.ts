import { db } from '../../database/db.js';
import { addDays, nowStr, todayStr } from '../../lib/time.js';
import { notify } from './notify.js';

/** Sends a one-time in-app reminder to approved participants of trips happening tomorrow. */
export function sendTripReminders() {
  const tomorrow = addDays(todayStr(), 1);
  const rows = db.prepare(`SELECT r.user_id,t.id AS trip_id,t.title,t.start_time FROM registrations r JOIN trips t ON t.id=r.trip_id
    WHERE r.status='approved' AND t.status='published' AND t.trip_date=?`).all(tomorrow) as any[];
  let n = 0;
  for (const r of rows) {
    const exists = db.prepare("SELECT 1 FROM notifications WHERE user_id=? AND type='trip_reminder' AND link=?").get(r.user_id, `/trips/${r.trip_id}`);
    if (!exists) { notify(r.user_id, 'trip_reminder', { title: r.title, time: r.start_time }, `/trips/${r.trip_id}`); n++; }
  }
  return n;
}
/** Marks trips whose start time passed as completed (derived status also protects reads). */
export function completePastTrips() {
  const now = nowStr();
  db.prepare("UPDATE trips SET status='completed', updated_at=datetime('now') WHERE status='published' AND (trip_date||'T'||start_time) <= ?").run(now);
}
