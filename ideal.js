// "Better position" skeleton: the golfer's own pose, corrected only where the analysis found a fault.
// frames: [{t, pts:[{x,y}]}] (sorted), R: result of SwingMetrics.analyse
(function (root) {
'use strict';
const HEAD = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const UPPER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const mid = (p, a, b) => ({ x: (p[a].x + p[b].x) / 2, y: (p[a].y + p[b].y) / 2 });
const tiltOf = p => { const h = mid(p, 23, 24), s = mid(p, 11, 12); return Math.atan2(s.x - h.x, h.y - s.y); };
const ramp = (t, a, b) => t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);
function rotateAbout(P, idx, c, d) {
  for (const i of idx) { const dx = P[i].x - c.x, dy = c.y - P[i].y, r = Math.hypot(dx, dy), th = Math.atan2(dx, dy) + d; P[i] = { x: c.x + r * Math.sin(th), y: c.y - r * Math.cos(th) }; }
}
function shift(P, idx, dx, dy) { for (const i of idx) P[i] = { x: P[i].x + dx, y: P[i].y + dy }; }

function build(frames, R) {
  const m = R.metrics, s = R.scores, T = R.times, view = m.view, right = m.handed === 'right';
  const near = t => frames.reduce((a, f) => Math.abs(f.t - t) < Math.abs(a.t - t) ? f : a, frames[0]);
  const A = near(T.address).pts, an = p => mid(p, 27, 28);
  const T0 = Math.hypot(mid(A, 11, 12).x - mid(A, 23, 24).x, mid(A, 11, 12).y - mid(A, 23, 24).y);
  const tiltA = tiltOf(A), headA = { x: A[0].x - an(A).x, y: A[0].y - an(A).y }, hipA = mid(A, 23, 24).x - an(A).x;
  const lead = right ? [11, 13, 15, 17, 19, 21] : [12, 14, 16, 18, 20, 22];
  const fix = {
    setup: view !== 'face-on' && s['Setup posture'] != null && s['Setup posture'] < 9 && Math.abs(m.spine_address_deg - 30) > 5,
    spine: view !== 'face-on' && s['Spine angle'] != null && s['Spine angle'] < 8,
    hips: (view !== 'face-on' ? (m.hips_toward_ball_impact || 0) > 0.04 : Math.max(m.hip_slide_impact || 0, m.hip_sway_top || 0) > 0.1),
    head: s['Head stability'] != null && s['Head stability'] < 8,
    arm: m.lead_arm_top_deg != null && m.lead_arm_top_deg < 160,
    hands: m.hands_height_top != null && m.hands_height_top < 1.0,
    finish: m.finish_hands_height != null && m.finish_hands_height < 1.0,
  };
  const setupTarget = 30 * Math.PI / 180;
  const ideal = frames.map(f => {
    const t = f.t, P = f.pts.map(p => ({ x: p.x, y: p.y }));
    const wSwing = ramp(t, T.takeaway - 0.05, T.takeaway + 0.12) * (1 - ramp(t, T.impact + 0.1, T.impact + 0.4));
    const wAddr = 1 - ramp(t, T.takeaway, T.takeaway + 0.2);
    const wTop = bump(t, T.top, 0.22), wFin = ramp(t, T.finish - 0.2, T.finish);
    const hip = () => mid(P, 23, 24);
    if (fix.setup && wAddr > 0) { const tl = tiltOf(P), d = (Math.sign(tl || 1) * setupTarget - tl) * wAddr; rotateAbout(P, UPPER, hip(), d); }
    if (fix.hips && wSwing > 0) { const dx = (an(P).x + hipA - hip().x) * wSwing; shift(P, UPPER.concat([23, 24]), dx, 0); shift(P, [25, 26], dx / 2, 0); }
    if (fix.spine && wSwing > 0) { const d = (tiltA - tiltOf(P)) * wSwing; rotateAbout(P, UPPER, hip(), d); }
    if (fix.arm && wTop > 0) {
      const [sh, el, wr] = lead, S = P[sh], E = P[el], W = P[wr];
      const u = Math.hypot(E.x - S.x, E.y - S.y), fo = Math.hypot(W.x - E.x, W.y - E.y), dw = Math.hypot(W.x - S.x, W.y - S.y) || 1;
      const nx = (W.x - S.x) / dw, ny = (W.y - S.y) / dw, L = (u + fo) * 0.98;
      const W2 = { x: S.x + nx * L, y: S.y + ny * L }, E2 = { x: S.x + nx * u, y: S.y + ny * u };
      const dWx = (W2.x - W.x) * wTop, dWy = (W2.y - W.y) * wTop;
      P[el] = { x: E.x + (E2.x - E.x) * wTop, y: E.y + (E2.y - E.y) * wTop };
      shift(P, lead.slice(2), dWx, dWy);
    }
    if (fix.hands && wTop > 0) { const h = hip(), sh = mid(P, 11, 12), Tl = Math.hypot(sh.x - h.x, sh.y - h.y), wr = mid(P, 15, 16);
      const need = Math.max(0, (h.y - 1.08 * Tl) - wr.y) * -1; if (need < 0) { shift(P, [15, 16, 17, 18, 19, 20, 21, 22], 0, need * wTop); shift(P, [13, 14], 0, need * wTop / 2); } }
    if (fix.finish && wFin > 0) { const h = hip(), sh = mid(P, 11, 12), Tl = Math.hypot(sh.x - h.x, sh.y - h.y), wr = mid(P, 15, 16);
      const need = (h.y - 1.1 * Tl) - wr.y; if (need < 0) { shift(P, [15, 16, 17, 18, 19, 20, 21, 22], 0, need * wFin); shift(P, [13, 14], 0, need * wFin / 2); } }
    if (fix.head && wSwing + wAddr > 0) {
      const w = Math.max(wSwing, 0), a = an(P), dx = (a.x + headA.x - P[0].x) * w, dy = (a.y + headA.y - P[0].y) * w;
      shift(P, HEAD, dx, dy); shift(P, [11, 12], dx * 0.35, dy * 0.35);
    }
    return P;
  });
  // Plain-English position notes for the key frames
  const notes = {}; let headAt = null;
  const pct = x => Math.round(Math.abs(x) * 100) + '%';
  // torso lengths -> a rough real distance (hip to shoulder is about 52 cm on an adult)
  const cm = x => { const c = Math.max(1, Math.round(Math.abs(x) * 52)); return `about ${c} cm (${Math.max(1, Math.round(c / 2.54))} in)`; };
  const add = (k, txt, area) => (notes[k] = notes[k] || []).push({ txt, area });
  const at = t => { const i = frames.indexOf(near(t)); return { me: frames[i].pts, id: ideal[i] }; };
  const moved = (a, b, idx) => Math.max(...idx.map(i => Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y))) / T0;
  if (fix.setup) add('Address', m.spine_address_deg < 30 ? 'Bend more from your hips: you\'re standing too upright. Push your bum back until your arms hang straight down.' : 'Stand a little taller: you\'re bent over too much. Keep the bend in your hips, not your back.', 'Setup posture');
  if (fix.head) {
    let bi = -1, bd = 0;
    frames.forEach((f, i) => { if (f.t < T.takeaway || f.t > T.impact) return; const d = Math.hypot(ideal[i][0].x - f.pts[0].x, ideal[i][0].y - f.pts[0].y); if (d > bd) { bd = d; bi = i; } });
    if (bi >= 0) {
      const t = frames[bi].t, keys = [['Takeaway', T.takeaway], ['Top', T.top], ['Downswing', (T.top + T.impact) / 2], ['Impact', T.impact]];
      const k = keys.reduce((a, b) => Math.abs(b[1] - t) < Math.abs(a[1] - t) ? b : a)[0];
      const dy = (ideal[bi][0].y - frames[bi].pts[0].y) / T0;
      add(k, dy < -0.04 ? `Keep your head level: it dipped ${cm(m.head_max_drop)} during the swing.` : `Keep your head steady: it moved ${cm(Math.max(m.head_max_side, m.head_max_drop))} during the swing.`, 'Head stability');
      headAt = t;
    }
  }
  for (const [k, t] of [['Top', T.top], ['Impact', T.impact]]) {
    const { me, id } = at(t);
    if (fix.spine && k === 'Impact') add(k, m.spine_impact_deg < m.spine_address_deg ? 'Stay in your posture: you stood up as you came into the ball.' : 'Stay in your posture: you dipped down as you came into the ball.', 'Spine angle');
    if (fix.hips && k === 'Impact') add(k, view !== 'face-on' ? `Keep your bum back: your hips moved ${cm(m.hips_toward_ball_impact)} toward the ball.` : `Turn instead of sliding: your hips slid ${cm(m.hip_slide_impact || m.hip_sway_top)} sideways.`, 'Impact position');
    if (fix.arm && k === 'Top') add(k, 'Keep your front arm longer at the top: it\'s bending, which costs you width and power.', 'Backswing and top');
    if (fix.hands && k === 'Top') add(k, 'Turn fully so your hands finish above your shoulders at the top.', 'Backswing and top');
  }
  if (fix.finish) add('Finish', 'Finish higher: rotate through until your hands are above your shoulders.', 'Balance and finish');
  return { ideal, notes, fix, T0, headAt };
}
const api = { build };
if (typeof module !== 'undefined') module.exports = api; else root.IdealPose = api;
})(this);
