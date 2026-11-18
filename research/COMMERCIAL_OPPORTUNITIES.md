# Caddy Coach commercial opportunities: pricing, unit economics and partnerships

Part of the Caddy Coach research pack (November 2026): [Executive summary](./EXECUTIVE_SUMMARY.md) · [Competitor analysis](./COMPETITOR_ANALYSIS.md) · [Customer pain points](./CUSTOMER_PAIN_POINTS.md) · [Feature ideas](./FEATURE_IDEAS.md) · **Commercial opportunities** · [Product roadmap](./PRODUCT_ROADMAP.md) · [Research sources](./RESEARCH_SOURCES.md) · [Full research report](../reports/Caddy%20Coach%20market%20research.md)

**Labels used:**
- **VERIFIED FACT**: from a source, linked, accessed 18 Nov 2026.
- **ESTIMATE**: my calculation, with the working shown.
- **RECOMMENDATION**: my strategy opinion.

Currency conversions from USD use about £0.79 per $1. That rate is an assumption (it is the rate implied in the commercial research note), not a sourced figure.

---

## 1. The short answer

**RECOMMENDATION:**
- Keep a **generous free app** and sell one subscription, **Caddy Coach Plus**, built around the AI coach.
- **Price:** **£44.99 a year or £6.99 a month**, with a **3-week free trial**.
- **Founding-member price:** testers and anyone who joins in the first season keep **£34.99 a year** for as long as they stay subscribed. That honours the price already written into the app.
- Sell through the web with **Stripe first**, because it costs about 2–3% against the app stores' 15%.
- **Add later:** a small **Society Pass**, a **Coach seat** and, eventually, a **club partner pack**. These are B2B lines where one payer brings many golfers.
- **Do this before charging anyone:** move hosting off GitHub Pages and licence the weather, imagery and course data for commercial use.

---

## 2. What Caddy Coach has already planned (and whether to keep it)

**VERIFIED FACT (code):** "Caddy Coach Plus: switched off until there's a business and a Stripe account":
- `PLUS={on:false, monthly:'£4.99 a month', yearly:'£34.99 a year', trialDays:14, …, freeSwings:3}` (`app-3.js:1496-1498`).
- Plus gates swing analysis beyond 3 free a month, the shot tracer, live grip and swing comparison.
- The free tier keeps GPS, scoring, stats, handicap and leaderboards (`app-1.js:67, 669, 1238`; `app-3.js:1503-1508`).
- The Stripe webhook "does nothing until a STRIPE_WEBHOOK_SECRET secret is set" (`supabase/functions/cc-stripe-webhook/index.ts:1-4`).
- The launch doc says PLUS is set in `index.html`, but it is actually in `app-3.js`. The doc is out of date.

**RECOMMENDATION: keep the structure, change the numbers and the gates.**
1. **£34.99/yr is below every UK golf comparable.**
   - **VERIFIED FACT:** UK App Store prices are Hole19 Premium £59.99/£69.99 a year, TheGrint Pro £59.99, SwingU Plus £59.99, VPAR £49.99, and Golf GameBook IAPs up to £59.99 ([App Store GB, Hole19](https://apps.apple.com/gb/app/hole19-golf-gps-range-finder/id794462227); [TheGrint](https://apps.apple.com/gb/app/thegrint-golf-gps-scorecard/id532085262); [SwingU](https://apps.apple.com/gb/app/swingu-golf-gps-by-golf-genius/id332116103); [GolfMagic](https://www.golfmagic.com/equipment/buying-guides/best-golf-apps); [GameBook](https://apps.apple.com/gb/app/golf-gamebook-scorecard-gps/id409307935)).
   - **VERIFIED FACT:** "AI" tiers sit at £99.99 (18Birdies, Hole19 Intelligence, SwingU Pro) (same App Store sources).
   - **VERIFIED FACT:** AI swing apps Mustard and Sportsbox charge £49.99–£149.99 and about $109.99 ([Mustard App Store UK](https://apps.apple.com/gb/app/mustard-golf-swing-analysis/id6499280777); [Sportsbox via BirdieSwing](https://www.birdieswing.com/blog/best-ai-golf-swing-analyzer-apps)).
   - **VERIFIED FACT:** Adapty found that high-priced annual Health & Fitness plans reach a one-year LTV of $70, against $17 for low-priced ones, and about 90% of subscriptions sell at full price ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)).
   - **So:** £44.99 is still cheaper than every mid-tier GPS app, while including AI swing coaching that rivals charge £99.99+ for.
2. **Keep £34.99 as a founding price, not the list price.**
   - **VERIFIED FACT:** Whoop's broken upgrade promise caused a backlash and a reversal ([TechCrunch](https://techcrunch.com/2025/05/11/fitness-tracker-whoop-faces-unhappy-customers-over-upgrade-policy)).
   - **VERIFIED FACT:** Strava's messy price rise forced an apology ([Cycling Weekly](https://cyclingweekly.com/news/strava-insists-new-pricing-structure-is-legal)).
   - Locking early supporters at £34.99 turns them into advocates.
3. **A monthly price of £6.99, not £4.99.**
   - **ESTIMATE:** Stripe's fixed 20p fee takes about 6.2% of £4.99 (working in section 5).
   - At £4.99 a month against £34.99 a year, the annual plan is only 7 months' worth. That makes monthly attractive to golfers who would cancel every winter.
   - **VERIFIED FACT:** Health & Fitness is 68% annual by plan mix ([RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps)), and annual revenue share rose from 51% to 61% between 2023 and 2025 ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)).
4. **Trial: lengthen from 14 days to about 3 weeks.**
   - **VERIFIED FACT:** 17–32-day trials have a 42.5% median trial-to-paid, against 37.4% for 5–9 days and 25.5% for 4 days or less ([RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps)).
   - Three weeks lets a weekend golfer use the debrief after two or three rounds.
5. **Change the gates.**
   - Do **not** paywall the shot tracer or the grip check. Both are on-phone (no running cost), testers already have them free, and tracer videos are a free advert every time they are shared.
   - **VERIFIED FACT:** paywalling previously free features caused backlash at Garmin, MyFitnessPal and Strava ([TechRadar](https://www.techradar.com/health-fitness/smartwatches/furious-garmin-users-revolt-over-new-subscription-service-we-need-to-take-a-firm-stand); [Recime](https://www.recime.app/blog/myfitnesspal-cost); [hashe](https://www.hashe.com/tech-news/strava-puts-popular-year-in-sport-recap-behind-an-80-paywall)).
   - Put the **new AI value** in Plus instead (section 3).

---

## 3. Freemium vs subscription, and what goes where

**VERIFIED FACT, conversion benchmarks:**
- **Download-to-paid by day 35** (RevenueCat 2026): hard paywall median 10.7%, freemium median 2.1%, top-quartile freemium above 4.5% ([RevenueCat](https://www.revenuecat.com/state-of-subscription-apps)).
- **Paywall type** (Adapty): hard paywalls give 21% higher LTV; soft paywalls give nearly 50% better raw conversion ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)).
- **Every major golf app** studied offers a free tier ([golf GPS research](./COMPETITOR_ANALYSIS.md)).
- **Golfer reaction:** golfers complain that "Most 'free' golf apps gate the important features behind a paywall within the first round" ([ScoringZone](https://www.scoringzone.net/blog/18birdies-review)) and about "purchase premium now messages every couple of days" ([SwingU App Store GB](https://apps.apple.com/gb/app/swingu-golf-gps-by-golf-genius/id332116103)).

**RECOMMENDATION: freemium with a soft paywall, and the trial offered on day 0.** Golf apps are judged on their free tier, and a hard paywall would kill word of mouth in clubs and societies. Show the trial offer during onboarding (where 80–90% of trial starts happen, per [RevenueCat](https://www.youtube.com/watch?v=1toNkt5bTgg)) and at two "wow" moments only: after the third free swing analysis, and on the full post-round debrief. **Never show it during a round.**

| Free forever | Caddy Coach Plus |
|---|---|
| GPS, maps, flyovers, scoring, Stableford, side games, group rounds | Unlimited AI coach with memory (A1) and coach chat about stats and rules (A7) |
| WHS handicap estimate and the **MyEG companion card** (P1) | **Full post-round "One Thing" debrief** (A2); free users see the headline only |
| 3 swing analyses a month with the on-phone coach | Unlimited swing analyses, swing comparison, monthly swing report (A8) |
| Shot tracer (watermarked reel), grip and setup checks | One Focus engine with before/after proof (A3, A14) |
| Drill library with 3D demos, practice streak, weekly plan | Stats vs golfers of your handicap (P2), handicap forecast (P7) |
| Club leaderboards, competitions, live pins | Break 100/90/80 roadmaps (R2), adaptive plan (R3), winter programme (L4) |
| Year in Golf teaser | Full Year in Golf recap and all-time stats (Letterboxd/Strava pattern) |

---

## 4. Recommended price ladder

| Product | Price (RECOMMENDATION) | Grounding (VERIFIED FACT unless marked) |
|---|---|---|
| Free | £0 | All golf rivals have a free tier |
| **Plus (annual)** | **£44.99/yr** | UK mid-tier £49.99–£69.99 (Hole19, TheGrint, SwingU Plus, VPAR); AI tiers £99.99; Health & Fitness yearly median $39.94, Western Europe yearly median $40.12 ([RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps)) |
| Plus (monthly) | £6.99/mo | Garmin Connect+ £6.99/mo; Oura £5.99/mo; Strava £8.99/mo ([TechRadar](https://www.techradar.com/health-fitness/smartwatches/furious-garmin-users-revolt-over-new-subscription-service-we-need-to-take-a-firm-stand); [TechRadar Oura](https://techradar.com/health-fitness/oura-ring-4-latest-news-rumors-and-what-we-want-to-see); [BikeRadar](https://www.bikeradar.com/news/strava-hikes-monthly-subscription-cost-by-more-than-25-per-cent)) |
| Founding member | £34.99/yr, locked while subscribed | Existing planned price (`app-3.js:1498`) |
| Trial | 21 days | 17–32-day trials convert best (RevenueCat 2026) |
| Two-person plan (B3, later) | about £64.99/yr (ESTIMATE: 2 × £44.99 less about 28%) | Duolingo and Brilliant run family plans (see [Competitor analysis](./COMPETITOR_ANALYSIS.md)) |
| Society Pass (S1) | £4.99 per event, or £39.99 per season for the organiser | Squabbit: Player Pro £4.99 per event, Tournament Pro £29.99 per event / £99.99, League Pro £249.99 ([App Store GB](https://apps.apple.com/gb/app/id1556538444)) |
| Coach seat (B2) | about £99/yr per PGA pro | OnForm Coach $299.99/yr, CoachNow coach $499/yr, V1 Pro about $499/yr, Skillest $59/mo ([App Store US](https://apps.apple.com/us/app/onform-video-analysis-app/id1490334045); [CoachNow](https://coachnow.com/pricing); [GOATCode](https://goatcode.ai/v1-golf-app-pricing-2026.html); [Skillest](https://skillest.com/features)). The coach sources are search summaries; check before quoting |
| Pro swing review (A9) | about £15–£25 per review, coach keeps about 70% (RECOMMENDATION; split not benchmarked) | UK lessons £75–£300/hour at premium facilities ([GripGolf](https://gripgolf.co.uk/how-much-should-golf-lessons-cost-all-you-need-to-know/)); Skillest lessons $1–$400 ([Skillest](https://skillest.com/blog/best-online-golf-coaching-platforms-2026/)) |
| Club partner pack (L5) | test £300–£900/yr per club (RECOMMENDATION, no UK benchmark beyond one) | HowDidiDo: clubs pay £1,400/yr to cover all members; members otherwise pay £2.99–£9.99/yr ([NCG](https://www.nationalclubgolfer.com/club/howdidido-new-app-charges)) |

**Is the AI coaching worth its own tier?** **RECOMMENDATION: not yet.** Duolingo Max, Speak and MasterClass On Call sell AI as a premium tier (see [Competitor analysis](./COMPETITOR_ANALYSIS.md)). But Caddy Coach's AI costs well under 1p per call (section 5), and splitting a tiny user base across tiers adds complexity. Make AI the reason to buy Plus. Revisit a higher "Plus + Pro" tier only once human pro reviews (A9) exist.

**VERIFIED FACT, AI-app risk:** AI apps earn 41% more revenue per payer in year one but retain worse: annual retention is 21.1% vs 30.7% for non-AI apps, and refunds run at a 4.2% median vs 3.5% ([RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps)). The AI must keep delivering week after week, through memory and the focus loop, not just impress once.

---

## 5. Unit economics

### Variable cost per paying golfer (ESTIMATES)

**AI cost** (Haiku 5.5 prices from [Claude Platform pricing](https://platform.claude.com/docs/en/about-claude/pricing): $0.10 per million input tokens, $0.50 per million output tokens):
- One analysis or debrief ≈ 3,000–4,000 input + 800 output tokens ≈ **$0.0007–$0.0008 ≈ 0.06p**.
- Typical golfer, 40 calls a month: 40 × 0.06p = **2.4p a month, about 29p a year**.
- Heavy golfer, 150 calls a month: **9p a month, about £1.08 a year**.
- **Sonnet 5.5 would cost about 20× more** ($2/$10 per million tokens). Stay on Haiku and use the Batch API (50% off) for monthly reports.

**Payment fees on £44.99 a year:**
- **Stripe:** 1.5% + 20p + 0.7% Billing = £0.67 + £0.20 + £0.31 = **£1.19 (2.6%)** ([Stripe GB](https://stripe.com/gb/pricing)).
- **App store** (15% small-business rate, [Apple](https://developer.apple.com/app-store/small-business-program/)): 15% of the price before VAT (£37.49) = **£5.62**.

**VAT.** UK prices include 20% VAT once registered: £44.99 ÷ 1.2 = £37.49 net. VAT is general knowledge here and was not sourced in this research. Check with an accountant.

| Per subscriber per year (ESTIMATE) | Web + Stripe, £44.99 | App store, £44.99 | Web, founding £34.99 | Web, monthly £6.99 kept 12 months |
|---|---|---|---|---|
| Price after VAT | £37.49 | £37.49 | £29.16 | £69.90 (12 × £5.825) |
| Payment fee | −£1.19 | −£5.62 | −£0.97 | −£4.25 (12 × £0.354) |
| AI (heavy user) | −£1.08 | −£1.08 | −£1.08 | −£1.08 |
| **Contribution** | **£35.22** | **£30.79** | **£27.11** | **£64.57** if they never cancel |

The monthly column is a best case. **VERIFIED FACT:** active renewal rates are 83.4% for yearly and 39.2% for monthly plans ([RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps); definitions differ, so check the report).

### Fixed costs (some unknown)

| Item | Cost | Status |
|---|---|---|
| Supabase Pro (free projects pause) | $25/month = $300/yr ≈ **£237/yr** | VERIFIED FACT ([Supabase](https://supabase.com/pricing)); £ conversion is an ESTIMATE |
| New hosting (GitHub Pages forbids commercial SaaS) | **Not researched** | Must be priced; Cloudflare Pages and Vercel were not checked |
| Met Office weather key (Open-Meteo free tier is non-commercial only, `cc-weather/index.ts:1-4`) | **Not researched** | Licence needed |
| ArcGIS imagery key | **Not researched** | Licence needed (`README.md` "Before charging") |
| Own course-data server instead of public Overpass | **Not researched** | Needed at scale |
| Apple Developer Program (only for an iOS store app) | about $99/yr | General knowledge, not verified in this research |

**ESTIMATE, break-even scenarios** (fixed costs ÷ £35.22 contribution per web annual subscriber):

| Fixed costs per year | Paying golfers to break even |
|---|---|
| £1,000 | 1,000 ÷ 35.22 ≈ **29** |
| £3,000 | ≈ **86** |
| £6,000 | ≈ **171** |

### How many golfers it takes (ESTIMATE)

- Freemium download-to-paid median 2.1%, top quartile 4.5% ([RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps)).
- 10,000 installs → 210–450 payers → **£7,400–£15,800 contribution a year**.
- 50,000 installs → 1,050–2,250 payers → **£37,000–£79,000 a year**.
- Market context: England has **4,199,000** golfers on 9- and 18-hole courses and **835,554** registered golfers ([R&A/EGA 2025](https://ega-golf.ch/sites/ega/files/2026-06/Sporting%20Insights%20Report_The%20RA%20and%20EGA_European%20Golf%20Participation%202025_May%202026.pdf)). 50,000 installs would be about 1.2% of England's golfers.
- **VERIFIED FACT:** revenue is very concentrated. The top 10% of Health & Fitness apps take 92.6% of revenue ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)), and only 5% of H&F apps reach $10k total revenue within 2 years ([Athletech News on RevenueCat 2025](https://athletechnews.com/fitness-apps-monetizable-winner-take-all-or-most/)). **Keep fixed costs tiny until there is proof of demand.**

### Stripe (web) vs app stores

**VERIFIED FACT:**
- Web revenue is only **3.2% of subscription-app revenue** globally.
- 41% of top-tier apps earn some web revenue, against 1.3% of hobby-tier apps ([RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps)).
- iOS converts about 2× Android ([Athletech News on RevenueCat 2025](https://athletechnews.com/fitness-apps-monetizable-winner-take-all-or-most/)).

**RECOMMENDATION:** start with Stripe on the web app, which is cheaper and already built. Then package the PWA for Google Play (B1) for discovery. Accept the 15% fee there if it brings installs. UK/EU rules on steering app-store users to web payments were **not researched**; check before adding any "pay on the web" link inside a store app.

---

## 6. Other revenue lines

### Affiliates: small money, use sparingly

**VERIFIED FACT, commission rates:**
- American Golf about 6% (aggregator sources) ([UpPromote](https://uppromote.com/affiliate-directory/american-golf/)).
- Callaway 6–9%, TaylorMade 5–6%, Ben Hogan 10% ([Sports History Network](https://sportshistorynetwork.com/golf/15-golf-affiliate-programs/)).
- Bombtech 10% on Awin ([Awin](https://ui.awin.com/merchant-profile/129567)); Performance Golf (US) 25% ([Awin](https://ui.awin.com/merchant-profile/71491)).
- The Amazon UK "Sports & Outdoor" rate of 7% is **unverified** and conflicts with US rates ([Amazon UK](https://affiliate-program.amazon.co.uk/help/operating/scheduleoct1)).

**ESTIMATE:**
- A £300 driver at 6% earns £18.
- If 2% of 5,000 active golfers bought one £300 item a year through Caddy Coach: 100 × £18 = **£1,800 a year**.

**RECOMMENDATION:** link only to kit a drill actually needs (alignment sticks, impact bags, putting mirrors), clearly marked. **No display ads.** MyEG's "Footjoy ad that obliterates segments of the screen" is a named complaint ([Golf Monthly forum](https://forums.golfmonthly.com/threads/myeg-app-feedback.115847/)).

### Course, brand and creator partnerships

- **VERIFIED FACT:** Calm is distributed through EE and Match, and Peloton through hotel partners ([Calm support](https://support.calm.com/hc/en-us/articles/32949555877147-Calm-with-Match-UK); [Peloton UK partners](https://onepeloton.com/en-GB/partners/hyatt/offers)).
- **VERIFIED FACT:** Strava sells motivation to brands, through challenges and Year in Sport data ([SGI Europe](https://www.sgieurope.com/case-studies/case-study-how-strava-sells-motivation-to-brands/124154.article)).
- **VERIFIED FACT:** Mustard uses star coaches and an investor (Justin Rose) as its brand ([App Store UK](https://apps.apple.com/gb/app/mustard-golf-swing-analysis/id6499280777)).
- No sponsorship rates for small golf apps were found.

**RECOMMENDATION:**
- **Courses and clubs:** offer a free club page (already built) in return for promoting Caddy Coach to members, then a paid partner pack later.
- **PGA pros:** the best partnership channel. A pro who uses Caddy Coach with pupils brings each pupil in, and the existing coach–pupil link is the base. Give coaches a free seat during the first season.
- **Creators:** a UK golf YouTuber "Break 90 with …" roadmap (R2) could work. **No source confirmed** whether Rick Shiels or similar creators run paid apps; research before approaching anyone.
- **Brands:** wait until there are thousands of active golfers.

### B2B: clubs, societies, coaches

- **Societies (best first B2B).** **VERIFIED FACT:** the pain is real and recurring: paper cards, spreadsheets, manual entry ([Facebook group](https://www.facebook.com/groups/golftrips/posts/4424415841106279/); [Golf Monthly forum](https://forums.golfmonthly.com/threads/society-handicap-score-management.119011/)). The organiser pays (Squabbit model). Caddy Coach already has group rounds and competitions.
- **Coaches.** A low-cost seat (about £99/yr) undercuts every coach platform found.
- **Clubs.** **VERIFIED FACT:** HowDidiDo's £1,400/yr club-wide price ([NCG](https://www.nationalclubgolfer.com/club/howdidido-new-app-charges)) shows clubs do buy member apps. But club sales take a long time, and HowDidiDo/Club Systems are entrenched. **RECOMMENDATION:** later.

---

## 7. Hosting and licences: blockers before charging

**VERIFIED FACT:** "GitHub Pages is not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions or providing commercial software as a service (SaaS)." ([GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits))

**VERIFIED FACT (code):** the README's "Before charging for the app" list:
- move hosting;
- Supabase Pro (free projects pause);
- a paid weather plan (Open-Meteo is free for non-commercial use only);
- an ArcGIS key for imagery;
- an own course-data server instead of public Overpass.

Source: `README.md`; `app-3.js:439-443`; `cc-weather/index.ts:1-4`.

**RECOMMENDATION:** treat these as one "commercial readiness" task in the [roadmap](./PRODUCT_ROADMAP.md). Price each licence first, because the break-even table above depends on them. Do not take a single payment until all are done. **Netlify is excluded** by the project's own rules (publishing limits), so compare other static hosts.

---

## What not to build because it costs more than it earns

**RECOMMENDATION** for each, with the evidence:

| Don't build | Why |
|---|---|
| Own tracking hardware | Arccos and Shot Scope own this, and hardware needs capital. **VERIFIED FACT:** Arccos Air costs $349.99 ([Arccos](https://uk.arccosgolf.com/products/air)) |
| Tee-time booking | **VERIFIED FACT:** GolfNow dominates with a barter model and parity clauses ([TeeWire](https://teewire.com/teewire-vs-golfnow); [GolfNow terms](https://golfnowbusiness.com/sites/default/files/2020-04/GOLF-Tee-Time-Distribution-Terms.pdf)). A small app can't win commissions |
| Real-money wagers or paid fantasy | UK gambling-law implications were not researched; Sleeper's gambling promotions draw complaints ([Action Network](https://www.actionnetwork.com/online-sports-betting/reviews/sleeper)) |
| Official WHS score submission | **VERIFIED FACT:** England Golf doesn't accept third-party scorecards ([GolfMagic](https://www.golfmagic.com/equipment/buying-guides/best-golf-apps)). Be the companion instead (P1) |
| Cloud video upload and storage | On-phone analysis avoids egress; Supabase charges $0.09/GB uncached egress beyond 250 GB ([Supabase](https://supabase.com/pricing)). The privacy story ("videos never uploaded") is an asset |
| A 3D-from-one-video engine to rival Sportsbox | No consumer app publishes accuracy ([BirdieSwing](https://www.birdieswing.com/blog/best-ai-golf-swing-analyzer-apps)), and users doubt Sportsbox's 3D anyway ([GolfWRX](https://forums.golfwrx.com/topic/2061178-sportsbox-vs-swing-coach-ai-apps/)). Win on clear verdicts instead |
| Native Apple Watch app (now) | XL effort; watch sync bugs are the top complaint about rivals ([18Birdies App Store GB](https://apps.apple.com/gb/app/18birdies-golf-gps-tracker/id892700751)), so a weak one would hurt |
| Using Sonnet/Opus for routine coaching | About 20× the cost of Haiku for the same call (section 5) |
| Display advertising | Named UK complaint (MyEG); undermines a "premium" brand |
| A GolfLogix-style putt line in the app | **VERIFIED FACT:** GolfLogix sells rules-compliant printed Green Books because the app isn't allowed in competition ([Plugged In Golf](https://pluggedingolf.com/?p=77845)); green contour data was not researched |
