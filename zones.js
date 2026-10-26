// Fault clips: short looping clips per rated area with colour-coded zones on the body.
// D = {frames:[{t,P:[[x,y]x33],I:[[x,y]x33]}], A:P, T0, times, m, toBall, right, view, W, H, bg:(k)=>Promise<drawable>|null}
(function (root) {
'use strict';
const C = { ok: [47, 212, 111], warn: [245, 184, 46], bad: [255, 90, 74] };
const col = (s, a) => { const c = s === 0 ? C.ok : s === 1 ? C.warn : C.bad; return `rgba(${c[0]},${c[1]},${c[2]},${a == null ? 1 : a})`; };
const mid = (P, a, b) => [(P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2];
const an = P => mid(P, 27, 28), hip = P => mid(P, 23, 24), sh = P => mid(P, 11, 12), wr = P => mid(P, 15, 16);
const tilt = P => { const h = hip(P), s = sh(P); return Math.atan2(s[0] - h[0], h[1] - s[1]); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const DEG = 180 / Math.PI, pct = x => Math.round(Math.abs(x) * 100) + '%';

function arrow(x, a, b, lw) {
  const d = dist(a, b); if (d < lw * 3) return;
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h = Math.min(lw * 4, d * .5);
  x.save(); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = lw; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 3;
  x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0] - Math.cos(ang) * h * .6, b[1] - Math.sin(ang) * h * .6); x.stroke();
  x.beginPath(); x.moveTo(b[0], b[1]); x.lineTo(b[0] - Math.cos(ang - .5) * h, b[1] - Math.sin(ang - .5) * h); x.lineTo(b[0] - Math.cos(ang + .5) * h, b[1] - Math.sin(ang + .5) * h); x.closePath(); x.fill(); x.restore();
}
function circle(x, c, r, fill, stroke, lw, dash) { x.save(); x.beginPath(); x.arc(c[0], c[1], r, 0, 7); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; if (dash) x.setLineDash(dash); x.stroke(); } x.restore(); }
function capsule(x, a, b, w, fill, stroke, lw) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  x.save(); x.beginPath(); x.arc(a[0], a[1], w, ang + Math.PI / 2, ang - Math.PI / 2); x.arc(b[0], b[1], w, ang - Math.PI / 2, ang + Math.PI / 2); x.closePath();
  if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); } x.restore();
}
function wedge(x, c, a0, a1, len, fill, stroke, lw) { // angles measured from vertical-up, clockwise positive
  x.save(); x.beginPath(); x.moveTo(c[0], c[1]);
  for (let k = 0; k <= 12; k++) { const a = a0 + (a1 - a0) * k / 12; x.lineTo(c[0] + Math.sin(a) * len, c[1] - Math.cos(a) * len); }
  x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.setLineDash([lw * 2, lw * 1.5]); x.stroke(); } x.restore();
}
function lineAt(x, c, a, len, stroke, lw, dash) { x.save(); x.strokeStyle = stroke; x.lineWidth = lw; if (dash) x.setLineDash(dash); x.beginPath(); x.moveTo(c[0], c[1]); x.lineTo(c[0] + Math.sin(a) * len, c[1] - Math.cos(a) * len); x.stroke(); x.restore(); }
function band(x, x0, x1, y0, y1, s) { x.save(); x.fillStyle = col(s, .22); x.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); x.strokeStyle = col(s, .9); x.setLineDash([4, 3]); x.lineWidth = 1.5; x.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); x.restore(); }
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
function skel(x, P, lw, a) { x.save(); x.strokeStyle = `rgba(255,255,255,${a})`; x.lineWidth = lw; x.lineCap = 'round';
  for (const [i, j] of BONES) { if (!P[i] || !P[j] || isNaN(P[i][0]) || isNaN(P[j][0])) continue; x.beginPath(); x.moveTo(P[i][0], P[i][1]); x.lineTo(P[j][0], P[j][1]); x.stroke(); }
  const h = sh(P); x.beginPath(); x.moveTo(h[0], h[1]); x.lineTo(P[0][0], P[0][1]); x.stroke(); x.restore(); }

// ---- per-area definitions: window + overlay. Overlay works in frame pixel coords already mapped (mp). ----
function defs(D) {
  const T = D.times, m = D.m, A = D.A, T0 = D.T0, end = D.frames[D.frames.length - 1].t, fo = D.view === 'face-on';
  const headOff = [A[0][0] - an(A)[0], A[0][1] - an(A)[1]], hipOff = hip(A)[0] - an(A)[0], tiltA = tilt(A);
  const lead = D.right ? [11, 13, 15] : [12, 14, 16];
  const hipZone = (s, f, mp, k, lw, tol) => {
    const P = f.P, tx = an(P)[0] + hipOff, h = hip(P), half = tol * T0;
    const off = fo ? Math.abs(h[0] - tx) / T0 : (h[0] - tx) * D.toBall / T0;
    const sev = fo ? (off <= 0.1 ? 0 : off <= 0.18 ? 1 : 2) : (off <= 0.04 ? 0 : off <= 0.1 ? 1 : 2);
    const a = mp([tx - half, h[1] - 0.35 * T0]), b = mp([tx + half, h[1] + 0.3 * T0]);
    band(s, a[0], b[0], a[1], b[1], 0);
    const hp = mp(h), l = mp(P[23]), r = mp(P[24]);
    capsule(s, l, r, 0.11 * T0 * k, col(sev, .45), col(sev), lw);
    circle(s, hp, lw * 1.6, col(sev), null);
    if (sev) arrow(s, hp, mp([tx, h[1]]), lw);
    return { sev, label: fo ? `Hips ${pct(off)} sideways` : (off > 0 ? `Hips ${pct(off)} toward ball` : 'Hips held back') };
  };
  const handsZone = (s, f, mp, k, lw, from, to) => {
    const P = f.P, h = hip(P), S = sh(P), Tl = dist(h, S) || T0, w = wr(P), hh = (h[1] - w[1]) / Tl;
    if (f.t < from || (to != null && f.t > to)) return null;
    const a = mp([S[0] - 0.7 * T0, h[1] - 1.0 * Tl]), b = mp([S[0] + 0.7 * T0, h[1] - 1.45 * Tl]);
    band(s, a[0], b[0], a[1], b[1], 0);
    const sev = hh >= 0.95 ? 0 : hh >= 0.8 ? 1 : 2;
    circle(s, mp(w), lw * 3, col(sev, .55), col(sev), lw);
    if (sev) arrow(s, mp(w), mp([w[0], h[1] - 1.05 * Tl]), lw);
    return { sev, hh };
  };
  const spineZone = (s, f, mp, k, lw, target, tol) => {
    const P = f.P, h = hip(P), cur = tilt(P), dd = Math.abs(cur - target) * DEG, sev = dd <= tol ? 0 : dd <= tol * 2 ? 1 : 2, L = 1.45 * T0 * k, hp = mp(h);
    wedge(s, hp, target - tol / DEG, target + tol / DEG, L, col(0, .22), col(0, .9), lw * .8);
    lineAt(s, hp, target, L, col(0), lw, [lw * 2, lw * 1.5]);
    capsule(s, hp, mp(sh(P)), 0.13 * T0 * k, col(sev, .32), null);
    lineAt(s, hp, cur, L, col(sev), lw * 1.6);
    return { sev, cur: Math.round(Math.abs(cur) * DEG) };
  };
  const out = {};
  out['Head stability'] = { win: [T.address - 0.05, T.impact + 0.1], draw(s, f, mp, k, lw, fi, F) {
    const P = f.P, tgt = [an(P)[0] + headOff[0], an(P)[1] + headOff[1]], d = dist(P[0], tgt) / T0, sev = d <= 0.08 ? 0 : d <= 0.15 ? 1 : 2;
    circle(s, mp(tgt), 0.08 * T0 * k, col(0, .28), col(0), lw, [lw * 2, lw * 1.5]);
    s.save(); s.strokeStyle = 'rgba(255,255,255,.7)'; s.lineWidth = lw * .7; s.beginPath();
    F.slice(0, fi + 1).forEach((g, j) => { const p = mp(g.P[0]); j ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]); }); s.stroke(); s.restore();
    const hr = Math.max(0.1 * T0, dist(P[7], P[8]) * .7) * k;
    circle(s, mp(P[0]), hr, col(sev, .38), col(sev), lw * 1.2);
    if (sev) arrow(s, mp(P[0]), mp(tgt), lw);
    return { sev, label: `Head ${pct(d)} from start` };
  } };
  out['Spine angle'] = fo ? { win: [T.top - 0.05, T.impact + 0.2], draw: (s, f, mp, k, lw) => hipZone(s, f, mp, k, lw, 0.1) }
    : { win: [T.takeaway - 0.05, T.impact + 0.15], draw(s, f, mp, k, lw) { const r = spineZone(s, f, mp, k, lw, tiltA, 5); r.label = `Spine ${r.cur}° · start ${Math.round(Math.abs(tiltA) * DEG)}°`; return r; } };
  out['Setup posture'] = { win: [Math.max(0, T.address - 0.4), T.takeaway + 0.05], draw(s, f, mp, k, lw) {
    const P = f.P; let r = { sev: 0, label: '' };
    if (!fo) { const tg = Math.sign(tiltA || 1) * 30 / DEG; r = spineZone(s, f, mp, k, lw, tg, 6); r.label = `Spine ${r.cur}° · target 30°`; }
    for (const [hI, kI, aI] of [[23, 25, 27], [24, 26, 28]]) {
      const v1 = [P[hI][0] - P[kI][0], P[hI][1] - P[kI][1]], v2 = [P[aI][0] - P[kI][0], P[aI][1] - P[kI][1]];
      const ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))))) * DEG;
      const ks = Math.abs((m.knee_flex_address_deg || ang) - 158) <= 8 ? 0 : Math.abs((m.knee_flex_address_deg || ang) - 158) <= 14 ? 1 : 2;
      circle(s, mp(P[kI]), 0.07 * T0 * k, col(ks, .4), col(ks), lw);
      if (fo && !r.label) r = { sev: ks, label: `Knee flex ${m.knee_flex_address_deg}°` };
      else if (fo) r.sev = Math.max(r.sev, ks);
    }
    return r;
  } };
  out['Impact position'] = { win: [T.top - 0.05, T.impact + 0.2], draw(s, f, mp, k, lw) { return hipZone(s, f, mp, k, lw, fo ? 0.1 : 0.04); } };
  out['Backswing and top'] = { win: [T.takeaway, Math.min(end, T.top + 0.2)], draw(s, f, mp, k, lw) {
    const P = f.P, nearTop = Math.abs(f.t - T.top) < 0.15, sev = m.lead_arm_top_deg >= 160 ? 0 : m.lead_arm_top_deg >= 145 ? 1 : 2;
    const hz = handsZone(s, f, mp, k, lw, T.top - 0.15, T.top + 0.1);
    if (f.I && nearTop && sev) { s.save(); s.strokeStyle = col(0); s.lineWidth = lw * 1.4; s.setLineDash([lw * 2, lw * 1.5]); s.beginPath(); lead.forEach((j, n) => { const p = mp(f.I[j]); n ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]); }); s.stroke(); s.restore(); }
    capsule(s, mp(P[lead[0]]), mp(P[lead[1]]), 0.05 * T0 * k, nearTop ? col(sev, .5) : 'rgba(255,255,255,.25)', null);
    capsule(s, mp(P[lead[1]]), mp(P[lead[2]]), 0.05 * T0 * k, nearTop ? col(sev, .5) : 'rgba(255,255,255,.25)', null);
    return { sev: nearTop ? Math.max(sev, hz ? hz.sev : 0) : 0, label: `Lead arm ${m.lead_arm_top_deg}° at top` + (hz ? ` · hands ${hz.hh.toFixed(2)}` : '') };
  } };
  out['Tempo and sequencing'] = { win: [Math.max(0, T.takeaway - 0.15), Math.min(end, T.impact + 0.2)], draw(s, f, mp, k, lw, fi, F, cw, ch) {
    s.save(); s.lineWidth = lw * 1.2; s.lineCap = 'round';
    for (let j = 1; j <= fi; j++) { const a = mp(wr(F[j - 1].P)), b = mp(wr(F[j].P)); s.strokeStyle = F[j].t <= T.top ? col(0, .95) : col(1, .95); s.beginPath(); s.moveTo(a[0], a[1]); s.lineTo(b[0], b[1]); s.stroke(); }
    s.restore();
    circle(s, mp(wr(f.P)), lw * 2.2, '#fff', null);
    const t0 = F[0].t, t1 = F[F.length - 1].t, X = v => 8 + (cw - 16) * (v - t0) / (t1 - t0), y = ch - 16;
    s.save(); s.fillStyle = 'rgba(0,0,0,.55)'; s.fillRect(4, y - 8, cw - 8, 16);
    s.fillStyle = col(0, .9); s.fillRect(X(T.takeaway), y - 4, X(T.top) - X(T.takeaway), 8);
    s.fillStyle = col(1, .9); s.fillRect(X(T.top), y - 4, X(T.impact) - X(T.top), 8);
    s.fillStyle = '#fff'; s.fillRect(X(f.t) - 1, y - 8, 2, 16); s.restore();
    const r = m.tempo_ratio, sev = Math.abs(r - 3) <= 0.4 ? 0 : Math.abs(r - 3) <= 0.85 ? 1 : 2;
    return { sev, label: `${r}:1 · back ${m.backswing_s}s · down ${m.downswing_s}s` };
  } };
  out['Balance and finish'] = { win: [T.impact, end], draw(s, f, mp, k, lw, fi, F) {
    const hz = handsZone(s, f, mp, k, lw, T.finish - 0.25);
    let sev = hz ? hz.sev : 0;
    if (f.t >= T.finish) { const fF = F.find(g => g.t >= T.finish) || f, tgt = fF.P[0], d = dist(f.P[0], tgt) / T0, hs = d <= 0.08 ? 0 : d <= 0.15 ? 1 : 2;
      circle(s, mp(tgt), 0.08 * T0 * k, col(0, .25), col(0), lw, [lw * 2, lw * 1.5]); circle(s, mp(f.P[0]), lw * 3, col(hs, .6), col(hs), lw); sev = Math.max(sev, hs); }
    return { sev, label: `Finish hands ${m.finish_hands_height}` + (m.finish_head_wobble != null ? ` · hold ${pct(m.finish_head_wobble)}` : '') };
  } };
  if (fo) out['Hip and shoulder rotation'] = { win: [T.takeaway, Math.min(end, T.top + 0.15)], draw(s, f, mp, k, lw) {
    const P = f.P, ss = m.shoulder_turn_deg >= 80 ? 0 : m.shoulder_turn_deg >= 65 ? 1 : 2, hs = Math.abs(m.hip_turn_deg - 45) <= 12 ? 0 : 1;
    capsule(s, mp(P[11]), mp(P[12]), 0.06 * T0 * k, col(ss, .45), col(ss), lw); capsule(s, mp(P[23]), mp(P[24]), 0.06 * T0 * k, col(hs, .45), col(hs), lw);
    return { sev: Math.max(ss, hs), label: `Shoulders ${m.shoulder_turn_deg}° · hips ${m.hip_turn_deg}°` };
  } };
  return out;
}

// Build one clip: frames within the window, crop, pre-rendered backgrounds.
async function build(D, area, W, H) {
  const def = defs(D)[area]; if (!def) return null;
  const [a, b] = def.win;
  let F = D.frames.filter(f => f.t >= a - 1e-3 && f.t <= b + 1e-3 && f.P && !isNaN(f.P[0][0]));
  if (F.length < 3) return null;
  if (F.length > 45) { const step = (F.length - 1) / 44; F = Array.from({ length: 45 }, (_, j) => F[Math.round(j * step)]); }
  // crop: union of body points over the window, 3:4
  const xs = [], ys = []; F.forEach(f => [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(j => { xs.push(f.P[j][0]); ys.push(f.P[j][1]); }));
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ch = (y1 - y0) * 1.3, cw = ch * W / H; if ((x1 - x0) * 1.35 > cw) { cw = (x1 - x0) * 1.35; ch = cw * H / W; }
  if (D.W && cw <= D.W) cx = Math.min(Math.max(cx, cw / 2), D.W - cw / 2); if (D.H && ch <= D.H) cy = Math.min(Math.max(cy, ch / 2), D.H - ch / 2);
  const crop = { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch };
  const bgs = [];
  const bs = D.bgScale || 1;
  if (D.bg) for (const f of F) { const src = await D.bg(f); if (!src) { bgs.push(null); continue; } const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(src, crop.x * bs, crop.y * bs, crop.w * bs, crop.h * bs, 0, 0, W, H); bgs.push(c); }
  return { def, F, crop, bgs, W, H };
}
function render(clip, c, fi) {
  const { def, F, crop, bgs, W, H } = clip, x = c.getContext('2d'), k = c.width / crop.w, mp = p => [(p[0] - crop.x) * k, (p[1] - crop.y) * k], lw = Math.max(1.5, c.width / 110);
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (bgs[fi]) { x.drawImage(bgs[fi], 0, 0, c.width, c.height); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, c.width, c.height); }
  else { x.fillStyle = '#0d130f'; x.fillRect(0, 0, c.width, c.height); }
  skel(x, F[fi].P.map(mp), lw * .9, bgs[fi] ? .55 : .85);
  const r = def.draw(x, F[fi], mp, k, lw, fi, F, c.width, c.height) || { sev: 0, label: '' };
  // label chip
  x.save(); x.font = `600 ${Math.max(10, Math.round(c.width / 17))}px system-ui,sans-serif`; const tw = x.measureText(r.label).width;
  x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(4, 4, Math.min(c.width - 8, tw + 18), Math.round(c.width / 17) + 10);
  circle(x, [12, 4 + (Math.round(c.width / 17) + 10) / 2], 4, col(r.sev), null);
  x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.fillText(r.label, 20, 4 + (Math.round(c.width / 17) + 10) / 2, c.width - 28); x.restore();
}

// Animate every clip canvas in a container; only visible ones are drawn.
const LIVE = new Set(); let raf = 0;
function loop() {
  const now = performance.now();
  for (const it of LIVE) {
    if (!it.c.isConnected) { LIVE.delete(it); continue; }
    if (!it.vis || it.paused) continue;
    const F = it.clip.F, dur = F[F.length - 1].t - F[0].t, t = F[0].t + (((now - it.t0) / 1000 * 0.45) % (dur + 0.5));
    let i = 0; while (i < F.length - 1 && F[i + 1].t <= t) i++;
    if (i !== it.last) { render(it.clip, it.c, i); it.last = i; }
  }
  raf = LIVE.size ? requestAnimationFrame(loop) : 0;
}
const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(es => es.forEach(e => { for (const it of LIVE) if (it.c === e.target) it.vis = e.isIntersecting; }), { rootMargin: '100px' }) : null;
async function attach(container, D) {
  const cs = Array.from(container.querySelectorAll('canvas[data-clip]'));
  for (const c of cs) {
    const area = c.dataset.clip, dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round((c.clientWidth || 150) * dpr), h = Math.round(w * 4 / 3);
    c.width = w; c.height = h;
    let clip = null; try { clip = await build(D, area, w, h); } catch (e) { console.error(e); }
    if (!clip) { c.parentElement && c.parentElement.classList.add('noclip'); c.remove(); continue; }
    const it = { c, clip, t0: performance.now(), vis: !io, paused: false, last: -1 };
    render(clip, c, 0); LIVE.add(it); if (io) io.observe(c);
    c.onclick = () => { it.paused = !it.paused; if (!it.paused) it.t0 = performance.now(); };
    if (!raf) raf = requestAnimationFrame(loop);
  }
}
function stopAll(container) { for (const it of LIVE) if (!container || container.contains(it.c)) LIVE.delete(it); }

const api = { attach, stopAll, build, render, defs };
root.FaultClips = api;
})(this);
