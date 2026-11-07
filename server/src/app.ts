import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env.js';
import { initSchema } from './database/db.js';
import { ensureAdmin } from './database/init.js';
import { loadUser } from './middleware/auth.js';
import { apiLimiter } from './middleware/limits.js';
import { HttpError } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { tripsRouter } from './routes/trips.js';
import { registrationsRouter } from './routes/registrations.js';
import { searchRouter } from './routes/search.js';
import { adminRouter, costsRouter } from './routes/admin.js';
import { completePastTrips, sendTripReminders } from './services/notifications/reminders.js';

export function createApp() {
  initSchema();
  ensureAdmin();
  completePastTrips();
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(env.uploadDir, { maxAge: '7d', setHeaders: (r) => r.setHeader('X-Content-Type-Options', 'nosniff') }));

  const api = express.Router();
  api.use(apiLimiter);
  api.use(loadUser);
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRouter);
  api.use('/search', searchRouter);
  api.use('/trips', tripsRouter);
  api.use('/costs', costsRouter);
  api.use('/admin', adminRouter);
  api.use('/', registrationsRouter);
  api.use('/', publicRouter);
  api.use((_req, _res, next) => next(new HttpError(404, 'not_found')));
  app.use('/api', api);

  // Serve the built client when present (single-process production/demo mode)
  if (fs.existsSync(path.join(env.clientDist, 'index.html'))) {
    app.use(express.static(env.clientDist));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(env.clientDist, 'index.html')));
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || err?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return res.status(409).json({ error: 'conflict' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json' });
    console.error('[error]', err?.message || err);
    res.status(500).json({ error: 'server_error' }); // never leak internals
  });

  setInterval(() => { try { completePastTrips(); sendTripReminders(); } catch (e) { console.error(e); } }, 3600_000).unref();
  try { sendTripReminders(); } catch { /* ignore */ }
  return app;
}
