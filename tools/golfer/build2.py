# Build the realistic golfer for Drill Studio from the MakeHuman base mesh (CC0).
# Output: golfer.bin (geometry + skin) and golfer-skin.jpg (skin texture). Units metres, y up, golfer faces +z, his left (lead side) is +x.
import numpy as np, json, os, struct, math
from scipy.spatial import cKDTree
from PIL import Image, ImageFilter
import build1
H = os.path.dirname(os.path.abspath(__file__))
D = build1.D
OUT = H + '/out/'; os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

# ---------- shape ----------
extra = [('armslegs/l-upperarm-scale-vert-incr', 0.55), ('armslegs/r-upperarm-scale-vert-incr', 0.55), ('expression/units/caucasian/mouth-compression', 0.55), ('expression/units/caucasian/mouth-corner-puller', 0.22), ('expression/units/caucasian/eyebrows-left-inner-up', 0.1), ('expression/units/caucasian/eyebrows-right-inner-up', 0.1)]
V, VT, F, FT, G = build1.build(extra)
sk = json.load(open(D + 'rigs/default.mhskel'))
JP = {k: V[v].mean(0) for k, v in sk['joints'].items()}
def jh(b): return JP[sk['bones'][b]['head']]
def jt(b): return JP[sk['bones'][b]['tail']]

# body faces only (the base mesh also carries helper geometry)
body = [i for i, g in enumerate(G) if g == 'body']
BF = np.array([F[i] for i in body]); BFT = np.array([FT[i] for i in body])
used = np.unique(BF.ravel()); remap = -np.ones(len(V), int); remap[used] = np.arange(len(used))

# scale: leg (hip joint to ankle) = 0.90 m like the drill rig; floor at y=0; hips centred at x=z=0
hipL, hipR = jh('upperleg01.L'), jh('upperleg01.R')
leg = np.linalg.norm(jh('upperleg01.L') - jh('lowerleg01.L')) + np.linalg.norm(jh('lowerleg01.L') - jh('foot.L'))
S = 0.90 / leg
floor = V[used, 1].min()
org = np.array([0.0, floor, (hipL[2] + hipR[2]) / 2])
def M(p): return (np.asarray(p) - org) * S
P = M(V[used])          # body vertex positions (metres)
FQ = remap[BF]          # quads, body vertex indices
print('scale', round(S, 4), 'height', round(P[:, 1].max(), 3))

# ---------- skeleton: MakeHuman bones -> the bones the drill rig drives ----------
SIDES = ['L', 'R']
simple = ['hips', 'spine', 'chest', 'neck', 'head']
for s in SIDES:
    simple += [f'clav{s}', f'uarm{s}', f'farm{s}', f'ftw{s}', f'hand{s}'] + [f'f{f}{j}{s}' for f in range(1, 6) for j in range(1, 4)] + [f'thigh{s}', f'shin{s}', f'foot{s}']
BI = {n: i for i, n in enumerate(simple)}
def mapbone(b):
    if b in ('root', 'pelvis.L', 'pelvis.R', 'spine05'): return 'hips'
    if b in ('spine04', 'spine03'): return 'spine'
    if b in ('spine02', 'spine01', 'breast.L', 'breast.R'): return 'chest'
    if b.startswith('neck'): return 'neck'
    s = b[-1] if b[-2:] in ('.L', '.R') else None
    if b.startswith(('clavicle', 'shoulder01')): return 'clav' + s
    if b.startswith('upperarm'): return 'uarm' + s
    if b.startswith('lowerarm01'): return 'farm' + s
    if b.startswith('lowerarm02'): return 'ftw' + s
    if b.startswith(('wrist', 'metacarpal')): return 'hand' + s
    if b.startswith('finger'): f, j = b[6], b[8]; return f'f{f}{j}{s}'
    if b.startswith('upperleg'): return 'thigh' + s
    if b.startswith('lowerleg'): return 'shin' + s
    if b.startswith(('foot', 'toe')): return 'foot' + s
    return 'head'
mw = json.load(open(D + 'rigs/default_weights.mhw'))['weights']
W = np.zeros((len(used), len(simple)))
for b, lst in mw.items():
    k = BI[mapbone(b)]
    for v, w in lst:
        if remap[v] >= 0: W[remap[v], k] += w
W /= np.maximum(W.sum(1, keepdims=True), 1e-9)

rest = {}
def put(n, h, t): rest[n] = (M(h), M(t))
put('hips', (hipL + hipR) / 2, jh('spine04')); put('spine', jh('spine04'), jh('spine02')); put('chest', jh('spine02'), jh('neck01'))
put('neck', jh('neck01'), jh('head')); put('head', jh('head'), jt('head'))
for s in SIDES:
    put('clav' + s, jh(f'clavicle.{s}'), jh(f'upperarm01.{s}')); put('uarm' + s, jh(f'upperarm01.{s}'), jh(f'lowerarm01.{s}'))
    put('farm' + s, jh(f'lowerarm01.{s}'), jh(f'lowerarm02.{s}')); put('ftw' + s, jh(f'lowerarm02.{s}'), jh(f'wrist.{s}'))
    put('hand' + s, jh(f'wrist.{s}'), jh(f'finger3-1.{s}'))
    for f in range(1, 6):
        for j in range(1, 4): put(f'f{f}{j}{s}', jh(f'finger{f}-{j}.{s}'), jt(f'finger{f}-{j}.{s}'))
    put('thigh' + s, jh(f'upperleg01.{s}'), jh(f'lowerleg01.{s}')); put('shin' + s, jh(f'lowerleg01.{s}'), jh(f'foot.{s}'))
    put('foot' + s, jh(f'foot.{s}'), jh(f'toe3-1.{s}'))
dom = W.argmax(1)
def bone_t(n, pts):  # how far along a bone (0 head .. 1 tail)
    h, t = rest[n]; d = t - h; return ((pts - h) @ d) / (d @ d)

# ---------- normals ----------
def tris_of(Q): return np.concatenate([Q[:, [0, 1, 2]], Q[:, [0, 2, 3]]])
TR = tris_of(FQ)
def vnormals(P, T):
    n = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]); N = np.zeros_like(P)
    for k in range(3): np.add.at(N, T[:, k], n)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
N0 = vnormals(P, TR)
# neighbours for smoothing
nb = [set() for _ in range(len(P))]
for q in FQ:
    for a in range(4): nb[q[a]].add(q[(a + 1) % 4]); nb[q[a]].add(q[(a - 1) % 4])
nbl = [np.array(sorted(x)) for x in nb]

# ---------- landmarks ----------
headC = M(V[used][W[:, BI['head']] > 0.6].mean(0)) if False else P[W[:, BI['head']] > 0.6].mean(0)
eyeL, eyeR = M(JP['eye.L____head'] if 'eye.L____head' in JP else jh('eye.L')), M(jh('eye.R'))
eyeY = (eyeL[1] + eyeR[1]) / 2
headV = W[:, BI['head']] > 0.5
face = headV & (N0[:, 2] > 0.25) & (P[:, 2] > headC[2])
oris = sum(W[:, BI['head']] * 0 for _ in [0])
ow = np.zeros(len(P))
for b in ['oris01', 'oris05', 'oris03.L', 'oris03.R', 'oris04.L', 'oris04.R', 'oris06.L', 'oris06.R', 'oris07.L', 'oris07.R', 'oris02', 'oris06']:
    for v, w in mw.get(b, []):
        if remap[v] >= 0: ow[remap[v]] += w
mouth = (P[ow > 0.5] * ow[ow > 0.5, None]).sum(0) / ow[ow > 0.5].sum()
noseTip = P[face & (np.abs(P[:, 0]) < 0.01)][np.argmax(P[face & (np.abs(P[:, 0]) < 0.01), 2])]
print('headC', headC.round(3), 'eyes', eyeL.round(3), 'mouth', mouth.round(3), 'nose', noseTip.round(3))

# ---------- clothing regions ----------
y = P[:, 1]
hipsY = rest['hips'][0][1]
waistY = hipsY + 0.105
neckBase = rest['neck'][0]
R = np.full(len(P), 'skin', dtype=object)
torso = np.isin(dom, [BI['spine'], BI['chest'], BI['clavL'], BI['clavR']])
hipsD = dom == BI['hips']
uarm = {s: dom == BI['uarm' + s] for s in SIDES}
tU = {s: bone_t('uarm' + s, P) for s in SIDES}
shirt = (torso & (y > waistY - 0.012)) | (hipsD & (y > waistY - 0.012)) | ((dom == BI['neck']) & (y < neckBase[1] + 0.012) & (P[:, 2] < neckBase[2] + 0.05))
for s in SIDES: shirt |= uarm[s] & (tU[s] < 0.48)
tS = {s: bone_t('shin' + s, P) for s in SIDES}
legs = (hipsD | torso) & ~shirt & (y < waistY + 0.01)
for s in SIDES: legs |= (dom == BI['thigh' + s]) | ((dom == BI['shin' + s]) & (tS[s] < 0.95))
shoe = np.zeros(len(P), bool)
for s in SIDES: shoe |= (dom == BI['foot' + s]) | ((dom == BI['shin' + s]) & (tS[s] >= 0.95))
glove = np.zeros(len(P), bool)
leadHand = [BI['handL'], BI['ftwL']] + [BI[f'f{f}{j}L'] for f in range(1, 6) for j in range(1, 4)]
glove = np.isin(dom, [BI['handL']] + [BI[f'f{f}{j}L'] for f in range(1, 6) for j in range(1, 4)]) | ((dom == BI['ftwL']) & (bone_t('ftwL', P) > 0.86))
belt = (legs | shirt) & (np.abs(y - (waistY - 0.004)) < 0.017) & ~np.isin(dom, [BI['uarmL'], BI['uarmR']])
R[shirt] = 'shirt'; R[legs] = 'trousers'; R[shoe] = 'shoe'; R[glove] = 'glove'; R[belt] = 'belt'
# soles: the bottom of the shoe
sole = shoe & (y < 0.03)
R[sole] = 'sole'
for k in ['skin', 'shirt', 'trousers', 'belt', 'shoe', 'sole', 'glove']: print(k, int((R == k).sum()), end='  ')
print()

# ---------- cloth: lift off the body and smooth away anatomy ----------
off = np.zeros(len(P))
off[R == 'shirt'] = 0.010; off[R == 'trousers'] = 0.011; off[R == 'belt'] = 0.013; off[R == 'shoe'] = 0.011; off[R == 'sole'] = 0.011; off[R == 'glove'] = 0.0012
for s in SIDES:  # sleeve hem flares a little
    m = (R == 'shirt') & uarm[s]; off[m] += np.clip((tU[s][m] - 0.25) / 0.23, 0, 1) * 0.008
Q = P + N0 * off[:, None]
cloth = np.isin(R, ['shirt', 'trousers', 'belt', 'shoe', 'sole'])
def smooth(X, mask, it, lam=0.5, mu=-0.53):
    X = X.copy(); idx = np.where(mask)[0]
    for i in range(it):
        avg = np.array([X[nbl[v]].mean(0) for v in idx])
        X[idx] += (lam if i % 2 == 0 else mu) * (avg - X[idx])
    return X
Q = smooth(Q, cloth & (R != 'sole'), 24)
Q = smooth(Q, (R == 'shirt') & ~np.isin(dom, [BI['uarmL'], BI['uarmR']]), 70, 0.6, -0.62)
# trousers hang straight below the knee
for s in SIDES:
    h, t = rest['shin' + s]; ax = (t - h) / np.linalg.norm(t - h)
    m = (R == 'trousers') & (dom == BI['shin' + s]); tt = np.clip(bone_t('shin' + s, P[m]), 0, 1)
    c = h + np.outer(((Q[m] - h) @ ax), ax); r = Q[m] - c; rl = np.linalg.norm(r, axis=1)
    want = np.maximum(rl, 0.071 - 0.006 * tt); Q[m] = c + r / rl[:, None] * want[:, None]
    # thighs: a bit fuller, no muscle shapes
    h, t = rest['thigh' + s]; ax = (t - h) / np.linalg.norm(t - h)
    m = (R == 'trousers') & (dom == BI['thigh' + s]); c = h + np.outer(((Q[m] - h) @ ax), ax); r = Q[m] - c; rl = np.linalg.norm(r, axis=1)
    Q[m] = c + r * (1 + 0.04)
Q = smooth(Q, (R == 'trousers'), 10)
# never inside the body
d = ((Q - P) * N0).sum(1); bad = cloth & (d < off * 0.7); Q[bad] = P[bad] + N0[bad] * (off[bad] * 0.7)[:, None]
# shoes: flat soles and a little toe room
for s in SIDES:
    m = (R == 'sole') | (R == 'shoe')
    Q[m, 1] = np.maximum(Q[m, 1], 0.0)
Q[R == 'sole', 1] = np.minimum(Q[R == 'sole', 1], 0.012)

def facemat0(q):
    rs = list(R[q])
    for m in ['sole', 'shoe', 'belt', 'glove']:
        if rs.count(m) >= 2: return m
    return max(set(rs), key=rs.count)
# ---------- cap (built over the head) and polo collar ----------
fore = P[face & (np.abs(P[:, 0]) < 0.02)]
browY = eyeY + 0.03
zF, zB = headC[2] + 0.06, headC[2] - 0.08
def capline(z): return browY + 0.012 + (z - zF) / (zB - zF) * (eyeY - 0.012 - browY - 0.012)
capm = headV & (y > capline(P[:, 2]))
# make cap verts / faces from the head
cf = FQ[np.all(capm[FQ], axis=1)]
cv = np.unique(cf.ravel()); cmap = -np.ones(len(P), int); cmap[cv] = np.arange(len(cv))
CP = P[cv] + N0[cv] * 0.010
cnb = [nbl[v][capm[nbl[v]]] for v in cv]
for i in range(30):  # round dome
    avg = np.array([CP[cmap[n]].mean(0) if len(n) else CP[k] for k, n in enumerate(cnb)])
    CP += (0.5 if i % 2 == 0 else -0.52) * (avg - CP)
d = ((CP - P[cv]) * N0[cv]).sum(1); CP += N0[cv] * np.maximum(0, 0.009 - d)[:, None]
CQ = cmap[cf]
# boundary loop of the cap
from collections import defaultdict
ec = defaultdict(int)
for q in CQ:
    for a in range(4): e = tuple(sorted((q[a], q[(a + 1) % 4]))); ec[e] += 1
bed = [e for e, c in ec.items() if c == 1]
adj = defaultdict(list)
for a, b in bed: adj[a].append(b); adj[b].append(a)
loop = [bed[0][0]]; prev = None
while True:
    nx = [n for n in adj[loop[-1]] if n != prev]
    if not nx or nx[0] == loop[0]: break
    prev = loop[-1]; loop.append(nx[0])
loop = np.array(loop)
print('cap verts', len(cv), 'boundary', len(loop), 'of', len(bed))
RL = CP[loop].copy()
for _ in range(25): RL = 0.5 * RL + 0.25 * (np.roll(RL, 1, 0) + np.roll(RL, -1, 0))
hcx = headC[[0, 2]]
for k, v in enumerate(loop):
    r0 = np.hypot(*(CP[v, [0, 2]] - hcx)); r1 = np.hypot(*(RL[k, [0, 2]] - hcx)); RL[k, [0, 2]] = hcx + (RL[k, [0, 2]] - hcx) * max(1.0, r0 / max(r1, 1e-6))
CP[loop] = RL
# brim: from the front part of the rim, out and slightly down
rimP = CP[loop]; front = rimP[:, 2] > headC[2] + 0.02
ang = np.arctan2(rimP[:, 0] - headC[0], rimP[:, 2] - headC[2])
brimW = np.clip((np.cos(ang) - 0.42) / 0.58, 0, 1) ** 0.55 * 0.068
outd = np.stack([np.sin(ang), np.zeros_like(ang), np.cos(ang)], 1)
B1 = rimP + outd * brimW[:, None] + np.array([0, -1, 0]) * (brimW * 0.18 + np.sin(ang) ** 2 * brimW * 0.55)[:, None]
B1[:, 1] -= 0.0
brimOn = brimW > 0.004
# collar: a band standing up from the shirt round the neck
shirtF = np.array([facemat0(q) == 'shirt' for q in FQ])
ecs = defaultdict(list)
for fi, q in enumerate(FQ):
    for a in range(4): ecs[tuple(sorted((q[a], q[(a + 1) % 4])))].append(fi)
coll = [e for e, fs in ecs.items() if len(fs) == 2 and shirtF[fs[0]] != shirtF[fs[1]] and P[list(e), 1].min() > neckBase[1] - 0.09 and np.abs(P[list(e), 0]).max() < 0.13]
cadj = defaultdict(list)
for a, b in coll: cadj[a].append(b); cadj[b].append(a)
best = []
seen = set()
for st in list(cadj):
    if st in seen: continue
    lp = [st]; prev = None; seen.add(st)
    while True:
        nx = [n for n in cadj[lp[-1]] if n != prev and (n not in seen or n == lp[0])]
        if not nx or nx[0] == lp[0] or len(lp) > 500: break
        prev = lp[-1]; lp.append(nx[0]); seen.add(nx[0])
    if len(lp) > len(best): best = lp
cloop = np.array(best, int)
print('collar loop', len(cloop))
if len(cloop) > 8:
    L = Q[cloop].copy(); n = len(L)
    for _ in range(40):
        L = 0.5 * L + 0.25 * (np.roll(L, 1, 0) + np.roll(L, -1, 0))
    # keep it on the body surface roughly: move along the normal only as needed
    Q[cloop] = L + N0[cloop] * 0.002
    cc = L.mean(0); la = np.arctan2(L[:, 0] - cc[0], L[:, 2] - cc[2]); o = np.argsort(la); la_s = la[o]; ly_s = L[o, 1]
    near = (R == 'skin') & (np.abs(P[:, 0] - cc[0]) < 0.11) & (y > neckBase[1] - 0.1) & (y < neckBase[1] + 0.05) & np.isin(dom, [BI['neck'], BI['chest'], BI['spine']])
    ang_v = np.arctan2(P[:, 0] - cc[0], P[:, 2] - cc[2])
    hl = np.interp(ang_v, la_s, ly_s, period=2 * np.pi)
    fill = near & (y < hl + 0.003)
    R[fill] = 'shirt'; Q[fill] = P[fill] + N0[fill] * 0.004
    print('collar fill', int(fill.sum()))

# ---------- assemble one mesh with material groups ----------
mats = ['skin', 'shirt', 'trousers', 'belt', 'shoe', 'sole', 'glove', 'cap', 'eye', 'cornea']
verts = []  # (pos, nrm, uv, wts, part, mat)
# unique (vertex, uv) pairs for the body
key = {}
out_idx = {m: [] for m in mats}
def facemat(q):
    rs = list(R[q]);
    for m in ['sole', 'shoe', 'belt', 'glove']:
        if rs.count(m) >= 2: return m
    return max(set(rs), key=rs.count)
NQ = vnormals(Q, TR)
PV, NV, UV, WV, MV = [], [], [], [], []
def addv(p, n, uv, w):
    PV.append(p); NV.append(n); UV.append(uv); WV.append(w); return len(PV) - 1
for q, qt in zip(FQ, BFT):
    m = facemat(q); ids = []
    for v, t in zip(q, qt):
        k = (v, t, m in ('skin',))
        if k not in key: key[k] = addv(Q[v], NQ[v], VT[t], W[v])
        ids.append(key[k])
    out_idx[m] += [ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]]
# cap
headW = np.zeros(len(simple)); headW[BI['head']] = 1
CN = vnormals(CP, tris_of(CQ))
cbase = len(PV)
for k in range(len(cv)): addv(CP[k], CN[k], [0.5 + CP[k, 0] * 4, 0.5 + CP[k, 2] * 4], headW)
for q in CQ: out_idx['cap'] += [cbase + q[0], cbase + q[2], cbase + q[1], cbase + q[0], cbase + q[3], cbase + q[2]] if False else [cbase + q[0], cbase + q[1], cbase + q[2], cbase + q[0], cbase + q[2], cbase + q[3]]
# brim: top and underside
li = [i for i in range(len(loop))]
bt, bb, rt = {}, {}, {}
for i in li:
    if not brimOn[i] and not brimOn[(i + 1) % len(loop)] and not brimOn[i - 1]: continue
    p0 = CP[loop[i]]; p1 = B1[i]
    rt[i] = cbase + loop[i]
    bt[i] = addv(p1, [0, 1, 0], [0, 0], headW)
    bb[i] = addv(p1 + [0, -0.004, 0], [0, -1, 0], [0, 0], headW)
    if i not in bb: pass
ru = {}
for i in bt: ru[i] = addv(CP[loop[i]] + [0, -0.004, 0], [0, -1, 0], [0, 0], headW)
for i in bt:
    j = (i + 1) % len(loop)
    if j not in bt: continue
    out_idx['cap'] += [rt[i], bt[i], bt[j], rt[i], bt[j], rt[j]]
    out_idx['cap'] += [ru[i], bb[j], bb[i], ru[i], ru[j], bb[j]]
    out_idx['cap'] += [bt[i], bb[i], bb[j], bt[i], bb[j], bt[j]]
# collar band: a smooth ring round the neck base, hugging the neck at the top
if len(cloop) > 8:
    L = Q[cloop]; cc = L.mean(0)
    la = np.arctan2(L[:, 0] - cc[0], L[:, 2] - cc[2]); o = np.argsort(la)
    neckV = np.where(np.isin(dom, [BI['neck'], BI['chest']]) & (np.abs(P[:, 0] - cc[0]) < 0.12))[0]
    nang = np.arctan2(P[neckV, 0] - cc[0], P[neckV, 2] - cc[2]); nrad = np.hypot(P[neckV, 0] - cc[0], P[neckV, 2] - cc[2])
    def radius_at(th, yy):
        d = np.abs(((nang - th) + np.pi) % (2 * np.pi) - np.pi); m = (d < 0.25) & (np.abs(P[neckV, 1] - yy) < 0.012)
        return np.median(nrad[m]) if m.sum() > 2 else None
    NA = 56; base, top = [], []
    lr = np.hypot(L[:, 0] - cc[0], L[:, 2] - cc[2])
    ths = -np.pi + 2 * np.pi * np.arange(NA) / NA
    yb = np.interp(ths, la[o], L[o, 1], period=2 * np.pi); rb = np.interp(ths, la[o], lr[o], period=2 * np.pi)
    for _ in range(30): yb = 0.5 * yb + 0.25 * (np.roll(yb, 1) + np.roll(yb, -1)); rb = 0.5 * rb + 0.25 * (np.roll(rb, 1) + np.roll(rb, -1))
    for k, th in enumerate(ths):
        frontness = max(0.0, np.cos(th))
        ht = 0.026 * (1 - 0.45 * frontness)
        dirv = np.array([np.sin(th), 0, np.cos(th)])
        pb = cc * [1, 0, 1] + dirv * (rb[k] + 0.005) + [0, yb[k] - 0.01, 0]
        pt = cc * [1, 0, 1] + dirv * (rb[k] * (0.99 - 0.05 * frontness) + 0.007) + [0, yb[k] + ht, 0]
        nv = cloop[np.argmin(np.abs(((la - th) + np.pi) % (2 * np.pi) - np.pi))]
        wt = W[nv].copy(); wt2 = wt * 0.6; wt2[BI['neck']] += 0.4
        base.append(addv(pb, dirv, [0, 0], wt)); top.append(addv(pt, dirv, [0, 1], wt2))
    for k in range(NA):
        j = (k + 1) % NA
        out_idx['shirt'] += [base[k], base[j], top[j], base[k], top[j], top[k], base[k], top[j], base[j], base[k], top[k], top[j]]
# eyes: fitted from the high-poly eye proxy
def fit_proxy(path):
    sc = {}; vs = []; mode = None; objf = None
    for l in open(path):
        a = l.split()
        if not a or a[0].startswith('#'): continue
        if a[0] in ('x_scale', 'y_scale', 'z_scale'): sc[a[0][0]] = (int(a[1]), int(a[2]), float(a[3]))
        elif a[0] == 'obj_file': objf = a[1]
        elif a[0] == 'verts': mode = 'v'; continue
        elif a[0] in ('weights', 'delete_verts'): mode = None
        elif mode == 'v' and len(a) == 9: vs.append([int(a[0]), int(a[1]), int(a[2])] + [float(x) for x in a[3:]])
    s = np.array([np.abs(V[sc[k][0]] - V[sc[k][1]])['xyz'.index(k)] / sc[k][2] for k in 'xyz'])
    out = np.array([V[r[0]] * r[3] + V[r[1]] * r[4] + V[r[2]] * r[5] + np.array(r[6:9]) * s for r in vs])
    pv, pt, pf, pft, _ = build1.load_obj(os.path.dirname(path) + '/' + objf)
    return out, pt, pf, pft
EP, ET, EF, EFT = fit_proxy(D + 'eyes/high-poly/high-poly.mhclo')
EP = M(EP)
ebase = len(PV); ekey = {}
EN = vnormals(EP, np.array([f[:3] for f in EF] + [[f[0], f[2], f[3]] for f in EF if len(f) == 4]))
for f, ft in zip(EF, EFT):
    ids = []
    for v, t in zip(f, ft):
        k = (v, t)
        if k not in ekey: ekey[k] = addv(EP[v], EN[v], ET[t], headW)
        ids.append(ekey[k])
    mu = np.mean([ET[t][0] for t in ft]); mv = np.mean([ET[t][1] for t in ft])
    out_idx['cornea' if (mu > 0.8 and mv < 0.2) else 'eye'] += [ids[0], ids[1], ids[2]] + ([ids[0], ids[2], ids[3]] if len(ids) == 4 else [])
PV = np.array(PV, np.float32); NV = np.array(NV, np.float32); UV = np.array(UV, np.float32); WV = np.array(WV)
print('verts', len(PV), 'tris', sum(len(v) for v in out_idx.values()) // 3)

# ---------- ambient occlusion (point-cloud cone test) ----------
tree = cKDTree(PV)
dirs = rng.normal(size=(48, 3)); dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
AO = np.zeros(len(PV))
for i0 in range(0, len(PV), 2000):
    p = PV[i0:i0 + 2000]; n = NV[i0:i0 + 2000]; occ = np.zeros(len(p)); cnt = np.zeros(len(p))
    for d in dirs:
        w = n @ d; ok = w > 0.1
        hit = np.zeros(len(p), bool)
        for dist in (0.012, 0.025, 0.045, 0.075, 0.11):
            q = p + np.outer(np.ones(len(p)), d) * dist + n * 0.002
            dd, _ = tree.query(q, k=1, distance_upper_bound=dist * 0.35)
            hit |= np.isfinite(dd)
        occ += (hit & ok) * w; cnt += ok * w
    AO[i0:i0 + 2000] = 1 - occ / np.maximum(cnt, 1e-6)
AO = np.clip(AO, 0, 1) ** 0.8

# ---------- body part ids (for highlighting a part in a drill) ----------
PART = {'hips': 1, 'chest': 2, 'head': 3, 'leadarm': 4, 'trailarm': 5, 'leadleg': 6, 'trailleg': 7, 'leadfoot': 8, 'trailfoot': 9, 'neck': 10, 'leadhand': 11, 'trailhand': 12}
def part_of(w):
    n = simple[int(np.argmax(w))]
    if n in ('hips', 'spine'): return PART['hips']
    if n == 'chest' or n.startswith('clav'): return PART['chest']
    if n in ('head',): return PART['head']
    if n == 'neck': return PART['neck']
    s = n[-1]; lead = s == 'L'
    if n.startswith(('uarm', 'farm', 'ftw')): return PART['leadarm' if lead else 'trailarm']
    if n.startswith(('hand', 'f')) and not n.startswith('foot'): return PART['leadhand' if lead else 'trailhand']
    if n.startswith(('thigh', 'shin')): return PART['leadleg' if lead else 'trailleg']
    if n.startswith('foot'): return PART['leadfoot' if lead else 'trailfoot']
    return 0
PARTV = np.array([part_of(w) for w in WV], np.uint8)
# top-4 skin weights
idx4 = np.argsort(-WV, axis=1)[:, :4]; w4 = np.take_along_axis(WV, idx4, 1); w4 /= np.maximum(w4.sum(1, keepdims=True), 1e-9)
W8 = np.round(w4 * 255).astype(np.int32); W8[:, 0] += 255 - W8.sum(1)

# ---------- skin texture (UV space) ----------
TS = 2048
def vcol():
    base = np.array([0.80, 0.60, 0.49])          # fair, lightly tanned
    C = np.tile(base, (len(P), 1))
    def blob(c, r, col, k):
        d = np.linalg.norm((P - c) / r, axis=1); w = np.exp(-d * d) * k
        return w[:, None] * (np.array(col) - C)
    red = [0.80, 0.45, 0.40]
    for c in [np.array([eyeL[0] + 0.012, eyeY - 0.035, eyeL[2] - 0.005]), np.array([eyeR[0] - 0.012, eyeY - 0.035, eyeR[2] - 0.005])]:
        C += blob(c, np.array([0.022, 0.018, 0.03]), red, 0.35)
    C += blob(noseTip, np.array([0.012, 0.012, 0.02]), red, 0.30)
    # lips
    lipd = np.sqrt(((P[:, 0] - mouth[0]) / 0.024) ** 2 + ((P[:, 1] - mouth[1]) / 0.0085) ** 2)
    lw = np.clip(1.25 - lipd, 0, 1) * (P[:, 2] > mouth[2] - 0.012) * headV
    C += (np.clip(lw * 1.6, 0, 1))[:, None] * (np.array([0.66, 0.36, 0.34]) - C)
    # ears: a little redder
    ear = headV & (np.abs(P[:, 0]) > np.abs(eyeL[0]) + 0.035) & (np.abs(P[:, 1] - eyeY) < 0.04)
    C[ear] = C[ear] * 0.85 + np.array(red) * 0.15
    # eyebrows
    for e, sgn in [(eyeL, 1), (eyeR, -1)]:
        u = (P[:, 0] - e[0]) * sgn  # + outward
        by = e[1] + 0.017 + 0.004 * np.clip(1 - np.abs(u) / 0.02, 0, 1) - 0.006 * np.clip(u / 0.025, 0, 1) ** 2
        bw = np.clip(1 - np.abs(P[:, 1] - by) / (0.0055 - 0.0022 * np.clip(u / 0.026, 0, 1)), 0, 1) * (np.abs(u + 0.002) < 0.027) * (P[:, 2] > e[2] - 0.006) * headV
        C += (np.clip(bw * 1.2, 0, 0.7))[:, None] * (np.array([0.26, 0.18, 0.13]) - C)
    # stubble / beard shadow
    jaw = headV & (P[:, 1] < mouth[1] + 0.012) & (P[:, 1] > mouth[1] - 0.065) & (P[:, 2] > headC[2] - 0.02) & (lw < 0.2)
    jw = jaw * np.clip((headC[2] + 0.07 - P[:, 2]) * 0 + 1, 0, 1)
    C[jaw] = C[jaw] * 0.9 + np.array([0.45, 0.38, 0.36]) * 0.1
    # short hair below the cap (sides and back)
    earZ = headC[2] - 0.005
    hair = headV & (y > eyeY - 0.05) & (P[:, 2] < earZ + 0.025) & (np.abs(P[:, 0]) > 0.0) & (N0[:, 2] < 0.35) & ~((np.abs(P[:, 0]) > np.abs(eyeL[0]) + 0.04) & (np.abs(P[:, 1] - (eyeY - 0.01)) < 0.03) & (P[:, 2] > earZ - 0.035) & (P[:, 2] < earZ + 0.01))
    hair &= (P[:, 2] < earZ - 0.035) | (y > eyeY + 0.01) | (np.abs(P[:, 0]) < 0.0)
    hair &= ~ear | (y > eyeY + 0.025)
    C[hair] = np.array([0.20, 0.15, 0.11])
    # nails and knuckles: a touch pinker
    hands = np.isin(dom, [BI[n] for n in simple if n.startswith(('f', 'hand')) and not n.startswith('foot')])
    C[hands] = C[hands] * 0.92 + np.array(red) * 0.08
    return np.clip(C, 0, 1), hair
VC, HAIR = vcol()
img = np.zeros((TS, TS, 3)); wsum = np.zeros((TS, TS))
mask = np.zeros((TS, TS), bool)
UVb = VT
for q, qt in zip(FQ, BFT):
    for tri in ((0, 1, 2), (0, 2, 3)):
        a = [UVb[qt[t]] * [TS, TS] for t in tri]; c = [VC[q[t]] for t in tri]
        xs = [p[0] for p in a]; ys = [TS - p[1] for p in a]
        x0, x1 = int(max(0, math.floor(min(xs)) - 1)), int(min(TS - 1, math.ceil(max(xs)) + 1)); y0, y1 = int(max(0, math.floor(min(ys)) - 1)), int(min(TS - 1, math.ceil(max(ys)) + 1))
        if x1 < x0 or y1 < y0: continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = zip(xs, ys)
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9: continue
        l1 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / den; l2 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / den; l3 = 1 - l1 - l2
        ins = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
        if not ins.any(): continue
        col = l1[..., None] * c[0] + l2[..., None] * c[1] + l3[..., None] * c[2]
        sub = img[y0:y1 + 1, x0:x1 + 1]; sub[ins] = col[ins]; mask[y0:y1 + 1, x0:x1 + 1] |= ins
# detail: blotches and pores
def noise(sz, scale):
    n = rng.normal(size=(sz // scale + 2, sz // scale + 2)); im = Image.fromarray(((n - n.min()) / (np.ptp(n)) * 255).astype(np.uint8)).resize((sz, sz), Image.BICUBIC)
    return np.asarray(im) / 255.0 - 0.5
blot = noise(TS, 64) * 0.06 + noise(TS, 16) * 0.035 + noise(TS, 3) * 0.04 + rng.normal(size=(TS, TS)) * 0.012
img = img * (1 + blot[..., None] * np.array([0.9, 1.1, 1.15]))
# dilate islands so seams don't show
im8 = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)); m8 = Image.fromarray(mask.astype(np.uint8) * 255)
for _ in range(6):
    blurred = im8.filter(ImageFilter.BoxBlur(2)); mb = m8.filter(ImageFilter.BoxBlur(2))
    a = np.asarray(blurred).astype(float); w = np.asarray(mb).astype(float)[..., None] / 255
    cur = np.asarray(im8).astype(float); mm = np.asarray(m8)[..., None] > 0
    fill = np.where(w > 0.01, a / np.maximum(w, 1e-3) * (np.asarray(m8.filter(ImageFilter.BoxBlur(0)))[..., None] * 0 + 1), cur)
    new = np.where(mm, cur, np.clip(fill * 0 + a / np.maximum(w, 1e-3), 0, 255))
    im8 = Image.fromarray(np.clip(new, 0, 255).astype(np.uint8)); m8 = m8.filter(ImageFilter.MaxFilter(5))
im8.convert('RGB').resize((1024, 1024), Image.LANCZOS).save(OUT + 'golfer-skin.jpg', quality=86)
im8.save(OUT + 'golfer-skin-2k.png')

# ---------- write ----------
groups = []; I = []
for m in mats:
    if out_idx[m]: groups.append({'mat': m, 'start': len(I), 'count': len(out_idx[m])}); I += out_idx[m]
I = np.array(I, np.uint32 if len(PV) > 65535 else np.uint16)
bones = [{'n': n, 'h': [round(float(x), 5) for x in rest[n][0]], 't': [round(float(x), 5) for x in rest[n][1]]} for n in simple]
meta = {'v': 1, 'nv': len(PV), 'ni': len(I), 'i32': I.dtype == np.uint32, 'bones': bones, 'groups': groups, 'parts': PART,
        'headC': [round(float(x), 5) for x in headC], 'eyes': [[round(float(x), 5) for x in eyeL], [round(float(x), 5) for x in eyeR]],
        'license': 'Body, skeleton and eyes from MakeHuman (CC0 1.0). Clothes, cap, texture and fitting made for Caddy Coach.'}
jb = json.dumps(meta, separators=(',', ':')).encode(); jb += b' ' * ((4 - len(jb) % 4) % 4)
with open(OUT + 'golfer.bin', 'wb') as f:
    f.write(b'CCG1'); f.write(struct.pack('<I', len(jb))); f.write(jb)
    f.write(PV.astype('<f4').tobytes()); f.write(np.round(NV * 127).astype('<i1').tobytes()); f.write(b'\0' * ((4 - (len(PV) * 3) % 4) % 4))
    f.write(UV.astype('<f4').tobytes()); f.write(idx4.astype('<u1').tobytes()); f.write(W8.astype('<u1').tobytes())
    f.write(np.round(AO * 255).astype('<u1').tobytes()); f.write(PARTV.tobytes()); pad = (4 - (2 * len(PV)) % 4) % 4; f.write(b'\0' * pad)
    f.write(I.tobytes())
print('wrote', os.path.getsize(OUT + 'golfer.bin'), 'bytes')
np.savez(OUT + 'debug.npz', P=P, Q=Q, R=R.astype(str), dom=dom)
