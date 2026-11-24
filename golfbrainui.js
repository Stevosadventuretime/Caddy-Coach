// Caddy Coach: the "My Golf Brain" screen. Everything the coach knows about the golfer, each item labelled with where it
// came from (You told us / Measured / Calculated / Estimate / Not known yet). What the golfer told us can be edited;
// "Reset" clears only that, the coaching history and the focus (never swings, rounds or practice).
(function () {
'use strict';
if (!window.ccBrain) return;
const E = t => (typeof esc === 'function' ? esc(String(t)) : String(t));
const L = GolfBrainLogic;
const fmt = t => { try { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
const TAG = { told: ['You told us', 'read'], meas: ['Measured', ''], calc: ['Calculated', ''], est: ['Estimate', 'est'], none: ['Not known yet', 'read'] };
const tag = k => `<span class="bTag ${TAG[k][1]}">${TAG[k][0]}</span>`;
const OPTS = {
  level: [['', 'Not set'], ['new', 'New to golf'], ['casual', 'I play now and then'], ['regular', 'Regular golfer'], ['low', 'Single-figure golfer']],
  goal: [['', 'Not set'], ['learn', 'Learn the basics'], ['hit', 'Hit it better'], ['scores', 'Lower my scores'], ['handicap', 'Get or lower a handicap']],
  hand: [['', 'Not set'], ['right', 'Right-handed'], ['left', 'Left-handed']],
  freq: [['', 'Not set'], ['weekly', 'Most weeks'], ['monthly', 'Once or twice a month'], ['rarely', 'A few times a year']],
  conditions: [['', 'Not set'], ['parkland', 'Parkland'], ['links', 'Links'], ['heath', 'Heathland'], ['mixed', 'A mix']],
};
const sel = (k, v) => `<select id="gb_${k}" aria-label="${k}">${OPTS[k].map(([a, b]) => `<option value="${a}"${a === v ? ' selected' : ''}>${b}</option>`).join('')}</select>`;
let W = null, armed = false;

async function render() {
  const body = W.querySelector('.chBody'); body.innerHTML = '<p class="mut">Reading your golf…</p>';
  const r = await ccBrain.refresh().catch(() => null), b = (r && r.brain) || ccBrain.load(), s = (r && r.snap) || {};
  const a = b.about, R = s.rounds || {}, st = R.stats || {}, P = s.practice || {}, T = s.trend;
  const row = (k, v, t) => `<div><dt>${E(k)}</dt><dd>${v == null || v === '' ? `${tag('none')}` : `${E(v)} ${tag(t)}`}</dd></div>`;
  body.innerHTML = `
   <section class="pgSec"><h3>Your focus</h3>${b.focus.length ? `<ol class="gbFocus">${b.focus.map(p => `<li><div class="gbFT"><b>${E(p.title)}</b><span class="gbSt ${p.status}">${E(L.STATUS[p.status] || p.status)}</span></div>
      <p>${E(L.whyFor(p).replace(p.title + ': ', '').replace(/^./, c => c.toUpperCase()))}</p>${p.drill ? `<button type="button" class="chip" data-drill="${E(p.drill.id)}">${E(p.drill.name)}</button>` : ''}</li>`).join('')}</ol>`
     : '<p class="mut">Analyse a swing or record a round and your first priorities appear here, never more than three.</p>'}</section>
   <section class="pgSec"><h3>About you</h3><form class="gbAbout" data-gb-about>
     <label>What should I call you?<input id="gb_name" maxlength="30" value="${E(a.name || '')}" placeholder="First name"></label>
     <label>Experience${sel('level', a.level)}</label><label>Main goal${sel('goal', a.goal)}</label><label>Which way you swing${sel('hand', a.hand)}</label>
     <label>How often you play${sel('freq', a.freq)}</label><label>Where you usually play${sel('conditions', a.conditions)}</label>
     <label>Your target<input id="gb_target" maxlength="60" value="${E(a.target || '')}" placeholder="e.g. Break 90 by June"></label>
     <button type="submit" class="btn">Save</button><p class="chEv">Everything in this box is ${tag('told')}, and you can change it any time.</p></form></section>
   <section class="pgSec"><h3>Your swing</h3><dl class="gbDl">
     ${row('Swings analysed', s.swingCount || 0, 'meas')}
     ${row('Keeps coming back', (s.recurring || []).map(x => x.title).join('; '), 'meas')}
     ${row('Swing score trend', T ? `${T.first} → ${T.last} over ${T.n} swings` : '', 'est')}
     ${row('Usual camera angle', (s.swings || [])[0] ? ((s.swings[0].view === 'face-on') ? 'Face-on' : 'Down the line') : '', 'meas')}</dl>
     <p class="chEv">Body positions are measured from your videos. The swing score is an estimate against tour players filmed the same way.</p></section>
   <section class="pgSec"><h3>Your game</h3><dl class="gbDl">
     ${row('Rounds recorded (last 10)', R.n || '', 'calc')}${row('Average score per 18', R.avg, 'calc')}
     ${row('Fairways hit', st.fwPct != null ? st.fwPct + '%' : '', 'calc')}${row('Greens in regulation', st.girPct != null ? st.girPct + '%' : '', 'calc')}
     ${row('Up and downs', st.udPct != null ? st.udPct + '%' : '', 'calc')}${row('Putts per 18', st.puttsPer18, 'calc')}
     ${row('Handicap index', s.hcp && s.hcp.hi != null ? s.hcp.hi : '', 'calc')}</dl></section>
   <section class="pgSec"><h3>Practice</h3><dl class="gbDl">
     ${row("This week's plan", P.total ? `${P.done} of ${P.total} sessions` : '', 'meas')}${row('Practice streak', P.streak ? `${P.streak} week${P.streak === 1 ? '' : 's'}` : '', 'meas')}
     ${row('Sessions from today\'s practice (30 days)', (b.sessions || []).filter(x => Date.now() - x.at < 30 * 864e5).length || '', 'meas')}${row('Two-week focus', P.focus, 'meas')}${row('Club distances set', s.bagN ? `${s.bagN} clubs` : '', 'told')}</dl></section>
   <section class="pgSec" id="gbJourney"><h3>Your journey</h3>${(() => {
     const J = typeof PracticeLogic !== 'undefined' ? PracticeLogic.journey(b.history, b.sessions, 30) : [];
     const IC = { swing: 'Swing', sorted: 'Sorted', round: 'Round', practice: 'Practice' };
     return J.length ? `<ol class="gbJourney">${J.map(e => `<li class="${e.type}"><small>${fmt(e.at)} · ${IC[e.type]}</small>${E(e.text)}</li>`).join('')}</ol>`
       : '<p class="mut">Your swing fixes, practice sessions, rounds and the faults you sort out will build up here.</p>';
   })()}</section>
   <section class="pgSec"><h3>Coaching history</h3>${b.history.length ? `<ul class="gbHist">${b.history.slice(0, 25).map(h => `<li><small>${fmt(h.at)} · ${E({ swing: 'Swing analysis', round: 'Round', coach: 'Your coach', plan: 'Practice plan' }[h.source] || h.source)}</small>${E(h.text)}</li>`).join('')}</ul>`
     : '<p class="mut">Advice from your swings, rounds and the coach will be kept here, so I never forget what we\'ve worked on.</p>'}</section>
   <section class="pgSec"><h3>Start again</h3><p class="mut">Clears what you told us and the coaching history. Your swings, rounds, practice and handicap stay, and your focus is worked out again from them.</p>
     <button type="button" class="btn ghost" data-gb-reset>${armed ? 'Tap again to reset. This can\'t be undone' : 'Reset My Golf Brain'}</button></section>`;
}
function open(section) {
  if (!W) {
    W = document.createElement('div'); W.className = 'chWrap gbWrap'; W.setAttribute('role', 'dialog'); W.setAttribute('aria-modal', 'true'); W.setAttribute('aria-label', 'My Golf Brain');
    W.innerHTML = `<div class="chPanel"><header class="chHead"><div><h2>My Golf Brain</h2><small class="mut">Everything your coach knows about your game</small></div><button type="button" class="chX" aria-label="Close">✕</button></header><div class="chBody"></div></div>`;
    document.body.appendChild(W);
    W.addEventListener('click', e => {
      if (e.target.closest('.chX') || e.target.closest('[data-drill],[data-go]')) { W.classList.remove('on'); document.documentElement.classList.remove('chOpen'); armed = false; return; }
      if (e.target.closest('[data-gb-reset]')) {
        if (!armed) { armed = true; render(); return; }
        armed = false; const keep = ccBrain.load().sessions || [], b = GolfBrainLogic.empty(); b.sessions = keep; b.about.hand = typeof Hand !== 'undefined' ? Hand.get() : ''; ccBrain.save(b);
        if (typeof toast === 'function') toast('My Golf Brain has been reset'); render();
      }
    });
    W.addEventListener('submit', e => {
      e.preventDefault(); if (!e.target.matches('[data-gb-about]')) return;
      const b = ccBrain.load(), v = id => (W.querySelector('#gb_' + id) || {}).value || '';
      Object.assign(b.about, { name: v('name').trim(), level: v('level'), goal: v('goal'), hand: v('hand'), freq: v('freq'), conditions: v('conditions'), target: v('target').trim() });
      ccBrain.save(b);
      try { if (b.about.hand && typeof Hand !== 'undefined' && Hand.get() !== b.about.hand) Hand.set(b.about.hand); } catch (_) {}
      if (typeof toast === 'function') toast('Saved to My Golf Brain');
    });
  }
  document.querySelectorAll('.chWrap.on').forEach(x => { if (x !== W) x.classList.remove('on'); });
  document.documentElement.classList.add('chOpen'); void W.offsetWidth; W.classList.add('on');
  render().then(() => { if (section === 'journey') { const j = W.querySelector('#gbJourney'); if (j) j.scrollIntoView({ block: 'start' }); } });
}
window.ccBrainOpen = open;
document.addEventListener('click', e => { if (e.target.closest('[data-brain]')) { if (typeof profHide === 'function') profHide(); open(); } });
// ways in: the Home coach card and the coach screen's header
new MutationObserver(() => {
  const c = document.getElementById('homeCoach'); if (c && !c.querySelector('[data-brain]')) c.insertAdjacentHTML('beforeend', '<button type="button" class="btn ghost hcOpen" data-brain>My Golf Brain</button>');
  const h = document.querySelector('.chWrap:not(.pgWrap):not(.frWrap):not(.plWrap):not(.gbWrap) .chHead small'); if (h && !h.querySelector('[data-brain]')) h.insertAdjacentHTML('beforeend', ' · <button type="button" class="link" data-brain>My Golf Brain</button>');
}).observe(document.body, { childList: true, subtree: true });
})();
