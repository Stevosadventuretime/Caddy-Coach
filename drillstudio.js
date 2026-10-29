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
function keyJoints(dr, i) { return usesCapture(dr) ? poseOf(dr, keyInfo(dr, i)) : rig(dr.seq[i].P); }
function startJ(dr) { prep(dr); return keyJoints(dr, 0); }
function jointsAt(dr, t) {
  prep(dr); const s = sampleAt(dr, t);
  if (!usesCapture(dr)) return rig(s.p);
  const n = dr.seq.length, i = s.i, pi = (i - 1 + n) % n, B = keyInfo(dr, i), A = keyInfo(dr, pi);
  if (s.u >= 1 || s.inHold || (i === 0 && s.raw >= 1)) return poseOf(dr, B);
  if (A.f == null && B.f == null) return shiftJ(rig(s.p), rigShift());
  // play the capture forward between the two positions; a move from the backswing straight to a point part-way
  // through the downswing (e.g. address -> impact) isn't a real swing, so that blends instead
  const top = SWING.phases.top, fin = SWING.phases.finish;
  if (A.f != null && B.f != null && B.f > A.f && !(A.f < top && B.f > top && B.f < fin))
    return compose(A.f + (B.f - A.f) * s.raw, lerpDelta(deltaOf(A), deltaOf(B), s.u));
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
// the red "not this" pose for key i: the golfer's own pose with the fault added
function ghostAt(dr, i) {
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
let TX = null, TX_STRIPES = null;
function textures() {
  if (TX) return TX;
  const mkC = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
  const grass = mkC(1024, 1024, (x, w, h) => {
    x.fillStyle = '#5f9a47'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const l = Math.random(); x.fillStyle = `rgba(${40 + l * 50},${90 + l * 70},${25 + l * 30},${0.05 + Math.random() * 0.06})`; const s = 6 + Math.random() * 30; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, s, 0, 7); x.fill(); }
    for (let i = 0; i < 60000; i++) { const g = 70 + Math.random() * 90; x.fillStyle = `rgba(${g * 0.5},${g * 1.1},${g * 0.38},${0.12 + Math.random() * 0.18})`; x.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3); } });
  grass.wrapS = grass.wrapT = T.RepeatWrapping; grass.repeat.set(10, 10);
  const stripes = mkC(512, 512, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#e8f0e0' : '#c9d6c0'; x.fillRect(i * w / 8, 0, w / 8, h); } });
  stripes.wrapS = stripes.wrapT = T.RepeatWrapping; stripes.repeat.set(5, 1); TX_STRIPES = stripes;
  const wood = mkC(1024, 1024, (x, w, h) => {
    for (let i = 0; i < 24; i++) { const l = 205 + (i * 37 % 23) - 10; x.fillStyle = `rgb(${l},${l * 0.88 | 0},${l * 0.74 | 0})`; x.fillRect(0, i * h / 24, w, h / 24 - 2); x.fillStyle = 'rgba(90,60,30,.25)'; x.fillRect(0, (i + 1) * h / 24 - 2, w, 2); }
    for (let i = 0; i < 400; i++) { x.strokeStyle = 'rgba(120,80,40,.06)'; x.beginPath(); const y = Math.random() * h; x.moveTo(0, y); x.bezierCurveTo(w / 3, y + 6, w * 2 / 3, y - 6, w, y + 2); x.stroke(); }
    const r = x.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.5); r.addColorStop(0, 'rgba(236,232,226,0)'); r.addColorStop(1, 'rgba(236,232,226,1)'); x.fillStyle = r; x.fillRect(0, 0, w, h); });
  const sky = mkC(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fb6dc'); g.addColorStop(0.55, '#d5e4ee'); g.addColorStop(1, '#eef2ef'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const home = mkC(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e7e2da'); g.addColorStop(0.62, '#f1ede7'); g.addColorStop(1, '#ece8e2'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  return (TX = { grass, wood, sky, home });
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
// a quiet living room: warm wall, a bright window, skirting board and a sofa
function roomBack() {
  if (!ROOM) {
    const W = 4096, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
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
    const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; tx.anisotropy = 4;
    const geo = new T.CylinderGeometry(7, 7, 3.2, 96, 1, true); geo.translate(0, 1.6, 0);
    ROOM = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tx, side: T.BackSide, fog: false }));
  }
  return ROOM.clone();
}
// a painted, hazy tree line all the way round, like the edge of a fairway on a summer morning
function treeLine() {
  if (!BACK) {
    const W = 4096, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sky = x.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#9fc0de'); sky.addColorStop(0.7, '#dbe7ee'); sky.addColorStop(1, '#e6eee9'); x.fillStyle = sky; x.fillRect(0, 0, W, H);
    // rows of trees: far rows paler and bluer, near rows darker and more detailed
    const rows = [{ y: 0.80, h: 0.22, col: [150, 172, 168], n: 140, r: [10, 22] }, { y: 0.84, h: 0.30, col: [112, 140, 118], n: 120, r: [14, 30] }, { y: 0.88, h: 0.40, col: [72, 104, 70], n: 100, r: [18, 40] }, { y: 0.92, h: 0.46, col: [52, 82, 50], n: 80, r: [22, 48] }];
    for (const R of rows) {
      for (let i = 0; i < R.n; i++) {
        const cx = rnd() * W, base = H * R.y, th = H * R.h * (0.6 + rnd() * 0.5), r0 = R.r[0] + rnd() * (R.r[1] - R.r[0]);
        const conifer = rnd() < 0.25;
        for (let k = 0; k < 140; k++) {
          const t = rnd(), yy = base - th * (0.25 + t * 0.75), w = conifer ? r0 * (1.1 - t) : r0 * (0.6 + 0.6 * Math.sin(t * Math.PI));
          const xx = cx + (rnd() - 0.5) * w * 1.7, rr = w * (0.10 + rnd() * 0.16);
          const l = (0.78 + rnd() * 0.32) * (1.08 - 0.25 * (yy - (base - th)) / th * 0); x.fillStyle = `rgb(${R.col[0] * l | 0},${R.col[1] * l | 0},${R.col[2] * l | 0})`;
          x.beginPath(); x.arc(xx, yy, rr, 0, 7); x.fill();
        }
        x.fillStyle = `rgb(${R.col[0] * 0.7 | 0},${R.col[1] * 0.65 | 0},${R.col[2] * 0.6 | 0})`; x.fillRect(cx - 2, base - th * 0.3, 4, th * 0.3);
      }
      // haze over each row so distance reads
      x.fillStyle = 'rgba(214,228,234,0.18)'; x.fillRect(0, 0, W, H * R.y + 4);
    }
    const g = x.createLinearGradient(0, H * 0.9, 0, H); g.addColorStop(0, 'rgba(96,140,70,0)'); g.addColorStop(1, 'rgba(96,140,70,1)'); x.fillStyle = g; x.fillRect(0, H * 0.9, W, H * 0.1);
    // soft focus, as a camera focused on the golfer would see it
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const x2 = c2.getContext('2d'); x2.filter = 'blur(2.5px)'; x2.drawImage(c, 0, 0);
    if (!x2.filter || x2.filter === 'none') x2.drawImage(c, 0, 0);
    const tx = new T.CanvasTexture(c2); tx.encoding = T.sRGBEncoding; tx.wrapS = T.RepeatWrapping; tx.anisotropy = 4;
    const geo = new T.CylinderGeometry(46, 46, 22, 96, 1, true); geo.translate(0, 9, 0);
    BACK = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tx, side: T.BackSide, fog: false, depthWrite: false }));
    BACK.renderOrder = -1;
  }
  return BACK.clone();
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
  if (home) { ground = new T.Mesh(new T.PlaneGeometry(14, 14), new T.MeshStandardMaterial({ map: groundTex, roughness: 0.6 })); S.add(roomBack()); }
  else {
    S.fog = new T.Fog(new T.Color(0xd9e5ec).convertSRGBToLinear(), 20, 60);
    // grass is fully rough, so simple diffuse lighting looks the same as the full PBR model at a fraction of the cost (it fills most of the screen)
    const gm = new T.MeshLambertMaterial({ map: groundTex, emissiveMap: groundTex, emissive: new T.Color(GFILL[0], GFILL[1], GFILL[2]), color: new T.Color(GKEY, GKEY, GKEY) });   // emissive stands in for the sky's fill light
    gm.onBeforeCompile = sh => { sh.uniforms.stripes = { value: TX_STRIPES }; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D stripes;').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(0.86, 1.0, texture2D(stripes, vUv * vec2(0.5, 0.1)).r);'); };
    ground = new T.Mesh(new T.PlaneGeometry(120, 120), gm); S.add(treeLine());
  }
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
  if (!home) {
    if (!TX.turf) { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#3f7a4a'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 40000; i++) { const l = 50 + Math.random() * 60; x.fillStyle = `rgba(${l * 0.6 | 0},${l * 1.45 | 0},${l * 0.75 | 0},0.35)`; x.fillRect(Math.random() * 512, Math.random() * 512, 1, 2); }
      x.strokeStyle = 'rgba(20,40,25,.5)'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 502); TX.turf = new T.CanvasTexture(c); TX.turf.encoding = T.sRGBEncoding; TX.turf.anisotropy = 4; }
    const mat = new T.Mesh(new T.BoxGeometry(1.5, 0.014, 1.5), new T.MeshStandardMaterial({ map: TX.turf, roughness: 0.95 })); mat.position.set(0.05, 0.007, 0.3); mat.receiveShadow = true; S.add(mat); }
  if (home && dr.rug !== false) { const rug = new T.Mesh(new T.CircleGeometry(1.1, 48), std(0x5d6a62, { roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.004, 0.15); rug.receiveShadow = true; S.add(rug); }
  // target line: a dashed line on the ground toward the target, so every view shows which way the ball goes
  const tg = new T.Group(); for (let i = 0; i < 8; i++) { const d = box(0.16, 0.003, 0.018, std(0xffffff, { roughness: 0.8 }), [0.55 + i * 0.26, 0.004, ballOf(dr)[2]]); d.castShadow = false; tg.add(d); }
  const arr = new T.Mesh(new T.ConeGeometry(0.05, 0.14, 3), std(0xffffff)); arr.rotation.z = -Math.PI / 2; arr.position.set(2.75, 0.01, ballOf(dr)[2]); arr.scale.set(1, 1, 0.15); tg.add(arr); S.add(tg);
  const real = typeof CCGolfer !== 'undefined' && CCGolfer.ready();
  const fig = real ? CCGolfer.make(false) : figure(false), ghost = real ? CCGolfer.make(true) : figure(true); fig.real = real; ghost.real = real; S.add(fig.G); S.add(ghost.G); ghost.G.visible = false;
  const M = propMats();
  const club = new T.Group(); const hd = new T.Mesh(ironHead(), M.chrome || (M.chrome = std(0xe2e5e8, { roughness: 0.18, metalness: 1 }))); hd.castShadow = true;
  const gr = cyl(0.0125, M.grip || (M.grip = std(0x1c1d20, { roughness: 0.75 })), 18); club.add(cyl(0.0058, M.steel, 12), gr, hd); S.add(club);
  const gclub = new T.Group(); const gm = ghost.real ? ghost.mats[0] : ghost.P.chest.material; gclub.add(cyl(0.007, gm), cyl(0.014, gm), new T.Mesh(ell(0.048, 0.016, 0.022, 12), gm)); gclub.children.forEach(c => { c.castShadow = false; }); S.add(gclub);
  const stick = cyl(0.01, M.stick); S.add(stick); stick.visible = false;      // a stick across the chest, or a club down the spine
  let ball = null; if (dr.ball) { const b = new T.Mesh(new T.SphereGeometry(0.021, 20, 14), M.white); b.castShadow = true; b.position.set(ballOf(dr)[0], 0.042, ballOf(dr)[2]); S.add(b); const t = cyl(0.006, M.white); t.position.set(ballOf(dr)[0], 0, ballOf(dr)[2]); t.scale.y = 0.022; S.add(t); ball = b; }
  const props = buildProps(S, dr);
  const cam = new T.PerspectiveCamera(30, 0.8, 0.1, 60);
  const sc = { S, fig, ghost, club, gclub, stick, ball, props, cam, key };
  SCN.set(dr.id, sc); return sc;
}
// swap the simple figure for the realistic golfer as soon as he has loaded
function upgrade(sc) {
  const f = CCGolfer.make(false), g = CCGolfer.make(true); f.real = g.real = true;
  sc.S.remove(sc.fig.G); sc.S.remove(sc.ghost.G); sc.S.add(f.G); sc.S.add(g.G); g.G.visible = false; sc.fig = f; sc.ghost = g;
  const gm = g.mats[0]; sc.gclub.children.forEach(c => { c.material = gm; });
}
function poseClub(cg, club, J) {
  if (!club) { cg.visible = false; return; } cg.visible = true;
  const [a, b] = club, d = norm(sub(b, a)), L = len(sub(b, a));
  between(cg.children[0], a, b); between(cg.children[1], a, add(a, mul(d, 0.27)));
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
    if (st.playing) { st.t += dt * st.speed; if (st.t >= dr._dur) st.t = 0; }
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
    const s = sampleAt(dr, st.t), J = jointsAt(dr, st.t), key = s.key;
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
      poseClub(sc.club, (dr.noclub || s.p.noclub) ? null : J.club, J);
      // the red "not this" ghost
      const gw = key.G ? (s.inHold ? 1 : s.raw) : 0;
      sc.ghost.G.visible = gw > 0.05; sc.gclub.visible = false;
      if (gw > 0.05) { const GJ = ghostAt(dr, s.i); poseAny(sc.ghost, GJ); ghostOpacity(sc.ghost, 0.3 * gw); if (GJ.club) { poseClub(sc.gclub, GJ.club, GJ); sc.gclub.visible = true; } }
      const across = J.stickAcross || J.spineClub; sc.stick.visible = !!across; if (across) between(sc.stick, across[0], across[1]);
      if (sc.ball) { const hit = key.hit && (s.inHold || s.raw > 0.5); sc.ball.visible = !hit && !(dr.seq.slice(0, s.i).some(k => k.hit) && !key.reset); }
      updateProps(sc.props, J, key, dr, s);
      R.render(sc.S, sc.cam); STATS.renders++;
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
    if (!sc.fig.real && typeof CCGolfer !== 'undefined' && CCGolfer.ready()) upgrade(sc); poseAny(sc.fig, J); setTone(sc.fig, [], 0); poseClub(sc.club, (dr.noclub || s.p.noclub) ? null : J.club, J); sc.ghost.G.visible = false; sc.gclub.visible = false;
    if (warm) { poseAny(sc.ghost, J); ghostOpacity(sc.ghost, 0.3); poseClub(sc.gclub, J.club, J); sc.ghost.G.visible = !!J; sc.gclub.visible = !!J.club; }
    const across = J.stickAcross || J.spineClub; sc.stick.visible = !!across; if (across) between(sc.stick, across[0], across[1]);
    if (sc.ball) sc.ball.visible = true; updateProps(sc.props, J, {}, dr, s);
    R.render(sc.S, sc.cam); STATS.shared++; if (warm) { sc.ghost.G.visible = false; sc.gclub.visible = false; } const x = c.getContext('2d'); x.drawImage(R.domElement, 0, 0, w, h);
  } else { const x = c.getContext('2d'), yaw = (VIEWS[dr.view] || VIEWS.face).yaw * D2R, Rr = [Math.cos(yaw), 0, -Math.sin(yaw)], kk = h * 0.42; flat(x, w, h, p => [w / 2 + (MIR ? -1 : 1) * dot(p, Rr) * kk, h * 0.9 - p[1] * kk, 0], J, dr); }
  const url = c.toDataURL('image/jpeg', 0.86); POSTERS.set(id, url); if (typeof CCGolfer !== 'undefined' && CCGolfer.ready()) POSTERS.set(id + ':real', true); return url;
}
function stats() { return { scenes: SCN.size, renders: STATS.renders, scale: QUAL.s, programs: R && R.info.programs ? R.info.programs.length : 0 }; }
const api = { stats, slowFrames, QUAL, Player, poster, rig, pose, prep, sampleAt, webgl, VIEW_NAME, POSES, setMirror, setSwing, loadSwing, hasSwing, jointsAt, ghostAt, ballOf, propPoint };
root.DrillStudio = api;
})(this);
