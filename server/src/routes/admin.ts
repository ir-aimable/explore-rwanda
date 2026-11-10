import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { notify } from '../services/notifications/notify.js';
import { receiveImage, removeUpload } from '../lib/upload.js';
import { nowStr, todayStr } from '../lib/time.js';
import { getTripRow } from '../services/search/tripService.js';
import { closestHubs, loadTransport } from '../services/geo/transport.js';
import { FARE_PER_KM, ROAD_FACTOR, fareForKm, findPlace, roadKm } from '../services/geo/rwanda.js';
import { invalidateLexicon } from '../services/search/discovery.js';
import { adminUserCreateSchema, announcementSchema, categorySchema, costSchema, destinationSchema } from '../validators/schemas.js';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

const activeAdmins = async () => (await db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND is_active=1").get() as any).c as number;
const one = async (sql: string, ...a: any[]) => (await db.prepare(sql).get(...a) as any);

// ---------- Dashboard ----------
adminRouter.get('/stats', async (_req, res) => {
  const now = nowStr();
  const s = {
    users_total: (await one('SELECT COUNT(*) c FROM users')).c,
    travelers: (await one("SELECT COUNT(*) c FROM users WHERE role='traveler'")).c,
    organizers: (await one("SELECT COUNT(*) c FROM organizers")).c,
    admins: (await one("SELECT COUNT(*) c FROM users WHERE role='admin'")).c,
    pending_applications: (await one("SELECT COUNT(*) c FROM organizer_applications WHERE status='pending'")).c,
    approved_organizers: (await one("SELECT COUNT(*) c FROM organizers WHERE status='approved'")).c,
    suspended_organizers: (await one("SELECT COUNT(*) c FROM organizers WHERE status='suspended'")).c,
    trips_total: (await one('SELECT COUNT(*) c FROM trips')).c,
    trips_published: (await one("SELECT COUNT(*) c FROM trips WHERE status='published'")).c,
    trips_upcoming: (await one("SELECT COUNT(*) c FROM trips WHERE status='published' AND (trip_date||'T'||start_time) > ?", now)).c,
    trips_completed: (await one("SELECT COUNT(*) c FROM trips WHERE status='completed' OR (status='published' AND (trip_date||'T'||start_time) <= ?)", now)).c,
    trips_cancelled: (await one("SELECT COUNT(*) c FROM trips WHERE status='cancelled'")).c,
    registrations_total: (await one('SELECT COUNT(*) c FROM registrations')).c,
    registrations_pending: (await one("SELECT COUNT(*) c FROM registrations WHERE status='pending'")).c,
    registrations_approved: (await one("SELECT COUNT(*) c FROM registrations WHERE status='approved'")).c,
    open_support: (await one("SELECT COUNT(*) c FROM support_requests WHERE status!='resolved'")).c,
    open_reports: (await one("SELECT COUNT(*) c FROM reports WHERE status='open'")).c,
  };
  const recent = await db.prepare('SELECT id,actor_email,action,entity,entity_id,created_at FROM audit_logs ORDER BY id DESC LIMIT 10').all();
  const recentRegs = await db.prepare(`SELECT r.id,r.status,r.created_at,u.full_name,t.title FROM registrations r JOIN users u ON u.id=r.user_id JOIN trips t ON t.id=r.trip_id ORDER BY r.id DESC LIMIT 8`).all();
  res.json({ stats: s, recent_audit: recent, recent_registrations: recentRegs });
});

// ---------- Users ----------
adminRouter.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim(); const role = String(req.query.role || ''); const active = String(req.query.active || '');
  const where: string[] = []; const args: any[] = [];
  if (q) { where.push('(full_name LIKE ? OR email LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (role) { where.push('role=?'); args.push(role); }
  if (active !== '') { where.push('is_active=?'); args.push(active === '1' ? 1 : 0); }
  const items = await db.prepare(`SELECT id,full_name,email,phone,role,is_active,is_demo,created_at FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 300`).all(...args);
  res.json({ items });
});
adminRouter.post('/users', validateBody(adminUserCreateSchema), async (req, res) => {
  const b = req.body;
  if (await db.prepare('SELECT 1 FROM users WHERE email=?').get(b.email)) throw conflict('email_taken');
  const r = await db.prepare('INSERT INTO users (full_name,email,phone,password_hash,role) VALUES (?,?,?,?,?)')
    .run(b.full_name, b.email, b.phone || null, bcrypt.hashSync(b.password, 12), b.role);
  await audit(req, req.user!, 'user_create', 'user', Number(r.lastInsertRowid), { role: b.role });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
adminRouter.patch('/users/:id/active', async (req, res) => {
  const id = Number(req.params.id); const active = !!req.body?.is_active;
  const u = await one('SELECT * FROM users WHERE id=?', id); if (!u) throw notFound();
  if (id === req.user!.id) throw badRequest('cannot_modify_self');
  if (u.role === 'admin' && !active && await activeAdmins() <= 1) throw conflict('last_admin');
  await db.prepare("UPDATE users SET is_active=?, updated_at=datetime('now') WHERE id=?").run(active ? 1 : 0, id);
  await audit(req, req.user!, active ? 'user_activate' : 'user_deactivate', 'user', id, { email: u.email });
  res.json({ ok: true });
});
// Only an administrator can grant/revoke admin. Organizers are managed through the organizer workflow.
adminRouter.patch('/users/:id/role', async (req, res) => {
  const id = Number(req.params.id); const role = req.body?.role;
  if (!['admin', 'traveler'].includes(role)) throw badRequest('validation_error');
  const u = await one('SELECT * FROM users WHERE id=?', id); if (!u) throw notFound();
  if (id === req.user!.id) throw badRequest('cannot_modify_self');
  if (u.role === 'organizer') throw conflict('use_organizer_workflow');
  if (u.role === 'admin' && role !== 'admin' && await activeAdmins() <= 1) throw conflict('last_admin');
  await db.prepare("UPDATE users SET role=?, updated_at=datetime('now') WHERE id=?").run(role, id);
  await audit(req, req.user!, role === 'admin' ? 'admin_grant' : 'admin_revoke', 'user', id, { email: u.email });
  res.json({ ok: true });
});
/** Retention rule: personal data is deleted; audit log rows are kept (actor_email retained, actor_id nulled). */
adminRouter.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const u = await one('SELECT * FROM users WHERE id=?', id); if (!u) throw notFound();
  if (id === req.user!.id) throw badRequest('cannot_modify_self');
  if (u.role === 'admin' && await activeAdmins() <= 1) throw conflict('last_admin');
  const orgTrips = (await one(`SELECT COUNT(*) c FROM trips t JOIN organizers o ON o.id=t.organizer_id WHERE o.user_id=?`, id)).c;
  if (orgTrips > 0) throw conflict('organizer_has_trips');
  await db.prepare('DELETE FROM users WHERE id=?').run(id);
  await audit(req, req.user!, 'user_delete', 'user', id, { email: u.email, role: u.role });
  res.json({ ok: true });
});

// ---------- Organizer applications & organizers ----------
adminRouter.get('/applications', async (req, res) => {
  const st = String(req.query.status || '');
  const items = await db.prepare(`SELECT * FROM organizer_applications ${st ? 'WHERE status=?' : ''} ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC`).all(...(st ? [st] : []));
  res.json({ items });
});
adminRouter.post('/applications/:id/approve', async (req, res) => {
  await db.transaction(async () => {
    const a = await one('SELECT * FROM organizer_applications WHERE id=?', Number(req.params.id)); if (!a) throw notFound();
    if (a.status !== 'pending') throw conflict('not_pending');
    const u = await one('SELECT * FROM users WHERE id=?', a.user_id);
    if (u.role === 'admin') throw conflict('already_privileged');
    await db.prepare("UPDATE organizer_applications SET status='approved', reviewed_by=?, reviewed_at=datetime('now'), review_note=?, updated_at=datetime('now') WHERE id=?")
      .run(req.user!.id, req.body?.note ?? null, a.id);
    await db.prepare("INSERT INTO organizers (user_id,application_id,display_name,location,contact_phone,contact_email,bio) VALUES (?,?,?,?,?,?,?)")
      .run(a.user_id, a.id, a.organizer_name, a.location, a.phone, a.email, a.experience);
    await db.prepare("UPDATE users SET role='organizer', updated_at=datetime('now') WHERE id=?").run(a.user_id);
    await notify(a.user_id, 'application_approved', { name: a.organizer_name }, '/organizer');
    await audit(req, req.user!, 'organizer_approve', 'application', a.id, { organizer: a.organizer_name });
  });
  res.json({ ok: true });
});
adminRouter.post('/applications/:id/reject', async (req, res) => {
  const a = await one('SELECT * FROM organizer_applications WHERE id=?', Number(req.params.id)); if (!a) throw notFound();
  if (a.status !== 'pending') throw conflict('not_pending');
  await db.prepare("UPDATE organizer_applications SET status='rejected', reviewed_by=?, reviewed_at=datetime('now'), review_note=?, updated_at=datetime('now') WHERE id=?")
    .run(req.user!.id, String(req.body?.note || '').slice(0, 500) || null, a.id);
  await notify(a.user_id, 'application_rejected', { name: a.organizer_name, note: req.body?.note || null });
  await audit(req, req.user!, 'organizer_reject', 'application', a.id, { organizer: a.organizer_name });
  res.json({ ok: true });
});
adminRouter.get('/organizers', async (_req, res) => {
  const items = await db.prepare(`SELECT o.id,o.user_id,o.display_name,o.location,o.status,o.created_at,u.email,u.full_name,u.phone,u.role,u.is_active,
      (SELECT COUNT(*) FROM trips t WHERE t.organizer_id=o.id) AS trips FROM organizers o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`).all();
  res.json({ items });
});
adminRouter.post('/organizers', validateBody(adminUserCreateSchema.extend({ display_name: z.string().trim().min(2).max(120) })), async (req, res) => {
  const b = req.body;
  if (await db.prepare('SELECT 1 FROM users WHERE email=?').get(b.email)) throw conflict('email_taken');
  const id = await db.transaction(async () => {
    const u = await db.prepare("INSERT INTO users (full_name,email,phone,password_hash,role) VALUES (?,?,?,?, 'organizer')")
      .run(b.full_name, b.email, b.phone || null, bcrypt.hashSync(b.password, 12));
    const o = await db.prepare("INSERT INTO organizers (user_id,display_name,contact_email,contact_phone) VALUES (?,?,?,?)")
      .run(u.lastInsertRowid, b.display_name, b.email, b.phone || null);
    return Number(o.lastInsertRowid);
  });
  await audit(req, req.user!, 'organizer_create', 'organizer', id, { email: b.email });
  res.status(201).json({ id });
});
adminRouter.patch('/organizers/:id/status', async (req, res) => {
  const st = req.body?.status; if (!['approved', 'suspended'].includes(st)) throw badRequest('validation_error');
  const o = await one('SELECT * FROM organizers WHERE id=?', Number(req.params.id)); if (!o) throw notFound();
  await db.transaction(async () => {
    await db.prepare("UPDATE organizers SET status=?, updated_at=datetime('now') WHERE id=?").run(st, o.id);
    if (st === 'approved') await db.prepare("UPDATE users SET role='organizer' WHERE id=? AND role!='admin'").run(o.user_id);
    if (o.application_id) await db.prepare("UPDATE organizer_applications SET status=? WHERE id=?").run(st === 'approved' ? 'approved' : 'suspended', o.application_id);
    await notify(o.user_id, st === 'approved' ? 'organizer_reactivated' : 'organizer_suspended', { name: o.display_name });
  });
  await audit(req, req.user!, st === 'approved' ? 'organizer_reactivate' : 'organizer_suspend', 'organizer', o.id, { name: o.display_name });
  res.json({ ok: true });
});
/** Revoke organizer access entirely: role goes back to traveler; record and trips are kept but hidden. */
adminRouter.delete('/organizers/:id', async (req, res) => {
  const o = await one('SELECT * FROM organizers WHERE id=?', Number(req.params.id)); if (!o) throw notFound();
  await db.transaction(async () => {
    await db.prepare("UPDATE organizers SET status='suspended', updated_at=datetime('now') WHERE id=?").run(o.id);
    await db.prepare("UPDATE users SET role='traveler' WHERE id=? AND role='organizer'").run(o.user_id);
  });
  await audit(req, req.user!, 'organizer_revoke', 'organizer', o.id, { name: o.display_name });
  res.json({ ok: true });
});

// ---------- Destinations ----------
const saveDestCats = async (id: number, ids: number[]) => {
  await db.prepare('DELETE FROM destination_categories WHERE destination_id=?').run(id);
  const ins = db.prepare('INSERT OR IGNORE INTO destination_categories (destination_id,category_id) VALUES (?,?)');
  for (const c of ids) { if (await db.prepare('SELECT 1 FROM categories WHERE id=?').get(c)) await ins.run(id, c); }
};
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
adminRouter.get('/destinations', async (_req, res) => {
  const items = await db.prepare('SELECT * FROM destinations ORDER BY name').all() as any[];
  const links = await db.prepare('SELECT destination_id,category_id FROM destination_categories').all();
  res.json({ items: items.map((d) => ({ ...d, category_ids: links.filter((r) => r.destination_id === d.id).map((r) => r.category_id) })) });
});
adminRouter.post('/destinations', validateBody(destinationSchema), async (req, res) => {
  const b = req.body;
  let slug = slugify(b.name); if (await one('SELECT 1 x FROM destinations WHERE slug=?', slug)) slug += '-' + Date.now().toString(36);
  const id = await db.transaction(async () => {
    const r = await db.prepare('INSERT INTO destinations (name,slug,region,description_rw,description_en,latitude,longitude,is_published) VALUES (?,?,?,?,?,?,?,?)')
      .run(b.name, slug, b.region, b.description_rw, b.description_en, b.latitude ?? null, b.longitude ?? null, b.is_published ? 1 : 0);
    await saveDestCats(Number(r.lastInsertRowid), b.category_ids);
    return Number(r.lastInsertRowid);
  });
  await audit(req, req.user!, 'destination_create', 'destination', id, { name: b.name });
  res.status(201).json({ id });
});
adminRouter.put('/destinations/:id', validateBody(destinationSchema), async (req, res) => {
  const b = req.body; const id = Number(req.params.id);
  if (!await one('SELECT 1 x FROM destinations WHERE id=?', id)) throw notFound();
  await db.transaction(async () => {
    await db.prepare("UPDATE destinations SET name=?,region=?,description_rw=?,description_en=?,latitude=?,longitude=?,is_published=?,updated_at=datetime('now') WHERE id=?")
      .run(b.name, b.region, b.description_rw, b.description_en, b.latitude ?? null, b.longitude ?? null, b.is_published ? 1 : 0, id);
    await saveDestCats(id, b.category_ids);
  });
  await audit(req, req.user!, 'destination_update', 'destination', id, { name: b.name });
  res.json({ ok: true });
});
adminRouter.delete('/destinations/:id', async (req, res) => {
  const id = Number(req.params.id); const d = await one('SELECT * FROM destinations WHERE id=?', id); if (!d) throw notFound();
  if ((await one('SELECT COUNT(*) c FROM trips WHERE destination_id=?', id)).c > 0) throw conflict('destination_has_trips');
  await db.prepare('DELETE FROM destinations WHERE id=?').run(id); await removeUpload(d.image_path);
  await audit(req, req.user!, 'destination_delete', 'destination', id, { name: d.name });
  res.json({ ok: true });
});
adminRouter.post('/destinations/:id/image', async (req, res) => {
  const d = await one('SELECT * FROM destinations WHERE id=?', Number(req.params.id)); if (!d) throw notFound();
  const p = await receiveImage(req, res);
  await removeUpload(d.image_path);
  await db.prepare("UPDATE destinations SET image_path=?, updated_at=datetime('now') WHERE id=?").run(p, d.id);
  await audit(req, req.user!, 'destination_image', 'destination', d.id);
  res.status(201).json({ path: p });
});

// ---------- Categories ----------
// ---------- Transport fares (public transport, used by the assistant when a trip price excludes transport) ----------
adminRouter.get('/transport', async (_req, res) => {
  const data = await loadTransport();
  const dests = [...data.dests.values()].sort((a, b) => a.name.localeCompare(b.name));
  const estimates: { destination_id: number; hub_id: number; km: number; amount: number }[] = [];
  for (const d of dests) for (const h of data.hubs) if (d.point && h.point) { const km = roadKm(h.point, d.point); estimates.push({ destination_id: d.id, hub_id: h.id, km, amount: fareForKm(km) }); }
  res.json({
    hubs: data.hubs.map((h) => ({ id: h.id, name: h.name, is_default: h.is_default, located: !!h.point })),
    destinations: dests.map((d) => ({ id: d.id, name: d.name, region: d.region, located: !!d.point,
      closest: closestHubs(data, d.id).slice(0, 2).map((h) => ({ id: h.id, name: h.name, km: h.km })) })),
    fares: [...data.fares.entries()].map(([k, amount]) => { const [destination_id, hub_id] = k.split(':').map(Number); return { destination_id, hub_id, amount }; }),
    estimates, fare_per_km: FARE_PER_KM, road_factor: ROAD_FACTOR,
  });
});
const fareSchema = z.object({ fares: z.array(z.object({
  destination_id: z.number().int().positive(), hub_id: z.number().int().positive(), amount: z.number().int().min(0).max(1_000_000).nullable(),
})).min(1).max(5000) });
adminRouter.put('/transport/fares', validateBody(fareSchema), async (req, res) => {
  const list = req.body.fares as { destination_id: number; hub_id: number; amount: number | null }[];
  let saved = 0, cleared = 0;
  await db.transaction(async () => {
    for (const f of list) {
      if (!await one('SELECT 1 x FROM destinations WHERE id=?', f.destination_id) || !await one('SELECT 1 x FROM transport_hubs WHERE id=?', f.hub_id)) throw notFound();
      if (f.amount == null) { cleared += (await db.prepare('DELETE FROM hub_fares WHERE destination_id=? AND hub_id=?').run(f.destination_id, f.hub_id)).changes; continue; }
      await db.prepare(`INSERT INTO hub_fares (destination_id,hub_id,amount,updated_by,updated_at) VALUES (?,?,?,?,datetime('now'))
        ON CONFLICT(destination_id,hub_id) DO UPDATE SET amount=excluded.amount, updated_by=excluded.updated_by, updated_at=excluded.updated_at`).run(f.destination_id, f.hub_id, f.amount, req.user!.id);
      saved++;
    }
  });
  await audit(req, req.user!, 'hub_fares_update', 'hub_fares', undefined, { saved, cleared });
  res.json({ saved, cleared });
});
// Coordinates must be inside Rwanda (with a small margin)
const hubSchema = z.object({
  name: z.string().trim().min(2).max(40),
  latitude: z.number().min(-2.95).max(-1.0).nullable().optional(),
  longitude: z.number().min(28.8).max(31.0).nullable().optional(),
}).refine((b) => (b.latitude == null) === (b.longitude == null), { message: 'Give both latitude and longitude', path: ['latitude'] });
adminRouter.post('/transport/hubs', validateBody(hubSchema), async (req, res) => {
  const b = req.body;
  if (await one('SELECT 1 x FROM transport_hubs WHERE name=? COLLATE NOCASE', b.name)) throw conflict('hub_exists');
  // Known Rwandan places are located automatically from the built-in map
  const p = b.latitude == null ? findPlace(b.name) : undefined;
  const lat = b.latitude ?? p?.lat ?? null, lng = b.longitude ?? p?.lng ?? null;
  const r = await db.prepare('INSERT INTO transport_hubs (name,latitude,longitude,is_default,sort_order) VALUES (?,?,?,0,100)').run(b.name, lat, lng);
  invalidateLexicon();
  await audit(req, req.user!, 'transport_hub_create', 'transport_hub', Number(r.lastInsertRowid), { name: b.name, located: lat != null });
  res.status(201).json({ id: Number(r.lastInsertRowid), located: lat != null, matched: p?.name ?? null });
});
adminRouter.delete('/transport/hubs/:id', async (req, res) => {
  const id = Number(req.params.id);
  const h = await one('SELECT * FROM transport_hubs WHERE id=?', id);
  if (!h) throw notFound();
  if (h.is_default) throw forbidden('default_hub');
  await db.prepare('DELETE FROM transport_hubs WHERE id=?').run(id);
  invalidateLexicon();
  await audit(req, req.user!, 'transport_hub_delete', 'transport_hub', id, { name: h.name });
  res.json({ ok: true });
});

adminRouter.get('/categories', async (_req, res) => res.json({ items: await db.prepare('SELECT * FROM categories ORDER BY id').all() }));
adminRouter.post('/categories', validateBody(categorySchema), async (req, res) => {
  const b = req.body; if (await one('SELECT 1 x FROM categories WHERE slug=?', b.slug)) throw conflict('slug_taken');
  const r = await db.prepare('INSERT INTO categories (slug,name_rw,name_en,is_active) VALUES (?,?,?,?)').run(b.slug, b.name_rw, b.name_en, b.is_active ? 1 : 0);
  await audit(req, req.user!, 'category_create', 'category', Number(r.lastInsertRowid), b);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
adminRouter.put('/categories/:id', validateBody(categorySchema), async (req, res) => {
  const b = req.body; const id = Number(req.params.id);
  if (!await one('SELECT 1 x FROM categories WHERE id=?', id)) throw notFound();
  if (await one('SELECT 1 x FROM categories WHERE slug=? AND id!=?', b.slug, id)) throw conflict('slug_taken');
  await db.prepare('UPDATE categories SET slug=?,name_rw=?,name_en=?,is_active=? WHERE id=?').run(b.slug, b.name_rw, b.name_en, b.is_active ? 1 : 0, id);
  await audit(req, req.user!, 'category_update', 'category', id, b);
  res.json({ ok: true });
});
adminRouter.delete('/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  if ((await one('SELECT COUNT(*) c FROM trips WHERE category_id=?', id)).c > 0) throw conflict('category_in_use');
  await db.prepare('DELETE FROM categories WHERE id=?').run(id);
  await audit(req, req.user!, 'category_delete', 'category', id);
  res.json({ ok: true });
});

// ---------- Moderation ----------
adminRouter.get('/reviews', async (_req, res) => {
  res.json({ items: await db.prepare(`SELECT v.id,v.rating,v.comment,v.status,v.created_at,t.title,u.full_name AS reviewer FROM reviews v JOIN trips t ON t.id=v.trip_id JOIN users u ON u.id=v.user_id ORDER BY v.id DESC LIMIT 200`).all() });
});
adminRouter.patch('/reviews/:id', async (req, res) => {
  const st = req.body?.status; if (!['visible', 'hidden'].includes(st)) throw badRequest('validation_error');
  const r = await db.prepare('UPDATE reviews SET status=? WHERE id=?').run(st, Number(req.params.id)); if (!r.changes) throw notFound();
  await audit(req, req.user!, 'review_' + st, 'review', Number(req.params.id));
  res.json({ ok: true });
});
adminRouter.delete('/reviews/:id', async (req, res) => {
  await db.prepare('DELETE FROM reviews WHERE id=?').run(Number(req.params.id));
  await audit(req, req.user!, 'review_delete', 'review', Number(req.params.id));
  res.json({ ok: true });
});
adminRouter.get('/reports', async (_req, res) => {
  res.json({ items: await db.prepare(`SELECT r.*, u.full_name AS reporter FROM reports r LEFT JOIN users u ON u.id=r.reporter_id ORDER BY (r.status='open') DESC, r.id DESC LIMIT 200`).all() });
});
adminRouter.patch('/reports/:id', async (req, res) => {
  const st = req.body?.status; if (!['open', 'resolved', 'dismissed'].includes(st)) throw badRequest('validation_error');
  await db.prepare('UPDATE reports SET status=? WHERE id=?').run(st, Number(req.params.id));
  await audit(req, req.user!, 'report_' + st, 'report', Number(req.params.id));
  res.json({ ok: true });
});
adminRouter.get('/support', async (_req, res) => res.json({ items: await db.prepare('SELECT * FROM support_requests ORDER BY (status="resolved"), id DESC LIMIT 200').all() }));
adminRouter.patch('/support/:id', async (req, res) => {
  const s = await one('SELECT * FROM support_requests WHERE id=?', Number(req.params.id)); if (!s) throw notFound();
  const st = req.body?.status; if (!['open', 'in_progress', 'resolved'].includes(st)) throw badRequest('validation_error');
  const reply = String(req.body?.admin_reply ?? s.admin_reply ?? '').slice(0, 2000) || null;
  await db.prepare("UPDATE support_requests SET status=?, admin_reply=?, updated_at=datetime('now') WHERE id=?").run(st, reply, s.id);
  if (s.user_id) await notify(s.user_id, 'support_updated', { subject: s.subject, status: st }, '/traveler/support');
  await audit(req, req.user!, 'support_update', 'support', s.id, { status: st });
  res.json({ ok: true });
});

// ---------- Announcements, settings, audit ----------
adminRouter.get('/announcements', async (_req, res) => res.json({ items: await db.prepare('SELECT * FROM announcements ORDER BY id DESC').all() }));
adminRouter.post('/announcements', validateBody(announcementSchema), async (req, res) => {
  const b = req.body;
  const r = await db.prepare('INSERT INTO announcements (title_rw,title_en,body_rw,body_en,is_active) VALUES (?,?,?,?,?)').run(b.title_rw, b.title_en, b.body_rw, b.body_en, b.is_active ? 1 : 0);
  await audit(req, req.user!, 'announcement_create', 'announcement', Number(r.lastInsertRowid));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
adminRouter.put('/announcements/:id', validateBody(announcementSchema), async (req, res) => {
  const b = req.body;
  await db.prepare('UPDATE announcements SET title_rw=?,title_en=?,body_rw=?,body_en=?,is_active=? WHERE id=?').run(b.title_rw, b.title_en, b.body_rw, b.body_en, b.is_active ? 1 : 0, Number(req.params.id));
  await audit(req, req.user!, 'announcement_update', 'announcement', Number(req.params.id));
  res.json({ ok: true });
});
adminRouter.delete('/announcements/:id', async (req, res) => {
  await db.prepare('DELETE FROM announcements WHERE id=?').run(Number(req.params.id));
  await audit(req, req.user!, 'announcement_delete', 'announcement', Number(req.params.id));
  res.json({ ok: true });
});
const SETTING_KEYS = ['platform_name', 'contact_email', 'allow_organizer_applications', 'max_seats_per_registration'];
adminRouter.get('/settings', async (_req, res) => {
  res.json({ settings: Object.fromEntries((await db.prepare('SELECT key,value FROM system_settings').all() as any[]).map((r) => [r.key, r.value])) });
});
adminRouter.put('/settings', async (req, res) => {
  const body = req.body || {};
  await db.transaction(async () => {
    for (const k of SETTING_KEYS) if (body[k] !== undefined) {
      await db.prepare("INSERT INTO system_settings (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(k, String(body[k]).slice(0, 300));
    }
  });
  await audit(req, req.user!, 'settings_update', 'settings', undefined, body);
  res.json({ ok: true });
});
adminRouter.get('/audit', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const size = 30;
  const action = String(req.query.action || '');
  const where = action ? 'WHERE action LIKE ?' : '';
  const args = action ? [`%${action}%`] : [];
  const total = (await db.prepare(`SELECT COUNT(*) c FROM audit_logs ${where}`).get(...args) as any).c;
  const items = await db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, size, (page - 1) * size);
  res.json({ items, total, page, pages: Math.ceil(total / size) });
});

// ---------- Cost records (organizer for own trips; admin for anything) ----------
export const costsRouter = Router();
costsRouter.post('/', requireAuth, validateBody(costSchema), async (req, res) => {
  const b = req.body;
  if (req.user!.role === 'admin') {
    /* any target and any source */
  } else if (req.user!.role === 'organizer' && b.trip_id) {
    const t = await getTripRow(b.trip_id);
    if (!t || t.organizer_id !== req.user!.organizerId) throw forbidden();
    if (b.source_type !== 'organizer') throw forbidden('organizer_source_only');
  } else throw forbidden();
  const r = await db.prepare('INSERT INTO cost_records (trip_id,destination_id,cost_type,label,amount,source_type,source_note) VALUES (?,?,?,?,?,?,?)')
    .run(b.trip_id ?? null, b.trip_id ? null : b.destination_id, b.cost_type, b.label ?? null, b.amount ?? null, b.source_type, b.source_note ?? null);
  await audit(req, req.user!, 'cost_create', 'cost', Number(r.lastInsertRowid));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
costsRouter.delete('/:id', requireAuth, async (req, res) => {
  const c = await one('SELECT * FROM cost_records WHERE id=?', Number(req.params.id)); if (!c) throw notFound();
  if (req.user!.role !== 'admin') {
    const t = c.trip_id ? await getTripRow(c.trip_id) : null;
    if (!t || t.organizer_id !== req.user!.organizerId || c.cost_type === 'package') throw forbidden();
  }
  await db.prepare('DELETE FROM cost_records WHERE id=?').run(c.id);
  await audit(req, req.user!, 'cost_delete', 'cost', c.id);
  res.json({ ok: true });
});
void todayStr;
