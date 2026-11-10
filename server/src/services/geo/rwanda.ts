// Built-in map of Rwanda: towns, Kigali neighbourhoods and visitor sites with coordinates and the
// names people actually use (old prefecture names, Kinyarwanda spellings). Pure data + pure functions,
// so the assistant can tell which starting point is closest to a destination and estimate road distance.
// Same normalisation as the language parser (kept local to avoid an import cycle).
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`´']/g, ' ');

export interface Place {
  name: string;          // display name
  lat: number; lng: number;
  kind: 'city' | 'town' | 'area' | 'site';
  district: string;
  province: 'Kigali' | 'Northern' | 'Southern' | 'Eastern' | 'Western';
  aliases?: string[];
}

export const PLACES: Place[] = [
  // ---- Kigali City
  { name: 'Kigali', lat: -1.9441, lng: 30.0619, kind: 'city', district: 'Nyarugenge', province: 'Kigali', aliases: ['kigali city', 'umujyi wa kigali', 'nyarugenge', 'gasabo', 'kicukiro', 'nyabugogo', 'downtown kigali', 'kigali town'] },
  { name: 'Remera', lat: -1.9536, lng: 30.1137, kind: 'area', district: 'Gasabo', province: 'Kigali' },
  { name: 'Kimironko', lat: -1.9497, lng: 30.1263, kind: 'area', district: 'Gasabo', province: 'Kigali' },
  { name: 'Kacyiru', lat: -1.9355, lng: 30.0866, kind: 'area', district: 'Gasabo', province: 'Kigali' },
  { name: 'Nyamirambo', lat: -1.9786, lng: 30.0447, kind: 'area', district: 'Nyarugenge', province: 'Kigali' },
  { name: 'Kanombe', lat: -1.9686, lng: 30.1395, kind: 'area', district: 'Kicukiro', province: 'Kigali' },
  { name: 'Nyandungu Eco-Park', lat: -1.9500, lng: 30.1450, kind: 'site', district: 'Gasabo', province: 'Kigali', aliases: ['nyandungu', 'nyandungu eco park', 'nyandungu urban wetland'] },
  { name: 'Mount Kigali', lat: -1.9900, lng: 30.0300, kind: 'site', district: 'Nyarugenge', province: 'Kigali', aliases: ['umusozi wa kigali'] },
  { name: 'Mount Jali', lat: -1.8950, lng: 30.0700, kind: 'site', district: 'Gasabo', province: 'Kigali', aliases: ['jali'] },
  // ---- Northern Province
  { name: 'Musanze', lat: -1.4996, lng: 29.6349, kind: 'town', district: 'Musanze', province: 'Northern', aliases: ['ruhengeri'] },
  { name: 'Kinigi', lat: -1.4306, lng: 29.5928, kind: 'area', district: 'Musanze', province: 'Northern' },
  { name: 'Volcanoes National Park', lat: -1.4300, lng: 29.5800, kind: 'site', district: 'Musanze', province: 'Northern', aliases: ['volcanoes', 'volcanoes park', 'pariki y ibirunga', 'ibirunga', 'kalisimbi', 'karisimbi', 'bisoke', 'sabyinyo'] },
  { name: 'Musanze Caves', lat: -1.5000, lng: 29.6200, kind: 'site', district: 'Musanze', province: 'Northern', aliases: ['ubuvumo bwa musanze'] },
  { name: 'Buhanga Eco-Park', lat: -1.4870, lng: 29.6150, kind: 'site', district: 'Musanze', province: 'Northern', aliases: ['buhanga'] },
  { name: 'Twin Lakes Burera & Ruhondo', lat: -1.4800, lng: 29.7400, kind: 'site', district: 'Burera', province: 'Northern', aliases: ['burera', 'ruhondo', 'twin lakes'] },
  { name: 'Gakenke', lat: -1.6900, lng: 29.7860, kind: 'town', district: 'Gakenke', province: 'Northern' },
  { name: 'Gicumbi', lat: -1.5760, lng: 30.0670, kind: 'town', district: 'Gicumbi', province: 'Northern', aliases: ['byumba'] },
  { name: 'Rulindo', lat: -1.7314, lng: 30.0017, kind: 'town', district: 'Rulindo', province: 'Northern' },
  // ---- Western Province
  { name: 'Rubavu', lat: -1.6792, lng: 29.2597, kind: 'town', district: 'Rubavu', province: 'Western', aliases: ['gisenyi'] },
  { name: 'Lake Kivu', lat: -1.7028, lng: 29.2564, kind: 'site', district: 'Rubavu', province: 'Western', aliases: ['kivu', 'ikiyaga cya kivu'] },
  { name: 'Bigogwe', lat: -1.6329, lng: 29.4296, kind: 'area', district: 'Nyabihu', province: 'Western' },
  { name: 'Nyabihu', lat: -1.6136, lng: 29.5300, kind: 'town', district: 'Nyabihu', province: 'Western', aliases: ['mukamira'] },
  { name: 'Gishwati-Mukura National Park', lat: -1.8200, lng: 29.3800, kind: 'site', district: 'Rutsiro', province: 'Western', aliases: ['gishwati', 'mukura'] },
  { name: 'Rutsiro', lat: -1.9400, lng: 29.3000, kind: 'town', district: 'Rutsiro', province: 'Western' },
  { name: 'Ngororero', lat: -1.8650, lng: 29.6250, kind: 'town', district: 'Ngororero', province: 'Western' },
  { name: 'Karongi', lat: -2.0601, lng: 29.3480, kind: 'town', district: 'Karongi', province: 'Western', aliases: ['kibuye'] },
  { name: 'Nyamasheke', lat: -2.3300, lng: 29.0900, kind: 'town', district: 'Nyamasheke', province: 'Western', aliases: ['kagano'] },
  { name: 'Gisakura', lat: -2.4626, lng: 29.0953, kind: 'area', district: 'Nyamasheke', province: 'Western' },
  { name: 'Rusizi', lat: -2.4846, lng: 28.9075, kind: 'town', district: 'Rusizi', province: 'Western', aliases: ['cyangugu', 'kamembe'] },
  // ---- Southern Province
  { name: 'Muhanga', lat: -2.0845, lng: 29.7564, kind: 'town', district: 'Muhanga', province: 'Southern', aliases: ['gitarama'] },
  { name: 'Kamonyi', lat: -2.0072, lng: 29.9028, kind: 'town', district: 'Kamonyi', province: 'Southern' },
  { name: 'Ruhango', lat: -2.2290, lng: 29.7790, kind: 'town', district: 'Ruhango', province: 'Southern' },
  { name: 'Nyanza', lat: -2.3517, lng: 29.7509, kind: 'town', district: 'Nyanza', province: 'Southern' },
  { name: 'King’s Palace Museum', lat: -2.3550, lng: 29.7470, kind: 'site', district: 'Nyanza', province: 'Southern', aliases: ['kings palace', 'king s palace', 'rukari', 'ingoro y umwami'] },
  { name: 'Huye', lat: -2.5967, lng: 29.7394, kind: 'town', district: 'Huye', province: 'Southern', aliases: ['butare'] },
  { name: 'Ethnographic Museum', lat: -2.5850, lng: 29.7480, kind: 'site', district: 'Huye', province: 'Southern', aliases: ['ethnographic museum', 'ingoro ndangamurage'] },
  { name: 'Gisagara', lat: -2.6160, lng: 29.8350, kind: 'town', district: 'Gisagara', province: 'Southern' },
  { name: 'Nyamagabe', lat: -2.4790, lng: 29.5650, kind: 'town', district: 'Nyamagabe', province: 'Southern', aliases: ['gikongoro'] },
  { name: 'Nyaruguru', lat: -2.6383, lng: 29.5578, kind: 'town', district: 'Nyaruguru', province: 'Southern', aliases: ['kibeho'] },
  { name: 'Nyungwe National Park', lat: -2.4785, lng: 29.2000, kind: 'site', district: 'Nyamagabe', province: 'Southern', aliases: ['nyungwe', 'nyungwe forest', 'uwinka', 'pariki ya nyungwe'] },
  // ---- Eastern Province
  { name: 'Rwamagana', lat: -1.9487, lng: 30.4347, kind: 'town', district: 'Rwamagana', province: 'Eastern' },
  { name: 'Lake Muhazi', lat: -1.8800, lng: 30.3500, kind: 'site', district: 'Rwamagana', province: 'Eastern', aliases: ['muhazi'] },
  { name: 'Kayonza', lat: -1.8996, lng: 30.5087, kind: 'town', district: 'Kayonza', province: 'Eastern', aliases: ['mukarange'] },
  { name: 'Akagera National Park', lat: -1.8800, lng: 30.7000, kind: 'site', district: 'Kayonza', province: 'Eastern', aliases: ['akagera', 'pariki y akagera'] },
  { name: 'Ngoma', lat: -2.1597, lng: 30.5427, kind: 'town', district: 'Ngoma', province: 'Eastern', aliases: ['kibungo'] },
  { name: 'Kirehe', lat: -2.2655, lng: 30.7036, kind: 'town', district: 'Kirehe', province: 'Eastern', aliases: ['nyakarambi'] },
  { name: 'Rusumo Falls', lat: -2.3800, lng: 30.7830, kind: 'site', district: 'Kirehe', province: 'Eastern', aliases: ['rusumo'] },
  { name: 'Bugesera', lat: -2.1490, lng: 30.0930, kind: 'town', district: 'Bugesera', province: 'Eastern', aliases: ['nyamata'] },
  { name: 'Gatsibo', lat: -1.6000, lng: 30.4000, kind: 'town', district: 'Gatsibo', province: 'Eastern', aliases: ['kabarore'] },
  { name: 'Nyagatare', lat: -1.2930, lng: 30.3270, kind: 'town', district: 'Nyagatare', province: 'Eastern' },
];

/** Every searchable name (normalized) -> place. Longer names first, so "lake kivu" wins over "kivu". */
const keyOf = (s: string) => norm(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const INDEX: { key: string; place: Place }[] = PLACES.flatMap((p) => [p.name, ...(p.aliases || [])].map((a) => ({ key: keyOf(a), place: p })))
  .sort((a, b) => b.key.length - a.key.length);

/** The place a name refers to (exact name or alias, or a known name contained in it: "Nyungwe Forest Trail"). */
export function findPlace(name?: string | null): Place | undefined {
  if (!name) return undefined;
  const k = keyOf(name);
  if (!k) return undefined;
  return INDEX.find((e) => e.key === k)?.place
    ?? INDEX.find((e) => e.key.length >= 4 && new RegExp(`(^| )${e.key}( |$)`).test(k))?.place;
}

/** All names the language parser should recognise as Rwandan places (alias -> canonical display name). */
export function placeTerms(): { term: string; canonical: string }[] {
  return INDEX.map((e) => ({ term: e.key, canonical: e.place.name }));
}

export interface Point { lat: number; lng: number }
const R = 6371;
/** Straight-line distance in km. */
export function airKm(a: Point, b: Point) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Rwanda is hilly: roads are about a third longer than the straight line. */
export const ROAD_FACTOR = 1.35;
export const roadKm = (a: Point, b: Point) => Math.round(airKm(a, b) * ROAD_FACTOR);

/** Public transport (bus) fare per passenger-km in RWF, close to the regulated inter-city tariff. */
export const FARE_PER_KM = 22;
/** Shortest ride in town (moto/bus) used as a floor for very short distances. */
export const MIN_FARE = 300;
/** One-way public transport estimate for a road distance, rounded up to RWF 100. */
export const fareForKm = (km: number) => Math.max(MIN_FARE, Math.ceil((km * FARE_PER_KM) / 100) * 100);

/** Coordinates of a destination record: its own, else the built-in map (by name, then by region). */
export function locate(d: { name?: string | null; region?: string | null; latitude?: number | null; longitude?: number | null }): Point | undefined {
  if (d.latitude != null && d.longitude != null) return { lat: d.latitude, lng: d.longitude };
  const p = findPlace(d.name) ?? findPlace(d.region);
  return p ? { lat: p.lat, lng: p.lng } : undefined;
}

/** Points sorted by road distance from `from`. */
export function byDistance<T extends { point?: Point }>(from: Point, items: T[]): (T & { km: number })[] {
  return items.filter((i) => i.point).map((i) => ({ ...i, km: roadKm(from, i.point!) })).sort((a, b) => a.km - b.km);
}
