// Swing phase detection, measurements and rule-based scores from BlazePose frames.
// frames: [{t, pts:[{x,y,vis}] (image px), world:[[x,y,z]] (metres, hip-centred, y down)}]
(function (root) {
'use strict';
const L = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28 };
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = v => Math.hypot(v[0], v[1], v[2]);
const deg = r => r * 180 / Math.PI;
const ang2 = (a, b, c) => { const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y, d = Math.hypot(ux, uy) * Math.hypot(vx, vy); return d ? deg(Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d)))) : null; };
const ang3 = (a, b, c) => { const u = sub(a, b), v = sub(c, b); return deg(Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (len(u) * len(v)))))); };
const median = a => { const s = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = x => x == null ? null : Math.round(x * 10) / 10, r2 = x => x == null ? null : Math.round(x * 100) / 100, r0 = x => x == null ? null : Math.round(x);

function features(f) {
  const p = f.pts, w = f.world;
  const hip = mid(p[L.lHip], p[L.rHip]), sh = mid(p[L.lSh], p[L.rSh]), wr = mid(p[L.lWr], p[L.rWr]), an = mid(p[L.lAn], p[L.rAn]);
  const T = Math.hypot(sh.x - hip.x, sh.y - hip.y) || 1;
  const o = { t: f.t, hip, sh, wr, an, T, head: p[L.nose], pts: p,
    h: (hip.y - wr.y) / T,                                                  // hand height: 0 = hips, 1 = shoulders
    tilt: deg(Math.atan2(sh.x - hip.x, hip.y - sh.y)),                      // spine line vs vertical, signed
    shW: Math.hypot(p[L.lSh].x - p[L.rSh].x, p[L.lSh].y - p[L.rSh].y) / T,
    hipW: Math.hypot(p[L.lHip].x - p[L.rHip].x, p[L.lHip].y - p[L.rHip].y) / T,
    headX: (p[L.nose].x - an.x), headY: (an.y - p[L.nose].y),             // pixels; scaled by address torso later
    hipX: (hip.x - an.x),
    vis: [L.lSh, L.rSh, L.lHip, L.rHip, L.lWr, L.rWr].reduce((a, i) => a + p[i].vis, 0) / 6 };
  // joint angles from the flat picture: a straight arm or leg always looks straight, and research on phone
  // body tracking finds the 2D picture far steadier than its 3D guess
  o.lElbow = ang2(p[L.lSh], p[L.lEl], p[L.lWr]); o.rElbow = ang2(p[L.rSh], p[L.rEl], p[L.rWr]);
  o.lKnee = ang2(p[L.lHip], p[L.lKn], p[L.lAn]); o.rKnee = ang2(p[L.rHip], p[L.rKn], p[L.rAn]);
  if (w && w.length) {
    const hv = sub(w[L.rHip], w[L.lHip]), wm = [(w[L.lWr][0] + w[L.rWr][0]) / 2, 0, (w[L.lWr][2] + w[L.rWr][2]) / 2];
    o.handSide = (wm[0] * hv[0] + wm[2] * hv[2]) / (Math.hypot(hv[0], hv[2]) || 1);
  }
  return o;
}

// 3-point median smoothing of the scalar features (only for densely sampled stretches)
// (where every frame was tracked, 5 frames: about a sixth of a second, so a single jittery frame never sets a score)
function smooth(F) {
  const keys = ['tilt', 'shW', 'hipW', 'headX', 'headY', 'hipX', 'lElbow', 'rElbow', 'lKnee', 'rKnee', 'handSide'];
  return F.map((f, i) => {
    if (i === 0 || i === F.length - 1 || F[i + 1].t - F[i - 1].t > 0.2) return f;
    const g = Object.assign({}, f), wide = i >= 2 && i <= F.length - 3 && F[i + 2].t - F[i - 2].t <= 0.2;
    for (const k of keys) if (f[k] != null) g[k] = median(wide ? [F[i - 2][k], F[i - 1][k], f[k], F[i + 1][k], F[i + 2][k]] : [F[i - 1][k], f[k], F[i + 1][k]]);
    return g;
  });
}

function phases(F) {
  if (F.length < 5) return null;
  const T = median(F.map(f => f.T));
  let hi = -1;
  for (let i = 1; i < F.length; i++) if (F[i].h > 0.7 && F.slice(0, i).some(f => f.h < 0.35)) { hi = i; break; }
  if (hi < 0) return null;
  let top = hi;
  for (let i = hi; i < F.length && F[i].t - F[hi].t < 0.8; i++) { if (F[i].h >= F[top].h) top = i; else if (F[i].h < F[top].h - 0.5) break; }
  let imp = -1;
  for (let i = top + 1; i < F.length && F[i].t - F[top].t < 0.9; i++) if (imp < 0 || F[i].h < F[imp].h) imp = i;
  if (imp < 0 || F[imp].h > 0.6) return { approx: true, top };
  let fin = -1;
  for (let i = imp + 1; i < F.length && F[i].t - F[imp].t < 1.6; i++) if (fin < 0 || F[i].h > F[fin].h + 0.02) fin = i;
  if (fin < 0) fin = F.length - 1;
  // takeaway and address are found from the top backwards, so where the clip happens to start (or a waggle or a
  // tracking glitch before the swing) never moves them. Reference hand position: where the hands sat before the
  // backswing; takeaway: going back from the top, the moment the hands come back within 7%, 10% and 13% of a torso
  // length of it (beyond the tracking jitter there), averaged; two frames in a row must be back, so one odd frame
  // in the backswing doesn't stop it early. Then the reference is re-taken just before that takeaway, and once more.
  const med = a => median(a);
  let ax = 0, ay = 0, jit = 0, take = 0, takeT = F[0].t;
  const dist = i => Math.hypot(F[i].wr.x - ax, F[i].wr.y - ay) / T;
  const setRef = fs => { if (!fs.length) return false; ax = med(fs.map(f => f.wr.x)); ay = med(fs.map(f => f.wr.y)); jit = fs.length > 3 ? med(fs.map(f => Math.hypot(f.wr.x - ax, f.wr.y - ay) / T)) : 0; return true; };
  const tTop = F[top].t;
  if (!setRef(F.filter(f => f.t >= tTop - 1.5 && f.t <= tTop - 0.6 && f.h < 0.35))) setRef(F.filter((f, i) => i < top && f.h < 0.35)) || setRef([F[0]]);
  const backTo = th0 => { const th = th0 + jit;
    for (let i = top - 1; i >= 1; i--) if (dist(i) <= th && dist(i - 1) <= th) { const d0 = dist(i), d1 = dist(i + 1); return { i, t: F[i].t + (F[i + 1].t - F[i].t) * clamp((th - d0) / Math.max(1e-6, d1 - d0), 0, 1) }; }
    return null; };
  for (let pass = 0; pass < 3; pass++) {
    const xs = [0.07, 0.1, 0.13].map(backTo).filter(Boolean);
    if (!xs.length) break;
    takeT = xs.reduce((a, x) => a + x.t, 0) / xs.length; take = xs[Math.min(1, xs.length - 1)].i;
    if (pass < 2 && !setRef(F.filter(f => f.t >= takeT - 0.5 && f.t <= takeT - 0.1))) break;
  }
  // address: the last frame a tenth of a second before the takeaway
  let addr = 0; for (let i = 0; i <= take; i++) if (F[i].t <= takeT - 0.1) addr = i;
  // sub-frame timing: quadratic fit through the extreme frame and its neighbours
  const peak = i => { if (i <= 0 || i >= F.length - 1) return F[i].t;
    const [x0, x1, x2] = [F[i - 1].t, F[i].t, F[i + 1].t], [y0, y1, y2] = [F[i - 1].h, F[i].h, F[i + 1].h];
    const d = (x0 - x1) * (x0 - x2) * (x1 - x2); if (!d) return x1;
    const A = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / d, B = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / d;
    if (!A) return x1; return clamp(-B / (2 * A), x0, x2); };
  // top of the backswing: centre of the plateau where the hands are within 0.05 torso of their highest point
  const hmax = F[top].h, plate = F.filter((f, i) => i > take && i < imp && f.h >= hmax - 0.05);
  const topT = plate.length ? plate.reduce((p, f) => p + f.t, 0) / plate.length : F[top].t;
  // timing from how fast the hands move (steadier than positions): the top is where they're slowest between the
  // fastest point going back and the fastest coming down; the takeaway is where they first reach 15% of their
  // backswing speed. Each is placed between frames, so the result doesn't depend on which frames were filmed.
  let topS = null, takeS = null;
  { const v = F.map((f, i) => i ? Math.hypot(f.wr.x - F[i - 1].wr.x, f.wr.y - F[i - 1].wr.y) / T / Math.max(1e-3, f.t - F[i - 1].t) : 0);
    const vs = v.map((x, i) => (i > 0 && i < v.length - 1) ? (v[i - 1] + 2 * x + v[i + 1]) / 4 : x), tm = i => i ? (F[i].t + F[i - 1].t) / 2 : F[0].t;
    let pb = -1, pd = -1;
    for (let i = take + 1; i <= top; i++) if (pb < 0 || vs[i] > vs[pb]) pb = i;
    for (let i = top; i <= imp && i < vs.length; i++) if (pd < 0 || vs[i] > vs[pd]) pd = i;
    if (pb > 0 && pd > pb + 1) {
      let mn = pb + 1; for (let i = pb + 1; i < pd; i++) if (vs[i] < vs[mn]) mn = i;
      if (mn > 0 && mn < vs.length - 1) { const y0 = vs[mn - 1], y1 = vs[mn], y2 = vs[mn + 1], d = y0 - 2 * y1 + y2, off = d > 1e-9 ? clamp((y0 - y2) / (2 * d), -0.5, 0.5) : 0;
        topS = tm(mn) + off * ((tm(mn + 1) - tm(mn - 1)) / 2); }
      const th = 0.15 * vs[pb];
      for (let i = pb; i > Math.max(0, addr - 3); i--) if (vs[i - 1] < th && vs[i] >= th) { takeS = tm(i - 1) + (tm(i) - tm(i - 1)) * clamp((th - vs[i - 1]) / Math.max(1e-9, vs[i] - vs[i - 1]), 0, 1); break; }
    } }
  const impT = peak(imp);
  return { addr, take, takeT, top, imp, fin, T, topT, impT, topS: (topS != null && takeS != null && takeS < topS && topS < impT && topS - takeS > 0.45 && topS - takeS < 1.8) ? topS : null, takeS };
}

function band(v, steps) { if (v == null || isNaN(v)) return null; for (const [lim, s] of steps) if (v <= lim) return s; return steps[steps.length - 1][1]; }
const avg = a => { const b = a.filter(x => x != null); return b.length ? Math.round(b.reduce((p, q) => p + q, 0) / b.length) : null; };

function analyse(frames, opt) {
  opt = opt || {};
  let F = frames.filter(f => f.pts).map(features).sort((a, b) => a.t - b.t);
  F = smooth(F);
  const P = phases(F); if (!P || P.approx) return { ok: false, F, P };
  const A = F[P.addr], K = F[P.take], Tp = F[P.top], I = F[P.imp], Fi = F[P.fin], T = P.T;
  // address = average of the still frames just before the takeaway
  const addrSet = F.filter(f => f.t <= A.t && f.t >= A.t - 0.5 && f.h < 0.4);
  const at = (k) => median(addrSet.map(f => f[k]));
  const shW0 = at('shW'), hipW0 = at('hipW'), T0 = at('T') || T;
  for (const f of F) { f.headX /= T0; f.headY /= T0; f.hipX /= T0; }
  // the golfer says which way they filmed; the picture only checks it. Shoulders look wide face-on and narrow
  // down the line; a clear contradiction is flagged instead of quietly running the wrong checks.
  const looks = shW0 < 0.45 ? 'down-the-line' : shW0 > 0.7 ? 'face-on' : 'angled';
  const view = opt.view || (looks === 'angled' ? 'face-on' : looks);
  // face-on: the hands finish on the target side, and the lead foot is the one on that side
  const tgImg = Math.sign(Fi.wr.x - Tp.wr.x) || 1, leftOnTarget = Math.sign(median(addrSet.map(f => f.pts[L.lAn].x - f.pts[L.rAn].x))) === tgImg;
  const right = opt.hand ? opt.hand === 'right' : view !== 'down-the-line' ? leftOnTarget : (Tp.handSide != null && A.handSide != null ? Tp.handSide >= A.handSide : true);
  const lead = right ? 'l' : 'r';
  const toBall = Math.sign(A.wr.x - A.hip.x) || 1;
  const between = (a, b) => F.filter(f => f.t >= a.t && f.t <= b.t);
  const m = { view, handed: right ? 'right' : 'left', view_looks: looks, shoulder_width_ratio: r2(shW0), miss: opt.miss || null };
  if (opt.view && ((opt.view === 'down-the-line' && shW0 > 0.75) || (opt.view === 'face-on' && shW0 < 0.4))) m.view_mismatch = looks;
  // tempo from hand speed where it's clear, else from positions
  const tA = P.topS != null ? P.takeS : P.takeT, tT = P.topS != null ? P.topS : P.topT;
  m.backswing_s = r2(tT - tA); m.downswing_s = r2(P.impT - tT); m.tempo_ratio = r1((tT - tA) / Math.max(0.05, P.impT - tT));
  { const dts = []; for (let i = 1; i < F.length; i++) { const d = F[i].t - F[i - 1].t; if (d > 0.004 && d < 0.1) dts.push(d); } const md = median(dts); m.fps = md ? Math.round(1 / md) : null; }
  m.spine_address_deg = r0(Math.abs(at('tilt'))); m.spine_top_deg = r0(Math.abs(Tp.tilt)); m.spine_impact_deg = r0(Math.abs(I.tilt));
  m.spine_change_deg = r0(Math.abs(at('tilt')) - Math.abs(I.tilt));                    // + = more upright at impact
  const hx0 = at('headX'), hy0 = at('headY'), hip0 = at('hipX');
  const seg = between(A, I);
  m.head_move_side = r2(I.headX - hx0); m.head_move_up = r2(I.headY - hy0);
  if (view === 'face-on') m.head_toward_target_impact = r2((I.headX - hx0) * (right ? 1 : -1)); else m.head_toward_ball_impact = r2((I.headX - hx0) * toBall);
  m.head_max_drop = r2(Math.max(0, ...seg.map(f => hy0 - f.headY)));
  m.head_max_side = r2(Math.max(...seg.map(f => Math.abs(f.headX - hx0))));
  if (view !== 'face-on') m.hips_toward_ball_impact = r2((I.hipX - hip0) * toBall);
  if (view !== 'down-the-line') { m.hip_sway_top = r2(Math.abs(Tp.hipX - hip0)); m.hip_slide_impact = r2(Math.abs(I.hipX - hip0)); }
  if (view === 'face-on') {
    m.shoulder_turn_deg = r0(deg(Math.acos(clamp(Tp.shW / shW0, 0, 1))));
    m.hip_turn_deg = r0(deg(Math.acos(clamp(Tp.hipW / hipW0, 0, 1))));
    m.x_factor_deg = m.shoulder_turn_deg - m.hip_turn_deg;
  }
  m.lead_arm_top_deg = r0(Tp[lead + 'Elbow']);
  m.knee_flex_address_deg = r0(Math.min(at('lKnee'), at('rKnee')));
  m.hands_height_top = r2(Tp.h);
  m.finish_hands_height = r2(Fi.h);
  const hold = F.filter(f => f.t >= Fi.t && f.t <= Fi.t + 0.6);
  m.finish_head_wobble = hold.length > 2 ? r2(Math.max(...hold.map(f => Math.hypot(f.headX - Fi.headX, f.headY - Fi.headY)))) : null;
  m.tracking_quality = r2(F.reduce((a, f) => a + f.vis, 0) / F.length);
  Object.assign(m, extra(F, P, { A, Tp, I, Fi, addrSet, T0, right, view, toBall, shW0, hipW0 }));
  // ---- shoulder plane at the top (down the line, TPI's flat-shoulder-plane check) ----
  // the shoulders should turn at right angles to the spine angle set at address, so at the top the shoulder line
  // tilts down toward the ball by about the address spine angle. Less than that is a flat shoulder plane (the
  // shoulders turned level, the posture lost); much more is a steep, tilting turn.
  if (view === 'down-the-line') {
    const near = F.filter(f => Math.abs(f.t - Tp.t) <= 0.05), li = lead === 'l' ? L.lSh : L.rSh, ti = lead === 'l' ? L.rSh : L.lSh;
    const tilt = median(near.map(f => { const a = f.pts[li], b = f.pts[ti]; return deg(Math.atan2(a.y - b.y, Math.abs(a.x - b.x) + 1e-6)); }));
    const sp = Math.abs(at('tilt'));
    if (tilt != null && sp != null) { m.shoulder_tilt_top_deg = r0(tilt); m.shoulder_plane_dev = r0(tilt - sp); }
  }
  // ---- from the club shaft at address, when the picture showed it clearly ----
  const club = opt.club || 'iron'; m.club = club;
  const sh = opt.shaft && opt.shaft.ok ? opt.shaft : null;
  if (sh) {
    m.shaft = { gx: r1(sh.gx), gy: r1(sh.gy), cx: r1(sh.cx), cy: r1(sh.cy) };
    const dx = sh.cx - sh.gx, dy = sh.cy - sh.gy;
    if (view === 'down-the-line') {
      // the "V": a line along the shaft at address (ball through the hands) and a line from the ball through the
      // shoulders at address. Halfway down (hands passing 0.4 torso lengths above their address height) the hands
      // should be inside it: 0 = on the shaft line, 1 = on the shoulder line; above 1 is steep (over the top),
      // below 0 is stuck under the plane
      const bx = sh.cx, by = sh.cy, shX = median(addrSet.map(f => f.sh.x)), shY = median(addrSet.map(f => f.sh.y));
      const ang = (x, y) => Math.atan2(by - y, Math.abs(x - bx) > 1e-6 ? (x - bx) * Math.sign(sh.gx - bx) : 1e-6);   // angle up from the ground, toward the golfer
      const aShaft = ang(sh.gx, sh.gy), aShoulder = ang(shX, shY);
      let z = null;
      if (aShoulder - aShaft > 0.05) for (let i = P.top + 1; i <= P.imp && i < F.length; i++) if (F[i - 1].h >= 0.4 && F[i].h < 0.4) {
        const k = (F[i - 1].h - 0.4) / Math.max(1e-6, F[i - 1].h - F[i].h), hx = F[i - 1].wr.x + (F[i].wr.x - F[i - 1].wr.x) * k, hy = F[i - 1].wr.y + (F[i].wr.y - F[i - 1].wr.y) * k;
        z = (ang(hx, hy) - aShaft) / (aShoulder - aShaft); break; }
      if (z != null) { m.plane_down = r2(z); m.vplane = { bx: r1(bx), by: r1(by), sx: r1(shX), sy: r1(shY) }; }
    } else {
      // ball position: where the clubhead sits between the feet (0 = trail foot, 1 = lead foot), against where it
      // should be for the club; and how the shaft leans (+ = hands toward the target)
      const lAn = median(addrSet.map(f => f.pts[L.lAn].x)), rAn = median(addrSet.map(f => f.pts[L.rAn].x)), aY = median(addrSet.map(f => (f.pts[L.lAn].y + f.pts[L.rAn].y) / 2));
      const leadX = right ? (leftOnTarget ? lAn : rAn) : (leftOnTarget ? rAn : lAn), trailX = leadX === lAn ? rAn : lAn;
      const xAt = y => sh.gx + dx * (y - sh.gy) / (Math.abs(dy) > 1e-6 ? dy : 1e-6), headX = Math.abs(dy) > Math.abs(dx) ? xAt(aY) : sh.cx;
      const pos = (headX - trailX) / ((leadX - trailX) || 1);
      const BALL = { driver: 0.9, wood: 0.75, iron: 0.55, wedge: 0.5 }, LEAN = { driver: 0, wood: 2, iron: 6, wedge: 8 };
      if (Math.abs(leadX - trailX) > 0.3 * T0) { m.ball_pos = r2(pos); m.ball_pos_dev = r2(pos - (BALL[club] || 0.55)); }
      const tg = Math.sign(leadX - trailX) || 1, lean = deg(Math.atan2((sh.gx - headX) * tg, Math.max(1, aY - sh.gy)));
      m.shaft_lean_deg = r0(lean); m.shaft_lean_dev = r0(lean - (LEAN[club] != null ? LEAN[club] : 6));
    }
  }
  const times = { address: r2(Math.max(F[0].t, Math.min(A.t, P.takeT - 0.25))), takeaway: r2(P.takeT), top: r2(P.topT), impact: r2(P.impT), finish: r2(Fi.t) };
  return { ok: true, metrics: m, times, F, P, toBall, scores: score(m, view), checks: checks(m, view) };
}

// More positions, the ones coaches check first (see FAULTS below): measured in torso lengths (hip to shoulder) or degrees.
function extra(F, P, c) {
  const { A, Tp, I, Fi, addrSet, T0, right, view, toBall, shW0, hipW0 } = c, m = {};
  const ld = right ? { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, heel: 29, toe: 31 } : { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28, heel: 30, toe: 32 };
  const tr = right ? { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28, heel: 30, toe: 32 } : { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, heel: 29, toe: 31 };
  const md = (fs, fn) => median(fs.map(fn));
  const pt = (f, i) => f.pts[i];
  const fo = view === 'face-on', dtl = view === 'down-the-line';
  const imp = F.indexOf(I), top = F.indexOf(Tp), fin = F.indexOf(Fi);
  // a key position read from the frames either side of it too, so one jittery frame can't decide a score
  const nb = (K, fn) => median(F.filter(f => Math.abs(f.t - K.t) <= 0.04).map(fn));
  if (view !== 'down-the-line') {
    // which way the target is in the picture: the lead foot is on the target side
    const tg = Math.sign(Fi.wr.x - Tp.wr.x) || Math.sign(md(addrSet, f => pt(f, ld.an).x - pt(f, tr.an).x)) || 1;
    const away = f => { const t = Math.atan2(f.sh.x - f.hip.x, f.hip.y - f.sh.y) * 180 / Math.PI; return -t * tg; };   // spine leaning away from the target, degrees
    const hip0 = md(addrSet, f => f.hip.x), sh0 = md(addrSet, f => f.sh.x), head0 = md(addrSet, f => f.head.x);
    m.stance_ratio = r2(md(addrSet, f => Math.abs(pt(f, ld.an).x - pt(f, tr.an).x) / (Math.abs(pt(f, ld.sh).x - pt(f, tr.sh).x) || 1)));
    m.side_tilt_address_deg = r0(md(addrSet, away));
    m.side_tilt_top_deg = r0(nb(Tp, away));
    m.side_tilt_impact_deg = r0(nb(I, away));
    const shLine = (f, lower) => { const a = pt(f, ld.sh), b = pt(f, tr.sh), dx = Math.abs(a.x - b.x) || 1; return r0(deg(Math.atan2(lower === 'lead' ? a.y - b.y : b.y - a.y, dx))); };
    m.shoulder_tilt_top_deg = shLine(Tp, 'lead');
    m.shoulder_tilt_impact_deg = r0(nb(I, f => shLine(f, 'trail')));
    m.sway_top = r2(nb(Tp, f => (hip0 - f.hip.x) * tg / T0));                       // + = hips moved away from the target
    m.head_sway_top = r2(nb(Tp, f => (head0 - f.head.x) * tg / T0));
    m.trail_hip_outside_top = r2((pt(Tp, tr.an).x - pt(Tp, tr.hip).x) * tg / T0);   // + = trail hip outside the trail foot
    m.hip_shift_impact = r2(nb(I, f => (f.hip.x - hip0) * tg / T0));                 // + = toward the target
    m.chest_shift_impact = r2(nb(I, f => (f.sh.x - sh0) * tg / T0));
    m.sway_gap_impact = r2(m.hip_shift_impact - m.chest_shift_impact);    // + = hips ahead of the chest
    m.slide_impact = r2(nb(I, f => (pt(f, ld.hip).x - pt(f, ld.an).x) * tg / T0));   // + = lead hip outside the lead foot
    m.hip_open_impact_deg = r0(nb(I, f => deg(Math.acos(clamp(f.hipW / hipW0, 0, 1)))));
    m.head_behind_impact = r2(nb(I, f => (head0 - f.head.x) * tg / T0));              // + = head stayed behind where it started
    m.finish_over_lead = r2((Fi.hip.x - pt(Fi, ld.an).x) * tg / T0);      // ~0 or + = hips over the lead foot
    m.trail_heel_up_finish = r2((pt(Fi, tr.toe).y - pt(Fi, tr.heel).y) / T0);
  }
  if (view !== 'face-on') {
    // hands under the shoulders at address, measured toward the ball
    m.arm_hang = r2(md(addrSet, f => (f.wr.x - f.sh.x) * toBall / T0));
    // early extension: the furthest the hips came toward the ball in the downswing
    const hip0 = md(addrSet, f => f.hip.x);
    const ds = F.slice(top, Math.min(F.length, imp + 2));
    m.early_ext_max = r2(Math.max(...ds.map(f => (f.hip.x - hip0) * toBall / T0)));
    m.hip_depth_top = r2((Tp.hip.x - hip0) * toBall / T0);              // + = hips moved toward the ball going back
    // hand path: on the way down vs the way back at the same heights; + = hands further out (over the top)
    const back = F.slice(F.indexOf(A), top + 1), down = F.slice(top, imp + 1), hx0 = md(addrSet, f => f.wr.x);
    const atH = (seg, h) => { for (let i = 1; i < seg.length; i++) { const a = seg[i - 1], b = seg[i]; if ((a.h - h) * (b.h - h) <= 0 && a.h !== b.h) { const u = (h - a.h) / (b.h - a.h); return a.wr.x + (b.wr.x - a.wr.x) * u; } } return null; };
    const d = [0.35, 0.5, 0.65, 0.8].map(h => { const xb = atH(back, h), xd = atH(down, h); return xb == null || xd == null ? null : (xd - xb) * toBall / T0; }).filter(v => v != null);
    m.hand_path_out = d.length ? r2(d.reduce((a, b) => a + b, 0) / d.length) : null;
    m.head_rise_impact = r2(I.headY - md(addrSet, f => f.headY));
  }
  // the lead arm through the ball (chicken wing): from impact until the hands are back at chest height
  const post = F.slice(imp, fin + 1).filter((f, i, a) => f.h > 0.15 && f.h < 0.95 && i < a.length);
  const pe = post.map(f => f[(right ? 'l' : 'r') + 'Elbow']).filter(v => v != null);
  m.lead_arm_through_deg = pe.length ? r0(Math.min(...pe.slice(0, 4))) : null;
  // trail knee straightening going back, lead knee at impact
  const kk = (f, s) => f[(s === 'lead' ? (right ? 'l' : 'r') : (right ? 'r' : 'l')) + 'Knee'];
  m.trail_knee_top_deg = r0(kk(Tp, 'trail')); m.trail_knee_address_deg = r0(median(addrSet.map(f => kk(f, 'trail'))));
  m.lead_knee_impact_deg = r0(kk(I, 'lead'));
  return m;
}

// ---------- Scoring: every check against how tour players measure on this same body tracking ----------
// Anchors were set from 24 tour swings filmed face-on and tracked by this app (median ≈ 9.5, their weakest ≈ 8),
// and from published tour vs high-handicap gaps (GolfTEC, Sportsbox AI, TPI). A typical amateur fault lands around 3–5.
const lerp = (v, A) => { if (v == null || isNaN(v)) return null; if (v <= A[0][0]) return A[0][1]; for (let i = 1; i < A.length; i++) if (v <= A[i][0]) { const [x0, y0] = A[i - 1], [x1, y1] = A[i]; return y0 + (y1 - y0) * (v - x0) / ((x1 - x0) || 1); } return A[A.length - 1][1]; };
const PC = v => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.round(Math.abs(v) * 100) + '%';
const PCa = v => v == null ? '–' : Math.round(Math.abs(v) * 100) + '%';
const DG = v => v == null ? '–' : Math.round(v) + '°';
// view: 'fo' face-on only, 'dtl' down-the-line only, 'all'
// phase: where in the swing the coach looks; area: the report section it counts toward; w: how much it matters
const CHECKS = [
  // ----- setup
  { id: 'stance', view: 'fo', phase: 'Setup', area: 'Setup posture', w: 0.8, name: 'Stance width', key: 'stance_ratio', fmt: v => v.toFixed(2) + '× shoulders', target: 'about 1.2–1.5× shoulder width (wider with driver)',
    A: [[0.8, 2], [1.0, 5], [1.15, 8], [1.3, 9.5], [1.55, 9.5], [1.8, 7], [2.1, 4]] },
  { id: 'setupTilt', view: 'fo', phase: 'Setup', area: 'Setup posture', w: 0.7, name: 'Spine tilt away from target', key: 'side_tilt_address_deg', fmt: DG, target: 'a few degrees away from the target (trail shoulder lower)',
    A: [[-8, 2], [-4, 4], [0, 7], [2, 9], [8, 10], [12, 9], [18, 6]] },
  { id: 'posture', view: 'dtl', phase: 'Setup', area: 'Setup posture', w: 1.2, name: 'Hip hinge (forward bend)', key: 'spine_address_deg', fmt: DG, target: 'about 28–38° from vertical',
    A: [[10, 1], [16, 3], [22, 5.5], [27, 8], [30, 9.5], [38, 9.5], [44, 7], [50, 4], [58, 1]] },
  { id: 'knees', view: 'dtl', phase: 'Setup', area: 'Setup posture', w: 0.6, name: 'Knee flex', key: 'knee_flex_address_deg', fmt: DG, target: 'soft flex, about 145–158° at the knee',
    A: [[125, 2], [135, 5], [143, 8], [148, 9.5], [158, 9.5], [163, 7.5], [168, 5], [175, 2]] },
  { id: 'armHang', view: 'dtl', phase: 'Setup', area: 'Setup posture', w: 0.6, name: 'Arms hanging under the shoulders', key: 'arm_hang', fmt: PC, target: 'hands just inside to slightly beyond the shoulders',
    A: [[-0.15, 2], [-0.05, 5], [0.02, 8], [0.08, 9.5], [0.22, 9.5], [0.32, 7], [0.45, 4], [0.6, 1.5]] },
  // ----- backswing and top
  { id: 'sway', view: 'fo', phase: 'Backswing', area: 'Backswing and top', w: 1.4, name: 'Hip sway going back', key: 'sway_top', fmt: PC, target: 'under 10% of a torso length away from the target',
    A: [[-0.3, 3], [-0.15, 7], [0, 10], [0.1, 9.5], [0.18, 8], [0.28, 5], [0.4, 2.5], [0.55, 1]] },
  { id: 'reverse', view: 'fo', phase: 'Top', area: 'Spine angle', w: 1.3, name: 'Spine at the top (reverse spine check)', key: 'side_tilt_top_deg', fmt: DG, target: 'still tilted away from the target (about 5°+)',
    A: [[-10, 1], [-5, 3], [0, 6], [3, 8.5], [6, 10]] },
  { id: 'shTurn', view: 'fo', phase: 'Top', area: 'Hip and shoulder rotation', w: 1.3, name: 'Shoulder turn (camera estimate)', key: 'shoulder_turn_deg', fmt: DG, target: 'back fully turned to the target (tour players read about 55–65° on this camera)',
    A: [[25, 2], [35, 4], [45, 7], [52, 8.5], [57, 9.5], [65, 10]] },
  { id: 'hipTurn', view: 'fo', phase: 'Top', area: 'Hip and shoulder rotation', w: 0.7, name: 'Hip turn (camera estimate)', key: 'hip_turn_deg', fmt: DG, target: 'about 35–50° on this camera',
    A: [[10, 3], [20, 6], [30, 8.5], [36, 10], [50, 10], [60, 8], [70, 6]] },
  { id: 'hipDepth', view: 'dtl', phase: 'Backswing', area: 'Spine angle', w: 1.0, name: 'Hips staying back going back', key: 'hip_depth_top', fmt: PC, target: 'hips no closer to the ball at the top',
    A: [[-0.1, 10], [0.02, 10], [0.06, 8], [0.12, 5], [0.2, 2]] },
  { id: 'leadArm', view: 'fo', phase: 'Top', area: 'Backswing and top', w: 0.7, name: 'Lead arm width at the top', key: 'lead_arm_top_deg', fmt: DG, target: 'long and wide: the lead arm close to straight (160°+ seen face-on)',
    A: [[120, 2], [135, 4.5], [145, 6.5], [155, 8.5], [163, 9.5], [170, 10]] },
  { id: 'handsTopFo', view: 'fo', phase: 'Top', area: 'Backswing and top', w: 0.8, name: 'Hands height at the top', key: 'hands_height_top', fmt: v => v.toFixed(2), target: '1.4+ torso lengths above the hips',
    A: [[0.9, 2], [1.1, 4.5], [1.25, 7], [1.4, 9], [1.5, 10]] },
  { id: 'handsTopDtl', view: 'dtl', phase: 'Top', area: 'Backswing and top', w: 0.8, name: 'Hands height at the top', key: 'hands_height_top', fmt: v => v.toFixed(2), target: '1.0+ (hands above the shoulders)',
    A: [[0.7, 2], [0.85, 5], [1.0, 8], [1.1, 9.5]] },
  // ----- transition and downswing
  { id: 'tempo', view: 'all', phase: 'Downswing', area: 'Tempo and sequencing', w: 1.3, name: 'Tempo (backswing : downswing)', key: 'tempo_ratio', fmt: v => v.toFixed(1) + ':1', target: 'about 3:1',
    A: [[1.6, 1], [2.0, 3], [2.3, 6], [2.6, 9], [2.8, 10], [3.3, 10], [3.6, 8], [4.2, 5], [5, 2]] },
  { id: 'dsTime', view: 'all', phase: 'Downswing', area: 'Tempo and sequencing', w: 0.7, name: 'Downswing time', key: 'downswing_s', fmt: v => v.toFixed(2) + 's', target: 'about 0.25–0.32s',
    A: [[0.16, 6], [0.22, 9], [0.25, 10], [0.32, 10], [0.38, 7.5], [0.5, 4], [0.8, 1]] },
  { id: 'ballPos', view: 'fo', phase: 'Setup', area: 'Setup posture', w: 0.8, name: 'Ball position for this club', key: 'ball_pos_dev', fmt: v => Math.abs(v) < 0.05 ? 'right for the club' : Math.round(Math.abs(v) * 100) + '% of your stance too far ' + (v > 0 ? 'forward' : 'back'), target: 'driver off the lead heel, irons just ahead of centre, wedges in the middle',
    A: [[-0.4, 1], [-0.25, 4], [-0.15, 7], [-0.07, 10], [0.07, 10], [0.15, 7], [0.25, 4], [0.4, 1]] },
  { id: 'shaftLean', view: 'fo', phase: 'Setup', area: 'Setup posture', w: 0.5, name: 'Shaft lean at address', key: 'shaft_lean_dev', fmt: v => Math.abs(v) < 3 ? 'right for the club' : Math.round(Math.abs(v)) + '° too much ' + (v > 0 ? 'toward the target' : 'away from the target'), target: 'hands level with or a little ahead of the ball (less with a driver)',
    A: [[-15, 2], [-10, 5], [-6, 8], [-3, 10], [4, 10], [8, 8], [12, 5], [18, 2]] },
  { id: 'downPlane', view: 'dtl', phase: 'Downswing', area: 'Tempo and sequencing', w: 1.0, name: 'Hands halfway down, inside the swing plane "V"', key: 'plane_down', fmt: v => v > 1.05 ? 'above the shoulder line (steep)' : v < -0.05 ? 'under the shaft line (stuck)' : 'inside the V', target: 'between the shaft line and the shoulder line',
    A: [[-0.7, 2], [-0.4, 6], [-0.15, 9], [0, 10], [0.95, 10], [1.1, 8], [1.3, 5], [1.6, 2.5], [2, 1]] },
  { id: 'flatShoulders', view: 'dtl', phase: 'Top', area: 'Hip and shoulder rotation', w: 0.8, name: 'Shoulder plane at the top', key: 'shoulder_plane_dev', fmt: v => Math.abs(v) < 6 ? 'turning around your spine' : Math.round(Math.abs(v)) + '° ' + (v < 0 ? 'flatter' : 'steeper') + ' than your spine angle', target: 'shoulders turning at right angles to the spine (about the same tilt as your posture)',
    A: [[-35, 1.5], [-25, 4], [-16, 7], [-9, 10], [10, 10], [18, 7], [28, 4], [40, 2]] },
  { id: 'ott', view: 'dtl', phase: 'Downswing', area: 'Tempo and sequencing', w: 2.0, name: 'Hand path coming down (over the top check)', key: 'hand_path_out', fmt: PC, target: 'hands on or inside the backswing path',
    A: [[-0.25, 8.5], [-0.12, 10], [-0.03, 10], [0.03, 8], [0.08, 6], [0.14, 4], [0.22, 2], [0.35, 1]] },
  { id: 'swayGap', view: 'fo', phase: 'Downswing', area: 'Tempo and sequencing', w: 1.5, name: 'Hips leading the chest', key: 'sway_gap_impact', fmt: PC, target: 'hips clearly ahead of the chest at impact',
    A: [[-0.15, 1.5], [-0.05, 3.5], [0.03, 6], [0.1, 8.5], [0.18, 9.5]] },
  { id: 'earlyExt', view: 'dtl', phase: 'Downswing', area: 'Impact position', w: 2.0, name: 'Hips toward the ball (early extension)', key: 'early_ext_max', fmt: PC, target: 'no closer to the ball than at address',
    A: [[-0.1, 10], [0, 10], [0.03, 9], [0.06, 7], [0.1, 5], [0.15, 3], [0.22, 1]] },
  { id: 'standUp', view: 'dtl', phase: 'Impact', area: 'Spine angle', w: 1.5, name: 'Posture held to impact', key: 'spine_change_deg', fmt: v => (v > 0 ? '+' : '') + Math.round(v) + '°', target: 'within about 4° of address (+ = standing up)',
    A: [[-14, 4], [-8, 8], [-3, 10], [2, 10], [5, 8.5], [8, 6.5], [12, 4], [18, 1.5]] },
  // ----- impact
  { id: 'hipShift', view: 'fo', phase: 'Impact', area: 'Impact position', w: 1.8, name: 'Weight shift (hips toward the target)', key: 'hip_shift_impact', fmt: PC, target: 'hips 10–35% of a torso length toward the target',
    A: [[-0.15, 1], [-0.05, 3], [0.02, 5.5], [0.08, 8], [0.15, 9.5], [0.35, 10], [0.5, 8], [0.65, 5]] },
  { id: 'slide', view: 'fo', phase: 'Impact', area: 'Impact position', w: 1.0, name: 'Lead hip over the lead foot (slide check)', key: 'slide_impact', fmt: PC, target: 'lead hip inside the lead foot',
    A: [[-0.3, 9.5], [-0.1, 9.5], [0, 8], [0.08, 5.5], [0.18, 3], [0.3, 1]] },
  { id: 'hipOpen', view: 'fo', phase: 'Impact', area: 'Hip and shoulder rotation', w: 1.5, name: 'Hips open at impact', key: 'hip_open_impact_deg', fmt: DG, target: 'about 30–45° open',
    A: [[0, 1], [10, 3], [18, 5.5], [25, 7.5], [32, 9], [38, 10], [55, 9], [70, 6]] },
  { id: 'impactTilt', view: 'fo', phase: 'Impact', area: 'Spine angle', w: 1.2, name: 'Staying behind the ball (spine tilt at impact)', key: 'side_tilt_impact_deg', fmt: DG, target: 'tilted away from the target, about 10–18°',
    A: [[-5, 1], [0, 3], [5, 5.5], [9, 8], [13, 9.5], [25, 9.5], [32, 7]] },
  { id: 'headImpact', view: 'fo', phase: 'Impact', area: 'Head stability', w: 1.2, name: 'Head behind the ball at impact', key: 'head_behind_impact', fmt: PC, target: 'level with or behind where it started',
    A: [[-0.35, 1.5], [-0.25, 3.5], [-0.15, 6], [-0.05, 8], [0.05, 9.5], [0.3, 10], [0.5, 7]] },
  { id: 'headSide', view: 'fo', phase: 'Backswing', area: 'Head stability', w: 0.8, name: 'Head movement side to side', key: 'head_max_side', fmt: PCa, target: 'under about 30% of a torso length',
    A: [[0.12, 10], [0.25, 9.5], [0.35, 7.5], [0.45, 5], [0.6, 3], [0.8, 1]] },
  { id: 'headDepth', view: 'dtl', phase: 'Backswing', area: 'Head stability', w: 1.0, name: 'Head moving toward or away from the ball', key: 'head_max_side', fmt: PCa, target: 'under about 10% of a torso length',
    A: [[0.06, 10], [0.12, 8.5], [0.2, 5.5], [0.3, 3], [0.45, 1]] },
  { id: 'headDrop', view: 'all', phase: 'Backswing', area: 'Head stability', w: 1.0, name: 'Head dipping', key: 'head_max_drop', fmt: PCa, target: 'under about 10% of a torso length',
    A: [[0.05, 10], [0.1, 9], [0.16, 7.5], [0.22, 5.5], [0.3, 3.5], [0.45, 1]] },
  { id: 'headRise', view: 'dtl', phase: 'Impact', area: 'Head stability', w: 0.8, name: 'Head height at impact', key: 'head_rise_impact', fmt: PC, target: 'about where it started (+ = lifted up)',
    A: [[-0.2, 5], [-0.1, 8.5], [-0.03, 10], [0.04, 9.5], [0.1, 6.5], [0.16, 4], [0.25, 1.5]] },
  // ----- follow-through and finish
  { id: 'chickenWing', view: 'fo', phase: 'Finish', area: 'Balance and finish', w: 1.1, name: 'Lead arm extending through the ball (chicken wing check)', key: 'lead_arm_through_deg', fmt: DG, target: 'long lead arm after impact (155°+ seen face-on)',
    A: [[110, 1], [125, 3], [138, 5.5], [148, 7.5], [156, 9], [163, 10]] },
  { id: 'finishWeight', view: 'fo', phase: 'Finish', area: 'Balance and finish', w: 1.0, name: 'Weight on the lead foot at the finish', key: 'finish_over_lead', fmt: PC, target: 'hips over the lead foot',
    A: [[-0.9, 1], [-0.7, 3], [-0.5, 6], [-0.35, 8], [-0.25, 9.5]] },
  { id: 'trailHeel', view: 'fo', phase: 'Finish', area: 'Balance and finish', w: 0.6, name: 'Up on the trail toe', key: 'trail_heel_up_finish', fmt: PCa, target: 'trail heel well off the ground',
    A: [[0, 2], [0.08, 5], [0.15, 7.5], [0.22, 9], [0.28, 10]] },
  { id: 'finishFo', view: 'fo', phase: 'Finish', area: 'Balance and finish', w: 0.6, name: 'Full finish (hands high)', key: 'finish_hands_height', fmt: v => v.toFixed(2), target: '1.4+ torso lengths above the hips',
    A: [[0.8, 2], [1.1, 5], [1.3, 8], [1.45, 9.5]] },
  { id: 'finishDtl', view: 'dtl', phase: 'Finish', area: 'Balance and finish', w: 0.6, name: 'Full finish (hands high)', key: 'finish_hands_height', fmt: v => v.toFixed(2), target: '1.2+ torso lengths above the hips',
    A: [[0.8, 2], [1.0, 5], [1.2, 8], [1.35, 9.5]] },
  { id: 'hold', view: 'all', phase: 'Finish', area: 'Balance and finish', w: 0.5, name: 'Holding the finish', key: 'finish_head_wobble', fmt: PCa, target: 'still and balanced',
    A: [[0.1, 10], [0.3, 8.5], [0.5, 6], [0.8, 3]] },
];
// how much each reading typically moves between two films of the same swing (measured by re-running clips with the trim moved a frame or two)
// how much each reading moves between two looks at the same swing (measured on real swings by re-running them
// with the trim moved), by check. A reading this close to a band edge is called borderline, not a fault.
const NOISE = { flatShoulders: 3, ballPos: 0.03, shaftLean: 1.5, downPlane: 0.06, tempo: 0.35, dsTime: 0.02, posture: 1.0, knees: 2.0, armHang: 0.04, hipDepth: 0.015, leadArm: 3, handsTopDtl: 0.02, handsTopFo: 0.02,
  ott: 0.03, earlyExt: 0.015, standUp: 1.5, headDepth: 0.02, headDrop: 0.02, headRise: 0.03, finishDtl: 0.03, finishFo: 0.05, hold: 0.05,
  stance: 0.02, setupTilt: 1, sway: 0.02, reverse: 1, shTurn: 3, hipTurn: 5, swayGap: 0.03, hipShift: 0.03, slide: 0.02, hipOpen: 4,
  impactTilt: 1.5, headImpact: 0.02, headSide: 0.02, chickenWing: 3, finishWeight: 0.06, trailHeel: 0.02 };
const AREA_LIST = ['Setup posture', 'Spine angle', 'Head stability', 'Hip and shoulder rotation', 'Backswing and top', 'Tempo and sequencing', 'Impact position', 'Balance and finish'];
function checks(m, view) {
  const v = view === 'face-on' ? 'fo' : view === 'down-the-line' ? 'dtl' : 'fo';
  const out = [];
  for (const c of CHECKS) {
    if (c.view !== 'all' && c.view !== v) continue;
    const val = m[c.key]; if (val == null || isNaN(val)) continue;
    // a reading has some wobble from frame to frame; score the range it could be, so being a hair either side of a
    // band edge doesn't swing the score
    const sd = NOISE[c.id] || 0, s = Math.max(0, Math.min(10, sd ? [-1, -0.5, 0, 0.5, 1].reduce((a, k) => a + lerp(val + k * sd, c.A), 0) / 5 : lerp(val, c.A)));
    // the score range the reading could really be in (two noise widths either side): a check is only a clear
    // fault when even its kindest reading is a fault, and only clearly fine when even its harshest is fine
    const lo = Math.min(lerp(val - 2 * sd, c.A), lerp(val + 2 * sd, c.A), lerp(val, c.A)), hi = Math.max(lerp(val - 2 * sd, c.A), lerp(val + 2 * sd, c.A), lerp(val, c.A));
    // tempo needs enough frames in a quarter-second downswing: below 50 frames a second it's shown, not judged
    // and filmed down the line the start of the takeaway moves the hands toward or away from the camera, so the
    // backswing (and the tempo ratio) can't be timed reliably: shown, not judged
    const lowFps = (c.id === 'tempo' || c.id === 'dsTime') && m.fps != null && m.fps < 50;
    const info = lowFps || (c.id === 'tempo' && v === 'dtl');
    out.push({ id: c.id, phase: c.phase, area: c.area, w: c.w, name: c.name, value: val, shown: c.fmt(val), target: c.target, score: Math.round(s * 10) / 10,
      infoWhy: info ? (lowFps ? 'fps' : 'angle') : undefined,
      verdict: info ? 'info' : hi < 6.5 ? (s >= 4 ? 'fault' : 'major') : lo >= 6.5 ? (s >= 8.5 ? 'tour' : 'ok') : 'borderline', info });
  }
  return out;
}
function score(m, view) {
  const C = checks(m, view).filter(c => !c.info), s = {};
  for (const a of AREA_LIST) {
    const cs = C.filter(c => c.area === a); if (!cs.length) { s[a] = null; continue; }
    const mean = cs.reduce((p, c) => p + c.score * c.w, 0) / cs.reduce((p, c) => p + c.w, 0), lo = Math.min(...cs.map(c => c.score));
    s[a] = Math.round(0.6 * mean + 0.4 * lo);   // one bad position drags the section down
  }
  s['Clubface and path (estimate)'] = null;
  // overall: weighted by how much each position matters, then held down by the worst faults
  const W = C.reduce((p, c) => p + c.w, 0), base = C.reduce((p, c) => p + c.score * c.w, 0) / (W || 1);
  // each position below the fault line costs up to 0.3 and each 'nearly there' one a little, phased in over a
  // point of score rather than switched on at a line, so a reading a hair either side never jumps the overall
  const ramp = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  const pen = C.reduce((p, c) => p + 0.3 * ramp(-c.score, -7, -6) + 0.05 * ramp(c.score, 6, 6.5) * ramp(-c.score, -8.5, -8), 0);
  let o = base - pen;
  // the weakest position holds the overall down (half of any amount above it + 3.2), phased in the same way
  const mn = C.length ? Math.min(...C.map(c => c.score)) : 10, cap = mn + 3.2;
  if (o > cap) o -= (o - cap) * 0.5 * ramp(-mn, -7, -6);
  s.overall = Math.max(1, Math.min(10, Math.round(o * 10) / 10));
  return s;
}
// what a score usually means in handicap terms (rough guide)
function level(o) {
  return o >= 9 ? { band: 'Tour-level positions', hcp: 'scratch or better' } : o >= 8 ? { band: 'Low handicap', hcp: 'about 0–6' } : o >= 7 ? { band: 'Single figures', hcp: 'about 5–10' }
    : o >= 6 ? { band: 'Mid handicap', hcp: 'about 10–16' } : o >= 5 ? { band: 'Mid-to-high handicap', hcp: 'about 15–20' } : o >= 4 ? { band: 'High handicap', hcp: 'about 20–28' } : { band: 'Beginner patterns', hcp: '28+' };
}

// ---------- What each check means, what it does to the ball, and how to fix it ----------
// Written in plain words from common coaching (Rick Shiels' fundamentals, TPI swing characteristics, GolfTEC and
// Sportsbox tour data). lo/hi: the fault when the number is too low or too high (two-sided checks).
const FAULTS = {
  stance: {
    lo: { title: 'Stance too narrow', why: 'A narrow base makes it hard to turn and shift without losing balance, so you lose speed and strike gets inconsistent, especially with driver.', feel: 'Feet about shoulder width with irons; for driver take one more step out with your trail foot.', drill: { name: 'Two-club stance check', steps: ['Lay a club across the front of your toes.', 'Lay a second club pointing at the ball from between your feet.', 'Set your feet so the outsides are about level with the outsides of your shoulders (a touch wider with driver).'] } },
    hi: { title: 'Stance too wide', why: 'A very wide stance locks your hips, so you sway instead of turning and struggle to get onto your lead side.', feel: 'Bring your feet in until you can turn your back to the target comfortably.', drill: { name: 'Feet-together swings', steps: ['Hit half shots with your feet almost touching.', 'Feel the body turn rather than slide.', 'Widen gradually to shoulder width keeping that same turn.'] } },
    good: 'Good stance width for a stable turn.' },
  setupTilt: {
    lo: { title: 'Leaning toward the target at address', why: 'Starting with your spine tilted toward the target sets you up to reverse pivot and hit down too steeply, causing pulls, slices and thin shots, especially with driver.', feel: 'Let your trail shoulder sit a touch lower than your lead shoulder, with your sternum just behind the ball.', drill: { name: 'Trail hand down the thigh', steps: ['Take your grip and stance.', 'Slide your trail hand a couple of inches down your trail thigh before regripping.', 'Check in the mirror that your spine leans slightly away from the target.'] } },
    good: 'Nice slight tilt away from the target at address.' },
  posture: {
    lo: { title: 'Standing too upright at address', why: 'Without enough hip hinge your arms have no room to swing, so the club gets flat and stuck, and you tend to stand up or move toward the ball through impact.', feel: 'Push your bum back and keep your back straight until your arms hang straight down from your shoulders.', drill: { name: 'Club down the spine', steps: ['Hold a club against your back touching your head, between your shoulder blades and your tailbone.', 'Hinge forward from the hips until your chest is over the ball, keeping all three contact points.', 'Let your knees soften and your arms hang. That\'s your posture.'] } },
    hi: { title: 'Bending over too much at address', why: 'Too much bend restricts your shoulder turn and makes it easy to lift up in the backswing, which leads to thin and fat shots.', feel: 'Stand a little taller with your chest up, still hinged from the hips, not the waist.', drill: { name: 'Club down the spine', steps: ['Hold a club against your back touching your head, between your shoulder blades and your tailbone.', 'Hinge only until the club handle points just beyond your toes.', 'Keep all three contact points as you set your arms.'] } },
    good: 'Good athletic hip hinge at address.' },
  knees: {
    lo: { title: 'Too much knee bend', why: 'Sitting down too much drops you into a squat, so you tend to stand up through impact and catch the ball thin.', feel: 'Just soften your knees. You should still see your shoelaces.', drill: { name: 'Shoelace check', steps: ['Set up and look down.', 'If you can\'t see your toes you\'re squatting; straighten a little.', 'If you can see all your laces, flex a touch more.'] } },
    hi: { title: 'Legs too straight at address', why: 'Locked knees make it hard to turn your hips and keep your balance, so your arms take over.', feel: 'Soft, athletic knees, like you\'re ready to catch a ball.', drill: { name: 'Shoelace check', steps: ['Set up and look down.', 'Soften your knees until the tops of your laces just disappear behind your knees.', 'Keep that flex as you take the club back.'] } },
    good: 'Soft, athletic knee flex.' },
  armHang: {
    lo: { title: 'Standing too close to the ball', why: 'Crowding the ball leaves no room for your hands, so you stand up through impact or catch it off the heel.', feel: 'Let your arms hang straight down from your shoulders with about a hand-width between your hands and your thighs.', drill: { name: 'Hand-width gap', steps: ['Set up, then let go with your trail hand.', 'Fit your flat trail hand between the grip and your lead thigh.', 'Move back until there\'s just a hand\'s width.'] } },
    hi: { title: 'Reaching for the ball', why: 'Reaching pulls your weight onto your toes, flattens the swing and causes toe strikes and shanks as you fall forward.', feel: 'Shuffle closer until your arms hang straight down under your shoulders.', drill: { name: 'Hand-width gap', steps: ['Set up and let your arms hang naturally.', 'Fit a hand between the grip and your lead thigh.', 'If there\'s much more room than that, move closer.'] } },
    good: 'Arms hang naturally under the shoulders.' },
  sway: {
    hi: { title: 'Sway: hips slide away from the target going back', why: 'When your hips slide back instead of turning, the low point of your swing moves around. That means fat and thin shots, blocks and lost power.', feel: 'Keep your sternum central and turn your back to the target. Feel pressure in the inside of your trail foot, not the outside.', drill: { name: 'Stick by the trail hip', steps: ['Push an alignment stick (or umbrella) into the ground just outside your trail hip.', 'Make backswings turning your hips without touching the stick.', 'Hit half shots, then full ones, keeping clear of it.'] } },
    lo: { title: 'Hips drifting toward the target going back', why: 'Moving toward the target in the backswing (a reverse pivot) leaves your weight on the wrong foot at the top, so you fall back through impact: weak slices, pulls and thin shots.', feel: 'Feel your weight move into your trail heel as you turn back.', drill: { name: 'Step-back drill', steps: ['Start with your feet together.', 'Step your trail foot back as you start the backswing.', 'Feel your weight load into that foot at the top, then swing through.'] } },
    good: 'Stable hips going back, turning rather than sliding.' },
  reverse: {
    lo: { title: 'Reverse spine angle at the top', why: 'Your upper body leans toward the target at the top. It\'s one of the most common faults and leads to steep, over-the-top swings, pulls, slices and a sore lower back.', feel: 'Keep your trail shoulder lower and your head behind the ball at the top. Turn, don\'t tilt toward the target.', drill: { name: 'Wall behind you', steps: ['Stand with your back a club-length from a wall, set up as normal.', 'Turn back until your trail glute touches the wall while your head stays behind the ball.', 'Make 10 slow rehearsals, then hit balls with the same feel.'] } },
    good: 'Spine stays tilted away from the target at the top.' },
  shTurn: {
    lo: { title: 'Short shoulder turn', why: 'Without a full turn the arms do the work. You lose speed, get steep from the top and tend to swing over the top.', feel: 'Rotate your lead shoulder down and under your chin until your back faces the target.', drill: { name: 'Club across the shoulders', steps: ['Hold a club across your chest with both arms crossed.', 'Turn back until the club points just past the ball.', 'Do 10 turns, then hit balls trying to copy that turn. Letting your trail knee straighten a little helps.'] } },
    good: 'Full shoulder turn.' },
  hipTurn: {
    lo: { title: 'Hips not turning going back', why: 'Locked hips cap your shoulder turn and make you lift your arms instead, costing power.', feel: 'Let your trail knee straighten a touch and your trail hip turn behind you.', drill: { name: 'Belt-buckle turn', steps: ['Set up with arms crossed on your chest.', 'Turn your belt buckle to point behind the ball.', 'Repeat 10 times, then hit balls copying it.'] } },
    hi: { title: 'Hips over-turning going back', why: 'Turning the hips too much loses the stretch between hips and shoulders, so you lose power and control.', feel: 'Feel the trail knee stay flexed and resist with your lower body while the shoulders turn.', drill: { name: 'Ball between the knees', steps: ['Squeeze a ball or headcover between your knees.', 'Make backswings without dropping it.', 'Hit half shots keeping that resistance.'] } },
    good: 'Good hip turn.' },
  hipDepth: {
    hi: { title: 'Losing posture in the backswing', why: 'Your hips move toward the ball as you turn back, so your spine angle changes and you have to make compensations later: thin, fat and shanked shots.', feel: 'Keep your bum back on the line it started on as you turn.', drill: { name: 'Chair drill', steps: ['Put a chair behind you so your bum just touches it at address.', 'Turn back keeping your trail cheek on the chair.', 'Swing through with your lead cheek moving onto it. Arms crossed first, then with a club.'] } },
    good: 'Hips stay back as you turn.' },
  leadArm: {
    lo: { title: 'Lead arm collapsing at the top', why: 'A bent lead arm narrows the swing, costs width and speed, and makes strike inconsistent.', feel: 'Keep the lead arm stretched and the takeaway wide, swinging back with your chest rather than lifting with the hands.', drill: { name: 'Wide takeaway', steps: ['Put a tee in the ground a foot behind the ball.', 'Sweep the club back low and wide through the tee.', 'Stop when your lead arm is parallel to the ground: still straight and the club pointing up.'] } },
    good: 'Wide, long lead arm at the top.' },
  handsTopFo: {
    lo: { title: 'Short backswing', why: 'A short, low backswing limits speed, and people often make up for it with the arms and hands from the top.', feel: 'Turn fully until your hands get up above your trail shoulder.', drill: { name: 'Pause at the top', steps: ['Swing back slowly and pause for a second at the top.', 'Check your hands are above your trail shoulder.', 'Hit balls with a feel of "turn, pause, go".'] } },
    good: 'Good length of backswing.' },
  handsTopDtl: {
    lo: { title: 'Short backswing', why: 'A short, low backswing limits speed, and people often make up for it with the arms and hands from the top.', feel: 'Turn fully until your hands get above your trail shoulder.', drill: { name: 'Pause at the top', steps: ['Swing back slowly and pause for a second at the top.', 'Check your hands are above your shoulder.', 'Hit balls with a feel of "turn, pause, go".'] } },
    good: 'Good length of backswing.' },
  tempo: {
    lo: { title: 'Rushed backswing (quick tempo)', why: 'Snatching the club back leaves no time for the body to set at the top, so the arms and shoulders throw it from the top.', feel: 'Smooth it away: "one-and-two" back, "three" down.', drill: { name: 'Count to three', steps: ['Say "one, two" through the backswing and "three" at impact.', 'Hit 10 shots at 70% speed holding that count.', 'Build speed but keep the count.'] } },
    hi: { title: 'Slow, stalled transition', why: 'A very slow backswing or a long pause at the top kills the stretch you created, so you lose speed.', feel: 'Keep the backswing moving and start down as soon as you feel the turn finish.', drill: { name: 'Continuous swings', steps: ['Make three back-and-through swings without stopping.', 'On the third, hit the ball.', 'Feel the club change direction smoothly at the top.'] } },
    good: 'Tour-like 3:1 rhythm.' },
  dsTime: {
    hi: { title: 'Slow downswing', why: 'A slow downswing usually means the arms are doing the work instead of the body unwinding from the ground up.', feel: 'Start down by pushing into the ground with your lead foot and turning your hips, letting the arms drag down.', drill: { name: 'Feet-together speed swings', steps: ['Feet together, no ball.', 'Swing and make the loudest "whoosh" you can past where the ball would be.', 'Do 10, then hit balls with a normal stance.'] } },
    lo: { title: 'Very quick downswing', why: 'A downswing this quick often means throwing the club from the top with the hands.', feel: 'Start down from the ground up: legs, hips, chest, then arms.', drill: { name: 'Pump drill', steps: ['Swing to the top.', 'Pump the club halfway down and back up twice, feeling the hips start it.', 'On the third, swing through.'] } },
    good: 'Good downswing speed.' },
  ballPos: {
    lo: { title: 'Ball too far back in your stance', why: 'With the ball back, the club reaches it while still coming down steeply and before the face has squared: low pushes, thin shots and a sore wrist from digging.', feel: 'Set the ball where the club naturally brushes the ground: just ahead of centre for irons, off your lead heel for driver.', drill: { name: 'Ball position check', steps: ['Lay a club on the ground pointing at the ball from between your feet.', 'For a mid iron, the ball should be a ball or two ahead of the middle of your stance.', 'For driver, in line with the inside of your lead heel.'] } },
    hi: { title: 'Ball too far forward in your stance', why: 'With the ball forward your shoulders open up to reach it, so the club swings across the ball: pulls, slices and thin shots as the club is already rising.', feel: 'Bring the ball back toward the middle until your shoulders sit square at address.', drill: { name: 'Ball position check', steps: ['Lay a club on the ground pointing at the ball from between your feet.', 'For a mid iron, the ball should be a ball or two ahead of the middle of your stance.', 'Check your shoulders are parallel to your feet with the ball there.'] } },
    good: 'Ball in the right place for the club.' },
  shaftLean: {
    lo: { title: 'Shaft leaning back at address', why: 'With your hands behind the ball the club is already flipping at address, which makes it easy to scoop the ball and hit it thin or fat.', feel: 'Set your hands level with, or just ahead of, the ball so the shaft leans a touch toward the target.', drill: { name: 'Hands ahead set-up', steps: ['Set the club behind the ball.', 'Move your hands until they sit over your lead thigh.', 'Keep that angle as you start the club back.'] } },
    hi: { title: 'Too much forward shaft lean at address', why: 'Pressing the hands well forward delofts and opens the face and tends to start the club back too far inside.', feel: 'Let the hands hang just ahead of the ball, over the inside of your lead thigh, not past it.', drill: { name: 'Neutral hands', steps: ['Set up and let your arms hang naturally.', 'The grip should point at your belt buckle or just ahead of it.', 'Make a few swings from that position.'] } },
    good: 'Good shaft angle at address.' },
  downPlane: {
    hi: { title: 'Coming down above the plane (steep)', why: 'Halfway down your hands are above the line from the ball through your shoulders, so the club comes into the ball steep and from outside: slices, pulls and divots that point left.', feel: 'From the top, let your trail elbow drop toward your hip so the hands come down under the line before you turn through.', drill: { name: 'Plane line drill', steps: ['Film down the line and draw two lines from the ball: one along the shaft at address, one through your shoulders.', 'Make slow swings pausing halfway down: the hands should be between the two lines.', 'Feel the club drop behind you first, then turn.'] } },
    lo: { title: 'Coming down too far under the plane (stuck)', why: 'Your hands drop under the line the shaft made at address, so the club gets stuck behind you and has to be flipped closed: pushes and hooks.', feel: 'Keep your chest turning through the ball so the arms stay in front of you coming down.', drill: { name: 'Pump and turn', steps: ['Swing to the top.', 'Pump down to halfway with the hands just under the shaft line, then back to the top, twice.', 'On the third, turn your chest through to the finish.'] } },
    good: 'Hands come down inside the swing plane.' },
  flatShoulders: {
    lo: { title: 'Flat shoulder turn', why: 'At the top your shoulders have turned too level for your posture, so you lose your spine angle and the club gets behind you or out of position; the downswing then has to re-route it, costing strike and consistency.', feel: 'Turn your lead shoulder down toward the ball, at right angles to your spine, rather than round level with the ground.', drill: { name: 'Club across the chest', steps: ['Hold a club across your chest in your posture.', 'Turn back: the club end by your lead shoulder should point at the ground just past the ball.', 'Hold the posture; repeat ten slow turns, then hit half shots.'] } },
    hi: { title: 'Tilting rather than turning', why: 'Your lead shoulder dives down rather than turning, so you tilt toward the ball at the top: steep swings, heavy contact and reverse pivots follow.', feel: 'Turn your back to the target around your spine; your lead shoulder goes across, not just down.', drill: { name: 'Club across the chest', steps: ['Hold a club across your chest in your posture.', 'Turn back so the club end by your lead shoulder points just past the ball, not at your feet.', 'Repeat ten slow turns, then hit half shots.'] } },
    good: 'Shoulders turn nicely around your spine.' },
  ott: {
    hi: { title: 'Over the top', why: 'Your hands come down further out than they went back, so the club cuts across the ball from out-to-in. That\'s the classic cause of slices (and pulls when the face is square).', feel: 'From the top, let the club drop behind you first, then swing out toward right field (for a right-hander).', drill: { name: 'Headcover outside the ball', steps: ['Place a headcover just outside and a few inches behind the ball.', 'Swing without hitting it, so you must come from the inside.', 'Aim to start the ball slightly right of target.'] } },
    good: 'Hands come down on or inside the backswing path.' },
  swayGap: {
    lo: { title: 'Upper body leading the downswing', why: 'Your chest moves toward the target as fast as your hips (or faster). That\'s how an over-the-top move starts and leads to pulls, slices and weak contact.', feel: 'Start down from the ground up: lead hip first, while your chest and head stay back.', drill: { name: 'Step-through drill', steps: ['Set up with your feet together.', 'Step toward the target with your lead foot as you start down.', 'Feel the hips lead and the chest stay back, then swing through.'] } },
    good: 'Hips lead the chest coming down.' },
  earlyExt: {
    hi: { title: 'Early extension (hips toward the ball)', why: 'Your hips move toward the ball coming down, so you stand up and lose room for the arms. It\'s the most common fault in amateur golf and causes blocks, hooks, thin and fat shots and shanks.', feel: 'Keep your bum back: feel your trail cheek, then your lead cheek, stay on the line behind you through impact.', drill: { name: 'Chair drill', steps: ['Put a chair behind you so your bum just touches it at address.', 'Swing back keeping your trail cheek on the chair.', 'Through impact, push your lead cheek into the chair. Rehearse with arms crossed, then hit half shots.'] } },
    good: 'No early extension: hips stay back through impact.' },
  standUp: {
    hi: { title: 'Standing up through impact', why: 'Losing your spine angle raises the bottom of the swing, so you catch it thin or off the toe and lose compression.', feel: 'Keep your chest over the ball until it\'s gone.', drill: { name: 'Chair drill', steps: ['Set up with your bum touching a chair behind you.', 'Keep contact with the chair right through impact.', 'Hit half shots holding your posture to a balanced finish.'] } },
    lo: { title: 'Dipping down through impact', why: 'Bending further toward the ball through impact causes fat shots and hits off the heel.', feel: 'Feel tall through impact with your chest rotating, not diving.', drill: { name: 'Hold the height', steps: ['Rest a club across your shoulders.', 'Rotate through without the club tipping toward the ball.', 'Then hit half shots with the same feeling.'] } },
    good: 'Spine angle held to impact.' },
  hipShift: {
    lo: { title: 'Hanging back at impact', why: 'Your weight is still on your trail side at impact, so the low point is behind the ball: fat shots, thin shots and weak, high slices.', feel: 'From the top, shift your lead hip toward the target and feel about two-thirds of your weight on your lead foot at impact. Ball first, ground after.', drill: { name: 'Lead foot only finish', steps: ['Hit half shots and finish standing on your lead foot.', 'Lift your trail foot off the ground at the finish and hold for three seconds.', 'If you can\'t, you hung back.'] } },
    hi: { title: 'Too much lateral move toward the target', why: 'Moving the whole body too far toward the target gets you ahead of the ball, so it\'s easy to block or pull it.', feel: 'Shift a little, then turn: the hips rotate open rather than keep sliding.', drill: { name: 'Stick outside the lead hip', steps: ['Push a stick into the ground just outside your lead hip.', 'Swing through so your hip turns away from it rather than bumping it.', 'Hit half shots, then full.'] } },
    good: 'Good weight shift onto the lead side.' },
  slide: {
    hi: { title: 'Sliding past the lead foot', why: 'Your lead hip slides outside your lead foot instead of rotating, so you lose speed and the face is hard to square, giving blocks and hooks.', feel: 'Bump a little, then turn: feel your lead hip turn back behind you.', drill: { name: 'Stick outside the lead hip', steps: ['Push a stick into the ground just outside your lead hip at address.', 'Swing through without your hip touching the stick: it should turn away from it.', 'Start slow, then speed up.'] } },
    good: 'Lead hip stays over the lead foot.' },
  hipOpen: {
    lo: { title: 'Hips not open at impact', why: 'Tour players arrive at impact with their hips about 36° open; most amateurs are closer to 20°. Square hips mean the arms take over: less speed, and hooks or slices.', feel: 'From the top, turn your belt buckle toward the target first and let the arms follow.', drill: { name: 'Hips-first pump', steps: ['Swing to the top.', 'Turn your hips open toward the target while your arms stay back, then return.', 'Do it twice, then swing through on the third.'] } },
    good: 'Hips nicely open at impact.' },
  impactTilt: {
    lo: { title: 'Not staying behind the ball', why: 'Your spine is upright or leaning toward the target at impact. That makes the club come in steep, so you get thin shots, low-spinning slices and a weak driver.', feel: 'At impact your trail shoulder is lower than your lead shoulder and your head stays behind the ball.', drill: { name: 'Headcover under the trail arm', steps: ['Tuck a headcover under your trail armpit.', 'Swing back and through keeping it until just after impact.', 'Feel the trail side stay low and behind.'] } },
    good: 'Stays behind the ball at impact.' },
  headImpact: {
    lo: { title: 'Head moving toward the target', why: 'Your head gets ahead of where it started, so your upper body is out in front at impact: steep strikes, pulls and slices, and weak drives.', feel: 'Keep your head behind the ball until after it\'s gone.', drill: { name: 'Shadow check', steps: ['With the sun behind you, set up so your head\'s shadow sits on a tee.', 'Swing keeping the shadow on or behind it through impact.', 'Or film yourself face-on and check.'] } },
    good: 'Head stays behind the ball through impact.' },
  headSide: {
    hi: { title: 'Head moving a lot side to side', why: 'Big head movement moves the whole swing, so strike gets inconsistent.', feel: 'Turn around a steady head: the chest turns under it rather than the head going with it.', drill: { name: 'Hat on the head', steps: ['Film face-on with a fixed line behind your head.', 'Make swings keeping your head within a hat\'s width of the line.', 'Check the video every five balls.'] } },
    good: 'Steady head.' },
  headDepth: {
    hi: { title: 'Head moving toward or away from the ball', why: 'If your head moves in or out, your spine angle is changing, which changes where the club bottoms out: heel and toe strikes.', feel: 'Keep the same distance from the ball with your head throughout.', drill: { name: 'Head against a wall', steps: ['Set up with your head lightly touching a wall or door in front of you.', 'Make slow backswings and downswings keeping the contact.', 'Then hit balls with the same feel.'] } },
    good: 'Head stays at the same distance from the ball.' },
  headDrop: {
    hi: { title: 'Head dipping in the swing', why: 'Dropping the head lowers the bottom of your swing, so you hit fat shots and then stand up to save it.', feel: 'Keep your head level and let your chest turn under it.', drill: { name: 'Level head rehearsal', steps: ['Set up with a mirror or camera at eye level.', 'Turn back and through keeping your eyes on the same line.', 'Hit slow half shots with the same feel.'] } },
    good: 'Head stays level.' },
  headRise: {
    hi: { title: 'Head lifting at impact', why: 'Lifting the head means your body is standing up, so you top or thin it.', feel: 'Stay down: your chest stays over the ball until your trail shoulder pulls your head up into the finish.', drill: { name: 'Look at the spot', steps: ['Put a coin under the ball.', 'After the strike, keep looking at the coin for a count of one.', 'Then rotate up into the finish.'] } },
    lo: { title: 'Head dropping at impact', why: 'Dropping toward the ball through impact causes fat shots and heel strikes.', feel: 'Stay tall through the ball, rotating rather than diving.', drill: { name: 'Level head rehearsal', steps: ['Set up with a camera at eye level.', 'Swing keeping your eyes on the same line.', 'Hit slow half shots with the same feel.'] } },
    good: 'Head height steady at impact.' },
  chickenWing: {
    lo: { title: 'Chicken wing (lead arm folding through impact)', why: 'Your lead elbow bends through the ball instead of extending. It adds loft and spin, loses distance and leaves the face open: weak slices.', feel: 'Extend both arms through the ball and let your forearms cross over, while your body keeps rotating.', drill: { name: 'Lead-arm-only swings', steps: ['Hold the club in your lead hand only, halfway down the grip.', 'Make small swings rotating your chest and keeping the lead arm long after impact.', 'Then hit with both hands, feeling the forearms cross.'] } },
    good: 'Arms extend through the ball.' },
  finishWeight: {
    lo: { title: 'Falling back at the finish', why: 'Finishing on your back foot means your weight never got through: thin, fat and weak shots.', feel: 'Finish with almost all your weight on your lead foot, belt buckle facing the target.', drill: { name: 'Hold for three', steps: ['Hit every practice shot and hold your finish for a count of three.', 'Your trail foot should be up on its toe, only balancing.', 'If you wobble, slow down until you can hold it.'] } },
    good: 'Finishes on the lead foot.' },
  trailHeel: {
    lo: { title: 'Trail foot flat at the finish', why: 'If your trail heel stays down, your hips stopped turning and your weight stayed back.', feel: 'Let your trail heel come up so you finish on its toe, belt buckle to the target.', drill: { name: 'Hold for three', steps: ['Swing to a full finish.', 'Check the sole of your trail shoe faces behind you.', 'Hold for a count of three.'] } },
    good: 'Up on the trail toe at the finish.' },
  finishFo: {
    lo: { title: 'Short finish', why: 'Stopping short of a full finish means you\'re slowing down through the ball, which costs speed and control.', feel: 'Rotate all the way until your hands finish over your lead shoulder.', drill: { name: 'Hold for three', steps: ['Swing through to a full finish.', 'Hold it for a count of three.', 'Belt buckle and chest facing the target.'] } },
    good: 'Full, high finish.' },
  finishDtl: {
    lo: { title: 'Short finish', why: 'Stopping short of a full finish means you\'re slowing down through the ball, which costs speed and control.', feel: 'Rotate all the way until your hands finish over your lead shoulder.', drill: { name: 'Hold for three', steps: ['Swing through to a full finish.', 'Hold it for a count of three.', 'Belt buckle and chest facing the target.'] } },
    good: 'Full, high finish.' },
  hold: {
    hi: { title: 'Wobbly finish', why: 'Not being able to hold your finish means you swung out of balance, usually too hard.', feel: 'Swing at 80% and hold your finish until the ball lands.', drill: { name: 'Hold for three', steps: ['Every practice ball: hold the finish for a count of three.', 'If you can\'t, swing a bit softer.', 'Add speed only while you can still hold it.'] } },
    good: 'Balanced finish.' },
};
// which side of the check failed: the side of the anchors where the score drops
function faultSide(c) {
  const def = CHECKS.find(x => x.id === c.id); if (!def) return 'lo';
  const best = def.A.reduce((a, b) => b[1] > a[1] ? b : a);
  return c.value < best[0] ? 'lo' : 'hi';
}
// a check turned into coaching: title, why, feel, drill (null when it's fine)

// One swing thought for when you're hitting balls, about the club, ball, ground or target rather than a body part.
// External cues like these beat body-part cues for accuracy in beginners and scratch golfers alike (Wulf & Su 2007,
// pitch shots: an internal 'arms' focus was no better than no instruction). The body 'feel' in FAULTS stays for
// slow rehearsal swings; this is the one thought to take to the ball.
const CUES = {
  'stance.lo': 'Set your feet so the clubhead could sweep a line from your trail toe to your lead toe.',
  'stance.hi': 'Set your feet so you could just step a ball-width toward each other.',
  'setupTilt.lo': 'Set the grip end of the club pointing at your lead hip pocket, not past it.',
  'posture.lo': 'Let the grip end point at your belt buckle with the clubhead sitting flat on the ground.',
  'posture.hi': 'Hold the club so its sole sits flat, with the grip end pointing just below your belt buckle.',
  'knees.lo': 'Stand tall enough that the clubhead sits flat on the ground, not on its heel.',
  'knees.hi': 'Stand ready to jump: flex until the club sole sits flat without reaching.',
  'armHang.lo': 'Leave a hand-width of space between the butt of the club and your thighs.',
  'armHang.hi': 'Move in until the butt of the club is a hand-width from your thighs.',
  'sway.lo': 'Swing the clubhead back low and wide along the ground for the first two feet.',
  'sway.hi': 'Swing the club back around you, not away from the target: turn the clubhead behind you.',
  'reverse.lo': 'At the top, feel the club point at the target behind your head, not at the sky.',
  'shTurn.lo': 'Swing the club back until the shaft points at the target at the top.',
  'hipTurn.lo': 'Swing the club back further round behind you, letting the belt buckle follow.',
  'hipTurn.hi': 'Make a compact backswing: stop when the shaft points at the target.',
  'hipDepth.hi': 'Swing the club back around you while the ball stays the same distance from your belt.',
  'leadArm.lo': 'Push the clubhead as far from the ball as you can going back: make the arc wide.',
  'handsTopFo.lo': 'Swing the club back until the shaft points at the target.',
  'handsTopDtl.lo': 'Swing the club back until the shaft points at the target.',
  'tempo.lo': 'Swing the clubhead back slowly enough that you could stop it at any point.',
  'tempo.hi': 'Let the clubhead change direction at the top without a pause.',
  'dsTime.lo': 'Swing at 80% and let the clubhead pick up speed through the ball, not from the top.',
  'dsTime.hi': 'Swish the clubhead through the ball: the loudest swish should be just after the ball.',
  'ballPos.lo': 'Put the ball where your practice swing brushes the grass.',
  'ballPos.hi': 'Put the ball where your practice swing brushes the grass.',
  'shaftLean.lo': 'Let the grip end point at the inside of your lead thigh at address.',
  'shaftLean.hi': 'Let the grip end point at your belt buckle or just ahead of it.',
  'downPlane.lo': 'Swing the clubhead through toward the target, not out to the right.',
  'downPlane.hi': 'Swing the clubhead out at right field (for a right-hander): hit the inside back of the ball.',
  'ott.hi': 'Swing the clubhead out at right field (for a right-hander): hit the inside back of the ball.',
  'swayGap.lo': 'Feel the club stay behind you as you start down; the ball comes to you.',
  'earlyExt.hi': 'Swing the clubhead out toward the target after impact, keeping room between the club and your legs.',
  'standUp.lo': 'Brush the grass just in front of the ball.',
  'standUp.hi': 'Brush the grass just in front of the ball.',
  'hipShift.lo': 'Take a divot just in front of the ball (or brush the tee with a driver).',
  'hipShift.hi': 'Swing the club around to the finish rather than toward the target.',
  'slide.hi': 'Swing the club around you to the finish, not out at the target.',
  'hipOpen.lo': 'Swing the club to a full finish, with the shaft behind your head.',
  'impactTilt.lo': 'Hit the back of the ball, not the top of it.',
  'headImpact.lo': 'Watch the back of the ball until the club has hit it.',
  'headSide.hi': 'Keep your eyes on one dimple on the back of the ball.',
  'headDepth.hi': 'Keep your eyes on one dimple on the back of the ball.',
  'headDrop.hi': 'Keep your eyes on one dimple on the back of the ball, at the same height.',
  'headRise.lo': 'Brush the grass just in front of the ball.',
  'headRise.hi': 'Keep looking at the spot where the ball was until the club has passed it.',
  'chickenWing.lo': 'Throw the clubhead out toward the target after impact, so the shaft points at it.',
  'finishWeight.lo': 'Finish with the club behind your head and the ball still in sight down the fairway.',
  'trailHeel.lo': 'Finish with the club behind your head and your belt buckle facing the target.',
  'finishFo.lo': 'Finish with the club wrapped behind your head.',
  'finishDtl.lo': 'Finish with the club wrapped behind your head.',
  'hold.hi': 'Swing at 80% and hold the finish until the ball lands.',
  'flatShoulders.lo': 'Swing the club up more, so at the top the shaft is over your trail shoulder, not behind your neck.',
  'flatShoulders.hi': 'Swing the club back more around you, so the shaft sits over your trail shoulder at the top.'
};
function advice(c) {
  const F = FAULTS[c.id]; if (!F) return null;
  if (c.score >= 8.5) return { good: F.good };
  const side = faultSide(c), f = F[side] || F.lo || F.hi;
  return Object.assign({ severity: c.score < 4 ? 'major' : c.score < 5.5 ? 'moderate' : c.score < 6.5 ? 'minor' : 'polish', cue: CUES[c.id + '.' + side] || null }, f);
}
// What a coach asks first: "what's your usual miss?". For each miss, the body faults the camera can see that
// commonly cause it (strength 0-1), with the link in plain words. A fault linked to the golfer's miss moves up the
// list and says why; the camera can't see the clubface, so a miss with no visible cause is said honestly.
const MISSES = {
  slice: { name: 'slice', links: [
    ['ott', 'hi', 1, 'Coming over the top swings the club across the ball from out to in, which is the classic slice spin.'],
    ['downPlane', 'hi', 1, 'Coming down above the shaft plane brings the club into the ball from outside, putting slice spin on it.'],
    ['ballPos', 'hi', 0.4, 'A ball too far forward opens your shoulders at address, so the club swings across it.'],
    ['reverse', 'lo', 0.7, 'Leaning toward the target at the top makes you fall back coming down and throw the club over the top.'],
    ['shTurn', 'lo', 0.6, 'A short shoulder turn leaves the arms to do the work, and they swing out and across the ball.'],
    ['chickenWing', 'lo', 0.6, 'A lead arm that folds through impact holds the clubface open, so the ball curves right (for a right-hander).'],
    ['sway', 'hi', 0.4, 'Swaying off the ball makes you lunge back at it from the top, which swings the club across it.'],
    ['hipShift', 'lo', 0.5, 'Hanging back on your trail side leaves the face open and the path across the ball.']] },
  hook: { name: 'hook', links: [
    ['earlyExt', 'hi', 1, 'When your hips move toward the ball the arms get stuck behind you, so the hands flip the face shut to save the shot.'],
    ['downPlane', 'lo', 0.8, 'Coming down well under the plane gets the club stuck behind you, so the hands flip it shut.'],
    ['hipShift', 'lo', 0.7, 'Hanging back makes the hands take over through impact and close the face.'],
    ['hipOpen', 'lo', 0.7, 'If your hips stop turning through impact the arms overtake the body and the face shuts.'],
    ['swayGap', 'lo', 0.4, 'Starting down with the upper body throws the timing off so the hands close the face to catch up.'],
    ['standUp', 'hi', 0.4, 'Standing up through impact gets the club stuck, and a late flip of the hands hooks it.']] },
  push: { name: 'push', links: [
    ['earlyExt', 'hi', 1, 'Hips moving toward the ball leave the arms stuck behind you, so the club swings out to the right (for a right-hander).'],
    ['slide', 'hi', 0.7, 'Sliding past your lead foot leaves the clubface behind, pointing right of target.'],
    ['downPlane', 'lo', 0.8, 'Coming down well under the plane swings the club out to the right (for a right-hander).'],
    ['ballPos', 'lo', 0.6, 'A ball too far back is struck before the club has swung back to the target line, so it starts right.'],
    ['hipShift', 'hi', 0.6, 'Too much move toward the target gets the body ahead of the club and the face stays open.'],
    ['standUp', 'hi', 0.5, 'Standing up through impact gets the club stuck behind you, which pushes the ball.']] },
  pull: { name: 'pull', links: [
    ['ott', 'hi', 1, 'Coming over the top swings the club left of target (for a right-hander), so a square face pulls it straight left.'],
    ['downPlane', 'hi', 1, 'Coming down above the plane swings the club left of target, pulling the ball.'],
    ['ballPos', 'hi', 0.6, 'A ball too far forward is struck after the club has started swinging left.'],
    ['hipOpen', null, 0.4, 'Hips and shoulders spinning open early swing the club across the ball to the left.'],
    ['reverse', 'lo', 0.5, 'A reverse spine at the top tends to throw the club over the top and pull it.']] },
  fat: { name: 'fat', links: [
    ['hipShift', 'lo', 1, 'Hanging back keeps the bottom of your swing behind the ball, so the club hits the ground first.'],
    ['ballPos', 'hi', 0.5, 'A ball too far forward sits past the bottom of your swing, so the club hits the ground first.'],
    ['shaftLean', 'lo', 0.5, 'Hands behind the ball at address set you up to flip and catch the ground first.'],
    ['sway', 'hi', 0.8, 'Swaying away from the target moves the bottom of the swing back with you.'],
    ['headDrop', 'hi', 0.7, 'Your head dipping takes the club lower, into the ground before the ball.'],
    ['headRise', 'lo', 0.6, 'Your head dropping at impact takes the club into the ground.'],
    ['finishWeight', 'lo', 0.6, 'Falling back at the finish shows the weight stayed back, which puts the low point behind the ball.'],
    ['impactTilt', 'lo', 0.4, 'Your upper body is ahead of the ball at impact, so the club comes in steep and digs.']] },
  thin: { name: 'thin', links: [
    ['standUp', 'hi', 1, 'Standing up through impact lifts the club, so it catches the middle of the ball.'],
    ['ballPos', 'hi', 0.5, 'A ball too far forward is reached after the bottom of the swing, with the club already rising.'],
    ['shaftLean', 'lo', 0.4, 'Hands behind the ball at address make it easy to scoop and catch it thin.'],
    ['earlyExt', 'hi', 0.9, 'Hips moving toward the ball make you stand up to make room, raising the club.'],
    ['headRise', 'hi', 0.7, 'Your head lifting at impact lifts your chest and the club with it.'],
    ['hipShift', 'lo', 0.5, 'Hanging back means the club bottoms out early and is rising when it reaches the ball.'],
    ['chickenWing', 'lo', 0.5, 'A lead arm folding through impact shortens the radius, so the club rises into the ball.']] },
  top: { name: 'topped shot', links: [
    ['standUp', 'hi', 1, 'Standing up through impact lifts the club right off the ground.'],
    ['headRise', 'hi', 0.9, 'Lifting your head to see where it went lifts your chest and the club with it.'],
    ['earlyExt', 'hi', 0.8, 'Hips moving toward the ball make you stand up, lifting the club.'],
    ['chickenWing', 'lo', 0.6, 'A lead arm folding through impact pulls the club up into the top of the ball.']] },
  shank: { name: 'shank', links: [
    ['earlyExt', 'hi', 1, 'Hips moving toward the ball push your hands out, so the hosel (the neck of the club) gets to the ball first.'],
    ['headDepth', 'hi', 0.8, 'Your head moving toward the ball takes your hands closer to it, bringing the hosel into play.'],
    ['hipDepth', 'hi', 0.8, 'Losing posture going back moves your body toward the ball, so the hands come down further out.'],
    ['ott', 'hi', 0.4, 'Coming over the top can throw the hands out toward the ball.']] }
};
const FAMILY = { ott: 'steep', downPlane: 'steep' };
function missLink(c, miss) {
  const M = miss && MISSES[miss]; if (!M) return null;
  for (const [id, side, k, why] of M.links) if (id === c.id && (!side || faultSide(c) === side)) return { k, why };
  return null;
}
// the faults to work on, most important first (how bad × how much it matters)
const PHASE_ORDER = ['Setup', 'Backswing', 'Top', 'Downswing', 'Impact', 'Finish'];
function faults(C, miss) {
  // everything scoring below the fault line, clear faults and borderline readings ranked together by how much they
  // matter (so a reading a hair either side of the line doesn't drop out of the list); borderline ones are marked.
  // A coach fixes the earliest cause first, so among faults of similar size the one earlier in the swing leads.
  return C.filter(c => !c.info && (c.verdict === 'fault' || c.verdict === 'major' || (c.verdict === 'borderline' && c.score < 6.5))).map(c => { const ph = Math.max(0, PHASE_ORDER.indexOf(c.phase));
    const ml = missLink(c, miss);
    // a fault that explains the golfer's own miss counts up to twice as much
    return Object.assign({}, c, { advice: advice(c), borderline: c.verdict === 'borderline', missWhy: ml ? ml.why : null, pri: (6.5 - c.score) * c.w * (1.25 - 0.05 * ph) * (1 + (ml ? ml.k : 0)) }); })
    .filter(c => c.advice && c.advice.title).sort((a, b) => b.pri - a.pri || a.id.localeCompare(b.id))
    // the same fault seen two ways (hand path and the plane line) is reported once, the stronger reading
    .filter((c, i, all) => !(FAMILY[c.id] && all.slice(0, i).some(x => FAMILY[x.id] === FAMILY[c.id] && faultSide(x) === faultSide(c))));
}

// Rough swing window from a sparse scan: the first time the hands go high after a set-up.
function findWindow(frames) {
  const F = frames.filter(f => f.pts).map(features).sort((a, b) => a.t - b.t);
  // samples are a few per second, so the very top is usually missed and the highest sample can flip between two
  // nearly equal ones. Instead anchor on the moment the hands rise through 0.45 torso lengths above the address,
  // placed between the two samples either side: a tiny tracking difference then moves the trim only a tiny amount.
  for (let i = 1; i < F.length; i++) if (F[i].h > 0.45 && F[i - 1].h <= 0.45 && F.slice(0, i).some(f => f.h < 0.3)) {
    let pk = F[i].h; for (let j = i + 1; j < F.length && F[j].t - F[i].t <= 1.0; j++) pk = Math.max(pk, F[j].h);
    if (pk < 0.55) continue;
    const a = F[i - 1], b = F[i], tc = a.t + (b.t - a.t) * (0.45 - a.h) / Math.max(1e-6, b.h - a.h);
    return { t0: tc - 1.2, t1: tc + 2.4, hi: tc };
  }
  return null;
}

// ---------- The club shaft at address, from the picture ----------
// The shaft is the thinnest, most continuous straight line from the hands down to near the feet (searched in one
// frame at a time: golfers waggle, so the club isn't still enough to average frames). Searched coarse-to-fine; returns
// null when no line stands out clearly from its surroundings (better no plane line than a wrong one).
// g: grey image (Float32Array, w*h, 0-255); hx,hy: hands; T: torso length (px); footY: ankle height (px).
// opt.view: 'down-the-line' (the shaft points out from the body toward the ball, opt.dir = +1/-1 in x, at a
// normal lie, 20-70° from the ground) or 'face-on' (the shaft hangs within 35° of vertical). Lines outside these
// (legs, the edge of shorts, mat lines) are never considered.
function detectShaft(g, w, h, hx, hy, T, footY, opt) {
  opt = opt || {};
  const okAng = a => { const c = Math.cos(a), fromH = Math.asin(Math.min(1, Math.abs(Math.sin(a)))) * 180 / Math.PI;
    if (opt.view === 'down-the-line') return fromH >= 20 && fromH <= 70 && (!opt.dir || Math.sign(c) === opt.dir);
    if (opt.view === 'face-on') return fromH >= 55;
    return true; };
  const px = (x, y) => { if (x < 0) x = 0; if (y < 0) y = 0; if (x > w - 1.001) x = w - 1.001; if (y > h - 1.001) y = h - 1.001;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return g[i] * (1 - fx) * (1 - fy) + g[i + 1] * fx * (1 - fy) + g[i + w] * (1 - fx) * fy + g[i + w + 1] * fx * fy; };
  // how much the line stands out as a thin stripe (darker or lighter than both sides), mean and 30th percentile
  const line = (x0, y0, x1, y1, a = 0.2, b = 0.97, off = 0) => {
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 4) return 0; const nx = -(y1 - y0) / L, ny = (x1 - x0) / L, n = Math.max(12, Math.min(160, L | 0)), d = new Float32Array(n);
    for (let k = 0; k < n; k++) { const t = a + (b - a) * k / (n - 1), x = x0 + (x1 - x0) * t + nx * off, y = y0 + (y1 - y0) * t + ny * off;
      const c = px(x, y), l = px(x + nx * 2.5, y + ny * 2.5), r = px(x - nx * 2.5, y - ny * 2.5), dl = c - l, dr = c - r;
      d[k] = (dl > 0) === (dr > 0) ? Math.min(Math.abs(dl), Math.abs(dr)) : 0; }
    let m = 0; for (let k = 0; k < n; k++) m += d[k]; m /= n; const srt = Array.from(d).sort((p, q) => p - q);
    return 0.5 * m + 0.5 * srt[Math.floor(n * 0.3)]; };
  let best = null;
  const tryLine = (gx, gy, ang, ey) => { const sn = Math.sin(ang); if (sn < 0.25 || !okAng(ang)) return; const L = (ey - gy) / sn; if (L < 0.8 * T || L > 2.6 * T) return;
    const cx = gx + Math.cos(ang) * L, cy = ey, s = line(gx, gy, cx, cy); if (!best || s > best.s) best = { s, gx, gy, cx, cy, ang }; };
  const D = Math.PI / 180;
  for (let dx = -0.2; dx <= 0.201; dx += 0.1) for (let dy = -0.1; dy <= 0.301; dy += 0.1)
    for (let a = 15; a <= 165; a += 1.5) for (let e = -0.4; e <= 0.601; e += 0.2) tryLine(hx + dx * T, hy + dy * T, a * D, footY + e * T);
  if (!best) return null;
  const b0 = Object.assign({}, best), ey0 = b0.cy;
  for (let dx = -0.05; dx <= 0.0501; dx += 0.025) for (let dy = -0.05; dy <= 0.0501; dy += 0.025)
    for (let a = -2; a <= 2.001; a += 0.25) for (let e = -0.1; e <= 0.101; e += 0.05) tryLine(b0.gx + dx * T, b0.gy + dy * T, b0.ang + a * D, ey0 + e * T);
  const B = best, L = Math.hypot(B.cx - B.gx, B.cy - B.gy), ux = (B.cx - B.gx) / L, uy = (B.cy - B.gy) / L;
  // follow the shaft on to the clubhead while it still stands out (short faint gaps allowed: the lower shaft is
  // often faint against grass); where it fades, the clubhead is placed where the straight shaft meets the ground
  let end = 0.6 * L, miss = 0; const step = 0.06 * T;
  for (let t = 0.6 * L; t < 3 * T; t += step) { const s = line(B.gx + ux * t, B.gy + uy * t, B.gx + ux * (t + step), B.gy + uy * (t + step), 0, 1);
    if (s >= 0.3 * B.s) { end = t + step; miss = 0 } else if (++miss > 3) break; }
  const ground = footY + 0.1 * T, tg = uy > 0.2 ? (ground - B.gy) / uy : end;
  const head = { x: B.gx + ux * Math.max(end, Math.min(tg, 3 * T)), y: B.gy + uy * Math.max(end, Math.min(tg, 3 * T)) };
  // it must stand out from lines just beside it
  const side = Math.max(line(B.gx, B.gy, B.cx, B.cy, 0.2, 0.97, 7), line(B.gx, B.gy, B.cx, B.cy, 0.2, 0.97, -7));
  const conf = B.s / (side + 1);
  return { gx: B.gx, gy: B.gy, cx: head.x, cy: head.y, seenTo: end / L, ang: B.ang / D, s: B.s, conf, ok: B.s >= 10 && conf >= 3 };
}

// ---------- Swing-to-swing consistency ----------
// Good players repeat their positions: how much a position varies from swing to swing tracks skill closely (e.g.
// spine tilt across swings, r ≈ 0.8 with scoring, Frontiers 2023). Given the measurements from several swings
// filmed from the same angle, each check's spread (standard deviation) is compared with the width of its 'good'
// band; anything no bigger than the tracking's own wobble is reported as steady.
function consistency(list, view) {
  const ms = list.filter(m => m && m.view === view); if (ms.length < 3) return null;
  const out = [];
  const v = view === 'down-the-line' ? 'dtl' : 'fo';
  for (const c of CHECKS) {
    if (c.view !== 'all' && c.view !== v) continue;
    const vs = ms.map(m => m[c.key]).filter(x => x != null && !isNaN(x)); if (vs.length < 3) continue;
    const mean = vs.reduce((a, b) => a + b, 0) / vs.length, sd = Math.sqrt(vs.reduce((a, b) => a + (b - mean) ** 2, 0) / (vs.length - 1));
    const good = c.A.filter(a => a[1] >= 9.5).map(a => a[0]), width = good.length > 1 ? Math.max(...good) - Math.min(...good) : (Math.max(...c.A.map(a => a[0])) - Math.min(...c.A.map(a => a[0]))) / 6;
    const noise = NOISE[c.id] || 0, ratio = sd <= 1.5 * noise ? 0 : sd / Math.max(1e-9, width);
    out.push({ id: c.id, name: c.name, n: vs.length, sd, ratio, fmt: c.fmt, mean, state: ratio < 0.3 ? 'steady' : ratio < 0.6 ? 'varies' : 'all over' });
  }
  out.sort((a, b) => b.ratio * (CHECKS.find(c => c.id === b.id).w) - a.ratio * (CHECKS.find(c => c.id === a.id).w));
  const steady = out.filter(o => o.state === 'steady').length;
  return { n: ms.length, items: out, steadyShare: out.length ? steady / out.length : 1 };
}

// ---------- Since last time ----------
// What a coach checks first at the next lesson: did the thing we worked on change? Compares this swing with the
// previous one from the same angle, check by check. A change only counts when it's bigger than three times the
// tracking's own wobble and moves the score by at least a point.
function progress(now, prev, view) {
  if (!now || !prev || prev.view !== view) return null;
  const a = checks(now, view), b = checks(prev, view), out = [];
  for (const c of a) { const p = b.find(x => x.id === c.id); if (!p || c.info || p.info) continue;
    const dv = c.value - p.value, ds = c.score - p.score, sd = NOISE[c.id] || 0;
    if (Math.abs(ds) >= 1 && Math.abs(dv) > 3 * sd) out.push({ id: c.id, name: c.name, from: p.shown, to: c.shown, ds, better: ds > 0, w: c.w }); }
  out.sort((x, y) => Math.abs(y.ds) * y.w - Math.abs(x.ds) * x.w);
  return { better: out.filter(o => o.better), worse: out.filter(o => !o.better) };
}
const api = { progress, CUES, consistency, detectShaft, MISSES, missLink, analyse, features, phases, score, checks, level, faults, advice, lerp, FAULTS, CHECKS, AREA_LIST, findWindow, L };
if (typeof module !== 'undefined') module.exports = api; else root.SwingMetrics = api;
})(this);
