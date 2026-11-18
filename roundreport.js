// Caddy Coach: the report after every round. Pure logic: one round (and the golfer's earlier rounds) in, a plain-English
// report out, built only from what was recorded. Compared with the golfer's own recent rounds, never invented.
(function (root) {
'use strict';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pc = (a, b) => b ? Math.round(a / b * 100) : null;
const MIN = 6;   // a stat counts once it's been logged on at least this many holes

function stats(holes) {
  const s = { holes: 0, score: 0, par: 0, fw: 0, fwN: 0, fl: 0, fr: 0, gir: 0, girN: 0, putts: 0, pN: 0, three: 0, one: 0, ud: 0, udN: 0,
    sand: 0, sandN: 0, pen: 0, penN: 0, dbl: 0, dblExtra: 0, birdies: 0, pars: 0, byPar: { 3: [0, 0], 4: [0, 0], 5: [0, 0] } };
  for (const h of holes || []) {
    if (!h || h.score == null) continue;
    s.holes++; s.score += h.score; s.par += h.par;
    const d = h.score - h.par;
    if (d <= -1) s.birdies++; else if (d === 0) s.pars++;
    if (d >= 2) { s.dbl++; s.dblExtra += d - 1; }
    if (s.byPar[h.par]) { s.byPar[h.par][0] += d; s.byPar[h.par][1]++; }
    if (h.pen != null) { s.penN++; s.pen += h.pen; }
    if (h.par >= 4 && h.fw) { s.fwN++; if (h.fw === 'hit') s.fw++; else if (h.fw === 'left') s.fl++; else if (h.fw === 'right') s.fr++; }
    if (h.putts != null) {
      s.pN++; s.putts += h.putts; s.girN++;
      if (h.score - h.putts <= h.par - 2) s.gir++; else { s.udN++; if (h.score <= h.par) s.ud++; }
      if (h.putts >= 3) s.three++; if (h.putts === 1) s.one++;
    }
    if (h.sand) { s.sandN++; if (h.score <= h.par) s.sand++; }
  }
  return s;
}
// the measures a report talks about: value for one set of holes, higher-is-better or not, and how to say it
const MEASURES = [
  { k: 'fw', name: 'Fairways hit', area: 'tee', up: true, ok: s => s.fwN >= MIN, v: s => pc(s.fw, s.fwN), say: (s) => `${s.fw} of ${s.fwN} fairways` },
  { k: 'gir', name: 'Greens in regulation', area: 'app', up: true, ok: s => s.girN >= MIN, v: s => pc(s.gir, s.girN), say: s => `${s.gir} of ${s.girN} greens in regulation` },
  { k: 'putts', name: 'Putts', area: 'putt', up: false, ok: s => s.pN >= MIN, v: s => s.putts / s.pN * 18, say: s => `${s.putts} putts over ${plural(s.pN, 'hole')}` },
  { k: 'three', name: 'Three-putts', area: 'putt', up: false, ok: s => s.pN >= MIN, v: s => s.three / s.pN * 18, say: s => plural(s.three, 'three-putt') },
  { k: 'ud', name: 'Up and downs', area: 'arg', up: true, ok: s => s.udN >= 3, v: s => pc(s.ud, s.udN), say: s => `${s.ud} of ${s.udN} up and downs` },
  { k: 'pen', name: 'Penalty shots', area: 'tee', up: false, ok: s => s.penN >= MIN, v: s => s.pen / s.penN * 18, say: s => plural(s.pen, 'penalty shot') },
  { k: 'dbl', name: 'Doubles or worse', area: 'mgmt', up: false, ok: s => s.holes >= 9, v: s => s.dbl / s.holes * 18, say: s => plural(s.dbl, 'double') + ' or worse' },
];
const AREA = { tee: 'Off the tee', app: 'Approach shots', arg: 'Short game', putt: 'Putting', mgmt: 'Course management' };
const PLAN = {
  putt: [{ kind: 'task', id: 'gate', label: 'Gate putting from 3 feet' }, { kind: 'task', id: 'ladder', label: 'Lag ladder: 20, 30, 40 feet' }],
  arg: [{ kind: 'task', id: 'updown', label: 'Up-and-down game' }, { kind: 'task', id: 'landing', label: 'Chip to a landing spot' }],
  app: [{ kind: 'task', id: 'approach', label: 'Three-club approach ladder' }, { kind: 'drill', id: 'tempo', label: '3-to-1 tempo count' }],
  tee: [{ kind: 'task', id: 'fairway', label: 'Fairway finder' }, { kind: 'drill', id: 'tempo', label: '3-to-1 tempo count' }],
  mgmt: [{ kind: 'task', id: 'pressure', label: 'Range round' }],
};

function build(round, prevRounds, opts) {
  opts = opts || {};
  const S = stats(round.holes), prev = (prevRounds || []).slice(0, 5).map(r => stats(r.holes)).filter(p => p.holes >= 9);
  const out = { overall: {}, good: [], improve: [], biggest: null, plan: [], target: '', missing: [], basis: '' };
  if (!S.holes) { out.missing.push('No scores were entered for this round.'); return out; }
  // overall
  const per18 = S.score / S.holes * 18, avgPrev = prev.length ? prev.reduce((a, p) => a + p.score / p.holes * 18, 0) / prev.length : null;
  out.overall = { score: S.score, par: S.par, toPar: S.score - S.par, holes: S.holes, pts: opts.pts == null ? null : opts.pts,
    vsAvg: avgPrev == null ? null : Math.round((per18 - avgPrev) * 10) / 10, birdies: S.birdies, pars: S.pars, doubles: S.dbl,
    best: bestWorst(round.holes, 1), worst: bestWorst(round.holes, -1) };
  out.basis = prev.length ? `Compared with your last ${plural(prev.length, 'round')}.` : 'This is your first round with enough holes to compare, so it\'s judged on its own.';
  // measures: compared with this golfer's own recent rounds where possible
  const rows = [];
  for (const M of MEASURES) {
    if (!M.ok(S)) continue;
    const now = M.v(S), pp = prev.filter(M.ok), avg = pp.length ? pp.reduce((a, p) => a + M.v(p), 0) / pp.length : null;
    const delta = avg == null ? null : (M.up ? now - avg : avg - now);   // positive = better than usual
    rows.push({ M, now, avg, delta, text: M.say(S) });
  }
  const scaled = r => r.delta == null ? null : r.delta / (r.M.k === 'fw' || r.M.k === 'gir' || r.M.k === 'ud' ? 15 : 1.5);
  const withAvg = rows.filter(r => r.delta != null).sort((a, b) => scaled(b) - scaled(a));
  if (withAvg.length) {
    out.good = withAvg.filter(r => scaled(r) > 0.2).slice(0, 3).map(r => `${r.text}: better than your usual (${fmtAvg(r)}).`);
    out.improve = withAvg.slice().reverse().filter(r => scaled(r) < -0.2).slice(0, 3).map(r => `${r.text}: worse than your usual (${fmtAvg(r)}).`);
  }
  // without earlier rounds, or nothing stood out: plain facts from today
  if (!out.good.length) {
    if (S.birdies + S.pars >= 3) out.good.push(`${plural(S.pars, 'par')}${S.birdies ? ` and ${plural(S.birdies, 'birdie')}` : ''}.`);
    if (S.penN >= MIN && S.pen === 0) out.good.push('No penalty shots.');
    if (S.pN >= MIN && S.three === 0) out.good.push('No three-putts.');
    if (S.fwN >= MIN && pc(S.fw, S.fwN) >= 50) out.good.push(`${S.fw} of ${S.fwN} fairways hit.`);
    out.good = out.good.slice(0, 3);
  }
  // where the shots went: strokes gained when there's shot detail, otherwise a labelled estimate
  const sg = opts.sg;
  if (sg && sg.full >= 9) {
    const ks = ['tee', 'app', 'arg', 'putt'].filter(k => sg[k] != null).sort((a, b) => sg[a] - sg[b]);
    if (ks.length) out.biggest = { area: ks[0], how: 'sg', text: `${AREA[ks[0]]} cost you the most shots compared with the rest of your game (strokes gained ${fmtSg(sg[ks[0]])} per round against a tour player; everyone loses shots here, the gap between areas is what matters).` };
  }
  if (!out.biggest) {
    const lost = [];
    if (S.pN >= MIN) lost.push({ area: 'putt', n: S.three, why: plural(S.three, 'three-putt') });
    if (S.penN >= MIN) lost.push({ area: 'tee', n: S.pen, why: plural(S.pen, 'penalty shot') });
    if (S.holes >= 9) lost.push({ area: 'mgmt', n: S.dblExtra, why: `${plural(S.dbl, 'double')} or worse` });
    if (S.udN >= 3) lost.push({ area: 'arg', n: Math.floor((S.udN - S.ud) * 0.25), why: `${S.udN - S.ud} missed up and downs` });
    lost.sort((a, b) => b.n - a.n);
    if (lost.length && lost[0].n > 0) out.biggest = { area: lost[0].area, how: 'estimate', shots: lost[0].n, text: `About ${plural(lost[0].n, 'shot')} went on ${lost[0].why} (an estimate from your scorecard).` };
  }
  // practice plan and a target for next time
  if (out.biggest) {
    out.plan = (PLAN[out.biggest.area] || []).slice(0, 2).concat(out.biggest.area === 'mgmt' ? [{ kind: 'tip', label: 'On trouble holes, aim for the fat part of the green and take bogey as a good score.' }] : []).slice(0, 3);
    out.target = targetFor(out.biggest.area, S);
  }
  // what wasn't recorded
  if (S.pN < MIN) out.missing.push('Log your putts next round to see your putting, greens and short game.');
  if (S.fwN < MIN) out.missing.push('Log fairway hit or missed on each par 4 and 5 to see your driving.');
  if (!(sg && sg.full >= 9)) out.missing.push('Mark your shots on the hole map to get strokes gained by part of your game.');
  out.good = out.good.slice(0, 3); out.improve = out.improve.slice(0, 3); out.missing = out.missing.slice(0, 2);
  return out;
}
function fmtAvg(r) {
  const k = r.M.k, a = r.avg;
  if (k === 'fw' || k === 'gir' || k === 'ud') return `usually ${Math.round(a)}%`;
  if (k === 'putts') return `usually ${Math.round(a)} per 18`;
  return `usually ${Math.round(a * 10) / 10} per 18`;
}
const fmtSg = x => (x > 0 ? '+' : '') + (Math.round(x * 10) / 10);
function bestWorst(holes, dir) {
  const hs = (holes || []).filter(h => h && h.score != null).map(h => ({ n: h.n, d: h.score - h.par }));
  if (hs.length < 3) return [];
  const sorted = hs.sort((a, b) => dir > 0 ? a.d - b.d : b.d - a.d), edge = sorted[0].d;
  return sorted.filter(h => h.d === edge).slice(0, 3).map(h => h.n);
}
function targetFor(area, S) {
  if (area === 'putt') return S.three > 0 ? `No more than ${Math.max(0, S.three - 1)} three-putt${S.three - 1 === 1 ? '' : 's'} next round.` : 'Keep three-putts at zero.';
  if (area === 'tee') return S.pen > 0 ? `No more than ${Math.max(0, S.pen - 1)} penalty shot${S.pen - 1 === 1 ? '' : 's'} next round.` : `Hit ${S.fw + 1} fairways or more next round.`;
  if (area === 'arg') return `Get up and down at least ${S.ud + 1} time${S.ud + 1 === 1 ? '' : 's'} next round.`;
  if (area === 'app') return `Hit ${S.gir + 1} greens or more next round.`;
  return S.dbl > 0 ? `No more than ${Math.max(0, S.dbl - 1)} double${S.dbl - 1 === 1 ? '' : 's'} or worse next round.` : 'Keep it bogey-free of disasters next round.';
}

// ---------- club consistency from GPS-measured shots ----------
// dist: {club: {n, avg, p10, p90}}. Consistency needs at least 5 shots a club.
function clubConsistency(dist, order) {
  const ids = (order || Object.keys(dist || {})).filter(id => dist[id] && dist[id].n >= 5);
  const ranked = ids.map(id => ({ id, n: dist[id].n, avg: dist[id].avg, spread: dist[id].p90 - dist[id].p10, lo: dist[id].p10, hi: dist[id].p90 }))
    .sort((a, b) => a.spread - b.spread);
  const tips = [];
  for (let i = 0; i + 1 < ids.length; i++) {   // neighbouring clubs in bag order
    const a = dist[ids[i]], b = dist[ids[i + 1]];
    const mid = Math.round((a.avg + b.avg) / 2);
    if (mid >= Math.max(a.p10, b.p10) && mid <= Math.min(a.p90, b.p90)) {
      const sa = a.p90 - a.p10, sb = b.p90 - b.p10;
      if (Math.abs(sa - sb) >= 6) { const [good, bad] = sa < sb ? [ids[i], ids[i + 1]] : [ids[i + 1], ids[i]]; tips.push({ yds: mid, good, bad }); }
    }
  }
  return { ranked, tips: tips.slice(0, 2) };
}

const api = { build, stats, clubConsistency, MEASURES, AREA };
if (typeof module !== 'undefined') module.exports = api; else root.RoundReport = api;
})(typeof window !== 'undefined' ? window : this);
