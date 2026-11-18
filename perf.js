// Caddy Coach: performance. The report after every round, the "Your progress" dashboard and club consistency in My bag.
// Everything is worked out on the phone from what the golfer recorded (roundreport.js does the sums).
(function () {
'use strict';
if (typeof RoundReport === 'undefined') return;
const has = n => typeof window[n] === 'function';
const E = t => (typeof esc === 'function' ? esc(String(t)) : String(t));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const thru = r => { try { return tally(r.holes || []).thru; } catch (_) { return 0; } };
const dateOf = r => String(r.date || '') + String(r.finishedAt || r.createdAt || '');
const fmtD = d => { try { return new Date(String(d).length <= 10 ? d + 'T12:00:00' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };

// ---------- the report after a round ----------
function reportFor(r, rounds) {
  const prev = (rounds || []).filter(x => x !== r && x.id !== r.id && thru(x) >= 9 && dateOf(x) < dateOf(r)).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  let pts = null, sg = null;
  try { const nt = rtNet(r); if (nt) pts = nt.pts; } catch (_) {}
  try { sg = sgSum([r]); } catch (_) {}
  return RoundReport.build(r, prev, { pts, sg });
}
window.ccRoundReport = reportFor;
function reportHTML(rep) {
  if (!rep || !rep.overall || !rep.overall.holes) return '';
  const o = rep.overall, tp = o.toPar === 0 ? 'level par' : (o.toPar > 0 ? '+' : '') + o.toPar;
  const act = p => p.kind === 'drill' ? `<button type="button" class="chip" data-drill="${E(p.id)}">${E(p.label)}</button>`
    : p.kind === 'task' ? `<button type="button" class="chip" data-go="3">${E(p.label)}</button>` : `<p class="rrTip">${E(p.label)}</p>`;
  return `<div class="card rrCard"><p class="rtLab" style="margin-top:0">Your round report</p>
   <div class="rrHead"><b>${o.score}</b><span>${tp} over ${plural(o.holes, 'hole')}${o.pts != null ? ` · ${o.pts} points` : ''}</span></div>
   ${o.vsAvg != null ? `<p class="rrVs ${o.vsAvg < 0 ? 'g-good' : o.vsAvg > 0 ? 'g-bad' : ''}">${o.vsAvg === 0 ? 'Right on your usual score' : `${Math.abs(o.vsAvg)} shots ${o.vsAvg < 0 ? 'better' : 'worse'} than your usual (per 18)`}</p>` : ''}
   ${rep.good.length ? `<h3>What went well</h3><ul>${rep.good.map(x => `<li>${E(x)}</li>`).join('')}</ul>` : ''}
   ${rep.improve.length ? `<h3>To work on</h3><ul>${rep.improve.map(x => `<li>${E(x)}</li>`).join('')}</ul>` : ''}
   ${rep.biggest ? `<h3>Biggest chance to save shots</h3><p>${E(rep.biggest.text)}</p>` : ''}
   ${rep.plan.length ? `<h3>Practise before your next round</h3><div class="chips">${rep.plan.map(act).join('')}</div>` : ''}
   ${rep.target ? `<div class="rrTarget"><span>Target for next round</span><b>${E(rep.target)}</b></div>` : ''}
   ${rep.missing.map(m => `<p class="chMiss">${E(m)}</p>`).join('')}
   <p class="chEv">${E(rep.basis)}</p>
   <button type="button" class="btn ghost rrAsk" data-coach="How did my last round go?">Ask your coach about this round</button></div>`;
}
// earlier rounds for the comparison: the app's list if it's loaded, otherwise loaded here and the screen redrawn
let ROUNDS = null, loading = false;
function allRs() {
  const r = typeof RT !== 'undefined' && RT.rounds; if (r && r.length) return r;
  if (!ROUNDS && !loading && typeof RStore !== 'undefined') {
    loading = true;
    RStore.list().then(l => { ROUNDS = l || []; loading = false; if (ROUNDS.length && typeof rtRender === 'function' && typeof RT !== 'undefined' && (RT.view === 'done' || RT.detail)) rtRender(); }).catch(() => { loading = false; });
  }
  return ROUNDS || [];
}
if (typeof rtFinish === 'function') {   // a new round changes the history
  const base = window.rtFinish;
  window.rtFinish = async function () { ROUNDS = null; return base.apply(this, arguments); };
}
if (has('rtDoneHTML')) {
  const base = window.rtDoneHTML;
  window.rtDoneHTML = function () { const h = base.apply(this, arguments); try { return reportHTML(reportFor(RT.doneRound, allRs())) + h; } catch (e) { console.warn('report', e); return h; } };
}
if (has('rtDetailHTML')) {
  const base = window.rtDetailHTML;
  window.rtDetailHTML = function () {
    const h = base.apply(this, arguments);
    try { const card = reportHTML(reportFor(RT.detail, allRs())); const i = h.indexOf('</div>') + 6; return card ? h.slice(0, i) + card + h.slice(i) : h; } catch (e) { console.warn('report', e); return h; }
  };
}

// ---------- "Your progress" ----------
function spark(vals, opt) {
  opt = opt || {}; const n = vals.length; if (n < 2) return '';
  const W = 300, H = 64, lo = Math.min(...vals), hi = Math.max(...vals), span = (hi - lo) || 1;
  const x = i => 8 + i * (W - 16) / (n - 1), y = v => opt.invert ? 8 + (v - lo) / span * (H - 16) : H - 8 - (v - lo) / span * (H - 16);
  return `<svg class="pgSpark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${E(opt.label || '')}: from ${vals[0]} to ${vals[n - 1]}"><polyline points="${vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(n - 1).toFixed(1)}" cy="${y(vals[n - 1]).toFixed(1)}" r="4.5" fill="currentColor"/></svg>`;
}
const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
const r1 = x => Math.round(x * 10) / 10;
async function progressData() {
  const D = { series: {}, bests: [], measures: [] };
  // rounds, oldest first
  let rs = []; try { rs = ((await allRounds()) || []).filter(r => thru(r) >= 9).sort((a, b) => dateOf(a).localeCompare(dateOf(b))); } catch (_) {}
  const st = rs.map(r => ({ r, s: RoundReport.stats(r.holes) }));
  const pick = (f, ok) => st.filter(x => ok(x.s)).map(x => ({ v: f(x.s), d: x.r.date }));
  D.series.score = pick(s => Math.round(s.score / s.holes * 18), s => s.holes >= 9);
  D.series.putts = pick(s => Math.round(s.putts / s.pN * 18), s => s.pN >= 6);
  D.series.fw = pick(s => Math.round(s.fw / s.fwN * 100), s => s.fwN >= 6);
  D.series.gir = pick(s => Math.round(s.gir / s.girN * 100), s => s.girN >= 6);
  D.series.ud = pick(s => Math.round(s.ud / s.udN * 100), s => s.udN >= 3);
  // swings, oldest first
  let sw = []; try { sw = ((await Store.list()) || []).filter(e => e.overall != null).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))); } catch (_) {}
  D.series.swing = sw.map(e => ({ v: e.overall, d: e.createdAt }));
  // handicap after each score
  try { const rec = HcpStore.rec; if (rec && rec.start) { const c = WHS.calc(rec); D.series.hcp = (c.rows || []).slice().reverse().map(row => ({ v: row.hi != null ? row.hi : row.before, d: row.s && row.s.d })).filter(p => p.v != null); D.hi = c.hi; } } catch (_) {}
  // practice
  try { D.weeks = (await practiceWeeks()).size; const s = await practiceStreak(); D.streak = s ? s.n : 0; } catch (_) {}
  // personal bests, only where the data exists
  const full = st.filter(x => x.s.holes === 18);
  if (full.length) { const b = full.reduce((a, x) => x.s.score < a.s.score ? x : a); D.bests.push(['Best 18-hole score', `${b.s.score} (${fmtD(b.r.date)})`]); }
  try { const pts = rs.map(r => ({ r, n: rtNet(r) })).filter(x => x.n && x.n.pts != null); if (pts.length) { const b = pts.reduce((a, x) => x.n.pts > a.n.pts ? x : a); D.bests.push(['Most Stableford points', `${b.n.pts} (${fmtD(b.r.date)})`]); } } catch (_) {}
  if (sw.length) { const b = sw.reduce((a, e) => e.overall > a.overall ? e : a); D.bests.push(['Best swing score', `${b.overall}/10 (${fmtD(b.createdAt)})`]); }
  try { let best = 0; for (const r of rs) for (const h of r.holes || []) for (const s of holeShots(h)) if (s.club === 'D' && s.yds != null && s.yds <= 380 && s.yds > best) best = s.yds; if (best) D.bests.push(['Longest tracked drive', `${best} yds (GPS, includes roll)`]); } catch (_) {}
  // improvement score: each measure's last 5 against the 5 before (at least 3 in each)
  const M = [['score', 'Score per 18', -1, 1], ['putts', 'Putts per 18', -1, 1], ['fw', 'Fairways hit', 1, 5], ['gir', 'Greens in regulation', 1, 5], ['ud', 'Up and downs', 1, 8], ['swing', 'Swing score', 1, 0.3], ['hcp', 'Handicap index', -1, 0.5]];
  for (const [k, name, dir, step] of M) {
    const s = (D.series[k] || []).map(p => p.v); if (s.length < 6) continue;
    const last = s.slice(-5), before = s.slice(-10, -5); if (before.length < 3) continue;
    const ch = (mean(last) - mean(before)) * dir;
    D.measures.push({ name, state: ch >= step ? 'up' : ch <= -step ? 'down' : 'same', from: r1(mean(before)), to: r1(mean(last)) });
  }
  try { if (window.ccSnapshot) D.top = CoachBrain.top3(await ccSnapshot()); } catch (_) {}
  return D;
}
function section(title, pts, opt) {
  opt = opt || {}; const v = (pts || []).map(p => p.v);
  if (v.length < 2) return `<section class="pgSec"><h3>${E(title)}</h3><p class="mut">${E(opt.empty)}</p></section>`;
  const first = v[0], last = v[v.length - 1];
  return `<section class="pgSec"><h3>${E(title)}</h3>${spark(v.slice(-20), { invert: opt.lowerBetter, label: title })}
   <p>${E(opt.say ? opt.say(first, last, v.length) : `${first} → ${last}`)}</p><p class="chEv">Based on ${plural(v.length, opt.unit || 'round')}.${opt.lowerBetter ? ' Lower is better, so the chart goes up as you improve.' : ''}</p></section>`;
}
async function openProgress() {
  let w = document.querySelector('.pgWrap');
  if (!w) {
    w = document.createElement('div'); w.className = 'chWrap pgWrap'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'Your progress');
    w.innerHTML = `<div class="chPanel"><header class="chHead"><div><h2>Your progress</h2><small class="mut">From your own rounds, swings and practice</small></div><button type="button" class="chX" aria-label="Close">✕</button></header><div class="chBody"><p class="mut">Adding it up…</p></div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => { if (e.target.closest('.chX') || e.target.closest('[data-go],[data-drill],[data-coach]')) { w.classList.remove('on'); document.documentElement.classList.remove('chOpen'); } });
  }
  document.documentElement.classList.add('chOpen'); void w.offsetWidth; w.classList.add('on');
  const D = await progressData().catch(e => { console.warn('progress', e); return null; }); if (!D) return;
  const up = D.measures.filter(m => m.state === 'up'), down = D.measures.filter(m => m.state === 'down');
  const per = (a, b) => b < a ? 'down' : b > a ? 'up' : 'level';
  w.querySelector('.chBody').innerHTML = `
   <section class="pgScore"><h3>Improvement</h3>${D.measures.length >= 2 ? `<p class="pgBig"><b>${up.length} of ${D.measures.length}</b> measures improving</p>
     <ul class="pgM">${D.measures.map(m => `<li class="${m.state}"><span>${E(m.name)}</span><small>${m.from} → ${m.to}</small><i>${m.state === 'up' ? 'Better' : m.state === 'down' ? 'Worse' : 'Same'}</i></li>`).join('')}</ul>
     <p class="chEv">Your last 5 rounds or swings against the 5 before, for each measure with enough data. Small changes count as "same".</p>`
     : `<p class="mut">Once you have about 6 rounds or swings, this shows which parts of your game are getting better. Log putts and fairways to get more measures.</p>`}${down.length ? '' : ''}</section>
   ${section('Handicap', D.series.hcp, { lowerBetter: true, unit: 'score', empty: 'Set your handicap and add scores to see it move.', say: (a, b) => `${a} → ${b} (${per(a, b)})` })}
   ${section('Score per 18 holes', D.series.score, { lowerBetter: true, empty: 'Play a round of 9 or more holes to start this chart.', say: (a, b, n) => `From ${a} to ${b} over ${n} rounds.` })}
   ${section('Swing score', D.series.swing, { unit: 'swing', empty: 'Analyse two swings to see your swing score trend.', say: (a, b) => `${a} → ${b} out of 10.` })}
   ${section('Driving: fairways hit', D.series.fw, { empty: 'Log fairway hit or missed on each par 4 and 5.', say: (a, b) => `${a}% → ${b}%.` })}
   ${section('Approach: greens in regulation', D.series.gir, { empty: 'Log your putts and greens show up here.', say: (a, b) => `${a}% → ${b}%.` })}
   ${section('Short game: up and downs', D.series.ud, { empty: 'Log your putts and up-and-downs show up here.', say: (a, b) => `${a}% → ${b}%.` })}
   ${section('Putting: putts per 18', D.series.putts, { lowerBetter: true, empty: 'Log your putts on each hole.', say: (a, b) => `${a} → ${b}.` })}
   <section class="pgSec"><h3>Practice</h3><p>${D.weeks ? `You've practised in ${plural(D.weeks, 'week')}${D.streak ? `, and you're on a ${D.streak}-week streak` : ''}.` : 'Tick off a session in this week\'s plan to start your practice record.'}</p><button type="button" class="chip" data-go="3">This week's plan</button></section>
   ${D.bests.length ? `<section class="pgSec"><h3>Personal bests</h3><dl class="pgBests">${D.bests.map(([k, v]) => `<div><dt>${E(k)}</dt><dd>${E(v)}</dd></div>`).join('')}</dl></section>` : ''}
   ${D.top && D.top.length ? `<section class="pgSec"><h3>Working on now</h3><ol class="pgTop">${D.top.map(t => `<li>${E(t.title)} <small class="mut">${E(t.why)}</small></li>`).join('')}</ol><button type="button" class="chip" data-coach="">Open your coach</button></section>` : ''}`;
}
window.ccProgress = openProgress;
document.addEventListener('click', e => { if (e.target.closest('[data-progress]')) openProgress(); });

// ways in: My rounds and the coach card on Home
if (has('rtListHTML')) {
  const base = window.rtListHTML;
  window.rtListHTML = function () { return `<button type="button" class="btn ghost pgOpen" data-progress>Your progress: handicap, scores and stats</button>` + base.apply(this, arguments); };
}
new MutationObserver(() => {
  const c = document.getElementById('homeCoach'); if (c && !c.querySelector('[data-progress]')) c.insertAdjacentHTML('beforeend', '<button type="button" class="btn ghost hcOpen" data-progress>Your progress</button>');
}).observe(document.getElementById('p0') || document.body, { childList: true, subtree: true });

// ---------- club consistency in My bag ----------
if (has('bagTrackedHTML')) {
  const base = window.bagTrackedHTML;
  window.bagTrackedHTML = function () {
    const h = base.apply(this, arguments);
    try {
      const D = (typeof BG !== 'undefined' && BG.dist) || {}, order = typeof bagOrder === 'function' ? bagOrder(Object.keys(D)) : Object.keys(D);
      const C = RoundReport.clubConsistency(D, order), nm = id => typeof clubName === 'function' ? clubName(id) : id;
      const bag = (BG.bag && BG.bag.yards) || {}, est = Object.keys(bag).filter(id => (bag[id] || {}).carry && !(D[id] && D[id].n >= 1));
      let extra = '';
      if (C.ranked.length >= 2) extra += `<div class="card"><h2>Your most consistent clubs</h2><p class="mut" style="margin:0 0 8px">From clubs with at least 5 GPS-measured shots. A smaller spread means a more reliable distance.</p>
        <ol class="ccList">${C.ranked.map(c => `<li><b>${E(nm(c.id))}</b><span>${c.lo}–${c.hi} yds (${c.spread}-yd spread, ${c.n} shots)</span></li>`).join('')}</ol>
        ${C.tips.map(t => `<p class="hcNote">From about ${t.yds} yds, your ${E(nm(t.good).toLowerCase())} is more consistent than your ${E(nm(t.bad).toLowerCase())}.</p>`).join('')}</div>`;
      else if (Object.keys(D).length) extra += `<p class="mut ccNote">Mark 5 or more shots with a club to see how consistent it is.</p>`;
      if (est.length) extra += `<p class="mut ccNote"><b>Measured</b> distances come from GPS between your marked shots. <b>Your estimate</b> is what you typed in: ${E(est.map(nm).join(', '))}.</p>`;
      return h + extra;
    } catch (e) { console.warn('clubs', e); return h; }
  };
}
})();
