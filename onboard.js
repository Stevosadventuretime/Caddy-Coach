// Caddy Coach: getting to know the golfer. Three quick questions (experience, main goal, which hand) shown once,
// then "Your first steps" on Home is tailored to the answers. Answers stay on this phone (cc_golfer).
// Builds on app-3.js: renderHomeStart (the Home card), onbSteps (its steps), Hand (which way you play).
(function () {
'use strict';
const LEVELS = [
  { k: 'new', t: 'New to golf', d: 'Just starting out, or not played much yet' },
  { k: 'casual', t: 'I play now and then', d: 'A few rounds or range visits a year' },
  { k: 'regular', t: 'Regular golfer', d: 'Play most months, maybe have a handicap' },
  { k: 'low', t: 'Single-figure golfer', d: 'Handicap under 10' },
];
const GOALS = [
  { k: 'learn', t: 'Learn the basics', d: 'Grip, setup and a simple swing' },
  { k: 'hit', t: 'Hit it better', d: 'More solid contact, straighter shots' },
  { k: 'scores', t: 'Lower my scores', d: 'Fewer shots on the course' },
  { k: 'handicap', t: 'Get a handicap', d: 'Or bring mine down' },
];
const KEY = 'cc_golfer';
const get = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.level ? v : null; } catch (_) { return null; } };
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {} };
const seen = k => { try { return !!localStorage.getItem('cc_seen_' + k); } catch (_) { return false; } };
const mark = k => { try { localStorage.setItem('cc_seen_' + k, '1'); } catch (_) {} };
window.ccGolfer = get;

// ---------- remember which screens and drills the golfer has opened (for ticking off first steps) ----------
if (typeof tab === 'function') {
  const base = window.tab;
  window.tab = function (n) { const r = base.apply(this, arguments); try { if (typeof n === 'number') mark('p' + n); } catch (_) {} return r; };
}
document.addEventListener('click', e => { if (e.target.closest('[data-drill]')) mark('drill'); }, true);

// ---------- the three questions ----------
let sheet = null;
let close = function (done) {
  if (!sheet) return;
  const s = sheet; sheet = null; s.classList.remove('on');
  setTimeout(() => s.remove(), 260);
  if (done && typeof renderHomeStart === 'function') renderHomeStart();
};
function ask(force) {
  if (sheet || (!force && get())) return;
  const cur = get() || {}, hand = typeof Hand !== 'undefined' ? Hand.get() : 'right';
  const ans = { level: cur.level || '', goal: cur.goal || '', hand: cur.hand || hand };
  let step = 0;
  sheet = document.createElement('div');
  sheet.className = 'obWrap';
  sheet.innerHTML = '<div class="obScrim"></div><div class="obSheet" role="dialog" aria-modal="true" aria-labelledby="obQ"></div>';
  document.body.appendChild(sheet);
  const box = sheet.querySelector('.obSheet');
  const opt = (name, o, on) => `<button type="button" class="obOpt${on ? ' on' : ''}" data-ob="${name}" data-v="${o.k}" aria-pressed="${on}"><b>${o.t}</b>${o.d ? `<small>${o.d}</small>` : ''}</button>`;
  function draw() {
    const qs = [
      ['How much golf do you play?', LEVELS.map(o => opt('level', o, ans.level === o.k)).join('')],
      ['What do you most want from Caddy Coach?', GOALS.map(o => opt('goal', o, ans.goal === o.k)).join('')],
      ['Which way do you swing?', [{ k: 'right', t: 'Right-handed', d: 'Club on your right shoulder at the top' }, { k: 'left', t: 'Left-handed', d: 'Club on your left shoulder at the top' }].map(o => opt('hand', o, ans.hand === o.k)).join('')],
    ];
    const ready = [ans.level, ans.goal, ans.hand][step];
    box.innerHTML = `<div class="obTop"><span class="obDots" aria-label="Question ${step + 1} of 3">${[0, 1, 2].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</span>
      <button type="button" class="link" data-ob-skip>${get() ? 'Cancel' : 'Skip'}</button></div>
      <h2 id="obQ">${qs[step][0]}</h2><p class="mut">So Caddy Coach can suggest the right first steps. You can change this any time.</p>
      <div class="obOpts">${qs[step][1]}</div>
      <div class="obNav">${step ? '<button type="button" class="btn ghost" data-ob-back>Back</button>' : '<span></span>'}
      <button type="button" class="btn pri" data-ob-next ${ready ? '' : 'disabled'}>${step < 2 ? 'Next' : 'Done'}</button></div>`;
  }
  box.addEventListener('click', e => {
    const o = e.target.closest('[data-ob]');
    if (o) { ans[o.dataset.ob] = o.dataset.v; draw(); return; }
    if (e.target.closest('[data-ob-back]')) { step = Math.max(0, step - 1); draw(); return; }
    if (e.target.closest('[data-ob-skip]')) { if (!get()) save({ level: '', goal: '', hand: ans.hand, at: Date.now(), skipped: true }); close(true); return; }
    if (e.target.closest('[data-ob-next]')) {
      if (step < 2) { step++; draw(); return; }
      save({ level: ans.level, goal: ans.goal, hand: ans.hand, at: Date.now() });
      try { if (typeof Hand !== 'undefined' && Hand.get() !== ans.hand) Hand.set(ans.hand); } catch (_) {}
      close(true);
    }
  });
  sheet.querySelector('.obScrim').addEventListener('click', () => { if (get()) close(false); });
  draw();
  requestAnimationFrame(() => sheet && sheet.classList.add('on'));
}
window.ccAskGolfer = ask;
// the "help improve Caddy Coach" question waits until these questions are answered, so two sheets never stack
let shareLater = null;
if (typeof shareAsk === 'function') {
  const base = window.shareAsk;
  window.shareAsk = function () { if (sheet) { shareLater = arguments; return; } return base.apply(this, arguments); };
  const closeBase = close;
  close = function (done) { closeBase(done); if (shareLater) { const a = shareLater; shareLater = null; setTimeout(() => window.shareAsk.apply(null, a), 900); } };
}

// ask once: after "Look around first", after making a profile, or for existing golfers on their next visit
const profileOpen = () => document.documentElement.classList.contains('pfOpen');
function maybeAsk() {
  if (get()) return;
  const known = (typeof meU === 'function' && meU()) || (function () { try { return localStorage.getItem('cc_guest'); } catch (_) { return null; } })();
  if (!known || profileOpen()) return;
  ask(false);
}
document.addEventListener('click', e => { if (e.target.closest('[data-pf="guest"]')) setTimeout(maybeAsk, 700); }, true);
if (typeof profEnter === 'function') {
  const base = window.profEnter;
  window.profEnter = async function () { const r = await base.apply(this, arguments); setTimeout(maybeAsk, 900); return r; };
}
setTimeout(maybeAsk, 1600);

// ---------- first steps tailored to the answers ----------
const LEVEL_NAME = { new: 'new golfer', casual: 'golfer who plays now and then', regular: 'regular golfer', low: 'single-figure golfer' };
if (typeof onbSteps === 'function') {
  const base = window.onbSteps;
  window.onbSteps = async function () {
    const g = get(); if (!g || !g.level) return base.apply(this, arguments);
    const all = await base.apply(this, arguments), by = {}; all.forEach(s => { by[s.k] = s; });
    const sw = await allSwings();
    const bag = typeof BG !== 'undefined' && BG.bag && BG.bag.yards ? Object.values(BG.bag.yards).some(y => y && y.carry) : false;
    let planDone = false; try { if (typeof planGet === 'function') planDone = planDoneN(await planGet()) > 0; } catch (_) {}
    const extra = {
      guide: { k: 'guide', t: 'See what a good swing looks like', d: 'The positions that matter, in plain English.', done: seen('p7'), act: 'data-go="7"', btn: 'Read' },
      grip: { k: 'grip', t: 'Check your grip', d: 'Hold the club to your camera and get live feedback.', done: seen('p4'), act: 'data-go="4"', btn: 'Check' },
      setup: { k: 'setup', t: 'Check your setup', d: 'Stance, ball position and posture for any club.', done: seen('p5'), act: 'data-go="5"', btn: 'Check' },
      drill: { k: 'drill', t: 'Try a drill', d: 'Watch the 3D demo, then have a go.', done: seen('drill'), act: 'data-go="3"', btn: 'Drills' },
      bag: { k: 'bag', t: 'Add your club distances', d: 'So yardages tell you which club to hit.', done: bag, act: 'data-go="9"', btn: 'Add' },
      plan: { k: 'plan', t: "Do one of this week's practice sessions", d: 'Three short sessions, built around your game.', done: planDone, act: 'data-go="3"', btn: 'Practise' },
      angles: { k: 'angles', t: 'Analyse a swing from both angles', d: 'Face-on and down the line each check different things.', done: new Set(sw.map(s => s.view)).size >= 2, act: 'data-go="1"', btn: 'Film' },
    };
    const pick = { new: ['guide', 'grip', 'setup', 'drill', 'swing'], casual: ['swing', 'setup', 'drill', 'plan', 'goal'], regular: ['swing', 'bag', 'plan', 'round', 'hcp'], low: ['angles', 'hcp', 'round', 'trace', 'goal'] }[g.level] || ['swing', 'hcp', 'trace', 'round', 'goal'];
    const lead = { learn: 'guide', hit: 'swing', scores: 'round', handicap: 'hcp' }[g.goal];
    if (lead && !pick.includes(lead)) pick.unshift(lead);
    const guest = !(typeof meU === 'function' && meU());   // a visitor's handicap needs a profile, so that step waits
    return pick.filter(k => !(guest && k === 'hcp')).map(k => extra[k] || by[k]).filter(Boolean).slice(0, 5);
  };
}
// the card says who it's tailored for, with a way to change the answers
if (typeof renderHomeStart === 'function') {
  const base = window.renderHomeStart;
  window.renderHomeStart = async function () {
    const r = await base.apply(this, arguments);
    const el = document.getElementById('homeStart'), g = get();
    if (el && !el.hidden) {
      const h = el.querySelector('h2'); if (h) h.textContent = 'Your first steps';
      const top = el.querySelector('.rtTop small');
      if (top && !el.querySelector('[data-ob-change]')) top.insertAdjacentHTML('afterend', g && g.level ? `<small class="mut obFor">For a ${LEVEL_NAME[g.level]} · <button type="button" class="link" data-ob-change>Change</button></small>` : `<small class="mut obFor"><button type="button" class="link" data-ob-change>Tell us about your golf</button></small>`);
    }
    return r;
  };
}
document.addEventListener('click', e => { if (e.target.closest('[data-ob-change]')) ask(true); });
})();
