import './lib/asyncRoutes.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env.js';
import { initSchema, usingTurso } from './database/db.js';
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

/** One-time startup work (schema, first admin, stale trips). Runs before the first request is handled,
 *  both for the long-running local server and for each new serverless instance on Vercel. */
let readyPromise: Promise<void> | null = null;
export function ready() {
  readyPromise ??= (async () => {
    await initSchema();
    const msg = await ensureAdmin();
    if (msg.startsWith('Administrator created')) console.log('[db]', msg);
    await completePastTrips();
  })().catch((e) => { readyPromise = null; throw e; });
  return readyPromise;
}

/** Daily housekeeping: mark finished trips completed and send tomorrow's reminders. */
export async function housekeeping() {
  await completePastTrips();
  return { reminders: await sendTripReminders() };
}

export function createApp() {
  const app = express();
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(env.uploadDir, { maxAge: '7d', setHeaders: (r) => r.setHeader('X-Content-Type-Options', 'nosniff') }));

  const api = express.Router();
  api.use(async (_req, _res, next) => { await ready(); next(); });
  api.get('/health', (_req, res) => res.json({ ok: true, database: usingTurso ? 'turso' : 'sqlite-file', uploads: env.blobToken ? 'vercel-blob' : 'local' }));
  // Vercel Cron calls this once a day with "Authorization: Bearer $CRON_SECRET"
  api.get('/cron/daily', async (req, res) => {
    if (!env.cronSecret || req.headers.authorization !== `Bearer ${env.cronSecret}`) return res.status(401).json({ error: 'unauthorized' });
    res.json({ ok: true, ...(await housekeeping()) });
  });
  api.use(apiLimiter);
  api.use(loadUser);
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
    app.get(/^\/(?!api|uploads).*/, async (_req, res) => res.sendFile(path.join(env.clientDist, 'index.html')));
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || err?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || /UNIQUE constraint failed|PRIMARY KEY constraint failed/.test(String(err?.message))) return res.status(409).json({ error: 'conflict' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json' });
    console.error('[error]', err?.message || err);
    res.status(500).json({ error: 'server_error' }); // never leak internals
  });

  // Long-running server only: hourly housekeeping (on Vercel the daily cron above does this).
  if (!env.onVercel) {
    setInterval(() => { housekeeping().catch((e) => console.error(e)); }, 3600_000).unref();
    ready().then(() => sendTripReminders()).catch(() => undefined);
  }
  return app;
}
