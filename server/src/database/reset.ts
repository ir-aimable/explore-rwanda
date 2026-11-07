import fs from 'node:fs';
import { env } from '../config/env.js';
for (const suffix of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(env.databasePath + suffix); } catch { /* not present */ }
}
console.log('[db] database deleted:', env.databasePath);
console.log('[db] run `npm run db:init` and `npm run db:seed` to recreate it.');
