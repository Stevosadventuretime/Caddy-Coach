# Caddy Coach: project memory

Read this first in a new session. Keep it short and current. Update it at the end of every phase.

## What it is
Caddy Coach is a UK golf improvement app for average weekend golfers. Its core loop:

swing analysis → weaknesses → personal plan → drills → play → round analysis → update the golfer's profile ("My Golf Brain") → measure → adapt.

It's a static PWA on GitHub Pages (`main`), with Supabase (project `dhrzscyirgvjwnvgdpqt`) for accounts, backup and social. There's no build step.

## How it's put together
- **Core app (very large, never read whole, use grep):** `index.html` (markup + all CSS), `app-1.js` … `app-4.js`.
- **Analysis on the phone:**
  - `pose.js`/`posework.js`/`tflite.js`: the BlazePose models.
  - `metrics.js`: positions, checks, faults.
  - `ideal.js`: the "better position" overlay.
  - `grip.js`/`hand.js`, `setup.js`, `live.js`: the grip, setup and live checks.
  - `tracer*.js`: the shot tracer.
- **Golf data:**
  - `whs.js`: the World Handicap System.
  - `zones.js`, `flyover.js`: course data.
  - `coach.js`: the miss guide and two-week focus.
  - `drills.js`, `drillstudio.js`, `golfer.js`: the drills.
- **New layers.** Each pure-logic file has a Node test. Files that change the page wrap the global functions they need, so the core files barely change.

| Pure logic (tested) | On screen | What it does |
|---|---|---|
| `coachbrain.js` | `coachhub.js` | "Your coach": answers from the golfer's own data, top 3, evidence lines |
| `golfbrainlogic.js` | `golfbrain.js`, `golfbrainui.js` | My Golf Brain: profile, focus with status, coaching history, "why" |
| `roundreport.js` | `perf.js` | Round report, Your progress dashboard, club consistency |
| `achieve.js` | `achieveui.js` | Badges, XP, levels, weekly challenges |
| `friendlogic.js` | `friends.js` | Friends, friends' leaderboards, private competitions |
| `tiers.js` | `plans.js` | Free/Plus/Pro gates, plans screen, anonymous usage counts |
| n/a | `onboard.js` | Welcome questions, tailored first steps |
| n/a | `swingcoach.js` | Optional Claude coach (off: no API key), progress card, plan card |
| n/a | `homehole.js`, `motion.js` | Home scrolling course photo; springs, haptics, transitions |

- **Server:**
  - `supabase/migrations/` in date order.
  - Edge functions: `cc-auth`, `cc-signup`, `cc-weather`, `cc-stripe-webhook`, `cc-coach`. `cc-coach` is deployed but needs an `ANTHROPIC_API_KEY`, which Owen has declined for now.

## Where data lives
- **On the phone:** localStorage and IndexedDB, per profile.
- **Backed up across phones** (`Backup` in `app-1.js`, `user_backup` table): rounds, analyses (without video), courses, practice, and **brain** (from migration `20261123_brain_backup.sql`).
- **Also backed up:** handicap (`HcpCloud`), bag (`BagCloud`).
- **Phone only (fine to lose):** earned-badge dates (`cc_badges`, worked out again from records), visited screens (`cc_seen_*`), coach questions per day.
- **Shared with friends:** `friend_cards`, the golfer's own summary. The server only lets friends and fellow competition members read it.

## Decisions
- No paid services without Owen's OK.
  - Claude coach: off.
  - Payments: off. `PLUS.on=false`, so everyone gets everything.
- Never invent data. Every number is labelled Measured / Calculated / Estimate / You told us, and answers say what they're based on and what's missing.
- At most 3 priorities or fixes at a time.
- Nothing goes live without Owen's approval. Each phase gets a PR, and database migrations are applied only on approval.
- Hosting must move off GitHub Pages before charging (its terms), and the weather, imagery and course data need commercial licences.

## Phases
- **Done:**
  - motion kit, Home redesign (scrolling course);
  - research pack (`research/`, `reports/`);
  - welcome questions, visitor access;
  - Your coach, round reports, Your progress, club consistency;
  - badges/XP/levels/challenges, friends and competitions;
  - plans (Free/Plus/Pro, payments off) and owner retention numbers.
- **In progress:** My Golf Brain foundations (PR `brain-foundation`).
- **Next, from the master prompt:**
  1. Home "current focus" + "Start today's practice", and the improvement timeline.
  2. Practice generator (10–60 min, by location) with a session player.
  3. Swing timeline per measure, comparisons by date.
  4. Round patterns across rounds, quicker round input, shareable report.
  5. Beginner pathway (15 steps), Club DNA.
  6. Entitlements refresh.

## Known issues
- Swing analysis can't be tested end to end here (no sample video), so it needs a real phone.
- Friends and leaderboard stats are worked out on each phone, so a determined user could fake them.
- The Pro tier would need `cc-stripe-webhook` to save plan `'pro'`. Today it saves only the interval.
- Most features haven't yet been checked on a real iPhone by Owen.

## Run and test
- **Preview:** `.claude/launch.json` has Ruby `httpd` servers on ports 8765–8772. Use a fresh origin (`127.0.0.1` vs `localhost`) or unregister the service worker, because it caches by version.
- **Tests:**
  ```
  node --test tools/test_whs.js tools/test_drills_content.js tools/test_coach.js tools/golfer/motion/test_drill_motion.js tools/golfer/motion/test_perf.js
  ```
  `tools/test_coach.js` also runs the metrics, coach, round report, achievements, friends, tiers and brain tests.
- **Smoke test:** `python tools/ci/smoke.py` runs in CI (Playwright isn't installed locally).
- **Ship:** branch → PR → CI → Owen approves → apply any migration → merge → bump `sw.js` V → confirm the live version.
- Node is at `~/.local/node-v22.11.0-darwin-x64/bin` and gh at `~/.local/gh_2.62.0_macOS_amd64/bin`; neither is on PATH.
