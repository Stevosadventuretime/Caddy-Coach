// node --test test_drill_motion.js — Drill Studio plays swing-model.json (run make_swing.py first)
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const SITE = process.env.SITE || '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad/site/';
function load() {
  const ctx = { THREE: null, console }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SITE + 'drillstudio.js', 'utf8'), ctx); vm.runInContext(fs.readFileSync(SITE + 'drills.js', 'utf8'), ctx);
  return ctx;
}
const MODEL = JSON.parse(fs.readFileSync(SITE + 'swing-model.json', 'utf8'));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const drill = (seq, extra) => Object.assign({ id: 'x' + Math.random(), seq, steps: [{ t: 'x' }], view: 'face' }, extra || {});
const endOf = (D, dr, i) => { D.prep(dr); return dr._tl[i].e; };

test('no motion: identical to the rig', () => {
  const { DrillStudio: D, DRILL_LIBRARY: L } = load();
  for (const dr of L.slice(0, 3)) { D.prep(dr); for (let k = 0; k < 50; k++) { const t = dr._dur * k / 50; assert.deepStrictEqual(JSON.parse(JSON.stringify(D.jointsAt(dr, t))), JSON.parse(JSON.stringify(D.rig(D.sampleAt(dr, t).p)))); } }
});
test('plain key lands on the motion phase pose', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  const dr = drill([{ k: 'address', d: 0.5 }, { k: 'top', d: 0.8 }]);
  const J = D.jointsAt(dr, endOf(D, dr, 1)); assert.ok(dist(J.lh, MODEL.frames[MODEL.phases.top].lh) < 0.001);
});
test('override key keeps the rig', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  const dr = drill([{ k: 'address', o: { arms: 'back' }, d: 0.5 }]);
  const J = D.jointsAt(dr, endOf(D, dr, 0)), R = D.rig(D.pose('address', { arms: 'back' }));
  assert.ok(dist(J.lh, R.lh) < 1e-9 && dist(J.head, R.head) < 1e-9);
});
test('segment length stretches the capture', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  for (const d of [0.4, 1.2]) {
    const dr = drill([{ k: 'address', d: 0.5 }, { k: 'top', d }]); D.prep(dr);
    assert.ok(dist(D.jointsAt(dr, dr._tl[1].s).lh, MODEL.frames[MODEL.phases.address].lh) < 0.001);
    assert.ok(dist(D.jointsAt(dr, dr._tl[1].e).lh, MODEL.frames[MODEL.phases.top].lh) < 0.001);
  }
});
test('backwards and skipped moves blend smoothly', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  for (const seq of [[{ k: 'finish', d: 0.5 }, { k: 'address', d: 0.8 }], [{ k: 'address', d: 0.5 }, { k: 'impact', d: 0.8 }], [{ k: 'top', d: 0.5 }, { k: 'address', o: { arms: 'back' }, d: 0.8 }]]) {
    const dr = drill(seq); D.prep(dr); let prev = null;
    for (let t = dr._tl[1].s; t <= dr._tl[1].e; t += 1 / 120) { const J = D.jointsAt(dr, t); if (prev) for (const k of ['pel', 'head', 'lh', 'th', 'lk', 'la']) assert.ok(dist(J[k], prev[k]) < 0.05, k + ' jumped at ' + t); prev = J; }
  }
});
test('same t, same pose', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  const dr = drill([{ k: 'address', d: 0.5 }, { k: 'top', d: 0.8 }, { k: 'impact', d: 0.3 }, { k: 'finish', d: 0.8 }]);
  const a = JSON.stringify(D.jointsAt(dr, 1.0)); D.jointsAt(dr, 0.2); D.jointsAt(dr, 2.0); assert.strictEqual(JSON.stringify(D.jointsAt(dr, 1.0)), a);
});
test('mirror: joints are unchanged (the scene does the mirroring, as for the rig)', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  const dr = drill([{ k: 'address', d: 0.5 }, { k: 'top', d: 0.8 }]); const a = JSON.stringify(D.jointsAt(dr, 1.0));
  D.setMirror(true); assert.strictEqual(JSON.stringify(D.jointsAt(dr, 1.0)), a);
});
test('bad model is ignored', () => {
  const { DrillStudio: D } = load(); D.setSwing({ v: 1, frames: [] });
  const dr = drill([{ k: 'address', d: 0.5 }, { k: 'top', d: 0.8 }]); D.prep(dr);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(D.jointsAt(dr, 1.0))), JSON.parse(JSON.stringify(D.rig(D.sampleAt(dr, 1.0).p))));
});
test('"not this" key holds the previous motion pose', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  const dr = drill([{ k: 'top', d: 0.5 }, { k: 'impact', o: { hip: 10 }, badge: { tone: 'bad' }, d: 0.6 }]);
  const J = D.jointsAt(dr, endOf(D, dr, 1)); assert.ok(dist(J.lh, MODEL.frames[MODEL.phases.top].lh) < 0.001);
});
test('the ball follows the model', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL); const dr = drill([{ k: 'address' }]); D.prep(dr);
  assert.deepStrictEqual(D.ballOf(dr), MODEL.ball);
});
