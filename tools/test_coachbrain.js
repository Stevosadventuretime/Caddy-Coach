// The on-phone coach (coachbrain.js): answers come only from the golfer's data, say what they're based on,
// say what's missing, and never list more than three things.
const test = require('node:test');
const assert = require('node:assert');
const B = require('../coachbrain.js');

const SLICE = { name: 'slice', drills: [{ id: 'pausetop', name: 'Pause at the top' }, { id: 'headcover', name: 'Headcover gate' }],
  links: [
    { id: 'ott', name: 'Hand path coming down', why: 'Coming over the top swings the club across the ball.', found: false, checkable: false },
    { id: 'reverse', name: 'Spine at the top', why: 'Leaning toward the target at the top.', found: false, checkable: true },
    { id: 'shTurn', name: 'Shoulder turn', why: 'A short shoulder turn leaves the arms to do the work.', found: false, checkable: true },
  ] };
const empty = { golfer: { hand: 'right' }, swings: [], misses: { slice: SLICE } };
const swing = (over, faults, view) => ({ date: '2026-11-01', view: view || 'face-on', overall: over, faults: faults || [] });

test('works out what was asked', () => {
  assert.deepStrictEqual(B.intent('Why am I slicing my driver?'), { k: 'miss', miss: 'slice' });
  assert.deepStrictEqual(B.intent('Why am I losing so many shots with my wedges?'), { k: 'area', area: 'app' });
  assert.strictEqual(B.intent('What should I practise today?').k, 'practice');
  assert.strictEqual(B.intent('Has my swing improved over the last month?').k, 'improved');
  assert.strictEqual(B.intent('Which part of my game should I focus on?').k, 'focus');
  assert.strictEqual(B.intent('How is my putting?').area, 'putt');
  assert.strictEqual(B.intent('blah').k, 'help');
});

test('with no data, every answer says what is missing and claims nothing about the golfer', () => {
  for (const q of B.CHIPS) {
    const a = B.answer(q, empty);
    assert.ok(a.title, q);
    assert.ok(a.points.length <= 3, q);
    if (a.intent !== 'help') assert.ok(a.missing.length > 0 || /haven't|need|can't|not set/i.test(a.points.join(' ')), `"${q}" should admit it has no data`);
    assert.ok(!/your last \d+ swing/i.test(a.evidence), q);
  }
});

test('a slice cause found in the swing is named, with drills from the library', () => {
  const s = { ...empty, swings: [swing(6.1, [{ id: 'ott', title: 'Stop coming over the top', drills: [{ id: 'pausetop', name: 'Pause at the top' }] }], 'down-the-line')],
    misses: { slice: { ...SLICE, links: SLICE.links.map(l => l.id === 'ott' ? { ...l, found: true, checkable: true } : l) } } };
  const a = B.answer('Why am I slicing?', s);
  assert.match(a.points[0], /Hand path coming down/);
  assert.ok(a.actions.every(x => x.type !== 'drill' || ['pausetop', 'headcover'].includes(x.id)));
  assert.match(a.evidence, /Based on your last 1 swing/);
});

test('a cause the camera angle could not check is flagged rather than guessed', () => {
  const s = { ...empty, swings: [swing(7, [], 'face-on')] };
  const a = B.answer('why do I slice', s);
  assert.ok(a.missing.some(m => /couldn't check/.test(m)));
});

test('practice today never lists more than three things', () => {
  const s = { ...empty, swings: [swing(6, [{ id: 'sway', title: 'Stop swaying', drills: [{ id: 'headwall', name: 'Head against the wall' }] }])],
    recurring: [{ id: 'sway', title: 'Stop swaying', n: 3, drills: [{ id: 'headwall', name: 'Head against the wall' }] }],
    practice: { next: { title: 'Rhythm', why: 'A good one for any golfer' }, focus: 'Stop swaying', total: 3, done: 0 },
    rounds: { n: 4, sg: { full: 36, tee: -1, app: -4, arg: -2, putt: -1.5 } } };
  const a = B.answer('What should I practise today?', s);
  assert.ok(a.points.length >= 2 && a.points.length <= 3);
  assert.ok(a.actions.length <= 3);
  assert.ok(B.top3(s).length <= 3);
});

test('improvement needs two swings from the same angle, and reads the trend direction', () => {
  assert.match(B.answer('Has my swing improved?', { ...empty, swings: [swing(6)] }).points[0], /at least two swings/);
  const up = B.answer('Has my swing improved?', { ...empty, swings: [swing(7), swing(6.5), swing(6)], trend: { n: 3, first: 6, last: 7, from: '1 Oct', to: '1 Nov', view: 'face-on', better: ['Hip sway'], worse: [] } });
  assert.match(up.points[0], /up: 6 → 7/);
  const flat = B.answer('Has my swing improved?', { ...empty, swings: [swing(6), swing(6.2)], trend: { n: 2, first: 6, last: 6.2, from: 'a', to: 'b', view: 'face-on', better: [], worse: [] } });
  assert.match(flat.points[0], /about the same/);
  const ref = B.answer('Has my swing improved?', { ...empty, swings: [swing(7), swing(6)], reference: { text: 'Against your reference swing (1 Oct): 3 positions better, 0 worse.' }, trend: { n: 2, first: 6, last: 7, from: 'a', to: 'b', view: 'face-on', better: ['A', 'B'], worse: ['C'] } });
  assert.match(ref.points[1], /reference swing/);
});

test('game focus picks the area losing the most strokes, only when there is enough shot data', () => {
  const s = { ...empty, rounds: { n: 3, sg: { full: 27, tee: -1.2, app: -4.1, arg: -1.9, putt: -2.0 } } };
  assert.strictEqual(B.focusPick(s).area, 'app');
  assert.match(B.answer('Which part of my game should I focus on?', s).points[0], /approach/);
  assert.strictEqual(B.focusPick({ rounds: { n: 1, sg: { full: 4, tee: -9 } } }), null);
});

test('area questions without round data explain what to record', () => {
  const a = B.answer('Why am I losing shots with my wedges?', empty);
  assert.ok(a.missing[0] && /During a round/.test(a.missing[0]));
});

test('what the coach knows reflects the golfer, including left-handers', () => {
  const k = B.knows({ golfer: { level: 'regular', goal: 'scores', hand: 'left' }, swings: [] });
  assert.match(k[0].v, /left-handed/);
  assert.match(k[0].v, /Regular golfer/);
  assert.strictEqual(k.find(r => r.k === 'swings').v, 'None yet');
});

test('last round answers from the round report, or says there is none', () => {
  assert.strictEqual(B.intent('How did my last round go?').k, 'round');
  assert.match(B.answer('How did my last round go?', empty).points[0], /haven't recorded a round/);
  const rep = { overall: { score: 92, holes: 18, pts: 33, vsAvg: -2 }, good: ['No three-putts.'], improve: [], biggest: { text: 'About 4 shots went on penalties (an estimate from your scorecard).' }, target: 'No more than 3 penalty shots next round.', missing: [], basis: 'Compared with your last 4 rounds.' };
  const a = B.answer('how did my round go', { ...empty, lastReport: rep });
  assert.match(a.points[0], /92 over 18 holes, 33 points \(2 better than usual/);
  assert.ok(a.points.length <= 3);
});

test('level question answers from the achievements, with the nearest badges', () => {
  assert.strictEqual(B.intent("What's my level?").k, 'level');
  const achieve = { L: { n: 2, name: 'Weekend Golfer', to: 400, nextName: 'Regular' }, X: { total: 260 },
    B: [{ name: 'Ten swings', have: 7, need: 10, earned: false, how: 'Analyse 10 swings' }, { name: 'Break 90', have: 0, need: 1, earned: false, how: 'Score under 90 for 18 holes' }],
    C: [{ title: 'Do 3 drill tests', done: false }, { title: 'Play a round', done: true }] };
  const a = B.answer('what badges can I get next', { ...empty, achieve });
  assert.match(a.points[0], /Level 2, Weekend Golfer: 260 XP, 140 to Regular/);
  assert.match(a.points[1], /Ten swings \(7 of 10\)/);
  assert.ok(a.points.length <= 3);
});

test('what am I working on, and why, come from the saved focus and history', () => {
  assert.strictEqual(B.intent('What am I working on?').k, 'working');
  assert.strictEqual(B.intent('Why are you recommending this?').k, 'why');
  assert.match(B.answer('What am I working on?', empty).points[0], /Nothing yet/);
  const DAY = 864e5, now = Date.now();
  const s = { ...empty, focusNow: [{ id: 'ott', kind: 'fault', title: 'Over the top', why: 'In 3 of your last swings', measure: 'Whether it still shows up in your next 2 swings', status: 'working', since: now - 6 * DAY }],
    brainHistory: [{ at: now - 5 * DAY, text: 'Work on: Over the top', ref: 'ott', source: 'swing' }] };
  assert.match(B.answer('What am I working on?', s).points[0], /1\. Over the top \(working on it\)/);
  const w = B.answer('why are you recommending this', s);
  assert.match(w.points[0], /in 3 of your last swings, measured by the camera/);
  assert.match(w.points[1], /I suggested working on over the top/);
});
