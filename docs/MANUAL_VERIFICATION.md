# Browser verification (performed in headless Chromium against the built app)

These were run by script on the seeded demo database; observed results only.

| ID | Check | Observed result |
|---|---|---|
| UI-01 | Home page renders at 390 px, 820 px and 1366 px wide | Renders without console/page errors; no horizontal scrolling on home, trips, admin pages at 390 px and 1280 px |
| UI-02 | Visitor asks the AI planner "I have RWF 10,000 this weekend. Where can I go hiking?" | 1 recommendation card shown (seeded Sunday hike, RWF 8,000); "View trip" opens `/trips/1` |
| UI-03 | Traveler logs in via `?next=` and requests a place | Redirected back to trip, status "Butegereje" (pending) shown, success toast shown |
| UI-04 | "My registrations" page | Shows the new pending request plus seeded ones |
| UI-05 | Admin login and dashboard | 15 statistic cards rendered from live database counts |
| UI-06 | Admin approves the pending organizer application | Application leaves the pending list |
| UI-07 | Kinyarwanda default, English switch | Default RW on first load; RW/EN toggle in header and mobile menu |

Not verified: real destination photography (none bundled, see README), screen-reader testing, browsers other than Chromium, real Open-Meteo weather (sandbox has no access to it, the "unavailable" path was exercised instead).
