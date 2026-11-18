// Caddy Coach: the AI swing coach, progress tracker and after-analysis practice plan.
// Builds on app-1.js (swing results), app-2.js (SB), app-3.js (Auth, planGet) and metrics.js (SwingMetrics).
// The AI coach runs in the cc-coach server function; the video never leaves the phone, only the measured numbers.
(function () {
'use strict';
const has = n => typeof window[n] === 'function';

// ---------- swing history helpers ----------
async function sameView(view, n) {
  try {
    const idx = await Store.list();
    return (idx || []).filter(e => e && e.view === view).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, n);
  } catch (_) { return []; }
}
// faults that showed up in at least two of the last five swings from this camera angle
async function recurringFaults(view) {
  const rows = await sameView(view, 5), tally = new Map();
  for (const e of rows) {
    const d = await Store.detail(e.id).catch(() => null); if (!d || !d.metrics) continue;
    const F = SwingMetrics.faults(swingChecks(d.metrics), d.metrics.miss);
    for (const f of F.slice(0, 3)) { const t = plainAdvice(f).title; tally.set(f.id, { id: f.id, title: t, n: ((tally.get(f.id) || {}).n || 0) + 1 }); }
  }
  return [...tally.values()].filter(x => x.n >= 2).sort((a, b) => b.n - a.n);
}

// ---------- AI coach ----------
const COACH = { thread: [], left: null, off: false };
async function coachPayload(R) {
  const m = R.metrics, C = swingChecks(m), F = SwingMetrics.faults(C, m.miss);
  const ids = [...new Set(F.map(f => f.id).concat(C.filter(c => c.score < 8.5).map(c => c.id)))].slice(0, 8);
  const drills = []; ids.forEach(id => drillsForCheck(id).slice(0, 3).forEach(d => { if (!drills.some(x => x.id === d.id)) drills.push({ id: d.id, name: d.name, fixes: id }); }));
  const hist = (await sameView(m.view, 7)).filter(e => !RES.savedId || e.id !== RES.savedId).slice(0, 6)
    .map(e => ({ date: String(e.createdAt).slice(0, 10), view: e.view, overall: e.overall, fixing: e.top_priority || '' }));
  const rec = (await recurringFaults(m.view)).map(r => r.title);
  return {
    view: m.view, handed: m.handed, club: m.club || '', miss: m.miss && SwingMetrics.MISSES[m.miss] ? SwingMetrics.MISSES[m.miss].name : '',
    overall: R.scores.overall, areas: AREAS,
    checks: C.map(c => ({ id: c.id, check: c.name, plain: plainName(c), state: plainState(c), phase: c.phase, you: c.shown, tour: c.target, score: c.score, verdict: c.verdict, basis: c.basis })),
    faults: F.map(f => ({ id: f.id, title: plainAdvice(f).title, why_miss: f.missWhy || '' })),
    drills, history: hist, recurring: rec,
  };
}
async function callCoach(body) {
  if (typeof SB === 'undefined') return { error: 'offline' };
  const tok = typeof Auth !== 'undefined' && Auth.fresh ? await Auth.fresh().catch(() => null) : null;
  const h = { apikey: SB.key, Authorization: 'Bearer ' + SB.key, 'Content-Type': 'application/json' };
  if (tok) h['x-cc-user'] = tok;
  try {
    const r = await fetch(`${SB.url}/functions/v1/cc-coach`, { method: 'POST', headers: h, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 503) COACH.off = true;
    return r.ok ? j : Object.assign({ error: 'failed' }, j, { status: r.status });
  } catch (_) { return { error: 'offline' }; }
}
// inside Claude the old route still works; on the phone app the server coach is used, and if it can't answer
// (no key set yet, offline, daily allowance used) the built-in coaching stays, so nothing ever breaks
if (has('coachText')) {
  const inClaude = window.coachText;
  window.coachText = async function (R) {
    if (window.claude && claude.use) return inClaude(R);
    COACH.thread = [];
    const j = await callCoach({ mode: 'analysis', swing: await coachPayload(R) });
    if (!j || !j.ok || !j.coach || !Array.isArray(j.coach.categories)) { RES.coachErr = j && j.error; return null; }
    COACH.left = j.left;
    return Object.assign({ ai: true }, j.coach);
  };
}

const drillName = id => { const d = (typeof DRILLS !== 'undefined' ? DRILLS : []).find(x => x.id === id); return d ? d.name : null; };
function coachCardHTML(t) {
  if (!t || !t.ai || !Array.isArray(t.fixes) || !t.fixes.length) {
    if (RES && RES.coachErr === 'limit') return `<div class="card aiCoach"><h2>Your coach</h2><p class="mut" style="margin:0">You've used today's free coaching notes, so these are the built-in ones. ${Auth && Auth.s ? '' : 'Signed-in golfers get more each day. '}More tomorrow.</p></div>`;
    return '';
  }
  const fx = t.fixes.slice(0, 3).map((f, i) => {
    const ds = (f.drill_ids || []).map(id => ({ id, n: drillName(id) })).filter(d => d.n);
    return `<article class="aiFix"><div class="aiN">${i + 1}</div><div><h3>${esc(f.title)}</h3>
    <p><b>What you're doing:</b> ${esc(f.what_you_do)}</p><p><b>Why it happens:</b> ${esc(f.cause)}</p><p><b>What it does to the ball:</b> ${esc(f.ball_effect)}</p>
    ${ds.length ? `<div class="chips">${ds.map(d => `<button type="button" class="chip" data-drill="${esc(d.id)}">${esc(d.n)}</button>`).join('')}</div>` : ''}
    <p class="aiRoutine"><b>30-minute session:</b> ${esc(f.routine)}</p></div></article>`;
  }).join('');
  return `<div class="card aiCoach"><div class="aiHd"><h2>Your coach</h2><span class="bTag read">Coach's read</span></div>
  ${t.progress_note ? `<p class="aiProg">${esc(t.progress_note)}</p>` : ''}${fx}
  <div class="aiChat"><b>Ask your coach</b><div class="aiThread" id="aiThread">${COACH.thread.map(m => `<p class="aiMsg ${m.who}">${esc(m.text)}</p>`).join('')}</div>
  <form class="aiAsk" id="aiAsk"><input id="aiQ" maxlength="400" placeholder="e.g. Why does this cause my slice?" autocomplete="off" aria-label="Ask your coach about this swing"><button type="submit" class="btn sm">Ask</button></form>
  <p class="mut aiNote">Answers come from this swing's measurements only. AI coaching can be wrong, so trust what you feel on the range too.</p></div></div>`;
}
function wireChat(root) {
  const f = root.querySelector('#aiAsk'); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault(); const inp = f.querySelector('#aiQ'), q = inp.value.trim(); if (!q) return;
    const th = root.querySelector('#aiThread'), b = f.querySelector('button');
    COACH.thread.push({ who: 'me', text: q }); inp.value = ''; b.disabled = true;
    th.insertAdjacentHTML('beforeend', `<p class="aiMsg me">${esc(q)}</p><p class="aiMsg coach wait">Thinking…</p>`);
    const j = await callCoach({ mode: 'chat', question: q, thread: COACH.thread.slice(0, -1), swing: await coachPayload(RES.R) });
    const ans = j && j.ok && j.coach && j.coach.answer ? j.coach.answer
      : j && j.error === 'limit' ? "That's today's free questions used. Ask again tomorrow."
      : "Sorry, I couldn't answer that just now. Try again in a minute.";
    if (j && j.ok) COACH.thread.push({ who: 'coach', text: ans }); else COACH.thread.pop();
    const w = th.querySelector('.wait'); if (w) { w.classList.remove('wait'); w.textContent = ans; }
    b.disabled = false;
  };
}

// ---------- practice plan for the top fault ----------
function planCardHTML(R, t) {
  const m = R.metrics, F = SwingMetrics.faults(swingChecks(m), m.miss), top = F[0]; if (!top) return '';
  const a = plainAdvice(top), d = drillsForCheck(top.id)[0];
  const ai = t && t.ai && t.fixes && t.fixes.find(f => f.check_id === top.id);
  return `<div class="card planCard"><h2>Your practice plan</h2><p class="mut" style="margin:0 0 10px">For your number 1 fix: <b>${esc(a.title)}</b>. About 30 minutes, three times before you film again.</p>
  ${ai ? `<p>${esc(ai.routine)}</p>` : `<ol class="planSteps">
   <li><b>10 minutes: ${d ? esc(d.name) : 'the drill'}.</b> ${d ? `<button type="button" class="link" data-drill="${esc(d.id)}">See how</button>` : ''} Slow, no ball if you like. Get the feel right.</li>
   <li><b>10 minutes: half swings.</b> Hip-high to hip-high with a mid iron. ${a.feel ? esc(a.feel) : ''}</li>
   <li><b>10 minutes: full swings.</b> One swing thought only${a.cue ? `: “${esc(a.cue)}”` : ''}. Every fifth ball, film it.</li></ol>`}
  <p class="mut" style="margin:8px 0 0">It's in this week's practice plan too. When this fault stops showing up, your next analysis moves you on to fix 2.</p></div>`;
}

// ---------- results: add the coach and the plan ----------
if (has('renderLive')) {
  const base = window.renderLive;
  window.renderLive = function () {
    base.apply(this, arguments);
    const res = $('results'); if (!res || !RES || !RES.R) return;
    const fl = res.querySelector('.fixList');
    const html = coachCardHTML(RES.text) + planCardHTML(RES.R, RES.text);
    if (html) { const w = document.createElement('div'); w.innerHTML = html; (fl ? fl.after(...w.childNodes) : res.prepend(...w.childNodes)); }
    wireChat(res); if (has('wireFixes')) res.querySelectorAll('.aiCoach,.planCard').forEach(n => wireFixes(n));
  };
}
// a new analysis puts its top fault into the weekly plan straight away
if (has('saveAnalysis')) {
  const base = window.saveAnalysis;
  window.saveAnalysis = async function () {
    const r = await base.apply(this, arguments);
    try { if (has('planGet')) await planGet(true); } catch (_) {}
    return r;
  };
}

// ---------- progress tracker ----------
function spark(vals) {
  const W = 300, H = 70, n = vals.length, lo = Math.min(...vals, 4), hi = Math.max(...vals, 8);
  const x = i => n === 1 ? W / 2 : 8 + i * (W - 16) / (n - 1), y = v => H - 8 - (v - lo) / ((hi - lo) || 1) * (H - 16);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="pgSpark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Swing score over your last ${n} swings, from ${vals[0]} to ${vals[n - 1]}">
  <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  ${vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i === n - 1 ? 4.5 : 3}" fill="currentColor"/>`).join('')}</svg>`;
}
async function progressCardHTML(view) {
  const rows = (await sameView(view, 12)).reverse(); if (rows.length < 2) return '';
  const vals = rows.map(r => +r.overall).filter(v => !isNaN(v)); if (vals.length < 2) return '';
  const first = await Store.detail(rows[0].id).catch(() => null), last = await Store.detail(rows[rows.length - 1].id).catch(() => null);
  let moved = '';
  if (first && last && first.metrics && last.metrics) {
    const P = SwingMetrics.progress(last.metrics, first.metrics, view);
    if (P) {
      const li = o => `<li><b>${esc(plainName({ id: o.id, name: o.name }))}</b>: ${esc(o.from)} → ${esc(o.to)}</li>`;
      moved = (P.better.length ? `<p><b class="g-good">Better since your first swing</b></p><ul>${P.better.slice(0, 3).map(li).join('')}</ul>` : '')
        + (P.worse.length ? `<p><b class="g-bad">Worse since your first swing</b></p><ul>${P.worse.slice(0, 3).map(li).join('')}</ul>` : '');
    }
  }
  const rec = await recurringFaults(view);
  let done = '';
  try { if (has('planGet')) { const p = await planGet(); done = `<p class="mut" style="margin:6px 0 0">This week's practice: ${planDoneN(p)} of ${p.sessions.length} sessions done.</p>`; } } catch (_) {}
  const d = vals[vals.length - 1] - vals[0], word = d >= 0.5 ? 'going up' : d <= -0.5 ? 'going down' : 'holding steady';
  return `<div class="card pgCard"><h2>Your progress</h2><p class="mut" style="margin:0">Your last ${vals.length} swings filmed ${view === 'face-on' ? 'facing you' : 'down the line'}: score ${word} (${vals[0]} → ${vals[vals.length - 1]}).</p>
  ${spark(vals)}
  ${rec.length ? `<p><b>Keeps coming back</b></p><ul>${rec.map(r => `<li>${esc(r.title)} <span class="mut">(in ${r.n} of your last 5)</span></li>`).join('')}</ul>` : ''}
  ${moved}${done}
  <p class="mut" style="margin:8px 0 0;font-size:12.5px">The score is a guide from this app's checks, not a lab measurement. Small changes can just be tracking wobble, so look at the trend.</p></div>`;
}
window.ccProgressCard = progressCardHTML;
// show it under "Since your last swing" after each analysis
if (has('progressHTML')) {
  const base = window.progressHTML;
  window.progressHTML = async function (m) { return (await base.apply(this, arguments)) + (m ? await progressCardHTML(m.view) : ''); };
}
})();
