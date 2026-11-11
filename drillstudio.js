// Drill Studio: clear, step-by-step 3D demonstrations of golf drills.
// A posable golfer (pose + rig), real equipment, a camera that moves to the best angle for each step, and on-screen
// coaching: labels pinned to the body, arrows showing which way to move, a red "not this" ghost of the fault,
// a traced hand path, and a big tick or cross. Falls back to a flat drawing if WebGL isn't available.
// World: x toward the target (golfer's lead side), y up, z toward the ball (golfer faces +z). Right-handed. Metres.
(function (root) {
'use strict';
const T = root.THREE;
const D2R = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
function rotAxis(v, k, a) { const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), kd = dot(k, v);
  return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)]; }
function ik(A, Tg, a, b, pole) {
  let d = sub(Tg, A), L = len(d); const dir = norm(d);
  if (L > a + b - 1e-4) return add(A, mul(dir, a * L / (a + b)));
  L = Math.max(L, Math.abs(a - b) + 1e-4);
  const along = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - along * along));
  let p = sub(pole, mul(dir, dot(pole, dir))); p = norm(p);
  return add(add(A, mul(dir, along)), mul(p, h));
}

// ---------- poses ----------
// bend: forward hinge (deg); side: spine tilt (+ = away from target); kf: knee flex; turn: shoulders (+ = back);
// hip: pelvis turn (+ = back); ws: weight shift (m, + = toward target); hx/hz: extra pelvis move (hz + = toward the ball);
// theta/hinge: arm swing and wrist set around the swing plane; heel: trail heel up (0-1.6);
// tfx/tfz, lfx/lfz: move a foot; split: trail hand further down the grip; tdrop: trail hand let go and hanging.
const P0 = { bend: 0, side: 0, kf: 4, turn: 0, hip: 0, ws: 0, hx: 0, hz: 0, theta: 0, hinge: 0, plane: 22, splane: 36, clen: 0.89, reach: 0.56, stance: 0.2,
  heel: 0, lheel: 0, headDx: 0, headDy: 0, leadBend: 4, arms: 'club', walk: 0, tfx: 0, tfz: 0, lfx: 0, lfz: 0, split: 0, tdrop: 0, noclub: 0, head: 0 };
const POSES = {
  stand: { bend: 3, kf: 2, arms: 'hang' },
  address: { bend: 32, kf: 18, side: 4 },
  takeaway: { bend: 32, kf: 18, side: 5, turn: 32, hip: 10, theta: 50, hinge: 12, ws: -0.02 },
  half: { bend: 32, kf: 18, side: 6, turn: 62, hip: 24, theta: 92, hinge: 80, ws: -0.03 },
  top: { bend: 31, kf: 18, side: 7, turn: 90, hip: 45, theta: 146, hinge: 100, ws: -0.04, leadBend: 6 },
  down: { bend: 32, kf: 20, side: 10, turn: 48, hip: 5, theta: 100, hinge: 95, ws: 0.05 },
  impact: { bend: 30, kf: 16, side: 12, turn: 8, hip: -38, theta: -4, hinge: -4, ws: 0.08 },
  through: { bend: 26, kf: 12, side: 10, turn: -62, hip: -62, theta: -92, hinge: -80, ws: 0.1, heel: 0.6 },
  finish: { bend: 10, kf: 6, side: -6, turn: -105, hip: -86, theta: -146, hinge: -110, ws: 0.13, heel: 1, reach: 0.5 },
};
function pose(k, o) { return Object.assign({}, P0, POSES[k] || {}, o || {}); }
function mix(a, b, t) { const o = {}; for (const k in a) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k] == null ? a[k] : b[k], t) : (t < 0.5 ? a[k] : b[k]); return o; }

// ---------- rig: pose -> joint positions ----------
function rig(p) {
  const J = {};
  const sw = p.stance, ankY = 0.07;
  J.la = [sw + p.walk + p.lfx, ankY + 0.08 * p.lheel, p.lfz]; J.ta = [-sw + p.walk + p.tfx, ankY + 0.08 * p.heel, 0.04 * p.heel + p.tfz];
  J.lt = add(J.la, [0.04, -0.05 - 0.04 * p.lheel, 0.14]); J.tt = add(J.ta, [0.02 + 0.06 * p.heel, -0.05 - 0.08 * p.heel, 0.13 - 0.05 * p.heel]);
  J.lhl = add(J.la, [-0.01, -0.05, -0.05]); J.thl = add(J.ta, [-0.01, -0.05, -0.05]);
  const hipH = 0.93 - p.kf * 0.0042 - p.bend * 0.0012, hipBack = p.bend * 0.0042 + p.kf * 0.001;
  const pel = [p.ws + p.hx + p.walk, hipH, -hipBack + p.hz];
  const H = rotAxis([1, 0, 0], [0, 1, 0], -p.hip * D2R);
  J.pel = pel; J.lhip = add(pel, mul(H, 0.11)); J.thip = add(pel, mul(H, -0.11)); J.H = H;
  J.lkp = norm(add([0.15, 0, 1], mul(H, 0.2))); J.tkp = norm([-0.15, 0, 1]);
  J.lk = ik(J.la, J.lhip, 0.44, 0.46, J.lkp); J.tk = ik(J.ta, J.thip, 0.44, 0.46, J.tkp); J.arms = p.arms; J.tdrop = p.tdrop;
  let s = rotAxis([0, 1, 0], [1, 0, 0], p.bend * D2R);
  s = rotAxis(s, [0, 0, 1], p.side * D2R);
  const Lt = norm(rotAxis([1, 0, 0], s, -p.turn * D2R)), F = norm(cross(Lt, s));
  J.F = F; J.Lt = Lt; J.s = s;
  const C = add(pel, mul(s, 0.5)); J.chest = C; J.neck = add(pel, mul(s, 0.6));
  const hd = norm(add(mul(s, 0.55), [0, 0.45, 0]));
  J.head = add(add(J.neck, mul(hd, 0.13)), [p.headDx, p.headDy, 0]);
  // the eyes look at the ball until well after impact, then turn with the body
  const look = norm([0.0, -0.75, 1]), bodyF = norm([F[0], F[1] * 0.3, F[2]]);
  J.face = norm(add(mul(look, 1 - p.head), mul(bodyF, p.head)));
  J.ls = add(C, mul(Lt, 0.185)); J.ts = add(C, mul(Lt, -0.185));
  const ua = 0.3, fa = 0.29, a = p.arms;
  if (a === 'club' || a === 'lead' || a === 'trailonly' || a === 'noclub') {
    const ph = (p.plane + p.bend * 0.25) * D2R, v = [0, -Math.cos(ph), Math.sin(ph)], u = [-1, 0, 0];
    const ps = p.splane * D2R, vs = [0, -Math.cos(ps), Math.sin(ps)];
    const th = p.theta * D2R, SC = add(C, [0, -0.04, 0.02]);
    const hands = add(SC, mul(add(mul(v, Math.cos(th)), mul(u, Math.sin(th))), p.reach));
    const an = (p.theta + p.hinge) * D2R, sd = norm(add(mul(vs, Math.cos(an)), mul(u, Math.sin(an))));
    J.lh = hands; J.th = add(hands, mul(sd, 0.08 + p.split)); J.club = [add(hands, mul(sd, -0.06)), add(hands, mul(sd, p.clen))]; J.sd = sd;
    if (p.tdrop > 0) J.th = lerp3(J.th, hangPoint(J.ts, F), p.tdrop);
    J.le = ik(J.ls, J.lh, ua, fa, norm([0.2, -1, -0.3]));
    if (a === 'lead') { J.th = add(add(J.ls, mul(F, 0.07)), mul(s, -0.02)); J.te = ik(J.ts, J.th, ua, fa, norm([0, -1, 0.6])); }
    else if (a === 'trailonly') { J.th = hands; J.lh = add(add(J.ts, mul(F, 0.07)), mul(s, -0.02)); J.le = ik(J.ls, J.lh, ua, fa, norm([0, -1, 0.6])); J.te = ik(J.ts, J.th, ua, fa, norm([-0.2, -1, -0.6])); J.club = [add(hands, mul(sd, -0.06)), add(hands, mul(sd, p.clen))]; }
    else J.te = ik(J.ts, J.th, ua, fa, norm([-0.2, -1, -0.6]));
    if (a === 'noclub') { J.th = add(hands, mul(sd, 0.03)); J.te = ik(J.ts, J.th, ua, fa, norm([-0.2, -1, -0.6])); J.club = null; }
  } else if (a === 'crossed' || a === 'chestclub') {
    J.lh = add(add(J.ts, mul(F, 0.1)), mul(s, -0.05)); J.th = add(add(J.ls, mul(F, 0.12)), mul(s, -0.08));
    J.le = ik(J.ls, J.lh, ua, fa, norm(add(mul(F, 1), mul(s, -1)))); J.te = ik(J.ts, J.th, ua, fa, norm(add(mul(F, 1), mul(s, -1.2))));
    if (a === 'chestclub') { const c0 = add(add(C, mul(F, 0.14)), mul(s, 0.06)); J.stickAcross = [add(c0, mul(Lt, -0.5)), add(c0, mul(Lt, 0.5))]; }
  } else if (a === 'back') {
    // head back over the spine, chin level, as the drill asks: the back of the head touches the club
    J.face = norm(add(F, mul(s, -0.15)));
    const bk = mul(F, -0.13); J.spineClub = [add(add(J.head, bk), mul(s, 0.12)), add(add(pel, bk), mul(s, -0.14))];
    J.th = add(add(J.neck, bk), mul(Lt, -0.02)); J.lh = add(add(pel, mul(F, -0.15)), mul(s, 0.05));
    J.te = ik(J.ts, J.th, ua, fa, norm(add(mul(s, 1), mul(Lt, -1)))); J.le = ik(J.ls, J.lh, ua, fa, norm(add(mul(F, -1), mul(Lt, 1))));
  } else if (a === 'heli') {
    const out = norm(add(Lt, mul(s, -0.05)));
    J.lh = add(J.ls, mul(out, 0.6)); J.th = add(J.ts, mul(out, -0.6)); J.le = add(J.ls, mul(out, 0.3)); J.te = add(J.ts, mul(out, -0.3));
  } else if (a === 'hips') {
    const Fh = norm(cross(H, [0, 1, 0])), c0 = add(pel, mul(Fh, 0.15));
    J.lh = add(c0, mul(H, 0.14)); J.th = add(c0, mul(H, -0.14));
    J.le = ik(J.ls, J.lh, ua, fa, norm([0.3, -0.2, -1])); J.te = ik(J.ts, J.th, ua, fa, norm([-0.3, -0.2, -1]));
  } else { // hang
    J.lh = add(add(J.ls, [0.02, -0.56, 0.08]), mul(F, 0.05)); J.th = add(add(J.ts, [-0.02, -0.56, 0.08]), mul(F, 0.05));
    J.le = ik(J.ls, J.lh, ua, fa, [0, 0, -1]); J.te = ik(J.ts, J.th, ua, fa, [0, 0, -1]);
  }
  // a stick through the belt loops (always available as a prop)
  { const Fh = norm(cross(H, [0, 1, 0])), c0 = add(add(pel, mul(Fh, 0.16)), [0, 0.04, 0]); J.belt = [add(c0, mul(H, -0.55)), add(c0, mul(H, 0.55))]; J.Fh = Fh; }
  J.clubhead = J.club ? J.club[1] : J.lh;
  J.hands = J.club ? mul(add(J.lh, J.th), 0.5) : J.lh;
  J.seat = add(pel, add(mul(J.Fh, -0.13), [0, -0.05, 0]));          // the back of the hips (where a chair touches)
  J.bum = J.seat;
  return J;
}

// ---------- keyframes and timing ----------
function prep(dr) {
  if (dr._prep) return dr;
  // a "not this" moment: the golfer holds the right position while a red ghost shows the fault
  dr.seq.forEach((k, i) => {
    const bad = k.badge && k.badge.tone === 'bad' && !k.self;
    if (bad && !k.ghost) { k.ghost = { k: k.k, o: k.o }; const pv = dr.seq[i - 1]; k.P = pv ? pv.P : pose(k.k); k._held = !!pv; }
    else k.P = pose(k.k, k.o);
    if (k.ghost) k.G = pose(k.ghost.k || k.k, k.ghost.o);
  });
  let t = 0; dr._tl = dr.seq.map((k, i) => { const s = t; t += k.d || 0.6; const e = t; t += k.hold || 0; return { i, s, e, h: t }; }); dr._dur = t + 0.4;
  const a = rig(pose('address'));
  dr._ball = [a.club[1][0] + 0.02, 0.022, a.club[1][2] + 0.03];
  dr._prep = true; return dr;
}
function sampleAt(dr, t) {
  const tl = dr._tl; t = clamp(t, 0, dr._dur - 1e-3); let i = 0; while (i < tl.length - 1 && t >= tl[i].h) i++;
  const k = tl[i], key = dr.seq[i], prev = dr.seq[(i - 1 + dr.seq.length) % dr.seq.length];
  const raw = i === 0 && t < k.s ? 1 : clamp((t - k.s) / ((k.e - k.s) || 1), 0, 1), u = key.lin ? raw : ease(raw);
  return { p: mix(prev.P, key.P, u), key, prev, i, u, raw, inHold: t >= k.e, t };
}
// ---------- real swing motion (swing-model.json) ----------
// Drills that show a normal swing play motion-captured frames. Every key at a standard swing position is the captured
// pose plus that key's override, measured on the rig: captured(phase) + (rig(key) - rig(standard pose)). So a fault
// ("hips 10 degrees open"), a ghost, or a hanging trail hand sits on the real swing, and the ball, feet and props stay
// put. Moving forward between positions plays the captured frames (the override fading between the two keys);
// anything else (backwards, skipping the top) blends. Drills with no normal swing positions (special poses only)
// stay exactly on the rig, as before.
const MOTION_PH = ['address', 'takeaway', 'half', 'top', 'down', 'impact', 'through', 'finish'];
const MOTION_VEC = { s: 1, H: 1, Lt: 1, F: 1, face: 1, Fh: 1, sd: 1, lkp: 1, tkp: 1 };
let SWING = null;
function setSwing(m) {
  let ok = !!(m && m.v === 1 && Array.isArray(m.frames) && m.frames.length > 10 && m.phases && Array.isArray(m.ball));
  if (ok) for (const k of MOTION_PH) { const f = m.phases[k]; if (!(f >= 0 && f < m.frames.length)) ok = false; }
  if (ok) for (const f of [m.frames[0], m.frames[m.frames.length - 1]]) for (const n of ['pel', 'neck', 'ls', 'lh', 'th', 'la', 'ta', 'club', 'sd', 'seat']) if (!f || !f[n]) ok = false;
  SWING = ok ? m : null; BASE.clear();
  if (SWING) { const c = [0]; for (let i = 1; i < m.frames.length; i++) c.push(c[i - 1] + len(sub(m.frames[i].lh, m.frames[i - 1].lh))); SWING._arc = c; } POSTERS.clear(); if (typeof SCN !== 'undefined') dropScenes(0);
  return ok;
}
function hasSwing() { return !!SWING; }
// ms: give up after this long and ignore the file if it turns up later (so an open drill never changes under the viewer)
function loadSwing(base, ms) {
  if (typeof fetch === 'undefined') return Promise.resolve(false);
  let late = false;
  const got = fetch((base || '') + 'swing-model.json').then(r => r.ok ? r.json() : null).then(m => late ? false : setSwing(m)).catch(() => false);
  return ms ? Promise.race([got, new Promise(ok => setTimeout(() => { late = true; ok(false); }, ms))]) : got;
}
const plainKey = k => MOTION_PH.includes(k.k) && (!k.o || Object.keys(k.o).every(x => x === 'head'));
function usesCapture(dr) { return !!SWING && !dr.noclub && dr.seq.some(plainKey); }
function ballOf(dr) { prep(dr); return usesCapture(dr) ? SWING.ball.slice() : dr._ball; }
const lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const isV = a => Array.isArray(a) && a.length === 3 && typeof a[0] === 'number';
const isPair = a => Array.isArray(a) && a.length === 2 && isV(a[0]) && isV(a[1]);
function lerpJ(A, B, u) {
  const J = {};
  for (const k in A) {
    const a = A[k], b = B[k];
    if (b === undefined || b === null) { if (u < 0.5) J[k] = a; continue; }
    if (isV(a) && isV(b)) J[k] = MOTION_VEC[k] ? norm(lerp3(a, b, u)) : lerp3(a, b, u);
    else if (isPair(a) && isPair(b)) J[k] = [lerp3(a[0], b[0], u), lerp3(a[1], b[1], u)];
    else if (typeof a === 'number' && typeof b === 'number') J[k] = a + (b - a) * u;
    else J[k] = u < 0.5 ? a : b;
  }
  for (const k in B) if (!(k in A) && u >= 0.5) J[k] = B[k];
  return J;
}
function motionFrame(f) {
  const F = SWING.frames, i0 = Math.max(0, Math.min(F.length - 1, Math.floor(f))), i1 = Math.min(F.length - 1, i0 + 1), u = f - i0;
  const J = u > 1e-6 ? lerpJ(F[i0], F[i1], u) : Object.assign({}, F[i0]);
  J.arms = 'club'; J.tdrop = 0; return J;
}
const BASE = new Map();
function baseRig(k) { if (!BASE.has(k)) BASE.set(k, rig(pose(k))); return BASE.get(k); }
// where rig-only poses (e.g. walking in) sit relative to the captured golfer: line their pelvis up at address
function rigShift() { const c = SWING.frames[SWING.phases.address].pel, r = baseRig('address').pel; return [c[0] - r[0], 0, c[2] - r[2]]; }
function shiftJ(J, d) {
  const o = {}; for (const k in J) { const v = J[k]; o[k] = MOTION_VEC[k] ? v : isV(v) ? add(v, d) : isPair(v) ? [add(v[0], d), add(v[1], d)] : v; } return o;
}
// what a key stands for: a captured frame plus the key's own override, or a plain rig pose
function keyInfo(dr, i) {
  const k = dr.seq[i];
  if (k._held) return keyInfo(dr, i - 1);
  if (MOTION_PH.includes(k.k)) return { f: SWING.phases[k.k], P: k.P, base: k.k };
  return { f: null, P: k.P };
}
// a let-go trail hand hangs straight down from the shoulder, wherever that shoulder is
function hangPoint(ts, F) { return add(add(ts, [0, -0.575, 0]), mul(F, 0.03)); }
function deltaOf(info) {
  const R = rig(info.P), B = baseRig(info.base), d = {};
  // the hanging hand is placed from the captured shoulder in compose(), so the trail hand's delta leaves the drop out
  const Rn = R.tdrop > 0 ? rig(Object.assign({}, info.P, { tdrop: 0 })) : R;
  for (const k in R) { const r = R[k], b = B[k]; if (isV(r) && isV(b)) d[k] = sub(r, b); else if (isPair(r) && isPair(b)) d[k] = [sub(r[0], b[0]), sub(r[1], b[1])]; }
  if (Rn !== R) d.th = sub(Rn.th, B.th);
  const grip = R.club && R.arms === 'club' && !(R.tdrop > 0) ? 1 : 0;
  return { d, R, B, grip, drop: R.tdrop || 0, gl: grip ? len(sub(R.th, R.lh)) : null };
}
function lerpDelta(A, B, u) { const d = {}; for (const k in A.d) { const a = A.d[k], b = B.d[k]; if (!b) continue; d[k] = isPair(a) ? [lerp3(a[0], b[0], u), lerp3(a[1], b[1], u)] : lerp3(a, b, u); } return { d, R: u < 0.5 ? A.R : B.R, B: u < 0.5 ? A.B : B.B, grip: A.grip + (B.grip - A.grip) * u, drop: (A.drop || 0) + ((B.drop || 0) - (A.drop || 0)) * u, gl: A.gl != null && B.gl != null ? A.gl + (B.gl - A.gl) * u : (A.gl != null ? A.gl : B.gl) }; }
// captured frame + override, then made whole again: unit vectors, a full-length club in the hands, elbows and knees re-solved
function compose(f, D) {
  const C = motionFrame(f), J = {};
  for (const k in C) { const c = C[k], d = D.d[k]; if (d && isV(c)) J[k] = MOTION_VEC[k] ? norm(add(c, d)) : add(c, d); else if (d && isPair(c)) J[k] = [add(c[0], d[0]), add(c[1], d[1])]; else J[k] = c; }
  const R = D.R, shift = sub(C.pel, D.B.pel);
  J.arms = R.arms; J.tdrop = R.tdrop;
  for (const k of ['spineClub', 'stickAcross']) if (R[k]) J[k] = [add(R[k][0], shift), add(R[k][1], shift)];
  // the trail hand sits on the shaft as much as this pose holds the club with both hands (blends between poses)
  const g = D.grip == null ? 0 : D.grip;
  if (g > 0) J.th = lerp3(J.th, add(J.lh, mul(J.sd, D.gl || 0.08)), g);
  if (D.drop > 0) J.th = lerp3(J.th, hangPoint(J.ts, J.F), D.drop);
  if (R.club && R.arms === 'club') { const L = len(sub(R.club[1], R.club[0])); J.club = [sub(J.lh, mul(J.sd, 0.06)), add(J.lh, mul(J.sd, L - 0.06))]; }
  else if (!R.club) J.club = null;
  return finish(J);
}
function finish(J) {
  if (J.club) { J.clubhead = J.club[1]; J.hands = J.arms === 'club' ? mul(add(J.lh, J.th), 0.5) : J.lh; }
  else { J.clubhead = J.lh; J.hands = J.lh; }
  const mid = (a, b) => mul(add(a, b), 0.5);
  J.le = ik(J.ls, J.lh, 0.3, 0.29, norm(sub(J.le, mid(J.ls, J.lh))));
  J.te = ik(J.ts, J.th, 0.3, 0.29, norm(sub(J.te, mid(J.ts, J.th))));
  J.lk = ik(J.la, J.lhip, 0.44, 0.46, norm(sub(J.lk, mid(J.la, J.lhip))));
  J.tk = ik(J.ta, J.thip, 0.44, 0.46, norm(sub(J.tk, mid(J.ta, J.thip))));
  return J;
}
function poseOf(dr, info) { return info.f == null ? shiftJ(rig(info.P), rigShift()) : compose(info.f, deltaOf(info)); }

// ---------- posture: knees no more bent than a real golfer's ----------
// The rig and the captured swing both put the hips too low for the legs (0.46 m thigh, 0.44 m shin), so the knees
// bent 45-65 degrees at address where good players flex about 15-30. This raises the pelvis and pushes it back so
// each knee bends 40% as much, keeping the shoulders, head, arms, hands and club exactly where they were (the club
// still meets the ball), then re-solves the knees. Spine tilt grows as the hips go back, as it does in a real setup.
const KNEE_KEEP = 0.4;
function kneeFlex(hip, knee, ank) { const a = sub(hip, knee), b = sub(ank, knee); return 180 - Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b))))) * 180 / Math.PI; }
function legReach(a, b, flex) { return Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(flex * D2R)); }
function standTall(J) {
  if (!J || !J.pel || !J.lk || !J.tk || !J.la || !J.ta || !J.neck || J._tall) return J;
  const legs = [['lhip', 'lk', 'la'], ['thip', 'tk', 'ta']].map(([h, k, a]) => {
    const th = len(sub(J[h], J[k])), sh = len(sub(J[k], J[a])), f = kneeFlex(J[h], J[k], J[a]);
    return { h, k, a, th, sh, f, want: legReach(th, sh, Math.max(3, f * KNEE_KEEP)), pole: norm(sub(J[k], add(J[a], mul(sub(J[h], J[a]), 0.5)))) }; });
  const L = len(sub(J.neck, J.pel)), back = [0, 0, -1];
  // find how far up (dy) the pelvis must go; it also slides back (dz) so the pelvis-to-neck length stays the same
  const place = dy => { const up = [J.pel[0], J.pel[1] + dy, J.pel[2]]; const dx = J.neck[0] - up[0], dyn = J.neck[1] - up[1];
    const dzAbs = Math.sqrt(Math.max(0, L * L - dx * dx - dyn * dyn)), z = J.neck[2] - Math.sign(J.neck[2] - J.pel[2] || 1) * dzAbs; return [up[0], up[1], z]; };
  // whichever leg reaches its target first sets the height, so neither leg is ever over-stretched or locked
  const miss = dy => { const P = place(dy), d = sub(P, J.pel); let e = -1; for (const g of legs) e = Math.max(e, len(sub(add(J[g.h], d), J[g.a])) - g.want); return e; };
  let lo = 0, hi = 0.25; if (miss(0) >= 0) return J;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (miss(m) < 0) lo = m; else hi = m; }
  const P = place(lo), d = sub(P, J.pel), O = Object.assign({}, J);
  O.pel = P; for (const k of ['lhip', 'thip', 'seat', 'bum', 'sdBelt']) if (isV(J[k])) O[k] = add(J[k], d);
  for (const g of legs) O[g.k] = ik(O[g.a], O[g.h], g.sh, g.th, g.pole);
  const s = norm(sub(J.neck, P)), cr = len(sub(J.chest, J.pel)) / (L || 1); O.s = s; O.chest = add(P, mul(sub(J.neck, P), cr));
  O._tall = 1; return O; }
function keyJoints(dr, i) { return standTall(keyJoints0(dr, i)); }
function keyJoints0(dr, i) { return usesCapture(dr) ? poseOf(dr, keyInfo(dr, i)) : rig(dr.seq[i].P); }
function startJ(dr) { prep(dr); return keyJoints(dr, 0); }
function jointsAt(dr, t) { return clubClear(spineClubOn(keepReach(standTall(jointsAt0(dr, t))))); }
// blending between two very different arm poses (a finish with the club up, back to arms hanging for the reset) moved
// the hands in a straight line, which took the trail hand through its own shoulder; keep each hand at least 20 cm out
function keepReach(J) {
  if (!J || !J.ls) return J;
  for (const s of ['l', 't']) { const sh = J[s + 's'], h = J[s + 'h']; if (!sh || !h) continue; const v = sub(h, sh), r = len(v);
    if (r > 1e-6 && r < 0.2) { const k = 0.2 / r, nh = add(sh, mul(v, k)), d = sub(nh, h); J[s + 'h'] = nh; if (J[s + 'w']) J[s + 'w'] = add(J[s + 'w'], d); } }
  return J;
}
// the club never passes through the golfer's head or into the ground. Coming into a finish (and blending from a finish
// back to address) the shaft could cut through the back of his head; it now turns about the lead hand just far enough
// to go round it. At the bottom of the swing the head could sink up to 10 cm into the mat; the club now slides a
// little up through the hands instead (a few cm, not visible).
const HEAD_R = 0.17, SOLE_Y = 0.014;
function clubClear(J) {
  if (!J || !J.club || !J.lh || !J.head) return J;
  const a = J.lh; let u = norm(sub(J.club[1], J.club[0]));
  // the head as a capsule from the rig's head point up through the crown (the mesh's skull sits up to ~10 cm above and
  // ahead of that point as the head turns), sampled at a few points
  const up = J.neck ? norm(sub(J.head, J.neck)) : [0, 1, 0], cs = [0, 0.05, 0.1, 0.15].map(k => add(J.head, mul(up, k)));
  const along = Math.max(...cs.map(c => dot(sub(c, a), u)));
  const dist = v => Math.min(...cs.map(c => { const ca = sub(c, a), t = Math.max(0, dot(ca, v)); return len(sub(ca, mul(v, t))); }));
  const ca = sub(cs[2], a);
  let R = null;
  if (along > 0 && dist(u) < HEAD_R) {
    let ax = cross(u, ca); if (len(ax) < 1e-6) ax = cross(u, [0, 1, 0]); ax = norm(ax);
    let ang = 0; while (ang < 70 && dist(rotAxis(u, ax, -(ang + 2) * D2R)) < HEAD_R) ang += 2;
    ang += 2; R = v => rotAxis(v, ax, -ang * D2R);
  }
  const L0 = len(sub(J.club[1], a)), Lb = len(sub(J.club[0], a));
  if (R) { u = norm(R(u)); for (const k of ['th', 'tw', 'lw']) if (J[k]) J[k] = add(a, R(sub(J[k], a))); if (J.sd) J.sd = u; }
  J.club = [sub(a, mul(u, Lb)), add(a, mul(u, L0))];
  // into the ground: slide the club up through the hands
  if (J.club[1][1] < SOLE_Y && u[1] < -0.2) { const sl = Math.min(0.12, (SOLE_Y - J.club[1][1]) / -u[1]); J.club = [sub(J.club[0], mul(u, sl)), sub(J.club[1], mul(u, sl))]; }
  J.clubhead = J.club[1]; if (J.th) J.hands = mul(add(J.lh, J.th), 0.5);
  return J;
}
// the club down the spine lies ON the golfer's back (it used to run through him)
function spineClubOn(J) {
  if (!J || !J.spineClub || !J.pel || !J.s || !J.F) return J;
  const F = norm(J.F), s0 = norm(J.s), s = norm(sub(s0, mul(F, dot(s0, F))));   // along the back, square to facing
  // laid against the two points that stick out most, the seat and the back of the head (measured on the figure: the seat
  // 13 cm behind the spine line at belt height, the back of the head up to 1 cm in front of it at 78 cm up), 1.5 cm clear
  const back = h => 0.148 + (0.002 - 0.148) * (h - 0.02) / 0.76, at = h => add(J.pel, add(mul(s, h), mul(F, -back(h))));
  J.spineClub = [at(0.95), at(-0.16)];
  // and the hands on it: the trail hand behind the neck, the lead hand in the small of the back
  const on = (h, out) => add(at(h), mul(F, -out)), Lt = norm(J.Lt || [1, 0, 0]);
  // (eased in by how close the hands already are, so blending into or out of this pose stays smooth)
  const pull = (h, to) => { const w = clamp(1 - (len(sub(to, h)) - 0.06) / 0.25, 0, 1); return add(h, mul(sub(to, h), w)); };
  J.th = pull(J.th, add(on(0.66, 0.035), mul(Lt, -0.03))); J.lh = pull(J.lh, add(on(0.02, 0.035), mul(Lt, 0.03)));
  J.te = ik(J.ts, J.th, 0.3, 0.29, norm(add(mul(s, 1), mul(Lt, -1)))); J.le = ik(J.ls, J.lh, 0.3, 0.29, norm(add(mul(s, -1), mul(Lt, 1))));
  return J;
}
function jointsAt0(dr, t) {
  prep(dr); const s = sampleAt(dr, t);
  if (!usesCapture(dr)) return rig(s.p);
  const n = dr.seq.length, i = s.i, pi = (i - 1 + n) % n, B = keyInfo(dr, i), A = keyInfo(dr, pi);
  if (s.u >= 1 || s.inHold || (i === 0 && s.raw >= 1)) return poseOf(dr, B);
  if (A.f == null && B.f == null) return shiftJ(rig(s.p), rigShift());
  // play the capture forward between the two positions; a move from the backswing straight to a point part-way
  // through the downswing (e.g. address -> impact) isn't a real swing, so that blends instead
  const top = SWING.phases.top, fin = SWING.phases.finish;
  if (A.f != null && B.f != null && B.f > A.f && !(A.f < top && B.f > top && B.f < fin))
    return compose(runFrame(dr, i, s.t, A.f + (B.f - A.f) * s.raw), lerpDelta(deltaOf(A), deltaOf(B), s.u));
  // going back (e.g. finish -> address) rewinds the capture, eased, so the club comes back round rather than through him
  if (A.f != null && B.f != null && B.f < A.f) {
    // at an even hand speed (by distance along the hand path), not frame by frame, so the fast part doesn't whip past
    const c = SWING._arc, want = c[A.f] + (c[B.f] - c[A.f]) * s.raw; let f = B.f;
    while (f < A.f && c[f + 1] < want) f++;
    const ff = f + (want - c[f]) / Math.max(c[Math.min(f + 1, A.f)] - c[f], 1e-9);
    return compose(Math.min(A.f, Math.max(B.f, ff)), lerpDelta(deltaOf(A), deltaOf(B), s.u));
  }
  const J = lerpJ(poseOf(dr, A), poseOf(dr, B), s.u);
  if (J.club && J.arms === 'club' && J.sd) { const a = poseOf(dr, A).club, L = a ? len(sub(a[1], a[0])) : 0.95; J.club = [sub(J.lh, mul(J.sd, 0.06)), add(J.lh, mul(J.sd, L - 0.06))]; }
  return finish(J);
}
// Keys that follow each other with no pause (e.g. takeaway -> half -> top) are one continuous movement. Playing each
// key's stretch of the capture at its own even speed made the speed jump at every key, like a robot hitting marks.
function runFrame(dr, i, t, fallback) {
  const tl = dr._tl, seq = dr.seq, n = seq.length, top = SWING.phases.top, fin = SWING.phases.finish;
  const fwd = j => {   // is the move into key j a forward step through the capture?
    if (j <= 0 || j >= n || seq[j]._held || seq[j - 1]._held) return false;
    const A = keyInfo(dr, j - 1), B = keyInfo(dr, j);
    return A.f != null && B.f != null && B.f > A.f && !(A.f < top && B.f > top && B.f < fin);
  };
  const flows = j => tl[j].h - tl[j].e < 1e-6;   // no pause after arriving at key j
  if (!fwd(i)) return fallback;
  // the run starts at key a (it may pause there first) and moves through to key b without stopping
  let a = i - 1, b = i; while (a > 0 && fwd(a) && flows(a)) a--; while (b + 1 < n && flows(b) && fwd(b + 1)) b++;
  if (b === a + 1) return fallback;
  // each key still lands at its own time (so counts and labels line up), but the speed flows smoothly through the
  // keys (a monotone cubic through the key times) instead of jumping at each one; it starts from rest after a pause
  // and comes to rest where he stops
  const T = [tl[a + 1].s], Fr = [keyInfo(dr, a).f];
  for (let j = a + 1; j <= b; j++) { T.push(tl[j].e); Fr.push(keyInfo(dr, j).f); }
  return monoCubic(T, Fr, t, (a === 0 || !flows(a)), !flows(b));
}
function monoCubic(T, F, t, rest0, rest1) {   // Fritsch-Carlson monotone interpolation of F over T
  const n = T.length, d = [], m = [];
  for (let k = 0; k < n - 1; k++) d.push((F[k + 1] - F[k]) / Math.max(1e-6, T[k + 1] - T[k]));
  for (let k = 0; k < n; k++) {
    if (k === 0) m.push(rest0 ? 0 : d[0]); else if (k === n - 1) m.push(rest1 ? 0 : d[n - 2]);
    else m.push(d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2);
  }
  for (let k = 0; k < n - 1; k++) { if (d[k] === 0) { m[k] = m[k + 1] = 0; continue; }
    const a = m[k] / d[k], b = m[k + 1] / d[k], h = a * a + b * b; if (h > 9) { const q = 3 / Math.sqrt(h); m[k] = q * a * d[k]; m[k + 1] = q * b * d[k]; } }
  if (t <= T[0]) return F[0]; if (t >= T[n - 1]) return F[n - 1];
  let k = 0; while (k < n - 2 && t > T[k + 1]) k++;
  const hh = T[k + 1] - T[k], u = (t - T[k]) / hh, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * F[k] + (u3 - 2 * u2 + u) * hh * m[k] + (-2 * u3 + 3 * u2) * F[k + 1] + (u3 - u2) * hh * m[k + 1];
}
// the red "not this" pose for key i: the golfer's own pose with the fault added
function ghostAt(dr, i) { const J = ghostAt0(dr, i); return J && standTall(J); }
function ghostAt0(dr, i) {
  prep(dr); const key = dr.seq[i]; if (!key || !key.G) return null;
  if (!usesCapture(dr)) return rig(key.G);
  const gk = (key.ghost && key.ghost.k) || key.k;
  return MOTION_PH.includes(gk) ? compose(SWING.phases[gk], deltaOf({ f: SWING.phases[gk], P: key.G, base: gk })) : shiftJ(rig(key.G), rigShift());
}

function stepStart(dr, step) { prep(dr); const i = dr.seq.findIndex(k => k.step === step); return i < 0 ? 0 : (i === 0 ? 0 : dr._tl[i].s); }

// ---------- views ----------
const VIEWS = {
  face: { yaw: 0, pitch: 6, dist: 5.4, ty: 0.92, tz: 0.12 },
  dtl: { yaw: -90, pitch: 6, dist: 5.4, ty: 0.92, tz: 0.3, tx: 0.2 },
  tq: { yaw: -38, pitch: 9, dist: 5.5, ty: 0.92, tz: 0.2 },
  back: { yaw: -128, pitch: 10, dist: 4.8, ty: 0.86, tz: 0.0 },
  tqf: { yaw: 35, pitch: 9, dist: 5.5, ty: 0.92, tz: 0.2 },
  behind: { yaw: -150, pitch: 14, dist: 5.0, ty: 0.8, tz: 0.2 },
  top: { yaw: -18, pitch: 56, dist: 5.6, ty: 0.7, tz: 0.35 },
};
const VIEW_NAME = { face: 'Face-on', dtl: 'Down the line', tq: 'From the side', tqf: 'From the front', behind: 'From behind', top: 'From above', back: 'From behind' };
function camState(v, extra) { const b = Object.assign({ tx: 0 }, VIEWS[v] || VIEWS.face, extra || {}); return b; }
function camMix(a, b, u) { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k] == null ? a[k] : b[k], u); let dy = b.yaw - a.yaw; if (dy > 180) dy -= 360; if (dy < -180) dy += 360; o.yaw = a.yaw + dy * u; return o; }
function camPos(c) { const y = c.yaw * D2R, p = c.pitch * D2R; const dir = [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)]; const tg = [c.tx, c.ty, c.tz]; return { pos: add(tg, mul(dir, c.dist)), tg }; }

// ---------- colours ----------
const C = { shirt: 0x1f6aa5, shirtD: 0x245a82, pants: 0x30343c, skin: 0xd99a72, shoe: 0xf6f6f2, sole: 0x2b2b2b, cap: 0x1f4f3a, glove: 0xffffff,
  good: '#17b45f', bad: '#e5483b', info: '#1d5a8a', ink: '#10201a' };

// ---------- WebGL ----------
let R = null, glOK = null;
function webgl() {
  if (glOK !== null) return glOK;
  try {
    if (!T) throw new Error('no three');
    R = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    glOK = !!R.getContext();
  } catch (e) { glOK = false; R = null; }
  return glOK;
}
const Y = T ? new T.Vector3(0, 1, 0) : null;
const v3 = a => new T.Vector3(a[0], a[1], a[2]);
function lathe(profile, seg) { const g = new T.LatheGeometry(profile.map(([t, r]) => new T.Vector2(r, t)), seg || 24); g.computeVertexNormals(); return g; }
const PROF = {
  thigh: [[0, 0.004], [0.02, 0.078], [0.12, 0.092], [0.5, 0.082], [0.85, 0.064], [0.98, 0.058], [1, 0.004]],
  shin: [[0, 0.004], [0.03, 0.06], [0.2, 0.066], [0.5, 0.058], [0.85, 0.05], [0.98, 0.046], [1, 0.004]],
  upper: [[0, 0.004], [0.04, 0.056], [0.35, 0.056], [0.6, 0.05], [0.9, 0.042], [1, 0.004]],
  sleeve: [[0, 0.004], [0.03, 0.066], [0.5, 0.064], [0.98, 0.058], [1, 0.004]],
  fore: [[0, 0.004], [0.04, 0.042], [0.3, 0.044], [0.7, 0.033], [0.96, 0.028], [1, 0.004]],
  neck: [[0, 0.052], [1, 0.046]],
  chest: [[0, 0.13], [0.2, 0.135], [0.55, 0.158], [0.8, 0.165], [0.92, 0.14], [1, 0.06]],
  pelvis: [[0, 0.02], [0.1, 0.125], [0.45, 0.142], [0.8, 0.132], [1, 0.125]],
};
function ell(rx, ry, rz, seg) { const g = new T.SphereGeometry(1, seg || 24, Math.round((seg || 24) * 0.7)); g.scale(rx, ry, rz); return g; }
function std(col, o) { const m = new T.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.62, metalness: 0.02 }, o || {})); m.color.convertSRGBToLinear(); return m; }
function figure(ghost) {
  const G = new T.Group(), P = {};
  const tone = ghost ? null : 1;
  const M = ghost ? { all: new T.MeshStandardMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.32, roughness: 0.5, depthWrite: false }) } : {
    shirt: std(C.shirt, { roughness: 0.75 }), pants: std(C.pants, { roughness: 0.8 }), skin: std(C.skin, { roughness: 0.55 }), shoe: std(C.shoe, { roughness: 0.45 }),
    sole: std(C.sole), cap: std(C.cap, { roughness: 0.7 }), glove: std(C.glove, { roughness: 0.5 }), eye: std(0x1a1a1a) };
  const m = k => ghost ? M.all : M[k];
  const mk = (name, geo, mat) => { const x = new T.Mesh(geo, mat); x.castShadow = !ghost; x.receiveShadow = !ghost; G.add(x); P[name] = x; x.userData.base = mat; return x; };
  mk('lthigh', lathe(PROF.thigh), m('pants')); mk('tthigh', lathe(PROF.thigh), m('pants'));
  mk('lshin', lathe(PROF.shin), m('pants')); mk('tshin', lathe(PROF.shin), m('pants'));
  mk('lupper', lathe(PROF.sleeve), m('shirt')); mk('tupper', lathe(PROF.sleeve), m('shirt'));
  mk('lfore', lathe(PROF.fore), m('skin')); mk('tfore', lathe(PROF.fore), m('skin'));
  mk('neck', lathe(PROF.neck, 16), m('skin'));
  const ch = lathe(PROF.chest, 32); ch.scale(1.28, 1, 0.78); mk('chest', ch, m('shirt'));
  const pv = lathe(PROF.pelvis, 28); pv.scale(1.22, 1, 0.85); mk('pelvis', pv, m('pants'));
  mk('head', ell(0.095, 0.115, 0.102), m('skin'));
  const capG = new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); capG.scale(0.102, 0.075, 0.108); mk('cap', capG, m('cap'));
  const brim = new T.CylinderGeometry(0.075, 0.075, 0.008, 20, 1, false, -Math.PI / 2, Math.PI); brim.scale(1, 1, 1.25); mk('brim', brim, m('cap'));
  for (const s of ['l', 't']) {
    mk(s + 'delt', ell(0.066, 0.068, 0.066), m('shirt')); mk(s + 'knee', ell(0.062, 0.062, 0.062), m('pants')); mk(s + 'elbow', ell(0.04, 0.04, 0.04), m('skin'));
    mk(s + 'hand', ell(0.038, 0.052, 0.032), s === 'l' ? m('glove') : m('skin'));
    mk(s + 'foot', ell(0.048, 0.04, 0.13), m('shoe')); mk(s + 'sole', ell(0.05, 0.012, 0.135), m('sole'));
    mk(s + 'glute', ell(0.07, 0.078, 0.058), m('pants')); mk(s + 'hipj', ell(0.085, 0.085, 0.085), m('pants'));
  }
  return { G, P, ghost: !!ghost };
}
function bone(m, a, b, sc) { const A = v3(a), d = v3(b).sub(A), L = d.length(); m.position.copy(A); m.quaternion.setFromUnitVectors(Y, d.normalize()); m.scale.set(sc || 1, L, sc || 1); }
function basis(m, x, y, z, pos) { m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(v3(x), v3(y), v3(z))); m.position.copy(v3(pos)); }
function poseFigure(FG, J) {
  const P = FG.P;
  bone(P.lthigh, J.lhip, J.lk); bone(P.tthigh, J.thip, J.tk); bone(P.lshin, J.lk, J.la); bone(P.tshin, J.tk, J.ta);
  bone(P.lupper, J.ls, J.le); bone(P.tupper, J.ts, J.te); bone(P.lfore, J.le, J.lh); bone(P.tfore, J.te, J.th);
  const s = J.s, H = J.H, Fh = norm(cross(H, s)), Yh = norm(cross(Fh, H));
  basis(P.pelvis, H, Yh, Fh, add(J.pel, mul(s, -0.1))); P.pelvis.scale.set(1, 0.28, 1);
  const Lt = J.Lt, F = J.F, Yc = norm(cross(F, Lt));
  basis(P.chest, Lt, Yc, F, add(J.pel, mul(s, 0.1))); P.chest.scale.set(1, 0.52, 1);
  bone(P.neck, add(J.pel, mul(s, 0.58)), J.head); P.neck.scale.set(1, P.neck.scale.y * 0.8, 1);
  // head: z axis = where the face looks
  const fz = J.face, fx = norm(cross([0, 1, 0], fz)), fy = norm(cross(fz, fx));
  basis(P.head, fx, fy, fz, J.head);
  basis(P.cap, fx, fy, fz, add(J.head, mul(fy, 0.028)));
  basis(P.brim, fx, fy, fz, add(add(J.head, mul(fy, 0.03)), mul(fz, 0.085)));
  for (const [sd, sh, el, hd, kn, an, toe, hip, hl] of [['l', J.ls, J.le, J.lh, J.lk, J.la, J.lt, J.lhip, J.lhl], ['t', J.ts, J.te, J.th, J.tk, J.ta, J.tt, J.thip, J.thl]]) {
    P[sd + 'delt'].position.copy(v3(sh)); P[sd + 'elbow'].position.copy(v3(el)); P[sd + 'knee'].position.copy(v3(kn)); P[sd + 'hipj'].position.copy(v3(hip));
    P[sd + 'hand'].position.copy(v3(hd)); P[sd + 'hand'].quaternion.setFromUnitVectors(Y, v3(norm(sub(hd, el))));
    const fc = add(mul(an, .4), mul(toe, .6)), fdir = norm(sub(toe, hl)), fside = norm(cross([0, 1, 0], fdir)), fup = norm(cross(fdir, fside));
    basis(P[sd + 'foot'], fside, fup, fdir, add(fc, [0, -0.005, 0])); basis(P[sd + 'sole'], fside, fup, fdir, add(fc, mul(fup, -0.035)));
    const side = sd === 'l' ? 1 : -1;
    P[sd + 'glute'].position.copy(v3(add(add(J.pel, mul(H, 0.075 * side)), add(mul(Fh, -0.08), mul(s, -0.04))))); P[sd + 'glute'].quaternion.copy(P.pelvis.quaternion);
  }
}
const HLR = { hips: ['hips'], head: ['head', 'neck'], chest: ['chest'], shoulders: ['chest'], leadarm: ['leadarm', 'leadhand'], trailarm: ['trailarm', 'trailhand'], arms: ['leadarm', 'trailarm'],
  trailleg: ['trailleg'], leadleg: ['leadleg'], legs: ['leadleg', 'trailleg'], trailknee: ['trailleg'], leadknee: ['leadleg'], feet: ['leadfoot', 'trailfoot'], trailfoot: ['trailfoot'], leadfoot: ['leadfoot'], bum: ['hips'] };
function poseAny(FG, J) { if (FG.real) FG.pose(J); else poseFigure(FG, J); }
function ghostOpacity(FG, o) { if (FG.real) { FG.mats[0].opacity = Math.min(0.55, o * 1.6); FG.G.renderOrder = 2; } else FG.P.chest.material.opacity = o; }
function setTone(FG, hl, t) {
  if (FG.real) { const ps = []; for (const h of hl || []) for (const n of (HLR[h] || [h])) ps.push(n); return FG.highlight(ps, t); }
  // highlighted body parts glow green; everything else back to normal
  const parts = new Set(); for (const h of hl || []) for (const n of (HL[h] || [h])) parts.add(n);
  for (const n in FG.P) { const m = FG.P[n]; if (FG.ghost) continue;
    if (parts.has(n)) { if (!m.userData.hl) { m.userData.hl = m.material.clone(); } m.material = m.userData.hl; m.material.emissive.setHex(0x19c46a); m.material.emissiveIntensity = 0.35 + 0.25 * Math.sin(t * 6); }
    else if (m.material !== m.userData.base) m.material = m.userData.base; }
}
const HL = { hips: ['pelvis', 'lglute', 'tglute', 'lhipj', 'thipj'], head: ['head', 'cap', 'brim'], chest: ['chest'], shoulders: ['chest', 'ldelt', 'tdelt'],
  leadarm: ['lupper', 'lfore', 'lelbow', 'lhand'], trailarm: ['tupper', 'tfore', 'telbow', 'thand'], arms: ['lupper', 'lfore', 'tupper', 'tfore', 'lelbow', 'telbow'],
  trailleg: ['tthigh', 'tshin', 'tknee'], leadleg: ['lthigh', 'lshin', 'lknee'], legs: ['lthigh', 'lshin', 'lknee', 'tthigh', 'tshin', 'tknee'],
  trailknee: ['tknee', 'tthigh'], leadknee: ['lknee', 'lthigh'], feet: ['lfoot', 'tfoot'], trailfoot: ['tfoot', 'tsole'], leadfoot: ['lfoot', 'lsole'], bum: ['lglute', 'tglute', 'pelvis'] };

// ---------- textures ----------
// The painted pictures around the golfer (grass, wooden floor, tree line, living room). Painting them takes
// half a second on a phone, so a background worker paints them while the list is read and the screen never stalls.
// The same function paints on the page itself when a worker can't (older phones, or the build that makes the card pictures).
function paintTex(name, mk) {
  if (name === 'trees') {   // four trees for the range, side by side (512 x 1024 each): lit from the upper left, transparent around them
    const W = 2048, H = 1024, c = mk(W, H), x = c.getContext('2d');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const kinds = [{ k: 'oak', col: [62, 98, 50] }, { k: 'poplar', col: [70, 104, 48] }, { k: 'pine', col: [40, 70, 50] }, { k: 'birch', col: [96, 128, 62] }];
    kinds.forEach((K, i) => {
      const ox = i * 512, cw = 512, base = H - 6, cx = ox + cw / 2;
      const crown = K.k === 'oak' ? { cy: H * 0.46, rx: cw * 0.46, ry: H * 0.37, top: H * 0.08 } : K.k === 'poplar' ? { cy: H * 0.46, rx: cw * 0.24, ry: H * 0.42, top: H * 0.03 }
        : K.k === 'pine' ? { cy: H * 0.48, rx: cw * 0.36, ry: H * 0.46, top: H * 0.02 } : { cy: H * 0.47, rx: cw * 0.38, ry: H * 0.37, top: H * 0.08 };
      const tw = K.k === 'pine' ? 16 : K.k === 'birch' ? 14 : 22, tTop = crown.cy + crown.ry * 0.2;
      // trunk and a few limbs reaching into the crown
      x.fillStyle = K.k === 'birch' ? '#d8d4c8' : '#4a3a2c'; x.beginPath(); x.moveTo(cx - tw, base); x.lineTo(cx - tw * 0.45, tTop); x.lineTo(cx + tw * 0.45, tTop); x.lineTo(cx + tw, base); x.fill();
      if (K.k === 'birch') { x.fillStyle = '#3a3530'; for (let j = 0; j < 26; j++) x.fillRect(cx - tw * 0.8 + rnd() * tw * 1.2, tTop + rnd() * (base - tTop), 6 + rnd() * 8, 2); }
      x.strokeStyle = K.k === 'birch' ? '#7d7668' : '#40322a'; x.lineCap = 'round';
      for (let j = 0; j < (K.k === 'pine' ? 0 : 7); j++) { const y0 = tTop + rnd() * 60, a = (rnd() - 0.5) * 2.2; x.lineWidth = 5 + rnd() * 5; x.beginPath(); x.moveTo(cx, y0); x.quadraticCurveTo(cx + Math.sin(a) * 60, y0 - 80, cx + Math.sin(a) * crown.rx * 0.8, y0 - 120 - rnd() * 140); x.stroke(); }
      // leaf masses: sub-crowns, then clusters inside each, dark ones first (the inside of the crown) and lit ones on top
      const subs = [];
      const inside = (px, py) => { if (K.k === 'pine') { const t = (py - crown.top) / (crown.cy + crown.ry - crown.top); return t > 0 && t < 1 && Math.abs(px - cx) < crown.rx * t * (0.75 + 0.25 * Math.sin(t * 40)); }
        const dx = (px - cx) / crown.rx, dy = (py - crown.cy) / crown.ry; return dx * dx + dy * dy < 1; };
      for (let j = 0; j < 400 && subs.length < (K.k === 'pine' ? 40 : 16); j++) { const px = cx + (rnd() * 2 - 1) * crown.rx, py = crown.top + rnd() * (crown.cy + crown.ry - crown.top); if (inside(px, py)) subs.push([px, py, (K.k === 'pine' ? 30 : 46) + rnd() * 40]); }
      const L = [-0.62, -0.78];   // light from the upper left
      for (const pass of [0, 1]) for (const [sx, sy, sr] of subs) {
        const n = pass ? 110 : 60;
        for (let j = 0; j < n; j++) {
          const a = rnd() * 6.283, r = Math.sqrt(rnd()) * sr, px = sx + Math.cos(a) * r, py = sy + Math.sin(a) * r * 0.85;
          const nx = (px - sx) / sr, ny = (py - sy) / sr, lit = Math.max(0, -(nx * L[0] + ny * L[1])), up = 1 - (py - crown.top) / (base - crown.top);
          const k = pass ? 0.62 + 0.55 * lit + 0.18 * up : 0.38 + 0.12 * up, v = 0.92 + rnd() * 0.16;
          x.fillStyle = `rgb(${Math.min(255, K.col[0] * k * v) | 0},${Math.min(255, K.col[1] * k * v) | 0},${Math.min(255, K.col[2] * k * v * (pass ? 0.95 : 1.1)) | 0})`;
          x.beginPath(); x.ellipse(px, py, 5 + rnd() * (K.k === 'pine' ? 7 : 10), 4 + rnd() * 7, rnd() * 3, 0, 7); x.fill();
        }
      }
      // ragged edges: loose leaves just outside the crown
      for (let j = 0; j < 260; j++) { const [sx, sy, sr] = subs[(rnd() * subs.length) | 0], a = rnd() * 6.283, r = sr * (0.95 + rnd() * 0.3);
        const k = 0.55 + rnd() * 0.5; x.fillStyle = `rgb(${K.col[0] * k | 0},${K.col[1] * k | 0},${K.col[2] * k | 0})`; x.beginPath(); x.arc(sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.85, 2 + rnd() * 4, 0, 7); x.fill(); }
    });
    return c;
  }
  if (name === 'planks') {   // light oak floorboards, 1.6 m square and tiling: 10 boards across, staggered ends, grain and a little colour variation
    const S = 1024, c = mk(S, S), x = c.getContext('2d'), n = 10, bw = S / n;
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      let y = -rnd() * S;
      while (y < S) {
        const len = S * (0.45 + rnd() * 0.55), tone = 0.86 + rnd() * 0.22, warm = rnd() * 14;
        const g = x.createLinearGradient(i * bw, 0, (i + 1) * bw, 0); const col = (k) => `rgb(${(204 + warm) * tone * k | 0},${163 * tone * k | 0},${118 * tone * k | 0})`;
        g.addColorStop(0, col(0.96)); g.addColorStop(0.5, col(1.02)); g.addColorStop(1, col(0.95));
        for (const yy of [y, y + S, y - S]) { x.fillStyle = g; x.fillRect(i * bw, yy, bw, len); }
        x.save(); x.beginPath(); x.rect(i * bw, y, bw, len); x.rect(i * bw, y - S, bw, len); x.rect(i * bw, y + S, bw, len); x.clip();
        for (let j = 0; j < 14; j++) { const gx = i * bw + 4 + rnd() * (bw - 8), ph = rnd() * 6; x.strokeStyle = `rgba(110,72,38,${0.06 + rnd() * 0.1})`; x.lineWidth = 0.6 + rnd() * 1.4; x.beginPath();
          for (let t = 0; t <= S * 2; t += 16) { const px = gx + Math.sin(t / (60 + j * 7) + ph) * 2.5, py = y - S + t; t ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
        if (rnd() < 0.35) { const kx = i * bw + 10 + rnd() * (bw - 20), ky = y + rnd() * len; x.fillStyle = 'rgba(120,80,45,.35)'; x.beginPath(); x.ellipse(kx, ky, 3, 6, 0, 0, 7); x.fill(); }
        x.restore();
        for (const yy of [y, y + S, y - S]) { x.fillStyle = 'rgba(70,45,25,.55)'; x.fillRect(i * bw, yy, bw, 2); }
        y += len;
      }
      x.fillStyle = 'rgba(70,45,25,.5)'; x.fillRect(i * bw, 0, 2, S);
    }
    return c;
  }
  if (name === 'rug') {   // a round woven rug: muted sage with a darker border and a cream line
    const S = 1024, c = mk(S, S), x = c.getContext('2d'), m = S / 2;
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ring = (r, col) => { x.fillStyle = col; x.beginPath(); x.arc(m, m, r, 0, 7); x.fill(); };
    ring(m, '#4c5a54'); ring(m * 0.93, '#e6dccb'); ring(m * 0.91, '#6d7d74'); ring(m * 0.62, '#5d6d65'); ring(m * 0.6, '#768880');
    for (let i = 0; i < 90000; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * m; x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; x.fillRect(m + Math.cos(a) * r, m + Math.sin(a) * r, 2, 2); }
    return c;
  }
  if (name === 'grass') {
    const w = 1024, h = 1024, c = mk(w, h), x = c.getContext('2d');
    x.fillStyle = '#5f9a47'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const l = Math.random(); x.fillStyle = `rgba(${40 + l * 50},${90 + l * 70},${25 + l * 30},${0.05 + Math.random() * 0.06})`; const s = 6 + Math.random() * 30; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, s, 0, 7); x.fill(); }
    for (let i = 0; i < 60000; i++) { const g = 70 + Math.random() * 90; x.fillStyle = `rgba(${g * 0.5},${g * 1.1},${g * 0.38},${0.12 + Math.random() * 0.18})`; x.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3); }
    return c;
  }
  if (name === 'wood') {
    const w = 1024, h = 1024, c = mk(w, h), x = c.getContext('2d');
    for (let i = 0; i < 24; i++) { const l = 205 + (i * 37 % 23) - 10; x.fillStyle = `rgb(${l},${l * 0.88 | 0},${l * 0.74 | 0})`; x.fillRect(0, i * h / 24, w, h / 24 - 2); x.fillStyle = 'rgba(90,60,30,.25)'; x.fillRect(0, (i + 1) * h / 24 - 2, w, 2); }
    for (let i = 0; i < 400; i++) { x.strokeStyle = 'rgba(120,80,40,.06)'; x.beginPath(); const y = Math.random() * h; x.moveTo(0, y); x.bezierCurveTo(w / 3, y + 6, w * 2 / 3, y - 6, w, y + 2); x.stroke(); }
    const r = x.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.5); r.addColorStop(0, 'rgba(236,232,226,0)'); r.addColorStop(1, 'rgba(236,232,226,1)'); x.fillStyle = r; x.fillRect(0, 0, w, h);
    return c;
  }
  if (name === 'room') {   // a quiet living room: warm wall, a bright window, skirting board and a sofa
    const W = 4096, H = 640, c = mk(W, H), x = c.getContext('2d');
    const wall = x.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#e9e1d6'); wall.addColorStop(1, '#ddd2c3'); x.fillStyle = wall; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(120,100,80,${Math.random() * 0.025})`; x.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
    const win = (cx, w) => { const g = x.createRadialGradient(cx, H * 0.42, 10, cx, H * 0.42, w * 1.2); g.addColorStop(0, 'rgba(255,252,240,.55)'); g.addColorStop(1, 'rgba(255,252,240,0)'); x.fillStyle = g; x.fillRect(cx - w * 1.5, 0, w * 3, H);
      x.fillStyle = '#f7f5ee'; x.fillRect(cx - w / 2 - 14, H * 0.18 - 14, w + 28, H * 0.5 + 28); const sky = x.createLinearGradient(0, H * 0.18, 0, H * 0.68); sky.addColorStop(0, '#cfe3f1'); sky.addColorStop(1, '#eef4ec'); x.fillStyle = sky; x.fillRect(cx - w / 2, H * 0.18, w, H * 0.5);
      x.save(); x.beginPath(); x.rect(cx - w / 2, H * 0.18, w, H * 0.5); x.clip(); x.fillStyle = 'rgba(110,150,100,.5)'; for (let i = 0; i < 60; i++) { x.beginPath(); x.arc(cx - w / 2 + Math.random() * w, H * 0.6 + Math.random() * 30, 14 + Math.random() * 22, 0, 7); x.fill(); } x.restore();
      x.fillStyle = '#f7f5ee'; x.fillRect(cx - 6, H * 0.18, 12, H * 0.5); x.fillRect(cx - w / 2, H * 0.42, w, 10); };
    win(W * 0.5, 360); win(W * 0.12, 300);
    x.fillStyle = '#6f6458'; x.beginPath(); x.roundRect ? x.roundRect(W * 0.72, H * 0.6, 700, 200, 40) : x.rect(W * 0.72, H * 0.6, 700, 200); x.fill();
    x.fillStyle = '#857a6d'; x.fillRect(W * 0.72 + 20, H * 0.66, 660, 60);
    x.fillStyle = '#f2ede4'; x.fillRect(0, H * 0.93, W, H * 0.07); x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, H * 0.93, W, 3);
    return c;
  }
  if (name === 'tree') {   // the far backdrop all the way round: a summer sky with soft clouds over a hazy distant tree line (the near trees are 3D)
    const W = 4096, H = 640, c = mk(W, H), x = c.getContext('2d');
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sky = x.createLinearGradient(0, 0, 0, H * 0.9); sky.addColorStop(0, '#5f93c9'); sky.addColorStop(0.6, '#9cc0e0'); sky.addColorStop(1, '#d6e4ea'); x.fillStyle = sky; x.fillRect(0, 0, W, H);
    // fair-weather clouds: flat grey-blue bases, bright tops, smaller and flatter toward the horizon
    for (let i = 0; i < 46; i++) {
      const cy = H * (0.3 + rnd() * 0.42), sc = 0.5 + (cy / H) * 0.9 * 0, size = (1.1 - cy / H) * (60 + rnd() * 120), cx = rnd() * W;
      for (let j = 0; j < 30; j++) { const px = cx + (rnd() - 0.5) * size * 3.2, py = cy - rnd() * size * 0.55, r = size * (0.25 + rnd() * 0.35);
        const g = x.createRadialGradient(px, py - r * 0.3, r * 0.1, px, py, r); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(0.7, 'rgba(240,244,248,.45)'); g.addColorStop(1, 'rgba(225,232,240,0)');
        x.fillStyle = g; x.beginPath(); x.ellipse(px, py, r * 1.4, r * 0.8, 0, 0, 7); x.fill(); }
      void sc;
    }
    // two rows of far trees, pale and blue with distance
    for (const R of [{ y: 0.9, h: 0.09, col: [150, 172, 176], n: 260 }, { y: 0.95, h: 0.1, col: [118, 146, 136], n: 220 }]) {
      for (let i = 0; i < R.n; i++) { const cx = rnd() * W, base = H * R.y, th = H * R.h * (0.5 + rnd() * 0.7), r0 = 10 + rnd() * 22;
        for (let k = 0; k < 40; k++) { const t = rnd(), l = 0.86 + rnd() * 0.22; x.fillStyle = `rgb(${R.col[0] * l | 0},${R.col[1] * l | 0},${R.col[2] * l | 0})`;
          x.beginPath(); x.arc(cx + (rnd() - 0.5) * r0 * 1.6, base - th * (0.2 + t * 0.8), r0 * (0.2 + rnd() * 0.25) * (1.2 - t * 0.5), 0, 7); x.fill(); } }
      x.fillStyle = 'rgba(214,226,230,0.22)'; x.fillRect(0, 0, W, H * R.y + 2);
    }
    x.fillStyle = '#8fae84'; x.fillRect(0, H * 0.95, W, H * 0.05);
    const c2 = mk(W, H), x2 = c2.getContext('2d'); x2.filter = 'blur(1.2px)'; x2.drawImage(c, 0, 0);
    if (!x2.filter || x2.filter === 'none') x2.drawImage(c, 0, 0);
    return c2;
  }
}
const PAINTS = ['tree', 'trees', 'grass', 'room', 'planks', 'rug'], PAINTED = {};
let PAINTP = null;
// ask a background worker to paint every picture; resolves when they're ready (or straight away if it can't)
function prepTextures(ms) {
  if (PAINTP) return PAINTP;
  PAINTP = new Promise(done => {
    let w = null, url = null;
    const fin = () => { if (w) w.terminate(); if (url) URL.revokeObjectURL(url); w = null; done(); };
    try {
      if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return fin();
      const src = 'const paintTex = ' + paintTex.toString() + ';\nonmessage = e => { const out = {}, keep = []; for (const n of e.data) { try { const b = paintTex(n, (w, h) => new OffscreenCanvas(w, h)).transferToImageBitmap(); out[n] = b; keep.push(b); } catch (err) {} } postMessage(out, keep); };';
      url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); w = new Worker(url);
      w.onmessage = e => { Object.assign(PAINTED, e.data || {}); fin(); }; w.onerror = fin;
      w.postMessage(PAINTS); setTimeout(fin, ms || 15000);
    } catch (e) { fin(); }
  });
  return PAINTP;
}
// the picture as a canvas: the worker's copy when it has one (a quick copy), otherwise painted here
function painted(name) {
  const b = PAINTED[name]; delete PAINTED[name];
  if (b) { const c = document.createElement('canvas'); c.width = b.width; c.height = b.height; c.getContext('2d').drawImage(b, 0, 0); if (b.close) b.close(); return c; }
  return paintTex(name, (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
}
let TX = null, TX_STRIPES = null;
function textures() {
  if (TX) return TX;
  const tex = c => { const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
  const mkC = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return tex(c); };
  const grass = tex(painted('grass'));
  grass.wrapS = grass.wrapT = T.RepeatWrapping; grass.repeat.set(10, 10);
  const stripes = mkC(512, 512, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#e8f0e0' : '#c9d6c0'; x.fillRect(i * w / 8, 0, w / 8, h); } });
  stripes.wrapS = stripes.wrapT = T.RepeatWrapping; stripes.repeat.set(5, 1); TX_STRIPES = stripes;
  const wood = tex(painted('planks')); wood.wrapS = wood.wrapT = T.RepeatWrapping; wood.repeat.set(14 / 1.6, 14 / 1.6);
  const rug = tex(painted('rug')), trees = tex(painted('trees'));
  // slow, large-scale patches of lighter and darker grass, so the fairway doesn't look printed
  const macro = mkC(256, 256, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); let sd = 9; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) { const cx = r() * w, cy = r() * h, rr = 10 + r() * 40, v = r() < 0.5 ? 255 : 0; for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rr); g.addColorStop(0, `rgba(${v},${v},${v},.18)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); x.fillStyle = g; x.fillRect(cx + ox - rr, cy + oy - rr, rr * 2, rr * 2); } } });
  macro.wrapS = macro.wrapT = T.RepeatWrapping; macro.encoding = T.LinearEncoding;
  const sky = mkC(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fb6dc'); g.addColorStop(0.55, '#d5e4ee'); g.addColorStop(1, '#eef2ef'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const home = mkC(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e7e2da'); g.addColorStop(0.62, '#f1ede7'); g.addColorStop(1, '#ece8e2'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  return (TX = { grass, wood, sky, home, rug, trees, macro });
}

// ---------- sky light for reflections, and the course around the golfer ----------
let ENV = null;
function envMap() {
  if (ENV) return ENV;
  const es = new T.Scene(), g = new T.SphereGeometry(10, 32, 16), pa = g.attributes.position, cols = [];
  const top = new T.Color(0x7fa8d4).convertSRGBToLinear(), hor = new T.Color(0xe9f0f2).convertSRGBToLinear(), gr = new T.Color(0x5e7d47).convertSRGBToLinear();
  for (let i = 0; i < pa.count; i++) { const yy = pa.getY(i) / 10; const c = yy > 0 ? hor.clone().lerp(top, Math.pow(yy, 0.6)) : hor.clone().lerp(gr, Math.min(1, -yy * 4)); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); es.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const sun = new T.Mesh(new T.SphereGeometry(0.7, 16, 8), new T.MeshBasicMaterial({ color: new T.Color(6, 5.6, 5) })); sun.position.set(4, 7, 5); es.add(sun);
  const pm = new T.PMREMGenerator(R); ENV = pm.fromScene(es, 0.03).texture; pm.dispose(); return ENV;
}
let BACK = null, ROOM = null;
function roomBack() {
  if (!ROOM) {
    const tx = new T.CanvasTexture(painted('room')); tx.encoding = T.sRGBEncoding; tx.anisotropy = 4;
    const geo = new T.CylinderGeometry(7, 7, 3.2, 96, 1, true); geo.translate(0, 1.6, 0);
    ROOM = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tx, side: T.BackSide, fog: false }));
  }
  return ROOM.clone();
}
function treeLine() {
  if (!BACK) {
    const tx = new T.CanvasTexture(painted('tree')); tx.encoding = T.sRGBEncoding; tx.wrapS = T.RepeatWrapping; tx.anisotropy = 4;
    const geo = new T.CylinderGeometry(46, 46, 22, 96, 1, true); geo.translate(0, 9, 0);
    BACK = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tx, side: T.BackSide, fog: false, depthWrite: false }));
    BACK.renderOrder = -1;
  }
  return BACK.clone();
}
// ---------- the range: real trees around it and flags out on the range ----------
// Trees are flat cut-outs that always turn to face the camera, so they stay sharp (the painted tree line behind them
// was a 4096 px strip stretched round 290 m and always looked blurred). Four kinds, packed in one picture.
const TREE_KINDS = [{ h: [10, 14], w: 0.62 }, { h: [13, 18], w: 0.4 }, { h: [11, 16], w: 0.5 }, { h: [8, 12], w: 0.5 }];
let FOREST = null;
function forestLayout() {
  if (FOREST) return FOREST;
  let sd = 21; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647, out = [[], [], [], []];
  for (let i = 0; i < 150; i++) {
    let a = r() * Math.PI * 2, d = 36 + r() * 24;
    const ahead = Math.cos(a) > 0.82;                 // toward the target the range stays open: trees only far away
    if (ahead) d = 95 + r() * 45;
    const k = r() < 0.38 ? 0 : r() < 0.4 ? 1 : r() < 0.6 ? 2 : 3, K = TREE_KINDS[k], h = K.h[0] + r() * (K.h[1] - K.h[0]);
    out[k].push({ x: Math.cos(a) * d, z: Math.sin(a) * d + 0.3, h, w: h * K.w * (0.9 + r() * 0.2), tint: 0.85 + r() * 0.25 });
  }
  return (FOREST = out);
}
function forest(S) {
  const lay = forestLayout(), group = new T.Group(); group.userData.trees = [];
  const mat = new T.MeshBasicMaterial({ map: TX.trees, alphaTest: 0.5, side: T.DoubleSide });
  lay.forEach((list, k) => {
    const g = new T.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / 4);
    const m = new T.InstancedMesh(g, mat, list.length); m.frustumCulled = false;
    list.forEach((t, i) => m.setColorAt(i, new T.Color(t.tint, t.tint, t.tint * 0.96)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    group.add(m); group.userData.trees.push({ m, list });
  });
  group.userData.cam = null; S.add(group); S.userData.forest = group; return group;
}
// turn every tree to face the camera (only when the camera has moved)
const _q = T ? new T.Quaternion() : null, _s = T ? new T.Vector3() : null, _p = T ? new T.Vector3() : null, _mm = T ? new T.Matrix4() : null, _e = T ? new T.Euler() : null;
function faceTrees(sc) {
  const f = sc.S.userData.forest; if (!f) return;
  const c = sc.S.worldToLocal(sc.cam.position.clone()), last = f.userData.cam;
  if (last && last.distanceToSquared(c) < 1e-4) return; f.userData.cam = c;
  for (const { m, list } of f.userData.trees) {
    list.forEach((t, i) => { _e.set(0, Math.atan2(c.x - t.x, c.z - t.z), 0); _q.setFromEuler(_e); _p.set(t.x, 0, t.z); _s.set(t.w, t.h, 1); m.setMatrixAt(i, _mm.compose(_p, _q, _s)); });
    m.instanceMatrix.needsUpdate = true;
  }
}
// target greens with flags at about 50, 90 and 130 m, so the range has depth and a direction
function rangeTargets(S) {
  const g = new T.Group(), green = new T.MeshBasicMaterial({ color: new T.Color(0x5e9c45) }), pole = new T.MeshLambertMaterial({ color: 0xf4f4f0 });
  for (const [x, z, r, col] of [[48, -7, 5, 0xd8332a], [88, 11, 7, 0xf2c12e], [130, -16, 9, 0xffffff]]) {
    const gr = new T.Mesh(new T.CircleGeometry(r, 40), green); gr.rotation.x = -Math.PI / 2; gr.position.set(x, 0.02, z); gr.scale.set(1.35, 1, 1); g.add(gr);
    const p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.6, 6), pole); p.position.set(x, 1.3, z); g.add(p);
    const fl = new T.Mesh(new T.PlaneGeometry(0.9, 0.6), new T.MeshLambertMaterial({ color: col, side: T.DoubleSide })); fl.position.set(x + 0.45, 2.3, z); g.add(fl);
  }
  S.add(g); return g;
}
// ---------- props ----------
function cyl(r, mat, seg) { const g = new T.CylinderGeometry(r, r, 1, seg || 14); g.translate(0, 0.5, 0); const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m; }
function box(w, h, d, mat, pos) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; if (pos) m.position.set(pos[0], pos[1], pos[2]); return m; }
function between(m, a, b) { const A = v3(a), d = v3(b).sub(A), L = d.length(); m.position.copy(A); m.quaternion.setFromUnitVectors(Y, d.clone().normalize()); m.scale.set(1, L, 1); }
let PM = null;
function propMats() {
  if (PM) return PM;
  return (PM = { stick: std(0xffb020, { roughness: 0.4 }), stick2: std(0xff5fa2, { roughness: 0.4 }), white: std(0xffffff, { roughness: 0.35 }), black: std(0x161616, { roughness: 0.4, metalness: 0.3 }),
    steel: std(0xd0d4d8, { roughness: 0.22, metalness: 0.9 }), wood: std(0x8a5a32, { roughness: 0.7 }), wood2: std(0x6e4526, { roughness: 0.7 }), wall: std(0xdcd3c4, { roughness: 0.95 }),
    towel: std(0xf3f3ee, { roughness: 1 }), bag: std(0x1d5a34, { roughness: 0.7 }), red: std(0xc8372b, { roughness: 0.7 }), cover: std(0x283a8c, { roughness: 0.8 }), bottle: std(0x8fd0ff, { roughness: 0.1, metalness: 0, transparent: true, opacity: 0.75 }),
    cap: std(0x2a6fd6, { roughness: 0.5 }), umb: std(0x2a2a2a), umbC: std(0xe03a3a, { roughness: 0.6, side: T.DoubleSide }), mat: std(0x2d5a3a, { roughness: 0.95 }), glove: std(0xffffff, { roughness: 0.6 }),
    line: std(0xffffff, { roughness: 0.8 }), mirror: std(0xbfd6de, { roughness: 0.05, metalness: 0.85 }), frame: std(0xf4f1ea, { roughness: 0.8 }) });
}
function propVal(dr, v) {
  if (typeof v !== 'string') return v;
  const ball = ballOf(dr), J0 = startJ(dr), num = parseFloat(v.slice(2)) || 0;
  const base = { BX: ball[0], BZ: ball[2], HX: J0.head[0], HZ: J0.head[2], SX: J0.seat[0], SZ: J0.seat[2] }[v.slice(0, 2)];
  return base == null ? v : base + num;
}
function propPoint(dr, a) { return a.map(v => propVal(dr, v)); }
function buildProps(S, dr) {
  const M = propMats(), out = [], ball = ballOf(dr), BX = ball[0], BZ = ball[2];
  const res = v => propVal(dr, v), J0 = startJ(dr), HZ = J0.head[2], HX = J0.head[0];
  const R3 = a => a.map(res);
  for (const q of dr.props || []) {
    const g = new T.Group(); g.userData.q = q; let m;
    switch (q.type) {
      case 'ball': { const b = new T.Mesh(new T.SphereGeometry(0.021, 20, 14), M.white); b.castShadow = true; const at = R3(q.at || ['BX', 0.021, 'BZ']); b.position.set(at[0], at[1] || 0.021, at[2]); g.add(b); break; }
      case 'tee': { const at = R3(q.at); m = cyl(0.006, M.white); m.position.set(at[0], 0, at[2]); m.scale.y = q.h || 0.05; g.add(m); break; }
      case 'stick': { m = cyl(0.009, q.alt ? M.stick2 : M.stick); between(m, R3(q.a), R3(q.b)); g.add(m); break; }
      case 'line': { const a = R3(q.a), b = R3(q.b), d = sub(b, a), L = len(d); m = box(0.035, 0.004, L, M.line); m.position.set((a[0] + b[0]) / 2, 0.003, (a[2] + b[2]) / 2); m.rotation.y = Math.atan2(d[0], d[2]); m.castShadow = false; g.add(m); break; }
      case 'chair': { const c = R3(q.at), w = 0.22, d = 0.42, sh = 0.47;   // backrest nearest the golfer, seat away from them
        for (const [x, z, h] of [[-w, 0, 0.92], [w, 0, 0.92], [-w, -d, sh], [w, -d, sh]]) { const l = cyl(0.017, M.wood2); l.position.set(c[0] + x, 0, c[2] + z); l.scale.y = h; g.add(l); }
        g.add(box(w * 2 + 0.05, 0.035, d + 0.04, M.wood, [c[0], sh, c[2] - d / 2]));
        g.add(box(w * 2 + 0.04, 0.3, 0.035, M.wood, [c[0], 0.76, c[2]])); break; }
      case 'wall': { const z = res(q.z), x = q.x || 0; if (q.towel) { const tw = box(0.2, 0.14, 0.03, M.towel, [HX, J0.head[1] + 0.03, z - 0.015]); g.add(tw); } g.add(box(3.2, 2.4, 0.08, M.wall, [x, 1.2, z + 0.04])); break; }
      case 'door': { const z = res(q.z), x = res(q.x); g.add(box(0.07, 2.1, 0.12, M.frame, [x, 1.05, z])); g.add(box(0.07, 2.1, 0.12, M.frame, [x - 0.86, 1.05, z])); g.add(box(0.93, 0.07, 0.12, M.frame, [x - 0.43, 2.1, z])); break; }
      case 'umbrella': { const at = R3(q.at), h = q.h || 1.0; const s = cyl(0.008, M.umb); s.position.set(at[0], 0, at[2]); s.scale.y = h; g.add(s);
        const can = new T.Mesh(new T.ConeGeometry(0.09, 0.62, 10, 1, true), M.umbC); can.position.set(at[0], h - 0.32, at[2]); can.rotation.x = Math.PI; can.castShadow = true; g.add(can);
        const hd = new T.Mesh(new T.TorusGeometry(0.03, 0.007, 6, 12, Math.PI), M.umb); hd.position.set(at[0] + 0.03, h, at[2]); g.add(hd); break; }
      case 'bottle': { const at = R3(q.at); const b = cyl(0.035, M.bottle, 18); b.scale.y = 0.22; g.add(b); const c = cyl(0.016, M.cap); c.position.y = 0.22; c.scale.y = 0.03; g.add(c); g.position.set(at[0], 0, at[2]); g.userData.knock = true; break; }
      case 'headcover': { const at = R3(q.at); const h = new T.Mesh(ell(0.075, 0.07, 0.11, 20), M.cover); h.position.set(at[0], 0.07, at[2]); h.castShadow = true; g.add(h); const s = new T.Mesh(ell(0.05, 0.045, 0.08), M.cover); s.position.set(at[0] - 0.1, 0.05, at[2]); g.add(s); break; }
      case 'glove': { const gl = new T.Mesh(ell(0.075, 0.04, 0.095, 16), propMats().cap); gl.castShadow = true; g.add(gl); g.userData.attach = q.attach; break; }
      case 'mirror': { const at = R3(q.at); g.add(box(0.04, 1.8, 0.8, M.frame, [at[0], 0.95, at[2]])); g.add(box(0.045, 1.7, 0.7, M.mirror, [at[0] - 0.005, 0.95, at[2]])); break; }
      case 'bag': { const at = R3(q.at); const b = cyl(0.13, M.bag, 20); b.position.set(at[0], 0, at[2]); b.scale.y = 0.85; g.add(b); break; }
      case 'impactbag': { const at = R3(q.at); g.add(box(0.36, 0.3, 0.28, M.red, [at[0], 0.15, at[2]])); break; }
      case 'belt': { m = cyl(0.009, M.stick); g.add(m); g.userData.belt = true; break; }
      case 'shadowballs': { for (const j of [J0.pel, J0.chest, J0.head]) { const b = new T.Mesh(new T.SphereGeometry(0.021, 16, 12), M.white); b.position.set(j[0] + 0.1 * j[1] / 4.4, 0.021, j[2] + 0.5 * j[1]); b.castShadow = true; g.add(b); } break; }
    }
    S.add(g); out.push(g);
  }
  return out;
}
function updateProps(props, J, key, dr, st) {
  for (const g of props) {
    const q = g.userData.q;
    g.visible = !(q.from != null && st.i < q.from) && !(q.until != null && st.i > q.until);
    if (q.type === 'glove') { const a = q.attach === 'larm' ? [J.ls, J.le] : [J.ts, J.te], c = add(add(mul(a[0], 0.72), mul(a[1], 0.28)), add(mul(J.F, 0.05), mul(J.Lt, q.attach === 'larm' ? 0.1 : -0.1))); g.children[0].position.copy(v3(add(c, mul(norm(sub(J.chest, a[0])), 0.02)))); g.children[0].quaternion.setFromUnitVectors(Y, v3(norm(sub(a[1], a[0])))); }
    if (q.type === 'belt') between(g.children[0], J.belt[0], J.belt[1]);
    if (g.userData.knock) { const k = key.knock ? (st.inHold ? 1 : st.raw) : 0; g.rotation.set(k * 1.4, 0, -k * 0.5); }
  }
}

// ---------- scene per drill ----------
const GFILL = [0.95, 0.82, 1.8], GKEY = 1;   // grass: sky fill matched to the old full-PBR look (tools: perf/gtune.py)
// Only the latest couple of drill scenes are kept: each has its own 2048px shadow map (16 MB on the GPU),
// and keeping all thirty made phones run out of graphics memory.
const SCN = new Map(), KEEP_SCENES = 2, STATS = { renders: 0, shared: 0 };
function dropScene(sc) { const m = sc.key && sc.key.shadow && sc.key.shadow.map; if (m) { m.dispose(); sc.key.shadow.map = null; } }
function dropScenes(keep) { while (SCN.size > keep) { const k = SCN.keys().next().value; dropScene(SCN.get(k)); SCN.delete(k); } }
function scene(dr) {
  if (SCN.has(dr.id)) { const sc = SCN.get(dr.id); SCN.delete(dr.id); SCN.set(dr.id, sc); return sc; }
  dropScenes(KEEP_SCENES - 1);
  prep(dr);
  const S = new T.Scene(), TXs = textures(), home = dr.scene === 'home';
  S.background = home ? TXs.home : TXs.sky;
  S.environment = envMap();
  S.add(new T.HemisphereLight(0xe4eef6, home ? 0x8a7458 : 0x56704a, home ? 0.45 : 0.35));
  const key = new T.DirectionalLight(0xfff2e2, home ? 1.6 : 2.1);
  if (dr.light === 'behind') key.position.set(-0.1, 4.4, -2.2); else key.position.set(2.2, 4.6, 3.4);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 0.5, far: 14 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.004; key.shadow.radius = 3; key.shadow.camera.updateProjectionMatrix(); S.add(key);
  const fill = new T.DirectionalLight(0xfff1e2, 0.25); fill.position.set(-3, 2.2, 2.5); S.add(fill);
  const rim = new T.DirectionalLight(0xdfe9ff, 0.6); rim.position.set(-1.5, 3, -3.5); S.add(rim);
  const groundTex = home ? TXs.wood : TXs.grass;
  let ground;
  if (home) { ground = new T.Mesh(new T.PlaneGeometry(14, 14), new T.MeshStandardMaterial({ map: groundTex, roughness: 0.5, envMapIntensity: 0.7 })); S.add(roomBack()); }
  else {
    // aerial haze: far things fade toward the colour of the distant trees, gently (it used to go fully grey by 60 m, a hard band at the horizon)
    S.fog = new T.Fog(new T.Color(0xc9d9da).convertSRGBToLinear(), 28, 170);
    // grass is fully rough, so simple diffuse lighting looks the same as the full PBR model at a fraction of the cost (it fills most of the screen)
    const gm = new T.MeshLambertMaterial({ map: groundTex, emissiveMap: groundTex, emissive: new T.Color(GFILL[0], GFILL[1], GFILL[2]), color: new T.Color(GKEY, GKEY, GKEY) });   // emissive stands in for the sky's fill light
    // mown fairway: 4 m bands along the target line, light and dark as the mower went up and back, with slow patches of
    // lighter and darker grass on top. The same shade goes on the sky-fill (emissive) part, which is most of the brightness.
    gm.onBeforeCompile = sh => { sh.uniforms.macro = { value: TX.macro };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D macro;')
        .replace('#include <map_fragment>', '#include <map_fragment>\nfloat bandF = fract(vUv.y * 1.5); float band = smoothstep(0.0, 0.04, bandF) * (1.0 - smoothstep(0.5, 0.54, bandF));\nfloat gk = mix(0.84, 1.0, band) * mix(0.86, 1.1, texture2D(macro, vUv * 0.05).r);\ndiffuseColor.rgb *= gk * vec3(0.9, 0.9, 0.86);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= gk * vec3(0.8, 0.83, 0.76);'); };
    ground = new T.Mesh(new T.PlaneGeometry(400, 400), gm); TX.grass.repeat.set(400 / 12, 400 / 12); S.add(treeLine()); forest(S); rangeTargets(S);
  }
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
  if (!home) {
    // a practice-range hitting mat: dense dark turf in a black rubber frame
    if (!TX.turf) { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#24502c'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 70000; i++) { const l = 40 + Math.random() * 70; x.fillStyle = `rgba(${l * 0.55 | 0},${l * 1.3 | 0},${l * 0.62 | 0},0.4)`; x.fillRect(Math.random() * 512, Math.random() * 512, 1, 1 + Math.random() * 2); }
      for (let i = 0; i < 512; i += 4) { x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(0, i, 512, 1); }
      TX.turf = new T.CanvasTexture(c); TX.turf.encoding = T.sRGBEncoding; TX.turf.anisotropy = 4; TX.turf.wrapS = TX.turf.wrapT = T.RepeatWrapping; TX.turf.repeat.set(3, 3); }
    const frame = new T.Mesh(new T.BoxGeometry(1.64, 0.012, 1.64), std(0x161816, { roughness: 0.85 })); frame.position.set(0.05, 0.006, 0.3); frame.receiveShadow = true; S.add(frame);
    const mat = new T.Mesh(new T.BoxGeometry(1.5, 0.016, 1.5), new T.MeshStandardMaterial({ map: TX.turf, roughness: 1, envMapIntensity: 0.25 })); mat.position.set(0.05, 0.008, 0.3); mat.receiveShadow = true; S.add(mat); }
  if (home && dr.rug !== false) { const rug = new T.Mesh(new T.CircleGeometry(1.1, 64), new T.MeshStandardMaterial({ map: TXs.rug, roughness: 1, envMapIntensity: 0.2 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.004, 0.15); rug.receiveShadow = true; S.add(rug); }
  // target line: a dashed line on the ground toward the target, so every view shows which way the ball goes
  const tg = new T.Group(); for (let i = 0; i < 8; i++) { const d = box(0.16, 0.003, 0.018, std(0xffffff, { roughness: 0.8 }), [0.55 + i * 0.26, 0.004, ballOf(dr)[2]]); d.castShadow = false; tg.add(d); }
  const arr = new T.Mesh(new T.ConeGeometry(0.05, 0.14, 3), std(0xffffff)); arr.rotation.z = -Math.PI / 2; arr.position.set(2.75, 0.01, ballOf(dr)[2]); arr.scale.set(1, 1, 0.15); tg.add(arr); S.add(tg);
  const real = typeof CCGolfer !== 'undefined' && CCGolfer.ready();
  const fig = real ? CCGolfer.make(false) : figure(false), ghost = real ? CCGolfer.make(true) : figure(true); fig.real = real; ghost.real = real; S.add(fig.G); S.add(ghost.G); ghost.G.visible = false;
  const M = propMats();
  const club = new T.Group(); const hd = new T.Mesh(ironHead(), M.chrome || (M.chrome = std(0xe2e5e8, { roughness: 0.18, metalness: 1 }))); hd.castShadow = true;
  const gr = cyl(0.0125, M.grip || (M.grip = std(0x1c1d20, { roughness: 0.75 })), 18); club.add(shaftMesh(M.steel), gr, hd); S.add(club); const trail = speedTrail(); S.add(trail);
  const gclub = new T.Group(); const gm = ghost.real ? ghost.mats[0] : ghost.P.chest.material; gclub.add(cyl(0.007, gm), cyl(0.014, gm), new T.Mesh(ell(0.048, 0.016, 0.022, 12), gm)); gclub.children.forEach(c => { c.castShadow = false; }); S.add(gclub);
  const stick = cyl(0.01, M.stick); S.add(stick); stick.visible = false;      // a stick across the chest, or a club down the spine
  let ball = null; if (dr.ball) { const b = new T.Mesh(new T.SphereGeometry(0.021, 20, 14), M.white); b.castShadow = true; b.position.set(ballOf(dr)[0], 0.042, ballOf(dr)[2]); S.add(b); const t = cyl(0.006, M.white); t.position.set(ballOf(dr)[0], 0, ballOf(dr)[2]); t.scale.y = 0.022; S.add(t); ball = b; }
  const props = buildProps(S, dr);
  const cam = new T.PerspectiveCamera(30, 0.8, 0.1, 400);
  const sc = { S, fig, ghost, club, gclub, stick, ball, props, cam, key, trail };
  SCN.set(dr.id, sc); return sc;
}
// swap the simple figure for the realistic golfer as soon as he has loaded
function upgrade(sc) {
  const f = CCGolfer.make(false), g = CCGolfer.make(true); f.real = g.real = true;
  sc.S.remove(sc.fig.G); sc.S.remove(sc.ghost.G); sc.S.add(f.G); sc.S.add(g.G); g.G.visible = false; sc.fig = f; sc.ghost = g;
  const gm = g.mats[0]; sc.gclub.children.forEach(c => { c.material = gm; });
}
function poseClub(cg, club, J, flex) {
  if (!club) { cg.visible = false; return; } cg.visible = true;
  const [a, b0] = club, d0 = norm(sub(b0, a)), L = len(sub(b0, a));
  between(cg.children[0], a, b0); between(cg.children[1], a, add(a, mul(d0, 0.27)));
  // a bending shaft: the tip moves by flex and the head follows the tip's slope (the grip end stays stiff)
  const fl = flex && cg.children[0].userData.base ? flex : null; bendShaft(cg.children[0], fl, L);
  const b = fl ? add(b0, fl) : b0, d = fl ? norm(add(d0, mul(fl, 1.5 / (L * (1 - SHAFT_GRIP / L))))) : d0;
  const h = cg.children[2];
  if (h.geometry === IRON) {
    // hosel at the end of the shaft; the blade runs out toward the toe, square to the swing, sole down the shaft line
    const up = mul(d, -1), sw = J && J.sd ? norm(cross(d, cross([0, 1, 0], d))) : [0, 0, 1];
    let face = norm(sub(sw, mul(d, dot(sw, d)))); if (!isFinite(face[0])) face = [0, 0, 1];
    const toeD = norm(cross(up, face));
    const lie = 0.62, toeX = norm(add(mul(toeD, Math.cos(lie)), mul(d, Math.sin(lie))));
    const ux = toeX, uy = norm(sub(up, mul(ux, dot(up, ux)))), uz = norm(cross(ux, uy));
    h.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(v3(ux), v3(uy), v3(uz))); h.position.copy(v3(add(b, mul(d, -0.012))));
  } else { const side = norm(cross(d, [0, 1, 0])), toe = len(side) > 0.1 ? norm(add(mul(d, 0.35), side)) : d; h.position.copy(v3(add(b, mul(toe, 0.035)))); h.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), v3(toe)); }
  void L;
}

// ---------- the club in motion: a shaft that bends, and a blur of the clubhead when it moves fast ----------
// A real shaft bends in a set order (MacKenzie, St Francis Xavier University): toe-up and lagging as the downswing
// starts, then bowed forward and toe-down at impact as the head's weight, sitting off the shaft's line, is flung
// outward. Measured drivers bend 5-8 cm at the tip; irons less. Here the tip lags against the club's own acceleration across the
// shaft, and bows forward and toe-down with speed squared.
const SHAFT_GRIP = 0.27, FLEX_LAG = 1.8e-4, FLEX_SPEED = 2.0e-5, FLEX_MAX = 0.045;   // an iron bends less than a driver: ~3-4 cm
function shaftMesh(mat) {
  const g = new T.CylinderGeometry(0.0058, 0.0058, 1, 12, 16); g.translate(0, 0.5, 0);
  const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; m.userData.base = Float32Array.from(g.attributes.position.array); return m;
}
function bendShaft(m, flex, L) {
  const pa = m.geometry.attributes.position, base = m.userData.base; if (!base) return;
  if (!flex) { if (m.userData.bent) { pa.array.set(base); pa.needsUpdate = true; m.userData.bent = false; } return; }
  const q = m.quaternion.clone().invert(), dl = new T.Vector3(flex[0], flex[1], flex[2]).applyQuaternion(q), g0 = SHAFT_GRIP / L;
  for (let i = 0; i < pa.count; i++) {
    const y = base[i * 3 + 1], u = Math.max(0, (y - g0) / (1 - g0)), f = u * u * (3 - u) / 2;   // a cantilever loaded at its tip
    pa.array[i * 3] = base[i * 3] + dl.x * f; pa.array[i * 3 + 1] = y; pa.array[i * 3 + 2] = base[i * 3 + 2] + dl.z * f;
  }
  pa.needsUpdate = true; m.geometry.computeBoundingSphere(); m.userData.bent = true;
}
const TRAIL_N = 9, TRAIL_SPAN = 1 / 60;   // about one video frame of the clubhead's path, like a camera's shutter
function speedTrail() {
  const g = new T.BufferGeometry(), pos = new Float32Array(TRAIL_N * 2 * 3), al = new Float32Array(TRAIL_N * 2), idx = [];
  for (let k = 0; k < TRAIL_N - 1; k++) { const a = 2 * k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('al', new T.BufferAttribute(al, 1)); g.setIndex(idx);
  const m = new T.Mesh(g, new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { op: { value: 0 } },
    vertexShader: 'attribute float al; varying float vA; void main(){ vA = al; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float op; varying float vA; void main(){ gl_FragColor = vec4(0.86, 0.88, 0.9, op * vA); }' }));
  m.frustumCulled = false; m.visible = false; m.renderOrder = 2; return m;
}
// the club's flex and its blur for time t, from the club's motion around t (null when it is still or motion is reduced)
function clubFx(dr, t, J) {
  if (REDUCED || !J || !J.club) return null;
  const at = tt => { const j = jointsAt(dr, clamp(tt, 0, dr._dur - 1e-3)); return j && j.club ? j.club : null; };
  const h = 1 / 40, cm = at(t - h), cp = at(t + h);   // a wide step: the keyed motion is too coarse for a sharper acceleration
  if (!cm || !cp) return null;   // the club is put down or picked up within this step
  const b = J.club[1], d = norm(sub(b, J.club[0]));
  const v = mul(sub(cp[1], cm[1]), 1 / (2 * h)), acc = mul(add(sub(cp[1], mul(b, 2)), cm[1]), 1 / (h * h)), sp = len(v);
  const ap = sub(acc, mul(d, dot(acc, d)));
  const up = mul(d, -1), sw = norm(cross(d, cross([0, 1, 0], d))); let face = norm(sub(sw, mul(d, dot(sw, d)))); if (!isFinite(face[0])) face = [0, 0, 1];
  const toe = norm(cross(up, face)), vp = sub(v, mul(d, dot(v, d))), lead = len(vp) > 1e-6 ? norm(vp) : [0, 0, 0];
  let flex = add(mul(ap, -FLEX_LAG), mul(add(mul(toe, 0.6), mul(lead, 0.8)), FLEX_SPEED * sp * sp));
  const fm = len(flex); if (fm > FLEX_MAX) flex = mul(flex, FLEX_MAX / fm); if (!isFinite(flex[0]) || fm < 0.002) flex = null;
  let trail = null;
  if (sp > 12) {
    trail = { op: clamp((sp - 12) / 22, 0, 1) * 0.6, pts: [] };
    for (let k = 0; k < TRAIL_N; k++) { const c = k ? at(t - TRAIL_SPAN * k / (TRAIL_N - 1)) : J.club; if (!c) break; const dd = norm(sub(c[1], c[0])); trail.pts.push([c[1], sub(c[1], mul(dd, 0.3))]); }
    if (trail.pts.length < TRAIL_N) trail = null;
  }
  return { flex, trail };
}
function poseTrail(m, tr) {
  if (!m) return; if (!tr) { m.visible = false; return; }
  const pa = m.geometry.attributes.position, al = m.geometry.attributes.al;
  tr.pts.forEach((p, k) => { pa.array.set(p[0], k * 6); pa.array.set(p[1], k * 6 + 3); const w = 1 - k / (TRAIL_N - 1); al.array[2 * k] = w; al.array[2 * k + 1] = w * 0.35; });
  pa.needsUpdate = true; al.needsUpdate = true; m.material.uniforms.op.value = tr.op; m.visible = true;
}

// an iron's head: a blade with a sole, built along +x (toe) with the face toward +z
let IRON = null;
function ironHead() {
  if (IRON) return IRON;
  const sh = new T.Shape(); sh.moveTo(-0.012, 0); sh.lineTo(0.062, 0.004); sh.quadraticCurveTo(0.078, 0.008, 0.074, 0.03); sh.quadraticCurveTo(0.068, 0.05, 0.05, 0.052); sh.lineTo(-0.004, 0.036); sh.quadraticCurveTo(-0.014, 0.03, -0.012, 0);
  const g = new T.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, -0.006, -0.012); g.computeVertexNormals(); return (IRON = g);
}
// ---------- the 2D layer: labels, arrows, hand path, tick/cross ----------
function roundRect(x, X, Yy, w, h, r) { x.beginPath(); x.moveTo(X + r, Yy); x.arcTo(X + w, Yy, X + w, Yy + h, r); x.arcTo(X + w, Yy + h, X, Yy + h, r); x.arcTo(X, Yy + h, X, Yy, r); x.arcTo(X, Yy, X + w, Yy, r); x.closePath(); }
function toneCol(t) { return t === 'bad' ? C.bad : t === 'info' ? C.info : C.good; }
function at3(J, a, dr) {
  if (Array.isArray(a)) return a.map(v => propVal(dr, v));
  if (a === 'ball') return ballOf(dr);
  if (a === 'knees') return mul(add(J.lk, J.tk), 0.5);
  if (a === 'feet') return mul(add(J.la, J.ta), 0.5);
  if (a === 'shoulders') return mul(add(J.ls, J.ts), 0.5);
  if (a === 'shHead' || a === 'shBelt') { const j = startJ(dr)[a === 'shHead' ? 'head' : 'pel']; return [j[0] + 0.1 * j[1] / 4.4, 0.03, j[2] + 0.5 * j[1]]; }
  return J[a] || J.pel;
}
function overlay(x, W, Hh, proj, J, key, st, dr, dpr, path, GJ, cf, cpitch) {
  x.clearRect(0, 0, W, Hh);
  const fs = Math.round(13.5 * dpr), lw = 2.5 * dpr;
  // hand / clubhead path through this move
  if (path && path.length > 1) {
    const n = Math.max(2, Math.round(path.length * (st.inHold ? 1 : st.raw)));
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (let i = 1; i < n; i++) { const a = proj(path[i - 1]), b = proj(path[i]); x.strokeStyle = `rgba(255,214,10,${0.25 + 0.65 * i / n})`; x.lineWidth = 4 * dpr; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  }
  // arrows: which way to move
  const vis = (st.inHold || st.raw > 0.15) ? 1 : 0;
  for (const ar of key.arr || []) {
    if (!vis) break; const col = toneCol(ar.tone);
    let A, B;
    const JJ = ar.tone === 'bad' && GJ ? GJ : J;
    if (ar.dir) { A = at3(JJ, ar.at, dr); B = add(A, mul(norm(ar.dir), ar.len || 0.3)); if (ar.off) { A = add(A, ar.off); B = add(B, ar.off); } }
    else { A = at3(J, ar.a, dr); B = at3(J, ar.b, dr); }
    if (ar.rot) { // turning arrow around a body part: an arc in the horizontal plane
      const c = at3(J, ar.at, dr), r = ar.r || 0.28, a0 = ar.from || 200, a1 = ar.to || 330, pts = [];
      const fw = norm([cf[0], 0, cf[2]]), rh = norm(cross(fw, [0, 1, 0])), tilt = Math.max(0, 38 - cpitch) * D2R;
      const far = add(c, mul(fw, r)), tl = s => { const q = rotAxis(mul(fw, r), rh, s * tilt); return q[1]; }, sg = tl(1) > tl(-1) ? 1 : -1; void far;
      for (let k = 0; k <= 18; k++) { const an = (a0 + (a1 - a0) * k / 18) * D2R, v0 = [Math.cos(an) * r, 0, Math.sin(an) * r]; pts.push(proj(add(add(c, rotAxis(v0, rh, sg * tilt)), [0, ar.dy || 0, 0]))); }
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = lw + 3 * dpr; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke();
      x.strokeStyle = col; x.lineWidth = lw + 0.5 * dpr; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke();
      const p1 = pts[pts.length - 1], p0 = pts[pts.length - 3]; arrowHead(x, p0, p1, col, dpr); continue;
    }
    const a = proj(A), b = proj(B);
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = lw + 3 * dpr; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
    x.strokeStyle = col; x.lineWidth = lw + 0.5 * dpr; if (ar.dash) x.setLineDash([6 * dpr, 5 * dpr]); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); x.setLineDash([]);
    if (!ar.noHead) arrowHead(x, a, b, col, dpr);
  }
  // labels pinned to the body or equipment
  const placed = [];
  for (const lb of key.lab || []) {
    if (!vis) break;
    const p = proj(at3(lb.tone === 'bad' && GJ ? GJ : J, lb.at, dr)), col = toneCol(lb.tone);
    x.font = `600 ${fs}px "Instrument Sans",system-ui,-apple-system,sans-serif`;
    const lines = wrap(x, lb.text, W * 0.42), tw = Math.max(...lines.map(l => x.measureText(l).width)), ph = fs * 1.3 * lines.length + 10 * dpr, pw = tw + 20 * dpr;
    let side = lb.side || (p[0] > W * 0.55 ? 'l' : 'r');
    let lx = side === 'r' ? p[0] + 34 * dpr : p[0] - 34 * dpr - pw, ly = p[1] - ph / 2 + (lb.dy || 0) * dpr;
    lx = clamp(lx, 8 * dpr, W - pw - 8 * dpr); ly = clamp(ly, 8 * dpr, Hh - ph - 8 * dpr);
    for (const q of placed) if (lx < q[0] + q[2] && lx + pw > q[0] && ly < q[1] + q[3] && ly + ph > q[1]) ly = q[1] + q[3] + 6 * dpr;
    ly = clamp(ly, 8 * dpr, Hh - ph - 8 * dpr); placed.push([lx, ly, pw, ph]);
    // leader line and a dot on the spot
    const ex = side === 'r' ? lx : lx + pw, ey = clamp(p[1], ly + 6 * dpr, ly + ph - 6 * dpr);
    x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 4 * dpr; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(ex, ey); x.stroke();
    x.strokeStyle = col; x.lineWidth = 2 * dpr; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(ex, ey); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(p[0], p[1], 6 * dpr, 0, 7); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(p[0], p[1], 4 * dpr, 0, 7); x.fill();
    x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 8 * dpr; x.fillStyle = '#fff'; roundRect(x, lx, ly, pw, ph, 8 * dpr); x.fill(); x.shadowBlur = 0;
    x.fillStyle = col; roundRect(x, lx, ly, 5 * dpr, ph, 3 * dpr); x.fill();
    x.fillStyle = C.ink; x.textBaseline = 'top'; lines.forEach((l, i) => x.fillText(l, lx + 12 * dpr, ly + 5 * dpr + i * fs * 1.3));
  }
  // the big verdict for this moment
  if (key.badge && (st.inHold || st.raw > 0.6)) {
    const good = key.badge.tone !== 'bad', t = key.badge.text, bf = Math.round(17 * dpr);
    x.font = `700 ${bf}px "Instrument Sans",system-ui,sans-serif`; const tw = x.measureText(t).width, h = bf + 18 * dpr, w = tw + h + 16 * dpr, bx = 12 * dpr, by = 12 * dpr;
    x.shadowColor = 'rgba(0,0,0,.2)'; x.shadowBlur = 10 * dpr; x.fillStyle = good ? C.good : C.bad; roundRect(x, bx, by, w, h, h / 2); x.fill(); x.shadowBlur = 0;
    x.strokeStyle = '#fff'; x.lineWidth = 3 * dpr; x.lineCap = 'round'; x.beginPath(); const cx = bx + h / 2, cy = by + h / 2, r = h * 0.2;
    if (good) { x.moveTo(cx - r, cy); x.lineTo(cx - r * 0.25, cy + r * 0.75); x.lineTo(cx + r, cy - r * 0.7); } else { x.moveTo(cx - r, cy - r); x.lineTo(cx + r, cy + r); x.moveTo(cx + r, cy - r); x.lineTo(cx - r, cy + r); }
    x.stroke(); x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.fillText(t, bx + h, cy + 1);
  }
  // count or cue word, big and centred (tempo counts, "pause")
  if (key.say && (st.inHold || st.raw > 0.2)) { const bf = Math.round(30 * dpr); x.font = `700 ${bf}px "Instrument Sans",system-ui,sans-serif`; const tw = x.measureText(key.say).width, pw = tw + 32 * dpr, ph = bf + 20 * dpr, px = (W - pw) / 2, py = Hh - ph - 14 * dpr;
    x.fillStyle = 'rgba(16,32,26,.82)'; roundRect(x, px, py, pw, ph, ph / 2); x.fill(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(key.say, W / 2, py + ph / 2 + 1); x.textAlign = 'left'; }
}
function arrowHead(x, a, b, col, dpr) { const an = Math.atan2(b[1] - a[1], b[0] - a[0]), s = 13 * dpr; x.fillStyle = col; x.strokeStyle = '#fff'; x.lineWidth = 2 * dpr; x.beginPath(); x.moveTo(b[0] + Math.cos(an) * 3 * dpr, b[1] + Math.sin(an) * 3 * dpr); x.lineTo(b[0] - Math.cos(an - 0.45) * s, b[1] - Math.sin(an - 0.45) * s); x.lineTo(b[0] - Math.cos(an + 0.45) * s, b[1] - Math.sin(an + 0.45) * s); x.closePath(); x.stroke(); x.fill(); }
function wrap(x, t, maxW) { const w = String(t).split(' '), out = []; let cur = ''; for (const s of w) { const n = cur ? cur + ' ' + s : s; if (x.measureText(n).width > maxW && cur) { out.push(cur); cur = s; } else cur = n; } if (cur) out.push(cur); return out; }

// ---------- flat fallback (no WebGL) ----------
function flat(x, W, Hh, proj, J, dr) {
  const sky = x.createLinearGradient(0, 0, 0, Hh); sky.addColorStop(0, dr.scene === 'home' ? '#e7e2da' : '#d9e4e8'); sky.addColorStop(1, dr.scene === 'home' ? '#efe9e1' : '#eef1ee'); x.fillStyle = sky; x.fillRect(0, 0, W, Hh);
  const g0 = proj([0, 0, 0]); x.fillStyle = dr.scene === 'home' ? '#d6c3a5' : '#86b874'; x.fillRect(0, g0[1] - 30, W, Hh);
  const seg = (a, b, w, c) => { const A = proj(a), B = proj(b); x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.stroke(); };
  const k = Math.abs(proj([0, 1, 0])[1] - proj([0, 0, 0])[1]);
  seg(J.lhip, J.lk, 0.14 * k, '#2c3038'); seg(J.lk, J.la, 0.11 * k, '#2c3038'); seg(J.thip, J.tk, 0.14 * k, '#2c3038'); seg(J.tk, J.ta, 0.11 * k, '#2c3038');
  seg(J.pel, J.chest, 0.28 * k, '#2f6f9f'); seg(J.ls, J.ts, 0.12 * k, '#2f6f9f');
  seg(J.ls, J.le, 0.09 * k, '#2f6f9f'); seg(J.le, J.lh, 0.07 * k, '#e2ad88'); seg(J.ts, J.te, 0.09 * k, '#2f6f9f'); seg(J.te, J.th, 0.07 * k, '#e2ad88');
  const h = proj(J.head); x.fillStyle = '#e2ad88'; x.beginPath(); x.arc(h[0], h[1], 0.1 * k, 0, 7); x.fill();
  if (J.club) seg(J.club[0], J.club[1], Math.max(2, 0.02 * k), '#222');
}

// ---------- player ----------
function pathFor(dr, i) {
  // the clubhead (or hands) path from the previous key to this one
  const key = dr.seq[i]; if (!key.trail) return null;
  if (key._path && key._pathM === SWING) return key._path;
  const tl = dr._tl[i], pts = [];
  for (let k = 0; k <= 30; k++) { const J = jointsAt(dr, tl.s + (tl.e - tl.s) * k / 30 - (k === 30 ? 1e-6 : 0)); pts.push(key.trail === 'hands' ? J.hands : J.clubhead); }
  key._pathM = SWING; return (key._path = pts);
}
// Left-handed golfers see every demo mirrored: the whole world flips across the target line's normal,
// the camera with it, and labels are projected from the mirrored points so text still reads normally.
let MIR = false;
const mx = p => MIR ? [-p[0], p[1], p[2]] : p;
function setMirror(on) { MIR = !!on; }
// The 3D picture's resolution adapts to the phone: if frames take too long it renders a little smaller
// (labels and lines stay sharp on their own layer). Shared by all drills for this visit.
const QUAL = { s: 1, min: 0.7 };
// remembered on this phone until the app updates, so the first drill of a visit starts at the right size
try { const q = JSON.parse(localStorage.getItem('cc_q3d') || 'null'); if (q && q.v === root.CC_VER && q.s >= QUAL.min && q.s <= 1) QUAL.s = q.s; } catch (e) { }
function saveQual() { try { localStorage.setItem('cc_q3d', JSON.stringify({ s: QUAL.s, v: root.CC_VER })); } catch (e) { } }
function slowFrames(dts) { const d = dts.slice().sort((a, b) => a - b); return d[d.length >> 1] > 24; }
// ---------- life: a real person is never perfectly still ----------
// While the demo holds a position (or moves slowly) the golfer breathes, his weight drifts a little between his feet,
// his head settles and the club head hovers. Feet stay planted; knees take half the drift. Fades out as he swings.
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const LIFE_POS_SKIP = { la: 1, ta: 1, lt: 1, tt: 1 }, LIFE_KNEE = { lk: 1, tk: 1 }, LIFE_UPPER = { chest: 1, neck: 1, head: 1, ls: 1, ts: 1, le: 0.5, te: 0.5 };
function lifeAt(J, t, w) {
  if (!J || w <= 0.001) return J;
  const n = (a, b, c) => Math.sin(t * a + c) * 0.6 + Math.sin(t * b + c * 1.7) * 0.4;
  const sway = [0.007 * n(1.31, 2.17, 0.4) * w, 0, 0.004 * n(0.97, 1.83, 2.1) * w];
  const br = 0.0035 * Math.sin(t * 2 * Math.PI / 3.9) * w;          // one breath every ~4 s
  const o = {};
  for (const k in J) {
    const v = J[k];
    if (MOTION_VEC[k] || LIFE_POS_SKIP[k]) { o[k] = v; continue; }
    const kk = LIFE_KNEE[k] ? 0.5 : 1, up = (LIFE_UPPER[k] || 0) * br;
    if (isV(v)) o[k] = [v[0] + sway[0] * kk, v[1] + up, v[2] + sway[2] * kk];
    else if (isPair(v)) o[k] = [add(v[0], sway), add(v[1], sway)];
    else o[k] = v;
  }
  // the head settles: a slow look a degree or two either way
  if (isV(J.face)) { const a = 0.025 * n(0.61, 1.13, 1.0) * w, c = Math.cos(a), sn = Math.sin(a), f = J.face; o.face = [f[0] * c + f[2] * sn, f[1], -f[0] * sn + f[2] * c]; }
  return o;
}
function Player(wrap, dr, opt) {
  opt = opt || {}; prep(dr);
  const gl = webgl();
  const box3 = document.createElement('div'); box3.className = 'dsStage';
  const ov = document.createElement('canvas'); ov.className = 'dsOverlay'; ov.setAttribute('aria-hidden', 'true');
  let cv; if (gl) { cv = R.domElement; cv.className = 'dsGl'; } else { cv = document.createElement('canvas'); cv.className = 'dsGl'; }
  box3.appendChild(cv); box3.appendChild(ov); wrap.innerHTML = ''; wrap.appendChild(box3);
  const sc = gl ? scene(dr) : null;
  const st = { t: stepStart(dr, opt.step || 0), playing: !opt.paused, speed: 1, view: 'auto', last: performance.now(), step: -1, raf: 0, cam: null, dead: false, still: false, dirty: true };
  let W = 0, H = 0, dpr = 1;
  function size() { const r = box3.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr));
    if (gl) { R.setPixelRatio(1); R.setSize(gw(), gh(), false); sc.cam.aspect = W / H; sc.cam.updateProjectionMatrix(); } else { cv.width = W; cv.height = H; } ov.width = W; ov.height = H; }
  const gw = () => Math.max(2, Math.round(W * QUAL.s)), gh = () => Math.max(2, Math.round(H * QUAL.s));
  const dts = []; let warm = 10;
  function viewFor(key) { return st.view === 'auto' ? (key.cam || dr.view || 'face') : st.view; }
  function frame(now) {
    if (st.dead) return;
    const ms = now - st.last, dt = Math.min(0.1, ms / 1000); st.last = now;
    if (gl && st.playing && !document.hidden && ms < 1000 && warm-- <= 0) { dts.push(ms); if (dts.length >= 30) { if (slowFrames(dts) && QUAL.s > QUAL.min) { QUAL.s = Math.max(QUAL.min, QUAL.s * 0.85); size(); saveQual(); } dts.length = 0; } }
    if (st.playing) { st.t += dt * st.speed; st.lt = (st.lt || 0) + dt * st.speed; if (st.t >= dr._dur) st.t = 0; }
    // paused with the camera settled: the picture can't change, so don't redraw it (saves the battery and keeps the phone cool)
    if (gl && !sc.fig.real && typeof CCGolfer !== 'undefined' && CCGolfer.ready()) st.dirty = true;
    if (st.gen !== STATS.shared) { st.gen = STATS.shared; st.dirty = true; }   // a card picture borrowed the shared canvas
    if (st.playing || st.dirty || !st.still) { st.dirty = false; draw(); }
    st.raf = requestAnimationFrame(frame);
  }
  const _sz = gl ? new T.Vector2() : null;
  function draw() {
    if (!W) size();
    // the card pictures share this renderer and may have shrunk it: put it back to the player's size
    if (gl) { R.getSize(_sz); if (_sz.x !== gw() || _sz.y !== gh() || R.getPixelRatio() !== 1) { R.setPixelRatio(1); R.setSize(gw(), gh(), false); } if (Math.abs(sc.cam.aspect - W / H) > 1e-3) { sc.cam.aspect = W / H; sc.cam.updateProjectionMatrix(); } }
    const s = sampleAt(dr, st.t), key = s.key;
    // how much "life" to add: full when the hands are near still, none mid-swing (measured, so it fades smoothly)
    let J = jointsAt(dr, st.t);
    if (!REDUCED && J && J.lh) { const J2 = jointsAt(dr, Math.min(dr._dur - 1e-3, st.t + 0.05)), sp = J2 && J2.lh ? len(sub(J2.lh, J.lh)) / 0.05 : 0;
      const want = clamp(1 - sp / 0.35, 0, 1); st.life = st.life == null ? want : st.life + (want - st.life) * 0.15;
      J = lifeAt(J, st.lt || 0, st.life); }
    if (key.step !== st.step) { st.step = key.step; opt.onStep && opt.onStep(key.step); }
    // camera: ease toward this key's view
    const want = camState(viewFor(key), key.camo || dr.camo);
    if (!st.cam) st.cam = want; else st.cam = camMix(st.cam, want, 0.08);
    st.still = Object.keys(want).every(k => typeof want[k] !== 'number' || Math.abs(k === 'yaw' ? ((want.yaw - st.cam.yaw) % 360 + 540) % 360 - 180 : want[k] - st.cam[k]) < 1e-3);
    const cp = camPos(st.cam);
    let proj;
    if (gl) {
      const P0 = mx(cp.pos), T0 = mx(cp.tg); sc.S.scale.x = MIR ? -1 : 1; sc.S.updateMatrixWorld();
      sc.cam.position.set(P0[0], P0[1], P0[2]); sc.cam.lookAt(T0[0], T0[1], T0[2]); sc.cam.updateMatrixWorld();
      if (!sc.fig.real && typeof CCGolfer !== 'undefined' && CCGolfer.ready()) upgrade(sc); poseAny(sc.fig, J); if (sc.fig.real && sc.fig.elbows) { J.le = sc.fig.elbows.L; J.te = sc.fig.elbows.R; } setTone(sc.fig, key.hl, st.t);
      const noClub = dr.noclub || s.p.noclub, fx = noClub ? null : clubFx(dr, st.t, J);
      poseClub(sc.club, noClub ? null : J.club, J, fx && fx.flex); poseTrail(sc.trail, fx && fx.trail);
      // the red "not this" ghost
      const gw = key.G ? (s.inHold ? 1 : s.raw) : 0;
      sc.ghost.G.visible = gw > 0.05; sc.gclub.visible = false;
      if (gw > 0.05) { const GJ = ghostAt(dr, s.i); poseAny(sc.ghost, GJ); ghostOpacity(sc.ghost, 0.3 * gw); if (GJ.club) { poseClub(sc.gclub, GJ.club, GJ); sc.gclub.visible = true; } }
      const across = J.stickAcross || J.spineClub; sc.stick.visible = !!across; if (across) between(sc.stick, across[0], across[1]);
      if (sc.ball) { const hit = key.hit && (s.inHold || s.raw > 0.5); sc.ball.visible = !hit && !(dr.seq.slice(0, s.i).some(k => k.hit) && !key.reset); }
      updateProps(sc.props, J, key, dr, s);
      faceTrees(sc); R.render(sc.S, sc.cam); STATS.renders++;
      const v = new T.Vector3(); proj = p => { const q = mx(p); v.set(q[0], q[1], q[2]).project(sc.cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; };
    } else {
      const yaw = st.cam.yaw * D2R, Rr = [Math.cos(yaw), 0, -Math.sin(yaw)], k = H * 0.42;
      proj = p => { const q = MIR ? [-p[0], p[1], p[2]] : p, d = dot(sub(p, [st.cam.tx, 0, st.cam.tz]), Rr) * k; return [MIR ? W / 2 - d : W / 2 + d, H * 0.9 - q[1] * k, 0]; };
      flat(cv.getContext('2d'), W, H, proj, J, dr);
    }
    overlay(ov.getContext('2d'), W, H, proj, J, key, s, dr, dpr, pathFor(dr, s.i), key.G ? ghostAt(dr, s.i) : null, norm(sub(cp.tg, cp.pos)), st.cam.pitch);
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { size(); draw(); }) : null; if (ro) ro.observe(box3);
  size(); st.raf = requestAnimationFrame(frame);
  return {
    get playing() { return st.playing; }, get step() { return st.step; }, get view() { return st.view; },
    play() { st.playing = true; st.last = performance.now(); }, pause() { st.playing = false; st.dirty = true; },
    toggle() { st.playing ? this.pause() : this.play(); return st.playing; },
    goStep(i) { st.t = stepStart(dr, clamp(i, 0, dr.steps.length - 1)); st.step = -1; draw(); },
    next() { this.goStep(st.step + 1 >= dr.steps.length ? 0 : st.step + 1); }, prev() { this.goStep(Math.max(0, st.step - 1)); },
    setSpeed(s) { st.speed = s; }, setView(v) { st.view = v; st.dirty = true; },
    seek(t) { st.t = t; st.cam = null; draw(); }, get dur() { return dr._dur; },
    keyTimes() { return dr._tl.map(k => k.e + Math.min(0.4, (k.h - k.e) * 0.6)); },
    destroy() { st.dead = true; cancelAnimationFrame(st.raf); if (ro) ro.disconnect(); if (gl && cv.parentNode) cv.parentNode.removeChild(cv); },
  };
}
// a still picture of the drill's key moment, for the library cards
const POSTERS = new Map();
function poster(dr, w, h, warm) {   // warm: also draw the red ghost, so its shaders are ready before a drill plays
  prep(dr); const keyI = dr.poster != null ? dr.poster : Math.min(dr.seq.length - 1, 2), k = dr._tl[keyI].e + 0.01, id = dr.id + ':' + w + 'x' + h + (MIR ? ':L' : '');
  if (POSTERS.has(id) && (POSTERS.get(id + ':real') || typeof CCGolfer === 'undefined' || !CCGolfer.ready())) return POSTERS.get(id);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const s = sampleAt(dr, k), J = jointsAt(dr, k), key = s.key;
  const cp = camPos(camState(key.cam || dr.view || 'face', key.camo || dr.camo));
  if (webgl()) {
    const sc = scene(dr); R.setPixelRatio(1); R.setSize(w, h, false); sc.cam.aspect = w / h; sc.cam.updateProjectionMatrix();
    const P0 = mx(cp.pos), T0 = mx(cp.tg); sc.S.scale.x = MIR ? -1 : 1; sc.S.updateMatrixWorld();
    sc.cam.position.set(P0[0], P0[1], P0[2]); sc.cam.lookAt(T0[0], T0[1], T0[2]); sc.cam.updateMatrixWorld();
    if (!sc.fig.real && typeof CCGolfer !== 'undefined' && CCGolfer.ready()) upgrade(sc); poseAny(sc.fig, J); setTone(sc.fig, [], 0); poseClub(sc.club, (dr.noclub || s.p.noclub) ? null : J.club, J); poseTrail(sc.trail, null); sc.ghost.G.visible = false; sc.gclub.visible = false;
    if (warm) { poseAny(sc.ghost, J); ghostOpacity(sc.ghost, 0.3); poseClub(sc.gclub, J.club, J); sc.ghost.G.visible = !!J; sc.gclub.visible = !!J.club; }
    const across = J.stickAcross || J.spineClub; sc.stick.visible = !!across; if (across) between(sc.stick, across[0], across[1]);
    if (sc.ball) sc.ball.visible = true; updateProps(sc.props, J, {}, dr, s);
    faceTrees(sc); R.render(sc.S, sc.cam); STATS.shared++; if (warm) { sc.ghost.G.visible = false; sc.gclub.visible = false; } const x = c.getContext('2d'); x.drawImage(R.domElement, 0, 0, w, h);
  } else { const x = c.getContext('2d'), yaw = (VIEWS[dr.view] || VIEWS.face).yaw * D2R, Rr = [Math.cos(yaw), 0, -Math.sin(yaw)], kk = h * 0.42; flat(x, w, h, p => [w / 2 + (MIR ? -1 : 1) * dot(p, Rr) * kk, h * 0.9 - p[1] * kk, 0], J, dr); }
  const url = c.toDataURL('image/jpeg', 0.86); POSTERS.set(id, url); if (typeof CCGolfer !== 'undefined' && CCGolfer.ready()) POSTERS.set(id + ':real', true); return url;
}
function stats() { return { scenes: SCN.size, renders: STATS.renders, scale: QUAL.s, programs: R && R.info.programs ? R.info.programs.length : 0 }; }
const api = { _raw: (dr, t) => jointsAt0(dr, t), _ghostRaw: (dr, i) => ghostAt0(dr, i), _standTall: J => standTall(J), prepTextures, stats, slowFrames, QUAL, Player, poster, rig, pose, prep, sampleAt, webgl, VIEW_NAME, POSES, setMirror, setSwing, loadSwing, hasSwing, jointsAt, ghostAt, _clubFx: clubFx, ballOf, propPoint };
root.DrillStudio = api;
})(this);
