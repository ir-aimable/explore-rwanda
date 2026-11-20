// Answers about destinations ("any free destinations?", "tell me about Lake Kivu", "is Akagera free?")
// and about one trip's details ("what's included?", "where do we meet?"). Facts come straight from the database.
import { db } from '../../database/db.js';
import { getTripRow, listPublicTrips, shapeTrip } from '../search/tripService.js';
import { discover } from '../search/discovery.js';
import { norm, weekdayName, type Intent, type TripAspect } from './nlp.js';
import type { Session } from './session.js';

type Lang = 'rw' | 'en';
const L = (lang: Lang, rw: string, en: string) => (lang === 'rw' ? rw : en);
const rwf = (n: number) => `RWF ${n.toLocaleString('en-US')}`;
const list = (xs: string[], lang: Lang) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${L(lang, 'na', 'and')} ${xs[xs.length - 1]}`);
const when = (date: string, lang: Lang) => `${weekdayName(date, lang)} ${date}`;

/** A destination as shown in the chat: everything a traveller needs to decide whether to go. */
export interface DestCard {
  id: number; name: string; slug: string; region: string; link: string; image_path: string | null;
  is_free: boolean; entry: { amount: number | null; source: string } | null;
  categories: { slug: string; name_en: string; name_rw: string }[];
  rating: number | null; review_count: number;
  open_trips: number; next_trip: string | null; cheapest_trip: number | null;
  things: { title: string; price_from: number }[];
}

async function loadDestinations(lang: Lang) {
  const rows = await db.prepare('SELECT * FROM destinations WHERE is_published=1').all() as any[];
  const cats = await db.prepare('SELECT dc.destination_id,c.slug,c.name_en,c.name_rw FROM destination_categories dc JOIN categories c ON c.id=dc.category_id').all() as any[];
  const entry = await db.prepare("SELECT destination_id,amount,source_type FROM cost_records WHERE trip_id IS NULL AND cost_type='entry_fee' ORDER BY id").all() as any[];
  const ratings = await db.prepare("SELECT destination_id, ROUND(AVG(rating),1) avg, COUNT(*) n FROM reviews WHERE status='visible' GROUP BY destination_id").all() as any[];
  const things = await db.prepare(`SELECT e.destination_id,e.title_en,e.title_rw,e.price_from FROM experiences e LEFT JOIN organizers o ON o.id=e.organizer_id
    WHERE e.is_published=1 AND e.destination_id IS NOT NULL AND (e.organizer_id IS NULL OR o.status='approved') ORDER BY e.sort_order,e.id`).all() as any[];
  const open = (await listPublicTrips({ unlimited: true, sort: 'date' })).items.filter((t: any) => t.is_open);
  return rows.map((d): DestCard & { description: string; tips: string[] } => {
    const trips = open.filter((t: any) => t.destination.id === d.id);
    const e = entry.find((x) => x.destination_id === d.id);
    const r = ratings.find((x) => x.destination_id === d.id);
    const info = ((lang === 'rw' ? d.info_rw || d.info_en : d.info_en || d.info_rw) || '') as string;
    return {
      id: d.id, name: d.name, slug: d.slug, region: d.region, link: `/destinations/${d.id}`, image_path: d.image_path,
      is_free: !!d.is_free, entry: d.is_free ? { amount: 0, source: 'official' } : e ? { amount: e.amount, source: e.source_type } : null,
      categories: cats.filter((c) => c.destination_id === d.id).map(({ destination_id: _, ...c }) => c),
      rating: r ? Number(r.avg) : null, review_count: r ? Number(r.n) : 0,
      open_trips: trips.length, next_trip: trips[0]?.trip_date ?? null, cheapest_trip: trips.length ? Math.min(...trips.map((t: any) => t.price)) : null,
      things: things.filter((x) => x.destination_id === d.id).map((x) => ({ title: lang === 'rw' ? x.title_rw : x.title_en, price_from: x.price_from })),
      description: (lang === 'rw' ? d.description_rw : d.description_en) || '',
      tips: info.split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean),
    };
  });
}
const card = ({ description: _d, tips: _t, ...c }: DestCard & { description: string; tips: string[] }): DestCard => c;
const catName = (c: { name_en: string; name_rw: string }, lang: Lang) => (lang === 'rw' ? c.name_rw : c.name_en);

function entryText(d: DestCard, lang: Lang) {
  if (d.is_free) return L(lang, `Gusura ${d.name} ni ubuntu: nta mafaranga yo kwinjira.`, `${d.name} is free to visit: there is no entry fee.`);
  if (d.entry?.amount != null) return L(lang, `Amafaranga yo kwinjira: ${rwf(d.entry.amount)}.`, `Entry fee: ${rwf(d.entry.amount)}.`);
  return L(lang, `Amafaranga yo kwinjira ntaremezwa; banza ubaze ababishinzwe mbere yo kugenda.`, `The entry fee is not confirmed yet; check with the site before you go.`);
}
function tripsText(d: DestCard, lang: Lang) {
  if (!d.open_trips) return L(lang, 'Nta ngendo zateguwe zifunguye ubu zijyayo.', 'No organized trips there are open right now.');
  return L(lang, `Hari ingendo ${d.open_trips} zifunguye; iya mbere ni ${when(d.next_trip!, lang)}, guhera kuri ${rwf(d.cheapest_trip!)}.`,
    `${d.open_trips} open trip${d.open_trips > 1 ? 's' : ''}; the next one is on ${when(d.next_trip!, lang)}, from ${rwf(d.cheapest_trip!)}.`);
}
const ratingText = (d: DestCard, lang: Lang) => (d.rating != null
  ? L(lang, `Amanota: ${d.rating}/5 (abagenzi ${d.review_count}).`, `Rated ${d.rating}/5 by ${d.review_count} traveller${d.review_count > 1 ? 's' : ''}.`) : '');
const thingsText = (d: DestCard, lang: Lang) => (d.things.length
  ? L(lang, `Ibyo gukora: ${d.things.slice(0, 3).map((x) => `${x.title} (guhera kuri ${rwf(x.price_from)})`).join('; ')}.`,
    `Things to do: ${d.things.slice(0, 3).map((x) => `${x.title} (from ${rwf(x.price_from)})`).join('; ')}.`) : '');
const actsText = (d: DestCard, lang: Lang) => (d.categories.length ? L(lang, `Ibikorwa: ${d.categories.map((c) => catName(c, lang)).join(', ')}.`, `Activities: ${d.categories.map((c) => catName(c, lang)).join(', ')}.`) : '');

/** Sorting for lists: open trips first, then rating; "cheap" puts free and low entry fees first. */
const entryRank = (d: DestCard) => (d.is_free ? 0 : d.entry?.amount != null ? d.entry.amount : Number.MAX_SAFE_INTEGER);
const byPopular = (a: DestCard, b: DestCard) => b.open_trips - a.open_trips || (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name);

export async function destinationReply(i: Intent, lang: Lang, session: Session) {
  const all = await loadDestinations(lang);
  if (i.destAspect !== 'list' && i.destName) {
    const d = all.find((x) => x.name === i.destName);
    if (d) return destinationDetail(d, i, lang, session);
  }
  // ---- A list, filtered by what was asked
  let items = all.slice();
  const filters: string[] = [];
  if (i.destFree) items = items.filter((d) => d.is_free);
  if (i.category) {
    items = items.filter((d) => d.categories.some((c) => c.slug === i.category));
    const c = all.flatMap((d) => d.categories).find((x) => x.slug === i.category); if (c) filters.push(L(lang, `bya ${catName(c, lang)}`, `for ${catName(c, lang).toLowerCase()}`));
  }
  if (i.location) {
    const loc = norm(i.location);
    items = items.filter((d) => norm(`${d.name} ${d.region}`).includes(loc));
    filters.push(L(lang, `i ${i.location}`, `in ${i.location}`));
  }
  items.sort(i.lowCost || i.destFree ? (a, b) => entryRank(a) - entryRank(b) || byPopular(a, b) : byPopular);
  const where = filters.length ? ' ' + filters.join(' ') : '';
  let message: string;
  let shown = items;
  if (i.destFree && !items.length) {
    // Nothing is free: offer the cheapest known entry instead
    shown = all.filter((d) => d.entry?.amount != null).sort((a, b) => entryRank(a) - entryRank(b)).slice(0, 4);
    message = L(lang, `Nta hantu hagaragazwa nk’ahasurwa ku buntu${where} ubu.${shown.length ? ` Ahafite amafaranga yo kwinjira make azwi: ${list(shown.map((d) => `${d.name} (${rwf(d.entry!.amount!)})`), lang)}.` : ''}`,
      `No destination${where} is marked free to visit right now.${shown.length ? ` The lowest known entry fees: ${list(shown.map((d) => `${d.name} (${rwf(d.entry!.amount!)})`), lang)}.` : ''}`);
  } else if (!items.length) {
    message = L(lang, `Nta hantu mbonye${where}. Gerageza ikindi gikorwa cyangwa akandi gace.`, `I couldn't find any destination${where}. Try another activity or area.`);
    shown = all.sort(byPopular).slice(0, 4);
  } else {
    // "Lake Kivu – Western Province, free entry, 2 open trips"
    const fee = (d: DestCard) => (d.is_free ? L(lang, 'kwinjira ni ubuntu', 'free entry') : d.entry?.amount != null ? L(lang, `kwinjira ${rwf(d.entry.amount)}`, `entry ${rwf(d.entry.amount)}`) : L(lang, 'amafaranga yo kwinjira ntazwi', 'entry fee not confirmed'));
    const names = items.slice(0, 5).map((d) => [`${d.name} – ${d.region}`, i.lowCost && !i.destFree ? fee(d) : '',
      d.open_trips ? L(lang, `ingendo zifunguye: ${d.open_trips}`, `${d.open_trips} open trip${d.open_trips > 1 ? 's' : ''}`) : ''].filter(Boolean).join(', '));
    const join = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join('; ')}; ${L(lang, 'na', 'and')} ${xs[xs.length - 1]}`);
    message = i.destFree
      ? L(lang, `Ahantu ${items.length} hasurwa ku buntu${where}: ${join(names)}. Ku buntu bivuze ko nta mafaranga yo kwinjira; transport n’ingendo ziyobowe byishyurwa ukwabyo.`,
        `${items.length === 1 ? 'One destination is' : `${items.length} destinations are`} free to visit${where}: ${join(names)}. Free means no entry fee; transport and guided trips are paid separately.`)
      : i.lowCost
        ? L(lang, `Ahahendutse gusura${where}, uhereye ku buntu: ${join(names)}.`, `Cheapest to visit${where}, free ones first: ${join(names)}.`)
        : L(lang, `Ahantu ${items.length}${where}: ${join(names)}.`, `${items.length} destination${items.length > 1 ? 's' : ''}${where}: ${join(names)}.`);
  }
  const top = shown[0];
  return {
    message, dest_cards: shown.slice(0, 6).map(card),
    suggestions: [
      top && L(lang, `Mbwira ibya ${top.name}`, `Tell me about ${top.name}`),
      top?.open_trips ? L(lang, `Ingendo zijya ${top.name}`, `Trips to ${top.name}`) : undefined,
      i.destFree ? L(lang, 'Ahantu hahendutse', 'Cheapest destinations') : L(lang, 'Ahasurwa ku buntu', 'Free destinations'),
      L(lang, 'Ahantu ho gutembera ku musozi', 'Places for hiking'),
    ].filter(Boolean) as string[],
    context: session,
  };
}

async function destinationDetail(d: Awaited<ReturnType<typeof loadDestinations>>[number], i: Intent, lang: Lang, session: Session) {
  const parts: string[] = [];
  const head = L(lang, `${d.name} iherereye ${d.region}.`, `${d.name} is in ${d.region}.`);
  const reviews = i.destAspect === 'reviews' ? await db.prepare(`SELECT rating,comment FROM reviews WHERE destination_id=? AND status='visible' ORDER BY id DESC LIMIT 2`).all(d.id) as any[] : [];
  switch (i.destAspect) {
    case 'entry': parts.push(entryText(d, lang), head, tripsText(d, lang)); break;
    case 'activities': parts.push(actsText(d, lang) || L(lang, `Nta bikorwa byanditswe kuri ${d.name}.`, `No activities are listed for ${d.name} yet.`), thingsText(d, lang), tripsText(d, lang)); break;
    case 'reviews':
      parts.push(ratingText(d, lang) || L(lang, `${d.name} nta manota iragira.`, `${d.name} has no reviews yet.`));
      for (const r of reviews) parts.push(`“${r.comment}” (${r.rating}/5)`);
      parts.push(tripsText(d, lang)); break;
    default: parts.push(head, ratingText(d, lang), d.description, entryText(d, lang), actsText(d, lang), thingsText(d, lang), tripsText(d, lang));
      if (d.tips.length) parts.push(L(lang, `Ibyo kumenya: ${d.tips.slice(0, 3).join('; ')}.`, `Good to know: ${d.tips.slice(0, 3).join('; ')}.`));
  }
  // Open trips to the destination as bookable cards (same costing as a normal search)
  const r = d.open_trips ? await discover({ raw: d.name, currency: 'RWF', location: d.name, origin: session.origin, lowCost: false, easy: false, challenging: false,
    wantsAvailability: false, action: 'search', social: [], detected: [] } as Intent, 3, false) : undefined;
  const recs = (r?.trips || []).filter((t) => norm(t.destination) === norm(d.name));
  return {
    message: parts.filter(Boolean).join(' '), dest_cards: [card(d)], recs,
    suggestions: [
      d.open_trips ? L(lang, `Ingendo zijya ${d.name}`, `Trips to ${d.name}`) : undefined,
      L(lang, `Nagera ate i ${d.name}?`, `How do I get to ${d.name}?`),
      i.destAspect !== 'activities' ? L(lang, `Nakora iki i ${d.name}?`, `What can I do at ${d.name}?`) : L(lang, `Mbwira ibya ${d.name}`, `Tell me about ${d.name}`),
      d.is_free ? L(lang, 'Ahandi hasurwa ku buntu', 'Other free destinations') : L(lang, 'Ahasurwa ku buntu', 'Free destinations'),
    ].filter(Boolean) as string[],
    // "What's included?" right after this refers to these trips
    context: { ...session, lastTripIds: recs.map((t) => t.id) } as Session,
  };
}

// ---------------------------------------------------------------------------------------------------
/** Everything about one trip, as shown in the chat. */
export interface TripDetailCard {
  id: number; title: string; link: string; destination: string; category_en: string; category_rw: string;
  trip_date: string; start_time: string; duration_hours: number | null; price: number;
  starting_location: string; meeting_point: string; organizer: string; verified: boolean;
  remaining_spaces: number; capacity: number; status: string; is_open: boolean; registration_deadline: string;
  included: string[]; excluded: string[]; transport_info: string | null; food_info: string | null; bring_items: string | null;
  difficulty: string | null; cancellation_policy: string | null; rating: number | null; review_count: number; description: string;
}
const DIFF: Record<string, [string, string]> = { easy: ['byoroshye', 'easy'], moderate: ['biringaniye', 'moderate'], challenging: ['bigoye', 'challenging'] };
const STATUS: Record<string, [string, string]> = {
  published: ['urugendo rurafunguye', 'open for registration'], fully_booked: ['rwuzuye', 'fully booked'], registration_closed: ['kwiyandikisha byarangiye', 'registration is closed'],
  cancelled: ['rwasubitswe', 'cancelled'], completed: ['rwarangiye', 'already took place'],
};
const deadlineText = (s: string) => s.replace('T', ' ');

/** Which trip the question is about: the one named, else the one just shown, else ask. */
async function resolveTrip(i: Intent, session: Session) {
  const ids = i.tripId ? [i.tripId] : session.lastTripIds || [];
  for (const id of ids.slice(0, 1)) {
    const row = await getTripRow(id);
    if (row && row.status !== 'draft' && row.organizer_status === 'approved') return { trip: shapeTrip(row), others: ids.length - 1 };
  }
  return undefined;
}
const ASK: Record<TripAspect, [string, string]> = {
  about: ['Mbwira ibya', 'Tell me about'], included: ['Ibirimo muri', 'What is included in'], meeting: ['Duhurira he ku', 'Where do we meet for'],
  bring: ['Nitwaza iki ku', 'What should I bring for'], difficulty: ['Biragoye gute', 'How hard is'], cancellation: ['Guhagarika', 'Cancellation policy for'],
  organizer: ['Ninde wateguye', 'Who organizes'], schedule: ['Bitangira ryari', 'What time does it start:'], spaces: ['Imyanya ingahe isigaye ku', 'How many spaces are left on'],
  food: ['Ibiryo ku', 'Is food included in'],
};

export async function tripReply(i: Intent, lang: Lang, session: Session) {
  const aspect = i.tripAspect || 'about';
  const found = await resolveTrip(i, session);
  if (!found) {
    // No trip in view: offer the upcoming open trips as one-tap questions
    const open = (await listPublicTrips({ limit: 4, sort: 'date', availableOnly: true })).items;
    const q = L(lang, 'Ni uruhe rugendo ushaka kumenya?', 'Which trip do you mean?');
    return { message: q, clarification: { question: q, options: open.map((t: any) => `${L(lang, ...ASK[aspect])} ${t.title}?`) }, context: session };
  }
  const t = found.trip;
  const cat = L(lang, t.category.name_rw, t.category.name_en);
  const parts: string[] = [];
  const status = STATUS[t.effective_status] ? L(lang, ...STATUS[t.effective_status]) : t.effective_status;
  const spaces = t.is_open ? L(lang, `Hasigaye imyanya ${t.remaining_spaces} kuri ${t.capacity}.`, `${t.remaining_spaces} of ${t.capacity} spaces left.`) : L(lang, `Uru rugendo ${status}.`, `This trip is ${status}.`);
  const inc = t.included_services as string[], exc = t.excluded_services as string[];
  switch (aspect) {
    case 'included':
      parts.push(inc.length ? L(lang, `Birimo: ${inc.join(', ')}.`, `Included: ${inc.join(', ')}.`) : L(lang, 'Uwateguye ntiyagaragaje ibirimo.', 'The organizer has not listed what is included.'));
      if (exc.length) parts.push(L(lang, `Ntibirimo: ${exc.join(', ')}.`, `Not included: ${exc.join(', ')}.`));
      if (t.transport_info) parts.push(L(lang, `Transport: ${t.transport_info}`, `Transport: ${t.transport_info}`));
      if (t.food_info) parts.push(L(lang, `Ibiryo: ${t.food_info}`, `Food: ${t.food_info}`));
      break;
    case 'food': parts.push(t.food_info ? L(lang, `Ibiryo: ${t.food_info}`, `Food: ${t.food_info}`) : L(lang, 'Uwateguye ntiyagaragaje iby’ibiryo.', 'The organizer has not said anything about food.')); break;
    case 'meeting': parts.push(L(lang, `Muzahurira ${t.meeting_point} (urugendo ruhagurukira i ${t.starting_location}) ${when(t.trip_date, lang)} saa ${t.start_time}.`,
      `Meet at ${t.meeting_point} (the trip leaves from ${t.starting_location}) on ${when(t.trip_date, lang)} at ${t.start_time}.`)); break;
    case 'bring': parts.push(t.bring_items ? L(lang, `Itwaze: ${t.bring_items}`, `Bring: ${t.bring_items}`) : L(lang, 'Uwateguye ntiyagaragaje ibyo kwitwaza.', 'The organizer has not listed what to bring.')); break;
    case 'difficulty': parts.push(t.difficulty ? L(lang, `Urwego: ${L(lang, ...(DIFF[t.difficulty] || [t.difficulty, t.difficulty]))}.`, `Difficulty: ${(DIFF[t.difficulty]?.[1]) || t.difficulty}.`) : L(lang, 'Urwego rw’ingorane ntirwagaragajwe.', 'The difficulty level is not given.'));
      if (t.duration_hours) parts.push(L(lang, `Bimara amasaha nka ${t.duration_hours}.`, `It lasts about ${t.duration_hours} hours.`)); break;
    case 'cancellation': parts.push(t.cancellation_policy ? L(lang, `Guhagarika: ${t.cancellation_policy}`, `Cancellation policy: ${t.cancellation_policy}`) : L(lang, 'Nta mategeko yo guhagarika yagaragajwe.', 'No cancellation policy is given.')); break;
    case 'organizer': parts.push(L(lang, `Rwateguwe na ${t.organizer.display_name}${t.organizer.verified ? ' (wemejwe)' : ''}.`, `Organized by ${t.organizer.display_name}${t.organizer.verified ? ' (verified organizer)' : ''}.`));
      if (t.avg_rating) parts.push(L(lang, `Amanota y’uru rugendo: ${t.avg_rating}/5 (${t.review_count}).`, `This trip is rated ${t.avg_rating}/5 (${t.review_count} reviews).`)); break;
    case 'schedule': parts.push(L(lang, `${when(t.trip_date, lang)} saa ${t.start_time}${t.duration_hours ? `, bimara amasaha nka ${t.duration_hours}` : ''}. Kwiyandikisha birangira ${deadlineText(t.registration_deadline)}.`,
      `${when(t.trip_date, lang)} at ${t.start_time}${t.duration_hours ? `, about ${t.duration_hours} hours` : ''}. Registration closes ${deadlineText(t.registration_deadline)}.`)); break;
    case 'spaces': parts.push(spaces); break;
    default:
      parts.push(L(lang, `${t.title} (${cat}) rujya ${t.destination.name} ${when(t.trip_date, lang)} saa ${t.start_time}, ruhagurukira i ${t.starting_location}.`,
        `${t.title} (${cat}) goes to ${t.destination.name} on ${when(t.trip_date, lang)} at ${t.start_time}, leaving from ${t.starting_location}.`));
      parts.push(L(lang, `Igiciro: ${t.price === 0 ? 'ubuntu' : rwf(t.price)} ku muntu.`, `Price: ${t.price === 0 ? 'free' : rwf(t.price)} per person.`));
      parts.push(L(lang, `Rwateguwe na ${t.organizer.display_name}.`, `Organized by ${t.organizer.display_name}.`));
      if (t.description) parts.push(t.description);
  }
  if (aspect !== 'spaces') parts.push(spaces);
  if (t.is_open && aspect !== 'about') parts.push(L(lang, 'Wiyandikisha ku rupapuro rw’urugendo.', 'You can register on the trip page.'));
  const detail: TripDetailCard = {
    id: t.id, title: t.title, link: `/trips/${t.id}`, destination: t.destination.name, category_en: t.category.name_en, category_rw: t.category.name_rw,
    trip_date: t.trip_date, start_time: t.start_time, duration_hours: t.duration_hours, price: t.price, starting_location: t.starting_location, meeting_point: t.meeting_point,
    organizer: t.organizer.display_name, verified: t.organizer.verified, remaining_spaces: t.remaining_spaces, capacity: t.capacity, status: t.effective_status, is_open: t.is_open,
    registration_deadline: t.registration_deadline, included: inc, excluded: exc, transport_info: t.transport_info, food_info: t.food_info, bring_items: t.bring_items,
    difficulty: t.difficulty, cancellation_policy: t.cancellation_policy, rating: t.avg_rating, review_count: t.review_count, description: t.description,
  };
  const next: TripAspect[] = (['included', 'meeting', 'bring', 'cancellation', 'difficulty'] as TripAspect[]).filter((a) => a !== aspect);
  const FOLLOW: Record<string, [string, string]> = { included: ['Harimo iki?', 'What’s included?'], meeting: ['Duhurira he?', 'Where do we meet?'],
    bring: ['Nitwaze iki?', 'What should I bring?'], cancellation: ['Nshobora guhagarika?', 'Cancellation policy?'], difficulty: ['Biragoye?', 'How hard is it?'] };
  return {
    message: parts.join(' '), trip_detail: detail,
    suggestions: next.slice(0, 3).map((a) => L(lang, ...FOLLOW[a])).concat(L(lang, `Ingendo zijya ${t.destination.name}`, `Trips to ${t.destination.name}`)),
    context: { ...session, lastTripIds: [t.id] } as Session,
  };
}
