# Build the drill golfer from a Microsoft Rocketbox avatar (MIT licence) instead of the MakeHuman body.
# The avatar is re-skinned onto the app's own skeleton (hips, spine, chest, neck, head, clav/uarm/farm/ftw/hand,
# 15 finger bones, thigh/shin/foot per side), so golfer.js poses it exactly like the old figure.
#
#   pip install bpy numpy pillow
#   git clone --depth 1 --filter=blob:none --sparse https://github.com/microsoft/Microsoft-Rocketbox.git rb
#   (sparse-checkout Assets/Avatars/Adults/Male_Adult_01)
#   python3 build_rb.py rb/Assets/Avatars/Adults/Male_Adult_01 out/
# Writes out/golfer-rb.wasm (CCG1 binary mesh, not WebAssembly) and out/golfer-rb-*.jpg/png textures.
import bpy, sys, os, json, struct, math
import numpy as np
from PIL import Image
from mathutils import Vector
from mathutils.bvhtree import BVHTree

src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
name = os.path.basename(src.rstrip('/'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(src, 'Export', name + '.fbx'), automatic_bone_orientation=True)
AR = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; ME = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == AR][0]
MW = AR.matrix_world
def tj(v): v = MW @ v; return np.array([v.x, v.z, -v.y])          # Blender (z up, faces -y) -> three.js (y up, faces +z)
H = {b.name[6:]: tj(b.head_local) for b in AR.data.bones}            # 'Bip01 L Hand' -> 'L Hand'
T = {b.name[6:]: tj(b.tail_local) for b in AR.data.bones}

# ---------- the app skeleton, placed on the avatar ----------
bones = []
def add(n, h, t): bones.append({'n': n, 'h': [round(float(x), 5) for x in h], 't': [round(float(x), 5) for x in t]})
add('hips', H['Pelvis'], H['Spine']); add('spine', H['Spine'], H['Spine2']); add('chest', H['Spine2'], H['Neck'])
add('neck', H['Neck'], H['Head'])
top = max((ME.matrix_world @ v.co).z for v in ME.data.vertices)
add('head', H['Head'], H['Head'] + np.array([0, top - H['Head'][1], 0]))
ANKLE_Y = 0.0735          # the drill rig's ankle height: the foot bone sits here so the soles land on the ground
for S, s in (('L', 'L'), ('R', 'R')):
    add('clav' + S, H[s + ' Clavicle'], H[s + ' UpperArm']); add('uarm' + S, H[s + ' UpperArm'], H[s + ' Forearm'])
    el, wr = H[s + ' Forearm'], H[s + ' Hand']; mid = (el + wr) / 2
    add('farm' + S, el, mid); add('ftw' + S, mid, wr)
    kn = [H[s + ' Finger%d' % f] for f in (1, 2, 3, 4)]; add('hand' + S, wr, sum(kn) / 4)
    for f, rb in enumerate(('0', '1', '2', '3', '4'), 1):          # f1 = thumb .. f5 = little finger
        segs = ['Finger' + rb, 'Finger' + rb + ('1' if rb != '0' else '1'), 'Finger' + rb + '2']
        segs = [s + ' ' + x for x in segs]
        for j, sg in enumerate(segs, 1):
            add('f%d%d%s' % (f, j, S), H[sg], T[sg])
    hip, knee = H[s + ' Thigh'], H[s + ' Calf']
    ank = H[s + ' Foot'].copy(); ank[1] = ANKLE_Y
    toe = T[s + ' Foot'].copy(); fwd = np.array([toe[0] - ank[0], 0, toe[2] - ank[2]]); fwd /= np.linalg.norm(fwd)
    add('thigh' + S, hip, knee); add('shin' + S, knee, ank)
    add('foot' + S, ank, ank + fwd * 0.145 + np.array([0, -0.047, 0]))   # same rest slope as the old figure's foot
bi = {b['n']: i for i, b in enumerate(bones)}
print('thumb check', [b['n'] for b in bones if b['n'].startswith('f1')][:3])

# ---------- weights: each avatar bone feeds one app bone (the forearm splits into elbow and twist halves) ----------
def target(rb):
    r = rb[6:]
    if r == 'Pelvis': return 'hips'
    if r in ('Spine', 'Spine1'): return 'spine'
    if r == 'Spine2': return 'chest'
    if r == 'Neck': return 'neck'
    if r[:2] in ('L ', 'R '):
        S, p = r[0], r[2:]
        m = {'Clavicle': 'clav', 'UpperArm': 'uarm', 'Hand': 'hand', 'Thigh': 'thigh', 'Calf': 'shin', 'Foot': 'foot', 'Toe0': 'foot'}
        if p in m: return m[p] + S
        if p == 'Forearm': return 'FOREARM' + S
        if p.startswith('Finger'):
            d = p[6:]; f = int(d[0]) + 1; j = 1 if len(d) == 1 else int(d[1]) + 1
            return 'f%d%d%s' % (f, j, S)
    return 'head'   # head, eyes, jaw and the face bones
dg = bpy.context.evaluated_depsgraph_get()
me = ME.data; nvo = len(me.vertices)
Wv = np.zeros((nvo, len(bones)), np.float32)
P = np.array([tj(ME.matrix_world @ v.co) for v in me.vertices]) if False else None
Pw = np.array([[*(lambda w: (w.x, w.z, -w.y))(ME.matrix_world @ v.co)] for v in me.vertices], np.float64)
for vi, v in enumerate(me.vertices):
    for g in v.groups:
        if g.weight <= 0: continue
        t = target(ME.vertex_groups[g.group].name)
        if t.startswith('FOREARM'):
            S = t[-1]; a, b = np.array(bones[bi['farm' + S]]['h']), np.array(bones[bi['ftw' + S]]['t'])
            u = np.clip(np.dot(Pw[vi] - a, b - a) / np.dot(b - a, b - a), 0, 1); k = np.clip((u - 0.3) / 0.4, 0, 1)
            Wv[vi, bi['farm' + S]] += g.weight * (1 - k); Wv[vi, bi['ftw' + S]] += g.weight * k
        else: Wv[vi, bi[t]] += g.weight
top4 = np.argsort(-Wv, 1)[:, :4]; w4 = np.take_along_axis(Wv, top4, 1); w4 /= np.maximum(w4.sum(1, keepdims=True), 1e-6)
q = np.round(w4 * 255).astype(np.int32); q[:, 0] += 255 - q.sum(1)

# ---------- ambient occlusion per vertex (rays against the avatar itself, rest pose) ----------
bvh = BVHTree.FromObject(ME, dg)
rng = np.random.default_rng(3); dirs = rng.normal(size=(48, 3)); dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
me.calc_loop_triangles() if hasattr(me, 'calc_loop_triangles') else None
ao = np.ones(nvo)
for vi, v in enumerate(me.vertices):
    co = ME.matrix_world @ v.co; n = (ME.matrix_world.to_3x3() @ v.normal).normalized(); hit = 0; tot = 0
    for d in dirs:
        d = Vector(d)
        if d.dot(n) < 0: d = -d
        tot += 1; r = bvh.ray_cast(co + n * 0.002, d, 0.25)
        if r[0] is not None: hit += 1
    ao[vi] = 1 - hit / tot
ao = np.clip(0.35 + 0.65 * ao, 0, 1)

# ---------- split vertices on uv seams; per-material index groups ----------
li = np.zeros(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', li)
uv = np.zeros(len(me.loops) * 2, np.float32); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
nr = np.array([tuple(l.normal) for l in me.loops]) if hasattr(me.loops[0], 'normal') else None
cn = np.zeros(len(me.loops) * 3, np.float32)
try: me.corner_normals.foreach_get('vector', cn); cn = cn.reshape(-1, 3)
except Exception: cn = np.array([tuple(me.vertices[i].normal) for i in li], np.float32)
key = np.concatenate([li[:, None].astype(np.float64), np.round(uv * 1e5), np.round(cn * 100)], 1)
uk, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
src_v = li[first]; nv = len(first)
mw3 = np.array(ME.matrix_world.to_3x3().normalized())
def tjd(a): return np.stack([a[:, 0], a[:, 2], -a[:, 1]], 1)
pos = Pw[src_v].astype(np.float32); nrm = tjd(cn[first] @ mw3.T); nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-6)
uvs = uv[first]
tris = []; tmat = []
for p in me.polygons:
    ls = list(range(p.loop_start, p.loop_start + p.loop_total))
    for k in range(1, len(ls) - 1): tris.append([inv[ls[0]], inv[ls[k]], inv[ls[k + 1]]]); tmat.append(p.material_index)
tris = np.array(tris, np.int64); tmat = np.array(tmat)
# winding: Blender's axis swap (x, z, -y) is a rotation, so the face order is kept
mats = ['rbBody', 'rbHead', 'rbHair']
order = np.argsort(tmat, kind='stable'); tris = tris[order]; tmat = tmat[order]
groups = []
for mi in range(len(mats)):
    c = int((tmat == mi).sum()); s = int(np.argmax(tmat == mi)) * 3 if c else 0
    if c: groups.append({'mat': mats[mi], 'start': s, 'count': c * 3})

# ---------- body part per vertex (for the drill's highlight glow) ----------
parts = {'hips': 1, 'chest': 2, 'head': 3, 'leadarm': 4, 'trailarm': 5, 'leadleg': 6, 'trailleg': 7, 'leadfoot': 8, 'trailfoot': 9, 'neck': 10, 'leadhand': 11, 'trailhand': 12}
def part(bn):
    if bn in ('hips', 'spine'): return 1
    if bn in ('chest', 'clavL', 'clavR'): return 2
    if bn == 'head': return 3
    if bn == 'neck': return 10
    S = bn[-1]
    if bn[:-1] in ('uarm', 'farm', 'ftw'): return 4 if S == 'L' else 5
    if bn[:-1] == 'hand' or bn[0] == 'f' and bn[1].isdigit(): return 11 if S == 'L' else 12
    if bn[:-1] in ('thigh', 'shin'): return 6 if S == 'L' else 7
    if bn[:-1] == 'foot': return 8 if S == 'L' else 9
    return 0
ptv = np.array([part(bones[top4[v, 0]]['n']) for v in range(nvo)], np.uint8)

# ---------- textures: 1024 px JPEG colour and normal maps, PNG for the alpha-tested hair and lashes ----------
tdir = os.path.join(src, 'Textures'); tag = 'golfer-rb-'
pref = [f for f in os.listdir(tdir) if f.endswith('_body_color.tga')][0].split('_body_')[0]
def tex(part_, kind, size=1024, png=False):
    im = Image.open(os.path.join(tdir, f'{pref}_{part_}_{kind}.tga'))
    im = im.convert('RGBA' if png else 'RGB').resize((size, size), Image.LANCZOS)
    fn = f'{tag}{part_}-{kind[0]}.' + ('png' if png else 'jpg')
    im.save(os.path.join(out, fn), **({'optimize': True} if png else {'quality': 86, 'optimize': True})); return fn
texs = {'body': tex('body', 'color'), 'bodyN': tex('body', 'normal'), 'head': tex('head', 'color'), 'headN': tex('head', 'normal'),
        'hair': tex('opacity', 'color', 512, True)}

# ---------- write CCG1 ----------
skin_i = top4[src_v].astype(np.uint8); skin_w = q[src_v].astype(np.uint8)
meta = {'v': 1, 'kind': 'rb', 'nv': int(nv), 'ni': int(tris.size), 'i32': bool(nv > 65535), 'groups': groups, 'parts': parts, 'bones': bones,
        'headC': [round(float(x), 5) for x in (H['Head'] + np.array([0, 0.09, 0.02]))], 'eyes': [[round(float(x), 5) for x in H['LEye']], [round(float(x), 5) for x in H['REye']]],
        'tex': texs, 'license': 'Body, clothes and textures from Microsoft Rocketbox (' + name + ', MIT licence). Re-skinned for Caddy Coach.'}
js = json.dumps(meta, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
b = bytearray(b'CCG1' + struct.pack('<I', len(js)) + js)
def put(a): b.extend(a.tobytes())
def pad(): b.extend(b'\0' * ((4 - len(b) % 4) % 4))
put(pos.astype(np.float32)); put(np.round(nrm * 127).astype(np.int8)); pad()
put(uvs.astype(np.float32)); put(skin_i); put(skin_w); put(np.round(ao[src_v] * 255).astype(np.uint8)); put(ptv[src_v]); pad()
put(tris.astype(np.uint32 if meta['i32'] else np.uint16).ravel())
open(os.path.join(out, 'golfer-rb.wasm'), 'wb').write(bytes(b))
print('wrote', nv, 'verts', len(tris), 'tris', len(b), 'bytes', texs)
