import { Router } from 'express';
import { db } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { publicFormLimiter } from '../middleware/limits.js';
import { applicationSchema, organizerProfileSchema, supportSchema } from '../validators/schemas.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { notify, notifyAdmins } from '../services/notifications/notify.js';
import { listPublicTrips } from '../services/search/tripService.js';
import { env } from '../config/env.js';
import bcrypt from 'bcryptjs';
import { setSessionCookie } from '../middleware/auth.js';

export const publicRouter = Router();

publicRouter.get('/categories', (_req, res) => {
  res.json({ items: db.prepare('SELECT id,slug,name_rw,name_en FROM categories WHERE is_active=1 ORDER BY id').all() });
});

function destRow(d: any) {
  const cats = db.prepare('SELECT c.id,c.slug,c.name_rw,c.name_en FROM destination_categories dc JOIN categories c ON c.id=dc.category_id WHERE dc.destination_id=?').all(d.id);
  const costs = db.prepare(`SELECT cost_type,label,amount,currency,source_type,source_note FROM cost_records WHERE destination_id=? AND trip_id IS NULL`).all(d.id);
  const upcoming = (listPublicTrips({ destinationId: d.id, availableOnly: true, limit: 100 })).total;
  return { ...d, is_demo: !!d.is_demo, categories: cats, costs, available_trips: upcoming };
}
publicRouter.get('/destinations', (req, res) => {
  const q = String(req.query.q || '').trim();
  const cat = String(req.query.category || '');
  const where = ['d.is_published=1']; const args: any[] = [];
  if (q) { where.push('(d.name LIKE ? OR d.region LIKE ? OR d.description_en LIKE ? OR d.description_rw LIKE ?)'); args.push(...Array(4).fill(`%${q}%`)); }
  if (cat) { where.push('EXISTS (SELECT 1 FROM destination_categories dc JOIN categories c ON c.id=dc.category_id WHERE dc.destination_id=d.id AND c.slug=?)'); args.push(cat); }
  const rows = db.prepare(`SELECT d.* FROM destinations d WHERE ${where.join(' AND ')} ORDER BY d.name`).all(...args);
  res.json({ items: rows.map(destRow) });
});
publicRouter.get('/destinations/:id', (req, res) => {
  const d = db.prepare('SELECT * FROM destinations WHERE (id=? OR slug=?)').get(Number(req.params.id) || -1, req.params.id) as any;
  if (!d || (!d.is_published && req.user?.role !== 'admin')) throw notFound();
  res.json({ destination: destRow(d), trips: listPublicTrips({ destinationId: d.id, limit: 50 }).items });
});

publicRouter.get('/announcements', (_req, res) => {
  res.json({ items: db.prepare('SELECT id,title_rw,title_en,body_rw,body_en,created_at FROM announcements WHERE is_active=1 ORDER BY id DESC LIMIT 5').all() });
});

publicRouter.get('/config', (_req, res) => {
  const s = Object.fromEntries((db.prepare('SELECT key,value FROM system_settings').all() as any[]).map((r) => [r.key, r.value]));
  res.json({ platform_name: s.platform_name, contact_email: s.contact_email,
    allow_organizer_applications: s.allow_organizer_applications === 'true',
    maps_embed_enabled: !!env.googleMapsKey, weather_enabled: env.weatherEnabled, ollama_enabled: !!env.ollamaUrl });
});

publicRouter.post('/support', publicFormLimiter, validateBody(supportSchema), (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO support_requests (user_id,name,email,subject,message) VALUES (?,?,?,?,?)')
    .run(req.user?.id ?? null, b.name, b.email, b.subject, b.message);
  notifyAdmins('support_received', { subject: b.subject }, '/admin/support');
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
publicRouter.get('/support/mine', requireAuth, (req, res) => {
  res.json({ items: db.prepare('SELECT id,subject,message,status,admin_reply,created_at FROM support_requests WHERE user_id=? ORDER BY id DESC').all(req.user!.id) });
});

// ---------- Organizer application ----------
publicRouter.post('/organizer-applications', publicFormLimiter, validateBody(applicationSchema), (req, res) => {
  const settings = db.prepare("SELECT value FROM system_settings WHERE key='allow_organizer_applications'").get() as any;
  if (settings?.value === 'false') throw forbidden('applications_closed');
  const b = req.body;
  let userId = req.user?.id;
  if (req.user && req.user.role !== 'traveler') throw conflict('already_privileged');
  const id = db.transaction(() => {
    if (!userId) {
      if (!b.password) throw badRequest('validation_error', 'Password required', { password: 'required' });
      if (db.prepare('SELECT 1 FROM users WHERE email=?').get(b.email)) throw conflict('email_taken');
      const r = db.prepare("INSERT INTO users (full_name,email,phone,password_hash,role) VALUES (?,?,?,?, 'traveler')")
        .run(b.applicant_name, b.email, b.phone, bcrypt.hashSync(b.password, 12));
      userId = Number(r.lastInsertRowid);
    }
    if (db.prepare("SELECT 1 FROM organizer_applications WHERE user_id=? AND status='pending'").get(userId)) throw conflict('application_pending');
    const a = db.prepare(`INSERT INTO organizer_applications (user_id,organizer_name,applicant_name,email,phone,experience,location,supporting_info)
      VALUES (?,?,?,?,?,?,?,?)`).run(userId, b.organizer_name, b.applicant_name, b.email, b.phone, b.experience, b.location, b.supporting_info || null);
    notify(userId!, 'application_submitted', { name: b.organizer_name });
    notifyAdmins('application_received', { name: b.organizer_name }, '/admin/applications');
    return Number(a.lastInsertRowid);
  }).immediate();
  if (!req.user) setSessionCookie(res, userId!);
  res.status(201).json({ id, status: 'pending' });
});

// ---------- Organizer profile: authentication REQUIRED (project rule) ----------
publicRouter.get('/organizers/:id', requireAuth, (req, res) => {
  const o = db.prepare("SELECT id,display_name,bio,location,contact_phone,contact_email,status,created_at FROM organizers WHERE id=?").get(Number(req.params.id)) as any;
  if (!o || (o.status !== 'approved' && req.user!.role !== 'admin')) throw notFound();
  const trips = listPublicTrips({ organizerId: o.id, limit: 50 }).items;
  const rating = db.prepare(`SELECT ROUND(AVG(v.rating),1) avg, COUNT(*) n FROM reviews v JOIN trips t ON t.id=v.trip_id WHERE t.organizer_id=? AND v.status='visible'`).get(o.id);
  res.json({ organizer: o, trips, rating });
});
publicRouter.get('/organizer/me', requireRole('organizer'), (req, res) => {
  const o = db.prepare('SELECT * FROM organizers WHERE id=?').get(req.user!.organizerId);
  const t = db.prepare(`SELECT
    COUNT(*) total,
    SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) published,
    SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) drafts FROM trips WHERE organizer_id=?`).get(req.user!.organizerId) as any;
  const regs = db.prepare(`SELECT SUM(CASE WHEN r.status='pending' THEN 1 ELSE 0 END) pending, SUM(CASE WHEN r.status='approved' THEN r.seats ELSE 0 END) confirmed
    FROM registrations r JOIN trips t ON t.id=r.trip_id WHERE t.organizer_id=?`).get(req.user!.organizerId) as any;
  res.json({ organizer: o, stats: { ...t, pending: regs.pending ?? 0, confirmed: regs.confirmed ?? 0 } });
});
publicRouter.put('/organizer/me', requireRole('organizer'), validateBody(organizerProfileSchema), (req, res) => {
  const b = req.body;
  db.prepare("UPDATE organizers SET display_name=?,bio=?,location=?,contact_phone=?,contact_email=?,updated_at=datetime('now') WHERE id=?")
    .run(b.display_name, b.bio || null, b.location || null, b.contact_phone || null, b.contact_email || null, req.user!.organizerId);
  res.json({ ok: true });
});
