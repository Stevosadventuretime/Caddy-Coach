// Friends' leaderboards and private competitions (friendlogic.js): only real data, within the dates, ties shared.
const test = require('node:test');
const assert = require('node:assert');
const F = require('../friendlogic.js');

const NOW = Date.parse('2026-11-19T12:00:00Z');
const R = (d, holes, score, extra) => Object.assign({ d, holes, score, pts: null, putts: 0, pN: 0 }, extra || {});
const card = recs => F.buildCard(Object.assign({ now: NOW }, recs));

test('a shared card keeps only the last 60 days and scales score to 18 holes', () => {
  const c = card({ rounds: [R('2026-08-01', 18, 90), R('2026-11-10', 9, 45, { putts: 16, pN: 9 }), R('2026-11-15', 18, 88, { pts: 34, putts: 32, pN: 18, drive: 251 })] });
  assert.strictEqual(c.rounds.length, 2);
  assert.strictEqual(c.rounds[0].gross18, 90);
  assert.strictEqual(c.rounds[0].pts, null, '9-hole rounds never count for Stableford');
  assert.strictEqual(c.rounds[1].drive, 251);
});

test('competition standings count only rounds inside the dates and skip golfers with no data', () => {
  const people = [
    { id: 'a', name: 'Al', card: card({ rounds: [R('2026-11-01', 18, 90, { pts: 36 }), R('2026-10-20', 18, 80, { pts: 41 })] }) },
    { id: 'b', name: 'Bo', card: card({ rounds: [R('2026-11-05', 18, 92, { pts: 33 })] }) },
    { id: 'c', name: 'Cy', card: card({ rounds: [] }) },
  ];
  const s = F.compStandings({ format: 'stableford', starts: '2026-11-01', ends: '2026-11-30' }, people);
  assert.deepStrictEqual(s.map(r => [r.name, r.value, r.pos]), [['Al', 36, 1], ['Bo', 33, 2]]);
});

test('ties share a position, and lower is better for score and putts', () => {
  const people = ['A', 'B', 'C'].map((n, i) => ({ id: n, name: n, card: card({ rounds: [R('2026-11-10', 18, [85, 85, 90][i])] }) }));
  const s = F.compStandings({ format: 'gross', starts: '2026-11-01', ends: '2026-11-30' }, people);
  assert.deepStrictEqual(s.map(r => r.pos), [1, 1, 3]);
});

test('most improved needs two handicap points in the window', () => {
  const one = card({ hiHist: [{ d: '2026-11-01', hi: 18 }] }), two = card({ hiHist: [{ d: '2026-09-01', hi: 18.4 }, { d: '2026-11-10', hi: 16.9 }] });
  const lb = F.leaderboard([{ id: 'x', name: 'X', card: one }, { id: 'y', name: 'Y', card: two }], 'improved', NOW);
  assert.deepStrictEqual(lb.map(r => [r.name, r.value]), [['Y', 1.5]]);
});

test('longest drive uses GPS-tracked drives only', () => {
  const people = [{ id: 'a', name: 'A', card: card({ rounds: [R('2026-11-10', 18, 90, { drive: 240 })] }) }, { id: 'b', name: 'B', card: card({ rounds: [R('2026-11-11', 18, 90)] }) }];
  assert.deepStrictEqual(F.leaderboard(people, 'drive', NOW).map(r => r.name), ['A']);
});
