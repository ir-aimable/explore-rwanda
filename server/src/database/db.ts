import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { SCHEMA } from './schema.js';

fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
export const db = new Database(env.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema() {
  db.exec(SCHEMA);
  const cats: [string, string, string][] = [
    ['hiking', 'Gutembera ku musozi', 'Hiking'],
    ['swimming', 'Koga', 'Swimming'],
    ['nature', 'Ibidukikije', 'Nature'],
    ['wildlife', 'Inyamaswa', 'Wildlife / Safari'],
    ['culture', 'Umuco', 'Culture'],
    ['waterfall', 'Ibishanga n’amazi atemba', 'Waterfalls'],
    ['boating', 'Kugenda mu bwato', 'Boating'],
    ['cycling', 'Gutwara igare', 'Cycling'],
  ];
  const ins = db.prepare('INSERT OR IGNORE INTO categories (slug,name_rw,name_en) VALUES (?,?,?)');
  const defaults: Record<string, string> = {
    platform_name: 'Explore Rwanda',
    contact_email: 'support@explore-rwanda.example',
    allow_organizer_applications: 'true',
    max_seats_per_registration: '10',
  };
  const setIns = db.prepare('INSERT OR IGNORE INTO system_settings (key,value) VALUES (?,?)');
  db.transaction(() => {
    cats.forEach((c) => ins.run(...c));
    Object.entries(defaults).forEach(([k, v]) => setIns.run(k, v));
  })();
}
