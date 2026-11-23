// Caddy Coach: My Golf Brain, the record. One per golfer on this phone, backed up to their account (kind 'brain') so it
// follows them to a new phone. It holds what the golfer told us, the coach's history and the current focus; swings,
// rounds, practice, handicap and bag are read live from the app's own records (via ccSnapshot in coachhub.js).
(function () {
'use strict';
if (typeof GolfBrainLogic === 'undefined') return;
const L = GolfBrainLogic;
const user = () => (typeof meU === 'function' && meU()) || 'guest';
const key = () => 'cc_brain_' + user();
const get_ = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } };
const put_ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

function load() {
  let b = get_(key(), null);
  if (!b) {   // first time: bring in what the golfer already told us
    b = L.empty();
    const g = get_('cc_golfer', null) || {};
    Object.assign(b.about, { level: g.level || '', goal: g.goal || '', hand: g.hand || (typeof Hand !== 'undefined' ? Hand.get() : '') });
    try { if (typeof goalsGet === 'function') { const hg = goalsGet().find(x => x.type === 'hcp'); if (hg) b.about.target = `Handicap under ${hg.target}`; } } catch (_) {}
    const ref = get_('cc_refswing', null); if (ref) b.refSwing = ref;
    b.planSess = get_('cc_plansess', {}) || {};
    put_(key(), b);
  }
  return b;
}
function save(b, quiet) {
  b.updatedAt = Date.now(); put_(key(), b);
  // keep the older stores in step, so everything that already reads them keeps working
  put_('cc_golfer', Object.assign(get_('cc_golfer', {}) || {}, { level: b.about.level, goal: b.about.goal, hand: b.about.hand || undefined }));
  if (b.refSwing) put_('cc_refswing', b.refSwing); else try { localStorage.removeItem('cc_refswing'); } catch (_) {}
  try { if (!quiet && typeof Backup !== 'undefined' && Backup.on()) Backup.put('brain', 'brain', b); } catch (_) {}
  return b;
}
// a brain coming down from another phone: the newest wins
if (typeof Backup !== 'undefined' && typeof Backup.apply === 'function') {
  const base = Backup.apply.bind(Backup);
  Backup.apply = async function (x) {
    if (!x || x.kind !== 'brain') return base(x);
    if (x.deleted || !x.data) return false;
    const cur = get_(key(), null);
    if (cur && (cur.updatedAt || 0) >= (x.data.updatedAt || 0)) return false;
    put_(key(), x.data); save(x.data, true); return true;
  };
}

// note a piece of advice in the coaching history
function log(entry) { const b = load(); b.history = L.logAdvice(b.history, entry); save(b); }

// bring the current focus up to date from the golfer's real records
async function refresh() {
  const b = load();
  if (!window.ccSnapshot || typeof CoachBrain === 'undefined') return b;
  const s = await ccSnapshot();
  const sw = s.swings || [], lastTwo = sw.slice(0, 2).map(x => (x.faults || []).map(f => f.id));
  const before = b.focus;
  b.focus = L.mergeFocus(b.focus, CoachBrain.top3(s));
  // a swing fault that has dropped out of the focus because it's gone from the last two swings: note it as sorted
  for (const p of before) {
    if (p.kind === 'fault' && !b.focus.some(q => q.id === p.id) && lastTwo.length >= 2 && lastTwo.every(ids => !ids.includes(p.id)))
      b.history = L.logAdvice(b.history, { source: 'swing', text: `Sorted: ${p.title}. It hasn't shown up in your last two swings.`, ref: p.id });
  }
  for (const p of b.focus) {
    const since = sw.filter(x => x.at > p.since).length;
    p.status = L.statusFor(p, { swingsSince: since, lastTwo, roundsSince: 0 });
  }
  save(b); return { brain: b, snap: s };
}
window.ccBrain = { load, save, log, refresh, key };

// ---------- the coach remembers ----------
// every answer worth remembering goes in the history; the snapshot carries the history and focus to the coach
if (typeof CoachBrain !== 'undefined') {
  const base = CoachBrain.answer;
  CoachBrain.answer = function (q, s) {
    const a = base.call(this, q, s);
    try { if (a && a.intent !== 'help' && a.points.length && !/haven't|need at least|can't see|I can help|^Nothing yet/i.test(a.points[0])) log({ source: 'coach', text: `${a.title}: ${a.points[0]}`, ref: a.ref || a.intent }); } catch (_) {}
    return a;
  };
}
if (window.ccSnapshot) {
  const base = window.ccSnapshot;
  window.ccSnapshot = async function () {
    const s = await base.apply(this, arguments);
    try { const b = load(); s.brainHistory = b.history; s.focusNow = b.focus; s.about = b.about; } catch (_) {}
    return s;
  };
}
// after a swing analysis: note the top fix
if (typeof saveAnalysis === 'function') {
  const base = window.saveAnalysis;
  window.saveAnalysis = async function () {
    const r = await base.apply(this, arguments);
    try { const m = RES.R.metrics, F = SwingMetrics.faults(swingChecks(m), m.miss); if (F[0]) log({ source: 'swing', text: `Work on: ${plainAdvice(F[0]).title}`, ref: F[0].id }); } catch (_) {}
    setTimeout(() => refresh().catch(() => {}), 1500);
    return r;
  };
}
// after a round: note the target for next time
if (typeof rtFinish === 'function') {
  const base = window.rtFinish;
  window.rtFinish = async function () {
    const live = typeof RT !== 'undefined' ? RT.live : null;
    const r = await base.apply(this, arguments);
    try { if (live && window.ccRoundReport) { const rep = ccRoundReport(live, (RT.rounds || [])); if (rep && rep.target) log({ source: 'round', text: rep.target, ref: rep.biggest ? 'area:' + rep.biggest.area : 'round' }); } } catch (_) {}
    return r;
  };
}
setTimeout(() => { try { load(); } catch (_) {} }, 1200);
})();
