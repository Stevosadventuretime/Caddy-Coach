// Swing timeline and round patterns (trendlogic.js): only real movement counts, angles aren't mixed, and a pattern
// needs enough rounds and says what it's based on.
const test = require('node:test'), assert = require('node:assert');
const T = require('../trendlogic.js');
const DAY = 864e5, T0 = Date.parse('2026-10-01T12:00:00Z');
const sw = (d, view, scores) => ({ at: T0 + d * DAY, view, checks: Object.entries(scores).map(([id, score]) => ({ id, name: id, score, shown: String(score) })) });

test('a check is better or worse only when it moves more than a point', () => {
  const t = T.swingTimeline([sw(0, 'face-on', { sway: 3, hip: 6, tempo: 7 }), sw(5, 'face-on', { sway: 3.5, hip: 6.2, tempo: 7 }), sw(9, 'face-on', { sway: 6, hip: 5.9, tempo: 4 }), sw(12, 'face-on', { sway: 7, hip: 6.4, tempo: 4.5 })], 'face-on');
  const by = Object.fromEntries(t.map(x => [x.id, x.state]));
  assert.deepStrictEqual(by, { sway: 'better', hip: 'same', tempo: 'worse' });
  assert.strictEqual(t[0].id, 'sway', 'the biggest improvement comes first');
});

test('the timeline keeps camera angles apart, and needs 3 swings to call a trend', () => {
  const t = T.swingTimeline([sw(0, 'face-on', { sway: 3 }), sw(1, 'down-the-line', { sway: 9 }), sw(2, 'face-on', { sway: 4 })], 'face-on');
  assert.strictEqual(t[0].n, 2); assert.strictEqual(t[0].state, 'few');
});

test('comparing swings: same angle only, oldest to newest, biggest change first', () => {
  const a = sw(0, 'face-on', { sway: 3, hip: 6 }), b = sw(10, 'face-on', { sway: 7, hip: 5.5 });
  const c = T.compare(b, a);
  assert.ok(c.ok); assert.strictEqual(c.older, a); assert.strictEqual(c.rows[0].id, 'sway'); assert.strictEqual(c.rows[0].state, 'better'); assert.strictEqual(c.better, 1);
  assert.strictEqual(T.compare(a, sw(5, 'down-the-line', { sway: 5 })).ok, false);
});

// rounds: 18 holes, par 4 except holes 3, 7, 12, 16 (par 3) and 5, 14 (par 5)
const PARS = [4, 4, 3, 4, 5, 4, 3, 4, 4, 4, 4, 3, 4, 5, 4, 3, 4, 4];
function round(date, f) { return { date, holes: PARS.map((par, i) => Object.assign({ par, score: par + 1, putts: 2, pen: 0, fw: par >= 4 ? 'hit' : null }, f ? f(i, par) : {})) }; }

test('patterns need 3 rounds and say how many more', () => {
  const r = T.roundPatterns([round('2026-10-01'), round('2026-10-08')]);
  assert.strictEqual(r.patterns.length, 0); assert.strictEqual(r.need, 1);
});

test('finds par-3 trouble, slow starts, a one-sided miss and three-putts, with evidence', () => {
  const rs = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22'].map(d => round(d, (i, par) => Object.assign(
    par === 3 ? { score: 5 } : {},
    i < 3 ? { score: par + 2 } : {},
    par >= 4 && i % 3 === 0 ? { fw: 'left' } : {},
    i % 6 === 0 ? { putts: 3 } : {})));
  const P = T.roundPatterns(rs).patterns, ids = P.map(p => p.id);
  assert.ok(ids.includes('par3'), ids.join());
  assert.ok(ids.includes('start'), ids.join());
  assert.ok(P.length <= 4);
  for (const p of P) { assert.match(p.evidence, /round/); assert.ok(p.text.length > 10); }
});

test('a steady golfer gets no made-up patterns', () => {
  const rs = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22'].map(d => round(d));
  assert.deepStrictEqual(T.roundPatterns(rs).patterns, []);
});
