# Caddy Coach

Golf coaching web app: swing analysis, shot tracer, drills with a 3D golfer, round scoring with GPS yardages,
a World Handicap System estimate, and club leaderboards and competitions.

Live at **https://stevosadventuretime.github.io/Caddy-Coach/** (GitHub Pages, published from `main`).

## How it's built

- A static site with no build step: `index.html` plus the scripts beside it (`app-1.js`, `app-2.js`, `app-3.js`
  for the app, `drillstudio.js` and `golfer.js` for the 3D drills, `tracer.js` for the shot tracer,
  `metrics.js` for swing scoring, `whs.js` for the handicap maths).
- `sw.js` keeps the app working offline. **Change its version `V` in every release** so phones pick up the new files.
- Server side is Supabase (project `dhrzscyirgvjwnvgdpqt`):
  - `supabase/migrations/`: database changes, applied in date order.
  - `supabase/functions/`: edge functions (`cc-auth` and `cc-signup` for accounts, `cc-weather`, `cc-stripe-webhook`).
  - `supabase/email-templates/`: the branded password-reset email (paste into Supabase > Authentication > Emails).
- Only the public (anon) Supabase key is in the app. Never put the service-role key or any other secret in these files.

## What the server enforces

- Course maps and scorecards can only be added by signed-in golfers; each account gets one vote, and the app
  owner can hide a bad row (tick `hidden` in the table editor). Hourly limits per account.
- A golfer's profile (name, photo, home course) is readable only by them and the app owner.
- Leaderboard and competition points are worked out by the server from the hole scores, using 95% of the course
  handicap. The handicap itself still comes from the golfer's phone.
- Rounds, swing results and yardages are backed up to the golfer's own rows (`user_backup`); swing videos stay on the phone.
  Visitors who haven't signed up keep everything on the phone only.

## Making a change

1. Work on a branch and open a pull request.
2. GitHub Actions (`.github/workflows/tests.yml`) runs on every pull request: every script loads, the handicap
   rules (`tools/test_whs.js`), the drill motion tests, the motion-capture tools, and a headless phone smoke test of
   every screen and drill (`tools/ci/smoke.py`).
3. Merge to `main`; GitHub Pages publishes within a minute or two. If publishing fails, an issue is opened
   (`.github/workflows/publish-alert.yml`).

Run the tests locally:

```
node --test tools/test_whs.js tools/test_drills_content.js tools/golfer/motion/test_drill_motion.js tools/golfer/motion/test_perf.js
(cd tools/golfer/motion && python -m pytest -q)
python tools/ci/smoke.py
```

## Before charging for the app

- Move hosting off GitHub Pages: its terms don't allow commercial sites (Cloudflare Pages, Netlify or Vercel can
  serve these files as they are).
- Supabase Pro (free projects pause after a week without activity).
- Licences: a paid weather plan, an ArcGIS key for satellite imagery, and your own course-data server rather than
  the public Overpass servers. See `HOW-TO-PUT-IT-ONLINE.txt` and `CREDITS.txt`.

`.nojekyll` tells GitHub Pages to serve the files exactly as they are.
