// Caddy Coach: swing timeline, compare two swings, and patterns across rounds, added to "Your progress" (perf.js).
// All worked out on the phone from the golfer's own swings and rounds (trendlogic.js does the sums).
(function () {
'use strict';
if (typeof TrendLogic === 'undefined') return;
const T = TrendLogic;
const E = t => (typeof esc === 'function' ? esc(String(t)) : String(t));
const fmt = t => { try { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
const STATE = { better: 'Better', worse: 'Worse', same: 'Steady', few: 'Not enough yet' };
const VIEW = { 'face-on': 'Face-on', 'down-the-line': 'Down the line' };
let DATA = null, view = null, showAll = false, pickA = null, pickB = null;

function spark(vals) {
  if (vals.length < 2) return '';
  const W = 90, H = 26, x = i => 3 + i * (W - 6) / (vals.length - 1), y = v => H - 3 - v / 10 * (H - 6);
  return `<svg class="trSpark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

async function load() {
  const out = { swings: [], rounds: [] };
  try {
    const idx = ((await Store.list()) || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 20);
    for (const e of idx) {
      const d = await Store.detail(e.id).catch(() => null); if (!d || !d.metrics || typeof swingChecks !== 'function') continue;
      out.swings.push({ id: e.id, at: Date.parse(e.createdAt), view: d.metrics.view, overall: e.overall, checks: swingChecks(d.metrics) });
    }
  } catch (_) {}
  try { out.rounds = (typeof allRounds === 'function' ? await allRounds() : []) || []; } catch (_) {}
  return out;
}

function swingHTML() {
  const S = DATA.swings, views = Object.keys(VIEW).filter(v => S.some(s => s.view === v));
  if (S.length < 2 || !views.length) return '<p class="mut">Analyse two or more swings from the same camera angle and each part of your swing gets its own timeline here.</p>';
  if (!view || !views.includes(view)) view = views.sort((a, b) => S.filter(s => s.view === b).length - S.filter(s => s.view === a).length)[0];
  const tl = T.swingTimeline(S, view), n = S.filter(s => s.view === view).length;
  const rows = (showAll ? tl : tl.slice(0, 6)).map(t => `<li class="${t.state}"><div><b>${E(t.name)}</b><small>${E(t.first.shown)} → ${E(t.last.shown)}</small></div>${spark(t.points.map(p => p.score))}<i>${STATE[t.state]}</i></li>`).join('');
  return `${views.length > 1 ? `<div class="chips">${views.map(v => `<button type="button" class="chip${v === view ? ' on' : ''}" aria-pressed="${v === view}" data-tr-view="${v}">${VIEW[v]}</button>`).join('')}</div>` : ''}
    <ul class="trList">${rows}</ul>${tl.length > 6 ? `<button type="button" class="link" data-tr-all>${showAll ? 'Show fewer' : `Show all ${tl.length} checks`}</button>` : ''}
    <p class="chEv">Measured from ${n} ${VIEW[view].toLowerCase()} swings. "Better" or "Worse" means your last two swings moved more than a point (out of 10) from your first two, more than the camera's normal wobble.</p>`;
}

function compareHTML() {
  const S = DATA.swings.filter(s => s.view === view).sort((a, b) => b.at - a.at);
  if (S.length < 2) return '';
  if (!pickA || !S.some(s => s.id === pickA)) pickA = S[S.length - 1].id;
  if (!pickB || !S.some(s => s.id === pickB)) pickB = S[0].id;
  const opt = sel => S.map(s => `<option value="${E(s.id)}"${s.id === sel ? ' selected' : ''}>${fmt(s.at)}${s.overall != null ? ` · ${s.overall}/10` : ''}</option>`).join('');
  const c = T.compare(S.find(s => s.id === pickA), S.find(s => s.id === pickB));
  const body = !c.ok ? `<p class="mut">${E(c.why)}</p>` : pickA === pickB ? '<p class="mut">Pick two different swings.</p>'
    : `<p><b>${c.better}</b> better, <b>${c.worse}</b> worse, the rest steady.</p><ul class="trList trCmp">${c.rows.slice(0, 8).map(r => `<li class="${r.state}"><div><b>${E(r.name)}</b><small>${E(r.before)} → ${E(r.after)}</small></div><i>${STATE[r.state]}</i></li>`).join('')}</ul>`;
  return `<section class="pgSec" id="trCmp"><h3>Compare two swings</h3><div class="trPick"><label>Earlier<select data-tr-a>${opt(pickA)}</select></label><label>Later<select data-tr-b>${opt(pickB)}</select></label></div>${body}</section>`;
}

function patternsHTML() {
  const P = T.roundPatterns(DATA.rounds);
  if (!P.patterns.length) return `<p class="mut">${P.n < 3 ? `Record ${P.need} more round${P.need === 1 ? '' : 's'} of 9 holes or more and the habits that only show across several rounds appear here.` : 'Nothing stands out across your recent rounds. That\'s good news: no single habit is costing you.'}</p>`;
  return `<ul class="trPat">${P.patterns.map(p => `<li><b>${E(p.title)}</b><p>${E(p.text)}${p.cost ? ` That's about ${p.cost} shot${p.cost === 1 ? '' : 's'} a round.` : ''}</p><small>${E(p.evidence)}</small></li>`).join('')}</ul>
    <p class="chEv">Worked out from the scores, putts, fairways and penalties you recorded. Log more of each to see more patterns.</p>`;
}

function render(body) {
  let host = body.querySelector('#trHost');
  if (!host) { host = document.createElement('div'); host.id = 'trHost'; const score = body.querySelector('.pgScore'); if (score) score.after(host); else body.prepend(host); }
  host.innerHTML = `<section class="pgSec" id="trSwing"><h3>Swing timeline</h3>${swingHTML()}</section>${compareHTML()}<section class="pgSec" id="trPat"><h3>Patterns across your rounds</h3>${patternsHTML()}</section>`;
}
async function fill(body) {
  if (body.dataset.trBusy) return; body.dataset.trBusy = '1';
  try { DATA = await load(); render(body); } catch (e) { console.warn('trends', e); } finally { delete body.dataset.trBusy; }
}
// "Your progress" redraws its body when it opens; add these sections whenever that happens
new MutationObserver(() => {
  const body = document.querySelector('.pgWrap .chBody');
  if (body && body.querySelector('.pgScore') && !body.querySelector('#trHost')) fill(body);
}).observe(document.body, { childList: true, subtree: true });
document.addEventListener('click', e => {
  const body = document.querySelector('.pgWrap .chBody'); if (!body || !DATA) return;
  const v = e.target.closest('[data-tr-view]'); if (v) { view = v.dataset.trView; pickA = pickB = null; render(body); return; }
  if (e.target.closest('[data-tr-all]')) { showAll = !showAll; render(body); }
});
document.addEventListener('change', e => {
  const body = document.querySelector('.pgWrap .chBody'); if (!body || !DATA) return;
  if (e.target.matches('[data-tr-a]')) { pickA = e.target.value; render(body); } else if (e.target.matches('[data-tr-b]')) { pickB = e.target.value; render(body); }
});
})();
