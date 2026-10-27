// Realistic golfer for Drill Studio: a skinned human (MakeHuman CC0 body) driven by the drill rig's joint positions.
// Loads golfer-mesh.wasm (binary mesh, not WebAssembly) + golfer-skin.jpg. Exposes CCGolfer.load(base) -> Promise, CCGolfer.make(ghost) -> figure, figure.pose(J, opt).
(function (root) {
'use strict';
const T = root.THREE;
let DATA = null, LOADING = null, TEX = null;
const v3 = a => new T.Vector3(a[0], a[1], a[2]);

function parse(buf) {
  const dv = new DataView(buf); if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'CCG1') throw new Error('bad golfer file');
  const jl = dv.getUint32(4, true), meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl))); let o = 8 + jl; const nv = meta.nv;
  const take = (C, n, bytes) => { const a = new C(buf.slice(o, o + n * bytes)); o += n * bytes; return a; };
  const pos = take(Float32Array, nv * 3, 4); const nrm = take(Int8Array, nv * 3, 1); o += (4 - (nv * 3) % 4) % 4;
  const uv = take(Float32Array, nv * 2, 4); const si = take(Uint8Array, nv * 4, 1); const sw = take(Uint8Array, nv * 4, 1);
  const ao = take(Uint8Array, nv, 1); const part = take(Uint8Array, nv, 1); o += (4 - (2 * nv) % 4) % 4;
  const idx = meta.i32 ? take(Uint32Array, meta.ni, 4) : take(Uint16Array, meta.ni, 2);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nrm, 3, true));
  g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.BufferAttribute(sw, 4, true));
  g.setAttribute('ao', new T.BufferAttribute(ao, 1, true)); g.setAttribute('part', new T.BufferAttribute(part, 1));
  g.setIndex(new T.BufferAttribute(idx, 1));
  meta.groups.forEach((gr, i) => g.addGroup(gr.start, gr.count, i));
  g.computeBoundingSphere(); g.boundingSphere.radius = 3;   // posed far from rest; never cull
  meta.bi = {}; meta.bones.forEach((b, i) => { meta.bi[b.n] = i; b.H = v3(b.h); b.T = v3(b.t); });
  return { meta, geo: g };
}
function load(base) {
  if (DATA) return Promise.resolve(DATA);
  if (LOADING) return LOADING;
  base = base || '';
  // golfer-mesh.wasm is not WebAssembly: it's the golfer's binary mesh, named .wasm so every host serves it as binary
  LOADING = Promise.all([
    fetch(base + 'golfer-mesh.wasm').then(r => { if (!r.ok) throw new Error('golfer ' + r.status); return r.arrayBuffer(); }),
    new Promise((ok, no) => new T.TextureLoader().load(base + 'golfer-skin.jpg', ok, undefined, no)),
    new Promise(ok => new T.TextureLoader().load(base + 'golfer-eye.jpg', ok, undefined, () => ok(null))),
  ]).then(([buf, skin, eye]) => { skin.encoding = T.sRGBEncoding; skin.flipY = true; skin.anisotropy = 4; if (eye) eye.encoding = T.sRGBEncoding; TEX = { skin, eye }; DATA = parse(buf); return DATA; })
    .catch(e => { LOADING = null; throw e; });
  return LOADING;
}

// ---------- materials ----------
// every material gets: baked ambient occlusion, and a pulsing green glow on highlighted body parts
function patch(m, opt) {
  m.userData.hl = { value: 0 }; m.userData.hlB = { value: new Float32Array(64) }; m.userData.pulse = { value: 0 }; m.userData.ghost = !!opt.ghost;
  m.onBeforeCompile = sh => {
    sh.uniforms.hlMask = m.userData.hl; sh.uniforms.hlPulse = m.userData.pulse;
    sh.uniforms.hlB = m.userData.hlB;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float ao; varying float vAO; varying float vHL; uniform float hlB[64];')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAO = ao; vHL = skinWeight.x * hlB[int(skinIndex.x)] + skinWeight.y * hlB[int(skinIndex.y)] + skinWeight.z * hlB[int(skinIndex.z)] + skinWeight.w * hlB[int(skinIndex.w)];');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAO; varying float vHL; uniform float hlPulse;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nfloat bao = mix(1.0, vAO, ' + (opt.aoK || 0.85).toFixed(2) + '); reflectedLight.indirectDiffuse *= bao; reflectedLight.directDiffuse *= mix(1.0, bao, 0.45); reflectedLight.indirectSpecular *= bao;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat rimK = pow(1.0 - clamp(dot(normalize(vViewPosition), -normal) * -1.0 + 0.0, 0.0, 1.0), 2.0); float hv = smoothstep(0.15, 0.85, vHL); totalEmissiveRadiance += hv * vec3(0.10, 0.80, 0.42) * hlPulse * (0.12 + 1.9 * rimK); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.66, 0.40), hv * 0.10 * hlPulse);');
    if (opt.sss) sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' +
      // a soft red bleed where light falls off (cheap subsurface look)
      'reflectedLight.directDiffuse += diffuseColor.rgb * vec3(0.20, 0.05, 0.03) * clamp(1.0 - abs(dot(normal, normalize(vec3(0.3, 0.8, 0.5)))), 0.0, 1.0) * 0.6;');
  };
  m.customProgramCacheKey = () => 'ccg' + (opt.sss ? 's' : '') + (opt.aoK || 0.85);
  return m;
}
function materials(ghost) {
  if (ghost) { const g = patch(new T.MeshStandardMaterial({ color: 0xff3b2b, emissive: 0x8a1408, transparent: true, opacity: 0.45, roughness: 0.6, depthWrite: false, skinning: true }), { ghost: true, aoK: 0.3 }); g.color.convertSRGBToLinear(); return () => g; }
  const P = (o, x) => { const m = new T.MeshPhysicalMaterial(Object.assign({ skinning: true }, o)); if (o.color !== undefined) m.color.convertSRGBToLinear(); if (o.sheen) m.sheen.convertSRGBToLinear(); return patch(m, x || {}); };
  const M = {
    skin: P({ map: TEX.skin, roughness: 0.52, clearcoat: 0.08, clearcoatRoughness: 0.5, sheen: new T.Color(0x3a1d14) }, { sss: true, aoK: 0.9 }),
    shirt: P({ color: 0x23395a, roughness: 0.88, sheen: new T.Color(0x3a5070) }),
    trousers: P({ color: 0x34383f, roughness: 0.8, sheen: new T.Color(0x2b2f36) }),
    belt: P({ color: 0x2a1a12, roughness: 0.45, clearcoat: 0.3 }),
    shoe: P({ color: 0xf2f1ec, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    sole: P({ color: 0x23252a, roughness: 0.7 }),
    glove: P({ color: 0xf7f7f3, roughness: 0.62, sheen: new T.Color(0x666666) }),
    cap: P({ color: 0x15233a, roughness: 0.8, sheen: new T.Color(0x22324e), side: T.DoubleSide }),
    cornea: P({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.0, depthWrite: false }, { aoK: 0.0 }),
    eye: P({ map: TEX.eye || null, color: TEX.eye ? 0xffffff : 0xe8e4de, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }, { aoK: 0.4 }),
  };
  return k => M[k] || M.skin;
}

// ---------- figure ----------
function make(ghost) {
  const D = DATA, meta = D.meta;
  const bones = meta.bones.map(b => { const o = new T.Bone(); o.name = b.n; o.matrixAutoUpdate = false; return o; });
  const inv = meta.bones.map(b => new T.Matrix4().makeTranslation(-b.h[0], -b.h[1], -b.h[2]));
  const mat = materials(ghost), mats = meta.groups.map(g => mat(g.mat));
  const mesh = new T.SkinnedMesh(D.geo, mats);
  bones.forEach(b => mesh.add(b));
  const skel = new T.Skeleton(bones, inv); mesh.bind(skel, new T.Matrix4());
  mesh.castShadow = !ghost; mesh.receiveShadow = !ghost; mesh.frustumCulled = false;
  bones.forEach((b, i) => { b.matrix.makeTranslation(meta.bones[i].h[0], meta.bones[i].h[1], meta.bones[i].h[2]); });
  const fig = { G: mesh, mesh, bones, meta, ghost: !!ghost, mats, pose: (J, o) => poseGolfer(fig, J, o), highlight: (parts, t) => highlight(fig, parts, t) };
  return fig;
}

// set a bone so that its rest head->tail maps to world head->tail, with its rest "side" axis turned to `side`
const _m = new T.Matrix4(), _a = new T.Matrix4(), _b = new T.Matrix4();
function frame(d, s) { d = d.clone().normalize(); s = s.clone().sub(d.clone().multiplyScalar(s.dot(d))); if (s.lengthSq() < 1e-10) s = Math.abs(d.y) < 0.9 ? new T.Vector3(0, 1, 0).cross(d) : new T.Vector3(1, 0, 0).cross(d); s.normalize(); const w = new T.Vector3().crossVectors(d, s); return [d, s, w]; }
function setBone(fig, name, head, tail, side, restSide, stretch) {
  const i = fig.meta.bi[name], rb = fig.meta.bones[i];
  const d0 = rb.T.clone().sub(rb.H), L0 = d0.length(), d1 = tail.clone().sub(head), L1 = d1.length();
  const [a0, b0, c0] = frame(d0, restSide), [a1, b1, c1] = frame(d1, side);
  _a.makeBasis(a0, b0, c0); _b.makeBasis(a1, b1, c1);
  const k = stretch === false ? 1 : L1 / L0;
  // world = T(head) * R1 * S(k along bone) * R0^T  (applied to (p - restHead))
  _m.copy(_b).multiply(new T.Matrix4().makeScale(k, 1, 1)).multiply(_a.clone().transpose());
  _m.setPosition(head);
  fig.bones[i].matrix.copy(_m);
  return _m;
}
function setBoneM(fig, name, m) { fig.bones[fig.meta.bi[name]].matrix.copy(m); }
const PART_BONES = { hips: ['hips', 'spine'], chest: ['chest', 'clavL', 'clavR'], head: ['head'], neck: ['neck'], leadarm: ['uarmL', 'farmL', 'ftwL'], trailarm: ['uarmR', 'farmR', 'ftwR'],
  leadhand: ['handL', 'F:L'], trailhand: ['handR', 'F:R'], leadleg: ['thighL', 'shinL'], trailleg: ['thighR', 'shinR'], leadfoot: ['footL'], trailfoot: ['footR'] };
function highlight(fig, parts, t) {
  const arr = new Float32Array(64); let any = false;
  for (const p of parts || []) for (const b of PART_BONES[p] || []) {
    if (b.startsWith('F:')) { for (let f = 1; f <= 5; f++) for (let j = 1; j <= 3; j++) arr[fig.meta.bi['f' + f + j + b[2]]] = 1; }
    else if (fig.meta.bi[b] != null) arr[fig.meta.bi[b]] = 1;
    any = true;
  }
  for (const m of new Set(fig.mats)) { m.userData.hlB.value = arr; m.userData.pulse.value = any ? 0.55 + 0.25 * Math.sin((t || 0) * 5) : 0; }
}

// ---------- posing from the drill rig ----------
const A = a => new T.Vector3(a[0], a[1], a[2]);
function restPose(fig) { fig.bones.forEach((b, i) => b.matrix.makeTranslation(fig.meta.bones[i].h[0], fig.meta.bones[i].h[1], fig.meta.bones[i].h[2])); fig.mesh.updateMatrixWorld(true); }
function poseGolfer(fig, J, o) {
  o = o || {};
  if (!J) return restPose(fig);
  const mb = n => fig.meta.bones[fig.meta.bi[n]];
  const X = new T.Vector3(1, 0, 0), Yv = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);
  const pel = A(J.pel), s = A(J.s), H = A(J.H), Lt = A(J.Lt), F = A(J.F);
  // torso: hips -> spine -> chest -> neck, twisting from the hips' line to the shoulders' line
  const Fh = new T.Vector3().crossVectors(H, s).normalize(), Yh = new T.Vector3().crossVectors(Fh, H).normalize();
  const hb = mb('hips'), sp = mb('spine'), ch = mb('chest'), nk = mb('neck');
  const Lhip = hb.T.distanceTo(hb.H), Lsp = sp.T.distanceTo(sp.H), Lch = ch.T.distanceTo(ch.H);
  const neckP = A(J.neck);
  const pTop = pel.clone().addScaledVector(Yh, Lhip);
  const spTail = pTop.clone().addScaledVector(s, Lsp * 0.96);
  const mid = H.clone().add(Lt).normalize();
  setBone(fig, 'hips', pel, pTop, H, X);
  setBone(fig, 'spine', pTop, spTail, mid, X);
  const chM = setBone(fig, 'chest', spTail, neckP, Lt, X).clone();
  // head: centre at J.head, face looking along J.face
  const fz = A(J.face), fx = new T.Vector3().crossVectors(Yv, fz).normalize(), fy = new T.Vector3().crossVectors(fz, fx).normalize();
  const hC = A(fig.meta.headC), hd = mb('head');
  const R = new T.Matrix4().makeBasis(fx, fy, fz);
  const headM = R.clone(); headM.setPosition(A(J.head).sub(hC.clone().applyMatrix4(R)));
  // the head bone's own matrix is world*restInverse: world(p) = R p + t, so matrix = R with translation t + R*restHead
  const hM = R.clone(); const tr = new T.Vector3().setFromMatrixPosition(headM); hM.setPosition(tr.add(hd.H.clone().applyMatrix4(R)));
  setBoneM(fig, 'head', hM);
  const skull = hd.H.clone().applyMatrix4(R).add(new T.Vector3().setFromMatrixPosition(headM));
  setBone(fig, 'neck', neckP, skull, fx.clone().add(Lt).normalize(), X);
  // arms and legs
  for (const [S, sh, el, hand, kn, an, toe, hip, hl, lead] of [['L', J.ls, J.le, J.lh, J.lk, J.la, J.lt, J.lhip, J.lhl, true], ['R', J.ts, J.te, J.th, J.tk, J.ta, J.tt, J.thip, J.thl, false]]) {
    const cl = mb('clav' + S), clH = cl.H.clone().sub(ch.H).applyMatrix4(chM);
    setBone(fig, 'clav' + S, clH, A(sh), F, Z);
    const ua = mb('uarm' + S), fa = mb('farm' + S), fw = mb('ftw' + S), hn = mb('hand' + S);
    const Lu = ua.T.distanceTo(ua.H), Lf = fa.T.distanceTo(fa.H) + fw.T.distanceTo(fw.H);
    const du0 = ua.T.clone().sub(ua.H), df0 = fw.T.clone().sub(fa.H), n0 = new T.Vector3().crossVectors(du0, df0).normalize();
    const hf = handFrame(J, S, lead, fig), Mh = hf.M;
    const shV = A(sh), wrist = hn.H.clone().applyMatrix4(Mh);
    // elbow: two-bone reach from shoulder to wrist with the mesh's own arm lengths, bending the way the rig's elbow points
    const rigEl = A(el), toW = wrist.clone().sub(shV), Lw = toW.length(), dW = toW.clone().normalize();
    let pole = rigEl.clone().sub(shV).projectOnPlane(dW); if (pole.lengthSq() < 1e-8) pole = new T.Vector3(0, -1, -0.3); pole.normalize();
    const reach = Math.min(Lw, (Lu + Lf) * 0.999), along = (Lu * Lu - Lf * Lf + reach * reach) / (2 * reach), hgt = Math.sqrt(Math.max(0, Lu * Lu - along * along));
    const elV = shV.clone().addScaledVector(dW, along * Lw / reach).addScaledVector(pole, hgt);
    const du = elV.clone().sub(shV), df = wrist.clone().sub(elV);
    let n = new T.Vector3().crossVectors(du, df); if (n.lengthSq() < 1e-8) n = new T.Vector3().crossVectors(du, pole).negate(); n.normalize();
    setBone(fig, 'uarm' + S, shV, elV, n, n0);
    const mid2 = elV.clone().lerp(wrist, fa.T.distanceTo(fa.H) / Lf);
    setBone(fig, 'farm' + S, elV, mid2, n, n0);
    const handSideW = hf.side0.clone().transformDirection(Mh);
    const twist = n.clone().lerp(handSideW.projectOnPlane(df.clone().normalize()).normalize(), 0.5).normalize();
    setBone(fig, 'ftw' + S, mid2, wrist, twist, n0.clone().lerp(hf.side0, 0.5).normalize());
    setBoneM(fig, 'hand' + S, Mh.clone().multiply(new T.Matrix4().makeTranslation(hn.H.x, hn.H.y, hn.H.z)));
    fingers(fig, S, Mh, hf.curl, hf.thumb);
    // legs: knee bend axis, with the knee's pole when the leg is straight
    const th = mb('thigh' + S), sn = mb('shin' + S), ft = mb('foot' + S);
    const hipV = A(hip), knV = A(kn), anV = A(an);
    const dt0 = th.T.clone().sub(th.H), ln0 = new T.Vector3().crossVectors(dt0, new T.Vector3(0, 0, -1)).normalize();
    const dt = knV.clone().sub(hipV), ds = anV.clone().sub(knV);
    const kpole = A(lead ? (J.lkp || [0.15, 0, 1]) : (J.tkp || [-0.15, 0, 1])).normalize();
    let ln = new T.Vector3().crossVectors(dt.clone().normalize(), ds.clone().normalize()); ln.add(new T.Vector3().crossVectors(dt.clone().normalize(), kpole.clone().negate()).multiplyScalar(0.08)).normalize();
    setBone(fig, 'thigh' + S, hipV, knV, ln, ln0);
    setBone(fig, 'shin' + S, knV, anV, ln, ln0);
    // foot: ankle to the toes, flat on the ground unless the heel is up
    const toeV = A(toe), fdir = toeV.clone().sub(anV);
    const f0 = ft.T.clone().sub(ft.H), fs0 = new T.Vector3().crossVectors(Yv, f0).normalize(), fs = new T.Vector3().crossVectors(Yv, fdir).normalize();
    setBone(fig, 'foot' + S, anV, anV.clone().add(fdir.normalize().multiplyScalar(f0.length())), fs, fs0, false);
  }
  fig.mesh.updateMatrixWorld(true);
}
// hand: a grip frame worked out once from the rest hand (where a shaft would run through the curled fingers)
function handRest(fig, S) {
  const m = fig.meta; if (m['hr' + S]) return m['hr' + S];
  const B = n => m.bones[m.bi[n + S]];
  const wr = B('hand').H, kI = B('f21').H, kP = B('f51').H, tT = B('f13').T;
  const kM = kI.clone().add(kP).multiplyScalar(0.5), dir = kM.clone().sub(wr).normalize();
  const across = kI.clone().sub(kP).projectOnPlane(dir).normalize();          // pinky -> index
  let palm = tT.clone().sub(wr).projectOnPlane(dir).projectOnPlane(across).normalize();   // the thumb sits on the palm side
  const len = kM.distanceTo(wr);
  return (m['hr' + S] = { wr, dir, across, palm, len, kM });
}
const GRIP = { a: 0.55, b: 0.0, c: { L: 0.9, R: 0.9 }, roll: { L: 0.3, R: -0.3 } };
function handFrame(J, S, lead, fig) {
  const hr = handRest(fig, S);
  const hp = A(lead ? J.lh : J.th), el = A(lead ? J.le : J.te), fore = hp.clone().sub(el).normalize();
  const gripping = J.club && J.sd && !(J.arms === 'lead' && !lead) && !(J.arms === 'trailonly' && lead) && !(J.tdrop > 0.5 && !lead);
  let Rw, pLocal, pWorld, curl, thumb;
  if (gripping) {
    const sd = A(J.sd).normalize();
    // local: the shaft runs from the heel pad to the index finger, through the curled fingers
    const sdL = hr.across.clone().add(hr.dir.clone().multiplyScalar(GRIP.c[S])).normalize();
    pLocal = hr.wr.clone().addScaledVector(hr.dir, hr.len * GRIP.a).addScaledVector(hr.palm, GRIP.b);
    const pnL = hr.palm.clone().projectOnPlane(sdL).normalize();
    // world: palms face each other across the grip; the lead palm faces away from the target, turned a little toward the golfer
    const towardBody = el.clone().sub(hp).projectOnPlane(sd).normalize();
    let w = new T.Vector3(-1, 0, 0).projectOnPlane(sd); if (w.lengthSq() < 1e-6) w = towardBody.clone(); w.normalize();
    // keep w turning with the swing: use the plane of the swing (shaft and forearm)
    const across = new T.Vector3().crossVectors(sd, towardBody).normalize();
    let pn = lead ? across.clone() : across.clone().negate();
    if (pn.dot(w) * (lead ? 1 : -1) < 0 && Math.abs(pn.dot(w)) > 0.5) pn.negate();
    pn.applyAxisAngle(sd, GRIP.roll[S] * (lead ? 1 : -1)).normalize();
    pn.add(towardBody.clone().multiplyScalar(0.0)).normalize();
    const L = new T.Matrix4().makeBasis(sdL, pnL, new T.Vector3().crossVectors(sdL, pnL));
    const Wd = new T.Matrix4().makeBasis(sd, pn, new T.Vector3().crossVectors(sd, pn));
    Rw = Wd.multiply(L.transpose()); pWorld = hp; curl = 1; thumb = lead ? 0.25 : 0.6;
  } else {
    // relaxed hand, palm toward the body
    const sideW = new T.Vector3().crossVectors(A(J.F), fore).normalize();
    const L = new T.Matrix4().makeBasis(hr.dir, hr.across, new T.Vector3().crossVectors(hr.dir, hr.across));
    const across = S === 'L' ? sideW.clone().negate() : sideW.clone();
    const Wd = new T.Matrix4().makeBasis(fore, across.projectOnPlane(fore).normalize(), new T.Vector3().crossVectors(fore, across.projectOnPlane(fore).normalize()));
    Rw = Wd.multiply(L.transpose()); pLocal = hr.wr.clone(); pWorld = hp.clone().addScaledVector(fore, -0.045); curl = 0.3; thumb = 0.2;
  }
  // M maps rest points of the hand to the world: M = T(pWorld) R T(-pLocal)
  const M = Rw.clone(); M.setPosition(pWorld.clone().sub(pLocal.clone().applyMatrix4(Rw)));
  return { M, curl, thumb, side0: hr.across };
}
// fingers: each finger curls round its knuckle joints; the thumb less
const _c = new T.Matrix4();
const CURL = { f: [1.0, 1.25, 0.9], t: [0.25, 0.45, 0.5], sign: { L: -1, R: 1 }, ts: { L: 1, R: -1 } };
function fingers(fig, S, Mh, curl, thumb) {
  const hr = handRest(fig, S);
  for (let f = 1; f <= 5; f++) {
    let acc = Mh.clone();
    for (let j = 1; j <= 3; j++) {
      const b = fig.meta.bones[fig.meta.bi['f' + f + j + S]];
      const bd = b.T.clone().sub(b.H).normalize();
      const ax = f === 1 ? new T.Vector3().crossVectors(bd, hr.palm).normalize() : hr.across.clone();
      const ang = (f === 1 ? CURL.t[j - 1] * thumb : CURL.f[j - 1] * curl * (1 + (f - 2) * 0.06)) * CURL.sign[S] * (f === 1 ? CURL.ts[S] : 1);
      const rot = new T.Matrix4().makeTranslation(b.H.x, b.H.y, b.H.z).multiply(new T.Matrix4().makeRotationAxis(ax, ang)).multiply(new T.Matrix4().makeTranslation(-b.H.x, -b.H.y, -b.H.z));
      acc = acc.multiply(rot);
      fig.bones[fig.meta.bi['f' + f + j + S]].matrix.copy(acc.clone().multiply(new T.Matrix4().makeTranslation(b.H.x, b.H.y, b.H.z)));
    }
  }
}
root.CCGolfer = { load, make, ready: () => !!DATA, restPose, GRIP, CURL, _fingers: fingers, _handRest: handRest };
})(typeof window !== 'undefined' ? window : this);
