import { Router } from 'express';
import { db } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { notify } from '../services/notifications/notify.js';
import { effectiveStatus, getTripRow } from '../services/search/tripService.js';
import { nowStr } from '../lib/time.js';
import { decisionSchema, registrationCreateSchema, reviewSchema } from '../validators/schemas.js';

export const registrationsRouter = Router();

// Travelers (and organizers acting as ordinary users on OTHER organizers' trips) can register. Admins cannot.
registrationsRouter.post('/trips/:id/register', requireAuth, validateBody(registrationCreateSchema), (req, res) => {
  if (req.user!.role === 'admin') throw forbidden('admin_cannot_register');
  const tripId = Number(req.params.id);
  const { seats, note } = req.body;
  // Whole check-and-insert is ONE synchronous transaction: two requests can never both take the last seats.
  const regId = db.transaction(() => {
    const row = getTripRow(tripId);
    if (!row || row.status === 'draft' || row.organizer_status !== 'approved') throw notFound();
    if (req.user!.role === 'organizer' && req.user!.organizerId === row.organizer_id) throw forbidden('own_trip');
    const eff = effectiveStatus(row);
    if (eff === 'cancelled') throw conflict('trip_cancelled');
    if (eff === 'completed') throw conflict('trip_past');
    if (eff === 'registration_closed') throw conflict('deadline_passed');
    if (eff === 'fully_booked') throw conflict('fully_booked');
    if (row.capacity - row.approved_seats < seats) throw conflict('not_enough_spaces');
    const dup = db.prepare("SELECT 1 FROM registrations WHERE trip_id=? AND user_id=? AND status IN ('pending','approved','waitlisted')").get(tripId, req.user!.id);
    if (dup) throw conflict('duplicate_registration');
    const r = db.prepare("INSERT INTO registrations (trip_id,user_id,seats,note) VALUES (?,?,?,?)").run(tripId, req.user!.id, seats, note || null);
    notify(req.user!.id, 'registration_submitted', { title: row.title }, `/trips/${tripId}`);
    notify(row.organizer_user_id, 'registration_received', { title: row.title, traveler: req.user!.full_name, seats }, `/organizer/trips/${tripId}/registrations`);
    return Number(r.lastInsertRowid);
  }).immediate();
  res.status(201).json({ registration: db.prepare('SELECT id,trip_id,seats,status,created_at FROM registrations WHERE id=?').get(regId) });
});

registrationsRouter.get('/registrations/mine', requireAuth, (req, res) => {
  const items = db.prepare(`SELECT r.id,r.trip_id,r.seats,r.status,r.note,r.created_at,t.title,t.trip_date,t.start_time,t.price,t.status AS trip_status,
      d.name AS destination_name, o.display_name AS organizer_name,
      EXISTS(SELECT 1 FROM reviews rv WHERE rv.trip_id=t.id AND rv.user_id=r.user_id) AS reviewed
    FROM registrations r JOIN trips t ON t.id=r.trip_id JOIN destinations d ON d.id=t.destination_id JOIN organizers o ON o.id=t.organizer_id
    WHERE r.user_id=? ORDER BY r.id DESC`).all(req.user!.id) as any[];
  res.json({ items: items.map((i) => ({ ...i, trip_effective_status: effectiveStatus({ ...i, capacity: 1, approved_seats: 0, registration_deadline: '9999', status: i.trip_status }), reviewed: !!i.reviewed })) });
});

registrationsRouter.patch('/registrations/:id/cancel', requireAuth, (req, res) => {
  const reg = db.prepare('SELECT * FROM registrations WHERE id=?').get(Number(req.params.id)) as any;
  if (!reg || reg.user_id !== req.user!.id) throw notFound();
  if (!['pending', 'approved', 'waitlisted'].includes(reg.status)) throw conflict('not_cancellable');
  const row = getTripRow(reg.trip_id);
  if (`${row.trip_date}T${row.start_time}` <= nowStr()) throw conflict('trip_past');
  db.prepare("UPDATE registrations SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(reg.id);
  notify(row.organizer_user_id, 'registration_cancelled', { title: row.title, traveler: req.user!.full_name }, `/organizer/trips/${row.id}/registrations`);
  res.json({ ok: true });
});

// Registrations for a trip (owner organizer or admin)
registrationsRouter.get('/trips/:id/registrations', requireRole('organizer', 'admin'), (req, res) => {
  const row = getTripRow(Number(req.params.id));
  if (!row) throw notFound();
  if (req.user!.role === 'organizer' && req.user!.organizerId !== row.organizer_id) throw forbidden();
  const items = db.prepare(`SELECT r.id,r.seats,r.status,r.note,r.created_at,r.decided_at,u.full_name,u.email,u.phone
    FROM registrations r JOIN users u ON u.id=r.user_id WHERE r.trip_id=? ORDER BY r.id`).all(row.id);
  res.json({ items, trip: { id: row.id, title: row.title, capacity: row.capacity, approved_seats: row.approved_seats, pending_seats: row.pending_seats } });
});

// Organizer-wide list
registrationsRouter.get('/registrations/manage', requireRole('organizer', 'admin'), (req, res) => {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '');
  const where: string[] = []; const args: any[] = [];
  if (req.user!.role === 'organizer') { where.push('t.organizer_id=?'); args.push(req.user!.organizerId); }
  if (status) { where.push('r.status=?'); args.push(status); }
  if (q) { where.push('(u.full_name LIKE ? OR u.email LIKE ? OR t.title LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const items = db.prepare(`SELECT r.id,r.trip_id,r.seats,r.status,r.note,r.created_at,t.title,t.trip_date,u.full_name,u.email,u.phone,o.display_name AS organizer_name
    FROM registrations r JOIN trips t ON t.id=r.trip_id JOIN users u ON u.id=r.user_id JOIN organizers o ON o.id=t.organizer_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.id DESC LIMIT 300`).all(...args);
  res.json({ items });
});

registrationsRouter.patch('/registrations/:id/decision', requireRole('organizer', 'admin'), validateBody(decisionSchema), (req, res) => {
  const { decision, note } = req.body;
  db.transaction(() => {
    const reg = db.prepare('SELECT * FROM registrations WHERE id=?').get(Number(req.params.id)) as any;
    if (!reg) throw notFound();
    const row = getTripRow(reg.trip_id);
    if (req.user!.role === 'organizer' && req.user!.organizerId !== row.organizer_id) throw forbidden(); // ownership
    if (req.user!.role === 'organizer' && req.user!.organizerStatus !== 'approved') throw forbidden('organizer_suspended');
    if (row.status === 'cancelled') throw conflict('trip_cancelled');
    if (decision === 'approved') {
      if (!['pending', 'waitlisted'].includes(reg.status)) throw conflict('invalid_transition');
      if (row.capacity - row.approved_seats < reg.seats) throw conflict('not_enough_spaces'); // capacity re-checked inside the transaction
    } else if (!['pending', 'approved', 'waitlisted'].includes(reg.status)) throw conflict('invalid_transition');
    db.prepare("UPDATE registrations SET status=?, decided_by=?, decided_at=datetime('now'), updated_at=datetime('now') WHERE id=?")
      .run(decision, req.user!.id, reg.id);
    notify(reg.user_id, decision === 'approved' ? 'registration_approved' : 'registration_rejected', { title: row.title, note: note || null }, `/trips/${row.id}`);
    audit(req, req.user!, `registration_${decision}`, 'registration', reg.id, { trip_id: row.id });
  }).immediate();
  res.json({ ok: true });
});

// ---------- Saved trips ----------
registrationsRouter.get('/saved', requireAuth, (req, res) => {
  const items = db.prepare(`SELECT t.id,t.title,t.trip_date,t.price,t.status,d.name AS destination_name,t.cover_image
    FROM saved_trips s JOIN trips t ON t.id=s.trip_id JOIN destinations d ON d.id=t.destination_id WHERE s.user_id=? ORDER BY s.created_at DESC`).all(req.user!.id);
  res.json({ items });
});
registrationsRouter.put('/saved/:tripId', requireAuth, (req, res) => {
  const row = getTripRow(Number(req.params.tripId));
  if (!row || row.status === 'draft') throw notFound();
  db.prepare('INSERT OR IGNORE INTO saved_trips (user_id,trip_id) VALUES (?,?)').run(req.user!.id, row.id);
  res.json({ saved: true });
});
registrationsRouter.delete('/saved/:tripId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM saved_trips WHERE user_id=? AND trip_id=?').run(req.user!.id, Number(req.params.tripId));
  res.json({ saved: false });
});

// ---------- Reviews ----------
registrationsRouter.post('/trips/:id/reviews', requireAuth, validateBody(reviewSchema), (req, res) => {
  const row = getTripRow(Number(req.params.id));
  if (!row) throw notFound();
  const reg = db.prepare("SELECT 1 FROM registrations WHERE trip_id=? AND user_id=? AND status='approved'").get(row.id, req.user!.id);
  if (!reg) throw forbidden('not_participant');            // only confirmed participants
  if (effectiveStatus(row) !== 'completed') throw conflict('trip_not_completed'); // only after the trip took place
  if (db.prepare('SELECT 1 FROM reviews WHERE trip_id=? AND user_id=?').get(row.id, req.user!.id)) throw conflict('already_reviewed');
  const r = db.prepare('INSERT INTO reviews (trip_id,destination_id,user_id,rating,comment) VALUES (?,?,?,?,?)')
    .run(row.id, row.destination_id, req.user!.id, req.body.rating, req.body.comment);
  notify(row.organizer_user_id, 'review_received', { title: row.title, rating: req.body.rating }, `/organizer/reviews`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
registrationsRouter.get('/reviews/eligible', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT t.id AS trip_id,t.title,t.trip_date,t.start_time,t.status FROM registrations r JOIN trips t ON t.id=r.trip_id
    WHERE r.user_id=? AND r.status='approved' AND t.status!='cancelled' AND t.status!='draft'
      AND (t.trip_date||'T'||t.start_time) <= ? AND NOT EXISTS (SELECT 1 FROM reviews v WHERE v.trip_id=t.id AND v.user_id=r.user_id)`)
    .all(req.user!.id, nowStr());
  res.json({ items: rows });
});
registrationsRouter.get('/reviews/organizer', requireRole('organizer'), (req, res) => {
  const items = db.prepare(`SELECT v.id,v.rating,v.comment,v.created_at,t.title,u.full_name AS reviewer FROM reviews v JOIN trips t ON t.id=v.trip_id
    JOIN users u ON u.id=v.user_id WHERE t.organizer_id=? AND v.status='visible' ORDER BY v.id DESC`).all(req.user!.organizerId);
  res.json({ items });
});
registrationsRouter.post('/reports', requireAuth, (req, res) => {
  const { target_type, target_id, reason } = req.body || {};
  if (!['review', 'trip', 'organizer'].includes(target_type) || !Number.isInteger(target_id) || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500) throw badRequest('validation_error');
  db.prepare('INSERT INTO reports (reporter_id,target_type,target_id,reason) VALUES (?,?,?,?)').run(req.user!.id, target_type, target_id, reason.trim());
  res.status(201).json({ ok: true });
});

// ---------- Notifications ----------
registrationsRouter.get('/notifications', requireAuth, (req, res) => {
  const items = (db.prepare('SELECT id,type,data,link,is_read,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.user!.id) as any[])
    .map((n) => ({ ...n, data: JSON.parse(n.data), is_read: !!n.is_read }));
  res.json({ items });
});
registrationsRouter.post('/notifications/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user!.id);
  res.json({ ok: true });
});
