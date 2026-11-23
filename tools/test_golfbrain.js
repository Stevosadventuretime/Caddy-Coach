// My Golf Brain rules (golfbrainlogic.js): focus keeps its history, status comes only from real records,
// advice isn't repeated, and "why" answers from evidence.
const test = require('node:test');
const assert = require('node:assert');
const G = require('../golfbrainlogic.js');
const NOW = Date.parse('2026-11-23T12:00:00Z'), DAY = 864e5;

test('focus keeps each priority\'s start date and status, never more than 3', () => {
  const old = [{ id: 'ott', kind: 'fault', title: 'Over the top', since: NOW - 10 * DAY, status: 'working' }];
  const top = [{ id: 'ott', kind: 'fault', title: 'Over the top', why: 'In 3 of your last swings' }, { id: 'area:putt', kind: 'area', area: 'putt', title: 'Putting on the course', why: 'Your weakest round stat' }, { id: 'sway', kind: 'fault', title: 'Sway' }, { id: 'x', kind: 'fault', title: 'X' }];
  const f = G.mergeFocus(old, top, NOW);
  assert.strictEqual(f.length, 3);
  assert.deepStrictEqual([f[0].since, f[0].status], [NOW - 10 * DAY, 'working']);
  assert.deepStrictEqual([f[1].status, f[1].since], ['new', NOW]);
  assert.match(f[1].measure, /putts per round/);
});

test('a swing fault is only sorted when it is gone from the last two swings', () => {
  const p = { id: 'ott', kind: 'fault', status: 'working' };
  assert.strictEqual(G.statusFor(p, { swingsSince: 0 }), 'working');
  assert.strictEqual(G.statusFor(p, { swingsSince: 1, lastTwo: [['ott']] }), 'working');
  assert.strictEqual(G.statusFor(p, { swingsSince: 1, lastTwo: [[]] }), 'improving');
  assert.strictEqual(G.statusFor(p, { swingsSince: 2, lastTwo: [[], ['ott']] }), 'improving');
  assert.strictEqual(G.statusFor(p, { swingsSince: 2, lastTwo: [[], []] }), 'done');
});

test('advice history skips repeats within a week and keeps 100', () => {
  let h = G.logAdvice([], { text: 'Pause at the top', ref: 'ott' }, NOW);
  h = G.logAdvice(h, { text: 'Pause at the top', ref: 'ott' }, NOW + DAY);
  assert.strictEqual(h.length, 1);
  h = G.logAdvice(h, { text: 'Pause at the top', ref: 'ott' }, NOW + 8 * DAY);
  assert.strictEqual(h.length, 2);
  for (let i = 0; i < 120; i++) h = G.logAdvice(h, { text: 'x' + i }, NOW + 10 * DAY);
  assert.strictEqual(h.length, 100);
});

test('the coach recalls earlier advice only when it is older than a day', () => {
  const h = [{ at: NOW - 5 * DAY, text: 'Try the pause-at-the-top drill.', ref: 'ott', source: 'coach' }];
  assert.match(G.recallLine(h, 'ott', true, NOW), /I suggested: Try the pause-at-the-top drill\. It's still showing up/);
  assert.strictEqual(G.recallLine([{ at: NOW - 3600e3, text: 'x', ref: 'ott' }], 'ott', true, NOW), '');
});

test('why answers from the evidence, and says so when there is none', () => {
  assert.match(G.whyFor(null), /haven't got enough/);
  assert.match(G.whyFor({ kind: 'fault', title: 'Over the top', why: 'In 3 of your last swings', measure: 'Whether it still shows up in your next 2 swings', since: NOW - 4 * DAY }), /in 3 of your last swings, measured by the camera/);
});

test('a swing fix is recalled in plain words', () => {
  const h = [{ at: NOW - 5 * DAY, text: 'Work on: Hanging back at impact', ref: 'hb', source: 'swing' }];
  assert.match(G.recallLine(h, 'hb', true, NOW), /I suggested working on hanging back at impact\. It's still/);
});
