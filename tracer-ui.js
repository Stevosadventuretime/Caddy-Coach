// Caddy Coach shot tracer UI: detection pipeline in the browser, animated tracer, editing and export.
// Needs tracer.js (window.Tracer), pose.js, metrics.js. deps: {getPose, makeSampler, esc, hand()}
(function (root) {
'use strict';
const T = () => root.Tracer;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const YD = 0.9144;
const COLORS = [['#ff3b30', 'Red'], ['#ffd60a', 'Yellow'], ['#ffffff', 'White'], ['#34c759', 'Green'], ['#0a84ff', 'Blue'], ['#ff9f0a', 'Orange'], ['#ff2d92', 'Pink']];

const TracerUI = {
  st: null,
  init(el, deps) {
    this.el = el; this.deps = deps; const q = s => el.querySelector(s); this.q = q;
    let col = '#ff3b30', club = '7i'; try { col = localStorage.getItem('cc_tr_col') || col; club = localStorage.getItem('cc_tr_club') || localStorage.getItem('cc_setup_club') || club; } catch (_) {}
    this.style = { color: col, width: 'med', glow: true };
    q('#trClub').innerHTML = T().CLUBS.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); q('#trClub').value = club;
    q('#trClub').onchange = e => { try { localStorage.setItem('cc_tr_club', e.target.value); } catch (_) {} if (this.st) { this.st.club = T().CLUBS.find(c => c.id === e.target.value); this.paintEdit(); this.render(); } };
    q('#trFile').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) this.load(f); };
    q('#trRec').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) this.load(f); };
    q('#trPlay').onclick = () => this.togglePlay();
    q('#trReplay').onclick = () => this.replay();
    q('#trSeek').oninput = e => this.seekTo(+e.target.value);
    q('#trReset').onclick = () => { if (this.st && this.st.auto) { Object.assign(this.st.shot, JSON.parse(JSON.stringify(this.st.auto.shot))); this.st.start = Object.assign({}, this.st.auto.start); this.st.t0 = this.st.auto.t0; this.st.strike = null; this.rebuildCam(); this.fitCorr(); this.paintEdit(); this.finish(); } };
    q('#trSaveVid').onclick = () => { if (this.ready) this.saveReady(); else this.exportVideo(); };
    q('#trSaveImg').onclick = () => this.exportImage();
    q('#trRetry').onclick = () => { if (this.file) this.load(this.file); };
    const ag = q('#trAgain'); if (ag) ag.onclick = () => { if (this.file) this.load(this.file); };
    // shapes, strike, colours
    q('#trShapes').innerHTML = Object.entries(T().SHAPES).map(([k, s]) => `<button type="button" class="chip" data-shape="${k}">${s.name}</button>`).join('');
    q('#trStrike').innerHTML = T().STRIKES.map(s => `<button type="button" class="chip" data-strike="${s}">${s}</button>`).join('');
    q('#trColors').innerHTML = COLORS.map(([c, n]) => `<button type="button" class="sw" data-col="${c}" style="--c:${c}" aria-label="${n}" title="${n}"></button>`).join('') + `<label class="sw cust" title="Custom colour"><input type="color" id="trCustom" value="${col}" aria-label="Custom colour"></label>`;
    el.addEventListener('click', e => {
      const sh = e.target.closest('[data-shape]'); if (sh && this.st) { this.edited(); const s = T().applyShape(this.st.shot, sh.dataset.shape, this.lefty()); Object.assign(this.st.shot, s); this.paintEdit(); this.finish(); return; }
      const sk = e.target.closest('[data-strike]'); if (sk && this.st) { this.st.strike = this.st.strike === sk.dataset.strike ? null : sk.dataset.strike; this.paintEdit(); this.render(); return; }
      const c = e.target.closest('[data-col]'); if (c) { this.setColor(c.dataset.col); return; }
      const w = e.target.closest('[data-w]'); if (w) { this.style.width = w.dataset.w; this.paintEdit(); this.render(); }
    });
    q('#trCustom').oninput = e => this.setColor(e.target.value);
    const bind = (id, fn) => { q(id).oninput = e => { if (!this.st) return; this.edited(); fn(+e.target.value); this.paintEdit(true); this.finish(); }; };
    bind('#trCarry', v => { const s = this.st.shot, a = s.curve / s.D; s.D = v * YD; s.curve = a * s.D; });
    bind('#trApex', v => { this.st.shot.H = v * YD; });
    bind('#trStartDir', v => { this.st.shot.az = (this.lefty() ? -v : v) * Math.PI / 180; });
    bind('#trCurve', v => { this.st.shot.curve = (this.lefty() ? -v : v) / 100 * this.st.shot.D; });
    bind('#trTime', v => { this.st.t0 = this.st.auto.t0 + v / 1000; });
    // dragging the start and landing handles on the picture
    const cv = q('#trCan');
    const at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * cv.width, y: (e.clientY - r.top) / r.height * cv.height, s: cv.width / r.width }; };
    cv.addEventListener('pointerdown', e => {
      if (!this.st || !this.st.handles) return; const p = at(e), hs = this.st.handles, rr = 28 * p.s;
      const which = Math.hypot(p.x - hs.land.x, p.y - hs.land.y) < rr ? 'land' : Math.hypot(p.x - hs.start.x, p.y - hs.start.y) < rr ? 'start' : null;
      if (!which) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); this.drag = which; this.pause(); this.showFull = true;
      this.dragFrom = { y: e.clientY, D: this.st.shot.D };
    });
    cv.addEventListener('pointermove', e => { if (!this.drag) return; const p = at(e); this.dragTo(this.drag, p.x / this.k, p.y / this.k, e.clientY); });
    const up = () => { if (this.drag) { this.drag = null; this.paintEdit(); this.render(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    this.paintEdit();
  },
  lefty() { return this.deps.hand() === 'left'; },
  setColor(c) { this.style.color = c; try { localStorage.setItem('cc_tr_col', c); } catch (_) {} const cu = this.q('#trCustom'); if (cu && cu.value !== c && /^#[0-9a-f]{6}$/i.test(c)) cu.value = c; this.paintEdit(); this.render(); },
  say(t, p) { this.q('#trMsg').textContent = t; const b = this.q('#trProg'); b.hidden = p == null; if (p != null) b.value = p; },

  // ---------- load: you show it the ball and where it went, then it follows the ball ----------
  async load(file) {
    this.file = file; const q = this.q, v = q('#trVid');
    this.stop(); this.st = null; this.ready = null; const sv = q('#trSaveVid'); if (sv) sv.textContent = 'Save video to Photos'; q('#trResult').hidden = true; q('#trEdit').hidden = true; q('#trRetry').hidden = true; q('#trPick').hidden = true;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(file); v.src = this.url; v.muted = true; v.playsInline = true;
    this.say('Opening your video…', 0.01);
    const ok = await new Promise(r => { const to = setTimeout(() => r(false), 10000); v.onloadeddata = () => { clearTimeout(to); r(true); }; v.onerror = () => { clearTimeout(to); r(false); }; v.load(); });
    if (!ok || !v.videoWidth) { this.say(/hevc|mov/i.test(file.name + file.type) ? "This browser can't open this iPhone video (HEVC format). Open Caddy Coach in Safari on your iPhone or iPad, or in Chrome or Edge on a recent computer or Android phone. To make future clips work everywhere: iPhone Settings › Camera › Formats › Most Compatible." : "That video couldn't be opened. Try a different video."); return; }
    try { await this.openPick(v); } catch (e) { console.error(e); this.say('Something went wrong opening the video. Tap Try again.'); q('#trRetry').hidden = false; }
  },
  async openPick(v) {
    const q = this.q, L = 854, ka = Math.min(1, L / Math.max(v.videoWidth, v.videoHeight));
    const Wa = Math.round(v.videoWidth * ka), Ha = Math.round(v.videoHeight * ka);
    const cv = q('#trPickCan'), Lc = Math.min(1280, Math.max(v.videoWidth, v.videoHeight)), k2 = Lc / Math.max(v.videoWidth, v.videoHeight);
    cv.width = Math.round(v.videoWidth * k2); cv.height = Math.round(v.videoHeight * k2); q('#trPickStage').style.aspectRatio = cv.width + ' / ' + cv.height;
    this.pick = { step: 'ball', ball: null, target: null, t: 0.05, Wa, Ha, kc: cv.width / Wa, cands: [] };
    try { this.deps.getPose(); } catch (_) {} // get the body tracker ready while they tap
    q('#trPick').hidden = false; this.say('');
    await this.findBall(v);
    const sk = q('#trPickSeek'); sk.value = Math.round(this.pick.t / Math.max(0.1, v.duration || 1) * 1000);
    sk.oninput = async e => { const t = Math.max(0.05, (v.duration || 1) * (+e.target.value) / 1000); q('#trPickSeekV').textContent = `${t.toFixed(1)} s`; await this.pickAt(v, t); };
    cv.onpointerdown = e => this.pickTap(e);
    q('#trPickGo').onclick = () => { if (this.pick && this.pick.ball && !this.pick.busy) { this.pick.busy = true; this.startTrace(v, null); } };
    q('#trPick').scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
  // show a frame to tap on, and spot the white/yellow round things that could be the ball
  async pickAt(v, t) {
    const P = this.pick; await this.seek(v, t); P.t = v.currentTime || t;
    const C = document.createElement('canvas'); C.width = P.Wa; C.height = P.Ha; const cx = C.getContext('2d', { willReadFrequently: true }); cx.drawImage(v, 0, 0, P.Wa, P.Ha);
    try { P.cands = T().ballCandidates(cx.getImageData(0, 0, P.Wa, P.Ha).data, P.Wa, P.Ha, { top: 0.3 }); } catch (_) { P.cands = []; }
    this.pickPaint(); return C;
  },
  // The ball can be hidden behind the club at address, so look through the clip: the ball is the small bright spot at the
  // golfer's feet that stays in exactly the same place frame after frame. Show the latest frame where it's clearly visible.
  async findBall(v) {
    const P = this.pick, Tr = T(); P.finding = true;
    await this.pickAt(v, 0.05);
    let pose = null, smp = null; try { pose = await this.deps.getPose(); smp = this.deps.makeSampler(); } catch (_) {}
    const S = document.createElement('canvas'), ks = 480 / Math.max(P.Wa, P.Ha); S.width = Math.round(P.Wa * ks); S.height = Math.round(P.Ha * ks);
    const dur = Math.min(v.duration || 0, 60), n = Math.max(4, Math.min(14, Math.round(dur * 1.2))), samples = [];
    const C = document.createElement('canvas'); C.width = P.Wa; C.height = P.Ha; const cx = C.getContext('2d', { willReadFrequently: true });
    for (let i = 0; i < n && !P.manual; i++) {
      const t = 0.05 + Math.max(0, dur - 0.4) * i / (n - 1); await this.seek(v, t); cx.drawImage(v, 0, 0, P.Wa, P.Ha);
      // the golfer may walk in after the recording starts: keep looking for them until they're found
      if (!P.P0 && pose) try { S.getContext('2d').drawImage(C, 0, 0, S.width, S.height); const r = pose.track({ width: S.width, height: S.height }, null, smp(S)); if (r && r.pts) { const q = r.pts.map(p => ({ x: p.x / ks, y: p.y / ks, vis: p.vis })); if (Tr.poseOK(q, P.Wa, P.Ha)) P.P0 = q; } } catch (_) {}
      let data = null, cs = []; try { data = cx.getImageData(0, 0, P.Wa, P.Ha).data; cs = Tr.ballCandidates(data, P.Wa, P.Ha, { top: 0.3 }); } catch (_) {}
      samples.push({ t: v.currentTime || t, data, cs });
    }
    for (const sm of samples) { sm.cands = Tr.ballSpots(sm.cs, P.P0 || null, sm.data, P.Wa, P.Ha); sm.data = null; sm.cs = null; }
    P.finding = false; P.samples = samples;
    if (P.manual) return this.pickPaint();
    const f = Tr.ballFromSamples(samples, P.P0 || null, P.Wa, P.Ha);
    if (f) { P.ball = Object.assign({ auto: true }, f.ball); await this.pickAt(v, f.t); }
    else { await this.pickAt(v, 0.05); }
    this.pickPaint();
  },
  pickPaint() {
    const P = this.pick, q = this.q, cv = q('#trPickCan'), x = cv.getContext('2d'), v = q('#trVid'), k = P.kc, s = cv.width / 720;
    try { x.drawImage(v, 0, 0, cv.width, cv.height); } catch (_) {}
    const ring = (p, r, col, lw) => { x.strokeStyle = col; x.lineWidth = lw * s; x.beginPath(); x.arc(p.x * k, p.y * k, r * s, 0, 7); x.stroke(); };
    if (P.ball) { ring(P.ball, 20, '#000', 6); ring(P.ball, 20, '#fff', 3); x.fillStyle = '#ff3b30'; x.beginPath(); x.arc(P.ball.x * k, P.ball.y * k, 4 * s, 0, 7); x.fill(); }
    if (P.target) { ring(P.target, 16, '#000', 6); ring(P.target, 16, '#ffd60a', 3); }
    const msg = q('#trPickMsg');
    if (P.finding) msg.innerHTML = 'Finding your ball…';
    else if (P.ball && P.ball.auto) msg.innerHTML = 'Is the marker on your ball?<span>If it is, tap Trace my shot. If not, tap the ball and the marker moves to it.</span>';
    else if (P.ball) msg.innerHTML = 'Ball marked<span>Tap Trace my shot. Tap again if the marker isn\'t on the ball.</span>';
    else msg.innerHTML = 'Tap the ball<span>Tap on or near it and the marker snaps onto it. If the ball is hidden, move the Frame slider to a moment before the swing where you can see it.</span>';
    q('#trPickGo').disabled = !P.ball || !!P.finding;
  },
  pickTap(e) {
    const P = this.pick; if (!P || P.busy) return; const cv = this.q('#trPickCan'), r = cv.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width * P.Wa, y: (e.clientY - r.top) / r.height * P.Ha };
    // snap to the ball-like spot nearest the tap, if there's one close by
    let best = null, bd = Math.max(14, 0.045 * Math.max(P.Wa, P.Ha));
    for (const c of P.cands) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
    P.manual = true; P.ball = best ? { x: best.x, y: best.y, r: best.r, snapped: true } : { x: p.x, y: p.y, r: Math.max(2, 0.0055 * Math.max(P.Wa, P.Ha)) };
    this.pickPaint();
  },
  async startTrace(v, target) {
    const P = this.pick; this.q('#trPick').hidden = true; P.busy = false;
    try { await this.detect(v, P.ball, null, P.t, P.P0); } catch (e) { console.error(e); this.say('Something went wrong while tracing. Tap Try again.'); this.q('#trRetry').hidden = false; }
  },
  // ball: {x,y,r} and target {x,y} in analysis pixels (longest side 854); tPick: the frame they were tapped on
  async detect(v, ball, target, tPick, P0pick) {
    const Tr = T(), my = (this.job = (this.job || 0) + 1), live = () => my === this.job, t00 = performance.now();
    const club = Tr.CLUBS.find(c => c.id === this.q('#trClub').value) || Tr.CLUBS[11];
    const dur = Math.min(v.duration || 0, 60), L = 854, k = Math.min(1, L / Math.max(v.videoWidth, v.videoHeight));
    const W = Math.round(v.videoWidth * k), H = Math.round(v.videoHeight * k);
    const C = document.createElement('canvas'); C.width = W; C.height = H; const cx = C.getContext('2d', { willReadFrequently: true });
    // 1. one look at the golfer at address: which way the camera faces and how big the golfer is
    this.say('Getting ready…', 0.03);
    let P0 = P0pick || null;
    if (!P0) try { const pose = await this.deps.getPose(), smp = this.deps.makeSampler(), S = document.createElement('canvas'), ks = 480 / Math.max(W, H); S.width = Math.round(W * ks); S.height = Math.round(H * ks);
      await this.seek(v, tPick); S.getContext('2d').drawImage(v, 0, 0, S.width, S.height);
      const r = pose.track({ width: S.width, height: S.height }, null, smp(S)); if (r && r.pts) { const q = r.pts.map(p => ({ x: p.x / ks, y: p.y / ks, vis: p.vis })); if (Tr.poseOK(q, W, H)) P0 = q; } } catch (_) {}
    // the far edge of the course in the picture: from behind the ball, that's where a long shot comes down
    let hz = null; try { await this.seek(v, tPick); cx.drawImage(v, 0, 0, W, H); const xs = P0 ? [11, 12, 23, 24, 27, 28].map(i => P0[i].x) : null;
      hz = Tr.estimateHorizon(cx.getImageData(0, 0, W, H).data, W, H, xs ? { x0: Math.min(...xs) - 0.08 * W, x1: Math.max(...xs) + 0.08 * W } : null); } catch (_) {}
    if (!live()) return;
    // 2. the moment of impact: watch just the ball's own spot until it's gone for good
    const mk = this._mk = {}; mk.pose = performance.now() - t00;
    this.say('Finding the moment you hit it…', 0.08);
    const R = Math.max(2, ball.r), half = Math.ceil(4 * R + 4), bx0 = Math.max(0, Math.floor(ball.x - half)), by0 = Math.max(0, Math.floor(ball.y - half));
    const bw = Math.min(W - bx0, 2 * half), bh = Math.min(H - by0, 2 * half), pc = document.createElement('canvas'); pc.width = bw; pc.height = bh; const px = pc.getContext('2d', { willReadFrequently: true });
    const local = { x: ball.x - bx0, y: ball.y - by0, r: R };
    const sample = () => { px.drawImage(v, bx0 / k, by0 / k, bw / k, bh / k, 0, 0, bw, bh); return Tr.patch(px.getImageData(0, 0, bw, bh).data, bw, bh, local); };
    await this.seek(v, tPick); const ref = sample();
    const series = [];
    let goneSince = null; const thrG = Math.max(12, Math.hypot(ref.in[0] - ref.ring[0], ref.in[1] - ref.ring[1], ref.in[2] - ref.ring[2]) * 0.45);
    await this.playThrough(v, tPick, dur, 4, t => { const pt = sample(); series.push({ t, p: pt }); const g = Tr.ballState(pt, ref) === 'G'; goneSince = g ? (goneSince == null ? t : goneSince) : null; if (goneSince != null && t - goneSince > 1.2) return true; this.say('Finding the moment you hit it…', 0.08 + 0.3 * (t - tPick) / Math.max(0.1, dur - tPick)); }, live, 1 / 20);
    if (!live()) return;
    mk.watch = performance.now() - t00;
    let tImp = Tr.ballGone(series, ref), impNote = '';
    const grey = () => { cx.drawImage(v, 0, 0, W, H); const d = cx.getImageData(0, 0, W, H).data, g = new Uint8Array(W * H); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8; return { t: v.currentTime, g }; };
    const early = [];
    // a closer look above the ball, at up to the video's own resolution: far away the ball is a speck only a pixel or two
    // across, which the overview (854 px) loses
    const sR = Math.min(2.5, 1 / k), hiOn = sR >= 1.4;
    const hiBox = { x0: Math.max(0, Math.floor(ball.x - 0.28 * W)), y0: 0 }; hiBox.x1 = Math.min(W, Math.ceil(ball.x + 0.28 * W)); hiBox.y1 = Math.min(H, Math.ceil(ball.y + 4 * R));
    hiBox.RW = Math.round((hiBox.x1 - hiBox.x0) * sR); hiBox.RH = Math.round((hiBox.y1 - hiBox.y0) * sR); hiBox.s = sR;
    const hiC = hiOn ? document.createElement('canvas') : null, hiX = hiOn ? (hiC.width = hiBox.RW, hiC.height = hiBox.RH, hiC.getContext('2d', { willReadFrequently: true })) : null, hiFrames = [];
    const hiMs = [0, 0]; this._hiMs = hiMs;
    const hiToGrey = (src, t) => { const q0 = performance.now(); if (src) hiX.drawImage(src, 0, 0, hiBox.RW, hiBox.RH); else hiX.drawImage(v, hiBox.x0 / k, hiBox.y0 / k, (hiBox.x1 - hiBox.x0) / k, (hiBox.y1 - hiBox.y0) / k, 0, 0, hiBox.RW, hiBox.RH);
      const d = hiX.getImageData(0, 0, hiBox.RW, hiBox.RH).data, g = new Uint8Array(hiBox.RW * hiBox.RH); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8; hiFrames.push({ t, g }); hiMs[0] += performance.now() - q0; hiMs[1]++; if (src && src.close) src.close(); };
    // while the video plays, only take a snapshot (quick, so playback keeps up); turn them into pixels afterwards
    const hiSnaps = [], hiGrab = t => { if (!hiOn) return;
      if (window.createImageBitmap) { try { hiSnaps.push(createImageBitmap(v, hiBox.x0 / k, hiBox.y0 / k, (hiBox.x1 - hiBox.x0) / k, (hiBox.y1 - hiBox.y0) / k, { resizeWidth: hiBox.RW, resizeHeight: hiBox.RH }).then(b => ({ b, t }), () => null)); return; } catch (_) {} }
      hiToGrey(null, t); };
    if (tImp != null) {
      // to the frame: halve the gap between the last sighting of the ball and the first frame without it
      let lo = Math.max(tPick, tImp - 0.12), hi = Math.min(dur, tImp + 0.12);
      for (const s of series) { if (s.t < tImp && Tr.ballState(s.p, ref) === 'B') lo = Math.max(lo, s.t); if (s.t > tImp && s.t < hi) hi = s.t; }
      // play that moment slowly so every frame is seen (much quicker than seeking frame by frame): the frame the ball
      // leaves, and the first moments of the flight, when the ball is biggest and clearest and moving fastest
      const fine = [];
      // slow enough for this phone to copy every frame: the exact frame the ball leaves sets everything after it
      await this.seek(v, Math.max(tPick, lo - 1 / 60)); let fc = 1; for (let i = 0; i < 2; i++) { const q0 = performance.now(); grey(); sample(); fc = Math.min(fc, (performance.now() - q0) / 1000); }
      const fineRate = Math.max(0.04, Math.min(0.25, (1 / 60) / (fc * 1.6 + 0.004))); this._fineRate = fineRate;
      await this.playThrough(v, Math.max(tPick, lo - 1 / 60), Math.min(dur, hi + 0.17), fineRate, t => { const f = grey(); f.t = t; fine.push({ t, p: sample(), f }); hiGrab(t); }, live, 1 / 240);
      const tf = Tr.ballGone(fine, ref, { minGone: 0.04, needGround: 0 }); this._fine = { lo, hi, tf, s: fine.map(x => [+x.t.toFixed(3), Tr.ballState(x.p, ref), x.p.in.map(Math.round)]) };
      tImp = tf != null && tf > lo - 0.05 && tf < hi + 0.16 ? tf : (lo + hi) / 2;
      for (const x of fine) early.push(x.f);
    } else {
      tImp = Math.min(dur - 0.5, Math.max(tPick + 0.5, dur * 0.4)); impNote = "I couldn't see the ball leave the ground, so the strike time is a guess; use Impact timing below to line it up.";
    }
    if (!live()) return;
    // 3. follow the ball for the first couple of seconds, looking the way it was sent
    mk.refine = performance.now() - t00;
    this.say('Following the ball…', 0.42);
    // (the close-up every eighth of a second or so, up to about the top of a long shot's climb: enough to follow a speck, and quick)
    let hiLast = -1; const hiSome = t => { if (t > tImp + 3 || (t > tImp + 0.2 && t - hiLast < (t < tImp + 1.3 ? 0.065 : 0.18))) return; hiLast = t; hiGrab(t); };
    const frames = await this.grabGrey(v, Math.max(0, tImp - 0.5), Math.min(v.duration, tImp + 3.6), W, H, C, cx, live, 0.42, 0.85, early, hiOn ? hiSome : null, tImp + 1.4);
    if (!live()) return;
    mk.grab = performance.now() - t00;
    const aim = target ? { x: target.x - ball.x, y: target.y - ball.y } : null;
    let ob = Tr.bgTrack(frames, W, H, ball, tImp); this._lo = Tr.bgTrack.last; this._tImp = tImp; this._early = early.map(f => f.t);
    for (const sn of await Promise.all(hiSnaps)) if (sn) try { hiToGrey(sn.b, sn.t); } catch (_) {}
    let hf = null;
    if (hiOn && hiFrames.length > 8) {
      // the same search in the close-up; if it follows the ball further, use that
      hiFrames.sort((a, b) => a.t - b.t); const same = (a, b) => { for (let i = 0; i < a.length; i += 97) if (a[i] !== b[i]) return false; return true; };
      hf = hiFrames.filter((f, i) => i === 0 || (f.t - hiFrames[i - 1].t > 0.004 && !same(f.g, hiFrames[i - 1].g)));
      const S = hiBox.s, qb = performance.now(), oh = Tr.bgTrack(hf, hiBox.RW, hiBox.RH, { x: (ball.x - hiBox.x0) * S, y: (ball.y - hiBox.y0) * S, r: R * S }, tImp);
      const back = p => p.map(q => ({ t: q.t, x: hiBox.x0 + q.x / S, y: hiBox.y0 + q.y / S })), span = p => p.length ? p[p.length - 1].t - p[0].t : 0;
      this._hi = { ms: hiMs.slice(), bgMs: performance.now() - qb, n: hf.length, len: oh.length, span: span(oh), lo: ob.length, loSpan: span(ob), box: hiBox };
      if (oh.length >= 3 && (ob.length < 3 || span(oh) > span(ob) * 1.2)) { const m = back(oh); m.alts = (oh.alts || [oh]).map(back); m.score = oh.score; m.bg = true; ob = m; }
    }
    // keep following it once it's only a speck against the sky
    if (ob.bg && ob.length >= 3) try {
      const al = ob.alts, sc = ob.score; let ex;
      // where the overview lost the ball for a moment, what it linked up afterwards is a guess: let the close look take over from there
      { const st = ob.slice(1, 6).map((q, i) => q.t - ob[i].t).sort((a, b) => a - b), md = st[st.length >> 1] || 0.03; let cut = ob.length;
        for (let i = 3; i < ob.length; i++) if (ob[i].t - ob[i - 1].t > Math.max(0.09, 2.6 * md)) { cut = i; break; }
        if (cut < ob.length && hf) { const o2 = ob.slice(0, cut); o2.alts = al; o2.score = sc; o2.bg = true; ob = o2; } }
      if (hf) { const S = hiBox.s, h = Tr.extendTrack(hf, hiBox.RW, hiBox.RH, ob.map(q => ({ t: q.t, x: (q.x - hiBox.x0) * S, y: (q.y - hiBox.y0) * S })), tImp, { r: R * S * 0.6, thr: 10 }); ex = h.map(q => ({ t: q.t, x: hiBox.x0 + q.x / S, y: hiBox.y0 + q.y / S, ext: q.ext })); }
      else ex = Tr.extendTrack(frames, W, H, ob, tImp, { r: R * 0.6, thr: 12 });
      this._ext = ex.length - ob.length;
      if (ex.length > ob.length) { ex.alts = [ex].concat((al || []).slice(1)); ex.score = sc; ex.bg = true; ob = ex; }
    } catch (e) { console.warn(e); }
    hiFrames.length = 0; hf = null;
    if (ob.length < 4) { const tf = Tr.trackFlight(frames, W, H, ball, tImp, { aim });
      // the older tracker, for clips the one above can't use; only if what it found starts out from the ball
      if (tf.length >= 4 && Math.hypot(tf[0].x - ball.x, tf[0].y - ball.y) < 0.15 * Math.max(W, H) * Math.max(1, (tf[0].t - tImp) / 0.1)) ob = tf; }
    
    // 4. fit a flight to what was seen, from where the golfer and camera are
    this.say('Drawing your tracer…', 0.9); await sleep(0);
    let view = !P0 ? null : (Math.abs(P0[11].x - P0[12].x) / (Math.hypot((P0[11].x + P0[12].x) / 2 - (P0[23].x + P0[24].x) / 2, (P0[11].y + P0[12].y) / 2 - (P0[23].y + P0[24].y) / 2) || 1) < 0.5 ? 'dtl' : (this.lefty() ? 'face-l' : 'face-r'));
    // the ball itself says which way the camera faces: from behind it climbs almost straight up the picture, from the
    // side it flies off across it (the golfer's body can mislead, e.g. a golfer turned towards the phone)
    if (ob.length >= 3) { const L = ob[ob.length - 1], dx = L.x - ball.x, dy = L.y - ball.y;
      if (view && view !== 'dtl' && dy < -4 * R && Math.abs(dx) < 0.7 * -dy) view = 'dtl'; }
    this._view = view; this._hz = hz; 
    const bodyH = P0 ? (Math.max(P0[27].y, P0[28].y, P0[31].y, P0[32].y) - Math.min(P0[0].y, P0[7].y, P0[8].y)) / 0.88 : H * 0.45;
    const start = { x: ball.x, y: ball.y, r: R };
    // from behind, the far edge of the course sits on the horizon: how far the ball is below it gives the phone's height
    const hzOK = (view || 'dtl') === 'dtl' && hz != null && hz < ball.y - 0.04 * H;
    let chCam = null; if (hzOK) { const F = (Math.max(W, H) / 2) / Math.tan(33 * Math.PI / 180), c0 = Tr.sceneCamera(W, H, start, bodyH, 'dtl'), a = Math.atan((ball.y - H / 2) / F) - Math.atan((hz - H / 2) / F); chCam = Math.max(0.3, Math.min(2.2, Math.hypot(c0.cd, c0.lat) * Math.tan(a))); }
    const fx = Tr.sceneCamera(W, H, start, bodyH, view || 'dtl', chCam);
    let shot, camp, t0 = tImp, obs = [], note;
    // the ball left the ground just before its first sighting: work back from how fast it was going
    if (ob.length >= 2 && !ob.bg) { const a0 = ob[0], a1 = ob[1], sp = Math.hypot(a1.x - a0.x, a1.y - a0.y) / Math.max(1e-3, a1.t - a0.t), back = Math.hypot(a0.x - ball.x, a0.y - ball.y) / Math.max(1, sp); tImp = Math.max(tImp - 0.12, Math.min(tImp, a0.t - back)); }
    if (ob.length >= 4) {
      let bf = Tr.bestFlight(ob.alts || [ob], start, tImp, W, H, club, view || 'dtl', fx);
      // plenty of sightings: let the camera's distance and height come from the flight itself if that explains it better
      if (ob.length >= 8) { const bf2 = Tr.bestFlight(ob.alts || [ob], start, tImp, W, H, club, view || 'dtl', null); if (bf2 && (!bf || bf2.sc < bf.sc)) bf = bf2; }
      shot = bf.fit.shot; camp = bf.fit.camp; t0 = bf.fit.t0; obs = bf.chain;
      note = `Traced from ${obs.length} sightings of your ball after impact. Distance comes from your ${club.name} (edit it below).`;
    } else {
      shot = { D: club.carry * YD, H: club.apex, az: 0, curve: 0, pa: 0.6 }; camp = fx;
      note = `The ball was too small or fast to follow in this video, so the flight is your ${club.name}'s typical height and distance${target ? ', sent where you tapped' : ''}. Drag the landing point or edit it below.`;
      // what would help next time
      if (this._fps && this._fps < 45) note += ` This video is about ${this._fps} frames a second; at 60 the ball is much easier to follow.`;
      else note += ' Next time, film from low down right behind the ball with the phone kept still (tap How to film it above).';
    }
    this.st = { W, H, start, t0, shot, camp, club, obs, note: (impNote ? impNote + ' ' : '') + note, strike: null, target };
    this.rebuildCam();
    if (target) Tr.aimAt(this.st, target);
    this.fitCorr();
    // a shot filmed from behind lands out on the course, just short of its far edge, not in front of the golfer
    if (hzOK) {
      const Lp = this.pathPoint(1), F = (Math.max(W, H) / 2) / Math.tan(33 * Math.PI / 180), lo = hz + 1, hi = hz + Math.max(8, F * 1.4 / this.st.shot.D);
      if (Lp && (Lp.v > hi || Lp.v < lo || Lp.u < 0 || Lp.u > W)) { this.st.target = { x: Math.max(0.03 * W, Math.min(0.97 * W, Lp.u)), y: Math.max(lo, Math.min(hi, Lp.v)) }; this.st.autoLand = true; this.fitCorr(); }
    }
    // filmed from behind, a flight fitted to only a few sightings can run away: never let it land far outside the picture
    if ((view || 'dtl') === 'dtl') { const Lp = this.pathPoint(1);
      if (Lp && (!isFinite(Lp.u) || !isFinite(Lp.v) || Lp.u < -0.3 * W || Lp.u > 1.3 * W || Lp.v > 1.2 * H)) { this.st.target = { x: Math.max(0.03 * W, Math.min(0.97 * W, isFinite(Lp.u) ? Lp.u : ball.x)), y: Math.max(0.05 * H, Math.min(ball.y - 0.1 * H, isFinite(Lp.v) ? Lp.v : ball.y - 0.3 * H)) }; this.st.autoLand = true; this.fitCorr(); } }
    this.st.auto = { shot: JSON.parse(JSON.stringify(this.st.shot)), start: Object.assign({}, start), t0: this.st.t0 };
    this.st.secs = (performance.now() - t00) / 1000; mk.all = performance.now() - t00;
    this.say('');
    if (typeof window.ccTrack === 'function') window.ccTrack('trace');
    if (typeof window.ccNotify === 'function') window.ccNotify('Your shot tracer is ready', 'Tap to see the ball flight and what it says about your swing.');
    this.q('#trNote').textContent = this.st.note;
    this.q('#trResult').hidden = false; this.q('#trEdit').hidden = false;
    this.paintEdit(); this.setupCanvas(v); this.replay();
    this.q('#trResult').scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
  // seek and wait until the new picture is actually showing (after 'seeked' some browsers still show the old frame for a moment)
  async seekFrame(v, t) {
    if (!v.requestVideoFrameCallback) return this.seek(v, t);
    // returns the time of the picture actually on screen
    let mt = null; const p = new Promise(res => { const to = setTimeout(res, 250); v.requestVideoFrameCallback((now, meta) => { mt = meta && meta.mediaTime; clearTimeout(to); res(); }); });
    await this.seek(v, t); await p; return mt != null ? mt : v.currentTime;
  },
  seek(v, t) { return new Promise(res => { let done = false; const f = () => { if (done) return; done = true; v.removeEventListener('seeked', f); clearTimeout(to); res(); }; const to = setTimeout(f, 3000); v.addEventListener('seeked', f); v.currentTime = Math.max(0, Math.min((v.duration || 1) - 0.02, t)); }); },
  // play [a,b] calling cb(mediaTime) for frames at least minDt apart; falls back to seeking
  async playThrough(v, a, b, rate, cb, live, minDt) {
    await this.seek(v, a);
    if (v.requestVideoFrameCallback) {
      let last = -1;
      await new Promise(res => {
        let done = false; const fin = () => { if (done) return; done = true; clearTimeout(to); v.pause(); v.playbackRate = 1; res(); };
        const to = setTimeout(fin, (b - a) / rate * 1000 + 8000);
        v.addEventListener('ended', fin, { once: true });
        const f = (now, meta) => { if (done) return; if (!live()) return fin(); const t = meta.mediaTime; let stop = false; if (t - last >= minDt - 1e-3) { last = t; stop = cb(t) === true; } if (stop || t >= b) fin(); else v.requestVideoFrameCallback(f); };
        v.requestVideoFrameCallback(f); try { v.playbackRate = rate; } catch (_) {}
        const p = v.play(); if (p && p.catch) p.catch(fin);
      });
      if (last >= 0) return;
    }
    for (let t = a; t <= b && live(); t += Math.max(minDt, 0.1)) { await this.seek(v, t); if (cb(t) === true) break; }
  },
  async grabGrey(v, a, b, W, H, C, cx, live, p0, p1, extra, also, tSplit) {
    const out = [], grab = t => { if (p0 != null) this.say('Following the ball…', p0 + (p1 - p0) * Math.min(1, (t - a) / Math.max(0.1, b - a))); cx.drawImage(v, 0, 0, W, H); const d = cx.getImageData(0, 0, W, H).data, g = new Uint8Array(W * H); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8; out.push({ t, g }); if (also) also(t); };
    // how long one frame takes to copy on this phone: play slowly enough to keep up, or a slow phone skips the frames
    // the ball is in (the first second of the flight matters most, so that part gets every frame)
    await this.seek(v, a); let cost = 1;
    for (let i = 0; i < 2; i++) { const q0 = performance.now(); grab(v.currentTime); cost = Math.min(cost, (performance.now() - q0) / 1000); }
    out.length = 1; this._cost = cost;
    const rateFor = dt => Math.max(0.3, Math.min(0.75, dt / (cost * 1.4 + 0.003)));
    if (tSplit != null && tSplit > a + 0.1 && tSplit < b - 0.1) {
      await this.playThrough(v, a, tSplit, rateFor(1 / 45), grab, live, 1 / 70);
      if (live()) await this.playThrough(v, tSplit, b, rateFor(1 / 30), grab, live, 1 / 34);
    } else await this.playThrough(v, a, b, rateFor(1 / 60), grab, live, 1 / 70);
    this._rates = [rateFor(1 / 45), rateFor(1 / 30)];
    if (extra) out.push(...extra);
    // fill gaps by seeking
    out.sort((p, q) => p.t - q.t); this._gs = { played: out.length, t: performance.now() };
    { const d = out.slice(1).map((f, i) => f.t - out[i].t).filter(x => x > 0.004 && x < 0.1).sort((x, y) => x - y); this._fps = d.length > 5 ? Math.round(1 / d[d.length >> 2]) : null; }
    const fps = 30, want = []; const ts = [a].concat(out.map(f => f.t), [b]);
    // only plug real holes (3+ frames missing), early in the flight first: the tracker copes with the odd skipped frame, and seeking is slow on phones
    for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > 2.5 / fps) for (let t = ts[i - 1] + 1.5 / fps; t < ts[i] - 0.5 / fps; t += 2 / fps) want.push(t);
    // (on a slow phone a seek can take most of a second: stop after a second and a half of it)
    const gs0 = performance.now(); for (const t of want.slice(0, 12)) { if (!live() || performance.now() - gs0 > 1500) break; await this.seek(v, t); grab(v.currentTime); }
    this._gs.seeks = Math.min(12, want.length); this._gs.seekMs = performance.now() - this._gs.t;
    out.sort((p, q) => p.t - q.t);
    // a seek can land on the same picture twice: keep one of each
    const same = (a, b) => { for (let i = 0; i < a.length; i += 97) if (a[i] !== b[i]) return false; return true; };
    return out.filter((f, i) => i === 0 || (f.t - out[i - 1].t > 0.004 && !same(f.g, out[i - 1].g)));
  },

  // ---------- model ----------
  rebuildCam() { const s = this.st, c = s.camp; s.cam = T().makeCamera(s.W, s.H, s.start.x, s.start.y, c.beta, c.cd, c.ch, c.lat, c.fov); },
  // where the ball was actually seen, the line goes through those sightings; after that it follows the fitted flight
  pathPoint(tau, raw) {
    const s = this.st, tt = Math.max(0, Math.min(1, tau)), p = T().project(s.cam, T().shotPoint(s.shot, tt)); if (!p || raw) return p;
    const c = T().corrAt(s.corr, tt), q = { u: p.u + c.x, v: p.v + c.y, z: p.z }, O = s.seen; if (!O) return q;
    const t = s.t0 + tt * T().flightTime(s.shot);
    if (t <= O[O.length - 1].t) { let i = 1; while (i < O.length - 1 && O[i].t < t) i++; const a = O[i - 1], b = O[i], f = Math.max(0, Math.min(1, (t - a.t) / ((b.t - a.t) || 1))); return { u: a.x + (b.x - a.x) * f, v: a.y + (b.y - a.y) * f, z: p.z }; }
    const Tf = T().flightTime(s.shot), e = O[O.length - 1], te = (e.t - s.t0) / Tf, mc = x => { const m = this.pathPoint(x, true), cc = T().corrAt(s.corr, x); return { u: m.u + cc.x, v: m.v + cc.y }; };
    const pastTop = e.y - Math.min(...O.map(o => o.y)) > 3;
    if (s.target && te < 0.98 && !pastTop) {
      // lost before the top of its flight: follow the fitted flight, easing the gap at the last sighting away by the landing
      const me = mc(te), w = Math.max(0, (1 - tt) / Math.max(1e-3, 1 - te)); return { u: q.u + (e.x - me.u) * w, v: q.v + (e.y - me.v) * w, z: p.z };
    }
    if (s.target && te < 0.98) {
      // seen over the top: from the last sighting to where they tapped, a smooth curve that leaves at the ball's own speed and arrives the way a ball comes down
      const e0 = O[Math.max(0, O.length - 4)], dte = Math.max(1e-3, (e.t - e0.t) / Tf), Ve = { u: (e.x - e0.x) / dte, v: (e.y - e0.y) / dte };
      const L1 = mc(1), L0 = mc(0.97), VL = { u: (L1.u - L0.u) / 0.03, v: (L1.v - L0.v) / 0.03 }, h = 1 - te, x = (tt - te) / h;
      const h00 = 2 * x ** 3 - 3 * x * x + 1, h10 = x ** 3 - 2 * x * x + x, h01 = -2 * x ** 3 + 3 * x * x, h11 = x ** 3 - x * x;
      return { u: h00 * e.x + h10 * h * Ve.u + h01 * L1.u + h11 * h * VL.u, v: h00 * e.y + h10 * h * Ve.v + h01 * L1.v + h11 * h * VL.v, z: p.z };
    }
    // after the last sighting: carry on along the flight model's own shape, joined to where the ball was last seen
    const m0 = this.pathPoint(te, true); return { u: p.u + e.x - m0.u, v: p.v + e.y - m0.v, z: p.z };
  },
  fitCorr() { const s = this.st; s.corr = T().fitCorrection(s, s.obs, s.target, tau => this.pathPoint(tau, true));
    // the sightings, lightly smoothed, starting from the ball at the moment of impact
    const o = (s.obs || []).filter(x => x.t > s.t0); s.seen = null;
    if (o.length >= 4) { const sm = o.map((x, i) => { const a = o[Math.max(0, i - 1)], b = o[Math.min(o.length - 1, i + 1)]; return { t: x.t, x: (a.x + 2 * x.x + b.x) / 4, y: (a.y + 2 * x.y + b.y) / 4 }; }); sm[0] = o[0]; s.seen = [{ t: s.t0, x: s.start.x, y: s.start.y }].concat(sm); } },
  edited() { if (this.st) this.st.seen = null; if (this.ready) { this.ready = null; this.q('#trSaveVid').textContent = 'Save video to Photos'; } },
  dragTo(which, x, y, clientY) {
    const s = this.st; this.edited();
    if (which === 'start') { s.start = { x, y, r: s.start.r }; s.corr = null; this.rebuildCam(); this.render(); return; }
    // landing: up/down changes distance (gently, because far ground is squeezed near the horizon), left/right moves it sideways
    const sh = s.shot, curve0 = sh.curve / sh.D;
    sh.D = Math.max(15, Math.min(330 * YD, this.dragFrom.D * Math.exp(-(clientY - this.dragFrom.y) / 220)));
    sh.curve = curve0 * sh.D;
    const cc1 = T().corrAt(s.corr, 1); x -= cc1.x;
    const base = sh.D * Math.tan(sh.az), proj = Y => { const p = T().project(s.cam, { x: sh.D, y: Y, z: 0 }); return p ? p.u : null; };
    const u0 = proj(base + sh.curve), u1 = proj(base + sh.curve + 1);
    if (u0 != null && u1 != null && Math.abs(u1 - u0) > 1e-3) sh.curve += (x - u0) / (u1 - u0);
    this.paintEdit(true); this.render();
  },

  // ---------- drawing ----------
  // The phone plays the video itself (smooth, hardware decoded); the tracer is drawn on a clear layer on top, at screen resolution.
  setupCanvas(v) {
    const st = this.q('#trStage'), ar = v.videoWidth / v.videoHeight;
    st.style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight; st.style.width = `min(100%, calc(72vh * ${ar.toFixed(4)}))`;
    st.classList.add('trLayered'); v.hidden = false; this.sizeOverlay();
    if (!this.ro && root.ResizeObserver) { this.ro = new ResizeObserver(() => { if (this.sizeOverlay()) this.render(); }); this.ro.observe(st); }
  },
  sizeOverlay() {
    const cv = this.q('#trCan'), st = this.q('#trStage'), v = this.q('#trVid'); if (!this.st || !v.videoWidth) return false;
    const r = st.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = Math.max(240, Math.min(1440, Math.round((r.width || 360) * dpr))), H = Math.round(W * v.videoHeight / v.videoWidth);
    const ch = cv.width !== W || cv.height !== H; if (ch) { cv.width = W; cv.height = H; } this.k = cv.width / this.st.W; return ch;
  },
  togglePlay() { const v = this.q('#trVid'); if (this.playing) this.pause(); else { if (v.ended || this.ended) this.replay(); else this.play(); } },
  play() { const v = this.q('#trVid'); this.playing = true; this.showFull = false; this.ended = false; this.q('#trPlay').textContent = 'Pause'; const p = v.play(); if (p && p.catch) p.catch(() => {}); this.loop(); },
  pause() { const v = this.q('#trVid'); this.playing = false; v.pause(); this.q('#trPlay').textContent = 'Play'; this.render(); },
  stop() { this.playing = false; this.job = (this.job || 0) + 1; try { this.q('#trVid').pause(); } catch (_) {} cancelAnimationFrame(this.raf); },
  replay() { const v = this.q('#trVid'); this.after = 0; this.ended = false; this.seek(v, Math.max(0, this.st.t0 - 2.2)).then(() => this.play()); },
  seekTo(f) { if (!this.st) return; const v = this.q('#trVid'); this.pause(); this.showFull = false; const hd = this.hold(), tot = hd + this.extra(), t = f / 1000 * tot; if (t <= hd) { this.after = 0; this.seek(v, t).then(() => this.render()); } else { this.after = t - hd; this.seek(v, hd).then(() => this.render()); } this.render(); },
  hold() { const s = this.st, v = this.q('#trVid'); return Math.min((v.duration || 0) - 0.05, s.t0 + Math.max(2.0, T().flightTime(s.shot) + 1.5)); },
  extra() { const s = this.st; return Math.max(0, s.t0 + T().flightTime(s.shot) + 1.5 - this.hold()); },
  finish() { const v = this.q('#trVid'); this.playing = false; v.pause(); this.q('#trPlay').textContent = 'Play'; this.showFull = true; if (Math.abs(v.currentTime - this.hold()) > 0.05) this.seek(v, this.hold()).then(() => this.render()); this.render(); },
  loop() {
    cancelAnimationFrame(this.raf);
    const v = this.q('#trVid'); let last = performance.now();
    const step = now => {
      if (!this.playing) return;
      const dt = (now - last) / 1000; last = now;
      if (v.currentTime >= this.hold() - 0.02 && !v.paused) { v.pause(); }
      if (v.ended || v.currentTime >= this.hold() - 0.03) { this.after = (this.after || 0) + dt; if (this.after > this.extra() + 0.05) { this.playing = false; this.ended = true; this.q('#trPlay').textContent = 'Play'; this.showFull = true; this.render(); this.onEnd && this.onEnd(); return; } }
      this.render(); this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
  now() { const v = this.q('#trVid'); return Math.min(v.currentTime || 0, this.hold()) + (this.after || 0); },
  render() {
    const s = this.st; if (!s) return; const cv = this.q('#trCan'), x = cv.getContext('2d');
    if (!this.k) this.sizeOverlay();
    x.clearRect(0, 0, cv.width, cv.height);
    const seek = this.q('#trSeek'); if (seek && !this.drag) seek.value = Math.round(Math.min(1, this.now() / (this.hold() + this.extra())) * 1000);
    this.paint(x, cv.width, cv.height, { tnow: this.showFull ? null : this.now(), overlay: true, handles: !this.playing && this.showFull && !this.exporting });
    if (this.recC) { const v = this.q('#trVid'); this.compose(v, this.showFull ? null : this.now(), this.recC); }
  },
  // the tracer at time tnow (null = the finished shot), drawn on a W x H picture of the video
  paint(x, W, H, o) {
    const s = this.st, k = W / s.W, Tf = T().flightTime(s.shot), tnow = o.tnow == null ? s.t0 + Tf + 1 : o.tnow, tau = (tnow - s.t0) / Tf;
    const base = { thin: 2.2, med: 3.6, thick: 5.5 }[this.style.width] * W / 720, col = this.style.color;
    const N = 120, pts = [];
    if (tau > 0) for (let i = 0; i <= N; i++) { const tt = Math.min(tau, 1) * i / N, p = this.pathPoint(tt); if (p) pts.push({ x: p.u * k, y: p.v * k, z: p.z }); }
    if (pts.length > 1) {
      // thicker near the camera, thinner far away: the line is cut into a few runs of equal width so it takes a handful of strokes, not hundreds
      const wAt = z => Math.max(0.35, Math.min(1.6, 6 / z)), runs = []; let cur = null;
      for (let i = 1; i < pts.length; i++) { const w = Math.round(wAt(pts[i].z) * 10) / 10; if (!cur || cur.w !== w) { cur = { w, p: [pts[i - 1]] }; runs.push(cur); } cur.p.push(pts[i]); }
      x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
      const pass = (mul, style, alpha) => { x.strokeStyle = style; x.globalAlpha = alpha; for (const r of runs) { x.lineWidth = base * r.w * mul; x.beginPath(); x.moveTo(r.p[0].x, r.p[0].y); for (let i = 1; i < r.p.length; i++) x.lineTo(r.p[i].x, r.p[i].y); x.stroke(); } };
      pass(3.2, col, 0.16); pass(2.0, col, 0.32); pass(1, col, 1); pass(0.38, '#fff', 0.9);
      x.restore();
      if (tau < 1) { const h = pts[pts.length - 1], r0 = Math.max(2, base * 0.7 * wAt(h.z)); x.save(); x.fillStyle = col; x.globalAlpha = 0.35; x.beginPath(); x.arc(h.x, h.y, r0 * 2.4, 0, 7); x.fill(); x.globalAlpha = 1; x.fillStyle = '#fff'; x.beginPath(); x.arc(h.x, h.y, r0, 0, 7); x.fill(); x.restore(); }
    }
    const land = this.pathPoint(1), st0 = { x: s.start.x * k, y: s.start.y * k };
    if (o.overlay) s.handles = { land: land ? { x: land.u * k, y: land.v * k } : { x: -999, y: -999 }, start: st0 };
    if (tau >= 1 && land) this.drawLanding(x, s, base, W, k);
    if (tau >= 1) this.drawCard(x, W, s);
    if (o.handles) {
      x.save(); x.lineWidth = Math.max(2, W / 400); const u = W / 720;
      for (const h of [s.handles.land, st0]) { x.strokeStyle = '#fff'; x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(h.x, h.y, 16 * u, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(h.x - 6 * u, h.y); x.lineTo(h.x + 6 * u, h.y); x.moveTo(h.x, h.y - 6 * u); x.lineTo(h.x, h.y + 6 * u); x.stroke(); }
      x.restore();
    }
  },
  // a full-quality frame (video picture + tracer) for saving
  compose(src, tnow, c) {
    const v = this.q('#trVid'), L = Math.max(v.videoWidth, v.videoHeight), sc = Math.min(1, 1920 / L);
    const W = Math.round(v.videoWidth * sc / 2) * 2, H = Math.round(v.videoHeight * sc / 2) * 2;
    c = c || document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const x = c.getContext('2d'); try { x.drawImage(src, 0, 0, W, H); } catch (_) {} this.paint(x, W, H, { tnow }); return c;
  },
  drawLanding(x, s, base, W, k) {
    const D = s.shot.D, Y = s.shot.D * Math.tan(s.shot.az) + s.shot.curve, pts = [], cc = T().corrAt(s.corr, 1);
    for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2, p = T().project(s.cam, { x: D + Math.cos(a) * 4, y: Y + Math.sin(a) * 4, z: 0 }); if (p) pts.push([(p.u + cc.x) * k, (p.v + cc.y) * k]); }
    if (pts.length > 4) { x.save(); x.strokeStyle = this.style.color; x.lineWidth = Math.max(1.5, base * 0.5); x.shadowColor = this.style.color; x.shadowBlur = base * 2; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.stroke(); x.restore(); }
    const lp0 = T().project(s.cam, { x: D, y: Y, z: 0 }); if (!lp0) return; const lp = { u: lp0.u + cc.x, v: lp0.v + cc.y };
    const fs = Math.round(W / 26), txt = `${Math.round(D / YD)} yd`;
    x.save(); x.font = `800 ${fs}px system-ui,sans-serif`; const tw = x.measureText(txt).width, px = Math.min(W - tw - fs, Math.max(fs * 0.4, lp.u * k + fs * 0.6)), py = Math.max(fs * 1.2, lp.v * k - fs * 0.5);
    x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.roundRect ? x.roundRect(px - fs * 0.4, py - fs * 1.05, tw + fs * 0.8, fs * 1.45, fs * 0.35) : x.rect(px - fs * 0.4, py - fs * 1.05, tw + fs * 0.8, fs * 1.45); x.fill();
    x.fillStyle = '#fff'; x.fillText(txt, px, py); x.restore();
  },
  drawCard(x, W, s) {
    const fs = Math.round(W / 34), pad = fs * 0.8, lefty = this.lefty();
    const rows = [[s.club.name.toUpperCase(), ''], ['Carry', `${Math.round(s.shot.D / YD)} yd`], ['Apex', `${Math.round(s.shot.H / YD)} yd`], ['Shape', T().describeShape(s.shot, lefty)]];
    if (s.strike) rows.push(['Strike', s.strike]);
    x.save(); x.font = `600 ${fs}px system-ui,sans-serif`;
    const w = Math.max(...rows.map(r => x.measureText(r[0] + '    ' + r[1]).width)) + pad * 2, h = rows.length * fs * 1.45 + pad * 1.2, x0 = pad, y0 = pad;
    x.fillStyle = 'rgba(7,17,11,.72)'; x.beginPath(); x.roundRect ? x.roundRect(x0, y0, w, h, fs * 0.6) : x.rect(x0, y0, w, h); x.fill();
    x.fillStyle = this.style.color; x.fillRect(x0, y0 + fs * 0.5, fs * 0.22, h - fs);
    rows.forEach((r, i) => { const yy = y0 + pad + fs * (i * 1.45 + 0.95); x.fillStyle = i ? 'rgba(255,255,255,.75)' : '#fff'; x.font = `${i ? 600 : 800} ${fs}px system-ui,sans-serif`; x.fillText(r[0], x0 + pad, yy); x.fillStyle = '#fff'; x.font = `800 ${fs}px system-ui,sans-serif`; const tw = x.measureText(r[1]).width; x.fillText(r[1], x0 + w - pad - tw, yy); });
    x.restore();
  },
  paintEdit(fromSlider) {
    const s = this.st, q = this.q, lefty = this.lefty();
    q('#trColors').querySelectorAll('[data-col]').forEach(b => b.setAttribute('aria-pressed', b.dataset.col.toLowerCase() === this.style.color.toLowerCase()));
    q('#trWidth').querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', b.dataset.w === this.style.width));
    if (!s) return;
    const sh = s.shot, m = lefty ? -1 : 1, desc = T().describeShape(sh, lefty);
    q('#trShapes').querySelectorAll('[data-shape]').forEach(b => b.classList.toggle('on', T().SHAPES[b.dataset.shape].name === desc || (desc === 'Straight' && b.dataset.shape === 'straight')));
    q('#trStrike').querySelectorAll('[data-strike]').forEach(b => b.classList.toggle('on', b.dataset.strike === s.strike));
    const set = (id, v, txt) => { const el = q(id); if (!fromSlider || document.activeElement !== el) el.value = v; q(id + 'V').textContent = txt; };
    set('#trCarry', Math.round(sh.D / YD), `${Math.round(sh.D / YD)} yd`);
    set('#trApex', Math.round(sh.H / YD), `${Math.round(sh.H / YD)} yd`);
    const a = m * sh.az * 180 / Math.PI; set('#trStartDir', a.toFixed(1), Math.abs(a) < 0.5 ? 'On line' : `${Math.abs(a).toFixed(1)}° ${a > 0 ? 'right' : 'left'}`);
    const c = m * sh.curve / sh.D * 100; set('#trCurve', c.toFixed(1), Math.abs(c) < 0.5 ? 'None' : `${Math.round(Math.abs(c * sh.D / 100) / YD)} yd ${c > 0 ? 'right' : 'left'}`);
    const dt = Math.round((s.t0 - s.auto.t0) * 1000); set('#trTime', dt, dt ? `${dt > 0 ? '+' : ''}${dt} ms` : 'Auto');
    q('#trShapeNow').textContent = desc;
    const fp = T().faceAndPath(sh, lefty), why = q('#trWhy');
    if (why) why.innerHTML = `<b>What your ball flight says</b><br>Clubface about <b>${fp.faceTxt}</b> to the target, swing path <b>${fp.pathTxt}</b>. ${fp.why} <span class="mut">Fix: ${fp.fix}</span> <span class="mut" style="font-size:.8rem">Estimated from the start line and curve, so treat it as a guide.</span>`;
    try { localStorage.setItem('cc_lastflight', JSON.stringify(Object.assign({ t: Date.now(), shape: desc }, fp))); } catch (_) {}
  },

  // ---------- export ----------
  async exportImage() {
    if (!this.st) return; const v = this.q('#trVid'); this.pause(); this.showFull = true;
    if (Math.abs(v.currentTime - this.hold()) > 0.05) await this.seekFrame(v, this.hold());
    this.render(); const c = this.compose(v, null); const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    this.deliver(blob, `caddy-coach-tracer-${Date.now()}.png`);
  },
  async exportVideo() {
    if (!this.st) return; const b = this.q('#trSaveVid'); b.disabled = true; this.exporting = true; this.pause();
    let blob = null;
    try {
      if (root.VideoEncoder && root.VideoFrame && root.TracerMP4) blob = await this.encodeVideo().catch(e => { console.warn('tracer encode', e); return null; });
      if (!blob) blob = await this.recordVideo();
    } catch (e) { console.error(e); }
    this.exporting = false; b.disabled = false; this.showFull = true; this.say(''); this.finish();
    if (!blob || !blob.size) { this.say('This phone couldn\'t make the video. Use Save image instead.'); return; }
    // phones only let a page open the save sheet straight after a tap, so the finished video waits for one more tap
    this.ready = new File([blob], `caddy-coach-tracer-${Date.now()}.${/mp4/.test(blob.type) ? 'mp4' : 'webm'}`, { type: blob.type });
    b.textContent = 'Save to Photos'; b.classList.add('pri');
    this.say(navigator.canShare && navigator.canShare({ files: [this.ready] }) ? 'Your tracer video is ready. Tap Save to Photos, then choose Save Video to put it in your camera roll.' : 'Your tracer video is ready. Tap Save to Photos to download it.');
  },
  // Frame-by-frame: every frame of the saved video is drawn and encoded on a steady 30 fps clock, so it never
  // stutters or freezes however busy the phone is. The clip plays at half speed while it's built.
  async encodeVideo() {
    const v = this.q('#trVid'), s = this.st, FPS = 30, L = Math.max(v.videoWidth, v.videoHeight);
    let P = null;
    for (const lim of [1920, 1280]) {
      const sc = Math.min(1, lim / L), W = Math.round(v.videoWidth * sc / 2) * 2, H = Math.round(v.videoHeight * sc / 2) * 2, bitrate = Math.min(14e6, Math.round(W * H * FPS * 0.15));
      for (const [kind, codec] of [['avc', 'avc1.640028'], ['avc', 'avc1.4d0028'], ['avc', 'avc1.42e028'], ['avc', 'avc1.42001f'], ['vp9', 'vp09.00.40.08']]) {
        const cfg = { codec, width: W, height: H, bitrate, framerate: FPS }; if (kind === 'avc') cfg.avc = { format: 'avc' };
        try { const r = await VideoEncoder.isConfigSupported(cfg); if (r && r.supported) { P = { kind, cfg, W, H }; break; } } catch (_) {}
      }
      if (P) break;
    }
    if (!P) return null;
    const samples = []; let desc = null, err = null;
    const enc = new VideoEncoder({
      output: (ch, meta) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); samples.push({ data: d, key: ch.type === 'key', pts: ch.timestamp });
        const dc = meta && meta.decoderConfig; if (dc && dc.description && !desc) desc = new Uint8Array(ArrayBuffer.isView(dc.description) ? dc.description.buffer.slice(dc.description.byteOffset, dc.description.byteOffset + dc.description.byteLength) : dc.description.slice(0)); },
      error: e => { err = e; } });
    enc.configure(P.cfg);
    const c = document.createElement('canvas'); c.width = P.W; c.height = P.H;
    const tA = Math.max(0, s.t0 - 2.2), hold = this.hold(), tEnd = hold + this.extra(), total = Math.max(1, Math.ceil((tEnd - tA) * FPS));
    let n = 0, lastSay = 0;
    const tNext = () => tA + n / FPS;
    const prog = () => { const now = performance.now(); if (now - lastSay > 200) { lastSay = now; this.say(`Making your tracer video… ${Math.min(99, Math.round(n / total * 100))}%`); } };
    const frame = (tnow, src) => { this.compose(src, tnow, c); const f = new VideoFrame(c, { timestamp: Math.round(n * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); enc.encode(f, { keyFrame: n % 60 === 0 }); f.close(); n++; };
    const drain = async () => { while (enc.encodeQueueSize > 2 && !err) await sleep(4); if (err) throw err; };
    this.say('Making your tracer video…'); this._enc = { careful: false, t0: performance.now() };
    // 1. the filmed part
    await this.seekFrame(v, tA);
    if (v.requestVideoFrameCallback) {
      await new Promise((res, rej) => {
        let done = false, stall = null; const half = 0.5 / FPS;
        const fin = e => { if (done) return; done = true; clearTimeout(stall); v.pause(); try { v.playbackRate = 1; } catch (_) {} e ? rej(e) : res(); };
        const guard = () => { clearTimeout(stall); stall = setTimeout(() => fin(), 4000); };
        // Fast mode: frames are made while the clip plays. If the phone can't keep up and pictures get skipped,
        // it rewinds to the last good one and switches to careful mode, pausing on each picture while it's used.
        let careful = false, lastMt = null, dtMin = Infinity;
        const cb = async (now, meta) => {
          if (done) return; guard(); const mt = meta && meta.mediaTime != null ? meta.mediaTime : v.currentTime;
          try {
            if (lastMt != null && mt > lastMt) {
              const dt = mt - lastMt;
              if (!careful && dtMin < 1 && dt > dtMin * 1.6 && tNext() < mt - half) {
                careful = true; this._enc = Object.assign(this._enc || {}, { careful: true, at: +mt.toFixed(2) }); v.pause(); try { v.playbackRate = 1; } catch (_) {} await this.seekFrame(v, Math.max(tA, lastMt + dtMin * 0.5)); lastMt = null; if (done) return;
                v.requestVideoFrameCallback(cb); const pp = v.play(); if (pp && pp.catch) pp.catch(fin); return;
              }
              dtMin = Math.min(dtMin, dt);
            }
            lastMt = mt;
            // turn the picture on screen into every 30 fps frame it covers (drawn now, while it's still the one showing)
            const due = tNext() <= mt + half && tNext() <= hold;
            if (due && careful) v.pause();
            while (tNext() <= mt + half && tNext() <= hold) frame(tNext(), v);
            prog();
            if (tNext() > hold || v.ended || mt >= hold) return fin();
            if (due && careful) { if (enc.encodeQueueSize > 2) await drain(); if (done) return; v.requestVideoFrameCallback(cb); const pp = v.play(); if (pp && pp.catch) pp.catch(fin); return; }
            if (enc.encodeQueueSize > 2) { v.pause(); await drain(); if (done) return; v.requestVideoFrameCallback(cb); const pp = v.play(); if (pp && pp.catch) pp.catch(fin); return; }
          } catch (e) { return fin(e); }
          v.requestVideoFrameCallback(cb);
        };
        v.requestVideoFrameCallback(cb); guard();
        try { v.playbackRate = 0.5; } catch (_) {}
        const p = v.play(); if (p && p.catch) p.catch(fin);
      });
    }
    // anything left before the hold point (older phones without frame callbacks, or a frame missed at the end): seek to each frame
    while (tNext() <= hold) { await this.seekFrame(v, tNext()); frame(tNext(), v); await drain(); prog(); }
    // 2. the ball still in the air after the clip's hold point: the last picture stays and the tracer carries on
    await this.seekFrame(v, hold);
    const still = document.createElement('canvas'); still.width = P.W; still.height = P.H; still.getContext('2d').drawImage(v, 0, 0, P.W, P.H);
    while (n < total) { frame(tNext(), still); if (n % 4 === 0) { await drain(); prog(); } }
    await enc.flush(); enc.close(); if (err) throw err;
    if (P.kind === 'avc' && !desc) throw new Error('no avcC');
    this.say('Making your tracer video… 100%');
    return root.TracerMP4.mux({ width: P.W, height: P.H, fps: FPS, codec: P.kind, description: desc, samples });
  },
  // older browsers: record the composed picture in real time
  async recordVideo() {
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'], type = root.MediaRecorder && types.find(t => MediaRecorder.isTypeSupported(t));
    const c = document.createElement('canvas'); if (!c.captureStream || !root.MediaRecorder) return null;
    this.compose(this.q('#trVid'), null, c); this.recC = c;
    let rec; try { rec = new MediaRecorder(c.captureStream(30), type ? { mimeType: type, videoBitsPerSecond: 8e6 } : undefined); } catch (e) { this.recC = null; return null; }
    const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { rec.onstop = r; });
    this.say('Recording your tracer video…'); rec.start(250);
    await new Promise(res => { this.onEnd = res; this.replay(); });
    this.onEnd = null; const t1 = performance.now(); while (performance.now() - t1 < 300) { this.compose(this.q('#trVid'), null, c); await sleep(33); }
    rec.stop(); await done; this.recC = null;
    return new Blob(chunks, { type: (type || 'video/webm').split(';')[0] });
  },
  async saveReady() {
    const f = this.ready, b = this.q('#trSaveVid'); if (!f) return;
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Caddy Coach shot tracer' }); this.say('Saved. If you chose Save Video it\'s in your camera roll.'); this.ready = null; b.textContent = 'Save video to Photos'; return; } }
    catch (e) { if (e && e.name === 'AbortError') return; }
    if (window.ccSaveFile) { if (await window.ccSaveFile(f.name, f) !== 'saved') return; } else { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
    this.say(`Saved ${f.name} to your downloads.`); this.ready = null; b.textContent = 'Save video to Photos';
  },
  async deliver(blob, name) {
    try { const f = new File([blob], name, { type: blob.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Caddy Coach shot tracer' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    if (window.ccSaveFile) { if (await window.ccSaveFile(name, blob) !== 'saved') return; } else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
    this.say(`Saved ${name}`);
  },
};
root.TracerUI = TracerUI;
})(typeof window !== 'undefined' ? window : this);
