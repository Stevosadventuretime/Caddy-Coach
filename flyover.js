// 3D hole flyover: satellite imagery draped over the ground heights, a camera that flies from the tee to the green,
// today's pin, and yardage markers to the green. Uses three.js (already loaded for the drills).
(function (root) {
'use strict';
const T = root.THREE;
const M_LAT = 111320;
const TILE = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?cc=gf`;
const lon2px = (lon, z) => (lon + 180) / 360 * 256 * Math.pow(2, z);
const lat2px = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * Math.pow(2, z); };
const YD = 0.9144;
let FLY = null;

function local(o) { const c = Math.cos(o.lat0 * Math.PI / 180); return p => [(p.lon - o.lon0) * c * M_LAT, -(p.lat - o.lat0) * M_LAT]; }
function distM(a, b) { const c = Math.cos(a.lat * Math.PI / 180); return Math.hypot((a.lon - b.lon) * c * M_LAT, (a.lat - b.lat) * M_LAT); }

async function imagery(bb, z, onProgress) {
  const x0 = Math.floor(lon2px(bb.w, z) / 256), x1 = Math.floor(lon2px(bb.e, z) / 256), y0 = Math.floor(lat2px(bb.n, z) / 256), y1 = Math.floor(lat2px(bb.s, z) / 256);
  const c = document.createElement('canvas'); c.width = (x1 - x0 + 1) * 256; c.height = (y1 - y0 + 1) * 256; const x = c.getContext('2d');
  x.fillStyle = '#5e8a46'; x.fillRect(0, 0, c.width, c.height);
  let ok = 0, n = 0; const jobs = [];
  for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) jobs.push([tx, ty]);
  const one = async ([tx, ty]) => {
    try { const r = await fetch(TILE(z, tx, ty), { mode: 'cors' }); if (!r.ok) throw 0; const bm = await createImageBitmap(await r.blob()); x.drawImage(bm, (tx - x0) * 256, (ty - y0) * 256); ok++; } catch (_) {}
    n++; onProgress && onProgress(n / jobs.length);
  };
  for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map(one));
  return { canvas: c, ok: ok > jobs.length * 0.6, px0: x0 * 256, py0: y0 * 256 };
}

// a simple drawing of the hole when the satellite picture can't be had (offline)
function drawnHole(c, toPx, tee, green) {
  const x = c.getContext('2d'), t = toPx(tee), g = toPx(green);
  x.fillStyle = '#4f7a3b'; x.fillRect(0, 0, c.width, c.height);
  x.lineCap = 'round'; x.strokeStyle = '#6fa04e'; x.lineWidth = Math.max(40, Math.hypot(g[0] - t[0], g[1] - t[1]) * 0.12); x.beginPath(); x.moveTo(t[0], t[1]); x.lineTo(g[0], g[1]); x.stroke();
  x.fillStyle = '#86bb5c'; x.beginPath(); x.ellipse(g[0], g[1], 34, 28, 0, 0, 7); x.fill();
}

function flag(color) {
  const g = new T.Group(), pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 6, 8), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  pole.position.y = 3; g.add(pole);
  const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(2.4, -0.7); sh.lineTo(0, -1.4);
  const fl = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshStandardMaterial({ color, side: T.DoubleSide, roughness: 0.6 })); fl.position.set(0.05, 6, 0); g.add(fl);
  return g;
}

async function open(o) {
  if (!T) throw new Error('3D unavailable');
  close();
  const ov = document.createElement('div'); ov.className = 'flyOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `Hole ${o.hole.n} flyover`);
  ov.innerHTML = `<canvas class="flyCv"></canvas><div class="flyLabels" aria-hidden="true"></div>
    <div class="flyTop"><div><b>Hole ${o.hole.n}</b><span>Par ${o.hole.par}${o.hole.yds ? ` · ${o.hole.yds} yds` : ''}</span></div><button type="button" class="flyX" data-fly="close">Close</button></div>
    <p class="flyMsg" role="status">Loading the hole…</p>
    <div class="flyBot"><button type="button" data-fly="replay">Play again</button><p class="flySrc">Imagery © Esri, Maxar, Earthstar Geographics · ground heights Copernicus DEM via Open-Meteo</p></div>`;
  const prevOverflow = document.body.style.overflow;
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  const st = FLY = { ov, dead: false, raf: 0, prevOverflow, disp: [] };
  const msg = ov.querySelector('.flyMsg');
  // area: tee and green with room round both
  const tee = o.tee, green = o.green, pin = o.pin || green;
  if (distM(tee, green) > 1100) { close(); throw new Error('too far for a flyover'); }
  const pad = 160, lat0 = (tee.lat + green.lat) / 2, lon0 = (tee.lon + green.lon) / 2, c0 = Math.cos(lat0 * Math.PI / 180);
  const bb = { n: Math.max(tee.lat, green.lat) + pad / M_LAT, s: Math.min(tee.lat, green.lat) - pad / M_LAT, e: Math.max(tee.lon, green.lon) + pad / (M_LAT * c0), w: Math.min(tee.lon, green.lon) - pad / (M_LAT * c0) };
  const span = Math.max((bb.n - bb.s) * M_LAT, (bb.e - bb.w) * M_LAT * c0);
  const z = span > 700 ? 17 : 18;
  const L = local({ lat0, lon0 });
  // ground heights on a grid (in chunks the server accepts)
  const GX = 7, GY = 7, gpts = [];
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) gpts.push({ lat: bb.n - (bb.n - bb.s) * j / (GY - 1), lon: bb.w + (bb.e - bb.w) * i / (GX - 1) });
  let H = null;
  try { const out = []; for (let k = 0; k < gpts.length; k += 36) { const r = await o.elev(gpts.slice(k, k + 36)); if (!r || r.some(v => v == null)) throw 0; out.push(...r); } H = out; } catch (_) { H = null; }
  if (st.dead) return;
  msg.textContent = 'Loading the satellite picture…';
  const img = await imagery(bb, z, f => { if (!st.dead) msg.textContent = `Loading the satellite picture… ${Math.round(f * 100)}%`; });
  if (st.dead) return;
  const toPx = p => [lon2px(p.lon, z) - img.px0, lat2px(p.lat, z) - img.py0];
  if (!img.ok) drawnHole(img.canvas, toPx, tee, green);
  msg.textContent = img.ok ? '' : 'Satellite picture unavailable, showing a drawing of the hole.'; msg.classList.add('done');
  if (!img.ok) ov.querySelector('.flySrc').textContent = H ? 'Drawing of the hole · ground heights Copernicus DEM via Open-Meteo' : 'Drawing of the hole';
  else if (!H) ov.querySelector('.flySrc').textContent = 'Imagery © Esri, Maxar, Earthstar Geographics';
  // renderer and scene
  const cv = ov.querySelector('.flyCv');
  const R = new T.WebGLRenderer({ canvas: cv, antialias: true }); R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
  R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
  const S = new T.Scene(); const skyC = new T.Color(0xcfe0ea); S.background = skyC; S.fog = new T.Fog(skyC, 180, 520);
  S.add(new T.HemisphereLight(0xeaf3ff, 0x4d6b3a, 0.9)); const sun = new T.DirectionalLight(0xfff1dc, 1.4); sun.position.set(-200, 300, 150); S.add(sun);
  // terrain
  const lo = H ? Math.min(...H) : 0, ex = 1.3;
  const hAt = (lat, lon) => { if (!H) return 0; const u = (lon - bb.w) / (bb.e - bb.w) * (GX - 1), v = (bb.n - lat) / (bb.n - bb.s) * (GY - 1); const i = Math.max(0, Math.min(GX - 2, Math.floor(u))), j = Math.max(0, Math.min(GY - 2, Math.floor(v))), fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j));
    const a = H[j * GX + i], b = H[j * GX + i + 1], c = H[(j + 1) * GX + i], d = H[(j + 1) * GX + i + 1]; return ((a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv - lo) * ex; };
  const NX = 128, NY = 128, pos = [], uv = [], idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const lat = bb.n - (bb.n - bb.s) * j / NY, lon = bb.w + (bb.e - bb.w) * i / NX, [x, zz] = L({ lat, lon }), px = toPx({ lat, lon });
    const eu = Math.min(i, NX - i) / NX, ev = Math.min(j, NY - j) / NY, edge = Math.min(1, Math.min(eu, ev) / 0.14); pos.push(x, hAt(lat, lon) * (edge * edge * (3 - 2 * edge)), zz); uv.push(px[0] / img.canvas.width, 1 - px[1] / img.canvas.height);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const tex = new T.CanvasTexture(img.canvas); tex.encoding = T.sRGBEncoding; tex.anisotropy = R.capabilities.getMaxAnisotropy ? R.capabilities.getMaxAnisotropy() : 4;
  const tmat = new T.MeshStandardMaterial({ map: tex, roughness: 1 }); S.add(new T.Mesh(geo, tmat)); st.disp.push(geo, tex, tmat);
  // a skirt of grass beyond the picture so the edge isn't a cliff
  const skirt = new T.Mesh(new T.PlaneGeometry(4000, 4000), new T.MeshStandardMaterial({ color: new T.Color(0x56763f).convertSRGBToLinear(), roughness: 1 })); skirt.rotation.x = -Math.PI / 2; skirt.position.y = -0.3; S.add(skirt);
  // markers
  const P3 = p => { const [x, zz] = L(p); return new T.Vector3(x, hAt(p.lat, p.lon), zz); };
  const tP = P3(tee), gP = P3(green), pP = P3(pin);
  const fl = flag(new T.Color(o.pinConfirmed ? 0xf5c518 : 0xf3e3a0).convertSRGBToLinear()); fl.position.copy(pP); S.add(fl);
  const teeM = new T.Mesh(new T.SphereGeometry(0.9, 12, 8), new T.MeshStandardMaterial({ color: 0xffffff })); teeM.position.copy(tP).add(new T.Vector3(0, 0.6, 0)); S.add(teeM);
  // yardage markers to the middle of the green along the line from the tee
  const totalYd = Math.round(distM(tee, green) / YD), marks = [];
  for (const yd of [100, 150, 200, 250]) {
    if (yd >= totalYd - 20) continue;
    const f = 1 - yd * YD / distM(tee, green), p = { lat: tee.lat + (green.lat - tee.lat) * f, lon: tee.lon + (green.lon - tee.lon) * f };
    const m = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 0.3, 16), new T.MeshStandardMaterial({ color: yd === 100 ? 0xc42b2b : yd === 150 ? 0xffffff : 0xf3c43a })); m.position.copy(P3(p)).add(new T.Vector3(0, 0.2, 0)); S.add(m);
    marks.push({ v: m.position.clone().add(new T.Vector3(0, 2, 0)), t: `${yd}` });
  }
  const pinYd = Math.round(distM(tee, pin) / YD);
  marks.push({ v: pP.clone().add(new T.Vector3(0, 7, 0)), t: o.pin ? `Pin ${pinYd} yds` : `Green ${totalYd} yds`, cls: 'pin' });
  marks.push({ v: tP.clone().add(new T.Vector3(0, 3, 0)), t: o.fromYou ? 'You' : 'Tee', cls: 'tee' });
  const lab = ov.querySelector('.flyLabels');
  lab.innerHTML = marks.map((m, i) => `<span class="${m.cls || ''}" data-i="${i}">${m.t}</span>`).join('');
  const spans = [...lab.children];
  // camera path: behind the tee, up high, then down the hole to the green
  const dir = gP.clone().sub(tP).setY(0).normalize(), len = tP.distanceTo(gP);
  const cam = new T.PerspectiveCamera(50, 1, 1, 3000);
  const path = u => {
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const from = tP.clone().addScaledVector(dir, -40).add(new T.Vector3(0, 30, 0)), to = gP.clone().addScaledVector(dir, -Math.min(140, len * 0.45)).add(new T.Vector3(0, 40, 0));
    const p = from.lerp(to, e); p.y += Math.sin(e * Math.PI) * 12;
    const look = tP.clone().addScaledVector(dir, Math.min(200, len * 0.6)).lerp(gP.clone().addScaledVector(dir, 10), e);
    return [p, look];
  };
  function size() { const r = cv.getBoundingClientRect(); R.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); }
  size(); const onR = () => size(); addEventListener('resize', onR); st.offR = () => removeEventListener('resize', onR);
  const dur = matchMedia('(prefers-reduced-motion:reduce)').matches ? 0.01 : 8;
  st.t0 = performance.now();
  st.replay = () => { st.t0 = performance.now(); };
  const v = new T.Vector3();
  function frame(now) {
    if (st.dead) return;
    const u = Math.min(1, (now - st.t0) / 1000 / dur), [p, look] = path(u);
    cam.position.copy(p); cam.lookAt(look); cam.updateMatrixWorld();
    fl.rotation.y = Math.sin(now / 900) * 0.25;
    R.render(S, cam);
    const W = cv.clientWidth, Hh = cv.clientHeight;
    // place the labels, hiding any that would sit on top of a nearer one (the pin label always wins)
    const placed = [];
    marks.map((m, i) => { v.copy(m.v).project(cam); return { i, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * Hh, z: v.z, on: v.z < 1 && Math.abs(v.x) < 1.05 && v.y < 1.05 && v.y > -0.72, pri: m.cls === 'pin' ? 0 : 1 }; })
      .sort((a, b) => a.pri - b.pri || a.z - b.z)
      .forEach(q => { const s = spans[q.i]; let on = q.on && !placed.some(r => Math.abs(r.x - q.x) < 60 && Math.abs(r.y - q.y) < 26); s.style.display = on ? '' : 'none'; if (on) { placed.push(q); s.style.transform = `translate(${q.x}px,${q.y}px) translate(-50%,-100%)`; } });
    st.raf = requestAnimationFrame(frame);
  }
  st.R = R; st.u = () => Math.min(1, (performance.now() - st.t0) / 1000 / dur); st.raf = requestAnimationFrame(frame);
  return st;
}
function close() {
  const st = FLY; if (!st) return; st.dead = true; cancelAnimationFrame(st.raf); st.offR && st.offR();
  try { (st.disp || []).forEach(x => x.dispose && x.dispose()); } catch (_) {}
  // give the graphics context back, or repeated flyovers would run the phone out of them
  try { if (st.R) { st.R.dispose(); st.R.forceContextLoss(); } } catch (_) {}
  st.ov.remove(); document.body.style.overflow = st.prevOverflow || ''; FLY = null;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-fly]'); if (!b || !FLY) return; if (b.dataset.fly === 'close') close(); if (b.dataset.fly === 'replay') FLY.replay && FLY.replay(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && FLY) close(); });
root.CCFly = { open, close, get state() { return FLY; } };
})(typeof window !== 'undefined' ? window : this);
