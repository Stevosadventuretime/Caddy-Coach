// Practice builder rules (practicelogic.js): sessions fit the time and the place, use the golfer's own focus,
// never send a full swing drill to a putting green, and say what was left out and why.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const SITE = path.join(__dirname, '..') + '/';
const ctx = { THREE: null, console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(SITE + 'drillstudio.js', 'utf8'), ctx); vm.runInContext(fs.readFileSync(SITE + 'drills.js', 'utf8'), ctx);
const DR = ctx.DRILL_LIBRARY;
const P = require('../practicelogic.js');
const sum = s => s.blocks.reduce((a, b) => a + b.mins, 0);
const ott = { id: 'ott', kind: 'fault', title: 'Coming over the top', status: 'working' };
const putt = { id: 'area:putt', kind: 'area', area: 'putt', title: 'Putting on the course', status: 'new' };
const sway = { id: 'sway', kind: 'fault', title: 'Sway', status: 'new' };

test('every session adds up to the time chosen, at every place', () => {
  for (const m of P.MINS) for (const place of Object.keys(P.PLACES)) {
    const s = P.build({ minutes: m, place, focus: [ott, putt, sway], drills: DR });
    assert.strictEqual(sum(s), m, `${m} min at ${place}`);
    assert.ok(s.blocks.every(b => b.mins >= 1), `${m} min at ${place}: no empty blocks`);
    assert.strictEqual(s.blocks[0].kind, 'warm'); assert.strictEqual(s.blocks[s.blocks.length - 1].kind, 'play');
  }
});

test('the main work is the golfer\'s own focus, with a real drill that suits the place', () => {
  const s = P.build({ minutes: 30, place: 'range', focus: [ott, sway], drills: DR });
  const main = s.blocks.filter(b => b.kind === 'drill');
  assert.strictEqual(main.length, 2);
  for (const b of main) { const d = DR.find(x => x.id === b.drill); assert.ok(d, b.drill); assert.ok(P.drillFits(d, 'range')); }
  assert.ok(DR.find(d => d.id === main[0].drill).fixes.includes('ott'), 'first block fixes the top focus');
});

test('a putting green gets putting, never a full swing drill, and says why the swing fault was left out', () => {
  const s = P.build({ minutes: 20, place: 'green', focus: [ott, putt], drills: DR });
  assert.ok(!s.blocks.some(b => b.kind === 'drill'));
  assert.ok(s.blocks.some(b => b.kind === 'area' && b.area === 'putt'));
  assert.match(s.notes.join(' '), /Coming over the top/);
});

test('the simulator uses its numbers and never a drill that needs sunshine', () => {
  const shadow = DR.find(d => d.id === 'shadow');
  assert.ok(!P.drillFits(shadow, 'sim'));
  const s = P.build({ minutes: 45, place: 'sim', focus: [{ id: 'area:app', kind: 'area', area: 'app', title: 'Approach play', status: 'new' }], drills: DR });
  assert.match(JSON.stringify(s.blocks), /sim/i);
  assert.strictEqual(sum(s), 45);
});

test('no focus yet still gives a sensible session and says how to personalise it', () => {
  const s = P.build({ minutes: 10, place: 'home', focus: [], drills: DR });
  assert.ok(s.blocks.length >= 3);
  assert.match(s.notes.join(' '), /Analyse a swing/);
  const sorted = P.build({ minutes: 20, place: 'range', focus: [Object.assign({}, ott, { status: 'done' })], drills: DR });
  assert.ok(!sorted.blocks.some(b => b.focus === ott.title), 'sorted priorities are not practised again');
});

test('text never says left or right (it reads the same for left-handers)', () => {
  for (const place of Object.keys(P.PLACES)) {
    const s = P.build({ minutes: 60, place, focus: [ott, putt, { id: 'area:arg', kind: 'area', area: 'arg', title: 'Chipping', status: 'new' }, { id: 'area:tee', kind: 'area', area: 'tee', title: 'Driving', status: 'new' }], drills: DR });
    const own = s.blocks.filter(b => b.kind !== 'drill').map(b => JSON.stringify([b.title, b.steps, b.measure])).join(' ') + s.notes.join(' ');
    assert.ok(!/\b(left|right)\b/i.test(own), place);
  }
});

test('the journey lists swing work, sorted faults, rounds and practice, newest first, without repeats', () => {
  const NOW = Date.parse('2026-11-24T12:00:00Z');
  const j = P.journey([
    { at: NOW - 5e8, source: 'swing', text: 'Work on: Sway' },
    { at: NOW - 1e8, source: 'swing', text: 'Sorted: Sway. It hasn\'t shown up in your last two swings.' },
    { at: NOW - 3e8, source: 'coach', text: 'chat' },
    { at: NOW - 2e8, source: 'plan', text: 'Practised: 20-minute range session' },
  ], [{ at: NOW - 2e8, title: '20-minute range session', blocks: [{ title: 'Fairway finder', score: 6, of: 10 }] }]);
  assert.deepStrictEqual(j.map(e => e.type), ['sorted', 'practice', 'swing']);
});
