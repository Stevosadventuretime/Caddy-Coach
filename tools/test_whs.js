// node --test tools/test_whs.js — the handicap estimate (whs.js) against the World Handicap System rules
const test = require('node:test'), assert = require('node:assert'), path = require('path');
const W = require(path.join(__dirname, '..', 'whs.js'));
const holes = (scores, par = 4) => scores.map((s, i) => ({ n: i + 1, par, si: i + 1, score: s }));
const day = i => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
const rec = (hi, scores) => ({ start: hi == null ? null : { hi, date: '2025-12-31' }, scores, removed: [] });
const s18 = (i, a, extra) => Object.assign({ id: 's' + i, d: day(i), t: i, n: 18, cr: 72, sl: 113, par: 72, a }, extra || {});

test('course handicap: index x slope/113 + (rating - par), rounded', () => {
  assert.strictEqual(W.courseHcp(20.0, 70.4, 125, 72), 21);   // 22.12 - 1.6 = 20.52
  assert.strictEqual(W.courseHcp(0, 72, 113, 72), 0);
  assert.strictEqual(W.courseHcp(-2.0, 71, 130, 72), -3);     // plus handicap: -2.30 - 1 = -3.30
  assert.strictEqual(W.courseHcp9(20.0, 35.2, 125, 36), 10);  // 11.06 - 0.8 = 10.26
});

test('strokes received by stroke index, including plus handicaps', () => {
  const got = ch => Array.from({ length: 18 }, (_, i) => W.strokesOn(ch, i + 1, 18));
  assert.deepStrictEqual(got(20).slice(0, 3), [2, 2, 1]);
  assert.strictEqual(got(20).reduce((a, b) => a + b), 20);
  assert.strictEqual(got(-2).reduce((a, b) => a + b), -2);
  assert.deepStrictEqual(got(-2).slice(16), [-1, -1]);        // given back on the two easiest holes
});

test('net double bogey caps each hole; no index yet caps at par + 5', () => {
  const a = W.adjust(holes([10, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]), 18);
  assert.strictEqual(a.per[0].counted, 7);                    // par 4 + 2 + 1 stroke
  assert.strictEqual(a.capped, 1);
  assert.strictEqual(W.adjust(holes([12]), null).per[0].counted, 9);
});

test('how many holes count: at least 10 of 18, or all 9 of 9 (2024 rules)', () => {
  const card = (n, played) => Array.from({ length: n }, (_, i) => ({ n: i + 1, par: 4, score: i < played ? 4 : null }));
  assert.strictEqual(W.eligible(card(18, 18)), 18);
  assert.strictEqual(W.eligible(card(18, 10)), 18);
  assert.strictEqual(W.eligible(card(18, 9)), 0);
  assert.strictEqual(W.eligible(card(9, 9)), 9);
  assert.strictEqual(W.eligible(card(9, 8)), 0);
});

test('score differential: (113 / slope) x (adjusted gross - course rating)', () => {
  assert.strictEqual(W.differential(85, 70.4, 125), 13.2);    // 14.6 x 0.904 = 13.198
  assert.strictEqual(W.differential(72, 72, 113), 0);
});

test('how many differentials count, with the adjustments for a short record', () => {
  const want = { 3: [1, -2], 4: [1, -1], 5: [1, 0], 6: [2, -1], 7: [2, 0], 8: [2, 0], 9: [3, 0], 11: [3, 0], 12: [4, 0], 14: [4, 0],
    15: [5, 0], 16: [5, 0], 17: [6, 0], 18: [6, 0], 19: [7, 0], 20: [8, 0] };
  for (const [n, [use, adj]] of Object.entries(want)) assert.deepStrictEqual(W.table(+n), { use, adj }, 'n=' + n);
  assert.strictEqual(W.table(2), null);
});

test('index = average of the lowest 8 of the latest 20', () => {
  const scores = Array.from({ length: 20 }, (_, i) => s18(i, 72 + (i % 10)));   // differentials 0..9, twice
  const c = W.calc(rec(null, scores));
  assert.strictEqual(c.hi, 1.5);                              // lowest 8: 0,0,1,1,2,2,3,3
});

test('USGA worked example: index 14.0, 9-hole differential 7.2 -> 18-hole differential 15.7', () => {
  // 9-hole rating 34.8 on slope 113 and a 9-hole adjusted score of 42 give the 9-hole differential 7.2
  const r = rec(14.0, [{ id: 'n', d: day(1), t: 1, n: 9, cr: 69.6, sl: 113, par: 36, a: 42 }]);
  const row = W.calc(r).rows.find(x => x.s.id === 'n');
  assert.strictEqual(row.d9, 7.2);
  assert.strictEqual(row.exp, 8.5);
  assert.strictEqual(row.d, 15.7);
});

test('10-17 holes: differential for the holes played + expected score for the rest (2024 rules)', () => {
  // index 10.0, 14 holes played, 64 adjusted on a 72.0 / 113 course: 64 - 72 x 14/18 = 8.0, plus 4 holes expected (6.4 x 4/9 = 2.84)
  const r = rec(10.0, [s18(1, 80, { p: 14, ap: 64 })]);
  const row = W.calc(r).rows.find(x => x.s.id === 's1');
  assert.deepStrictEqual(row.part, { played: 14, dp: 8, exp: 2.8 });
  assert.strictEqual(row.d, 10.8);
  // no index yet: falls back to the older method (unplayed holes already in the adjusted gross score)
  const r2 = W.calc(rec(null, [s18(1, 80, { p: 14, ap: 64 })]));
  assert.strictEqual(r2.rows[0].d, 8);
});

test('older 18-hole scores without the holes-played detail keep their value', () => {
  assert.strictEqual(W.calc(rec(10.0, [s18(1, 82)])).rows[0].d, 10);
});

test('exceptional score reduction: 7 or more below the index takes 1 off, 10 or more takes 2 off', () => {
  const base = Array.from({ length: 20 }, (_, i) => s18(i, 92));            // differentials of 20
  const c1 = W.calc(rec(null, base.concat([s18(30, 84)])));                // 12.0: 8 below 20.0
  assert.strictEqual(c1.rows[0].esr, 1);
  const c2 = W.calc(rec(null, base.concat([s18(31, 80)])));                // 8.0: 12 below
  assert.strictEqual(c2.rows[0].esr, 2);
});

test('soft and hard caps hold the index within 3 (half above) and 5 of the 12-month low', () => {
  const low = Array.from({ length: 20 }, (_, i) => s18(i, 82));            // index 10.0
  const high = Array.from({ length: 20 }, (_, i) => s18(40 + i, 102));     // differentials of 30
  const c = W.calc(rec(null, low.concat(high)));
  assert.strictEqual(c.hi, 15);                                            // hard cap: low 10.0 + 5
  assert.ok(c.rows.some(r => r.soft) && c.rows.some(r => r.hard));
});

test('index never goes above 54.0', () => {
  const c = W.calc(rec(null, Array.from({ length: 20 }, (_, i) => s18(i, 140))));
  assert.strictEqual(c.hi, 54);
});

test('display and entry of plus handicaps', () => {
  assert.strictEqual(W.fmt(-2.1), '+2.1');
  assert.strictEqual(W.fmt(18.4), '18.4');
  assert.strictEqual(W.parse('+2.1'), -2.1);
  assert.strictEqual(W.parse('18,4'), 18.4);
  assert.ok(Number.isNaN(W.parse('abc')));
});
