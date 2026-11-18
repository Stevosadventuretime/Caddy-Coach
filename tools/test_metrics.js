// Swing positions and check labels from SwingMetrics (metrics.js), on a made-up swing with known timing.
const test = require('node:test');
const assert = require('node:assert');
const SM = require('../metrics.js');

// hand height (0 = hips, 1 = shoulders) through a swing filmed at 60 fps
const KEY = [[0, -0.5], [1.0, -0.5], [1.9, 1.6], [2.05, 1.6], [2.35, -0.4], [2.85, 1.5], [3.6, 1.5]];
function handH(t) {
  for (let i = 1; i < KEY.length; i++) if (t <= KEY[i][0]) {
    const [t0, h0] = KEY[i - 1], [t1, h1] = KEY[i], u = (t - t0) / (t1 - t0);
    return h0 + (h1 - h0) * (0.5 - 0.5 * Math.cos(Math.PI * u));   // smooth in and out of each position
  }
  return KEY[KEY.length - 1][1];
}
function frame(t) {
  const pts = Array.from({ length: 33 }, () => ({ x: 300, y: 500, vis: 0.99 }));
  const hipY = 600, shY = 400, T = hipY - shY, h = handH(t);
  pts[0] = { x: 300, y: 340, vis: 0.99 };                                            // nose
  pts[11] = { x: 250, y: shY, vis: 0.99 }; pts[12] = { x: 350, y: shY, vis: 0.99 };  // shoulders
  pts[13] = { x: 245, y: 480, vis: 0.99 }; pts[14] = { x: 355, y: 480, vis: 0.99 };  // elbows
  pts[23] = { x: 265, y: hipY, vis: 0.99 }; pts[24] = { x: 335, y: hipY, vis: 0.99 }; // hips
  pts[25] = { x: 262, y: 720, vis: 0.99 }; pts[26] = { x: 338, y: 720, vis: 0.99 };  // knees
  pts[27] = { x: 240, y: 840, vis: 0.99 }; pts[28] = { x: 360, y: 840, vis: 0.99 };  // ankles
  const wy = hipY - h * T, wx = 300 + 60 * Math.max(0, h);
  pts[15] = { x: wx - 5, y: wy, vis: 0.99 }; pts[16] = { x: wx + 5, y: wy, vis: 0.99 };
  return { t, pts };
}
const frames = []; for (let t = 0; t <= 3.6 + 1e-9; t += 1 / 60) frames.push(frame(+t.toFixed(4)));

test('finds nine positions, in order, near where they really are', () => {
  const F = frames.map(SM.features);
  const P = SM.phases(F);
  assert.ok(P && !P.approx, 'phases found');
  const seq = [P.takeT, P.halfT, P.topT, P.transT, P.downT, P.impT, P.thruT];
  seq.forEach(x => assert.ok(x != null, 'every in-between position found'));
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i] > seq[i - 1], `position ${i} comes after position ${i - 1}`);
  assert.ok(Math.abs(P.impT - 2.35) < 0.05, 'impact at the lowest hands');
  assert.ok(P.halfT > 1.3 && P.halfT < 1.65, 'halfway back is partway up the backswing');
  assert.ok(P.downT > 2.1 && P.downT < 2.3, 'downswing is partway down');
  assert.ok(P.thruT > 2.4 && P.thruT < 2.75, 'follow-through is partway up after impact');
});

test('leaves out a position it cannot find rather than guessing', () => {
  // a clip that stops just after impact has no follow-through
  const F = frames.filter(f => f.t <= 2.4).map(SM.features);
  const P = SM.phases(F);
  if (P && !P.approx) assert.strictEqual(P.thruT, null);
});

test('every check says whether it is measured or estimated', () => {
  const m = {};
  for (const c of SM.CHECKS) m[c.key] = c.A[Math.floor(c.A.length / 2)][0];
  for (const view of ['face-on', 'down-the-line']) {
    const C = SM.checks(m, view);
    assert.ok(C.length > 10);
    for (const c of C) assert.ok(c.basis === 'measured' || c.basis === 'estimated', `${c.id} has a basis`);
  }
  assert.strictEqual(SM.checks(m, 'face-on').find(c => c.id === 'shTurn').basis, 'estimated');
  assert.strictEqual(SM.checks(m, 'face-on').find(c => c.id === 'sway').basis, 'measured');
});
