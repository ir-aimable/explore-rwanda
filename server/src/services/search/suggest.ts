import { db } from '../../database/db.js';
import { norm } from '../ai/nlp.js';
import { findPlace, placeTerms } from '../geo/rwanda.js';
import { todayStr } from '../../lib/time.js';

export interface Suggestion {
  type: 'destination' | 'trip' | 'experience' | 'activity' | 'place';
  label: string;   // main line
  sub?: string;    // second line (region, date, price…)
  value: string;   // text put in the search box
  link: string;    // where choosing it goes
  free?: boolean;
}
const PROVINCE: Record<string, [string, string]> = {
  Kigali: ['Umujyi wa Kigali', 'Kigali City'], Northern: ['Amajyaruguru', 'Northern Province'], Southern: ['Amajyepfo', 'Southern Province'],
  Eastern: ['Iburasirazuba', 'Eastern Province'], Western: ['Iburengerazuba', 'Western Province'],
};
const rwf = (n: number) => `RWF ${n.toLocaleString('en-US')}`;

/** How well a name matches what was typed: 0 starts with it, 1 a word starts with it, 2 contains it, -1 no match. */
function rank(name: string, n: string) {
  const x = norm(name);
  if (x.startsWith(n)) return 0;
  if (x.split(/[^a-z0-9]+/).some((w) => w.startsWith(n))) return 1;
  return x.includes(n) ? 2 : -1;
}
/** Best rank among several fields; a secondary field (region, place) counts one step lower. -1 when nothing matches. */
function best(primary: string[], secondary: string[], n: string) {
  const rs = [...primary.map((x) => rank(x, n)), ...secondary.map((x) => { const r = rank(x, n); return r < 0 ? -1 : r + 1; })].filter((r) => r >= 0);
  return rs.length ? Math.min(...rs) : -1;
}
const ORDER: Suggestion['type'][] = ['destination', 'trip', 'experience', 'activity', 'place'];

/** Type-ahead suggestions drawn from real records and the built-in map of Rwanda ("nya" -> Nyandungu Eco-Park, Nyanza…). */
export async function suggest(q: string, lang: 'rw' | 'en'): Promise<Suggestion[]> {
  const n = norm(q.trim()).replace(/\s+/g, ' ');
  if (n.length < 2) return [];
  const L = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const found: (Suggestion & { r: number; k?: number })[] = [];
  const add = (r: number, s: Suggestion) => { if (r >= 0) found.push({ ...s, r }); };

  const dests = await db.prepare('SELECT id,name,region,is_free FROM destinations WHERE is_published=1').all() as any[];
  for (const d of dests) add(best([d.name], [d.region], n),
    { type: 'destination', label: d.name, sub: d.region, value: d.name, link: `/destinations/${d.id}`, free: !!d.is_free });

  const trips = await db.prepare(`SELECT t.id,t.title,t.trip_date,t.price,d.name AS dest FROM trips t JOIN organizers o ON o.id=t.organizer_id JOIN destinations d ON d.id=t.destination_id
    WHERE t.status='published' AND o.status='approved' AND t.trip_date>=? ORDER BY t.trip_date`).all(todayStr()) as any[];
  for (const t of trips) add(rank(t.title.replace(/\s*\(demo\)\s*/i, ' '), n),
    { type: 'trip', label: t.title, sub: `${t.dest} · ${t.trip_date} · ${t.price === 0 ? L('Ubuntu', 'Free') : rwf(t.price)}`, value: t.title, link: `/trips/${t.id}` });

  const exps = await db.prepare(`SELECT e.title_en,e.title_rw,e.location,e.price_from,e.destination_id,c.slug FROM experiences e LEFT JOIN categories c ON c.id=e.category_id
    LEFT JOIN organizers o ON o.id=e.organizer_id WHERE e.is_published=1 AND (e.organizer_id IS NULL OR o.status='approved')`).all() as any[];
  for (const e of exps) {
    const title = L(e.title_rw, e.title_en);
    add(best([title], [e.location], n),
      { type: 'experience', label: title, sub: `${e.location} · ${L('guhera kuri', 'from')} ${rwf(e.price_from)}`, value: title,
        link: e.destination_id ? `/destinations/${e.destination_id}${e.slug ? `?activity=${e.slug}` : ''}` : `/trips?q=${encodeURIComponent(e.location)}` });
  }

  const cats = await db.prepare('SELECT slug,name_rw,name_en FROM categories WHERE is_active=1').all() as any[];
  for (const c of cats) {
    add(best([c.name_en, c.name_rw, c.slug], [], n), { type: 'activity', label: L(c.name_rw, c.name_en), sub: L('Igikorwa', 'Activity'), value: L(c.name_rw, c.name_en), link: `/trips?category=${c.slug}` });
  }

  // Towns, areas and sites from the map of Rwanda, unless a destination already has that name. A place matches on its
  // own name or an old name ("Gisenyi" -> Rubavu), never on a district it merely contains. Places come after real records.
  const destNames = new Set(dests.map((d) => norm(d.name)));
  const seen = new Set<string>();
  const KIND = { city: 0, town: 1, area: 2, site: 3 } as const;
  for (const p of placeTerms()) {
    if (seen.has(p.canonical)) continue;
    const place = findPlace(p.canonical);
    if (!place || destNames.has(norm(place.name))) continue;
    const own = rank(place.name, n);
    const alias = own < 0 ? place.aliases?.find((a) => rank(a, n) >= 0 && rank(a, n) < 2) : undefined;
    if (!(own >= 0 && own < 2) && !alias) continue;
    seen.add(p.canonical);
    found.push({ type: 'place', label: alias ? `${place.name} (${alias.replace(/\b\w/g, (c) => c.toUpperCase())})` : place.name, value: place.name, link: `/trips?q=${encodeURIComponent(place.name)}`,
      sub: `${L(`Akarere ka ${place.district}`, `${place.district} District`)}, ${L(...PROVINCE[place.province])}`, r: (alias ? rank(alias, n) : own) + 1, k: KIND[place.kind] });
  }

  // Best matches first; at most 3 of a kind so every kind of answer can show up
  found.sort((a, b) => a.r - b.r || ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || (a.k ?? 0) - (b.k ?? 0) || a.label.length - b.label.length || a.label.localeCompare(b.label));
  const per = new Map<string, number>(); const out: Suggestion[] = [];
  for (const { r: _r, k: _k, ...s } of found) {
    if ((per.get(s.type) || 0) >= 3) continue;
    per.set(s.type, (per.get(s.type) || 0) + 1); out.push(s);
    if (out.length >= 8) break;
  }
  return out;
}
