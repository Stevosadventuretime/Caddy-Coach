// Caddy Coach: friends' leaderboards and private competitions. Pure logic over the cards golfers share (built from
// their real records on their own phones). Only golfers with real data for a measure appear, and nothing is estimated.
(function (root) {
'use strict';
const DAY = 864e5;
const iso = t => new Date(t).toISOString().slice(0, 10);

// the card a golfer shares: built from their own records (rounds already summarised, badges/level from achieve.js)
function buildCard(r) {
  r = r || {};
  const now = r.now || Date.now(), cut = iso(now - 60 * DAY), month = iso(now).slice(0, 7);
  const rounds = (r.rounds || []).filter(x => x.d >= cut).slice(-40).map(x => ({
    d: x.d, holes: x.holes, gross18: x.holes ? Math.round(x.score / x.holes * 18) : null, pts: x.holes === 18 && x.pts != null ? x.pts : null,
    putts18: x.pN >= Math.min(9, x.holes) ? Math.round(x.putts / x.pN * 18) : null, drive: x.drive || null }));
  const inMonth = t => iso(t).slice(0, 7) === month;
  const xpMonth = (r.swingTimes || []).filter(inMonth).length * 50 + (r.rounds || []).filter(x => x.d.slice(0, 7) === month).length * 100 + (r.testTimes || []).filter(inMonth).length * 20;
  return { v: 1, at: now, level: r.level || null, xp: r.xp || 0, xpMonth, hi: r.hi == null ? null : r.hi, hiStart: r.hiStart == null ? null : r.hiStart,
    hiHist: (r.hiHist || []).filter(h => h.d >= iso(now - 120 * DAY)).slice(-30), rounds, swingBest: r.swingBest == null ? null : r.swingBest, badges: r.badges || 0 };
}

// the measures, each: how to get one value from a card within a date range, and which way is better
const MEASURES = {
  stableford: { name: 'Best Stableford round', unit: 'pts', higher: true, val: (c, a, b) => best(inRange(c, a, b).filter(x => x.pts != null).map(x => x.pts), Math.max) },
  gross: { name: 'Lowest score (per 18)', unit: '', higher: false, val: (c, a, b) => best(inRange(c, a, b).filter(x => x.gross18 != null).map(x => x.gross18), Math.min) },
  putts: { name: 'Fewest putts (per 18)', unit: 'putts', higher: false, val: (c, a, b) => best(inRange(c, a, b).filter(x => x.putts18 != null).map(x => x.putts18), Math.min) },
  drive: { name: 'Longest drive', unit: 'yds', higher: true, val: (c, a, b) => best(inRange(c, a, b).filter(x => x.drive).map(x => x.drive), Math.max) },
  improved: { name: 'Most improved handicap', unit: '', higher: true, val: (c, a, b) => improved(c, a, b) },
  xp: { name: 'XP this month', unit: 'XP', higher: true, val: c => c.xpMonth || null },
};
const inRange = (c, a, b) => ((c && c.rounds) || []).filter(x => (!a || x.d >= a) && (!b || x.d <= b));
const best = (vals, f) => vals.length ? f(...vals) : null;
function improved(c, a, b) {
  const h = ((c && c.hiHist) || []).filter(x => (!a || x.d >= a) && (!b || x.d <= b));
  if (h.length < 2) return null;
  return Math.round((h[0].hi - h[h.length - 1].hi) * 10) / 10;   // positive = handicap came down
}
function rank(rows, higher) {
  rows.sort((x, y) => higher ? y.value - x.value : x.value - y.value);
  let pos = 0, last = null;
  rows.forEach((r, i) => { if (r.value !== last) { pos = i + 1; last = r.value; } r.pos = pos; });
  return rows;
}
// people: [{id, name, card, me?}]
function leaderboard(people, metric, now) {
  const M = MEASURES[metric]; if (!M) return [];
  now = now || Date.now();
  const a = metric === 'stableford' || metric === 'xp' ? iso(now).slice(0, 7) + '-01' : metric === 'improved' ? iso(now - 90 * DAY) : iso(now - 60 * DAY);
  const rows = people.map(p => ({ id: p.id, name: p.name, me: !!p.me, value: p.card ? M.val(p.card, a, null) : null })).filter(r => r.value != null && !(metric === 'improved' && r.value === 0 && false));
  return rank(rows, M.higher);
}
function compStandings(comp, people) {
  const M = MEASURES[comp.format]; if (!M) return [];
  const rows = people.map(p => ({ id: p.id, name: p.name, me: !!p.me, value: p.card ? M.val(p.card, comp.starts, comp.ends) : null })).filter(r => r.value != null);
  return rank(rows, M.higher);
}

const api = { buildCard, leaderboard, compStandings, MEASURES };
if (typeof module !== 'undefined') module.exports = api; else root.FriendLogic = api;
})(typeof window !== 'undefined' ? window : this);
