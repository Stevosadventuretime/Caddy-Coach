// Caddy Coach: badges, XP, levels and weekly challenges. Pure logic: a summary of the golfer's real records in,
// what they've earned out. Everything is recalculated from the records, so nothing can be faked or lost.
(function (root) {
'use strict';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const DAY = 864e5;
const XP = { swing: 50, round: 100, test: 20, session: 40, badge: 25 };
const LEVELS = [[0, 'Range Rookie'], [150, 'Weekend Golfer'], [400, 'Regular'], [800, 'Grinder'], [1400, 'Contender'], [2200, 'Club Champion'], [3200, 'Course Legend']];

// a badge: id, name, how to earn it, and progress [have, need] from the summary
const BADGES = [
  { id: 'swing1', name: 'First swing analysis', how: 'Analyse your first swing', p: s => [s.swings.length, 1] },
  { id: 'angles', name: 'Both angles', how: 'Analyse a swing face-on and one down the line', p: s => [new Set(s.swings.map(x => x.view)).size, 2] },
  { id: 'swing10', name: 'Ten swings', how: 'Analyse 10 swings', p: s => [s.swings.length, 10] },
  { id: 'swing7', name: 'Swing score 7+', how: 'Score 7 or more on a swing analysis', p: s => [s.swings.some(x => x.overall >= 7) ? 1 : 0, 1] },
  { id: 'fixed', name: 'Fixed it', how: 'Stop a fault that kept coming back showing up in your last two swings', p: s => [s.fixedFault ? 1 : 0, 1] },
  { id: 'round1', name: 'First round', how: 'Record a round of 9 holes or more', p: s => [s.rounds.length, 1] },
  { id: 'king', name: 'Consistency King', how: 'Play 4 rounds in one calendar month', p: s => [maxPerMonth(s.rounds), 4] },
  { id: 'b100', name: 'Break 100', how: 'Score under 100 for 18 holes', p: s => [s.rounds.some(r => r.holes === 18 && r.score < 100) ? 1 : 0, 1] },
  { id: 'b90', name: 'Break 90', how: 'Score under 90 for 18 holes', p: s => [s.rounds.some(r => r.holes === 18 && r.score < 90) ? 1 : 0, 1] },
  { id: 'b80', name: 'Break 80', how: 'Score under 80 for 18 holes', p: s => [s.rounds.some(r => r.holes === 18 && r.score < 80) ? 1 : 0, 1] },
  { id: 'no3', name: 'No three-putts', how: 'Finish a round with putts logged on 16+ holes and no three-putts', p: s => [s.rounds.some(r => r.pN >= 16 && r.three === 0) ? 1 : 0, 1] },
  { id: 'fairway', name: 'Fairway Finder', how: 'Hit half your fairways in a round (7 or more logged)', p: s => [s.rounds.some(r => r.fwN >= 7 && r.fw * 2 >= r.fwN) ? 1 : 0, 1] },
  { id: 'putts500', name: 'Putting Machine', how: 'Log 500 putts', p: s => [s.rounds.reduce((a, r) => a + (r.putts || 0), 0), 500] },
  { id: 'practice1', name: 'First practice', how: 'Do a drill test or tick off a practice session', p: s => [s.tests.length + s.sessions > 0 ? 1 : 0, 1] },
  { id: 'habit', name: 'Practice habit', how: 'Do 5 drill tests', p: s => [s.tests.length, 5] },
  { id: 'graduate', name: 'Drill graduate', how: 'Move up a stage in any drill', p: s => [s.stagesUp > 0 ? 1 : 0, 1] },
  { id: 'streak4', name: 'Four-week streak', how: 'Practise in 4 weeks in a row', p: s => [s.streak || 0, 4] },
  { id: 'journey', name: 'Improvement Journey', how: 'Get your handicap index 1.0 lower than when you started', p: s => [s.hcp && s.hcp.start != null && s.hcp.hi != null && s.hcp.start - s.hcp.hi >= 1 ? 1 : 0, 1] },
  { id: 'tracer', name: 'Ball flight', how: 'Trace a shot', p: s => [s.traced ? 1 : 0, 1] },
  { id: 'checks', name: 'Set up right', how: 'Use the grip check and the setup check', p: s => [(s.gripSeen ? 1 : 0) + (s.setupSeen ? 1 : 0), 2] },
];
function maxPerMonth(rounds) {
  const m = {}; for (const r of rounds) { const k = new Date(r.at).toISOString().slice(0, 7); m[k] = (m[k] || 0) + 1; }
  return Math.max(0, ...Object.values(m));
}
function norm(s) {
  s = s || {};
  return { swings: s.swings || [], rounds: s.rounds || [], tests: s.tests || [], sessions: s.sessions || 0, stagesUp: s.stagesUp || 0, streak: s.streak || 0,
    hcp: s.hcp || null, traced: !!s.traced, gripSeen: !!s.gripSeen, setupSeen: !!s.setupSeen, fixedFault: s.fixedFault || null, planDone: s.planDone || 0, planTotal: s.planTotal || 0, now: s.now || Date.now() };
}
function badges(s) {
  s = norm(s);
  return BADGES.map(b => { const [have, need] = b.p(s); return { id: b.id, name: b.name, how: b.how, have: Math.min(have, need), need, earned: have >= need }; });
}
function xp(s) {
  s = norm(s);
  const parts = { swing: s.swings.length * XP.swing, round: s.rounds.length * XP.round, test: s.tests.length * XP.test, session: s.sessions * XP.session,
    badge: badges(s).filter(b => b.earned).length * XP.badge };
  return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}
function level(total) {
  let i = 0; while (i + 1 < LEVELS.length && total >= LEVELS[i + 1][0]) i++;
  const next = LEVELS[i + 1];
  return { n: i + 1, name: LEVELS[i][1], from: LEVELS[i][0], to: next ? next[0] : null, nextName: next ? next[1] : null };
}

// ---------- this week's challenges ----------
function weekStart(t) { const d = new Date(t); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); return d.getTime() - day * DAY; }
function challenges(s) {
  s = norm(s);
  const ws = weekStart(s.now), wk = Math.floor(ws / (7 * DAY));
  const inWeek = x => x.at >= ws && x.at < ws + 7 * DAY;
  const sw = s.swings.filter(inWeek), rs = s.rounds.filter(inWeek), ts = s.tests.filter(inWeek);
  const views = new Set(s.swings.map(x => x.view));
  const all = {
    dtl: { t: 'Analyse a swing filmed down the line', p: [sw.filter(x => x.view === 'down-the-line').length, 1] },
    faceon: { t: 'Analyse a swing filmed face-on', p: [sw.filter(x => x.view === 'face-on').length, 1] },
    putts: { t: 'Log your putts on every hole of a round', p: [rs.filter(r => r.holes >= 9 && r.pN >= r.holes).length, 1] },
    fairways: { t: 'Log fairway hit or missed on every par 4 and 5 of a round', p: [rs.filter(r => r.fwN >= Math.floor(r.holes * 0.6)).length, 1] },
    plan2: { t: "Do 2 sessions from this week's practice plan", p: [s.planDone, 2] },
    drills3: { t: 'Do 3 drill tests', p: [ts.length, 3] },
    round: { t: 'Play a round of 9 holes or more', p: [rs.length, 1] },
    swing: { t: 'Analyse a swing', p: [sw.length, 1] },
  };
  const want = [];
  if (s.swings.length && !views.has('down-the-line')) want.push('dtl'); else if (s.swings.length && !views.has('face-on')) want.push('faceon');
  if (s.rounds.length && s.rounds.slice(-3).every(r => r.pN < r.holes)) want.push('putts');
  else if (s.rounds.length && s.rounds.slice(-3).every(r => r.fwN < 5)) want.push('fairways');
  if (s.planTotal) want.push('plan2');
  const rotate = ['drills3', 'round', 'swing', 'drills3', 'swing', 'round'];
  for (let i = 0; want.length < 3 && i < rotate.length; i++) { const k = rotate[(wk + i) % rotate.length]; if (!want.includes(k)) want.push(k); }
  return want.slice(0, 3).map(k => ({ k, title: all[k].t, have: Math.min(all[k].p[0], all[k].p[1]), need: all[k].p[1], done: all[k].p[0] >= all[k].p[1] }));
}

// which earned badges are new since last time; on the very first run, nothing counts as new (no burst of old badges)
function newlyEarned(earnedIds, saved) {
  if (!saved) return [];
  return earnedIds.filter(id => !saved[id]);
}

const api = { BADGES, XP, LEVELS, badges, xp, level, challenges, newlyEarned, weekStart };
if (typeof module !== 'undefined') module.exports = api; else root.Achieve = api;
})(typeof window !== 'undefined' ? window : this);
