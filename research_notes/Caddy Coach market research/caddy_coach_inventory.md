# Caddy Coach: product inventory (what exists in the code today, 18 Nov 2026)

Sources are files in the repository (paths relative to the repo root, with line numbers where useful). Anything not read directly in the code is marked *inferred*. No personal data is included.

## What are all user-facing features, grouped by area?

### Takeaway
Caddy Coach is already a broad, all-in-one golf app: on-device swing analysis (9 key positions, 38 scored checks, faults, a "better position" overlay, swing comparison), an AI coach (built but switched off), a shot tracer, live camera grip and setup checks, a 30-drill library with 3D demos and live voice-coached modes, practice plans and a miss guide, round scoring with GPS, 3D flyovers, weather "plays-like" yardages, a WHS handicap, strokes gained, side games, group rounds, club leaderboards, competitions, live pins, club pages, coach–pupil sharing and share cards. Any strategy recommendation in these areas is an *improve* recommendation, not a *build* one.

### Cited Findings

**Navigation / structure**
- Five bottom tabs: Home, Play, Swing, Practice, My bag. Swing groups Analyse, Shot tracer and Swing history; Practice groups Drills, Setup check, Grip check and the Swing guide — [app-1.js:45-47](app-1.js) (`HOLES`, `GROUPS`).
- The side menu uses a golf-course metaphor: "The Tee Box" (Home), "Hole 1 · The Tee" (Analyse), "Hole 2 · The Scorecard" (saved swings), "Hole 3 · The Practice Range" (Drills), "Hole 4 · The Pro Shop" (grip), "Hole 5 · The Starter" (setup), "Hole 6 · The Fairway" (tracer), "Hole 7 · The Yardage Book" (guide), "Hole 8 · The Scorer's Hut" (round tracker), "Hole 9 · The Bag" (yardages) — [index.html, nav#panel](index.html).

**Home ("The Tee Box")**
- Cards: start a round, "your game at a glance" stats strip (handicap, this week's practice, last swing score), Updates inbox, getting-started checklist, handicap card, home-course map, goals, weekly plan, "Your year in golf", today's focus with a drill, and Quick start tiles (Analyse a swing, Trace a shot, Grip check, Setup check) — [index.html:2089-2108](index.html); [app-4.js:125-131](app-4.js).
- On phones, Home sits over an aerial golf-hole photo; scrolling "flies" down the hole, a ball flight draws and a pill counts yards to the pin — [homehole.js:1-4](homehole.js).
- Goals: break a score, get handicap under a number, or reach a swing score — [app-3.js:672](app-3.js). Practice streak and "Your year in golf" summary — [app-3.js:370, 387](app-3.js).
- Updates inbox on Home (handicap changes, goals, practice reminders, new club rounds/competitions, coach notes) — [app-3.js:709-737](app-3.js); [HOW-TO-PUT-IT-ONLINE.txt "NEW IN THIS VERSION"](HOW-TO-PUT-IT-ONLINE.txt).

**Swing analysis (Analyse a swing / Swing history)**
- Upload or record a video; options: Golfer (auto-detect / right / left), Camera angle (face-on / down-the-line), Club (driver, wood/hybrid, iron, wedge), Your usual miss (slice, hook, push, pull, etc.). Steps: Trim → Track → Measure → Coach — [index.html:2110-2135](index.html).
- Trim tool with "Find my swing" auto-suggested trim, max 6 seconds; the clip can be saved with the analysis — [index.html:2137-2153](index.html); [app-1.js:452](app-1.js).
- Nine key positions: Address, Takeaway, Halfway back, Top, Transition, Downswing, Impact, Follow-through, Finish — [app-1.js:758](app-1.js).
- Nine scored report areas: Setup posture, Spine angle, Head stability, Hip and shoulder rotation, Backswing and top, Tempo and sequencing, Impact position, Balance and finish, Clubface and path (estimate) — [app-1.js:148](app-1.js).
- 38 rule-based checks (e.g. stance width, hip hinge, knee flex, sway, reverse spine, shoulder/hip turn, tempo 3:1, over-the-top hand path, early extension, posture held, weight shift, hip open at impact, chicken wing), each split by camera view, scored 0-10 against anchors "set from 24 tour swings filmed face-on and tracked by this app" plus published GolfTEC / Sportsbox AI / TPI gaps — [metrics.js:291-382](metrics.js).
- Readings are labelled "measured" vs "estimated", and borderline readings near a band edge are called borderline rather than faults — [metrics.js:383-391](metrics.js).
- Miss-to-cause links for slice, hook, push, pull, fat, thin, topped shot, shank — [metrics.js:655+](metrics.js).
- Player view with "You + better position" overlay (a corrected skeleton of the golfer's own pose), frame-by-frame, slow-mo — [index.html:2157-2167](index.html); [ideal.js:1-3](ideal.js).
- Looping "fault clips" with colour-coded zones on the body per rated area — [zones.js:1-2](zones.js).
- Plain-English report: fix list, gauges, position-by-position checklist; a rough "what this score means in handicap terms" guide — [app-1.js:817-822](app-1.js); [metrics.js:439](metrics.js).
- Swing history list with trend chart, per-swing detail and a "consistency" box — [index.html:2169-2179](index.html).
- Compare two swings side by side, synced across Address/Takeaway/Top/Impact/Finish — [app-1.js:1199-1203](app-1.js).
- Progress tracker and recurring-fault detection (faults in ≥2 of the last 5 swings from the same camera angle) — [swingcoach.js:384-386](swingcoach.js).
- After each analysis: "Your practice plan" for the #1 fix (10 min drill, 10 min half swings, 10 min full swings) and the top fault is added to the weekly plan — [swingcoach.js planCardHTML / saveAnalysis](swingcoach.js).
- Built-in written coach (summary, strengths, top priority) generated on the phone from measurements, no internet — [app-1.js:2037-2055](app-1.js).

**Shot tracer**
- Film from behind; the app finds the ball, detects impact, tracks it, fits a 3D flight and projects it — [tracer.js:1](tracer.js); [index.html:2295-2302](index.html).
- Club-based typical amateur carry/apex table (Driver 220 yd … 60° wedge 45 yd) — [tracer.js:416-423](tracer.js).
- Editing: drag landing/start point, start direction, curve, carry, apex, strike, timing; 7 colours and 3 line widths; "Save video to Photos" (own MP4 writer, H.264/VP9) and "Save image" — [index.html:2304-2325](index.html); [tracer-mp4.js:1-3](tracer-mp4.js).
- Tracer explains what the ball flight means for clubface and path, and the swing report reuses the last traced shot for its clubface/path section — [HOW-TO-PUT-IT-ONLINE.txt "NEW IN THIS VERSION"](HOW-TO-PUT-IT-ONLINE.txt).

**Live camera checks**
- Live grip check (face-on camera, body + 21 hand points per hand): lead hand turn/knuckles, trail hand V, hands together, lead thumb covered, hand position; spoken cues, one hand at a time; plus written guides (neutral grip diagram, six-step build, overlap/interlock/ten-finger, common faults table) — [index.html:2194-2258](index.html); [grip.js:1-2](grip.js); [hand.js:1-3](hand.js).
- Live setup check per club (22 clubs): face-on (stance width, ball position, which foot to move, shoulder tilt) and down-the-line (distance from ball, posture, knee flex), voice-guided; pre-shot routine and club-by-club setup table — [index.html:2260-2293](index.html); [setup.js:1, 364-369](setup.js).
- Live drill feedback: real-time pose checks and spoken cues; 22 drill specs with "hold" or "swing" modes — [live.js:1-2, 265-277](live.js).

**Drills and practice**
- 30 drills (setup 5, backswing 7, transition 3, downswing 7, impact 6, finish 2; levels 1/2/3 = 14/13/3; where: range 12, home 7, both 11), each with aim, cue, scored test, why, kit, steps, feel, mistakes, dose, success, progression, and a choreographed 3D demo — [drills.js:1-12](drills.js) (counts from grep).
- "Every drill has a 3D demo and a live mode that coaches you through your camera"; filter chips by where and part of swing — [index.html:2181-2192](index.html). *Note: only 22 live specs exist in live.js vs 30 drills, so "every" may be overstated (inferred).*
- Drill Studio: posable 3D golfer, real equipment, moving camera, body-pinned labels, arrows, red "not this" ghost, traced hand path, tick/cross; falls back to a flat drawing without WebGL — [drillstudio.js:1-5](drillstudio.js). Realistic skinned human (MakeHuman CC0) — [golfer.js:1-2](golfer.js).
- Practice coaching: scored test on every drill, progress steps (two passes in a row move you on), a two-week focus that shapes the weekly plan, and "What's your miss?" (ball flight → cause → drills, with quick self-checks) — [app-4.js:1-3](app-4.js); [coach.js:1-12](coach.js).
- Weekly practice plan: "three sessions to tick off", built from swing and rounds — [app-3.js:308](app-3.js).
- Swing guide ("Yardage Book"): what good looks like, ball-flight laws table (flips for handedness), filming tips, about/data — [index.html:2330-2350](index.html).

**Play: rounds, GPS, course maps**
- Round tracker with New round / My rounds / Club tabs — [index.html:2356-2360](index.html); [app-1.js:1292](app-1.js).
- Course search: UK courses from OpenStreetMap (Nominatim + Overpass), near GPS or by name, or a remembered postcode/town — [app-1.js:1407-1408, 2060-2062](app-1.js); [HOW-TO-PUT-IT-ONLINE.txt "HOW IT WORKS WITHOUT CLAUDE"](HOW-TO-PUT-IT-ONLINE.txt).
- GPS: satellite hole map (ArcGIS imagery), live position, yards to middle of green, tap to measure, big "at a glance" on-course view; auto-advance to next hole after walking 40 m — [app-1.js:1838-1856, 2007, 2242-2246](app-1.js); [flyover.js:4](flyover.js).
- 3D hole flyover (satellite over terrain heights, tee-to-green camera, pin and yardage markers) — [flyover.js:1-2](flyover.js).
- Automatic "green finder" that spots greens in satellite pixels and assigns them to holes using scorecard yardages; learns greens from where you pause before scoring — [app-2.js:2-3, 128-200](app-2.js); [app-1.js:2242](app-1.js).
- Crowd-sourced course mapping "the way TheGrint and 18Birdies do it" (tee, front/middle/back, fairway target), one vote per account, majority within 12 m wins; shared scorecards, ratings, slopes and stroke indexes (most common value wins) — [app-2.js:238-426](app-2.js).
- Live pins: golfers mark today's hole; confirmed when two agree within 4 m; club pin sheet wins; clears at midnight (London) — [app-3.js:1374-1380](app-3.js).
- On-course extras: weather (wind, gusts, temperature, rain) and "plays-like" distance with club suggestion from your bag, shot tracking (mark each shot to measure distance), per-hole notes, up to three playing partners on one phone with handicaps — [app-3.js:438-537](app-3.js).
- Scoring: shots received, net, Stableford; stats: fairways, GIR, putts; strokes gained vs PGA Tour baseline (Broadie tables) — [app-3.js:817-845](app-3.js).
- Side games: skins (net if handicaps known) and four-ball better ball — [app-3.js:538-545](app-3.js).
- Group rounds: 5-character code, friends score on their own phones and see cards live — [app-3.js:738-764](app-3.js); [HOW-TO-PUT-IT-ONLINE.txt](HOW-TO-PUT-IT-ONLINE.txt).
- Export: scorecard text to paste, all rounds as a spreadsheet — [app-3.js:798-802](app-3.js).

**Handicap (WHS)**
- WHS "the way England Golf does": course handicap, 9-hole handling, net double bogey AGS (par+5 with no index), 2024 rules for 9- and 10-17-hole rounds (expected score), score differential with PCC taken as 0, exceptional score reduction, soft/hard caps against low index (after 20 scores) — [whs.js:1-151](whs.js); [app-3.js:907](app-3.js).
- Handicap is computed on the phone; leaderboard points use 95% of course handicap and are re-scored by the server — [README.md "What the server enforces"](README.md); [supabase/migrations/20261112_verify_leaderboard.sql:1-4](supabase/migrations/20261112_verify_leaderboard.sql).

**Clubs, leaderboards, competitions, coaching**
- Club leaderboards: best Stableford round of the month and most-improved handicap — [app-3.js:607-609](app-3.js).
- Club competitions: anyone at the club can set one up (Stableford or net medal, up to 3 months) — [app-3.js:764](app-3.js); [HOW-TO-PUT-IT-ONLINE.txt](HOW-TO-PUT-IT-ONLINE.txt).
- Club page and club admins (logo, colour, welcome message, official competitions, "Set today's pins", printable pin sheet); admins appointed by the app owner — [app-3.js:1412-1418, 1573-1590](app-3.js); [HOW-TO-PUT-IT-ONLINE.txt "LIVE PINS…"](HOW-TO-PUT-IT-ONLINE.txt).
- Coach–pupil link: coach gets a 6-character code; pupil "Send to my coach" shares scores and up to 5 key-position images (never video); coach sends notes plus a drill back; notes appear on Home — [app-3.js:1514-1572](app-3.js).

**My bag**
- Club yardages (carry and total) for up to a full bag (default 12 clubs), saved with the profile; used for plays-like club suggestions — [index.html:2352-2355](index.html); [app-1.js:1747-1752](app-1.js); [app-3.js:488](app-3.js).

**Profiles, accounts, privacy, sharing, notifications**
- Unique-username profiles (name, photo, home course, handedness); login by username, email optional and used only for password reset; strong-password rules; visitors can look around without a profile (phone-only data) — [app-3.js:2-133](app-3.js); [supabase/functions/cc-auth/index.ts:1-3](supabase/functions/cc-auth/index.ts).
- Profile screens include: settings, handicap, edit, change password, add email, privacy, delete account, feedback, coaching, plus, stats — [app-*.js `profShow(...)` grep](app-3.js).
- Privacy page (UK GDPR): what's kept on phone vs online vs shared anonymously; copy of everything; delete my account — [app-3.js:1133-1140](app-3.js).
- Share cards (1080×1350 image of a round or swing for WhatsApp/Instagram) using the Web Share API — [app-3.js:571-576](app-3.js).
- Send feedback and "Invite a friend" — [HOW-TO-PUT-IT-ONLINE.txt "TESTING ON REAL PHONES"](HOW-TO-PUT-IT-ONLINE.txt); [app-3.js](app-3.js).
- Notifications: local notifications only (when an analysis or trace finishes while in another app), via service worker `showNotification`; no push server — [app-3.js:733-736](app-3.js); [HOW-TO-PUT-IT-ONLINE.txt](HOW-TO-PUT-IT-ONLINE.txt).
- Opt-in anonymous usage counts and Sentry crash reports (no names/emails/locations/videos), asked once — [app-1.js:2-6](app-1.js); [app-3.js:1367-1372, 1603](app-3.js).
- Owner dashboard: golfers per week, 4-week return rate, 30-day counts of rounds/swings/traces/pins/practice/coach shares — [app-3.js:1573-1590](app-3.js).

**Offline / install**
- Installable PWA (en-GB, portrait, standalone) — [manifest.webmanifest](manifest.webmanifest).
- Service worker caches the shell and the pose/hand models so the app "starts instantly even with no signal on the course"; updates download in background with a Refresh bar — [sw.js:1-4](sw.js); [index.html:2380-2400](index.html).

### Inferences
- Breadth is high relative to a one-person tester-stage product; the main weakness is likely depth/polish and discoverability across so many features rather than missing features (inferred).
- Leaderboards, group rounds, competitions and feedback are stored as prefixed rows in one `course_cards` table (`lb~`, `lbh~`, `grp~`, `comp~`, `fb~`), suggesting a quick-build data model that may need hardening at scale (inferred from [app-3.js:607-800](app-3.js)).

### Gaps
- Did not run the app, so UI quality, accuracy of pose/tracer results and real-world reliability are not verified.
- Did not read every drill or every check text; counts come from greps.
- Putting analysis, scheduling/tee-times, social feed, and push notifications were not found in code searches (absence not exhaustively proven).

## Technology stack and architecture

### Takeaway
A no-build static PWA (vanilla JS + three.js) on GitHub Pages with a hand-written TFLite runtime running MediaPipe models on the phone, backed by Supabase (Postgres with RLS, five Deno edge functions). Heavy work stays on-device; the server holds accounts, backups, shared course data and social features.

### Cited Findings
- Static site, no build step: `index.html` + scripts; hosted on GitHub Pages from `main`; `.nojekyll` — [README.md "How it's built"](README.md).
- Large files: app-1.js ~544 KB, app-3.js ~246 KB, index.html ~243 KB, drills.js ~129 KB, drillstudio.js ~114 KB (from `wc -c`).
- Custom plain-JavaScript TensorFlow Lite runtime (reads .tflite flatbuffers, runs the ops BlazePose needs) — [tflite.js:1-2](tflite.js).
- BlazePose pipeline (pose_detection + pose_landmark) — [pose.js:1](pose.js); models in `models/pose_det.tflite`, `pose_lm.tflite`, `hand.tflite` — [models/](models).
- Pose runs in a Web Worker for multi-core phones — [posework.js:1-2](posework.js).
- MediaPipe hand landmark model (21 points per hand), hands found from body pose like MediaPipe Holistic — [hand.js:1-3](hand.js).
- three.js for Drill Studio and the hole flyover; skinned golfer mesh in a custom binary format; motion data in `swing-model.json` (60 fps, phases address…finish) — [golfer.js:1-2](golfer.js); [flyover.js:1-2](flyover.js); [swing-model.json](swing-model.json).
- Swing-scoring is rule-based (no ML classifier): phases, measurements and anchor-curve scores — [metrics.js:1, 291-293](metrics.js).
- Storage: localStorage + IndexedDB (`caddycoach-data`) on the phone; signed-in golfers backed up to Supabase `user_backup` (kinds: round, analysis, course, practice); swing videos never uploaded — [app-1.js:2055-2058](app-1.js); [supabase/migrations/20261111_user_backup.sql](supabase/migrations/20261111_user_backup.sql); [supabase/migrations/20261113_practice_backup.sql](supabase/migrations/20261113_practice_backup.sql).
- Supabase tables seen: profiles, hole_maps, course_cards, user_backup, signup_log, coach_usage, weather_cache, app_owners, club_admins, clubs, pins, usage_events, entitlements, coach_profiles, coach_links, shared_swings, swing_notes — [supabase/setup.sql:122-308](supabase/setup.sql); [supabase/migrations/](supabase/migrations); app table calls in [app-3.js](app-3.js), [app-2.js](app-2.js).
- Security hardening migrations: private profiles (only self + owner), sign-in required to add course data with one vote per account and owner "hidden" flag, closed open DB functions, signup rate-limit log, server-verified leaderboard scoring — [supabase/migrations/20261111_*.sql, 20261112_*.sql](supabase/migrations).
- Edge functions: `cc-auth` (sign up, username login, add/change email, reset password), `cc-signup` (create confirmed login without email using placeholder addresses), `cc-weather` (Met Office if key set, else Open-Meteo; 30-min cache per ~2 km), `cc-stripe-webhook` (records subscriptions in `entitlements`), `cc-coach` (Claude AI coach) — [supabase/functions/*/index.ts headers](supabase/functions).
- External data: OpenStreetMap (Nominatim/Overpass), ArcGIS World Imagery tiles, Open-Meteo/Met Office, Sentry — [app-1.js:2060-2062](app-1.js); [flyover.js:6](flyover.js); [supabase/functions/cc-weather/index.ts:1-4](supabase/functions/cc-weather/index.ts); [app-1.js:2-3](app-1.js).
- CI: GitHub Actions runs script-load checks, WHS tests, drill motion tests, motion-capture tools and a headless phone smoke test of every screen and drill; publish failures open an issue — [README.md "Making a change"](README.md).
- The app also runs inside Claude (`HOSTED_IN_CLAUDE`), using `claude.use('db'|'sample'|'assets'|'downloads'|'user')` for storage and AI there — [app-1.js:1842, 803, 1051, 1122](app-1.js); [app-3.js:12, 813](app-3.js).

### Inferences
- Writing its own TFLite interpreter avoids heavy SDKs and keeps everything offline, but performance on older phones is a risk worth testing (inferred).
- Very large single JS files are a maintainability weakness for future work (inferred).

### Gaps
- No load or performance figures were found in the code reviewed (tools/perf exists but was not read).

## Existing AI integrations

### Takeaway
On-device AI is live (BlazePose body tracking and MediaPipe hand tracking via the custom TFLite runtime). The cloud AI coach (`cc-coach`, Claude Haiku) is fully built with structured output, chat follow-ups, swing memory and daily limits, but is off until an API key is set; the app falls back to its rule-based on-phone coach. A separate in-Claude path uses `claude.use('sample')`.

### Cited Findings
- `cc-coach` "turns the app's own swing measurements into personal coaching, and answers follow-up questions"; only numbers, faults, drills and notes from earlier swings are sent, never video; the prompt is built server-side "so this can't be used as a general chatbot" — [supabase/functions/cc-coach/index.ts:1-4](supabase/functions/cc-coach/index.ts).
- Needs `ANTHROPIC_API_KEY`; without it the function answers 503 and the app keeps its built-in coaching. Default model `claude-haiku-5-5` (overridable via `COACH_MODEL`), described as "about a tenth of a penny per analysis" — [supabase/functions/cc-coach/index.ts:6-8, 21-22](supabase/functions/cc-coach/index.ts).
- Daily limits: signed-in 6 analyses / 20 chat questions; guests 2 / 5; overall ceiling 3,000 per day; tracked in `coach_usage` — [supabase/functions/cc-coach/index.ts:24-25](supabase/functions/cc-coach/index.ts); [supabase/migrations/20261118_coach_usage.sql](supabase/migrations/20261118_coach_usage.sql).
- System prompt: "a straight-talking UK golf coach" for "average weekend club golfers"; rules forbid inventing numbers or things the camera can't see, require "about" for estimates, and limit drills to supplied ids — [supabase/functions/cc-coach/index.ts:80-88](supabase/functions/cc-coach/index.ts).
- App side: "Your coach" card with up to 3 fixes (what you're doing, why, ball effect, drill chips, 30-minute session), a progress note vs earlier swings, and an "Ask your coach" chat with a caution that "AI coaching can be wrong" — [swingcoach.js coachCardHTML/wireChat](swingcoach.js).
- Payload sent includes view, handedness, club, miss, all checks with tour target and verdict, faults, up to 8 related drills, last 6 same-view swings and recurring faults — [swingcoach.js:30-41](swingcoach.js).
- Fallback chain: inside Claude uses the old `coachText` path via `claude.use('sample')`; on the phone app uses `cc-coach`; if no key/offline/limit reached, built-in coaching stays — [swingcoach.js:57-66](swingcoach.js); [app-1.js:802-803](app-1.js).
- Built-in non-AI coach writes summary, strengths and top priority from the measurements on the phone — [app-1.js:2037-2055](app-1.js).
- The Plus upsell copy already says "Unlimited AI swing analysis" — [app-3.js:1507](app-3.js).

### Inferences
- Turning on the AI coach is a configuration step (set the secret), not a build, so strategy should treat it as "launch and tune" (inferred).

### Gaps
- Could not verify whether the API key is set in production (server secret not visible in repo); task brief states it is not set.

## Incomplete or half-built features

### Takeaway
The main built-but-off items are Caddy Coach Plus payments (Stripe), the cloud AI coach, the Met Office weather key, and true push notifications. Commercial launch blockers are documented: hosting off GitHub Pages, Supabase Pro, paid weather/imagery/course-data licences.

### Cited Findings
- "Caddy Coach Plus: switched off until there's a business and a Stripe account"; `PLUS={on:false, monthly:'£4.99 a month', yearly:'£34.99 a year', trialDays:14, linkMonthly:'', linkYearly:'', portal:'', freeSwings:3}` — [app-3.js:1496-1498](app-3.js).
- Plus gates exist in code for swing analysis (beyond 3 free a month), shot tracer, live grip, and swing comparison; free tier keeps GPS, scoring, stats, handicap, leaderboards — [app-1.js:67, 669, 1238](app-1.js); [app-3.js:1503-1508](app-3.js).
- Stripe webhook "does nothing until a STRIPE_WEBHOOK_SECRET secret is set" — [supabase/functions/cc-stripe-webhook/index.ts:1-4](supabase/functions/cc-stripe-webhook/index.ts).
- Launch doc says to set PLUS in `index.html`, but the object is actually in `app-3.js` (doc is out of date) — [HOW-TO-PUT-IT-ONLINE.txt "LIVE PINS…"](HOW-TO-PUT-IT-ONLINE.txt) vs [app-3.js:1498](app-3.js).
- AI coach off without `ANTHROPIC_API_KEY` — [supabase/functions/cc-coach/index.ts:6-7](supabase/functions/cc-coach/index.ts).
- Weather uses Open-Meteo (free for non-commercial use only) until a Met Office key is added — [app-3.js:439-443](app-3.js); [supabase/functions/cc-weather/index.ts:1-4](supabase/functions/cc-weather/index.ts).
- Notifications when the app is closed ("true push") "need a small server" — not built — [HOW-TO-PUT-IT-ONLINE.txt "NEW IN THIS VERSION"](HOW-TO-PUT-IT-ONLINE.txt).
- App store packaging (PWABuilder for Google Play) described but not done — [HOW-TO-PUT-IT-ONLINE.txt "APP STORES"](HOW-TO-PUT-IT-ONLINE.txt).
- Before charging: move hosting (GitHub Pages terms disallow commercial sites), Supabase Pro (free projects pause), paid weather plan, ArcGIS key, own course-data server instead of public Overpass — [README.md "Before charging for the app"](README.md).
- Handicap is still computed on the phone (server trusts it for leaderboards); PCC is taken as 0 — [README.md](README.md); [whs.js:50](whs.js).
- Some smaller courses aren't mapped in OpenStreetMap; golfers set the card and greens once — [HOW-TO-PUT-IT-ONLINE.txt "GOOD TO KNOW"](HOW-TO-PUT-IT-ONLINE.txt).
- Drill motion work in progress: spec/plan to replace robotic pose-blending with real motion-captured swing in Drill Studio; rollout doc covers 25 other drills — [docs/superpowers/specs/2026-10-28-real-swing-motion-design.md](docs/superpowers/specs/2026-10-28-real-swing-motion-design.md); [docs/drills/ROLLOUT.md](docs/drills/ROLLOUT.md).
- No TODO/FIXME or "coming soon" strings were found in app-1..4, swingcoach.js or index.html (grep).

### Inferences
- The project is unusually close to monetisation-ready in code; blockers are business/admin and licensing, not engineering (inferred).

### Gaps
- Whether the real-swing-motion plan is complete across all drills was not verified.

## Intended audience, competitive advantages and weaknesses

### Takeaway
The product is explicitly aimed at average UK weekend/club golfers (en-GB, England Golf WHS, Met Office, UK OSM courses, Stableford), right-handed by default with full left-handed flipping. Its standout advantages are privacy-first on-device analysis, a free tier covering GPS/scoring/handicap, and UK club-social features; weaknesses are web-only distribution, dependence on free/non-commercial data sources, and a crowded feature set built by one person.

### Cited Findings
- AI coach persona: "straight-talking UK golf coach… average weekend club golfers… plain everyday words" — [supabase/functions/cc-coach/index.ts:80](supabase/functions/cc-coach/index.ts).
- Handicap "the way England Golf does", CONGU 2024 rules for GB&I — [whs.js:1, 43](whs.js); manifest `lang: en-GB` — [manifest.webmanifest](manifest.webmanifest).
- Right-handed default with left-handed option: "which way you play: right-handed unless your profile says otherwise" — [app-1.js:1725](app-1.js); `[L]`/`[R]` tokens swap for left-handers in the miss guide — [coach.js:144](coach.js); grip/setup pages note "Shown for a right-handed golfer, as set in your profile" — [index.html](index.html).
- Privacy positioning: "Swing tracking runs on this device"; videos never uploaded; coach shares never include video — [index.html nav footer](index.html); [app-3.js:1133-1140, 1532](app-3.js).
- Scoring benchmarked against tour data and research (24 tour swings, GolfTEC, Sportsbox AI, TPI; Broadie strokes-gained) — [metrics.js:291-293](metrics.js); [app-3.js:839-841](app-3.js).
- Content standards: no drill names a player or coach, no unsupported statistics — [drills.js:10](drills.js); [docs/drills/ROLLOUT.md](docs/drills/ROLLOUT.md).
- Explicit reference to competitors' mapping approach (TheGrint, 18Birdies) — [app-2.js:238-240](app-2.js); [app-1.js:83](app-1.js).
- Planned pricing £4.99/month or £34.99/year with 14-day trial; free tier includes GPS, scoring, stats, handicap, leaderboards and 3 swing analyses a month — [app-3.js:1498](app-3.js); [HOW-TO-PUT-IT-ONLINE.txt](HOW-TO-PUT-IT-ONLINE.txt).
- Coach–pupil sharing aimed at "PGA professional or coach" — [app-3.js:1545](app-3.js).

### Inferences
- Advantages (inferred): one app combining swing analysis + tracer + GPS + WHS + club social, which competitors usually split; strong privacy story; offline-first; UK-specific detail; very low running cost (on-device AI, Haiku coach).
- Weaknesses (inferred): no native app-store presence; course data quality depends on OSM and crowd mapping; 2D single-camera estimates for rotation/plane/clubface; no launch-monitor or wearable integration found; data licences not yet commercial; one developer maintaining a very large codebase.

### Gaps
- No user research, tester feedback or usage numbers were available in the repository (they live in Supabase/Drive, not read).
- Competitor feature comparison requires external research (out of scope here).
