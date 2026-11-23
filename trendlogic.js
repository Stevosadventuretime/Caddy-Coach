// Caddy Coach: swing timeline and round patterns (pure, tested in tools/test_trends.js).
// - swingTimeline: each swing check's score over the golfer's swings from the same camera angle, and whether it's
//   really moving (more than the measurement's wobble), so "better" and "worse" mean something.
// - compare: two swings from the same angle, check by check.
// - roundPatterns: habits that only show across several rounds (par 3s, slow starts, back nine, which way the
//   misses go, three-putts, penalties, what happens after a double), each with the evidence and its cost in shots.
// Nothing is guessed: a pattern needs enough holes and rounds, and says what it's based on.
(function (root) {
'use strict';
const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
const r1 = x => Math.round(x * 10) / 10;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const STEP = 1.0;   // a check score has to move at least a point (out of 10) to count as better or worse

// entries: [{ at, view, checks: [{ id, name, score, shown, verdict, info }] }] in any order
function swingTimeline(entries, view) {
  const E = (entries || []).filter(e => e && e.at && (!view || e.view === view)).sort((a, b) => a.at - b.at);
  const by = new Map();
  for (const e of E) for (const c of e.checks || []) {
    if (c.info || c.score == null) continue;
    if (!by.has(c.id)) by.set(c.id, { id: c.id, name: c.name, points: [] });
    by.get(c.id).points.push({ at: e.at, score: c.score, shown: c.shown, verdict: c.verdict });
  }
  const out = [];
  for (const t of by.values()) {
    const p = t.points; t.n = p.length;
    if (p.length >= 3) {
      const k = Math.min(2, Math.floor(p.length / 2)), a = mean(p.slice(0, k).map(x => x.score)), b = mean(p.slice(-k).map(x => x.score));
      t.change = r1(b - a); t.state = b - a >= STEP ? 'better' : a - b >= STEP ? 'worse' : 'same';
    } else { t.change = null; t.state = 'few'; }
    t.first = p[0]; t.last = p[p.length - 1];
    out.push(t);
  }
  // the most changed first, then the ones that still need work
  const rank = { better: 0, worse: 1, same: 2, few: 3 };
  return out.sort((x, y) => rank[x.state] - rank[y.state] || Math.abs(y.change || 0) - Math.abs(x.change || 0) || x.last.score - y.last.score);
}

// two swings, same angle: what changed
function compare(a, b) {
  if (!a || !b) return { ok: false, why: 'Pick two swings.' };
  if (a.view !== b.view) return { ok: false, why: 'Those swings were filmed from different angles, so they can\'t be compared check by check.' };
  const [older, newer] = a.at <= b.at ? [a, b] : [b, a];
  const map = new Map((older.checks || []).filter(c => !c.info).map(c => [c.id, c]));
  const rows = [];
  for (const c of newer.checks || []) {
    const o = map.get(c.id); if (!o || c.info) continue;
    const d = r1(c.score - o.score);
    rows.push({ id: c.id, name: c.name, before: o.shown, after: c.shown, from: o.score, to: c.score, change: d, state: d >= STEP ? 'better' : d <= -STEP ? 'worse' : 'same' });
  }
  rows.sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
  return { ok: true, older, newer, rows, better: rows.filter(r => r.state === 'better').length, worse: rows.filter(r => r.state === 'worse').length };
}

// rounds: [{ date, holes: [{ score, par, fw, putts, pen }] }]; uses the newest 10 with 9+ holes scored
function roundPatterns(rounds) {
  const rs = (rounds || []).map(r => ({ r, H: (r.holes || []).map((h, i) => h && h.score != null && h.par ? Object.assign({ i }, h) : null) }))
    .filter(x => x.H.filter(Boolean).length >= 9).sort((a, b) => String(b.r.date || '').localeCompare(String(a.r.date || ''))).slice(0, 10);
  const n = rs.length, out = [];
  if (n < 3) return { n, patterns: [], need: 3 - n };
  const all = rs.flatMap(x => x.H.filter(Boolean)), over = h => h.score - h.par;
  const basis = `From your last ${plural(n, 'round')}`;

  // par 3s, 4s, 5s: which costs the most per hole, compared with the others
  const per = {}; for (const p of [3, 4, 5]) { const hs = all.filter(h => h.par === p); if (hs.length >= 6) per[p] = { avg: mean(hs.map(over)), n: hs.length }; }
  const ks = Object.keys(per);
  if (ks.length >= 2) {
    const worst = ks.reduce((a, b) => per[a].avg >= per[b].avg ? a : b), rest = ks.filter(k => k !== worst);
    const restAvg = mean(rest.map(k => per[k].avg)), gap = per[worst].avg - restAvg;
    if (gap >= 0.3) out.push({ id: 'par' + worst, area: worst === '3' ? 'app' : worst === '5' ? 'mgmt' : 'tee', title: `Par ${worst}s cost you the most`,
      text: `You average ${r1(per[worst].avg) > 0 ? '+' : ''}${r1(per[worst].avg)} on par ${worst}s, against ${restAvg > 0 ? '+' : ''}${r1(restAvg)} on the others.`,
      evidence: `${basis}, ${per[worst].n} par ${worst}s.`, cost: r1(gap * (per[worst].n / n)) });
  }
  // slow starts: the first three holes against the rest
  const starts = rs.flatMap(x => x.H.slice(0, 3).filter(Boolean)), later = rs.flatMap(x => x.H.slice(3).filter(Boolean));
  if (starts.length >= 9 && later.length >= 18) {
    const gap = mean(starts.map(over)) - mean(later.map(over));
    if (gap >= 0.4) out.push({ id: 'start', area: 'mgmt', title: 'Slow starts', text: `Your first three holes average ${r1(gap)} more over par than the rest of the round.`,
      evidence: `${basis}. A proper warm-up and an easy first tee shot usually help.`, cost: r1(gap * 3) });
  }
  // the back nine against the front, 18-hole rounds only
  const full = rs.filter(x => x.H.length >= 18 && x.H.slice(0, 18).every(Boolean));
  if (full.length >= 3) {
    const f9 = mean(full.map(x => x.H.slice(0, 9).reduce((a, h) => a + over(h), 0))), b9 = mean(full.map(x => x.H.slice(9, 18).reduce((a, h) => a + over(h), 0)));
    if (b9 - f9 >= 2) out.push({ id: 'back9', area: 'mgmt', title: 'The back nine gets away from you', text: `You average ${r1(b9 - f9)} shots more on the back nine than the front.`,
      evidence: `From ${plural(full.length, 'full round')}. Food, water and a steady routine late in the round are worth a look.`, cost: r1(b9 - f9) });
  }
  // fairway misses: one side much more than the other
  let fl = 0, fr = 0; for (const h of all) if (h.par >= 4) { if (h.fw === 'left') fl++; else if (h.fw === 'right') fr++; }
  if (fl + fr >= 8) {
    const big = fl >= fr ? ['left', fl] : ['right', fr], share = Math.round(big[1] / (fl + fr) * 100);
    if (share >= 65) out.push({ id: 'miss-' + big[0], area: 'tee', title: `Your tee shots miss ${big[0]}`, text: `${share}% of your missed fairways go ${big[0]} (${big[1]} of ${fl + fr}).`,
      evidence: `${basis}. Aim so that miss stays in play, and check the swing cause with a swing analysis.`, cost: null });
  }
  // three-putts and penalties per round
  const pH = all.filter(h => h.putts != null);
  if (pH.length >= 18) {
    const per18 = pH.filter(h => h.putts >= 3).length / pH.length * 18;
    if (per18 >= 1.5) out.push({ id: 'three', area: 'putt', title: 'Three-putts add up', text: `About ${r1(per18)} three-putts per 18 holes.`, evidence: `${basis}, ${pH.length} holes with putts logged. Lag putting to 3 feet saves most of these.`, cost: r1(per18) });
  }
  const penH = all.filter(h => h.pen != null);
  if (penH.length >= 18) {
    const per18 = penH.reduce((a, h) => a + h.pen, 0) / penH.length * 18;
    if (per18 >= 1.5) out.push({ id: 'pen', area: 'tee', title: 'Penalty shots', text: `About ${r1(per18)} penalty shots per 18 holes.`, evidence: `${basis}. A safer club off the tee on tight holes often costs less than the penalty.`, cost: r1(per18) });
  }
  // after a double bogey: does the next hole go wrong too?
  let dbl = 0, next = 0;
  for (const x of rs) for (let i = 0; i < x.H.length - 1; i++) { const h = x.H[i], nh = x.H[i + 1]; if (h && nh && over(h) >= 2) { dbl++; if (over(nh) >= 1) next++; } }
  if (dbl >= 5) {
    const share = Math.round(next / dbl * 100), base = Math.round(all.filter(h => over(h) >= 1).length / all.length * 100);
    if (share - base >= 15) out.push({ id: 'bounce', area: 'mgmt', title: 'One bad hole leads to another', text: `After a double bogey or worse, the next hole is over par ${share}% of the time, against ${base}% overall.`,
      evidence: `${basis}, ${plural(dbl, 'double')} or worse. A reset routine on the next tee helps.`, cost: null });
  }
  out.sort((a, b) => (b.cost || 0) - (a.cost || 0));
  return { n, patterns: out.slice(0, 4) };
}

const api = { swingTimeline, compare, roundPatterns, STEP };
if (typeof module !== 'undefined') module.exports = api; else root.TrendLogic = api;
})(typeof window !== 'undefined' ? window : this);
