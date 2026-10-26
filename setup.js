// Caddy Coach live setup check: distance from the ball, stance, ball position, feet, shoulders and posture per club.
// SetupEngine is pure logic; findBall is a pure image routine; SetupUI owns camera/overlay/audio. Needs live.js.
(function (root) {
'use strict';
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const median = a => { const s = a.filter(v => v != null).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
function ang3(a, b, c) { const u = { x: a.x - b.x, y: a.y - b.y }, v = { x: c.x - b.x, y: c.y - b.y }; const d = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1; return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / d))) * 180 / Math.PI; }

// ---------- clubs ----------
// c: 0 = driver ... 1 = 60° wedge (drives every target); len: standard length in inches (drives ball distance)
const CLUBS = [
  ['D', 'Driver', 0, 45.5], ['3W', '3 wood', 0.12, 43], ['5W', '5 wood', 0.18, 42], ['7W', '7 wood', 0.22, 41.5],
  ['3H', '3 hybrid', 0.28, 40.5], ['4H', '4 hybrid', 0.32, 40], ['5H', '5 hybrid', 0.36, 39.5],
  ['3i', '3 iron', 0.38, 39], ['4i', '4 iron', 0.44, 38.5], ['5i', '5 iron', 0.52, 38], ['6i', '6 iron', 0.6, 37.5], ['7i', '7 iron', 0.68, 37],
  ['8i', '8 iron', 0.75, 36.5], ['9i', '9 iron', 0.82, 36], ['PW', 'Pitching wedge', 0.87, 35.75],
  ['48', '48° wedge', 0.89, 35.5], ['50', '50° wedge', 0.91, 35.5], ['52', '52° wedge', 0.93, 35.25], ['54', '54° wedge', 0.95, 35.25],
  ['56', '56° wedge', 0.97, 35], ['58', '58° wedge', 0.985, 35], ['60', '60° wedge', 1, 35],
].map(([id, name, c, len]) => ({ id, name, c, len }));
// target ranges at anchor clubs, interpolated in between
const ANCH = [0, 0.12, 0.3, 0.52, 0.68, 0.87, 1];
const TGT = {
  width:  [[1.0, 1.5], [0.95, 1.42], [0.9, 1.35], [0.85, 1.28], [0.8, 1.24], [0.74, 1.18], [0.6, 1.05]],   // ankle gap / shoulder width (wide enough that tour setups pass)
  ball:   [[0.85, 1.0], [0.74, 0.9], [0.64, 0.8], [0.58, 0.72], [0.5, 0.64], [0.45, 0.58], [0.42, 0.56]],  // trail ankle 0 -> lead ankle 1
  shTilt: [[4, 17], [3, 15], [2, 13], [1.5, 12], [1, 11], [0.5, 10], [0.5, 10]],                       // degrees, trail shoulder lower
  head:   [[-0.45, -0.02], [-0.4, 0], [-0.34, 0.05], [-0.3, 0.07], [-0.28, 0.08], [-0.26, 0.1], [-0.24, 0.12]], // head vs stance centre / stance width (+ = toward target)
  hands:  [[-0.3, 0.5], [-0.1, 0.7], [0, 0.8], [0.1, 0.9], [0.15, 1.0], [0.2, 1.1], [0.2, 1.1]],         // hands vs hip centre / half hip width (+ = toward target)
  spine:  [[20, 38], [21, 39], [22, 40], [22, 41], [23, 42], [24, 44], [25, 45]],                        // hip-shoulder line from vertical, side-on
  gap:    [[0.35, 0.55], [0.34, 0.52], [0.32, 0.5], [0.31, 0.48], [0.3, 0.47], [0.28, 0.45], [0.26, 0.43]],     // hands ahead of thigh centre / torso
  reach:  [[-0.05, 0.35], [-0.07, 0.33], [-0.08, 0.3], [-0.1, 0.28], [-0.12, 0.27], [-0.13, 0.26], [-0.15, 0.25]], // hands ahead of shoulders / torso
};
function targets(club) {
  const c = club.c; let i = 0; while (i < ANCH.length - 2 && c > ANCH[i + 1]) i++;
  const f = (c - ANCH[i]) / (ANCH[i + 1] - ANCH[i]), out = {};
  for (const k in TGT) out[k] = [0, 1].map(j => TGT[k][i][j] + (TGT[k][i + 1][j] - TGT[k][i][j]) * f);
  out.dist = (0.75 * club.len - 4) / 21;   // toes to ball, in torso lengths (~0.3 x height)
  return out;
}
function describe(club, heightCm) {
  const t = targets(club), c = club.c, H = heightCm || 175;
  const ball = c < 0.06 ? 'Opposite the inside of your lead heel' : c < 0.25 ? 'About a ball inside your lead heel' : c < 0.45 ? 'Two balls forward of centre' : c < 0.62 ? 'A ball forward of centre' : c < 0.8 ? 'Just forward of centre' : 'In the centre of your stance';
  const stance = c < 0.1 ? 'Wider than your shoulders' : c < 0.3 ? 'A touch wider than shoulder width' : c < 0.8 ? 'About shoulder width' : c < 0.95 ? 'A little narrower than your shoulders' : 'Narrower than your shoulders';
  const cm = Math.round(t.dist * 0.3 * H / 5) * 5;
  const weight = c < 0.06 ? 'About 40% lead, 60% trail' : c < 0.3 ? 'About 45% lead, 55% trail' : c < 0.85 ? 'About 50/50' : '50/50 to 55% lead';
  const tilt = `Trail shoulder lower, about ${Math.round((t.shTilt[0] + t.shTilt[1]) / 2)}°`;
  const head = c < 0.06 ? 'Behind the ball, spine tilted away from the target' : c < 0.5 ? 'Slightly behind the ball' : 'Over or just behind the ball';
  const hands = c < 0.06 ? 'Level with the ball or just behind it' : c < 0.3 ? 'Level with the ball' : 'Slightly ahead of the ball, toward your lead thigh';
  const g0 = Math.round((t.gap[0] - 0.15) * 0.3 * H), g1 = Math.round((t.gap[1] - 0.15) * 0.3 * H);
  return { ball, stance, distCm: cm, dist: `Arms hanging straight down, ${g0}–${g1} cm (${c < 0.3 ? 'a hand width or more' : 'about a hand width'}) between your hands and thighs`, weight, tilt, head, hands,
    posture: `Hinge from the hips about ${Math.round((t.spine[0] + t.spine[1]) / 2)}° and let your arms hang`, t };
}

// ---------- ball finder ----------
// data: RGBA of the search region (w x h). expectR: ball radius in region pixels. avoid: [{x,y,r}] region coords.
function findBall(data, w, h, expectR, avoid, want) {
  const step = Math.max(1, Math.floor(expectR / 3.5)), gw = Math.floor(w / step), gh = Math.floor(h / step);
  if (gw < 3 || gh < 3) return null;
  const m = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const o = ((gy * step) * w + gx * step) * 4, r = data[o], g = data[o + 1], b = data[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const white = mn > 165 && mx - mn < 45, yellow = r > 150 && g > 140 && b < Math.min(r, g) * 0.72 && Math.abs(r - g) < 70, orange = r > 190 && g > 90 && g < 190 && b < 110;
    m[gy * gw + gx] = white ? 1 : yellow ? 2 : orange ? 3 : 0;
  }
  const seen = new Int32Array(gw * gh).fill(-1), cands = [], q = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || seen[i] >= 0) continue;
    let area = 0, sx = 0, sy = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; q.length = 0; q.push(i); seen[i] = i;
    while (q.length) {
      const j = q.pop(), x = j % gw, y = (j - x) / gw; area++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (area > 4000) break;
      for (const k of [j - 1, j + 1, j - gw, j + gw]) { if (k < 0 || k >= m.length || seen[k] >= 0 || !m[k]) continue; if ((k === j - 1 && x === 0) || (k === j + 1 && x === gw - 1)) continue; seen[k] = i; q.push(k); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, req = Math.sqrt(area / Math.PI) * step, fill = area / (bw * bh), asp = bw / bh;
    const size = Math.abs(Math.log(req / expectR));
    if (size > Math.log(1.9) || fill < 0.45 || asp < 0.55 || asp > 1.8 || area < 3) continue;
    const c = { x: (sx / area + 0.5) * step, y: (sy / area + 0.5) * step, r: req };
    // on the boundary of the search box: probably part of something bigger
    if (x0 === 0 || y0 === 0 || x1 === gw - 1 || y1 === gh - 1) continue;
    if (avoid && avoid.some(a => dist(a, c) < a.r)) continue;
    let sc = size * 1.2 + (1 - fill) * 0.8 + Math.abs(Math.log(asp)) * 0.6;
    if (want) sc += Math.abs(c.x - want.x) / (want.sx || 1e9) + Math.abs(c.y - want.y) / (want.sy || 1e9);
    cands.push(Object.assign(c, { sc }));
  }
  cands.sort((a, b) => a.sc - b.sc);
  return cands[0] || null;
}

// ---------- engine ----------
function SetupEngine(opt) {
  this.right = opt.right !== false; this.view = opt.view || 'face'; this.club = CLUBS.find(c => c.id === opt.club) || CLUBS[11];
  this.H = opt.height || 175; this.t = targets(this.club);
  this.win = []; this.balls = []; this.state = 'find'; this.lastSaid = {}; this.outSince = {}; this.inSince = null;
  this.setups = 0; this.good = 0; this.lostSince = null; this.findSaid = -99; this.prev = null; this.stillSince = null; this.said = {};
}
SetupEngine.CLUBS = CLUBS;
SetupEngine.prototype.setClub = function (id) { this.club = CLUBS.find(c => c.id === id) || this.club; this.t = targets(this.club); this.win = []; this.inSince = null; };
SetupEngine.prototype.words = function () { return this.right ? { L: 'left', T: 'right' } : { L: 'right', T: 'left' }; };
// where to search for the ball (image px) given the body; and the expected radius
SetupEngine.prototype.ballSearch = function (P) {
  if (!P) return null;
  const sh = mid(P[11], P[12]), hp = mid(P[23], P[24]), T = dist(sh, hp) || 1;
  const toeY = Math.max(P[31].y, P[32].y), heelY = Math.max(P[29].y, P[30].y), footY = Math.max(toeY, heelY);
  if (this.view === 'dtl') return null;
  if (false) {
    const fc = this.facing(P), toeX = fc > 0 ? Math.max(P[31].x, P[32].x) : Math.min(P[31].x, P[32].x), D = this.t.dist * T;
    const a = toeX + fc * D * 0.45, b = toeX + fc * D * 1.75;
    const r = 2.13 * T / (0.3 * this.H);
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: footY - 0.45 * T, y1: footY + 0.3 * T, r, want: { x: toeX + fc * D, y: footY, sx: D * 0.5, sy: T * 0.6 }, avoid: [27, 28, 29, 30, 31, 32].map(i => ({ x: P[i].x, y: P[i].y, r: 0.22 * T })) };
  }
  const shW = Math.abs(P[11].x - P[12].x) || 1, L = Math.min(P[27].x, P[28].x), R = Math.max(P[27].x, P[28].x), span = Math.max(R - L, shW * 0.5);
  const r = 2.13 * shW / (0.2 * this.H);
  return { x0: L - span * 0.4, x1: R + span * 0.4, y0: footY - shW * 0.35, y1: footY + shW * 0.45, r, want: { x: (L + R) / 2, y: footY + shW * 0.1, sx: span, sy: shW * 0.5 },
    avoid: [27, 28, 29, 30, 31, 32].map(i => ({ x: P[i].x, y: P[i].y, r: 0.28 * shW })).concat([15, 16].map(i => ({ x: P[i].x, y: P[i].y, r: 0.2 * shW }))) };
};
SetupEngine.prototype.facing = function (P) { const ears = mid(P[7], P[8]), d = P[0].x - ears.x, T = dist(mid(P[11], P[12]), mid(P[23], P[24])) || 1; return Math.abs(d) > T * 0.03 ? Math.sign(d) : Math.sign(mid(P[15], P[16]).x - mid(P[23], P[24]).x) || 1; };

SetupEngine.prototype.push = function (t, P, ball, W, H) {
  const out = { t, say: [], level: 'idle', text: '', sub: '', metrics: [], draw: { P, ball: null } };
  const ok = P && [0, 11, 12, 23, 24, 27, 28].every(i => P[i].vis == null || P[i].vis > 0.4) && P[0].y > 0 && Math.max(P[31].y, P[32].y, P[29].y, P[30].y) < H * 1.01 &&
    Math.min(...[11, 12, 27, 28].map(i => P[i].x)) > 0 && Math.max(...[11, 12, 27, 28].map(i => P[i].x)) < W;
  if (!ok) {
    this.lostSince = this.lostSince == null ? t : this.lostSince;
    out.text = P ? 'Step back so I can see you head to toe' : 'Looking for you…'; out.sub = this.view === 'dtl' ? 'Camera side-on, behind your hands, 2.5–3 m away at hip height' : 'Camera in front of you, 2.5–3 m away at hip height';
    if (t - this.lostSince > 1.5 && t - this.findSaid > 8) { out.say.push({ text: P ? 'Step back so I can see your feet and your head' : 'Stand where the camera can see you, head to toe', pri: 2 }); this.findSaid = t; }
    if (t - this.lostSince > 1) { this.win = []; this.inSince = null; this.prev = null; if (this.state === 'set') this.state = 'find'; }
    return out;
  }
  this.lostSince = null;
  const sh = mid(P[11], P[12]), hp = mid(P[23], P[24]), T = dist(sh, hp) || 1, shW = Math.abs(P[11].x - P[12].x);
  // camera angle
  const r = shW / T, wrong = this.view === 'dtl' ? r > 0.7 : r < 0.45;
  if (wrong) {
    out.level = 'warn'; out.text = this.view === 'dtl' ? 'Turn side-on to the camera' : 'Face the camera square on';
    out.sub = this.view === 'dtl' ? 'Down the line: the camera looks along your target line from behind your hands' : 'Face-on: the camera looks straight at your chest';
    if (t - (this.lastSaid.view || -99) > 8) { out.say.push({ text: out.text, pri: 2 }); this.lastSaid.view = t; }
    return out;
  }
  // only judge a real address: hands together and low, bent over the ball
  const wr0 = mid(P[15], P[16]), tilt0 = Math.atan2(Math.abs(sh.x - hp.x), hp.y - sh.y) * 180 / Math.PI;
  const address = dist(P[15], P[16]) < 0.6 * T && wr0.y > hp.y - 0.15 * T && (this.view !== 'dtl' || tilt0 > 8);
  if (!address) {
    this.win = []; this.inSince = null; this.stillSince = null; this.prev = { t, P };
    if (this.state === 'set' || this.state === 'check') this.state = 'swing';
    out.level = 'idle'; out.text = 'Take your address'; out.sub = 'Club behind the ball, both hands on the grip, then hold still';
    return out;
  }
  // stillness (a setup is judged only while you hold still)
  const key = [0, 11, 12, 15, 16, 23, 24, 27, 28];
  const sp = this.prev ? key.reduce((s, i) => s + dist(P[i], this.prev.P[i]), 0) / key.length / T / Math.max(0.05, t - this.prev.t) : 0;
  this.prev = { t, P };
  this.spd = this.spd == null ? sp : this.spd * 0.5 + sp * 0.5;
  if (this.spd > 0.6) {
    this.stillSince = null; this.win = []; this.inSince = null;
    if (this.state === 'set') this.state = 'swing';
    out.level = 'idle'; out.text = this.state === 'swing' ? 'Swinging… set up again when you\'re ready' : 'Settle into your address and hold still';
    return out;
  }
  this.stillSince = this.stillSince == null ? t : this.stillSince;
  if (this.state === 'find' || this.state === 'swing') {
    if (t - this.stillSince < 0.6) { out.text = 'Hold still at address'; return out; }
    if (this.state === 'find' && !this.said.first) { out.say.push({ text: `I can see you. Setting up with the ${this.club.name.replace('°', ' degree')}.`, pri: 2 }); this.said.first = true; }
    this.state = 'check'; this.setups++; this.win = []; this.balls = [];
  }
  // ball: keep recent detections, use the median
  this.balls.push(ball ? { t, x: ball.x, y: ball.y, r: ball.r } : { t }); while (this.balls.length > 1 && t - this.balls[0].t > 1.6) this.balls.shift();
  const bs = this.balls.filter(b => b.x != null), B = bs.length >= Math.max(2, this.balls.length * 0.4) ? { x: median(bs.map(b => b.x)), y: median(bs.map(b => b.y)), r: median(bs.map(b => b.r)) } : null;
  out.draw.ball = B;
  const m = this.view === 'dtl' ? this.dtl(P, B, T) : this.face(P, B, T, shW);
  // smooth each metric over ~1.2 s
  this.win.push({ t, v: m.map(x => x.v) }); while (this.win.length > 1 && t - this.win[0].t > 1.2) this.win.shift();
  const sm = m.map((x, i) => median(this.win.map(w => w.v[i])));
  const res = m.map((x, i) => x.eval(sm[i]));
  // a verdict only changes when the reading clearly crosses the line, so it doesn't flicker while you stand still
  res.forEach((r, i) => { if (r) r.raw = sm[i]; });
  this.lvPrev = this.lvPrev || {};
  for (const r of res) { if (!r) continue; const p = this.lvPrev[r.key]; let lv = lvOf(r.sev);
    if (p === 'in' && r.sev < 0.8) lv = 'in'; else if (p === 'out' && r.sev > 0.8) lv = 'out'; else if (p === 'warn' && r.sev > 0.45 && r.sev < 1.15) lv = 'warn';
    r.lv = lv; this.lvPrev[r.key] = lv; }
  out.metrics = res.filter(Boolean); out.draw.zones = m.map((x, i) => { const z = x.zone && x.zone(sm[i], res[i]); if (z && res[i]) z.key = res[i].key; return z; });
  if (this.win.length < 2) { out.text = 'Checking your setup…'; return out; }
  // first (highest priority) metric that is out; else the worst warning
  const outs = res.filter(x => x && x.lv === 'out'), warns = res.filter(x => x && x.lv === 'warn');
  const top = outs[0] || warns.sort((a, b) => b.sev - a.sev)[0];
  if (!top) {
    this.inSince = this.inSince == null ? t : this.inSince;
    out.level = 'in'; out.text = this.state === 'set' ? "You're set. Swing away" : 'In the zone'; out.sub = this.state === 'set' ? `${this.club.name} setup locked in` : `Hold it… ${Math.min(1.5, t - this.inSince).toFixed(1)} s`;
    if (this.state === 'check' && t - this.inSince >= 1.5) {
      this.state = 'set'; this.good++;
      out.say.push({ text: this.good === 1 ? "That's a good setup. You're set, swing away." : "Good setup. You're set.", pri: 3, tone: 'good', force: true });
    }
    for (const k in this.outSince) delete this.outSince[k];
    return out;
  }
  this.inSince = null; if (this.state === 'set') this.state = 'check';
  out.level = top.lv; out.text = top.say; out.sub = top.tip; out.draw.focus = top.key;
  if (top.lv === 'out') {
    const k = top.key + '|' + top.say; this.outSince[k] = this.outSince[k] == null ? t : this.outSince[k];
    if (t - this.outSince[k] >= 0.7 && t - (this.lastSaid[k] || -99) > 4.5) { out.say.push({ text: top.say, pri: 2 }); this.lastSaid[k] = t; }
  }
  return out;
};
const lvOf = s => s >= 1 ? 'out' : s >= 0.6 ? 'warn' : 'in';
const band = (v, [lo, hi], soft) => v == null ? 0 : v < lo ? (lo - v) / soft : v > hi ? (v - hi) / soft : 0;
const cmTxt = cm => { const c = Math.max(2, Math.round(cm / 2) * 2); return `about ${c} centimetres`; };

// ---- down the line: distance from the ball, posture, alignment ----
SetupEngine.prototype.dtl = function (P, B, T) {
  const t = this.t, w = this.words(), fc = this.facing(P), cmPer = 0.3 * this.H / T; // cm per px
  const sh = mid(P[11], P[12]), hp = mid(P[23], P[24]), wr = mid(P[15], P[16]);
  const toeX = fc > 0 ? Math.max(P[31].x, P[32].x) : Math.min(P[31].x, P[32].x);
  const lead = this.right ? { sh: 11, toe: 31 } : { sh: 12, toe: 32 }, trail = this.right ? { sh: 12, toe: 32 } : { sh: 11, toe: 31 };
  const M = [];
  // 1. distance from the ball: your arms should hang straight down from your shoulders (hands just ahead of them).
  //    Measured hands vs shoulders, the same way the swing analysis does; the thighs aren't used because from
  //    side-on your hands sit right in front of them.
  const reach = (wr.x - sh.x) * fc / T;
  M.push({ v: reach, eval: g => {
    const lo = t.reach[0], hi = t.reach[1], sev = band(g, [lo, hi], 0.08), far = g > hi, near = g < lo;
    const cm = Math.abs((g > hi ? g - hi : lo - g) + 0.04) * T * cmPer;
    return { key: 'dist', label: 'Distance from the ball', lv: lvOf(sev), sev, val: far ? 'arms reaching out for the ball' : near ? 'hands tucked in, crowding the ball' : 'arms hanging straight down',
      aim: 'arms hanging straight down from your shoulders, hands just ahead of them',
      say: far ? `Move closer to the ball, ${cmTxt(cm)}` : near ? `Move back from the ball, ${cmTxt(cm)}` : 'Good distance',
      tip: far ? 'You are stood too far away: your arms reach out and you lose posture. Step in until your arms hang straight down from your shoulders.' : 'You are crowding the ball: no room for your arms. Step back until your arms hang straight down, with your hands just ahead of your shoulders.' };
  }, zone: (v, r) => ({ type: 'vline', x: sh.x + fc * (t.reach[0] + t.reach[1]) / 2 * T, y0: sh.y, y1: wr.y + 0.15 * T, lv: r.lv }) });
  // 5. spine tilt for this club
  const tilt = Math.atan2(Math.abs(sh.x - hp.x), hp.y - sh.y) * 180 / Math.PI;
  M.push({ v: tilt, eval: v => { const s = band(v, t.spine, 4);
    return { key: 'spine', label: 'Posture', lv: lvOf(s), sev: s, val: `spine tilted ${Math.round(v)}°`, aim: `${Math.round(t.spine[0])}–${Math.round(t.spine[1])}° from the hips`,
      say: v < t.spine[0] ? 'Bend forward more from your hips' : 'Stand up a little taller',
      tip: v < t.spine[0] ? 'You are too upright. Push your backside back and tilt your chest over the ball.' : 'You are bent over too far. Lift your chest a little and keep your back straight.' }; },
    zone: (v, r) => { const a1 = t.spine[0] * Math.PI / 180, a2 = t.spine[1] * Math.PI / 180, L = T * 1.2; return { type: 'wedge', x: hp.x, y: hp.y, a: { x: hp.x + fc * Math.sin(a1) * L, y: hp.y - Math.cos(a1) * L }, b: { x: hp.x + fc * Math.sin(a2) * L, y: hp.y - Math.cos(a2) * L }, lv: r.lv }; } });
  // 6. knee flex
  const vis = i => P[i].vis == null ? 1 : P[i].vis, kn = vis(25) + vis(27) >= vis(26) + vis(28) ? ang3(P[23], P[25], P[27]) : ang3(P[24], P[26], P[28]);
  M.push({ v: kn, eval: v => { const s = band(v, [142, 175], 6);
    return { key: 'knees', label: 'Knee flex', lv: lvOf(s), sev: s, val: `${Math.round(v)}°`, aim: 'soft, athletic knees',
      say: v > 175 ? 'Flex your knees a little more' : 'Straighten your knees a little', tip: v > 175 ? 'Your legs are too straight. Add a little flex so you feel springy.' : 'Too much knee bend. Stand up a touch through the legs.' }; } });
  return M;
};

// ---- face-on: stance width, ball position, feet, shoulder tilt, head, hands ----
SetupEngine.prototype.face = function (P, B, T, shW) {
  const t = this.t, w = this.words(), H = this.H, cmPer = 0.2 * H / shW;
  const leadDir = Math.sign(this.right ? P[11].x - P[12].x : P[12].x - P[11].x) || 1;
  const L = this.right ? { a: 27, h: 29, toe: 31, sh: 11 } : { a: 28, h: 30, toe: 32, sh: 12 }, Tr = this.right ? { a: 28, h: 30, toe: 32, sh: 12 } : { a: 27, h: 29, toe: 31, sh: 11 };
  const xl = P[L.a].x * leadDir, xt = P[Tr.a].x * leadDir, width = (xl - xt), wN = width / shW;   // along the target axis
  const M = [];
  // 1. feet: stance width and ball position -> how to move each foot
  M.push({ v: wN, eval: wNs => {
    const wN = wNs == null ? width / shW : wNs, width = wN * shW;
    const Wt = (t.width[0] + t.width[1]) / 2 * shW, bt = (t.ball[0] + t.ball[1]) / 2;
    const ballOk = B != null;
    const bx = ballOk ? B.x * leadDir : null, bpos = ballOk ? (bx - xt) / (width || 1) : null;
    const sW = band(wN, t.width, 0.07), sB = ballOk ? band(bpos, t.ball, 0.06) : 0, sev = Math.max(sW, sB);
    // targets for each foot with the ball fixed
    let dL, dT;
    if (ballOk) { dL = (bx + (1 - bt) * Wt) - xl; dT = (bx - bt * Wt) - xt; }
    else { const g = (Wt - width) / 2; dL = g; dT = -g; }
    const cL = dL * cmPer, cT = dT * cmPer;
    const val = `${wN < t.width[0] ? 'narrow' : wN > t.width[1] ? 'wide' : 'good width'}${ballOk ? ` · ball ${bpos < 0.35 ? 'back in your stance' : bpos < 0.6 ? 'in the middle' : bpos < 0.85 ? 'forward of centre' : 'off your lead heel'}` : ' · ball not found'}`;
    let say, tip;
    if (Math.abs(cL) >= Math.abs(cT)) say = `${cap(w.L)} foot ${cL > 0 ? 'out' : 'in'}, ${cmTxt(Math.abs(cL))}`; else say = `${cap(w.T)} foot ${cT < 0 ? 'back' : 'in'}, ${cmTxt(Math.abs(cT))}`;
    if (Math.sign(cL) === Math.sign(cT) && Math.min(Math.abs(cL), Math.abs(cT)) > 4) say = `Shift both feet ${cL > 0 ? 'toward' : 'away from'} the target, ${cmTxt((Math.abs(cL) + Math.abs(cT)) / 2)}`;
    tip = ballOk ? `For a ${this.club.name}: ${describe(this.club, H).stance.toLowerCase()}, ball ${describe(this.club, H).ball.toLowerCase()}. Move your ${w.L} foot ${Math.abs(Math.round(cL))} cm ${cL > 0 ? 'out' : 'in'} and your ${w.T} foot ${Math.abs(Math.round(cT))} cm ${cT < 0 ? 'back' : 'in'}.`
      : `For a ${this.club.name}: ${describe(this.club, H).stance.toLowerCase()}. I couldn't see the ball, so only your stance width is checked.`;
    return { key: 'feet', label: 'Feet and ball position', lv: lvOf(sev), sev, val, aim: `${describe(this.club, H).stance}; ball ${describe(this.club, H).ball.toLowerCase()}`, say, tip, dL, dT };
  }, zone: (v, r) => r && { type: 'feet', y: Math.max(P[L.a].y, P[Tr.a].y), xl: (xl + r.dL) * leadDir, xt: (xt + r.dT) * leadDir, cl: P[L.a].x, ct: P[Tr.a].x, r: shW * 0.12, lv: r.lv, ball: B, b0: B && (xt + r.dT + t.ball[0] * (xl + r.dL - xt - r.dT)) * leadDir, b1: B && (xt + r.dT + t.ball[1] * (xl + r.dL - xt - r.dT)) * leadDir } });
  // 3. shoulder tilt: trail shoulder lower
  const tl = Math.atan2(P[Tr.sh].y - P[L.sh].y, Math.abs(P[L.sh].x - P[Tr.sh].x)) * 180 / Math.PI;
  M.push({ v: tl, eval: v => { const s = band(v, t.shTilt, 3);
    return { key: 'tilt', label: 'Shoulder tilt', lv: lvOf(s), sev: s, val: v < 0 ? `${w.T} shoulder higher` : `${w.T} shoulder ${Math.round(v)}° lower`, aim: `${w.T} shoulder ${Math.round(t.shTilt[0])}–${Math.round(t.shTilt[1])}° lower`,
      say: v < t.shTilt[0] ? `Drop your ${w.T} shoulder a little lower` : `Raise your ${w.T} shoulder a touch`,
      tip: v < t.shTilt[0] ? `Your ${w.T} hand sits lower on the grip, so your ${w.T} shoulder should sit a little lower too. Tilt your upper body slightly away from the target.` : `Too much tilt sets you behind the ball and can lead to hitting up and thin. Level your shoulders a little.` }; },
    zone: (v, r) => { const a = P[L.sh], Lx = Math.abs(P[L.sh].x - P[Tr.sh].x) * 1.15, th = (t.shTilt[0] + t.shTilt[1]) / 2 * Math.PI / 180; return { type: 'line', x0: a.x, y0: a.y, x1: a.x - leadDir * Math.cos(th) * Lx, y1: a.y + Math.sin(th) * Lx, lv: r.lv, dash: true }; } });
  // 4. head relative to stance centre
  const cx = (P[L.a].x + P[Tr.a].x) / 2, hd = (P[0].x - cx) * leadDir / (Math.abs(width) || shW);
  M.push({ v: hd, eval: v => { const s = band(v, t.head, 0.06);
    return { key: 'head', label: 'Head', lv: lvOf(s), sev: s * 0.9, val: v < -0.05 ? 'behind centre' : v > 0.05 ? 'ahead of centre' : 'centred', aim: describe(this.club, H).head.toLowerCase(),
      say: v > t.head[1] ? 'Head back a touch, behind the ball' : 'Head forward a touch, more over the ball',
      tip: v > t.head[1] ? `Your head is too far toward the target for a ${this.club.name}. Tilt your spine slightly away from the target.` : 'Your head is hanging back too far. Centre it more over the ball.' }; } });
  // 5. hands
  const hw = Math.abs(P[23].x - P[24].x) / 2 || shW * 0.3, hn = (mid(P[15], P[16]).x - mid(P[23], P[24]).x) * leadDir / hw;
  M.push({ v: hn, eval: v => { const s = band(v, t.hands, 0.2);
    return { key: 'hands', label: 'Hands', lv: lvOf(s), sev: s * 0.8, val: v < 0 ? 'behind centre' : v > 1 ? `at your ${w.L} thigh` : 'just ahead of centre', aim: describe(this.club, H).hands.toLowerCase(),
      say: v < t.hands[0] ? `Hands forward a touch, toward your ${w.L} thigh` : 'Hands back a touch, toward the centre', tip: v < t.hands[0] ? 'Your hands are behind the ball, which adds loft and flips the strike.' : `Your hands are pushed well ahead for a ${this.club.name}, which de-lofts the club.` }; } });
  return M;
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- UI ----------
const css = `
.suClub{width:100%;padding:10px 12px;border-radius:12px;border:1px solid #2c4a35;background:#0f2216;color:#eef5ec;font:600 1rem system-ui,sans-serif}
.gpM{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}
.gpM li{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:center;padding:8px 10px;border-radius:10px;background:#122017;border-left:4px solid #2c4a35}
.gpM li i{grid-row:span 2;width:12px;height:12px;border-radius:50%;background:#9fb8a5}
.gpM li b{font-size:.9rem}.gpM li small{color:#a9bdae;font-size:.8rem;line-height:1.35}
.gpM li.in{border-left-color:#46c06e}.gpM li.in i{background:#46c06e}
.gpM li.warn{border-left-color:#e0b13a}.gpM li.warn i{background:#e0b13a}
.gpM li.out{border-left-color:#ef6b5e}.gpM li.out i{background:#ef6b5e}
.suSel{background:#0f2216;color:#eef5ec;border:1px solid #2c4a35;border-radius:999px;padding:7px 10px;font:600 .85rem system-ui,sans-serif}
`;
const SetupUI = {
  el: null,
  ensure() {
    if (this.el) return;
    const LC = root.LiveCoach; LC.injectCss();
    { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
    const el = document.createElement('div'); el.className = 'lv'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Live setup check');
    el.innerHTML = `<div class="lvTop"><h2>Live setup check<small id="suSub">Practice</small></h2><button type="button" class="lvX" aria-label="Close setup check">✕</button></div>
<div class="lvBody">
 <div class="lvSet" id="suSet">
  <div class="lvRow"><span class="lvLbl">Club</span><select class="suClub" id="suClub" aria-label="Club">${CLUBS.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
  <div class="lvRow"><span class="lvLbl">Camera</span><span class="lvSeg" id="suView"><button type="button" data-v="face">Face-on</button><button type="button" data-v="dtl">Down the line</button></span></div>
  <p id="suHow"></p>
  <div class="lvRow"><span class="lvLbl">Golfer</span><span class="lvSeg" id="suHand"><button type="button" data-v="right">Right-handed</button><button type="button" data-v="left">Left-handed</button></span></div>
  <div class="lvRow"><span class="lvLbl">Height</span><select class="suSel" id="suHeight" aria-label="Your height">${Array.from({ length: 13 }, (_, i) => 145 + i * 5).map(h => `<option value="${h}">${h} cm (${Math.floor(h / 30.48)}′${Math.round(h / 2.54 % 12)}″)</option>`).join('')}</select><span class="lvLbl" style="min-width:0;text-transform:none;letter-spacing:0;font-weight:500">used to turn moves into centimetres</span></div>
  <div class="lvRow"><span class="lvLbl">Lens</span><span class="lvSeg" id="suLens"><button type="button" data-v="user">Front (screen faces you)</button><button type="button" data-v="environment">Back</button></span></div>
  <div class="lvRow"><span class="lvLbl">Sound</span><span class="lvSeg" id="suSound"><button type="button" data-v="voice">Voice</button><button type="button" data-v="tones">Tones</button><button type="button" data-v="off">Off</button></span></div>
  <div class="lvRow"><button type="button" class="lvGo" id="suStart">Start camera</button><label class="lvAlt" for="suFile">Use a photo or video</label><input type="file" id="suFile" accept="image/*,video/*" hidden></div>
  <div class="lvMsg" id="suMsg" role="status"></div>
 </div>
 <div id="suRun" hidden>
  <div class="lvRow" style="margin-bottom:8px"><select class="suClub" id="suClub2" aria-label="Club" style="width:auto;flex:1"></select></div>
  <div class="lvStatus" id="suStatus" aria-live="polite"><b>Starting…</b><span></span></div>
  <div class="lvStage" id="suStage" style="max-height:52vh"><video id="suVid" playsinline muted autoplay></video><img id="suImg" alt="" hidden style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"><canvas id="suCan"></canvas></div>
  <ul class="gpM" id="suMetrics"></ul>
  <div class="lvStats" id="suStats"></div>
  <div class="lvKey"><span><i style="background:#46c06e"></i>In zone</span><span><i style="background:#e0b13a"></i>Edge of zone</span><span><i style="background:#ef6b5e"></i>Out of zone</span><span id="suKey"></span></div>
  <div class="lvRow" style="margin-top:10px"><button type="button" class="lvAlt" id="suSwap">Switch camera angle</button><button type="button" class="lvAlt" id="suStop">Stop</button></div>
 </div>
</div>`;
    document.body.appendChild(el); this.el = el;
    const q = s => el.querySelector(s); this.q = q;
    q('#suClub2').innerHTML = q('#suClub').innerHTML;
    q('.lvX').onclick = () => this.close();
    el.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    const seg = (id, key, cb) => q(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.opt[key] = b.dataset.v; this.paint(); cb && cb(); });
    seg('#suView', 'view', () => this.paintHow()); seg('#suHand', 'hand'); seg('#suLens', 'lens');
    seg('#suSound', 'sound', () => { this.spk.mode = this.opt.sound; try { localStorage.setItem('cc_live_sound', this.opt.sound); } catch (_) {} });
    const clubCh = v => { this.opt.club = v; q('#suClub').value = v; q('#suClub2').value = v; this.paintHow(); try { localStorage.setItem('cc_setup_club', v); } catch (_) {} this.deps.onClub && this.deps.onClub(v);
      if (this.eng) { this.eng.setClub(v); this.spk.say({ text: CLUBS.find(c => c.id === v).name.replace('°', ' degree'), force: true, pri: 2 }); } };
    q('#suClub').onchange = e => clubCh(e.target.value); q('#suClub2').onchange = e => clubCh(e.target.value);
    q('#suHeight').onchange = e => { this.opt.height = +e.target.value; try { localStorage.setItem('cc_height', e.target.value); } catch (_) {} };
    q('#suStart').onclick = () => this.start('camera');
    q('#suFile').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) this.start(/^image\//.test(f.type) ? 'image' : 'file', f); };
    q('#suStop').onclick = () => this.stop(true);
    q('#suSwap').onclick = () => { this.opt.view = this.opt.view === 'dtl' ? 'face' : 'dtl'; this.paint(); this.paintHow(); if (this.eng) { const e = new SetupEngine({ right: this.opt.hand !== 'left', view: this.opt.view, club: this.opt.club, height: this.opt.height }); e.said.first = true; this.eng = e; } this.spk.say({ text: this.opt.view === 'dtl' ? 'Down the line view. Turn side-on to the camera.' : 'Face-on view. Face the camera.', force: true, pri: 2 }); };
    this.spk = new LC.Speaker();
  },
  paint() { for (const [id, k] of [['#suView', 'view'], ['#suHand', 'hand'], ['#suLens', 'lens'], ['#suSound', 'sound']]) this.q(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === this.opt[k])); },
  paintHow() {
    const v = this.opt.view;
    this.q('#suHow').textContent = v === 'dtl' ? 'From the side it checks how far you stand from the ball (how your arms hang), your posture and your knee flex. Put the phone 2.5–3 m away, side-on to you at hip height, so you are in the picture head to toe. Aim (feet and shoulders) can\'t be seen reliably by one camera: lay a club on the ground along your toes to check that.'
      : 'From the front it checks your stance width and ball position (and tells you which foot to move), shoulder tilt, head and hand position. Put the phone 2.5–3 m in front of you at hip height, square to your chest, with your feet and the ball in the picture.';
    this.q('#suKey').textContent = v === 'dtl' ? 'Dashed line: where your hands should hang' : 'Rings on the ground: where each foot should go · white ring: the ball';
  },
  open(deps) {
    this.ensure(); this.deps = deps;
    let snd = 'voice', club = deps.club || '7i', h = 175; try { snd = localStorage.getItem('cc_live_sound') || 'voice'; h = +(localStorage.getItem('cc_height') || 175); if (!deps.club) club = localStorage.getItem('cc_setup_club') || '7i'; } catch (_) {}
    this.opt = { view: deps.view || 'face', hand: deps.hand || 'right', lens: 'user', sound: snd, club, height: h }; this.spk.mode = snd;
    this.q('#suClub').value = club; this.q('#suClub2').value = club; this.q('#suHeight').value = String(h);
    this.paint(); this.paintHow(); this.q('#suSet').hidden = false; this.q('#suRun').hidden = true; this.q('#suMsg').textContent = '';
    this.el.hidden = false; document.documentElement.style.overflow = 'hidden'; this.q('.lvX').focus();
  },
  msg(t) { this.q('#suMsg').textContent = t; },
  async start(src, file) {
    const q = this.q, v = q('#suVid'), img = q('#suImg');
    this.spk.unlock(); q('#suStart').disabled = true; this.msg('Loading body tracking…');
    let pose; try { pose = await this.deps.getPose(); } catch (e) { q('#suStart').disabled = false; this.msg('Tracking could not load. Check your connection and try again.'); return; }
    this.src = src; img.hidden = true; v.hidden = false;
    const mir = on => { q('#suStage').classList.toggle('mir', on); };
    if (src === 'camera') {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { q('#suStart').disabled = false; this.msg('This browser does not give the app camera access here. Open the app in Safari or Chrome directly, or use a photo or video instead.'); return; }
      try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.opt.lens, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
      catch (e) { q('#suStart').disabled = false; const n = e && e.name; this.msg(n === 'NotAllowedError' || n === 'SecurityError' ? 'Camera access was blocked. Allow camera access for this page in your browser settings (on iPhone: Settings › Safari › Camera › Allow), then tap Start again, or use a photo or video.' : 'The camera could not start (' + (n || 'unknown error') + '). Try again, or use a photo or video.'); return; }
      v.srcObject = this.stream; mir(this.opt.lens === 'user');
    } else if (src === 'file') { this.url = URL.createObjectURL(file); v.srcObject = null; v.src = this.url; v.loop = true; mir(false); }
    else { this.url = URL.createObjectURL(file); img.src = this.url; img.hidden = false; v.hidden = true; try { await img.decode(); } catch (_) { q('#suStart').disabled = false; this.msg('That photo could not be opened.'); return; } mir(false); }
    if (src !== 'image') {
      try { await v.play(); } catch (_) {}
      await new Promise(r => { if (v.videoWidth) r(); else { v.onloadedmetadata = () => r(); setTimeout(r, 4000); } });
      if (!v.videoWidth) { this.stop(false); q('#suStart').disabled = false; this.msg(src === 'file' ? 'That video could not be played in this browser. Try a photo, or a different video.' : 'The camera started but sent no picture. Tap Start to try again.'); return; }
    }
    const sw = src === 'image' ? img.naturalWidth : v.videoWidth, sh = src === 'image' ? img.naturalHeight : v.videoHeight;
    q('#suStage').style.aspectRatio = sw + ' / ' + sh;
    q('#suSet').hidden = true; q('#suRun').hidden = false; q('#suStart').disabled = false; this.msg('');
    try { if (navigator.wakeLock && src === 'camera') this.wake = await navigator.wakeLock.request('screen'); } catch (_) {}
    this.eng = new SetupEngine({ right: this.opt.hand !== 'left', view: this.opt.view, club: this.opt.club, height: this.opt.height });
    this.spk.say({ text: src === 'camera' ? (this.opt.view === 'dtl' ? 'Camera on. Set up side-on to the camera.' : 'Camera on. Set up facing the camera.') : 'Checking your setup.', force: true, pri: 2 });
    this.run = true; this.loop(pose, src === 'image' ? img : v);
  },
  async loop(pose, el) {
    const my = (this.tok = (this.tok || 0) + 1), q = this.q;
    const F = document.createElement('canvas'), fx = F.getContext('2d', { willReadFrequently: true }), S = document.createElement('canvas'), sx = S.getContext('2d');
    const smp = this.deps.makeSampler(), can = q('#suCan'), x = can.getContext('2d');
    let roi = null, fps = 0, lastT = performance.now(), frames = 0;
    while (this.run && this.tok === my) {
      const vw = el.videoWidth || el.naturalWidth, vh = el.videoHeight || el.naturalHeight;
      if (!vw || (el.readyState != null && el.readyState < 2)) { await root.LiveCoach.sleep(60); continue; }
      const k = Math.min(1, 1280 / Math.max(vw, vh)), W = Math.round(vw * k), H = Math.round(vh * k);
      if (F.width !== W || F.height !== H) { F.width = W; F.height = H; }
      fx.drawImage(el, 0, 0, W, H);
      const t = this.src === 'camera' ? performance.now() / 1000 : this.src === 'file' ? el.currentTime + (this.loops || 0) * (el.duration || 0) : frames * 0.3;
      const ks = Math.min(1, 480 / Math.max(W, H)), sw = Math.round(W * ks), shh = Math.round(H * ks);
      if (S.width !== sw || S.height !== shh) { S.width = sw; S.height = shh; }
      sx.drawImage(F, 0, 0, sw, shh);
      let r = null; try { r = pose.track({ width: sw, height: shh }, roi, smp(S)); } catch (_) {}
      roi = r ? r.next : null;
      const P = r ? r.pts.map(p => ({ x: p.x / ks, y: p.y / ks, vis: p.vis })) : null;
      // look for the ball near the feet
      let ball = null;
      if (P) {
        const s = this.eng.ballSearch(P);
        if (s) {
          const x0 = Math.max(0, Math.floor(s.x0)), y0 = Math.max(0, Math.floor(s.y0)), x1 = Math.min(W, Math.ceil(s.x1)), y1 = Math.min(H, Math.ceil(s.y1));
          if (x1 - x0 > 8 && y1 - y0 > 8) {
            try {
              const id = fx.getImageData(x0, y0, x1 - x0, y1 - y0);
              const sh2 = p => ({ x: p.x - x0, y: p.y - y0, r: p.r });
              const b = findBall(id.data, x1 - x0, y1 - y0, s.r, s.avoid.map(sh2), s.want && { x: s.want.x - x0, y: s.want.y - y0, sx: s.want.sx, sy: s.want.sy });
              if (b) ball = { x: b.x + x0, y: b.y + y0, r: b.r };
            } catch (_) {}
          }
          this.search = { x0, y0, x1, y1 };
        }
      }
      const out = this.eng.push(t, P, ball, W, H);
      frames++;
      const now = performance.now(); fps = fps ? fps * 0.85 + 1000 / Math.max(1, now - lastT) * 0.15 : 1000 / Math.max(1, now - lastT); lastT = now;
      for (const s of out.say) this.spk.say(s);
      this.draw(x, can, out, W, H);
      this.status(out, fps);
      if (this.src === 'image' && frames > 10) { this.run = false; break; }
      if (this.src === 'file') { if (el.ended) this.loops = (this.loops || 0) + 1; el.playbackRate = Math.max(0.1, Math.min(1, Math.round(fps / 8 * 20) / 20)); }
      await new Promise(r2 => (root.requestAnimationFrame ? requestAnimationFrame(() => r2()) : setTimeout(r2, 0)));
    }
  },
  draw(x, can, out, W, H) {
    if (can.width !== W || can.height !== H) { can.width = W; can.height = H; }
    x.clearRect(0, 0, W, H);
    const COL = root.LiveCoach.COL, lw = Math.max(2, W / 240), d = out.draw;
    x.lineCap = 'round';
    for (const z of (d.zones || [])) {
      if (!z || !d.focus || z.key !== d.focus) continue; const c = COL[z.lv] || COL.idle; x.strokeStyle = c; x.fillStyle = c; x.lineWidth = lw * 1.3; x.setLineDash(z.dash ? [lw * 3, lw * 2] : []);
      if (z.type === 'line') { x.beginPath(); x.moveTo(z.x0, z.y0); x.lineTo(z.x1, z.y1); x.stroke(); if (z.dot) for (const [px, py] of [[z.x0, z.y0], [z.x1, z.y1]]) { x.beginPath(); x.arc(px, py, lw * 2, 0, 7); x.fill(); } }
      else if (z.type === 'vline') { x.setLineDash([lw * 3, lw * 2]); x.beginPath(); x.moveTo(z.x, z.y0); x.lineTo(z.x, z.y1); x.stroke(); }
      else if (z.type === 'band') { x.globalAlpha = 0.28; x.fillRect(Math.min(z.x0, z.x1), z.y - lw * 3, Math.abs(z.x1 - z.x0), lw * 6); x.globalAlpha = 1; }
      else if (z.type === 'wedge') { x.globalAlpha = 0.26; x.beginPath(); x.moveTo(z.x, z.y); x.lineTo(z.a.x, z.a.y); x.lineTo(z.b.x, z.b.y); x.closePath(); x.fill(); x.globalAlpha = 1; }
      else if (z.type === 'feet') {
        // target spots for each foot + current ankles
        for (const [tx, cx] of [[z.xl, z.cl], [z.xt, z.ct]]) {
          x.setLineDash([]); x.globalAlpha = 0.9; x.beginPath(); x.ellipse(tx, z.y, z.r, z.r * 0.45, 0, 0, 7); x.stroke(); x.globalAlpha = 1;
          if (Math.abs(tx - cx) > z.r * 0.4) { x.beginPath(); x.moveTo(cx, z.y); x.lineTo(tx, z.y); x.stroke(); const a = Math.sign(tx - cx); x.beginPath(); x.moveTo(tx - a * z.r * 0.5, z.y - z.r * 0.3); x.lineTo(tx - a * z.r * 0.15, z.y); x.lineTo(tx - a * z.r * 0.5, z.y + z.r * 0.3); x.stroke(); }
        }
        if (z.b0 != null) { x.globalAlpha = 0.28; x.fillRect(Math.min(z.b0, z.b1), z.ball.y - lw * 2.5, Math.abs(z.b1 - z.b0), lw * 5); x.globalAlpha = 1; }
      }
    }
    x.setLineDash([]);
    if (d.ball) { x.strokeStyle = '#ffffff'; x.lineWidth = lw; x.beginPath(); x.arc(d.ball.x, d.ball.y, Math.max(d.ball.r * 1.8, lw * 4), 0, 7); x.stroke(); }
    // a small marker on the body part being talked about, nothing else
    const P = d.P; if (!P || !d.focus) return;
    const at = { dist: [15, 16], spine: [11, 12, 23, 24], knees: [25, 26], feet: [27, 28], tilt: [11, 12], head: [0], hands: [15, 16] }[d.focus];
    if (at) { const c = COL[(out.level === 'out' ? 'out' : out.level === 'warn' ? 'warn' : 'idle')] || COL.idle, n = at.length, cx = at.reduce((a, i) => a + P[i].x, 0) / n, cy = at.reduce((a, i) => a + P[i].y, 0) / n;
      x.strokeStyle = c; x.lineWidth = lw * 1.2; x.globalAlpha = 0.9; x.beginPath(); x.arc(cx, cy, lw * 9, 0, 7); x.stroke(); x.globalAlpha = 1; }
  },
  status(out, fps) {
    const st = this.q('#suStatus'), e = this.eng;
    st.className = 'lvStatus ' + out.level; st.querySelector('b').textContent = out.text; st.querySelector('span').textContent = out.sub || '';
    if (out.metrics.length) this.q('#suMetrics').innerHTML = out.metrics.map(m => `<li class="${m.lv}"><i></i><b>${this.deps.esc(m.label)}: ${this.deps.esc(m.val)}</b><small>Aim for ${this.deps.esc(m.aim)}</small></li>`).join('');
    this.q('#suStats').innerHTML = `<span>${this.deps.esc(e.club.name)}</span><span>Setups <b>${e.setups}</b></span><span>Good to go <b>${e.good}</b></span>${this.src !== 'image' ? `<span>Tracking <b>${fps.toFixed(1)}</b> fps</span>` : ''}`;
  },
  stop(showSetup) {
    this.run = false; this.tok = (this.tok || 0) + 1;
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    const v = this.q && this.q('#suVid'); if (v) { try { v.pause(); } catch (_) {} v.srcObject = null; v.removeAttribute('src'); try { v.load(); } catch (_) {} }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    if (this.wake) { try { this.wake.release(); } catch (_) {} this.wake = null; }
    this.loops = 0; this.spk && this.spk.stop(); this.eng = null;
    if (showSetup && this.q) { this.q('#suRun').hidden = true; this.q('#suSet').hidden = false; this.q('#suMetrics').innerHTML = ''; }
  },
  close() { this.stop(false); if (this.el) this.el.hidden = true; document.documentElement.style.overflow = ''; this.deps && this.deps.onClose && this.deps.onClose(); },
};

const api = { SetupEngine, SetupUI, CLUBS, targets, describe, findBall };
if (typeof module !== 'undefined') module.exports = api; else root.SetupCoach = api;
})(typeof window !== 'undefined' ? window : this);
