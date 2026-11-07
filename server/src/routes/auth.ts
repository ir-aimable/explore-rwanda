import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/db.js';
import { COOKIE, requireAuth, setSessionCookie } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { authLimiter } from '../middleware/limits.js';
import { loginSchema, passwordChangeSchema, profileSchema, registerSchema } from '../validators/schemas.js';
import { conflict, unauthorized, badRequest } from '../lib/errors.js';
import { audit } from '../lib/audit.js';

export const authRouter = Router();
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

function me(userId: number) {
  const u = db.prepare('SELECT id,full_name,email,phone,role,preferred_language,created_at FROM users WHERE id=?').get(userId) as any;
  const org = db.prepare('SELECT id,display_name,status FROM organizers WHERE user_id=?').get(userId) as any;
  const app = db.prepare('SELECT id,status,organizer_name,review_note,created_at FROM organizer_applications WHERE user_id=? ORDER BY id DESC LIMIT 1').get(userId) as any;
  const unread = (db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(userId) as any).c;
  return { ...u, organizer: org ?? null, application: app ?? null, unread_notifications: unread };
}

authRouter.post('/register', authLimiter, validateBody(registerSchema), (req, res) => {
  const { full_name, email, phone, password, preferred_language } = req.body;
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw conflict('email_taken');
  const hash = bcrypt.hashSync(password, 12);
  // Role is ALWAYS traveler here. Nobody can self-assign organizer/admin.
  const r = db.prepare("INSERT INTO users (full_name,email,phone,password_hash,role,preferred_language) VALUES (?,?,?,?, 'traveler', ?)")
    .run(full_name, email, phone || null, hash, preferred_language || 'rw');
  setSessionCookie(res, Number(r.lastInsertRowid));
  res.status(201).json({ user: me(Number(r.lastInsertRowid)) });
});

authRouter.post('/login', authLimiter, validateBody(loginSchema), (req, res) => {
  const { email, password } = req.body;
  const u = db.prepare('SELECT id,password_hash,is_active,email FROM users WHERE email=?').get(email) as any;
  const ok = bcrypt.compareSync(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !ok) throw unauthorized('invalid_credentials');
  if (!u.is_active) throw unauthorized('account_disabled');
  setSessionCookie(res, u.id);
  audit(req, { id: u.id, email: u.email }, 'login');
  res.json({ user: me(u.id) });
});

authRouter.post('/logout', (_req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });

authRouter.get('/me', (req, res) => { res.json({ user: req.user ? me(req.user.id) : null }); });

authRouter.put('/profile', requireAuth, validateBody(profileSchema), (req, res) => {
  const { full_name, phone, preferred_language } = req.body;
  db.prepare("UPDATE users SET full_name=?, phone=?, preferred_language=COALESCE(?,preferred_language), updated_at=datetime('now') WHERE id=?")
    .run(full_name, phone || null, preferred_language ?? null, req.user!.id);
  res.json({ user: me(req.user!.id) });
});

authRouter.put('/password', requireAuth, authLimiter, validateBody(passwordChangeSchema), (req, res) => {
  const u = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user!.id) as any;
  if (!bcrypt.compareSync(req.body.current_password, u.password_hash)) throw badRequest('wrong_current_password');
  db.prepare("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?").run(bcrypt.hashSync(req.body.new_password, 12), req.user!.id);
  audit(req, req.user!, 'password_change', 'user', req.user!.id);
  res.json({ ok: true });
});
