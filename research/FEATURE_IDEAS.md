# Caddy Coach feature ideas: 61 ideas, scored and ranked

Part of the Caddy Coach research pack (November 2026): [Executive summary](./EXECUTIVE_SUMMARY.md) · [Competitor analysis](./COMPETITOR_ANALYSIS.md) · [Customer pain points](./CUSTOMER_PAIN_POINTS.md) · **Feature ideas** · [Commercial opportunities](./COMMERCIAL_OPPORTUNITIES.md) · [Product roadmap](./PRODUCT_ROADMAP.md) · [Research sources](./RESEARCH_SOURCES.md) · [Full research report](../reports/Caddy%20Coach%20market%20research.md)

**How to read this document.** Three kinds of statement are labelled throughout:
- **VERIFIED FACT**: comes from a named source. The link is given, and every source was accessed on 18 Nov 2026. Facts about Caddy Coach itself come from its own code (file and line numbers given).
- **ESTIMATE**: my own calculation. The working is shown.
- **RECOMMENDATION**: my strategy opinion, based on the evidence.

All scores in this document are **RECOMMENDATIONS**: judgement calls made from the evidence, not measured data.

---

## 1. The starting point: Caddy Coach already has most "standard" features

**VERIFIED FACT (code, 18 Nov 2026):** Caddy Coach already has:
- on-phone swing analysis (9 key positions, 38 scored checks, a "better position" overlay, swing comparison, recurring-fault detection);
- a rule-based coach that runs on the phone, plus a cloud AI coach built on Claude Haiku that is fully built but switched off;
- a shot tracer with video export;
- live grip, setup and drill checks with voice cues;
- 30 drills with 3D demos;
- a "What's your miss?" guide, a two-week focus, a weekly plan and a practice streak;
- GPS with satellite maps and 3D flyovers;
- weather "plays-like" distances;
- a World Handicap System (WHS) handicap and strokes gained;
- skins and better-ball games, group rounds, club leaderboards, competitions, live pins, club pages;
- coach–pupil sharing, share cards and "Your year in golf".

Sources: `app-1.js:758`, `metrics.js:291-382`, `swingcoach.js`, `tracer.js`, `coach.js`, `app-3.js:370-845`, `whs.js` (summarised in the [Competitor analysis](./COMPETITOR_ANALYSIS.md#caddy-coach-today-what-already-exists)).

**Not found in the code:** putting analysis, tee times, a social feed, push notifications, app-store listings, and any launch-monitor or wearable link (`caddy_coach_inventory.md`, "Gaps").

**RECOMMENDATION:** Caddy Coach's problem is not missing features. It is that the features are not yet joined into one loop that brings a golfer back every week, and that the strongest one (the AI coach) is switched off. Most of the top-scoring ideas below therefore join up or improve what already exists, rather than adding new screens. Every idea is marked **New**, **Partly exists** or **Exists**. For anything that partly exists, the write-up explains the significant improvement.

---

## 2. Scoring method

Each idea is scored 1–10 on seven criteria. As requested, demand, retention and feasibility/cost carry the most weight.

| Criterion | Weight | What a 10 means |
|---|---|---|
| Customer demand | **20%** | Golfers repeatedly ask for it, or complain about its absence (see [Customer pain points](./CUSTOMER_PAIN_POINTS.md)) |
| Retention potential | **20%** | Gives a reason to open the app every week |
| Technical feasibility | **15%** | Buildable by a solo developer on the current static web app + Supabase setup |
| Development cost efficiency | **15%** | Small build and near-zero running cost |
| Differentiation | 10% | No competitor does it, or Caddy Coach can clearly do it better |
| Revenue potential | 10% | Makes people upgrade, or opens a new revenue line |
| Long-term strategic value | 10% | Builds a moat, data or distribution |

**Overall** = 0.20×Demand + 0.10×Differentiation + 0.10×Revenue + 0.20×Retention + 0.15×Feasibility + 0.15×Cost efficiency + 0.10×Strategic (a weighted average out of 10).

**Effort key:** S = under 1 week · M = 2–4 weeks · L = 1–3 months · XL = more than 3 months (solo developer working with an AI assistant).

**ESTIMATE, running-cost unit used throughout:**
- One Claude Haiku 5.5 coaching call of about 3,000 input and 800 output tokens costs 3,000 × $0.10/1M + 800 × $0.50/1M = **$0.0007, about 0.06p** (prices from [Claude Platform pricing](https://platform.claude.com/docs/en/about-claude/pricing), as recorded in the commercial research note).
- The pence figure uses the exchange rate implied in that note (about £0.79 per $1). This is an assumption.
- The same call on Sonnet 5.5 costs about 1.1p.

---

## 3. All 61 ideas by category

The ID codes are used in the scoring tables (section 5) and the [Product roadmap](./PRODUCT_ROADMAP.md).

### AI coaching
| ID | Idea | Status | Evidence it matters |
|---|---|---|---|
| A1 | Switch on the AI coach, with a visible "what your coach remembers" card | Partly exists: `cc-coach` is fully built with swing memory and daily limits but is off without an API key (`supabase/functions/cc-coach/index.ts:6-8`) | Sportsbox SAMI, WHOOP Coach and ChatGPT memory all answer questions from the user's own data ([Sportsbox](https://www.sportsbox.ai/); [Business Wire](https://www.businesswire.com/news/home/20230926899032/en); [TechCrunch](https://techcrunch.com/2025/04/10/openai-updates-chatgpt-to-reference-your-other-chats/)) |
| A2 | Post-round "One Thing" debrief | New. The ingredients exist: strokes gained, fairways hit, greens in regulation (GIR) and putts (`app-3.js:817-845`) | Hole19 Otto writes a report after each round on strengths, weaknesses and focus ([Hole19](https://www.hole19golf.com/the-19th-hole/hole19-intelligence-tier)); SwingU Pro links post-round priorities to a drill ([App Store GB](https://apps.apple.com/gb/app/swingu-golf-gps-by-golf-genius/id332116103)) |
| A3 | One Focus engine joining rounds, swings and miss | Partly exists: the two-week focus and weekly plan are built "from swing and rounds" (`app-3.js:308`; `coach.js`) | Sportsbox gives free users "1 recommended goal" ([Sportsbox](https://www.sportsbox.ai/)); Clippd ranks "skill priorities" ([Clippd](https://clippd.com)) |
| A4 | Pre-round game plan for your home course | New | DECADE sells course strategy from $89 for 6 months ([DECADE](https://decade.golf/memberships/)); 18Birdies Premium has Tee Shot Planner and Course Strategy ([18Birdies help](https://help.18birdies.com/article/661-whats-included-with-18birdies-premium)) |
| A5 | On-course "aim here" tip from your own miss pattern | Partly exists: plays-like distance with a club suggestion from your bag (`app-3.js:438-537`) | Arccos AI Strategy and Hole19 Otto make on-course decisions ([Arccos](https://uk.arccosgolf.com/products/air)) |
| A6 | Spoken post-round debrief call | New | Duolingo Video Call is used "to help increase Max adoption" ([Duolingo Q3 2025 letter](https://www.sec.gov/Archives/edgar/data/1562088/000162828025049514/q3fy25duolingo9-30x25share.htm)) |
| A7 | Ask your coach about stats, rules and WHS | Partly exists: chat is limited to swing data (`swingcoach.js`) | Fitbod's founder says users want to know "why" ([TechRadar](https://techradar.com/health-fitness/fitness-apps/its-no-longer-enough-for-an-app-to-tell-you-what-to-do-people-want-to-know-why-fitness-app-fitbods-founder-on-the-reason-behind-the-ai-fitness-boom)) |
| A8 | Monthly swing report with missions | Partly exists: swing history and trend chart (`index.html:2169-2179`) | GolfFix runs daily and monthly reports with "missions" ([golffix.io](https://www.golffix.io/en/golffix)) |
| A9 | Paid PGA pro review of a swing | Partly exists: free coach–pupil link (`app-3.js:1514-1572`) | Future gives every member a human coach ([Garage Gym Reviews](https://www.garagegymreviews.com/future-app-review)) and reportedly dropped its AI-only product ([Athletech News](https://athletechnews.com/future-pulls-the-plug-on-ai-personal-training-commits-to-human-coaches/)); Skillest coaches charge $1–$400 a lesson ([Skillest](https://skillest.com/blog/best-online-golf-coaching-platforms-2026/)) |
| A10 | Honest grading with camera-angle-aware checks and a published test | Partly exists: "measured" vs "estimated" labels and borderline handling (`metrics.js:383-391`) | Users say AI grading is "too generous" ([Golf Training Daily](https://www.golftrainingdaily.com/blog/ai-golf-swing-analyzer-apps)); "thinks my swing is generally better than it is" ([GolfWRX](https://forums.golfwrx.com/topic/2061178-sportsbox-vs-swing-coach-ai-apps/)); no consumer app publishes accuracy figures ([BirdieSwing](https://www.birdieswing.com/blog/best-ai-golf-swing-analyzer-apps)) |
| A11 | Hands-free range mode | Partly exists: recording and live drill mode (`live.js`) | GolfFix Self Record Mode with instant replay ([golffix.io](https://www.golffix.io/en/golffix)) |
| A12 | Putting stroke check from phone video | New (not found in code) | Golfers ask for better putt capture ([MyGolfSpy forum](https://forum.mygolfspy.com/topic/64377-unofficial-review-arccos-golf-performance-tracking-system/)); Me and My Golf has putting plans ([App Store UK](https://apps.apple.com/gb/app/me-and-my-golf-coaching-app/id1541212755)) |
| A13 | Chipping and pitching check | New | Me and My Golf has chipping plans (same source) |
| A14 | Automatic before/after proof clip | Partly exists: two-swing comparison (`app-1.js:1199-1203`) | Sportsbox and GolfFix both offer comparison over time ([Sportsbox](https://www.sportsbox.ai/); [golffix.io](https://www.golffix.io/en/golffix)) |

### Performance and stats
| ID | Idea | Status | Evidence it matters |
|---|---|---|---|
| P1 | MyEG companion card | Partly exists: scorecard text export and on-phone WHS maths (`app-3.js:798-802`; `whs.js`) | Since 1 Sep 2025 all English scores go through MyEG ([Northern Golfer](https://www.northerngolfer.co.uk/new-whs-record-set-in-england-in-august/)); MyEG users complain the "Scorecard doesn't show PH", it is "generally quite glitchy" and needs signal ([Golf Monthly forum](https://forums.golfmonthly.com/threads/myeg-app-feedback.115847/)) |
| P2 | Plain-English stats vs golfers of your handicap | Partly exists: strokes gained against a **PGA Tour** baseline (`app-3.js:839-841`) | MyEG users want "more statistics" (same forum); SwingU Pro shows handicap-relative stats ([App Store GB](https://apps.apple.com/gb/app/swingu-golf-gps-by-golf-genius/id332116103)); a UK golfer says stats don't "tell me anything significant I don't already know" ([Golf Monthly forum](https://forums.golfmonthly.com/threads/who-has-moved-away-from-arccos.118414/)) |
| P3 | Near-zero-effort shot capture | Partly exists: manual shot marking (`app-3.js:438-537`) | Tracking hassle is a recurring reason people leave ([GolfWRX](https://forums.golfwrx.com/topic/2029985-its-time-to-move-on-from-arccos-other-options-for-tracking-rounds/)); a retained user says "I basically never miss shots" ([GolfWRX p2](https://forums.golfwrx.com/topic/2029985-its-time-to-move-on-from-arccos-other-options-for-tracking-rounds/page/2/)) |
| P4 | Auto-built carry distances | Partly exists: manual bag yardages for carry and total (`app-1.js:1747-1752`) | "carry is way more important" than total ([Golf Monthly forum](https://forums.golfmonthly.com/threads/who-has-moved-away-from-arccos.118414/)) |
| P5 | Verified UK course data | Partly exists: crowd voting, where the most common value wins (`app-2.js:238-426`) | Scottish slope ratings "wildly inaccurate" on TheGrint ([App Store GB](https://apps.apple.com/gb/app/thegrint-golf-gps-scorecard/id532085262)); mixed-up stroke indexes on GameBook ([App Store GB](https://apps.apple.com/gb/app/golf-gamebook-scorecard-gps/id409307935)) |
| P6 | On-course battery saver | New | "Almost every golf GPS app will drain the battery" ([Practical Golf](https://practical-golf.com/golf-gps-app-free)) |
| P7 | Handicap forecast | New | Whoop "Pace of Aging", updated weekly ([Plunge](https://plunge.com/blogs/blog/whoop-launches-5-0-and-mg-devices)) |
| P8 | Practice-to-score link | New | Clippd logs practice and rounds together ([Clippd](https://clippd.com)) |
| P9 | Weekend weather planner | Partly exists: in-round weather (`app-3.js:438-443`) | No golfer complaint evidence on weather was found ([pain points research](./CUSTOMER_PAIN_POINTS.md)), so demand is unproven |

### Gamification
| ID | Idea | Status | Evidence it matters |
|---|---|---|---|
| G1 | Forgiving weekly streak with freezes and revival | Partly exists: practice streak (`app-3.js:370`) | When Duolingo made one lesson enough to keep a streak, D14 retention rose 3.3% ([Duolingo blog](https://blog.duolingo.com/improving-the-streak)); the Weekend Amulet cut streak loss by 5% ([Duolingo engineering](https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)); 15.4M learners took part in a streak revival ([Duolingo IR](https://investors.duolingo.com/node/11401/pdf)) |
| G2 | Partner streak | New | About one-third of Duolingo's daily users had a Friend Streak ([Duolingo IR](https://duolingo.gcs-web.com/static-files/3c8277ee-bc94-4f5d-9b77-0db3e46f88b8)) |
| G3 | Weekly effort leagues by handicap band | New: club leaderboards rank best Stableford and most-improved handicap (`app-3.js:607-609`) | Duolingo leagues match learners with "similar habits" and reset weekly ([Duolingo blog](https://blog.duolingo.com/duolingo-leagues-leaderboards/)) |
| G4 | Monthly Challenge Day | New | Pokémon GO Community Day is a monthly 3-hour event window ([Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Community_Day)) |
| G5 | Skill tree and badges | Partly exists: drill progress steps (`app-4.js:1-3`) | Duolingo's progression; GolfFix "missions" ([golffix.io](https://www.golffix.io/en/golffix)) |
| G6 | Home-course hole segments | New | Strava users set 7.6m KOM/QOMs or course records in 2025 ([Endurance Sportswire](https://www.endurancesportswire.com/?p=221014)) |
| G7 | Club or society boss quest | New | Habitica party bosses ([Habitica wiki](https://habitica.fandom.com/wiki/Class_System)) |
| G8 | Earn extra free analyses | New | Duolingo Energy is refilled by perfect lessons and adding a friend ([Duolingo blog](https://blog.duolingo.com/duolingo-energy/)) |
| G9 | Ghost round (play your past self) | New | No direct evidence. This is an adaptation of Strava segments (above) |
| G10 | Daily 2-minute home drill | Partly exists: today's focus card with a drill (`app-4.js:125-131`) | SwingU gives a free daily tip ([App Store GB](https://apps.apple.com/gb/app/swingu-golf-gps-by-golf-genius/id332116103)); Brilliant gives one daily challenge ([Brilliant help](https://brilliant.org/help/pricing-and-plans/what-s-the-difference-between-free-and-premium/)) |

### Social and competitive
| ID | Idea | Status | Evidence it matters |
|---|---|---|---|
| S1 | Society mode with season order of merit and an organiser pass | Partly exists: group rounds by code, club competitions (`app-3.js:738-764`) | Societies still use "Paper cards, a spreadsheet, an app?" ([Facebook group](https://www.facebook.com/groups/golftrips/posts/4424415841106279/)); Squabbit charges per event and by organiser tier ([App Store GB](https://apps.apple.com/gb/app/id1556538444)) |
| S2 | More game formats | Partly exists: skins and four-ball better ball (`app-3.js:538-545`) | Golf GameBook offers 20 formats ([App Store GB](https://apps.apple.com/gb/app/golf-gamebook-scorecard-gps/id409307935)); 18Birdies has Wolf and Dots for free (its App Store listing) |
| S3 | Mates' prediction league | New | DP World Tour Fantasy runs private mini-leagues joined by code ([europeantour.com](https://www.europeantour.com/dpworld-tour/news/articles/detail/fantasy-dp-world-tour-is-back/)) |
| S4 | Tour fantasy mini-league | New | Same source; FPL had 11.43M teams ([Premier League](https://www.premierleague.com/en/news/4362120)) |
| S5 | Light friends feed with kudos | New | Strava kudos hit 14bn in 2025, up 20% ([Endurance Sportswire](https://www.endurancesportswire.com/?p=221014)) |
| S6 | Chat inside group or society | New | Sleeper puts chat on almost every screen ([TechCrunch](https://techcrunch.com/?p=1868752)) |
| S7 | Web push notifications | New: local notifications only; "true push needs a small server" (`HOW-TO-PUT-IT-ONLINE.txt`) | Squabbit sends leaderboard change notifications ([App Store GB](https://apps.apple.com/gb/app/id1556538444)) |
| S8 | One-tap branded tracer reel | Partly exists: tracer MP4 export and share cards (`tracer-mp4.js`; `app-3.js:571-576`) | Strava Year in Sport acts as free PR every December ([BikeRadar](https://www.bikeradar.com/news/strava-year-in-sport-2025)) |

### Personalisation
| ID | Idea | Status | Evidence it matters |
|---|---|---|---|
| R1 | 60-second onboarding to a first "wow" | Partly exists: getting-started checklist (`index.html:2089-2108`) | 86.1% of Health & Fitness trial starts happen on install day ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)) |
| R2 | Break 100 / 90 / 80 roadmaps | New | Me and My Golf has 20+ plans including "breaking 100" ([App Store UK](https://apps.apple.com/gb/app/me-and-my-golf-coaching-app/id1541212755)); DECADE sells "Breaking 90" ([DECADE](https://decade.golf/memberships/)) |
| R3 | Adaptive plan (Runna-style) | Partly exists: weekly plan of three sessions (`app-3.js:308`) | Runna plans adapt to progress and feedback ([the5krunner](https://the5krunner.com/2026/09/28/is-runna-ai/)); Strava sells it as a bundle ([Tom's Guide](https://www.tomsguide.com/wellness/fitness/strava-and-runna-launch-joint-subscription-heres-what-you-need-to-know)) |
| R4 | Simplified Home | Partly exists: Home has about ten cards (`index.html:2089-2108`) | Best fitness UX shows "one number or one next action" (see [Competitor analysis](./COMPETITOR_ANALYSIS.md)); complaints about "clunky and confusing" apps ([Reddit snippet](https://www.reddit.com/r/BritGolf/comments/1wj79r2/hole19_vs_18birdies_vs_the_grint/)) |
| R5 | Body and mobility settings | New | No direct golf evidence; Runna added options to dial back intensity after injury reports ([the5krunner](https://the5krunner.com/2026/02/21/runna-ai-marathon-training-injury/)) |

### Lifestyle and community
| ID | Idea | Status | Evidence it matters |
|---|---|---|---|
| L1 | Year in Golf as a December share moment | **Exists** ("Your year in golf", `app-3.js:387`); needs an upgrade | Strava Year in Sport is in its 12th year ([Webull/press](https://www.webull.com/news/13961203642123264)); Letterboxd requires 10 diary entries before a recap ([Letterboxd Pro](https://letterboxd.com/about/pro/)) |
| L2 | Round diary | Partly exists: per-hole notes | Letterboxd reached 30.7M members ([TheWrap](https://www.thewrap.com/industry-news/business/letterboxd-sale-gigi-pritzker-investor-consortium-acquisition/)) |
| L3 | 5-minute pre-round warm-up | New | No direct evidence found |
| L4 | Winter indoor practice programme | Partly exists: 7 home-only and 11 home-or-range drills (`drills.js`) | 18Birdies use peaks in summer (198K rounds on 3 Aug 2025) ([18Birdies](https://18birdies.com/clubhouse/community/the-18-birdies-2025-community-year-in-review)); the UK winter is an inference |
| L5 | Club partner pack | Partly exists: club pages and admins (`app-3.js:1412-1418`) | HowDidiDo lets a club pay £1,400/yr to cover all members ([NCG](https://www.nationalclubgolfer.com/club/howdidido-new-app-charges)) |
| L6 | Find a PGA pro near you | New | UK private lessons cost £75–£300 an hour at premium facilities ([GripGolf](https://gripgolf.co.uk/how-much-should-golf-lessons-cost-all-you-need-to-know/)) |
| L7 | Society trip planner | New | RiddyGolf handles invites and green-fee collection ([Golf Business News](https://golfbusinessnews.com/news/new-products/riddygolf-app-aims-to-simplify-society-golf-admin/)) |

### Unconventional and cross-industry
| ID | Idea | Status | Evidence it matters |
|---|---|---|---|
| U1 | Golf readiness score | New | Whoop recovery-style daily number ([Expert Reviews](https://www.expertreviews.co.uk/beauty-wellness/wearables/whoop-5-0-review)) |
| U2 | "Caddy Moment" snap | New | BeReal: about 50% of users active six days a week, but daily users fell from about 15M to about 6M ([Wikipedia](https://en.wikipedia.org/wiki/BeReal)) |
| U3 | Wellbeing guardrails | New | TikTok Well-being Missions ([TikTok Newsroom](https://newsroom.tiktok.com/introducing-a-new-way-to-unwind-reset-and-recharge-on-tiktok)) |
| U4 | Brand-sponsored drill challenges | New | Strava sells motivation to brands ([SGI Europe](https://www.sgieurope.com/case-studies/case-study-how-strava-sells-motivation-to-brands/124154.article)) |
| U5 | Apple Watch companion | New | Watch sync bugs are a top complaint about 18Birdies and SwingU ([App Store GB](https://apps.apple.com/gb/app/18birdies-golf-gps-tracker/id892700751)) |

### Business features
| ID | Idea | Status | Evidence it matters |
|---|---|---|---|
| B1 | Google Play listing (packaged PWA) | Planned, not done (`HOW-TO-PUT-IT-ONLINE.txt` "APP STORES") | Google Play takes a 15% fee on the first $1M ([RevenueCat](https://www.revenuecat.com/blog/engineering/app-store-fees)) |
| B2 | Coach seat plan | Partly exists: free coach link | V1 Pro is about $499/yr; CoachNow coach $499/yr; OnForm coach $299.99/yr ([GOATCode](https://goatcode.ai/v1-golf-app-pricing-2026.html); [CoachNow](https://coachnow.com/pricing); [App Store US](https://apps.apple.com/us/app/onform-video-analysis-app/id1490334045)) |
| B3 | Two-person plan for playing partners | New | Duolingo Family plan; Brilliant family plan for up to 6 ([happilyevertravels](https://happilyevertravels.com/duolingo-family-plan/); [Brilliant](https://brilliant.org/help/pricing-and-plans/how-much-does-brilliant-premium-cost/)) |

---

## 4. Detailed write-ups for the most promising ideas

Each write-up answers: problem solved, who uses it, why choose Caddy Coach, competitor offering, how to do it better, technology, effort, running cost, revenue potential, retention impact, and how hard it is to copy.

### A2. Post-round "One Thing" debrief (rank 1, score 8.50)
- **Problem solved.** Golfers finish a round with numbers but no idea what to change. **VERIFIED FACT:** a UK golfer leaving Arccos said the stats don't "tell me anything significant I don't already know" ([Golf Monthly forum](https://forums.golfmonthly.com/threads/who-has-moved-away-from-arccos.118414/)).
- **Who uses it.** Every golfer who logs a round, which is the most frequent action in the app.
- **Why choose Caddy Coach.** It is the only app in this research that has round stats, a swing fault history, a drill library with 3D demos and a two-week focus in one place. The debrief can say "your approach play cost you about 4 shots; your swing shows an early extension; here is the drill", and no competitor can join those three.
- **Competitor offer.** **VERIFIED FACT:** Hole19 Otto writes a strengths, weaknesses and focus report, but only in the £99.99 Intelligence tier ([App Store GB](https://apps.apple.com/gb/app/hole19-golf-gps-range-finder/id794462227)). SwingU Pro links post-round priorities to a drill at £99.99 (same listing type).
- **How to do it better.** One focus, not a list. Link it to the golfer's own swing faults, not generic videos. Show the "why" (strokes lost). Compare against golfers of the same handicap (P2), not tour pros. Add a "post to MyEG" button (P1) so the debrief arrives at the moment the golfer already has the phone out.
- **Technology.** The existing `cc-coach` edge function with a new round prompt. Inputs: hole scores, fairways, GIR, putts, strokes gained, recent swing faults, current focus. Falls back to the on-phone rule-based text when offline.
- **Effort.** M (2–3 weeks).
- **Running cost. ESTIMATE:** about 4,000 input and 800 output tokens = 4,000 × $0.10/1M + 800 × $0.50/1M = $0.0008, about **0.06p per round**. A golfer playing 40 rounds a year costs about 2.5p a year.
- **Revenue potential.** High. It is the clearest "this is worth paying for" moment, so a short version is free and the full version is in Plus (see [Commercial opportunities](./COMMERCIAL_OPPORTUNITIES.md)).
- **Retention impact.** Very high. It turns every round into a reason to open the app afterwards and into a practice task for the week.
- **Hard to copy?** Medium. The prompt is easy to copy. Joining it to a swing-fault history and a drill library is hard for GPS-first rivals.

### A1. Switch on the AI coach with a visible memory card (rank 2, 8.20)
- **Problem.** The built-in coach is rule-based. The far better AI coach is built but off (**VERIFIED FACT:** `cc-coach/index.ts:6-8`).
- **Who.** Everyone who analyses a swing.
- **Why Caddy Coach.** It already sends only numbers, never video, and the prompt is locked server-side so it "can't be used as a general chatbot" (`cc-coach/index.ts:1-4`). That privacy story is strong under UK GDPR.
- **Competitor.** **VERIFIED FACT:** Sportsbox SAMI answers questions from your 3D data ([Sportsbox](https://www.sportsbox.ai/)). Speak shows learners a short memory summary rather than a transcript ([Latent Space](https://latent.space/reading/speak-personalized-language-learning/)). ChatGPT asks UK/EEA users before turning memory on ([gHacks](https://www.ghacks.net/2025/06/04/chatgpt-enables-memory-feature-for-free-users/)).
- **Better how.** Show an editable "What your coach remembers" card (usual miss, clubs, goal, last focus, recurring faults). Make it opt-in. Every tip says why.
- **Technology.** Set `ANTHROPIC_API_KEY`, add a memory summary row in Supabase, add a card in the app.
- **Effort.** S (about 1 week, mostly the memory card).
- **Running cost. ESTIMATE:** at the existing caps (6 analyses and 20 questions a day), the worst case is 26 calls × 0.06p = 1.6p a day per golfer. A realistic 30 calls a month is about 2p a month (matches the commercial note's estimate). The built-in ceiling of 3,000 calls a day caps total spend at about 3,000 × $0.0007 = $2.10 a day.
- **Revenue.** High. The Plus copy already promises "Unlimited AI swing analysis" (`app-3.js:1507`).
- **Retention.** High. Memory makes each session build on the last.
- **Copy?** Easy to copy as a chat. The memory built from Caddy Coach's own 38 checks is not.

### R1. 60-second onboarding to a first "wow" (rank 3, 8.05)
- **Problem.** **VERIFIED FACT:** 86.1% of Health & Fitness trial starts happen on Day 0 ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)). RevenueCat says 80–90% ([RevenueCat video](https://www.youtube.com/watch?v=1toNkt5bTgg)). If the first session doesn't impress, the chance is gone.
- **Who.** Every new golfer.
- **Why Caddy Coach.** It can deliver an instant on-phone swing verdict with no upload wait. **VERIFIED FACT:** Mustard users complain analyses "take a REALLY long time" ([App Store US](https://apps.apple.com/us/app/mustard-golf-swing-analysis/id6499280777?see-all=reviews&platform=iphone)).
- **Better how.** Three questions (handicap, usual miss, goal), then either "film one swing" or "show me my handicap and focus". Use a sample swing if the golfer isn't at the range.
- **Technology.** Front-end only. **Effort.** M. **Running cost.** None.
- **Revenue.** Very high: it drives trial starts. **Retention.** Very high. **Copy?** Easy in principle, but the quality depends on the analysis behind it.

### A3. One Focus engine (rank 4, 8.00)
- **Problem.** Caddy Coach has a two-week focus, a weekly plan, a miss guide, recurring faults and round stats, but they are separate features.
- **Who.** Improvers, which is the core audience.
- **Why Caddy Coach.** It is the only app holding all the inputs.
- **Competitor.** **VERIFIED FACT:** Clippd ranks "skill priorities" at $240/yr ([Clippd](https://clippd.com)). Sportsbox's free plan gives "1 recommended goal" ([Sportsbox](https://www.sportsbox.ai/)).
- **Better how.** One ranked focus for two weeks, chosen from strokes lost, swing faults and stated miss, with a reason. At the end, a proof check: re-film (A14) and compare stats before and after.
- **Technology.** Mostly on-phone logic in `coach.js`, plus the AI wording through `cc-coach`. **Effort.** M–L.
- **Running cost.** About 0.06p per focus change. **Revenue.** Medium–high. **Retention.** Very high. **Copy?** Hard. It needs all of Caddy Coach's data types.

### P1. MyEG companion card (rank 5, 8.00)
- **Problem. VERIFIED FACT:** since 1 Sep 2025, every English general play score has to go through MyEG ([Northern Golfer](https://www.northerngolfer.co.uk/new-whs-record-set-in-england-in-august/)). Users report the MyEG "Scorecard doesn't show PH", "linking to competitions is farcical", it is "generally quite glitchy", and it needs signal before teeing off ([Golf Monthly forum](https://forums.golfmonthly.com/threads/myeg-app-feedback.115847/)). England Golf does not accept third-party scorecards for official handicaps ([GolfMagic](https://www.golfmagic.com/equipment/buying-guides/best-golf-apps)).
- **Who.** Every English club member and iGolf golfer. **VERIFIED FACT:** that is 750,071 club members plus 72,921 iGolf users in 2025 ([England Golf](https://www.englandgolf.org/news-detail?newsarticleid=1416)).
- **Why Caddy Coach.** It already does WHS maths "the way England Golf does" (`whs.js:1`) and works offline (`sw.js`).
- **Competitor.** None found doing this for MyEG specifically.
- **Better how.** After the round, show a card with hole-by-hole gross scores laid out in MyEG's order, playing handicap, adjusted gross score and estimated new index, plus a "Remind me to post when I have signal" button. Never claim to post officially.
- **Technology.** Front-end only. **Effort.** S. **Running cost.** None.
- **Revenue.** Low directly, but it keeps the free tier valuable. **Retention.** High, because it rides an existing weekly habit. **Copy?** Easy, but US-built rivals have not done it.

### G1. Forgiving weekly practice streak (rank 6, 7.70)
- **Problem.** Golf is weekly and seasonal. Daily streaks punish weekend golfers.
- **Evidence. VERIFIED FACT:** Duolingo's smaller streak action raised D14 retention 3.3% and new learners on a streak by 19% ([Duolingo blog](https://blog.duolingo.com/improving-the-streak)). The Weekend Amulet cut streak loss by 5% ([Duolingo engineering](https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)).
- **Better how.** Any one action counts: one 2-minute drill, one swing analysed or one round. Offer a weekly mode, a free Winter Freeze (Nov–Feb), a Rain Delay freeze, and a once-a-season revival. Reward effort, not scores. **VERIFIED FACT:** Duolingo replaced Hearts with Energy partly because beginners were twice as likely to run out mid-lesson ([Duolingo blog](https://blog.duolingo.com/duolingo-energy/)).
- **Technology.** Extend the existing streak (`app-3.js:370`). **Effort.** S. **Running cost.** None.
- **Revenue.** Low. **Retention.** Very high. **Copy?** Easy, but no golf rival in this research markets one.

### R4. Simplified Home (rank 7, 7.55)
- **Problem.** Home shows about ten card types (`index.html:2089-2108`). The best fitness apps put "one number or one next action" first (see [Competitor analysis](./COMPETITOR_ANALYSIS.md)).
- **Better how.** The top of Home shows "Your focus this fortnight" and one score (handicap or focus progress), with everything else below the fold. **Effort.** S. **Running cost.** None.

### P2. Stats vs golfers of your handicap (rank 8, 7.45)
- **Problem.** Strokes gained against the PGA Tour (`app-3.js:839-841`) tells an 18-handicapper they lose everywhere.
- **Competitor. VERIFIED FACT:** SwingU Pro has handicap-relative stats ([App Store GB](https://apps.apple.com/gb/app/swingu-golf-gps-by-golf-genius/id332116103)). Shot Scope and Hole19 Intelligence offer handicap benchmarking ([American Golf](https://www.americangolf.co.uk/gps/shot-scope-v5-gps-golf-watch-434900.html); [App Store GB](https://apps.apple.com/gb/app/hole19-golf-gps-range-finder/id794462227)).
- **Better how.** Plain-English lines such as "Your putting is better than most 18-handicappers; your tee shots cost you about 3 shots". Baseline data for amateur handicap bands was **not found in this research**. It could start from published amateur tables (to be sourced) and later from Caddy Coach's own anonymised rounds, which become a moat.
- **Effort.** M. **Running cost.** None.

### R2. Break 100 / 90 / 80 roadmaps (rank 9, 7.45)
- **Problem.** Average golfers think in score goals. Goals already exist in the app ("break a score", `app-3.js:672`) but don't drive a plan.
- **Competitor. VERIFIED FACT:** DECADE "Breaking 90" costs $89 for 6 months ([DECADE](https://decade.golf/memberships/)). Me and My Golf has "breaking 100" plans ([App Store UK](https://apps.apple.com/gb/app/me-and-my-golf-coaching-app/id1541212755)).
- **Better how.** Each roadmap reorders the existing 30 drills and the focus engine around the stats that matter at that level, with course-management rules for that level. **Effort.** M (mostly content). **Running cost.** None.

### A10. Honest grading and a published accuracy test (rank 10, 7.30)
- **Problem. VERIFIED FACT:** golfers doubt swing-AI accuracy: "not very 3D accurate", "thinks my swing is generally better than it is" ([GolfWRX](https://forums.golfwrx.com/topic/2061178-sportsbox-vs-swing-coach-ai-apps/)). No consumer app publishes validated accuracy figures ([BirdieSwing](https://www.birdieswing.com/blog/best-ai-golf-swing-analyzer-apps)).
- **Better how.** Show only checks the camera angle can actually measure. Display a confidence level. Run a small test against swings labelled by a PGA pro and publish the agreement rate, even if modest. That would make Caddy Coach the first consumer golf app in this research to publish one.
- **Effort.** M. **Running cost.** A one-off coach fee (not costed). **Copy?** Hard, because trust compounds.

### G2. Partner streak (rank 11, 7.25)
- **Better how.** Pair with your regular playing partner. Both must practise once that week, and the pair streak shows on both Homes. It needs push notifications (S7) to work well. **Effort.** M. **Running cost.** Negligible (Supabase rows).

### S1. Society mode (rank 12, 7.25)
- **Problem. VERIFIED FACT:** societies still juggle paper and spreadsheets, and complain about "completely manual entry of all scorecards" ([Golf Monthly forum snippet](https://forums.golfmonthly.com/threads/society-handicap-score-management.119011/)).
- **Competitor. VERIFIED FACT:** Squabbit charges £4.99 per event or £59.99 for Player Pro, £29.99 per event or £99.99 for Tournament Pro, and £249.99 for League Pro ([App Store GB](https://apps.apple.com/gb/app/id1556538444)). ParUp is free ([App Store GB](https://apps.apple.com/gb/app/parup-golf/id1546776968)).
- **Better how.** Build on the existing group rounds and competitions: several groups in one event, CONGU allowances, a season order of merit, and a "society improvement table" (most improved, most practice). That last part is something society apps can't offer because they have no coaching. The organiser pays.
- **Effort.** L. **Running cost.** Low (Supabase). **Revenue.** High: a new paying customer type. **Retention.** High: one organiser pulls in a whole group.

### L4. Winter indoor practice programme (rank 13, 7.25)
- **Problem.** Golf use peaks in summer (**VERIFIED FACT:** 18Birdies' peak day was 3 Aug 2025 ([18Birdies](https://18birdies.com/clubhouse/community/the-18-birdies-2025-community-year-in-review))). Annual subscribers who stop using the app in winter may not renew. RevenueCat reports annual first-renewal medians of about 23–40% ([RevenueCat](https://www.revenuecat.com/state-of-subscription-apps)).
- **Better how.** An 8-week "garage and living room" block built from the 7 home drills plus live camera checks. Grip, setup and posture work best indoors. **Effort.** M (content). **Running cost.** None.

### A14. Before/after proof clip (rank 16, 7.05)
- At the end of each focus block, the app asks for one re-film and auto-builds a side-by-side clip with the key check before and after. It reuses swing compare and the tracer MP4 writer. **Effort.** S. It doubles as shareable marketing.

### P3. Near-zero-effort shot capture (rank 17, 6.95)
- **Problem. VERIFIED FACT:** missed shots, editing and the phone in the pocket are recurring reasons people abandon trackers ([GolfWRX](https://forums.golfwrx.com/topic/2029985-its-time-to-move-on-from-arccos-other-options-for-tracking-rounds/); [Golf Monthly forum](https://forums.golfmonthly.com/threads/who-has-moved-away-from-arccos.118414/)).
- **Better how.** The green finder already learns from where golfers pause before scoring (`app-2.js`). Extend that: suggest the shot location when the golfer stops, use one tap to confirm, add a "2 putts" quick button, and fill the gaps after the round. Don't chase full automatic detection, because that needs hardware. **Effort.** L. **Running cost.** None (on-phone).

### S7. Web push notifications (rank 26, 6.65)
- An enabler for streaks, partner streaks, coach notes and society leaderboards. **VERIFIED FACT:** today there are only local notifications, and true push "needs a small server" (`HOW-TO-PUT-IT-ONLINE.txt`). Web push can run from a Supabase edge function. Build in quiet hours (U3) from day one. **Effort.** M. **Running cost.** Very low.

### S8. One-tap branded tracer reel (rank 19, 6.85)
- The tracer already writes MP4 (`tracer-mp4.js`). Add a small Caddy Coach watermark, a carry/curve caption and a one-tap share to Instagram or TikTok. **RECOMMENDATION:** this is the cheapest growth channel available, because every share is an advert. **Effort.** S.

### A9 + B2. Paid PGA pro review and coach seats (ranks 38 and 40)
- **Evidence. VERIFIED FACT:** Future reportedly dropped AI-only coaching to commit to human coaches ([Athletech News](https://athletechnews.com/future-pulls-the-plug-on-ai-personal-training-commits-to-human-coaches/)). UK lessons cost £75–£300 an hour at premium facilities ([GripGolf](https://gripgolf.co.uk/how-much-should-golf-lessons-cost-all-you-need-to-know/)). Coach software costs $299.99–$499 a year (see B2 above).
- **Better how.** Build on the existing coach–pupil link. A pupil pays for a 48-hour written or voice review of up to 5 key-position images (video stays on the phone, as now). Caddy Coach takes a commission. **Effort.** M. The money handling needs Stripe Connect or similar, which was not researched.

### A12. Putting stroke check (rank 44, 6.05)
- **Problem.** Better putt capture is a recurring request (see the [pain points research](./CUSTOMER_PAIN_POINTS.md)), and no putting analysis exists in Caddy Coach.
- **Better how.** Face-on phone on the floor: tempo ratio, head movement, stroke length back and through. The pose model already tracks head and hands.
- **Effort.** L. Ball-roll and face-angle measurement is uncertain with a single 2D camera. **RECOMMENDATION:** later.

---

## 5. Scoring tables

Columns: Demand (20%), Differentiation (10%), Revenue (10%), Retention (20%), Feasibility (15%), Cost efficiency (15%), Strategic (10%). Rank is the overall position out of 61.

### QUICK WINS (23 ideas)

Small or medium effort, low running cost, can ship in days to a few weeks.

| Rank | ID | Feature | Status in Caddy Coach | Effort | Demand | Differ. | Revenue | Retention | Feasibility | Cost eff. | Strategic | **Overall** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | A2 | Post-round 'One Thing' debrief (strengths, one weakness, one focus, one drill) | New (uses existing round stats) | M | 9 | 8 | 8 | 9 | 8 | 8 | 9 | **8.50** |
| 2 | A1 | Switch on the AI coach, with a visible 'what your coach remembers' card | Partly exists (built, switched off) | S | 8 | 7 | 8 | 8 | 9 | 9 | 8 | **8.20** |
| 3 | R1 | 60-second onboarding to a first 'wow' before any paywall | Partly exists (getting-started checklist) | M | 9 | 5 | 9 | 9 | 7 | 8 | 8 | **8.05** |
| 5 | P1 | MyEG companion card: score summary ready to post, playing handicap shown, post-round reminder | Partly exists (text export, WHS maths) | S | 8 | 8 | 5 | 8 | 9 | 9 | 8 | **8.00** |
| 6 | G1 | Forgiving weekly practice streak with Winter Freeze, Rain Delay and revival | Partly exists (practice streak) | S | 7 | 6 | 5 | 9 | 9 | 9 | 7 | **7.70** |
| 7 | R4 | Simplified Home: one focus card and one number | Partly exists (busy Home) | S | 8 | 5 | 6 | 8 | 8 | 9 | 7 | **7.55** |
| 13 | L4 | Winter indoor practice programme (garage, garden, living room) | Partly exists (7 home drills) | M | 7 | 7 | 6 | 8 | 7 | 8 | 7 | **7.25** |
| 14 | G10 | Daily 2-minute home drill that keeps the streak alive | Partly exists (today's focus card) | S | 7 | 5 | 5 | 8 | 8 | 9 | 6 | **7.15** |
| 16 | A14 | Automatic before/after proof clip at the end of each focus block | Partly exists (swing compare) | S | 7 | 7 | 6 | 7 | 7 | 8 | 7 | **7.05** |
| 18 | A8 | Monthly swing report with missions | Partly exists (history, trend chart) | S | 7 | 5 | 6 | 7 | 8 | 8 | 6 | **6.90** |
| 19 | S8 | One-tap branded shot-tracer reel for Instagram/TikTok | Partly exists (tracer video, share cards) | S | 7 | 7 | 5 | 6 | 7 | 8 | 8 | **6.85** |
| 21 | G9 | Ghost round: play against your own last round on the same course | New | S | 6 | 8 | 5 | 7 | 7 | 8 | 6 | **6.75** |
| 22 | L1 | Year in Golf as a December share moment | Exists (Your year in golf), needs upgrade | S | 6 | 5 | 6 | 6 | 8 | 9 | 7 | **6.75** |
| 23 | P7 | Handicap forecast ('where you'll be by spring at this pace') | New | S | 6 | 7 | 6 | 6 | 8 | 8 | 6 | **6.70** |
| 29 | G8 | Earn extra free analyses by doing drills or inviting a friend | New | S | 5 | 7 | 6 | 7 | 7 | 8 | 6 | **6.55** |
| 30 | B1 | Google Play listing (packaged PWA) | Planned, not done | S | 7 | 3 | 7 | 6 | 7 | 7 | 8 | **6.50** |
| 33 | A7 | Ask your coach about stats, rules and WHS (not just swings) | Partly exists (swing chat) | S | 6 | 5 | 5 | 6 | 8 | 8 | 6 | **6.40** |
| 35 | P6 | On-course battery saver mode | New | S | 7 | 4 | 3 | 6 | 8 | 9 | 5 | **6.35** |
| 36 | G4 | Monthly Saturday-morning Challenge Day | New | S | 5 | 7 | 4 | 7 | 7 | 8 | 6 | **6.35** |
| 39 | L3 | 5-minute pre-round warm-up routines | New | S | 6 | 5 | 5 | 6 | 8 | 8 | 5 | **6.30** |
| 47 | L2 | Round diary with highlight shot and note | Partly exists (per-hole notes) | S | 5 | 5 | 4 | 6 | 7 | 8 | 5 | **5.85** |
| 48 | P9 | Weekend weather planner: how Saturday will play, what to practise | Partly exists (round weather) | S | 5 | 6 | 4 | 5 | 7 | 8 | 5 | **5.75** |
| 53 | U3 | Wellbeing guardrails (quiet hours, 'rest your wrists') | New | S | 4 | 5 | 2 | 4 | 9 | 9 | 5 | **5.50** |

### HIGH-IMPACT FEATURES (19 ideas)

Bigger builds (weeks to a couple of months) with large retention, revenue or differentiation upside.

| Rank | ID | Feature | Status in Caddy Coach | Effort | Demand | Differ. | Revenue | Retention | Feasibility | Cost eff. | Strategic | **Overall** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | A3 | One Focus engine: rounds + swings + miss feed a single two-week focus, then prove the change | Partly exists (two-week focus, weekly plan) | M | 8 | 9 | 7 | 9 | 7 | 7 | 9 | **8.00** |
| 8 | P2 | Plain-English stats vs golfers of your handicap (not tour pros) | Partly exists (strokes gained vs PGA Tour) | M | 8 | 7 | 7 | 7 | 7 | 8 | 8 | **7.45** |
| 9 | R2 | Ability roadmaps: Break 100 / 90 / 80 | New | M | 8 | 6 | 7 | 8 | 7 | 8 | 7 | **7.45** |
| 10 | A10 | Honest grading: camera-angle-aware checks, confidence shown, tested against coach-labelled swings | Partly exists (measured vs estimated labels) | M | 8 | 7 | 6 | 7 | 7 | 7 | 9 | **7.30** |
| 11 | G2 | Partner streak with your regular playing partner | New | M | 6 | 8 | 5 | 9 | 7 | 8 | 7 | **7.25** |
| 12 | S1 | Society mode: multi-group events, CONGU allowances, season order of merit, organiser pass | Partly exists (group rounds, club competitions) | L | 8 | 7 | 8 | 8 | 5 | 6 | 9 | **7.25** |
| 15 | R3 | Plan that adapts to missed sessions and available time (Runna-style) | Partly exists (weekly plan) | M | 7 | 7 | 7 | 8 | 6 | 7 | 8 | **7.15** |
| 17 | P3 | Near-zero-effort shot capture (one tap, auto location, quick putt count) | Partly exists (manual shot marking) | L | 9 | 6 | 6 | 8 | 5 | 6 | 7 | **6.95** |
| 24 | A4 | Pre-round game plan for your home course | New | M | 7 | 7 | 7 | 6 | 6 | 7 | 7 | **6.65** |
| 25 | S2 | More game formats (Wolf, Texas scramble, team Reds v Blues) | Partly exists (skins, better ball) | M | 7 | 5 | 5 | 7 | 7 | 8 | 6 | **6.65** |
| 26 | S7 | Web push notifications (streaks, leaderboards, coach notes) | New (local notifications only today) | M | 7 | 3 | 6 | 8 | 6 | 7 | 8 | **6.65** |
| 27 | A11 | Hands-free range mode: prop phone, every swing auto-captured and replayed | Partly exists (record, live drills) | M | 7 | 7 | 6 | 7 | 6 | 6 | 7 | **6.60** |
| 28 | P5 | Verified UK course data (stroke index, slope, rating) with club confirmation badge | Partly exists (crowd majority vote) | M | 8 | 6 | 4 | 7 | 6 | 6 | 8 | **6.60** |
| 31 | A5 | On-course 'aim here' tip from your own miss pattern | Partly exists (plays-like club suggestion) | M | 7 | 6 | 7 | 6 | 6 | 7 | 6 | **6.45** |
| 34 | P4 | Auto-built carry distances from tracer and on-course shots | Partly exists (manual bag yardages) | M | 7 | 6 | 6 | 6 | 6 | 7 | 6 | **6.35** |
| 37 | G5 | Skill tree and badges for drills | Partly exists (drill progress steps) | M | 6 | 5 | 4 | 7 | 7 | 8 | 6 | **6.35** |
| 38 | A9 | Paid PGA pro review of a swing (hybrid AI + human) | Partly exists (free coach-pupil link) | M | 6 | 7 | 8 | 5 | 6 | 6 | 8 | **6.30** |
| 40 | B2 | Coach seat plan (PGA pros manage pupils) | Partly exists (free coach link) | M | 5 | 6 | 8 | 5 | 7 | 7 | 8 | **6.30** |
| 41 | G6 | Home-course hole 'segments' (best on each hole, club board) | New | M | 6 | 8 | 5 | 7 | 5 | 6 | 7 | **6.25** |

### LONG-TERM INNOVATIONS (19 ideas)

Worth doing once the core loop works and there are paying users, or bets with uncertain demand.

| Rank | ID | Feature | Status in Caddy Coach | Effort | Demand | Differ. | Revenue | Retention | Feasibility | Cost eff. | Strategic | **Overall** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20 | P8 | Practice-to-score link: which drills moved which stat | New | L | 6 | 9 | 7 | 7 | 5 | 7 | 8 | **6.80** |
| 32 | G3 | Weekly effort leagues by handicap band | New (club leaderboards are score-based) | L | 6 | 8 | 5 | 8 | 5 | 6 | 7 | **6.45** |
| 42 | B3 | Household / playing-partner two-person plan | New | S | 5 | 4 | 6 | 6 | 8 | 9 | 5 | **6.25** |
| 43 | S3 | Mates' prediction league (call your own Stableford score) | New | M | 5 | 8 | 4 | 7 | 6 | 7 | 6 | **6.15** |
| 44 | A12 | Putting stroke check from phone video | New | L | 7 | 8 | 6 | 6 | 4 | 5 | 7 | **6.05** |
| 45 | L5 | Club partner pack (club-branded, members covered by club) | Partly exists (club pages, admins) | M | 5 | 6 | 8 | 6 | 5 | 6 | 8 | **6.05** |
| 46 | U1 | Golf readiness score (Whoop-style daily number) | New | M | 5 | 7 | 5 | 6 | 6 | 7 | 6 | **5.95** |
| 49 | R5 | Body and mobility settings that change advice (age, flexibility, injuries) | New | M | 5 | 7 | 5 | 5 | 6 | 7 | 6 | **5.75** |
| 50 | L6 | Find a PGA pro near you (lesson referrals) | New | M | 6 | 6 | 7 | 5 | 5 | 5 | 7 | **5.70** |
| 51 | G7 | Club or society 'boss' quest (e.g. the 3-Putt Monster) | New | M | 4 | 8 | 4 | 6 | 6 | 7 | 5 | **5.65** |
| 52 | S5 | Light friends feed with kudos | New | M | 6 | 4 | 4 | 7 | 5 | 6 | 6 | **5.65** |
| 54 | A13 | Chipping and pitching check | New | L | 6 | 7 | 5 | 5 | 4 | 5 | 6 | **5.35** |
| 55 | U4 | Brand-sponsored drill challenges (Strava-style) | New | M | 3 | 5 | 7 | 5 | 6 | 7 | 6 | **5.35** |
| 56 | A6 | Spoken post-round debrief call | New | L | 5 | 7 | 6 | 5 | 4 | 4 | 6 | **5.10** |
| 57 | U5 | Apple Watch companion | New | XL | 7 | 3 | 6 | 7 | 2 | 2 | 6 | **4.90** |
| 58 | U2 | 'Caddy Moment' BeReal-style snap during a round | New | S | 3 | 6 | 2 | 4 | 7 | 8 | 3 | **4.75** |
| 59 | L7 | Society trip planner | New | M | 4 | 5 | 4 | 4 | 5 | 6 | 4 | **4.55** |
| 60 | S4 | Tour fantasy mini-league | New | M | 4 | 4 | 3 | 5 | 5 | 6 | 3 | **4.45** |
| 61 | S6 | Chat inside group or society | New | M | 4 | 3 | 3 | 5 | 5 | 6 | 4 | **4.45** |

---

## 6. What the ranking tells us

**RECOMMENDATION:**
- **The top five are all "join it up and switch it on" ideas:** A2, A1, R1, A3 and P1. Together they cost a few weeks of work and well under a penny per golfer per round to run.
- **Leagues and fantasy score lower than you might expect.** Golfers didn't ask for them, and they need a large user base to feel alive.
- **Hardware-like ideas score low on cost efficiency:** the watch app (U5), putting and chipping analysis (A12, A13).
- **Ideas left off on purpose:** tee-time booking, real-money wagers, own hardware, ads, official WHS score posting, and a full 3D-from-one-video engine. The reasons are in [Commercial opportunities](./COMMERCIAL_OPPORTUNITIES.md#what-not-to-build-because-it-costs-more-than-it-earns).
- **Next step.** Ask the current testers to rank the top 15 ideas. No source in this research broke down demand by handicap level (see [Customer pain points](./CUSTOMER_PAIN_POINTS.md)), so tester data would fill the biggest evidence gap.
