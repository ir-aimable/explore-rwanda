// Answers to "where is X?" and "how much is the bus from X to Y?" from the built-in map of Rwanda
// and the official RURA 2026 inter-city fare table. No trip search is run; the active search is kept.
import { db } from '../../database/db.js';
import { findPlace, locate, type Place, type Point } from '../geo/rwanda.js';
import { directionsOf, KIGALI_TERMINALS, nearestStops, planJourney, routeStops, RURA_DIRECTIONS, RURA_TARIFF, stopOf, type Journey } from '../geo/rura/network.js';
import type { Intent } from './nlp.js';
import type { Session } from './session.js';
import { msg } from './messages.js';

type Lang = 'rw' | 'en';
const L = (lang: Lang, rw: string, en: string) => (lang === 'rw' ? rw : en);
const rwf = (n: number) => `RWF ${n.toLocaleString('en-US')}`;
const PROVINCE: Record<Place['province'], [string, string]> = {
  Kigali: ['Umujyi wa Kigali', 'Kigali City'], Northern: ['Intara y’Amajyaruguru', 'Northern Province'], Southern: ['Intara y’Amajyepfo', 'Southern Province'],
  Eastern: ['Intara y’Iburasirazuba', 'Eastern Province'], Western: ['Intara y’Iburengerazuba', 'Western Province'],
};
const province = (p: Place, lang: Lang) => L(lang, ...PROVINCE[p.province]);
/** "mu Karere ka Huye" / "in Huye District" */
const inDistrict = (p: Place, lang: Lang) => L(lang, `mu Karere ka ${p.district}`, `in ${p.district} District`);
/** Kinyarwanda locative before a place name: "i Huye". */
const at = (n: string) => `i ${n}`;
/** "Direction 2: Nyabugogo - Musanze - Rubavu" -> "Nyabugogo – Musanze – Rubavu" */
const corridor = (i: number, lang: Lang) => (lang === 'rw' ? RURA_DIRECTIONS[i].name_rw : RURA_DIRECTIONS[i].name_en).replace(/^[^:]+:\s*/, '').replace(/ - /g, ' – ');

interface Endpoint { name: string; point?: Point; place?: Place }
/** A place on the map, or a destination record (its own coordinates; district from its region). */
async function resolve(name?: string): Promise<Endpoint | undefined> {
  if (!name) return undefined;
  const place = findPlace(name);
  if (place) return { name: place.name, point: { lat: place.lat, lng: place.lng }, place };
  const n = name.trim().toLowerCase();
  const d = (await db.prepare('SELECT name,region,latitude,longitude FROM destinations').all() as any[])
    .find((x) => x.name.toLowerCase() === n) ?? (await db.prepare('SELECT name,region,latitude,longitude FROM destinations').all() as any[])
    .find((x) => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()));
  if (!d) return undefined;
  return { name: d.name, point: locate(d), place: findPlace(d.region) ?? findPlace(d.name) };
}

const legText = (j: Journey, lang: Lang) => j.legs.map((l) => `${l.from} → ${l.to}${l.via ? L(lang, ` (unyuze i ${l.via})`, ` (via ${l.via})`) : ''}: ${rwf(l.fare)}`);

function journeyText(j: Journey, from: Endpoint, to: Endpoint, lang: Lang): string {
  const out: string[] = [];
  out.push(L(lang, `Kuva ${at(from.name)} ujya ${at(to.name)}: ${rwf(j.one_way)} ku muntu, urugendo rumwe (hafi ${rwf(j.one_way * 2)} kugenda no kugaruka).`,
    `${from.name} → ${to.name}: ${rwf(j.one_way)} per person one way (about ${rwf(j.one_way * 2)} return).`));
  const legs = legText(j, lang);
  if (legs.length === 1) out.push(L(lang, `Bisi itaziguye: ${legs[0]}.`, `Direct bus: ${legs[0]}.`));
  else if (legs.length > 1) out.push(L(lang, `Fata bisi ${legs.join(', hanyuma ')}.`, `Take the bus ${legs.join(', then ')}.`));
  if (from.place?.province === 'Kigali' && KIGALI_TERMINALS.includes(j.board.stop) && j.legs.length)
    out.push(L(lang, `I Kigali, iyi bisi ihagurukira muri gare ya ${j.board.stop}.`, `In Kigali, this bus leaves from the ${j.board.stop} bus park.`));
  if (j.board.fare > 0) out.push(L(lang, `Banza uve ${at(from.name)} ujye ${at(j.board.stop)} (nko ku km ${j.board.km}, hafi ${rwf(j.board.fare)} ukoresheje transport yo muri ako gace; ni ikigereranyo).`,
    `First get from ${from.name} to ${j.board.stop} (about ${j.board.km} km, ≈ ${rwf(j.board.fare)} by local transport; an estimate).`));
  if (j.alight.fare > 0) out.push(L(lang, `Kuva ${at(j.alight.stop)} ugera ${at(to.name)} ni nko ku km ${j.alight.km}: hafi ${rwf(j.alight.fare)} ukoresheje transport yo muri ako gace (ikigereranyo, si igiciro cya RURA).`,
    `From ${j.alight.stop} it is about ${j.alight.km} km to ${to.name}: ≈ ${rwf(j.alight.fare)} by local transport (an estimate, not a RURA fare).`));
  out.push(j.official ? L(lang, `Ni ibiciro bya bisi byemejwe na RURA (${RURA_TARIFF.year}).`, `These are official RURA ${RURA_TARIFF.year} bus fares.`)
    : L(lang, `Ibiciro bya bisi ni ibyemejwe na RURA (${RURA_TARIFF.year}).`, `Bus fares are official RURA ${RURA_TARIFF.year} fares.`));
  if (to.place) out.push(L(lang, `${to.name} iherereye ${inDistrict(to.place, lang)}, ${province(to.place, lang)}${j.km ? `, nko ku km ${j.km} z’umuhanda uvuye ${at(from.name)}` : ''}.`,
    `${to.name} is ${inDistrict(to.place, lang)}, ${province(to.place, lang)}${j.km ? `, about ${j.km} km by road from ${from.name}` : ''}.`));
  return out.join(' ');
}

const routeCard = (j: Journey, to: Endpoint) => ({
  from: j.from, to: j.to, one_way: j.one_way, return: j.one_way * 2, official: j.official, tariff_year: RURA_TARIFF.year, km: j.km,
  stops: routeStops(j), legs: j.legs.map((l) => ({ from: l.from, to: l.to, via: l.via, fare: l.fare })),
  board: j.board, alight: j.alight, place: to.place && placeCard(to.place, to.point),
});
const placeCard = (p: Place, point?: Point) => ({ name: p.name, district: p.district, province: p.province, lat: point?.lat ?? p.lat, lng: point?.lng ?? p.lng });

const notFound = (lang: Lang, raw: string) => { const name = raw.replace(/\b\w/g, (c) => c.toUpperCase()); return L(lang,
  `Sinabonye “${name}” ku ikarita y’u Rwanda mfite. Gerageza izina ry’umujyi, umurenge cyangwa aho bisi ihagarara (urugero: Musanze, Kitabi cyangwa Nyamata).`,
  `I couldn't find “${name}” on my map of Rwanda. Try a town, sector or bus-stop name (for example Musanze, Kitabi or Nyamata).`); };

/** "How much is the bus from X to Y?" / "How do I get to Y?" */
export async function routeReply(i: Intent, lang: Lang, session: Session) {
  const fromName = i.routeFrom ?? session.origin;
  const to = await resolve(i.routeTo);
  if (!to) return { message: notFound(lang, i.routeTo ?? ''), suggestions: [] as string[] };
  // No starting point anywhere: ask, never assume a city.
  if (!fromName) {
    const hubs = (await db.prepare('SELECT name FROM transport_hubs ORDER BY sort_order,id').all() as any[]).map((h) => h.name as string).filter((n) => n !== to.name).slice(0, 6);
    const question = msg.askRouteOrigin(lang, to.name);
    return { message: question, clarification: { question, options: hubs }, context: { ...session, pending: { kind: 'route_origin' as const, to: to.name } } };
  }
  const from = await resolve(fromName);
  if (!from) return { message: notFound(lang, i.routeFrom ?? session.origin ?? ''), suggestions: [] as string[] };
  const suggestions = [L(lang, `Ingendo zijya ${to.name}`, `Trips to ${to.name}`), L(lang, `${to.name} iherereye he?`, `Where is ${to.name}?`),
    L(lang, `Itike kuva ${at(to.name)} ujya ${at(from.name)}`, `Bus fare from ${to.name} to ${from.name}`)];
  if (from.name === to.name) return { message: L(lang, `Usanzwe uri ${at(to.name)}.`, `You're already in ${to.name}.`), suggestions };
  const j = planJourney(from, to);
  if (!j) return { message: L(lang, `Sinabonye inzira ya bisi ya RURA ihuza ${at(from.name)} na ${at(to.name)}.`, `I couldn't find a RURA bus route between ${from.name} and ${to.name}.`), suggestions };
  return { message: journeyText(j, from, to, lang), route: routeCard(j, to), suggestions };
}

/** "Where is X?" */
export async function placeReply(i: Intent, lang: Lang, session: Session) {
  const p = await resolve(i.placeQuery);
  if (!p || !p.place) return { message: notFound(lang, i.placeQuery ?? ''), suggestions: [] as string[] };
  const place = p.place, out: string[] = [];
  out.push(L(lang, `${p.name} iherereye ${inDistrict(place, lang)}, ${province(place, lang)}.`, `${p.name} is ${inDistrict(place, lang)}, ${province(place, lang)}.`));
  const stop = stopOf(p.name);
  if (stop) {
    const dirs = directionsOf(stop).slice(0, 2).map((d) => corridor(d, lang));
    if (dirs.length) out.push(L(lang, `Ni ahantu bisi zihagarara ku byerekezo bya RURA: ${dirs.join('; ')}.`, `It's a bus stop on the RURA route${dirs.length > 1 ? 's' : ''} ${dirs.join('; ')}.`));
  } else if (p.point) {
    const near = nearestStops(p.point, 1)[0];
    if (near) out.push(L(lang, `Aho bisi ihagarara hafi ni ${near.stop}, nko ku km ${near.km}.`, `The nearest bus stop is ${near.stop}, about ${near.km} km away.`));
  }
  // The bus fare only from where the traveller said they are; otherwise invite them to say.
  const originName = session.origin;
  const origin = await resolve(originName);
  let route;
  if (!origin) out.push(L(lang, `Mbwira aho uzaturuka nkubarire itike ya bisi ujya ${at(p.name)}.`, `Tell me where you'll travel from and I'll work out the bus fare to ${p.name}.`));
  else if (origin.name !== p.name && !(origin.place?.province === 'Kigali' && place.province === 'Kigali' && origin.name === 'Kigali')) {
    const j = planJourney(origin, p);
    if (j) {
      route = routeCard(j, p);
      const chain = routeStops(j).join(' → ');
      out.push(L(lang, `Kuva ${at(origin.name)}: ${rwf(j.one_way)} urugendo rumwe na bisi (${chain})${j.official ? '' : ', harimo ikigereranyo cy’urugendo rwo muri ako gace'}${j.km ? `; nko ku km ${j.km} z’umuhanda` : ''}.`,
        `From ${origin.name}: ${rwf(j.one_way)} one way by bus (${chain})${j.official ? '' : ', including an estimated local ride'}${j.km ? `; about ${j.km} km by road` : ''}.`));
    }
  }
  return {
    message: out.join(' '), place: placeCard(place, p.point), route,
    suggestions: [originName ? L(lang, `Itike kuva ${at(originName)} ujya ${at(p.name)}`, `Bus fare from ${originName} to ${p.name}`) : L(lang, `Nagera ate ${at(p.name)}?`, `How do I get to ${p.name}?`), L(lang, `Ingendo zijya ${p.name}`, `Trips to ${p.name}`)],
  };
}
