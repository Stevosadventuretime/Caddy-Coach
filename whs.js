// Caddy Coach: World Handicap System (the system England Golf uses) worked out from a player's scores.
// Pure functions, no page access, so it can be tested on its own.
(function (root) {
'use strict';
const r1 = x => Math.round(x * 10 + 1e-9) / 10;
const DAY = 864e5;
const dnum = d => Date.parse(d + 'T12:00:00Z');

// Course Handicap = Handicap Index x (Slope / 113) + (Course Rating - Par), to the nearest whole number
function courseHcp(hi, cr, slope, par) { return Math.round(hi * slope / 113 + (cr - par) + 1e-9); }
// 9 holes: half the Handicap Index against the 9-hole rating and par
function courseHcp9(hi, cr9, slope, par9) { return Math.round(hi / 2 * slope / 113 + (cr9 - par9) + 1e-9); }
// a 9-hole round on a course rated for 18: the nine is rated at half
const rating9 = cr => cr > 50 ? r1(cr / 2) : cr;

// stroke index order within the holes played: 1 = hardest. Missing stroke indexes fall back to hole order.
function ranks(holes) {
  const ok = holes.every(h => h.si) && new Set(holes.map(h => h.si)).size === holes.length;
  const order = holes.map((h, i) => ({ i, k: ok ? h.si : i + 1 })).sort((a, b) => a.k - b.k);
  const r = []; order.forEach((o, j) => { r[o.i] = j + 1; }); return { r, ok };
}
// strokes received on the hole ranked `rank` of `n` with course handicap `ch` (negative = plus handicap, strokes given back from the easiest hole)
function strokesOn(ch, rank, n) {
  if (ch >= 0) return Math.floor(ch / n) + (rank <= ch % n ? 1 : 0);
  const c = -ch; return -(Math.floor(c / n) + (rank > n - (c % n) ? 1 : 0));
}
// Adjusted Gross Score: each hole capped at net double bogey (par + 2 + strokes received).
// No Handicap Index yet: each hole capped at par + 5. A hole not played counts as net par.
function adjust(holes, ch) {
  const { r, ok } = ranks(holes), n = holes.length;
  let gross = 0, ags = 0, played = 0, capped = 0; const per = [];
  holes.forEach((h, i) => {
    const st = ch == null ? 0 : strokesOn(ch, r[i], n);
    const cap = ch == null ? h.par + 5 : h.par + 2 + st;
    if (h.score == null) { const v = ch == null ? h.par : h.par + st; ags += v; per.push({ n: h.n, par: h.par, st, cap, score: null, counted: v, missing: true }); return; }
    played++; gross += h.score; const v = Math.min(h.score, cap); if (v < h.score) capped++;
    ags += v; per.push({ n: h.n, par: h.par, st, cap, score: h.score, counted: v });
  });
  return { gross, ags, played, capped, per, siOk: ok };
}
// enough holes for a handicap score? 14 of 18, or 7 of 9
function eligible(holes) {
  const n = holes.length, p = holes.filter(h => h.score != null).length;
  if (n === 18) return p >= 14 ? 18 : 0;
  if (n === 9) return p >= 7 ? 9 : 0;
  return 0;
}
// Score Differential = (113 / Slope) x (Adjusted Gross Score - Course Rating - PCC). PCC is taken as 0.
const differential = (ags, cr, slope, pcc) => r1(113 / slope * (ags - cr - (pcc || 0)));
// expected 9-hole Score Differential for the nine not played, from the Handicap Index (2024 rule)
const expected9 = hi => 0.52 * hi + 1.2;

// how many of the most recent differentials count, and any adjustment, by how many there are
function table(n) {
  if (n < 3) return null;
  if (n === 3) return { use: 1, adj: -2 };
  if (n === 4) return { use: 1, adj: -1 };
  if (n === 5) return { use: 1, adj: 0 };
  if (n === 6) return { use: 2, adj: -1 };
  if (n <= 8) return { use: 2, adj: 0 };
  if (n <= 11) return { use: 3, adj: 0 };
  if (n <= 14) return { use: 4, adj: 0 };
  if (n <= 16) return { use: 5, adj: 0 };
  if (n <= 18) return { use: 6, adj: 0 };
  if (n === 19) return { use: 7, adj: 0 };
  return { use: 8, adj: 0 };
}
function fromRecord(last) {
  const t = table(last.length); if (!t) return null;
  const sorted = last.map((e, i) => ({ i, v: e.d + e.adj })).sort((a, b) => a.v - b.v || b.i - a.i).slice(0, t.use);
  const avg = sorted.reduce((a, x) => a + x.v, 0) / t.use;
  return { raw: avg + t.adj, count: sorted.map(x => x.i), use: t.use, adj: t.adj };
}

// Work out the whole record. rec = {start:{hi:number|null, date:'YYYY-MM-DD'}|null, scores:[...], removed:[ids]}
// score = {id, d:'YYYY-MM-DD', t:createdAt, n:18|9, cr, sl, par, g:gross, a:adjusted gross, c:course, tee}
// opts.before: only scores played before this date (the index "on the date of play")
function calc(rec, opts) {
  opts = opts || {};
  const removed = new Set(rec && rec.removed || []);
  let scores = (rec && rec.scores || []).filter(s => s && !removed.has(s.id));
  if (opts.before) scores = scores.filter(s => s.d < opts.before || (s.d === opts.before && opts.beforeT && (s.t || 0) < opts.beforeT));
  scores = scores.slice().sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.t || 0) - (b.t || 0));
  const start = rec && rec.start || null, seeded = !!(start && start.hi != null);
  const list = [];   // the scoring record: {d (differential), adj (ESR), seed?, s}
  if (seeded) for (let i = 0; i < 20; i++) list.push({ d: start.hi, adj: 0, seed: true, date: start.date });
  const hist = seeded ? [{ date: start.date, hi: start.hi, n: 20 }] : [];
  let cur = seeded ? start.hi : null, pend = null; const rows = [];
  for (const s of scores) {
    const before = cur, row = { s, before, hi: cur };
    let d;
    if (s.n === 9) {
      const cr9 = rating9(s.cr), d9 = differential(s.a, cr9, s.sl);
      row.d9 = d9; row.cr9 = cr9;
      if (before != null) { row.exp = r1(expected9(before)); d = r1(d9 + expected9(before)); }
      else if (pend) { d = r1(pend.d9 + d9); row.pair = pend.s.id; pend.row.paired = s.id; pend = null; }
      else { pend = { s, d9, row }; row.waiting = true; rows.push(row); continue; }
    } else d = differential(s.a, s.cr, s.sl);
    row.d = d;
    const e = { d, adj: 0, s, date: s.d }; list.push(e); row.e = e;
    let last = list.slice(-20), res = fromRecord(last);
    // Exceptional Score Reduction: 7.0 or more below the Handicap Index on the day
    if (before != null && res) {
      const gap = before - d, esr = gap >= 10 ? 2 : gap >= 7 ? 1 : 0;
      if (esr) { last.forEach(x => { x.adj -= esr; }); row.esr = esr; res = fromRecord(last); }
    }
    if (res) {
      let v = res.raw;
      // caps against the Low Handicap Index: the lowest index in the 365 days before this score (once 20 scores are on record)
      if (list.length >= 20) {
        const t = dnum(s.d), win = hist.filter(h => h.n >= 20 && dnum(h.date) <= t && t - dnum(h.date) <= 365 * DAY);
        if (win.length) {
          const low = Math.min(...win.map(h => h.hi)); row.low = low;
          if (v > low + 3) { const soft = low + 3 + (v - low - 3) / 2; row.soft = true; v = soft; }
          if (v > low + 5) { v = low + 5; row.hard = true; }
        }
      }
      cur = Math.min(54, r1(v)); row.raw = r1(res.raw);
      hist.push({ date: s.d, hi: cur, n: list.length });
    }
    row.hi = cur; rows.push(row);
  }
  const last = list.slice(-20), res = fromRecord(last);
  const counting = new Set(res ? res.count.map(i => last[i]) : []);
  let low = null;
  if (list.length >= 20 && scores.length) {
    const t = dnum(scores[scores.length - 1].d), win = hist.filter(h => h.n >= 20 && t - dnum(h.date) <= 365 * DAY && dnum(h.date) <= t);
    // the latest index itself isn't "before" the most recent score, so leave it out
    const pool = win.slice(0, -1).length ? win.slice(0, -1) : win; if (pool.length) low = Math.min(...pool.map(h => h.hi));
  } else if (seeded) low = start.hi;
  const seeds = last.filter(x => x.seed).length;
  const prev = hist.length >= 2 ? hist[hist.length - 2].hi : null;
  const needed = cur == null ? Math.max(0, 3 - list.length) : 0;
  return {
    hi: cur, prev, low, rows: rows.reverse(), last: last.slice().reverse(), counting, seeds, use: res ? res.use : 0, adj: res ? res.adj : 0,
    needed, pending9: !!pend, real: list.filter(x => !x.seed).length, total: scores.length, hist
  };
}
// display: plus handicaps are shown with a +
const fmt = hi => hi == null ? '–' : hi < 0 ? '+' + (-hi).toFixed(1) : hi.toFixed(1);
// parse what a player types: "18.4", "+2.1" (a plus handicap), "-2.1"
function parse(s) {
  s = String(s == null ? '' : s).trim().replace(',', '.'); if (!s) return null;
  const m = /^([+-]?)(\d{1,2}(?:\.\d)?)$/.exec(s); if (!m) return NaN;
  let v = +m[2]; if (m[1]) v = -v; return v;
}
const api = { r1, courseHcp, courseHcp9, rating9, ranks, strokesOn, adjust, eligible, differential, expected9, table, calc, fmt, parse, MAX: 54 };
root.WHS = api;
if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : this);
