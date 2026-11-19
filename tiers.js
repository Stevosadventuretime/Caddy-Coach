// Caddy Coach: what each plan includes (Free, Plus, Pro). The one place the app asks "can this golfer use this?".
// Payments are off: while the master switch (PLUS.on in app-3.js) is off, everyone gets everything.
(function (root) {
'use strict';
const ORDER = ['free', 'plus', 'pro'];
const PRICES = { plus: { month: '£6.99', year: '£44.99', testers: '£34.99 a year' }, pro: { month: '£11.99', year: '£79.99' } };
// the lowest plan each feature needs
const FEATURES = {
  swing: 'free',          // limited by swingsPerMonth on Free
  coach: 'free',          // limited by coachPerDay on Free
  reportFull: 'plus', progress: 'plus', trace: 'plus', grip: 'plus', compare: 'plus', clubs: 'plus',
  reference: 'pro', periods: 'pro', programme: 'pro',
  rounds: 'free', gps: 'free', handicap: 'free', leaderboards: 'free', friends: 'free', badges: 'free', drills: 'free',
};
const LIMITS = { free: { swingsPerMonth: 3, coachPerDay: 5 }, plus: { swingsPerMonth: Infinity, coachPerDay: Infinity }, pro: { swingsPerMonth: Infinity, coachPerDay: Infinity } };
const NAMES = { free: 'Free', plus: 'Plus', pro: 'Pro' };
const WHAT = {
  free: ['GPS yardages, scoring and your handicap', 'Club leaderboards, friends and competitions', '3 swing analyses a month', 'Your coach: 5 questions a day', 'Round report headline and target', 'Badges, levels and challenges'],
  plus: ['Unlimited swing analysis', 'Your coach with no daily limit', 'Your progress dashboard', 'Full round reports', 'Shot tracer and live grip check', 'Compare swings and club consistency'],
  pro: ['Everything in Plus', 'Compare with your reference swing', '30 and 90-day swing comparisons', 'Your improvement programme', 'New features first'],
};

// which plan a golfer is on. ent: {plan, status, current_period_end} from the entitlements table
function tierFor(ent, o) {
  o = o || {};
  if (!o.switchOn || o.owner || o.hostedInClaude) return 'pro';
  if (!ent || !['active', 'trialing'].includes(ent.status)) return 'free';
  if (ent.current_period_end && Date.parse(ent.current_period_end) < (o.now || Date.now()) - 3 * 864e5) return 'free';   // 3 days' grace
  // the payment webhook records the billing interval ('month'/'year') for today's single paid plan, which is Plus
  return ORDER.includes(ent.plan) ? ent.plan : ['month', 'year', 'plus_yearly', 'plus_monthly'].includes(ent.plan) ? 'plus' : 'free';
}
const rank = t => Math.max(0, ORDER.indexOf(t));
function can(tier, feature) { const need = FEATURES[feature]; return need ? rank(tier) >= rank(need) : true; }
function limit(tier, name) { return (LIMITS[tier] || LIMITS.free)[name]; }
function needs(feature) { return FEATURES[feature] || 'free'; }

const api = { ORDER, PRICES, FEATURES, LIMITS, NAMES, WHAT, tierFor, can, limit, needs };
if (typeof module !== 'undefined') module.exports = api; else root.Tiers = api;
})(typeof window !== 'undefined' ? window : this);
