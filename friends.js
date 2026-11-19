// Caddy Coach: friends, friends' leaderboards and private competitions. Golfers add each other by username; each shares
// a small card built from their own records (friendlogic.js). The server only lets accepted friends and fellow
// competition members see it (supabase/migrations/20261119_friends.sql). Needs a signed-in profile.
(function () {
'use strict';
if (typeof FriendLogic === 'undefined') return;
const E = t => (typeof esc === 'function' ? esc(String(t)) : String(t));
const iso = t => new Date(t).toISOString().slice(0, 10);
const nice = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (_) { return d; } };
const me = () => (typeof Auth !== 'undefined' && Auth.s && Auth.s.user && Auth.s.user.id) || null;
const signedIn = () => !!(me() && typeof meU === 'function' && meU());
const thru = r => { try { return tally(r.holes || []).thru; } catch (_) { return 0; } };
const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } };
const lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

// ---------- my card, from my own records ----------
async function myCard() {
  const r = { now: Date.now() };
  try {
    r.rounds = ((await allRounds()) || []).filter(x => thru(x) >= 9).map(x => {
      const s = RoundReport.stats(x.holes); let pts = null, drive = 0;
      try { const nt = rtNet(x); if (nt) pts = nt.pts; } catch (_) {}
      try { for (const h of x.holes || []) for (const sh of holeShots(h)) if (sh.club === 'D' && sh.yds != null && sh.yds <= 380 && sh.yds > drive) drive = sh.yds; } catch (_) {}
      return { d: x.date || iso(x.finishedAt || Date.now()), holes: s.holes, score: s.score, pts, putts: s.putts, pN: s.pN, drive: drive || null };
    });
  } catch (_) { r.rounds = []; }
  try { const l = (await Store.list()) || []; r.swingTimes = l.map(e => Date.parse(e.createdAt)); const b = l.filter(e => e.overall != null); r.swingBest = b.length ? Math.max(...b.map(e => e.overall)) : null; } catch (_) {}
  try { r.testTimes = PR.all().map(t => t.at); } catch (_) {}
  try { const rec = HcpStore.rec; if (rec && rec.start) { const c = WHS.calc(rec); r.hi = c.hi; r.hiStart = rec.start.hi; r.hiHist = (c.rows || []).slice().reverse().map(x => ({ d: x.s && x.s.d, hi: x.hi != null ? x.hi : x.before })).filter(x => x.d && x.hi != null); } } catch (_) {}
  try { if (window.ccAchieve) { const A = await ccAchieve(); r.level = { n: A.L.n, name: A.L.name }; r.xp = A.X.total; r.badges = A.B.filter(b => b.earned).length; } } catch (_) {}
  return FriendLogic.buildCard(r);
}
// shared only once the golfer has a friend or a competition; then after rounds and swings, and at most daily otherwise
async function pushCard(force) {
  if (!signedIn() || !lsG('cc_social', 0)) return;
  const last = lsG('cc_card_at', 0); if (!force && Date.now() - last < 864e5) return;
  try { await sbUpsert('friend_cards', { user_id: me(), card: await myCard(), updated_at: new Date().toISOString() }, 'user_id'); lsS('cc_card_at', Date.now()); } catch (e) { console.warn('friends card', e); }
}
setTimeout(() => pushCard(false), 6000);
for (const fn of ['rtFinish', 'saveAnalysis']) if (typeof window[fn] === 'function') {
  const base = window[fn];
  window[fn] = async function () { const r = await base.apply(this, arguments); setTimeout(() => pushCard(true), 1500); return r; };
}

// ---------- the screen ----------
let W = null, data = { friends: [], comps: [], boards: {}, tab: 'stableford', msg: '' };
const FORMATS = [['stableford', 'Best Stableford round'], ['gross', 'Lowest score (per 18)'], ['putts', 'Fewest putts (per 18)'], ['drive', 'Longest drive (GPS)'], ['improved', 'Most improved handicap']];
const unit = k => ({ stableford: ' pts', putts: ' putts', drive: ' yds', xp: ' XP' }[k] || '');
function rowsHTML(rows, k) {
  if (!rows.length) return `<p class="mut">No one has data for this yet.${k === 'drive' ? ' Mark your tee shot on the hole map with your driver to record a drive.' : ''}</p>`;
  return `<ol class="frRows">${rows.map(r => `<li class="${r.me ? 'me' : ''}"><span class="frPos">${r.pos}</span><b>${E(r.name)}${r.me ? ' (you)' : ''}</b><span class="frV">${k === 'improved' ? (r.value > 0 ? '−' : '+') + Math.abs(r.value) : r.value}${unit(k)}</span></li>`).join('')}</ol>`;
}
async function load() {
  const out = { friends: [], comps: [] };
  try { out.friends = (await sbRpcJ('cc_friends', {})) || []; } catch (e) { out.err = e.status === 404 ? 'Friends are being switched on. Try again later.' : "Couldn't reach Caddy Coach. Check your signal."; }
  try { out.comps = (await sbRpcJ('cc_comps', {})) || []; } catch (_) {}
  out.mine = await myCard().catch(() => null);
  return out;
}
async function render() {
  if (!W) return;
  const body = W.querySelector('.chBody');
  if (!signedIn()) {
    body.innerHTML = `<section class="pgSec"><h3>Play with friends</h3><p>Add friends, see a friends' leaderboard and run your own competitions. You need a free profile for this, so your friends can find you by your username.</p><button type="button" class="btn pri" data-fr-signup>Create your free profile</button></section>`;
    return;
  }
  body.innerHTML = '<p class="mut">Loading your friends…</p>';
  const L = await load(); Object.assign(data, L);
  const acc = data.friends.filter(f => f.status === 'accepted'), inc = data.friends.filter(f => f.status === 'pending' && f.incoming), out = data.friends.filter(f => f.status === 'pending' && !f.incoming);
  const people = acc.map(f => ({ id: f.user_id, name: f.name, card: f.card })).concat(L.mine ? [{ id: me(), name: 'You', card: L.mine, me: true }] : []);
  const board = FriendLogic.leaderboard(people, data.tab, Date.now());
  body.innerHTML = `${L.err ? `<p class="chMiss">${E(L.err)}</p>` : ''}${data.msg ? `<p class="chEv">${E(data.msg)}</p>` : ''}
   <section class="pgSec"><h3>Add a friend</h3><form class="chAsk" data-fr-add><input id="frU" maxlength="20" autocomplete="off" autocapitalize="none" placeholder="Their Caddy Coach username" aria-label="Friend's username"><button type="submit" class="btn sm">Add</button></form>
    <p class="chEv">Your username is <b>${E(meU())}</b>. Friends see your first name and initial, level, handicap, and a summary of your last 60 days of rounds. Never your swings or videos.</p></section>
   ${inc.length ? `<section class="pgSec"><h3>Friend requests</h3>${inc.map(f => `<div class="frReq"><b>${E(f.name)}</b><span><button type="button" class="chip" data-fr-accept="${f.user_id}">Accept</button><button type="button" class="chip" data-fr-remove="${f.user_id}">Decline</button></span></div>`).join('')}</section>` : ''}
   <section class="pgSec"><h3>Friends' leaderboard</h3>
    <div class="chips frTabs">${[['stableford', 'This month'], ['improved', 'Most improved'], ['drive', 'Longest drive'], ['xp', 'XP this month']].map(([k, l]) => `<button type="button" class="chip${data.tab === k ? ' on' : ''}" data-fr-tab="${k}">${l}</button>`).join('')}</div>
    ${acc.length ? rowsHTML(board, data.tab) : '<p class="mut">Add a friend to start a leaderboard.</p>'}
    <p class="chEv">${{ stableford: 'Best 18-hole Stableford round this month.', improved: 'Handicap change over the last 90 days (needs at least two scores).', drive: 'Longest drive marked with GPS in the last 60 days (includes roll).', xp: 'XP earned this month from swings, rounds and drill tests.' }[data.tab]}</p></section>
   ${acc.length ? `<section class="pgSec"><h3>Friends</h3><ul class="frList">${acc.map(f => { const c = f.card || {}; const n = (c.rounds || []).filter(x => x.d >= iso(Date.now()).slice(0, 7) + '-01').length;
      return `<li><b>${E(f.name)}</b><small>${c.level ? `Level ${c.level.n} · ` : ''}${c.hi != null ? `Handicap ${c.hi} · ` : ''}${n} round${n === 1 ? '' : 's'} this month</small><button type="button" class="link" data-fr-remove="${f.user_id}">Remove</button></li>`; }).join('')}</ul></section>` : ''}
   ${out.length ? `<p class="mut">Waiting for ${out.map(f => E(f.name)).join(', ')} to accept.</p>` : ''}
   <section class="pgSec"><h3>Private competitions</h3>
    ${data.comps.map(c => `<details class="frComp" data-fr-comp="${c.id}"><summary><b>${E(c.name)}</b><small>${E((FORMATS.find(f => f[0] === c.format) || [, c.format])[1])} · ${E(nice(c.starts))} to ${E(nice(c.ends))} · code <b>${E(c.code)}</b></small></summary><div class="frBoard">Loading…</div>
      <button type="button" class="chip" data-fr-share="${E(c.code)}" data-fr-name="${E(c.name)}">Invite with the code</button></details>`).join('') || '<p class="mut">No competitions yet.</p>'}
    <form class="frMake" data-fr-make><input id="frN" maxlength="60" placeholder="Name, e.g. Saturday crew November" aria-label="Competition name">
     <select id="frF" aria-label="Format">${FORMATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
     <div class="frDates"><label>From<input id="frS" type="date" value="${iso(Date.now())}"></label><label>To<input id="frE" type="date" value="${iso(Date.now() + 30 * 864e5)}"></label></div>
     <button type="submit" class="btn">Create competition</button></form>
    <form class="chAsk" data-fr-join><input id="frC" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="Join with a 6-character code" aria-label="Competition code"><button type="submit" class="btn sm">Join</button></form></section>`;
  data.msg = '';
}
async function compBoard(el) {
  const id = el.dataset.frComp, comp = data.comps.find(c => c.id === id), box = el.querySelector('.frBoard');
  try {
    const rows = (await sbRpcJ('cc_comp_board', { cid: id })) || [];
    const people = rows.map(r => ({ id: r.user_id, name: r.user_id === me() ? 'You' : r.name, card: r.user_id === me() ? (data.mine || r.card) : r.card, me: r.user_id === me() }));
    box.innerHTML = rowsHTML(FriendLogic.compStandings(comp, people), comp.format) + `<p class="chEv">${rows.length} player${rows.length === 1 ? '' : 's'}. Only rounds from ${E(nice(comp.starts))} to ${E(nice(comp.ends))} count.</p>`;
  } catch (_) { box.innerHTML = '<p class="chMiss">Couldn\'t load the standings.</p>'; }
}
async function act(fn) { try { await fn(); } catch (e) { data.msg = "That didn't work. Check your signal and try again."; console.warn('friends', e); } render(); }
async function patchLink(from) {
  if (typeof Auth !== 'undefined' && Auth.s) await Auth.fresh();
  const r = await fetch(`${SB.url}/rest/v1/friend_links?from_user=eq.${from}&to_user=eq.${me()}`, { method: 'PATCH', headers: Object.assign(SB.h(), { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ status: 'accepted' }) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
}
function open() {
  if (!W) {
    W = document.createElement('div'); W.className = 'chWrap frWrap'; W.setAttribute('role', 'dialog'); W.setAttribute('aria-modal', 'true'); W.setAttribute('aria-label', 'Friends');
    W.innerHTML = `<div class="chPanel"><header class="chHead"><div><h2>Friends</h2><small class="mut">Leaderboards and competitions from real rounds</small></div><button type="button" class="chX" aria-label="Close">✕</button></header><div class="chBody"></div></div>`;
    document.body.appendChild(W);
    W.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('.chX')) { close(); return; }
      if (t.closest('[data-fr-signup]')) { close(); if (typeof profShow === 'function') profShow('signup'); return; }
      const tb = t.closest('[data-fr-tab]'); if (tb) { data.tab = tb.dataset.frTab; render(); return; }
      const a = t.closest('[data-fr-accept]'); if (a) { act(async () => { await patchLink(a.dataset.frAccept); lsS('cc_social', 1); pushCard(true); }); return; }
      const rm = t.closest('[data-fr-remove]'); if (rm) { const u = rm.dataset.frRemove; act(async () => { await sbDel('friend_links', `from_user=eq.${u}&to_user=eq.${me()}`); await sbDel('friend_links', `from_user=eq.${me()}&to_user=eq.${u}`); }); return; }
      const sh = t.closest('[data-fr-share]'); if (sh) { const txt = `Join my Caddy Coach competition "${sh.dataset.frName}": open Caddy Coach, go to Friends and enter the code ${sh.dataset.frShare}.`;
        if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => { if (typeof toast === 'function') toast('Invite copied'); }).catch(() => {}); return; }
    });
    W.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('[data-fr-comp]'); if (d && d.open) compBoard(d); }, true);
    W.addEventListener('submit', e => {
      e.preventDefault(); const f = e.target;
      if (f.matches('[data-fr-add]')) { const u = f.querySelector('#frU').value.trim(); if (!u) return;
        act(async () => { const res = await sbRpcJ('cc_friend_request', { uname: u });
          data.msg = { sent: `Request sent to ${u}.`, accepted: `You and ${u} are now friends.`, already: `You've already asked ${u}.`, notfound: `No golfer called ${u}. Check the spelling.`, self: "That's you!", slow: 'Too many requests today. Try again tomorrow.' }[res] || 'Done.';
          if (res === 'sent' || res === 'accepted') { lsS('cc_social', 1); pushCard(true); } }); }
      if (f.matches('[data-fr-join]')) { const c = f.querySelector('#frC').value.trim(); if (!c) return;
        act(async () => { const id = await sbRpcJ('cc_comp_join', { cd: c }); data.msg = id ? 'You\'ve joined. Your rounds in the dates count automatically.' : 'No competition with that code, or it\'s full.'; if (id) { lsS('cc_social', 1); pushCard(true); } }); }
      if (f.matches('[data-fr-make]')) { const n = f.querySelector('#frN').value.trim(), fmt = f.querySelector('#frF').value, s = f.querySelector('#frS').value, en = f.querySelector('#frE').value;
        if (!n || !s || !en || en < s) { data.msg = 'Give it a name, and an end date after the start.'; render(); return; }
        act(async () => { const code = await sbRpcJ('cc_comp_make', { nm: n, fmt, s, e: en }); data.msg = code ? `Created. Share the code ${code} with your friends.` : "Couldn't create it. Try again later."; if (code) { lsS('cc_social', 1); pushCard(true); } }); }
    });
  }
  document.documentElement.classList.add('chOpen'); void W.offsetWidth; W.classList.add('on'); render();
}
function close() { if (!W) return; W.classList.remove('on'); document.documentElement.classList.remove('chOpen'); }
window.ccFriends = open;
document.addEventListener('click', e => { if (e.target.closest('[data-friends]')) { const w = document.querySelector('.pgWrap.on'); if (w) { w.classList.remove('on'); } open(); } });
// ways in: the Home coach card, and Your progress
new MutationObserver(() => {
  const c = document.getElementById('homeCoach'); if (c && !c.querySelector('[data-friends]')) c.insertAdjacentHTML('beforeend', '<button type="button" class="btn ghost hcOpen" data-friends>Friends and competitions</button>');
  const p = document.querySelector('.pgWrap .lvSec'); if (p && !p.querySelector('[data-friends]')) p.insertAdjacentHTML('beforeend', '<button type="button" class="chip" data-friends>Friends and competitions</button>');
}).observe(document.body, { childList: true, subtree: true });
})();
