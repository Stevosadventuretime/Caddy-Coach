// Caddy Coach: "Your coach". Gathers the golfer's own data on the phone into a snapshot, asks coachbrain.js, and shows
// the answers with what they're based on. Nothing leaves the phone. Ways in: a card on Home, a button on swing results.
(function () {
'use strict';
if (typeof CoachBrain === 'undefined') return;
const has = n => typeof window[n] === 'function';
const fmtDate = t => { try { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
const drillOf = id => { try { return drillsForCheck(id).slice(0, 2).map(d => ({ id: d.id, name: d.name })); } catch (_) { return []; } };
const pct = (a, b) => b ? Math.round(a / b * 100) : null;

// ---------- the golfer's data, gathered on the phone ----------
async function snapshot() {
  const s = { golfer: Object.assign({ hand: typeof Hand !== 'undefined' ? Hand.get() : 'right' }, (window.ccGolfer && ccGolfer()) || {}) };
  // swings: newest first; measurements from the 8 newest
  let idx = []; try { idx = ((await Store.list()) || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); } catch (_) {}
  s.swingCount = idx.length;
  const det = [];
  for (const e of idx.slice(0, 8)) { const d = await Store.detail(e.id).catch(() => null); if (d && d.metrics) det.push({ e, m: d.metrics }); }
  s.swings = det.map(({ e, m }) => {
    const C = swingChecks(m), F = SwingMetrics.faults(C, m.miss);
    return { id: e.id, date: fmtDate(e.createdAt), at: Date.parse(e.createdAt), view: m.view, overall: e.overall, checkIds: C.map(c => c.id),
      faults: F.slice(0, 3).map(f => ({ id: f.id, title: plainAdvice(f).title, drills: drillOf(f.id) })) };
  });
  // faults that keep coming back: top-3 fault in at least 2 of the last 5 swings from the same angle
  const tally = new Map();
  for (const sw of s.swings.slice(0, 5)) for (const f of sw.faults) { const t = tally.get(f.id) || Object.assign({ n: 0 }, f); t.n++; tally.set(f.id, t); }
  s.recurring = [...tally.values()].filter(x => x.n >= 2).sort((a, b) => b.n - a.n);
  // misses: which causes show up in this golfer's swings, and which the camera angles used couldn't check
  s.misses = {};
  const seenIds = new Set(s.swings.flatMap(x => x.checkIds)), faultIds = new Set(s.swings.slice(0, 3).flatMap(x => x.faults.map(f => f.id)));
  for (const [k, M] of Object.entries(SwingMetrics.MISSES || {})) {
    const links = M.links.map(([id, , w, why]) => ({ id, w, why, name: (() => { try { return plainName({ id, name: (SwingMetrics.CHECKS.find(c => c.id === id) || {}).name || id }); } catch (_) { return id; } })(),
      found: faultIds.has(id), checkable: seenIds.has(id) })).sort((a, b) => (b.found - a.found) || (b.w - a.w));
    const ds = []; for (const l of links.filter(l => l.found).concat(links)) { for (const d of drillOf(l.id)) if (!ds.some(x => x.id === d.id)) ds.push(d); if (ds.length >= 3) break; }
    s.misses[k] = { name: M.name, links, drills: ds };
  }
  try {
    const f = lsGet('cc_lastflight', null);
    if (f && Date.now() - f.t < 30 * 864e5 && typeof Coach !== 'undefined') s.lastFlight = { matches: Coach.missFromFlight(f.shape), face: f.faceTxt, path: f.pathTxt, when: fmtDate(f.t) };
  } catch (_) {}
  // swing trend from the golfer's most-used camera angle: last 30 days, or 90 if that's too few
  try {
    const view = (s.swings[0] || {}).view;
    if (view) {
      const same = det.filter(x => x.m.view === view);
      let win = 30, pick = same.filter(x => Date.now() - Date.parse(x.e.createdAt) < 30 * 864e5);
      if (pick.length < 2) { win = 90; pick = same.filter(x => Date.now() - Date.parse(x.e.createdAt) < 90 * 864e5); }
      if (pick.length < 2) { win = 0; pick = same; }
      if (pick.length >= 2) {
        const last = pick[0], first = pick[pick.length - 1], P = SwingMetrics.progress(last.m, first.m, view) || { better: [], worse: [] };
        const nm = o => plainName({ id: o.id, name: o.name });
        s.trend = { n: pick.length, view, window: win, first: first.e.overall, last: last.e.overall, from: fmtDate(first.e.createdAt), to: fmtDate(last.e.createdAt),
          better: P.better.map(nm), worse: P.worse.map(nm) };
      }
      const refId = lsGet('cc_refswing', null), ref = refId && det.find(x => x.e.id === refId);
      if (ref && det[0] && ref !== det[0] && ref.m.view === det[0].m.view) {
        const P = SwingMetrics.progress(det[0].m, ref.m, ref.m.view) || { better: [], worse: [] };
        s.reference = { text: `Against your reference swing (${fmtDate(ref.e.createdAt)}): ${P.better.length || P.worse.length ? `${P.better.length} position${P.better.length === 1 ? '' : 's'} better, ${P.worse.length} worse` : 'no clear change'}.` };
      }
    }
  } catch (_) {}
  // rounds: the last 10 played to at least 9 holes
  try {
    const rs = ((await allRounds()) || []).filter(r => tally_(r).thru >= 9).sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || ''))).slice(0, 10);
    if (rs.length) {
      const holes = rs.flatMap(r => r.holes || []), st = rtStats(holes), g = sgSum(rs);
      const per18 = rs.map(r => { const t = tally_(r); return t.thru ? t.total / t.thru * 18 : null; }).filter(x => x != null);
      s.rounds = { n: rs.length, avg: per18.length ? Math.round(per18.reduce((a, b) => a + b, 0) / per18.length) : null,
        stats: { fwPct: pct(st.fw, st.fwN), girPct: pct(st.gir, st.girN), udPct: pct(st.ud, st.udN), sandPct: pct(st.sand, st.sandN),
          puttsPer18: st.pN ? Math.round(st.putts / st.pN * 18) : null, threePutts: st.three, missSide: st.fl > st.fr * 1.5 ? 'left' : st.fr > st.fl * 1.5 ? 'right' : '' },
        sg: { tee: g.tee, app: g.app, arg: g.arg, putt: g.putt, full: g.full } };
      try { if (window.ccRoundReport) { s.lastReport = ccRoundReport(rs[0], rs); s.lastReportWhen = fmtDate(rs[0].date ? rs[0].date + 'T12:00:00' : rs[0].finishedAt); } } catch (_) {}
    }
  } catch (_) {}
  try { const rec = HcpStore.rec; if (rec && rec.start) s.hcp = { hi: WHS.calc(rec).hi, start: rec.start.hi, scores: (rec.scores || []).length }; } catch (_) {}
  try { s.goals = goalsGet(); } catch (_) { s.goals = []; }
  try { if (window.ccAchieve && !snapshot.inAchieve) { snapshot.inAchieve = true; s.achieve = await ccAchieve(); } } catch (_) {} finally { snapshot.inAchieve = false; }
  try { s.bagN = BG.bag && BG.bag.yards ? Object.values(BG.bag.yards).filter(y => y && y.carry).length : 0; } catch (_) { s.bagN = 0; }
  try {
    const p = await planGet(), i = p.sessions.findIndex((x, j) => !p.done['s' + j]);
    s.practice = { total: p.sessions.length, done: planDoneN(p), next: i >= 0 ? { title: p.sessions[i].title, why: p.sessions[i].why } : null };
    const st = await practiceStreak().catch(() => null); if (st) s.practice.streak = st.n;
    const fz = typeof PR !== 'undefined' && PR.focus(); if (fz && Coach.focusActive(fz)) s.practice.focus = fz.title || fz.name || '';
  } catch (_) {}
  return s;
}
const tally_ = r => { try { return tally(r.holes || []); } catch (_) { return { thru: 0, total: 0 }; } };

// ---------- the screen ----------
let panel = null, snap = null, thread = [];
const esc_ = t => (typeof esc === 'function' ? esc(String(t)) : String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
function actionHTML(a) {
  if (a.type === 'drill') return `<button type="button" class="chip" data-drill="${esc_(a.id)}">${esc_(a.label)}</button>`;
  if (a.type === 'go') return `<button type="button" class="chip" data-go="${a.page}">${esc_(a.label)}</button>`;
  if (a.type === 'ask') return `<button type="button" class="chip" data-cq="${esc_(a.q)}">${esc_(a.label)}</button>`;
  if (a.type === 'ref') return `<button type="button" class="chip" data-cref>${esc_(a.label)}</button>`;
  return '';
}
function answerHTML(a) {
  return `<div class="chMsg coach"><b class="chT">${esc_(a.title)}</b>${a.points.length ? `<ul>${a.points.map(p => `<li>${esc_(p)}</li>`).join('')}</ul>` : ''}
   ${a.evidence ? `<p class="chEv">${esc_(a.evidence)}</p>` : ''}${a.missing.map(m => `<p class="chMiss">${esc_(m)}</p>`).join('')}
   ${a.actions.length ? `<div class="chips">${a.actions.map(actionHTML).join('')}</div>` : ''}</div>`;
}
function render() {
  if (!panel) return;
  const K = CoachBrain.knows(snap), T = CoachBrain.top3(snap);
  panel.querySelector('.chBody').innerHTML = `
   <details class="chKnow"><summary><b>What your coach knows</b><span class="mut">Everything here is from this phone</span></summary>
    <dl>${K.map(r => `<div><dt>${esc_(r.t)}</dt><dd>${esc_(r.v)}${r.act === 'golfer' ? ' <button type="button" class="link" data-ob-change>Change</button>' : typeof r.act === 'number' ? ` <button type="button" class="link" data-go="${r.act}">Open</button>` : ''}</dd></div>`).join('')}</dl></details>
   <section class="chTop"><h3>Your top ${T.length || 3}</h3>${T.length ? `<ol>${T.map(t => `<li><b>${esc_(t.title)}</b><small>${esc_(t.why)}</small>${t.drill ? `<button type="button" class="chip" data-drill="${esc_(t.drill.id)}">${esc_(t.drill.name)}</button>` : t.ask ? `<button type="button" class="chip" data-cq="${esc_(t.ask)}">Tell me more</button>` : ''}</li>`).join('')}</ol>`
     : `<p class="mut">Analyse a swing or record a round and your top priorities appear here, never more than three at a time.</p>`}</section>
   <section class="chChat" aria-live="polite">${thread.map(m => m.who === 'me' ? `<div class="chMsg me">${esc_(m.text)}</div>` : answerHTML(m.a)).join('')}</section>`;
  const chat = panel.querySelector('.chChat'); if (chat.lastElementChild) chat.lastElementChild.scrollIntoView({ block: 'nearest' });
}
function askQ(q) {
  q = String(q || '').trim(); if (!q || !snap) return;
  thread.push({ who: 'me', text: q }, { who: 'coach', a: CoachBrain.answer(q, snap) });
  thread = thread.slice(-12); render();
}
async function open(q) {
  if (!panel) {
    panel = document.createElement('div'); panel.className = 'chWrap'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Your coach');
    panel.innerHTML = `<div class="chPanel"><header class="chHead"><div><h2>Your coach</h2><small class="mut">Answers from your own swings, rounds and practice · <button type="button" class="link" data-progress>Your progress</button></small></div><button type="button" class="chX" aria-label="Close">✕</button></header>
     <div class="chBody"><p class="mut">Getting your data…</p></div>
     <footer class="chFoot"><div class="chips chQs">${CoachBrain.CHIPS.map(c => `<button type="button" class="chip" data-cq="${esc_(c)}">${esc_(c)}</button>`).join('')}</div>
     <form class="chAsk"><input id="chQ" maxlength="200" autocomplete="off" placeholder="Ask about your game…" aria-label="Ask your coach"><button type="submit" class="btn sm">Ask</button></form></footer></div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      if (e.target.closest('.chX')) { close(); return; }
      const c = e.target.closest('[data-cq]'); if (c) { askQ(c.dataset.cq); return; }
      if (e.target.closest('[data-cref]')) { const id = snap && snap.swings[0] && snap.swings[0].id; if (id) { lsSet('cc_refswing', id); if (typeof toast === 'function') toast('Saved as your reference swing'); } return; }
      if (e.target.closest('[data-go],[data-drill],[data-ob-change]')) close();   // the app's own handlers then open the page
    });
    panel.querySelector('.chAsk').addEventListener('submit', e => { e.preventDefault(); const i = panel.querySelector('#chQ'); askQ(i.value); i.value = ''; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel && panel.classList.contains('on')) close(); });
  }
  document.documentElement.classList.add('chOpen');
  void panel.offsetWidth; panel.classList.add('on');   // force a layout first so the slide-in still animates
  snap = await snapshot().catch(e => { console.warn('coach', e); return { swings: [] }; });
  render();
  if (q) askQ(q);
}
function close() { if (!panel) return; panel.classList.remove('on'); document.documentElement.classList.remove('chOpen'); }
window.ccCoach = open;
window.ccSnapshot = snapshot;
document.addEventListener('click', e => { const b = e.target.closest('[data-coach]'); if (b) open(b.dataset.coach || ''); });

// ---------- ways in: a card on Home, a button on swing results ----------
async function homeCard() {
  const p0 = document.getElementById('p0'); if (!p0) return;
  let el = document.getElementById('homeCoach');
  if (!el) { el = document.createElement('div'); el.className = 'card'; el.id = 'homeCoach'; const after = document.getElementById('homeStats') || document.getElementById('homeRound'); if (after) after.after(el); else p0.prepend(el); }
  const s = await snapshot().catch(() => null); if (!s) return;
  const t = CoachBrain.top3(s)[0];
  el.innerHTML = `<div class="hcTop"><span class="hcIcon" aria-hidden="true"></span><div><h2>Your coach</h2><small class="mut">${t ? `Top priority: ${esc_(t.title)}` : 'Ask anything about your game. Answers come from your own data.'}</small></div></div>
   <div class="chips">${CoachBrain.CHIPS.slice(0, 3).map(c => `<button type="button" class="chip" data-coach="${esc_(c)}">${esc_(c)}</button>`).join('')}</div>
   <button type="button" class="btn ghost hcOpen" data-coach="">Open your coach</button>`;
}
if (has('renderHome')) {
  const base = window.renderHome;
  window.renderHome = function () { const r = base.apply(this, arguments); setTimeout(homeCard, 0); return r; };
}
setTimeout(homeCard, 1200);
if (has('renderLive')) {
  const base = window.renderLive;
  window.renderLive = function () {
    base.apply(this, arguments);
    const res = document.getElementById('results'); if (!res || res.querySelector('.chFromSwing')) return;
    const fl = res.querySelector('.fixList') || res.firstElementChild;
    const b = document.createElement('div'); b.className = 'chFromSwing';
    b.innerHTML = '<button type="button" class="btn ghost" data-coach="Has my swing improved?">Ask your coach about this swing</button>';
    if (fl) fl.after(b); else res.prepend(b);
  };
}
})();
