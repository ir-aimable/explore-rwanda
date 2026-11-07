import { db } from '../../database/db.js';
import { norm } from '../ai/nlp.js';

/** Type-ahead suggestions drawn from real records only. */
export function suggest(q: string, lang: 'rw' | 'en') {
  const n = norm(q.trim());
  if (n.length < 2) return [];
  const like = `%${q.trim()}%`;
  const out: { type: string; label: string; value: string; link?: string }[] = [];
  (db.prepare("SELECT id,name,region FROM destinations WHERE is_published=1 AND (name LIKE ? OR region LIKE ?) LIMIT 4").all(like, like) as any[])
    .forEach((d) => out.push({ type: 'destination', label: `${d.name} · ${d.region}`, value: d.name, link: `/destinations/${d.id}` }));
  (db.prepare("SELECT slug,name_rw,name_en FROM categories WHERE is_active=1 AND (name_en LIKE ? OR name_rw LIKE ? OR slug LIKE ?) LIMIT 3").all(like, like, like) as any[])
    .forEach((c) => out.push({ type: 'activity', label: lang === 'rw' ? c.name_rw : c.name_en, value: lang === 'rw' ? c.name_rw : c.name_en }));
  (db.prepare("SELECT t.id,t.title FROM trips t JOIN organizers o ON o.id=t.organizer_id WHERE t.status='published' AND o.status='approved' AND t.title LIKE ? LIMIT 4").all(like) as any[])
    .forEach((t) => out.push({ type: 'trip', label: t.title, value: t.title, link: `/trips/${t.id}` }));
  return out.slice(0, 8);
}
