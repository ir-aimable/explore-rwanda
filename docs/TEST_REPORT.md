# Explore Rwanda - Automated Test Report

Generated: 2026-11-07T16:44:16.738Z by `npm test` (server/src/tests). Results below are produced by the test run itself, not written by hand.

**Total: 98 | Passed: 98 | Failed: 0**

| Test ID | Description | Expected result | Actual result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| AUTH-01 | Traveler registers with name, email, phone, password | HTTP 201, role=traveler, no password hash in response | Matched expected result (all assertions passed) | PASS |  |
| AUTH-02 | Duplicate email is rejected | HTTP 409 email_taken | Matched expected result (all assertions passed) | PASS | Case-insensitive |
| AUTH-03 | Weak password (no digit) is rejected by validation | HTTP 400 validation_error | Matched expected result (all assertions passed) | PASS |  |
| AUTH-04 | Registration cannot self-assign administrator or organizer role | Account is created as traveler although role=admin was sent | Matched expected result (all assertions passed) | PASS |  |
| AUTH-05 | Login with valid credentials sets a session; /auth/me returns the user | HTTP 200 and me.email matches | Matched expected result (all assertions passed) | PASS |  |
| AUTH-06 | Invalid credentials are rejected | HTTP 401 invalid_credentials (same message for unknown email and wrong password) | Matched expected result (all assertions passed) | PASS |  |
| AUTH-07 | Logout clears the session | After logout /auth/me returns user=null and protected route is 401 | Matched expected result (all assertions passed) | PASS |  |
| AUTH-08 | Protected routes reject anonymous visitors | HTTP 401 for traveler, organizer and admin endpoints | Matched expected result (all assertions passed) | PASS | Includes organizer profile page (auth required by project rule) |
| AUTH-09 | Administrator can log in (seeded from environment variables) | HTTP 200 role=admin | Matched expected result (all assertions passed) | PASS |  |
| AUTH-10 | Passwords are stored as bcrypt hashes | password_hash starts with $2 and differs from plaintext | Matched expected result (all assertions passed) | PASS |  |
| ADM-01 | Administrator creates destinations | HTTP 201 for each | Matched expected result (all assertions passed) | PASS |  |
| ORG-01 | Visitor submits an organizer application (creates traveler account + pending application) | HTTP 201 status=pending | Matched expected result (all assertions passed) | PASS |  |
| ORG-02 | Applicant cannot create trips before approval | HTTP 403 | Matched expected result (all assertions passed) | PASS |  |
| ORG-03 | Duplicate pending application is rejected | HTTP 409 application_pending | Matched expected result (all assertions passed) | PASS |  |
| ORG-04 | Non-admins (traveler, applicant) cannot approve applications | HTTP 403 for each | Matched expected result (all assertions passed) | PASS | Organizers cannot approve themselves |
| ADM-02 | Administrator approves the application | HTTP 200; user role becomes organizer; applicant notified | Matched expected result (all assertions passed) | PASS |  |
| ORG-05 | Approved organizer logs in again and has organizer role | role=organizer | Matched expected result (all assertions passed) | PASS |  |
| ADM-03 | Administrator rejects a second application; applicant stays traveler | status=rejected, role=traveler | Matched expected result (all assertions passed) | PASS |  |
| ADM-04 | Administrator adds an organizer account directly | HTTP 201; that organizer can log in | Matched expected result (all assertions passed) | PASS |  |
| ORG-06 | Approved organizer creates a trip | HTTP 201, published, price stored | Matched expected result (all assertions passed) | PASS |  |
| ORG-07 | Trip validation: deadline after trip start, past date, negative price, bad capacity | HTTP 400 each | Matched expected result (all assertions passed) | PASS |  |
| ORG-08 | Organizer edits own trip; change persists | HTTP 200 and new title/price visible | Matched expected result (all assertions passed) | PASS |  |
| SEC-01 | Organizer cannot edit, cancel, delete or list registrations of another organizer's trip | HTTP 403 for each | Matched expected result (all assertions passed) | PASS |  |
| SEC-02 | Travelers cannot create or manage trips | HTTP 403 | Matched expected result (all assertions passed) | PASS |  |
| INT-01 | Draft trip is not visible publicly and not listed | Public GET 404; absent from list; visible to owner | Matched expected result (all assertions passed) | PASS |  |
| INT-02 | Registration to a draft trip is refused | HTTP 404 | Matched expected result (all assertions passed) | PASS |  |
| ORG-09 | Publish and unpublish | draft -> published -> draft | Matched expected result (all assertions passed) | PASS |  |
| ADM-05 | Administrator creates a trip on behalf of an organizer, and edits any trip | HTTP 201 / 200 | Matched expected result (all assertions passed) | PASS |  |
| ADM-06 | Destination cannot be deleted while trips use it; unused destination can | 409 destination_has_trips then 200 | Matched expected result (all assertions passed) | PASS |  |
| ADM-07 | Administrator updates a destination | HTTP 200 and value persisted | Matched expected result (all assertions passed) | PASS |  |
| TRV-01 | Public visitor browses trips and destinations without login | HTTP 200 with data | Matched expected result (all assertions passed) | PASS |  |
| TRV-02 | Traveler registers for a trip; status is pending | HTTP 201 status=pending | Matched expected result (all assertions passed) | PASS |  |
| TRV-03 | Anonymous visitor must log in to register | HTTP 401 | Matched expected result (all assertions passed) | PASS |  |
| INT-03 | Duplicate active registration is rejected | HTTP 409 duplicate_registration | Matched expected result (all assertions passed) | PASS |  |
| INT-04 | Concurrent duplicate attempts by one user create exactly one registration | 1 x 201, 4 x 409 | 1 created, 4 refused | PASS |  |
| TRV-04 | Traveler sees registration status in "my registrations" | status pending listed with trip title | Matched expected result (all assertions passed) | PASS |  |
| SEC-03 | Traveler cannot approve registrations (own or others) | HTTP 403 | Matched expected result (all assertions passed) | PASS |  |
| SEC-04 | Other organizer cannot decide on registrations of this trip | HTTP 403 | Matched expected result (all assertions passed) | PASS |  |
| ORG-10 | Owner organizer approves; traveler is notified; spaces decrease | status approved, remaining 9, notification registration_approved | Matched expected result (all assertions passed) | PASS |  |
| ORG-11 | Organizer rejects a request; traveler notified | status rejected | Matched expected result (all assertions passed) | PASS |  |
| INT-05 | Rejected traveler can submit a new request (only ACTIVE duplicates are blocked) | HTTP 201 | Matched expected result (all assertions passed) | PASS |  |
| INT-06 | Requesting more seats than remaining is refused | HTTP 409 not_enough_spaces | Matched expected result (all assertions passed) | PASS |  |
| INT-07 | OVERBOOKING: 6 pending requests, capacity 2, all approved concurrently -> only 2 approved | approved seats == 2, others 409 | 2 approvals succeeded, 4 refused; approved seats in DB = 2 | PASS |  |
| INT-08 | Fully booked trip refuses new registrations and is flagged | HTTP 409 fully_booked; effective_status fully_booked | Matched expected result (all assertions passed) | PASS |  |
| INT-09 | Many parallel registrations never exceed approved capacity (cap 3, 8 users register then organizer approves all in parallel) | approved <= 3 | Matched expected result (all assertions passed) | PASS |  |
| INT-10 | Registration after the deadline is refused | HTTP 409 deadline_passed | Matched expected result (all assertions passed) | PASS |  |
| INT-11 | Registration for a cancelled trip is refused and participants are notified of the cancellation | 409 trip_cancelled; notification trip_cancelled | Matched expected result (all assertions passed) | PASS |  |
| INT-12 | Important trip changes notify participants | notification trip_updated for a registered traveler | Matched expected result (all assertions passed) | PASS |  |
| ORG-12 | Capacity cannot be reduced below approved seats | HTTP 400 capacity_below_approved | Matched expected result (all assertions passed) | PASS |  |
| ORG-13 | Trip with active registrations cannot be deleted by organizer (must cancel) | HTTP 409 trip_has_registrations | Matched expected result (all assertions passed) | PASS |  |
| ORG-14 | Trip without registrations can be deleted by its owner | HTTP 200 then 404 | Matched expected result (all assertions passed) | PASS |  |
| TRV-05 | Traveler cancels own registration | status cancelled; another traveler cannot cancel it | Matched expected result (all assertions passed) | PASS |  |
| TRV-06 | Save / unsave trips | saved list contains then no longer contains the trip | Matched expected result (all assertions passed) | PASS |  |
| TRV-07 | Review refused before the trip took place, and for non-participants | HTTP 409 trip_not_completed / 403 not_participant | Matched expected result (all assertions passed) | PASS |  |
| TRV-08 | After the trip date, a confirmed participant can review once; non-participants still cannot | 201 then 409 already_reviewed; visible publicly | Matched expected result (all assertions passed) | PASS |  |
| ADM-08 | Administrator moderates (hides) a review | Review disappears from public list | Matched expected result (all assertions passed) | PASS |  |
| TRV-09 | Completed trips are not shown as available | Past trip absent from public list | Matched expected result (all assertions passed) | PASS |  |
| ADM-09 | Dashboard statistics reflect real data | users_total, trips_total, registrations_total > 0 and pending_applications is a number | Matched expected result (all assertions passed) | PASS |  |
| SEC-05 | Travelers and organizers cannot access admin endpoints | HTTP 403 | Matched expected result (all assertions passed) | PASS |  |
| ADM-10 | User search / filter | Finds Alice by partial email; role filter works | Matched expected result (all assertions passed) | PASS |  |
| ADM-11 | Deactivated account cannot log in or use an existing session | login 401 account_disabled; old session 401 | Matched expected result (all assertions passed) | PASS |  |
| ADM-12 | Administrator grants and revokes admin privilege; cannot modify self or remove last admin | grant 200; self 400; revoke 200; last admin protected | Matched expected result (all assertions passed) | PASS |  |
| SEC-06 | A non-admin cannot grant admin to themselves via the role endpoint | HTTP 403 | Matched expected result (all assertions passed) | PASS |  |
| ADM-13 | Suspending an organizer hides their trips, blocks trip creation and management | public list excludes trips; POST /trips 403 | Matched expected result (all assertions passed) | PASS |  |
| ADM-14 | Administrator can cancel and force-delete a trip with registrations | cancel 200; force delete 200 | Matched expected result (all assertions passed) | PASS |  |
| ADM-15 | Registration oversight: admin lists and searches all registrations | items include multiple organizers' trips | Matched expected result (all assertions passed) | PASS |  |
| ADM-16 | Audit log records privileged actions with actor | Contains organizer_approve, trip_create, user_deactivate, admin_grant | Matched expected result (all assertions passed) | PASS |  |
| ADM-17 | Category and announcement management, settings update | HTTP 2xx and persisted | Matched expected result (all assertions passed) | PASS |  |
| ADM-18 | Support request: visitor submits, admin replies, signed-in author is notified | HTTP 201 / 200 / notification | Matched expected result (all assertions passed) | PASS |  |
| ADM-19 | Cost records: organizer-only source for organizers; unknown cost stored without amount | organizer 201 (organizer source), 403 (official source); admin 201 | Matched expected result (all assertions passed) | PASS |  |
| SEC-07 | SQL injection strings in search/filter/login do not break queries or leak data | No 500; users table intact | Matched expected result (all assertions passed) | PASS |  |
| SEC-08 | Uploading a non-image disguised as PNG is rejected | HTTP 400 invalid_file_type | Matched expected result (all assertions passed) | PASS |  |
| SEC-09 | A genuine PNG upload by the owner is accepted; by another organizer is refused | 201 then 403 | Matched expected result (all assertions passed) | PASS |  |
| SEC-10 | Errors do not leak internals; malformed JSON handled | HTTP 400/404 with short error code, no stack trace | Matched expected result (all assertions passed) | PASS |  |
| SEC-11 | Rate limiting on login | HTTP 429 after the configured number of attempts | Matched expected result (all assertions passed) | PASS |  |
| SEC-12 | Private organizer data is not exposed on public trip listings | Public trip has organizer display_name+verified only | Matched expected result (all assertions passed) | PASS |  |
| ORG-15 | Organizer profile page needs sign-in; signed-in traveler can view | 401 anonymous, 200 signed in, no 5xx | Matched expected result (all assertions passed) | PASS |  |
| AI-01 | "I have RWF 10,000 this weekend. Where can I go hiking?" | Intent: hiking, 10000, weekend. Only Cheap Sat Hike returned | hiking/10000/2026-11-07..2026-11-08; results: Cheap Sat Hike | PASS |  |
| AI-02 | Never recommends draft, cancelled, fully booked, other-date trips; over-budget trip shown only as labelled alternative | Excluded ids absent from trips; Pricey Sat Hike in alternatives with over_budget_by=5000 | Matched expected result (all assertions passed) | PASS |  |
| AI-03 | Recommendation contains real data and a working link | price/date/spaces equal DB values; link opens a 200 trip page | Matched expected result (all assertions passed) | PASS |  |
| AI-04 | "Find swimming trips under RWF 15,000." | Only Sunday Swim | Matched expected result (all assertions passed) | PASS |  |
| AI-05 | "Show me trips available this Saturday." | Only open Saturday trips (cheap + pricey hike), no sunday/next week | Matched expected result (all assertions passed) | PASS |  |
| AI-06 | "I want to visit somewhere near Musanze." | Trip at the Musanze destination returned (Sunday Nature Walk) | Matched expected result (all assertions passed) | PASS |  |
| AI-07 | "Are there trips with at least two available spaces?" | people=2; nature trip (1 space left) excluded | Matched expected result (all assertions passed) | PASS |  |
| AI-08 | "I want a nature activity for Sunday." | Sunday Nature Walk (exact) ranks first; Sunday Swim not included | Matched expected result (all assertions passed) | PASS |  |
| AI-09 | Budget + people: "RWF 20,000 for two people, nature" | budget=20000, people=2, nature trip excluded for lack of spaces; explanation + hints given | Matched expected result (all assertions passed) | PASS |  |
| AI-10 | No matching trip gives an honest explanation, hints with real facts and clearly labelled destination ideas | trips empty, hints non-empty, destinations flagged as not organized trips | Matched expected result (all assertions passed) | PASS |  |
| AI-11 | Missing information triggers a clarification question instead of guessing | clarification object present, no trips | Matched expected result (all assertions passed) | PASS |  |
| AI-12 | Assistant is read-only and refuses to act | DB row counts unchanged; refusal message | Matched expected result (all assertions passed) | PASS |  |
| AI-13 | Assistant does not expose private user data | Refuses phone/email requests; responses contain no e-mail or phone numbers | Matched expected result (all assertions passed) | PASS |  |
| AI-14 | Kinyarwanda request is understood and answered in Kinyarwanda | hiking, 10000, weekend; message in rw | Matched expected result (all assertions passed) | PASS |  |
| AI-15 | Follow-up refinement uses previous context ("what about Sunday?") | Keeps hiking+budget, switches to Sunday -> none, with hints | Matched expected result (all assertions passed) | PASS |  |
| AI-16 | Results are database-grounded: cancelling a trip removes it from recommendations at once | Cheap Sat Hike disappears after cancel | Matched expected result (all assertions passed) | PASS |  |
| AI-17 | Central search endpoint reuses the same engine (text + filters + suggestions) | /search?q=... returns same intent; suggest returns real titles | Matched expected result (all assertions passed) | PASS |  |
| AI-18 | Works with no external AI provider configured | engine === rules | Matched expected result (all assertions passed) | PASS |  |
| NLP-01 | Budget extraction formats | 10k, RWF 10,000, 15 000 frw, "under 20000", "budget of 5k", 12.5k | Matched expected result (all assertions passed) | PASS |  |
| NLP-02 | People extraction | "for two people", "2 people", "group of 4", "for 10,000" is NOT people | Matched expected result (all assertions passed) | PASS |  |
| NLP-03 | Date interpretation relative to a fixed Wednesday | weekend=Sat..Sun, next weekend, tomorrow, sunday, next week, ISO date | Matched expected result (all assertions passed) | PASS |  |
