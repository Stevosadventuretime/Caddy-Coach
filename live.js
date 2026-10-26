// Caddy Coach live drill feedback: real-time pose checks and spoken cues.
// LiveEngine is pure logic (frames in, status + cues out); LiveUI owns camera, overlay and audio.
(function (root) {
'use strict';

// ---------- drill specs ----------
// mode 'hold': hold a static position in a target zone (absolute posture targets).
// mode 'swing': lock in your address, then each rep is checked against it.
// views: allowed camera angles, first is the default. crossed: arms folded on chest (no hand phases).
const SPECS = {
  hinge:       { mode: 'hold', views: ['dtl'], hold: 5, arms: false },
  mirror:      { mode: 'hold', views: ['dtl'], hold: 3, arms: true },
  station:     { mode: 'hold', views: ['dtl'], hold: 2, arms: true },
  chair:       { mode: 'swing', views: ['dtl'], checks: ['hips', 'tilt', 'height'] },
  chestturn:   { mode: 'swing', views: ['dtl', 'face'], checks: ['tilt', 'height', 'head', 'hipsway'], crossed: true },
  headwall:    { mode: 'swing', views: ['dtl'], checks: ['head', 'height'], crossed: true },
  partnerhead: { mode: 'swing', views: ['face', 'dtl'], checks: ['head', 'height'] },
  feettogether:{ mode: 'swing', views: ['face'], checks: ['head', 'height'], finish: 2 },
  crossarms:   { mode: 'swing', views: ['face'], checks: ['head', 'hipsway', 'turn'], crossed: true },
  hipstick:    { mode: 'swing', views: ['face'], checks: ['hipsway', 'head'] },
  leadarm:     { mode: 'swing', views: ['face', 'dtl'], checks: ['arm', 'head', 'height'] },
  pump:        { mode: 'swing', views: ['face', 'dtl'], checks: ['arm', 'head', 'height'], impactLo: 0.25 },
  ltol:        { mode: 'swing', views: ['face', 'dtl'], checks: ['head', 'height'] },
  tempo:       { mode: 'swing', views: ['face', 'dtl'], checks: ['tempo'], metro: true },
  pausetop:    { mode: 'swing', views: ['face', 'dtl'], checks: ['pause', 'head'] },
  impactbag:   { mode: 'swing', views: ['dtl'], checks: ['hips', 'tilt', 'height'], holdEnd: 2 },
  lowpoint:    { mode: 'swing', views: ['face'], checks: ['head', 'height'] },
  holdfinish:  { mode: 'swing', views: ['face', 'dtl'], checks: ['height'], finish: 3 },
  oneleg:      { mode: 'swing', views: ['face'], checks: [], finish: 5 },
  gate:        { mode: 'swing', views: ['face', 'dtl'], checks: ['head', 'height'] },
};
const ONLY = { tilt: 'dtl', hips: 'dtl', hipsway: 'face', turn: 'face' };
const TOL = { headX: { dtl: 0.08, face: 0.10 }, headY: 0.07, hips: 0.06, hipsAway: 0.15, hipsway: 0.14, tilt: 6, tiltUp: 9 };
const WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];

// ---------- geometry ----------
const mid = (p, a, b) => ({ x: (p[a].x + p[b].x) / 2, y: (p[a].y + p[b].y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function ang3(a, b, c) { const u = { x: a.x - b.x, y: a.y - b.y }, v = { x: c.x - b.x, y: c.y - b.y };
  const d = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1; return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / d))) * 180 / Math.PI; }
function feat(p) {
  const head = { x: (p[0].x + p[7].x + p[8].x) / 3, y: (p[0].y + p[7].y + p[8].y) / 3 };
  const hip = mid(p, 23, 24), sh = mid(p, 11, 12), wr = mid(p, 15, 16), ears = mid(p, 7, 8);
  const T = dist(sh, hip) || 1;
  const vis = i => p[i].vis == null ? 1 : p[i].vis;
  const kL = ang3(p[23], p[25], p[27]), kR = ang3(p[24], p[26], p[28]);
  return { head, hip, sh, wr, ears, nose: p[0], T, shW: Math.abs(p[11].x - p[12].x), tilt: Math.atan2(Math.abs(sh.x - hip.x), hip.y - sh.y) * 180 / Math.PI,
    knee: vis(25) + vis(27) >= vis(26) + vis(28) ? kL : kR, p };
}

// ---------- engine ----------
function LiveEngine(id, opt) {
  const sp = SPECS[id] || { mode: 'swing', views: ['face', 'dtl'], checks: ['head', 'height'] };
  this.id = id; this.sp = sp; this.right = opt.right !== false; this.view = opt.view || sp.views[0];
  this.checks = (sp.checks || []).filter(c => !ONLY[c] || ONLY[c] === this.view);
  this.state = 'find'; this.reps = 0; this.good = 0; this.hist = []; this.sm = null; this.ref = null;
  this.stillSince = null; this.lostSince = null; this.findSaid = -99; this.mismatch = 0; this.log = [];
  this.hold = { inSince: null, outSince: null, cue: null, lastSay: {}, done: false, entered: false };
}
LiveEngine.SPECS = SPECS;
LiveEngine.prototype.reset = function () { this.state = 'find'; this.ref = null; this.rep = null; this.count = null; this.stillSince = null; };

LiveEngine.prototype.push = function (t, pts, W, H) {
  const out = { t, say: [], zones: [], level: 'idle', text: '', sub: '', pts: null };
  // visibility: whole body in frame
  const ok = pts && [0, 11, 12, 23, 24].every(i => (pts[i].vis == null || pts[i].vis > 0.5)) &&
    Math.max(pts[27].vis == null ? 1 : pts[27].vis, pts[28].vis == null ? 1 : pts[28].vis) > 0.3 &&
    Math.min(pts[0].y, pts[11].y, pts[12].y) > 0 && Math.max(pts[27].y, pts[28].y) < H * 1.02 &&
    Math.min(...[0, 11, 12, 23, 24, 27, 28].map(i => pts[i].x)) > -W * 0.02 && Math.max(...[0, 11, 12, 23, 24, 27, 28].map(i => pts[i].x)) < W * 1.02;
  if (!ok) {
    this.lostSince = this.lostSince == null ? t : this.lostSince;
    out.level = 'idle'; out.text = pts ? 'Step back so your whole body is in view' : 'Looking for you…';
    out.sub = this.viewHint();
    if (t - this.lostSince > 1.2 && t - this.findSaid > 8) { out.say.push({ text: pts ? 'Step back so I can see all of you' : 'Stand where the camera can see you', pri: 1 }); this.findSaid = t; }
    if (this.state === 'rep' && this.rep && this.rep.impactT != null && t - this.lostSince > 0.5) { this.endRep(out); out.pts = null; }
    if (t - this.lostSince > 1.5) { this.sm = null; this.hist = []; if (this.state !== 'find' && this.state !== 'count') { this.state = 'find'; this.rep = null; } }
    return out;
  }
  this.lostSince = null;
  // smoothing (time-constant EMA so it behaves the same at 5 or 30 fps)
  const dt = this.sm ? Math.max(0.001, t - this.sm.t) : 1;
  const a = 1 - Math.exp(-dt / 0.08);
  const P = this.sm ? pts.map((q, i) => ({ x: this.sm.P[i].x + (q.x - this.sm.P[i].x) * a, y: this.sm.P[i].y + (q.y - this.sm.P[i].y) * a, vis: q.vis })) : pts.map(q => ({ x: q.x, y: q.y, vis: q.vis }));
  this.sm = { t, P }; out.pts = P;
  const f = feat(P); f.t = t;
  this.hist.push(f); while (this.hist.length > 2 && t - this.hist[0].t > 2.5) this.hist.shift();
  // speed over ~0.25 s window, in torso lengths per second
  const Tn = this.ref ? this.ref.T : f.T;
  let back = this.hist[0]; for (const h of this.hist) { if (t - h.t >= 0.22) back = h; else break; }
  const keyI = [0, 11, 12, 13, 14, 15, 16];
  f.speed = back === f || t - back.t < 0.05 ? 0 : keyI.reduce((s, i) => s + dist(P[i], back.p[i]), 0) / keyI.length / Tn / (t - back.t);
  // camera angle sanity (shoulder width vs torso)
  const r = f.shW / f.T, wrong = this.view === 'dtl' ? r > 0.75 : r < 0.35;
  this.mismatch = wrong && f.speed < 0.6 ? this.mismatch + dt : Math.max(0, this.mismatch - dt);
  const other = this.view === 'dtl' ? 'face' : 'dtl';
  if (this.mismatch > 1.2 && this.sp.views.includes(other)) {
    // drill works from either angle: follow the camera instead of nagging
    this.view = other; this.checks = (this.sp.checks || []).filter(c => !ONLY[c] || ONLY[c] === other);
    this.mismatch = 0; this.ref = null; this.state = 'find'; this.rep = null; this.stillSince = null; this.calibSaid = true;
    out.viewChanged = other; out.level = 'idle'; out.text = other === 'dtl' ? 'Side-on camera detected' : 'Face-on camera detected'; out.sub = 'Get set and hold still';
    out.say.push({ text: (other === 'dtl' ? 'Side-on view.' : 'Face-on view.') + ' Get set and hold still.', pri: 2 }); return out;
  }
  if (this.mismatch > 2) {
    out.level = 'warn'; out.text = this.view === 'dtl' ? 'Turn side-on to the camera' : 'Face the camera square on'; out.sub = this.viewHint();
    if (!this.mismatchSaid || t - this.mismatchSaid > 8) { out.say.push({ text: out.text, pri: 2 }); this.mismatchSaid = t; }
    this.stillSince = null; return out;
  }
  if (this.sp.mode === 'hold') return this.holdStep(f, out);
  return this.swingStep(f, out);
};
LiveEngine.prototype.viewHint = function () { return this.view === 'dtl' ? 'Camera side-on to you, 2–3 m away, at hip height' : 'Camera in front of you, 2–3 m away, at hip height'; };
LiveEngine.prototype.facing = function (f) { const d = f.nose.x - f.ears.x; return Math.abs(d) > f.T * 0.03 ? Math.sign(d) : Math.sign(f.wr.x - f.hip.x) || 1; };

// ---- static posture zone ----
LiveEngine.prototype.posture = function (f) {
  const fc = this.facing(f), res = [];
  const tilt = f.tilt;
  res.push({ key: 'tilt', sev: tilt < 24 ? (24 - tilt) / 5 : tilt > 42 ? (tilt - 42) / 6 : 0, dir: tilt < 30 ? -1 : 1,
    say: tilt < 30 ? 'Hinge forward' : 'Stand taller', detail: tilt < 30 ? `Tilt more from your hips: ${Math.round(tilt)}° now, aim for about 30°.` : `Too bent over (${Math.round(tilt)}°). Lift your chest a little.`, val: `${Math.round(tilt)}°` });
  const k = f.knee;
  res.push({ key: 'knee', sev: k > 173 ? (k - 173) / 6 : k < 145 ? (145 - k) / 8 : 0, say: k > 165 ? 'Sit down a little' : 'Stand up a little',
    detail: k > 165 ? 'Knees too straight. Flex them a touch more.' : 'Too much knee bend. Stand up a touch.', val: `${Math.round(k)}°` });
  if (this.sp.arms) {
    const reach = (f.wr.x - f.sh.x) * fc / f.T;
    res.push({ key: 'arms', sev: reach > 0.3 ? (reach - 0.3) / 0.12 + (reach > 0.42 ? 0 : 0) : reach < -0.15 ? (-0.15 - reach) / 0.12 : 0,
      say: reach > 0.3 ? 'Hands closer' : 'Hands out a little', detail: reach > 0.3 ? 'Your hands are reaching. Let your arms hang straight down from your shoulders.' : 'Your hands are tucked in. Let them hang under your shoulders.' });
  }
  return res;
};
LiveEngine.prototype.holdStep = function (f, out) {
  const H = this.hold, t = f.t, fc = this.facing(f);
  const res = this.posture(f), worst = res.reduce((a, b) => b.sev > a.sev ? b : a);
  // zones: ideal spine wedge from the hip, knee marker
  const L = f.T * 1.25, ang = d => ({ x: f.hip.x + fc * Math.sin(d * Math.PI / 180) * L, y: f.hip.y - Math.cos(d * Math.PI / 180) * L });
  const tr = res[0], lv = s => s >= 1 ? 'out' : s >= 0.5 ? 'warn' : 'in';
  out.zones.push({ type: 'wedge', x: f.hip.x, y: f.hip.y, a: ang(24), b: ang(42), lv: lv(tr.sev) });
  out.zones.push({ type: 'line', x0: f.hip.x, y0: f.hip.y, x1: f.sh.x, y1: f.sh.y, lv: lv(tr.sev), w: 2 });
  const kn = f.p[res[1] && f.knee === ang3(f.p[23], f.p[25], f.p[27]) ? 25 : 26];
  out.zones.push({ type: 'dot', x: kn.x, y: kn.y, r: f.T * 0.09, lv: lv(res[1].sev) });
  out.metrics = res.map(r => ({ key: r.key, lv: lv(r.sev), val: r.val }));
  if (f.speed > 1.0) { H.inSince = null; H.outSince = null; out.level = 'idle'; out.text = 'Moving… settle into your setup'; return out; }
  if (this.state === 'find') { this.state = 'hold'; out.say.push({ text: 'I can see you. Get into your setup.', pri: 1 }); }
  const inZone = worst.sev < 0.5, out1 = worst.sev >= 1;
  out.sub = `Hold ${this.sp.hold}s in the zone · ${res.map(r => r.val ? `${r.key === 'tilt' ? 'spine' : 'knees'} ${r.val}` : '').filter(Boolean).join(' · ')}`;
  if (H.done) {
    // wait for them to stand up before the next rep
    if (f.tilt < 15) { H.done = false; H.entered = false; }
    out.level = 'in'; out.text = 'Nice. Stand up, then set up again'; return out;
  }
  if (inZone) {
    H.outSince = null;
    if (H.inSince == null) { H.inSince = t; if (H.cue || !H.entered) { out.say.push({ text: 'In zone. Hold it.', pri: 2 }); } H.cue = null; H.entered = true; H.lastCount = 0; }
    const held = t - H.inSince, n = Math.floor(held);
    if (n > H.lastCount && n < this.sp.hold) { H.lastCount = n; out.say.push({ text: WORDS[n - 1] || String(n), pri: 3, force: true }); }
    if (held >= this.sp.hold) { this.reps++; this.good++; H.done = true; H.inSince = null; out.say.push({ text: 'Perfect. Stand up and go again.', pri: 3, force: true }); this.addLog('good', 'Held the zone for ' + this.sp.hold + ' seconds'); }
    out.level = 'in'; out.text = held >= 0.3 ? `In zone · ${Math.min(this.sp.hold, held).toFixed(1)}s` : 'In zone';
  } else {
    if (H.inSince != null && t - H.inSince > 0.3 && worst.sev >= 0.7) { H.inSince = null; }
    if (worst.sev >= 0.7) H.inSince = null;
    out.level = out1 ? 'out' : 'warn'; out.text = worst.say; out.detail = worst.detail;
    if (out1) {
      H.outSince = H.outSince == null ? t : H.outSince;
      const last = H.lastSay[worst.say] || -99;
      if (t - H.outSince > 0.6 && t - last > 4) { out.say.push({ text: worst.say, pri: 2 }); H.lastSay[worst.say] = t; H.cue = worst.say; }
    } else H.outSince = null;
  }
  return out;
};

// ---- swing reps ----
LiveEngine.prototype.calibrate = function () {
  const now = this.hist[this.hist.length - 1], win = this.hist.filter(h => now.t - h.t <= 0.6);
  const avgPt = g => ({ x: win.reduce((s, h) => s + g(h).x, 0) / win.length, y: win.reduce((s, h) => s + g(h).y, 0) / win.length });
  const P = now.p.map((_, i) => avgPt(h => h.p[i]));
  const f = feat(P);
  f.p = P; f.tilt = win.reduce((s, h) => s + h.tilt, 0) / win.length; f.fc = this.facing(now);
  this.ref = f;
};
LiveEngine.prototype.devs = function (f) {
  const R = this.ref, T = R.T, res = [], view = this.view;
  for (const c of this.checks) {
    if (c === 'head') {
      const dx = (f.head.x - R.head.x) / T, tol = TOL.headX[view];
      if (view === 'dtl') { const v = dx * R.fc; res.push({ c, key: v > 0 ? 'head+' : 'head-', sev: Math.abs(v) / tol, say: v > 0 ? 'Head back' : 'Head forward', detail: v > 0 ? 'Your head moved toward the ball.' : 'Your head moved back, away from the ball.' }); }
      else { const tgt = (dx > 0) === this.right; res.push({ c, key: dx > 0 ? 'head+' : 'head-', sev: Math.abs(dx) / tol, say: dx > 0 ? 'Head right' : 'Head left', detail: `Your head slid to your ${dx > 0 ? 'left' : 'right'} (${tgt ? 'toward' : 'away from'} the target). Keep it centred.` }); }
    } else if (c === 'height') {
      const dy = (f.head.y - R.head.y) / T;
      res.push({ c, key: dy > 0 ? 'height+' : 'height-', sev: Math.abs(dy) / TOL.headY, say: dy > 0 ? 'Lift up' : 'Stay down', detail: dy > 0 ? 'Your head dropped. Stay tall through the swing.' : 'Your head lifted. Keep your height through the ball.' });
    } else if (c === 'hips') {
      const v = (f.hip.x - R.hip.x) / T * R.fc;
      res.push({ c, key: v > 0 ? 'hips+' : 'hips-', sev: v > 0 ? v / TOL.hips : -v / TOL.hipsAway, say: v > 0 ? 'Hips back' : 'Hips forward', detail: v > 0 ? 'Your hips moved toward the ball. Keep your backside back.' : 'Your hips moved away from the ball.' });
    } else if (c === 'hipsway') {
      const dx = (f.hip.x - R.hip.x) / T;
      res.push({ c, key: dx > 0 ? 'sway+' : 'sway-', sev: Math.abs(dx) / TOL.hipsway, say: dx > 0 ? 'Hips right' : 'Hips left', detail: `Your hips slid to your ${dx > 0 ? 'left' : 'right'}. Rotate, don't slide.` });
    } else if (c === 'tilt') {
      const d = f.tilt - R.tilt;
      res.push({ c, key: d < 0 ? 'tilt-' : 'tilt+', sev: d < 0 ? -d / TOL.tilt : d / TOL.tiltUp, say: d < 0 ? 'Stay in posture' : 'Chest up', detail: d < 0 ? `You stood up out of your spine angle by ${Math.round(-d)}°.` : `You bent over ${Math.round(d)}° more than at address.` });
    }
  }
  return res;
};
LiveEngine.prototype.refZones = function (out, ds) {
  const R = this.ref, T = R.T, lv = s => s >= 1 ? 'out' : s >= 0.7 ? 'warn' : 'in', sev = k => Math.max(0, ...ds.filter(d => d.c === k).map(d => d.sev));
  if (this.checks.includes('head') || this.checks.includes('height')) {
    const rx = (this.checks.includes('head') ? TOL.headX[this.view] : 0.25) * T, ry = (this.checks.includes('height') ? TOL.headY : 0.25) * T;
    out.zones.push({ type: 'ellipse', x: R.head.x, y: R.head.y, rx, ry, lv: lv(Math.max(sev('head'), sev('height'))) });
  }
  if (this.checks.includes('hips')) { const x = R.hip.x + R.fc * TOL.hips * T; out.zones.push({ type: 'vline', x, y0: R.hip.y - 0.7 * T, y1: R.hip.y + 0.5 * T, lv: lv(sev('hips')) }); }
  if (this.checks.includes('hipsway')) for (const s of [-1, 1]) out.zones.push({ type: 'vline', x: R.hip.x + s * TOL.hipsway * T, y0: R.hip.y - 0.4 * T, y1: R.hip.y + 0.4 * T, lv: lv(sev('hipsway')) });
  if (this.checks.includes('tilt')) { const a = R.tilt * Math.PI / 180, L = T * 1.3; out.zones.push({ type: 'line', x0: R.hip.x, y0: R.hip.y, x1: R.hip.x + R.fc * Math.sin(a) * L, y1: R.hip.y - Math.cos(a) * L, lv: lv(sev('tilt')), dash: true, w: 2 }); }
};
LiveEngine.prototype.addLog = function (lv, text) { this.log.unshift({ lv, text }); if (this.log.length > 6) this.log.pop(); };

LiveEngine.prototype.swingStep = function (f, out) {
  const t = f.t, still = f.speed < 0.35;
  this.stillSince = still ? (this.stillSince == null ? t : this.stillSince) : null;
  const stillFor = this.stillSince == null ? 0 : t - this.stillSince;
  const handsLow = this.sp.crossed || f.wr.y > f.hip.y - 0.3 * f.T;
  const firstRef = !this.ref;
  if (this.state === 'find') {
    this.state = 'calib';
    if (!this.calibSaid) { out.say.push({ text: 'I can see you. Get set and hold still.', pri: 1 }); this.calibSaid = true; }
  }
  if (this.state === 'calib' || this.state === 'reset') {
    if (stillFor >= (this.state === 'calib' ? 1.0 : 0.7) && handsLow) {
      this.calibrate(); this.state = 'ready'; this.pre = [];
      out.say.push(firstRef ? { text: this.checks.includes('tempo') ? 'Locked in. Swing when ready, and I will time your tempo.' : 'Locked in. Swing when ready.', pri: 2 } : { text: 'Set', pri: 1, tone: 'ready' });
    } else {
      out.level = 'idle'; out.text = this.state === 'calib' ? 'Get into your setup and hold still' : 'Back to address and hold still';
      out.sub = this.sp.crossed ? 'Arms crossed on your chest' : 'Club down at address';
      return out;
    }
  }
  const R = this.ref, T = R.T;
  const disp = [11, 12, 13, 14, 15, 16].reduce((s, i) => s + dist(f.p[i], R.p[i]), 0) / 6 / T;
  const hh = (R.wr.y - f.wr.y) / T; // hands height above address
  const ds = this.devs(f);
  if (this.state === 'ready') {
    this.pre.push({ t, hh, hd: dist(f.wr, R.wr) / T }); while (this.pre.length && t - this.pre[0].t > 1.5) this.pre.shift();
    // drifted to a new stance without swinging: quietly re-lock
    if (stillFor >= 1.2 && handsLow && disp > 0.12 && disp < 0.6) { this.calibrate(); out.level = 'in'; out.text = 'Re-locked your address'; return out; }
    this.refZones(out, ds);
    if (disp > 0.18) { this.state = 'rep'; this.rep = { t0: t, frames: [], keys: {}, spoken: {}, maxHH: -9, topT: t, impactT: null, minShW: 9, ph: 'back', lo: null, pre: this.pre.slice() }; }
    else { out.level = 'in'; out.text = 'Locked in · swing when ready'; out.sub = `Reps ${this.reps} · in zone ${this.good}`; return out; }
  }
  if (this.state === 'rep') {
    const rp = this.rep;
    rp.frames.push({ t, hh, f, ds, ph: rp.ph });
    this.phase(rp, t, hh, f);
    const active = rp.ph !== 'through' || t <= rp.impactT + 0.12;
    if (active) for (const d of ds) {
      const k = rp.keys[d.key] || (rp.keys[d.key] = { vals: [], over: 0, d });
      k.vals.push(d.sev); if (d.sev > k.d.sev) k.d = d;
      k.over = d.sev >= 1 ? k.over + (rp.lastT ? t - rp.lastT : 0) : 0;
      // slow enough to correct mid-move: say it now
      if (k.over >= 0.4 && f.speed < 2.5 && !rp.spoken[d.c]) { out.say.push({ text: d.say, pri: 2 }); rp.spoken[d.c] = true; }
    }
    rp.lastT = t;
    this.refZones(out, active ? ds : []);
    const worst = active && ds.length ? ds.reduce((a, b) => b.sev > a.sev ? b : a) : null;
    out.level = worst && worst.sev >= 1 ? 'out' : worst && worst.sev >= 0.7 ? 'warn' : 'in';
    out.text = worst && worst.sev >= 1 ? worst.say : 'In zone'; out.sub = `Rep ${this.reps + 1}`;
    const back = disp < 0.2, through = rp.impactT != null, fin = this.sp.finish || this.sp.holdEnd;
    const endStill = still && ((stillFor >= (fin && through ? 0.3 : 0.6) && (back || through)) || (stillFor >= 3 && t - rp.t0 > 1.5));
    if (!endStill && through && t - rp.impactT > 2.5) {
      // never settled after the strike: walked off, or lost balance on a finish drill
      this.endRep(out, this.sp.finish ? { c: 'finish', key: 'wobble', sev: 1.5, say: 'Hold your finish', detail: 'You did not hold a still, balanced finish.' } : null); return out;
    }
    if (endStill || t - rp.t0 > 12) {
      if (this.sp.finish || this.sp.holdEnd) { this.state = 'count'; this.count = { t0: t, n: 0, need: this.sp.finish || this.sp.holdEnd, pos: { hip: f.hip, head: f.head }, high: f.wr.y < f.sh.y }; }
      else this.endRep(out);
    }
    return out;
  }
  if (this.state === 'count') {
    const c = this.count, held = t - c.t0, moved = (dist(f.hip, c.pos.hip) + dist(f.head, c.pos.head)) / 2 / T;
    if (moved > 0.12 || f.speed > 0.8) { this.endRep(out, held < c.need ? { key: 'wobble', sev: 1.5, say: 'Hold your balance', detail: `You moved after ${held.toFixed(1)} seconds. Hold the position for ${c.need}.` } : null); return out; }
    const n = Math.floor(held);
    if (n > c.n && n < c.need) { c.n = n; out.say.push({ text: WORDS[n - 1], pri: 3, force: true }); }
    out.level = 'in'; out.text = `Hold it… ${held.toFixed(1)} / ${c.need}s`; out.sub = this.sp.finish ? 'Balanced finish' : 'Hold the impact position';
    if (held >= c.need) this.endRep(out, null);
    return out;
  }
  return out;
};

// backswing -> downswing -> through. Impact = low point of the hands after the top
// (works when the strike falls between two camera frames).
LiveEngine.prototype.phase = function (rp, t, hh, f) {
  if (this.sp.crossed) { rp.minShW = Math.min(rp.minShW, f.shW / this.ref.shW); rp.maxHH = Math.max(rp.maxHH, hh); return; }
  const fr = rp.frames, n = fr.length - 1, lim = this.sp.impactLo || 0.45;
  if (rp.ph === 'back') {
    if (hh > rp.maxHH) { rp.maxHH = hh; rp.topT = t; }
    rp.minShW = Math.min(rp.minShW, f.shW / this.ref.shW);
    if (rp.maxHH > 0.6 && hh < rp.maxHH - 0.3) { rp.ph = 'down'; rp.lo = { hh, i: n }; rp.downT = n > 0 ? fr[n - 1].t : t; }
  } else if (rp.ph === 'down') {
    if (hh < rp.lo.hh) rp.lo = { hh, i: n };
    let hit = null;
    if (hh <= 0.15) hit = n;                                    // stopped at impact (impact bag) or slow swing
    else if (hh > rp.lo.hh + 0.25) {
      // passed through the low point; or a fast, deep dip-and-rise (the strike fell between camera frames)
      const quick = !this.sp.impactLo && t - rp.downT <= 0.5 && rp.lo.hh < rp.maxHH * 0.75;
      if (rp.lo.hh <= lim || quick) hit = rp.lo.i;
      else { rp.ph = 'back'; return; }                          // pump: back up without striking
    }
    if (hit != null) {
      // time where hands cross a level just above the low point, on the way down and up: impact = midpoint
      const L = Math.min(rp.lo.hh, hh) + 0.1, cross = (a, b) => a.t + (b.t - a.t) * (a.hh - L) / ((a.hh - b.hh) || 1);
      let tD = fr[hit].t, tU = fr[hit].t;
      for (let i = hit; i > 0; i--) if (fr[i - 1].hh >= L && fr[i].hh < L + 1e-9) { tD = cross(fr[i - 1], fr[i]); break; }
      for (let i = hit; i < n; i++) if (fr[i].hh < L + 1e-9 && fr[i + 1].hh >= L) { tU = cross(fr[i], fr[i + 1]); break; }
      rp.impactT = hit === n && hh <= 0.15 ? tD : (tD + tU) / 2; rp.ph = 'through';
    }
  }
};

// summarise one rep: worst faults + rep-level checks
LiveEngine.prototype.endRep = function (out, extra) {
  const rp = this.rep, R = this.ref, faults = [], info = [];
  for (const k of Object.values(rp.keys)) {
    const v = k.vals.slice().sort((a, b) => b - a), robust = v.length >= 2 ? v[1] : (v[0] || 0) * 0.8;
    if (robust >= 1) faults.push(Object.assign({}, k.d, { sev: robust }));
  }
  const fr = rp.frames, topFr = fr.filter(x => x.ph === 'back' && x.hh >= rp.maxHH - 0.1);
  if (this.checks.includes('arm') && rp.maxHH > 0.8 && topFr.length) {
    const L = this.right ? [11, 13, 15] : [12, 14, 16];
    const best = Math.max(...topFr.map(x => ang3(x.f.p[L[0]], x.f.p[L[1]], x.f.p[L[2]])));
    if (best < 155) faults.push({ c: 'arm', key: 'arm', sev: (165 - best) / 10, say: 'Straighten your lead arm', detail: `Lead arm bent to about ${Math.round(best)}° at the top. Keep it long, around 160° or more.` });
    else info.push(`Lead arm ${Math.round(best)}° at the top`);
  }
  if (this.checks.includes('turn')) {
    if (rp.minShW > 0.55) faults.push({ c: 'turn', key: 'turn', sev: 1 + (rp.minShW - 0.55) * 4, say: 'Turn more', detail: 'Your shoulder turn looked short. Turn until your lead shoulder is under your chin.' });
    else info.push('Full shoulder turn');
  }
  if (this.checks.includes('pause') && rp.maxHH > 0.6) {
    const dur = topFr.length ? topFr[topFr.length - 1].t - topFr[0].t : 0;
    if (dur < 0.6) faults.push({ c: 'pause', key: 'pause', sev: 1 + (0.6 - dur) * 2, say: 'Hold the top longer', detail: `You paused about ${dur.toFixed(1)} s at the top. Aim for a full second.` });
    else info.push(`Paused ${dur.toFixed(1)} s at the top`);
  }
  let tempoSay = null;
  if (this.checks.includes('tempo')) {
    const tm = this.tempo(rp);
    if (tm) {
      const r = tm.back / tm.down, rs = r.toFixed(1);
      info.push(`Backswing ${tm.back.toFixed(2)} s · downswing ${tm.down.toFixed(2)} s`);
      if (r < 2.4) { faults.push({ c: 'tempo', key: 'tempo', sev: 1 + (2.4 - r), say: `Tempo ${rs} to 1. Slow your backswing`, detail: `Tempo ${rs}:1. Take the club back more smoothly (aim for 3:1).` }); }
      else if (r > 3.6) { faults.push({ c: 'tempo', key: 'tempo', sev: 1 + (r - 3.6) / 2, say: `Tempo ${rs} to 1. Smoother, quicker backswing`, detail: `Tempo ${rs}:1. Your backswing is long and slow compared with the downswing (aim for 3:1).` }); }
      else tempoSay = `Tempo ${rs} to 1. In zone`;
    } else info.push('Tempo not measured (swing to the top and through)');
  }
  if (this.sp.finish && this.count && !this.count.high) faults.push({ c: 'finish', key: 'finishlow', sev: 1.2, say: 'Finish higher', detail: 'Your hands finished low. Rotate all the way to a high, balanced finish.' });
  if (extra) faults.push(extra);
  faults.sort((a, b) => b.sev - a.sev);
  this.reps++;
  if (!faults.length) {
    this.good++;
    out.say.push({ text: tempoSay || (this.sp.finish ? 'In zone. Great balance.' : 'In zone. Nice rep.'), pri: 3, tone: 'good' });
    this.addLog('good', `Rep ${this.reps}: in zone${info.length ? ' · ' + info.join(' · ') : ''}`);
    out.level = 'in'; out.text = 'In zone. Nice rep';
  } else {
    const top = faults.slice(0, 2), uniq = top.filter((x, i) => top.findIndex(y => y.c === x.c) === i);
    out.say.push({ text: uniq.map(x => x.say).join('. '), pri: 3, tone: 'bad' });
    this.addLog(faults[0].sev >= 1.6 ? 'out' : 'warn', `Rep ${this.reps}: ${uniq.map(x => x.detail).join(' ')}${info.length ? ' · ' + info.join(' · ') : ''}`);
    out.level = 'out'; out.text = uniq[0].say; out.detail = uniq.map(x => x.detail).join(' ');
  }
  out.repDone = true; this.lastRep = { faults, info, good: !faults.length };
  this.state = 'reset'; this.rep = null; this.count = null; this.stillSince = null;
};

// tempo: takeaway (hands leave address), top (plateau centre), impact (hands back down)
LiveEngine.prototype.tempo = function (rp) {
  if (rp.maxHH < 0.8 || rp.impactT == null) return null;
  const seq = rp.pre.concat(rp.frames.map(x => ({ t: x.t, hd: dist(x.f.wr, this.ref.wr) / this.ref.T })));
  let t0 = null;
  for (let i = 1; i < seq.length; i++) if (seq[i].hd >= 0.1 && seq[i - 1].hd < 0.1) { const a = seq[i - 1], b = seq[i]; t0 = a.t + (b.t - a.t) * (0.1 - a.hd) / ((b.hd - a.hd) || 1); }
  const top = rp.frames.filter(x => x.ph === 'back' && x.hh >= rp.maxHH - 0.08);
  if (t0 == null || !top.length) return null;
  const topT = top.reduce((s, x) => s + x.t, 0) / top.length;
  const back = topT - t0, down = rp.impactT - topT;
  if (back <= 0.2 || down <= 0.05) return null;
  return { back, down };
};

// ---------- UI ----------
const css = `
.lv{position:fixed;inset:0;z-index:60;background:#07110b;color:#eef5ec;display:flex;flex-direction:column;overflow:auto;-webkit-overflow-scrolling:touch}
.lv[hidden]{display:none}
.lvTop{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) max(16px,env(safe-area-inset-right,0px)) 12px max(16px,env(safe-area-inset-left,0px));background:#0b1d11;position:sticky;top:0;z-index:2}
.lvTop h2{font:600 1.05rem/1.2 'Playfair Display',Georgia,serif;margin:0;flex:1;min-width:0}
.lvTop h2 small{display:block;font:500 .78rem/1.3 system-ui,sans-serif;color:#9fb8a5;margin-top:2px}
.lvX{background:transparent;border:1px solid #2c4a35;color:#eef5ec;border-radius:12px;width:44px;height:44px;min-height:44px;flex:none;margin-left:auto;font-size:1.15rem;cursor:pointer;touch-action:manipulation}
.lvBody{padding:12px 16px calc(24px + env(safe-area-inset-bottom,0px));max-width:760px;width:100%;margin:0 auto;box-sizing:border-box}
.lvSet{display:grid;gap:10px}
.lvSet p{margin:0;color:#c8d8cc;font-size:.92rem;line-height:1.45}
.lvRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.lvSeg{display:inline-flex;border:1px solid #2c4a35;border-radius:999px;overflow:hidden}
.lvSeg button{background:transparent;color:#cfe0d3;border:0;padding:8px 12px;font:600 .82rem system-ui,sans-serif;cursor:pointer}
.lvSeg button.on{background:#4cbf74;color:#07110b}
.lvLbl{font:600 .72rem system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#8fa995;min-width:64px}
.lvGo{background:#4cbf74;color:#07110b;border:0;border-radius:12px;padding:12px 18px;font:700 1rem system-ui,sans-serif;cursor:pointer}
.lvGo:disabled{opacity:.5}
.lvAlt{background:transparent;color:#cfe0d3;border:1px solid #2c4a35;border-radius:12px;padding:10px 14px;font:600 .88rem system-ui,sans-serif;cursor:pointer}
.lvStage{position:relative;margin:12px auto 0;background:#000;border-radius:14px;overflow:hidden;max-height:62vh;max-width:100%}
.lvStage video,.lvStage canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.lvStage.mir video,.lvStage.mir canvas{transform:scaleX(-1)}
.lvStatus{margin-top:10px;border-radius:14px;padding:12px 14px;background:#16261b;border:2px solid #2c4a35;transition:background .15s,border-color .15s}
.lvStatus b{display:block;font:800 1.5rem/1.15 system-ui,sans-serif}
.lvStatus span{display:block;color:#c8d8cc;font-size:.88rem;margin-top:4px}
.lvStatus.in{border-color:#46c06e;background:#123321}.lvStatus.in b{color:#7ee09f}
.lvStatus.warn{border-color:#e0b13a;background:#33290f}.lvStatus.warn b{color:#f2cd6a}
.lvStatus.out{border-color:#ef6b5e;background:#3a1714}.lvStatus.out b{color:#ff9488}
.lvStats{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font:600 .82rem system-ui,sans-serif;color:#9fb8a5}
.lvStats b{color:#eef5ec}
.lvLog{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}
.lvLog li{padding:8px 10px;border-radius:10px;background:#122017;border-left:4px solid #2c4a35;font-size:.86rem;line-height:1.4;color:#d7e5da}
.lvLog li.good{border-left-color:#46c06e}.lvLog li.warn{border-left-color:#e0b13a}.lvLog li.out{border-left-color:#ef6b5e}
.lvMsg{color:#f2cd6a;font-size:.9rem;line-height:1.45}
.lvKey{display:flex;gap:12px;flex-wrap:wrap;font-size:.78rem;color:#9fb8a5;margin-top:6px}
.lvKey i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}
`;
const COL = { in: '#46c06e', warn: '#e0b13a', out: '#ef6b5e', idle: '#9fb8a5' };
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function Speaker() {
  this.mode = 'voice'; this.last = {}; this.lastAt = -99; this.ac = null; this.voice = null;
  const ss = root.speechSynthesis;
  if (ss) { const pick = () => { const vs = ss.getVoices() || []; this.voice = vs.find(v => /en[-_]GB/i.test(v.lang) && /natural|enhanced|premium|daniel|serena|kate/i.test(v.name)) || vs.find(v => /en[-_]GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; }; pick(); try { ss.addEventListener('voiceschanged', pick); } catch (_) {} }
}
Speaker.prototype.unlock = function () {
  try { const AC = root.AudioContext || root.webkitAudioContext; if (AC && !this.ac) this.ac = new AC(); if (this.ac && this.ac.state === 'suspended') this.ac.resume(); } catch (_) {}
  try { if (root.speechSynthesis && this.mode === 'voice') { const u = new SpeechSynthesisUtterance('Starting'); u.volume = 0.6; if (this.voice) u.voice = this.voice; speechSynthesis.speak(u); } } catch (_) {}
};
Speaker.prototype.tone = function (kind) {
  const ac = this.ac; if (!ac) return;
  const seq = { good: [[660, 0, .09], [880, .1, .14]], bad: [[240, 0, .2]], ready: [[520, 0, .07]], count: [[700, 0, .06]], tick: [[1200, 0, .03]], tock: [[800, 0, .05]] }[kind] || [[600, 0, .08]];
  const t0 = ac.currentTime + 0.01;
  for (const [fq, at, d] of seq) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = fq; o.type = 'sine'; g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.25, t0 + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + d); o.connect(g); g.connect(ac.destination); o.start(t0 + at); o.stop(t0 + at + d + 0.02); }
};
Speaker.prototype.say = function (s) {
  const now = performance.now() / 1000;
  if (!s.force && now - (this.last[s.text] || -99) < 4) return false;
  if (!s.force && now - this.lastAt < 1.5) {
    // too soon after the last cue: keep the most important one waiting rather than dropping it
    if ((s.pri || 0) >= 2 && (!this.pending || s.pri >= this.pending.pri)) {
      this.pending = s; clearTimeout(this.pt);
      this.pt = setTimeout(() => { const q = this.pending; this.pending = null; if (q) this.say(q); }, (this.lastAt + 1.5 - now) * 1000 + 30);
    }
    return false;
  }
  if (this.pending && this.pending !== s && (s.pri || 0) >= (this.pending.pri || 0)) { this.pending = null; clearTimeout(this.pt); }
  this.lastAt = now; this.last[s.text] = now;
  if (this.mode === 'off') return true;
  if (this.mode === 'tones' || !root.speechSynthesis) { this.tone(s.tone || (/^(one|two|three|four|five|six)$/i.test(s.text) ? 'count' : /in zone|nice|perfect|locked/i.test(s.text) ? 'good' : 'bad')); return true; }
  try { if (s.pri >= 2 && speechSynthesis.speaking) speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(s.text); u.rate = 1.08; u.lang = 'en-GB'; if (this.voice) u.voice = this.voice; speechSynthesis.speak(u); } catch (_) {}
  return true;
};
Speaker.prototype.stop = function () { this.pending = null; clearTimeout(this.pt); try { root.speechSynthesis && speechSynthesis.cancel(); } catch (_) {} };

const LiveUI = {
  el: null, run: false,
  ensure() {
    if (this.el) return;
    injectCss();
    const el = document.createElement('div'); el.className = 'lv'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Live drill feedback');
    el.innerHTML = `<div class="lvTop"><h2 id="lvTitle">Live feedback<small></small></h2><button type="button" class="lvX" aria-label="Close live feedback">✕</button></div>
<div class="lvBody">
 <div class="lvSet" id="lvSet">
  <p id="lvHow"></p>
  <div class="lvRow"><span class="lvLbl">Camera</span><span class="lvSeg" id="lvView"></span></div>
  <div class="lvRow"><span class="lvLbl">Golfer</span><span class="lvSeg" id="lvHand"><button type="button" data-v="right">Right-handed</button><button type="button" data-v="left">Left-handed</button></span></div>
  <div class="lvRow"><span class="lvLbl">Lens</span><span class="lvSeg" id="lvLens"><button type="button" data-v="user">Front (screen faces you)</button><button type="button" data-v="environment">Back</button></span></div>
  <div class="lvRow"><span class="lvLbl">Sound</span><span class="lvSeg" id="lvSound"><button type="button" data-v="voice">Voice</button><button type="button" data-v="tones">Tones</button><button type="button" data-v="off">Off</button></span></div>
  <div class="lvRow" id="lvMetroRow" hidden><span class="lvLbl">Beat</span><span class="lvSeg" id="lvMetro"><button type="button" data-v="0">Off</button><button type="button" data-v="75">75 bpm</button><button type="button" data-v="70">70 bpm</button><button type="button" data-v="80">80 bpm</button></span></div>
  <p>Headphones work well: cues play through whatever audio your phone is using. Keep the volume up and the screen on.</p>
  <div class="lvRow"><button type="button" class="lvGo" id="lvStart">Start camera</button><label class="lvAlt" for="lvFile">Use a video instead</label><input type="file" id="lvFile" accept="video/*" hidden></div>
  <div class="lvMsg" id="lvMsg" role="status"></div>
 </div>
 <div id="lvRun" hidden>
  <div class="lvStage" id="lvStage"><video id="lvVid" playsinline muted autoplay></video><canvas id="lvCan"></canvas></div>
  <div class="lvStatus" id="lvStatus" aria-live="polite"><b>Starting…</b><span></span></div>
  <div class="lvStats" id="lvStats"></div>
  <div class="lvKey"><span><i style="background:#46c06e"></i>In zone</span><span><i style="background:#e0b13a"></i>Edge of zone</span><span><i style="background:#ef6b5e"></i>Out of zone</span></div>
  <div class="lvRow" style="margin-top:10px"><button type="button" class="lvAlt" id="lvRecal">Re-lock position</button><button type="button" class="lvAlt" id="lvStop">Stop</button></div>
  <ul class="lvLog" id="lvLog"></ul>
 </div>
</div>`;
    document.body.appendChild(el); this.el = el;
    const q = s => el.querySelector(s); this.q = q;
    q('.lvX').onclick = () => this.close();
    el.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    const seg = (id, key, cb) => q(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.opt[key] = b.dataset.v; this.paintSeg(); cb && cb(); });
    seg('#lvView', 'view', () => this.paintHow()); seg('#lvHand', 'hand'); seg('#lvLens', 'lens'); seg('#lvSound', 'sound', () => { this.spk.mode = this.opt.sound; try { localStorage.setItem('cc_live_sound', this.opt.sound); } catch (_) {} }); seg('#lvMetro', 'metro', () => this.metro());
    q('#lvStart').onclick = () => this.start('camera');
    q('#lvFile').onchange = e => { const fl = e.target.files && e.target.files[0]; e.target.value = ''; if (fl) this.start('file', fl); };
    q('#lvStop').onclick = () => this.stop(true);
    q('#lvRecal').onclick = () => { if (this.eng) { this.eng.reset(); this.spk.say({ text: 'Get set and hold still', force: true, pri: 2 }); } };
    this.spk = new Speaker();
  },
  paintSeg() {
    for (const [id, k] of [['#lvView', 'view'], ['#lvHand', 'hand'], ['#lvLens', 'lens'], ['#lvSound', 'sound'], ['#lvMetro', 'metro']]) this.q(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(this.opt[k])));
  },
  paintHow() {
    const sp = SPECS[this.d.id] || {}, v = this.opt.view;
    const cam = v === 'dtl' ? 'Prop your phone 2–3 m away, side-on to you (down the line), at about hip height, so you are in profile.' : 'Prop your phone 2–3 m in front of you, at about hip height, so you face it square on.';
    const what = sp.mode === 'hold' ? `Get into position and the voice will guide you into the zone (spine tilt, knee flex${sp.arms ? ' and arm hang' : ''}), then count you through a ${sp.hold}-second hold.`
      : `Set up and hold still for a second so it can lock your position. Then make your reps: you'll hear a cue straight away if you drift out of the zone during slow moves, and a verdict after each rep${sp.finish ? ', plus a count while you hold your finish' : sp.holdEnd ? ', plus a count while you hold the impact position' : ''}.`;
    this.q('#lvHow').textContent = `${cam} Your whole body, head to feet, needs to be in the picture. ${what}`;
  },
  async open(d, deps) {
    this.ensure(); this.d = d; this.deps = deps;
    const sp = SPECS[d.id] || { views: ['face', 'dtl'] };
    let snd = 'voice'; try { snd = localStorage.getItem('cc_live_sound') || 'voice'; } catch (_) {}
    this.opt = { view: sp.views[0], hand: deps.hand || 'right', lens: 'user', sound: snd, metro: '0' };
    this.spk.mode = snd;
    this.q('#lvTitle small').textContent = d.name;
    this.q('#lvView').innerHTML = sp.views.map(v => `<button type="button" data-v="${v}">${v === 'dtl' ? 'Side-on (down the line)' : 'Facing you (face-on)'}</button>`).join('');
    this.q('#lvMetroRow').hidden = !sp.metro;
    this.paintSeg(); this.paintHow();
    this.q('#lvSet').hidden = false; this.q('#lvRun').hidden = true; this.q('#lvMsg').textContent = '';
    this.el.hidden = false; document.documentElement.style.overflow = 'hidden';
    this.q('.lvX').focus();
    deps.onOpen && deps.onOpen();
  },
  msg(t) { this.q('#lvMsg').textContent = t; },
  async start(src, file) {
    const q = this.q, v = q('#lvVid');
    this.spk.unlock(); this.metro();
    q('#lvStart').disabled = true; this.msg('Loading body tracking…');
    let pose;
    try { pose = await this.deps.getPose(); } catch (e) { q('#lvStart').disabled = false; this.msg('Body tracking could not load. Check your connection and try again.'); return; }
    if (src === 'camera') {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { q('#lvStart').disabled = false; this.msg('This browser does not give the app camera access here. Open the app in Safari or Chrome directly, or tap "Use a video instead" to get the same feedback on a recording.'); return; }
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.opt.lens, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false });
      } catch (e) {
        q('#lvStart').disabled = false;
        const n = e && e.name;
        this.msg(n === 'NotAllowedError' || n === 'SecurityError' ? 'Camera access was blocked. Allow camera access for this page in your browser settings (on iPhone: Settings › Safari › Camera › Allow), then tap Start again. If you opened the app inside another app, try opening it in Safari or Chrome. You can also tap "Use a video instead".'
          : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'No camera was found. Try the other lens, or tap "Use a video instead".' : 'The camera could not start (' + (n || 'unknown error') + '). Tap Start to try again, or use a video instead.');
        return;
      }
      v.srcObject = this.stream; v.muted = true; this.src = 'camera';
      q('#lvStage').classList.toggle('mir', this.opt.lens === 'user');
    } else {
      this.url = URL.createObjectURL(file); v.srcObject = null; v.src = this.url; v.muted = true; v.loop = false; this.src = 'file';
      q('#lvStage').classList.remove('mir');
    }
    try { await v.play(); } catch (_) {}
    await new Promise(r => { if (v.videoWidth) r(); else { v.onloadedmetadata = () => r(); setTimeout(r, 4000); } });
    if (!v.videoWidth) { this.stop(false); q('#lvStart').disabled = false; this.msg(src === 'file' ? 'That video could not be played in this browser. iPhone HEVC videos play in Safari; in other browsers choose a different video.' : 'The camera started but sent no picture. Tap Start to try again.'); return; }
    q('#lvStage').style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight;
    q('#lvSet').hidden = true; q('#lvRun').hidden = false; q('#lvStart').disabled = false; this.msg('');
    try { if (navigator.wakeLock) this.wake = await navigator.wakeLock.request('screen'); } catch (_) {}
    this.eng = new LiveEngine(this.d.id, { right: this.opt.hand !== 'left', view: this.opt.view });
    this.spk.say({ text: src === 'camera' ? 'Camera on. Step into view.' : 'Checking your video.', force: true, pri: 2 });
    this.run = true; this.loop(pose, v);
  },
  async loop(pose, v) {
    const my = (this.tok = (this.tok || 0) + 1), smp = this.deps.makeSampler(), cv = document.createElement('canvas'), cx = cv.getContext('2d');
    const can = this.q('#lvCan'), x = can.getContext('2d');
    let roi = null, fps = 0, lastT = performance.now(), cost = 0;
    if (this.src === 'file') { v.playbackRate = 0.5; }
    while (this.run && this.tok === my) {
      if (this.src === 'file' && v.ended) { this.finishFile(); break; }
      const vw = v.videoWidth, vh = v.videoHeight;
      if (!vw || v.readyState < 2) { await sleep(60); continue; }
      const sc = Math.min(1, 480 / Math.max(vw, vh)), W = Math.round(vw * sc), H = Math.round(vh * sc);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      cx.drawImage(v, 0, 0, W, H);
      const t = this.src === 'file' ? v.currentTime : performance.now() / 1000;
      const c0 = performance.now();
      let r = null; try { r = pose.track({ width: W, height: H }, roi, smp(cv)); } catch (_) { r = null; }
      roi = r ? r.next : null;
      const out = this.eng.push(t, r ? r.pts : null, W, H);
      const now = performance.now(); cost = cost ? cost * 0.8 + (now - c0) * 0.2 : now - c0;
      fps = fps ? fps * 0.85 + 1000 / Math.max(1, now - lastT) * 0.15 : 1000 / Math.max(1, now - lastT); lastT = now;
      // recorded video: slow playback so tracking sees ~10 frames per second of swing
      if (this.src === 'file') v.playbackRate = Math.max(0.1, Math.min(1, Math.round(fps / 10 * 20) / 20));
      if (out.viewChanged) { this.opt.view = out.viewChanged; this.paintSeg(); }
      for (const s of out.say) this.spk.say(s);
      this.draw(x, can, out, W, H);
      this.status(out, fps);
      await new Promise(r2 => (root.requestAnimationFrame ? requestAnimationFrame(() => r2()) : setTimeout(r2, 0)));
    }
  },
  draw(x, can, out, W, H) {
    if (can.width !== W || can.height !== H) { can.width = W; can.height = H; }
    x.clearRect(0, 0, W, H);
    const lw = Math.max(2, W / 200);
    x.lineCap = 'round';
    for (const z of out.zones) {
      const c = COL[z.lv] || COL.idle; x.strokeStyle = c; x.fillStyle = c; x.lineWidth = (z.w || 2.5) * lw / 2; x.setLineDash(z.dash ? [lw * 3, lw * 2.5] : []);
      x.beginPath();
      if (z.type === 'ellipse') { x.globalAlpha = 0.18; x.ellipse(z.x, z.y, z.rx, z.ry, 0, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; x.stroke(); }
      else if (z.type === 'vline') { x.moveTo(z.x, z.y0); x.lineTo(z.x, z.y1); x.stroke(); }
      else if (z.type === 'line') { x.moveTo(z.x0, z.y0); x.lineTo(z.x1, z.y1); x.stroke(); }
      else if (z.type === 'dot') { x.globalAlpha = 0.25; x.arc(z.x, z.y, z.r, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; x.stroke(); }
      else if (z.type === 'wedge') { x.globalAlpha = 0.32; x.moveTo(z.x, z.y); x.lineTo(z.a.x, z.a.y); x.lineTo(z.b.x, z.b.y); x.closePath(); x.fill(); x.globalAlpha = 0.9; x.setLineDash([lw * 2, lw * 2]); x.beginPath(); x.moveTo(z.a.x, z.a.y); x.lineTo(z.x, z.y); x.lineTo(z.b.x, z.b.y); x.stroke(); x.globalAlpha = 1; }
    }
    x.setLineDash([]);
    const P = out.pts; if (!P) return;
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = lw;
    x.beginPath(); for (const [a, b] of BONES) { x.moveTo(P[a].x, P[a].y); x.lineTo(P[b].x, P[b].y); } x.stroke();
    x.fillStyle = COL[out.level] || '#fff';
    const hd = { x: (P[0].x + P[7].x + P[8].x) / 3, y: (P[0].y + P[7].y + P[8].y) / 3 };
    x.beginPath(); x.arc(hd.x, hd.y, lw * 2.2, 0, Math.PI * 2); x.fill();
    for (const i of [11, 12, 15, 16, 23, 24, 25, 26, 27, 28]) { x.beginPath(); x.arc(P[i].x, P[i].y, lw * 1.1, 0, Math.PI * 2); x.fill(); }
  },
  status(out, fps) {
    const st = this.q('#lvStatus');
    const hold = this.lastRepUntil && performance.now() < this.lastRepUntil;
    if (out.repDone) { this.lastRepUntil = performance.now() + 2500; this.paintLog(); }
    if (!out.repDone && hold && out.level !== 'out' && out.level !== 'warn') { /* keep the rep verdict on screen briefly */ }
    else { st.className = 'lvStatus ' + out.level; st.querySelector('b').textContent = out.text || ''; st.querySelector('span').textContent = out.detail || out.sub || ''; }
    const e = this.eng;
    this.q('#lvStats').innerHTML = `<span>Reps <b>${e.reps}</b></span><span>In zone <b>${e.good}</b></span><span>Tracking <b>${fps.toFixed(0)}</b> fps</span>${this.src === 'file' ? '<span>Video slowed so every frame is checked</span>' : ''}`;
  },
  paintLog() { this.q('#lvLog').innerHTML = this.eng.log.map(l => `<li class="${l.lv}">${this.deps.esc(l.text)}</li>`).join(''); },
  finishFile() {
    const e = this.eng, st = this.q('#lvStatus');
    st.className = 'lvStatus ' + (e.reps ? (e.good === e.reps ? 'in' : 'warn') : 'idle');
    st.querySelector('b').textContent = e.reps ? `Video done: ${e.good} of ${e.reps} reps in zone` : 'Video done: no complete reps found';
    st.querySelector('span').textContent = e.reps ? 'Your rep-by-rep notes are below.' : 'Make sure your whole body is in view and you hold still at address for a second before each rep.';
    this.paintLog(); this.run = false;
  },
  metro() {
    clearInterval(this.mt); this.mt = null;
    const bpm = +this.opt.metro; if (!bpm || !this.el || this.el.hidden) return;
    this.spk.unlock(); let n = 0;
    this.mt = setInterval(() => { this.spk.tone(n % 4 === 3 ? 'tock' : 'tick'); n++; }, 60000 / bpm);
  },
  stop(showSetup) {
    this.run = false; this.tok = (this.tok || 0) + 1;
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    const v = this.q && this.q('#lvVid'); if (v) { try { v.pause(); } catch (_) {} v.srcObject = null; v.removeAttribute('src'); try { v.load(); } catch (_) {} }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    if (this.wake) { try { this.wake.release(); } catch (_) {} this.wake = null; }
    this.spk && this.spk.stop();
    if (showSetup && this.q) { this.q('#lvRun').hidden = true; this.q('#lvSet').hidden = false; }
  },
  close() {
    this.stop(false); clearInterval(this.mt); this.mt = null;
    if (this.el) this.el.hidden = true; document.documentElement.style.overflow = '';
    this.deps && this.deps.onClose && this.deps.onClose();
  },
};

let cssDone = false;
function injectCss() { if (cssDone) return; cssDone = true; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
const api = { LiveEngine, LiveUI, SPECS, Speaker, injectCss, COL, sleep };
if (typeof module !== 'undefined') module.exports = api; else root.LiveCoach = api;
})(typeof window !== 'undefined' ? window : this);
