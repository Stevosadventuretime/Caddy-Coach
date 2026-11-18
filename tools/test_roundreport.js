// The round report (roundreport.js): built only from what was recorded, compared with the golfer's own rounds,
// strokes gained only with enough shot detail, never more than three items in a list.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../roundreport.js');

const hole = (n, par, score, extra) => Object.assign({ n, par, score }, extra || {});
const round = (scoreFor, extra) => ({ holes: Array.from({ length: 18 }, (_, i) => hole(i + 1, i % 3 === 0 ? 3 : 4, scoreFor(i), extra && extra(i))) });

test('a round with only scores still gets a report and says what is missing', () => {
  const r = R.build(round(i => (i % 3 === 0 ? 4 : 5)), []);
  assert.strictEqual(r.overall.holes, 18);
  assert.ok(r.missing.some(m => /putts/.test(m)));
  assert.ok(r.good.length <= 3 && r.improve.length <= 3 && r.plan.length <= 3);
});

test('three-putts drive the putting weakness and the target', () => {
  const r = R.build(round(i => (i % 3 === 0 ? 4 : 5), i => ({ putts: i < 5 ? 3 : 2, fw: 'hit', pen: 0 })), []);   // bogey golf with five three-putts
  assert.strictEqual(r.biggest.area, 'putt');
  assert.strictEqual(r.biggest.how, 'estimate');
  assert.match(r.target, /No more than 4 three-putts/);
  assert.strictEqual(r.plan[0].id, 'gate');
});

test('strokes gained is used only with at least 9 holes of shot detail', () => {
  const rd = round(i => 5, i => ({ putts: 2 }));
  assert.strictEqual(R.build(rd, [], { sg: { full: 9, tee: -1, app: -3, arg: -1, putt: -0.5 } }).biggest.how, 'sg');
  assert.strictEqual(R.build(rd, [], { sg: { full: 9, tee: -1, app: -3, arg: -1, putt: -0.5 } }).biggest.area, 'app');
  assert.notStrictEqual((R.build(rd, [], { sg: { full: 4, tee: -9 } }).biggest || {}).how, 'sg');
});

test('compared with the golfer\'s own average in the right direction', () => {
  const usual = round(i => 5, i => ({ putts: 2, fw: i % 2 ? 'hit' : 'left' }));             // 36 putts, about half the fairways
  const today = round(i => 5, i => ({ putts: i < 3 ? 1 : 2, fw: i % 4 ? 'left' : 'hit' }));   // fewer putts, fewer fairways
  const r = R.build(today, [usual, usual]);
  assert.ok(r.good.some(g => /putts/i.test(g)), 'putting should be a good');
  assert.ok(r.improve.some(g => /fairways/i.test(g)), 'fairways should be an improve');
  assert.ok(r.overall.vsAvg != null);
});

test('club consistency needs at least 5 shots a club and only advises between neighbouring clubs', () => {
  const dist = { '6i': { n: 7, avg: 158, p10: 140, p90: 172 }, '7i': { n: 12, avg: 148, p10: 141, p90: 156 }, '8i': { n: 2, avg: 138, p10: 130, p90: 145 } };
  const c = R.clubConsistency(dist, ['6i', '7i', '8i']);
  assert.deepStrictEqual(c.ranked.map(x => x.id), ['7i', '6i']);
  assert.strictEqual(c.tips[0].good, '7i');
  assert.strictEqual(R.clubConsistency({ '7i': { n: 3, avg: 150, p10: 140, p90: 160 } }).ranked.length, 0);
});
