import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, T, closeServer, db, rows, setFixedNow, writeReport } from './harness.js';
import { extractBudget, extractDate, extractPeople } from '../services/ai/nlp.js';

// Pin "now" to Wednesday 2026-11-04 12:00 Kigali so date logic is deterministic.
setFixedNow(new Date('2026-11-04T10:00:00Z'));
const PW = 'Passw0rdTest';
const admin = new Client(), org1 = new Client(), org2 = new Client(), alice = new Client(), bob = new Client(), anon = new Client(), applicant = new Client();
const S: Record<string, any> = {};
const catId = (slug: string) => (db.prepare('SELECT id FROM categories WHERE slug=?').get(slug) as any).id as number;

const tripBody = (o: Record<string, any> = {}) => ({
  title: 'Test Trip', description: 'A test trip description for the platform.', destination_id: S.dBig, category_id: catId('hiking'),
  starting_location: 'Kigali', meeting_point: 'Nyabugogo', trip_date: '2026-11-07', start_time: '07:00', duration_hours: 5,
  price: 8000, included_services: ['Guide'], excluded_services: ['Lunch'], difficulty: 'easy', capacity: 10,
  registration_deadline: '2026-11-06T18:00', status: 'published', ...o,
});
const mk = async (c: Client, o: Record<string, any> = {}) => {
  const r = await c.post('/trips', tripBody(o));
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json.trip.id as number;
};
const reg = async (c: Client, email: string) => { const r = await c.post('/auth/register', { full_name: 'T ' + email, email, phone: '0788123456', password: PW }); assert.equal(r.status, 201); return r.json.user.id as number; };

after(() => {
  writeReport(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/TEST_REPORT.md'));
  closeServer();
  setTimeout(() => process.exit(process.exitCode ?? 0), 50).unref();
});

// ============================================================ AUTH
test('authentication', async () => {
  await T('AUTH-01', 'Traveler registers with name, email, phone, password', 'HTTP 201, role=traveler, no password hash in response', async () => {
    const r = await alice.post('/auth/register', { full_name: 'Alice Test', email: 'alice@test.local', phone: '0788111222', password: PW });
    assert.equal(r.status, 201); assert.equal(r.json.user.role, 'traveler');
    assert.ok(!JSON.stringify(r.json).includes('password'));
    S.aliceId = r.json.user.id;
  });
  await T('AUTH-02', 'Duplicate email is rejected', 'HTTP 409 email_taken', async () => {
    const r = await new Client().post('/auth/register', { full_name: 'Dup', email: 'ALICE@test.local', password: PW });
    assert.equal(r.status, 409); assert.equal(r.json.error, 'email_taken');
  }, 'Case-insensitive');
  await T('AUTH-03', 'Weak password (no digit) is rejected by validation', 'HTTP 400 validation_error', async () => {
    const r = await new Client().post('/auth/register', { full_name: 'Weak', email: 'weak@test.local', password: 'onlyletters' });
    assert.equal(r.status, 400);
  });
  await T('AUTH-04', 'Registration cannot self-assign administrator or organizer role', 'Account is created as traveler although role=admin was sent', async () => {
    const c = new Client();
    const r = await c.post('/auth/register', { full_name: 'Sneaky', email: 'sneaky@test.local', password: PW, role: 'admin' });
    assert.equal(r.status, 201); assert.equal(r.json.user.role, 'traveler');
    const a = await c.get('/admin/stats'); assert.equal(a.status, 403);
  });
  await T('AUTH-05', 'Login with valid credentials sets a session; /auth/me returns the user', 'HTTP 200 and me.email matches', async () => {
    const c = new Client();
    const r = await c.post('/auth/login', { email: 'alice@test.local', password: PW }); assert.equal(r.status, 200);
    const me = await c.get('/auth/me'); assert.equal(me.json.user.email, 'alice@test.local');
  });
  await T('AUTH-06', 'Invalid credentials are rejected', 'HTTP 401 invalid_credentials (same message for unknown email and wrong password)', async () => {
    const c = new Client();
    const a = await c.post('/auth/login', { email: 'alice@test.local', password: 'WrongPass123' });
    const b = await c.post('/auth/login', { email: 'nobody@test.local', password: 'WrongPass123' });
    assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(a.json.error, b.json.error);
  });
  await T('AUTH-07', 'Logout clears the session', 'After logout /auth/me returns user=null and protected route is 401', async () => {
    const c = new Client(); await c.post('/auth/login', { email: 'alice@test.local', password: PW });
    await c.post('/auth/logout'); const me = await c.get('/auth/me'); assert.equal(me.json.user, null);
    assert.equal((await c.get('/registrations/mine')).status, 401);
  });
  await T('AUTH-08', 'Protected routes reject anonymous visitors', 'HTTP 401 for traveler, organizer and admin endpoints', async () => {
    for (const u of ['/registrations/mine', '/saved', '/notifications', '/trips/manage/mine', '/admin/stats', '/organizers/1'])
      assert.equal((await anon.get(u)).status, 401, u);
  }, 'Includes organizer profile page (auth required by project rule)');
  await T('AUTH-09', 'Administrator can log in (seeded from environment variables)', 'HTTP 200 role=admin', async () => {
    const r = await admin.post('/auth/login', { email: 'admin@test.local', password: 'TestAdminPass123' });
    assert.equal(r.status, 200); assert.equal(r.json.user.role, 'admin');
  });
  await T('AUTH-10', 'Passwords are stored as bcrypt hashes', 'password_hash starts with $2 and differs from plaintext', async () => {
    const h = (db.prepare("SELECT password_hash h FROM users WHERE email='alice@test.local'").get() as any).h as string;
    assert.ok(h.startsWith('$2') && h !== PW);
  });
});

// ============================================================ ORGANIZER WORKFLOW + ADMIN
test('organizer application and approval', async () => {
  await T('ADM-01', 'Administrator creates destinations', 'HTTP 201 for each', async () => {
    const cats = [catId('hiking'), catId('nature')];
    const a = await admin.post('/admin/destinations', { name: 'Test Bigogwe', region: 'Western Province (near Musanze)', description_rw: 'Ibisobanuro', description_en: 'Description', latitude: -1.6, longitude: 29.4, is_published: true, category_ids: cats });
    const b = await admin.post('/admin/destinations', { name: 'Test Musanze Hills', region: 'Northern Province (Musanze)', description_rw: 'Ibisobanuro', description_en: 'Description', is_published: true, category_ids: cats });
    const c = await admin.post('/admin/destinations', { name: 'Test Lake Kivu', region: 'Western Province', description_rw: 'Ibisobanuro', description_en: 'Description', is_published: true, category_ids: [catId('swimming')] });
    assert.deepEqual([a.status, b.status, c.status], [201, 201, 201]);
    S.dBig = a.json.id; S.dMus = b.json.id; S.dKivu = c.json.id;
  });
  await T('ORG-01', 'Visitor submits an organizer application (creates traveler account + pending application)', 'HTTP 201 status=pending', async () => {
    const r = await applicant.post('/organizer-applications', { organizer_name: 'Test Trails Co', applicant_name: 'Olivia Org', email: 'olivia@test.local', phone: '0788333444', experience: 'We have organised community hikes for three years.', location: 'Kigali', password: PW });
    assert.equal(r.status, 201); assert.equal(r.json.status, 'pending'); S.app1 = r.json.id;
  });
  await T('ORG-02', 'Applicant cannot create trips before approval', 'HTTP 403', async () => {
    const r = await applicant.post('/trips', tripBody()); assert.equal(r.status, 403);
    assert.equal((await applicant.get('/trips/manage/mine')).status, 403);
  });
  await T('ORG-03', 'Duplicate pending application is rejected', 'HTTP 409 application_pending', async () => {
    const r = await applicant.post('/organizer-applications', { organizer_name: 'Another', applicant_name: 'Olivia Org', email: 'olivia@test.local', phone: '0788333444', experience: 'Second application attempt text here.', location: 'Kigali' });
    assert.equal(r.status, 409);
  });
  await T('ORG-04', 'Non-admins (traveler, applicant) cannot approve applications', 'HTTP 403 for each', async () => {
    assert.equal((await alice.post(`/admin/applications/${S.app1}/approve`)).status, 403);
    assert.equal((await applicant.post(`/admin/applications/${S.app1}/approve`)).status, 403);
    assert.equal((await anon.post(`/admin/applications/${S.app1}/approve`)).status, 401);
  }, 'Organizers cannot approve themselves');
  await T('ADM-02', 'Administrator approves the application', 'HTTP 200; user role becomes organizer; applicant notified', async () => {
    const r = await admin.post(`/admin/applications/${S.app1}/approve`); assert.equal(r.status, 200);
    const me = await applicant.get('/auth/me'); assert.equal(me.json.user.role, 'organizer'); assert.ok(me.json.user.organizer.id);
    S.org1Id = me.json.user.organizer.id;
    const n = await applicant.get('/notifications'); assert.ok(n.json.items.some((x: any) => x.type === 'application_approved'));
  });
  await T('ORG-05', 'Approved organizer logs in again and has organizer role', 'role=organizer', async () => {
    const r = await org1.post('/auth/login', { email: 'olivia@test.local', password: PW }); assert.equal(r.json.user.role, 'organizer');
  });
  await T('ADM-03', 'Administrator rejects a second application; applicant stays traveler', 'status=rejected, role=traveler', async () => {
    const c = new Client();
    const a = await c.post('/organizer-applications', { organizer_name: 'Rejected Co', applicant_name: 'Rita Rej', email: 'rita@test.local', phone: '0788555666', experience: 'Short but sufficient experience description.', location: 'Huye', password: PW });
    const r = await admin.post(`/admin/applications/${a.json.id}/reject`, { note: 'Insufficient detail' }); assert.equal(r.status, 200);
    const me = await c.get('/auth/me'); assert.equal(me.json.user.role, 'traveler'); assert.equal(me.json.user.application.status, 'rejected');
    assert.equal((await c.post('/trips', tripBody())).status, 403);
  });
  await T('ADM-04', 'Administrator adds an organizer account directly', 'HTTP 201; that organizer can log in', async () => {
    const r = await admin.post('/admin/organizers', { full_name: 'Second Organizer', email: 'org2@test.local', password: PW, display_name: 'Test Lake Tours' });
    assert.equal(r.status, 201);
    const l = await org2.post('/auth/login', { email: 'org2@test.local', password: PW }); assert.equal(l.json.user.role, 'organizer'); S.org2Id = l.json.user.organizer.id;
  });
});

// ============================================================ TRIP MANAGEMENT
test('trip management and ownership', async () => {
  await T('ORG-06', 'Approved organizer creates a trip', 'HTTP 201, published, price stored', async () => {
    S.tHike = await mk(org1, { title: 'Hike A', price: 8000 });
    const t = await anon.get(`/trips/${S.tHike}`); assert.equal(t.json.trip.price, 8000); assert.equal(t.json.trip.effective_status, 'published');
  });
  await T('ORG-07', 'Trip validation: deadline after trip start, past date, negative price, bad capacity', 'HTTP 400 each', async () => {
    assert.equal((await org1.post('/trips', tripBody({ registration_deadline: '2026-11-08T10:00' }))).status, 400);
    assert.equal((await org1.post('/trips', tripBody({ trip_date: '2026-10-01', registration_deadline: '2026-09-30T10:00' }))).status, 400);
    assert.equal((await org1.post('/trips', tripBody({ price: -5 }))).status, 400);
    assert.equal((await org1.post('/trips', tripBody({ capacity: 0 }))).status, 400);
  });
  await T('ORG-08', 'Organizer edits own trip; change persists', 'HTTP 200 and new title/price visible', async () => {
    const r = await org1.put(`/trips/${S.tHike}`, tripBody({ title: 'Hike A (edited)', price: 9000 })); assert.equal(r.status, 200);
    const t = await anon.get(`/trips/${S.tHike}`); assert.equal(t.json.trip.title, 'Hike A (edited)'); assert.equal(t.json.trip.price, 9000);
    await org1.put(`/trips/${S.tHike}`, tripBody({ title: 'Hike A', price: 8000 }));
  });
  await T('SEC-01', 'Organizer cannot edit, cancel, delete or list registrations of another organizer\'s trip', 'HTTP 403 for each', async () => {
    assert.equal((await org2.put(`/trips/${S.tHike}`, tripBody())).status, 403);
    assert.equal((await org2.post(`/trips/${S.tHike}/cancel`)).status, 403);
    assert.equal((await org2.del(`/trips/${S.tHike}`)).status, 403);
    assert.equal((await org2.get(`/trips/${S.tHike}/registrations`)).status, 403);
    assert.equal((await org2.post(`/trips/${S.tHike}/images`)).status, 403);
  });
  await T('SEC-02', 'Travelers cannot create or manage trips', 'HTTP 403', async () => {
    assert.equal((await alice.post('/trips', tripBody())).status, 403);
    assert.equal((await alice.put(`/trips/${S.tHike}`, tripBody())).status, 403);
  });
  await T('INT-01', 'Draft trip is not visible publicly and not listed', 'Public GET 404; absent from list; visible to owner', async () => {
    const id = await mk(org1, { title: 'Hidden draft', status: 'draft' });
    assert.equal((await anon.get(`/trips/${id}`)).status, 404);
    const list = await anon.get('/trips?limit=100'); assert.ok(!list.json.items.some((t: any) => t.id === id));
    assert.equal((await org1.get(`/trips/${id}`)).status, 200);
    S.tDraft = id;
  });
  await T('INT-02', 'Registration to a draft trip is refused', 'HTTP 404', async () => {
    assert.equal((await alice.post(`/trips/${S.tDraft}/register`, {})).status, 404);
  });
  await T('ORG-09', 'Publish and unpublish', 'draft -> published -> draft', async () => {
    assert.equal((await org1.post(`/trips/${S.tDraft}/publish`)).json.trip.status, 'published');
    assert.equal((await org1.post(`/trips/${S.tDraft}/unpublish`)).json.trip.status, 'draft');
  });
  await T('ADM-05', 'Administrator creates a trip on behalf of an organizer, and edits any trip', 'HTTP 201 / 200', async () => {
    const r = await admin.post('/trips', tripBody({ title: 'Admin-made trip', organizer_id: S.org2Id })); assert.equal(r.status, 201);
    assert.equal(r.json.trip.organizer.id, S.org2Id); S.tAdmin = r.json.trip.id;
    assert.equal((await admin.put(`/trips/${S.tAdmin}`, tripBody({ title: 'Admin-made trip v2', organizer_id: S.org2Id }))).status, 200);
  });
  await T('ADM-06', 'Destination cannot be deleted while trips use it; unused destination can', '409 destination_has_trips then 200', async () => {
    assert.equal((await admin.del(`/admin/destinations/${S.dBig}`)).status, 409);
    const d = await admin.post('/admin/destinations', { name: 'Temp', region: 'Xyz', description_rw: 'aaaaa', description_en: 'aaaaa', category_ids: [] });
    assert.equal((await admin.del(`/admin/destinations/${d.json.id}`)).status, 200);
  });
  await T('ADM-07', 'Administrator updates a destination', 'HTTP 200 and value persisted', async () => {
    assert.equal((await admin.put(`/admin/destinations/${S.dKivu}`, { name: 'Test Lake Kivu', region: 'Western Province', description_rw: 'Ibisobanuro bishya', description_en: 'New description', is_published: true, category_ids: [catId('swimming')] })).status, 200);
    const d = await anon.get(`/destinations/${S.dKivu}`); assert.equal(d.json.destination.description_en, 'New description');
  });
});

// ============================================================ REGISTRATION INTEGRITY
test('registration workflow and integrity', async () => {
  S.bobId = await reg(bob, 'bob@test.local');
  await T('TRV-01', 'Public visitor browses trips and destinations without login', 'HTTP 200 with data', async () => {
    const t = await anon.get('/trips'); const d = await anon.get('/destinations');
    assert.equal(t.status, 200); assert.ok(t.json.items.length >= 1); assert.equal(d.status, 200); assert.ok(d.json.items.length >= 3);
  });
  await T('TRV-02', 'Traveler registers for a trip; status is pending', 'HTTP 201 status=pending', async () => {
    const r = await alice.post(`/trips/${S.tHike}/register`, { seats: 1 }); assert.equal(r.status, 201); assert.equal(r.json.registration.status, 'pending'); S.regA = r.json.registration.id;
  });
  await T('TRV-03', 'Anonymous visitor must log in to register', 'HTTP 401', async () => { assert.equal((await anon.post(`/trips/${S.tHike}/register`, {})).status, 401); });
  await T('INT-03', 'Duplicate active registration is rejected', 'HTTP 409 duplicate_registration', async () => {
    const r = await alice.post(`/trips/${S.tHike}/register`, { seats: 1 }); assert.equal(r.status, 409); assert.equal(r.json.error, 'duplicate_registration');
  });
  await T('INT-04', 'Concurrent duplicate attempts by one user create exactly one registration', '1 x 201, 4 x 409', async () => {
    const c = new Client(); await c.post('/auth/login', { email: 'bob@test.local', password: PW });
    const res = await Promise.all(Array.from({ length: 5 }, () => c.post(`/trips/${S.tHike}/register`, { seats: 1 })));
    const ok = res.filter((r) => r.status === 201).length; assert.equal(ok, 1); assert.equal(res.filter((r) => r.status === 409).length, 4);
    return `${ok} created, ${res.length - ok} refused`;
  });
  await T('TRV-04', 'Traveler sees registration status in "my registrations"', 'status pending listed with trip title', async () => {
    const r = await alice.get('/registrations/mine'); const m = r.json.items.find((i: any) => i.id === S.regA);
    assert.equal(m.status, 'pending'); assert.equal(m.title, 'Hike A');
  });
  await T('SEC-03', 'Traveler cannot approve registrations (own or others)', 'HTTP 403', async () => {
    assert.equal((await alice.patch(`/registrations/${S.regA}/decision`, { decision: 'approved' })).status, 403);
  });
  await T('SEC-04', 'Other organizer cannot decide on registrations of this trip', 'HTTP 403', async () => {
    assert.equal((await org2.patch(`/registrations/${S.regA}/decision`, { decision: 'approved' })).status, 403);
  });
  await T('ORG-10', 'Owner organizer approves; traveler is notified; spaces decrease', 'status approved, remaining 9, notification registration_approved', async () => {
    assert.equal((await org1.patch(`/registrations/${S.regA}/decision`, { decision: 'approved' })).status, 200);
    const t = await anon.get(`/trips/${S.tHike}`); assert.equal(t.json.trip.remaining_spaces, 9);
    const n = await alice.get('/notifications'); assert.ok(n.json.items.some((x: any) => x.type === 'registration_approved'));
  });
  await T('ORG-11', 'Organizer rejects a request; traveler notified', 'status rejected', async () => {
    const regB = (db.prepare("SELECT id FROM registrations WHERE user_id=? AND trip_id=?").get(S.bobId, S.tHike) as any).id;
    assert.equal((await org1.patch(`/registrations/${regB}/decision`, { decision: 'rejected', note: 'Full group' })).status, 200);
    const mine = await bob.get('/registrations/mine'); assert.equal(mine.json.items[0].status, 'rejected');
    S.regB = regB;
  });
  await T('INT-05', 'Rejected traveler can submit a new request (only ACTIVE duplicates are blocked)', 'HTTP 201', async () => {
    assert.equal((await bob.post(`/trips/${S.tHike}/register`, { seats: 1 })).status, 201);
  });
  await T('INT-06', 'Requesting more seats than remaining is refused', 'HTTP 409 not_enough_spaces', async () => {
    const id = await mk(org1, { title: 'Tiny trip', capacity: 2 });
    const r = await alice.post(`/trips/${id}/register`, { seats: 3 }); assert.equal(r.status, 409); assert.equal(r.json.error, 'not_enough_spaces');
  });
  await T('INT-07', 'OVERBOOKING: 6 pending requests, capacity 2, all approved concurrently -> only 2 approved', 'approved seats == 2, others 409', async () => {
    const id = await mk(org1, { title: 'Race trip', capacity: 2 }); S.tRace = id;
    const regIds: number[] = [];
    for (let i = 0; i < 6; i++) {
      const c = new Client(); await reg(c, `race${i}@test.local`);
      const r = await c.post(`/trips/${id}/register`, { seats: 1 }); assert.equal(r.status, 201); regIds.push(r.json.registration.id);
    }
    const res = await Promise.all(regIds.map((rid) => org1.patch(`/registrations/${rid}/decision`, { decision: 'approved' })));
    const ok = res.filter((r) => r.status === 200).length;
    const approved = (db.prepare("SELECT COALESCE(SUM(seats),0) s FROM registrations WHERE trip_id=? AND status='approved'").get(id) as any).s;
    assert.equal(approved, 2); assert.equal(ok, 2); assert.ok(res.filter((r) => r.status === 409).length === 4);
    return `${ok} approvals succeeded, ${res.length - ok} refused; approved seats in DB = ${approved}`;
  });
  await T('INT-08', 'Fully booked trip refuses new registrations and is flagged', 'HTTP 409 fully_booked; effective_status fully_booked', async () => {
    const t = await anon.get(`/trips/${S.tRace}`); assert.equal(t.json.trip.effective_status, 'fully_booked'); assert.equal(t.json.trip.remaining_spaces, 0);
    const c = new Client(); await reg(c, 'late@test.local');
    const r = await c.post(`/trips/${S.tRace}/register`, { seats: 1 }); assert.equal(r.status, 409); assert.equal(r.json.error, 'fully_booked');
  });
  await T('INT-09', 'Many parallel registrations never exceed approved capacity (cap 3, 8 users register then organizer approves all in parallel)', 'approved <= 3', async () => {
    const id = await mk(org1, { title: 'Parallel', capacity: 3 });
    const ids: number[] = [];
    await Promise.all(Array.from({ length: 8 }, async (_, i) => { const c = new Client(); await reg(c, `par${i}@test.local`); const r = await c.post(`/trips/${id}/register`, { seats: 1 }); if (r.status === 201) ids.push(r.json.registration.id); }));
    await Promise.all(ids.map((rid) => org1.patch(`/registrations/${rid}/decision`, { decision: 'approved' })));
    const approved = (db.prepare("SELECT COALESCE(SUM(seats),0) s FROM registrations WHERE trip_id=? AND status='approved'").get(id) as any).s;
    assert.ok(approved <= 3 && approved === 3, `approved=${approved}`);
  });
  await T('INT-10', 'Registration after the deadline is refused', 'HTTP 409 deadline_passed', async () => {
    const id = await mk(org1, { title: 'Deadline soon', trip_date: '2026-11-06', registration_deadline: '2026-11-05T09:00' });
    setFixedNow(new Date('2026-11-05T09:30:00Z')); // 11:30 Kigali: after deadline
    const r = await alice.post(`/trips/${id}/register`, { seats: 1 });
    setFixedNow(new Date('2026-11-04T10:00:00Z'));
    assert.equal(r.status, 409); assert.equal(r.json.error, 'deadline_passed');
  });
  await T('INT-11', 'Registration for a cancelled trip is refused and participants are notified of the cancellation', '409 trip_cancelled; notification trip_cancelled', async () => {
    const id = await mk(org1, { title: 'To cancel' });
    const c = new Client(); await reg(c, 'canc@test.local'); await c.post(`/trips/${id}/register`, { seats: 1 });
    assert.equal((await org1.post(`/trips/${id}/cancel`)).status, 200);
    const r = await alice.post(`/trips/${id}/register`, { seats: 1 }); assert.equal(r.status, 409); assert.equal(r.json.error, 'trip_cancelled');
    assert.ok((await c.get('/notifications')).json.items.some((n: any) => n.type === 'trip_cancelled'));
    assert.equal((await org1.put(`/trips/${id}`, tripBody())).status, 409);
  });
  await T('INT-12', 'Important trip changes notify participants', 'notification trip_updated for a registered traveler', async () => {
    await org1.put(`/trips/${S.tHike}`, tripBody({ title: 'Hike A', meeting_point: 'Remera Giporoso' }));
    assert.ok((await alice.get('/notifications')).json.items.some((n: any) => n.type === 'trip_updated'));
  });
  await T('ORG-12', 'Capacity cannot be reduced below approved seats', 'HTTP 400 capacity_below_approved', async () => {
    const r = await org1.put(`/trips/${S.tRace}`, tripBody({ title: 'Race trip', capacity: 1 })); assert.equal(r.status, 400);
  });
  await T('ORG-13', 'Trip with active registrations cannot be deleted by organizer (must cancel)', 'HTTP 409 trip_has_registrations', async () => {
    assert.equal((await org1.del(`/trips/${S.tHike}`)).status, 409);
  });
  await T('ORG-14', 'Trip without registrations can be deleted by its owner', 'HTTP 200 then 404', async () => {
    const id = await mk(org1, { title: 'Delete me' });
    assert.equal((await org1.del(`/trips/${id}`)).status, 200); assert.equal((await anon.get(`/trips/${id}`)).status, 404);
  });
  await T('TRV-05', 'Traveler cancels own registration', 'status cancelled; another traveler cannot cancel it', async () => {
    const id = await mk(org1, { title: 'Cancelable' });
    const r = await alice.post(`/trips/${id}/register`, { seats: 1 });
    assert.equal((await bob.patch(`/registrations/${r.json.registration.id}/cancel`)).status, 404);
    assert.equal((await alice.patch(`/registrations/${r.json.registration.id}/cancel`)).status, 200);
    assert.equal((await alice.get('/registrations/mine')).json.items.find((i: any) => i.id === r.json.registration.id).status, 'cancelled');
  });
  await T('TRV-06', 'Save / unsave trips', 'saved list contains then no longer contains the trip', async () => {
    await alice.put(`/saved/${S.tHike}`); assert.ok((await alice.get('/saved')).json.items.some((t: any) => t.id === S.tHike));
    await alice.del(`/saved/${S.tHike}`); assert.ok(!(await alice.get('/saved')).json.items.some((t: any) => t.id === S.tHike));
  });
});

// ============================================================ REVIEWS
test('reviews', async () => {
  await T('TRV-07', 'Review refused before the trip took place, and for non-participants', 'HTTP 409 trip_not_completed / 403 not_participant', async () => {
    assert.equal((await alice.post(`/trips/${S.tHike}/reviews`, { rating: 5, comment: 'Great trip!' })).status, 409);
    assert.equal((await bob.post(`/trips/${S.tHike}/reviews`, { rating: 5, comment: 'Never went' })).status, 403);
  });
  await T('TRV-08', 'After the trip date, a confirmed participant can review once; non-participants still cannot', '201 then 409 already_reviewed; visible publicly', async () => {
    setFixedNow(new Date('2026-11-08T10:00:00Z'));
    const el = await alice.get('/reviews/eligible'); assert.ok(el.json.items.some((t: any) => t.trip_id === S.tHike));
    assert.equal((await alice.post(`/trips/${S.tHike}/reviews`, { rating: 4, comment: 'Lovely hike with a good group.' })).status, 201);
    assert.equal((await alice.post(`/trips/${S.tHike}/reviews`, { rating: 4, comment: 'Second review attempt' })).status, 409);
    assert.equal((await bob.post(`/trips/${S.tHike}/reviews`, { rating: 1, comment: 'I did not attend' })).status, 403);
    assert.equal((await anon.get(`/trips/${S.tHike}/reviews`)).json.items.length, 1);
    setFixedNow(new Date('2026-11-04T10:00:00Z'));
  });
  await T('ADM-08', 'Administrator moderates (hides) a review', 'Review disappears from public list', async () => {
    const list = await admin.get('/admin/reviews'); const id = list.json.items[0].id;
    assert.equal((await admin.patch(`/admin/reviews/${id}`, { status: 'hidden' })).status, 200);
    assert.equal((await anon.get(`/trips/${S.tHike}/reviews`)).json.items.length, 0);
  });
  await T('TRV-09', 'Completed trips are not shown as available', 'Past trip absent from public list', async () => {
    setFixedNow(new Date('2026-11-08T10:00:00Z'));
    const list = await anon.get('/trips?limit=100'); setFixedNow(new Date('2026-11-04T10:00:00Z'));
    assert.ok(!list.json.items.some((t: any) => t.id === S.tHike));
  });
});

// ============================================================ ADMIN
test('administrator controls', async () => {
  await T('ADM-09', 'Dashboard statistics reflect real data', 'users_total, trips_total, registrations_total > 0 and pending_applications is a number', async () => {
    const s = (await admin.get('/admin/stats')).json.stats;
    assert.ok(s.users_total > 5 && s.trips_total > 5 && s.registrations_total > 5); assert.equal(typeof s.pending_applications, 'number');
    const real = (db.prepare('SELECT COUNT(*) c FROM users').get() as any).c; assert.equal(s.users_total, real);
  });
  await T('SEC-05', 'Travelers and organizers cannot access admin endpoints', 'HTTP 403', async () => {
    for (const c of [alice, org1]) for (const u of ['/admin/stats', '/admin/users', '/admin/audit', '/admin/settings']) assert.equal((await c.get(u)).status, 403, u);
  });
  await T('ADM-10', 'User search / filter', 'Finds Alice by partial email; role filter works', async () => {
    const r = await admin.get('/admin/users?q=alice'); assert.ok(r.json.items.some((u: any) => u.email === 'alice@test.local'));
    const o = await admin.get('/admin/users?role=organizer'); assert.ok(o.json.items.every((u: any) => u.role === 'organizer') && o.json.items.length >= 2);
    assert.ok(!JSON.stringify(r.json).includes('password_hash'));
  });
  await T('ADM-11', 'Deactivated account cannot log in or use an existing session', 'login 401 account_disabled; old session 401', async () => {
    const c = new Client(); const id = await reg(c, 'victim@test.local');
    assert.equal((await admin.patch(`/admin/users/${id}/active`, { is_active: false })).status, 200);
    assert.equal((await c.get('/registrations/mine')).status, 401);
    const l = await new Client().post('/auth/login', { email: 'victim@test.local', password: PW }); assert.equal(l.status, 401); assert.equal(l.json.error, 'account_disabled');
  });
  await T('ADM-12', 'Administrator grants and revokes admin privilege; cannot modify self or remove last admin', 'grant 200; self 400; revoke 200; last admin protected', async () => {
    const id = (db.prepare("SELECT id FROM users WHERE email='bob@test.local'").get() as any).id;
    assert.equal((await admin.patch(`/admin/users/${id}/role`, { role: 'admin' })).status, 200);
    const b2 = new Client(); await b2.post('/auth/login', { email: 'bob@test.local', password: PW }); assert.equal((await b2.get('/admin/stats')).status, 200);
    const adminId = (db.prepare("SELECT id FROM users WHERE email='admin@test.local'").get() as any).id;
    assert.equal((await admin.patch(`/admin/users/${adminId}/role`, { role: 'traveler' })).status, 400);
    assert.equal((await admin.patch(`/admin/users/${id}/role`, { role: 'traveler' })).status, 200);
    assert.equal((await b2.get('/admin/stats')).status, 403);
    assert.equal((await admin.del(`/admin/users/${adminId}`)).status, 400);
  });
  await T('SEC-06', 'A non-admin cannot grant admin to themselves via the role endpoint', 'HTTP 403', async () => {
    assert.equal((await alice.patch(`/admin/users/${S.aliceId}/role`, { role: 'admin' })).status, 403);
  });
  await T('ADM-13', 'Suspending an organizer hides their trips, blocks trip creation and management', 'public list excludes trips; POST /trips 403', async () => {
    assert.equal((await admin.patch(`/admin/organizers/${S.org2Id}/status`, { status: 'suspended' })).status, 200);
    const list = await anon.get('/trips?limit=100'); assert.ok(!list.json.items.some((t: any) => t.organizer.id === S.org2Id));
    assert.equal((await org2.post('/trips', tripBody())).status, 403);
    assert.equal((await admin.patch(`/admin/organizers/${S.org2Id}/status`, { status: 'approved' })).status, 200);
    assert.equal((await org2.post('/trips', tripBody({ title: 'After reactivation' }))).status, 201);
  });
  await T('ADM-14', 'Administrator can cancel and force-delete a trip with registrations', 'cancel 200; force delete 200', async () => {
    assert.equal((await admin.post(`/trips/${S.tAdmin}/cancel`)).status, 200);
    const id = await mk(org1, { title: 'Force delete' }); await alice.post(`/trips/${id}/register`, { seats: 1 });
    assert.equal((await admin.del(`/trips/${id}`)).status, 409); assert.equal((await admin.del(`/trips/${id}?force=true`)).status, 200);
  });
  await T('ADM-15', 'Registration oversight: admin lists and searches all registrations', 'items include multiple organizers\' trips', async () => {
    const r = await admin.get('/registrations/manage?q=alice'); assert.ok(r.json.items.length >= 1);
    const o = await org1.get('/registrations/manage'); assert.ok(o.json.items.every((i: any) => i.organizer_name === 'Test Trails Co'));
  });
  await T('ADM-16', 'Audit log records privileged actions with actor', 'Contains organizer_approve, trip_create, user_deactivate, admin_grant', async () => {
    const acts = (db.prepare('SELECT DISTINCT action FROM audit_logs').all() as any[]).map((a) => a.action);
    for (const a of ['organizer_approve', 'organizer_reject', 'trip_create', 'user_deactivate', 'admin_grant', 'admin_revoke', 'destination_create', 'organizer_suspend', 'registration_approved']) assert.ok(acts.includes(a), a);
    const r = await admin.get('/admin/audit?page=1'); assert.ok(r.json.items[0].actor_email);
  });
  await T('ADM-17', 'Category and announcement management, settings update', 'HTTP 2xx and persisted', async () => {
    assert.equal((await admin.post('/admin/categories', { slug: 'camping', name_rw: 'Gukambika', name_en: 'Camping', is_active: true })).status, 201);
    assert.equal((await admin.post('/admin/announcements', { title_rw: 'Amakuru', title_en: 'News', body_rw: 'Ibisobanuro', body_en: 'Body', is_active: true })).status, 201);
    assert.equal((await anon.get('/announcements')).json.items.length, 1);
    assert.equal((await admin.put('/admin/settings', { contact_email: 'help@test.local' })).status, 200);
    assert.equal((await anon.get('/config')).json.contact_email, 'help@test.local');
  });
  await T('ADM-18', 'Support request: visitor submits, admin replies, signed-in author is notified', 'HTTP 201 / 200 / notification', async () => {
    const s = await alice.post('/support', { name: 'Alice', email: 'alice@test.local', subject: 'Question', message: 'How do I cancel a registration?' }); assert.equal(s.status, 201);
    assert.equal((await anon.post('/support', { name: 'Anon', email: 'anon@test.local', subject: 'Hello', message: 'A public message from a visitor.' })).status, 201);
    assert.equal((await admin.patch(`/admin/support/${s.json.id}`, { status: 'resolved', admin_reply: 'Use My registrations > Cancel.' })).status, 200);
    assert.ok((await alice.get('/notifications')).json.items.some((n: any) => n.type === 'support_updated'));
    assert.equal((await alice.get('/support/mine')).json.items[0].admin_reply, 'Use My registrations > Cancel.');
  });
  await T('ADM-19', 'Cost records: organizer-only source for organizers; unknown cost stored without amount', 'organizer 201 (organizer source), 403 (official source); admin 201', async () => {
    const ok = await org1.post('/costs', { trip_id: S.tHike, cost_type: 'food', label: 'Lunch', amount: 3000, source_type: 'organizer' }); assert.equal(ok.status, 201);
    assert.equal((await org1.post('/costs', { trip_id: S.tHike, cost_type: 'entry_fee', amount: 100, source_type: 'official' })).status, 403);
    assert.equal((await org2.post('/costs', { trip_id: S.tHike, cost_type: 'food', amount: 1, source_type: 'organizer' })).status, 403);
    assert.equal((await admin.post('/costs', { destination_id: S.dBig, cost_type: 'entry_fee', source_type: 'unknown', source_note: 'Not verified' })).status, 201);
    const t = await anon.get(`/trips/${S.tHike}`); assert.ok(t.json.trip.costs.some((c: any) => c.source_type === 'organizer' && c.cost_type === 'food'));
  });
});

// ============================================================ SECURITY
test('security', async () => {
  await T('SEC-07', 'SQL injection strings in search/filter/login do not break queries or leak data', 'No 500; users table intact', async () => {
    const evil = "' OR 1=1; DROP TABLE users; --";
    for (const u of [`/search?q=${encodeURIComponent(evil)}`, `/trips?q=${encodeURIComponent(evil)}`, `/destinations?q=${encodeURIComponent(evil)}`, `/search/suggest?q=${encodeURIComponent(evil)}`])
      assert.ok((await anon.get(u)).status < 500, u);
    assert.equal((await new Client().post('/auth/login', { email: "admin@test.local' OR '1'='1", password: evil })).status, 400);
    assert.ok((db.prepare('SELECT COUNT(*) c FROM users').get() as any).c > 5);
  });
  await T('SEC-08', 'Uploading a non-image disguised as PNG is rejected', 'HTTP 400 invalid_file_type', async () => {
    const f = new FormData(); f.append('image', new Blob(['<?php echo 1; ?> not an image'], { type: 'image/png' }), 'x.png');
    const r = await org1.req('POST', `/trips/${S.tHike}/images`, undefined, { form: f }); assert.equal(r.status, 400);
    const g = new FormData(); g.append('image', new Blob(['hello'], { type: 'text/plain' }), 'x.txt');
    assert.equal((await org1.req('POST', `/trips/${S.tHike}/images`, undefined, { form: g })).status, 400);
  });
  await T('SEC-09', 'A genuine PNG upload by the owner is accepted; by another organizer is refused', '201 then 403', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const mkForm = () => { const f = new FormData(); f.append('image', new Blob([png], { type: 'image/png' }), 'ok.png'); return f; };
    const r = await org1.req('POST', `/trips/${S.tHike}/images?cover=true`, undefined, { form: mkForm() }); assert.equal(r.status, 201);
    assert.ok(r.json.path.startsWith('/uploads/'));
    assert.equal((await org2.req('POST', `/trips/${S.tHike}/images`, undefined, { form: mkForm() })).status, 403);
  });
  await T('SEC-10', 'Errors do not leak internals; malformed JSON handled', 'HTTP 400/404 with short error code, no stack trace', async () => {
    const r = await fetch(`${(await import('./harness.js')).base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' });
    assert.equal(r.status, 400); const t = await r.text(); assert.ok(!t.includes('at ') && !t.includes('node_modules'));
    assert.equal((await anon.get('/nope')).status, 404);
  });
  await T('SEC-11', 'Rate limiting on login', 'HTTP 429 after the configured number of attempts', async () => {
    process.env.DISABLE_RATE_LIMIT = 'false';
    let got429 = false; const c = new Client();
    for (let i = 0; i < 40 && !got429; i++) { const r = await c.post('/auth/login', { email: 'ratelimit@test.local', password: 'x' + i }); if (r.status === 429) got429 = true; }
    process.env.DISABLE_RATE_LIMIT = 'true';
    assert.ok(got429);
  });
  await T('SEC-12', 'Private organizer data is not exposed on public trip listings', 'Public trip has organizer display_name+verified only', async () => {
    const t = (await anon.get(`/trips/${S.tHike}`)).json.trip; assert.deepEqual(Object.keys(t.organizer).sort(), ['display_name', 'id', 'verified']);
    assert.equal(t.approved_seats, undefined);
  });
  await T('ORG-15', 'Organizer profile page needs sign-in; signed-in traveler can view', '401 anonymous, 200 signed in, no 5xx', async () => {
    assert.equal((await anon.get(`/organizers/${S.org1Id}`)).status, 401); assert.equal((await alice.get(`/organizers/${S.org1Id}`)).status, 200);
  });
});

// ============================================================ AI / SEARCH
test('AI assistant and intelligent search', async () => {
  // Controlled dataset: wipe trips and rebuild a known catalogue (Wed 2026-11-04 is "today").
  db.exec('DELETE FROM registrations; DELETE FROM trips;');
  const sat = '2026-11-07', sun = '2026-11-08', nextSat = '2026-11-14';
  const dl = (d: string) => `${d}T05:00`;
  const ids: Record<string, number> = {};
  const add = async (key: string, o: Record<string, any>) => { ids[key] = await mk(org1, { registration_deadline: dl(o.trip_date), ...o }); };
  await add('hikeCheap', { title: 'Cheap Sat Hike', category_id: catId('hiking'), trip_date: sat, price: 8000 });
  await add('hikeDear', { title: 'Pricey Sat Hike', category_id: catId('hiking'), trip_date: sat, price: 15000 });
  await add('hikeNext', { title: 'Next Weekend Hike', category_id: catId('hiking'), trip_date: nextSat, price: 6000 });
  await add('swim', { title: 'Sunday Swim', category_id: catId('swimming'), destination_id: S.dKivu, trip_date: sun, price: 12000 });
  await add('nature', { title: 'Sunday Nature Walk', category_id: catId('nature'), destination_id: S.dMus, trip_date: sun, price: 3000, capacity: 2 });
  await add('draftHike', { title: 'Draft Hike', category_id: catId('hiking'), trip_date: sat, price: 1000, status: 'draft' });
  await add('cancelHike', { title: 'Cancelled Hike', category_id: catId('hiking'), trip_date: sat, price: 1000 });
  await org1.post(`/trips/${ids.cancelHike}/cancel`);
  await add('fullHike', { title: 'Full Hike', category_id: catId('hiking'), trip_date: sat, price: 1000, capacity: 1 });
  const c = new Client(); await reg(c, 'filler@test.local'); const fr = await c.post(`/trips/${ids.fullHike}/register`, { seats: 1 });
  await org1.patch(`/registrations/${fr.json.registration.id}/decision`, { decision: 'approved' });
  // nature trip: 1 of 2 seats taken
  const c2 = new Client(); await reg(c2, 'filler2@test.local'); const nr = await c2.post(`/trips/${ids.nature}/register`, { seats: 1 });
  await org1.patch(`/registrations/${nr.json.registration.id}/decision`, { decision: 'approved' });
  const ask = async (message: string, context?: any, lang: 'en' | 'rw' = 'en') => (await anon.post('/search/assistant', { message, lang, context })).json;
  const tids = (j: any) => j.trips.map((t: any) => t.id);

  await T('AI-01', '"I have RWF 10,000 this weekend. Where can I go hiking?"', 'Intent: hiking, 10000, weekend. Only Cheap Sat Hike returned', async () => {
    const j = await ask('I have RWF 10,000 this weekend. Where can I go hiking?');
    assert.equal(j.intent.category, 'hiking'); assert.equal(j.intent.budget, 10000); assert.equal(j.intent.date.dateFrom, sat); assert.equal(j.intent.date.dateTo, sun);
    assert.deepEqual(tids(j), [ids.hikeCheap]);
    return `hiking/10000/${j.intent.date.dateFrom}..${j.intent.date.dateTo}; results: ${j.trips.map((t: any) => t.title).join(', ')}`;
  });
  await T('AI-02', 'Never recommends draft, cancelled, fully booked, other-date trips; over-budget trip shown only as labelled alternative', 'Excluded ids absent from trips; Pricey Sat Hike in alternatives with over_budget_by=5000', async () => {
    const j = await ask('I have RWF 10,000 this weekend. Where can I go hiking?');
    for (const k of ['draftHike', 'cancelHike', 'fullHike', 'hikeNext', 'hikeDear']) assert.ok(!tids(j).includes(ids[k]), k);
    const alt = j.alternatives.find((t: any) => t.id === ids.hikeDear); assert.ok(alt && alt.alternative && alt.over_budget_by === 5000);
    assert.ok(!j.alternatives.some((t: any) => [ids.draftHike, ids.cancelHike, ids.fullHike, ids.hikeNext].includes(t.id)));
  });
  await T('AI-03', 'Recommendation contains real data and a working link', 'price/date/spaces equal DB values; link opens a 200 trip page', async () => {
    const j = await ask('Hiking under 10k this weekend'); const t = j.trips[0];
    const row = db.prepare('SELECT price,trip_date,capacity FROM trips WHERE id=?').get(t.id) as any;
    assert.equal(t.price, row.price); assert.equal(t.trip_date, row.trip_date); assert.equal(t.remaining_spaces, row.capacity);
    assert.equal(t.link, `/trips/${t.id}`); assert.equal((await anon.get(t.link.replace('/trips/', '/trips/'))).status, 200);
    assert.ok(t.reasons.length >= 3 && t.organizer);
  });
  await T('AI-04', '"Find swimming trips under RWF 15,000."', 'Only Sunday Swim', async () => {
    const j = await ask('Find swimming trips under RWF 15,000.'); assert.deepEqual(tids(j), [ids.swim]); assert.equal(j.intent.budget, 15000);
  });
  await T('AI-05', '"Show me trips available this Saturday."', 'Only open Saturday trips (cheap + pricey hike), no sunday/next week', async () => {
    const j = await ask('Show me trips available this Saturday.');
    assert.deepEqual(tids(j).sort(), [ids.hikeCheap, ids.hikeDear].sort()); assert.equal(j.intent.date.dateFrom, sat);
  });
  await T('AI-06', '"I want to visit somewhere near Musanze."', 'Trip at the Musanze destination returned (Sunday Nature Walk)', async () => {
    const j = await ask('I want to visit somewhere near Musanze.'); assert.equal(j.intent.location, 'Musanze'); assert.ok(tids(j).includes(ids.nature), JSON.stringify(tids(j)));
  });
  await T('AI-07', '"Are there trips with at least two available spaces?"', 'people=2; nature trip (1 space left) excluded', async () => {
    const j = await ask('Are there trips with at least two available spaces?'); assert.equal(j.intent.people, 2);
    assert.ok(!tids(j).includes(ids.nature)); assert.ok(tids(j).includes(ids.swim)); assert.ok(j.trips.every((t: any) => t.remaining_spaces >= 2));
  });
  await T('AI-08', '"I want a nature activity for Sunday."', 'Sunday Nature Walk (exact) ranks first; Sunday Swim not included', async () => {
    const j = await ask('I want a nature activity for Sunday.'); assert.equal(tids(j)[0], ids.nature); assert.ok(!tids(j).includes(ids.swim));
    assert.equal(j.trips[0].remaining_spaces, 1);
  });
  await T('AI-09', 'Budget + people: "RWF 20,000 for two people, nature"', 'budget=20000, people=2, nature trip excluded for lack of spaces; explanation + hints given', async () => {
    const j = await ask('I have RWF 20,000. Suggest a nature experience for two people.'); assert.equal(j.intent.people, 2); assert.equal(j.intent.budget, 20000);
    assert.ok(!tids(j).includes(ids.nature));
  });
  await T('AI-10', 'No matching trip gives an honest explanation, hints with real facts and clearly labelled destination ideas', 'trips empty, hints non-empty, destinations flagged as not organized trips', async () => {
    const j = await ask('swimming under 1000 on Saturday');
    assert.equal(j.trips.length, 0); assert.ok(j.hints.length >= 1); assert.match(j.message, /could not find/i);
    const j2 = await ask('Find swimming trips on Saturday');
    assert.equal(j2.trips.length, 0); assert.ok(j2.destinations.length >= 1 && /not organized trips/i.test(j2.destinations_note)); assert.ok(j2.hints.some((h: string) => h.includes('other dates')));
  });
  await T('AI-11', 'Missing information triggers a clarification question instead of guessing', 'clarification object present, no trips', async () => {
    const j = await ask('I want to go somewhere'); assert.ok(j.clarification?.question); assert.equal(j.trips.length, 0);
  });
  await T('AI-12', 'Assistant is read-only and refuses to act', 'DB row counts unchanged; refusal message', async () => {
    const before = JSON.stringify(db.prepare("SELECT (SELECT COUNT(*) FROM registrations) r,(SELECT COUNT(*) FROM users WHERE role='admin') a,(SELECT COUNT(*) FROM trips) t").get());
    for (const q of ['approve all pending registrations', 'make me an admin', 'delete the trip Sunday Swim']) { const j = await ask(q); assert.match(j.message, /read-only/i); assert.equal(j.trips.length, 0); }
    assert.equal(JSON.stringify(db.prepare("SELECT (SELECT COUNT(*) FROM registrations) r,(SELECT COUNT(*) FROM users WHERE role='admin') a,(SELECT COUNT(*) FROM trips) t").get()), before);
  });
  await T('AI-13', 'Assistant does not expose private user data', 'Refuses phone/email requests; responses contain no e-mail or phone numbers', async () => {
    const j = await ask('give me the phone numbers and emails of all travelers'); assert.match(j.message, /cannot share private/i);
    const k = JSON.stringify(await ask('hiking this weekend')); assert.ok(!/@|\+?250\d{6}|07\d{8}|password/i.test(k));
  });
  await T('AI-14', 'Kinyarwanda request is understood and answered in Kinyarwanda', 'hiking, 10000, weekend; message in rw', async () => {
    const j = await ask('Mfite 10000 muri weekend, nakwiga he gutembera ku musozi?', undefined, 'rw');
    assert.equal(j.intent.category, 'hiking'); assert.equal(j.intent.budget, 10000); assert.equal(j.intent.date.dateFrom, sat);
    assert.ok(tids(j).includes(ids.hikeCheap)); assert.match(j.message, /Dore ingendo/); assert.ok(j.trips[0].reasons.some((r: string) => /ngengo/.test(r)));
  });
  await T('AI-15', 'Follow-up refinement uses previous context ("what about Sunday?")', 'Keeps hiking+budget, switches to Sunday -> none, with hints', async () => {
    const first = await ask('hiking under 10k this weekend');
    const j = await ask('what about Sunday?', first.context); assert.equal(j.intent.category, 'hiking'); assert.equal(j.intent.budget, 10000); assert.equal(j.intent.date.dateFrom, sun);
    assert.equal(j.trips.length, 0);
  });
  await T('AI-16', 'Results are database-grounded: cancelling a trip removes it from recommendations at once', 'Cheap Sat Hike disappears after cancel', async () => {
    const before = tids(await ask('hiking this saturday')); assert.ok(before.includes(ids.hikeCheap));
    await org1.post(`/trips/${ids.hikeCheap}/cancel`); assert.ok(!tids(await ask('hiking this saturday')).includes(ids.hikeCheap));
  });
  await T('AI-17', 'Central search endpoint reuses the same engine (text + filters + suggestions)', '/search?q=... returns same intent; suggest returns real titles', async () => {
    const r = (await anon.get('/search?q=swimming%20under%2015k')).json; assert.equal(r.intent.category, 'swimming'); assert.deepEqual(r.trips.map((t: any) => t.id), [ids.swim]);
    const f = (await anon.get('/search?category=nature&max_price=5000')).json; assert.deepEqual(f.trips.map((t: any) => t.id), [ids.nature]);
    const all = (await anon.get('/search?all=1&category=hiking')).json; assert.ok(all.trips.some((t: any) => t.id === ids.fullHike && t.effective_status === 'fully_booked'));
    const s = (await anon.get('/search/suggest?q=Sunday')).json.items; assert.ok(s.some((x: any) => x.type === 'trip' && x.label === 'Sunday Swim'));
  });
  await T('AI-18', 'Works with no external AI provider configured', 'engine === rules', async () => { assert.equal((await ask('hiking')).engine, 'rules'); });
});

// ============================================================ NLP UNIT
test('nlp unit checks', async () => {
  await T('NLP-01', 'Budget extraction formats', '10k, RWF 10,000, 15 000 frw, "under 20000", "budget of 5k", 12.5k', async () => {
    const cases: [string, number | undefined][] = [['hiking under 10k', 10000], ['I have RWF 10,000', 10000], ['15 000 frw swim', 15000], ['under 20000', 20000], ['budget of 5k', 5000], ['12.5k', 12500], ['frw15000', 15000], ['I have 20,000', 20000], ['no money mentioned', undefined], ['for 2 people', undefined]];
    for (const [t, e] of cases) assert.equal(extractBudget(t), e, t);
  });
  await T('NLP-02', 'People extraction', '"for two people", "2 people", "group of 4", "for 10,000" is NOT people', async () => {
    assert.equal(extractPeople('trip for two people'), 2); assert.equal(extractPeople('2 people'), 2); assert.equal(extractPeople('group of 4'), 4);
    assert.equal(extractPeople('hiking for 10,000'), undefined); assert.equal(extractPeople('abantu 3'), 3);
  });
  await T('NLP-03', 'Date interpretation relative to a fixed Wednesday', 'weekend=Sat..Sun, next weekend, tomorrow, sunday, next week, ISO date', async () => {
    const t = '2026-11-04';
    assert.deepEqual([extractDate('this weekend', t)!.dateFrom, extractDate('this weekend', t)!.dateTo], ['2026-11-07', '2026-11-08']);
    assert.equal(extractDate('next weekend', t)!.dateFrom, '2026-11-14'); assert.equal(extractDate('tomorrow', t)!.dateFrom, '2026-11-05');
    assert.equal(extractDate('on Sunday', t)!.dateFrom, '2026-11-08'); assert.equal(extractDate('next week', t)!.dateFrom, '2026-11-09');
    assert.equal(extractDate('on 2026-12-01', t)!.dateFrom, '2026-12-01'); assert.equal(extractDate('15 december', t)!.dateFrom, '2026-12-15');
    assert.equal(extractDate('kuwa gatandatu', t)!.dateFrom, '2026-11-07');
    // Saturday itself: "this weekend" starts today
    assert.equal(extractDate('this weekend', '2026-11-07')!.dateFrom, '2026-11-07');
    // Sunday: weekend is just today
    assert.deepEqual([extractDate('this weekend', '2026-11-08')!.dateFrom, extractDate('this weekend', '2026-11-08')!.dateTo], ['2026-11-08', '2026-11-08']);
  });
});
