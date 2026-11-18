# Caddy Coach research sources and limitations

Part of the Caddy Coach research pack (November 2026): [Executive summary](./EXECUTIVE_SUMMARY.md) · [Competitor analysis](./COMPETITOR_ANALYSIS.md) · [Customer pain points](./CUSTOMER_PAIN_POINTS.md) · [Feature ideas](./FEATURE_IDEAS.md) · [Commercial opportunities](./COMMERCIAL_OPPORTUNITIES.md) · [Product roadmap](./PRODUCT_ROADMAP.md) · **Research sources** · [Full research report](../reports/Caddy%20Coach%20market%20research.md)

Every web source below was accessed on **18 Nov 2026**. The list holds 306 unique URLs, grouped by the research topic they first appeared under. Each URL is listed once, even if more than one topic cited it. Labels are the link text used in the research notes.

## Caddy Coach's own code (read 18 Nov 2026)

Facts about what Caddy Coach already does come from the repository, not the web. The main files read were:
- `app-1.js`, `app-2.js`, `app-3.js`, `app-4.js`, `index.html`
- `metrics.js`, `swingcoach.js`, `coach.js`, `drills.js`, `live.js`, `grip.js`, `setup.js`
- `tracer.js`, `tracer-mp4.js`, `whs.js`, `flyover.js`, `homehole.js`, `sw.js`, `manifest.webmanifest`
- `supabase/functions/*` (cc-auth, cc-signup, cc-weather, cc-stripe-webhook, cc-coach), `supabase/migrations/*`, `supabase/setup.sql`
- `README.md`, `HOW-TO-PUT-IT-ONLINE.txt`

Counts (drills, checks, file sizes) came from text searches over the code, not from running the app.

## Limitations: what this research could not check

- **Reddit couldn't be read directly.** The fetch tool doesn't support reddit.com, so every Reddit point comes from search-result snippets or from aggregator sites. Those are marked *(snippet)*. Some aggregators (Birvix, GummySearch) are run by, or sell, rival apps.
- **Few app-store reviews were collected.** Love and complaint evidence comes from a handful of UK App Store listings plus a few US ones. Google Play ratings were not checked. No systematic review mining was done, so how often each complaint appears in store reviews is unmeasured.
- **Many prices are second-hand.**
  - UK App Store in-app purchase lists show price points without saying which plan each belongs to.
  - Several prices come from search summaries, competitors' blogs (BirdieSwing, GOATCode, Skillest, Golf Pad, SwingU) or review sites.
  - Many prices were in USD only. Converting at about £0.79 per $1 is an assumption.
  - Prices change, so check them live before quoting any.
- **No data by handicap level.** No source split golfers' pain points or wants by beginner, mid or low handicap. The level table in [Customer pain points](./CUSTOMER_PAIN_POINTS.md) is a set of hypotheses to test.
- **No golf retention or churn data.** No golf app published retention, churn or conversion figures. All benchmarks come from general Health & Fitness reports (RevenueCat, Adapty), some read only through secondary coverage.
- **Accuracy is unverified.** There are no independent accuracy tests of any phone swing-analysis app, including Caddy Coach. The Caddy Coach app itself was not run.
- **Some costs were not priced:**
  - replacement hosting for GitHub Pages;
  - the Met Office weather plan;
  - an ArcGIS imagery key;
  - a course-data server;
  - voice AI;
  - payment-splitting for coach reviews;
  - Apple and Google developer fees (not verified on official pages).
- **Some legal questions were not researched:** UK gambling law for fantasy or wager features, and UK/EU anti-steering rules for web payments inside store apps. VAT treatment was not researched either; take accountancy advice.
- **Some topics have thin coverage:**
  - weather-related golfer needs (no evidence found);
  - slow play caused by apps (no evidence found);
  - Scottish Golf and Wales Golf apps;
  - Golfboy, Rick Shiels-style creator apps;
  - Catapult;
  - Golf Genius's club and society product;
  - Runna's adaptation mechanics;
  - Zwift's features.
- **Some sources are low-confidence:** aggregator mirrors (e.g. an "NGF-style" report), a Bunkered social post, the WeekendGolfer statistics page, and figures that conflict between sources. These are flagged where they are used.
- **Company claims are not independent.** For example: Arccos's "5.7 strokes" handicap cut, Hole19's user numbers, GolfFix's download counts, and Sportsbox's accuracy validation.


## Golf GPS, scoring, stats and UK golf-social apps

From research note `golf_gps_stats_apps.md`. 48 sources, all accessed 18 Nov 2026.

- App Store GB: <https://apps.apple.com/gb/app/18birdies-golf-gps-tracker/id892700751>
- 18Birdies: <https://18birdies.com/clubhouse/community/10-million-golfers-10-dream-courses-10-weeks>
- 18Birdies: <https://18birdies.com/clubhouse/community/the-18-birdies-2025-community-year-in-review>
- AppGoblin: <https://appgoblin.info/apps/com.squarevalley.i8birdies>
- NGF-style report: <https://ngf-oracle-reports.pages.dev/usga/golf-app-landscape.html>
- App Store GB: <https://apps.apple.com/gb/app/hole19-golf-gps-range-finder/id794462227>
- First Call Golf press release: <https://www.firstcallgolf.com/industry-news/release/2025-07-09/hole19-launches-otto-ai>
- Hole19 blog: <https://www.hole19golf.com/the-19th-hole/hole19-intelligence-tier>
- Golf Monthly (sponsored): <https://www.golfmonthly.com/gear/hole19-launches-intelligence-plan-to-help-golfers-lower-scores-faster>
- Arccos UK comparison: <https://uk.arccosgolf.com/pages/arccos-product-comparison>
- Arccos Air: <https://uk.arccosgolf.com/products/air>
- GolfMagic, 20 Aug 2026: <https://www.golfmagic.com/equipment/buying-guides/best-golf-apps>
- American Golf: <https://www.americangolf.co.uk/gps/shot-scope-v5-gps-golf-watch-434900.html>
- retailer listing: <https://www.clubhousegolf.co.uk/acatalog/Shot-Scope-V5-Golf-GPS-Watch-Grey.html>
- Golf Monthly: <https://www.golfmonthly.com/reviews/gps/shot-scope-v5-golf-gps-watch-review>
- MyGolfSpy: <https://mygolfspy.com/news-opinion/shot-scope-adds-strokes-gained-course-analysis-features/>
- Golfshot help centre: <https://shotzoom.zendesk.com/hc/en-us/articles/360000956554-What-is-Golfshot-Pro-and-what-does-it-cost>
- Golf Monthly: <https://golfmonthly.com/features/what-is-the-difference-between-golfshot-and-golfshot-pro>
- App Store GB: <https://apps.apple.com/gb/app/thegrint-golf-gps-scorecard/id532085262>
- App Store GB: <https://apps.apple.com/gb/app/garmin-golf/id1192480582>
- GolfLogix App Store US: <https://apps.apple.com/us/app/-/id322399059>
- Plugged In Golf: <https://pluggedingolf.com/?p=77845>
- App Store GB: <https://apps.apple.com/gb/app/swingu-golf-gps-by-golf-genius/id332116103>
- App Store GB: <https://apps.apple.com/gb/app/golf-gamebook-scorecard-gps/id409307935>
- Clippd: <https://clippd.com>
- App Store: <https://apps.apple.com/us/app/circles-golf/id6444925845>
- appshunter: <https://appshunter.io/ios/app/6444925845>
- England Golf help: <https://englandgolf.freshdesk.com/support/solutions/articles/80000972978-how-to-add-and-verify-a-score-on-myeg-app>
- Northern Golfer: <https://www.northerngolfer.co.uk/new-whs-record-set-in-england-in-august/>
- GolfMagic: <https://www.golfmagic.com/news/england-golf-announces-record-breaking-month-world-handicap-system>
- National Club Golfer, 8 Jan 2026: <https://www.nationalclubgolfer.com/club/howdidido-new-app-charges>
- App Store: <https://apps.apple.com/gb/app/id6742023251>
- App Store GB: <https://apps.apple.com/gb/app/id1556538444>
- App Store GB: <https://apps.apple.com/gb/app/parup-golf/id1546776968>
- BetaFamily: <https://betafamily.com/app/1926>
- Golf Business News: <https://golfbusinessnews.com/news/new-products/riddygolf-app-aims-to-simplify-society-golf-admin/>
- Teeday: <https://apps.apple.com/us/app/teeday/id6763561922>
- 18Birdies help: <https://help.18birdies.com/article/661-whats-included-with-18birdies-premium>
- Golf Digest: <https://www.golfdigest.com/story/arccos-smart-laser-rangefinder-now-to-include-app-access-to-ai-c>
- American Golf: <https://americangolf.co.uk/balls-accessories/shot-swing-trackers/arccos-caddie-generation-3%2B-smart-golf-sensors-408423.html>
- Arccos gift card: <https://uk.arccosgolf.com/collections/arccos-products/products/gift-card>
- American Golf: <https://americangolf.co.uk/gps/shot-scope-v5-gps-golf-watch-434902.html>
- Birvix (biased): <https://birvix.pages.dev/compare/pricing/golfshot-pricing>
- Breaking Eighty: <https://breakingeighty.com/golflogix-review>
- Marlvel report: <https://marlvel.ai/apps/18birdies-golf-gps-tracker>
- AppFollow / App Store US: <https://apps.appfollow.io/ios/thegrint-golf-handicap/532085262?country=us>
- GummySearch: <https://gummysearch.com/tools/best-products/golf-app/>
- Birvix (biased): <https://birvix.pages.dev/resources/best/best-golf-app-reddit>

## Golf coaching, swing analysis and launch monitors

From research note `golf_coaching_swing_tech.md`. 35 sources, all accessed 18 Nov 2026.

- sportsbox.ai: <https://www.sportsbox.ai/>
- BirdieSwing blog, 26 Aug 2026 (written by a competitor): <https://www.birdieswing.com/blog/best-ai-golf-swing-analyzer-apps>
- golffix.io: <https://www.golffix.io/en/golffix>
- WBD/Golf Digest press release: <https://press.wbd.com/us/media-release/golf-digest/golf-digest-mustard-launch-groundbreaking-ai-powered-platform-mustard-golf-help-every>
- App Store UK: <https://apps.apple.com/gb/app/mustard-golf-swing-analysis/id6499280777>
- GOATCode V1 review (competitor): <https://goatcode.ai/v1-golf-app-review-is-it-worth-it.html>
- Skillest blog: <https://skillest.com/blog/skillest-vs-v1-golf/>
- Skillest features: <https://skillest.com/features>
- coachnow.com/pricing: <https://coachnow.com/pricing>
- OnForm blog: <https://onform.com/blog/onform-acquires-hudl-technique/>
- VisualEyes: <https://www.visualeyesapp.com/blog/hudl-technique-replacement>
- App Store UK: <https://apps.apple.com/gb/app/me-and-my-golf-coaching-app/id1541212755>
- DECADE memberships: <https://decade.golf/memberships/>
- ScoringZone review: <https://www.scoringzone.net/blog/decade-golf-app-review>
- pinpoint.golf: <https://www.pinpoint.golf/>
- App Store: <https://apps.apple.com/us/app/golfpass-video/id1448493740>
- Rapsodo UK memberships: <https://rapsodo.co.uk/pages/rapsodo-golf-memberships>
- PlayBetter review 2026: <https://www.playbetter.com/blogs/golf-simulator-reviews/garmin-approach-r10-review-golf-launch-monitor-under-1000>
- Trackman software: <https://www.trackman.com/golf/launch-monitors/software>
- Trackman FAQ Golf Pro App: <https://support.trackmangolf.com/hc/en-us/articles/37707767452571-FAQ-Golf-Pro-App>
- HomeCourt subscription FAQ: <https://www.homecourt.ai/faq/subscription>
- App Store reviews: <https://apps.apple.com/us/app/mustard-golf-swing-analysis/id6499280777?see-all=reviews&platform=iphone>
- GOATCode (competitor): <https://goatcode.ai/v1-golf-app-review-2026-honest.html>
- Sportsbox sign-up: <https://3dgolf.sportsbox.ai/sign-up?plansType=players>
- App Store: <https://apps.apple.com/us/app/golffix-ai-golf-swing-analyzer/id1586120680>
- Golfspan: <https://www.golfspan.com/best-golf-swing-analysis-app>
- GOATCode pricing (competitor): <https://goatcode.ai/v1-golf-app-pricing-2026.html>
- SourceForge: <https://sourceforge.net/software/product/V1-Golf-App/>
- Grumpy Gopher: <https://www.grumpygopher.com/best-online-golf-lessons>
- App Store US: <https://apps.apple.com/us/app/onform-video-analysis-app/id1490334045>
- meandmygolf.com membership: <https://meandmygolf.com/me-and-my-golf-membership/>
- Rapsodo UK blog: <https://rapsodo.co.uk/blogs/golf/rapsodo-mlm2pro-premium-lifetime-membership>
- App Store: <https://apps.apple.com/us/app/golffix-ai-golf-swing-analyzer/id1586120680?see-all=reviews>
- Google Play: <https://play.google.com/store/apps/details?id=kr.co.moais.golffix&hl=en_US>
- Golf Training Daily: <https://www.golftrainingdaily.com/blog/ai-golf-swing-analyzer-apps>

## Fitness, health and premium subscription apps

From research note `fitness_subscription_apps.md`. 64 sources, all accessed 18 Nov 2026.

- BikeRadar: <https://www.bikeradar.com/news/strava-year-in-sport-2025>
- Endurance Sportswire: <https://www.endurancesportswire.com/?p=221014>
- Marathon Handbook: <https://marathonhandbook.com/strava-announces-acquisition-of-personalized-training-app-runna/>
- Tom's Guide: <https://www.tomsguide.com/wellness/fitness/strava-and-runna-launch-joint-subscription-heres-what-you-need-to-know>
- Expert Reviews: <https://www.expertreviews.co.uk/beauty-wellness/wearables/whoop-5-0-review>
- T3: <https://www.t3.com/active/fitness-trackers/did-whoop-just-win-the-wearable-subscription-game>
- TechRadar: <https://www.techradar.com/health-fitness/smartwatches/furious-garmin-users-revolt-over-new-subscription-service-we-need-to-take-a-firm-stand>
- TechRadar: <https://techradar.com/health-fitness/oura-ring-4-latest-news-rumors-and-what-we-want-to-see>
- GB News: <https://www.gbnews.com/tech/oura-ring-4-online-sale-currys-boots-amazon-uk>
- Garage Gym Reviews: <https://www.garagegymreviews.com/myfitnesspal-review>
- MyFitnessPal Premium+: <https://www.myfitnesspal.com/premium-plus>
- findyouredge: <https://www.findyouredge.app/news/freeletics-alternatives-uk-2026>
- App Store UK: <https://apps.apple.com/gb/app/freeletics/id654810212>
- findyouredge: <https://www.findyouredge.app/news/nike-training-club-alternatives-uk-2026>
- TechRadar: <https://www.techradar.com/news/apple-fitness-plus-vs-nike-training-club>
- Apple UK: <https://www.apple.com/uk/apple-fitness-plus/>
- Peloton UK: <https://onepeloton.com/en-GB/app>
- Garage Gym Reviews: <https://www.garagegymreviews.com/future-app-review>
- Athletech News: <https://athletechnews.com/future-pulls-the-plug-on-ai-personal-training-commits-to-human-coaches/>
- Ladder: <https://offer.joinladder.com>
- Trainwell comparison: <https://www.trainwell.net/blog/trainwell-vs-ladder-best-personal-training-apps-compared-2026>
- Zwift UK: <https://www.zwift.com/uk/news/33635-how-much-does-zwift-cost-and-whats-included-everything-you-need-to-know>
- Velora Cycling: <https://veloracycling.com/guides/buying/best-indoor-cycling-apps-2026>
- themindwanders: <https://themindwanders.com/headspace-vs-calm/>
- SGI Europe: <https://www.sgieurope.com/consumer/gen-z-chooses-fitness-over-social-media-strava-study-reveals/118471.article>
- Webull/press release: <https://www.webull.com/news/13961203642123264>
- T3: <https://www.t3.com/active/running/strava-year-in-sport-trend-report-2025>
- Plunge: <https://plunge.com/blogs/blog/whoop-launches-5-0-and-mg-devices>
- Engadget: <https://engadget.com/2242774/most-expensive-whoop-membership-life-why-pay/>
- nextpit: <https://www.nextpit.com/news/garmin-connect-plus-which-ai-features-worth-it-or-not>
- TechRadar: <https://www.techradar.com/health-fitness/exercise-equipment/peloton-revamps-loads-of-its-fitness-equipment-introduces-an-ai-powered-coaching-features-and-of-course-hikes-prices>
- Advnture: <https://www.advnture.com/tech/the-highly-anticipated-strava-runna-subscription-lands-giving-runners-ai-powered-coaching-for-less-than-the-price-of-a-pair-of-running-shoes>
- Running Insight: <https://www.runninginsight.com/movement-is-in-running-is-cool-and-community-rules>
- Insider FITT: <https://insider.fitt.co/gen-z-drives-strength-social-workouts/>
- Adapty H&F benchmarks, Mar 2026: <https://adapty.io/blog/health-fitness-app-subscription-benchmarks/>
- BikeRadar: <https://www.bikeradar.com/news/strava-hikes-monthly-subscription-cost-by-more-than-25-per-cent>
- Cycling Weekly: <https://cyclingweekly.com/news/strava-insists-new-pricing-structure-is-legal>
- endurance.biz: <https://endurance.biz/?p=89546>
- Runna support: <https://support.runna.com/en/articles/18298149-changes-to-our-uk-subscription>
- the5krunner: <https://the5krunner.com/2026/11/10/quick-read-runna-price-rise>
- Tom's Guide: <https://www.tomsguide.com/wellness/smartwatches/garmin-sparks-outrage-with-connect-subscription-paywall-have-your-say>
- Currys: <https://www.currys.co.uk/brand/oura/oura.html>
- Recime: <https://www.recime.app/blog/myfitnesspal-cost>
- subger (aggregator): <https://subger.com/en/service/freeletics>
- Sensai: <https://www.sensai.fit/blog/future-app-review-2026>
- Ladder pricing: <https://www2.joinladder.com/pricing>
- EE: <https://ee.co.uk/products/calm-trial>
- upskillwise: <https://upskillwise.com/?p=11070>
- lifestack: <https://lifestack.ai/blog/headspace-pricing>
- Calm support: <https://support.calm.com/hc/en-us/articles/32949555877147-Calm-with-Match-UK>
- Peloton UK partners: <https://onepeloton.com/en-GB/partners/hyatt/offers>
- BikePerfect: <https://bikeperfect.com/news/strava-faces-backlash-as-platform-increases-monthly-subscription-price-by-25-percent>
- Advnture: <https://www.advnture.com/tech/watches-wearable-tech/garmin-lovers-could-be-forced-to-pay-more-for-favorite-features-as-the-smartwatch-brand-considers-new-paywalls>
- TechRadar poll: <https://www.techradar.com/health-fitness/ill-switch-to-another-brand-i-polled-over-1-000-garmin-users-to-see-what-they-thought-of-garmins-connect-premium-tier-one-year-after-its-launch>
- TechCrunch: <https://techcrunch.com/2025/05/11/fitness-tracker-whoop-faces-unhappy-customers-over-upgrade-policy>
- Bloomberg: <https://www.bloomberg.com/news/articles/2025-05-09/whoop-faces-backlash-after-charging-existing-users-upgrade-fee-for-new-models>
- TechRadar: <https://www.techradar.com/health-fitness/fitness-trackers/whoop-has-broken-a-promise-on-free-hardware-upgrades-and-users-arent-pleased>
- TechRadar: <https://techradar.com/opinion/strava-premiums-still-worth-getting-unless-you-already-use-garmin-connect>
- SGB: <https://sgbonline.com/stravas-year-in-sport-trend-report-highlights-gen-zs-passion-for-run/>
- RevenueCat: <https://revenuecat.com/state-of-subscription-apps-2025>
- Subscription Insider: <https://subscriptioninsider.com/article-type/news/revenuecats-state-of-subscription-apps-2025-report-ais-dominance-retention-challenges-and-the-shift-away-from-pure-subscriptions>
- Athletech News: <https://athletechnews.com/fitness-apps-monetizable-winner-take-all-or-most/>
- RevenueCat blog: <https://www-docs.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026>
- Business of Apps: <https://businessofapps.com/?p=98298>

## Learning, AI tutors, social and gamification apps

From research note `learning_social_gamification_apps.md`. 82 sources, all accessed 18 Nov 2026.

- Duolingo Q4 FY2025 results via SEC/IR search summary: <https://www.boardroomalpha.com/sec/duol-8-k-2026-02-26-0001628280-26-012246/q4fy25duolingo12-31x25pres.htm>
- Duolingo Q3 2025 shareholder letter (SEC): <https://www.sec.gov/Archives/edgar/data/1562088/000162828025049514/q3fy25duolingo9-30x25share.htm>
- Q1 FY26 letter (edgar.tools mirror): <https://app.edgar.tools/filing/1562088/0001628280-26-029790/q1fy26duolingo3-31x26share.htm>
- Brilliant help: free vs premium: <https://brilliant.org/help/pricing-and-plans/what-s-the-difference-between-free-and-premium/>
- Engadget via Owler: <https://www.owler.com/reports/masterclass/masterclass--masterclass-on-call-gives-you-on-dema/1734011796857>
- App Store: <https://apps.apple.com/app/id6504948244>
- TechCrunch: <https://techcrunch.com/2024/12/10/openai-backed-speak-raises-78m-at-1b-valuation-to-help-users-learn-languages-by-talking-out-loud>
- Benzinga: <https://www.benzinga.com/news/topics/25/11/48975908/this-1-billion-ai-startup-backed-by-openai-khosla-ventures-just-hit-100m-revenue-racing-to-beat-duolingo>
- TechCrunch May 2024: <https://techcrunch.com/2024/05/22/praktika-raises-35-5m-to-use-ai-avatars-to-make-learning-languages-feel-more-natural>
- FinSMEs: <https://finsmes.com/2024/05/praktika-raises-32-5m-in-series-a-funding.html>
- Khan Academy blog: <https://blog.khanacademy.org/?p=15159>
- SkillScouter review: <https://skillscouter.com/khan-academy-review/>
- Brighterly: <https://brighterly.com/blog/synthesis-tutor-cost>
- Neil Squire: <https://www.neilsquire.ca/synthesis-tutor-an-intelligent-math-tutoring-app/>
- Habitica wiki (fandom): <https://habitica.fandom.com/wiki/Class_System>
- makerstack review: <https://makerstack.co/reviews/habitica-review/>
- PocketGamer.biz: <https://www.pocketgamer.biz/pokmon-go-has-20m-weekly-active-players-nearly-nine-years-after-its-global-launch>
- PocketGamer.biz 10th anniversary: <https://www.pocketgamer.biz/pokemon-go-celebrates-10th-anniversary-with-over-9bn-in-revenue/>
- PocketGamer.biz 800M: <https://www.pocketgamer.biz/pokemon-go-marks-10-years-with-800m-players-and-a-trillion-pokemon-caught/>
- Premier League: <https://www.premierleague.com/en/news/4362120>
- Sportscasting: <https://www.sportscasting.com/uk/?p=59863>
- europeantour.com "Fantasy DP World Tour is back": <https://www.europeantour.com/dpworld-tour/news/articles/detail/fantasy-dp-world-tour-is-back/>
- TechCrunch: <https://techcrunch.com/?p=1868752>
- Google Play listing: <https://play.google.com/store/apps/details?id=com.sleeperbot>
- Action Network review: <https://www.actionnetwork.com/online-sports-betting/reviews/sleeper>
- DollarSprout: <https://dollarsprout.com/sweatcoin-review/>
- App Store: <https://apps.apple.com/ie/app/id971023427?l=en-gb>
- Business Wire: <https://www.businesswire.com/news/home/20251030834086/en/Reddit-Announces-Third-Quarter-2025-Results/>
- TechSpot: <https://www.techspot.com/community/topics/discord-claims-over-200-million-monthly-active-users-planning-an-ipo.284760/>
- Fintool: <https://fintool.com/news/discord-ipo-confidential-filing>
- Wikipedia: <https://en.wikipedia.org/wiki/BeReal>
- Voodoo 2025 review: <https://voodoo.io/news/2025-a-year-of-growth-and-transformation-for-voodoo>
- SGI Europe: <https://www.sgieurope.com/case-studies/case-study-how-strava-sells-motivation-to-brands/124154.article>
- TheWrap: <https://www.thewrap.com/industry-news/business/letterboxd-sale-gigi-pritzker-investor-consortium-acquisition/>
- Letterboxd About: <https://letterboxd.com/about/>
- ABC7: <https://abc7ny.com/post/what-know-instagrams-new-features-including-map-reposts-friends-reels-tab/17470707/>
- TikTok Newsroom Mar 2025: <https://newsroom.tiktok.com/en-gb/new-ways-we-are-supporting-parents-and-helping-teens-build-balanced-digital-habits-uk>
- TikTok Newsroom Nov 2025: <https://newsroom.tiktok.com/introducing-a-new-way-to-unwind-reset-and-recharge-on-tiktok>
- TechCrunch: <https://techcrunch.com/2025/04/10/openai-updates-chatgpt-to-reference-your-other-chats/>
- gHacks: <https://www.ghacks.net/2025/06/04/chatgpt-enables-memory-feature-for-free-users/>
- OpenAI: <https://openai.com/index/memory-and-new-controls-for-chatgpt/>
- Business Wire: <https://www.businesswire.com/news/home/20230926899032/en>
- TechRadar: <https://techradar.com/health-fitness/fitness-apps/its-no-longer-enough-for-an-app-to-tell-you-what-to-do-people-want-to-know-why-fitness-app-fitbods-founder-on-the-reason-behind-the-ai-fitness-boom>
- the5krunner: <https://the5krunner.com/2026/09/28/is-runna-ai/>
- Duolingo blog: Improving the streak: <https://blog.duolingo.com/improving-the-streak>
- Duolingo engineering blog: <https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals>
- Duolingo wiki: <https://duolingo.fandom.com/wiki/Shop/Streak_freeze>
- Duolingo IR static file: <https://duolingo.gcs-web.com/static-files/3c8277ee-bc94-4f5d-9b77-0db3e46f88b8>
- SQ Magazine: <https://sqmagazine.co.uk/duolingo-statistics/>
- Duolingo IR: <https://investors.duolingo.com/node/11401/pdf>
- Duolingo blog: Leagues: <https://blog.duolingo.com/duolingo-leagues-leaderboards/>
- Duolingo blog: Energy: <https://blog.duolingo.com/duolingo-energy/>
- Duolingo wiki: Energy: <https://duolingo.fandom.com/wiki/Energy>
- myengineeringbuddy: <https://www.myengineeringbuddy.com/blog/duolingo-reviews-pricing-alternatives-2026/>
- Forbes AU: <https://www.forbes.com.au/news/innovation/this-startup-is-racing-duolingo-to-replace-human-language-tutors-with-ai/>
- Latent Space writeup: <https://latent.space/reading/speak-personalized-language-learning/>
- Speak blog: <https://speak.com/blog/series-c>
- Bulbapedia: <https://bulbapedia.bulbagarden.net/wiki/Community_Day>
- PokémonDB: <https://pokemondb.net/go/community-days>
- SportBible: <https://www.sportbible.com/football/football-news/aston-villa/fpl-record-game-week-4-transfer-564122-20250912>
- Letterboxd Pro: <https://letterboxd.com/about/pro/>
- Lenny's Newsletter: <https://www.lennysnewsletter.com/p/duolingo-streaks>
- freedomisntfree.co.uk: <https://freedomisntfree.co.uk/articles/is-super-duolingo-worth-it-uk>
- happilyevertravels: <https://happilyevertravels.com/duolingo-family-plan/>
- thepricer: <https://www.thepricer.org/how-much-does-super-duolingo-cost/>
- Brilliant help: <https://brilliant.org/help/pricing-and-plans/how-much-does-brilliant-premium-cost/>
- recurdash: <https://recurdash.com/subscription-pricing/brilliant>
- MasterClass help: <https://www.masterclass.com/help-center/oncall/answers/pricing--id--tXXpR0amReCXGvoGlo3eNA>
- TechCrunch: <https://techcrunch.com/2024/06/20/language-learning-app-speak-nets-20m-doubles-valuation>
- toolradar: <https://toolradar.com/tools/speak>
- nibble-app: <https://nibble-app.com/blog/khan-academy-pricing>
- mutra: <https://mutra.pages.dev/compare/pricing/habitica>
- PressReader/Daily Mail: <https://www.pressreader.com/uk/daily-mail/20220706/282265259132422>
- Cycling Weekly: <https://www.cyclingweekly.com/news/strava-inflation-takes-on-new-meaning-with-price-rise-above-25>
- hashe: <https://www.hashe.com/tech-news/strava-puts-popular-year-in-sport-recap-behind-an-80-paywall>
- Adapty paywall library: <https://adapty.io/paywall-library/letterboxd/>
- Change.org: <https://www.change.org/p/duolingo-hearts-not-energy>
- Android Authority: <https://www.androidauthority.com/quitting-duolingo-energy-system-3599842/>
- TechRepublic: <https://www.techrepublic.com/de/article/news-duolingo-ai-strategy-backlash/>
- The Star: <https://www.thestar.com.my/tech/tech-news/2025/06/14/why-duolingos-founder-is-doing-damage-control-after-ai-announcement>
- ScreenWise: <https://screenwiseapp.com/guides/managing-duolingo-streaks-when-gamification-becomes-stressful>
- the5krunner: <https://the5krunner.com/2026/02/21/runna-ai-marathon-training-injury/>

## Golfer pain points, UK handicap system and UK market

From research note `golfer_pain_points.md`. 36 sources, all accessed 18 Nov 2026.

- GolfWRX: <https://forums.golfwrx.com/topic/2029985-its-time-to-move-on-from-arccos-other-options-for-tracking-rounds/>
- Golf Monthly forum: <https://forums.golfmonthly.com/threads/who-has-moved-away-from-arccos.118414/>
- Breaking Eighty: <https://breakingeighty.com/arccos-caddie-review>
- Facebook: <https://www.facebook.com/golfmaddad/posts/like-many-golf-apps-a-lot-of-the-main-features-have-gone-behind-the-paid-subscri/1152453977114909/>
- ScoringZone: <https://www.scoringzone.net/blog/18birdies-review>
- Golfshot blog: <https://golfshot.com/blog/golfshot-vs-18birdies-two-of-the-most-used-golf-apps>
- Reddit: <https://www.reddit.com/r/weekendgolfers/comments/1toj6sp/golf_gps_app_suggestions_great_okay_bad/>
- Golf Monthly forum: <https://forums.golfmonthly.com/threads/sportsbox-ai-has-anyone-tried-it-swing-analysis.119354/>
- Golf Insider UK: <https://golfinsideruk.com/best-golf-apps/>
- MyGolfSpy forum: <https://forum.mygolfspy.com/topic/64377-unofficial-review-arccos-golf-performance-tracking-system/>
- Reddit: <https://www.reddit.com/r/golf/comments/swuj4p/im_looking_for_a_better_golf_app_one_that_doesnt/>
- Practical Golf: <https://practical-golf.com/golf-gps-app-free>
- Reddit: <https://www.reddit.com/r/golf/comments/2jgzfq/my_golf_gps_app_drains_my_phones_battery_so_this/>
- Golf Monthly forum: <https://forums.golfmonthly.com/threads/myeg-issues.120294/>
- Golf Monthly forum: <https://forums.golfmonthly.com/threads/myeg-app-feedback.115847/>
- Reddit: <https://www.reddit.com/r/golf/comments/1h2p7lo/anyone_use_18_birdies_if_so_care_to_share_your/>
- Reddit: <https://www.reddit.com/r/BritGolf/comments/1wj79r2/hole19_vs_18birdies_vs_the_grint/>
- GolfWRX: <https://forums.golfwrx.com/topic/2061178-sportsbox-vs-swing-coach-ai-apps/>
- Sportsbox help: <https://help.sportsbox.ai/sportsbox-ai-accuracy>
- Facebook golf trips group (snippet): <https://www.facebook.com/groups/golftrips/posts/4424415841106279/>
- Golf Monthly forum (snippet): <https://forums.golfmonthly.com/threads/society-handicap-score-management.119011/>
- ParUp: <https://parup.golf/>
- GripGolf: <https://gripgolf.co.uk/how-much-should-golf-lessons-cost-all-you-need-to-know/>
- UK Golf Guy: <https://www.ukgolfguy.com/golf-blog/2025-summer-green-fees>
- GolfPass: <https://www.golfpass.com/travel-advisor/articles/have-golf-course-green-fees-in-the-united-kingdom-gotten-out-of-hand>
- Golfshake: <https://www.golfshake.com/news/view/21083/Most_Golfers_Expect_Membership_Costs_to_Rise_in_2025.html>
- PGA: <https://www.pga.info/discover/latest/news/dynamic-pricing-pga-professionals-complete-guide-tee-sheet-optimisation/>
- Facebook group: <https://www.facebook.com/groups/1331678583927060/posts/2037086560052922/>
- GolfWRX p2: <https://forums.golfwrx.com/topic/2029985-its-time-to-move-on-from-arccos-other-options-for-tracking-rounds/page/2/>
- England Golf: <https://www.englandgolf.org/myeg-app>
- England Golf support: <https://englandgolf.freshdesk.com/support/solutions/articles/80000964151-how-do-i-enter-overseas-scores-club-members>
- England Golf: <https://www.englandgolf.org/news-detail?newsarticleid=1416>
- GCMA: <https://gcma.org.uk/news/what-does-the-average-golfer-in-england-look-like/>
- WeekendGolfer: <https://weekendgolfer.co.uk/pages/uk-golf-statistics-2026>
- Statista: <https://www.statista.com/statistics/899231/golf-participation-uk/>
- National Club Golfer: <https://www.nationalclubgolfer.com/club/club/golf-participation-statistics-covid-boom/>

## Commercial models, pricing benchmarks, platform fees and costs

From research note `commercial_models.md`. 41 sources, all accessed 18 Nov 2026.

- 18Birdies Premium page: <https://18birdies.com/premium/>
- Golf Pad comparison (2026): <https://golfpadgps.com/news/golf-pad-vs-18birdies-vs-golfshot>
- Hole19 Premium page: <https://www.hole19golf.com/premium>
- TheGrint Free vs Pro: <https://thegrint.com/features/free-vs-pro>
- SwingU blog: <https://swingu.com/blog/best-arccos-alternatives>
- Arccos Smart Sensors: <https://www.arccosgolf.com/products/smart-sensors>
- r/golf: <https://www.reddit.com/r/golf/comments/1hxq4yb/arccos_is_cheaper_to_renew_by_buying_all_new/>
- Garmin: <https://www.garmin.com/en-US/p/850633/>
- Skillest blog: <https://skillest.com/blog/best-online-golf-coaching-platforms-2026/>
- UpPromote directory: <https://uppromote.com/affiliate-directory/american-golf/>
- ReferralRocket: <https://referralrocket.io/affiliate-program/american-golf_Mu>
- Sports History Network: <https://sportshistorynetwork.com/golf/15-golf-affiliate-programs/>
- Awin: <https://ui.awin.com/merchant-profile/129567>
- Awin: <https://ui.awin.com/merchant-profile/71491>
- Amazon Associates UK: <https://affiliate-program.amazon.co.uk/help/operating/scheduleoct1>
- Amazon Associates US: <https://affiliate-program.amazon.com/help/node/topic/G4ARBJC7Z2NK48CA>
- Hello Partner: <https://hellopartner.com/affiliates-face-financial-shock-as-amazons-associates-programme-cuts-commission-rates/>
- TeeWire comparison: <https://teewire.com/teewire-vs-golfnow>
- GolfWRX forum: <https://forums.golfwrx.com/topic/2003286-golfnow-biz-model/>
- NGCOA: <https://www.ngcoa.org/golf-business-weekly/2021/june/week-3/golfnow>
- GolfNow Business terms PDF: <https://golfnowbusiness.com/sites/default/files/2020-04/GOLF-Tee-Time-Distribution-Terms.pdf>
- RevenueCat State of Subscription Apps 2026: <https://www.revenuecat.com/state-of-subscription-apps>
- RevenueCat SOSA 2025: <https://www.revenuecat.com/state-of-subscription-apps-2025>
- RevenueCat 2026 summary video: <https://www.youtube.com/watch?v=1toNkt5bTgg>
- Apple Developer: <https://developer.apple.com/app-store/small-business-program/>
- Apple Newsroom 2020: <https://www.apple.com/newsroom/2020/11/apple-announces-app-store-small-business-program/>
- RevenueCat on store fees: <https://www.revenuecat.com/blog/engineering/app-store-fees>
- Chop Dawg: <https://www.chopdawg.com/how-to-qualify-for-apples-small-business-program-15-instead-of-30/>
- Stripe GB pricing: <https://stripe.com/gb/pricing>
- Supabase pricing: <https://supabase.com/pricing>
- CloudZero: <https://www.cloudzero.com/blog/supabase-pricing/>
- Jetadmin: <https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/>
- GitHub Docs: Pages limits: <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>
- Claude Platform pricing: <https://platform.claude.com/docs/en/about-claude/pricing>
- R&A / EGA European Golf Participation 2025 (May 2026): <https://ega-golf.ch/sites/ega/files/2026-06/Sporting%20Insights%20Report_The%20RA%20and%20EGA_European%20Golf%20Participation%202025_May%202026.pdf>
- Floom Creative, citing England Golf: <https://floomcreative.co.uk/uk-golf-trends-2026-and-2027/>
- R&A: <https://www.randa.org/en/articles/participation-remains-strong-in-gb-i>
- R&A Global Participation 2025 via APGC: <https://www.apgc.online/sustained-increase-in-golfs-global-participation/>
- Bunkered (Facebook post): <https://www.facebook.com/BunkeredOnline/posts/golf-is-booming-across-england-more-than-126-million-people-played-the-sport-in-/1720597362886902/>
- AmateurGolf.com: <https://www.amateurgolf.com/golf-tournament-news/the-true-cost-of-club-life-what-golfers-really-pay-around-the-world-33697>
- GCMA, citing the Premium Credit Membership Survey 2025-26: <https://gcma.org.uk/news/season-tickets-and-golf-club-membership-two-things-it-seems-we-cant-do-without/>

