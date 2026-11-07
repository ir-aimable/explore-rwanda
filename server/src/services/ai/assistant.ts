import { db } from '../../database/db.js';
import { discover, getLexicon, type DiscoveryResult } from '../search/discovery.js';
import { listPublicTrips } from '../search/tripService.js';
import { mergeContext, needsClarification, parseIntent, type Intent } from './nlp.js';
import { hintText, msg, reasonText, understoodText } from './messages.js';
import { rephrase } from './ollama.js';

type Lang = 'rw' | 'en';

export function localizeRec(r: DiscoveryResult['trips'][number], lang: Lang) {
  return { ...r, reasons: r.reasons.map((x) => reasonText(x, lang)).filter(Boolean), reason_keys: r.reasons.map((x) => x.key) };
}

export function interpret(message: string, ctx?: any): Intent {
  return mergeContext(parseIntent(message, getLexicon()), ctx);
}

export async function runAssistant(message: string, lang: Lang, ctx?: any) {
  const intent = interpret(message, ctx);
  const base = { engine: 'rules' as 'rules' | 'rules+ollama', intent, context: { budget: intent.budget, category: intent.category, date: intent.date, location: intent.location, people: intent.people } };
  const catName = intent.category ? (db.prepare('SELECT name_en,name_rw FROM categories WHERE slug=?').get(intent.category) as any) : undefined;
  const catLabel = catName ? (lang === 'rw' ? catName.name_rw : catName.name_en) : undefined;
  const understood = understoodText(intent, lang, catLabel);

  if (intent.action === 'greeting') return { ...base, message: msg.greeting(lang), understood, trips: [], alternatives: [], destinations: [], hints: [] };
  if (intent.action === 'help') return { ...base, message: msg.help(lang), understood, trips: [], alternatives: [], destinations: [], hints: [] };
  if (intent.action === 'blocked_action') return { ...base, message: msg.blockedAction(lang), understood, trips: [], alternatives: [], destinations: [], hints: [] };
  if (intent.action === 'blocked_private') return { ...base, message: msg.blockedPrivate(lang), understood, trips: [], alternatives: [], destinations: [], hints: [] };
  if (needsClarification(intent)) {
    const c = msg.clarify(lang);
    return { ...base, message: c.question, clarification: c, understood, trips: [], alternatives: [], destinations: [], hints: [] };
  }

  const r = discover(intent);
  let text: string;
  if (listPublicTrips({ limit: 1 }).total === 0) text = msg.noDataNote(lang);
  else if (r.trips.length) text = msg.found(lang, r.trips.length, catLabel);
  else text = msg.none(lang);

  if (r.trips.length) {
    const o = await rephrase(text, { trips: r.trips.map((t) => ({ title: t.title, date: t.trip_date, price: t.price, spaces: t.remaining_spaces })) }, lang);
    if (o) { text = o; base.engine = 'rules+ollama'; }
  }
  return {
    ...base, message: text, understood,
    trips: r.trips.map((t) => localizeRec(t, lang)),
    alternatives: r.alternatives.map((t) => localizeRec(t, lang)),
    alternatives_title: r.alternatives.length ? msg.alternativesTitle(lang) : undefined,
    destinations: r.destinations, destinations_note: r.destinations.length ? msg.destinationsNote(lang) : undefined,
    hints: r.hints.map((h) => hintText(h, lang)).filter(Boolean),
  };
}
