# Caddy Coach audit (18 Nov 2026)

How this was checked:
- **Preview:** every screen was opened in a 375×812 phone-sized preview, both as a visitor and as a signed-in golfer (simulated).
- **Code:** the repository was read; the full inventory is in `research_notes/Caddy Coach market research/caddy_coach_inventory.md`.
- **Tests:** `node --test` passes 53 tests, and CI runs a headless phone smoke test of every screen on each pull request.

Legend: **Verified** = seen working in the preview or tests. **Code only** = present in the code but needs a real phone, camera, GPS or account to prove. **Off** = built but switched off.

## Feature state

| Area | Feature | State | Notes |
|---|---|---|---|
| Swing | Analyse a swing: trim, track, 9 positions, 38 checks, measured/estimate tags, fixes, drills | Verified (screens, maths tests); Code only (real video) | No sample video in the repo to run end to end; needs a real swing on a phone |
| Swing | Swing history, compare two swings, progress and recurring faults | Code only | Needs saved swings; visitors need a profile |
| Swing | AI coach (Claude) and "Ask your coach" | **Off** | Needs a paid `ANTHROPIC_API_KEY`; built-in on-phone coaching is used instead |
| Swing | Shot tracer: find ball, fit flight, edit, save MP4/image | Code only | Needs a filmed shot |
| Practice | 30 drills with 3D demo and scored test; 22 with live camera mode | Verified (screens, motion tests) | Copy said "every drill" has a live mode; fixed |
| Practice | Live grip check (hand tracking), live setup check (22 clubs) | Code only | Needs a camera |
| Practice | Weekly plan, two-week focus, "What's your miss?" | Verified | |
| Play | Course search (OpenStreetMap), GPS, flyover, plays-like weather, shot tracking, Stableford, strokes gained, side games, group rounds | Code only | Needs GPS and a course; screens load |
| Handicap | World Handicap System, England Golf rules | Verified (tests) | Official scores must still go through MyEG |
| Social | Club leaderboards, competitions, live pins, club pages, coach–pupil sharing | Code only | Needs accounts |
| Bag | Club yardages, plays-like club suggestions | Verified | Saved on the phone for visitors |
| Account | Profiles, privacy page, delete account, backup | Code only | Not tested against the live server |
| Money | Caddy Coach Plus (£4.99/mo, £34.99/yr) and Stripe | **Off** | `PLUS.on=false` in `app-3.js` |
| Weather | Open-Meteo, Met Office if keyed | Live (Open-Meteo) | Open-Meteo's free tier is non-commercial only |
| Alerts | Local notifications only | Live | True push needs a server |

## Problems found

**Fixed in Phase 1:**
- Visitors were blocked from almost everything, including tools that only run on the phone.
- New golfers were never asked their level or goals, and visitors got no guidance.
- The Drills page said "Drills the tour pros use" with no evidence, and said every drill has a live mode when only 22 of 30 do.
- `HOW-TO-PUT-IT-ONLINE.txt` pointed to the wrong file for the Plus settings.

**Still to fix (later phases or admin):**
- Before charging money:
  - Hosting must move off GitHub Pages (its terms don't allow commercial use).
  - The weather, satellite imagery and course data need commercial licences.
- Social data (leaderboards, groups, competitions, feedback) all lives in one `course_cards` table, told apart by key prefixes. It works, but it should get proper tables before it grows.
- Handicaps are worked out on the phone. The server re-scores leaderboard points but trusts the handicap.
- The main files are very large (`app-1.js` is about 540 KB). New features go in new files (`swingcoach.js`, `homehole.js`, `onboard.js`) to keep things manageable.

## Costs today
- **Hosting:** GitHub Pages (free).
- **Database and accounts:** Supabase free tier.
- **AI:** pose and hand tracking run on the phone at no cost; the Claude coach is off, so it costs nothing.
- **Phase 1 adds no costs.**

## Cheapest way to deliver the next phases
- **AI coach:** answer golfers' questions on the phone from their own data (swings, rounds, bag, handicap, practice). This is free and works offline. Claude can be added later as an optional upgrade at about 0.06p per question, but only with approval.
- **Round reports and dashboards:** work them out on the phone from the data already saved; no new server.
- **Social and gamification:** reuse the existing leaderboards, competitions and Supabase tables, plus new tables only where needed (still the free tier).
