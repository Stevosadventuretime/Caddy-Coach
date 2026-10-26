// BlazePose pipeline (MediaPipe pose_detection + pose_landmark), plain JS.
// Image input is {data: RGBA Uint8ClampedArray, width, height} or a sampler.
(function (root) {
'use strict';
const TF = typeof module !== 'undefined' ? require('./tflite.js') : root.TFLite;

function anchors() {
  const strides = [8, 16, 32, 32, 32], out = [];
  let l = 0;
  while (l < strides.length) {
    let last = l, n = 0;
    while (last < strides.length && strides[last] === strides[l]) { n += 2; last++; }
    const f = Math.ceil(224 / strides[l]);
    for (let y = 0; y < f; y++) for (let x = 0; x < f; x++) for (let k = 0; k < n; k++) out.push([(x + .5) / f, (y + .5) / f]);
    l = last;
  }
  return out;
}
const sig = x => 1 / (1 + Math.exp(-x));
const normAng = a => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));

// sample(dst Float32Array, size, roi, lo, hi): fills dst with RGB of rotated square crop
function cropSampler(img) {
  const { data, width: W, height: H } = img;
  return function (dst, S, roi, lo, hi) {
    const c = Math.cos(roi.rot), s = Math.sin(roi.rot), k = (hi - lo) / 255;
    for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
      const nx = (u + .5) / S - .5, ny = (v + .5) / S - .5;
      const x = roi.cx + (nx * c - ny * s) * roi.w - .5, y = roi.cy + (nx * s + ny * c) * roi.h - .5;
      const o = (v * S + u) * 3;
      const x0 = Math.floor(x), y0 = Math.floor(y), dx = x - x0, dy = y - y0;
      for (let ch = 0; ch < 3; ch++) {
        const px = (xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H) ? 0 : data[(yy * W + xx) * 4 + ch];
        const a = px(x0, y0), b = px(x0 + 1, y0), cc = px(x0, y0 + 1), d = px(x0 + 1, y0 + 1);
        dst[o + ch] = lo + k * (a + (b - a) * dx + (cc - a) * dy + (a - b - cc + d) * dx * dy);
      }
    }
  };
}

function Pose(detBuf, lmBuf) {
  this.det = new TF.Model(detBuf);
  this.lm = new TF.Model(lmBuf, [0, 1, 3, 4]);
  this.anc = anchors();
  this.dIn = new Float32Array(224 * 224 * 3);
  this.lIn = new Float32Array(256 * 256 * 3);
}

// Person detection on the whole frame (letterboxed to 224x224, range -1..1).
Pose.prototype.detect = function (img, sampler) {
  const W = img.width, H = img.height, m = Math.max(W, H);
  sampler = sampler || cropSampler(img);
  sampler(this.dIn, 224, { cx: W / 2, cy: H / 2, w: m, h: m, rot: 0 }, -1, 1);
  // letterbox padding must be -1 (zero pixels): sampler returns lo for out-of-bounds already
  const [box, score] = this.det.run([this.dIn]);
  const dets = [];
  for (let i = 0; i < this.anc.length; i++) {
    let r = score.d[i]; r = r < -100 ? -100 : r > 100 ? 100 : r; const sc = sig(r);
    if (sc < .5) continue;
    const b = box.d.subarray(i * 12, i * 12 + 12), a = this.anc[i];
    const cx = b[0] / 224 + a[0], cy = b[1] / 224 + a[1], w = b[2] / 224, h = b[3] / 224;
    const kp = []; for (let k = 0; k < 4; k++) kp.push([b[4 + 2 * k] / 224 + a[0], b[5 + 2 * k] / 224 + a[1]]);
    dets.push({ sc, box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], kp });
  }
  // weighted NMS
  dets.sort((p, q) => q.sc - p.sc);
  const iou = (p, q) => { const ix = Math.max(0, Math.min(p[2], q[2]) - Math.max(p[0], q[0])), iy = Math.max(0, Math.min(p[3], q[3]) - Math.max(p[1], q[1])), i = ix * iy;
    return i / ((p[2] - p[0]) * (p[3] - p[1]) + (q[2] - q[0]) * (q[3] - q[1]) - i); };
  const out = [], used = new Array(dets.length).fill(false);
  for (let i = 0; i < dets.length; i++) {
    if (used[i]) continue;
    let tw = 0; const kp = [[0, 0], [0, 0], [0, 0], [0, 0]], bx = [0, 0, 0, 0];
    for (let j = i; j < dets.length; j++) {
      if (used[j] || iou(dets[i].box, dets[j].box) <= .3) continue;
      used[j] = true; const w = dets[j].sc; tw += w;
      for (let k = 0; k < 4; k++) { kp[k][0] += dets[j].kp[k][0] * w; kp[k][1] += dets[j].kp[k][1] * w; bx[k] += dets[j].box[k] * w; }
    }
    const toPx = (x, y) => [x * m - (m - W) / 2, y * m - (m - H) / 2];
    out.push({ score: dets[i].sc, kp: kp.map(p => toPx(p[0] / tw, p[1] / tw)), box: [...toPx(bx[0] / tw, bx[1] / tw), ...toPx(bx[2] / tw, bx[3] / tw)] });
  }
  return out;
};

function roiFrom(p0, p1, W, H) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const size = Math.sqrt(dx * dx + dy * dy) * 2 * 1.25;
  const rot = normAng(Math.PI / 2 - Math.atan2(-dy, dx));
  return { cx: p0[0], cy: p0[1], w: size, h: size, rot };
}
Pose.prototype.roiFromDetection = function (d, W, H) { return roiFrom(d.kp[0], d.kp[1], W, H); };

// Landmarks inside a ROI. Returns 33 points in image pixels plus aux points and world landmarks.
Pose.prototype.landmarks = function (img, roi, sampler) {
  sampler = sampler || cropSampler(img);
  sampler(this.lIn, 256, roi, 0, 1);
  const [lm, flag, hm, world] = this.lm.run([this.lIn]);
  const c = Math.cos(roi.rot), s = Math.sin(roi.rot), pts = [];
  for (let i = 0; i < 39; i++) {
    let x = lm.d[i * 5] / 256, y = lm.d[i * 5 + 1] / 256;
    // heatmap refinement (kernel 7)
    if (i < 33 && hm) {
      const HS = 64, cc = Math.round(x * HS), rr = Math.round(y * HS);
      let sum = 0, wx = 0, wy = 0, mx = 0;
      for (let r = Math.max(0, rr - 3); r <= Math.min(HS - 1, rr + 3); r++) for (let q = Math.max(0, cc - 3); q <= Math.min(HS - 1, cc + 3); q++) {
        const cf = sig(hm.d[(r * HS + q) * 39 + i]); sum += cf; wx += q * cf; wy += r * cf; if (cf > mx) mx = cf; }
      if (mx >= .5 && sum > 0) { x = wx / HS / sum; y = wy / HS / sum; }
    }
    const nx = x - .5, ny = y - .5;
    pts.push({ x: roi.cx + (nx * c - ny * s) * roi.w, y: roi.cy + (nx * s + ny * c) * roi.h,
      vis: sig(lm.d[i * 5 + 3]), pres: sig(lm.d[i * 5 + 4]) });
  }
  const wl = []; if (world) for (let i = 0; i < 33; i++) wl.push([world.d[i * 3], world.d[i * 3 + 1], world.d[i * 3 + 2]]);
  return { score: flag.d[0], pts: pts.slice(0, 33), aux: pts.slice(33, 35), world: wl, next: roiFrom([pts[33].x, pts[33].y], [pts[34].x, pts[34].y]) };
};

// Track one person across frames: detect when lost.
Pose.prototype.track = function (img, prevRoi, sampler) {
  let roi = prevRoi, r = null;
  if (roi) { r = this.landmarks(img, roi, sampler); if (r.score < .5) r = null; }
  if (!r) {
    const d = this.detect(img, sampler); if (!d.length) return null;
    // prefer the person closest to the previous position, otherwise the most confident
    let best = d[0];
    if (prevRoi) best = d.reduce((a, b) => Math.hypot(b.kp[0][0] - prevRoi.cx, b.kp[0][1] - prevRoi.cy) < Math.hypot(a.kp[0][0] - prevRoi.cx, a.kp[0][1] - prevRoi.cy) ? b : a);
    roi = this.roiFromDetection(best, img.width, img.height);
    r = this.landmarks(img, roi, sampler); if (r.score < .5) return null;
  }
  r.roi = roi; return r;
};

const api = { Pose, cropSampler, anchors };
if (typeof module !== 'undefined') module.exports = api; else root.BlazePose = api;
})(this);
