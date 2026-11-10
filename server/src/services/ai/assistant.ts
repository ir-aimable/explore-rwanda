import { db } from '../../database/db.js';
import { discover, getLexicon, type DiscoveryResult, type Nearby } from '../search/discovery.js';
import { listPublicTrips } from '../search/tripService.js';
import { mergeContext, needsClarification, norm, parseIntent, type Intent } from './nlp.js';
import { applySession, hasSearch, toSession, type Session } from './session.js';
import { hintText, msg, reasonText, socialOpener, understoodText, whenPhrase } from './messages.js';
import { chatReply, rephrase } from './ollama.js';
import { todayStr } from '../../lib/time.js';
import { extractDate } from './nlp.js';

type Lang = 'rw' | 'en';

export function localizeRec(r: DiscoveryResult['trips'][number], lang: Lang) {
  return { ...r, reasons: r.reasons.map((x) => reasonText(x, lang)).filter(Boolean), reason_keys: r.reasons.map((x) => x.key) };
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
/** Quick-reply suggestions built from trips that are open right now, so every chip leads to real results. */
export async function buildSuggestions(lang: Lang, exclude?: string): Promise<string[]> {
  const open = (await listPublicTrips({ limit: 100, sort: 'date' })).items.filter((t: any) => t.is_open);
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

export async function interpret(message: string, ctx?: any): Promise<Intent> {
  return mergeContext(parseIntent(message, await getLexicon()), ctx);
}

/** Quick replies that MODIFY the active search (destination, budget, date, origin) instead of starting a new one. */
export async function sessionSuggestions(lang: Lang, i: Intent): Promise<string[]> {
  const out: string[] = [];
  const open = (await listPublicTrips({ limit: 100, sort: 'date' })).items.filter((t: any) => t.is_open && (!i.category || t.category.slug === i.category));
  const dest = open.map((t: any) => t.destination.name).find((d: string) => !i.location || !d.toLowerCase().includes(i.location.toLowerCase()));
  if (dest) out.push(lang === 'rw' ? `Ingendo zijya ${dest}` : `Trips to ${dest}`);
  if (open.length) {
    const cheapest = Math.min(...open.map((t: any) => t.price));
    const cap5 = Math.max(5000, Math.ceil((cheapest + 1) / 5000) * 5000);
    if (cap5 !== i.budget) out.push(lang === 'rw' ? `Ingendo ziri munsi ya RWF ${cap5.toLocaleString('en-US')}` : `Trips under RWF ${cap5.toLocaleString('en-US')}`);
  }
  if (i.date?.labelKey !== 'date_weekend') out.push(lang === 'rw' ? 'Muri iyi weekend' : 'This weekend');
  out.push(msg.changeOriginChip(lang));
  return out.slice(0, 4);
}

/** Quick replies that accept the closest option (switch activity / drop the place or date) or keep searching. */
function nearbySuggestions(lang: Lang, i: Intent, nb: Nearby, raiseTo?: number): string[] {
  const out: string[] = [];
  if (raiseTo) { const v = Math.ceil(raiseTo / 1000) * 1000; out.push(lang === 'rw' ? `Ingengo y’imari RWF ${v.toLocaleString('en-US')}` : `Budget RWF ${v.toLocaleString('en-US')}`); }
  const t = nb.trips[0];
  if (nb.relaxed.includes('category')) out.push(lang === 'rw' ? cap(t.category_name_rw) : `${cap(t.category_slug)} trips`);
  if (nb.relaxed.includes('location')) out.push(lang === 'rw' ? `Ingendo zijya ${t.destination}` : `Trips to ${t.destination}`);
  if (nb.relaxed.includes('date')) out.push(lang === 'rw' ? 'Itariki iyo ari yo yose' : 'Any date');
  if (nb.relaxed.includes('transportIncluded')) out.push(lang === 'rw' ? 'Transport ntacyo bitwaye' : 'Transport doesn’t matter');
  if (i.date && !nb.relaxed.includes('date')) out.push(lang === 'rw' ? 'Itariki iyo ari yo yose' : 'Any date');
  out.push(lang === 'rw' ? 'Tangira bushya' : 'Start over');
  return [...new Set(out)].slice(0, 4);
}

export async function runAssistant(message: string, lang: Lang, ctx?: Session) {
  const parsed = parseIntent(message, await getLexicon());
  const turn = applySession(parsed, ctx);
  const intent = turn.intent;
  const searching = intent.action === 'search';
  // Non-search messages (thanks, help, small talk) keep the active search exactly as it was.
  const kept: Session = turn.mode === 'reset' ? {} : { ...(ctx || {}), pending: undefined };
  const base = { engine: 'rules' as 'rules' | 'rules+ollama', intent, context: kept as Session };
  const catRows = await db.prepare('SELECT slug,name_en,name_rw FROM categories').all();
  const catLabelOf = (slug?: string) => {
    const row = slug ? catRows.find((c) => c.slug === slug) : undefined;
    return row ? (lang === 'rw' ? row.name_rw : row.name_en) as string : undefined;
  };
  const catLabel = catLabelOf(intent.category);
  const understood = understoodText(intent, lang, catLabel);
  // The search as remembered after this reply, shown to the user
  const planOf = (s: Session) => understoodText({ ...(s as any), currency: 'RWF' } as Intent, lang, catLabelOf(s.category));

  const empty = { understood, plan: planOf(kept), trips: [], alternatives: [], unavailable: [], destinations: [], hints: [] };
  if (turn.mode === 'reset' && parsed.detected.length === 0) return { ...base, ...empty, understood: [], plan: [], message: msg.reset(lang), suggestions: await buildSuggestions(lang) };
  if (intent.action === 'greeting') return { ...base, ...empty, message: msg.greeting(lang), suggestions: await buildSuggestions(lang) };
  if (intent.action === 'small_talk') {
    const bye = intent.social.includes('bye');
    return { ...base, ...empty, message: msg.smallTalk(intent.social, lang), suggestions: bye ? [] : await buildSuggestions(lang) };
  }
  if (intent.action === 'help') return { ...base, ...empty, message: msg.help(lang), suggestions: await buildSuggestions(lang) };
  if (intent.action === 'unknown') {
    let message = msg.unknown(lang);
    const o = await chatReply(intent.raw, lang);
    if (o) { message = o; base.engine = 'rules+ollama'; }
    return { ...base, ...empty, message, suggestions: hasSearch(kept) ? await sessionSuggestions(lang, { ...(kept as any) }) : await buildSuggestions(lang) };
  }
  if (intent.action === 'recommend' && !hasSearch(ctx)) {
    const r = await discover({ ...intent, action: 'search' }, 3);
    const opener = socialOpener(intent.social, lang);
    return {
      ...base, ...empty, message: [opener, msg.recommend(lang, r.trips.length)].filter(Boolean).join(' '), state: r.state,
      trips: r.trips.map((t) => localizeRec(t, lang)),
      destinations: r.trips.length ? [] : r.destinations, destinations_note: !r.trips.length && r.destinations.length ? msg.destinationsNote(lang) : undefined,
      suggestions: await buildSuggestions(lang),
    };
  }
  if (intent.action === 'blocked_action') return { ...base, ...empty, message: msg.blockedAction(lang) };
  if (intent.action === 'blocked_private') return { ...base, ...empty, message: msg.blockedPrivate(lang) };
  if (!searching && intent.action !== 'recommend') return { ...base, ...empty, message: msg.unknown(lang), suggestions: await buildSuggestions(lang) };

  const session = toSession(intent);
  const notes: string[] = [];
  const opener = socialOpener(intent.social, lang);
  if (opener) notes.push(opener);
  if (turn.changed.length) notes.push(msg.changed(lang, turn.changed));
  if (turn.cleared.length) notes.push(msg.cleared(lang, turn.cleared));

  // Targeted clarification: everything else stays as it is while we wait for the answer.
  if (turn.ask) {
    const question = turn.ask.kind === 'place_role' ? msg.askPlaceRole(lang, turn.ask.place) : msg.askOrigin(lang);
    // Starting-location chips: Kigali plus where open trips actually start from
    const hubs = (await db.prepare('SELECT name FROM transport_hubs ORDER BY sort_order,id').all()).map((h: any) => h.name as string);
    const starts = [...new Set([...hubs, ...(await listPublicTrips({ limit: 100, sort: 'date' })).items.filter((t: any) => t.is_open).map((t: any) => t.starting_location)])]
      .filter((p) => p && p.length <= 30 && norm(p) !== norm(intent.origin || '')).slice(0, 6);
    const options = turn.ask.kind === 'place_role' ? msg.placeRoleOptions(lang) : starts;
    const text = [...notes, question].join(' ');
    const context: Session = { ...session, lastRequest: ctx?.lastRequest, lastTripIds: ctx?.lastTripIds, pending: turn.ask };
    return { ...base, ...empty, context, plan: planOf(context), message: text, clarification: { question: text, options } };
  }
  if (needsClarification(intent)) {
    const c = msg.clarify(lang);
    const live = await buildSuggestions(lang);
    const q = [opener, c.question].filter(Boolean).join(' ');
    return { ...base, ...empty, message: q, clarification: { ...c, question: q, options: live.length >= 2 ? live : c.options } };
  }

  // Run the central recommendation service with the retained parameters.
  const r = await discover(intent);
  const anyTrips = (await listPublicTrips({ limit: 1 })).total > 0;
  let text = !anyTrips ? msg.noDataNote(lang) : msg.state(lang, r.state, r.trips.length, catLabel, intent.budgetType,
    [...new Set(r.trips.flatMap((t) => t.cost.lines.filter((l) => l.status === 'unknown').map((l) => l.type)))]);
  // No bookable match: offer the closest open trips as a question instead of a dead end.
  const nb = r.nearby;
  if (nb && anyTrips) {
    const seen = nb.trips.every((t) => ctx?.lastNearbyIds?.includes(t.id));
    const alt = r.state === 'MATCHED_ABOVE_BUDGET' ? r.alternatives[0] : undefined;
    if (alt && intent.budget !== undefined) text = msg.aboveBudgetNearby(lang, {
      alt, altCount: r.alternatives.length, budget: intent.budget, activityOnly: intent.budgetType === 'activity',
      whenText: intent.date ? whenPhrase(intent.date, lang) : undefined, near: nb.trips[0], relaxed: nb.relaxed,
    });
    else text = seen ? msg.nearbyAgain(lang, nb.trips[0], catLabel) : msg.nearby(lang, {
      relaxed: nb.relaxed, trips: nb.trips,
      want: { cat: catLabel, place: intent.location, when: !!intent.date, whenText: intent.date ? whenPhrase(intent.date, lang) : undefined, none: r.hints.some((h) => h.key === 'h_no_activity') },
      origin_ok: !!intent.origin && norm(nb.trips[0].starting_location).includes(norm(intent.origin)),
      nearKm: nb.trips[0].reasons.find((x) => x.key === 'r_near')?.params?.km as number | undefined,
    });
  }
  if (r.state === 'MATCHED_AVAILABLE_AFFORDABILITY_CONFIRMED') {
    const o = await rephrase(text, { trips: r.trips.map((t) => ({ title: t.title, date: t.trip_date, price: t.price, spaces: t.remaining_spaces })) }, lang);
    if (o) { text = o; base.engine = 'rules+ollama'; }
  }
  // Explain any public transport fare that was added to a total
  const shown = [...r.trips, ...r.alternatives, ...(nb?.trips || [])];
  const est = shown.flatMap((t) => t.cost.lines.filter((l) => l.status === 'estimated' && l.estimate).map((l) => l.estimate!));
  if (est.length && anyTrips) {
    const from = [...new Set(est.map((e) => e.from))];
    text += ' ' + msg.transportNote(lang, { from: from.length === 1 ? from[0] : from.join(lang === 'rw' ? ' na ' : ' / '), assumed: est.every((e) => e.assumed),
      table: est.some((e) => e.basis === 'table'), distance: est.some((e) => e.basis === 'distance'),
      replaced: est.find((e) => e.instead_of)?.instead_of?.start });
  }
  if (notes.length) text = `${notes.join(' ')} ${text}`;
  const context: Session = { ...session, lastRequest: message.slice(0, 300), lastTripIds: r.trips.map((t) => t.id), lastNearbyIds: nb?.trips.map((t) => t.id) };
  return {
    ...base, context, message: text, understood, plan: planOf(context), state: r.state,
    suggestions: nb ? nearbySuggestions(lang, intent, nb, r.alternatives[0] && intent.budget !== undefined ? intent.budget + (r.alternatives[0].over_budget_by ?? 0) : undefined)
      : await sessionSuggestions(lang, intent),
    nearby: nb ? nb.trips.map((t) => localizeRec(t, lang)) : [],
    nearby_title: nb ? msg.nearbyTitle(lang, nb.relaxed) : undefined,
    trips: r.trips.map((t) => localizeRec(t, lang)),
    alternatives: r.alternatives.map((t) => localizeRec(t, lang)),
    alternatives_title: r.alternatives.length ? msg.alternativesTitle(lang) : undefined,
    unavailable: r.unavailable.map((t) => localizeRec(t, lang)),
    unavailable_title: r.unavailable.length ? msg.unavailableTitle(lang, r.state) : undefined,
    destinations: r.destinations, destinations_note: r.destinations.length ? msg.destinationsNote(lang) : undefined,
    // The closest-options message already says what to change; generic hints would repeat it.
    hints: r.hints.filter((h) => !nb || !['h_no_activity', 'h_broaden'].includes(h.key)).map((h) => hintText(h, lang)).filter(Boolean),
  };
}
