// Caddy Coach: plans (Free, Plus, Pro) on screen, the one gate every paid feature asks, and anonymous usage counts.
// Payments are off: while PLUS.on (app-3.js) is false every gate is open and the plans screen says "Coming soon".
(function () {
'use strict';
if (typeof Tiers === 'undefined') return;
const E = t => (typeof esc === 'function' ? esc(String(t)) : String(t));
const switchOn = () => typeof PLUS !== 'undefined' && !!PLUS.on;
function tier() {
  let ent = null;
  try { ent = (typeof ENT !== 'undefined' && ENT.s) || (typeof v2Me === 'function' && lsGet('cc_ent_' + v2Me(), null)); } catch (_) {}
  return Tiers.tierFor(ent, { switchOn: switchOn(), owner: typeof OWN !== 'undefined' && OWN.is === true, hostedInClaude: typeof HOSTED_IN_CLAUDE !== 'undefined' && HOSTED_IN_CLAUDE });
}
const can = f => Tiers.can(tier(), f);
window.ccTier = tier; window.ccCan = can;

// anonymous usage counts, with an optional short detail (e.g. which locked feature was tapped). Opt-in, as before.
async function trackX(kind, detail) {
  try {
    if (typeof v2On !== 'function' || !v2On() || !v2Me() || !shareOK()) return;
    const uh = await usageCode(); if (!uh) return;
    const row = { kind, uhash: uh, day: hcpToday() }; if (detail) row.detail = String(detail).slice(0, 24);
    sbSend('usage_events', [row]);
  } catch (_) {}
}
window.ccTrackX = trackX;

// ---------- the gate ----------
const WHY = { progress: 'Your progress dashboard is part of Caddy Coach Plus.', reportFull: 'The full round report is part of Caddy Coach Plus.', clubs: 'Club consistency is part of Caddy Coach Plus.',
  reference: 'Comparing with your reference swing is part of Caddy Coach Pro.', periods: '30 and 90-day comparisons are part of Caddy Coach Pro.', coach: "You've asked your 5 free questions today.", programme: 'The improvement programme is part of Caddy Coach Pro.' };
function gate(feature) { if (can(feature)) return true; trackX('gate', feature); openPlans(WHY[feature] || ''); return false; }
window.ccGate = gate;
// today's paid features (swing analysis beyond the free 3 a month, tracer, grip, compare) go through the same plans
if (typeof plusGate === 'function') {
  const base = window.plusGate;
  window.plusGate = async function (f) {
    if (!switchOn()) return true;
    const t = tier();
    if (f === 'swing') { if (t !== 'free') return true; try { if (await swingsThisMonth() < Tiers.limit(t, 'swingsPerMonth')) return true; } catch (_) {} trackX('gate', 'swing'); return base.apply(this, arguments); }
    if (Tiers.can(t, f)) return true;
    trackX('gate', f); return base.apply(this, arguments);
  };
}

// the coach: Free has 5 questions a day (counted on the phone)
const dayKey = () => 'cc_coachq_' + new Date().toISOString().slice(0, 10);
document.addEventListener('click', e => {
  const q = e.target.closest('.chWrap:not(.pgWrap):not(.frWrap) [data-cq], [data-coach]'); if (!q || q.dataset.coach === '') return;
  if (!coachAllowed()) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  countCoach();
}, true);
document.addEventListener('submit', e => {
  if (!e.target.closest('.chWrap:not(.pgWrap):not(.frWrap) .chAsk')) return;
  if (!coachAllowed()) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  countCoach();
}, true);
function coachAllowed() {
  const t = tier(), n = +(localStorage.getItem(dayKey()) || 0);
  if (n < Tiers.limit(t, 'coachPerDay')) return true;
  trackX('gate', 'coach'); openPlans(WHY.coach); return false;
}
function countCoach() { try { localStorage.setItem(dayKey(), String(+(localStorage.getItem(dayKey()) || 0) + 1)); } catch (_) {} trackX('coach_q'); }

// Your progress (Plus), Friends (free; counted)
if (typeof window.ccProgress === 'function') {
  const base = window.ccProgress;
  window.ccProgress = function () { if (!gate('progress')) return; trackX('progress'); return base.apply(this, arguments); };
}
if (typeof window.ccFriends === 'function') {
  const base = window.ccFriends;
  window.ccFriends = function () { trackX('friends'); return base.apply(this, arguments); };
}
// a round report was shown
if (typeof rtDoneHTML === 'function') {
  const base = window.rtDoneHTML;
  window.rtDoneHTML = function () { trackX('report'); return base.apply(this, arguments); };
}

// ---------- the plans screen ----------
let W = null;
function openPlans(why) {
  if (!W) {
    W = document.createElement('div'); W.className = 'chWrap plWrap'; W.setAttribute('role', 'dialog'); W.setAttribute('aria-modal', 'true'); W.setAttribute('aria-label', 'Caddy Coach plans');
    W.innerHTML = `<div class="chPanel"><header class="chHead"><div><h2>Caddy Coach plans</h2><small class="mut">What's free, and what Plus and Pro add</small></div><button type="button" class="chX" aria-label="Close">✕</button></header><div class="chBody"></div></div>`;
    document.body.appendChild(W);
    W.addEventListener('click', e => { if (e.target.closest('.chX')) { W.classList.remove('on'); document.documentElement.classList.remove('chOpen'); } });
  }
  document.querySelectorAll('.chWrap.on').forEach(x => { if (x !== W) x.classList.remove('on'); });
  const t = tier(), P = Tiers.PRICES;
  W.querySelector('.chBody').innerHTML = `${why ? `<p class="chMiss">${E(why)}</p>` : ''}
   ${!switchOn() ? '<p class="chEv">Everything in Caddy Coach is free while it\'s being tested. Paid plans are coming later, and you\'ll always be told before anything changes.</p>' : ''}
   ${Tiers.ORDER.map(k => `<section class="pgSec plCard${switchOn() && k === t ? ' on' : ''}"><div class="plTop"><h3>${Tiers.NAMES[k]}</h3><span>${k === 'free' ? 'Free' : `${P[k].month} a month or ${P[k].year} a year`}</span></div>
     <ul>${Tiers.WHAT[k].map(w => `<li>${E(w)}</li>`).join('')}</ul>
     ${k === 'free' ? '' : !switchOn() ? '<p class="mut plSoon">Coming soon</p>' : k === t ? '<p class="plSoon">Your plan</p>' : k === 'plus' ? '<button type="button" class="btn pri" data-pf="to-plus">See Plus</button>' : '<p class="mut plSoon">Coming soon</p>'}
     ${k === 'plus' && P.plus.testers ? `<p class="chEv">Testers who join in the first season keep ${E(P.plus.testers)}.</p>` : ''}</section>`).join('')}`;
  document.documentElement.classList.add('chOpen'); void W.offsetWidth; W.classList.add('on');
}
window.ccPlans = openPlans;
document.addEventListener('click', e => { if (e.target.closest('[data-plans]')) { if (typeof profHide === 'function') profHide(); openPlans(''); } });
})();
