// Caddy Coach: badges, XP, levels and this week's challenges on screen. Gathers the golfer's real records on the phone,
// asks achieve.js what they've earned, and shows it in Your progress, on the Home coach card and as a toast for new badges.
(function () {
'use strict';
if (typeof Achieve === 'undefined') return;
const E = t => (typeof esc === 'function' ? esc(String(t)) : String(t));
const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const thru = r => { try { return tally(r.holes || []).thru; } catch (_) { return 0; } };

async function summary() {
  const s = { now: Date.now() };
  try { s.swings = ((await Store.list()) || []).map(e => ({ at: Date.parse(e.createdAt), view: e.view, overall: e.overall })); } catch (_) { s.swings = []; }
  try {
    s.rounds = ((await allRounds()) || []).filter(r => thru(r) >= 9).map(r => {
      const t = typeof RoundReport !== 'undefined' ? RoundReport.stats(r.holes) : { holes: thru(r), score: 0 };
      return { at: r.finishedAt || Date.parse((r.date || '') + 'T12:00:00') || Date.now(), holes: t.holes, score: t.score, par: t.par, putts: t.putts, pN: t.pN, three: t.three, fw: t.fw, fwN: t.fwN };
    });
  } catch (_) { s.rounds = []; }
  try { s.tests = PR.all().map(r => ({ at: r.at })); s.stagesUp = Object.values(PR.stages()).filter(v => v > 0).length; } catch (_) { s.tests = []; }
  // practice-plan sessions ticked: the plan only keeps this week, so the most ticked each week is remembered here
  try {
    const p = await planGet(), n = planDoneN(p), m = get('cc_plansess', {}), wk = String(Achieve.weekStart(Date.now()));
    if (n > (m[wk] || 0)) { m[wk] = n; put('cc_plansess', m); }
    s.sessions = Object.values(m).reduce((a, b) => a + b, 0); s.planDone = n; s.planTotal = p.sessions.length;
  } catch (_) {}
  try { const st = await practiceStreak(); s.streak = st ? st.n : 0; } catch (_) {}
  try { const rec = HcpStore.rec; if (rec && rec.start) s.hcp = { start: rec.start.hi, hi: WHS.calc(rec).hi }; } catch (_) {}
  s.traced = !!get('cc_lastflight', null);
  try { s.gripSeen = !!localStorage.getItem('cc_seen_p4'); s.setupSeen = !!localStorage.getItem('cc_seen_p5'); } catch (_) {}
  // "fixed it": a fault in at least 2 of the swings before your last two, and in neither of your last two
  try {
    if (window.ccSnapshot) {
      const sn = await ccSnapshot(), sw = sn.swings || [];
      if (sw.length >= 4) {
        const recent = new Set(sw.slice(0, 2).flatMap(x => x.faults.map(f => f.id))), cnt = {};
        for (const x of sw.slice(2, 8)) for (const f of x.faults) cnt[f.id] = (cnt[f.id] || { n: 0, t: f.title }), cnt[f.id].n++;
        const fx = Object.entries(cnt).find(([id, v]) => v.n >= 2 && !recent.has(id)); if (fx) s.fixedFault = fx[1].t;
      }
    }
  } catch (_) {}
  return s;
}
async function state(record) {   // only the Home strip records badges as announced, so a toast is never missed
  const s = await summary(), B = Achieve.badges(s), X = Achieve.xp(s), L = Achieve.level(X.total), C = Achieve.challenges(s);
  // remember when each badge was first seen earned; the very first run records them quietly
  const saved = get('cc_badges', null), now = Date.now(), ids = B.filter(b => b.earned).map(b => b.id);
  const fresh = Achieve.newlyEarned(ids, saved), keep = Object.assign({}, saved || {});
  for (const id of ids) if (!keep[id]) keep[id] = now;
  if (record || !saved) put('cc_badges', keep);
  return { s, B, X, L, C, fresh, when: keep };
}
window.ccAchieve = () => state(false);

// ---------- the section in Your progress ----------
const fmtD = t => { try { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
function sectionHTML(A) {
  const L = A.L, pct = L.to ? Math.round((A.X.total - L.from) / (L.to - L.from) * 100) : 100, got = A.B.filter(b => b.earned), todo = A.B.filter(b => !b.earned).sort((a, b) => b.have / b.need - a.have / a.need);
  return `<section class="pgSec lvSec"><div class="lvTop"><span class="lvN">${L.n}</span><div><h3>${E(L.name)}</h3><small class="mut">${A.X.total} XP${L.to ? ` · ${L.to - A.X.total} to ${E(L.nextName)}` : ' · top level'}</small></div></div>
   <div class="lvBar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="XP to next level"><i style="width:${pct}%"></i></div>
   <p class="chEv">XP comes only from real golf: swings analysed (50), rounds (100), drill tests (20), practice sessions (40) and badges (25).</p>
   <h4>This week's challenges</h4><ul class="lvCh">${A.C.map(c => `<li class="${c.done ? 'done' : ''}"><span>${c.done ? '✓' : `${c.have}/${c.need}`}</span>${E(c.title)}</li>`).join('')}</ul>
   <h4>Badges · ${got.length} of ${A.B.length}</h4>
   <div class="bdGrid">${got.map(b => `<div class="bd on"><b>${E(b.name)}</b><small>${A.when[b.id] ? 'Earned ' + fmtD(A.when[b.id]) : 'Earned'}</small></div>`).join('')}
    ${todo.map(b => `<div class="bd"><b>${E(b.name)}</b><small>${E(b.how)}${b.need > 1 ? ` · ${b.have} of ${b.need}` : ''}</small></div>`).join('')}</div></section>`;
}
if (typeof window.ccProgress === 'function') {
  const base = window.ccProgress;
  window.ccProgress = async function () {
    await base.apply(this, arguments);
    const body = document.querySelector('.pgWrap .chBody'); if (!body) return;
    const A = await state().catch(() => null); if (!A) return;
    const old = body.querySelector('.lvSec'); if (old) old.remove();
    body.insertAdjacentHTML('afterbegin', sectionHTML(A));
  };
}

// ---------- the strip on the Home coach card, and toasts for new badges ----------
async function homeStrip() {
  const c = document.getElementById('homeCoach'); if (!c) return;
  const A = await state(true).catch(() => null); if (!A) return;
  const done = A.C.filter(x => x.done).length;
  let el = c.querySelector('.lvStrip'); if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'lvStrip'; el.setAttribute('data-progress', ''); const top = c.querySelector('.hcTop'); if (top) top.after(el); else c.prepend(el); }
  el.innerHTML = `<span class="lvN sm">${A.L.n}</span><span><b>${E(A.L.name)}</b> · ${A.X.total} XP</span><span class="mut">${done} of ${A.C.length} challenges this week</span>`;
  for (const id of A.fresh.slice(0, 2)) {
    const b = A.B.find(x => x.id === id); if (!b) continue;
    try { if (window.ccHaptic) ccHaptic('success'); } catch (_) {}
    if (typeof toast === 'function') toast(`Badge earned: ${b.name}`);
    try { if (window.ccTrackX) ccTrackX('badge', id); } catch (_) {}
  }
}
let t = 0;
const later = () => { clearTimeout(t); t = setTimeout(homeStrip, 400); };
new MutationObserver(m => { if (m.some(x => [...x.addedNodes].some(n => n.id === 'homeCoach' || (n.nodeType === 1 && n.closest && n.closest('#homeCoach'))))) later(); })
  .observe(document.getElementById('p0') || document.body, { childList: true, subtree: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) later(); });
setTimeout(later, 2500);
})();
