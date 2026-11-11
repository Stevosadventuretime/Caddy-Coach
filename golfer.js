// Realistic golfer for Drill Studio: a skinned human (MakeHuman CC0 body) driven by the drill rig's joint positions.
// Loads golfer-mesh.wasm (binary mesh, not WebAssembly) + golfer-skin.jpg. Exposes CCGolfer.load(base) -> Promise, CCGolfer.make(ghost) -> figure, figure.pose(J, opt).
(function (root) {
'use strict';
const T = root.THREE;
let DATA = null, LOADING = null, TEX = null;
const v3 = a => new T.Vector3(a[0], a[1], a[2]);
const D2R = Math.PI / 180;

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
// Two figures: the Rocketbox human (golfer-rb.wasm, MIT licence, textured like a photo) is the default; the older
// MakeHuman figure (golfer-mesh.wasm) is the fallback if it fails to load, or with ?golfer=classic in the address.
const texL = (url, set) => new Promise(ok => new T.TextureLoader().load(url, t => { if (set) set(t); ok(t); }, undefined, () => ok(null)));
function loadRB(base) {
  return fetch(base + 'golfer-rb.wasm').then(r => { if (!r.ok) throw new Error('golfer ' + r.status); return r.arrayBuffer(); }).then(buf => {
    const D = parse(buf), tx = D.meta.tex || {};
    const col = t => { t.encoding = T.sRGBEncoding; t.anisotropy = 4; };
    return Promise.all([texL(base + tx.body, col), texL(base + tx.bodyN), texL(base + tx.head, col), texL(base + tx.headN), null, texL(base + 'golfer-pores.jpg', t => { t.wrapS = t.wrapT = T.RepeatWrapping; })])
      .then(([body, bodyN, head, headN, hair, pores]) => { if (!body || !head) throw new Error('golfer textures');
        return { D, TX: { body, bodyN, head, headN, hair, pores } }; });
  });
}
// The classic head's cap, hair and eyes are only drawn when the classic head is (?golfer=classic, or the realistic head
// failed to load), so they are fetched only then: that keeps ~150 KB out of every visitor's offline download.
const CLASSIC_HEAD = { eye: 'golfer-eye.jpg', cap: 'golfer-cap.jpg', capN: 'golfer-cap-n.jpg', hair: 'golfer-hair.png' };
function loadClassicHead(base) {
  return Promise.all(Object.entries(CLASSIC_HEAD).map(([k, f]) => texL(base + f).then(t => [k, t]))).then(list => {
    for (const [k, t] of list) { if (!t) continue; TEX[k] = t;
      if (k === 'eye' || k === 'hair') { t.encoding = T.sRGBEncoding; t.anisotropy = 4; }
      if (k === 'cap') { t.encoding = T.sRGBEncoding; t.flipY = false; t.anisotropy = 4; } if (k === 'capN') t.flipY = false; }
  });
}
function loadClassic(base) {
  return Promise.all([
    fetch(base + 'golfer-mesh.wasm').then(r => { if (!r.ok) throw new Error('golfer ' + r.status); return r.arrayBuffer(); }),
    new Promise((ok, no) => new T.TextureLoader().load(base + 'golfer-skin.jpg', ok, undefined, no)),
    new Promise(ok => new T.TextureLoader().load(base + 'golfer-shoe.jpg', ok, undefined, () => ok(null))),
    new Promise(ok => new T.TextureLoader().load(base + 'golfer-shoe-n.jpg', ok, undefined, () => ok(null))),
    ...['pique', 'twill', 'pores'].map(n => new Promise(ok => new T.TextureLoader().load(base + 'golfer-' + n + '.jpg', t => { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; ok(t); }, undefined, () => ok(null)))),
  ]).then(([buf, skin, shoe, shoeN, pique, twill, pores]) => { skin.encoding = T.sRGBEncoding; skin.flipY = true; skin.anisotropy = 4;
    if (shoe) { shoe.encoding = T.sRGBEncoding; shoe.flipY = false; shoe.anisotropy = 4; } if (shoeN) shoeN.flipY = false;
    TEX = { skin, eye: null, shoe, shoeN, cap: null, capN: null, hair: null, pique, twill, pores }; DATA = parse(buf); return DATA; });
}
// The drill golfer is the classic figure's body and clothes (polo, trousers, belt, shoes, glove) with the Rocketbox
// head and neck: a real face and hair on the familiar outfit. The cap is left off: refitted to the new head it hid the
// face. ?golfer=classic shows the old head and cap.
let RB = null, DONE = false;   // DONE: both figures settled (the classic one alone must not count as ready, or a
// drill opened while the head is still downloading would keep the old head)
function load(base) {
  if (DATA && DONE) return Promise.resolve(DATA);
  if (LOADING) return LOADING;
  base = base || '';
  // golfer-*.wasm files are not WebAssembly: they're the golfer's binary mesh, named .wasm so every host serves them as binary
  let classic = false; try { classic = /[?&]golfer=classic\b/.test(root.location.search); } catch (e) {}
  LOADING = Promise.all([loadClassic(base), classic ? null : loadRB(base).catch(e => { console.warn('realistic head unavailable, using the classic figure', e); return null; })])
    .then(([d, rb]) => (rb ? Promise.resolve() : loadClassicHead(base)).then(() => { RB = rb; DONE = true; return d; }))
    .catch(e => { LOADING = null; throw e; });
  return LOADING;
}
// a copy of a mesh's geometry keeping only some triangles (by material and body part), with groups rebuilt
function subGeo(D, keep) {
  const g = D.geo, idx = g.index.array, part = g.attributes.part.array, meta = D.meta, out = [], groups = [];
  meta.groups.forEach((gr, gi) => { const st = out.length;
    for (let i = gr.start; i < gr.start + gr.count; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      if (keep(gr.mat, [part[a], part[b], part[c]])) out.push(a, b, c); }
    if (out.length > st) groups.push({ start: st, count: out.length - st, gi }); });
  const ng = new T.BufferGeometry(); for (const k in g.attributes) ng.setAttribute(k, g.attributes[k]);
  ng.setIndex(new T.BufferAttribute(out.length > 65535 * 3 || meta.i32 ? new Uint32Array(out) : new Uint16Array(out), 1));
  groups.forEach((x, i) => ng.addGroup(x.start, x.count, x.gi)); ng.boundingSphere = g.boundingSphere;
  return ng;
}
const HEADP = [3, 10];   // body parts: head, neck

// ---------- materials ----------
// every material gets: baked ambient occlusion, and a pulsing green glow on highlighted body parts
function patch(m, opt) {
  m.userData.hl = { value: 0 }; m.userData.hlB = { value: Array.from({ length: 16 }, () => new T.Vector4()) }; m.userData.pulse = { value: 0 }; m.userData.ghost = !!opt.ghost;
  const det = opt.detail && opt.detail.tex ? opt.detail : null;
  if (det) { m.extensions = { derivatives: true }; if (!m.map && !m.normalMap) m.defines = Object.assign(m.defines || {}, { USE_UV: '' }); }
  m.onBeforeCompile = sh => {
    if (det) {
      sh.uniforms.detN = { value: det.tex }; sh.uniforms.detK = { value: det.k }; sh.uniforms.detS = { value: det.s };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D detN; uniform float detK; uniform float detS;\n' +
        // micro detail (knit, twill, pores) from a tiled normal map, with a tangent frame from screen derivatives
        'vec3 ccDetail(vec3 p, vec3 n, vec2 uv){ vec3 q0 = dFdx(p), q1 = dFdy(p); vec2 s0 = dFdx(uv), s1 = dFdy(uv); vec3 q1p = cross(q1, n), q0p = cross(n, q0); vec3 Tn = q1p * s0.x + q0p * s1.x; vec3 Bn = q1p * s0.y + q0p * s1.y; float d = max(dot(Tn, Tn), dot(Bn, Bn)); if (d <= 0.0) return n; float sc = inversesqrt(d); vec3 mN = texture2D(detN, uv).xyz * 2.0 - 1.0; mN.xy *= detS; return normalize(Tn * (mN.x * sc) + Bn * (mN.y * sc) + n * mN.z); }')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = ccDetail(-vViewPosition, normal, vUv * detK);');
    }
    sh.uniforms.hlMask = m.userData.hl; sh.uniforms.hlPulse = m.userData.pulse;
    sh.uniforms.hlB = m.userData.hlB;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float ao; varying float vAO; varying float vHL; uniform vec4 hlB[16];\nfloat hlPick(float f){ int i = int(f + 0.5); vec4 v = hlB[i / 4]; int c = i - (i / 4) * 4; return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAO = ao;\n#ifdef USE_SKINNING\nvHL = skinWeight.x * hlPick(skinIndex.x) + skinWeight.y * hlPick(skinIndex.y) + skinWeight.z * hlPick(skinIndex.z) + skinWeight.w * hlPick(skinIndex.w);\n#else\nvHL = 0.0;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAO; varying float vHL; uniform float hlPulse;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nfloat bao = mix(1.0, vAO, ' + (opt.aoK || 0.85).toFixed(2) + '); reflectedLight.indirectDiffuse *= bao; reflectedLight.directDiffuse *= mix(1.0, bao, 0.45); reflectedLight.indirectSpecular *= bao;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat rimK = pow(1.0 - clamp(dot(normalize(vViewPosition), -normal) * -1.0 + 0.0, 0.0, 1.0), 2.0); float hv = smoothstep(0.15, 0.85, vHL); totalEmissiveRadiance += hv * vec3(0.10, 0.80, 0.42) * hlPulse * (0.12 + 1.9 * rimK); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.66, 0.40), hv * 0.10 * hlPulse);');
    if (opt.sss) sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' +
      // a soft red bleed where light falls off (cheap subsurface look)
      'reflectedLight.directDiffuse += diffuseColor.rgb * vec3(0.20, 0.05, 0.03) * clamp(1.0 - abs(dot(normal, normalize(vec3(0.3, 0.8, 0.5)))), 0.0, 1.0) * 0.6;');
  };
  m.customProgramCacheKey = () => 'ccg' + (opt.sss ? 's' : '') + (det ? 'd' : '') + (opt.aoK || 0.85);
  return m;
}
function materials(ghost) {
  if (ghost) { const g = patch(new T.MeshStandardMaterial({ color: 0xff3b2b, emissive: 0x8a1408, transparent: true, opacity: 0.45, roughness: 0.6, depthWrite: false, skinning: true }), { ghost: true, aoK: 0.3 }); g.color.convertSRGBToLinear(); return () => g; }
  const P = (o, x) => { const m = new T.MeshPhysicalMaterial(Object.assign({ skinning: true }, o)); if (o.color !== undefined) m.color.convertSRGBToLinear(); if (o.sheen) m.sheen.convertSRGBToLinear(); return patch(m, x || {}); };
  if (DATA.meta.kind === 'rb') {
    const N = (t, k) => t ? { normalMap: t, normalScale: new T.Vector2(k, k) } : {};
    const R = {
      rbBody: P(Object.assign({ map: TEX.body, roughness: 0.78, sheen: new T.Color(0x2a2a2a) }, N(TEX.bodyN, 0.9)), { aoK: 0.85 }),
      rbHead: P(Object.assign({ map: TEX.head, roughness: 0.52, clearcoat: 0.08, clearcoatRoughness: 0.5, sheen: new T.Color(0x3a1d14) }, N(TEX.headN, 0.8)), { sss: true, aoK: 0.9 }),
      // hair cards: matte (the cards' normals don't follow the hair, so any shine shows up as silver streaks)
      rbHair: P({ map: TEX.hair, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.9, envMapIntensity: 0.25, metalness: 0, reflectivity: 0.1 }, { aoK: 0.9 }),
    };
    return k => R[k] || R.rbBody;
  }
  const M = {
    skin: P({ map: TEX.skin, roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.45, sheen: new T.Color(0x3a1d14) }, { sss: true, aoK: 0.9, detail: { tex: TEX.pores, k: 46, s: 0.28 } }),
    shirt: P({ color: 0x23395a, roughness: 0.88, sheen: new T.Color(0x3a5070) }, { detail: { tex: TEX.pique, k: 90, s: 0.6 } }),
    trousers: P({ color: 0x34383f, roughness: 0.8, sheen: new T.Color(0x2b2f36) }, { detail: { tex: TEX.twill, k: 70, s: 0.45 } }),
    belt: P({ color: 0x2a1a12, roughness: 0.45, clearcoat: 0.3 }),
    shoe: P(Object.assign({ color: 0xffffff, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }, TEX.shoe ? { map: TEX.shoe } : { color: 0xf2f1ec }, TEX.shoeN ? { normalMap: TEX.shoeN, normalScale: new T.Vector2(0.8, 0.8) } : {})),
    sole: P({ color: 0x2b2d31, roughness: 0.75 }),
    mid: P({ color: 0xe9e7e0, roughness: 0.55 }),
    shoeacc: P({ color: 0x1d2c44, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.35 }),
    hair1: P({ map: TEX.hair, alphaTest: 0.12, visible: !!TEX.hair, roughness: 0.62, sheen: new T.Color(0x3a2c22) }, { aoK: 0.9 }),
    hair2: P({ map: TEX.hair, alphaTest: 0.32, visible: !!TEX.hair, roughness: 0.62, sheen: new T.Color(0x3a2c22) }, { aoK: 0.9 }),
    hair3: P({ map: TEX.hair, alphaTest: 0.52, visible: !!TEX.hair, roughness: 0.62, sheen: new T.Color(0x3a2c22) }, { aoK: 0.9 }),
    hair4: P({ map: TEX.hair, alphaTest: 0.72, visible: !!TEX.hair, roughness: 0.62, sheen: new T.Color(0x3a2c22) }, { aoK: 0.9 }),
    cuff: P({ color: 0x1f3352, roughness: 0.9, sheen: new T.Color(0x3a5070) }, { detail: { tex: TEX.twill, k: 6, s: 0.8 } }),
    buckle: P({ color: 0xc9c6bf, metalness: 1, roughness: 0.28 }, { aoK: 0.5 }),
    button: P({ color: 0xf3f0e8, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    lace: P({ color: 0xf4f4f0, roughness: 0.8, side: T.DoubleSide }),
    sock: P({ color: 0x1f2329, roughness: 0.9, sheen: new T.Color(0x30343c) }),
    glove: P({ color: 0xf7f7f3, roughness: 0.62, sheen: new T.Color(0x666666) }),
    cap: P(Object.assign({ color: 0xffffff, roughness: 0.82, sheen: new T.Color(0x22324e) }, TEX.cap ? { map: TEX.cap } : { color: 0x15233a }, TEX.capN ? { normalMap: TEX.capN, normalScale: new T.Vector2(0.7, 0.7) } : {})),
    cornea: P({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.0, depthWrite: false }, { aoK: 0.0 }),
    eye: P({ map: TEX.eye || null, color: TEX.eye ? 0xffffff : 0xe8e4de, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }, { aoK: 0.4 }),
  };
  return k => M[k] || M.skin;
}

// ---------- figure ----------
function make(ghost) {
  const body = make1(ghost, RB && !ghost ? (mat, ps) => !(['hair1', 'hair2', 'hair3', 'hair4', 'eye', 'cornea', 'cap'].includes(mat) || (mat === 'skin' && ps.every(p => p === 3))) : null);
  if (!RB || ghost) return body;
  // the Rocketbox head, posed by the same skeleton (its own rest pose and neck length)
  const keepD = DATA, keepT = TEX; DATA = RB.D; TEX = RB.TX;
  // face and neck only: the avatar's body texture is its own striped shirt. Its hair is left to the head texture
  // (short hair painted on the scalp): the alpha-tested hair cards showed as black streaks with a pale patch between
  // them on the crown, which read as a bald spot.
  let head; try { head = make1(false, (mat, ps) => mat !== 'rbBody' && mat !== 'rbHair' && ps.some(p => HEADP.includes(p))); } finally { DATA = keepD; TEX = keepT; }
  const G = new T.Group(); G.add(body.mesh); G.add(head.mesh);
  const fig = { G, mesh: body.mesh, bones: body.bones, meta: body.meta, ghost: false, mats: body.mats.concat(head.mats), parts: [body, head],
    pose: (J, o) => { body.pose(J, o); head.pose(J, o); fig.elbows = body.elbows; },
    highlight: (parts, t) => { body.highlight(parts, t); head.highlight(parts, t); } };
  return fig;
}
function make1(ghost, keep) {
  const D = DATA, meta = D.meta;
  const bones = meta.bones.map(b => { const o = new T.Bone(); o.name = b.n; o.matrixAutoUpdate = false; return o; });
  const inv = meta.bones.map(b => new T.Matrix4().makeTranslation(-b.h[0], -b.h[1], -b.h[2]));
  const mat = materials(ghost), mats = meta.groups.map(g => mat(g.mat));
  const mesh = new T.SkinnedMesh(keep ? subGeo(D, keep) : D.geo, mats);
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
  const v4 = Array.from({ length: 16 }, (_, k) => new T.Vector4(arr[k * 4], arr[k * 4 + 1], arr[k * 4 + 2], arr[k * 4 + 3]));
  for (const m of new Set(fig.mats)) { m.userData.hlB.value = v4; m.userData.pulse.value = any ? 0.55 + 0.25 * Math.sin((t || 0) * 5) : 0; }
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
  const mid = H.clone().multiplyScalar(0.4).add(Lt.clone().multiplyScalar(0.6)).normalize();   // the lower back twists part way toward the shoulders
  setBone(fig, 'hips', pel, pTop, H, X);
  setBone(fig, 'spine', pTop, spTail, mid, X);
  const chM = setBone(fig, 'chest', spTail, neckP, Lt, X).clone();
  // head: centre at J.head, face looking along J.face
  // head: looks along J.face, but only as far as a neck allows. Measured against the chest, the old head turned up to
  // 104 degrees at the top of the swing and 93 the other way after impact (a neck manages about 70-80), then whipped
  // back in two frames. Past ~50 degrees of turn the head now starts to go with the shoulders, as a golfer's does,
  // and it tilts partly with the spine instead of staying dead level.
  const cR = new T.Matrix4().extractRotation(chM), cs = X.clone().transformDirection(cR), cu = Yv.clone().transformDirection(cR), cf = Z.clone().transformDirection(cR);
  const f0 = A(J.face).normalize(), knee = (v, a, m) => { const u = Math.abs(v); return u <= a ? v : Math.sign(v) * (a + (m - a) * Math.tanh((u - a) / (m - a))); };
  const yaw = knee(Math.atan2(f0.dot(cs), f0.dot(cf)), 70 * D2R, 95 * D2R), pit = Math.max(-58 * D2R, Math.min(35 * D2R, Math.asin(Math.max(-1, Math.min(1, f0.dot(cu))))));
  const fz = cs.clone().multiplyScalar(Math.sin(yaw) * Math.cos(pit)).addScaledVector(cf, Math.cos(yaw) * Math.cos(pit)).addScaledVector(cu, Math.sin(pit)).normalize();
  const hup = Yv.clone().multiplyScalar(0.6).addScaledVector(cu, 0.4).normalize();
  const fx = new T.Vector3().crossVectors(hup, fz).normalize(), fy = new T.Vector3().crossVectors(fz, fx).normalize();
  const hC = A(fig.meta.headC), hd = mb('head');
  const R = new T.Matrix4().makeBasis(fx, fy, fz);
  // the neck keeps its own length: the skull sits one neck-length from the base of the neck, along the neck as it
  // would bend between the chest and the head (placing the head's centre exactly on J.head stretched the neck by half)
  const restNeck = nk.T.clone().sub(nk.H), Lnk = restNeck.length();
  const nDir = restNeck.clone().normalize().transformDirection(R).add(restNeck.clone().normalize().transformDirection(chM)).normalize();
  const skull = neckP.clone().addScaledVector(nDir, Lnk);
  // the head bone's own matrix is world*restInverse: world(p) = R (p - restHead) + skull
  const hM = R.clone(); hM.setPosition(skull);
  setBoneM(fig, 'head', hM);
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
    // which way the elbow points. With a nearly straight arm the rig's elbow sits only 3-4 cm off the shoulder-wrist
    // line, so its direction is noise: the arm rolled half a turn in a frame as the elbow began to bend or straighten.
    // A steady guess is mixed in (elbows point down the spine and back toward the body); it decides when the arm is
    // near straight and fades out as the real bend grows.
    const prior = A(J.s).multiplyScalar(-0.7).addScaledVector(F, -0.7);
    let pole = rigEl.clone().sub(shV).projectOnPlane(dW).addScaledVector(prior.projectOnPlane(dW), 0.06);
    if (pole.lengthSq() < 1e-8) pole = new T.Vector3(0, -1, -0.3); pole.normalize();
    // soft elbows: a real arm is never locked dead straight, so near full reach the arm keeps a slight bend and the
    // bones stretch a touch (at most ~3%) rather than snapping straight
    const kS = Math.max(1, Lw / ((Lu + Lf) * 0.988)), Lu2 = Lu * kS, Lf2 = Lf * kS;
    const reach = Math.min(Lw, (Lu2 + Lf2) * 0.999), along = (Lu2 * Lu2 - Lf2 * Lf2 + reach * reach) / (2 * reach), hgt = Math.sqrt(Math.max(0, Lu2 * Lu2 - along * along));
    const elV = shV.clone().addScaledVector(dW, along * Lw / reach).addScaledVector(pole, hgt);
    const du = elV.clone().sub(shV), df = wrist.clone().sub(elV);
    let n = new T.Vector3().crossVectors(du, df); if (n.lengthSq() < 1e-8) n = new T.Vector3().crossVectors(du, pole).negate(); n.normalize();
    setBone(fig, 'uarm' + S, shV, elV, n, n0);
    const mid2 = elV.clone().lerp(wrist, fa.T.distanceTo(fa.H) / Lf);
    setBone(fig, 'farm' + S, elV, mid2, n, n0);
    const handSideW = hf.side0.clone().transformDirection(Mh);
    // the forearm's twist bone takes half the hand's turn against the elbow. Halving by averaging the two directions
    // flipped it half a turn whenever that turn passed 180 degrees (it does for a frame or two as the club releases),
    // which wrapped the forearm like a sweet paper. The half-angle now fades to nothing as the turn nears 180, so it
    // stays continuous on both sides.
    const fax = df.clone().normalize(), hs = handSideW.clone().projectOnPlane(fax).normalize(), n1 = n.clone().projectOnPlane(fax).normalize();
    const aTw = Math.atan2(fax.dot(new T.Vector3().crossVectors(n1, hs)), n1.dot(hs)), wTw = Math.min(1, Math.max(0, (Math.PI - Math.abs(aTw)) / (Math.PI / 3)));
    const twist = n1.clone().applyAxisAngle(fax, aTw * 0.5 * wTw);
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
    const toeV = A(toe); let fdir = toeV.clone().sub(anV);
    const f0 = ft.T.clone().sub(ft.H), fs0 = new T.Vector3().crossVectors(Yv, f0).normalize();
    // heel up, toes down: a foot that's meant to be on the ground pivots on its toes (they stay at their rest height)
    // instead of tipping forward into the air. A foot lifted off the ground (stepping drills) is left as the rig says.
    const toeY = ft.T.y, footL = f0.length(), lift = anV.y - toeY;
    if (toeV.y < 0.12 && lift > -0.0 && fdir.y < 0) {
      const hz = new T.Vector3(fdir.x, 0, fdir.z); if (hz.lengthSq() < 1e-8) hz.set(0, 0, 1); hz.normalize();
      const dy = Math.min(lift, footL * 0.97), dh = Math.sqrt(Math.max(0, footL * footL - dy * dy));
      fdir = hz.multiplyScalar(dh).add(new T.Vector3(0, -dy, 0));
    }
    const fs = new T.Vector3().crossVectors(Yv, fdir).normalize();
    setBone(fig, 'foot' + S, anV, anV.clone().add(fdir.normalize().multiplyScalar(f0.length())), fs, fs0, false);
  }
  // where the elbows really are (the mesh's own arm lengths), so labels can point at them
  const eL = new T.Vector3().setFromMatrixPosition(fig.bones[fig.meta.bi.farmL].matrix), eR = new T.Vector3().setFromMatrixPosition(fig.bones[fig.meta.bi.farmR].matrix);
  fig.elbows = { L: [eL.x, eL.y, eL.z], R: [eR.x, eR.y, eR.z] };
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
const GRIP = { ew: 1, sw: 1, up: 0.5 };   // how much the elbow, the shoulder and the chest each say about which side of the shaft the wrist sits
function handFrame(J, S, lead, fig) {
  const hr = handRest(fig, S);
  const hp = A(lead ? J.lh : J.th), el = A(lead ? J.le : J.te), fore = hp.clone().sub(el).normalize();
  const gripping = J.club && J.sd && !(J.arms === 'lead' && !lead) && !(J.arms === 'trailonly' && lead) && !(J.tdrop > 0.5 && !lead);
  let Rw, pLocal, pWorld, curl, thumb;
  if (gripping) {
    const sd = A(J.sd).normalize();
    // local: the shaft lies in the tunnel the curled fingers make (gripLine), club head toward the index finger
    const gl = gripLine(fig, S), sdL = gl.dir; pLocal = gl.mid.clone();
    const uL = hr.wr.clone().sub(pLocal).projectOnPlane(sdL).normalize();
    // world: the hand turns about the shaft until its wrist is on the side its own elbow is, so the forearm runs
    // straight into the hand, the way a real grip works. (Setting the palms from the swing plane, or from a fixed side,
    // bent the wrists 85-105 degrees and left the shaft outside the fingers.)
    // "Its own elbow" alone is not steady: in the swing data the forearm ends on the shaft itself, so as the wrists hinge
    // the forearm passes through the line of the shaft and the elbow's side flips, spinning the hand half a turn in two
    // frames. The shoulder is further off the shaft's line, and the chest sits off both arms' lines, which steadies the moment after impact
    // when the club passes the arms, so the side is taken from all three together.
    const sh = A(lead ? J.ls : J.ts);
    let e1 = el.clone().sub(hp).multiplyScalar(GRIP.ew).add(sh.sub(hp).multiplyScalar(GRIP.sw)).addScaledVector(A(J.chest || J.neck).sub(hp).normalize(), GRIP.up).projectOnPlane(sd);
    if (e1.lengthSq() < 1e-6) e1 = new T.Vector3(0, 1, 0).projectOnPlane(sd);
    e1.normalize();
    // the swing data already says where each wrist sits off the shaft (lw / tw, placed with the same rule): turn the hand
    // to that exact side, so the forearm meets the hand where the arm was solved and the shaft stays in the fingers
    const wj = lead ? J.lw : J.tw;
    if (wj) { const w1 = A(wj).sub(hp).projectOnPlane(sd), r = w1.length(); if (r > 0.05 && r < 0.16 && w1.dot(e1) > 0.5 * r) e1 = w1.normalize(); }
    const L = new T.Matrix4().makeBasis(sdL, uL, new T.Vector3().crossVectors(sdL, uL));
    const Wd = new T.Matrix4().makeBasis(sd, e1, new T.Vector3().crossVectors(sd, e1));
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
function curlRot(fig, hr, S, f, j, curl, thumb) {   // the turn of finger f's joint j, in the hand's rest space
  const b = fig.meta.bones[fig.meta.bi['f' + f + j + S]], bd = b.T.clone().sub(b.H).normalize();
  const ax = f === 1 ? new T.Vector3().crossVectors(bd, hr.palm).normalize() : hr.across.clone();
  const ang = (f === 1 ? CURL.t[j - 1] * thumb : CURL.f[j - 1] * curl * (1 + (f - 2) * 0.06)) * CURL.sign[S] * (f === 1 ? CURL.ts[S] : 1);
  return new T.Matrix4().makeTranslation(b.H.x, b.H.y, b.H.z).multiply(new T.Matrix4().makeRotationAxis(ax, ang)).multiply(new T.Matrix4().makeTranslation(-b.H.x, -b.H.y, -b.H.z));
}
function fingers(fig, S, Mh, curl, thumb) {
  const hr = handRest(fig, S);
  for (let f = 1; f <= 5; f++) {
    let acc = Mh.clone();
    for (let j = 1; j <= 3; j++) {
      const b = fig.meta.bones[fig.meta.bi['f' + f + j + S]];
      acc = acc.multiply(curlRot(fig, hr, S, f, j, curl, thumb));
      fig.bones[fig.meta.bi['f' + f + j + S]].matrix.copy(acc.clone().multiply(new T.Matrix4().makeTranslation(b.H.x, b.H.y, b.H.z)));
    }
  }
}
// Where a shaft sits in a closed hand, in the hand's rest space: for the index and little fingers, the centre of the
// circle through the knuckle and the two finger joints once the finger is curled. The shaft runs through both centres.
function circum(a, b, c) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a), n = new T.Vector3().crossVectors(ab, ac), d = 2 * n.lengthSq();
  if (d < 1e-12) return a.clone().add(c).multiplyScalar(0.5);
  const t = new T.Vector3().crossVectors(n, ab).multiplyScalar(ac.lengthSq()).add(new T.Vector3().crossVectors(ac, n).multiplyScalar(ab.lengthSq())).multiplyScalar(1 / d);
  return a.clone().add(t);
}
function gripLine(fig, S) {
  const m = fig.meta; if (m['gl' + S]) return m['gl' + S];
  const hr = handRest(fig, S), cs = [], rs = [];
  for (const f of [2, 5]) {
    let acc = new T.Matrix4(); const P = [];
    for (let j = 1; j <= 3; j++) { const b = m.bones[m.bi['f' + f + j + S]]; P.push(b.H.clone().applyMatrix4(acc)); acc = acc.multiply(curlRot(fig, hr, S, f, j, 1, 0)); if (j === 3) P.push(b.T.clone().applyMatrix4(acc)); }
    const c = circum(P[0], P[1], P[2]); cs.push(c); rs.push(c.distanceTo(P[0]));
  }
  const dir = cs[0].clone().sub(cs[1]).normalize(), mid = cs[0].clone().add(cs[1]).multiplyScalar(0.5);
  return (m['gl' + S] = { dir, mid, r: rs });
}
root.CCGolfer = { load, make, ready: () => !!DATA && DONE, restPose, GRIP, CURL, _fingers: fingers, _handRest: handRest, _gripLine: gripLine };
})(typeof window !== 'undefined' ? window : this);
