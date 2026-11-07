import { Router, type Request } from 'express';
import { db } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { notify } from '../services/notifications/notify.js';
import { nowStr, todayStr } from '../lib/time.js';
import { imageUpload, removeUpload, verifyImageFile } from '../lib/upload.js';
import { tripSchema } from '../validators/schemas.js';
import { effectiveStatus, getTrip, getTripRow, listPublicTrips, listTripsRaw, shapeTrip, tripCosts, tripImages } from '../services/search/tripService.js';
import { getWeather } from '../services/weather.js';

export const tripsRouter = Router();
const num = (v: unknown) => (v === undefined || v === '' || isNaN(Number(v)) ? undefined : Number(v));

// ---------- Public ----------
tripsRouter.get('/', (req, res) => {
  const q = req.query;
  const r = listPublicTrips({
    q: (q.q as string) || undefined, category: (q.category as string) || undefined,
    destinationId: num(q.destination_id), destination: (q.destination as string) || undefined,
    maxPrice: num(q.max_price), minPrice: num(q.min_price), date: (q.date as string) || undefined,
    dateFrom: (q.date_from as string) || undefined, dateTo: (q.date_to as string) || undefined,
    minSeats: num(q.min_seats), availableOnly: q.available === '1' || q.available === 'true',
    sort: (q.sort as any) || 'date', limit: num(q.limit), offset: num(q.offset),
  });
  res.json(r);
});

/** Can this requester see this trip? Public: published/cancelled/completed of approved organizers. */
function canView(req: Request, row: any) {
  if (req.user?.role === 'admin') return true;
  if (req.user?.role === 'organizer' && req.user.organizerId === row.organizer_id) return true;
  return row.status !== 'draft' && row.organizer_status === 'approved';
}
function isManager(req: Request, row: any) {
  return req.user?.role === 'admin' || (req.user?.role === 'organizer' && req.user.organizerId === row.organizer_id);
}

// Manager lists (declared before /:id)
tripsRouter.get('/manage/mine', requireRole('organizer'), (req, res) => {
  const rows = listTripsRaw('WHERE t.organizer_id=? ORDER BY t.trip_date DESC', req.user!.organizerId);
  res.json({ items: rows.map((r) => shapeTrip(r, { includePrivate: true })) });
});
tripsRouter.get('/manage/all', requireRole('admin'), (req, res) => {
  const rows = listTripsRaw('ORDER BY t.trip_date DESC');
  res.json({ items: rows.map((r) => ({ ...shapeTrip(r, { includePrivate: true }), organizer_status: r.organizer_status })) });
});

tripsRouter.get('/:id', (req, res) => {
  const row = getTripRow(Number(req.params.id));
  if (!row || !canView(req, row)) throw notFound();
  const trip = shapeTrip(row, { includePrivate: isManager(req, row) });
  let my_registration = null;
  if (req.user) {
    my_registration = db.prepare("SELECT id,status,seats FROM registrations WHERE trip_id=? AND user_id=? ORDER BY id DESC LIMIT 1").get(row.id, req.user.id) ?? null;
  }
  const saved = req.user ? !!db.prepare('SELECT 1 FROM saved_trips WHERE user_id=? AND trip_id=?').get(req.user.id, row.id) : false;
  res.json({ trip: { ...trip, images: tripImages(row.id), costs: tripCosts(row.id, row.destination_id), my_registration, saved } });
});

tripsRouter.get('/:id/weather', async (req, res) => {
  const row = getTripRow(Number(req.params.id));
  if (!row || !canView(req, row)) throw notFound();
  const lat = row.latitude ?? row.dest_lat, lng = row.longitude ?? row.dest_lng;
  res.json(await getWeather(lat, lng, row.trip_date, row.destination_name));
});

tripsRouter.get('/:id/reviews', (req, res) => {
  const items = db.prepare(`SELECT r.id,r.rating,r.comment,r.created_at,u.full_name AS reviewer
    FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.trip_id=? AND r.status='visible' ORDER BY r.id DESC`).all(Number(req.params.id));
  res.json({ items });
});

// ---------- Manage (organizer / admin) ----------
function resolveOrganizerId(req: Request, bodyOrg?: number) {
  if (req.user!.role === 'admin') {
    if (!bodyOrg) throw badRequest('organizer_required');
    const o = db.prepare("SELECT id,status FROM organizers WHERE id=?").get(bodyOrg) as any;
    if (!o) throw badRequest('organizer_not_found');
    return o.id as number;
  }
  if (req.user!.role !== 'organizer' || !req.user!.organizerId) throw forbidden('not_organizer');
  if (req.user!.organizerStatus !== 'approved') throw forbidden('organizer_suspended');
  return req.user!.organizerId;
}
function checkRefs(b: any) {
  const d = db.prepare('SELECT is_published FROM destinations WHERE id=?').get(b.destination_id) as any;
  if (!d) throw badRequest('destination_not_found');
  const c = db.prepare('SELECT is_active FROM categories WHERE id=?').get(b.category_id) as any;
  if (!c) throw badRequest('category_not_found');
}
const COLS = ['destination_id', 'category_id', 'title', 'description', 'starting_location', 'meeting_point', 'latitude', 'longitude',
  'trip_date', 'start_time', 'duration_hours', 'price', 'transport_info', 'food_info', 'bring_items', 'difficulty', 'capacity',
  'registration_deadline', 'cancellation_policy'] as const;

tripsRouter.post('/', requireAuth, validateBody(tripSchema), (req, res) => {
  const b = req.body;
  const organizerId = resolveOrganizerId(req, b.organizer_id);
  checkRefs(b);
  if (b.trip_date < todayStr()) throw badRequest('date_in_past');
  const r = db.prepare(`INSERT INTO trips (organizer_id,${COLS.join(',')},currency,included_services,excluded_services,status)
    VALUES (?,${COLS.map(() => '?').join(',')},'RWF',?,?,?)`)
    .run(organizerId, ...COLS.map((c) => b[c] ?? null), JSON.stringify(b.included_services), JSON.stringify(b.excluded_services), b.status);
  const id = Number(r.lastInsertRowid);
  if (b.price > 0 || b.price === 0) {
    db.prepare("INSERT INTO cost_records (trip_id,cost_type,label,amount,source_type,source_note) VALUES (?, 'package','Trip price',?,'organizer','Set by the organizer')")
      .run(id, b.price);
  }
  audit(req, req.user!, 'trip_create', 'trip', id, { title: b.title, status: b.status });
  res.status(201).json({ trip: getTrip(id, { includePrivate: true }) });
});

const IMPORTANT = ['trip_date', 'start_time', 'meeting_point', 'price', 'registration_deadline', 'destination_id', 'starting_location'] as const;

tripsRouter.put('/:id', requireAuth, validateBody(tripSchema), (req, res) => {
  const row = getTripRow(Number(req.params.id));
  if (!row) throw notFound();
  if (!isManager(req, row)) throw forbidden(); // ownership enforced server-side
  if (req.user!.role === 'organizer' && req.user!.organizerStatus !== 'approved') throw forbidden('organizer_suspended');
  if (['cancelled', 'completed'].includes(row.status) || effectiveStatus(row) === 'completed') throw conflict('trip_not_editable');
  const b = req.body;
  checkRefs(b);
  if (b.status === 'published' && `${b.trip_date}T${b.start_time}` <= nowStr()) throw badRequest('date_in_past');
  if (b.capacity < row.approved_seats) throw badRequest('capacity_below_approved', `Capacity cannot be lower than ${row.approved_seats} approved seats`);
  const changed = IMPORTANT.filter((k) => String(b[k] ?? '') !== String(row[k] ?? ''));
  db.transaction(() => {
    db.prepare(`UPDATE trips SET ${COLS.map((c) => `${c}=?`).join(',')}, included_services=?, excluded_services=?, status=?, updated_at=datetime('now') WHERE id=?`)
      .run(...COLS.map((c) => b[c] ?? null), JSON.stringify(b.included_services), JSON.stringify(b.excluded_services), b.status, row.id);
    if (b.price !== row.price) {
      db.prepare("UPDATE cost_records SET amount=? WHERE trip_id=? AND cost_type='package' AND source_type='organizer'").run(b.price, row.id);
    }
    if (changed.length && row.status === 'published') {
      const regs = db.prepare("SELECT user_id FROM registrations WHERE trip_id=? AND status IN ('pending','approved')").all(row.id) as any[];
      regs.forEach((r) => notify(r.user_id, 'trip_updated', { title: b.title, fields: changed }, `/trips/${row.id}`));
    }
  })();
  audit(req, req.user!, 'trip_update', 'trip', row.id, { changed });
  res.json({ trip: getTrip(row.id, { includePrivate: true }) });
});

function setStatus(action: 'publish' | 'unpublish' | 'cancel') {
  return (req: Request, res: any) => {
    const row = getTripRow(Number(req.params.id));
    if (!row) throw notFound();
    if (!isManager(req, row)) throw forbidden();
    if (req.user!.role === 'organizer' && req.user!.organizerStatus !== 'approved') throw forbidden('organizer_suspended');
    if (row.status === 'cancelled' || row.status === 'completed') throw conflict('trip_not_editable');
    if (action === 'publish') {
      if (`${row.trip_date}T${row.start_time}` <= nowStr()) throw badRequest('date_in_past');
      db.prepare("UPDATE trips SET status='published', updated_at=datetime('now') WHERE id=?").run(row.id);
    } else if (action === 'unpublish') {
      db.prepare("UPDATE trips SET status='draft', updated_at=datetime('now') WHERE id=?").run(row.id);
    } else {
      db.transaction(() => {
        db.prepare("UPDATE trips SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(row.id);
        const regs = db.prepare("SELECT user_id FROM registrations WHERE trip_id=? AND status IN ('pending','approved','waitlisted')").all(row.id) as any[];
        regs.forEach((r) => notify(r.user_id, 'trip_cancelled', { title: row.title }, `/trips/${row.id}`));
      })();
    }
    audit(req, req.user!, `trip_${action}`, 'trip', row.id, { title: row.title });
    res.json({ trip: getTrip(row.id, { includePrivate: true }) });
  };
}
tripsRouter.post('/:id/publish', requireAuth, setStatus('publish'));
tripsRouter.post('/:id/unpublish', requireAuth, setStatus('unpublish'));
tripsRouter.post('/:id/cancel', requireAuth, setStatus('cancel'));

tripsRouter.delete('/:id', requireAuth, (req, res) => {
  const row = getTripRow(Number(req.params.id));
  if (!row) throw notFound();
  if (!isManager(req, row)) throw forbidden();
  const active = (db.prepare("SELECT COUNT(*) c FROM registrations WHERE trip_id=? AND status IN ('pending','approved','waitlisted')").get(row.id) as any).c;
  const force = req.user!.role === 'admin' && req.query.force === 'true';
  if (active > 0 && !force) throw conflict('trip_has_registrations');
  const imgs = tripImages(row.id);
  db.prepare('DELETE FROM trips WHERE id=?').run(row.id);
  [row.cover_image, ...imgs.map((i: any) => i.path)].forEach(removeUpload);
  audit(req, req.user!, 'trip_delete', 'trip', row.id, { title: row.title, force });
  res.json({ ok: true });
});

tripsRouter.post('/:id/images', requireAuth, (req, res, next) => {
  const row = getTripRow(Number(req.params.id));
  if (!row) return next(notFound());
  if (!isManager(req, row)) return next(forbidden());
  imageUpload(req, res, (err: any) => {
    if (err) return next(err.code === 'LIMIT_FILE_SIZE' ? badRequest('file_too_large') : err);
    if (!req.file) return next(badRequest('file_required'));
    if (!verifyImageFile(req.file.path)) { removeUpload('/uploads/' + req.file.filename); return next(badRequest('invalid_file_type')); }
    const p = '/uploads/' + req.file.filename;
    if (req.query.cover === 'true' || !row.cover_image) {
      removeUpload(row.cover_image);
      db.prepare("UPDATE trips SET cover_image=?, updated_at=datetime('now') WHERE id=?").run(p, row.id);
    } else {
      db.prepare('INSERT INTO trip_images (trip_id,path) VALUES (?,?)').run(row.id, p);
    }
    audit(req, req.user!, 'trip_image_upload', 'trip', row.id);
    res.status(201).json({ path: p });
  });
});
tripsRouter.delete('/:id/images/:imageId', requireAuth, (req, res) => {
  const row = getTripRow(Number(req.params.id));
  if (!row) throw notFound();
  if (!isManager(req, row)) throw forbidden();
  const img = db.prepare('SELECT * FROM trip_images WHERE id=? AND trip_id=?').get(Number(req.params.imageId), row.id) as any;
  if (!img) throw notFound();
  db.prepare('DELETE FROM trip_images WHERE id=?').run(img.id);
  removeUpload(img.path);
  res.json({ ok: true });
});
