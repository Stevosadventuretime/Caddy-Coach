# Caddy Coach product roadmap: five phases for a solo, low-budget builder

Part of the Caddy Coach research pack (November 2026): [Executive summary](./EXECUTIVE_SUMMARY.md) · [Competitor analysis](./COMPETITOR_ANALYSIS.md) · [Customer pain points](./CUSTOMER_PAIN_POINTS.md) · [Feature ideas](./FEATURE_IDEAS.md) · [Commercial opportunities](./COMMERCIAL_OPPORTUNITIES.md) · **Product roadmap** · [Research sources](./RESEARCH_SOURCES.md) · [Full research report](../reports/Caddy%20Coach%20market%20research.md)

**Labels used in this document:**
- This whole roadmap is a **RECOMMENDATION**.
- Evidence behind each item is in [Feature ideas](./FEATURE_IDEAS.md) (scores and sources). Feature IDs (A1, P1 and so on) match that document.
- **VERIFIED FACT** marks sourced points; **ESTIMATE** marks calculations.

**Keys:**
- **Complexity:** S = under 1 week · M = 2–4 weeks · L = 1–3 months · XL = more than 3 months (solo developer working with an AI assistant).
- **Infra cost:** the extra running cost per month, beyond today's.
- **AI cost:** about 0.06p per Claude Haiku 5.5 call (**ESTIMATE**: 3,000–4,000 input + 800 output tokens at $0.10/$0.50 per million tokens, from [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)).

---

## The order, and why

**Prioritisation rule (RECOMMENDATION):** highest return for the least build and running cost. That means **switch on and join up what already exists before building anything new**.

**Calendar.** Today is 18 Nov 2026, the start of the UK winter. **VERIFIED FACT:** golf app use peaks in summer; 18Birdies' busiest day was 3 Aug 2025 ([18Birdies](https://18birdies.com/clubhouse/community/the-18-birdies-2025-community-year-in-review)). The calendar therefore drives the plan:

| When | Phase | Goal |
|---|---|---|
| Nov 2026 – early Jan 2027 | **Phase 1: Immediate improvements** | Turn the existing app into one weekly loop; prove it with testers over winter |
| Jan – Mar 2027 | **Phase 2: Competitive advantage** | Make the loop clearly better than £99.99 rivals; build the enablers (push, honest grading) |
| From Jan 2027, finished **before** any charging | **Phase 5a: Commercial readiness** (pulled forward) | Hosting, licences, Stripe; launch Plus at the start of the 2027 season (about April) |
| Apr – Sep 2027 | **Phase 3: Advanced AI** and **Phase 4: Community** in parallel | Deepen coaching; add the social reasons to return during peak season |
| Oct 2027 onwards | **Phase 5b: Scaling** | B2B (societies, coaches, clubs), Google Play, Year in Golf moment in December |

---

## Phase 1: Immediate improvements (weeks 1–6)

| Order | ID | Feature | Description | User benefit | Business benefit | Complexity | Infra cost | Depends on |
|---|---|---|---|---|---|---|---|---|
| 1 | A1 | **Switch on the AI coach + memory card** | Set the API key on the existing `cc-coach`; add an editable, opt-in "What your coach remembers" card | Coaching that remembers your miss, clubs and last focus | The headline Plus benefit; testers start generating real feedback | S | **ESTIMATE:** about 2p per golfer per month at 30 calls; hard ceiling of 3,000 calls a day ≈ $2.10 a day | Anthropic API key and spend limit |
| 2 | A2 | **Post-round "One Thing" debrief** | After saving a round: strengths, one weakness (in shots lost), one focus, one drill, all linked to recent swing faults | Knows exactly what to practise this week | Main retention loop; main reason to pay | M | about 0.06p per round | A1 |
| 3 | P1 | **MyEG companion card** | Post-round card with gross scores in MyEG order, playing handicap, adjusted gross, estimated new index, "remind me when I have signal" | Saves faff with the official app; nothing lost without signal | Rides an existing weekly habit (MyEG is mandatory) | S | None | none |
| 4 | R4 | **Simplified Home** | Top of Home shows "Your focus this fortnight" + one number; other cards fold below | Clear next step every time the app opens | Less confusion, higher return rate | S | None | A2 (for the focus card) |
| 5 | R1 | **60-second onboarding** | 3 questions (handicap, miss, goal), then film one swing or see your handicap + focus; sample swing if not at the range | Value in the first minute | **VERIFIED FACT:** 86.1% of H&F trial starts are on day 0 ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)) | M | None | R4 |
| 6 | G1 + G10 | **Forgiving weekly streak + 2-minute home drill** | Any one action keeps the streak; weekly mode; Winter Freeze (Nov–Feb), Rain Delay, a seasonal revival; a daily 2-minute drill counts | Motivation without guilt over winter | Retention through the off-season | S | None | none (extends `app-3.js:370`) |
| 7 | L4 | **Winter indoor programme** | 8-week garage/living-room block using the 7 home drills and live grip/setup checks | Keeps improving when courses are wet | Keeps winter users active; trial content for spring | M (mostly content) | None | G1 |
| 8 | P6 | **On-course battery saver** | Lower GPS polling between shots, dark screen, "battery mode" toggle | Phone lasts 18 holes | Removes a recurring complaint | S | None | none |
| 9 | — | **Tester survey by handicap level** | 5 questions in-app: level, top frustration, would-pay price, top 3 features from the scored list | n/a | Fills the biggest evidence gap (no data by level) | S | None | Existing feedback screen |

**How to know Phase 1 worked.** Compare the owner dashboard's **4-week return rate** and the weekly practice count before and after (`app-3.js:1573-1590` already tracks both). No baseline figure was available to this research, so record it before shipping.

---

## Phase 2: Competitive advantage (about Jan – Mar 2027)

| Order | ID | Feature | Description | User benefit | Business benefit | Complexity | Infra cost | Depends on |
|---|---|---|---|---|---|---|---|---|
| 10 | A3 | **One Focus engine** | Ranks round stats, swing faults and stated miss into one two-week focus with a reason; ends with a proof check | One clear job, then proof it worked | Hard-to-copy core of Plus | M–L | about 0.06p per focus | A1, A2 |
| 11 | A14 | **Before/after proof clip** | Auto side-by-side of the focus check, start vs end of block | Sees real progress | Shareable proof that sells the app | S | None (on-phone MP4) | A3 |
| 12 | P2 | **Stats vs golfers of your handicap** | Replace or supplement the PGA Tour baseline with handicap-band comparisons in plain English | Stats that mean something | Answers the "stats tell me nothing new" complaint | M | None | Amateur baseline data (not yet sourced) |
| 13 | A10 | **Honest grading + published test** | Show only checks each camera angle can measure; confidence levels; test about 50–100 swings against a PGA pro's labels and publish the agreement rate | Trust | First consumer golf app in this research to publish accuracy | M | One-off coach fee (not costed) | A PGA pro partner |
| 14 | R2 | **Break 100 / 90 / 80 roadmaps** | Level-based plans reordering the 30 drills and the focus engine | Goal in golfer language | Strong Plus feature; creator partnership hook | M (content) | None | A3 |
| 15 | S7 | **Web push notifications** | Push for streaks, coach notes, group rounds and leaderboards; quiet hours built in (U3) | Timely nudges | The re-engagement channel (only local notifications today) | M | Very low (Supabase edge function) | Hosting that supports it (Phase 5a) |
| 16 | S8 | **Branded tracer reel** | One-tap Instagram/TikTok video with watermark and carry/curve caption | Show off a good shot | Free marketing from every share | S | None | none |
| 17 | A8 | **Monthly swing report with missions** | First-of-month card: progress, a mission for the month | Sense of progress | Habit; Plus feature | S | about 0.03p per report via Batch API (**ESTIMATE**: 0.06p × 50%) | A1 |
| 18 | P5 | **Verified UK course data** | "Verified" badge when a club admin confirms slope, rating and stroke index; flag disagreements | Correct playing handicaps | UK trust advantage over US apps | M | None | Club admin tools (exist) |
| 19 | P7 | **Handicap forecast** | "At this pace you'll be about X by May" | Motivation | Plus feature | S | None | WHS history (exists) |

---

## Phase 3: Advanced AI (about Apr – Sep 2027)

| Order | ID | Feature | Description | User benefit | Business benefit | Complexity | Infra cost | Depends on |
|---|---|---|---|---|---|---|---|---|
| 20 | R3 | **Adaptive plan** | Weekly plan adjusts to missed sessions, available time and progress (Runna-style); intensity setting | Plan fits real life | Retention; Plus | M | None | A3 |
| 21 | A4 | **Pre-round game plan (home course)** | Hole-by-hole "aim here, club there" from your dispersion, miss pattern and the hole map | Fewer blow-up holes | Strategy is a paid category (DECADE) | M | about 0.06p per round | P4, course maps (exist) |
| 22 | A5 | **On-course aim tip** | Adds aim advice from your miss to the existing plays-like club suggestion | Smarter decisions without thinking | Plus feature at the moment of play | M | None (on-phone) | A4 |
| 23 | A11 | **Hands-free range mode** | Prop the phone; every swing auto-detected, replayed and checked against the current focus | Practice with feedback, no fiddling | Daily-use Plus feature | M | None (on-phone) | Existing pose pipeline |
| 24 | P4 | **Auto carry distances** | Fill bag carry yardages from traced and on-course shots | Accurate club choice | Better plays-like advice | M | None | Shot tracer, shot marking |
| 25 | P3 | **Near-zero-effort shot capture** | Suggest shot spots from pauses; one-tap confirm; quick putt buttons; tidy-up after the round | Stats without hassle | Removes the #2 complaint | L | None | Green finder (exists) |
| 26 | A7 | **Coach chat for stats, rules and WHS** | Extend the server prompt beyond swings | One place for golf questions | Plus value | S | about 0.06p per question | A1 |
| 27 | P8 | **Practice-to-score link** | Shows which drills preceded stat changes | Knows practice works | Unique proof of value | L | None | A3, enough data |
| 28 | A12 | **Putting stroke check** | Face-on phone on the floor: tempo, head movement, stroke length | First putting help in the app | Fills a missing area | L | None (on-phone) | Pose model tuning |
| 29 | A13 | **Chipping check** | Similar for short game | Short-game help | Completeness | L | None | A12 |
| 30 | A6 | **Spoken post-round debrief** | Voice version of A2 | Hands-free review | Premium hook | L | Voice costs **not researched** | A2 |

---

## Phase 4: Community, social and engagement (about Apr – Dec 2027)

| Order | ID | Feature | Description | User benefit | Business benefit | Complexity | Infra cost | Depends on |
|---|---|---|---|---|---|---|---|---|
| 31 | G2 | **Partner streak** | Pair with a regular playing partner; both practise once a week | Friendly accountability | **VERIFIED FACT:** a third of Duolingo daily users hold a Friend Streak ([Duolingo IR](https://duolingo.gcs-web.com/static-files/3c8277ee-bc94-4f5d-9b77-0db3e46f88b8)) | M | Negligible (Supabase rows) | G1, S7 |
| 32 | S1 | **Society mode** | Multi-group events, CONGU allowances, season order of merit, "most improved" and practice tables; organiser pass | No more paper and spreadsheets | New paying customer (organiser) | L | Low | Group rounds and competitions (exist), S7 |
| 33 | S2 | **More game formats** | Wolf, Texas scramble, team Reds v Blues | More fun with mates | Group retention | M | None | S1 |
| 34 | G9 | **Ghost round** | Play against your own last round on the same course | A rival every round | Retention | S | None | Round history (exists) |
| 35 | G4 | **Monthly Challenge Day** | Saturday-morning 3-hour featured drill with a badge | Fun event | Monthly re-engagement spike | S | None | S7 |
| 36 | G5 | **Skill tree and badges** | Visual progression through drills | Progress you can see | Retention | M | None | Drill progress steps (exist) |
| 37 | G8 | **Earn extra free analyses** | Free users earn analyses by completing drills or inviting a friend | Free users keep going | Invite loop; softer paywall | S | about 0.06p per extra analysis | Plus gating |
| 38 | G6 | **Home-course hole segments** | Best score on each hole, club board per hole | Local bragging rights | Club engagement | M | Low | Club leaderboards (exist) |
| 39 | G3 | **Weekly effort leagues by handicap band** | About 20–30 similar golfers, reset Sunday night, effort XP only, private opt-out | A league you can win | Weekly habit | L | Low | Enough active users; S7 |
| 40 | L1 | **Year in Golf upgrade (Dec 2027)** | Shareable recap, at least 10 rounds needed; teaser free, full recap in Plus | A season keepsake | Free PR every December | S | None | Existing "Your year in golf" |
| 41 | S3 | **Mates' prediction league** | Predict your own Stableford; points for beating it; no money | Banter | Group retention | M | Low | S1 |
| 42 | L2 / L3 | **Round diary + warm-up routines** | One-line note and highlight per round; 5-minute pre-round routine | Memories; better starts | Content depth | S each | None | none |
| 43 | S5 | **Light friends feed with kudos** | Friends' rounds and practice, kudos only, no comments | Encouragement | Social proof | M | Low | S7, privacy settings |
| 44 | G7 | **Society boss quest** | Group "fights" a monthly boss with logged drills | Team fun | Society engagement | M | Low | S1 |

**Deliberately low priority:** chat (S6), tour fantasy (S4), the "Caddy Moment" snap (U2) and a trip planner (L7). They scored lowest in [Feature ideas](./FEATURE_IDEAS.md).

---

## Phase 5: Monetisation and scaling

### 5a. Commercial readiness: must be finished before taking any payment (start Jan 2027)

| Order | Item | Description | Why | Complexity | Cost | Depends on |
|---|---|---|---|---|---|---|
| C1 | **Move hosting off GitHub Pages** | Choose and move to a static host that allows commercial use (not Netlify, per project rules) | **VERIFIED FACT:** GitHub Pages forbids commercial SaaS ([GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)) | M | **Not researched**; price it first | none |
| C2 | **Supabase Pro** | Upgrade so the project never pauses | Free projects pause (`README.md`) | S | **VERIFIED FACT:** $25/month ([Supabase](https://supabase.com/pricing)) | none |
| C3 | **Commercial data licences** | Met Office weather key (Open-Meteo is non-commercial), ArcGIS imagery key, own course-data server instead of public Overpass | Required by the providers' terms (`README.md`; `cc-weather/index.ts`) | M | **Not researched**; price each | none |
| C4 | **Business + Stripe + VAT** | Business set-up, Stripe account, webhook secret, VAT advice | Stripe webhook is built but inactive (`cc-stripe-webhook/index.ts`) | S–M | **VERIFIED FACT:** Stripe 1.5% + 20p + 0.7% Billing ([Stripe GB](https://stripe.com/gb/pricing)) | C1 |
| C5 | **Update the launch doc** | `HOW-TO-PUT-IT-ONLINE.txt` says PLUS is in `index.html`; it is in `app-3.js` | Avoid mistakes at launch | S | None | none |

### 5b. Launch and scale

| Order | ID | Feature | Description | User benefit | Business benefit | Complexity | Infra cost | Depends on |
|---|---|---|---|---|---|---|---|---|
| 45 | — | **Launch Caddy Coach Plus (about April 2027)** | £44.99/yr or £6.99/mo, 21-day trial, founding price £34.99/yr locked for testers and first-season joiners; new AI features in Plus; tracer and grip stay free | Clear value, fair price | Revenue | S (code exists) | Stripe fees only | C1–C4, Phases 1–2 |
| 46 | B1 | **Google Play listing (packaged PWA)** | Package with PWABuilder as already planned | Find it in the store | Discovery; **VERIFIED FACT:** 15% fee on the first $1M ([RevenueCat](https://www.revenuecat.com/blog/engineering/app-store-fees)) | S–M | 15% of store revenue | C1 |
| 47 | S1 pass | **Society Pass** | £4.99 per event or £39.99 per season, paid by the organiser | One payment covers the group | B2B revenue line | S (on top of S1) | Stripe fees | S1, C4 |
| 48 | B2 | **Coach seats** | About £99/yr per PGA pro; first season free | Manage pupils cheaply | Distribution: every coach brings pupils | M | Low | Coach link (exists) |
| 49 | A9 | **Paid PGA pro swing review** | Pupil pays about £15–£25; coach keeps about 70% | Human expert on top of AI | Commission revenue; the "Future" hybrid model | M | Payment-split tooling **not researched** | B2, C4 |
| 50 | — | **Affiliate kit links (drill kit only)** | Clearly marked links on drills that need kit | Know what to buy | **ESTIMATE:** small (about £18 per £300 sale at 6%) | S | None | C4 |
| 51 | L5 | **Club partner pack** | Club-branded page; club pays to cover members | Members get Plus via their club | **VERIFIED FACT:** HowDidiDo charges clubs £1,400/yr ([NCG](https://www.nationalclubgolfer.com/club/howdidido-new-app-charges)) | M | Low | Club pages (exist), B2 track record |
| 52 | B3 | **Two-person plan** | About £64.99/yr for two playing partners | Cheaper together | Pairs reinforce G2 | S | None | Plus launch |
| 53 | — | **Code and data hardening** | Split the very large JS files; move leaderboards, groups and competitions out of the shared `course_cards` prefix rows; server-side handicap checks | n/a | Lowers the risk of a solo developer breaking things at scale | L | None | Before big user growth |
| 54 | U5 | **Apple Watch companion (only if demand proves it)** | Native watch app | Yardages on the wrist | Parity with big rivals | XL | Apple developer fee (about $99/yr, unverified) | B1, revenue |

---

## What we should build next

**RECOMMENDATION: switch on the AI coach (A1) and build the post-round "One Thing" debrief (A2) on top of it, followed straight away by the MyEG companion card (P1) on the same post-round screen.**

**Why this first:**
1. **It uses what already exists.** The AI coach, round stats, strokes gained, swing-fault history, drills and two-week focus are all built. Turning on the AI coach is a configuration step, and the debrief is a new prompt plus one screen.
2. **It hits the top golfer complaint about stats.** **VERIFIED FACT:** stats that don't "tell me anything significant I don't already know" ([Golf Monthly forum](https://forums.golfmonthly.com/threads/who-has-moved-away-from-arccos.118414/)).
3. **It undercuts rivals.** It matches what Hole19 and SwingU charge £99.99 for (see [Competitor analysis](./COMPETITOR_ANALYSIS.md)).
4. **It arrives at the right moment.** **VERIFIED FACT:** since Sep 2025, English golfers already open an app after every round to post their score in MyEG ([Northern Golfer](https://www.northerngolfer.co.uk/new-whs-record-set-in-england-in-august/)).
5. **It costs almost nothing to run.** **ESTIMATE:** about 0.06p per round.

**Suggested first three weeks:**
- **Week 1:** set the API key with a spend limit; ship the memory card; check the existing daily limits (6 analyses and 20 questions for signed-in users).
- **Week 2:** write the debrief prompt (strokes-gained categories, the worst three holes, recent faults, current focus); show it after "save round"; fall back to on-phone text when offline.
- **Week 3:** add the MyEG card and "set as my focus" button; bump `sw.js`; ask testers to use it for the next three rounds; read the dashboard return rate.
