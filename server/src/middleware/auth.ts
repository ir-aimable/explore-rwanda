import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../database/db.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export interface AuthUser { id: number; email: string; role: 'traveler' | 'organizer' | 'admin'; full_name: string; organizerId?: number; organizerStatus?: string }
declare global { namespace Express { interface Request { user?: AuthUser } } }

export const COOKIE = 'er_session';

export function signSession(userId: number) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: '7d' });
}
export function setSessionCookie(res: Response, userId: number) {
  res.cookie(COOKIE, signSession(userId), {
    httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: 7 * 24 * 3600 * 1000, path: '/',
  });
}

/** Loads the user fresh from the DB each request so role/active changes take effect immediately. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const p = jwt.verify(token, env.jwtSecret) as unknown as { sub: string };
    const u = await db.prepare(`SELECT u.id,u.email,u.role,u.full_name,u.is_active,o.id AS organizerId,o.status AS organizerStatus
      FROM users u LEFT JOIN organizers o ON o.user_id=u.id WHERE u.id=?`).get(Number(p.sub)) as any;
    if (u && u.is_active) {
      req.user = { id: u.id, email: u.email, role: u.role, full_name: u.full_name,
        organizerId: u.organizerId ?? undefined, organizerStatus: u.organizerStatus ?? undefined };
    }
  } catch { /* invalid or expired token: treat as anonymous */ }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}
export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
/** Approved, non-suspended organizer (admins are NOT organizers; they use admin routes). */
export function requireActiveOrganizer(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'organizer' || !req.user.organizerId) return next(forbidden('not_organizer'));
  if (req.user.organizerStatus !== 'approved') return next(forbidden('organizer_suspended'));
  next();
}
