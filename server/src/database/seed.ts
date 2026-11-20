// Demonstration data. Every seeded record is flagged is_demo=1 and marked "Demo" in titles/descriptions.
// Prices/dates below are INVENTED for demonstration and are NOT official tourism information.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, initSchema } from './db.js';
import { ensureAdmin } from './init.js';
import { env } from '../config/env.js';
import { addDays, todayStr, weekday } from '../lib/time.js';

await initSchema();
console.log('[seed]', await ensureAdmin());

/** Demo "Things to do" cards. Added whenever the table is empty, so databases seeded before this feature get them too. */
async function seedExperiences() {
  if ((await db.prepare('SELECT COUNT(*) c FROM experiences').get() as any).c > 0) return false;
  const id = async (sql: string, v: string) => ((await db.prepare(sql).get(v)) as any)?.id ?? null;
  const dest = (slug: string) => id('SELECT id FROM destinations WHERE slug=?', slug);
  const cat = (slug: string) => id('SELECT id FROM categories WHERE slug=?', slug);
  const org = (email: string) => id('SELECT o.id FROM organizers o JOIN users u ON u.id=o.user_id WHERE u.email=?', email);
  const org1 = await org('organizer1@demo.explore-rwanda.test'), org2 = await org('organizer2@demo.explore-rwanda.test');
  // [title_en, title_rw, location, destination slug, category slug, organizer, price from (RWF, invented), duration]
  const items: [string, string, string, string, string, number | null, number, string][] = [
    ['Milking cows with herders in Bigogwe', 'Gukama inka hamwe n’aborozi i Bigogwe', 'Bigogwe', 'ibere-rya-bigogwe', 'culture', org1, 10000, 'Half day'],
    ['Boating on Lake Kivu at sunset', 'Gutembera mu bwato ku Kivu izuba rirenga', 'Rubavu', 'lake-kivu', 'boating', org2, 15000, '2 hours'],
    ['Canopy walk in Nyungwe Forest', 'Kugenda hejuru y’ishyamba rya Nyungwe', 'Nyungwe', 'nyungwe-national-park', 'nature', null, 40000, '3 hours'],
    ['Game drive in Akagera National Park', 'Gusura inyamaswa muri Pariki y’Akagera', 'Akagera', 'akagera-national-park', 'wildlife', org2, 45000, 'Full day'],
    ['Cycling the Nyandungu wetland trails', 'Gutwara igare mu nzira za Nyandungu', 'Kigali', 'nyandungu-eco-park', 'cycling', org1, 5000, '2 hours'],
    ['Hiking the volcano foothills near Musanze', 'Gutembera ku misozi y’ibirunga hafi ya Musanze', 'Musanze', 'musanze-area', 'hiking', org1, 15000, 'Full day'],
  ];
  for (const [i, [en, rw, loc, d, c, o, price, dur]] of items.entries()) {
    await db.prepare(`INSERT INTO experiences (title_en,title_rw,location,destination_id,category_id,organizer_id,price_from,duration,sort_order,is_demo)
      VALUES (?,?,?,?,?,?,?,?,?,1)`).run(en, rw, loc, await dest(d), await cat(c), o, price, dur, i + 1);
  }
  return true;
}

/** Demo traveller reviews on the completed Bigogwe hike, and organizer recommendations of "Things to do" cards,
 *  so the cards' stars and ranking have something to show. Each part runs only when it has not been added yet. */
async function seedDemoExtras() {
  const one = async (sql: string, ...a: unknown[]) => (await db.prepare(sql).get(...a)) as any;
  const done = await one("SELECT id,destination_id FROM trips WHERE title='Completed Bigogwe Hike (Demo)'");
  if (done && !(await one('SELECT 1 x FROM reviews WHERE trip_id=?', done.id))) {
    const demoReviews: [string, number, string][] = [
      ['alice@demo.explore-rwanda.test', 5, 'Great views and a friendly guide. (Demo review)'],
      ['bosco@demo.explore-rwanda.test', 4, 'Well organized, a bit steep at the end. (Demo review)'],
      ['chantal@demo.explore-rwanda.test', 5, 'Loved it, would go again. (Demo review)'],
    ];
    for (const [email, rating, comment] of demoReviews) {
      const u = await one('SELECT id FROM users WHERE email=?', email); if (!u) continue;
      if (!(await one("SELECT 1 x FROM registrations WHERE trip_id=? AND user_id=? AND status='approved'", done.id, u.id)))
        await db.prepare("INSERT INTO registrations (trip_id,user_id,seats,status,is_demo) VALUES (?,?,1,'approved',1)").run(done.id, u.id);
      await db.prepare('INSERT OR IGNORE INTO reviews (trip_id,destination_id,user_id,rating,comment) VALUES (?,?,?,?,?)').run(done.id, done.destination_id, u.id, rating, comment);
    }
  }
  // Demo free destinations (public lakeshore and a hill walk): marked free, entry fee recorded as RWF 0
  if (!(await one('SELECT 1 x FROM destinations WHERE is_free=1'))) {
    for (const slug of ['lake-kivu', 'ibere-rya-bigogwe']) {
      const d = await one('SELECT id FROM destinations WHERE slug=? AND is_demo=1', slug); if (!d) continue;
      await db.prepare('UPDATE destinations SET is_free=1 WHERE id=?').run(d.id);
      await db.prepare("DELETE FROM cost_records WHERE destination_id=? AND trip_id IS NULL AND cost_type='entry_fee'").run(d.id);
      await db.prepare("INSERT INTO cost_records (destination_id,cost_type,label,amount,source_type,source_note) VALUES (?, 'entry_fee','Entry fee',0,'official','Free to visit (set by an administrator)')").run(d.id);
    }
  }
  // Starting ratings chosen by whoever added each demo card (3 recommended … 5 highly recommended)
  const starting: [string, number][] = [['Milking cows with herders in Bigogwe', 5], ['Boating on Lake Kivu at sunset', 4], ['Canopy walk in Nyungwe Forest', 5],
    ['Game drive in Akagera National Park', 4], ['Cycling the Nyandungu wetland trails', 3], ['Hiking the volcano foothills near Musanze', 4]];
  for (const [title, r] of starting) await db.prepare('UPDATE experiences SET initial_rating=? WHERE title_en=? AND is_demo=1 AND initial_rating IS NULL').run(r, title);
  if (!(await one('SELECT 1 x FROM experience_recommendations'))) {
    const org = async (email: string) => (await one('SELECT o.id FROM organizers o JOIN users u ON u.id=o.user_id WHERE u.email=?', email))?.id;
    const org1 = await org('organizer1@demo.explore-rwanda.test'), org2 = await org('organizer2@demo.explore-rwanda.test');
    const recs: [number | undefined, string][] = [
      [org2, 'Milking cows with herders in Bigogwe'], [org2, 'Hiking the volcano foothills near Musanze'], [org2, 'Canopy walk in Nyungwe Forest'],
      [org1, 'Boating on Lake Kivu at sunset'], [org1, 'Canopy walk in Nyungwe Forest'], [org1, 'Game drive in Akagera National Park'],
    ];
    for (const [o, title] of recs) {
      const e = await one('SELECT id,organizer_id FROM experiences WHERE title_en=?', title);
      if (o && e && e.organizer_id !== o) await db.prepare('INSERT OR IGNORE INTO experience_recommendations (experience_id,organizer_id) VALUES (?,?)').run(e.id, o);
    }
  }
}

if ((await db.prepare("SELECT COUNT(*) c FROM users WHERE is_demo=1").get() as any).c > 0) {
  console.log('[seed] Demo data already present - skipping. Run `npm run db:reset` first to start fresh.');
  if (await seedExperiences()) console.log('[seed] Added demo "Things to do" cards.');
  await seedDemoExtras();
  await db.close(); process.exit(0);
}

let demoPassword = env.demoPassword;
let generated = false;
if (!demoPassword || demoPassword.length < 8) { demoPassword = 'Demo' + crypto.randomBytes(5).toString('hex') + '1'; generated = true; }
const hash = bcrypt.hashSync(demoPassword, 10);

const today = todayStr();
const nextDow = (dow: number) => { const s = addDays(today, 1); return addDays(s, (dow - weekday(s) + 7) % 7); }; // strictly after today
const sat1 = nextDow(6), sun1 = nextDow(0), sat2 = addDays(sat1, 7), sun2 = addDays(sun1, 7);

const user = async (name: string, email: string, phone: string, role = 'traveler') =>
  Number((await db.prepare('INSERT INTO users (full_name,email,phone,password_hash,role,is_demo) VALUES (?,?,?,?,?,1)').run(name, email, phone, hash, role)).lastInsertRowid);

await db.transaction(async () => {
  // --- Users ---
  const org1User = await user('Demo Organizer One', 'organizer1@demo.explore-rwanda.test', '+250780000001', 'organizer');
  const org2User = await user('Demo Organizer Two', 'organizer2@demo.explore-rwanda.test', '+250780000002', 'organizer');
  const t1 = await user('Demo Traveler Alice', 'alice@demo.explore-rwanda.test', '+250780000011');
  const t2 = await user('Demo Traveler Bosco', 'bosco@demo.explore-rwanda.test', '+250780000012');
  const t3 = await user('Demo Traveler Chantal', 'chantal@demo.explore-rwanda.test', '+250780000013');
  const applicant = await user('Demo Applicant Diane', 'applicant@demo.explore-rwanda.test', '+250780000014');

  // --- Organizers (approved through demo applications) ---
  const mkOrg = async (uid: number, name: string, loc: string, email: string) => {
    const app = await db.prepare(`INSERT INTO organizer_applications (user_id,organizer_name,applicant_name,email,phone,experience,location,status,reviewed_at,is_demo)
      VALUES (?,?,?,?,?,?,?, 'approved', datetime('now'), 1)`).run(uid, name, name, email, '+250780000000', 'Demo application: organizes weekend group trips (demo text).', loc);
    return Number((await db.prepare('INSERT INTO organizers (user_id,application_id,display_name,location,contact_email,bio) VALUES (?,?,?,?,?,?)')
      .run(uid, app.lastInsertRowid, name, loc, email, 'Demo organizer profile - not a real company.')).lastInsertRowid);
  };
  const org1 = await mkOrg(org1User, 'Demo Hikers Rwanda', 'Kigali', 'organizer1@demo.explore-rwanda.test');
  const org2 = await mkOrg(org2User, 'Demo Lake & Wild Tours', 'Rubavu', 'organizer2@demo.explore-rwanda.test');
  await db.prepare(`INSERT INTO organizer_applications (user_id,organizer_name,applicant_name,email,phone,experience,location,supporting_info,status,is_demo)
    VALUES (?,?,?,?,?,?,?,?, 'pending', 1)`).run(applicant, 'Demo Green Trails Club', 'Demo Applicant Diane', 'applicant@demo.explore-rwanda.test', '+250780000014',
    'Demo application waiting for administrator review: we run monthly community walks around Kigali.', 'Kigali', 'Demo supporting information.');

  // --- Destinations (coordinates approximate, for map links/weather only) ---
  const cat = async (slug: string) => (await db.prepare('SELECT id FROM categories WHERE slug=?').get(slug) as any).id as number;
  const dest = async (name: string, slug: string, region: string, rw: string, en: string, lat: number, lng: number, cats: string[]) => {
    const id = Number((await db.prepare('INSERT INTO destinations (name,slug,region,description_rw,description_en,latitude,longitude,is_demo) VALUES (?,?,?,?,?,?,?,1)')
      .run(name, slug, region, rw, en, lat, lng)).lastInsertRowid);
    for (const c of cats) await db.prepare('INSERT INTO destination_categories VALUES (?,?)').run(id, await cat(c));
    // Official entry fees are NOT known to this demo: record that honestly instead of inventing a number.
    await db.prepare("INSERT INTO cost_records (destination_id,cost_type,label,amount,source_type,source_note) VALUES (?, 'entry_fee','Entry fee',NULL,'unknown','Not verified in this demo. Check the official operator before travelling.')").run(id);
    return id;
  };
  const bigogwe = await dest('Ibere rya Bigogwe', 'ibere-rya-bigogwe', 'Western Province (near Musanze)', 'Umusozi w’ubwiza ukunzwe n’abakunda gutembera n’amafoto. (Amakuru y’icyitegererezo.)', 'A scenic hill popular with hikers and photographers. (Demo description.)', -1.62, 29.45, ['hiking', 'nature']);
  const nyandungu = await dest('Nyandungu Eco-Park', 'nyandungu-eco-park', 'Kigali', 'Ubusitani bw’ibidukikije bwo mu mujyi wa Kigali. (Amakuru y’icyitegererezo.)', 'An urban eco-park in Kigali. (Demo description.)', -1.97, 30.15, ['nature', 'cycling']);
  const akagera = await dest('Akagera National Park', 'akagera-national-park', 'Eastern Province', 'Pariki y’igihugu y’inyamaswa mu Burasirazuba. (Amakuru y’icyitegererezo.)', 'A national park in the east known for wildlife. (Demo description.)', -1.88, 30.73, ['wildlife', 'nature', 'boating']);
  const nyungwe = await dest('Nyungwe National Park', 'nyungwe-national-park', 'Southwest Rwanda', 'Ishyamba rya Nyungwe ririmo urusobe rw’ibinyabuzima. (Amakuru y’icyitegererezo.)', 'A montane rainforest national park. (Demo description.)', -2.48, 29.2, ['hiking', 'nature', 'waterfall']);
  const kivu = await dest('Lake Kivu', 'lake-kivu', 'Western Province', 'Ikiyaga cya Kivu: koga, ubwato n’inkombe nziza. (Amakuru y’icyitegererezo.)', 'Lake Kivu: swimming, boating and lakeshore. (Demo description.)', -1.7, 29.26, ['swimming', 'boating', 'nature']);
  const musanze = await dest('Musanze Area', 'musanze-area', 'Northern Province (Musanze)', 'Akarere ka Musanze n’ibikorwa byo mu misozi y’ibirunga. (Amakuru y’icyitegererezo.)', 'The Musanze area and volcano-region experiences. (Demo description.)', -1.5, 29.63, ['hiking', 'nature', 'culture']);

  // --- Trips ---
  const trip = async (o: { org: number; dest: number; cat: string; title: string; desc: string; from: string; meet: string; date: string; time?: string; price: number; cap: number;
    deadline?: string; status?: string; diff?: string; inc?: string[]; exc?: string[] }) => {
    const time = o.time || '07:00';
    const [hh, mm] = time.split(':').map(Number);
    const deadline = o.deadline || `${o.date}T${String(Math.max(0, hh - 1)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; // closes 1h before departure
    return Number((await db.prepare(`INSERT INTO trips (organizer_id,destination_id,category_id,title,description,starting_location,meeting_point,trip_date,start_time,duration_hours,
      price,included_services,excluded_services,transport_info,food_info,bring_items,difficulty,capacity,registration_deadline,cancellation_policy,status,is_demo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(
      o.org, o.dest, await cat(o.cat), o.title, o.desc + ' (Demo trip: invented details for demonstration.)', o.from, o.meet, o.date, time, 6, o.price,
      JSON.stringify(o.inc || ['Guide', 'Group coordination']), JSON.stringify(o.exc || ['Personal snacks']),
      'Shared minibus from the meeting point (demo).', 'Bring your own lunch (demo).', 'Water, hat, sturdy shoes, rain jacket.',
      o.diff || 'easy', o.cap, deadline, 'Cancel at least 24 hours before departure (demo policy).', o.status || 'published')).lastInsertRowid);
  };
  const tBig = await trip({ org: org1, dest: bigogwe, cat: 'hiking', title: 'Bigogwe Hiking Experience (Demo)', desc: 'A guided group hike to the hill.', from: 'Kigali', meet: 'Nyabugogo Bus Park', date: sun1, price: 8000, cap: 20, diff: 'moderate' });
  const tNyan = await trip({ org: org1, dest: nyandungu, cat: 'nature', title: 'Nyandungu Nature Walk (Demo)', desc: 'A relaxed walk around the eco-park wetlands.', from: 'Kigali', meet: 'Nyandungu Eco-Park main gate', date: sun1, time: '08:00', price: 3000, cap: 25 });
  const tSwim = await trip({ org: org2, dest: kivu, cat: 'swimming', title: 'Lake Kivu Swim & Beach Day (Demo)', desc: 'A day of swimming and relaxing on the lakeshore.', from: 'Kigali', meet: 'Kigali Convention Centre roundabout', date: sat1, price: 12000, cap: 15 });
  const tMus = await trip({ org: org1, dest: musanze, cat: 'hiking', title: 'Musanze Foothills Hike (Demo)', desc: 'A day hike on the foothills near Musanze town.', from: 'Kigali', meet: 'Musanze town bus station', date: sat1, price: 15000, cap: 12, diff: 'challenging' });
  const tAk = await trip({ org: org2, dest: akagera, cat: 'wildlife', title: 'Akagera Day Safari (Demo)', desc: 'A group day trip to look for wildlife.', from: 'Kigali', meet: 'Remera Giporoso', date: sat2, time: '05:30', price: 45000, cap: 10, exc: ['Park entry fee (check official operator)'] });
  const tNyu = await trip({ org: org1, dest: nyungwe, cat: 'nature', title: 'Nyungwe Forest Nature Weekend (Demo)', desc: 'A weekend nature trip in the forest region.', from: 'Kigali', meet: 'Nyabugogo Bus Park', date: sun2, price: 30000, cap: 8, diff: 'moderate' });
  const tBoat = await trip({ org: org2, dest: kivu, cat: 'boating', title: 'Lake Kivu Boat Trip (Demo)', desc: 'A scenic group boat ride on the lake.', from: 'Rubavu', meet: 'Rubavu lakeside', date: sun2, price: 20000, cap: 16 });
  const tFull = await trip({ org: org1, dest: nyandungu, cat: 'nature', title: 'Kigali Sunset Walk - Fully Booked (Demo)', desc: 'Small group evening walk. Seeded as fully booked.', from: 'Kigali', meet: 'Nyandungu Eco-Park main gate', date: sat1, time: '16:00', price: 2000, cap: 2 });
  await trip({ org: org1, dest: bigogwe, cat: 'hiking', title: 'Draft Hike - Not Published (Demo)', desc: 'This trip is a draft and must never appear publicly.', from: 'Kigali', meet: 'Nyabugogo', date: sat2, price: 5000, cap: 10, status: 'draft' });
  await trip({ org: org2, dest: kivu, cat: 'swimming', title: 'Cancelled Swim (Demo)', desc: 'Seeded as cancelled.', from: 'Kigali', meet: 'Kigali', date: sun1, price: 6000, cap: 10, status: 'cancelled' });
  await trip({ org: org1, dest: musanze, cat: 'hiking', title: 'Deadline Passed Hike (Demo)', desc: 'Registration deadline already passed.', from: 'Kigali', meet: 'Nyabugogo', date: sun1, time: '09:00', price: 4000, cap: 10, deadline: `${addDays(today, -1)}T12:00` });
  const tDone = await trip({ org: org1, dest: bigogwe, cat: 'hiking', title: 'Completed Bigogwe Hike (Demo)', desc: 'A past trip for demonstrating reviews.', from: 'Kigali', meet: 'Nyabugogo', date: addDays(today, -6), price: 7000, cap: 15, deadline: `${addDays(today, -7)}T18:00`, status: 'completed' });

  // Package prices as organizer-provided cost records
  for (const t of await db.prepare('SELECT id,price FROM trips').all())
    await db.prepare("INSERT INTO cost_records (trip_id,cost_type,label,amount,source_type,source_note) VALUES (?, 'package','Trip price',?,'organizer','Set by the organizer (demo)')").run(t.id, t.price);
  await db.prepare("INSERT INTO cost_records (trip_id,cost_type,label,amount,source_type,source_note) VALUES (?, 'food','Lunch',3000,'community','Community-reported estimate (demo)')").run(tBig);
  await db.prepare("INSERT INTO cost_records (trip_id,cost_type,label,amount,source_type,source_note) VALUES (?, 'transport','Return minibus',NULL,'unknown','Organizer has not provided a transport cost')").run(tMus);

  // --- Registrations ---
  const reg = async (trip: number, uid: number, status: string, seats = 1) =>
    await db.prepare('INSERT INTO registrations (trip_id,user_id,seats,status,is_demo) VALUES (?,?,?,?,1)').run(trip, uid, seats, status);
  await reg(tBig, t1, 'approved', 2); await reg(tBig, t2, 'pending'); await reg(tSwim, t1, 'pending', 2); await reg(tNyan, t3, 'approved');
  await reg(tFull, t2, 'approved'); await reg(tFull, t3, 'approved'); await reg(tDone, t1, 'approved');

  await db.prepare("INSERT INTO announcements (title_rw,title_en,body_rw,body_en) VALUES (?,?,?,?)")
    .run('Ikaze kuri Explore Rwanda', 'Welcome to Explore Rwanda', 'Aya ni amakuru y’icyitegererezo yo kwerekana urubuga.', 'This platform currently shows demonstration data.');
});

await seedExperiences();
await seedDemoExtras();
console.log('\n[seed] Demo data created (all flagged is_demo).');
console.log('  Demo organizers : organizer1@demo.explore-rwanda.test , organizer2@demo.explore-rwanda.test');
console.log('  Demo travelers  : alice@ / bosco@ / chantal@demo.explore-rwanda.test');
console.log('  Pending applicant: applicant@demo.explore-rwanda.test (approve this in the admin dashboard)');
console.log(generated ? `  Demo password   : ${demoPassword}   (randomly generated - shown once; set DEMO_PASSWORD in .env to choose your own)`
  : '  Demo password   : the value of DEMO_PASSWORD in your .env');
await db.close();
