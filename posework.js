// Caddy Coach: body tracking in a background thread, so several frames are worked on at once on phones with
// more than one core. Same model and the same code as on the page; frames arrive as JPEG blobs.
self.window = self;
importScripts('tflite.js', 'pose.js', 'models.js');
const ab = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
let pose = null, cv = null, cx = null;
function sampler(src) {
  return (dst, S, roi, lo, hi) => {
    if (!cv || cv.width !== S) { cv = new OffscreenCanvas(S, S); cx = cv.getContext('2d', { willReadFrequently: true }); }
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#000'; cx.fillRect(0, 0, S, S);
    cx.translate(S / 2, S / 2); cx.rotate(-roi.rot); cx.scale(S / roi.w, S / roi.h); cx.translate(-roi.cx, -roi.cy); cx.drawImage(src, 0, 0);
    const d = cx.getImageData(0, 0, S, S).data, k = (hi - lo) / 255;
    for (let i = 0, j = 0; i < S * S; i++, j += 4) { dst[i * 3] = lo + k * d[j]; dst[i * 3 + 1] = lo + k * d[j + 1]; dst[i * 3 + 2] = lo + k * d[j + 2]; }
  };
}
const slim = r => r && { pts: r.pts, world: r.world, roi: r.roi, next: r.next };
self.onmessage = async e => {
  const m = e.data;
  try {
    if (!pose) pose = new BlazePose.Pose(ab(POSE_MODELS.det), ab(POSE_MODELS.lm));
    if (m.type === 'warm') { self.postMessage({ id: m.id, ok: true }); return; }
    // jobs: [{i, blob, roi}] ; chain: each frame starts from the one before it
    const out = []; let roi = m.roi || null;
    for (const j of m.jobs) {
      const bmp = await createImageBitmap(j.blob);
      const r = pose.track({ width: m.W, height: m.H }, m.chain ? roi : (j.roi || null), sampler(bmp)); bmp.close && bmp.close();
      roi = r ? r.next : null; out.push({ i: j.i, r: slim(r) });
      self.postMessage({ id: m.id, progress: 1 });
    }
    self.postMessage({ id: m.id, ok: true, out });
  } catch (err) { self.postMessage({ id: m.id, ok: false, err: String(err && err.message || err) }); }
};
