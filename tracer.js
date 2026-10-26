// Caddy Coach shot tracer: find the ball, detect impact, track the ball in flight, fit a 3D flight and project it.
// Pure functions (no DOM) so they can be tested in node; TracerUI lives in tracer-ui.js.
(function (root) {
'use strict';
const YD = 0.9144;

// ---------- clubs: typical amateur carry (yd) and apex (m) ----------
const CLUBS = [
  ['D', 'Driver', 220, 27], ['3W', '3 wood', 200, 26], ['5W', '5 wood', 185, 26], ['7W', '7 wood', 175, 26],
  ['3H', '3 hybrid', 180, 25], ['4H', '4 hybrid', 170, 25], ['5H', '5 hybrid', 160, 24],
  ['3i', '3 iron', 175, 24], ['4i', '4 iron', 165, 24], ['5i', '5 iron', 155, 24], ['6i', '6 iron', 145, 25], ['7i', '7 iron', 135, 25],
  ['8i', '8 iron', 125, 25], ['9i', '9 iron', 115, 25], ['PW', 'Pitching wedge', 105, 24], ['48', '48° wedge', 95, 23], ['50', '50° wedge', 90, 23],
  ['52', '52° wedge', 85, 23], ['54', '54° wedge', 75, 22], ['56', '56° wedge', 65, 22], ['58', '58° wedge', 55, 20], ['60', '60° wedge', 45, 20],
].map(([id, name, carry, apex]) => ({ id, name, carry, apex }));

// ---------- blobs ----------
// RGBA image -> candidate balls (white / yellow / orange, round, small)
function ballCandidates(data, W, H, opt) {
  opt = opt || {};
  const y0 = Math.floor(H * (opt.top != null ? opt.top : 0.45)), rMin = opt.rMin || 1.5, rMax = opt.rMax || Math.max(6, W * 0.03);
  const m = new Uint8Array(W * H);
  for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4, r = data[o], g = data[o + 1], b = data[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if ((mn > 165 && mx - mn < 45) || (r > 150 && g > 140 && b < Math.min(r, g) * 0.72 && Math.abs(r - g) < 70) || (r > 190 && g > 90 && g < 190 && b < 110)) m[y * W + x] = 1;
  }
  const lab = new Int32Array(W * H), out = [], q = [];
  let id = 0;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || lab[i]) continue;
    id++; let area = 0, sx = 0, sy = 0, x0 = 1e9, x1 = -1, yy0 = 1e9, y1 = -1; q.length = 0; q.push(i); lab[i] = id;
    while (q.length) {
      const j = q.pop(), x = j % W, y = (j - x) / W; area++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < yy0) yy0 = y; if (y > y1) y1 = y;
      if (x > 0 && m[j - 1] && !lab[j - 1]) { lab[j - 1] = id; q.push(j - 1); }
      if (x < W - 1 && m[j + 1] && !lab[j + 1]) { lab[j + 1] = id; q.push(j + 1); }
      if (y > 0 && m[j - W] && !lab[j - W]) { lab[j - W] = id; q.push(j - W); }
      if (y < H - 1 && m[j + W] && !lab[j + W]) { lab[j + W] = id; q.push(j + W); }
    }
    const bw = x1 - x0 + 1, bh = y1 - yy0 + 1, r = Math.sqrt(area / Math.PI), fill = area / (bw * bh), asp = bw / bh;
    if (r < rMin || r > rMax || fill < 0.45 || asp < 0.5 || asp > 2) continue;
    out.push({ x: sx / area + 0.5, y: sy / area + 0.5, r, fill });
  }
  return out;
}
// mean colour inside a disk, and in a ring around it
function patch(data, W, H, c) {
  const R = Math.max(1.5, c.r * 0.8), R2 = c.r * 2.2, R3 = c.r * 3.2; let n = 0, s = [0, 0, 0], m = 0, t = [0, 0, 0];
  for (let y = Math.max(0, Math.floor(c.y - R3)); y <= Math.min(H - 1, Math.ceil(c.y + R3)); y++) for (let x = Math.max(0, Math.floor(c.x - R3)); x <= Math.min(W - 1, Math.ceil(c.x + R3)); x++) {
    const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y), o = (y * W + x) * 4;
    if (d <= R) { n++; s[0] += data[o]; s[1] += data[o + 1]; s[2] += data[o + 2]; }
    else if (d >= R2 && d <= R3) { m++; t[0] += data[o]; t[1] += data[o + 1]; t[2] += data[o + 2]; }
  }
  return { in: s.map(v => v / Math.max(1, n)), ring: t.map(v => v / Math.max(1, m)) };
}
const cdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// series: [{t, p: [patch per candidate]}] -> {cand, tImp, score}: a ball that is visible, then vanishes for good,
// while the rest of the scene stays put (so a moving camera doesn't count).
function findImpact(cands, series, opt) {
  const n = series.length; if (n < 8) return null;
  const info = cands.map((c, k) => {
    const r0 = series[0].p[k].in, contrast = cdist(r0, series[0].p[k].ring);
    if (contrast < 25) return null;
    const thr = Math.max(14, contrast * 0.45);
    return { k, c, contrast, gone: series.map(s => cdist(s.p[k].in, r0) > thr ? 1 : 0) };
  }).filter(Boolean);
  const events = [];
  for (const I of info) {
    const g = I.gone;
    for (let i = 1; i < n; i++) {
      if (!g[i] || g[i - 1]) continue;
      const t = series[i].t;
      const pre = series.map((s, j) => j).filter(j => j < i && series[j].t >= t - 0.5), post = series.map((s, j) => j).filter(j => j > i && series[j].t <= t + 0.9);
      if (pre.length < 2 || post.length < 3 || series[n - 1].t - t < 0.35) continue;
      const pf = pre.filter(j => !g[j]).length / pre.length, gf = post.filter(j => g[j]).length / post.length;
      if (pf < 0.7 || gf < 0.88) continue;
      // stays gone to the end (or at least 2 s)
      const tail = series.map((s, j) => j).filter(j => j > i && series[j].t <= t + 2), tf = tail.filter(j => g[j]).length / Math.max(1, tail.length);
      if (tf < 0.8) continue;
      events.push({ I, i, t, score: pf + gf + tf * 0.5 + Math.min(1, I.contrast / 80) * 0.5 });
    }
  }
  // camera moved: many still things change together
  const out = [], L = opt && opt.L || 1000;
  for (const e of events) {
    // only things well away from this ball count as evidence of the camera moving
    const far = info.filter(o => o !== e.I && Math.hypot(o.c.x - e.I.c.x, o.c.y - e.I.c.y) > 0.25 * L);
    const others = events.filter(o => o.I !== e.I && Math.abs(o.t - e.t) < 0.3 && far.includes(o.I)).length;
    if (others >= Math.max(3, far.length * 0.35)) continue;
    out.push({ cand: e.I.c, k: e.I.k, tImp: (series[e.i - 1].t + series[e.i].t) / 2, i: e.i, score: e.score - others * 0.3, contrast: e.I.contrast });
  }
  out.sort((a, b) => b.score - a.score);
  // one event per place in the picture
  const uniq = []; for (const e of out) if (!uniq.some(u => Math.hypot(u.cand.x - e.cand.x, u.cand.y - e.cand.y) < 3 * e.cand.r && Math.abs(u.tImp - e.tImp) < 0.5)) uniq.push(e);
  return uniq;
}
// refine impact on full-rate grey frames: last frame where the ball patch still matches its look just before
function refineImpact(frames, W, start, tGuess) {
  const R = Math.max(1.5, start.r * 0.8), mean = g => { let s = 0, n = 0; for (let y = Math.floor(start.y - R); y <= Math.ceil(start.y + R); y++) for (let x = Math.floor(start.x - R); x <= Math.ceil(start.x + R); x++) { if (Math.hypot(x + 0.5 - start.x, y + 0.5 - start.y) <= R) { s += g[y * W + x]; n++; } } return s / Math.max(1, n); };
  const ms = frames.map(f => ({ t: f.t, m: mean(f.g) }));
  const before = ms.filter(x => x.t < tGuess - 0.08 && x.t > tGuess - 0.4).map(x => x.m), after = ms.filter(x => x.t > tGuess + 0.15 && x.t < tGuess + 0.6).map(x => x.m);
  if (!before.length || !after.length) return tGuess;
  const mb = before.reduce((a, b) => a + b) / before.length, ma = after.reduce((a, b) => a + b) / after.length, thr = Math.abs(mb - ma) * 0.5;
  if (thr < 6) return tGuess;
  for (let i = 1; i < ms.length; i++) if (ms[i].t > tGuess - 0.15 && Math.abs(ms[i].m - mb) > thr && ms.slice(i, i + 4).every(x => Math.abs(x.m - mb) > thr)) return (ms[i - 1].t + ms[i].t) / 2;
  return tGuess;
}

// the ball's own spot (patches over time, from where the golfer tapped it): when does it stop looking like the ball, for good?
// returns the time between the last frame with the ball and the first without, or null
// what the ball's spot shows in one frame: 'B' the ball, 'G' bare ground (the ball has gone), 'X' something else
// in the way (the clubhead resting over it at address, the golfer's shadow, the swing passing through)
function ballState(p, ref) {
  const contrast = cdist(ref.in, ref.ring), thr = Math.max(12, contrast * 0.45);
  if (cdist(p.in, ref.in) <= thr) return 'B';
  const ch = c => (c[0] + c[1]) / 2 - c[2], gc = ch(ref.ring);
  const grassy = cdist(p.in, ref.ring) < Math.max(25, contrast * 0.3) && Math.abs(ch(p.in) - gc) < Math.max(18, Math.abs(gc) * 0.5);
  return grassy ? 'G' : 'X';
}
function ballGone(series, ref, opt) {
  opt = opt || {}; const n = series.length; if (n < 3) return null;
  const minGone = opt.minGone != null ? opt.minGone : 0.3, needG = opt.needGround != null ? opt.needGround : 0.5;
  const st = series.map(s => ballState(s.p, ref)), g = st.map(x => x === 'B' ? 0 : 1);
  // the ball can be hidden for a while before the swing (the clubhead resting in front of it, a waggle), but after
  // impact it never comes back and the spot shows bare ground
  let best = null;
  for (let i = 1; i < n; i++) {
    if (!g[i] || g[i - 1]) continue;
    const rest = st.slice(i), back = rest.filter(x => x === 'B').length / rest.length, ground = rest.filter(x => x === 'G').length / rest.length;
    const span = series[n - 1].t - series[i].t, tm = (series[i - 1].t + series[i].t) / 2;
    if (back <= 0.08 && ground >= needG && span >= Math.min(minGone, span)) return tm;
    const sc = back + Math.max(0, needG - ground);
    if (!best || sc < best.sc) best = { sc, t: tm };
  }
  return best && best.sc < 0.25 ? best.t : null;
}
// point the flight where the golfer tapped: from behind, left/right in the picture is the start direction;
// from side on, it's how far the ball went
function aimAt(st, target) {
  const s = st.shot, cam = st.cam; if (!cam || !target) return;
  const cf = s.curve / Math.max(1, s.D);
  const u = (az, D) => { const p = project(cam, { x: D, y: D * Math.tan(az) + cf * D, z: 0 }); return p ? p.u : null; };
  const solve = (f, a, b, lo, hi) => { for (let it = 0; it < 30; it++) { const fa = f(a), fb = f(b); if (fa == null || fb == null || Math.abs(fb - fa) < 1e-6) break; const c = Math.max(lo, Math.min(hi, b - fb * (b - a) / (fb - fa))); a = b; b = c; if (Math.abs(f(b) || 0) < 0.3) break; } return b; };
  if (!st.camp || st.camp.beta === 0) { s.az = solve(az => { const v = u(az, s.D); return v == null ? null : v - target.x; }, s.az, s.az + 0.02, -0.4, 0.4); }
  else { const lD = solve(l => { const v = u(s.az, Math.exp(l)); return v == null ? null : v - target.x; }, Math.log(s.D), Math.log(s.D * 1.05), Math.log(15), Math.log(300)); s.D = Math.exp(lD); s.curve = cf * s.D; }
}
// The flight model gives the shape; this small smooth correction (zero at the ball) makes the drawn line pass through
// the ball wherever it was actually seen, and finish where the golfer tapped. Returns {x:[a,b,c], y:[a,b,c]} in picture px.
function fitCorrection(st, obs, target, P3) {
  const rows = []; // [tau, dx, dy, weight]
  const Tf = flightTime(st.shot);
  for (const o of obs || []) { const tau = (o.t - st.t0) / Tf; if (tau <= 0 || tau > 1.05) continue; const p = P3(tau); if (!p) continue; rows.push([tau, o.x - p.u, o.y - p.v, 1]); }
  if (target) { const p = P3(1); if (p) rows.push([1, target.x - p.u, target.y - p.v, Math.max(3, rows.length * 0.5)]); }
  if (!rows.length) return null;
  const B = t => [Math.sqrt(t), t, t * t, t * t * t], n = 4;
  const lam = 1e-4 * rows.reduce((a, r) => a + r[3], 0) + 1e-9, solveN = k => {
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? lam : 0)), b = Array(n).fill(0);
    for (const [t, dx, dy, w] of rows) { const f = B(t), d = k ? dy : dx; for (let i = 0; i < n; i++) { b[i] += w * f[i] * d; for (let j = 0; j < n; j++) A[i][j] += w * f[i] * f[j]; } }
    for (let i = 0; i < n; i++) { let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r; [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } }
    const x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let v = b[i]; for (let c = i + 1; c < n; c++) v -= A[i][c] * x[c]; x[i] = v / A[i][i]; } return x;
  };
  // past the last thing it was fitted to, the correction isn't known: hold it there and ease it away by the landing
  // (a few sightings just after impact mustn't bend the whole flight)
  return { x: solveN(0), y: solveN(1), tmax: Math.min(1, Math.max(...rows.map(r => r[0]))) };
}
const corrAt = (c, tau) => { if (!c) return { x: 0, y: 0 };
  const e = tau => { const f = [Math.sqrt(tau), tau, tau * tau, tau * tau * tau], d = v => v.reduce((a, q, i) => a + q * (f[i] || 0), 0); return { x: d(c.x), y: d(c.y) }; };
  if (c.tmax == null || tau <= c.tmax || c.tmax >= 0.999) return e(tau);
  const m = e(c.tmax), w = Math.max(0, 1 - (tau - c.tmax) / (1 - c.tmax)), s = w * w * (3 - 2 * w); return { x: m.x * s, y: m.y * s }; };
// keep candidates that could be a ball at this golfer's feet: ground level, right size, within reach
// a pose worth trusting: a whole person standing up (head over shoulders over hips over knees over ankles),
// tall enough to be the golfer, and seen clearly. The pose model sometimes 'finds' a person in an empty scene.
function poseOK(P, W, H) {
  if (!P || P.length < 33) return false;
  const m = (a, b) => (P[a].y + P[b].y) / 2, head = Math.min(P[0].y, P[7].y, P[8].y), sh = m(11, 12), hip = m(23, 24), kn = m(25, 26), an = m(27, 28);
  if (!(head < sh && sh < hip && hip < kn && kn < an)) return false;
  // the whole body inside the picture (a 'person' half off the edge is usually the model guessing)
  if ([0, 11, 12, 23, 24, 25, 26, 27, 28].some(i => P[i].x < 0 || P[i].x > W || P[i].y < 0 || P[i].y > H)) return false;
  if (an - head < 0.12 * H) return false;
  const key = [0, 11, 12, 23, 24, 25, 26, 27, 28], vis = key.reduce((s, i) => s + (P[i].vis == null ? 1 : P[i].vis), 0) / key.length;
  return vis > 0.5 && (hip - sh) > 0.15 * (an - head);
}
function filterByBody(cands, P) {
  if (!P) return cands;
  const footY = Math.max(P[27].y, P[28].y, P[31].y, P[32].y), headY = Math.min(P[0].y, P[7].y, P[8].y);
  const bodyH = Math.max(1, footY - headY) / 0.88, feetX = (P[27].x + P[28].x) / 2, rr = 0.0123 * bodyH;
  return cands.filter(c => Math.abs(c.y - footY) < 0.16 * bodyH && c.r > 0.45 * rr && c.r < 2 * rr && Math.abs(c.x - feetX) < 1.1 * bodyH);
}
// candidate balls in one frame, with how ball-like each is (contrast, round, near the feet, clear of the shoes)
function ballSpots(cands, P, data, W, H) {
  let cs = cands.filter(c => c.y > H * 0.35); if (!data) return [];
  let footY = H * 0.88, feetX = W / 2, bodyH = H * 0.45;
  if (P) { const f = filterByBody(cs, P); cs = f; footY = Math.max(P[27].y, P[28].y, P[31].y, P[32].y); bodyH = Math.max(1, footY - Math.min(P[0].y, P[7].y, P[8].y)) / 0.88; feetX = (P[27].x + P[28].x) / 2; }
  const feet = P ? [27, 28, 29, 30, 31, 32].map(i => P[i]) : [], rr = 0.0123 * bodyH, out = [];
  for (const c of cs) {
    const pt = patch(data, W, H, c), con = cdist(pt.in, pt.ring), br = (pt.in[0] + pt.in[1] + pt.in[2]) / 3;
    if (con < 30) continue;
    if (feet.some(f => Math.hypot(f.x - c.x, f.y - c.y) < 0.11 * bodyH)) continue;
    const sc = Math.min(3, con / 50) + c.fill + (br > 150 ? 0.5 : 0) - Math.abs(c.y - footY) / (0.12 * bodyH) - Math.abs(c.x - feetX) / (2.5 * bodyH) - (P ? Math.min(1.5, Math.abs(Math.log(c.r / rr))) : 0);
    out.push({ x: c.x, y: c.y, r: c.r, sc });
  }
  return out;
}
// the same spot in many frames is the ball sitting still; returns {ball, t} with t a frame where it's visible, just before it's hit
function ballFromSamples(samples, P, W, H) {
  const cl = [];
  samples.forEach((s, i) => s.cands.filter(c => c.sc > -1).forEach(c => {
    const k = cl.find(q => Math.hypot(q.x - c.x, q.y - c.y) < Math.max(3, 1.3 * q.r));
    if (k) { k.hits.push(i); k.hs.push(c.sc); k.sc += c.sc; k.n++; k.x += (c.x - k.x) / k.n; k.y += (c.y - k.y) / k.n; k.r += (c.r - k.r) / k.n; }
    else cl.push({ x: c.x, y: c.y, r: c.r, sc: c.sc, n: 1, hits: [i], hs: [c.sc] });
  }));
  if (!cl.length) return null;
  // the ball sits still until it's hit and is gone for the rest of the clip; things that stay all the way through
  // (a ball basket, a tee marker, a sign) aren't it
  const nS = samples.length, tailN = Math.max(1, Math.round(nS * 0.2));
  for (const q of cl) {
    // what's left on the spot after the ball has gone (a tee, a mark on the mat) looks much fainter than the ball did
    const top = Math.max(...q.hs), keep = q.hits.filter((_, j) => q.hs[j] >= Math.max(-0.5, 0.5 * top));
    const u = [...new Set(keep)].sort((a, b) => a - b); q.u = u; const atEnd = u.filter(i => i >= nS - tailN).length;
    // the tell-tale pattern: there in an unbroken run of frames, then gone for good
    let run = 1, br = 1; for (let j = 1; j < u.length; j++) { run = u[j] === u[j - 1] + 1 ? run + 1 : 1; if (run > br) br = run; }
    const goneLater = u[u.length - 1] < nS - 1 && atEnd === 0;
    // (a short clip can end before the shot, so 'still there at the end' only counts against something that was there all along)
    const always = atEnd >= Math.min(2, tailN) && u.length >= Math.max(3, 0.6 * nS);
    q.score = u.length * 0.6 + br * 0.8 + q.sc / q.n - (always ? 100 : 0) + (goneLater && br >= 3 ? 4 : 0); }
  cl.sort((a, b) => b.score - a.score); const b = cl[0];
  // its longest unbroken run of sightings ends at the last frame before the strike
  let best = [b.u[0], b.u[0]], cur = [b.u[0], b.u[0]];
  for (let j = 1; j < b.u.length; j++) { if (b.u[j] === b.u[j - 1] + 1) cur[1] = b.u[j]; else cur = [b.u[j], b.u[j]]; if (cur[1] - cur[0] > best[1] - best[0]) best = cur.slice(); }
  return { ball: { x: b.x, y: b.y, r: b.r }, t: samples[best[1]].t, frames: b.u.length };
}
// the ball at address: a small round bright spot on the ground at the golfer's feet, standing out from the grass or mat
function pickBall(cands, P, data, W, H) {
  let cs = cands.filter(c => c.y > H * 0.35); if (!cs.length) return null;
  let footY = H * 0.88, feetX = W / 2, bodyH = H * 0.45;
  if (P) { const f = filterByBody(cs, P); if (f.length) cs = f; footY = Math.max(P[27].y, P[28].y, P[31].y, P[32].y); bodyH = Math.max(1, footY - Math.min(P[0].y, P[7].y, P[8].y)) / 0.88; feetX = (P[27].x + P[28].x) / 2; }
  let best = null;
  const feet = P ? [27, 28, 29, 30, 31, 32].map(i => P[i]) : [], rr = 0.0123 * bodyH;
  for (const c of cs) {
    const pt = patch(data, W, H, c), con = cdist(pt.in, pt.ring), br = (pt.in[0] + pt.in[1] + pt.in[2]) / 3;
    if (con < 30) continue;
    // white socks and trainers sit right on the feet; the ball is clear of them
    if (feet.some(f => Math.hypot(f.x - c.x, f.y - c.y) < 0.11 * bodyH)) continue;
    const sc = Math.min(3, con / 50) + c.fill + (br > 150 ? 0.5 : 0) - Math.abs(c.y - footY) / (0.12 * bodyH) - Math.abs(c.x - feetX) / (2.5 * bodyH) - (P ? Math.min(1.5, Math.abs(Math.log(c.r / rr))) : 0);
    if (!best || sc > best.sc) best = { sc, x: c.x, y: c.y, r: c.r };
  }
  return best ? { x: best.x, y: best.y, r: best.r } : null;
}
// ---------- in-flight tracking on grey frames ----------
// frames: [{t, g: Uint8Array(W*H)}], start {x,y,r}, tImp. Returns [{t,x,y}] (image px)
function diffBlobs(a, b, c, W, H, roi, thr) {
  const out = [], m = new Uint8Array(W * H), lab = new Int32Array(W * H), q = [];
  for (let y = roi.y0; y < roi.y1; y++) for (let x = roi.x0; x < roi.x1; x++) {
    const i = y * W + x, d = Math.min(Math.abs(b[i] - a[i]), Math.abs(b[i] - c[i]));
    if (d > thr) m[i] = d;
  }
  let id = 0;
  for (let y = roi.y0; y < roi.y1; y++) for (let x = roi.x0; x < roi.x1; x++) {
    const i0 = y * W + x; if (!m[i0] || lab[i0]) continue;
    id++; let area = 0, sx = 0, sy = 0, sw = 0, mx = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; q.length = 0; q.push(i0); lab[i0] = id;
    while (q.length) {
      const j = q.pop(), xx = j % W, yy = (j - xx) / W, w = m[j]; area++; sx += xx * w; sy += yy * w; sw += w; if (w > mx) mx = w;
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      for (const k of [j - 1, j + 1, j - W, j + W]) if (k >= 0 && k < m.length && m[k] && !lab[k] && Math.abs((k % W) - xx) <= 1) { lab[k] = id; q.push(k); }
      if (area > 900) break;
    }
    out.push({ x: sx / sw + 0.5, y: sy / sw + 0.5, area, peak: mx, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out;
}
function trackFlight(frames, W, H, start, tImp, opt) {
  opt = opt || {};
  const r = Math.max(1.5, start.r), maxArea = Math.max(40, Math.PI * (3.2 * r) ** 2), L = Math.max(W, H);
  const roi = { x0: 0, x1: W, y0: 0, y1: Math.min(H, Math.ceil(start.y + 2 * r)) };
  const C = [];
  for (let i = 1; i < frames.length - 1; i++) {
    const f = frames[i];
    if (f.t < tImp - 0.02 || f.t > tImp + (opt.maxT || 2.5)) { C.push(null); continue; }
    const bl = diffBlobs(frames[i - 1].g, f.g, frames[i + 1].g, W, H, roi, opt.thr || 16).filter(b => b.area <= maxArea && Math.max(b.w, b.h) <= Math.max(14, 9 * r));
    C.push({ t: f.t, i, bl });
  }
  const fdt = frames.length > 2 ? (frames[frames.length - 1].t - frames[0].t) / (frames.length - 1) : 1 / 30;
  // distance from point to segment a->b
  const segD = (p, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1, u = Math.max(0, Math.min(1.3, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)); return Math.hypot(a.x + u * vx - p.x, a.y + u * vy - p.y); };
  const all = [];
  for (let s = 0; s < C.length; s++) {
    const cs = C[s]; if (!cs || cs.t > tImp + 0.3 || cs.t <= tImp) continue;
    for (const sd of cs.bl) {
      const dx = sd.x - start.x, dy = sd.y - start.y, d0 = Math.hypot(dx, dy);
      if (sd.y > start.y - 1.5 * r || dy > -Math.abs(dx) * 0.15) continue;
      // it has to set off roughly the way the golfer said it went
      let cosA = 0; if (opt.aim) { const al = Math.hypot(opt.aim.x, opt.aim.y) || 1; cosA = (dx * opt.aim.x + dy * opt.aim.y) / (al * (d0 || 1)); if (cosA < 0.2) continue; }
      // a struck ball leaves fast: at least ~2.5 picture-heights per second
      const launch = d0 / L / Math.max(fdt, cs.t - tImp);
      if (launch < 2.5 || d0 > 0.55 * L) continue;
      const chain = [{ t: cs.t, x: sd.x, y: sd.y }];
      let vel = { x: dx / Math.max(1, (cs.t - tImp) / fdt), y: dy / Math.max(1, (cs.t - tImp) / fdt) }, miss = 0;
      for (let k = s + 1; k < C.length && miss <= 5; k++) {
        const ck = C[k]; if (!ck) break;
        const last = chain[chain.length - 1], gap = Math.max(1, Math.round((ck.t - last.t) / fdt));
        // the ball slows a lot in the picture as it flies away: search between "stopped" and "same speed"
        const far = { x: last.x + vel.x * gap, y: last.y + vel.y * gap }, sp = Math.hypot(vel.x, vel.y);
        const rad = Math.max(5, 0.25 * sp * gap + 4);
        let pick = null, pd = 1e9;
        for (const b of ck.bl) {
          if (Math.hypot(b.x - last.x, b.y - last.y) < 0.5) continue;
          const d = segD(b, last, far); if (d > rad) continue;
          const along = ((b.x - last.x) * vel.x + (b.y - last.y) * vel.y) / (sp || 1);
          if (along < -2) continue;
          const sc = d + Math.abs(along - sp * gap * 0.45) * 0.15;
          if (sc < pd) { pd = sc; pick = b; }
        }
        if (!pick) { miss++; continue; }
        const nv = { x: (pick.x - last.x) / gap, y: (pick.y - last.y) / gap };
        // stop at a sudden jump or a turn back: the ball has been lost and this is something else
        if (chain.length >= 2) {
          const a2 = chain[chain.length - 2], a1 = chain[chain.length - 1], gp = Math.max(1, Math.round((a1.t - a2.t) / fdt));
          const prev = Math.hypot(a1.x - a2.x, a1.y - a2.y) / gp, nsp = Math.hypot(nv.x, nv.y);
          if (nsp > 2.5 * prev + 3) break;
          if (chain.length >= 5 && nsp > 2) {
            const b5 = chain[chain.length - 5], dir = { x: a1.x - b5.x, y: a1.y - b5.y }, dl = Math.hypot(dir.x, dir.y);
            if (dl > 3 && (dir.x * nv.x + dir.y * nv.y) / (dl * nsp) < -0.2) break;
          }
        }
        vel = { x: vel.x * 0.3 + nv.x * 0.7, y: vel.y * 0.3 + nv.y * 0.7 };
        chain.push({ t: ck.t, x: pick.x, y: pick.y }); miss = 0;
      }
      if (chain.length < 3) continue;
      // a real ball keeps moving clearly in its first quarter second after we pick it up
      const early = chain.filter(c => c.t <= chain[0].t + 0.25), move = Math.hypot(early[early.length - 1].x - chain[0].x, early[early.length - 1].y - chain[0].y);
      if (move < 0.03 * L) continue;
      // a ball moves smoothly away from where it started: straight-ish path, distance from the start keeps growing
      // judged on the climb only (the first ~0.7 s): after the top the ball can come back towards where it started in the picture
      const climb = chain.filter(c => c.t <= chain[0].t + 0.7);
      let path = 0, away = 0, steps = 0;
      for (let i = 1; i < climb.length; i++) {
        const st = Math.hypot(climb[i].x - climb[i - 1].x, climb[i].y - climb[i - 1].y); path += st;
        if (st > 0.6) { steps++; if (Math.hypot(climb[i].x - start.x, climb[i].y - start.y) > Math.hypot(climb[i - 1].x - start.x, climb[i - 1].y - start.y)) away++; }
      }
      const straight = climb.length > 1 ? Math.hypot(climb[climb.length - 1].x - climb[0].x, climb[climb.length - 1].y - climb[0].y) / (path || 1) : 0, mono = steps ? away / steps : 0;
      if (straight < 0.55 || mono < 0.7) continue;
      const rise = (start.y - Math.min(...chain.map(c => c.y))) / H;
      const sc = Math.min(chain.length, 25) * 0.6 + straight * 10 + mono * 8 - (cs.t - tImp) * 8 + rise * 6 + cosA * 6;
      all.push({ sc, chain, launch });
    }
  }
  if (!all.length) return [];
  all.sort((a, b) => b.sc - a.sc);
  const alts = []; for (const a of all) { if (alts.length >= 6) break; if (!alts.some(b => Math.hypot(b.chain[0].x - a.chain[0].x, b.chain[0].y - a.chain[0].y) < 10 && Math.abs(b.chain[0].t - a.chain[0].t) < 0.05)) alts.push(a); }
  const out = alts[0].chain; out.launch = alts[0].launch; out.score = alts[0].sc; out.alts = alts.map(a => a.chain); return out;
}

// ---------- finding the ball in flight against a still background ----------
// frames: [{t, g}] grey, from ~0.4 s before impact to ~2.5 s after. The picture before impact (median) is the background;
// after impact the ball is a small spot brighter than that background, away from anything else that changed.
function median9(vals) { vals.sort((a, b) => a - b); return vals[vals.length >> 1]; }
function bgTrack(frames, W, H, ball, tImp, opt) {
  opt = opt || {};
  const r = Math.max(1.5, ball.r || 2), pre = frames.filter(f => f.t < tImp - 0.05 && f.t > tImp - 0.6), post = frames.filter(f => f.t > tImp + 0.005);
  if (pre.length < 3 || post.length < 5) return [];
  const step = Math.max(1, Math.floor(pre.length / 9)), P = pre.filter((_, i) => i % step === 0).slice(-9), N = W * H, B = new Uint8Array(N), tmp = new Array(P.length);
  for (let i = 0; i < N; i++) { for (let k = 0; k < P.length; k++) tmp[k] = P[k].g[i]; B[i] = median9(tmp); }
  // and the picture after the shot, from frames spread over the rest of the clip: anything still there then (the scene the golfer
  // was standing in front of, lights) isn't a moving ball
  const qs = Math.max(1, Math.floor(post.length / 9)), Q = post.filter((_, i) => i % qs === 0).slice(0, 9), A = new Uint8Array(N), tq = new Array(Q.length);
  for (let i = 0; i < N; i++) { for (let k = 0; k < Q.length; k++) tq[k] = Q[k].g[i]; A[i] = median9(tq); }
  const yMax = Math.min(H, Math.floor(ball.y - 1.5 * r)), maxA = Math.max(12, Math.PI * (2.6 * r) ** 2), thr = opt.thr || 16;
  const fdt = post.length > 1 ? (post[post.length - 1].t - post[0].t) / (post.length - 1) : 1 / 30;
  // spots in each frame
  const dets = post.map(f => {
    const g = f.g, m = new Uint8Array(W * yMax), out = [];
    // a white ball can show up brighter than the sky behind it (blue sky, trees) or darker (bright cloud): either way it's new, and gone again later
    for (let i = 0; i < W * yMax; i++) { const d = g[i] - B[i], e = g[i] - A[i]; if ((d > thr && e > thr * 0.8) || (d < -thr && e < -thr * 0.8)) m[i] = 1; else if (d > thr || d < -thr) m[i] = 2; }
    const seen = new Uint8Array(W * yMax), q = [];
    for (let i = 0; i < W * yMax; i++) {
      if (m[i] !== 1 || seen[i]) continue;
      let area = 0, sx = 0, sy = 0, sw = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; q.length = 0; q.push(i); seen[i] = 1;
      const sg = Math.sign(g[i] - B[i]);
      while (q.length) { const j = q.pop(), x = j % W, y = (j - x) / W, w = Math.abs(g[j] - B[j]); area++; sx += x * w; sy += y * w; sw += w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (area > maxA * 3) break;
        for (const k of [j - 1, j + 1, j - W, j + W]) if (k >= 0 && k < m.length && m[k] === 1 && !seen[k] && Math.abs((k % W) - x) <= 1 && Math.sign(g[k] - B[k]) === sg) { seen[k] = 1; q.push(k); } }
      if (area > maxA || x1 - x0 > 6 * r + 6 || y1 - y0 > 6 * r + 6) continue;
      // on its own: hardly anything else changed around it (so not part of the golfer, the club or a shadow)
      let other = 0; const pad = Math.round(4 * r + 5);
      for (let y = Math.max(0, y0 - pad); y <= Math.min(yMax - 1, y1 + pad); y++) for (let x = Math.max(0, x0 - pad); x <= Math.min(W - 1, x1 + pad); x++) if (m[y * W + x]) other++;
      if (other > area * 1.6 + 6) continue;
      out.push({ x: sx / sw + 0.5, y: sy / sw + 0.5, a: area, c: sw / area });
    }
    return { t: f.t, d: out };
  });
  // a spot that sits in the same place frame after frame is part of the scene (a flickering pixel, a leaf), not a ball in flight
  { const all = []; dets.forEach((fr, fi) => fr.d.forEach(d => all.push([fi, d])));
    for (const fr of dets) fr.d = fr.d.filter(d => { let n = 0; for (const [fi, e] of all) if (e !== d && Math.abs(e.x - d.x) < 1.6 && Math.abs(e.y - d.y) < 1.6 && ++n >= 3) return false; return true; }); }
  // join spots into tracks, frame by frame
  const tracks = [];
  for (const fr of dets) {
    // every pairing of a track with a spot in this frame, best fits first, so a stray track can't take the ball's spot
    // from the ball's own track
    const used = new Set(), took = new Set(), pairs = [];
    tracks.forEach((tr, ti) => {
      // velocities in pixels per second, so frames that come at uneven spacing (every frame just after impact, fewer later) link up alike
      const L = tr.p[tr.p.length - 1], dt = fr.t - L.t; if (dt < 0.002 || tr.dead) return; if (dt > 3.6 * fdt) { tr.dead = true; return; }
      const v = tr.v || { x: 0, y: 0 }, pr = { x: L.x + v.x * dt, y: L.y + v.y * dt }, sp = Math.hypot(v.x, v.y), gate = tr.v ? Math.max(6, 0.7 * sp * dt + 5) : Math.max(8, 3 * Math.max(W, H) * dt);
      fr.d.forEach((d, di) => { const dd = Math.hypot(d.x - pr.x, d.y - pr.y); if (dd >= gate) return;
        // a ball keeps to its line: it may slow down, but it doesn't step sideways off it
        if (tr.v && sp * dt > 4) { const ux = v.x / sp, uy = v.y / sp, wx = d.x - L.x, wy = d.y - L.y; if (Math.abs(wx * uy - wy * ux) > Math.max(3, 0.25 * sp * dt + 2)) return; }
        pairs.push({ ti, di, dt, L, k: dd / gate + (tr.v ? 0 : 0.5) }); });
    });
    pairs.sort((a, b) => a.k - b.k);
    for (const pq of pairs) {
      if (took.has(pq.ti) || used.has(pq.di)) continue; took.add(pq.ti); used.add(pq.di);
      const tr = tracks[pq.ti], d = fr.d[pq.di], L = pq.L, dt = pq.dt, nv = { x: (d.x - L.x) / dt, y: (d.y - L.y) / dt };
      tr.v = tr.v ? { x: tr.v.x * 0.4 + nv.x * 0.6, y: tr.v.y * 0.4 + nv.y * 0.6 } : nv; tr.p.push({ t: fr.t, x: d.x, y: d.y });
    }
    fr.d.forEach((d, i) => { if (!used.has(i)) tracks.push({ p: [{ t: fr.t, x: d.x, y: d.y }] }); });
  }
  // which track is the ball? it appears soon after impact, at a distance the ball could have flown in that time, and moves away from the ball
  const vmax = 9 * Math.max(W, H);
  const scored = [];
  for (const tr of tracks) {
    const p = tr.p; if (p.length < 3) continue;
    // three sightings are enough only straight after impact and in a straight line
    if (p.length === 3) { const a = p[0], c = p[2], ab = Math.hypot(c.x - a.x, c.y - a.y) || 1, off = Math.abs((p[1].x - a.x) * (c.y - a.y) - (p[1].y - a.y) * (c.x - a.x)) / ab;
      if (p[0].t - tImp > 0.1 || off > 1.5 || ab < 6) continue; }
    const f0 = p[0], tf = f0.t - tImp, d0 = Math.hypot(f0.x - ball.x, f0.y - ball.y);
    if (tf > 0.7 || d0 / Math.max(fdt, tf + fdt * 0.5) > vmax) continue;
    if (f0.y > ball.y - 2 * r) continue;
    // things that just appeared and stay put (lights, a shadow moving off) aren't the ball
    const lp = p[p.length - 1], net = Math.hypot(lp.x - f0.x, lp.y - f0.y); if (net < Math.max(8, 3 * r)) continue;
    // it has to keep going: the path from the ball outwards, not wandering
    const k = Math.min(p.length - 1, 6), vx = p[k].x - f0.x, vy = p[k].y - f0.y, vl = Math.hypot(vx, vy);
    const ux = (f0.x - ball.x) / (d0 || 1), uy = (f0.y - ball.y) / (d0 || 1), cos = vl > 0.5 ? (vx * ux + vy * uy) / vl : 0.5;
    if (cos < -0.2) continue;
    const span = p[p.length - 1].t - f0.t, steps = p.length;
    let jerk = 0; for (let i = 2; i < p.length; i++) { const a = { x: p[i - 1].x - p[i - 2].x, y: p[i - 1].y - p[i - 2].y }, b = { x: p[i].x - p[i - 1].x, y: p[i].y - p[i - 1].y }; jerk += Math.hypot(b.x - a.x, b.y - a.y); }
    jerk /= Math.max(1, p.length - 2);
    const sc = Math.min(steps, 60) * 0.5 + span * 6 + cos * 6 - tf * 10 - Math.min(10, jerk) * 0.8;
    scored.push({ sc, p });
  }
  bgTrack.last = { dets, tracks, scored, fdt };
  if (!scored.length) return [];
  scored.sort((a, b) => b.sc - a.sc);
  const out = scored[0].p.slice(); out.alts = scored.slice(0, 4).map(s => s.p); out.score = scored[0].sc; out.bg = true; return out;
}
// ---------- flight model ----------
// shot: {D carry m, H apex m, az start direction rad (+ right), curve lateral m at landing (+ right), pa apex fraction}
// skewed parabola with apex at pa: h(p) = p(1-p)(1+bp)/norm
function hfun(pa) {
  const b = (2 * pa - 1) / (pa * (2 - 3 * pa)); // derivative = 0 at pa
  const bb = isFinite(b) ? b : 0, nrm = pa * (1 - pa) * (1 + bb * pa) || 0.25;
  return p => Math.max(0, p * (1 - p) * (1 + bb * p) / nrm);
}
function flightTime(s) { return Math.max(1.2, Math.sqrt(8 * s.H / 9.81) * 1.08); }
const K = 1.6, EK = 1 - Math.exp(-K);
function shotPoint(s, tau) { // tau 0..1 of flight time
  const p = (1 - Math.exp(-K * tau)) / EK, h = hfun(s.pa || 0.6);
  return { x: s.D * p, y: s.D * Math.tan(s.az) * p + s.curve * p * p, z: s.H * h(p), p };
}
// inverse: horizontal fraction -> tau
function tauAt(p) { return -Math.log(1 - p * EK) / K; }

// ---------- camera ----------
// cam: {F, cx, cy, pos:[x,y,z], yaw, pitch}
function project(cam, P) {
  const R = [P.x - cam.pos[0], P.y - cam.pos[1], P.z - cam.pos[2]];
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const f = [cp * cy, cp * sy, sp], rt = [-sy, cy, 0], up = [-sp * cy, -sp * sy, cp];
  const zc = R[0] * f[0] + R[1] * f[1] + R[2] * f[2]; if (zc <= 0.05) return null;
  const xc = R[0] * rt[0] + R[1] * rt[1], yc = R[0] * up[0] + R[1] * up[1] + R[2] * up[2];
  return { u: cam.cx + cam.F * xc / zc, v: cam.cy - cam.F * yc / zc, z: zc };
}
// place a camera at azimuth beta (0 = behind the ball looking at the target, +90 = across the ball, facing the golfer)
// distance cd, height ch, side offset lat (m, + = right of the line), and aim it so the ball lands on (u0, v0)
function makeCamera(W, H, u0, v0, beta, cd, ch, lat, fov) {
  const F = (Math.max(W, H) / 2) / Math.tan((fov || 66) * Math.PI / 360);
  const b = beta * Math.PI / 180, pos = [-cd * Math.cos(b), cd * Math.sin(b), ch];
  { const ps = Math.atan2(-pos[1], -pos[0]); pos[0] += -Math.sin(ps) * lat; pos[1] += Math.cos(ps) * lat; }
  // start looking straight at the ball
  const d = [-pos[0], -pos[1], -pos[2]];
  const cam = { F, cx: W / 2, cy: H / 2, pos, yaw: Math.atan2(d[1], d[0]), pitch: Math.atan2(d[2], Math.hypot(d[0], d[1])) };
  for (let it = 0; it < 30; it++) {
    const p = project(cam, { x: 0, y: 0, z: 0 }); if (!p) break;
    const eu = p.u - u0, ev = p.v - v0; if (Math.abs(eu) + Math.abs(ev) < 0.05) break;
    cam.yaw += Math.atan(eu / cam.F); cam.pitch -= Math.atan(ev / cam.F);
  }
  return cam;
}
// fit shot + camera to tracked points. obs: [{t,x,y}], start {x,y}. Returns {shot, cam, err}
function fitShot(obs, start, tImp, W, H, club, view, fixed) {
  const D0 = club.carry * YD, H0 = club.apex;
  const views = view ? [view] : ['dtl', 'face-r', 'face-l'];
  const betaOf = v => v === 'dtl' ? 0 : v === 'face-r' ? 90 : -90;
  let best = null;
  const cost = (x, v) => {
    const [az, lH, lD, dt, ch0, lcd] = x, Hh = H0 * Math.exp(lH), D = D0 * Math.exp(lD);
    const cd = fixed ? fixed.cd * Math.exp(lcd) : 3 * Math.exp(lcd), ch = fixed ? fixed.ch * Math.exp(lcd) * (ch0 / 1.2) : ch0;
    if (ch < 0.2 || ch > 2.6 || Math.abs(az) > 0.45) return 1e9;
    const F0 = (Math.max(W, H) / 2) / Math.tan(33 * Math.PI / 180), lat0 = v === 'dtl' ? -(start.x - W / 2) * cd / F0 : 0;
    const cam = makeCamera(W, H, start.x, start.y, betaOf(v), cd, ch, fixed ? fixed.lat * Math.exp(lcd) : lat0, 66);
    const s = { D, H: Hh, az, curve: 0, pa: 0.6 }, T = flightTime(s);
    let e = 0;
    for (const o of obs) {
      const tau = (o.t - (tImp + dt)) / T; if (tau <= 0) { e += 400; continue; }
      const p = project(cam, shotPoint(s, tau)); if (!p) { e += 1e4; continue; }
      e += Math.min(2500, (p.u - o.x) ** 2 + (p.v - o.y) ** 2);
    }
    const sc = W / 400; // priors scaled to image size
    const camPrior = fixed ? 30 * ((ch0 - 1.2) / 0.17) ** 2 + 30 * (lcd / 0.2) ** 2 : 10 * ((ch - 1.2) / 0.4) ** 2 + 10 * (lcd / 0.4) ** 2;
    return e / obs.length / (sc * sc) + 30 * lH * lH / 0.16 + 30 * lD * lD / 0.06 + 20 * (dt / 0.04) ** 2 + camPrior;
  };
  for (const v of views) {
    for (const az0 of [-0.08, 0, 0.08]) for (const h0 of [-0.3, 0, 0.3]) {
      let x = [az0, h0, 0, 0, 1.2, 0];
      x = nelder(p => cost(p, v), x, [0.05, 0.25, 0.15, 0.03, 0.3, 0.3], 260);
      const c = cost(x, v);
      if (!best || c < best.c) best = { c, x, v };
    }
  }
  const [az, lH, lD, dt, ch0, lcd] = best.x;
  const shot = { D: D0 * Math.exp(lD), H: H0 * Math.exp(lH), az, curve: 0, pa: 0.6 };
  const camp = fixed ? { beta: betaOf(best.v), cd: fixed.cd * Math.exp(lcd), ch: fixed.ch * Math.exp(lcd) * (ch0 / 1.2), lat: fixed.lat * Math.exp(lcd), fov: 66 }
    : { beta: betaOf(best.v), cd: 3 * Math.exp(lcd), ch: ch0, lat: best.v === 'dtl' ? -(start.x - W / 2) * 3 * Math.exp(lcd) / ((Math.max(W, H) / 2) / Math.tan(33 * Math.PI / 180)) : 0, fov: 66 };
  return { shot, camp, view: best.v, t0: tImp + dt, err: best.c };
}
function nelder(f, x0, step, iters) {
  const n = x0.length; let P = [x0.slice()];
  for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += step[i]; P.push(x); }
  let F = P.map(f);
  for (let it = 0; it < iters; it++) {
    const idx = F.map((v, i) => i).sort((a, b) => F[a] - F[b]); P = idx.map(i => P[i]); F = idx.map(i => F[i]);
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += P[i][j] / n;
    const xr = c.map((v, j) => v + (v - P[n][j])), fr = f(xr);
    if (fr < F[0]) { const xe = c.map((v, j) => v + 2 * (v - P[n][j])), fe = f(xe); if (fe < fr) { P[n] = xe; F[n] = fe; } else { P[n] = xr; F[n] = fr; } }
    else if (fr < F[n - 1]) { P[n] = xr; F[n] = fr; }
    else { const xc = c.map((v, j) => v + 0.5 * (P[n][j] - v)), fc = f(xc); if (fc < F[n]) { P[n] = xc; F[n] = fc; } else { for (let i = 1; i <= n; i++) { P[i] = P[i].map((v, j) => P[0][j] + 0.5 * (v - P[0][j])); F[i] = f(P[i]); } } }
  }
  const i = F.indexOf(Math.min(...F)); return P[i];
}

// horizon / far ground edge: strongest horizontal brightness change between 10% and 70% of the height,
// ignoring columns covered by the golfer. Returns v (px) or null.
function estimateHorizon(data, W, H, skip) {
  const rows = new Float32Array(H), n = new Float32Array(H);
  for (let y = Math.floor(H * 0.06); y < Math.floor(H * 0.75); y++) for (let x = 0; x < W; x += 2) {
    if (skip && x > skip.x0 && x < skip.x1) continue;
    const o = (y * W + x) * 4; rows[y] += data[o] * 0.3 + data[o + 1] * 0.59 + data[o + 2] * 0.11; n[y]++;
  }
  for (let y = 0; y < H; y++) rows[y] = n[y] ? rows[y] / n[y] : 0;
  const k = Math.max(2, Math.round(H / 120)); let best = null, bv = 0;
  for (let y = Math.floor(H * 0.1) + k; y < Math.floor(H * 0.7) - k; y++) {
    let a = 0, b = 0; for (let j = 1; j <= k; j++) { a += rows[y - j]; b += rows[y + j]; }
    const d = Math.abs(b - a) / k; if (d > bv) { bv = d; best = y; }
  }
  return bv > 12 ? best : null;
}
// camera from scene clues: the golfer's size in the picture gives the camera distance; height defaults to ~1.3 m
function sceneCamera(W, H, start, bodyHpx, view, ch, fov) {
  const F = (Math.max(W, H) / 2) / Math.tan((fov || 66) * Math.PI / 360);
  const Dg = Math.max(1, Math.min(8, F * 1.75 / Math.max(50, bodyHpx)));
  const cd = view === 'dtl' ? Math.sqrt(Math.max(0.6, Dg * Dg - 0.6 * 0.6)) : Math.max(1, Dg - 0.8);
  // assume the phone is aimed down the target line: the ball's place left/right in the picture sets the camera's side offset
  const lat = view === 'dtl' ? -(start.x - W / 2) * cd / F : 0;
  return { cd, ch: ch || 1.35, lat, fov: fov || 66, beta: view === 'dtl' ? 0 : view === 'face-r' ? 90 : -90 };
}
// carry a track on after the ball has shrunk to a speck against the sky. Far away the ball slows right down in the
// picture, so each step looks along the way it was going, anywhere from barely moving to a little past where its last
// speed would take it, for a small spot that wasn't there before the shot and isn't there later.
function extendTrack(frames, W, H, track, tImp, opt) {
  opt = opt || {}; const thr = opt.thr || 10, r = Math.max(1, opt.r || 1.5), out = track.slice(); if (out.length < 2) return out;
  const pre = frames.filter(f => f.t < tImp - 0.05 && f.t > tImp - 0.6), last0 = out[out.length - 1].t, post = frames.filter(f => f.t > last0 + 0.004);
  if (pre.length < 3 || post.length < 2) return out;
  const pick = (L, n) => { const st = Math.max(1, Math.floor(L.length / n)); return L.filter((_, i) => i % st === 0).slice(0, n); };
  const P = pick(pre, 9), Q = pick(frames.filter(f => f.t > tImp + 0.3), 9);
  const med = (fs, i, tmp) => { for (let k = 0; k < fs.length; k++) tmp[k] = fs[k].g[i]; tmp.length = fs.length; return median9(tmp); };
  const tp = [], tq = [], maxA = Math.max(12, Math.PI * (2.2 * r) ** 2);
  let miss = 0;
  for (const f of post) {
    const L = out[out.length - 1], K = out[Math.max(0, out.length - 3)], dt = f.t - L.t; if (dt > 0.5) break;
    const kt = Math.max(1e-3, L.t - K.t), vx = (L.x - K.x) / kt, vy = (L.y - K.y) / kt, sp = Math.hypot(vx, vy);
    // (far away it slows down fast in the picture: by a fifth of a second it has covered well under its last speed's worth)
    const reach = Math.min(dt * 1.15, 0.2), E = { x: L.x + vx * reach, y: L.y + vy * reach }, gate = 4 + 2 * r + 0.15 * sp * Math.min(dt, 0.2);
    const x0 = Math.max(1, Math.floor(Math.min(L.x, E.x) - gate)), x1 = Math.min(W - 2, Math.ceil(Math.max(L.x, E.x) + gate)), y0 = Math.max(1, Math.floor(Math.min(L.y, E.y) - gate)), y1 = Math.min(H - 2, Math.ceil(Math.max(L.y, E.y) + gate));
    if (x1 <= x0 || y1 <= y0) break;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, m = new Int8Array(bw * bh), dv = new Float32Array(bw * bh);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x, b = med(P, i, tp), a = Q.length >= 3 ? med(Q, i, tq) : b, d = f.g[i] - b, e = f.g[i] - a, j = (y - y0) * bw + (x - x0);
      dv[j] = d; if (d > thr && e > thr * 0.8) m[j] = 1; else if (d < -thr && e < -thr * 0.8) m[j] = -1; }
    const seen = new Uint8Array(bw * bh), q = []; let best = null;
    for (let j = 0; j < m.length; j++) {
      if (!m[j] || seen[j]) continue; const sg = m[j]; let area = 0, sx = 0, sy = 0, sw = 0, pk = 0; q.length = 0; q.push(j); seen[j] = 1;
      while (q.length) { const c = q.pop(), cx = c % bw, cy = (c - cx) / bw, w = Math.abs(dv[c]); area++; sx += cx * w; sy += cy * w; sw += w; if (w > pk) pk = w;
        for (const n of [c - 1, c + 1, c - bw, c + bw]) if (n >= 0 && n < m.length && m[n] === sg && !seen[n] && Math.abs((n % bw) - cx) <= 1) { seen[n] = 1; q.push(n); } }
      if (area > maxA) continue;
      const px = x0 + sx / sw + 0.5, py = y0 + sy / sw + 0.5;
      // how far it is from the stretch between 'hardly moved' and 'kept its speed'
      const ux = E.x - L.x, uy = E.y - L.y, l2 = ux * ux + uy * uy || 1, u = Math.max(0, Math.min(1, ((px - L.x) * ux + (py - L.y) * uy) / l2)), dd = Math.hypot(L.x + u * ux - px, L.y + u * uy - py);
      if (dd > gate) continue;
      // keeps heading the way it was going (near the top of its climb it hardly moves, and then any way will do)
      const stx = px - L.x, sty = py - L.y, sl = Math.hypot(stx, sty), vl = sp * dt;
      if (sl > 3 + r && vl > 3 + r && (stx * vx + sty * vy) / (sl * sp) < 0.3) continue;
      // on its own (not a waving treetop or the edge of something the camera wobbled against), and against plain sky
      // unless it stands out strongly
      const cx = Math.round(px), cy = Math.round(py), pad = Math.round(3 * r + 3); let other = 0, lo = 255, hi = 0;
      for (let y = Math.max(0, cy - pad); y <= Math.min(H - 1, cy + pad); y++) for (let x = Math.max(0, cx - pad); x <= Math.min(W - 1, cx + pad); x++) {
        const i = y * W + x, b = med(P, i, tp); if (Math.abs(f.g[i] - b) > thr) other++; if (Math.hypot(x - px, y - py) > 2 * r + 1) { if (b < lo) lo = b; if (b > hi) hi = b; } }
      if (other > area * 1.6 + 6) continue;
      const busy = hi - lo > 3 * thr; if (busy && pk < 2.5 * thr) continue;
      const sc = pk / thr - dd / gate - (busy ? 1 : 0); if (!best || sc > best.sc) best = { sc, x: px, y: py };
    }
    if (best) { out.push({ t: f.t, x: best.x, y: best.y, ext: true }); miss = 0; } else miss++;
  }
  return out;
}
// choose among alternative chains the one a ball flight explains best
function bestFlight(alts, start, tImp, W, H, club, view, fixed) {
  let best = null;
  for (const ch of alts) {
    if (ch.length < 4) continue;
    const f = fitShot(ch, start, tImp, W, H, club, view, fixed);
    const sc = f.err - Math.min(ch.length, 25) * 0.8;
    if (!best || sc < best.sc) best = { sc, fit: f, chain: ch };
  }
  return best;
}
// ---------- shapes ----------
// right-handed sense: draw = right-to-left. For left-handers the UI mirrors start/curve.
const SHAPES = {
  straight: { name: 'Straight', az: 0, curve: 0 }, draw: { name: 'Draw', az: 2, curve: -6 }, fade: { name: 'Fade', az: -2, curve: 6 },
  hook: { name: 'Hook', az: 1, curve: -16 }, slice: { name: 'Slice', az: -1, curve: 16 }, push: { name: 'Push', az: 5, curve: 0 }, pull: { name: 'Pull', az: -5, curve: 0 },
  pushfade: { name: 'Push-slice', az: 4, curve: 10 }, pulldraw: { name: 'Pull-hook', az: -4, curve: -10 },
};
// curve is given as % of carry; az in degrees
function applyShape(shot, key, lefty) {
  const s = SHAPES[key]; if (!s) return shot; const m = lefty ? -1 : 1;
  return Object.assign({}, shot, { az: m * s.az * Math.PI / 180, curve: m * s.curve / 100 * shot.D, shapeKey: key });
}
function describeShape(shot, lefty) {
  const m = lefty ? -1 : 1, a = m * shot.az * 180 / Math.PI, c = m * shot.curve / Math.max(1, shot.D) * 100;
  const start = a > 6 ? 'right' : a < -6 ? 'left' : 'straight', bend = c > 11 ? 'slice' : c > 3 ? 'fade' : c < -11 ? 'hook' : c < -3 ? 'draw' : '';
  if (!bend) return start === 'straight' ? 'Straight' : start === 'right' ? 'Push' : 'Pull';
  if (start === 'straight') return bend[0].toUpperCase() + bend.slice(1);
  if (start === 'right') return bend === 'draw' ? 'Draw' : bend === 'hook' ? 'Push-hook' : bend === 'fade' ? 'Push-fade' : 'Push-slice';
  return bend === 'fade' ? 'Fade' : bend === 'slice' ? 'Pull-slice' : bend === 'draw' ? 'Pull-draw' : 'Pull-hook';
}
const STRIKES = ['Pure', 'Thin', 'Fat', 'Toe', 'Heel', 'Topped', 'Skied'];


// Clubface and path from the ball flight (D-plane rule of thumb): the ball starts mostly where the face points
// (about 80% face, 20% path) and curves away from the path by the face-to-path angle (about 2.5% of carry per degree).
function faceAndPath(shot, lefty) {
  const m = lefty ? -1 : 1, a = m * shot.az * 180 / Math.PI, c = m * shot.curve / Math.max(1, shot.D) * 100;
  const ftp = c / 2.5, face = a + 0.2 * ftp, path = face - ftp, r1 = x => Math.round(x * 10) / 10;
  const dir = (v, pos, neg) => Math.abs(v) < 1 ? 'square' : `${Math.abs(v).toFixed(0)}° ${v > 0 ? pos : neg}`;
  const faceTxt = dir(face, 'open', 'closed'), pathTxt = Math.abs(path) < 1 ? 'straight down the line' : `${Math.abs(path).toFixed(0)}° ${path > 0 ? 'in-to-out' : 'out-to-in'}`;
  let why, fix;
  if (Math.abs(ftp) < 1.2 && Math.abs(face) < 2) { why = 'Face and path are both close to square, so the ball starts on line and flies straight.'; fix = 'Nothing to fix here. Keep this feel.'; }
  else if (ftp >= 1.2 && path < -1) { why = 'The path cuts across the ball from out to in and the face is open to it, which is what puts slice spin on the ball.'; fix = 'Start the downswing with your lower body so the hands drop inside, and feel the clubface turning over through impact.'; }
  else if (ftp >= 1.2) { why = 'The face is open to the path at impact, so the ball curves right' + (lefty ? ' (left for you)' : '') + ' even though the path is not cutting across.'; fix = 'Check your grip is not too weak and let your forearms rotate through impact to square the face.'; }
  else if (ftp <= -1.2 && path > 1) { why = 'The path swings from in to out and the face is closed to it, which is what puts hook spin on the ball.'; fix = 'Keep your body turning through impact so the hands don\'t flip, and check your grip is not too strong.'; }
  else if (ftp <= -1.2) { why = 'The face is closed to the path at impact, so the ball curves left' + (lefty ? ' (right for you)' : '') + '.'; fix = 'Check your grip is not too strong and keep turning your chest through the ball.'; }
  else { why = `The ball starts ${a > 0 ? 'right' : 'left'} of target because the face points there at impact; the curve is small.`; fix = 'Check your alignment and ball position, then aim the clubface at the target at address.'; }
  return { face: r1(face), path: r1(path), ftp: r1(ftp), start: r1(a), curve: r1(c), faceTxt, pathTxt, why, fix };
}

const api = { faceAndPath, extendTrack, ballSpots, ballFromSamples, ballState, pickBall, poseOK, bgTrack, fitCorrection, corrAt, ballGone, aimAt, bestFlight, CLUBS, ballCandidates, filterByBody, estimateHorizon, sceneCamera, patch, findImpact, refineImpact, trackFlight, diffBlobs, shotPoint, tauAt, flightTime, project, makeCamera, fitShot, nelder, SHAPES, applyShape, describeShape, STRIKES, YD, hfun };
if (typeof module !== 'undefined') module.exports = api; else root.Tracer = api;
})(typeof window !== 'undefined' ? window : this);
