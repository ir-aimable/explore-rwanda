import bcrypt from 'bcryptjs';
import { db, initSchema } from './db.js';
import { env } from '../config/env.js';

export async function ensureAdmin(): Promise<string> {
  const existing = await db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
  if (existing) return 'Administrator already exists - skipped.';
  if (!env.adminEmail || !env.adminPassword) {
    return 'No administrator created: set ADMIN_EMAIL and ADMIN_PASSWORD in .env then run `npm run db:init` again.';
  }
  if (env.adminPassword.length < 10) return 'ADMIN_PASSWORD must be at least 10 characters. Administrator not created.';
  const hash = bcrypt.hashSync(env.adminPassword, 12);
  await db.prepare("INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,'admin')")
    .run(env.adminName, env.adminEmail, hash);
  return `Administrator created: ${env.adminEmail}`;
}

if (process.argv[1] && /init\.(ts|js)$/.test(process.argv[1])) {
  await initSchema();
  console.log('[db] schema ready at', env.tursoUrl ? env.tursoUrl : env.databasePath);
  console.log('[db]', await ensureAdmin());
}
