// All assistant wording (Kinyarwanda + English) lives here. Facts are injected from the database.
import type { Intent, Social } from './nlp.js';
import { weekdayName } from './nlp.js';

type Lang = 'rw' | 'en';
const f = (n: number) => n.toLocaleString('en-US');
const L = (lang: Lang, rw: string, en: string) => (lang === 'rw' ? rw : en);

export function reasonText(r: { key: string; params?: Record<string, any> }, lang: Lang): string {
  const p = r.params || {};
  switch (r.key) {
    case 'r_activity': return L(lang, `Ihuye n’ibyo ushaka: ${p.name_rw}`, `Matches the activity you asked for: ${p.name_en}`);
    case 'r_related': return L(lang, `Ni igikorwa gifitanye isano n’ibidukikije (${p.name_rw})`, `Related nature activity (${p.name_en})`);
    case 'r_location': return L(lang, `Iri hafi cyangwa mu gace ka ${p.place}`, `Located in or listed for ${p.place}`);
    case 'r_near': return L(lang, `Hari nko ku birometero ${p.km} uvuye i ${p.place}`, `About ${p.km} km from ${p.place}`);
    case 'r_start_far': return p.included
      ? L(lang, `Transport iri mu giciro ihera i ${p.start}, nko ku birometero ${p.km} uvuye i ${p.from}: baza uwateguye niba wafatirwa mu nzira`, `Transport is included from ${p.start}, about ${p.km} km from ${p.from}: ask the organizer whether you can join on the way`)
      : L(lang, `Rutangirira i ${p.start}, nko ku birometero ${p.km} uvuye i ${p.from}`, `Starts from ${p.start}, about ${p.km} km from ${p.from}`);
    case 'r_origin': return L(lang, `Gitangirira i ${p.place}`, `Starts from ${p.place}`);
    case 'r_date': return L(lang, `Kiba ${weekdayName(p.date, 'rw')} ${p.date}`, `Takes place on ${weekdayName(p.date, 'en')} ${p.date}`);
    case 'r_budget': return L(lang, `Kiri mu ngengo y’imari yawe: RWF ${f(p.price)} (usigaranye RWF ${f(p.left)})`, `Within your budget: RWF ${f(p.price)} (RWF ${f(p.left)} to spare)`);
    case 'r_budget_total': return L(lang, `Igiciro cyose kizwi kiri mu ngengo y’imari yawe: RWF ${f(p.price)} (usigaranye RWF ${f(p.left)})`, `Complete known cost within your budget: RWF ${f(p.price)} (RWF ${f(p.left)} to spare)`);
    case 'r_budget_unconfirmed': return L(lang,
      `Ibiciro bizwi (RWF ${f(p.price)}) biri munsi y’ingengo y’imari yawe, ariko ${costNames(p.missing, 'rw')} ntibizwi: igiciro cyose ntikiremezwa`,
      `Known costs (RWF ${f(p.price)}) are under your budget, but ${costNames(p.missing, 'en')} ${p.missing?.length > 1 ? 'are' : 'is'} unknown, so the total cannot yet be confirmed`);
    case 'r_transport_included': return L(lang, 'Transport iri mu giciro', 'Transport included in the price');
    case 'r_lowcost': return L(lang, `Igiciro gito: RWF ${f(p.price)}`, `Low cost: RWF ${f(p.price)}`);
    case 'r_spaces': return L(lang, `Hasigaye imyanya ${p.n}`, `${p.n} spaces left`);
    case 'r_few_spaces': return L(lang, `Hasigaye imyanya mike gusa (${p.n})`, `Only ${p.n} spaces left`);
    case 'r_people': return L(lang, `Hari umwanya w’abantu ${p.n}`, `Enough space for ${p.n} people`);
    case 'r_easy': return L(lang, 'Kiroroshye ku batangiye', 'Easy level, suitable for beginners');
    case 'r_challenging': return L(lang, 'Ni igikorwa kigoye ku bakunda ibigeragezo', 'Challenging level as requested');
    default: return '';
  }
}

const COST_NAME: Record<string, [string, string]> = {
  transport: ['transport', 'transport'], food: ['ibiryo', 'food'], entry_fee: ['amafaranga yo kwinjira', 'entry fees'],
  accommodation: ['icumbi', 'accommodation'], activity: ['ibindi bikorwa', 'extra activities'], other: ['ibindi', 'other costs'],
};
function costNames(keys: string[] = [], lang: Lang) {
  const n = [...new Set(keys)].map((k) => (COST_NAME[k] || [k, k])[lang === 'rw' ? 0 : 1]);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} ${L(lang, 'n’', 'and')} ${n[n.length - 1]}` : n[0] || '';
}

export function hintText(h: { key: string; params?: Record<string, any> }, lang: Lang): string {
  const p = h.params || {};
  switch (h.key) {
    case 'h_other_dates': return L(lang, `Hari ingendo ${p.n} zihuye n’ibyo ushaka ariko ku yindi matariki (iya mbere: ${p.first}). Gerageza indi tariki.`, `${p.n} matching trip(s) exist on other dates (first: ${p.first}). Try another date.`);
    case 'h_raise_budget': return L(lang, `Urugendo ruhendutse muri izi ni RWF ${f(p.price)}. Wazamura ingengo y’imari.`, `The cheapest matching trip costs RWF ${f(p.price)}. Consider raising your budget.`);
    case 'h_fewer_people': return L(lang, 'Nta rugendo rufite imyanya ihagije y’umubare w’abantu mwavuze. Gerageza umubare muto.', 'No matching trip has enough spaces for that many people. Try a smaller group.');
    case 'h_no_activity': return L(lang, 'Nta rugendo rufunguye rw’icyo gikorwa ruri ku rubuga ubu. Reba ibindi bikorwa.', 'There is no open trip for that activity on the platform right now. Try another activity.');
    case 'h_broaden': return L(lang, 'Gerageza gukuraho ikintu kimwe (itariki, ingengo y’imari cyangwa aho ujya).', 'Try removing one condition (date, budget or place).');
    default: return '';
  }
}

export function understoodText(i: Intent, lang: Lang, catName?: string): string[] {
  const out: string[] = [];
  if (catName) out.push(L(lang, `Igikorwa: ${catName}`, `Activity: ${catName}`));
  if (i.location) out.push(L(lang, `Ahantu: ${i.location}`, `Place: ${i.location}`));
  if (i.origin) out.push(L(lang, `Uvuye: ${i.origin}`, `From: ${i.origin}`));
  if (i.budget !== undefined) out.push(L(lang, `Ingengo y’imari: RWF ${f(i.budget)}`, `Budget: RWF ${f(i.budget)}`));
  if (i.date) {
    const d = i.date;
    const s = d.labelKey === 'date_month' ? monthName(d.label, lang) : d.dateFrom === d.dateTo ? `${weekdayName(d.dateFrom, lang)} ${d.dateFrom}` : `${d.dateFrom} → ${d.dateTo}`;
    out.push(L(lang, `Itariki: ${s}`, `Date: ${s}`));
  }
  if (i.people) out.push(L(lang, `Abantu: ${i.people}`, `People: ${i.people}`));
  if (i.budget !== undefined) out.push(i.budgetType === 'activity'
    ? L(lang, 'Ingengo y’imari: igiciro cy’igikorwa gusa', 'Budget covers: activity price only')
    : L(lang, 'Ingengo y’imari: urugendo rwose', 'Budget covers: the whole trip'));
  if (i.transportIncluded) out.push(L(lang, 'Transport irimo', 'Transport included'));
  if (i.lowCost) out.push(L(lang, 'Ushaka igiciro gito', 'Preference: low cost'));
  return out;
}

const MONTH_RW = ['Mutarama', 'Gashyantare', 'Werurwe', 'Mata', 'Gicurasi', 'Kamena', 'Nyakanga', 'Kanama', 'Nzeri', 'Ukwakira', 'Ugushyingo', 'Ukuboza'];
/** "2026-12" -> "December 2026" / "Ukuboza 2026" */
export function monthName(ym: string, lang: Lang) {
  const [y, m] = ym.split('-').map(Number);
  return lang === 'rw' ? `${MONTH_RW[m - 1]} ${y}` : `${new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })} ${y}`;
}
/** How the requested date reads inside a sentence: "in December 2026", "on Sat 14 Nov", "between … and …". */
export function whenPhrase(d: { dateFrom: string; dateTo: string; label: string; labelKey: string }, lang: Lang) {
  const day = (x: string) => new Date(x + 'T12:00:00Z').toLocaleDateString(lang === 'rw' ? 'fr-RW' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (d.labelKey === 'date_month') return L(lang, `muri ${monthName(d.label, lang)}`, `in ${monthName(d.label, lang)}`);
  if (d.dateFrom === d.dateTo) return L(lang, `ku wa ${day(d.dateFrom)}`, `on ${day(d.dateFrom)}`);
  return L(lang, `hagati ya ${day(d.dateFrom)} na ${day(d.dateTo)}`, `between ${day(d.dateFrom)} and ${day(d.dateTo)}`);
}

const ASK = (lang: Lang) => L(lang, 'Explore Rwanda yagufasha ite ku rugendo rwawe?', 'How can Explore Rwanda help you with your trip?');

/** One short, friendly line per conversational cue, in the order they should be said. */
const SOCIAL_LINE: Record<Social, (lang: Lang) => string> = {
  greeting: (lang) => L(lang, 'Muraho! 👋', 'Hello! 👋'),
  how_are_you: (lang) => L(lang, 'Ndaho neza, urakoze kubaza! 😊', 'I am fine, thank you for asking! 😊'),
  feeling_good: (lang) => L(lang, 'Nishimiye kubyumva!', 'Glad to hear that!'),
  thanks: (lang) => L(lang, 'Nta kibazo, ni ibyishimo kugufasha!', 'You are welcome, happy to help!'),
  compliment: (lang) => L(lang, 'Urakoze cyane, ni wowe mwiza!', 'Thank you, that is very kind of you!'),
  who: (lang) => L(lang,
    'Ndi Umufasha wa Explore Rwanda: ngufasha kubona ingendo zifunguye, ahantu heza, ibiciro n’imyanya isigaye mu Rwanda.',
    'I am the Explore Rwanda Assistant. I help you find open trips, great places, prices and available spaces across Rwanda.'),
  affirm: (lang) => L(lang, 'Ni byiza!', 'Great!'),
  bye: (lang) => L(lang, 'Murabeho! Mugire urugendo rwiza mu Rwanda.', 'Goodbye! Have a wonderful time exploring Rwanda.'),
};
const ORDER: Social[] = ['greeting', 'how_are_you', 'feeling_good', 'thanks', 'compliment', 'who', 'affirm', 'bye'];
/** Short opener used before search results, e.g. "Hello! I am fine, thank you for asking!" */
export function socialOpener(social: Social[], lang: Lang) {
  return ORDER.filter((k) => social.includes(k) && k !== 'bye' && k !== 'affirm').map((k) => SOCIAL_LINE[k](lang)).join(' ');
}

const PREF_NAME: Record<string, [string, string]> = {
  category: ['igikorwa', 'activity'], location: ['aho ujya', 'destination'], origin: ['aho uturuka', 'starting location'],
  budget: ['ingengo y’imari', 'budget'], budgetType: ['ibyo ingengo y’imari ikubiyemo', 'budget interpretation'], date: ['itariki', 'date'],
  people: ['umubare w’abantu', 'number of travellers'], transportIncluded: ['transport', 'transport preference'],
};
const listPrefs = (keys: string[], lang: Lang) => {
  const n = [...new Set(keys.filter((k) => !(k === 'budgetType' && keys.includes('budget'))).map((k) => (PREF_NAME[k] || [k, k])[lang === 'rw' ? 0 : 1]))];
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} ${L(lang, 'n’', 'and')} ${n[n.length - 1]}` : n[0] || '';
};

export const msg = {
  /** One message per result state; the state is decided by the backend from real results. */
  state: (lang: Lang, state: string, n: number, catName?: string, budgetType?: string, missing?: string[]) => {
    const cat = catName ? L(lang, `za “${catName}” `, ` for “${catName}”`) : '';
    switch (state) {
      case 'MATCHED_AVAILABLE_AFFORDABILITY_CONFIRMED': return L(lang,
        `Dore ingendo ${n} ${cat}zihuye n’ibyo wasabye, zifite imyanya.`,
        `Here ${n === 1 ? 'is 1 available trip' : `are ${n} available trips`}${cat} matching your request.`);
      case 'MATCHED_AVAILABLE_AFFORDABILITY_UNCONFIRMED': return L(lang,
        `Dore ingendo ${n} ${cat}zihuye n’ibyo wasabye kandi zifite imyanya. Igiciro cyose ntikiremezwa kuko hari ibiciro bitazwi (${missing?.length ? costNames(missing, 'rw') : 'urugero transport'}).`,
        `I found ${n === 1 ? '1 matching trip' : `${n} matching trips`}${cat} with spaces available. The total cost cannot yet be confirmed because some costs (${missing?.length ? costNames(missing, 'en') : 'such as transport'}) are unknown.`);
      case 'MATCHED_ABOVE_BUDGET': return L(lang,
        `Hari ingendo zihuye n’ibyo wasabye kandi zifite imyanya, ariko zirenze ingengo y’imari yawe${budgetType === 'activity' ? '' : ' (hubariwe ibiciro bizwi)'}.`,
        `There are matching trips with spaces, but they are above your budget${budgetType === 'activity' ? '' : ' based on their known costs'}.`);
      case 'MATCHED_BUT_FULL': return L(lang,
        'Hari ingendo zihuye n’ibyo wasabye, ariko nta myanya ihagije isigaye.',
        'I found matching trips, but they do not have enough spaces left.');
      case 'MATCHED_BUT_REGISTRATION_CLOSED': return L(lang,
        'Hari ingendo zihuye n’ibyo wasabye, ariko kwiyandikisha byarangiye.',
        'I found matching trips, but registration for them has closed.');
      case 'MATCHED_BUT_DATE_MISMATCH': return L(lang,
        'Sinabonye urugendo rufunguye kuri iyo tariki, ariko hari ingendo zihuye n’ibyo wasabye ku yindi matariki.',
        'I could not find an open trip on that date, but there are matching trips on other dates.');
      case 'DESTINATION_SUGGESTIONS_ONLY': return L(lang,
        'Mbabarira, nta rugendo ruteguwe ruhuye n’ibyo wasabye ubu.',
        'Sorry, I could not find an organized trip that matches your request right now.');
      default: return L(lang,
        'Mbabarira, nta rugendo rufunguye ruhuye n’ibyo wasabye ubu, ariko dore ibyagufasha:',
        'Sorry, I could not find an open trip that matches your request right now, but here is what might help:');
    }
  },
  unavailableTitle: (lang: Lang, state: string) => state === 'MATCHED_BUT_DATE_MISMATCH'
    ? L(lang, 'Ingendo zihuye ku yindi matariki', 'Matching trips on other dates')
    : state === 'MATCHED_BUT_FULL' ? L(lang, 'Ingendo zihuye ariko zuzuye', 'Matching trips that are full')
    : L(lang, 'Ingendo zihuye ariko kwiyandikisha byarangiye', 'Matching trips with registration closed'),
  askPlaceRole: (lang: Lang, place: string) => L(lang,
    `Urashaka ingendo zijya ${place}, cyangwa nahindure aho uturuka nkashyiraho ${place}?`,
    `Do you want trips to ${place}, or should I change your starting location to ${place}?`),
  placeRoleOptions: (lang: Lang) => (lang === 'rw' ? ['Aho njya', 'Aho nturuka'] : ['Destination', 'Starting location']),
  askOrigin: (lang: Lang) => L(lang, 'Uzaturuka he?', 'Where will you be starting from?'),
  changed: (lang: Lang, keys: string[]) => L(lang, `Nahinduye ${listPrefs(keys, lang)}, ibindi ndabigumana.`, `Updated the ${listPrefs(keys, lang)} and kept your other choices.`),
  cleared: (lang: Lang, keys: string[]) => L(lang, `Nakuyeho ${listPrefs(keys, lang)}.`, `Removed the ${listPrefs(keys, lang)}.`),
  reset: (lang: Lang) => L(lang, 'Sawa, dutangire bushya. Urashaka gukora iki?', 'Okay, starting a new search. What would you like to do?'),
  changeOriginChip: (lang: Lang) => L(lang, 'Hindura aho nturuka', 'Change starting location'),
  greeting: (lang: Lang) => L(lang,
    'Muraho! 👋 Ndi Umufasha wa Explore Rwanda. Mbwira icyo ushaka gukora, ahantu, itariki cyangwa amafaranga ufite, nkushakire ingendo zifunguye. Cyangwa uhitemo kimwe muri ibi:',
    'Hello! 👋 I am the Explore Rwanda Assistant. Tell me what you would like to do, where, when or your budget, and I will find open trips for you. Or pick one of these:'),
  smallTalk: (social: Social[], lang: Lang) => {
    // "I'm good, thanks" answers our question, so the thanks there is not a thank-you to reply to.
    const cues = social.includes('feeling_good') ? social.filter((k) => k !== 'thanks' && k !== 'affirm') : social;
    const lines = ORDER.filter((k) => cues.includes(k)).map((k) => SOCIAL_LINE[k](lang));
    if (social.includes('bye')) return [...lines.filter((x) => x !== SOCIAL_LINE.bye(lang)), SOCIAL_LINE.bye(lang), L(lang, 'Garuka igihe cyose ushaka gutegura urugendo.', 'Come back any time you are planning a trip.')].join(' ');
    return `${lines.join(' ')} ${ASK(lang)} ${L(lang, 'Dore ibitekerezo bike:', 'Here are a few ideas:')}`;
  },
  help: (lang: Lang) => L(lang,
    'Nshimishijwe no kugufasha! Mbwira mu magambo yawe icyo ushaka: igikorwa (urugero gutembera ku musozi, koga, inyamaswa), ahantu, itariki n’amafaranga ufite. Nzakwereka ingendo zifunguye, ibiciro n’imyanya isigaye. (Sinshobora guhindura amakuru cyangwa kwemeza abiyandikishije.)',
    'Happy to help! Just tell me in your own words what you are looking for: an activity (hiking, swimming, safari…), a place, a date and your budget. I will show you open trips with real prices and spaces left. (I cannot change data or approve registrations.)'),
  recommend: (lang: Lang, n: number) => (n
    ? L(lang,
      `Dore ingendo ${n} nkugiriye inama, zifunguye kandi zifite imyanya. Nshobora kuzitoranya neza nimbwira igikorwa, itariki cyangwa amafaranga ufite.`,
      `Here ${n === 1 ? 'is a trip' : `are ${n} trips`} I would recommend right now, open and with spaces left. Tell me an activity, a date or your budget and I can narrow it down.`)
    : L(lang, 'Ubu nta rugendo rufunguye ruhari.', 'There are no open trips right now.')),
  unknown: (lang: Lang) => L(lang,
    'Simbyumvise neza 🤔, ariko nakwishimira kugufasha gutegura urugendo! Nshobora gushaka ingendo hakurikijwe igikorwa, ahantu, itariki cyangwa amafaranga. Gerageza kimwe muri ibi:',
    'I am not sure I understood that 🤔, but I would love to help you plan something! I can find trips by activity, place, date or budget. Try one of these:'),
  suggestionsTitle: (lang: Lang) => L(lang, 'Ushobora kandi kugerageza:', 'You could also try:'),
  clarify: (lang: Lang) => ({
    question: L(lang,
      'Nshaka kugufasha neza. Ni ikihe gikorwa ushaka (urugero gutembera ku musozi, koga), kandi ufite ingengo y’imari cyangwa itariki runaka?',
      'I would love to help! What kind of activity are you in the mood for (for example hiking or swimming), and do you have a budget or date in mind?'),
    options: lang === 'rw'
      ? ['Gutembera ku musozi muri weekend', 'Koga munsi ya RWF 15,000', 'Ibidukikije ku cyumweru']
      : ['Hiking this weekend', 'Swimming under RWF 15,000', 'A nature activity on Sunday'],
  }),
  blockedAction: (lang: Lang) => L(lang,
    'Ndi umufasha ushakisha gusa. Sinshobora guhindura amakuru, kwemeza ibyifuzo, guhindura uruhare cyangwa gusiba. Ibyo bikorwa bikorerwa ku rupapuro rwawe rw’imikorere nyuma yo kwinjira.',
    'I am a read-only search assistant. I cannot change data, approve requests, change roles or delete anything. Those actions are done from your dashboard after signing in.'),
  blockedPrivate: (lang: Lang) => L(lang,
    'Sinshobora gutanga amakuru bwite y’abakoresha. Nshobora kugufasha gushaka ingendo, ahantu n’ibiciro.',
    'I cannot share private information about users. I can help you find trips, places and prices.'),
  found: (lang: Lang, n: number, catName?: string) => L(lang,
    `Dore ingendo ${n} ${catName ? `za “${catName}” ` : ''}zihuye n’ibyo wasabye, zifite imyanya.`,
    `Here ${n === 1 ? 'is 1 open trip' : `are ${n} open trips`}${catName ? ` for “${catName}”` : ''} matching your request.`),
  none: (lang: Lang) => L(lang,
    'Mbabarira, nta rugendo rufunguye ruhuye n’ibyo wasabye ubu, ariko dore ibyagufasha:',
    'Sorry, I could not find an open trip that matches your request right now, but here is what might help:'),
  /** No exact match, but close options exist: say what is missing, what was found, and ask what to change. */
  nearby: (lang: Lang, o: { relaxed: string[]; trips: { title: string; destination: string; trip_date: string; price: number; starting_location: string; category_name_en: string; category_name_rw: string }[];
    want: { cat?: string; place?: string; when?: boolean; whenText?: string; none?: boolean }; origin_ok?: boolean; nearKm?: number }) => {
    const t = o.trips[0], n = o.trips.length;
    const day = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(lang === 'rw' ? 'fr-RW' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    const r = new Set(o.relaxed);
    const tCat = (lang === 'rw' ? t.category_name_rw : t.category_name_en).split('/')[0].trim();
    const fromOk = o.origin_ok;
    // What could not be matched
    const missEn = r.has('category') && o.want.cat ? `any ${o.want.cat.toLowerCase()} trips` : 'an exact match';
    const missRw = r.has('category') && o.want.cat ? `urugendo rwa “${o.want.cat}”${o.want.none ? ' rufunguye ubu' : ''}` : 'urugendo ruhuye neza';
    const whereEn = r.has('location') && o.want.place ? ` in ${o.want.place}` : '';
    const whenEn = o.want.none ? ' open on the platform right now' : o.want.whenText ? ` ${o.want.whenText}` : r.has('date') ? ' on those dates' : o.want.when ? ' for those dates' : '';
    const far = r.has('location') && o.want.place && o.nearKm !== undefined;
    const lead = `${t.title} (${tCat}, ${day(t.trip_date)}, RWF ${t.price.toLocaleString('en-US')}${fromOk ? `, from ${t.starting_location}` : ''}${far ? `, about ${o.nearKm} km from ${o.want.place}` : ''})`;
    const leadRw = `${t.title} (${tCat}, ${day(t.trip_date)}, RWF ${t.price.toLocaleString('en-US')}${fromOk ? `, uturutse ${t.starting_location}` : ''}${far ? `, nko ku birometero ${o.nearKm} uvuye i ${o.want.place}` : ''})`;
    // Only the date is off: say plainly that nothing runs then, and which open dates exist instead.
    if (r.size === 1 && r.has('date') && !o.want.none) {
      const dates = [...new Set(o.trips.map((x) => day(x.trip_date)))];
      const datesEn = dates.length > 1 ? `${dates.slice(0, -1).join(', ')} and ${dates[dates.length - 1]}` : dates[0];
      const datesRw = dates.length > 1 ? `${dates.slice(0, -1).join(', ')} na ${dates[dates.length - 1]}` : dates[0];
      return L(lang,
        n === 1
          ? `Nta rugendo rufunguye ruhuye n’ibyo wasabye ${o.want.whenText || 'kuri iyo tariki'}. Urwegereye ni urugendo ruhuye n’ibindi byose wasabye, ariko ku yindi tariki: ${leadRw}. Iyo tariki yakunogera, cyangwa nshake ikindi gihe?`
          : `Nta rugendo rufunguye ruhuye n’ibyo wasabye ${o.want.whenText || 'kuri iyo tariki'}. Hari ingendo ${n} zihuye n’ibindi byose wasabye ku yindi matariki (${datesRw}), iya mbere ni ${leadRw}. Imwe muri izo tariki yakunogera, cyangwa nshake ikindi gihe?`,
        n === 1
          ? `There are no open trips ${o.want.whenText || 'on those dates'} that match your request yet. The closest option is on a different date but fits everything else you asked for: ${lead}. Would that date work for you, or should I check another time?`
          : `There are no open trips ${o.want.whenText || 'on those dates'} that match your request yet. The closest options are ${n} open trips on other dates (${datesEn}) that fit everything else you asked for, starting with ${lead}. Would one of those dates work for you, or should I check another time?`);
    }
    const howEn = [...r].filter((k) => k !== 'transportIncluded').map((k) => k === 'category' ? 'activity' : k === 'location' ? 'place' : 'date');
    const diffEn = howEn.length ? `just a different ${howEn.join(' and ')}` : 'but transport is not included';
    const diffRw = [...r].map((k) => k === 'category' ? 'igikorwa' : k === 'location' ? 'ahantu' : k === 'date' ? 'itariki' : 'transport').join(' n’');
    const askEn = r.has('category') ? `Would you like to try ${tCat.toLowerCase()} instead${r.has('date') || o.want.none ? '' : ', or should I look at other dates'}?`
      : r.has('location') ? `${far ? 'It’s the closest option I have. ' : ''}Would you like to go there instead, or try another place?`
      : r.has('date') ? 'Does another date work for you?' : 'Would that work for you?';
    const askRw = r.has('category') ? `Wahitamo “${tCat}” aho${o.want.none ? '' : ', cyangwa nshake ku yindi matariki'}?` : 'Byakunogera?';
    return L(lang,
      `Sinabonye ${missRw} uko wabisabye. Ariko hari ${n === 1 ? 'urugendo 1 rufunguye ruhuye' : `ingendo ${n} zifunguye zihuye`} n’ibindi byose wasabye, uretse ${diffRw}: ${leadRw}. ${askRw}`,
      `I couldn't find ${missEn}${whereEn}${whenEn}. But there ${n === 1 ? 'is 1 open trip' : `are ${n} open trips`} that fit${n === 1 ? 's' : ''} everything else you asked for, ${diffEn}: ${lead}. ${askEn}`);
  },
  /** Trips match but cost more than the budget, and a cheaper trip exists if one condition changes: name both. */
  aboveBudgetNearby: (lang: Lang, o: { alt: { title: string; trip_date: string; over_budget_by?: number }; altCount: number; budget: number; activityOnly: boolean;
    whenText?: string; near: { title: string; trip_date: string; price: number; cost: { known_total: number } }; relaxed: string[] }) => {
    const day = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(lang === 'rw' ? 'fr-RW' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    const over = o.alt.over_budget_by ?? 0, cost = o.budget + over;
    const nearCost = o.activityOnly ? o.near.price : o.near.cost.known_total;
    const r = new Set(o.relaxed);
    const diffEn = [r.has('date') && 'on a different date', r.has('category') && 'with a different activity', r.has('location') && 'in a different place', r.has('transportIncluded') && 'without included transport'].filter(Boolean).join(', ');
    const diffRw = [r.has('date') && 'ku yindi tariki', r.has('category') && 'ari ikindi gikorwa', r.has('location') && 'ahandi hantu', r.has('transportIncluded') && 'nta transport irimo'].filter(Boolean).join(', ');
    const whenEn = o.whenText ? `${o.whenText.charAt(0).toUpperCase()}${o.whenText.slice(1)}, there` : 'There';
    const whenRw = o.whenText ? `${o.whenText.charAt(0).toUpperCase()}${o.whenText.slice(1)}, hari` : 'Hari';
    const many = o.altCount > 1;
    return L(lang,
      `${whenRw} ${many ? `ingendo ${o.altCount} zihuye n’ibyo wasabye; ihendutse ni` : 'urugendo 1 ruhuye n’ibyo wasabye:'} ${o.alt.title} (${day(o.alt.trip_date)}), ariko ${o.activityOnly ? 'igiciro cyarwo' : 'igiciro cyarwo kizwi'} ni RWF ${f(cost)}, kirenga ingengo y’imari yawe ya RWF ${f(o.budget)} ho RWF ${f(over)}. `
      + `Mu ngengo y’imari yawe, urwegereye ni ${o.near.title} (${day(o.near.trip_date)}, RWF ${f(nearCost)})${diffRw ? `, ${diffRw}` : ''}. Wahitamo urwo, cyangwa wazamura ingengo y’imari?`,
      `${whenEn} ${many ? `are ${o.altCount} trips that match your request; the cheapest is` : 'is 1 trip that matches your request:'} ${o.alt.title} (${day(o.alt.trip_date)}), but ${o.activityOnly ? 'its price' : 'its known cost'} is RWF ${f(cost)}, RWF ${f(over)} above your RWF ${f(o.budget)} budget. `
      + `Within your budget, the closest option is ${o.near.title} (${day(o.near.trip_date)}, RWF ${f(nearCost)})${diffEn ? `, ${diffEn}` : ''}. Would you like that one instead, or would you raise your budget?`);
  },
  /** Transport was not in the trip price, so a public transport fare was added to the total. */
  transportNote: (lang: Lang, o: { from: string; assumed: boolean; table: boolean; distance: boolean; replaced?: string }) => {
    const how = o.table && !o.distance ? L(lang, 'nkurikije ibiciro byashyizweho n’ubuyobozi', 'using the platform’s fare table')
      : !o.table ? L(lang, 'nkurikije intera y’umuhanda', 'estimated from the road distance') : L(lang, 'nkurikije ibiciro byashyizweho cyangwa intera', 'from the fare table or the road distance');
    return o.assumed
      ? L(lang, `Aho transport itari mu giciro, nongeyeho itike ya bisi (kugenda no kugaruka) uvuye i ${o.from}, aho urugendo rutangirira (${how}). Mbwira aho uzaturuka nkubarire neza.`,
        `Where transport isn't included, I added a return public transport fare from ${o.from}, the trip's starting point (${how}). Tell me where you'll travel from and I'll recalculate.`)
      : L(lang, `Aho transport itari mu giciro, nongeyeho itike ya bisi (kugenda no kugaruka) uvuye i ${o.from} (${how}).${o.replaced ? ` Ku rugendo rufite transport y’uwateguye ihera i ${o.replaced}, nabaze bisi uvuye i ${o.from} kuko ari ho uri hafi.` : ''}`,
        `Where transport isn't included, I added the return public transport fare from ${o.from} (${how}).${o.replaced ? ` For trips whose transport is organized from ${o.replaced}, I used public transport from ${o.from} instead, since you're starting there.` : ''}`);
  },
  /** The same closest option again after a follow-up: short, no repeated pitch. */
  nearbyAgain: (lang: Lang, t: { title: string; trip_date: string; category_name_en: string; category_name_rw: string }, cat?: string) => {
    const day = new Date(t.trip_date + 'T12:00:00Z').toLocaleDateString(lang === 'rw' ? 'fr-RW' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    const tCat = (lang === 'rw' ? t.category_name_rw : t.category_name_en).split('/')[0].trim();
    return L(lang,
      `Biracyari uko: nta ${cat ? `rugendo rwa “${cat}”` : 'rugendo ruhuye neza'} ruhari. ${t.title} (${day}) ni rwo rukiri hafi y’ibyo ushaka. Wahitamo “${tCat}”?`,
      `Still no ${cat ? `${cat.toLowerCase()} trips` : 'exact match'}, I'm afraid. ${t.title} on ${day} is still your closest option. Shall I switch you to ${tCat.toLowerCase()}?`);
  },
  nearbyTitle: (lang: Lang, relaxed: string[]) => {
    const only = relaxed.length === 1 ? relaxed[0] : '';
    return L(lang, only === 'date' ? 'Ibyegereye ibyo wasabye: ku yindi tariki' : 'Ibyegereye ibyo wasabye',
      only === 'category' ? 'Closest options: a different activity' : only === 'date' ? 'Closest options: other dates' : 'Closest options');
  },
  alternativesTitle: (lang: Lang) => L(lang, 'Izindi nzira: ingendo zirengeje ingengo y’imari yawe', 'Alternatives: trips above your budget'),
  destinationsNote: (lang: Lang) => L(lang,
    'Ahantu hakurikira ni ibitekerezo gusa — si ingendo ziteguwe. Ntiwemeza ko hari urugendo ruhari.',
    'The places below are general suggestions only — they are not organized trips and do not mean a trip is available.'),
  noDataNote: (lang: Lang) => L(lang,
    'Nta rugendo na rumwe rwatangajwe ku rubuga ubu.',
    'There are no published trips on the platform yet.'),
};
