// Caddy Coach practice coaching: from a golfer's miss to its cause and the drills, scored drill tests and progress,
// and a two-week focus. Pure data and functions (no page code), so they can be tested on their own.
(function (root) {
'use strict';

// ---------- the miss: what the ball did, what it means at impact, and where to start ----------
// [R] and [L] are swapped for left-handed golfers: a right-hander's slice curves right, a left-hander's left.
// ball: drills that train the impact cause directly (start line, face, low point, strike), most useful first.
// check: a quick way for the golfer to confirm the cause without a coach.
const MISS_GUIDE = {
  slice: { name: 'Slice', flight: 'Starts at or [L] of the target and curves well to the [R].',
    impact: 'The clubface is open to the direction the club is swinging. Usually the swing is also coming across the ball from outside, which adds to the curve.',
    order: 'Work on the face first, then the path. If a slice turns into a straight pull, the face is fixed and only the path remains: that is progress.',
    check: 'Lay a club on the ground a couple of metres in front of the ball, pointing at the target. Note where the ball starts against it and which way it curves. The start mostly shows the face; the curve shows the face against the path.',
    ball: ['startline', 'grip', 'trailarm', 'headcover', 'twoball', 'station'], kind: 'dir' },
  hook: { name: 'Hook', flight: 'Curves sharply to the [L], often starting [R] of the target.',
    impact: 'The clubface is closed to the direction the club is swinging. Often the club is stuck behind the body and the hands flip it shut to save the shot.',
    order: 'Check the grip first (a very strong grip shuts the face), then the body movements that get the club stuck.',
    check: 'Lay a club in front of the ball pointing at the target and watch the start and the curve. A ball that starts [R] and hooks back is a face closed to an in-to-out path.',
    ball: ['startline', 'grip', 'twoball', 'chair', 'hipstick', 'station'], kind: 'dir' },
  push: { name: 'Push', flight: 'Starts [R] of the target and flies fairly straight.',
    impact: 'The club is swinging out to the [R] and the face is pointing the same way. Often the body has stopped turning or moved toward the ball, leaving the arms behind.',
    order: 'Check your aim first: many pushes are good swings aimed [R]. Then work on the body turning through.',
    check: 'Lay a club along your feet and another behind the ball at the target. If they aren\'t parallel, it is aim, not the swing.',
    ball: ['station', 'startline', 'chair', 'beltclick'], kind: 'dir' },
  pull: { name: 'Pull', flight: 'Starts [L] of the target and flies fairly straight.',
    impact: 'The club is swinging across the ball to the [L] and the face is pointing the same way. The face is often fine; the path is the problem.',
    order: 'Check aim and ball position first (a ball too far forward pulls), then the downswing path.',
    check: 'Lay a club on the ground in front of the ball at the target. A ball that starts [L] and flies straight is a path problem with a square face.',
    ball: ['station', 'startline', 'headcover', 'stickover', 'twoball'], kind: 'dir' },
  fat: { name: 'Fat', flight: 'The club hits the ground before the ball: a big divot, a short shot.',
    impact: 'The lowest point of the swing is behind the ball. Usually the weight is staying on the trail side, or the body is moving away from the target.',
    order: 'Fix where the club meets the ground first; distance and direction follow.',
    check: 'Draw a line on the ground (or lay a towel edge on a mat) and hit off it without a ball. Marks that start behind the line show the low point is too far back.',
    ball: ['line', 'towel', 'stepthrough', 'impactbag', 'hipstick'], kind: 'strike' },
  thin: { name: 'Thin', flight: 'The leading edge catches the middle of the ball: low, hot, often over the green.',
    impact: 'The club is rising or too high when it reaches the ball: the low point is behind it, or the body is lifting through impact.',
    order: 'Work on the low point and on keeping your posture to impact.',
    check: 'Draw a line and make practice swings. No mark at all means you are lifting; marks behind the line mean the low point is back.',
    ball: ['line', 'towel', 'chair', 'impactbag', 'headwall'], kind: 'strike' },
  top: { name: 'Topped', flight: 'The club hits the top of the ball and it runs along the ground.',
    impact: 'The club is well above the ground at impact. Nearly always the body stands up or the head lifts to see the shot early.',
    order: 'Keep your posture and your eyes on the ball until after it has gone.',
    check: 'Make practice swings over a line. If the club doesn\'t touch the ground at all, you are standing up.',
    ball: ['line', 'headwall', 'chair', 'feettogether'], kind: 'strike' },
  shank: { name: 'Shank', flight: 'The ball shoots sharply [R] off the neck of the club.',
    impact: 'The hands and club are further from you at impact than at address, so the neck (hosel) reaches the ball first.',
    order: 'Get the strike back to the middle of the face first: stand a little further away and keep your posture.',
    check: 'Put a little foot powder or a dry-wipe mark on the clubface. Strikes near the heel confirm it.',
    ball: ['heeltoe', 'handhang', 'chair', 'headcover'], kind: 'strike' },
};
const MISS_ORDER = ['slice', 'hook', 'push', 'pull', 'fat', 'thin', 'top', 'shank'];
function sideWords(text, lefty) { return String(text).replace(/\[R\]/g, lefty ? 'left' : 'right').replace(/\[L\]/g, lefty ? 'right' : 'left'); }
// the traced shot's shape (tracer.describeShape) to a miss, if it is one
function missFromFlight(shape) {
  const s = String(shape || '').toLowerCase();
  if (/slice/.test(s)) return 'slice'; if (/hook/.test(s)) return 'hook';
  if (s === 'push' || s === 'push-fade') return 'push'; if (s === 'pull' || s === 'pull-draw') return 'pull';
  return null;
}

// What to work on for a miss: the drills that train the impact cause, then the body causes (from the swing
// analysis' own miss links, strongest first) each with its drills. A drill appears once, at its first place.
// drillsForCheck(id) -> drills for a swing check; found: the check ids the golfer's own last swing showed as faults.
function missPlan(miss, opts) {
  const G = MISS_GUIDE[miss]; if (!G) return null;
  const all = opts.drills || [], byId = id => all.find(d => d.id === id), seen = new Set();
  const take = d => { if (!d || seen.has(d.id)) return null; seen.add(d.id); return d; };
  const ball = G.ball.map(byId).map(take).filter(Boolean);
  const links = ((opts.misses || {})[miss] || {}).links || [], found = new Set(opts.found || []);
  const causes = links.map(([id, side, k, why]) => ({ id, side, k, why, found: found.has(id) }))
    .sort((a, b) => (b.found - a.found) || (b.k - a.k))
    .map(c => Object.assign(c, { drills: (opts.drillsForCheck ? opts.drillsForCheck(c.id) : []).map(take).filter(Boolean).slice(0, 2) }));
  return { miss, guide: G, ball, causes };
}

// ---------- drill tests: a score out of N for each drill, at the golfer's current step ----------
// A result: { id, d: drill id, at: ms, stage: index into drill.progress, score, of }.
function results(all, drillId) { return (all || []).filter(r => r.d === drillId).sort((a, b) => a.at - b.at); }
function passed(r, test) { return !!test && r.score >= Math.ceil(test.pass * r.of / test.of); }
// the step the golfer is on (from their stored stage, never past the last), its last few scores, and whether
// they have earned the next step: two passes in a row at this step (one good day can be luck)
function testState(drill, all, stage) {
  const T = drill.test, steps = (drill.progress || []).length || 1, st = Math.max(0, Math.min(steps - 1, stage || 0));
  const R = results(all, drill.id), here = R.filter(r => (r.stage || 0) === st);
  const last2 = here.slice(-2), ready = !!T && last2.length === 2 && last2.every(r => passed(r, T)) && st < steps - 1;
  const best = R.length ? Math.max(...R.map(r => r.score / r.of)) : null;
  return { stage: st, steps, stepText: (drill.progress || [])[st] || null, recent: R.slice(-8), here, ready, best,
    done: !!T && st === steps - 1 && last2.length >= 1 && passed(last2[last2.length - 1], T) };
}
// trend over the last results at a step: up, down or flat (needs 3 or more)
function trend(rs) {
  if (!rs || rs.length < 3) return null;
  const v = rs.slice(-5).map(r => r.score / r.of), n = v.length, mx = (n - 1) / 2, my = v.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0; v.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) * (i - mx); });
  const s = den ? num / den : 0; return s > 0.03 ? 'up' : s < -0.03 ? 'down' : 'flat';
}

// ---------- focus: one thing for two weeks ----------
// { key, label, why, drills: [ids], from: ms, until: ms }. Week 1 learns it (slow, then tested); week 2 owns it
// (tested at the next step, then mixed clubs and targets, then a pressure test).
const FOCUS_DAYS = 14;
function focusActive(f, now) { return !!(f && f.drills && f.drills.length && (now || Date.now()) < f.until); }
function focusWeek(f, now) { return !focusActive(f, now) ? 0 : ((now || Date.now()) - f.from) < 7 * 864e5 ? 1 : 2; }
function makeFocus(key, label, why, drillIds, now) {
  const t = now || Date.now(); return { key, label, why, drills: drillIds.slice(0, 3), from: t, until: t + FOCUS_DAYS * 864e5 };
}
// the plan's focus sessions for the week the golfer is in
function focusSessions(f, now) {
  const w = focusWeek(f, now); if (!w) return [];
  const [a, b] = f.drills;
  if (w === 1) return [
    { title: `Learn it: ${f.label}`, why: 'Week 1 of your focus. Slow rehearsals first, then the drill\'s test.', items: [{ kind: 'drill', id: a, test: true }].concat(b ? [{ kind: 'drill', id: b }] : []) },
    { title: `Test it: ${f.label}`, why: 'Score the drill again. Two passes in a row move you to the next step.', items: [{ kind: 'drill', id: a, test: true }].concat(b ? [{ kind: 'drill', id: b, test: true }] : []) }];
  return [
    { title: `Own it: ${f.label}`, why: 'Week 2 of your focus. The test at your current step, then the same feeling with a different club every ball.', items: [{ kind: 'drill', id: a, test: true }, { kind: 'task', id: 'mixed' }] },
    { title: `Pressure test: ${f.label}`, why: 'Play it like the course: a full routine every ball, and count the ones that work.', items: [{ kind: 'task', id: 'pressure' }].concat(b ? [{ kind: 'drill', id: b, test: true }] : []) }];
}

root.Coach = { MISS_GUIDE, MISS_ORDER, sideWords, missFromFlight, missPlan, results, passed, testState, trend, FOCUS_DAYS, focusActive, focusWeek, makeFocus, focusSessions };
})(this);
