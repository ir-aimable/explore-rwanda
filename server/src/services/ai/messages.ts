// All assistant wording (Kinyarwanda + English) lives here. Facts are injected from the database.
import type { Intent } from './nlp.js';
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

export const msg = {
  greeting: (lang: Lang) => L(lang,
    'Muraho! Ndi umufasha wa Explore Rwanda. Mbwira icyo ushaka, urugero: “Mfite RWF 10,000 muri weekend. Nakwiga he gutembera ku musozi?”',
    'Hello! I am the Explore Rwanda trip assistant. Tell me what you want, for example: “I have RWF 10,000 this weekend. Where can I go hiking?”'),
  help: (lang: Lang) => L(lang,
    'Nshobora gushakisha ingendo zifunguye mu bubiko bw’urubuga hakurikijwe igikorwa, ahantu, itariki, ingengo y’imari n’umubare w’abantu. Sinshobora guhindura amakuru cyangwa kwemeza abiyandikishije.',
    'I can search the open trips on the platform by activity, place, date, budget and group size. I cannot change data or approve registrations.'),
  clarify: (lang: Lang) => ({
    question: L(lang,
      'Nshaka kugufasha neza. Ni ikihe gikorwa ushaka (urugero gutembera ku musozi, koga), kandi ufite ingengo y’imari cyangwa itariki runaka?',
      'I want to help properly. Which activity do you want (for example hiking or swimming), and do you have a budget or date in mind?'),
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
    'Nta rugendo rufunguye ruhuye n’ibyo wasabye ubu.',
    'I could not find an open trip that matches your request right now.'),
  alternativesTitle: (lang: Lang) => L(lang, 'Izindi nzira: ingendo zirengeje ingengo y’imari yawe', 'Alternatives: trips above your budget'),
  destinationsNote: (lang: Lang) => L(lang,
    'Ahantu hakurikira ni ibitekerezo gusa — si ingendo ziteguwe. Ntiwemeza ko hari urugendo ruhari.',
    'The places below are general suggestions only — they are not organized trips and do not mean a trip is available.'),
  noDataNote: (lang: Lang) => L(lang,
    'Nta rugendo na rumwe rwatangajwe ku rubuga ubu.',
    'There are no published trips on the platform yet.'),
};
