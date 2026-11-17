import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { db } from '../database/db.js';
import { COOKIE, requireAuth, setSessionCookie } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { authLimiter, resetLimiter } from '../middleware/limits.js';
import { forgotPasswordSchema, googleLoginSchema, loginSchema, passwordChangeSchema, profileSchema, registerSchema, resetPasswordSchema } from '../validators/schemas.js';
import { sendMail } from '../services/notifications/mail.js';
import { conflict, unauthorized, badRequest } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { verifyGoogleCredential } from '../services/auth/google.js';

export const authRouter = Router();
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

async function me(userId: number) {
  const u = await db.prepare('SELECT id,full_name,email,phone,role,preferred_language,created_at FROM users WHERE id=?').get(userId) as any;
  const org = await db.prepare('SELECT id,display_name,status FROM organizers WHERE user_id=?').get(userId) as any;
  const app = await db.prepare('SELECT id,status,organizer_name,review_note,created_at FROM organizer_applications WHERE user_id=? ORDER BY id DESC LIMIT 1').get(userId) as any;
  const unread = (await db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(userId) as any).c;
  return { ...u, organizer: org ?? null, application: app ?? null, unread_notifications: unread };
}

authRouter.post('/register', authLimiter, validateBody(registerSchema), async (req, res) => {
  const { full_name, email, phone, password, preferred_language } = req.body;
  if (await db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw conflict('email_taken');
  const hash = bcrypt.hashSync(password, 12);
  // Role is ALWAYS traveler here. Nobody can self-assign organizer/admin.
  const r = await db.prepare("INSERT INTO users (full_name,email,phone,password_hash,role,preferred_language) VALUES (?,?,?,?, 'traveler', ?)")
    .run(full_name, email, phone || null, hash, preferred_language || 'rw');
  setSessionCookie(res, Number(r.lastInsertRowid));
  res.status(201).json({ user: await me(Number(r.lastInsertRowid)) });
});

authRouter.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const u = await db.prepare('SELECT id,password_hash,is_active,email FROM users WHERE email=?').get(email) as any;
  const ok = bcrypt.compareSync(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !ok) throw unauthorized('invalid_credentials');
  if (!u.is_active) throw unauthorized('account_disabled');
  setSessionCookie(res, u.id);
  await audit(req, { id: u.id, email: u.email }, 'login');
  res.json({ user: await me(u.id) });
});

authRouter.post('/logout', async (_req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });

authRouter.get('/me', async (req, res) => { res.json({ user: req.user ? await me(req.user.id) : null }); });

authRouter.put('/profile', requireAuth, validateBody(profileSchema), async (req, res) => {
  const { full_name, phone, preferred_language } = req.body;
  await db.prepare("UPDATE users SET full_name=?, phone=?, preferred_language=COALESCE(?,preferred_language), updated_at=datetime('now') WHERE id=?")
    .run(full_name, phone || null, preferred_language ?? null, req.user!.id);
  res.json({ user: await me(req.user!.id) });
});

authRouter.put('/password', requireAuth, authLimiter, validateBody(passwordChangeSchema), async (req, res) => {
  const u = await db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user!.id) as any;
  if (!bcrypt.compareSync(req.body.current_password, u.password_hash)) throw badRequest('wrong_current_password');
  await db.prepare("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?").run(bcrypt.hashSync(req.body.new_password, 12), req.user!.id);
  await audit(req, req.user!, 'password_change', 'user', req.user!.id);
  res.json({ ok: true });
});

// ---------- Password reset ----------
const RESET_TTL_MIN = 60;
/** Every forgot-password answer takes at least this long, so response time does not reveal whether an email is registered. */
const FORGOT_MIN_MS = 800;
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

function resetEmail(lang: 'rw' | 'en', name: string, link: string) {
  return lang === 'rw'
    ? { subject: 'Hindura ijambo ry’ibanga rya Explore Rwanda',
        text: `Muraho ${name},\n\nTwakiriye ubusabe bwo guhindura ijambo ry’ibanga rya konti yawe ya Explore Rwanda.\nKanda kuri iyi link mu minota ${RESET_TTL_MIN}:\n\n${link}\n\nNiba atari wowe wabisabye, wirengagize ubu butumwa: ijambo ry’ibanga ryawe ntirihinduka.\n\nExplore Rwanda` }
    : { subject: 'Reset your Explore Rwanda password',
        text: `Hello ${name},\n\nWe received a request to reset the password for your Explore Rwanda account.\nOpen this link within ${RESET_TTL_MIN} minutes:\n\n${link}\n\nIf you did not ask for this, ignore this email: your password will not change.\n\nExplore Rwanda` };
}

authRouter.post('/forgot-password', resetLimiter, validateBody(forgotPasswordSchema), async (req, res) => {
  const started = Date.now();
  try {
    const u = await db.prepare('SELECT id,full_name,email,is_active,preferred_language FROM users WHERE email=?').get(req.body.email) as any;
    if (u?.is_active) {
      const token = crypto.randomBytes(32).toString('hex');
      await db.transaction(async () => {
        // Only the newest link works: earlier unused links for this account are removed.
        await db.prepare('DELETE FROM password_reset_tokens WHERE user_id=? AND used_at IS NULL').run(u.id);
        await db.prepare(`INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES (?,?,datetime('now','+${RESET_TTL_MIN} minutes'))`).run(u.id, sha256(token));
      });
      const m = resetEmail(u.preferred_language === 'en' ? 'en' : 'rw', u.full_name, `${env.appUrl}/reset-password?token=${token}`);
      await sendMail(u.email, m.subject, m.text);
      await audit(req, { id: u.id, email: u.email }, 'password_reset_requested', 'user', u.id);
    }
  } catch (e) {
    // A mail or database failure must not reveal whether the account exists either.
    console.error('[auth] forgot-password failed:', e);
  }
  const wait = FORGOT_MIN_MS - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  res.json({ ok: true });
});

authRouter.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), async (req, res) => {
  const hash = sha256(req.body.token);
  const row = await db.prepare(`SELECT t.id, t.user_id, u.email, u.is_active FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
    WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at > datetime('now')`).get(hash) as any;
  if (!row || !row.is_active) throw badRequest('invalid_token');
  // Claim the token in one statement, so two simultaneous requests cannot both use it.
  const claimed = await db.prepare("UPDATE password_reset_tokens SET used_at=datetime('now') WHERE id=? AND used_at IS NULL").run(row.id);
  if (claimed.changes !== 1) throw badRequest('invalid_token');
  await db.transaction(async () => {
    await db.prepare("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?").run(bcrypt.hashSync(req.body.password, 12), row.user_id);
    await db.prepare('DELETE FROM password_reset_tokens WHERE user_id=? AND used_at IS NULL').run(row.user_id);
  });
  await audit(req, { id: row.user_id, email: row.email }, 'password_reset', 'user', row.user_id);
  setSessionCookie(res, row.user_id);
  res.json({ user: await me(row.user_id) });
});

// ---------- Sign in with Google ----------
/** Which sign-in providers the client should offer. */
authRouter.get('/providers', (_req, res) => { res.json({ google: env.googleClientIds[0] ?? null }); });

authRouter.post('/google', authLimiter, validateBody(googleLoginSchema), async (req, res) => {
  if (!env.googleClientIds.length) throw badRequest('google_not_configured');
  let g;
  try { g = await verifyGoogleCredential(req.body.credential, env.googleClientIds); }
  catch (e) { console.error('[auth] Google verification unavailable:', e); throw badRequest('google_failed'); }
  if (!g) throw badRequest('google_failed');

  // 1) The account already linked to this Google account; 2) an account with the same (Google-verified) email,
  // which is linked now; 3) otherwise a new traveler account.
  let u = await db.prepare('SELECT id,email,is_active,google_sub FROM users WHERE google_sub=?').get(g.sub) as any
    ?? await db.prepare('SELECT id,email,is_active,google_sub FROM users WHERE email=?').get(g.email) as any;
  let created = false;
  if (u) {
    if (!u.is_active) throw unauthorized('account_disabled');
    if (u.google_sub && u.google_sub !== g.sub) throw badRequest('google_failed'); // email already linked to a different Google account
    if (!u.google_sub) {
      await db.prepare("UPDATE users SET google_sub=?, updated_at=datetime('now') WHERE id=?").run(g.sub, u.id);
      await audit(req, { id: u.id, email: u.email }, 'google_linked', 'user', u.id);
    }
  } else {
    // No password yet: an unusable random hash. The user can set one later with "Forgot password".
    const unusable = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
    const r = await db.prepare("INSERT INTO users (full_name,email,password_hash,role,preferred_language,google_sub) VALUES (?,?,?, 'traveler', ?, ?)")
      .run(g.name, g.email, unusable, req.body.preferred_language || 'rw', g.sub);
    u = { id: Number(r.lastInsertRowid), email: g.email };
    created = true;
  }
  setSessionCookie(res, u.id);
  await audit(req, { id: u.id, email: u.email }, created ? 'register_google' : 'login_google');
  res.status(created ? 201 : 200).json({ user: await me(u.id), created });
});
