// Caddy Coach: "Start today's practice". A Home card with the golfer's current focus, a builder (how long, where),
// and a step-by-step session player with a timer and a score for each block. Finished sessions are saved in My Golf
// Brain (backed up with it) and appear in the coaching history and the journey.
(function () {
'use strict';
if (typeof PracticeLogic === 'undefined' || !window.ccBrain) return;
const PL = PracticeLogic;
const E = t => (typeof esc === 'function' ? esc(String(t)) : String(t));
const get_ = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } };
const put_ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const LVL = { new: 1, casual: 1, regular: 2, low: 3 };
const ST = (typeof GolfBrainLogic !== 'undefined' && GolfBrainLogic.STATUS) || {};
const KIND = { warm: 'Warm up', drill: 'Drill', area: 'Practice game', play: 'Play it like the course' };
const mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

let W = null, S = null;   // the panel, and the session in progress: { plan, i, left, running, scores, started }
let tick = null;

function buildPlan(minutes, place) {
  const b = ccBrain.load();
  return PL.build({ minutes, place, focus: b.focus, drills: window.DRILL_LIBRARY || [], level: LVL[b.about.level] || 2 });
}

// ---------- the panel ----------
function panel() {
  if (W) return W;
  W = document.createElement('div'); W.className = 'chWrap prWrap'; W.setAttribute('role', 'dialog'); W.setAttribute('aria-modal', 'true'); W.setAttribute('aria-label', 'Practice');
  W.innerHTML = `<div class="chPanel"><header class="chHead"><div><h2>Today's practice</h2><small class="mut">Built from your own focus</small></div><button type="button" class="chX" aria-label="Close">✕</button></header><div class="chBody"></div></div>`;
  document.body.appendChild(W);
  W.addEventListener('click', onClick);
  W.addEventListener('input', e => { const i = e.target.closest('[data-pr-score]'); if (i && S) S.scores[S.i] = i.value === '' ? null : +i.value; });
  return W;
}
function show() {
  document.querySelectorAll('.chWrap.on').forEach(x => { if (x !== W) x.classList.remove('on'); });
  document.documentElement.classList.add('chOpen'); void W.offsetWidth; W.classList.add('on'); pill(false);
}
function hide() { if (!W) return; W.classList.remove('on'); document.documentElement.classList.remove('chOpen'); }
function open() { panel(); if (S) renderStep(); else renderBuilder(); show(); }
window.ccPractice = open;

// ---------- the builder ----------
function renderBuilder() {
  const last = get_('cc_pr_last', { minutes: 20, place: 'range' });
  const plan = buildPlan(last.minutes, last.place);
  const chip = (k, v, label, on) => `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" data-pr-${k}="${v}">${E(label)}</button>`;
  W.querySelector('.chBody').innerHTML = `
   <section class="pgSec"><h3>How long have you got?</h3><div class="chips">${PL.MINS.map(m => chip('min', m, `${m} min`, m === plan.minutes)).join('')}</div></section>
   <section class="pgSec"><h3>Where are you?</h3><div class="chips">${Object.entries(PL.PLACES).map(([k, p]) => chip('place', k, p.short, k === plan.place)).join('')}</div></section>
   <section class="pgSec"><h3>${E(plan.title)}</h3><ol class="prPlan">${plan.blocks.map(b => `<li><span class="prMin">${b.mins} min</span><div><b>${E(b.title)}</b>${b.focus ? `<small>For: ${E(b.focus)}</small>` : b.kind === 'warm' ? '<small>Loosen up first</small>' : `<small>${E(KIND[b.kind])}</small>`}</div></li>`).join('')}</ol>
     ${plan.notes.map(n => `<p class="chEv">${E(n)}</p>`).join('')}
     <button type="button" class="pri prGo" data-pr-start>Start session</button></section>`;
}

// ---------- the player ----------
function start() {
  const last = get_('cc_pr_last', { minutes: 20, place: 'range' });
  const plan = buildPlan(last.minutes, last.place);
  S = { plan, i: 0, left: plan.blocks[0].mins * 60, running: false, scores: plan.blocks.map(() => null), started: Date.now() };
  if (window.ccTrackX) ccTrackX('practice', 'gen-' + plan.place);
  renderStep();
}
function renderStep() {
  const b = S.plan.blocks[S.i], n = S.plan.blocks.length;
  const dots = S.plan.blocks.map((_, k) => `<span class="${k < S.i ? 'done' : k === S.i ? 'now' : ''}"></span>`).join('');
  W.querySelector('.chBody').innerHTML = `
   <div class="prDots" aria-label="Block ${S.i + 1} of ${n}">${dots}</div>
   <section class="pgSec prStep"><small class="prKind">${E(KIND[b.kind])}${b.focus ? ` · for ${E(b.focus)}` : ''}</small><h3>${E(b.title)}</h3>
     <div class="prTimer" aria-live="polite"><b data-pr-clock>${mmss(S.left)}</b><button type="button" class="btn ghost" data-pr-toggle>${S.running ? 'Pause' : 'Start timer'}</button></div>
     <ol class="prSteps">${(b.steps || []).map(t => `<li>${E(t)}</li>`).join('')}</ol>
     ${b.cue ? `<p class="prCue"><b>Cue:</b> ${E(b.cue)}</p>` : ''}${b.kit ? `<p class="chEv">You need: ${E(b.kit)}</p>` : ''}
     ${b.drill ? `<button type="button" class="link" data-pr-drill="${E(b.drill)}">See how to do the drill</button>` : ''}
     ${b.measure ? `<label class="prScore">${E(b.measure)}${b.of ? ` (out of ${b.of})` : ''}<input type="number" inputmode="numeric" min="0" ${b.of ? `max="${b.of}"` : ''} data-pr-score value="${S.scores[S.i] == null ? '' : S.scores[S.i]}" placeholder="Your score"></label>` : ''}
   </section>
   <div class="prNav">${S.i > 0 ? '<button type="button" class="btn ghost" data-pr-back>Back</button>' : '<button type="button" class="btn ghost" data-pr-quit>End session</button>'}<button type="button" class="pri" data-pr-next>${S.i < n - 1 ? 'Next' : 'Finish'}</button></div>`;
}
function setClock() { const c = W && W.querySelector('[data-pr-clock]'); if (c) c.textContent = mmss(S.left); }
function run(on) {
  clearInterval(tick); tick = null; if (!S) return; S.running = on;
  if (on) tick = setInterval(() => {
    S.left = Math.max(0, S.left - 1); setClock(); updatePill();
    if (S.left === 0) { run(false); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (_) {} if (typeof toast === 'function') toast('Time for the next block'); if (W.classList.contains('on')) renderStep(); }
  }, 1000);
  const t = W && W.querySelector('[data-pr-toggle]'); if (t) t.textContent = on ? 'Pause' : 'Start timer';
}
function go(k) { run(false); S.i = k; S.left = S.plan.blocks[k].mins * 60; renderStep(); W.querySelector('.chBody').scrollTop = 0; }
function finish() {
  run(false);
  const p = S.plan, blocks = p.blocks.map((b, k) => ({ title: b.title, kind: b.kind, drill: b.drill || null, focus: b.focus || null, score: S.scores[k], of: b.of || null }));
  const rec = { at: Date.now(), title: p.title, place: p.place, minutes: p.minutes, mins: Math.max(1, Math.round((Date.now() - S.started) / 6e4)), blocks };
  const br = ccBrain.load(); br.sessions = [rec].concat(br.sessions || []).slice(0, 60);
  const scored = blocks.filter(b => b.score != null);
  br.history = GolfBrainLogic.logAdvice(br.history, { source: 'plan', text: `Practised: ${p.title}${scored.length ? ` (${scored.map(b => `${b.title} ${b.score}${b.of ? '/' + b.of : ''}`).join(', ')})` : ''}`, ref: 'practice' }, rec.at);
  ccBrain.save(br);
  S = null; pill(false);
  W.querySelector('.chBody').innerHTML = `<section class="pgSec prDone"><h3>Session saved</h3>
    ${scored.length ? `<ul class="gbHist">${scored.map(b => `<li><small>${E(b.title)}</small>${b.score}${b.of ? ` out of ${b.of}` : ''}</li>`).join('')}</ul>` : '<p class="mut">Add a score next time and you\'ll see it improve in your journey.</p>'}
    <p class="chEv">Saved in My Golf Brain. Your next swing analysis will show whether it's working.</p>
    <button type="button" class="pri" data-journey>See your journey</button> <button type="button" class="btn ghost" data-pr-close>Done</button></section>`;
}
function onClick(e) {
  const t = e.target;
  if (t.closest('.chX') || t.closest('[data-pr-close]')) { hide(); if (S) pill(true); return; }
  const m = t.closest('[data-pr-min]'), pl = t.closest('[data-pr-place]');
  if (m || pl) { const last = get_('cc_pr_last', { minutes: 20, place: 'range' }); if (m) last.minutes = +m.dataset.prMin; if (pl) last.place = pl.dataset.prPlace; put_('cc_pr_last', last); renderBuilder(); return; }
  if (t.closest('[data-pr-start]')) return start();
  if (!S) return;
  if (t.closest('[data-pr-toggle]')) return run(!S.running);
  if (t.closest('[data-pr-next]')) return S.i < S.plan.blocks.length - 1 ? go(S.i + 1) : finish();
  if (t.closest('[data-pr-back]')) return go(S.i - 1);
  if (t.closest('[data-pr-quit]')) { run(false); S = null; renderBuilder(); return; }
  const d = t.closest('[data-pr-drill]');
  if (d) { hide(); pill(true); if (typeof openDrill === 'function') openDrill(d.dataset.prDrill); }
}

// a small "back to your session" pill while a session is running and the player is closed
let P = null;
function pill(on) {
  if (on && !P) { P = document.createElement('button'); P.type = 'button'; P.className = 'prPill'; P.addEventListener('click', open); document.body.appendChild(P); }
  if (P) P.hidden = !on || !S; updatePill();
}
function updatePill() { if (P && S) P.textContent = `Back to your practice · ${mmss(S.left)}`; }

// ---------- Home: today's focus ----------
// The app's own "Today's focus" card (#homeFocus, app-1.js) shows a drill for the latest swing's weakest area.
// When My Golf Brain has a focus, the card shows that instead (with its drill and live feedback); either way it gets
// "Start today's practice" and a link to the journey. No second card, so Home never shows two "today's focus".
function homeToday() {
  const el = document.getElementById('homeFocus'); if (!el) return;
  const b = ccBrain.load(), f = (b.focus || []).filter(p => p.status !== 'done'), top = f[0];
  const sessions = (b.sessions || []).filter(s => Date.now() - s.at < 7 * 864e5).length;
  const extra = `<button type="button" class="pri hfGo" data-practice>Start today's practice</button>
    <div class="hfLinks"><button type="button" class="link" data-journey>Your journey</button>${sessions ? `<small class="mut">${sessions} session${sessions === 1 ? '' : 's'} this week</small>` : ''}</div>`;
  if (top) {
    const d = top.drill && (window.DRILL_LIBRARY || []).find(x => x.id === top.drill.id);
    el.classList.remove('hasThumb'); el.classList.add('hfCard');
    el.innerHTML = `<small class="hfEye">Today's focus</small><div class="gbFT"><b class="hfT">${E(top.title)}</b><span class="gbSt ${E(top.status)}">${E(ST[top.status] || top.status)}</span></div>
       <p class="mut">${E(top.why || '')}${f.length > 1 ? ` · ${f.length - 1} more in your plan` : ''}</p>
       ${d ? `<button type="button" class="liveBtn" data-live="${E(d.id)}"><span class="dot" aria-hidden="true"></span>Drill: ${E(d.name)}<small>${E(d.time || '')} · with live feedback</small></button>` : ''}${extra}`;
  } else if (!el.querySelector('.hfGo')) {
    el.insertAdjacentHTML('beforeend', extra);
  }
}
if (typeof renderHome === 'function') {
  const base = window.renderHome;
  window.renderHome = function () { const r = base.apply(this, arguments); setTimeout(homeToday, 0); return r; };
}
setTimeout(homeToday, 1300);
// keep the card fresh when the brain changes (a new swing, a finished session)
const baseSave = ccBrain.save;
ccBrain.save = function () { const r = baseSave.apply(this, arguments); setTimeout(() => { try { homeToday(); } catch (_) {} }, 0); return r; };
const baseRefresh = ccBrain.refresh;
ccBrain.refresh = async function () { const r = await baseRefresh.apply(this, arguments); setTimeout(() => { try { homeToday(); } catch (_) {} }, 0); return r; };

document.addEventListener('click', e => {
  if (e.target.closest('[data-practice]')) { if (typeof profHide === 'function') profHide(); open(); }
  else if (e.target.closest('[data-journey]')) { hide(); if (window.ccBrainOpen) ccBrainOpen('journey'); }
});
})();
