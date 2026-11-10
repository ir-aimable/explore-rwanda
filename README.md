# Explore Rwanda
**Explore more. Go together.** Local Tourism Discovery and AI-Based Trip Organizer...

Travelers discover destinations and organized trips, ask an AI-style assistant for suggestions, and register. Organizers apply, get approved, publish trips and manage participants. Administrators supervise everything, and every sensitive action is audit-logged.

## 1. Features
- Public: homepage, destinations, trip discovery with natural-language search + type-ahead, trip details with costs (each with its source), map links, weather (Open-Meteo, optional), reviews, contact form.
- AI trip assistant (no paid API): understands English and Kinyarwanda, extracts activity, place, budget, date/weekend, group size and origin, reads the real database, filters by deadline/capacity/status, ranks, explains each recommendation, links to real trip pages. Read-only.
- Traveler: register/login, profile, register for trips, cancel, save trips, notifications, reviews after completed trips, support requests.
- Organizer: apply (admin approval required), dashboard, create/edit/publish/cancel/delete own trips, photos, costs, approve/reject registrations, reviews.
- Admin: statistics, users, organizer applications and organizers, destinations, categories, trips (all), registrations, review/report moderation, support replies, announcements, settings, audit log.
- Kinyarwanda is the default language, English is available (`client/src/i18n`).

## 2. Stack
React + TypeScript + Vite + plain CSS + React Router + fetch | Node.js + Express + TypeScript | SQLite: a local file in development (better-sqlite3), hosted Turso/libSQL on Vercel | Vercel Blob for uploaded photos on Vercel | bcrypt, JWT in httpOnly cookie, zod validation, helmet, express-rate-limit, multer.

## 3. Requirements
Node.js 20+ (tested on 22), npm, Git. No database server needed.

## 4. Install and run
```bash
cd explore-rwanda
npm run install:all
cp .env.example .env          # then edit: JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD
npm run db:init               # creates the schema and the initial administrator from .env
npm run db:seed               # OPTIONAL demo data (all flagged is_demo)
npm run dev                   # API on :4000, web app on :5173
```
Open http://localhost:5173. Single-process mode (as used for the demo): `npm run build` then `npm start` and open http://localhost:4000 (the server serves `client/dist`).

Individually: `npm run dev:server`, `npm run dev:client`. Reset everything: `npm run db:reset`, then init and seed again.

### Deploy on Vercel (everything on Vercel)
The website is served from Vercel's CDN and the whole Express API runs as one Vercel Function (`api/index.mjs`, built from `server/`). Vercel functions have no permanent disk, so production data lives in two hosted services that have free tiers and are available from the Vercel Marketplace:

| Data | Local development | On Vercel |
|---|---|---|
| Database | SQLite file `server/data/explore-rwanda.db` | **Turso** (hosted SQLite/libSQL), same schema and SQL |
| Uploaded photos | `uploads/` folder | **Vercel Blob** (public URLs stored in the database) |
| Daily housekeeping (completed trips, reminders) | hourly timer | **Vercel Cron** → `/api/cron/daily` (see `vercel.json`) |

1. Push the repository to GitHub, then in Vercel: **Add New → Project** → import it. Keep the root directory as the repository root; `vercel.json` sets the install, build, output, rewrites and cron.
2. **Database:** in the project, **Storage → Create → Turso** (Marketplace) and connect it to the project. This adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Pick a database region close to the Vercel function region.
3. **Photos:** **Storage → Create → Blob** and connect it. This adds `BLOB_READ_WRITE_TOKEN`.
4. **Environment variables** (Settings → Environment Variables):
   - `JWT_SECRET`: a long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (10+ characters): the first administrator, created automatically on the first request
   - `CRON_SECRET`: any long random string (Vercel sends it to the cron endpoint)
   - optional: `CLIENT_ORIGIN` (your site URL), `WEATHER_ENABLED`, `GOOGLE_MAPS_API_KEY`
5. **Deploy.** The tables are created on the first request. Check `https://<your-site>/api/health`: it should say `"database":"turso","uploads":"vercel-blob"`.
6. **Demo data (optional):** from your computer, with the Turso values from the Vercel project settings:
   ```bash
   cd server
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... DEMO_PASSWORD=... npm run db:seed
   ```

Notes: the demo trip dates are relative to the day you seed, so re-seed before a presentation (create a fresh Turso database first). Rate limits are kept per function instance. Free tiers have usage limits; check the Turso and Vercel pricing pages.

## 5. Configuration (`.env`)
See `.env.example`. Secrets are only read from environment variables. `JWT_SECRET` is required in production. No default credentials are shipped: the admin is created from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (min 10 characters); the seed uses `DEMO_PASSWORD` or generates a random one and prints it once. Optional: `OLLAMA_URL` (local model rephrases the assistant's intro sentence only), `WEATHER_ENABLED`.

## 6. Demonstration script
1. Visitor: home, ask the planner "Mfite RWF 10,000 muri weekend. Nakwiga he gutembera ku musozi?", open a trip.
2. Traveler: sign up (or log in as `alice@demo.explore-rwanda.test` with the demo password), request a place, see status "Butegereje".
3. Organizer applicant: `/become-organizer`, submit. Log in as admin, **Ubusabe bwo gutegura ingendo**, approve (a seeded pending applicant `applicant@demo.explore-rwanda.test` also exists).
4. Organizer: log in as the approved organizer, create and publish a trip, open **Abiyandikishije**, approve or reject requests.
5. Admin: dashboard, users, audit log (shows the approval and every sensitive action).
Seeded demo trips are dated relative to the day you seed; re-seed (`db:reset`, `db:init`, `db:seed`) before a presentation so dates are upcoming.

## 7. How the AI assistant works (`server/src/services/ai`, `search`)
1. `nlp.ts` normalizes the text and extracts: budget (`10k`, `RWF 10,000`, `15 000 frw`), people, dates relative to Africa/Kigali "today" (this weekend, Saturday, next week, ISO dates, Kinyarwanda day names), activity (synonyms + category names from the DB), place (names/regions/starting points from the DB), origin, low-cost/level preferences. Attempts to make it change data or reveal private data are refused. Nothing understood leads to a clarification question.
2. `discovery.ts` (shared by assistant, homepage search, trip discovery) retrieves published trips of approved organizers that have not started, applies hard filters (date window, registration deadline, remaining spaces ≥ group size, activity, place, budget), scores (activity 35, place 25, budget 20-25, date, availability, rating) and records reasons.
3. Over-budget trips appear only in a labelled "alternatives" list; other-date trips are never recommended, only counted in hints. If nothing matches, the answer explains why and offers destinations clearly labelled as *not organized trips*.
4. `messages.ts` builds RW/EN wording from facts. Optional Ollama can reword the intro sentence; failures fall back silently.

## 8. Security measures
bcrypt (cost 12) hashes; httpOnly SameSite cookie sessions re-validated against the DB on every request (deactivation/role change is immediate); role and ownership checks on the server; zod validation; parameterized SQL only; rate limits on login/registration/forms/AI; CORS limited to `CLIENT_ORIGIN`; helmet headers; uploads limited to 4 MB JPG/PNG/WebP with magic-byte verification and random filenames; no stack traces in errors; audit log of privileged actions; no public admin creation; registration always creates a traveler.

## 9. Roles and permissions
| Action | Visitor | Traveler | Applicant | Organizer | Admin |
|---|---|---|---|---|---|
| Browse, search, AI assistant | yes | yes | yes | yes | yes |
| Organizer profile pages | no (login) | yes | yes | yes | yes |
| Register for trips | no | yes | yes | yes (not own trips) | no |
| Create/manage trips | no | no | no | own only | all |
| Approve registrations | no | no | no | own trips | all |
| Approve organizers, manage users/destinations | no | no | no | no | yes |

## 10. Data model and API
ERD: `docs/erd.png` (source `docs/erd.mmd`). Architecture: `docs/architecture.png`. Tables: users, organizer_applications, organizers, categories, destinations, destination_categories, trips, trip_images, registrations, saved_trips, reviews, notifications, support_requests, reports, cost_records, announcements, audit_logs, system_settings.

Trip `status` is stored as draft/published/cancelled/completed. *Fully booked* and *registration closed* are derived live from capacity, approved seats and the deadline, so they cannot go stale. Only **approved** registrations consume capacity; approval and registration run in immediate SQLite transactions and re-check capacity.

Main endpoints (all under `/api`): `auth/{register,login,logout,me,profile,password}`; `search`, `search/assistant`, `search/suggest`; `trips` (GET, POST, `:id` GET/PUT/DELETE, `:id/{publish,unpublish,cancel,register,registrations,images,reviews,weather}`); `destinations`; `categories`; `registrations/{mine,manage,:id/decision,:id/cancel}`; `saved`; `notifications`; `reviews/eligible`; `organizer-applications`; `organizers/:id` (auth); `organizer/me`; `costs`; `support`; `admin/{stats,users,applications,organizers,destinations,categories,reviews,reports,support,announcements,settings,audit}`.

## 11. Testing
`npm test` runs 98 checks (API workflows, permissions, overbooking/concurrency, AI queries, NLP units) against an isolated temporary database and **regenerates `docs/TEST_REPORT.md` from the real results**. Browser checks are in `docs/MANUAL_VERIFICATION.md`.

## 12. Troubleshooting
- `better-sqlite3` install error: use Node 20/22 LTS and rerun `npm run install:all`.
- Vercel: `/api/health` fails with "TURSO_DATABASE_URL is not set": connect the Turso database to the project (step 2) and redeploy. Photos fail to upload: connect a Blob store (step 3).
- Blank admin login: run `npm run db:init` after setting `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Trips look expired: demo dates are relative to the seed day; reseed.
- Weather says unavailable: the server cannot reach open-meteo.com, or the trip date is more than 15 days away. Trip pages are unaffected.
- Fonts: loaded from Google Fonts; falls back to Georgia/system fonts offline.

## 13. Current limitations
- No bundled photography: trips/destinations without an upload show an illustrated placeholder. Admins and organizers upload real photos; put a hero photo at `client/public/hero.jpg` to use it behind the home hero.
- Demo destinations/prices/dates are invented examples, flagged "Demo data". Entry fees are recorded as "unknown". No official data is claimed.
- Waitlist status exists in the schema but there is no automatic waitlisting.
- E-mail notifications are not implemented (in-app only). No password-reset flow, no payments.
- The assistant has no distance data, so "near X" means the place appears in the stored destination/region/meeting point.
- Google Maps embedding is not implemented; ordinary map and direction links are used.
- Cookie sessions rely on SameSite=Lax; there is no separate CSRF token.
- Accessibility was designed for (focus rings, labels, reduced motion) but not audited with a screen reader.

## 14. Future improvements
Waitlist promotion, e-mail/SMS notifications, password reset, mobile-money payments, distance/transport costing with verified data, embedded maps, Ollama-based query understanding, CSRF tokens.
