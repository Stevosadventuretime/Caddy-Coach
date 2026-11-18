# Caddy Coach competitor analysis: 70+ apps across golf, fitness, learning and social

Part of the Caddy Coach research pack (November 2026): [Executive summary](./EXECUTIVE_SUMMARY.md) · **Competitor analysis** · [Customer pain points](./CUSTOMER_PAIN_POINTS.md) · [Feature ideas](./FEATURE_IDEAS.md) · [Commercial opportunities](./COMMERCIAL_OPPORTUNITIES.md) · [Product roadmap](./PRODUCT_ROADMAP.md) · [Research sources](./RESEARCH_SOURCES.md) · [Full research report](../reports/Caddy%20Coach%20market%20research.md)

**How to read this document**
- **Labels.**
  - **VERIFIED FACT**: from the linked source, accessed 18 Nov 2026. Every fact in the app profiles is a verified fact unless labelled otherwise.
  - **ESTIMATE**: my calculation.
  - **RECOMMENDATION**: my opinion. The "Lesson for Caddy Coach" and "Golf adaptability" lines are always recommendations.
- **Missing data.** "Not in research" means the research notes had nothing on that point. I have not filled gaps from memory.
- **Price notes.**
  - UK App Store listings show in-app purchase (IAP) price points without saying which plan each belongs to, so treat GBP lists as price points.
  - Several prices come from search summaries or from competitors' blogs. These are marked *(secondary)* or *(competitor source)*.

---

## Caddy Coach today: what already exists

Facts in this section come from the Caddy Coach code, read on 18 Nov 2026 (file references given). Strengths and weaknesses are RECOMMENDATIONS/assessments.

| Area | What exists (VERIFIED FACT, code) |
|---|---|
| Structure | Five tabs: Home, Play, Swing, Practice, My bag. Golf-course themed menu ("The Tee Box", "Hole 1 · The Tee"…) (`app-1.js:45-47`; `index.html` nav) |
| Home | Start-a-round card, stats strip, Updates inbox, getting-started checklist, handicap card, home-course map, goals, weekly plan, "Your year in golf", today's focus with a drill, quick-start tiles. On phones, scrolling flies down an aerial golf hole (`index.html:2089-2108`; `homehole.js`) |
| Swing analysis | Upload or record; face-on or down-the-line; club and usual miss; auto trim. 9 key positions, 9 report areas, **38 rule-based checks** scored against 24 tour swings plus GolfTEC/Sportsbox/TPI gaps. "Measured" vs "estimated" labels. Miss-to-cause links. "You + better position" overlay. Fault clips. Plain-English report. History, trend and consistency. Two-swing compare. Recurring-fault detection. A 30-minute practice plan for the #1 fix (`metrics.js:291-391`; `app-1.js:758-1203`; `swingcoach.js`) |
| AI | On-phone BlazePose body tracking and MediaPipe hand tracking via a custom TFLite runtime. The cloud AI coach (`cc-coach`, Claude Haiku 5.5) is built with up to 3 fixes, a progress note, "Ask your coach" chat, memory of the last 6 same-view swings and daily limits, **but is switched off** (no API key). A rule-based coach runs offline (`cc-coach/index.ts`; `app-1.js:2037-2055`) |
| Shot tracer | Finds ball, impact and flight; fits a 3D flight; editable; 7 colours; own MP4 writer; explains face and path; feeds the swing report (`tracer.js`; `tracer-mp4.js`) |
| Live camera checks | Grip check (21 hand points per hand, spoken cues), setup check for 22 clubs from both views, live drill feedback (22 drill specs) (`grip.js`; `setup.js`; `live.js`) |
| Drills and practice | 30 drills with 3D demos (Drill Studio, realistic golfer). Scored tests, progress steps, two-week focus, "What's your miss?" guide, weekly plan of three sessions, practice streak, Swing guide (`drills.js`; `coach.js`; `app-4.js`; `app-3.js:308-387`) |
| Play | UK courses from OpenStreetMap. GPS satellite maps, tap to measure, auto-advance, 3D flyover, automatic green finder, crowd-sourced mapping, live pins, weather and plays-like club suggestion, manual shot tracking, notes, up to 4 golfers on one phone (`app-1.js`; `app-2.js`; `app-3.js:438-537`; `flyover.js`) |
| Scoring and handicap | Net and Stableford. Fairways, GIR, putts. Strokes gained vs PGA Tour (Broadie). Skins and better ball. Group rounds by code. Text and spreadsheet export. WHS "the way England Golf does", including 2024 9-hole rules and caps (`app-3.js:538-845`; `whs.js`) |
| Clubs and coaching | Club leaderboards (best monthly Stableford, most improved), club competitions, club pages and admins, printable pin sheet, coach–pupil link (scores and up to 5 images, never video; coach sends notes and a drill) (`app-3.js:607-1590`) |
| Account and platform | Username profiles, UK GDPR privacy page, share cards, invite a friend, feedback, opt-in anonymous analytics and Sentry, owner dashboard, installable offline PWA. Local notifications only (`app-3.js`; `sw.js`; `manifest.webmanifest`) |
| Built but switched off | Caddy Coach Plus (Stripe) at £4.99/mo or £34.99/yr with a 14-day trial; cloud AI coach; Met Office weather key; true push; Google Play packaging (`app-3.js:1496-1498`; `README.md`; `HOW-TO-PUT-IT-ONLINE.txt`) |
| Not found | Putting analysis, tee times, social feed, push notifications, app-store listing, launch-monitor or wearable link |

**Strengths (RECOMMENDATION/assessment)**
1. **Breadth no single rival matches.** Swing AI, tracer, GPS, WHS and club social are normally split across 3–4 apps.
2. **Privacy and speed.** Analysis runs on the phone, video is never uploaded, and it works offline.
3. **UK-specific detail.** England Golf WHS rules, Stableford, UK courses, Met Office, en-GB.
4. **Analysis from both camera angles, face-on and down-the-line.** Mustard's main complaint is that it handles down-the-line only.
5. **Very low running cost.** The analysis runs on the phone; the AI coach costs about 0.06p a call.
6. **Close to monetisation-ready in code.**

**Weaknesses (RECOMMENDATION/assessment)**
1. **The features are not joined into one weekly loop**, and Home is crowded.
2. **The strongest feature, the AI coach, is off.**
3. **Web-only distribution:** no app store.
4. **Data dependence:** relies on free/non-commercial data (Open-Meteo, public Overpass, ArcGIS without a key) and on GitHub Pages, which forbids commercial use.
5. **Accuracy is unproven:** single-camera 2D estimates for rotation, plane and clubface, with no published accuracy test.
6. **No push notifications**, so no way to bring people back.
7. **One developer** maintaining very large files.

---

## Market map in one table

| Group | Apps | Typical UK price (VERIFIED FACT) | What Caddy Coach should take from it (RECOMMENDATION) |
|---|---|---|---|
| Free GPS + paid AI/strategy tier | 18Birdies, Hole19, Golfshot, SwingU, TheGrint, GolfLogix | £50–£70/yr mid tier; £99.99 "AI" tier | A post-round report linked to a drill; a generous free core |
| Hardware trackers | Arccos, Shot Scope, Garmin | £135–£350 hardware; Arccos plus a subscription | Avoid hardware; offer low-effort phone capture |
| Social, society and tournament | Golf GameBook, Squabbit, VPAR, ParUp, society apps | Free to £399.99 (organiser tiers) | Organiser-pays society mode |
| UK official | MyEG, HowDidiDo, iGolf | £0–£46/yr | Be the companion, not the rival |
| AI swing apps | Sportsbox, GolfFix, Mustard | about £50–£150/yr | Instant verdicts, missions, both camera angles, lower price |
| Coach tools and marketplaces | V1, Skillest, CoachNow, OnForm | $299–$899/yr for coaches | Cheap coach seats; paid human review |
| Content academies and strategy | Me and My Golf, DECADE, GolfPass, CORE | about £26–£300/yr | Score-goal roadmaps; a "start from the miss" Shot Fixer |
| Fitness/subscription | Strava, Runna, Whoop, Garmin Connect+, Oura, Apple Fitness+ … | £5.99–£17.99/mo | One number on Home; a yearly recap; never paywall free features |
| Learning/gamification/social | Duolingo, FPL, Pokémon GO, Letterboxd … | Mostly free + about £4–£10/mo | Forgiving streaks, friend streaks, leagues, events, a diary |

---

## A. Golf GPS, scoring and stats apps

### 18Birdies
- **What it does.** Free GPS rangefinder, scorecard, handicap tracking, side games and social feed ([App Store GB](https://apps.apple.com/gb/app/18birdies-golf-gps-tracker/id892700751)).
- **Main selling point.** A big free app. 10 million cumulative users by June 2026 ([18Birdies](https://18birdies.com/clubhouse/community/10-million-golfers-10-dream-courses-10-weeks)); 31M+ rounds tracked in 2025 ([18Birdies](https://18birdies.com/clubhouse/community/the-18-birdies-2025-community-year-in-review)).
- **Most innovative.** Premium includes Plays Like, club recommendations, Tee Shot Planner, Course Strategy, 3D/heatmap Green Maps, Live Coach, Smart Tracking (automatic shot detection), strokes gained, an AI Swing Analyzer, Swing Signature and Meta AI Glasses support ([18Birdies help](https://help.18birdies.com/article/661-whats-included-with-18birdies-premium)).
- **What brings users back.** Free games (Skins, Wolf, Dots), social feed, community campaigns such as a 10-week sweepstakes. Peak day was 198K rounds on 3 Aug 2025.
- **Money.** UK IAPs: yearly £99.99/£105.99, a £69.99 yearly, monthly £9.49–£19.99, weekly £6.99–£7.99. US: $99.99/yr or $19.99/mo ([App Store GB](https://apps.apple.com/gb/app/18birdies-golf-gps-tracker/id892700751); [18Birdies Premium](https://18birdies.com/premium/)). 7-day trial ([Golf Pad comparison](https://golfpadgps.com/news/golf-pad-vs-18birdies-vs-golfshot), *competitor source*).
- **Users love.** "the yardages are very accurate". Rated 4.9 from about 15,000 UK ratings.
- **Complaints.** The Watch app skips or starts on the wrong hole ("absolutely unusable"); rounds fail to save; pushback on the roughly $100/yr price ([Marlvel](https://marlvel.ai/apps/18birdies-golf-gps-tracker), *aggregator*); upgrade prompts in the free version ([Reddit snippet](https://www.reddit.com/r/golf/comments/1h2p7lo/anyone_use_18_birdies_if_so_care_to_share_your/)); strokes gained is paywalled ([Golf Insider UK](https://golfinsideruk.com/best-golf-apps/)).
- **UX strengths.** Keeps the social and game features free and charges for decision features.
- **Lesson for Caddy Coach.** Free social and games bring people back. Avoid nagging upgrade prompts and don't ship a watch app until it is reliable.

### Hole19
- **What it does.** Free GPS for 42,000+ courses, scorecard, live leaderboards, Apple Watch GPS, social ([App Store GB](https://apps.apple.com/gb/app/hole19-golf-gps-range-finder/id794462227)).
- **Main selling point.** Simple, clean GPS. It has "a cleaner interface with fewer pop-ups" than 18Birdies ([Golf Insider UK](https://golfinsideruk.com/best-golf-apps/)).
- **Most innovative.** The Otto AI (launched 9 Jul 2025; Hole19 claims 5M+ users and 70M rounds) ([First Call Golf](https://www.firstcallgolf.com/industry-news/release/2025-07-09/hole19-launches-otto-ai)). The Intelligence tier writes a post-round report on strengths, weaknesses and focus, and adds auto shot detection, strokes gained and handicap benchmarking ([Hole19 blog](https://www.hole19golf.com/the-19th-hole/hole19-intelligence-tier); [Golf Monthly, sponsored](https://www.golfmonthly.com/gear/hole19-launches-intelligence-plan-to-help-golfers-lower-scores-faster)).
- **What brings users back.** Handicap tracking ("within seven rounds I think I've got my handicap down considerably").
- **Money.** Premium Pro £59.99/£69.99 a year, 6 months £49.99, monthly £9.99/£12.99; Intelligence £99.99 a year (UK IAPs). US: $69.99/yr or $14.99/mo with a 14-day trial ([Hole19 Premium](https://www.hole19golf.com/premium)). A UK golfer saw a £30 offer ([r/BritGolf](https://www.reddit.com/r/BritGolf/comments/1wj79r2/hole19_vs_18birdies_vs_the_grint/), *anecdote*).
- **Users love.** Rated 4.8 from 14k UK ratings.
- **Complaints.** Slows during a round and "drains the battery rapidly" (2018–23 reviews); Premium "Feels super clunky and confusing" ([Reddit snippet](https://www.reddit.com/r/BritGolf/comments/1wj79r2/hole19_vs_18birdies_vs_the_grint/)).
- **UX strengths.** Free live leaderboards and wrist yardages.
- **Lesson for Caddy Coach.** **The closest rival to the A2 debrief idea, but priced at £99.99.** Caddy Coach can offer it in a £44.99 Plus and join it to swing data.

### Arccos Caddie
- **What it does.** Hardware-led automatic shot tracking via sensors or smart grips; AI rangefinder, AI caddie, strokes gained, web dashboard ([Arccos UK](https://uk.arccosgolf.com/pages/arccos-product-comparison)).
- **Main selling point.** Automatic tracking. Arccos claims new users cut their handicap by 5.7 strokes in year one ([GolfMagic](https://www.golfmagic.com/equipment/buying-guides/best-golf-apps); *company claim*).
- **Most innovative.** Arccos Air: a pocket wearable, "No sensors. No phone. Just golf.", "powered by AI trained on 1.5 billion real golf shots" ([Arccos Air](https://uk.arccosgolf.com/products/air)). AI Strategy is now bundled with the Smart Laser ([Golf Digest](https://www.golfdigest.com/story/arccos-smart-laser-rangefinder-now-to-include-app-access-to-ai-c)).
- **What brings users back.** Automatic data with no input during the round.
- **Money.** Smart Sensors £179.99 MSRP (seen at £134.99), grips from £199.99, first year included; US $249.99 then $199.99/yr; Air $349.99 ([Arccos](https://www.arccosgolf.com/products/smart-sensors); [American Golf](https://americangolf.co.uk/balls-accessories/shot-swing-trackers/arccos-caddie-generation-3%2B-smart-golf-sensors-408423.html)). No official GBP renewal price.
- **Users love.** Rated 4.6 in an aggregator analysis of Reddit ([GummySearch](https://gummysearch.com/tools/best-products/golf-app/)).
- **Complaints.** Cost: "the £99 sub was hard to justify", "their yearly subs is a robbery" ([Golf Monthly forum](https://forums.golfmonthly.com/threads/who-has-moved-away-from-arccos.118414/)); missed shots and editing ([GolfWRX](https://forums.golfwrx.com/topic/2029985-its-time-to-move-on-from-arccos-other-options-for-tracking-rounds/)); "their mapping of my course is awful"; only the first putt is auto-tracked ([MyGolfSpy](https://forum.mygolfspy.com/topic/64377-unofficial-review-arccos-golf-performance-tracking-system/)).
- **UX strengths.** No phone needed (Air).
- **Lesson for Caddy Coach.** Golfers leave when hardware plus a subscription feels expensive and capture needs fixing. Don't build hardware. Make phone capture forgiving instead.

### Shot Scope
- **What it does.** GPS watches (e.g. V5) with club tags for automatic tracking; 100+ stats including strokes gained and handicap benchmarking ([American Golf](https://www.americangolf.co.uk/gps/shot-scope-v5-gps-golf-watch-434900.html)).
- **Main selling point.** **No subscription.**
- **Most innovative.** Strokes gained course analysis ([MyGolfSpy](https://mygolfspy.com/news-opinion/shot-scope-adds-strokes-gained-course-analysis-features/)).
- **What brings users back.** Free stats after a one-off purchase. About 6 GolfWRX posters moved to it from Arccos ([GolfWRX](https://forums.golfwrx.com/topic/2029985-its-time-to-move-on-from-arccos-other-options-for-tracking-rounds/)).
- **Money.** V5 RRP £239.99 (seen at £199.99), "no extra costs or subscription fees" ([Clubhouse Golf](https://www.clubhousegolf.co.uk/acatalog/Shot-Scope-V5-Golf-GPS-Watch-Grey.html)).
- **Users love.** Golf Monthly calls the strokes gained data "exceptionally useful" ([Golf Monthly](https://www.golfmonthly.com/reviews/gps/shot-scope-v5-golf-gps-watch-review)).
- **Complaints / UX strengths.** Not in research.
- **Lesson for Caddy Coach.** "No subscription" wins people who resent subscriptions. Caddy Coach's free tier must stay genuinely useful.

### Golfshot
- **What it does.** GPS with augmented reality (AR). Pro adds auto shot tracking, Apple Watch, club recommendations and 3D flyovers; a "Champions" tier adds Golfplan coaching ([Golfshot help](https://shotzoom.zendesk.com/hc/en-us/articles/360000956554-What-is-Golfshot-Pro-and-what-does-it-cost); [Golf Monthly](https://golfmonthly.com/features/what-is-the-difference-between-golfshot-and-golfshot-pro)).
- **Money.** $69.99/yr or $14.99/mo ($39.99/yr for Plus members, undated) per the official help centre; $79.99 per other sources ([Golfshot blog](https://golfshot.com/blog/golfshot-vs-18birdies-two-of-the-most-used-golf-apps)).
- **Complaints.** In-round upsells were the most common complaint in an aggregator's Reddit analysis ([GummySearch](https://gummysearch.com/tools/best-products/golf-app/); [Birvix, *biased*](https://birvix.pages.dev/resources/best/best-golf-app-reddit)). Rated 4.1 in that analysis.
- **Brings users back / loves / UX.** Not in research (the UK App Store page returned 404).
- **Lesson for Caddy Coach.** **Never upsell during a round.** Caddy Coach already has 3D flyovers, so no gap there.

### TheGrint
- **What it does.** Handicap-first app (GHIN link in the US, GHAP network elsewhere), GPS for 40,000+ courses, stats, friends, live leaderboards, Skins and Stableford, course rankings ([App Store GB](https://apps.apple.com/gb/app/thegrint-golf-gps-scorecard/id532085262)).
- **Money.** Pro £59.99/yr, monthly £3.99–£7.99, GHAP handicap-only £9.99 (UK IAPs); $59.99/yr ([TheGrint](https://thegrint.com/features/free-vs-pro)).
- **Users love.** Personal customer service; "intuitive interface". Rated 4.8 from 1.2k UK ratings.
- **Complaints.** Scottish course and slope ratings "wildly inaccurate" (2022); price went from $20 to $60 a year ([AppFollow](https://apps.appfollow.io/ios/thegrint-golf-handicap/532085262?country=us)).
- **Brings users back.** Handicap.
- **Lesson for Caddy Coach.** Accurate UK course data, and a personal touch from a founder who answers feedback, are both differentiators.

### Garmin Golf
- **What it does.** Companion app for Garmin watches and rangefinders: shot maps, stats, weekly leaderboards across 43,000+ courses, custom tournaments ([App Store GB](https://apps.apple.com/gb/app/garmin-golf/id1192480582)).
- **Most innovative.** Home Tee Hero virtual rounds with a launch monitor; Green Contours.
- **Brings users back.** Weekly leaderboards and tournaments.
- **Money.** £8.99/mo or £89.99/yr plus hardware.
- **Complaints.** "The tracking of clubs is way out"; can't detect chips or putts without sensors; "The stats are fairly limited". Rated 4.6 from 3.1k.
- **Lesson for Caddy Coach.** Weekly leaderboards across many courses work. A handicap-band effort league (G3) is the coaching version.

### GolfLogix
- **What it does.** 3D GPS known for its animated Putt Line ([App Store US](https://apps.apple.com/us/app/-/id322399059)).
- **Money.** Plus $39.99 (2025) or $59.99/yr (2024); a 2-day putt-line pass for $9.99; printed Green Books about $30–50, which are rules-compliant unlike the app ([Plugged In Golf](https://pluggedingolf.com/?p=77845); [Breaking Eighty](https://breakingeighty.com/golflogix-review)).
- **Loves / complaints / brings users back.** Not in research.
- **Lesson for Caddy Coach.** The short-duration pass is an interesting idea, e.g. a "society weekend pass". Don't build putt lines.

### SwingU (owned by Golf Genius)
- **What it does.** Free GPS, scorecard, handicap after 3 rounds, a daily tip. Plus adds Plays Like, games and Green Maps; Pro adds "Versus" strokes gained, post-round priorities and personalised video drills from top-100 teachers ([App Store GB](https://apps.apple.com/gb/app/swingu-golf-gps-by-golf-genius/id332116103)).
- **Money.** Plus £59.99, Pro £99.99, monthly £9.99–£14.99 (UK IAPs); $99.99/yr includes "a drill after every round" ([SwingU blog](https://swingu.com/blog/best-arccos-alternatives)).
- **Complaints.** Watch stuck on the previous hole; freezes; "purchase premium now messages every couple of days" (2020–21); battery drain ([Reddit snippet](https://www.reddit.com/r/golf/comments/swuj4p/im_looking_for_a_better_golf_app_one_that_doesnt/)). Rated 4.7 from about 18k.
- **Brings users back.** A free daily tip.
- **UX strengths.** Links stats to an action (priority → drill).
- **Lesson for Caddy Coach.** **The "stat → drill" loop is proven and sells at £99.99.** Caddy Coach adds the swing data and 3D drills and charges less.

### Golf GameBook
- **What it does.** Social scorecard with 20 formats, tournaments for up to 72 players (including Ryder Cup-style), feed, GPS, its own handicap. Claims 1.5M+ golfers and 50M+ rounds ([App Store GB](https://apps.apple.com/gb/app/golf-gamebook-scorecard-gps/id409307935)).
- **Money.** Gold/Membership IAPs £19.99, £34.99, £59.99.
- **Users love.** "easiest golf app" tried; accurate GPS; Gold stats "helped their game". Rated 4.7 from 1.8k.
- **Complaints.** Missing courses; mixed-up stroke indexes (older reviews).
- **UX strengths.** Calculates playing handicap per course automatically; syncs to Apple Watch.
- **Lesson for Caddy Coach.** Game variety (S2) and automatic handicap maths matter to groups.

### Clippd
- **What it does.** AI performance analysis across rounds, practice, lessons and simulator; ranks "skill priorities"; coach accounts; Garmin link ([Clippd](https://clippd.com)).
- **Money.** $240/yr or $25/mo; coach accounts described as free.
- **Loves.** Testimonials from college, top-amateur and LPGA players.
- **Complaints / brings users back.** Not in research.
- **Lesson for Caddy Coach.** Priority ranking from all data sources is valued at the elite end. Caddy Coach can bring the same idea to weekend golfers at a fraction of the price (A3).

### Circles (Draw More Circles, UK)
- **What it does.** "Golf intelligence" stats, personalised practice plans, trends, practice logs. Free ([App Store](https://apps.apple.com/us/app/circles-golf/id6444925845); [appshunter](https://appshunter.io/ios/app/6444925845)).
- **Other fields.** Not in research. It may differ from the product the research brief meant.
- **Lesson for Caddy Coach.** There is a UK competitor in stats-to-practice planning; watch it.

### Pinpoint Golf
- **What it does.** Strokes gained stats and GPS to "identify areas for improvement" ([pinpoint.golf](https://www.pinpoint.golf/), *secondary*).
- **Money.** $7.99/mo or $54.99/yr; team plans $24.99–$124.99/mo.
- **Other fields.** Not in research.
- **Lesson for Caddy Coach.** Team plans exist even for stats apps, which supports a society or coach plan.

### Golf Pad
- **What we know.** Mentioned only as where about 3 GolfWRX posters went "because of its low subscription price" ([GolfWRX](https://forums.golfwrx.com/topic/2029985-its-time-to-move-on-from-arccos-other-options-for-tracking-rounds/)).
- **Lesson for Caddy Coach.** Price-sensitive switchers exist.

## B. UK official, society and tournament apps

### My England Golf (MyEG)
- **What it does.** The official England Golf WHS app: pre-register general play, enter scores, a marker verifies ([England Golf help](https://englandgolf.freshdesk.com/support/solutions/articles/80000972978-how-to-add-and-verify-a-score-on-myeg-app)).
- **Main selling point.** Mandatory. From 1 Sep 2025 every score goes through MyEG. 8.96m scores were submitted in the first 8 months of 2025 ([Northern Golfer](https://www.northerngolfer.co.uk/new-whs-record-set-in-england-in-august/); [GolfMagic](https://www.golfmagic.com/news/england-golf-announces-record-breaking-month-world-handicap-system)).
- **Brings users back.** Obligation.
- **Money.** Not stated for the app. iGolf costs £46/yr for golfers without a club.
- **Users love.** Easy card entry, friends list, can submit anywhere in the UK.
- **Complaints.** "generally quite glitchy"; "linking to competitions is farcical"; "Scorecard doesn't show PH"; no results shown; confusing labels; US-style dates; a FootJoy ad; needs signal before teeing off ([Golf Monthly forum](https://forums.golfmonthly.com/threads/myeg-app-feedback.115847/)). Attester not notified and course search failing (Aug 2026) ([Golf Monthly forum](https://forums.golfmonthly.com/threads/myeg-issues.120294/)). Wants "more statistics".
- **Lesson for Caddy Coach.** **The single best partner-shaped gap in the UK: be the friendly, offline, stats-rich companion (P1, P2).**

### HowDidiDo (Club Systems)
- **What it does.** Rebuilt on 12 Jan 2026, merging HowDidiDo, ClubV1 Members Hub and igMember. Dashboard with handicap, competitions, bookings and balances. Claims 1M+ golfers at 2,000+ clubs ([NCG](https://www.nationalclubgolfer.com/club/howdidido-new-app-charges)).
- **Brings users back.** Competition reminders and calendar events.
- **Money.** App £2.99/yr or £9.99/yr ad-free; website free with ads; clubs can pay £1,400/yr for all members.
- **UX strengths.** Easier login, one dashboard, better score entry.
- **Loves / complaints.** Not in research.
- **Lesson for Caddy Coach.** UK golfers now accept small app fees, and clubs buy member-wide licences.

### iGolf (England Golf)
- **What it does.** Official WHS handicap for golfers without a club, £46/yr ([GolfMagic](https://www.golfmagic.com/equipment/buying-guides/best-golf-apps)). 72,921 users in 2025, up 34% ([England Golf](https://www.englandgolf.org/news-detail?newsarticleid=1416)).
- **Lesson for Caddy Coach.** A growing group of non-club golfers who already pay for golf admin. A good target audience.

### Squabbit
- **What it does.** Tournaments, leagues and societies: live leaderboards, many formats, season leaderboards, GPS, Watch, automatic handicaps, CSV export, group chat; 30k+ courses ([App Store GB](https://apps.apple.com/gb/app/id1556538444)).
- **Most innovative.** Leaderboard change notifications; "Tip a beer" IAPs (£4.99).
- **Brings users back.** Organisers running seasons.
- **Money.** Player Pro £59.99 or £4.99 per event; Tournament Pro £99.99 or £29.99 per event; League Pro £249.99; Club Pro £399.99; tips £4.99–£99.99.
- **Users love.** "Just punch in the gross score and it worked out their points"; handled 50–72 players. Rated 4.9 from 1.2k.
- **Complaints.** Weak signal delays updates; slope settings confusing.
- **Lesson for Caddy Coach.** **The pricing template for Society mode (S1):** organiser pays, per event or per season.

### VPAR
- Live leaderboards for group events, GPS on 40,000 courses, stats; Premium £49.99/yr ([GolfMagic](https://www.golfmagic.com/equipment/buying-guides/best-golf-apps)). Other fields not in research.
- **Lesson for Caddy Coach.** £49.99 is a normal UK mid-tier price.

### ParUp Golf
- Free UK app for groups and societies: live scoring, group handicapping, chat. Payments and wagers listed as planned. "no hidden paywalls" ([App Store GB](https://apps.apple.com/gb/app/parup-golf/id1546776968); [ParUp](https://parup.golf/)). A testimonial says it beats "spreadsheets and scorecards". Other fields not in research.
- **Lesson for Caddy Coach.** Free society scoring is already available, so Caddy Coach's society mode must add something extra: improvement tables, coaching and season stats.

### Smaller society apps: Golf Society Manager, RiddyGolf, Teeday, My Society Golf
- Golf Society Manager: CONGU handicap adjustment, automatic Stableford and strokeplay ([BetaFamily](https://betafamily.com/app/1926)).
- RiddyGolf: invites, live scorecards, green-fee collection via Stripe ([Golf Business News](https://golfbusinessnews.com/news/new-products/riddygolf-app-aims-to-simplify-society-golf-admin/)).
- Teeday: [App Store](https://apps.apple.com/us/app/teeday/id6763561922).
- Prices, loves and complaints: not in research.
- **Lesson for Caddy Coach.** The society niche is fragmented, with no clear winner. That is an opening.

### GolfNow (tee times)
- The dominant tee-time marketplace. It uses barter (courses give it tee times) and parity terms ([TeeWire](https://teewire.com/teewire-vs-golfnow); [GolfWRX](https://forums.golfwrx.com/topic/2003286-golfnow-biz-model/); [NGCOA](https://www.ngcoa.org/golf-business-weekly/2021/june/week-3/golfnow)).
- **Lesson for Caddy Coach.** Don't compete here.

## C. Golf coaching, swing analysis and launch monitors

### Sportsbox AI (3D Golf)
- **What it does.** 3D swing model from one phone video: turn, tilt, sway, lift. Claims "500+ coaches and 50,000+ golfers"; partners with TaylorMade; sells Sportsbox Studio for bays ([sportsbox.ai](https://www.sportsbox.ai/); [BirdieSwing](https://www.birdieswing.com/blog/best-ai-golf-swing-analyzer-apps), *competitor source*).
- **Most innovative.** SAMI, "your AI swing expert", answers questions from your 3D data. AI Highlights; auto swing detection.
- **Brings users back.** Goals, progress tracking, comparison over time.
- **Money.** Free plan 5 swings a month and "1 recommended goal"; 3D Player $9.17/mo billed annually, i.e. $109.99/yr (third-party monthly prices conflict).
- **Users love.** "enough directionality to be useful" ([GolfWRX](https://forums.golfwrx.com/topic/2061178-sportsbox-vs-swing-coach-ai-apps/)).
- **Complaints.** "just not very 3D accurate"; "particularly terrible UI"; "More numbers than verdicts"; "doubt I'd subscribe" ([Golf Monthly forum](https://forums.golfmonthly.com/threads/sportsbox-ai-has-anyone-tried-it-swing-analysis.119354/)). Its accuracy FAQ shows no figures; it cites its own validation against AMM3D ([Sportsbox help](https://help.sportsbox.ai/sportsbox-ai-accuracy)).
- **UX strengths.** One recommended goal.
- **Lesson for Caddy Coach.** Use a free allowance by count (Caddy Coach already plans 3 a month), one goal at a time, and verdicts rather than numbers.

### GolfFix (MOAIS, Korea)
- **What it does.** Upload a video; "Vision AI" finds faults "Just 10 seconds after uploading". Claims 1.5M+ downloads and 15M+ analyses ([golffix.io](https://www.golffix.io/en/golffix)).
- **Most innovative.** Focus Drill for AI-found weaknesses; Shot Fix Lesson (works back from the slice to causes and drills); Self Record Mode with instant replay; daily and monthly reports with missions; a community with auto-translation; "Pic of the Day".
- **Brings users back.** Reports and missions.
- **Money.** Free with ads; Premium adds advanced AI, monthly report and no ads; $14.99/mo or $99.99/yr per a third party (*unverified*).
- **Users love.** Rated 4.8 from 825 ratings in one snapshot ([App Store](https://apps.apple.com/us/app/golffix-ai-golf-swing-analyzer/id1586120680?see-all=reviews)).
- **Complaints.** Android recording fixed at 60fps; ads and limited history on free ([Google Play](https://play.google.com/store/apps/details?id=kr.co.moais.golffix&hl=en_US)).
- **Lesson for Caddy Coach.** **Reports and missions turn one-off analysis into a habit (A8).** Caddy Coach already has the Shot Fix equivalent ("What's your miss?").

### Mustard Golf (QualiaOS, with Golf Digest)
- **What it does.** AI swing analysis built from motion capture of thousands of swings; pro-coach video tips; at-home drills; progress tracking ([App Store UK](https://apps.apple.com/gb/app/mustard-golf-swing-analysis/id6499280777); [WBD press](https://press.wbd.com/us/media-release/golf-digest/golf-digest-mustard-launch-groundbreaking-ai-powered-platform-mustard-golf-help-every)).
- **Main selling point.** Star coaches (Justin Rose as investor; Mark Blackburn and others).
- **Money.** UK: monthly £9.99 and £24.99; annual £49.99 and £149.99. Rated 4.7 from 465.
- **Users love.** "picks out certain faults in your swing quite accurately"; "by far the best AI app out there".
- **Complaints.** "25 pounds a month though is ridiculous"; "very limited" without face-on analysis; analyses "take a REALLY long time"; asks for a free trial ([App Store US](https://apps.apple.com/us/app/mustard-golf-swing-analysis/id6499280777?see-all=reviews&platform=iphone)).
- **Lesson for Caddy Coach.** **Caddy Coach beats Mustard's top complaints already:** both camera angles, instant on-phone results, lower price. Say so in marketing.

### V1 Golf / V1 Pro
- **What it does.** Manual video tool: slow motion, drawing, side-by-side; its AI (V1CTOR) is for instructors ([BirdieSwing](https://www.birdieswing.com/blog/best-ai-golf-swing-analyzer-apps)).
- **Money.** Basic $9.99/mo or $69.99/yr; Premium $29.99/mo or $359/yr; V1 Pro about $499/yr; lessons $30–$150 ([Skillest blog](https://skillest.com/blog/skillest-vs-v1-golf/), *competitor source*).
- **Complaints.** "will not tell you what is wrong with your swing" ([GOATCode](https://goatcode.ai/v1-golf-app-review-2026-honest.html), *competitor source*).
- **UX strengths.** Drawing tools, voice-over.
- **Lesson for Caddy Coach.** Golfers want a diagnosis, not just tools. Coach software is priced at about $500 a year.

### Skillest
- **What it does.** Marketplace of 1,000+ coaches; video review and live lessons; AI for skeletons and summaries, humans coach ([Skillest](https://skillest.com/features)).
- **Money.** Free for golfers; lessons $1–$400 set by coaches; coach software $59/mo.
- **Lesson for Caddy Coach.** A model for paid pro reviews (A9).

### CoachNow
- Coach–athlete video and messaging. Athlete $59/yr; coach $499/yr; higher plan $899/yr ([coachnow.com](https://coachnow.com/pricing), *secondary, undated*). Other fields not in research.
- **Lesson for Caddy Coach.** A ceiling price for a coach seat.

### OnForm
- Coach-focused video analysis: multi-camera, voice-over, academy tools; "not designed for self-coaching". Personal $4.99/mo or $49.99/yr; Coach $29.99/mo or $299.99/yr; free tier of 10 videos and 5 voice-overs a month ([App Store US](https://apps.apple.com/us/app/onform-video-analysis-app/id1490334045), *secondary*). Has an AI auto-detect camera and "Practice Partner".
- **Lesson for Caddy Coach.** A free allowance by count is standard.

### Hudl Technique (closed)
- OnForm bought it and shut it down on 1 Sep 2021 ([OnForm](https://onform.com/blog/onform-acquires-hudl-technique/); [VisualEyes](https://www.visualeyesapp.com/blog/hudl-technique-replacement)).
- **Lesson for Caddy Coach.** Even big brands abandon standalone technique apps. Combining technique with play is a defence.

### Me and My Golf (UK)
- **What it does.** Coaching-video membership: personalised roadmap, 20+ plans (putting, chipping, breaking 100), practice plans, "Shot Fixer", swing analysis, community, brand discounts, weekly new videos ([App Store UK](https://apps.apple.com/gb/app/me-and-my-golf-coaching-app/id1541212755)).
- **Money.** Core $24.92/mo or $299/yr; VIP $499/yr; 7-day trial ([meandmygolf.com](https://meandmygolf.com/me-and-my-golf-membership/), *secondary*). An older UK listing showed £24.99/mo and £209/yr.
- **Users love.** The plans and the fitness plan. Rated 4.2 from 13 UK ratings.
- **Complaints.** App closing on launch (2024); videos not playing (2021).
- **Lesson for Caddy Coach.** **The closest UK content competitor, at roughly £200–£300 a year.** Ability roadmaps (R2) and a Shot Fixer are proven.

### DECADE (Scott Fawcett)
- Course-management system, "not a practice app". Breaking 90 $89 for 6 months; Foundations $125/6 months or $199/yr; Elite $250/$325; no free tier ([DECADE](https://decade.golf/memberships/); [ScoringZone](https://www.scoringzone.net/blog/decade-golf-app-review)).
- **Lesson for Caddy Coach.** Golfers pay for strategy. A simple pre-round game plan (A4) is a cheaper version.

### GolfPass (NBC/Golf Channel)
- Video, GolfPass+ and VIP tiers at $49.99 / $119 / $199.99 (period unclear) ([App Store](https://apps.apple.com/us/app/golfpass-video/id1448493740), *secondary*). Coaching details not confirmed.

### CORE
- UK coaching app at £26.49/yr ([GolfMagic](https://www.golfmagic.com/equipment/buying-guides/best-golf-apps)). Its drills are offered inside Hole19 Intelligence on iOS. Other fields not in research.

### Swing Coach AI
- Mentioned in a GolfWRX thread. Valued for instant feedback and pro comparison, but "thinks my swing is generally better than it is" ([GolfWRX](https://forums.golfwrx.com/topic/2061178-sportsbox-vs-swing-coach-ai-apps/)).
- **Lesson for Caddy Coach.** Grading that is too generous destroys trust (A10).

### Rapsodo MLM2PRO
- Phone-paired launch monitor; Swing Vision and Impact Vision; Bag Mapping; Wedge Matrix. Free £0 (100 shots), Core £159.99/yr (30k simulated courses), Studios £349.99/yr ([Rapsodo UK](https://rapsodo.co.uk/pages/rapsodo-golf-memberships)).
- **Lesson for Caddy Coach.** Launch-monitor owners are a later integration target. Bag mapping relates to P4.

### Garmin Approach R10
- Portable launch monitor; the membership unlocks Home Tee Hero and weekly tournaments; $9.99/mo or $99.99/yr (US) ([PlayBetter](https://www.playbetter.com/blogs/golf-simulator-reviews/garmin-approach-r10-review-golf-launch-monitor-under-1000), *secondary*).

### Trackman Golf app
- Free consumer app for bay booking and data; a separate Golf Pro app with a premium tier (price not found) ([Trackman](https://www.trackman.com/golf/launch-monitors/software)).

### HomeCourt (basketball)
- AI phone-camera training; usable free; $7.99/mo or $69.99/yr ([HomeCourt FAQ](https://www.homecourt.ai/faq/subscription), *secondary*).
- **Golf adaptability.** Direct: proves phone-camera sports AI can be freemium.

## D. Fitness, health and premium subscription apps

### Strava
- **What it does.** "the app for active people": logging, social feed, segments, clubs. 180m+ users ([BikeRadar](https://www.bikeradar.com/news/strava-year-in-sport-2025)).
- **Most innovative.** Segments (7.6m KOM/QOMs or course records in 2025); clubs (new clubs quadrupled to 1m; UK run clubs tripled); Year in Sport, now in its 12th year ([Endurance Sportswire](https://www.endurancesportswire.com/?p=221014); [SGI Europe](https://www.sgieurope.com/case-studies/case-study-how-strava-sells-motivation-to-brands/124154.article)).
- **Brings users back.** Kudos (14bn in 2025, up 20%) and clubs.
- **Money.** UK £8.99/mo or £54.99/yr ([BikeRadar](https://www.bikeradar.com/news/strava-hikes-monthly-subscription-cost-by-more-than-25-per-cent)). Year in Sport is now subscriber-only ([hashe](https://www.hashe.com/tech-news/strava-puts-popular-year-in-sport-recap-behind-an-80-paywall)).
- **Complaints.** Price-rise backlash and an apology ([Cycling Weekly](https://cyclingweekly.com/news/strava-insists-new-pricing-structure-is-legal)); paywalling the recap.
- **UX strengths.** The recap doubles as PR.
- **Golf adaptability.** High. Home-course hole segments (G6), society clubs (S1), Year in Golf (L1).
- **Lesson for Caddy Coach.** Social plus logging is the habit. Don't paywall something people already got free.

### Runna (owned by Strava since April 2025)
- **What it does.** Coach-designed plans adapted by algorithm ([the5krunner](https://the5krunner.com/2026/09/28/is-runna-ai/); [Marathon Handbook](https://marathonhandbook.com/strava-announces-acquisition-of-personalized-training-app-runna/)).
- **Money.** UK £99.99 → £109.99/yr and £15.99 → £17.99/mo from 10 Dec 2026 ([the5krunner](https://the5krunner.com/2026/11/10/quick-read-runna-price-rise); [Runna support](https://support.runna.com/en/articles/18298149-changes-to-our-uk-subscription)). Strava + Runna bundle £119.99/yr, rising to £124.99 ([endurance.biz](https://endurance.biz/?p=89546)).
- **Complaints.** Aggressive plans linked to injury; options added to dial back ([the5krunner](https://the5krunner.com/2026/02/21/runna-ai-marathon-training-injury/)).
- **Golf adaptability.** High. An adaptive practice plan (R3) with an intensity setting (R5).

### WHOOP (and WHOOP Coach)
- **What it does.** A screenless band sold only as a membership, with tiers One, Peak and Life ([Expert Reviews](https://www.expertreviews.co.uk/beauty-wellness/wearables/whoop-5-0-review)).
- **Most innovative.** Weekly "WHOOP Age" and "Pace of Aging" ([Plunge](https://plunge.com/blogs/blog/whoop-launches-5-0-and-mg-devices)); WHOOP Coach (GPT-4, 2023) answers from your own data ([Business Wire](https://www.businesswire.com/news/home/20230926899032/en)).
- **Money.** UK annual only: £169 / £229 / £349 (may be out of date).
- **Complaints.** An upgrade fee broke a promise; reversed after backlash ([TechCrunch](https://techcrunch.com/2025/05/11/fitness-tracker-whoop-faces-unhappy-customers-over-upgrade-policy)); "not great value".
- **Golf adaptability.** Medium. A handicap forecast (P7), a readiness score (U1), coach answers from your own data (A1, A7).

### Garmin Connect / Connect+
- **What it does.** Free hardware companion app; Connect+ (Mar 2025) at £6.99/mo or £69.99/yr adds AI insights ([TechRadar](https://www.techradar.com/health-fitness/smartwatches/furious-garmin-users-revolt-over-new-subscription-service-we-need-to-take-a-firm-stand)).
- **Complaints.** "Furious Garmin users revolt" over feared paywalling; a year later free features hadn't been removed ([TechRadar poll](https://www.techradar.com/health-fitness/ill-switch-to-another-brand-i-polled-over-1-000-garmin-users-to-see-what-they-thought-of-garmins-connect-premium-tier-one-year-after-its-launch)).
- **Golf adaptability.** Lesson: **put only new features in premium.**

### Oura
- Smart ring (Ring 4 from £349) plus £5.99/mo or £69.99/yr; first month free ([TechRadar](https://techradar.com/health-fitness/oura-ring-4-latest-news-rumors-and-what-we-want-to-see); [Currys](https://www.currys.co.uk/brand/oura/oura.html)). Other fields not in research.
- **Golf adaptability.** A daily score on Home (R4).

### MyFitnessPal
- Calorie logging; Premium $19.99/mo or $79.99/yr; Premium+ $24.99/$99.99 (US) ([Garage Gym Reviews](https://www.garagegymreviews.com/myfitnesspal-review)). The barcode scanner moved behind the paywall, drawing complaints ([Recime](https://www.recime.app/blog/myfitnesspal-cost)).
- **Lesson for Caddy Coach.** Don't move the tracer or grip check behind the paywall.

### Freeletics
- Bodyweight/HIIT with an "AI Coach" that adapts from feedback; full coach paid ([findyouredge](https://www.findyouredge.app/news/freeletics-alternatives-uk-2026)). UK IAPs £25.99–£32.99 (2024 listing) ([App Store UK](https://apps.apple.com/gb/app/freeletics/id654810212)).
- **Golf adaptability.** Feedback-adapted sessions (R3).

### Nike Training Club
- Free workouts; former Premium programmes made free to Nike Members ([findyouredge](https://www.findyouredge.app/news/nike-training-club-alternatives-uk-2026)).
- **Lesson for Caddy Coach.** A free app can be a brand funnel, which is relevant to club or brand partners.

### Apple Fitness+
- Instructor video workouts tied to Apple Watch; UK £9.99/mo or £79.99/yr; 1 month free, 3 months with a device ([Apple UK](https://www.apple.com/uk/apple-fitness-plus/)).
- **Lesson for Caddy Coach.** Trials bundled with a purchase work. A club or pro could gift a trial.

### Peloton app
- App One £12.99/mo (3 cardio-equipment classes a month); App+ £24/mo unlimited ([Peloton UK](https://onepeloton.com/en-GB/app)). Added AI coaching alongside price rises ([TechRadar](https://www.techradar.com/health-fitness/exercise-equipment/peloton-revamps-loads-of-its-fitness-equipment-introduces-an-ai-powered-coaching-features-and-of-course-hikes-prices)). Hotel partner distribution.
- **Lesson for Caddy Coach.** Tiers split by usage count are easy to understand ("3 free swing analyses a month").

### Future
- A dedicated human coach backed by AI; reportedly dropped AI-only coaching ([Athletech News](https://athletechnews.com/future-pulls-the-plug-on-ai-personal-training-commits-to-human-coaches/)). About $199/mo ([Garage Gym Reviews](https://www.garagegymreviews.com/future-app-review); [Sensai](https://www.sensai.fit/blog/future-app-review-2026)).
- **Golf adaptability.** High-value hybrid: AI plus a PGA pro review (A9).

### Ladder
- Coach-designed programmes for a "team" of members; about $30–50/mo per a competitor ([Trainwell](https://www.trainwell.net/blog/trainwell-vs-ladder-best-personal-training-apps-compared-2026)).
- **Golf adaptability.** Society or club "team" programmes.

### Zwift
- Virtual world for indoor cycling and running; £17.99/mo or £179.99/yr; Zwift Plus £26.99/mo per a later review ([Zwift UK](https://www.zwift.com/uk/news/33635-how-much-does-zwift-cost-and-whats-included-everything-you-need-to-know); [Velora](https://veloracycling.com/guides/buying/best-indoor-cycling-apps-2026)). Features not sourced.
- **Golf adaptability.** Winter indoor engagement (L4).

### Calm and Headspace
- Meditation and sleep. Calm about £39.99–£49.99/yr (unofficial); via EE £29.99/yr with a 14-day trial ([themindwanders](https://themindwanders.com/headspace-vs-calm/); [EE](https://ee.co.uk/products/calm-trial)). Headspace prices conflict (£49.99–£69.99/yr).
- **Lesson for Caddy Coach.** Partner distribution (EE, Match) works as a channel.

## E. Learning, AI tutors, gamification, social

### Duolingo
- **What it does.** Gamified language learning (plus maths, music, chess). Q4 2025: 133.1M MAU, 52.7M DAU, 12.2M paid subscribers ([Duolingo Q4 via Boardroom Alpha](https://www.boardroomalpha.com/sec/duol-8-k-2026-02-26-0001628280-26-012246/q4fy25duolingo12-31x25pres.htm)). Paid penetration 9.0% ([Q3 2025 letter](https://www.sec.gov/Archives/edgar/data/1562088/000162828025049514/q3fy25duolingo9-30x25share.htm)).
- **Most innovative.**
  - Making one lesson enough to keep a streak raised D14 retention 3.3% ([Duolingo blog](https://blog.duolingo.com/improving-the-streak)).
  - Streak Wager raised D7 by 14%; Weekend Amulet cut streak loss by 5% ([Duolingo engineering](https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)).
  - Friend Streaks held by about one-third of daily users ([Duolingo IR](https://duolingo.gcs-web.com/static-files/3c8277ee-bc94-4f5d-9b77-0db3e46f88b8)).
  - A streak revival brought back 15.4M learners ([Duolingo IR](https://investors.duolingo.com/node/11401/pdf)).
  - 10 weekly leagues ([Duolingo blog](https://blog.duolingo.com/duolingo-leagues-leaderboards/)); Energy ([Duolingo blog](https://blog.duolingo.com/duolingo-energy/)); Video Call with Lily.
- **Brings users back.** Learners on a 7-day streak are 2.4× more likely to return the next day.
- **Money.** Super about £59.99/yr or £4.99–£10.99/mo; Max about £120/yr (secondary, conflicting). AI costs cut gross margin by about 40bps.
- **Complaints.** The Energy change drew petitions ([Change.org](https://www.change.org/p/duolingo-hearts-not-energy)); the "AI-first" memo backlash ([TechRepublic](https://www.techrepublic.com/de/article/news-duolingo-ai-strategy-backlash/)); streak anxiety ([ScreenWise](https://screenwiseapp.com/guides/managing-duolingo-streaks-when-gamification-becomes-stressful)).
- **Golf adaptability.** **Very high: forgiving weekly streaks (G1), partner streaks (G2), effort leagues (G3), effort-earned credits (G8).** Frame AI as "built with a PGA pro", not as a replacement for coaches.

### Brilliant
- Interactive STEM lessons; free users get one daily challenge; Premium removes caps; family plan up to 6; no free trials ([Brilliant help](https://brilliant.org/help/pricing-and-plans/what-s-the-difference-between-free-and-premium/)). About $13.49–$30/mo (third party).
- **Golf adaptability.** A daily 2-minute drill (G10).

### MasterClass On Call
- AI versions of experts as a separate subscription, $10/mo or $84/yr; 7-day guarantee ([Owler/Engadget](https://www.owler.com/reports/masterclass/masterclass--masterclass-on-call-gives-you-on-dema/1734011796857)).
- **Golf adaptability.** A coach persona with a voice; a premium hook later (A6).

### Speak
- Speaking-first AI language tutor; $78M Series C at a $1B valuation ([TechCrunch](https://techcrunch.com/2024/12/10/openai-backed-speak-raises-78m-at-1b-valuation-to-help-users-learn-languages-by-talking-out-loud)); about $100M revenue (Nov 2025) ([Benzinga](https://www.benzinga.com/news/topics/25/11/48975908/this-1-billion-ai-startup-backed-by-openai-khosla-ventures-just-hit-100m-revenue-racing-to-beat-duolingo)); $20/mo or $99/yr. Memory pass shows learners a short summary ([Latent Space](https://latent.space/reading/speak-personalized-language-learning/)).
- **Golf adaptability.** The "what your coach remembers" card (A1).

### Praktika
- AI avatar tutors, "50x cheaper than a tutor"; $8/mo; 1.2M MAU and nearly $20M revenue in 2024 ([TechCrunch](https://techcrunch.com/2024/05/22/praktika-raises-35-5m-to-use-ai-avatars-to-make-learning-languages-feel-more-natural)).
- **Golf adaptability.** The "a coach at a fraction of the price" message.

### Khanmigo (Khan Academy)
- AI tutor; free for US teachers; families $4/mo or $44/yr (secondary) ([Khan Academy blog](https://blog.khanacademy.org/?p=15159)).
- **Golf adaptability.** Free for coaches; the pupil or family pays, which suits the coach seat model.

### Synthesis Tutor
- Adaptive AI maths for ages 5–11 with parent progress reports; about $99/yr (conflicting) ([Brighterly](https://brighterly.com/blog/synthesis-tutor-cost)).
- **Golf adaptability.** Progress reports to a coach or parent, relevant for junior golfers (junior membership up 34%).

### Habitica
- RPG habit tracker with shared party bosses; subscription is cosmetic only ([Habitica wiki](https://habitica.fandom.com/wiki/Class_System); [makerstack](https://makerstack.co/reviews/habitica-review/)).
- **Golf adaptability.** A society boss quest (G7), using gentle stakes only.

### Pokémon GO
- Location AR game; about 20M weekly and 10M daily players (Mar 2025); over $1B revenue in 2025 ([PocketGamer.biz](https://www.pocketgamer.biz/pokmon-go-has-20m-weekly-active-players-nearly-nine-years-after-its-global-launch)). Monthly 3-hour Community Day ([Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Community_Day)).
- **Golf adaptability.** A Saturday-morning Challenge Day (G4).

### Fantasy Premier League
- Free; 11.43M teams in 2024/25 ([Premier League](https://www.premierleague.com/en/news/4362120)); weekly deadlines; elite leagues for the previous season's top players.
- **Golf adaptability.** Weekly deadlines and mini-leagues (S3).

### DP World Tour Fantasy
- Pick six players with a captain; unlimited private code-joined leagues; prizes include season tickets ([europeantour.com](https://www.europeantour.com/dpworld-tour/news/articles/detail/fantasy-dp-world-tour-is-back/)).
- **Golf adaptability.** Proves golfers understand code-joined mini-leagues, which Caddy Coach already uses for group rounds.

### Sleeper
- Social-first fantasy with chat on almost every screen ([TechCrunch](https://techcrunch.com/?p=1868752)); collects league dues; real-money products ([Google Play](https://play.google.com/store/apps/details?id=com.sleeperbot)). Complaints about bugs and gambling promotions ([Action Network](https://www.actionnetwork.com/online-sports-betting/reviews/sleeper)).
- **Golf adaptability.** Chat (S6) is low priority. Avoid money handling.

### Sweatcoin
- Rewards steps; 600+ partners; premium about £4.99/mo (2022) ([DollarSprout](https://dollarsprout.com/sweatcoin-review/); [Daily Mail via PressReader](https://www.pressreader.com/uk/daily-mail/20220706/282265259132422)). Complaints about counting bugs and low-value rewards.
- **Golf adaptability.** Low. Rewards need partners.

### Reddit
- Interest communities; 116.0M DAUq and 443.8M WAUq in Q3 2025 ([Business Wire](https://www.businesswire.com/news/home/20251030834086/en/Reddit-Announces-Third-Quarter-2025-Results/)).
- **Golf adaptability.** Golfers already discuss apps there (r/golf, r/BritGolf). It is a listening channel, not a feature.

### Discord
- Community servers; 200M+ MAU (secondary) ([TechSpot](https://www.techspot.com/community/topics/discord-claims-over-200-million-monthly-active-users-planning-an-ipo.284760/)).
- **Golf adaptability.** A tester community channel. Don't build chat.

### BeReal
- One random daily 2-minute posting window; about 40M MAU in 2025; daily users fell from about 15M to about 6M ([Wikipedia](https://en.wikipedia.org/wiki/BeReal)).
- **Golf adaptability.** Low (U2). Novelty fades.

### TikTok
- Well-being Missions and wind-down features ([TikTok Newsroom](https://newsroom.tiktok.com/introducing-a-new-way-to-unwind-reset-and-recharge-on-tiktok)).
- **Golf adaptability.** Wellbeing guardrails (U3), and TikTok as a share target for tracer reels (S8).

### Instagram
- 2025: opt-in friends map, a Friends tab in Reels, Reposts ([ABC7](https://abc7ny.com/post/what-know-instagrams-new-features-including-map-reposts-friends-reels-tab/17470707/)).
- **Golf adaptability.** Make location sharing opt-in, and use the social proof of "what your friends practised".

### Letterboxd
- Film diary plus social; 30.7M members, up 43% ([TheWrap](https://www.thewrap.com/industry-news/business/letterboxd-sale-gigi-pritzker-investor-consortium-acquisition/)); Pro about $19/yr; Year in Review needs 10 entries ([Letterboxd Pro](https://letterboxd.com/about/pro/)).
- **Golf adaptability.** A round diary (L2) and a Year in Golf that needs at least 10 rounds (L1).

### ChatGPT memory
- References all past chats (Plus/Pro); lightweight version for free users; UK/EEA users see a prompt before it switches on ([TechCrunch](https://techcrunch.com/2025/04/10/openai-updates-chatgpt-to-reference-your-other-chats/); [gHacks](https://www.ghacks.net/2025/06/04/chatgpt-enables-memory-feature-for-free-users/)).
- **Golf adaptability.** Opt-in, editable coach memory (A1).

### Fitbod
- An algorithm picks the next workout from per-muscle recovery; the founder says users want "why" ([TechRadar](https://techradar.com/health-fitness/fitness-apps/its-no-longer-enough-for-an-app-to-tell-you-what-to-do-people-want-to-know-why-fitness-app-fitbods-founder-on-the-reason-behind-the-ai-fitness-boom)).
- **Golf adaptability.** Every tip should say why.

---

## Bottom line (RECOMMENDATION)

**Who Caddy Coach is really up against.** Caddy Coach's real competitors for the *same job* are:
- Hole19 Intelligence and SwingU Pro (£99.99: post-round priority → drill);
- Mustard and GolfFix (AI swing → drills);
- Me and My Golf (UK roadmap content, about £200–£300).

**Caddy Coach can undercut all of them on price and join their jobs together.** The big platforms (18Birdies, Strava, Duolingo) show the habit mechanics to copy. The UK official apps (MyEG, HowDidiDo) show where golfers already are every week and what they wish was better.
