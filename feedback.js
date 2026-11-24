// Caddy Coach: in-app feedback, and which poster or link brought a golfer in.
// - "Send feedback" in the profile menu, any time. A gentle one-off ask after a golfer's 2nd swing analysis or 1st round
//   (at most every 3 weeks, at most 3 times, never again once they say "don't ask").
// - Feedback goes to the `feedback` table: anyone can send, only the app owner can read. No usage code, username or
//   device id goes with it; a way to reply is only kept if the golfer types one.
// - A poster's QR code can carry ?src=poster-venue. The first one seen is kept on the phone, sent with feedback, and
//   counted (anonymously, opt-in) as an 'arrive' usage event so the owner can see which posters work.
(function () {
'use strict';
const E = t => (typeof esc === 'function' ? esc(String(t)) : String(t));
const get_ = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } };
const put_ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const DAY = 864e5;

// ---------- where they came from ----------
try {
  const src = (new URLSearchParams(location.search).get('src') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  if (src && !get_('cc_src', null)) put_('cc_src', { src, at: Date.now() });
  if (src && history.replaceState) { const u = new URL(location.href); u.searchParams.delete('src'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
} catch (_) {}
const arrived = () => (get_('cc_src', null) || {}).src || null;
// count the arrival once, when anonymous usage sharing is on (it's opt-in)
function countArrival() {
  const a = get_('cc_src', null); if (!a || a.sent) return;
  try { if (typeof v2On !== 'function' || !v2On() || !v2Me() || !shareOK() || !window.ccTrackX) return; } catch (_) { return; }
  ccTrackX('arrive', a.src); a.sent = true; put_('cc_src', a);
}
setTimeout(countArrival, 6000); setInterval(countArrival, 60000);

function device() {
  const ua = navigator.userAgent || '';
  const d = /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'Computer';
  const inst = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  return d + (inst ? ', installed' : ', browser');
}
async function appVer() { try { const k = await caches.keys(); return (k.find(x => /^cc-gh-/.test(x)) || '').slice(0, 24) || null; } catch (_) { return null; } }

// ---------- the sheet ----------
const ASK = { after_swing: 'How was that swing analysis?', after_round: 'How did Caddy Coach do on the course?', menu: 'Tell us what you think' };
function open(source) {
  source = source || 'menu';
  if (document.getElementById('fbAsk')) return;
  const ret = document.activeElement, el = document.createElement('div');
  el.id = 'fbAsk'; el.className = 'shareAsk fbAsk';
  el.innerHTML = `<div class="shareScrim" data-fb-close></div><div class="shareSheet" role="dialog" aria-modal="true" aria-labelledby="fbT"><span class="shareGrab" aria-hidden="true"></span>
   <h2 id="fbT">${E(ASK[source] || ASK.menu)}</h2><p class="shareSub">It goes straight to the person who builds Caddy Coach</p>
   <form data-fb-form>
    <div class="fbStars" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n} out of 5" data-fb-star="${n}">★</button>`).join('')}</div>
    <label class="fbL">What would make it better?<textarea id="fbBody" maxlength="1000" rows="3" placeholder="Anything: what you liked, what confused you, what's missing"></textarea></label>
    <label class="fbL">Happy for us to reply? <small>(optional)</small><input id="fbContact" maxlength="120" autocomplete="email" placeholder="Email or phone"></label>
    <p class="fbNote">We only keep what you type here. No username, location or video is sent.</p>
    <div class="shareBtns">${source === 'menu' ? '<button type="button" data-fb-close>Cancel</button>' : '<button type="button" data-fb-never>Don\'t ask again</button>'}<button type="submit" class="pri">Send</button></div>
   </form></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  let rating = null;
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 220); document.removeEventListener('keydown', key); if (ret && ret.focus) ret.focus(); };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  el.addEventListener('click', e => {
    const s = e.target.closest('[data-fb-star]');
    if (s) { rating = +s.dataset.fbStar; el.querySelectorAll('[data-fb-star]').forEach(b => { const on = +b.dataset.fbStar <= rating; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(+b.dataset.fbStar === rating)); }); return; }
    if (e.target.closest('[data-fb-never]')) { const st = get_('cc_fb', {}); st.never = true; put_('cc_fb', st); close(); return; }
    if (e.target.closest('[data-fb-close]')) close();
  });
  el.addEventListener('submit', async e => {
    e.preventDefault();
    const body = el.querySelector('#fbBody').value.trim(), contact = el.querySelector('#fbContact').value.trim();
    if (!rating && !body) { el.querySelector('.fbNote').textContent = 'Pick a star rating or write a few words first.'; return; }
    const row = { rating, body: body || null, source, arrived: arrived(), device: device(), app_ver: await appVer(), contact: contact || null };
    if (typeof sbSend === 'function') sbSend('feedback', [row]);   // waits on the phone if there's no signal
    if (window.ccTrackX) ccTrackX('feedback', source);
    const st = get_('cc_fb', {}); st.sent = (st.sent || 0) + 1; st.last = Date.now(); put_('cc_fb', st);
    close(); if (typeof toast === 'function') toast('Thanks, that really helps');
  });
  setTimeout(() => { const b = el.querySelector('[data-fb-star]'); b && b.focus(); }, 60);
}
window.ccFeedback = open;
document.addEventListener('click', e => { if (e.target.closest('[data-feedback]')) { if (typeof profHide === 'function') profHide(); open('menu'); } });

// ---------- the gentle ask ----------
function maybeAsk(source) {
  const st = get_('cc_fb', {});
  if (st.never || (st.asked || 0) >= 3 || (st.last && Date.now() - st.last < 21 * DAY)) return;
  st.asked = (st.asked || 0) + 1; st.last = Date.now(); put_('cc_fb', st);
  setTimeout(() => { if (!document.querySelector('.chWrap.on, #shareAsk')) open(source); }, 2500);
}
if (typeof saveAnalysis === 'function') {
  const base = window.saveAnalysis;
  window.saveAnalysis = async function () {
    const r = await base.apply(this, arguments);
    try { const st = get_('cc_fb', {}); st.swings = (st.swings || 0) + 1; put_('cc_fb', st); if (st.swings === 2) maybeAsk('after_swing'); } catch (_) {}
    return r;
  };
}
if (typeof rtFinish === 'function') {
  const base = window.rtFinish;
  window.rtFinish = async function () {
    const r = await base.apply(this, arguments);
    try { const st = get_('cc_fb', {}); st.rounds = (st.rounds || 0) + 1; put_('cc_fb', st); if (st.rounds === 1) maybeAsk('after_round'); } catch (_) {}
    return r;
  };
}

// ---------- the owner's screen: feedback and which posters work ----------
const FB = { list: null, arr: null };
if (typeof ownerOpen === 'function' && typeof statsHTML === 'function') {
  const baseOpen = window.ownerOpen, baseHTML = window.statsHTML;
  window.ownerOpen = async function () {
    try { FB.list = await sbRpcJ('cc_feedback_list', { n: 50 }); } catch (_) { FB.list = null; }
    try { FB.arr = await sbRpcJ('cc_arrivals'); } catch (_) { FB.arr = null; }
    return baseOpen.apply(this, arguments);
  };
  window.statsHTML = function () {
    const fmt = t => { try { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
    const L = FB.list, A = FB.arr || {};
    const arr = Object.keys(A).length ? `<ul class="fbArr">${Object.entries(A).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<li><b>${E(k)}</b> ${n} golfer${n === 1 ? '' : 's'}</li>`).join('')}</ul>`
      : '<p class="mut">No poster or link visits counted yet. Add <code>?src=poster-name</code> to the link in a QR code to count it.</p>';
    const fb = L == null ? '<p class="mut">Couldn\'t load feedback just now.</p>' : !L.length ? '<p class="mut">No feedback yet.</p>'
      : `<ul class="fbList">${L.map(f => `<li><div class="fbMeta">${fmt(f.created_at)}${f.rating ? ` · ${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}` : ''} · ${E(f.source || '')}${f.arrived ? ` · from ${E(f.arrived)}` : ''}${f.device ? ` · ${E(f.device)}` : ''}</div>${f.body ? `<p>${E(f.body)}</p>` : ''}${f.contact ? `<small>Reply to: ${E(f.contact)}</small>` : ''}</li>`).join('')}</ul>`;
    return baseHTML.apply(this, arguments) + `<section class="pgSec"><h3>Golfers' feedback</h3>${fb}</section><section class="pgSec"><h3>Where golfers came from (90 days)</h3>${arr}</section>`;
  };
}
})();
