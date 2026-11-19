// Badges, XP, levels and weekly challenges (achieve.js): earned only from real records, at their exact thresholds.
const test = require('node:test');
const assert = require('node:assert');
const A = require('../achieve.js');

const NOW = Date.parse('2026-11-19T12:00:00Z');
const day = d => NOW - d * 864e5;
const rnd = (at, score, extra) => Object.assign({ at, holes: 18, score, par: 72, putts: 34, pN: 18, three: 1, fw: 6, fwN: 14 }, extra || {});
const earned = s => A.badges(s).filter(b => b.earned).map(b => b.id);

test('an empty profile has earned nothing and is at level 1', () => {
  assert.deepStrictEqual(earned({}), []);
  assert.strictEqual(A.xp({}).total, 0);
  assert.deepStrictEqual([A.level(0).n, A.level(0).name], [1, 'Range Rookie']);
});

test('badges trigger only at their thresholds', () => {
  assert.ok(!earned({ swings: Array(9).fill({ view: 'face-on', overall: 6 }) }).includes('swing10'));
  assert.ok(earned({ swings: Array(10).fill({ view: 'face-on', overall: 6 }) }).includes('swing10'));
  assert.ok(!earned({ rounds: [rnd(day(1), 100)] }).includes('b100'));
  assert.ok(earned({ rounds: [rnd(day(1), 99)] }).includes('b100'));
  assert.ok(!earned({ rounds: [rnd(day(1), 85, { holes: 9 })] }).includes('b90'), '9 holes never counts for breaking 90');
  assert.ok(earned({ rounds: [rnd(day(1), 95, { three: 0, pN: 16 })] }).includes('no3'));
  assert.ok(!earned({ rounds: [rnd(day(1), 95, { three: 0, pN: 12 })] }).includes('no3'));
  assert.ok(earned({ hcp: { start: 20, hi: 19 } }).includes('journey'));
  assert.ok(!earned({ hcp: { start: 20, hi: 19.2 } }).includes('journey'));
  const pm = A.badges({ rounds: [rnd(day(1), 95, { putts: 120 })] }).find(b => b.id === 'putts500');
  assert.deepStrictEqual([pm.have, pm.need, pm.earned], [120, 500, false]);
});

test('Consistency King counts rounds within one calendar month', () => {
  const spread = [Date.parse('2026-09-28'), Date.parse('2026-09-30'), Date.parse('2026-10-02'), Date.parse('2026-10-05')].map(t => rnd(t, 95));
  assert.ok(!earned({ rounds: spread }).includes('king'));
  const oct = [2, 9, 16, 23].map(d => rnd(Date.parse(`2026-10-${String(d).padStart(2, '0')}`), 95));
  assert.ok(earned({ rounds: oct }).includes('king'));
});

test('XP adds up from real activity only', () => {
  const s = { swings: [{ view: 'face-on', overall: 6 }], rounds: [rnd(day(2), 101)], tests: [{ at: day(1) }, { at: day(1) }], sessions: 1 };
  const x = A.xp(s), badgesN = earned(s).length;
  assert.strictEqual(x.total, 50 + 100 + 40 + 40 + badgesN * 25);
  assert.strictEqual(A.level(400).name, 'Regular');
});

test('weekly challenges come from the golfer\'s gaps and count only this week', () => {
  const s = { now: NOW, swings: [{ view: 'face-on', overall: 6, at: day(20) }], rounds: [rnd(day(20), 95, { pN: 0, putts: 0 })], planTotal: 3, planDone: 1 };
  const c = A.challenges(s);
  assert.strictEqual(c.length, 3);
  assert.deepStrictEqual(c.slice(0, 3).map(x => x.k), ['dtl', 'putts', 'plan2']);
  assert.strictEqual(c.find(x => x.k === 'dtl').have, 0, 'an old swing does not count this week');
  const s2 = { ...s, swings: s.swings.concat([{ view: 'down-the-line', overall: 6, at: NOW - 3600e3 }]) };
  assert.ok(A.challenges(s2).every(x => x.k !== 'dtl') || A.challenges(s2).find(x => x.k === 'dtl').done);
});

test('the first run does not announce old badges, later runs announce only new ones', () => {
  assert.deepStrictEqual(A.newlyEarned(['swing1', 'round1'], null), []);
  assert.deepStrictEqual(A.newlyEarned(['swing1', 'round1'], { swing1: 1 }), ['round1']);
});
