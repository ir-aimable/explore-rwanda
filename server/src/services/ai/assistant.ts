import { db } from '../../database/db.js';
import { discover, getLexicon, type DiscoveryResult } from '../search/discovery.js';
import { listPublicTrips } from '../search/tripService.js';
import { mergeContext, needsClarification, parseIntent, type Intent } from './nlp.js';
import { hintText, msg, reasonText, socialOpener, understoodText } from './messages.js';
import { chatReply, rephrase } from './ollama.js';
import { todayStr } from '../../lib/time.js';
import { extractDate } from './nlp.js';

type Lang = 'rw' | 'en';

export function localizeRec(r: DiscoveryResult['trips'][number], lang: Lang) {
  return { ...r, reasons: r.reasons.map((x) => reasonText(x, lang)).filter(Boolean), reason_keys: r.reasons.map((x) => x.key) };
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
/** Quick-reply suggestions built from trips that are open right now, so every chip leads to real results. */
export function buildSuggestions(lang: Lang, exclude?: string): string[] {
  const open = listPublicTrips({ limit: 100, sort: 'date' }).items.filter((t: any) => t.is_open);
  if (!open.length) return lang === 'rw' ? ['Ni he heza nasura?', 'Ubufasha'] : ['Where should I go?', 'What can you do?'];
  const out: string[] = [];
  const counts = new Map<string, { n: number; en: string; rw: string }>();
  for (const t of open as any[]) { const c = counts.get(t.category.slug) || { n: 0, en: t.category.slug, rw: t.category.name_rw }; c.n++; counts.set(t.category.slug, c); }
  [...counts.entries()].filter(([slug]) => slug !== exclude).sort((a, b) => b[1].n - a[1].n).slice(0, 2)
    .forEach(([, c]) => out.push(lang === 'rw' ? cap(c.rw) : `${cap(c.en)} trips`));
  const wk = extractDate('this weekend', todayStr());
  if (wk && open.some((t: any) => t.trip_date >= wk.dateFrom && t.trip_date <= wk.dateTo)) out.push(lang === 'rw' ? 'Ingendo za weekend' : 'Trips this weekend');
  const cheapest = Math.min(...open.map((t: any) => t.price));
  const cap5 = Math.max(5000, Math.ceil((cheapest + 1) / 5000) * 5000);
  out.push(lang === 'rw' ? `Ingendo ziri munsi ya RWF ${cap5.toLocaleString('en-US')}` : `Trips under RWF ${cap5.toLocaleString('en-US')}`);
  const dest = (open[0] as any).destination.name;
  if (out.length < 4) out.push(lang === 'rw' ? `Ingendo zijya ${dest}` : `Trips to ${dest}`);
  return out.slice(0, 4);
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

  const empty = { understood, trips: [], alternatives: [], destinations: [], hints: [] };
  if (intent.action === 'greeting') return { ...base, ...empty, message: msg.greeting(lang), suggestions: buildSuggestions(lang) };
  if (intent.action === 'small_talk') {
    const bye = intent.social.includes('bye');
    return { ...base, ...empty, message: msg.smallTalk(intent.social, lang), suggestions: bye ? [] : buildSuggestions(lang) };
  }
  if (intent.action === 'help') return { ...base, ...empty, message: msg.help(lang), suggestions: buildSuggestions(lang) };
  if (intent.action === 'unknown') {
    let message = msg.unknown(lang);
    const o = await chatReply(intent.raw, lang);
    if (o) { message = o; base.engine = 'rules+ollama'; }
    return { ...base, ...empty, message, suggestions: buildSuggestions(lang) };
  }
  if (intent.action === 'recommend') {
    const r = discover({ ...intent, action: 'search' }, 3);
    const opener = socialOpener(intent.social, lang);
    return {
      ...base, ...empty, message: [opener, msg.recommend(lang, r.trips.length)].filter(Boolean).join(' '),
      trips: r.trips.map((t) => localizeRec(t, lang)),
      destinations: r.trips.length ? [] : r.destinations, destinations_note: !r.trips.length && r.destinations.length ? msg.destinationsNote(lang) : undefined,
      suggestions: buildSuggestions(lang),
    };
  }
  if (intent.action === 'blocked_action') return { ...base, message: msg.blockedAction(lang), understood, trips: [], alternatives: [], destinations: [], hints: [] };
  if (intent.action === 'blocked_private') return { ...base, message: msg.blockedPrivate(lang), understood, trips: [], alternatives: [], destinations: [], hints: [] };
  if (needsClarification(intent)) {
    const c = msg.clarify(lang);
    const live = buildSuggestions(lang);
    const opener = socialOpener(intent.social, lang);
    return { ...base, ...empty, message: [opener, c.question].filter(Boolean).join(' '), clarification: { ...c, question: [opener, c.question].filter(Boolean).join(' '), options: live.length >= 2 ? live : c.options } };
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
  const opener = socialOpener(intent.social, lang);
  if (opener) text = `${opener} ${text}`;
  return {
    ...base, message: text, understood,
    suggestions: r.trips.length ? [] : buildSuggestions(lang, intent.category),
    trips: r.trips.map((t) => localizeRec(t, lang)),
    alternatives: r.alternatives.map((t) => localizeRec(t, lang)),
    alternatives_title: r.alternatives.length ? msg.alternativesTitle(lang) : undefined,
    destinations: r.destinations, destinations_note: r.destinations.length ? msg.destinationsNote(lang) : undefined,
    hints: r.hints.map((h) => hintText(h, lang)).filter(Boolean),
  };
}
