// "Things to do" cards shown on the home page (e.g. milking cows in Bigogwe, boating on Lake Kivu).
// Each card is an activity mapped to a destination: clicking it opens that destination's open trips for the activity.
// Administrators manage every card; approved organizers manage their own and can recommend other organizers' cards.
import { Router, type Request } from 'express';
import { db } from '../database/db.js';
import { requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { audit } from '../lib/audit.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { receiveImage, removeUpload } from '../lib/upload.js';
import { experienceSchema } from '../validators/schemas.js';
import { listPublicTrips } from '../services/search/tripService.js';

export const experiencesRouter = Router();

// Rating: the starting rating set by the card's organizer/admin (if any) averaged with every visible traveller review
// of trips for this activity at the card's destination (any activity when the card has none).
const SELECT = `SELECT e.*, d.name AS destination_name, d.slug AS destination_slug, d.is_published AS destination_published,
  c.slug AS category_slug, c.name_en AS category_name_en, c.name_rw AS category_name_rw,
  o.display_name AS organizer_name, o.status AS organizer_status,
  (SELECT SUM(rv.rating) FROM reviews rv JOIN trips t ON t.id=rv.trip_id
     WHERE rv.status='visible' AND rv.destination_id=e.destination_id AND (e.category_id IS NULL OR t.category_id=e.category_id)) AS review_sum,
  (SELECT COUNT(*) FROM reviews rv JOIN trips t ON t.id=rv.trip_id
     WHERE rv.status='visible' AND rv.destination_id=e.destination_id AND (e.category_id IS NULL OR t.category_id=e.category_id)) AS review_n,
  (SELECT COUNT(*) FROM experience_recommendations er JOIN organizers ro ON ro.id=er.organizer_id
     WHERE er.experience_id=e.id AND ro.status='approved') AS recommendations
  FROM experiences e
  LEFT JOIN destinations d ON d.id=e.destination_id
  LEFT JOIN categories c ON c.id=e.category_id
  LEFT JOIN organizers o ON o.id=e.organizer_id`;

/** Open trips per destination, and per destination + activity. */
async function openTripCounts() {
  const all = new Map<number, number>(); const byAct = new Map<string, number>();
  for (const t of (await listPublicTrips({ unlimited: true })).items) {
    if (!t.is_open) continue;
    all.set(t.destination.id, (all.get(t.destination.id) || 0) + 1);
    const k = `${t.destination.id}:${t.category.slug}`; byAct.set(k, (byAct.get(k) || 0) + 1);
  }
  return { all, byAct };
}

async function shapeAll(rows: any[], viewerOrg?: number) {
  const open = await openTripCounts();
  const recs = rows.length ? await db.prepare(`SELECT er.experience_id, er.organizer_id, o.display_name FROM experience_recommendations er
    JOIN organizers o ON o.id=er.organizer_id WHERE o.status='approved' AND er.experience_id IN (${rows.map(() => '?').join(',')}) ORDER BY er.created_at`)
    .all(...rows.map((r) => r.id)) as any[] : [];
  return rows.map((r) => {
    const mine = recs.filter((x) => x.experience_id === r.id);
    const n = Number(r.review_n || 0) + (r.initial_rating ? 1 : 0);
    const avg = n ? Math.round(((Number(r.review_sum || 0) + (r.initial_rating || 0)) / n) * 10) / 10 : null;
    return {
      id: r.id, title_en: r.title_en, title_rw: r.title_rw, location: r.location, price_from: r.price_from, duration: r.duration,
      image_path: r.image_path, sort_order: r.sort_order, is_published: !!r.is_published, is_demo: !!r.is_demo,
      destination: r.destination_id ? { id: r.destination_id, name: r.destination_name, slug: r.destination_slug, published: !!r.destination_published } : null,
      category: r.category_id ? { id: r.category_id, slug: r.category_slug, name_en: r.category_name_en, name_rw: r.category_name_rw } : null,
      organizer: r.organizer_id ? { id: r.organizer_id, display_name: r.organizer_name } : null,
      initial_rating: r.initial_rating ?? null, avg_rating: avg, rating_count: n, review_count: Number(r.review_n || 0),
      recommendations: r.recommendations, recommended_by: mine.slice(0, 3).map((x) => x.display_name),
      recommended_by_me: viewerOrg ? mine.some((x) => x.organizer_id === viewerOrg) : false,
      // open trips for this activity at the destination (all open trips there when the card has no activity)
      open_trips: r.destination_id ? (r.category_id ? open.byAct.get(`${r.destination_id}:${r.category_slug}`) || 0 : open.all.get(r.destination_id) || 0) : 0,
    };
  });
}
type Shaped = Awaited<ReturnType<typeof shapeAll>>[number];

/** Best rated first, then most reviews, most organizer recommendations, most open trips; the admin "position" breaks ties. */
const byRank = (a: Shaped, b: Shaped) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1) || b.rating_count - a.rating_count
  || b.recommendations - a.recommendations || b.open_trips - a.open_trips || a.sort_order - b.sort_order || a.id - b.id;

const viewerOrg = (req: Request) => (req.user?.role === 'organizer' && req.user.organizerStatus === 'approved' ? req.user.organizerId : undefined);

// ---------- Public ----------
experiencesRouter.get('/', async (req, res) => {
  const rows = await db.prepare(`${SELECT} WHERE e.is_published=1 AND (e.organizer_id IS NULL OR o.status='approved')
    AND (e.destination_id IS NULL OR d.is_published=1)`).all();
  res.json({ items: (await shapeAll(rows, viewerOrg(req))).sort(byRank).slice(0, 24) });
});

// ---------- Management (admin: all cards; organizer: own cards) ----------
const manager = requireRole('admin', 'organizer');
function assertOrganizerActive(req: Request) {
  if (req.user!.role !== 'organizer') return;
  if (!req.user!.organizerId) throw forbidden('not_organizer');
  if (req.user!.organizerStatus !== 'approved') throw forbidden('organizer_suspended');
}
async function ownedRow(req: Request) {
  const row = await db.prepare('SELECT * FROM experiences WHERE id=?').get(Number(req.params.id)) as any;
  if (!row) throw notFound();
  if (req.user!.role !== 'admin') {
    assertOrganizerActive(req);
    if (row.organizer_id !== req.user!.organizerId) throw forbidden();
  }
  return row;
}
async function checkRefs(b: any) {
  if (!await db.prepare('SELECT 1 x FROM destinations WHERE id=?').get(b.destination_id)) throw badRequest('invalid_destination');
  if (b.category_id && !await db.prepare('SELECT 1 x FROM categories WHERE id=?').get(b.category_id)) throw badRequest('invalid_category');
}

experiencesRouter.get('/manage', manager, async (req, res) => {
  const rows = req.user!.role === 'admin'
    ? await db.prepare(SELECT).all()
    : await db.prepare(`${SELECT} WHERE e.organizer_id=?`).all(req.user!.organizerId ?? -1);
  res.json({ items: (await shapeAll(rows, viewerOrg(req))).sort(byRank) });
});

experiencesRouter.post('/', manager, validateBody(experienceSchema), async (req, res) => {
  assertOrganizerActive(req);
  const b = req.body; await checkRefs(b);
  const orgId = req.user!.role === 'organizer' ? req.user!.organizerId : null;
  const r = await db.prepare(`INSERT INTO experiences (title_en,title_rw,location,destination_id,category_id,organizer_id,price_from,duration,sort_order,initial_rating,is_published,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.title_en, b.title_rw, b.location, b.destination_id, b.category_id ?? null, orgId,
    b.price_from, b.duration || null, b.sort_order, b.initial_rating ?? null, b.is_published ? 1 : 0, req.user!.id);
  const id = Number(r.lastInsertRowid);
  await audit(req, req.user!, 'experience_create', 'experience', id, { title: b.title_en });
  res.status(201).json({ id });
});

experiencesRouter.put('/:id', manager, validateBody(experienceSchema), async (req, res) => {
  const row = await ownedRow(req); const b = req.body; await checkRefs(b);
  await db.prepare(`UPDATE experiences SET title_en=?,title_rw=?,location=?,destination_id=?,category_id=?,price_from=?,duration=?,sort_order=?,initial_rating=?,is_published=?,
    updated_at=datetime('now') WHERE id=?`).run(b.title_en, b.title_rw, b.location, b.destination_id, b.category_id ?? null,
    b.price_from, b.duration || null, b.sort_order, b.initial_rating ?? null, b.is_published ? 1 : 0, row.id);
  await audit(req, req.user!, 'experience_update', 'experience', row.id, { title: b.title_en });
  res.json({ ok: true });
});

experiencesRouter.delete('/:id', manager, async (req, res) => {
  const row = await ownedRow(req);
  await db.prepare('DELETE FROM experiences WHERE id=?').run(row.id); await removeUpload(row.image_path);
  await audit(req, req.user!, 'experience_delete', 'experience', row.id, { title: row.title_en });
  res.json({ ok: true });
});

experiencesRouter.post('/:id/image', manager, async (req, res) => {
  const row = await ownedRow(req);
  const p = await receiveImage(req, res);
  await removeUpload(row.image_path);
  await db.prepare("UPDATE experiences SET image_path=?, updated_at=datetime('now') WHERE id=?").run(p, row.id);
  await audit(req, req.user!, 'experience_image', 'experience', row.id);
  res.status(201).json({ path: p });
});

// ---------- Organizer recommendations (approved organizers, other organizers' / platform cards only) ----------
async function recommendable(req: Request) {
  if (req.user!.role !== 'organizer') throw forbidden('not_organizer');
  assertOrganizerActive(req);
  const row = await db.prepare('SELECT id,organizer_id,is_published,title_en FROM experiences WHERE id=?').get(Number(req.params.id)) as any;
  if (!row || !row.is_published) throw notFound();
  if (row.organizer_id === req.user!.organizerId) throw badRequest('cannot_recommend_own');
  return row;
}
experiencesRouter.post('/:id/recommend', requireRole('organizer'), async (req, res) => {
  const row = await recommendable(req);
  await db.prepare('INSERT OR IGNORE INTO experience_recommendations (experience_id,organizer_id) VALUES (?,?)').run(row.id, req.user!.organizerId);
  await audit(req, req.user!, 'experience_recommend', 'experience', row.id, { title: row.title_en });
  res.json({ ok: true });
});
experiencesRouter.delete('/:id/recommend', requireRole('organizer'), async (req, res) => {
  const row = await recommendable(req);
  await db.prepare('DELETE FROM experience_recommendations WHERE experience_id=? AND organizer_id=?').run(row.id, req.user!.organizerId);
  await audit(req, req.user!, 'experience_unrecommend', 'experience', row.id, { title: row.title_en });
  res.json({ ok: true });
});
