// MediaPipe hand landmark model (21 points per hand) run by the app's own TFLite interpreter.
// Hands are found from the body pose (wrist / index / pinky), like MediaPipe Holistic, then tracked
// from their own landmarks. Input image is a sampler, see pose.js.
(function (root) {
'use strict';
const TF = typeof module !== 'undefined' ? require('./tflite.js') : root.TFLite;
const normAng = a => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));

// RectTransformationCalculator: shift (in the rotated frame), square on the long side, scale
function transform(r, scale, shiftY) {
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  const cx = r.cx - r.h * shiftY * s, cy = r.cy + r.h * shiftY * c;
  const L = Math.max(r.w, r.h) * scale;
  return { cx, cy, w: L, h: L, rot: r.rot };
}
// HandLandmarksToRectCalculator + scale 2, shift -0.1
function roiFromLandmarks(P) {
  const idx = [0, 1, 2, 3, 5, 6, 9, 10, 13, 14, 17, 18];
  const x0 = P[0].x, y0 = P[0].y;
  const x1 = ((P[5].x + P[13].x) / 2 + P[9].x) / 2, y1 = ((P[5].y + P[13].y) / 2 + P[9].y) / 2;
  const rot = normAng(Math.PI / 2 - Math.atan2(-(y1 - y0), x1 - x0)), rev = -rot;
  let ax0 = 1e9, ax1 = -1e9, ay0 = 1e9, ay1 = -1e9;
  for (const i of idx) { ax0 = Math.min(ax0, P[i].x); ax1 = Math.max(ax1, P[i].x); ay0 = Math.min(ay0, P[i].y); ay1 = Math.max(ay1, P[i].y); }
  const acx = (ax0 + ax1) / 2, acy = (ay0 + ay1) / 2;
  let px0 = 1e9, px1 = -1e9, py0 = 1e9, py1 = -1e9;
  for (const i of idx) {
    const ox = P[i].x - acx, oy = P[i].y - acy;
    const px = ox * Math.cos(rev) - oy * Math.sin(rev), py = ox * Math.sin(rev) + oy * Math.cos(rev);
    px0 = Math.min(px0, px); px1 = Math.max(px1, px); py0 = Math.min(py0, py); py1 = Math.max(py1, py);
  }
  const pcx = (px0 + px1) / 2, pcy = (py0 + py1) / 2;
  const cx = pcx * Math.cos(rot) - pcy * Math.sin(rot) + acx, cy = pcx * Math.sin(rot) + pcy * Math.cos(rot) + acy;
  return transform({ cx, cy, w: px1 - px0, h: py1 - py0, rot }, 2.0, -0.1);
}
// Hand ROI from body-pose wrist, pinky and index points (Holistic's HandDetectionsFromPose + scale 2.7)
function roiFromPose(w, pinky, index) {
  const mx = (2 * index.x + pinky.x) / 3, my = (2 * index.y + pinky.y) / 3;
  const rot = normAng(Math.PI / 2 - Math.atan2(-(my - w.y), mx - w.x));
  const d = 2 * Math.hypot(mx - w.x, my - w.y);
  return transform({ cx: w.x, cy: w.y, w: d, h: d, rot }, 2.7, -0.1);
}

function Hand(buf) { this.m = new TF.Model(buf); this.inp = new Float32Array(224 * 224 * 3); }
// Landmarks inside an ROI: 21 points in image pixels; z in the same pixel scale (smaller = nearer camera).
Hand.prototype.run = function (roi, sampler) {
  sampler(this.inp, 224, roi, 0, 1);
  const [lm, flag, hd, world] = this.m.run([this.inp]);
  const c = Math.cos(roi.rot), s = Math.sin(roi.rot), pts = [];
  for (let i = 0; i < 21; i++) {
    const nx = lm.d[i * 3] / 224 - 0.5, ny = lm.d[i * 3 + 1] / 224 - 0.5;
    pts.push({ x: roi.cx + (nx * c - ny * s) * roi.w, y: roi.cy + (nx * s + ny * c) * roi.h, z: lm.d[i * 3 + 2] / 224 * roi.w });
  }
  const wl = []; if (world) for (let i = 0; i < 21; i++) wl.push([world.d[i * 3], world.d[i * 3 + 1], world.d[i * 3 + 2]]);
  return { score: flag.d[0], right: hd.d[0], pts, world: wl, roi, next: roiFromLandmarks(pts) };
};
// One step of tracking: use the previous ROI when given, else the pose ROI (refined with a second pass).
Hand.prototype.track = function (prev, poseRoi, sampler) {
  let r = prev ? this.run(prev, sampler) : null;
  if (!r || r.score < 0.5) {
    if (!poseRoi) return r && r.score >= 0.5 ? r : null;
    r = this.run(poseRoi, sampler);
    if (r.score >= 0.3) r = this.run(r.next, sampler);
  }
  return r.score >= 0.5 ? r : null;
};

const api = { Hand, roiFromLandmarks, roiFromPose };
if (typeof module !== 'undefined') module.exports = api; else root.HandModel = api;
})(this);
