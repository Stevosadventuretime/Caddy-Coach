# Caddy Coach

Golf coaching web app: swing analysis, shot tracer, round scoring with GPS yardages, handicap (WHS), club leaderboards.

- The app is the files in this folder (static site, no build step). Netlify publishes this folder as it is.
- `supabase/` holds the server side: the database setup SQL and the `cc-auth` function (sign-up, log in by username, email, password reset).
- Setup and launch notes: `HOW-TO-PUT-IT-ONLINE.txt`.

Live at https://caddycoach-test.netlify.app. Every push to `main` is published by Netlify automatically.


## Where it's hosted

- **GitHub Pages (free):** https://stevosadventuretime.github.io/Caddy-Coach/ goes live from `main` automatically
  once Pages is switched on (Settings → Pages → Deploy from a branch → `main` / root).
- **Netlify:** `caddycoach-test.netlify.app` also deploys from `main` when the team has build credits.

`.nojekyll` tells GitHub Pages to serve the files exactly as they are.
