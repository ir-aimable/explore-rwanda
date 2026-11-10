// Database access, async, with two interchangeable backends:
//  - production on Vercel: a hosted Turso (libSQL) database, when TURSO_DATABASE_URL is set
//  - local development and tests: a plain SQLite file (DATABASE_PATH) through better-sqlite3
// The API mirrors better-sqlite3 (`db.prepare(sql).get/all/run`), but every call returns a promise.
// Statements issued inside `db.transaction(fn)` automatically run on that transaction (AsyncLocalStorage),
// so helpers such as getTripRow / notify / audit join it without being passed a handle.
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { SCHEMA } from './schema.js';
import { findPlace } from '../services/geo/rwanda.js';

export interface RunResult { changes: number; lastInsertRowid: number }
interface Result { rows: Record<string, unknown>[]; changes: number; lastInsertRowid: number }
/** One connection-like thing that can execute a statement. */
interface Conn { exec(sql: string, args: unknown[]): Promise<Result> }
interface Backend {
  read: Conn;                                   // reads outside a transaction
  write(sql: string, args: unknown[]): Promise<Result>;  // single write outside a transaction
  begin(): Promise<{ conn: Conn; commit(): Promise<void>; rollback(): Promise<void> }>;
  script(sql: string): Promise<void>;
  close(): void;
}

const clean = (args: unknown[]) => args.map((a) => (typeof a === 'boolean' ? (a ? 1 : 0) : a === undefined ? null : a));

// ---------- Local file: better-sqlite3 (one connection, foreign keys always on) ----------
async function localBackend(file: string): Promise<Backend> {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const { default: Database } = await import('better-sqlite3');
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');
  const run = (sql: string, args: unknown[]): Result => {
    const st = sqlite.prepare(sql);
    if (st.reader) return { rows: st.all(...clean(args)) as any[], changes: 0, lastInsertRowid: 0 };
    const r = st.run(...clean(args));
    return { rows: [], changes: r.changes, lastInsertRowid: Number(r.lastInsertRowid) };
  };
  const conn: Conn = { exec: async (sql, args) => run(sql, args) };
  return {
    read: conn,
    write: async (sql, args) => run(sql, args),
    begin: async () => {
      sqlite.exec('BEGIN IMMEDIATE');
      return { conn, commit: async () => { sqlite.exec('COMMIT'); }, rollback: async () => { if (sqlite.inTransaction) sqlite.exec('ROLLBACK'); } };
    },
    script: async (sql) => { sqlite.exec(sql); },
    close: () => sqlite.close(),
  };
}

// ---------- Turso: Hrana over HTTP (pure JS, works in serverless functions) ----------
// Foreign keys are off by default in Turso and the pragma only lasts for one stream, so every write
// stream turns them on first (ON DELETE CASCADE / RESTRICT behave exactly as in local SQLite).
async function tursoBackend(url: string, token?: string): Promise<Backend> {
  const hrana = await import('@libsql/hrana-client');
  const client = hrana.openHttp(url.replace(/^libsql:\/\//, 'https://'), token);
  const toResult = (r: any): Result => ({
    rows: (r.rows || []).map((row: any) => {
      const o: Record<string, unknown> = {};
      r.columnNames.forEach((c: string | undefined, i: number) => { if (c !== undefined) o[c] = row[i]; });
      return o;
    }),
    changes: r.affectedRowCount ?? 0,
    lastInsertRowid: Number(r.lastInsertRowid ?? 0),
  });
  const onStream = (s: any): Conn => ({ exec: async (sql, args) => toResult(await s.query([sql, clean(args)])) });
  const writeStream = async () => {
    const s = client.openStream();
    s.intMode = 'number';
    await s.run('PRAGMA foreign_keys = ON');
    return s;
  };
  return {
    read: { exec: async (sql, args) => {
      const s = client.openStream(); s.intMode = 'number';
      try { return toResult(await s.query([sql, clean(args)])); } finally { s.close(); }
    } },
    write: async (sql, args) => {
      const s = await writeStream();
      try { return toResult(await s.query([sql, clean(args)])); } finally { s.close(); }
    },
    begin: async () => {
      const s = await writeStream();
      await s.run('BEGIN IMMEDIATE');
      return {
        conn: onStream(s),
        commit: async () => { try { await s.run('COMMIT'); } finally { s.close(); } },
        rollback: async () => { try { await s.run('ROLLBACK'); } catch { /* stream may be gone */ } finally { s.close(); } },
      };
    },
    script: async (sql) => {
      const s = client.openStream();
      try { await s.sequence(sql); } finally { s.close(); }
    },
    close: () => client.close(),
  };
}

if (env.onVercel && !env.tursoUrl) {
  throw new Error('TURSO_DATABASE_URL is not set: on Vercel the data must live in a hosted Turso database (see README, "Deploy on Vercel").');
}
const backend: Backend = env.tursoUrl ? await tursoBackend(env.tursoUrl, env.tursoToken || undefined) : await localBackend(env.databasePath);
export const usingTurso = !!env.tursoUrl;

/** One writer at a time inside this process (SQLite allows a single writer). */
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}
const txStore = new AsyncLocalStorage<Conn>();
const isBusy = (e: any) => /SQLITE_BUSY|database is locked/i.test(`${e?.code || ''} ${e?.message || ''}`);

export interface Statement {
  get<T = any>(...args: unknown[]): Promise<T | undefined>;
  all<T = any>(...args: unknown[]): Promise<T[]>;
  run(...args: unknown[]): Promise<RunResult>;
}

export const db = {
  prepare(sql: string): Statement {
    const read = (args: unknown[]) => (txStore.getStore() ?? backend.read).exec(sql, args);
    return {
      get: async (...a) => (await read(a)).rows[0] as any,
      all: async (...a) => (await read(a)).rows as any[],
      run: async (...a) => {
        const tx = txStore.getStore();
        const r = tx ? await tx.exec(sql, a) : await exclusive(() => backend.write(sql, a));
        return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
      },
    };
  },
  /** Several statements separated by semicolons (schema). */
  exec: (sql: string) => exclusive(() => backend.script(sql)),
  /** Write transaction (BEGIN IMMEDIATE): everything inside commits or rolls back together. Nested calls join it. */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (txStore.getStore()) return fn();
    return exclusive(async () => {
      for (let attempt = 0; ; attempt++) {
        let tx: Awaited<ReturnType<Backend['begin']>>;
        try { tx = await backend.begin(); } catch (e) {
          if (isBusy(e) && attempt < 5) { await new Promise((r) => setTimeout(r, 150 * (attempt + 1))); continue; }
          throw e;
        }
        try {
          const out = await txStore.run(tx.conn, fn);
          await tx.commit();
          return out;
        } catch (e) {
          await tx.rollback();
          throw e;
        }
      }
    });
  },
  close: () => backend.close(),
};

const CATEGORIES: [string, string, string][] = [
  ['hiking', 'Gutembera ku musozi', 'Hiking'],
  ['swimming', 'Koga', 'Swimming'],
  ['nature', 'Ibidukikije', 'Nature'],
  ['wildlife', 'Inyamaswa', 'Wildlife / Safari'],
  ['culture', 'Umuco', 'Culture'],
  ['waterfall', 'Ibishanga n’amazi atemba', 'Waterfalls'],
  ['boating', 'Kugenda mu bwato', 'Boating'],
  ['cycling', 'Gutwara igare', 'Cycling'],
];
/** Default public-transport starting locations (always present; admins can add others). */
export const DEFAULT_HUBS = ['Kigali', 'Musanze', 'Rubavu', 'Muhanga', 'Kayonza', 'Rwamagana'];
const DEFAULT_SETTINGS: Record<string, string> = {
  platform_name: 'Explore Rwanda',
  contact_email: 'support@explore-rwanda.example',
  allow_organizer_applications: 'true',
  max_seats_per_registration: '10',
};

export async function initSchema() {
  await db.exec(SCHEMA);
  await db.transaction(async () => {
    for (const c of CATEGORIES) await db.prepare('INSERT OR IGNORE INTO categories (slug,name_rw,name_en) VALUES (?,?,?)').run(...c);
    for (const [i, name] of DEFAULT_HUBS.entries()) {
      const p = findPlace(name)!;
      await db.prepare('INSERT OR IGNORE INTO transport_hubs (name,latitude,longitude,is_default,sort_order) VALUES (?,?,?,1,?)').run(name, p.lat, p.lng, i);
    }
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) await db.prepare('INSERT OR IGNORE INTO system_settings (key,value) VALUES (?,?)').run(k, v);
  });
}
