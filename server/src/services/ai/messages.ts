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
    case 'r_origin': return L(lang, `Gitangirira i ${p.place}`, `Starts from ${p.place}`);
    case 'r_date': return L(lang, `Kiba ${weekdayName(p.date, 'rw')} ${p.date}`, `Takes place on ${weekdayName(p.date, 'en')} ${p.date}`);
    case 'r_budget': return L(lang, `Kiri mu ngengo y’imari yawe: RWF ${f(p.price)} (usigaranye RWF ${f(p.left)})`, `Within your budget: RWF ${f(p.price)} (RWF ${f(p.left)} to spare)`);
    case 'r_lowcost': return L(lang, `Igiciro gito: RWF ${f(p.price)}`, `Low cost: RWF ${f(p.price)}`);
    case 'r_spaces': return L(lang, `Hasigaye imyanya ${p.n}`, `${p.n} spaces left`);
    case 'r_few_spaces': return L(lang, `Hasigaye imyanya mike gusa (${p.n})`, `Only ${p.n} spaces left`);
    case 'r_people': return L(lang, `Hari umwanya w’abantu ${p.n}`, `Enough space for ${p.n} people`);
    case 'r_easy': return L(lang, 'Kiroroshye ku batangiye', 'Easy level, suitable for beginners');
    case 'r_challenging': return L(lang, 'Ni igikorwa kigoye ku bakunda ibigeragezo', 'Challenging level as requested');
    default: return '';
  }
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
    const s = d.dateFrom === d.dateTo ? `${weekdayName(d.dateFrom, lang)} ${d.dateFrom}` : `${d.dateFrom} → ${d.dateTo}`;
    out.push(L(lang, `Itariki: ${s}`, `Date: ${s}`));
  }
  if (i.people) out.push(L(lang, `Abantu: ${i.people}`, `People: ${i.people}`));
  if (i.lowCost) out.push(L(lang, 'Ushaka igiciro gito', 'Preference: low cost'));
  return out;
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

export const msg = {
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
    : L(lang, 'Ubu nta rugendo rufunguye ruhari, ariko dore ahantu heza ushobora gutekerezaho.', 'There are no open trips right now, but here are some great places to consider.')),
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
  alternativesTitle: (lang: Lang) => L(lang, 'Izindi nzira: ingendo zirengeje ingengo y’imari yawe', 'Alternatives: trips above your budget'),
  destinationsNote: (lang: Lang) => L(lang,
    'Ahantu hakurikira ni ibitekerezo gusa — si ingendo ziteguwe. Ntiwemeza ko hari urugendo ruhari.',
    'The places below are general suggestions only — they are not organized trips and do not mean a trip is available.'),
  noDataNote: (lang: Lang) => L(lang,
    'Nta rugendo na rumwe rwatangajwe ku rubuga ubu.',
    'There are no published trips on the platform yet.'),
};
