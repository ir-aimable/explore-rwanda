// Rule-based natural-language understanding for English + Kinyarwanda trip requests.
// Pure functions (no DB access) so they are unit-testable. The DB-backed lexicon is passed in.
import { addDays, todayStr, weekday } from '../../lib/time.js';

export interface Lexicon {
  categories: { slug: string; names: string[] }[];
  locations: { term: string; canonical: string }[]; // normalized term -> display name
}

export interface DateRange { dateFrom: string; dateTo: string; weekdays?: number[]; label: string; labelKey: string; exact?: boolean }
export interface Intent {
  raw: string;
  category?: string;
  location?: string;      // destination / area wanted
  origin?: string;        // travelling from
  budget?: number; currency: 'RWF';
  people?: number;
  date?: DateRange;
  lowCost: boolean;
  easy: boolean; challenging: boolean;
  wantsAvailability: boolean;
  action: 'search' | 'greeting' | 'blocked_action' | 'blocked_private' | 'help';
  detected: string[];     // human-readable list of what was understood
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'");
const tokens = (s: string) => norm(s).replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, ' ').replace(/\s+/g, ' ').trim();

// ---- Activity synonyms (English + Kinyarwanda) ----
const CATEGORY_WORDS: Record<string, string[]> = {
  hiking: ['hike', 'hikes', 'hiking', 'trek', 'trekking', 'climb', 'climbing', 'walk', 'trail', 'gutembera', 'kuzamuka', 'urugendo rw amaguru', 'umusozi', 'imisozi'],
  swimming: ['swim', 'swimming', 'beach', 'koga', 'kwoga', 'gukina mu mazi', 'kunanura'],
  nature: ['nature', 'eco', 'outdoor', 'outdoors', 'forest', 'park', 'ibidukikije', 'ishyamba', 'pariki', 'ubusitani'],
  wildlife: ['safari', 'wildlife', 'game drive', 'animals', 'birds', 'birdwatching', 'inyamaswa', 'inyoni'],
  culture: ['culture', 'cultural', 'museum', 'heritage', 'history', 'umuco', 'ingoro', 'amateka'],
  waterfall: ['waterfall', 'waterfalls', 'falls', 'ishyamba ry amazi', 'amazi atemba'],
  boating: ['boat', 'boating', 'kayak', 'canoe', 'bwato', 'ubwato', 'kugenda mu bwato'],
  cycling: ['cycling', 'bike', 'biking', 'bicycle', 'igare', 'gutwara igare'],
};
export const RELATED: Record<string, string[]> = {
  nature: ['hiking', 'waterfall', 'wildlife', 'boating', 'cycling'],
  hiking: ['nature'], waterfall: ['nature', 'hiking'], wildlife: ['nature'], boating: ['nature', 'swimming'], swimming: ['boating'],
};

// ---- Numbers ----
const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, single: 1,
  umwe: 1, babiri: 2, batatu: 3, bane: 4, batanu: 5, batandatu: 6, barindwi: 7, umunani: 8,
};
const numTok = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|umwe|babiri|batatu|bane|batanu|batandatu|barindwi)';
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUM_WORDS[s]);

export function extractBudget(text: string): number | undefined {
  const t = norm(text);
  const parse = (n: string, k?: string) => {
    let v = parseFloat(n.replace(/[ ,]/g, '').replace(/\.(?=\d{3}\b)/g, ''));
    if (isNaN(v)) return undefined;
    if (k) v *= 1000;
    return Math.round(v);
  };
  let m: RegExpMatchArray | null;
  // "10.5k" / "10k" / "10 k"
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*k\b/))) return parse(m[1], 'k');
  // currency BEFORE number: rwf 10,000 / frw10000
  if ((m = t.match(/(?:rwf|frw|rfw|rf|fr)\s*\.?\s*(\d+(?:[ ,.]\d{3})*(?:\.\d+)?)/))) return parse(m[1]);
  // number BEFORE currency: 10,000 rwf / 10000 amafaranga
  if ((m = t.match(/(\d+(?:[ ,.]\d{3})*(?:\.\d+)?)\s*(?:rwf|frw|rfw|rf\b|amafaranga|amafr|francs?)/))) return parse(m[1]);
  // "under 10,000" / "budget of 15000" / "below 20 000"
  if ((m = t.match(/(?:under|below|less than|within|budget(?: of| is)?|max(?:imum)?|up to|hasi ya|atarenze|ntarenze)\s*(\d+(?:[ ,.]\d{3})*)/))) return parse(m[1]);
  // "I have 10,000" / "mfite 10000"
  if ((m = t.match(/(?:i have|have|mfite|ngafite)\s*(\d{1,3}(?:[ ,.]\d{3})+|\d{4,})/))) return parse(m[1]);
  // bare large number with thousands separator (e.g. 15,000)
  if ((m = t.match(/\b(\d{1,3}(?:[,.]\d{3})+)\b/))) return parse(m[1]);
  // bare number >= 1000 (not a year handled by date parser: exclude 20xx)
  if ((m = t.match(/\b(\d{4,7})\b/)) && !/^20\d\d$/.test(m[1])) return parse(m[1]);
  return undefined;
}

export function extractPeople(text: string): number | undefined {
  const t = tokens(text);
  const pats = [
    new RegExp(`for\\s+${numTok}\\s*(?:people|persons|person|pax|adults|of us|travell?ers|friends)`),
    new RegExp(`${numTok}\\s*(?:people|persons|person|pax|adults|travell?ers|seats|spaces|spots|places|tickets|abantu|umuntu)`),
    new RegExp(`(?:abantu|n abantu|ku bantu)\\s*${numTok}`),
    new RegExp(`(?:group|party) of\\s+${numTok}`),
    new RegExp(`at least\\s+${numTok}\\s*(?:available\\s*)?(?:people|spaces|seats|spots|places)?`),
    new RegExp(`(?:available|free) for\\s+${numTok}\\b`),
    new RegExp(`\\bfor\\s+${numTok}\\b(?!\\s*\\d{3})(?!\\s*(?:k|rwf|frw|hours|days|nights))`),
    new RegExp(`\\b${numTok}\\s+of us\\b`),
  ];
  for (const p of pats) {
    const m = t.match(p);
    if (m) { const n = toNum(m[1]); if (n && n >= 1 && n <= 10) return n; }
  }
  if (/\b(couple|both of us)\b/.test(t)) return 2;
  return undefined;
}

// ---- Dates (relative to Africa/Kigali "today") ----
const WD: [number, string[]][] = [
  [1, ['monday', 'mon', 'kuwa mbere', 'ku wa mbere', 'ku wa mbere']],
  [2, ['tuesday', 'tue', 'tues', 'kuwa kabiri', 'ku wa kabiri']],
  [3, ['wednesday', 'wed', 'kuwa gatatu', 'ku wa gatatu']],
  [4, ['thursday', 'thu', 'thur', 'thurs', 'kuwa kane', 'ku wa kane']],
  [5, ['friday', 'fri', 'kuwa gatanu', 'ku wa gatanu']],
  [6, ['saturday', 'sat', 'kuwa gatandatu', 'ku wa gatandatu']],
  [0, ['sunday', 'sun', 'ku cyumweru', 'cyumweru', 'kucyumweru']],
];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function nextWeekday(from: string, wd: number) {
  const diff = (wd - weekday(from) + 7) % 7;
  return addDays(from, diff);
}
function mondayOfNextWeek(from: string) {
  const w = weekday(from); // 0=Sun
  const toMon = ((1 - w + 7) % 7) || 7;
  return addDays(from, toMon);
}

export function extractDate(text: string, today = todayStr()): DateRange | undefined {
  const t = tokens(text);
  const has = (re: RegExp) => re.test(t);
  // explicit ISO date
  let m = text.match(/\b(20\d\d)-(\d{2})-(\d{2})\b/);
  if (m) return { dateFrom: m[0], dateTo: m[0], label: m[0], labelKey: 'date_exact', exact: true };
  // "15 november" / "november 15"
  for (let i = 0; i < 12; i++) {
    const mn = MONTHS[i], short = mn.slice(0, 3);
    const r1 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s*)?(?:${mn}|${short})\\b`);
    const r2 = new RegExp(`\\b(?:${mn}|${short})\\s*(\\d{1,2})(?:st|nd|rd|th)?\\b`);
    const mm = t.match(r1) || t.match(r2);
    if (mm) {
      const day = Number(mm[1]);
      if (day >= 1 && day <= 31) {
        let y = Number(today.slice(0, 4));
        let d = `${y}-${String(i + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (d < today) d = `${y + 1}-${String(i + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { dateFrom: d, dateTo: d, label: d, labelKey: 'date_exact', exact: true };
      }
    }
  }
  if (has(/\b(today|uyu munsi)\b/)) return { dateFrom: today, dateTo: today, label: today, labelKey: 'date_today', exact: true };
  if (has(/\b(tomorrow|ejo hazaza|ejo)\b/)) { const d = addDays(today, 1); return { dateFrom: d, dateTo: d, label: d, labelKey: 'date_tomorrow', exact: true }; }
  const nextWeek = has(/\b(next week|icyumweru gitaha|icyumweru kizaza)\b/);
  const thisWeek = has(/\b(this week|iki cyumweru)\b/);
  const weekend = has(/\b(weekend|weekends|herekanwe|iherekanwa|weekend)\b/);
  const next = has(/\b(next|gitaha|kizaza|utaha)\b/);
  if (weekend) {
    let sat: string;
    if (next) { sat = nextWeekday(mondayOfNextWeek(today), 6); }
    else sat = weekday(today) === 0 ? addDays(today, -1) : nextWeekday(today, 6);
    const sun = addDays(sat, 1);
    const from = sat < today ? today : sat;
    return { dateFrom: from, dateTo: sun, weekdays: [6, 0], label: `${sat}..${sun}`, labelKey: next ? 'date_next_weekend' : 'date_weekend' };
  }
  for (const [wd, names] of WD) {
    if (names.some((n) => new RegExp(`\\b${n}\\b`).test(t))) {
      const base = next ? mondayOfNextWeek(today) : today;
      const d = nextWeekday(base, wd);
      return { dateFrom: d, dateTo: d, label: d, labelKey: 'date_weekday', exact: true };
    }
  }
  if (nextWeek) { const mon = mondayOfNextWeek(today); return { dateFrom: mon, dateTo: addDays(mon, 6), label: `${mon}..${addDays(mon, 6)}`, labelKey: 'date_next_week' }; }
  if (thisWeek) {
    const toSun = (7 - weekday(today)) % 7;
    return { dateFrom: today, dateTo: addDays(today, toSun), label: 'this week', labelKey: 'date_this_week' };
  }
  return undefined;
}

export function weekdayName(dateStr: string, lang: 'rw' | 'en') {
  const en = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const rw = ['Ku cyumweru', 'Kuwa mbere', 'Kuwa kabiri', 'Kuwa gatatu', 'Kuwa kane', 'Kuwa gatanu', 'Kuwa gatandatu'];
  return (lang === 'rw' ? rw : en)[weekday(dateStr)];
}

// ---- Main parser ----
export function parseIntent(raw: string, lex: Lexicon, today = todayStr()): Intent {
  const text = raw.trim();
  const t = tokens(text);
  const intent: Intent = {
    raw: text, currency: 'RWF', lowCost: false, easy: false, challenging: false, wantsAvailability: false,
    action: 'search', detected: [],
  };

  // Safety: the assistant is read-only. Detect attempts to make it act or reveal private data.
  if (/\b(approve|reject|delete|remove|ban|suspend|promote|demote|make me (an? )?(admin|organizer)|grant|change (my |the )?role|reset password|siba|ndemerera|nkuremo)\b/.test(t)
      && /\b(registrations?|users?|accounts?|organizers?|admins?|trips?|bookings?|roles?|passwords?|konti|itike)\b/.test(t)) {
    intent.action = 'blocked_action'; return intent;
  }
  if (/\b(email|e mail|phone|number|password|address|id number|telephone|telefone)s?\b/.test(t)
      && /\b(of|for|belonging|who|all)\b.*\b(user|users|traveler|travelers|traveller|travellers|participants?|organizer|organizers|admin|people|abantu)\b/.test(t)
      && !/\b(contact|support)\b/.test(t)) {
    intent.action = 'blocked_private'; return intent;
  }

  intent.budget = extractBudget(text);
  if (intent.budget !== undefined) intent.detected.push('budget');
  intent.people = extractPeople(text);
  if (intent.people) intent.detected.push('people');
  intent.date = extractDate(text, today);
  if (intent.date) intent.detected.push('date');

  // Activity
  let best: { slug: string; len: number } | undefined;
  for (const [slug, words] of Object.entries(CATEGORY_WORDS)) {
    for (const w of words) {
      if (new RegExp(`(^| )${w}( |$)`).test(t) || (w.length > 5 && t.includes(w))) {
        if (!best || w.length > best.len) best = { slug, len: w.length };
      }
    }
  }
  for (const c of lex.categories) {
    for (const n of c.names) {
      const nn = tokens(n);
      if (nn.length > 3 && t.includes(nn) && (!best || nn.length > best.len)) best = { slug: c.slug, len: nn.length };
    }
  }
  if (best && lex.categories.some((c) => c.slug === best!.slug)) { intent.category = best.slug; intent.detected.push('activity'); }

  // Origin ("from Kigali", "ngiye kuva i Kigali")
  const originM = t.match(/(?:\bfrom|\bkuva(?: i| mu)?|\bdepart(?:ing)? from|\bleaving)\s+([a-z]+(?: [a-z]+)?)/);
  const sortedLoc = [...lex.locations].sort((a, b) => b.term.length - a.term.length);
  if (originM) {
    const frag = originM[1];
    const hit = sortedLoc.find((l) => frag.startsWith(l.term) || l.term.startsWith(frag.split(' ')[0]));
    intent.origin = hit ? hit.canonical : frag.split(' ')[0].replace(/^./, (c) => c.toUpperCase());
    intent.detected.push('origin');
  }
  // Destination: any known location term in the text, excluding the origin phrase
  const withoutOrigin = originM ? t.replace(originM[0], ' ') : t;
  const locHit = sortedLoc.find((l) => l.term.length >= 4 && new RegExp(`(^| )${l.term}( |$)`).test(withoutOrigin));
  if (locHit) { intent.location = locHit.canonical; intent.detected.push('location'); }

  intent.lowCost = /\b(cheap|cheapest|low cost|low-cost|affordable|budget friendly|inexpensive|bidahenze|bihendutse|igiciro gito)\b/.test(t) || /\blow ?cost\b/.test(t);
  if (intent.lowCost) intent.detected.push('low_cost');
  intent.easy = /\b(easy|beginner|beginners|family|families|kids|children|relaxed|byoroshye|abana)\b/.test(t);
  intent.challenging = /\b(challenging|hard|difficult|tough|adventurous|bigoye)\b/.test(t);
  intent.wantsAvailability = /\b(available|availability|still have|spaces|seats|spots|open|ahari|umwanya|imyanya)\b/.test(t);

  const nothing = !intent.category && !intent.location && !intent.origin && intent.budget === undefined && !intent.date && !intent.people && !intent.lowCost && !intent.wantsAvailability && !intent.easy && !intent.challenging;
  if (nothing) {
    if (/\b(hi|hello|hey|hola|muraho|mwiriwe|mwaramutse|bonjour|yo|salut|sawa)\b/.test(t) && t.split(' ').length <= 6) intent.action = 'greeting';
    else if (/\b(help|how|what can|what do|ubufasha|ufasha|nshobora|wakora iki)\b/.test(t)) intent.action = 'help';
    else if (/\b(trip|trips|travel|visit|go|explore|activity|activities|somewhere|place|places|urugendo|gusura|ahantu|jya|genda|ngiye)\b/.test(t)) intent.action = 'search';
  }
  return intent;
}

/** True when nothing useful (no filter at all) was understood from a search request. */
export function needsClarification(i: Intent) {
  if (i.action !== 'search') return false;
  return !i.category && !i.location && !i.origin && i.budget === undefined && !i.date && !i.people && !i.lowCost && !i.wantsAvailability && !i.easy && !i.challenging;
}

/** Follow-up merge: a short message with no activity/location refines the previous request. */
export function mergeContext(cur: Intent, prev?: Partial<{ budget: number; category: string; date: DateRange; location: string; people: number }>) {
  if (!prev || cur.action !== 'search') return cur;
  const isRefinement = !cur.category && !cur.location && cur.raw.split(/\s+/).length <= 8 && cur.detected.length > 0;
  if (!isRefinement) return cur;
  const m = { ...cur };
  if (m.budget === undefined && prev.budget !== undefined) { m.budget = prev.budget; m.detected.push('budget_ctx'); }
  if (!m.category && prev.category) { m.category = prev.category; m.detected.push('activity_ctx'); }
  if (!m.date && prev.date) { m.date = prev.date; m.detected.push('date_ctx'); }
  if (!m.location && prev.location) { m.location = prev.location; m.detected.push('location_ctx'); }
  if (!m.people && prev.people) { m.people = prev.people; m.detected.push('people_ctx'); }
  return m;
}

export function buildLexicon(cats: any[], dests: any[], trips: { starting_location: string; meeting_point: string }[]): Lexicon {
  const GENERIC = new Set(['national', 'park', 'lake', 'eco', 'ibere', 'rya', 'rwanda', 'area', 'hill', 'forest', 'the', 'and']);
  const locs = new Map<string, string>();
  const add = (term: string, canonical: string) => { const n = tokens(term); if (n.length >= 4 && !GENERIC.has(n)) if (!locs.has(n)) locs.set(n, canonical); };
  for (const d of dests) {
    add(d.name, d.name); add(d.region, d.region);
    // single words map to themselves so "near Musanze" matches every record that mentions Musanze
    const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
    tokens(d.name).split(' ').forEach((w) => add(w, cap(w)));
    tokens(d.region).split(' ').forEach((w) => add(w, cap(w)));
  }
  for (const t of trips) add(t.starting_location, t.starting_location);
  // Common Rwandan place aliases that only help when a matching record exists
  const alias: Record<string, string> = { gisenyi: 'Rubavu', rubavu: 'Rubavu', kibuye: 'Karongi', karongi: 'Karongi', ruhengeri: 'Musanze', volcanoes: 'Musanze', kivu: 'Lake Kivu' };
  for (const [k, v] of Object.entries(alias)) { if (![...locs.values()].some((c) => norm(c).includes(norm(v)))) continue; add(k, v); }
  return {
    categories: cats.map((c) => ({ slug: c.slug, names: [c.name_en, c.name_rw, c.slug] })),
    locations: [...locs.entries()].map(([term, canonical]) => ({ term, canonical })),
  };
}
