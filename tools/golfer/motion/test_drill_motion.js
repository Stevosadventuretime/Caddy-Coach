// node --test test_drill_motion.js — Drill Studio plays swing-model.json (run make_swing.py first)
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const SITE = process.env.SITE || path.join(__dirname, '..', '..', '..') + '/';
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
  for (const dr of L) { D.prep(dr); for (let k = 0; k < 50; k++) { const t = dr._dur * k / 50; assert.deepStrictEqual(JSON.parse(JSON.stringify(D.jointsAt(dr, t))), JSON.parse(JSON.stringify(D.rig(D.sampleAt(dr, t).p)))); } }
});
test('plain key lands on the motion phase pose', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  const dr = drill([{ k: 'address', d: 0.5 }, { k: 'top', d: 0.8 }]);
  const J = D.jointsAt(dr, endOf(D, dr, 1)); assert.ok(dist(J.lh, MODEL.frames[MODEL.phases.top].lh) < 0.001);
});
const PH = ['address', 'takeaway', 'half', 'top', 'down', 'impact', 'through', 'finish'];
const isPlain = k => PH.includes(k.k) && (!k.o || Object.keys(k.o).every(x => x === 'head'));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
test('drills with no plain swing keys stay exactly on the rig', () => {
  const { DrillStudio: D, DRILL_LIBRARY: L } = load(); D.setSwing(MODEL); let n = 0;
  for (const dr of L.filter(d => !d.seq.some(isPlain))) { n++; D.prep(dr);
    for (let k = 0; k < 60; k++) { const t = dr._dur * k / 60; assert.deepStrictEqual(JSON.parse(JSON.stringify(D.jointsAt(dr, t))), JSON.parse(JSON.stringify(D.rig(D.sampleAt(dr, t).p))), dr.id + ' ' + t); }
    assert.deepStrictEqual(D.ballOf(dr), dr._ball, dr.id + ' ball'); }
  assert.ok(n >= 10, 'rig-only drills ' + n);
});
test('override key = captured pose + the override', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  const dr = drill([{ k: 'top', d: 0.5 }, { k: 'impact', o: { hip: -10, side: 4 }, d: 0.6 }]);
  const J = D.jointsAt(dr, endOf(D, dr, 1)), want = sub(D.rig(D.pose('impact', { hip: -10, side: 4 })).pel, D.rig(D.pose('impact')).pel);
  assert.ok(dist(sub(J.pel, MODEL.frames[MODEL.phases.impact].pel), want) < 0.002);
});
test('club keeps its length and arms their reach, in every drill that uses the capture', () => {
  const { DrillStudio: D, DRILL_LIBRARY: L } = load(); D.setSwing(MODEL);
  for (const dr of L.filter(d => d.seq.some(isPlain))) { D.prep(dr);
    for (let k = 0; k <= 200; k++) { const t = dr._dur * k / 200, J = D.jointsAt(dr, t);
      if (J.club && J.arms === 'club') { const cl = dist(J.club[0], J.club[1]); assert.ok(Math.abs(cl - 0.95) < 0.06, dr.id + ' club ' + cl.toFixed(3) + ' at ' + t.toFixed(2)); }
      for (const s of ['l', 't']) { const r = dist(J[s + 's'], J[s + 'h']); assert.ok(r > 0.12 && r < 0.66, dr.id + ' ' + s + ' arm ' + r.toFixed(3) + ' at ' + t.toFixed(2)); } } }
});
test('feet stay planted through a plain swing drill', () => {
  const { DrillStudio: D, DRILL_LIBRARY: L } = load(); D.setSwing(MODEL);
  const dr = L.find(d => d.id === 'tempo'); D.prep(dr); const a0 = D.jointsAt(dr, 0).lt; let worst = 0;
  for (let k = 0; k <= 200; k++) { const J = D.jointsAt(dr, dr._dur * k / 200); worst = Math.max(worst, Math.hypot(J.lt[0] - a0[0], J.lt[2] - a0[2])); }
  assert.ok(worst < 0.03, 'lead toe moved ' + worst);
});
test('the ghost is the golfer plus the fault', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL);
  const dr = drill([{ k: 'address', d: 0.5 }, { k: 'impact', d: 0.6, ghost: { k: 'impact', o: { hip: 10, hz: 0.06 } } }]);
  const J = D.jointsAt(dr, endOf(D, dr, 1)), G = D.ghostAt(dr, 1);
  const want = sub(D.rig(D.pose('impact', { hip: 10, hz: 0.06 })).pel, D.rig(D.pose('impact')).pel);
  assert.ok(dist(sub(G.pel, J.pel), want) < 0.002);
});
test('the chair sits just behind the golfer', () => {
  for (const withModel of [false, true]) { const { DrillStudio: D, DRILL_LIBRARY: L } = load(); if (withModel) D.setSwing(MODEL);
    const dr = L.find(d => d.id === 'chair'), q = dr.props.find(p => p.type === 'chair');
    assert.ok(Math.abs(D.propPoint(dr, q.at)[2] - (D.jointsAt(dr, 0).seat[2] - 0.02)) < 0.005, 'model ' + withModel); }
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
    for (let t = dr._tl[1].s; t <= dr._tl[1].e; t += 1 / 120) { const J = D.jointsAt(dr, t); if (prev) for (const k of ['pel', 'head', 'lh', 'th', 'lk', 'la']) assert.ok(dist(J[k], prev[k]) < 0.1, k + ' jumped at ' + t); prev = J; }
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
test('the ball follows the model in drills that use the capture', () => {
  const { DrillStudio: D } = load(); D.setSwing(MODEL); const dr = drill([{ k: 'address' }]); D.prep(dr);
  assert.deepStrictEqual(D.ballOf(dr), MODEL.ball);
});
