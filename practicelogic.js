// Caddy Coach: the practice builder's rules (pure, tested in tools/test_practice.js).
// build() turns the golfer's My Golf Brain focus, the time they have and where they are into a session:
// warm up → main work on focus #1 → focus #2 → a game that copies the course. Swing faults use the drill library
// (drills.js); short game, putting and course games use the simple standard practice games below.
// Text never says left or right, so it reads the same for left-handed golfers.
(function (root) {
'use strict';
const MINS = [10, 20, 30, 45, 60];
const PLACES = {
  range: { label: 'Driving range', short: 'Range', hits: true },
  sim: { label: 'Indoor simulator', short: 'Simulator', hits: true },
  short: { label: 'Short-game area', short: 'Short game', hits: false },
  green: { label: 'Putting green', short: 'Putting green', hits: false },
  home: { label: 'At home', short: 'Home', hits: false },
};
const AREA_NAME = { tee: 'Driving', app: 'Approach play', arg: 'Chipping and pitching', putt: 'Putting' };

// a drill from the library suits a place if it's made for it (and doesn't need sunshine indoors)
function drillFits(d, place) {
  if (!d) return false;
  if (place === 'home') return d.where === 'home' || d.where === 'both';
  if (place === 'range') return d.where === 'range' || d.where === 'both';
  if (place === 'sim') return (d.where === 'range' || d.where === 'both') && !/sun/i.test(d.kit || '');
  return false;
}

// games for each area, by place. measure: what to count; of: out of how many
const AREA = {
  tee: {
    range: { title: 'Fairway finder', steps: ['Pick two targets about 30 yards apart. That\'s your fairway.', 'Hit 10 drivers, with your full pre-shot routine every time.', 'Count how many finish between the targets.'], measure: 'Drives in the fairway', of: 10 },
    sim: { title: 'Fairway finder on the sim', steps: ['Set the sim to its range or a wide, straight hole.', 'Hit 10 drivers, with your full pre-shot routine every time.', 'Count how many finish within 15 yards of the centre line.'], measure: 'Drives within 15 yards of the centre line', of: 10 },
  },
  app: {
    range: { title: 'Three-flag ladder', steps: ['Pick three flags at different distances.', 'Hit 3 balls at each, changing club every ball.', 'Count the balls that would have finished on the green.'], measure: 'Balls on the green', of: 9 },
    sim: { title: 'Know your carries', steps: ['Hit 5 balls each with three irons, full routine every time.', 'Note the average carry the sim shows for each club.', 'Count the shots within 10 yards of that club\'s average.'], measure: 'Shots within 10 yards of your average carry', of: 15 },
  },
  arg: {
    short: { title: 'Up-and-down game', steps: ['Drop 9 balls round the green, all in different lies.', 'Chip or pitch each one, then putt it out.', 'Count how many you get down in two.'], measure: 'Up and downs', of: 9 },
    sim: { title: 'Landing-spot chips', steps: ['Use the sim\'s short-game mode, or a chipping target on the mat.', 'Pick a landing spot about 15 yards away.', 'Hit 10 chips and count the ones that land within 2 yards of it.'], measure: 'Chips landing within 2 yards', of: 10 },
    home: { title: 'Chip into a basket', steps: ['Use a soft practice ball, never a real one indoors.', 'Put a laundry basket 3 to 5 paces away.', 'Chip 10 and count how many land in it.'], measure: 'Chips in the basket', of: 10 },
  },
  putt: {
    green: { title: 'Putting ladder', steps: ['Push tees in at 3, 6 and 9 feet from a hole, in a straight line.', 'Putt 3 balls from each tee.', 'Count how many you hole.'], measure: 'Putts holed', of: 9 },
    home: { title: 'Coin gate', steps: ['Make a gate with two coins, just wider than a ball, 6 feet away.', 'Roll 10 putts through it with a smooth, even stroke.', 'Count the ones that go through cleanly.'], measure: 'Putts through the gate', of: 10 },
  },
};
const WARM = {
  range: ['A few gentle turns and practice swings to loosen up.', 'Hit 10 balls with a wedge, building slowly to full speed.'],
  sim: ['A few gentle turns and practice swings to loosen up.', 'Hit 10 balls with a wedge, building slowly to full speed. Ignore the numbers for now.'],
  short: ['Hit 10 easy chips with one club from a good lie.', 'Then a few from the rough to feel the different lies.'],
  green: ['Roll 10 long putts across the green to get the pace.', 'Then 10 short ones from 3 feet to see the ball go in.'],
  home: ['Gentle shoulder turns and hip turns with a club across your chest.', 'A few slow practice swings, without a ball.'],
};
const PLAY = {
  range: { title: '9 holes on the range', steps: ['Picture a course you know and play its first 9 holes.', 'Tee shot, then the club you\'d need for the approach. New target every ball.', 'Full routine every shot, and keep today\'s cue in mind.'], measure: 'Shots you\'d be happy with on the course', of: 18 },
  sim: { title: 'Play holes on the sim', steps: ['Pick a course on the sim and play a few holes.', 'Full pre-shot routine every shot. No mulligans.', 'Keep today\'s cue in mind, then write down your score.'], measure: 'Score against par (e.g. 2 for +2)', of: null },
  short: { title: 'Par 18', steps: ['9 balls from 9 different spots round the green.', 'Each one is a par 2: chip, then one putt.', 'Count your total shots.'], measure: 'Total shots (par is 18)', of: null },
  green: { title: 'Pressure finish', steps: ['Put a ball 3 feet from the hole.', 'Hole 5 in a row. If you miss, start again.', 'Count how many tries it took.'], measure: 'Tries to hole 5 in a row', of: null },
  home: { title: 'Mirror rehearsals', steps: ['Stand side-on to a mirror or a dark window.', '10 slow rehearsal swings with today\'s cue.', 'Count the ones that look and feel spot on.'], measure: 'Rehearsals that felt spot on', of: 10 },
};

function split(m) {
  const warm = m <= 10 ? 2 : m <= 30 ? 5 : m <= 45 ? 7 : 8;
  const play = m <= 10 ? 2 : m <= 20 ? 4 : m <= 30 ? 6 : m <= 45 ? 9 : 12;
  return { warm, main: m - warm - play, play };
}

// one piece of work for a focus item at this place, or null if it can't be done there
function workFor(p, place, drills, level, used) {
  if (!p) return null;
  if (p.kind === 'area') {
    const g = AREA[p.area] && AREA[p.area][place]; if (!g) return null;
    return { kind: 'area', area: p.area, focus: p.title, title: g.title, steps: g.steps, measure: g.measure, of: g.of };
  }
  const lib = drills || [];
  const want = p.drill && p.drill.id ? lib.find(d => d.id === p.drill.id) : null;
  const pick = (want && drillFits(want, place) && !used.has(want.id) && want)
    || lib.filter(d => (d.fixes || []).includes(p.id) && drillFits(d, place) && !used.has(d.id) && (d.level || 1) <= (level || 2) + 1)
      .sort((a, b) => (a.level || 1) - (b.level || 1))[0];
  if (!pick) return null;
  used.add(pick.id);
  return { kind: 'drill', drill: pick.id, focus: p.title, title: pick.name, steps: [pick.dose || pick.rx].filter(Boolean), cue: pick.cue || '', kit: pick.kit || '',
    measure: pick.test ? pick.test.q : null, of: pick.test ? pick.test.of : null, pass: pick.test ? pick.test.pass : null };
}

// fallbacks when the golfer has no focus that fits this place yet
const BASIC = { range: ['tempo', 'holdfinish', 'station'], sim: ['tempo', 'station', 'feettogether'], home: ['hinge', 'helicopter', 'tempo'] };

// opts: { minutes, place, focus: [brain focus items], drills: DRILL_LIBRARY, level: 1-3 }
function build(opts) {
  opts = opts || {};
  const m = MINS.includes(+opts.minutes) ? +opts.minutes : 20, place = PLACES[opts.place] ? opts.place : 'range';
  const level = opts.level || 2, used = new Set(), notes = [];
  const focus = (opts.focus || []).filter(p => p && p.status !== 'done');
  const work = [];
  for (const p of focus) {
    if (work.length >= 2) break;
    const w = workFor(p, place, opts.drills, level, used);
    if (w) work.push(w);
    else notes.push(p.kind === 'area'
      ? `${AREA_NAME[p.area] || p.title} is one of your focuses, but it needs ${p.area === 'putt' ? 'a putting green (or a carpet at home)' : p.area === 'arg' ? 'a short-game area' : 'somewhere to hit full shots'}, so it isn't in this session.`
      : `"${p.title}" needs ${place === 'short' || place === 'green' ? 'room for full swings' : 'a different setting'}, so it isn't in this session.`);
  }
  if (!work.length) {
    // nothing from the focus fits: sensible basics for the place
    if (AREA.arg[place] && (place === 'short')) work.push(workFor({ kind: 'area', area: 'arg', title: 'Short game' }, place, opts.drills, level, used));
    else if (place === 'green') work.push(workFor({ kind: 'area', area: 'putt', title: 'Putting' }, place, opts.drills, level, used));
    else for (const id of BASIC[place] || []) { const d = (opts.drills || []).find(x => x.id === id); const w = d && workFor({ kind: 'fault', id: '_', title: 'The basics', drill: { id } }, place, opts.drills, level, used); if (w) { work.push(w); break; } }
    if (!focus.length) notes.push('Analyse a swing or record a round and your sessions will be built round your own game.');
  }
  // a second block at short-game and putting places when there's time: the other half of the short game
  if (work.length === 1 && m >= 20 && (place === 'short' || place === 'green' || place === 'home')) {
    const other = place === 'short' ? null : place === 'green' ? null : (work[0].area === 'putt' ? AREA.arg.home : AREA.putt.home);
    if (other) work.push({ kind: 'area', area: work[0].area === 'putt' ? 'arg' : 'putt', focus: 'All-round short game', title: other.title, steps: other.steps, measure: other.measure, of: other.of });
  }
  const t = split(m);
  const blocks = [{ kind: 'warm', title: 'Warm up', mins: t.warm, steps: WARM[place] }];
  if (work.length >= 2 && t.main >= 10) {
    const a = Math.round(t.main * 0.6);
    blocks.push(Object.assign({ mins: a }, work[0]), Object.assign({ mins: t.main - a }, work[1]));
  } else if (work.length) blocks.push(Object.assign({ mins: t.main }, work[0]));
  const pl = PLAY[place];
  blocks.push({ kind: 'play', title: pl.title, mins: t.play, steps: pl.steps, measure: pl.measure, of: pl.of });
  return { minutes: m, place, placeLabel: PLACES[place].label, title: `${m}-minute ${PLACES[place].short.toLowerCase()} session`, blocks, notes };
}

// the improvement timeline: what the coach advised, what got sorted, rounds and practice, newest first
function journey(history, sessions, limit) {
  const out = [];
  for (const h of history || []) {
    if (!h || !h.at || h.source === 'coach') continue;
    const type = /^Sorted:/.test(h.text) ? 'sorted' : h.source === 'round' ? 'round' : h.source === 'plan' ? 'practice' : 'swing';
    out.push({ at: h.at, type, text: h.text });
  }
  for (const s of sessions || []) {
    if (!s || !s.at) continue;
    const scored = (s.blocks || []).filter(b => b.score != null);
    out.push({ at: s.at, type: 'practice', text: `${s.title || 'Practice session'}${scored.length ? `: ${scored.map(b => `${b.title} ${b.score}${b.of ? '/' + b.of : ''}`).join(', ')}` : ''}` });
  }
  out.sort((a, b) => b.at - a.at);
  // the same practice logged twice (history and sessions) shows once
  const seen = new Set();
  return out.filter(e => { const k = e.type + Math.round(e.at / 6e4); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, limit || 40);
}

const api = { MINS, PLACES, AREA_NAME, build, journey, drillFits, split };
if (typeof module !== 'undefined') module.exports = api; else root.PracticeLogic = api;
})(typeof window !== 'undefined' ? window : this);
