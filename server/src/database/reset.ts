import fs from 'node:fs';
import { env } from '../config/env.js';
if (env.tursoUrl) {
  console.error('[db] db:reset only deletes the local SQLite file. To reset the Turso database, recreate it: turso db destroy <name> && turso db create <name>.');
  process.exit(1);
}
for (const suffix of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(env.databasePath + suffix); } catch { /* not present */ }
}
console.log('[db] database deleted:', env.databasePath);
console.log('[db] run `npm run db:init` and `npm run db:seed` to recreate it.');
