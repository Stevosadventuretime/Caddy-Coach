// Caddy Coach: the coach's brain. Turns a snapshot of the golfer's own data (built on the phone by coachhub.js) into
// plain-English answers. Pure logic with no page code, so it runs the same in the app and in node tests.
// Rules: only say what the data shows, say what it's based on, say what's missing, and never more than 3 things.
(function (root) {
'use strict';

// ---------- what was asked ----------
const MISS_WORDS = [['slice', /slic/], ['hook', /hook/], ['push', /\bpush/], ['pull', /\bpull/], ['fat', /\bfat\b|heavy|chunk/],
  ['thin', /\bthin|skull|blade/], ['top', /\btop(ped|ping)?\b/], ['shank', /shank|socket/]];
const AREA_WORDS = [['putt', /putt/], ['arg', /chip|pitch|short game|bunker|sand|around the green/],
  ['app', /wedge|approach|iron|green(s)? in reg|\bgir\b|hitting greens/], ['tee', /driv|tee shot|off the tee|fairway/]];
function intent(text) {
  const t = String(text || '').toLowerCase();
  for (const [k, re] of MISS_WORDS) if (re.test(t)) return { k: 'miss', miss: k };
  if (/handicap|index/.test(t)) return { k: 'hcp' };
  if (/improv|getting better|progress|better than|over the last|compared|reference/.test(t)) return { k: 'improved' };
  for (const [k, re] of AREA_WORDS) if (re.test(t)) return { k: 'area', area: k };
  if (/practi[cs]e|today|work on|session|drill/.test(t)) return { k: 'practice' };
  if (/focus|weak|biggest|losing|lose|where.*shots|which part/.test(t)) return { k: 'focus' };
  return { k: 'help' };
}

const AREA = { tee: 'Driving', app: 'Approach shots', arg: 'Short game', putt: 'Putting' };
const n1 = x => Math.round(x * 10) / 10;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ans = (o) => Object.assign({ title: '', points: [], evidence: '', actions: [], missing: [] }, o);
const drillActs = ds => (ds || []).slice(0, 2).map(d => ({ type: 'drill', id: d.id, label: d.name }));
function swingBasis(s) {
  const sw = s.swings || []; if (!sw.length) return '';
  const views = [...new Set(sw.map(x => x.view === 'down-the-line' ? 'down the line' : 'face-on'))].join(' and ');
  return `Based on your last ${plural(Math.min(sw.length, 8), 'swing')} (${views}).`;
}

// ---------- why do I slice / hook / … ----------
function missAnswer(s, k) {
  const M = (s.misses || {})[k]; const name = M ? M.name : k;
  if (!M) return ans({ title: `I don't have notes on a ${name} yet`, points: ['Try "What\'s my miss?" on the Practice page.'] });
  const sw = s.swings || [];
  const found = M.links.filter(l => l.found), unseen = M.links.filter(l => !l.found && !l.checkable);
  const a = ans({ title: `Why you ${k === 'top' ? 'top' : k === 'fat' ? 'hit it fat' : k === 'thin' ? 'thin' : k} the ball` });
  if (!sw.length) {
    a.points = M.links.slice(0, 3).map(l => `${l.name}: ${l.why}`);
    a.evidence = "These are the usual causes. I haven't seen your swing yet, so I can't tell which one is yours.";
    a.missing.push('Analyse a swing and I can tell you which of these you actually do.');
    a.actions.push({ type: 'go', page: 1, label: 'Analyse a swing' });
  } else if (found.length) {
    a.points = found.slice(0, 3).map(l => `${l.name}: ${l.why}`);
    a.evidence = swingBasis(s) + ' These showed up in your measurements.';
    a.actions = drillActs(M.drills);
  } else {
    a.points = ["Your swing measurements don't show the usual body causes, so the clubface (your grip or hands) is the most likely reason."];
    a.evidence = swingBasis(s);
    a.actions = [{ type: 'go', page: 4, label: 'Check your grip' }, { type: 'go', page: 6, label: 'Trace a shot' }];
  }
  if (sw.length && unseen.length) a.missing.push(`I couldn't check ${unseen.slice(0, 2).map(l => l.name.toLowerCase()).join(' or ')} from your camera angle. Film one swing from the ${s.swings[0].view === 'face-on' ? 'side, down the line' : 'front, face-on'}.`);
  const f = s.lastFlight;
  if (f && f.matches === k) a.points.push(`Your last traced shot (${f.when}) agrees: clubface ${f.face}, path ${f.path}.`);
  a.points = a.points.slice(0, 3);
  return a;
}

// ---------- what should I practise today? ----------
function practiceAnswer(s) {
  const items = [], acts = [], P = s.practice || {}, rec = s.recurring || [], sw = s.swings || [];
  if (P.next) { items.push(`This week's plan: ${P.next.title}${P.next.why ? ` (${P.next.why.replace(/\.$/, '').toLowerCase()})` : ''}.`); acts.push({ type: 'go', page: 3, label: 'Open this week\'s plan' }); }
  const fault = rec[0] || (sw[0] && sw[0].faults && sw[0].faults[0] && { title: sw[0].faults[0].title, drills: sw[0].faults[0].drills, n: 1 });
  if (fault) {
    items.push(`${fault.title}${fault.n > 1 ? `: it's shown up in ${fault.n} of your last swings` : ': from your last swing'}. 10 minutes of the drill, then half swings with that feel.`);
    acts.push(...drillActs(fault.drills).slice(0, 1));
  }
  const fz = focusPick(s);
  if (fz && fz.kind === 'area' && items.length < 3) items.push(`On the course you're losing most in ${AREA[fz.area].toLowerCase()}. ${fz.tip}`);
  if (P.focus && items.length < 3) items.push(`Your two-week focus: ${P.focus}.`);
  const a = ans({ title: 'What to practise today' });
  if (!items.length) {
    const lvl = (s.golfer || {}).level;
    if (lvl === 'new') { a.points = ['Start with the grip and setup: they decide most of what happens after.', 'Then try one drill from the Practice page.']; a.actions = [{ type: 'go', page: 4, label: 'Grip check' }, { type: 'go', page: 5, label: 'Setup check' }]; }
    else { a.points = ['I need a little more to go on.']; a.actions = [{ type: 'go', page: 1, label: 'Analyse a swing' }]; }
    a.missing.push('Analyse a swing or record a round, and I can tailor this to you.');
    return a;
  }
  a.points = items.slice(0, 3); a.actions = acts.slice(0, 3);
  a.evidence = [P.next ? "This week's plan" : '', rec.length ? 'faults that keep coming back in your swings' : sw.length ? 'your last swing' : '', s.rounds && s.rounds.n ? `${plural(s.rounds.n, 'round')}` : ''].filter(Boolean).join(', ');
  a.evidence = a.evidence ? 'Based on ' + a.evidence + '.' : '';
  return a;
}

// ---------- has my swing improved? ----------
function improvedAnswer(s) {
  const T = s.trend; const a = ans({ title: 'Is your swing improving?' });
  if (!T || T.n < 2) {
    a.points = [`I need at least two swings filmed from the same angle to compare. You have ${plural((s.swings || []).length, 'swing')} so far.`];
    a.actions = [{ type: 'go', page: 1, label: 'Analyse a swing' }];
    a.missing.push('Film from the same angle each time so the numbers compare like for like.');
    return a;
  }
  const d = n1(T.last - T.first), word = d >= 0.5 ? 'up' : d <= -0.5 ? 'down' : 'about the same';
  a.points.push(`Your swing score is ${word}: ${T.first} → ${T.last} over ${plural(T.n, 'swing')} (${T.from} to ${T.to}).`);
  if (s.reference) a.points.push(s.reference.text);
  if (T.better && T.better.length) a.points.push(`Better: ${T.better.slice(0, 3).join(', ')}.`);
  if (T.worse && T.worse.length) a.points.push(`Slipped: ${T.worse.slice(0, 3).join(', ')}.`);
  if (!(T.better && T.better.length) && !(T.worse && T.worse.length)) a.points.push("No single position has changed by more than the tracking can tell apart, so it's the same swing, just a different day.");
  a.evidence = `Based on your ${T.view === 'down-the-line' ? 'down-the-line' : 'face-on'} swings${T.window ? ` in the last ${T.window} days` : ''}. Small changes can be tracking wobble, so look at the trend.`;
  if (!s.reference) a.actions.push({ type: 'ref', label: 'Make my latest swing my reference' });
  a.points = a.points.slice(0, 3);
  return a;
}

// ---------- where am I losing shots? ----------
function focusPick(s) {
  const R = s.rounds || {};
  if (R.sg && R.sg.full >= 9) {
    const ks = ['tee', 'app', 'arg', 'putt'].filter(k => R.sg[k] != null);
    if (ks.length) { const k = ks.sort((a, b) => R.sg[a] - R.sg[b])[0]; return { kind: 'area', area: k, how: 'sg', tip: AREA_TIP[k] }; }
  }
  const st = R.stats;
  if (st) {
    const c = [];
    if (st.puttsPer18 != null && st.puttsPer18 > 34) c.push(['putt', st.puttsPer18 - 34]);
    if (st.girPct != null && st.girPct < 25) c.push(['app', (25 - st.girPct) / 5]);
    if (st.fwPct != null && st.fwPct < 40) c.push(['tee', (40 - st.fwPct) / 8]);
    if (st.udPct != null && st.udPct < 20) c.push(['arg', (20 - st.udPct) / 6]);
    if (c.length) { c.sort((a, b) => b[1] - a[1]); return { kind: 'area', area: c[0][0], how: 'stats', tip: AREA_TIP[c[0][0]] }; }
  }
  return null;
}
const AREA_TIP = {
  tee: 'Pick the club you hit straightest off the tee on tight holes, and work on starting the ball on line.',
  app: 'Aim for the middle of the green, take one more club than you think, and practise solid contact.',
  arg: 'Get the ball on the green first time: a simple chip with a putting stroke beats a fancy shot.',
  putt: 'Lag putts to finish inside a club length, and practise 3–6 footers every session.',
};
function areaLine(s, k) {
  const R = s.rounds || {}, st = R.stats || {}, sg = R.sg || {}, out = [];
  if (sg[k] != null && sg.full >= 9) out.push(`Strokes gained: ${sg[k] > 0 ? '+' : ''}${n1(sg[k])} per round against a tour player (everyone loses shots here; it's the gap between areas that matters).`);
  if (k === 'tee' && st.fwPct != null) out.push(`Fairways hit: ${st.fwPct}%${st.missSide ? `, most misses go ${st.missSide}` : ''}.`);
  if (k === 'app' && st.girPct != null) out.push(`Greens in regulation: ${st.girPct}%.`);
  if (k === 'arg' && st.udPct != null) out.push(`Up and downs: ${st.udPct}%${st.sandPct != null ? `, sand saves ${st.sandPct}%` : ''}.`);
  if (k === 'putt' && st.puttsPer18 != null) out.push(`Putts: ${st.puttsPer18} per 18 holes${st.threePutts ? `, ${plural(st.threePutts, 'three-putt')}` : ''}.`);
  return out;
}
const RECORD_TIP = { tee: 'fairway hit or missed', app: 'putts (so I can tell greens hit)', arg: 'putts and bunker shots', putt: 'putts on each hole' };
function areaAnswer(s, k) {
  const R = s.rounds || {}, a = ans({ title: AREA[k] });
  const lines = areaLine(s, k);
  if (!R.n || !lines.length) {
    a.points = [`I haven't got ${AREA[k].toLowerCase()} data from your rounds yet.`, AREA_TIP[k]];
    a.missing.push(`During a round, tap in your ${RECORD_TIP[k]} as well as your score, and I'll show where the shots go.`);
    a.actions = [{ type: 'go', page: 8, label: 'Play a round' }];
    return a;
  }
  a.points = lines.slice(0, 2);
  const fz = focusPick(s);
  a.points.push(fz && fz.area === k ? `This is where you lose the most shots right now. ${AREA_TIP[k]}` : AREA_TIP[k]);
  a.evidence = `Based on your last ${plural(R.n, 'round')}${R.sg && R.sg.full ? ` (${plural(R.sg.full, 'hole')} with shot detail)` : ''}.`;
  return a;
}
function focusAnswer(s) {
  const a = ans({ title: 'Where to focus' }), fz = focusPick(s), rec = s.recurring || [], sw = s.swings || [];
  if (fz) { a.points.push(`On the course: ${AREA[fz.area].toLowerCase()}. ${areaLine(s, fz.area)[0] || ''}`.trim()); a.points.push(fz.tip); }
  const fault = rec[0] || (sw[0] && sw[0].faults && sw[0].faults[0]);
  if (fault) { a.points.push(`In your swing: ${fault.title.charAt(0).toLowerCase() + fault.title.slice(1)}.`); a.actions.push(...drillActs(fault.drills).slice(0, 1)); }
  if (!a.points.length) {
    a.points = ["I can't see enough yet to say where you're losing shots."];
    a.missing.push('Record a round (with putts and fairways) and analyse a swing, and I can tell you exactly where to focus.');
    a.actions = [{ type: 'go', page: 8, label: 'Play a round' }, { type: 'go', page: 1, label: 'Analyse a swing' }];
    return a;
  }
  if (!fz) a.missing.push("I haven't got enough round data to compare driving, approach, short game and putting. Record fairways and putts in your next round.");
  if (fz) a.actions.push({ type: 'ask', q: `How is my ${{ tee: 'driving', app: 'approach play', arg: 'short game', putt: 'putting' }[fz.area]}?`, label: `More on ${AREA[fz.area].toLowerCase()}` });
  a.evidence = [s.rounds && s.rounds.n ? plural(s.rounds.n, 'round') : '', sw.length ? plural(Math.min(sw.length, 8), 'swing') : ''].filter(Boolean).join(' and ');
  a.evidence = a.evidence ? `Based on your last ${a.evidence}.` : '';
  a.points = a.points.slice(0, 3);
  return a;
}

// ---------- handicap ----------
function hcpAnswer(s) {
  const H = s.hcp, a = ans({ title: 'Your handicap' });
  if (!H || H.hi == null) {
    a.points = ["You haven't set a handicap in Caddy Coach yet."];
    a.missing.push("Add your handicap index (or say you don't have one) and I'll track it as you post scores.");
    a.actions = [{ type: 'go', page: 0, label: 'Set it on Home' }];
    return a;
  }
  a.points.push(`Your handicap index is ${H.hi}.`);
  if (H.start != null && H.start !== H.hi) a.points.push(`${H.hi < H.start ? 'Down' : 'Up'} ${n1(Math.abs(H.hi - H.start))} from ${H.start} when you started.`);
  const g = (s.goals || []).find(x => x.type === 'hcp');
  if (g) a.points.push(H.hi <= g.target ? `You've hit your goal of under ${g.target}. Time for a new one.` : `${n1(H.hi - g.target)} to go to reach your goal of ${g.target}.`);
  a.evidence = `Based on ${plural(H.scores || 0, 'score')} in Caddy Coach. Official handicaps in England are kept by England Golf (MyEG).`;
  return a;
}

function helpAnswer() {
  return ans({ title: 'I can help with', points: ['Why you hit a certain miss (slice, hook, fat, thin…)', 'What to practise today, and where you lose shots', 'Whether your swing is improving'], actions: CHIPS.slice(0, 3).map(q => ({ type: 'ask', q, label: q })) });
}

function answer(text, s) {
  s = s || {};
  const it = intent(text);
  const a = it.k === 'miss' ? missAnswer(s, it.miss) : it.k === 'practice' ? practiceAnswer(s) : it.k === 'improved' ? improvedAnswer(s)
    : it.k === 'area' ? areaAnswer(s, it.area) : it.k === 'focus' ? focusAnswer(s) : it.k === 'hcp' ? hcpAnswer(s) : helpAnswer();
  a.intent = it.k; a.points = a.points.filter(Boolean).slice(0, 3);
  return a;
}

// ---------- your top 3, and what the coach knows ----------
function top3(s) {
  s = s || {}; const out = [], seen = new Set();
  for (const r of (s.recurring || [])) { if (out.length >= 2) break; seen.add(r.id); out.push({ title: r.title, why: `In ${r.n} of your last swings`, drill: (r.drills || [])[0] || null }); }
  const fz = focusPick(s);
  if (fz && out.length < 3) out.push({ title: `${AREA[fz.area]} on the course`, why: fz.how === 'sg' ? 'Where your rounds lose the most shots' : 'Your weakest round stat', ask: `How is my ${{ tee: 'driving', app: 'approach play', arg: 'short game', putt: 'putting' }[fz.area]}?` });
  const last = (s.swings || [])[0];
  if (last && last.faults) for (const f of last.faults) { if (out.length >= 3) break; if (seen.has(f.id)) continue; seen.add(f.id); out.push({ title: f.title, why: 'From your last swing', drill: (f.drills || [])[0] || null }); }
  return out.slice(0, 3);
}
const LEVEL = { new: 'New to golf', casual: 'Plays now and then', regular: 'Regular golfer', low: 'Single-figure golfer' };
const GOAL = { learn: 'learn the basics', hit: 'hit it better', scores: 'lower scores', handicap: 'get or lower a handicap' };
function knows(s) {
  s = s || {}; const g = s.golfer || {}, R = s.rounds || {}, P = s.practice || {};
  return [
    { k: 'you', t: 'You', v: g.level ? `${LEVEL[g.level]}${g.goal ? `, wants to ${GOAL[g.goal]}` : ''}, ${g.hand === 'left' ? 'left' : 'right'}-handed` : `${g.hand === 'left' ? 'Left' : 'Right'}-handed (tell me your level and goal)`, act: 'golfer' },
    { k: 'hcp', t: 'Handicap', v: s.hcp && s.hcp.hi != null ? String(s.hcp.hi) : 'Not set', act: 0 },
    { k: 'swings', t: 'Swings analysed', v: (s.swings || []).length ? `${s.swingCount || s.swings.length}` : 'None yet', act: 1 },
    { k: 'faults', t: 'Keeps coming back', v: (s.recurring || []).length ? s.recurring.slice(0, 2).map(r => r.title).join('; ') : 'Nothing yet', act: 2 },
    { k: 'rounds', t: 'Rounds recorded', v: R.n ? `${R.n}${R.avg != null ? `, average ${R.avg}` : ''}` : 'None yet', act: 8 },
    { k: 'bag', t: 'Club distances', v: s.bagN ? `${plural(s.bagN, 'club')} set` : 'Not set', act: 9 },
    { k: 'practice', t: 'Practice', v: P.total ? `${P.done} of ${P.total} sessions this week${P.streak ? `, ${P.streak}-week streak` : ''}` : 'No plan yet', act: 3 },
  ];
}

const CHIPS = ['What should I practise today?', 'Which part of my game should I focus on?', 'Has my swing improved?', 'Why am I slicing?', 'How is my putting?', "What's my handicap doing?"];
const api = { intent, answer, top3, knows, CHIPS, focusPick };
if (typeof module !== 'undefined') module.exports = api; else root.CoachBrain = api;
})(typeof window !== 'undefined' ? window : this);
