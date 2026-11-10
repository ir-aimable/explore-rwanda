import { Router } from 'express';
import { db } from '../database/db.js';
import { validateBody } from '../middleware/validate.js';
import { aiLimiter } from '../middleware/limits.js';
import { assistantSchema } from '../validators/schemas.js';
import { interpret, localizeRec, runAssistant } from '../services/ai/assistant.js';
import { discover } from '../services/search/discovery.js';
import { listPublicTrips } from '../services/search/tripService.js';
import { suggest } from '../services/search/suggest.js';
import { hintText, understoodText } from '../services/ai/messages.js';
import { extractDate } from '../services/ai/nlp.js';

export const searchRouter = Router();

// AI trip assistant (public, read-only)
searchRouter.post('/assistant', aiLimiter, validateBody(assistantSchema), async (req, res) => {
  const { message, lang, context } = req.body;
  res.json(await runAssistant(message, lang, context));
});

// Central search used by homepage, trip discovery, budget search and destination search.
searchRouter.get('/', aiLimiter, async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'rw';
  const q = String(req.query.q || '').slice(0, 300);
  const intent = await interpret(q);
  // Explicit UI filters override what was parsed from text.
  if (req.query.category) intent.category = String(req.query.category);
  if (req.query.max_price && !isNaN(Number(req.query.max_price))) intent.budget = Number(req.query.max_price);
  if (req.query.location) intent.location = String(req.query.location);
  if (req.query.people && Number(req.query.people) > 0) intent.people = Number(req.query.people);
  if (req.query.date) intent.date = { dateFrom: String(req.query.date), dateTo: String(req.query.date), label: String(req.query.date), labelKey: 'date_exact', exact: true };
  else if (req.query.weekend === '1') intent.date = extractDate('this weekend');

  const catRow = intent.category ? (await db.prepare('SELECT name_en,name_rw FROM categories WHERE slug=?').get(intent.category) as any) : undefined;
  const understood = understoodText(intent, lang, catRow ? (lang === 'rw' ? catRow.name_rw : catRow.name_en) : undefined);

  let trips: any[]; let alternatives: any[] = []; let unavailable: any[] = []; let state: string | undefined; let destinations: any[] = []; let hints: string[] = []; let total: number;
  if (req.query.all === '1') {
    // Browse mode: include trips that are full / closed (flagged), same intent filters.
    const r = await listPublicTrips({
      category: intent.category, maxPrice: intent.budget, dateFrom: intent.date?.dateFrom, dateTo: intent.date?.dateTo,
      weekdays: intent.date?.weekdays, destination: intent.location, minSeats: intent.people,
      q: !intent.category && !intent.location && intent.budget === undefined && !intent.date && q.trim().length > 1 && intent.detected.length === 0 ? q.trim() : undefined,
      sort: (req.query.sort as any) || 'date', limit: 100,
    });
    trips = r.items; total = r.total;
    if (!trips.length) { const d = await discover(intent, 6); alternatives = d.alternatives.map((t) => localizeRec(t, lang)); destinations = d.destinations; hints = d.hints.map((h) => hintText(h, lang)).filter(Boolean); }
  } else {
    const d = await discover(intent, 100);
    trips = d.trips.map((t) => localizeRec(t, lang)); alternatives = d.alternatives.map((t) => localizeRec(t, lang));
    unavailable = d.unavailable.map((t) => localizeRec(t, lang)); state = d.state;
    destinations = d.destinations; hints = d.hints.map((h) => hintText(h, lang)).filter(Boolean); total = d.trips.length;
  }
  res.json({ intent, understood, state, total, trips, alternatives, unavailable, destinations, hints });
});

searchRouter.get('/suggest', aiLimiter, async (req, res) => {
  res.json({ items: await suggest(String(req.query.q || ''), req.query.lang === 'en' ? 'en' : 'rw') });
});
