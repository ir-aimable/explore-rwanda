import { Router, type Request } from 'express';
import { db } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { notify } from '../services/notifications/notify.js';
import { nowStr, todayStr } from '../lib/time.js';
import { receiveImage, removeUpload } from '../lib/upload.js';
import { tripSchema } from '../validators/schemas.js';
import { effectiveStatus, getTrip, getTripRow, listPublicTrips, listTripsRaw, shapeTrip, tripCosts, tripImages } from '../services/search/tripService.js';
import { getWeather } from '../services/weather.js';

export const tripsRouter = Router();
const num = (v: unknown) => (v === undefined || v === '' || isNaN(Number(v)) ? undefined : Number(v));

// ---------- Public ----------
tripsRouter.get('/', async (req, res) => {
  const q = req.query;
  const r = await listPublicTrips({
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
tripsRouter.get('/manage/mine', requireRole('organizer'), async (req, res) => {
  const rows = await listTripsRaw('WHERE t.organizer_id=? ORDER BY t.trip_date DESC', req.user!.organizerId);
  res.json({ items: rows.map((r) => shapeTrip(r, { includePrivate: true })) });
});
tripsRouter.get('/manage/all', requireRole('admin'), async (req, res) => {
  const rows = await listTripsRaw('ORDER BY t.trip_date DESC');
  res.json({ items: rows.map((r) => ({ ...shapeTrip(r, { includePrivate: true }), organizer_status: r.organizer_status })) });
});

tripsRouter.get('/:id', async (req, res) => {
  const row = await getTripRow(Number(req.params.id));
  if (!row || !canView(req, row)) throw notFound();
  const trip = shapeTrip(row, { includePrivate: isManager(req, row) });
  let my_registration = null;
  if (req.user) {
    my_registration = await db.prepare("SELECT id,status,seats FROM registrations WHERE trip_id=? AND user_id=? ORDER BY id DESC LIMIT 1").get(row.id, req.user.id) ?? null;
  }
  const saved = req.user ? !!await db.prepare('SELECT 1 FROM saved_trips WHERE user_id=? AND trip_id=?').get(req.user.id, row.id) : false;
  res.json({ trip: { ...trip, images: await tripImages(row.id), costs: await tripCosts(row.id, row.destination_id), my_registration, saved } });
});

tripsRouter.get('/:id/weather', async (req, res) => {
  const row = await getTripRow(Number(req.params.id));
  if (!row || !canView(req, row)) throw notFound();
  const lat = row.latitude ?? row.dest_lat, lng = row.longitude ?? row.dest_lng;
  res.json(await getWeather(lat, lng, row.trip_date, row.destination_name));
});

tripsRouter.get('/:id/reviews', async (req, res) => {
  const items = await db.prepare(`SELECT r.id,r.rating,r.comment,r.created_at,u.full_name AS reviewer
    FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.trip_id=? AND r.status='visible' ORDER BY r.id DESC`).all(Number(req.params.id));
  res.json({ items });
});

// ---------- Manage (organizer / admin) ----------
async function resolveOrganizerId(req: Request, bodyOrg?: number) {
  if (req.user!.role === 'admin') {
    if (!bodyOrg) throw badRequest('organizer_required');
    const o = await db.prepare("SELECT id,status FROM organizers WHERE id=?").get(bodyOrg) as any;
    if (!o) throw badRequest('organizer_not_found');
    return o.id as number;
  }
  if (req.user!.role !== 'organizer' || !req.user!.organizerId) throw forbidden('not_organizer');
  if (req.user!.organizerStatus !== 'approved') throw forbidden('organizer_suspended');
  return req.user!.organizerId;
}
async function checkRefs(b: any) {
  const d = await db.prepare('SELECT is_published FROM destinations WHERE id=?').get(b.destination_id) as any;
  if (!d) throw badRequest('destination_not_found');
  const c = await db.prepare('SELECT is_active FROM categories WHERE id=?').get(b.category_id) as any;
  if (!c) throw badRequest('category_not_found');
}
const COLS = ['destination_id', 'category_id', 'title', 'description', 'starting_location', 'meeting_point', 'latitude', 'longitude',
  'trip_date', 'start_time', 'duration_hours', 'price', 'transport_info', 'food_info', 'bring_items', 'difficulty', 'capacity',
  'registration_deadline', 'cancellation_policy'] as const;

tripsRouter.post('/', requireAuth, validateBody(tripSchema), async (req, res) => {
  const b = req.body;
  const organizerId = await resolveOrganizerId(req, b.organizer_id);
  await checkRefs(b);
  if (b.trip_date < todayStr()) throw badRequest('date_in_past');
  const r = await db.prepare(`INSERT INTO trips (organizer_id,${COLS.join(',')},currency,included_services,excluded_services,status)
    VALUES (?,${COLS.map(() => '?').join(',')},'RWF',?,?,?)`)
    .run(organizerId, ...COLS.map((c) => b[c] ?? null), JSON.stringify(b.included_services), JSON.stringify(b.excluded_services), b.status);
  const id = Number(r.lastInsertRowid);
  if (b.price > 0 || b.price === 0) {
    await db.prepare("INSERT INTO cost_records (trip_id,cost_type,label,amount,source_type,source_note) VALUES (?, 'package','Trip price',?,'organizer','Set by the organizer')")
      .run(id, b.price);
  }
  await audit(req, req.user!, 'trip_create', 'trip', id, { title: b.title, status: b.status });
  res.status(201).json({ trip: await getTrip(id, { includePrivate: true }) });
});

const IMPORTANT = ['trip_date', 'start_time', 'meeting_point', 'price', 'registration_deadline', 'destination_id', 'starting_location'] as const;

tripsRouter.put('/:id', requireAuth, validateBody(tripSchema), async (req, res) => {
  const row = await getTripRow(Number(req.params.id));
  if (!row) throw notFound();
  if (!isManager(req, row)) throw forbidden(); // ownership enforced server-side
  if (req.user!.role === 'organizer' && req.user!.organizerStatus !== 'approved') throw forbidden('organizer_suspended');
  if (['cancelled', 'completed'].includes(row.status) || effectiveStatus(row) === 'completed') throw conflict('trip_not_editable');
  const b = req.body;
  await checkRefs(b);
  if (b.status === 'published' && `${b.trip_date}T${b.start_time}` <= nowStr()) throw badRequest('date_in_past');
  if (b.capacity < row.approved_seats) throw badRequest('capacity_below_approved', `Capacity cannot be lower than ${row.approved_seats} approved seats`);
  const changed = IMPORTANT.filter((k) => String(b[k] ?? '') !== String(row[k] ?? ''));
  await db.transaction(async () => {
    await db.prepare(`UPDATE trips SET ${COLS.map((c) => `${c}=?`).join(',')}, included_services=?, excluded_services=?, status=?, updated_at=datetime('now') WHERE id=?`)
      .run(...COLS.map((c) => b[c] ?? null), JSON.stringify(b.included_services), JSON.stringify(b.excluded_services), b.status, row.id);
    if (b.price !== row.price) {
      await db.prepare("UPDATE cost_records SET amount=? WHERE trip_id=? AND cost_type='package' AND source_type='organizer'").run(b.price, row.id);
    }
    if (changed.length && row.status === 'published') {
      const regs = await db.prepare("SELECT user_id FROM registrations WHERE trip_id=? AND status IN ('pending','approved')").all(row.id) as any[];
      for (const r of regs) await notify(r.user_id, 'trip_updated', { title: b.title, fields: changed }, `/trips/${row.id}`);
    }
  });
  await audit(req, req.user!, 'trip_update', 'trip', row.id, { changed });
  res.json({ trip: await getTrip(row.id, { includePrivate: true }) });
});

function setStatus(action: 'publish' | 'unpublish' | 'cancel') {
  return async (req: Request, res: any) => {
    const row = await getTripRow(Number(req.params.id));
    if (!row) throw notFound();
    if (!isManager(req, row)) throw forbidden();
    if (req.user!.role === 'organizer' && req.user!.organizerStatus !== 'approved') throw forbidden('organizer_suspended');
    if (row.status === 'cancelled' || row.status === 'completed') throw conflict('trip_not_editable');
    if (action === 'publish') {
      if (`${row.trip_date}T${row.start_time}` <= nowStr()) throw badRequest('date_in_past');
      await db.prepare("UPDATE trips SET status='published', updated_at=datetime('now') WHERE id=?").run(row.id);
    } else if (action === 'unpublish') {
      await db.prepare("UPDATE trips SET status='draft', updated_at=datetime('now') WHERE id=?").run(row.id);
    } else {
      await db.transaction(async () => {
        await db.prepare("UPDATE trips SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(row.id);
        const regs = await db.prepare("SELECT user_id FROM registrations WHERE trip_id=? AND status IN ('pending','approved','waitlisted')").all(row.id) as any[];
        for (const r of regs) await notify(r.user_id, 'trip_cancelled', { title: row.title }, `/trips/${row.id}`);
      });
    }
    await audit(req, req.user!, `trip_${action}`, 'trip', row.id, { title: row.title });
    res.json({ trip: await getTrip(row.id, { includePrivate: true }) });
  };
}
tripsRouter.post('/:id/publish', requireAuth, setStatus('publish'));
tripsRouter.post('/:id/unpublish', requireAuth, setStatus('unpublish'));
tripsRouter.post('/:id/cancel', requireAuth, setStatus('cancel'));

tripsRouter.delete('/:id', requireAuth, async (req, res) => {
  const row = await getTripRow(Number(req.params.id));
  if (!row) throw notFound();
  if (!isManager(req, row)) throw forbidden();
  const active = (await db.prepare("SELECT COUNT(*) c FROM registrations WHERE trip_id=? AND status IN ('pending','approved','waitlisted')").get(row.id) as any).c;
  const force = req.user!.role === 'admin' && req.query.force === 'true';
  if (active > 0 && !force) throw conflict('trip_has_registrations');
  const imgs = await tripImages(row.id);
  await db.prepare('DELETE FROM trips WHERE id=?').run(row.id);
  await Promise.all([row.cover_image, ...imgs.map((i: any) => i.path)].map(removeUpload));
  await audit(req, req.user!, 'trip_delete', 'trip', row.id, { title: row.title, force });
  res.json({ ok: true });
});

tripsRouter.post('/:id/images', requireAuth, async (req, res) => {
  const row = await getTripRow(Number(req.params.id));
  if (!row) throw notFound();
  if (!isManager(req, row)) throw forbidden();
  const p = await receiveImage(req, res);
  if (req.query.cover === 'true' || !row.cover_image) {
    await removeUpload(row.cover_image);
    await db.prepare("UPDATE trips SET cover_image=?, updated_at=datetime('now') WHERE id=?").run(p, row.id);
  } else {
    await db.prepare('INSERT INTO trip_images (trip_id,path) VALUES (?,?)').run(row.id, p);
  }
  await audit(req, req.user!, 'trip_image_upload', 'trip', row.id);
  res.status(201).json({ path: p });
});
tripsRouter.delete('/:id/images/:imageId', requireAuth, async (req, res) => {
  const row = await getTripRow(Number(req.params.id));
  if (!row) throw notFound();
  if (!isManager(req, row)) throw forbidden();
  const img = await db.prepare('SELECT * FROM trip_images WHERE id=? AND trip_id=?').get(Number(req.params.imageId), row.id) as any;
  if (!img) throw notFound();
  await db.prepare('DELETE FROM trip_images WHERE id=?').run(img.id);
  await removeUpload(img.path);
  res.json({ ok: true });
});
