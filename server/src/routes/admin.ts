import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { notify } from '../services/notifications/notify.js';
import { imageUpload, removeUpload, verifyImageFile } from '../lib/upload.js';
import { nowStr, todayStr } from '../lib/time.js';
import { getTripRow } from '../services/search/tripService.js';
import { adminUserCreateSchema, announcementSchema, categorySchema, costSchema, destinationSchema } from '../validators/schemas.js';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

const activeAdmins = () => (db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND is_active=1").get() as any).c as number;
const one = (sql: string, ...a: any[]) => (db.prepare(sql).get(...a) as any);

// ---------- Dashboard ----------
adminRouter.get('/stats', (_req, res) => {
  const now = nowStr();
  const s = {
    users_total: one('SELECT COUNT(*) c FROM users').c,
    travelers: one("SELECT COUNT(*) c FROM users WHERE role='traveler'").c,
    organizers: one("SELECT COUNT(*) c FROM organizers").c,
    admins: one("SELECT COUNT(*) c FROM users WHERE role='admin'").c,
    pending_applications: one("SELECT COUNT(*) c FROM organizer_applications WHERE status='pending'").c,
    approved_organizers: one("SELECT COUNT(*) c FROM organizers WHERE status='approved'").c,
    suspended_organizers: one("SELECT COUNT(*) c FROM organizers WHERE status='suspended'").c,
    trips_total: one('SELECT COUNT(*) c FROM trips').c,
    trips_published: one("SELECT COUNT(*) c FROM trips WHERE status='published'").c,
    trips_upcoming: one("SELECT COUNT(*) c FROM trips WHERE status='published' AND (trip_date||'T'||start_time) > ?", now).c,
    trips_completed: one("SELECT COUNT(*) c FROM trips WHERE status='completed' OR (status='published' AND (trip_date||'T'||start_time) <= ?)", now).c,
    trips_cancelled: one("SELECT COUNT(*) c FROM trips WHERE status='cancelled'").c,
    registrations_total: one('SELECT COUNT(*) c FROM registrations').c,
    registrations_pending: one("SELECT COUNT(*) c FROM registrations WHERE status='pending'").c,
    registrations_approved: one("SELECT COUNT(*) c FROM registrations WHERE status='approved'").c,
    open_support: one("SELECT COUNT(*) c FROM support_requests WHERE status!='resolved'").c,
    open_reports: one("SELECT COUNT(*) c FROM reports WHERE status='open'").c,
  };
  const recent = db.prepare('SELECT id,actor_email,action,entity,entity_id,created_at FROM audit_logs ORDER BY id DESC LIMIT 10').all();
  const recentRegs = db.prepare(`SELECT r.id,r.status,r.created_at,u.full_name,t.title FROM registrations r JOIN users u ON u.id=r.user_id JOIN trips t ON t.id=r.trip_id ORDER BY r.id DESC LIMIT 8`).all();
  res.json({ stats: s, recent_audit: recent, recent_registrations: recentRegs });
});

// ---------- Users ----------
adminRouter.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim(); const role = String(req.query.role || ''); const active = String(req.query.active || '');
  const where: string[] = []; const args: any[] = [];
  if (q) { where.push('(full_name LIKE ? OR email LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (role) { where.push('role=?'); args.push(role); }
  if (active !== '') { where.push('is_active=?'); args.push(active === '1' ? 1 : 0); }
  const items = db.prepare(`SELECT id,full_name,email,phone,role,is_active,is_demo,created_at FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 300`).all(...args);
  res.json({ items });
});
adminRouter.post('/users', validateBody(adminUserCreateSchema), (req, res) => {
  const b = req.body;
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(b.email)) throw conflict('email_taken');
  const r = db.prepare('INSERT INTO users (full_name,email,phone,password_hash,role) VALUES (?,?,?,?,?)')
    .run(b.full_name, b.email, b.phone || null, bcrypt.hashSync(b.password, 12), b.role);
  audit(req, req.user!, 'user_create', 'user', Number(r.lastInsertRowid), { role: b.role });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
adminRouter.patch('/users/:id/active', (req, res) => {
  const id = Number(req.params.id); const active = !!req.body?.is_active;
  const u = one('SELECT * FROM users WHERE id=?', id); if (!u) throw notFound();
  if (id === req.user!.id) throw badRequest('cannot_modify_self');
  if (u.role === 'admin' && !active && activeAdmins() <= 1) throw conflict('last_admin');
  db.prepare("UPDATE users SET is_active=?, updated_at=datetime('now') WHERE id=?").run(active ? 1 : 0, id);
  audit(req, req.user!, active ? 'user_activate' : 'user_deactivate', 'user', id, { email: u.email });
  res.json({ ok: true });
});
// Only an administrator can grant/revoke admin. Organizers are managed through the organizer workflow.
adminRouter.patch('/users/:id/role', (req, res) => {
  const id = Number(req.params.id); const role = req.body?.role;
  if (!['admin', 'traveler'].includes(role)) throw badRequest('validation_error');
  const u = one('SELECT * FROM users WHERE id=?', id); if (!u) throw notFound();
  if (id === req.user!.id) throw badRequest('cannot_modify_self');
  if (u.role === 'organizer') throw conflict('use_organizer_workflow');
  if (u.role === 'admin' && role !== 'admin' && activeAdmins() <= 1) throw conflict('last_admin');
  db.prepare("UPDATE users SET role=?, updated_at=datetime('now') WHERE id=?").run(role, id);
  audit(req, req.user!, role === 'admin' ? 'admin_grant' : 'admin_revoke', 'user', id, { email: u.email });
  res.json({ ok: true });
});
/** Retention rule: personal data is deleted; audit log rows are kept (actor_email retained, actor_id nulled). */
adminRouter.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const u = one('SELECT * FROM users WHERE id=?', id); if (!u) throw notFound();
  if (id === req.user!.id) throw badRequest('cannot_modify_self');
  if (u.role === 'admin' && activeAdmins() <= 1) throw conflict('last_admin');
  const orgTrips = one(`SELECT COUNT(*) c FROM trips t JOIN organizers o ON o.id=t.organizer_id WHERE o.user_id=?`, id).c;
  if (orgTrips > 0) throw conflict('organizer_has_trips');
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  audit(req, req.user!, 'user_delete', 'user', id, { email: u.email, role: u.role });
  res.json({ ok: true });
});

// ---------- Organizer applications & organizers ----------
adminRouter.get('/applications', (req, res) => {
  const st = String(req.query.status || '');
  const items = db.prepare(`SELECT * FROM organizer_applications ${st ? 'WHERE status=?' : ''} ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC`).all(...(st ? [st] : []));
  res.json({ items });
});
adminRouter.post('/applications/:id/approve', (req, res) => {
  db.transaction(() => {
    const a = one('SELECT * FROM organizer_applications WHERE id=?', Number(req.params.id)); if (!a) throw notFound();
    if (a.status !== 'pending') throw conflict('not_pending');
    const u = one('SELECT * FROM users WHERE id=?', a.user_id);
    if (u.role === 'admin') throw conflict('already_privileged');
    db.prepare("UPDATE organizer_applications SET status='approved', reviewed_by=?, reviewed_at=datetime('now'), review_note=?, updated_at=datetime('now') WHERE id=?")
      .run(req.user!.id, req.body?.note ?? null, a.id);
    db.prepare("INSERT INTO organizers (user_id,application_id,display_name,location,contact_phone,contact_email,bio) VALUES (?,?,?,?,?,?,?)")
      .run(a.user_id, a.id, a.organizer_name, a.location, a.phone, a.email, a.experience);
    db.prepare("UPDATE users SET role='organizer', updated_at=datetime('now') WHERE id=?").run(a.user_id);
    notify(a.user_id, 'application_approved', { name: a.organizer_name }, '/organizer');
    audit(req, req.user!, 'organizer_approve', 'application', a.id, { organizer: a.organizer_name });
  }).immediate();
  res.json({ ok: true });
});
adminRouter.post('/applications/:id/reject', (req, res) => {
  const a = one('SELECT * FROM organizer_applications WHERE id=?', Number(req.params.id)); if (!a) throw notFound();
  if (a.status !== 'pending') throw conflict('not_pending');
  db.prepare("UPDATE organizer_applications SET status='rejected', reviewed_by=?, reviewed_at=datetime('now'), review_note=?, updated_at=datetime('now') WHERE id=?")
    .run(req.user!.id, String(req.body?.note || '').slice(0, 500) || null, a.id);
  notify(a.user_id, 'application_rejected', { name: a.organizer_name, note: req.body?.note || null });
  audit(req, req.user!, 'organizer_reject', 'application', a.id, { organizer: a.organizer_name });
  res.json({ ok: true });
});
adminRouter.get('/organizers', (_req, res) => {
  const items = db.prepare(`SELECT o.id,o.user_id,o.display_name,o.location,o.status,o.created_at,u.email,u.full_name,u.phone,u.role,u.is_active,
      (SELECT COUNT(*) FROM trips t WHERE t.organizer_id=o.id) AS trips FROM organizers o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`).all();
  res.json({ items });
});
adminRouter.post('/organizers', validateBody(adminUserCreateSchema.extend({ display_name: z.string().trim().min(2).max(120) })), (req, res) => {
  const b = req.body;
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(b.email)) throw conflict('email_taken');
  const id = db.transaction(() => {
    const u = db.prepare("INSERT INTO users (full_name,email,phone,password_hash,role) VALUES (?,?,?,?, 'organizer')")
      .run(b.full_name, b.email, b.phone || null, bcrypt.hashSync(b.password, 12));
    const o = db.prepare("INSERT INTO organizers (user_id,display_name,contact_email,contact_phone) VALUES (?,?,?,?)")
      .run(u.lastInsertRowid, b.display_name, b.email, b.phone || null);
    return Number(o.lastInsertRowid);
  })();
  audit(req, req.user!, 'organizer_create', 'organizer', id, { email: b.email });
  res.status(201).json({ id });
});
adminRouter.patch('/organizers/:id/status', (req, res) => {
  const st = req.body?.status; if (!['approved', 'suspended'].includes(st)) throw badRequest('validation_error');
  const o = one('SELECT * FROM organizers WHERE id=?', Number(req.params.id)); if (!o) throw notFound();
  db.transaction(() => {
    db.prepare("UPDATE organizers SET status=?, updated_at=datetime('now') WHERE id=?").run(st, o.id);
    if (st === 'approved') db.prepare("UPDATE users SET role='organizer' WHERE id=? AND role!='admin'").run(o.user_id);
    if (o.application_id) db.prepare("UPDATE organizer_applications SET status=? WHERE id=?").run(st === 'approved' ? 'approved' : 'suspended', o.application_id);
    notify(o.user_id, st === 'approved' ? 'organizer_reactivated' : 'organizer_suspended', { name: o.display_name });
  })();
  audit(req, req.user!, st === 'approved' ? 'organizer_reactivate' : 'organizer_suspend', 'organizer', o.id, { name: o.display_name });
  res.json({ ok: true });
});
/** Revoke organizer access entirely: role goes back to traveler; record and trips are kept but hidden. */
adminRouter.delete('/organizers/:id', (req, res) => {
  const o = one('SELECT * FROM organizers WHERE id=?', Number(req.params.id)); if (!o) throw notFound();
  db.transaction(() => {
    db.prepare("UPDATE organizers SET status='suspended', updated_at=datetime('now') WHERE id=?").run(o.id);
    db.prepare("UPDATE users SET role='traveler' WHERE id=? AND role='organizer'").run(o.user_id);
  })();
  audit(req, req.user!, 'organizer_revoke', 'organizer', o.id, { name: o.display_name });
  res.json({ ok: true });
});

// ---------- Destinations ----------
const saveDestCats = (id: number, ids: number[]) => {
  db.prepare('DELETE FROM destination_categories WHERE destination_id=?').run(id);
  const ins = db.prepare('INSERT OR IGNORE INTO destination_categories (destination_id,category_id) VALUES (?,?)');
  ids.forEach((c) => { if (db.prepare('SELECT 1 FROM categories WHERE id=?').get(c)) ins.run(id, c); });
};
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
adminRouter.get('/destinations', (_req, res) => {
  const items = db.prepare('SELECT * FROM destinations ORDER BY name').all() as any[];
  res.json({ items: items.map((d) => ({ ...d, category_ids: (db.prepare('SELECT category_id FROM destination_categories WHERE destination_id=?').all(d.id) as any[]).map((r) => r.category_id) })) });
});
adminRouter.post('/destinations', validateBody(destinationSchema), (req, res) => {
  const b = req.body;
  let slug = slugify(b.name); if (one('SELECT 1 x FROM destinations WHERE slug=?', slug)) slug += '-' + Date.now().toString(36);
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO destinations (name,slug,region,description_rw,description_en,latitude,longitude,is_published) VALUES (?,?,?,?,?,?,?,?)')
      .run(b.name, slug, b.region, b.description_rw, b.description_en, b.latitude ?? null, b.longitude ?? null, b.is_published ? 1 : 0);
    saveDestCats(Number(r.lastInsertRowid), b.category_ids);
    return Number(r.lastInsertRowid);
  })();
  audit(req, req.user!, 'destination_create', 'destination', id, { name: b.name });
  res.status(201).json({ id });
});
adminRouter.put('/destinations/:id', validateBody(destinationSchema), (req, res) => {
  const b = req.body; const id = Number(req.params.id);
  if (!one('SELECT 1 x FROM destinations WHERE id=?', id)) throw notFound();
  db.transaction(() => {
    db.prepare("UPDATE destinations SET name=?,region=?,description_rw=?,description_en=?,latitude=?,longitude=?,is_published=?,updated_at=datetime('now') WHERE id=?")
      .run(b.name, b.region, b.description_rw, b.description_en, b.latitude ?? null, b.longitude ?? null, b.is_published ? 1 : 0, id);
    saveDestCats(id, b.category_ids);
  })();
  audit(req, req.user!, 'destination_update', 'destination', id, { name: b.name });
  res.json({ ok: true });
});
adminRouter.delete('/destinations/:id', (req, res) => {
  const id = Number(req.params.id); const d = one('SELECT * FROM destinations WHERE id=?', id); if (!d) throw notFound();
  if (one('SELECT COUNT(*) c FROM trips WHERE destination_id=?', id).c > 0) throw conflict('destination_has_trips');
  db.prepare('DELETE FROM destinations WHERE id=?').run(id); removeUpload(d.image_path);
  audit(req, req.user!, 'destination_delete', 'destination', id, { name: d.name });
  res.json({ ok: true });
});
adminRouter.post('/destinations/:id/image', (req, res, next) => {
  const d = one('SELECT * FROM destinations WHERE id=?', Number(req.params.id)); if (!d) return next(notFound());
  imageUpload(req, res, (err: any) => {
    if (err) return next(err.code === 'LIMIT_FILE_SIZE' ? badRequest('file_too_large') : err);
    if (!req.file) return next(badRequest('file_required'));
    if (!verifyImageFile(req.file.path)) { removeUpload('/uploads/' + req.file.filename); return next(badRequest('invalid_file_type')); }
    removeUpload(d.image_path);
    const p = '/uploads/' + req.file.filename;
    db.prepare("UPDATE destinations SET image_path=?, updated_at=datetime('now') WHERE id=?").run(p, d.id);
    audit(req, req.user!, 'destination_image', 'destination', d.id);
    res.status(201).json({ path: p });
  });
});

// ---------- Categories ----------
adminRouter.get('/categories', (_req, res) => res.json({ items: db.prepare('SELECT * FROM categories ORDER BY id').all() }));
adminRouter.post('/categories', validateBody(categorySchema), (req, res) => {
  const b = req.body; if (one('SELECT 1 x FROM categories WHERE slug=?', b.slug)) throw conflict('slug_taken');
  const r = db.prepare('INSERT INTO categories (slug,name_rw,name_en,is_active) VALUES (?,?,?,?)').run(b.slug, b.name_rw, b.name_en, b.is_active ? 1 : 0);
  audit(req, req.user!, 'category_create', 'category', Number(r.lastInsertRowid), b);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
adminRouter.put('/categories/:id', validateBody(categorySchema), (req, res) => {
  const b = req.body; const id = Number(req.params.id);
  if (!one('SELECT 1 x FROM categories WHERE id=?', id)) throw notFound();
  if (one('SELECT 1 x FROM categories WHERE slug=? AND id!=?', b.slug, id)) throw conflict('slug_taken');
  db.prepare('UPDATE categories SET slug=?,name_rw=?,name_en=?,is_active=? WHERE id=?').run(b.slug, b.name_rw, b.name_en, b.is_active ? 1 : 0, id);
  audit(req, req.user!, 'category_update', 'category', id, b);
  res.json({ ok: true });
});
adminRouter.delete('/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (one('SELECT COUNT(*) c FROM trips WHERE category_id=?', id).c > 0) throw conflict('category_in_use');
  db.prepare('DELETE FROM categories WHERE id=?').run(id);
  audit(req, req.user!, 'category_delete', 'category', id);
  res.json({ ok: true });
});

// ---------- Moderation ----------
adminRouter.get('/reviews', (_req, res) => {
  res.json({ items: db.prepare(`SELECT v.id,v.rating,v.comment,v.status,v.created_at,t.title,u.full_name AS reviewer FROM reviews v JOIN trips t ON t.id=v.trip_id JOIN users u ON u.id=v.user_id ORDER BY v.id DESC LIMIT 200`).all() });
});
adminRouter.patch('/reviews/:id', (req, res) => {
  const st = req.body?.status; if (!['visible', 'hidden'].includes(st)) throw badRequest('validation_error');
  const r = db.prepare('UPDATE reviews SET status=? WHERE id=?').run(st, Number(req.params.id)); if (!r.changes) throw notFound();
  audit(req, req.user!, 'review_' + st, 'review', Number(req.params.id));
  res.json({ ok: true });
});
adminRouter.delete('/reviews/:id', (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id=?').run(Number(req.params.id));
  audit(req, req.user!, 'review_delete', 'review', Number(req.params.id));
  res.json({ ok: true });
});
adminRouter.get('/reports', (_req, res) => {
  res.json({ items: db.prepare(`SELECT r.*, u.full_name AS reporter FROM reports r LEFT JOIN users u ON u.id=r.reporter_id ORDER BY (r.status='open') DESC, r.id DESC LIMIT 200`).all() });
});
adminRouter.patch('/reports/:id', (req, res) => {
  const st = req.body?.status; if (!['open', 'resolved', 'dismissed'].includes(st)) throw badRequest('validation_error');
  db.prepare('UPDATE reports SET status=? WHERE id=?').run(st, Number(req.params.id));
  audit(req, req.user!, 'report_' + st, 'report', Number(req.params.id));
  res.json({ ok: true });
});
adminRouter.get('/support', (_req, res) => res.json({ items: db.prepare('SELECT * FROM support_requests ORDER BY (status="resolved"), id DESC LIMIT 200').all() }));
adminRouter.patch('/support/:id', (req, res) => {
  const s = one('SELECT * FROM support_requests WHERE id=?', Number(req.params.id)); if (!s) throw notFound();
  const st = req.body?.status; if (!['open', 'in_progress', 'resolved'].includes(st)) throw badRequest('validation_error');
  const reply = String(req.body?.admin_reply ?? s.admin_reply ?? '').slice(0, 2000) || null;
  db.prepare("UPDATE support_requests SET status=?, admin_reply=?, updated_at=datetime('now') WHERE id=?").run(st, reply, s.id);
  if (s.user_id) notify(s.user_id, 'support_updated', { subject: s.subject, status: st }, '/traveler/support');
  audit(req, req.user!, 'support_update', 'support', s.id, { status: st });
  res.json({ ok: true });
});

// ---------- Announcements, settings, audit ----------
adminRouter.get('/announcements', (_req, res) => res.json({ items: db.prepare('SELECT * FROM announcements ORDER BY id DESC').all() }));
adminRouter.post('/announcements', validateBody(announcementSchema), (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO announcements (title_rw,title_en,body_rw,body_en,is_active) VALUES (?,?,?,?,?)').run(b.title_rw, b.title_en, b.body_rw, b.body_en, b.is_active ? 1 : 0);
  audit(req, req.user!, 'announcement_create', 'announcement', Number(r.lastInsertRowid));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
adminRouter.put('/announcements/:id', validateBody(announcementSchema), (req, res) => {
  const b = req.body;
  db.prepare('UPDATE announcements SET title_rw=?,title_en=?,body_rw=?,body_en=?,is_active=? WHERE id=?').run(b.title_rw, b.title_en, b.body_rw, b.body_en, b.is_active ? 1 : 0, Number(req.params.id));
  audit(req, req.user!, 'announcement_update', 'announcement', Number(req.params.id));
  res.json({ ok: true });
});
adminRouter.delete('/announcements/:id', (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id=?').run(Number(req.params.id));
  audit(req, req.user!, 'announcement_delete', 'announcement', Number(req.params.id));
  res.json({ ok: true });
});
const SETTING_KEYS = ['platform_name', 'contact_email', 'allow_organizer_applications', 'max_seats_per_registration'];
adminRouter.get('/settings', (_req, res) => {
  res.json({ settings: Object.fromEntries((db.prepare('SELECT key,value FROM system_settings').all() as any[]).map((r) => [r.key, r.value])) });
});
adminRouter.put('/settings', (req, res) => {
  const body = req.body || {};
  db.transaction(() => {
    for (const k of SETTING_KEYS) if (body[k] !== undefined) {
      db.prepare("INSERT INTO system_settings (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(k, String(body[k]).slice(0, 300));
    }
  })();
  audit(req, req.user!, 'settings_update', 'settings', undefined, body);
  res.json({ ok: true });
});
adminRouter.get('/audit', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const size = 30;
  const action = String(req.query.action || '');
  const where = action ? 'WHERE action LIKE ?' : '';
  const args = action ? [`%${action}%`] : [];
  const total = (db.prepare(`SELECT COUNT(*) c FROM audit_logs ${where}`).get(...args) as any).c;
  const items = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, size, (page - 1) * size);
  res.json({ items, total, page, pages: Math.ceil(total / size) });
});

// ---------- Cost records (organizer for own trips; admin for anything) ----------
export const costsRouter = Router();
costsRouter.post('/', requireAuth, validateBody(costSchema), (req, res) => {
  const b = req.body;
  if (req.user!.role === 'admin') {
    /* any target and any source */
  } else if (req.user!.role === 'organizer' && b.trip_id) {
    const t = getTripRow(b.trip_id);
    if (!t || t.organizer_id !== req.user!.organizerId) throw forbidden();
    if (b.source_type !== 'organizer') throw forbidden('organizer_source_only');
  } else throw forbidden();
  const r = db.prepare('INSERT INTO cost_records (trip_id,destination_id,cost_type,label,amount,source_type,source_note) VALUES (?,?,?,?,?,?,?)')
    .run(b.trip_id ?? null, b.trip_id ? null : b.destination_id, b.cost_type, b.label ?? null, b.amount ?? null, b.source_type, b.source_note ?? null);
  audit(req, req.user!, 'cost_create', 'cost', Number(r.lastInsertRowid));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
costsRouter.delete('/:id', requireAuth, (req, res) => {
  const c = one('SELECT * FROM cost_records WHERE id=?', Number(req.params.id)); if (!c) throw notFound();
  if (req.user!.role !== 'admin') {
    const t = c.trip_id ? getTripRow(c.trip_id) : null;
    if (!t || t.organizer_id !== req.user!.organizerId || c.cost_type === 'package') throw forbidden();
  }
  db.prepare('DELETE FROM cost_records WHERE id=?').run(c.id);
  audit(req, req.user!, 'cost_delete', 'cost', c.id);
  res.json({ ok: true });
});
void todayStr;
