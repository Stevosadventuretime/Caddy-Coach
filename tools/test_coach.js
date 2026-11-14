// node --test tools/test_coach.js — the practice coaching in coach.js (miss guide, drill tests, two-week focus)
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const SITE = path.join(__dirname, '..') + '/';
const ctx = { THREE: null, console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['drillstudio.js', 'drills.js', 'coach.js']) vm.runInContext(fs.readFileSync(SITE + f, 'utf8'), ctx);
const C = ctx.Coach, L = ctx.DRILL_LIBRARY, M = require(SITE + 'metrics.js');
const drill = id => L.find(d => d.id === id);

test('every miss has a guide, sides that flip for left-handers, and drills that exist or are planned', () => {
  for (const k of C.MISS_ORDER) { const G = C.MISS_GUIDE[k];
    for (const f of ['name', 'flight', 'impact', 'order', 'check']) assert.ok(G[f], k + ' ' + f);
    assert.ok(G.ball.length >= 3, k + ' has impact drills');
    assert.ok(M.MISSES[k], k + ' is a swing-analysis miss'); }
  assert.match(C.sideWords(C.MISS_GUIDE.slice.flight, false), /curves well to the right/);
  assert.match(C.sideWords(C.MISS_GUIDE.slice.flight, true), /curves well to the left/);
  assert.ok(!/\[[RL]\]/.test(C.sideWords(JSON.stringify(C.MISS_GUIDE), true)));
  assert.ok(!/\b(left|right)\b/i.test(JSON.stringify(C.MISS_GUIDE)), 'every side is a [L]/[R] token so it flips for left-handers');
});
test('a traced flight becomes a miss', () => {
  assert.strictEqual(C.missFromFlight('Slice'), 'slice'); assert.strictEqual(C.missFromFlight('pull-hook'), 'hook');
  assert.strictEqual(C.missFromFlight('push'), 'push'); assert.strictEqual(C.missFromFlight('straight'), null);
});
test('the miss plan lists each drill once, existing drills only, and puts the golfer\'s own faults first', () => {
  const forCheck = id => L.filter(d => (d.fixes || []).includes(id));
  const p = C.missPlan('slice', { drills: L, misses: M.MISSES, drillsForCheck: forCheck, found: ['ott'] });
  const ids = p.ball.map(d => d.id).concat(...p.causes.map(c => c.drills.map(d => d.id)));
  assert.strictEqual(new Set(ids).size, ids.length, 'no drill twice');
  assert.ok(ids.every(id => drill(id)), 'only drills in the library');
  if (p.causes.some(c => c.id === 'ott')) assert.strictEqual(p.causes[0].id, 'ott');
  assert.strictEqual(C.missPlan('nope', { drills: L }), null);
});
test('every drill has a focus cue and a scored test that can be passed', () => {
  for (const d of L) {
    assert.ok(d.cue && d.cue.length < 90, d.id + ' cue');
    assert.ok(d.test && d.test.q && d.test.of > 0 && d.test.pass > 0 && d.test.pass <= d.test.of, d.id + ' test');
  }
});
test('two passes in a row at a step earn the next step; a fail in between does not', () => {
  const d = drill('chair'), T = d.test, r = (s, at, stage = 0) => ({ d: d.id, at, stage, score: s, of: T.of });
  assert.strictEqual(C.testState(d, [r(T.pass, 1)], 0).ready, false);
  assert.strictEqual(C.testState(d, [r(T.pass, 1), r(T.pass, 2)], 0).ready, true);
  assert.strictEqual(C.testState(d, [r(T.pass, 1), r(T.pass - 1, 2)], 0).ready, false);
  assert.strictEqual(C.testState(d, [r(T.pass, 1), r(T.pass, 2)], 1).ready, false, 'passes at another step do not count');
  const last = d.progress.length - 1;
  assert.strictEqual(C.testState(d, [r(T.pass, 1, last), r(T.pass, 2, last)], last).ready, false, 'no step past the last');
  assert.strictEqual(C.testState(d, [r(T.pass, 1, last)], last).done, true);
  assert.strictEqual(C.testState(d, [], 99).stage, last, 'a stored step past the end is clamped');
  assert.ok(C.passed({ score: 4, of: 5 }, { of: 10, pass: 8 }), 'a score out of a different total is scaled');
});
test('trend needs three results and reads the direction', () => {
  const rs = v => v.map((s, i) => ({ score: s, of: 10, at: i }));
  assert.strictEqual(C.trend(rs([5, 6])), null);
  assert.strictEqual(C.trend(rs([3, 5, 7, 8])), 'up'); assert.strictEqual(C.trend(rs([8, 6, 4])), 'down'); assert.strictEqual(C.trend(rs([6, 6, 6])), 'flat');
});
test('a focus lasts two weeks: learn and test in week 1, own it and pressure-test in week 2', () => {
  const t0 = Date.UTC(2026, 10, 1), f = C.makeFocus('slice', 'Your slice', 'why', ['startline', 'grip', 'trailarm', 'x'], t0);
  assert.strictEqual(f.drills.length, 3);
  assert.strictEqual(C.focusWeek(f, t0 + 2 * 864e5), 1); assert.strictEqual(C.focusWeek(f, t0 + 8 * 864e5), 2); assert.strictEqual(C.focusWeek(f, t0 + 15 * 864e5), 0);
  const w1 = C.focusSessions(f, t0 + 864e5), w2 = C.focusSessions(f, t0 + 9 * 864e5);
  assert.strictEqual(w1.length, 2); assert.match(w1[0].title, /^Learn it/); assert.ok(w1[0].items[0].test);
  assert.ok(w2.some(s => s.items.some(i => i.id === 'pressure')) && w2.some(s => s.items.some(i => i.id === 'mixed')));
  assert.strictEqual(C.focusSessions(f, t0 + 20 * 864e5).length, 0);
  assert.strictEqual(C.focusActive({ drills: [] , until: t0 + 1e9 }, t0), false);
});
