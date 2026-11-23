# Caddy Coach — notes for Claude

Owen's UK golf coaching web app, in testing with a small group of golfers. Owen isn't a developer: explain changes in plain English, keep replies short, and tell him what to check on his phone.

Live: https://stevosadventuretime.github.io/Caddy-Coach/ (GitHub Pages, publishes from `main`).
Project memory in the repo: `docs/PROJECT.md` (architecture, data, decisions, phases, how to test). Read it first.
Project brain (status, decisions, next steps): Google Drive > "Claude Super Brain" > "11 Caddy Coach". Read it at the start of a session if the Drive connector is available, and update its Status / Next steps / Decisions log at the end.

## Save tokens
- These files are huge. **Never read `app-1.js` (540KB), `app-3.js` (245KB), `drills.js`, `drillstudio.js` or `index.html` whole.** Search with grep/rg for the function or text you need, then read only those lines.
- Never open `three.min.js`, `models.js`, `hand_model.js`, `*.wasm`, images or `posters/` — they're vendored libraries and assets.
- Don't scan the whole repo for small tasks. Owen will name the screen or feature; find it with a targeted search.
- Use plan mode for anything touching more than one file. Ask before big refactors.

## How it's built
- Static site, no build step: `index.html` + scripts beside it.
  - App: `app-1.js`, `app-2.js`, `app-3.js`, `app-4.js`
  - 3D drills: `drillstudio.js`, `golfer.js`, `drills.js` (drill library), `coach.js` (miss guide, two-week focus)
  - Swing analysis: `metrics.js`, `pose.js`, `posework.js`, `ideal.js`, `live.js`, `grip.js`, `setup.js`
  - Shot tracer: `tracer.js`, `tracer-ui.js`, `tracer-mp4.js`
  - Handicap (World Handicap System): `whs.js` · Course/GPS: `zones.js`, `flyover.js`
- `sw.js` = offline cache. **Bump its version `V` in every release** or phones keep old files.
- Backend: Supabase project `dhrzscyirgvjwnvgdpqt`. Migrations in `supabase/migrations/` (date order), edge functions in `supabase/functions/` (`cc-auth`, `cc-signup`, `cc-weather`, `cc-stripe-webhook`).
- Settings in `app-3.js`: `APP_OWNER_EMAIL`, `WEATHER`.

## Rules
- Only the public anon Supabase key goes in app files. Never commit the service-role key or any secret.
- Golfer defaults: right-handed, with a left-handed option. Drill/miss text uses `[L]`/`[R]` tokens so it flips for left-handers — never write "left"/"right" directly in `coach.js` guides.
- Keep analysis simple for average weekend golfers, not overly technical.
- UI should feel sleek and premium, not demo-like. Test on a phone-sized viewport.
- Don't host on Netlify (publishing limits) — GitHub Pages for now. Before charging money, hosting must move (GitHub Pages terms) — see README.

## Making a change
1. Branch → pull request → GitHub Actions runs tests → merge to `main` → live in 1–2 minutes.
2. Run tests locally before pushing (`tools/test_coach.js` also runs the coach, brain, round report, achievements, friends, tiers and metrics tests):
   ```
   node --test tools/test_whs.js tools/test_drills_content.js tools/test_coach.js tools/golfer/motion/test_drill_motion.js tools/golfer/motion/test_perf.js
   python tools/ci/smoke.py
   ```
3. Bump `sw.js` `V`. Tell Owen what changed and what to try on his phone.
