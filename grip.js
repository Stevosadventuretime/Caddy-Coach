// Caddy Coach live grip check: body pose + both hands (21 points each), face-on camera.
// GripEngine is pure logic; GripUI owns the camera, overlay, close-up and audio. Needs live.js and hand.js.
(function (root) {
'use strict';
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const norm = v => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };

// ---- per-hand geometry ----
function handGeom(h) {
  const P = h.pts, W = h.wpts || P;
  const C = { x: (P[0].x + P[5].x + P[9].x + P[13].x + P[17].x) / 5, y: (P[0].y + P[5].y + P[9].y + P[13].y + P[17].y) / 5 };
  const len = dist(P[0], P[9]) || 1;
  // V between thumb and index: bisector of the thumb line and the index-side line, pointing up the arm
  const u1 = norm({ x: P[2].x - P[4].x, y: P[2].y - P[4].y }), u2 = norm({ x: P[5].x - P[6].x, y: P[5].y - P[6].y });
  const v = norm({ x: u1.x + u2.x, y: u1.y + u2.y }), web = mid(P[2], P[5]);
  // back-of-hand normal in 3D (world landmarks, metres) -> how square the back of the hand is to the camera
  const a = [W[5].x - W[0].x, W[5].y - W[0].y, W[5].z - W[0].z], b = [W[17].x - W[0].x, W[17].y - W[0].y, W[17].z - W[0].z];
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const cos = Math.abs(n[2]) / (Math.hypot(n[0], n[1], n[2]) || 1);
  return { C, len, v, web, cos, P };
}

const STYLES = { overlap: { gap: 1.25, name: 'Overlap (Vardon)' }, interlock: { gap: 1.25, name: 'Interlock' }, ten: { gap: 1.6, name: 'Ten-finger (baseball)' } };

// One hand at a time. At address your hands overlap on the grip, so no camera can see both of them fully at once.
// Step 1 checks the lead hand on its own (trail arm by your side); step 2 adds the trail hand, which sits on top
// and is the one the camera sees, and checks it against where the lead hand was.
function GripEngine(opt) {
  this.right = opt.right !== false; this.style = STYLES[opt.style] ? opt.style : 'overlap';
  this.single = !!opt.single;   // a photo: only the visible top hand can be checked
  this.step = this.single ? 'trail' : 'lead'; this.win = []; this.lastSaid = {}; this.inSince = null; this.attempts = 1; this.good = 0;
  this.lostSince = null; this.findSaid = -99; this.outSince = {}; this.leadLock = null; this.stepSince = null; this.lvPrev = {};
}
GripEngine.STYLES = STYLES;
// "finding you" prompts (face the camera, which hand, etc.) are spoken at most every 6 s between them
GripEngine.prototype.find = function (out, t, key, gap, text) { if (t - (this.lastSaid[key] || -99) > gap && t - (this.lastFind || -99) > 6) { out.say.push({ text, pri: 2 }); this.lastSaid[key] = t; this.lastFind = t; } };
GripEngine.prototype.w = function () { return this.right ? { L: 'left', T: 'right' } : { L: 'right', T: 'left' }; };
// which wrist the app should look for a hand from
GripEngine.prototype.track = function () { return this.step === 'trail' ? 'trail' : 'lead'; };
// move on without waiting for the lead hand to be in the zone
GripEngine.prototype.skip = function () { if (this.step !== 'lead') return; this.leadLock = this.cur || null; this.step = 'trail'; this.win = []; this.inSince = null; this.stepSince = null; };
GripEngine.prototype.restart = function () { this.step = this.single ? 'trail' : 'lead'; this.leadLock = null; this.win = []; this.inSince = null; this.stepSince = null; this.lvPrev = {}; };

// body: 33 pose points (image px) or null; hand: {pts, wpts} for the hand being checked, or null
GripEngine.prototype.push = function (t, body, hand, W, H) {
  const out = { t, say: [], level: 'idle', text: '', sub: '', metrics: [], draw: null, step: this.step };
  const wd = this.w(), L = cap(wd.L), Tn = cap(wd.T);
  const okBody = body && [0, 11, 12, 23, 24].every(i => body[i].vis == null || body[i].vis > 0.5) && body[0].y > 0 && Math.max(body[23].y, body[24].y) < H * 1.05;
  if (!okBody) {
    this.lostSince = this.lostSince == null ? t : this.lostSince;
    out.text = 'Stand facing the camera, head to knees in view'; out.sub = 'Phone about 1.5 m in front of you, at chest height';
    if (t - this.lostSince > 1.5 && t - this.findSaid > 8) { out.say.push({ text: 'Face the camera so I can see you from head to knees', pri: 2 }); this.findSaid = t; }
    if (t - this.lostSince > 0.8) { this.win = []; this.inSince = null; }
    return out;
  }
  this.lostSince = null;
  const sh = mid(body[11], body[12]), hp = mid(body[23], body[24]), T = dist(sh, hp) || 1;
  if (Math.abs(body[11].x - body[12].x) / T < 0.45) {
    out.level = 'warn'; out.text = 'Face the camera square on'; out.sub = 'The grip check needs the camera in front of you, chest high';
    this.find(out, t, 'face', 8, 'Turn to face the camera');
    return out;
  }
  const leadW = this.right ? body[15] : body[16], trailW = this.right ? body[16] : body[15], apart = dist(leadW, trailW) / T;
  const rel = p => ({ x: (p.x - hp.x) / T, y: (p.y - hp.y) / T }), abs = r => ({ x: hp.x + r.x * T, y: hp.y + r.y * T });
  const leadDir = Math.sign(this.right ? body[11].x - body[12].x : body[12].x - body[11].x) || 1;
  const chin = body[0], trailSh = this.right ? body[12] : body[11], shY = sh.y, span = (trailSh.x - chin.x) || 1;
  // where a V points at shoulder height: 0 = chin, 1 = trail shoulder
  const aim = g => { if (g.v.y > -0.25) return null; const k = (shY - g.web.y) / g.v.y; const x = g.web.x + k * g.v.x; return { s: (x - chin.x) / span, x, y: shY }; };
  const zone = { chin, trailSh, shY };
  const LL = this.leadLock, leadC = LL && LL.C && LL.C.x != null ? abs(LL.C) : null, len = LL && LL.len ? LL.len * T : null;
  // is the hand we can see actually on the grip next to the lead hand? (the wrists alone can't tell: a hanging arm is close by too)
  // (and if all we can see is the lead hand again, sitting where it was, the trail hand isn't on yet)
  const onGrip = h => { if (!h) return false; if (!leadC) return apart < 0.3; const d = dist(handGeom(h).C, leadC); return d < 2.4 * len && d > 0.3 * len; };
  const stepIn = () => { if (this.stepSince == null) this.stepSince = t; };

  // ---- finished: wait for the hands to come apart, then start again ----
  if (this.step === 'done') {
    if (!onGrip(hand) && (apart > 0.35 || !hand)) { this.restart(); this.attempts++; out.say.push({ text: `Build it again. ${L} hand first.`, pri: 2 }); return out; }
    out.level = 'in'; out.text = 'Great grip'; out.sub = 'Let go, shake your hands out, and build it again'; out.metrics = this.lastMetrics || [];
    return out;
  }

  // ---- step 1: lead hand on its own ----
  if (this.step === 'lead') {
    stepIn();
    if (apart < 0.22) {
      out.text = `Take your ${wd.T} hand off for now`; out.sub = `Hold the club in your ${wd.L} hand only, at address, with your ${wd.T} arm hanging by your side. Your ${wd.T} hand comes next.`;
      this.find(out, t, 'off', 7, `Just your ${wd.L} hand on the club for now. ${Tn} arm by your side.`);
      this.win = []; this.inSince = null; return out;
    }
    if (!hand) {
      out.text = `I can't see your ${wd.L} hand`; out.sub = 'Hold the club out at address in front of you, with your hand between your thighs and the camera, in good light';
      if (t - this.stepSince > 2) this.find(out, t, 'findL', 8, `Hold the club in your ${wd.L} hand, out in front of you`);
      this.win = []; this.inSince = null; return out;
    }
    const g = handGeom(hand), a = aim(g), kn = 1 + 3 * g.cos;
    const last = this.win[this.win.length - 1], moving = last && dist(abs(last.C), g.C) / T / Math.max(0.05, t - last.t) > 0.6;
    this.win.push({ t, C: rel(g.C), th: rel(g.P[4]), len: g.len / T, kn, s: a && a.s });
    while (this.win.length > 1 && t - this.win[0].t > 1.6) this.win.shift();
    const md = k => median(this.win.map(x => x[k]).filter(x => x != null));
    const knM = md('kn'), sM = md('s');
    out.draw = Object.assign({ g, a, key: 'lead' }, zone);
    this.cur = { C: { x: median(this.win.map(w => w.C.x)), y: median(this.win.map(w => w.C.y)) }, th: { x: median(this.win.map(w => w.th.x)), y: median(this.win.map(w => w.th.y)) }, len: md('len'), kn: knM, s: sM };
    if (moving || this.win.length < 3) { out.text = 'Hold still'; out.sub = `Checking your ${wd.L} hand…`; this.inSince = null; return out; }
    const kSev = knM < 2 ? (2 - knM) / 0.5 : knM > 3.2 ? (knM - 3.2) / 0.5 : 0, kDir = knM < 2 ? -1 : 1;
    const vSev = sM == null ? 0 : sM < 0.1 ? (0.1 - sM) / 0.3 : sM > 1.3 ? (sM - 1.3) / 0.35 : 0, vDir = sM != null && sM < 0.1 ? -1 : 1;
    const sev = Math.max(kSev, vSev), dir = kSev >= vSev ? kDir : vDir;
    const kTxt = knM < 1.6 ? 'about 1 knuckle' : knM < 2.4 ? 'about 2 knuckles' : knM < 3.2 ? 'about 3 knuckles' : 'all 4 knuckles';
    const vW = sM == null ? '' : sM < 0.1 ? `, V at or ${wd.L} of your chin` : sM > 1.3 ? `, V outside your ${wd.T} shoulder` : `, V between chin and ${wd.T} shoulder`;
    const m = { key: 'lead', label: `${L} hand`, sev, lv: this.lv('lead', sev), val: (sev < 0.6 ? 'neutral: ' : dir < 0 ? 'weak: ' : 'strong: ') + kTxt + vW, aim: `2–3 knuckles showing, V pointing between your chin and ${wd.T} shoulder`,
      say: dir < 0 ? `Turn your ${wd.L} hand more on top of the grip` : `Turn your ${wd.L} hand back toward the target`,
      tip: dir < 0 ? `Weak ${wd.L} hand: it tends to leave the face open, so the ball slices. Turn the hand away from the target until you can see 2 or 3 knuckles.` : `Strong ${wd.L} hand: it tends to shut the face, so the ball hooks. Turn the hand toward the target until you see 2 or 3 knuckles.` };
    out.metrics = [m];
    if (m.lv === 'in') {
      this.inSince = this.inSince == null ? t : this.inSince;
      out.level = 'in'; out.text = `${L} hand in the zone`; out.sub = `Hold it… ${Math.min(1.5, t - this.inSince).toFixed(1)} s`;
      if (t - this.inSince >= 1.5) {
        this.leadLock = Object.assign({ m }, this.cur); this.step = 'trail'; this.win = []; this.inSince = null; this.stepSince = null;
        out.say.push({ text: `Good ${wd.L} hand. Now add your ${wd.T} hand.`, pri: 3, tone: 'good', force: true });
        out.text = `Good. Now add your ${wd.T} hand`; out.sub = `Keep your ${wd.L} hand where it is and put your ${wd.T} hand on below it.`;
      }
    } else { this.inSince = null; this.coach(out, m, t); }
    return out;
  }

  // ---- step 2: trail hand (on top, the one the camera sees) ----
  stepIn();
  if (!this.single && !onGrip(hand) && apart > 0.22) {
    out.text = `Now add your ${wd.T} hand`; out.sub = `Keep your ${wd.L} hand where it is and put your ${wd.T} hand on the grip below it.`;
    this.find(out, t, 'add', 8, `Now put your ${wd.T} hand on`);
    this.win = []; this.inSince = null; return out;
  }
  if (!hand) {
    out.text = `I can't see your ${wd.T} hand clearly`; out.sub = 'Keep your hands between your thighs and the camera, in good light, and hold still';
    if (t - this.stepSince > 2.5) this.find(out, t, 'findT', 8, 'Hold still at address so I can see your hands');
    this.win = []; this.inSince = null; return out;
  }
  const g = handGeom(hand), a = aim(g);
  const last = this.win[this.win.length - 1], moving = last && dist(abs(last.C), g.C) / T / Math.max(0.05, t - last.t) > 0.6;
  const leadTh = LL && LL.th && LL.th.x != null ? abs(LL.th) : null, L2 = len || g.len;
  const wr = mid(body[15], body[16]), hw = Math.abs(body[23].x - body[24].x) / 2 || T * 0.3, pos = (wr.x - hp.x) * leadDir / hw;
  this.win.push({ t, C: rel(g.C), s: a && a.s, gap: leadC ? dist(g.C, leadC) / L2 : null, th: leadTh ? dist(leadTh, g.C) / L2 : null, pos });
  while (this.win.length > 1 && t - this.win[0].t > 1.6) this.win.shift();
  const md = k => median(this.win.map(x => x[k]).filter(x => x != null));
  const sT = md('s'), gap = md('gap'), th = md('th'), ps = md('pos');
  out.draw = Object.assign({ g, a, key: 'trail' }, zone);
  if (moving || this.win.length < 3) { out.text = 'Hold still'; out.sub = `Checking your ${wd.T} hand…`; this.inSince = null; return out; }
  const M = [];
  if (LL && LL.m) M.push(Object.assign({}, LL.m, { lv: LL.m.sev < 0.6 ? 'in' : LL.m.lv, say: null }));
  const tSev = sT == null ? 0 : sT < 0.3 ? (0.3 - sT) / 0.3 : sT > 1.4 ? (sT - 1.4) / 0.35 : 0;
  M.push({ key: 'trail', label: `${Tn} hand`, sev: tSev, val: sT == null ? 'V not clear' : sT < 0.3 ? 'turned too far over the top (weak)' : sT > 1.4 ? 'turned too far under (strong)' : `V pointing at your ${wd.T} shoulder`, aim: `palm facing the target, V pointing at your ${wd.T} shoulder`,
    say: sT != null && sT < 0.3 ? `Turn your ${wd.T} hand more under the grip` : `Turn your ${wd.T} hand more on top of the grip`,
    tip: sT != null && sT < 0.3 ? `Your ${wd.T}-hand V points at your chin or beyond. Turn the hand away from the target so its palm faces the target and the V points at your ${wd.T} shoulder.` : `Your ${wd.T} hand is too far under the grip. Turn it toward the target so the V points at your ${wd.T} shoulder.` });
  if (gap != null) { const gMax = STYLES[this.style].gap, gSev = gap > gMax ? (gap - gMax) / 0.3 : 0;
    M.push({ key: 'gap', label: 'Hands together', sev: gSev, val: gap > gMax ? 'a gap between your hands' : 'hands working together', aim: 'no gap between the hands',
      say: `Slide your ${wd.T} hand up to your ${wd.L}`, tip: `Your hands look apart. Slide the ${wd.T} hand up so it touches the ${wd.L} hand and they work as one.` }); }
  if (th != null && this.style !== 'ten') { const thSev = th > 0.85 ? (th - 0.85) / 0.3 : 0;
    M.push({ key: 'thumb', label: `${L} thumb`, sev: thSev, val: th > 0.85 ? 'showing' : `covered by your ${wd.T} palm`, aim: `tucked under your ${wd.T} palm`,
      say: `Cover your ${wd.L} thumb with your ${wd.T} palm`, tip: `Fit the fleshy pad of your ${wd.T} palm over your ${wd.L} thumb.` }); }
  const pSev = ps < -0.1 ? (-0.1 - ps) / 0.3 : ps > 1.5 ? (ps - 1.5) / 0.4 : 0;
  M.push({ key: 'pos', label: 'Hand position', sev: pSev, val: ps < -0.1 ? 'behind centre' : ps > 1.5 ? `outside your ${wd.L} thigh` : 'just ahead of centre', aim: `between the centre of your body and your ${wd.L} thigh`,
    say: ps < -0.1 ? `Hands forward a touch, toward your ${wd.L} thigh` : 'Hands back a touch, toward the centre',
    tip: ps < -0.1 ? `Press your hands slightly toward your ${wd.L} thigh so the shaft leans a little toward the target.` : 'Your hands are pushed well ahead. Bring them back toward your zip.' });
  for (const m of M) if (m.key !== 'lead') m.lv = this.lv(m.key, m.sev);
  out.metrics = M; this.lastMetrics = M;
  const live = M.filter(m => m.key !== 'lead'), worst = live.slice().sort((a2, b) => ((b.lv === 'out') - (a2.lv === 'out')) || b.sev - a2.sev)[0];
  if (live.every(m => m.lv === 'in')) {
    this.inSince = this.inSince == null ? t : this.inSince;
    out.level = 'in'; out.text = 'In the zone'; out.sub = `Hold it… ${Math.min(1.5, t - this.inSince).toFixed(1)} s`;
    if (t - this.inSince >= 1.5) {
      this.step = 'done'; this.good++;
      const leadOk = !LL || !LL.m || LL.m.sev < 0.6;
      out.say.push({ text: leadOk ? (this.good === 1 ? 'Great grip. That is in the zone. Now let go, and build it again.' : 'Great grip.') : `Good ${wd.T} hand. Work on your ${wd.L} hand next time.`, pri: 3, tone: 'good', force: true });
      out.text = 'Great grip'; out.sub = 'Let go, shake your hands out, and build it again';
    }
    for (const k in this.outSince) delete this.outSince[k];
  } else { this.inSince = null; this.coach(out, worst, t); }
  return out;
};
// a verdict only changes when the reading clearly crosses the line
GripEngine.prototype.lv = function (key, sev) {
  const p = this.lvPrev[key]; let lv = sev >= 1 ? 'out' : sev >= 0.6 ? 'warn' : 'in';
  if (p === 'in' && sev < 0.8) lv = 'in'; else if (p === 'out' && sev > 0.8) lv = 'out';
  this.lvPrev[key] = lv; return lv;
};
GripEngine.prototype.coach = function (out, m, t) {
  out.level = m.lv === 'out' ? 'out' : 'warn'; out.text = m.say; out.sub = m.tip;
  if (m.lv === 'out') { const k = m.key + m.say; this.outSince[k] = this.outSince[k] == null ? t : this.outSince[k];
    if (t - this.outSince[k] >= 0.8 && t - (this.lastSaid[k] || -99) > 4.5) { out.say.push({ text: m.say, pri: 2 }); this.lastSaid[k] = t; } }
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- UI ----------
const css = `
.gpStage{max-height:50vh}
.gpInset{position:absolute;right:8px;top:8px;width:34%;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:#000;border:2px solid rgba(255,255,255,.7);z-index:2;display:none}
.gpInset.on{display:block}
.gpInset canvas{position:absolute;inset:0;width:100%;height:100%}
.gpInset.mir canvas{transform:scaleX(-1)}
.gpInset span{position:absolute;left:6px;top:6px;background:rgba(7,17,11,.75);color:#cfe0d3;font:600 .72rem system-ui,sans-serif;padding:3px 8px;border-radius:999px;letter-spacing:.04em}
.gpTwo{display:grid;gap:10px}

.gpM{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}
.gpM li{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:center;padding:8px 10px;border-radius:10px;background:#122017;border-left:4px solid #2c4a35}
.gpM li i{grid-row:span 2;width:12px;height:12px;border-radius:50%;background:#9fb8a5}
.gpM li b{font-size:.9rem}.gpM li small{color:#a9bdae;font-size:.8rem;line-height:1.35}
.gpM li.in{border-left-color:#46c06e}.gpM li.in i{background:#46c06e}
.gpM li.warn{border-left-color:#e0b13a}.gpM li.warn i{background:#e0b13a}
.gpM li.out{border-left-color:#ef6b5e}.gpM li.out i{background:#ef6b5e}
.gpSteps{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0 0;padding:0;counter-reset:s}
.gpSteps li{counter-increment:s;padding:8px 6px;border-radius:10px;background:#122017;color:#9fb8a5;font:600 .82rem system-ui,sans-serif;text-align:center}
.gpSteps li:before{content:counter(s) '. '}
.gpSteps li.now{background:#1c3a26;color:#eef5ec;box-shadow:inset 0 0 0 2px #46c06e}
.gpSteps li.ok{color:#46c06e}
`;
const HB = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

const GripUI = {
  el: null,
  ensure() {
    if (this.el) return;
    const LC = root.LiveCoach; LC.injectCss();
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const el = document.createElement('div'); el.className = 'lv'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Live grip check');
    el.innerHTML = `<div class="lvTop"><h2>Live grip check<small>Practice</small></h2><button type="button" class="lvX" aria-label="Close grip check">✕</button></div>
<div class="lvBody">
 <div class="lvSet" id="gpSet">
  <p>Prop your phone about 1.5 m in front of you at chest height, facing you square on, so you're in the picture from your head to your knees.</p>
  <p>Your grip is checked one hand at a time, the way a coach builds it. <b>First</b>, hold the club at address with just your lead hand (your left, for a right-hander), other arm by your side. <b>Then</b> add your other hand. Your hands overlap on the club, so checking them one at a time is what lets the camera see each one properly. The voice tells you which way to turn each hand and when it's in the zone.</p>
  <div class="lvRow"><span class="lvLbl">Golfer</span><span class="lvSeg" id="gpHand"><button type="button" data-v="right">Right-handed</button><button type="button" data-v="left">Left-handed</button></span></div>
  <div class="lvRow"><span class="lvLbl">Grip</span><span class="lvSeg" id="gpStyle"><button type="button" data-v="overlap">Overlap</button><button type="button" data-v="interlock">Interlock</button><button type="button" data-v="ten">Ten-finger</button></span></div>
  <div class="lvRow"><span class="lvLbl">Lens</span><span class="lvSeg" id="gpLens"><button type="button" data-v="user">Front (screen faces you)</button><button type="button" data-v="environment">Back</button></span></div>
  <div class="lvRow"><span class="lvLbl">Sound</span><span class="lvSeg" id="gpSound"><button type="button" data-v="voice">Voice</button><button type="button" data-v="tones">Tones</button><button type="button" data-v="off">Off</button></span></div>
  <p>Good light helps a lot: face a window or a lamp, and avoid a bright light behind you. A glove is fine.</p>
  <div class="lvRow"><button type="button" class="lvGo" id="gpStart">Start camera</button><label class="lvAlt" for="gpFile">Use a photo or video</label><input type="file" id="gpFile" accept="image/*,video/*" hidden></div>
  <div class="lvMsg" id="gpMsg" role="status"></div>
 </div>
 <div id="gpRun" hidden>
  <ol class="gpSteps" id="gpSteps"><li data-s="lead">Lead hand</li><li data-s="trail">Add other hand</li><li data-s="done">Done</li></ol>
  <div class="lvStatus" id="gpStatus" aria-live="polite"><b>Starting…</b><span></span></div>
  <div class="lvStage gpStage" id="gpStage"><video id="gpVid" playsinline muted autoplay></video><img id="gpImg" alt="" hidden style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"><canvas id="gpCan"></canvas>
   <div class="gpInset" id="gpInsetBox"><canvas id="gpInset" width="360" height="360" aria-label="Close-up of your hand"></canvas><span>Close-up</span></div></div>
  <ul class="gpM" id="gpMetrics"></ul>
  <div class="lvStats" id="gpStats"></div>
  <div class="lvKey"><span><i style="background:#46c06e"></i>Green band: where your V should point</span><span>The arrow shows where it points now</span></div>
  <div class="lvRow" style="margin-top:10px"><button type="button" class="lvAlt" id="gpSkip">Skip to the other hand</button><button type="button" class="lvAlt" id="gpAgain">Start again</button><button type="button" class="lvAlt" id="gpStop">Stop</button></div>
 </div>
</div>`;
    document.body.appendChild(el); this.el = el;
    const q = s => el.querySelector(s); this.q = q;
    q('.lvX').onclick = () => this.close();
    el.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    const seg = (id, key, cb) => q(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.opt[key] = b.dataset.v; this.paint(); cb && cb(); });
    seg('#gpHand', 'hand'); seg('#gpStyle', 'style', () => { try { localStorage.setItem('cc_grip_style', this.opt.style); } catch (_) {} });
    seg('#gpLens', 'lens'); seg('#gpSound', 'sound', () => { this.spk.mode = this.opt.sound; try { localStorage.setItem('cc_live_sound', this.opt.sound); } catch (_) {} });
    q('#gpStart').onclick = () => this.start('camera');
    q('#gpFile').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) this.start(/^image\//.test(f.type) ? 'image' : 'file', f); };
    q('#gpStop').onclick = () => this.stop(true);
    q('#gpSkip').onclick = () => { if (this.eng) { this.eng.skip(); this.spk.say({ text: `Now put your ${this.eng.w().T} hand on`, force: true, pri: 2 }); } };
    q('#gpAgain').onclick = () => { if (this.eng) { this.eng.restart(); this.spk.say({ text: `${cap(this.eng.w().L)} hand first`, force: true, pri: 2 }); } };
    this.spk = new LC.Speaker();
  },
  paint() { for (const [id, k] of [['#gpHand', 'hand'], ['#gpStyle', 'style'], ['#gpLens', 'lens'], ['#gpSound', 'sound']]) this.q(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === this.opt[k])); },
  open(deps) {
    this.ensure(); this.deps = deps;
    let snd = 'voice', sty = 'overlap'; try { snd = localStorage.getItem('cc_live_sound') || 'voice'; sty = localStorage.getItem('cc_grip_style') || 'overlap'; } catch (_) {}
    this.opt = { hand: deps.hand || 'right', style: sty, lens: 'user', sound: snd }; this.spk.mode = snd;
    this.paint(); this.q('#gpSet').hidden = false; this.q('#gpRun').hidden = true; this.q('#gpMsg').textContent = '';
    this.el.hidden = false; document.documentElement.style.overflow = 'hidden'; this.q('.lvX').focus();
  },
  msg(t) { this.q('#gpMsg').textContent = t; },
  async start(src, file) {
    const q = this.q, v = q('#gpVid'), img = q('#gpImg');
    this.spk.unlock(); q('#gpStart').disabled = true; this.msg('Loading body and hand tracking…');
    let models;
    try { models = await this.deps.getModels(); } catch (e) { q('#gpStart').disabled = false; this.msg('Tracking could not load. Check your connection and try again.'); return; }
    this.src = src; img.hidden = true; v.hidden = false;
    if (src === 'camera') {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { q('#gpStart').disabled = false; this.msg('This browser does not give the app camera access here. Open the app in Safari or Chrome directly, or use a photo or video of your grip instead.'); return; }
      try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.opt.lens, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
      catch (e) {
        q('#gpStart').disabled = false; const n = e && e.name;
        this.msg(n === 'NotAllowedError' || n === 'SecurityError' ? 'Camera access was blocked. Allow camera access for this page in your browser settings (on iPhone: Settings › Safari › Camera › Allow), then tap Start again, or use a photo or video of your grip.' : 'The camera could not start (' + (n || 'unknown error') + '). Try again, or use a photo or video.');
        return;
      }
      v.srcObject = this.stream; q('#gpStage').classList.toggle('mir', this.opt.lens === 'user'); q('#gpInsetBox').classList.toggle('mir', this.opt.lens === 'user');
    } else if (src === 'file') {
      this.url = URL.createObjectURL(file); v.srcObject = null; v.src = this.url; v.loop = true;
      q('#gpStage').classList.remove('mir'); q('#gpInsetBox').classList.remove('mir');
    } else {
      this.url = URL.createObjectURL(file); img.src = this.url; img.hidden = false; v.hidden = true;
      try { await img.decode(); } catch (_) { q('#gpStart').disabled = false; this.msg('That photo could not be opened.'); return; }
      q('#gpStage').classList.remove('mir'); q('#gpInsetBox').classList.remove('mir');
    }
    if (src !== 'image') {
      try { await v.play(); } catch (_) {}
      await new Promise(r => { if (v.videoWidth) r(); else { v.onloadedmetadata = () => r(); setTimeout(r, 4000); } });
      if (!v.videoWidth) { this.stop(false); q('#gpStart').disabled = false; this.msg(src === 'file' ? 'That video could not be played in this browser. Try a photo, or a different video.' : 'The camera started but sent no picture. Tap Start to try again.'); return; }
    }
    const sw = src === 'image' ? img.naturalWidth : v.videoWidth, shh = src === 'image' ? img.naturalHeight : v.videoHeight;
    q('#gpStage').style.aspectRatio = sw + ' / ' + shh;
    q('#gpSet').hidden = true; q('#gpRun').hidden = false; q('#gpStart').disabled = false; this.msg('');
    try { if (navigator.wakeLock && src === 'camera') this.wake = await navigator.wakeLock.request('screen'); } catch (_) {}
    this.eng = new GripEngine({ right: this.opt.hand !== 'left', style: this.opt.style, single: src === 'image' });
    q('#gpSteps').hidden = src === 'image'; q('#gpSkip').hidden = src === 'image'; q('#gpAgain').hidden = src === 'image';
    this.spk.say({ text: src === 'camera' ? `Camera on. Face the camera and hold the club in your ${this.eng.w().L} hand only.` : 'Checking your grip.', force: true, pri: 2 });
    this.run = true; this.loop(models, src === 'image' ? img : v);
  },
  async loop(models, el) {
    const my = (this.tok = (this.tok || 0) + 1), q = this.q;
    const F = document.createElement('canvas'), fx = F.getContext('2d'), S = document.createElement('canvas'), sx = S.getContext('2d');
    const smpPose = this.deps.makeSampler(), smpHand = this.deps.makeSampler();
    const can = q('#gpCan'), x = can.getContext('2d'), ins = q('#gpInset'), ix = ins.getContext('2d');
    const { pose } = models, hand_ = models.hand, HM = root.HandModel;
    let proi = null, body = null, n = 0, fps = 0, lastT = performance.now(), roi = null, lastWhich = null, imgFrames = 0;
    while (this.run && this.tok === my) {
      const vw = el.videoWidth || el.naturalWidth, vh = el.videoHeight || el.naturalHeight;
      if (!vw || (el.readyState != null && el.readyState < 2)) { await root.LiveCoach.sleep(60); continue; }
      const k = Math.min(1, 1280 / Math.max(vw, vh)), W = Math.round(vw * k), H = Math.round(vh * k);
      if (F.width !== W || F.height !== H) { F.width = W; F.height = H; }
      fx.drawImage(el, 0, 0, W, H);
      const t = this.src === 'camera' ? performance.now() / 1000 : this.src === 'file' ? el.currentTime + (this.loops || 0) * (el.duration || 0) : imgFrames * 0.35;
      // body pose on a small copy (every few frames once hands are tracked)
      if (!body || n % 4 === 0 || !roi) {
        const ks = Math.min(1, 480 / Math.max(W, H)), sw = Math.round(W * ks), sh = Math.round(H * ks);
        if (S.width !== sw || S.height !== sh) { S.width = sw; S.height = sh; }
        sx.drawImage(F, 0, 0, sw, sh);
        let r = null; try { r = pose.track({ width: sw, height: sh }, proi, smpPose(S)); } catch (_) {}
        proi = r ? r.next : null; body = r ? r.pts.map(p => ({ x: p.x / ks, y: p.y / ks, vis: p.vis })) : null;
      }
      n++;
      let hand = null;
      const which = this.eng.track();
      if (which !== lastWhich) { roi = null; lastWhich = which; }
      if (body) {
        const right = this.opt.hand !== 'left', side = (right ? which === 'lead' : which !== 'lead') ? [15, 17, 19] : [16, 18, 20];
        const [wi, pi, ii] = side, pr = HM.roiFromPose(body[wi], body[pi], body[ii]);
        let r = null; try { r = hand_.track(roi, pr, smpHand(F)); } catch (_) {}
        // the hand must stay with its own wrist
        if (r && dist(r.pts[0], body[wi]) > 1.2 * dist(r.pts[0], r.pts[9]) + 0.08 * Math.max(W, H)) r = null;
        hand = r ? withWorld(r) : null; roi = r ? r.next : null;
      } else roi = null;
      this.dbg = { body: !!body, hand: !!hand, step: this.eng.step };
      const out = this.eng.push(t, body, hand, W, H);
      const now = performance.now(); fps = fps ? fps * 0.85 + 1000 / Math.max(1, now - lastT) * 0.15 : 1000 / Math.max(1, now - lastT); lastT = now;
      for (const s of out.say) this.spk.say(s);
      this.draw(x, can, ix, ins, F, out, W, H);
      this.status(out, fps);
      if (this.src === 'image') { imgFrames++; if (imgFrames > 12 || this.eng.step === 'done') { this.status(out, fps, true); this.run = false; break; } }
      if (this.src === 'file' && el.ended) this.loops = (this.loops || 0) + 1;
      await new Promise(r2 => (root.requestAnimationFrame ? requestAnimationFrame(() => r2()) : setTimeout(r2, 0)));
    }
  },
  draw(x, can, ix, ins, F, out, W, H) {
    if (can.width !== W || can.height !== H) { can.width = W; can.height = H; }
    x.clearRect(0, 0, W, H);
    const COL = root.LiveCoach.COL, lw = Math.max(2, W / 260), d = out.draw, M = {};
    for (const m of out.metrics || []) M[m.key] = m.lv;
    const S = ins.width; ix.fillStyle = '#000'; ix.fillRect(0, 0, S, S);
    this.q('#gpInsetBox').classList.toggle('on', !!(d && d.g));
    if (!d || !d.g) return;
    x.lineCap = 'round';
    const c = COL[M[d.key] || 'idle'];
    // where the V should point: a soft green band at shoulder height, from the chin to the trail shoulder
    const x0 = d.chin.x + 0.12 * (d.trailSh.x - d.chin.x), x1 = d.chin.x + 1.3 * (d.trailSh.x - d.chin.x);
    x.strokeStyle = COL.in; x.globalAlpha = 0.4; x.lineWidth = lw * 6; x.beginPath(); x.moveTo(x0, d.shY); x.lineTo(x1, d.shY); x.stroke(); x.globalAlpha = 1;
    // where it points now: one arrow from the V of the hand
    const g = d.g, end = d.a ? { x: d.a.x, y: d.a.y } : { x: g.web.x + g.v.x * g.len * 3, y: g.web.y + g.v.y * g.len * 3 };
    const arrow = (cx, p0, p1, w) => { cx.strokeStyle = c; cx.fillStyle = c; cx.lineWidth = w; cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke();
      const dv = norm({ x: p1.x - p0.x, y: p1.y - p0.y }), hs = w * 3.2; cx.beginPath(); cx.moveTo(p1.x, p1.y); cx.lineTo(p1.x - dv.x * hs - dv.y * hs * 0.6, p1.y - dv.y * hs + dv.x * hs * 0.6); cx.lineTo(p1.x - dv.x * hs + dv.y * hs * 0.6, p1.y - dv.y * hs - dv.x * hs * 0.6); cx.closePath(); cx.fill(); };
    arrow(x, g.web, end, lw * 1.6);
    // close-up of the hand being checked
    const P = g.P; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of P) { a0 = Math.min(a0, p.x); a1 = Math.max(a1, p.x); b0 = Math.min(b0, p.y); b1 = Math.max(b1, p.y); }
    const side = Math.max(a1 - a0, b1 - b0) * 1.7, cx0 = (a0 + a1) / 2, cy0 = (b0 + b1) / 2, sx = cx0 - side / 2, sy = cy0 - side / 2, sc = S / side;
    try { ix.drawImage(F, sx, sy, side, side, 0, 0, S, S); } catch (_) {}
    const tf = p => ({ x: (p.x - sx) * sc, y: (p.y - sy) * sc });
    ix.lineCap = 'round'; const w0 = tf(g.web);
    arrow(ix, w0, { x: w0.x + g.v.x * S * 0.32, y: w0.y + g.v.y * S * 0.32 }, 4);
    // the knuckles you should be able to see, on the lead hand
    if (d.key === 'lead') { ix.fillStyle = '#ffffff'; for (const i of [5, 9, 13, 17]) { const k = tf(P[i]); ix.globalAlpha = 0.85; ix.beginPath(); ix.arc(k.x, k.y, 4, 0, 7); ix.fill(); } ix.globalAlpha = 1; }
  },
  status(out, fps, final) {
    const st = this.q('#gpStatus'), e = this.eng, order = ['lead', 'trail', 'done'];
    this.q('#gpSteps').querySelectorAll('li').forEach(li => { const k = order.indexOf(li.dataset.s), n = order.indexOf(e.step); li.classList.toggle('now', k === n); li.classList.toggle('ok', k < n); });
    this.q('#gpSkip').hidden = this.src === 'image' || e.step !== 'lead';
    st.className = 'lvStatus ' + out.level; st.querySelector('b').textContent = final && out.level !== 'in' && !(out.metrics || []).length ? 'Grip not found in this photo' : out.text;
    st.querySelector('span').textContent = final && !(out.metrics || []).length ? 'Use a face-on photo from head to knees, with both hands on the club and in good light.' : out.sub || '';
    const ms = out.metrics && out.metrics.length ? out.metrics : null;
    if (ms) this.q('#gpMetrics').innerHTML = ms.map(m => `<li class="${m.lv}"><i></i><b>${this.deps.esc(m.label)}: ${this.deps.esc(m.val)}</b><small>Aim for ${this.deps.esc(m.aim)}</small></li>`).join('');
    this.q('#gpStats').innerHTML = `<span>Grips built <b>${e.attempts}</b></span><span>In zone <b>${e.good}</b></span>${this.src === 'camera' || this.src === 'file' ? `<span>Tracking <b>${fps.toFixed(1)}</b> fps</span>` : ''}`;
  },
  stop(showSetup) {
    this.run = false; this.tok = (this.tok || 0) + 1;
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    const v = this.q && this.q('#gpVid'); if (v) { try { v.pause(); } catch (_) {} v.srcObject = null; v.removeAttribute('src'); try { v.load(); } catch (_) {} }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    if (this.wake) { try { this.wake.release(); } catch (_) {} this.wake = null; }
    this.loops = 0; this.spk && this.spk.stop();
    if (showSetup && this.q) { this.q('#gpRun').hidden = true; this.q('#gpSet').hidden = false; this.q('#gpMetrics').innerHTML = ''; }
  },
  close() { this.stop(false); if (this.el) this.el.hidden = true; document.documentElement.style.overflow = ''; this.deps && this.deps.onClose && this.deps.onClose(); },
};
const handC = h => ({ x: (h.pts[0].x + h.pts[5].x + h.pts[9].x + h.pts[13].x + h.pts[17].x) / 5, y: (h.pts[0].y + h.pts[5].y + h.pts[9].y + h.pts[13].y + h.pts[17].y) / 5 });
// world landmarks come in the crop's rotated frame: turn them back to the image frame
function withWorld(r) {
  const c = Math.cos(r.roi.rot), s = Math.sin(r.roi.rot);
  r.wpts = r.world.length ? r.world.map(w => ({ x: w[0] * c - w[1] * s, y: w[0] * s + w[1] * c, z: w[2] })) : r.pts;
  return r;
}

const api = { GripEngine, GripUI, handGeom, withWorld };
if (typeof module !== 'undefined') module.exports = api; else root.GripCoach = api;
})(typeof window !== 'undefined' ? window : this);
