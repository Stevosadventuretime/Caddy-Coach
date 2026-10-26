# Caddy Coach

Golf coaching web app: swing analysis, shot tracer, round scoring with GPS yardages, handicap (WHS), club leaderboards.

- The app is the files in this folder (static site, no build step). Netlify publishes this folder as it is.
- `supabase/` holds the server side: the database setup SQL and the `cc-auth` function (sign-up, log in by username, email, password reset).
- Setup and launch notes: `HOW-TO-PUT-IT-ONLINE.txt`.

Live at https://caddycoach-test.netlify.app. Every push to `main` is published by Netlify automatically.
