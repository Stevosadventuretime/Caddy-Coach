# Build the realistic golfer for Drill Studio from the MakeHuman base mesh (CC0).
# Output: golfer.bin (geometry + skin) and golfer-skin.jpg (skin texture). Units metres, y up, golfer faces +z, his left (lead side) is +x.
import numpy as np, json, os, struct, math
from scipy.spatial import cKDTree
from PIL import Image, ImageFilter
import build1
from scipy.spatial import ConvexHull
build1_targets = build1.golfer_targets
build1.golfer_targets = lambda **k: build1_targets(muscle=0.5, weight=0.55)
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
# clean garment edges: slide the nearest vertex of every crossing edge onto the edge line (hems, cuffs, neckline, belt)
EDGE = np.zeros(len(P), bool)
EDG = set()
for q in FQ:
    for a_ in range(4): EDG.add(tuple(sorted((q[a_], q[(a_ + 1) % 4]))))
EDG = np.array(sorted(EDG))
def snap(F, zone):
    global y
    e = EDG[zone[EDG[:, 0]] & zone[EDG[:, 1]]]
    e = e[np.sign(F[e[:, 0]]) != np.sign(F[e[:, 1]])]
    moved = set()
    for v0, v1 in sorted(e.tolist(), key=lambda t: min(abs(F[t[0]]), abs(F[t[1]]))):
        v, n = (v0, v1) if abs(F[v0]) <= abs(F[v1]) else (v1, v0)
        if v in moved or EDGE[v] or n in moved: continue
        t = abs(F[v]) / (abs(F[v]) + abs(F[n]) + 1e-12)
        if t > 0.5: continue
        P[v] += t * (P[n] - P[v]); F[v] = 0; EDGE[v] = True; moved.add(v)
    y = P[:, 1]
    return F
nk = neckBase
phN = np.arctan2(P[:, 0] - nk[0], P[:, 2] - (nk[2] - 0.01))
def neckline(ph): return nk[1] + 0.006 - 0.034 * np.maximum(0, np.cos(ph)) ** 3
rN = np.hypot(P[:, 0] - nk[0], P[:, 2] - nk[2])
nzone = np.isin(dom, [BI['neck'], BI['chest'], BI['clavL'], BI['clavR'], BI['spine']]) & (rN < 0.115) & (y > nk[1] - 0.09) & (y < nk[1] + 0.06)
Fn = snap(y - neckline(phN), nzone)
for s_ in SIDES:
    snap(bone_t('uarm' + s_, P) - 0.48, np.isin(dom, [BI['uarm' + s_], BI['farm' + s_]]))
    snap(bone_t('shin' + s_, P) - 0.94, np.isin(dom, [BI['shin' + s_], BI['foot' + s_]]))
snap(bone_t('ftwL', P) - 0.86, np.isin(dom, [BI['ftwL'], BI['handL']]))
bz = np.isin(dom, [BI['spine'], BI['hips'], BI['thighL'], BI['thighR']])
snap(y - (waistY + 0.012), bz); snap(y - (waistY - 0.020), bz)
y = P[:, 1]; print('snapped edge verts', int(EDGE.sum()))
uarm = {s: dom == BI['uarm' + s] for s in SIDES}
tU = {s: bone_t('uarm' + s, P) for s in SIDES}
E9 = 1e-9
shirt = ((torso | hipsD) & (y > waistY - 0.020 - E9)) | ((dom == BI['neck']) & (y < nk[1] + 0.03))
shirt &= ~(nzone & (Fn > E9))
shirt &= ~((dom == BI['neck']) & ~nzone)
for s in SIDES: shirt |= (uarm[s] | ((dom == BI['farm' + s]) & (tU[s] > 0.3))) & (tU[s] <= 0.48 + E9)
for s in SIDES:
    h_, t_ = rest['uarm' + s]; d_ = (t_ - h_) / np.linalg.norm(t_ - h_); rel_ = P - h_
    dist_ = np.linalg.norm(rel_ - np.outer(rel_ @ d_, d_), axis=1)
    armz = (tU[s] > 0.2) & (dist_ < 0.075) & ((P[:, 0] > 0.1) if s == 'L' else (P[:, 0] < -0.1))
    shirt &= ~(armz & (tU[s] > 0.48 + E9))
    ARMZ_ = armz if s == 'L' else (ARMZ_ | armz)
tS = {s: bone_t('shin' + s, P) for s in SIDES}
legs = (hipsD | torso) & ~shirt & (y < waistY + 0.012 + E9)
for s in SIDES: legs |= (dom == BI['thigh' + s]) | (dom == BI['shin' + s])
shoe = np.zeros(len(P), bool)
for s in SIDES: shoe |= (dom == BI['foot' + s]) | ((dom == BI['shin' + s]) & (tS[s] >= 0.965))
sock = np.zeros(len(P), bool)
for s in SIDES: sock |= (dom == BI['shin' + s]) & (tS[s] >= 0.94 + E9) & (tS[s] < 0.965)
glove = np.isin(dom, [BI['handL']] + [BI[f'f{f}{j}L'] for f in range(1, 6) for j in range(1, 4)]) | ((dom == BI['ftwL']) & (bone_t('ftwL', P) >= 0.86 - E9))
for s in SIDES: legs &= ~((dom == BI['shin' + s]) & (tS[s] > 0.94 + E9))
belt = (legs | shirt) & (y >= waistY - 0.020 - E9) & (y <= waistY + 0.012 + E9) & ~np.isin(dom, [BI['uarmL'], BI['uarmR']])
R[shirt] = 'shirt'; R[legs] = 'trousers'; R[sock] = 'sock'; R[shoe] = 'hidden'; R[glove] = 'glove'; R[belt] = 'belt'
for k in ['skin', 'shirt', 'trousers', 'belt', 'sock', 'hidden', 'glove']: print(k, int((R == k).sum()), end='  ')
print()

# ---------- cloth: fabric bridges across hollows (convex hull per slice), with ease, then folds ----------
Q = P.copy()
def smooth(X, mask, it, lam=0.5, mu=-0.53):
    X = X.copy(); idx = np.where(mask)[0]
    for i in range(it):
        avg = np.array([X[nbl[v]].mean(0) for v in idx])
        X[idx] += (lam if i % 2 == 0 else mu) * (avg - X[idx])
    return X
def drape(mask, o, d, ease, binw=0.009):
    """push the masked vertices out to the convex hull of their slice (perpendicular to axis d through o) plus ease(t, ang)"""
    idx = np.where(mask)[0]
    if not len(idx): return
    d = d / np.linalg.norm(d); u = np.cross(d, [0, 0, 1.0]);
    if np.linalg.norm(u) < 0.1: u = np.cross(d, [1.0, 0, 0])
    u /= np.linalg.norm(u); v = np.cross(d, u)
    rel = P[idx] - o; t = rel @ d; xy = np.stack([rel @ u, rel @ v], 1)
    lo, hi = t.min(), t.max(); nb = max(1, int((hi - lo) / binw) + 1)
    out = np.zeros((len(idx), 2))
    for k in range(nb):
        sel = np.where((t >= lo + k * binw - binw * 0.6) & (t < lo + (k + 1) * binw + binw * 0.6))[0]
        core = np.where((t >= lo + k * binw) & (t < lo + (k + 1) * binw))[0]
        if len(core) == 0: continue
        pts = xy[sel]
        try: hull = ConvexHull(pts); poly = pts[hull.vertices]
        except Exception: out[core] = xy[core]; continue
        c = poly.mean(0)
        for i in core:
            dr = xy[i] - c; L = np.linalg.norm(dr)
            if L < 1e-6: out[i] = xy[i]; continue
            dr /= L; best = None
            for j in range(len(poly)):
                a2, b2 = poly[j] - c, poly[(j + 1) % len(poly)] - c; e = b2 - a2
                den = dr[0] * (-e[1]) - dr[1] * (-e[0])
                if abs(den) < 1e-12: continue
                tt = (a2[0] * (-e[1]) - a2[1] * (-e[0])) / den; ss = (dr[0] * a2[1] - dr[1] * a2[0]) / den
                if tt > 0 and -1e-6 <= ss <= 1 + 1e-6: best = tt if best is None else min(best, tt)
            rh = max(best if best is not None else L, L)
            ang = np.arctan2(dr[1], dr[0])
            out[i] = c + dr * (rh + ease(t[i], ang, dr))
    Q[idx] = o + np.outer(t, d) + np.outer(out[:, 0], u) + np.outer(out[:, 1], v)
hipC = (rest['thighL'][0] + rest['thighR'][0]) / 2
crotchY = hipC[1] - 0.075
chestY = rest['chest'][0][1] + 0.06
up = np.array([0, 1.0, 0])
torsoShirt = (R == 'shirt') & ~np.isin(dom, [BI['uarmL'], BI['uarmR']])
def shirt_ease(t, ang, dr):
    yy = hipC[1] + t
    belly = np.clip((chestY - yy) / max(chestY - waistY, 1e-3), 0, 1)       # hangs straight from the chest down
    front = max(0.0, dr[1]) if True else 0
    return 0.009 + 0.010 * belly * (0.5 + 0.5 * max(0.0, dr[1])) + 0.004 * belly
drape(torsoShirt, hipC, up, shirt_ease)
for sd in SIDES:
    h, t = rest['uarm' + sd]
    drape((R == 'shirt') & (uarm[sd] | (dom == BI['farm' + sd])), h, t - h, lambda tt, ang, dr: 0.010 + 0.012 * np.clip(tt / 0.13, 0, 1))
# trousers: hips as one piece above the crotch, then each leg straight down
pelv = (R == 'trousers') & (y >= crotchY) | (R == 'belt')
drape(pelv, hipC, up, lambda tt, ang, dr: 0.014)
for sd in SIDES:
    side = (P[:, 0] > 0) if sd == 'L' else (P[:, 0] <= 0)
    th = rest['thigh' + sd]; sh = rest['shin' + sd]
    mt = (R == 'trousers') & (y < crotchY) & side & ~(dom == BI['shin' + sd])
    drape(mt, th[0], th[1] - th[0], lambda tt, ang, dr: 0.016 + 0.012 * np.clip(tt / 0.4, 0, 1))
    ms = (R == 'trousers') & (dom == BI['shin' + sd])
    def shin_ease(tt, ang, dr, L=np.linalg.norm(sh[1] - sh[0])): return 0.028 + 0.003 * np.clip(tt / L, 0, 1)
    drape(ms, sh[0], sh[1] - sh[0], shin_ease)
cloth = np.isin(R, ['shirt', 'trousers', 'belt'])
Q = smooth(Q, cloth, 16)
# pressed creases down the front and back of each trouser leg
for sd in SIDES:
    side = (P[:, 0] > 0) if sd == 'L' else (P[:, 0] <= 0)
    th = rest['thigh' + sd]; sh = rest['shin' + sd]
    m = (R == 'trousers') & side & (y < crotchY - 0.03)
    ax = np.where((y < sh[0][1])[:, None], sh[0] + np.outer((y - sh[0][1]) / (sh[1][1] - sh[0][1]), sh[1] - sh[0]), th[0] + np.outer((y - th[0][1]) / (th[1][1] - th[0][1]), th[1] - th[0]))
    hd = (Q - ax) * [1, 0, 1]; a = np.arctan2(hd[:, 0], hd[:, 2])
    ridge = 0.0032 * np.exp(-(a / 0.10) ** 2) + 0.0018 * np.exp(-((np.abs(a) - np.pi) / 0.10) ** 2)
    nh = hd / np.maximum(np.linalg.norm(hd, axis=1, keepdims=True), 1e-6)
    Q[m] += nh[m] * ridge[m, None]
# folds: the polo blouses over the belt, trousers break over the shoe and crease behind the knee
ang = np.arctan2(P[:, 0], P[:, 2])
bl = (R == 'shirt') & (y > waistY) & (y < waistY + 0.075) & torsoShirt
w = np.clip(1 - np.abs(y - (waistY + 0.03)) / 0.045, 0, 1)
fold = 0.0035 * w * (0.55 + 0.45 * np.sin(ang * 11 + 1.7 * np.sin(ang * 3)))
Q[bl] += N0[bl] * (0.006 * w[bl] + fold[bl])[:, None]
for sd in SIDES:
    sh = rest['shin' + sd]; Lsh = np.linalg.norm(sh[1] - sh[0]); ts = tS[sd]
    m = (R == 'trousers') & (dom == BI['shin' + sd]) & (ts > 0.72)
    ww = np.clip((ts - 0.72) / 0.16, 0, 1)
    Q[m] += N0[m] * (0.004 * ww[m] * (0.5 + 0.5 * np.sin(ts[m] * Lsh * 2 * np.pi / 0.045 + ang[m] * 2)))[:, None]
    th = rest['thigh' + sd]; tt = bone_t('thigh' + sd, P)
    m = (R == 'trousers') & (dom == BI['thigh' + sd]) & (tt > 0.78) & (N0[:, 2] < -0.2)
    ww = np.clip(1 - np.abs(tt - 0.92) / 0.14, 0, 1)
    Q[m] += N0[m] * (0.003 * ww[m] * np.sin(tt[m] * 60))[:, None]
# never inside the body
off = np.where(R == 'shirt', 0.006, np.where(R == 'trousers', 0.008, np.where(R == 'belt', 0.010, np.where(R == 'glove', 0.0012, 0.0))))
d = ((Q - P) * N0).sum(1); bad = (off > 0) & (d < off); Q[bad] += N0[bad] * (off[bad] - d[bad])[:, None]
Q[R == 'glove'] = P[R == 'glove'] + N0[R == 'glove'] * 0.0012
# cloth follows the body part it now sits over: weights from the nearest body points to the draped position, then smoothed
_bt = cKDTree(P)
clothM = np.isin(R, ['shirt', 'trousers', 'belt'])
ci = np.where(clothM)[0]
dd, ii = _bt.query(Q[ci], k=8); ww = 1 / np.maximum(dd, 2e-3) ** 2; ww /= ww.sum(1, keepdims=True)
Wc = (W[ii] * ww[:, :, None]).sum(1)
W = W.copy(); W[ci] = 0.5 * W[ci] + 0.5 * Wc
for _ in range(4):
    W[ci] = 0.5 * W[ci] + 0.5 * np.array([W[nbl[v]].mean(0) for v in ci])
W /= W.sum(1, keepdims=True)
# the belt stands proud of the trousers
Q[R == 'belt'] += N0[R == 'belt'] * 0.004
PRI = ['shirt', 'trousers', 'belt', 'glove', 'sock', 'hidden', 'skin']
def facemat0(q):
    rs = list(R[q]) if EDGE[q].all() or not EDGE[q].any() else list(R[q][~EDGE[q]])
    for m in ['hidden', 'belt', 'glove']:
        if rs.count(m) >= min(2, len(rs)): return m
    return max(sorted(set(rs), key=lambda m: PRI.index(m) if m in PRI else 9), key=rs.count)
import cap as capmod
HEC, HER = capmod.fit_ellipsoid(P[headV & (y > eyeY + 0.03)]); HEC[0] = headC[0]
TS = 2048
def hair_field(X, hw):
    """short back-and-sides haircut: 0..1 coverage with a smooth, feathered hairline"""
    hzc = headC[2] - 0.055
    phi = np.abs(np.arctan2(X[:, 0] - headC[0], X[:, 2] - hzc))
    kx = [0.0, 0.55, 0.95, 1.18, 1.45, 1.80, 2.25, 2.70, np.pi]
    ky = [0.075, 0.062, 0.020, -0.030, -0.004, -0.010, -0.050, -0.082, -0.090]
    yh = eyeY + np.interp(phi, kx, ky)
    ed = np.linalg.norm((X - HEC) / HER, axis=1)
    earM = (np.abs(X[:, 0] - headC[0]) > 0.0735) & (X[:, 2] > headC[2] - 0.098) & (X[:, 2] < headC[2] - 0.036) & (np.abs(X[:, 1] - (eyeY - 0.008)) < 0.042)
    return np.clip((X[:, 1] - yh) / 0.010, 0, 1) * np.clip((hw - 0.3) / 0.4, 0, 1) * ~earM
def vcol():
    base = np.array([0.78, 0.565, 0.445])         # fair, lightly tanned
    C = np.tile(base, (len(P), 1))
    armsT = np.isin(dom, [BI[n] for n in ['farmL', 'farmR', 'ftwL', 'ftwR', 'handR', 'uarmL', 'uarmR']] + [BI[f'f{f}{j}R'] for f in range(1, 6) for j in range(1, 4)])
    C[armsT] = C[armsT] * 0.9 + np.array([0.62, 0.40, 0.29]) * 0.1          # golfer's tan on the arms
    C[headV] = C[headV] * 0.93 + np.array([0.70, 0.44, 0.34]) * 0.07
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
    C += (np.clip(lw * 1.25, 0, 0.85))[:, None] * (np.array([0.68, 0.43, 0.39]) - C)
    # ears: a little redder
    ear = headV & (np.abs(P[:, 0]) > np.abs(eyeL[0]) + 0.035) & (np.abs(P[:, 1] - eyeY) < 0.04)
    C[ear] = C[ear] * 0.85 + np.array(red) * 0.15
    # eyebrows
    for e, sgn in [(eyeL, 1), (eyeR, -1)]:
        u = (P[:, 0] - e[0]) * sgn  # + outward
        by = e[1] + 0.017 + 0.004 * np.clip(1 - np.abs(u) / 0.02, 0, 1) - 0.006 * np.clip(u / 0.025, 0, 1) ** 2
        bw = np.clip(1 - np.abs(P[:, 1] - by) / (0.0055 - 0.0022 * np.clip(u / 0.026, 0, 1)), 0, 1) * (np.abs(u + 0.002) < 0.027) * (P[:, 2] > e[2] - 0.006) * headV
        C += (np.clip(bw * 1.0, 0, 0.5))[:, None] * (np.array([0.30, 0.21, 0.15]) - C)
    # stubble / beard shadow
    jaw = headV & (P[:, 1] < mouth[1] + 0.012) & (P[:, 1] > mouth[1] - 0.065) & (P[:, 2] > headC[2] - 0.02) & (lw < 0.2)
    jw = jaw * np.clip((headC[2] + 0.07 - P[:, 2]) * 0 + 1, 0, 1)
    C[jaw] = C[jaw] * 0.95 + np.array([0.52, 0.40, 0.36]) * 0.05
    # short back-and-sides haircut: a smooth hairline round the head, feathered
    hf = hair_field(P, (W[:, BI['head']] > 0.5).astype(float))
    hair = hf > 0.02
    C[hair] = C[hair] * (1 - 0.8 * hf[hair, None]) + np.array([0.16, 0.12, 0.09]) * 0.8 * hf[hair, None]
    globals()['HF0'] = hf
    # nails and knuckles: a touch pinker
    hands = np.isin(dom, [BI[n] for n in simple if n.startswith(('f', 'hand')) and not n.startswith('foot')])
    C[hands] = C[hands] * 0.92 + np.array(red) * 0.08
    return np.clip(C, 0, 1), hair
VC, HAIR = vcol()
HF = HF0.copy()
VC = np.c_[VC, HF, P, W[:, BI['head']]]
# ---------- polo collar (stand + fold-over leaf), placket and buttons ----------
from scipy.interpolate import griddata
lv = np.where(EDGE & nzone & (np.abs(Fn) < 1e-9))[0]
cc = np.array([nk[0], 0, nk[2] - 0.01])
la = np.arctan2(Q[lv, 0] - cc[0], Q[lv, 2] - cc[2]); o_ = np.argsort(la); la = la[o_]; lv = lv[o_]
print('neckline verts', len(lv))
lr = np.hypot(Q[lv, 0] - cc[0], Q[lv, 2] - cc[2]); ly = Q[lv, 1]
NA = 90; gap = 0.30
ths = np.linspace(gap, 2 * np.pi - gap, NA); ths = np.where(ths > np.pi, ths - 2 * np.pi, ths)
rb = np.interp(ths, la, lr, period=2 * np.pi); yb = np.interp(ths, la, ly, period=2 * np.pi)
order = np.argsort(np.unwrap(np.where(ths < 0, ths + 2 * np.pi, ths)))
for _ in range(20):
    rb2 = rb.copy(); yb2 = yb.copy()
    rb2[1:-1] = 0.5 * rb[1:-1] + 0.25 * (rb[:-2] + rb[2:]); yb2[1:-1] = 0.5 * yb[1:-1] + 0.25 * (yb[:-2] + yb[2:]); rb, yb = rb2, yb2
shirtIdx = np.where(R == 'shirt')[0]; stree = cKDTree(Q[shirtIdx])
NQs = vnormals(Q, TR)
prof = []
for k, th in enumerate(ths):
    near = np.clip(1 - (min(abs(th), 2 * np.pi - abs(th)) - gap) / 0.55, 0, 1)
    hs = 0.024 - 0.006 * near; drop = 0.032 + 0.028 * near ** 2; out = 0.010 + 0.016 * near
    nrm = np.array([np.sin(th), 0, np.cos(th)]); B = cc * [1, 0, 1] + nrm * (rb[k] + 0.001) + [0, yb[k], 0]
    side = np.array([np.cos(th), 0, -np.sin(th)])
    tipfwd = near ** 2 * 0.012 * (1 if th < 0 else -1)        # collar points swing toward the centre front
    pts2 = [(-0.0015, -0.002, 0), (-0.0025, hs, 0), (0.0007, hs + 0.0038, 0), (0.0048, hs + 0.002, 0),
            (0.009 + 0.5 * out, hs - 0.45 * drop, 0.4 * tipfwd), (0.012 + out, hs - drop, tipfwd), (0.010 + out, hs - drop + 0.0028, tipfwd),
            (0.0045 + 0.4 * out, hs - 0.4 * drop, 0.4 * tipfwd), (0.0018, hs - 0.0045, 0), (0.0018, 0.0, 0)]
    prof.append([B + nrm * a_ + np.array([0, b_, 0]) + side * c_ for a_, b_, c_ in pts2])
prof = np.array(prof)   # (NA, 10, 3)
# keep the leaf lying on the shirt, never inside it
flat = prof.reshape(-1, 3)
for it in range(3):
    d_, i_ = stree.query(flat); qv = shirtIdx[i_]
    gap_ = ((flat - Q[qv]) * NQs[qv]).sum(1)
    flat += NQs[qv] * np.maximum(0, 0.0028 - gap_)[:, None]
prof = flat.reshape(prof.shape)
NPf = prof.shape[1]
CV = prof.reshape(-1, 3); CT = []
for k in range(NA - 1):
    for j in range(NPf):
        a_, b_, c_, d_ = k * NPf + j, k * NPf + (j + 1) % NPf, (k + 1) * NPf + (j + 1) % NPf, (k + 1) * NPf + j
        CT += [[a_, b_, c_], [a_, c_, d_]]
ends = []
for k in (0, NA - 1):
    ci = len(CV) + len(ends); ends.append(prof[k].mean(0))
    for j in range(NPf): CT.append([ci, k * NPf + j, k * NPf + (j + 1) % NPf])
CV = np.vstack([CV, ends]); CT = np.array(CT)
def orient_out(V_, T_, ctr):
    n = np.cross(V_[T_[:, 1]] - V_[T_[:, 0]], V_[T_[:, 2]] - V_[T_[:, 0]]); return n
# orient each tube face so it faces away from the profile centre line
ctrl = np.repeat(prof.mean(1), NPf, 0); ctrl = np.vstack([ctrl, ends])
n_ = np.cross(CV[CT[:, 1]] - CV[CT[:, 0]], CV[CT[:, 2]] - CV[CT[:, 0]]); fc = CV[CT].mean(1)
refc = ctrl[CT[:, 0]]
flip = (n_ * (fc - refc)).sum(1) < 0; CT[flip] = CT[flip][:, [0, 2, 1]]
d_, i_ = stree.query(CV); CW = W[shirtIdx[i_]].copy()
hgt = CV[:, 1] - np.interp(np.arctan2(CV[:, 0] - cc[0], CV[:, 2] - cc[2]), la, ly, period=2 * np.pi)
upk = np.clip(hgt / 0.03, 0, 1) * 0.45
CW = CW * (1 - upk)[:, None]; CW[:, BI['neck']] += upk
# placket: a raised strip down the chest front with two buttons
front = shirtIdx[(NQs[shirtIdx, 2] > 0.35) & (np.abs(Q[shirtIdx, 0]) < 0.08) & (Q[shirtIdx, 1] > nk[1] - 0.25)]
zf = lambda xx, yy: griddata(Q[front][:, :2], Q[front][:, 2], np.c_[xx, yy], method='linear')
ytop = neckline(0.0) - 0.002; ybot = ytop - 0.115
PX = np.array([-0.0155, -0.0145, 0.0145, 0.0155]); PYs = np.linspace(ytop, ybot, 14)
PV_ = []
for yy in PYs:
    zz = zf(PX, np.full(4, yy))
    for xx, z0, lift in zip(PX, zz, [0.0006, 0.0028, 0.0028, 0.0006]): PV_.append([xx, yy, z0 + lift])
PV_ = np.array(PV_); PT = []
for i in range(len(PYs) - 1):
    for j in range(3):
        a_, b_, c_, d_ = i * 4 + j, i * 4 + j + 1, (i + 1) * 4 + j + 1, (i + 1) * 4 + j
        PT += [[a_, c_, b_], [a_, d_, c_]]
PT = np.array(PT)
n_ = np.cross(PV_[PT[:, 1]] - PV_[PT[:, 0]], PV_[PT[:, 2]] - PV_[PT[:, 0]]); fl = n_[:, 2] < 0; PT[fl] = PT[fl][:, [0, 2, 1]]
d_, i_ = stree.query(PV_); PW = W[shirtIdx[i_]]
BV, BT_ = [], []
for by in (ytop - 0.030, ytop - 0.075):
    z0 = float(zf(np.array([0.0]), np.array([by]))[0]) + 0.0028
    c0 = len(BV); BV.append([0, by, z0 + 0.0022])
    for k in range(16):
        a = 2 * np.pi * k / 16; BV.append([0.0058 * np.cos(a), by + 0.0058 * np.sin(a), z0 + 0.0014]); BV.append([0.0062 * np.cos(a), by + 0.0062 * np.sin(a), z0 - 0.0003])
    for k in range(16):
        k1 = (k + 1) % 16
        BT_ += [[c0, c0 + 1 + 2 * k, c0 + 1 + 2 * k1], [c0 + 1 + 2 * k, c0 + 2 + 2 * k, c0 + 2 + 2 * k1], [c0 + 1 + 2 * k, c0 + 2 + 2 * k1, c0 + 1 + 2 * k1]]
BV = np.array(BV); BT_ = np.array(BT_)
n_ = np.cross(BV[BT_[:, 1]] - BV[BT_[:, 0]], BV[BT_[:, 2]] - BV[BT_[:, 0]]); fl = n_[:, 2] < 0; BT_[fl] = BT_[fl][:, [0, 2, 1]]
d_, i_ = stree.query(BV); BWt = W[shirtIdx[i_]]
# ---------- assemble one mesh with material groups ----------
mats = ['skin', 'shirt', 'trousers', 'belt', 'sock', 'shoe', 'shoeacc', 'mid', 'sole', 'lace', 'button', 'cuff', 'buckle', 'glove', 'cap', 'hair1', 'hair2', 'hair3', 'hair4', 'eye', 'cornea', 'hidden']
verts = []  # (pos, nrm, uv, wts, part, mat)
# unique (vertex, uv) pairs for the body
key = {}
out_idx = {m: [] for m in mats}
ARMD = np.isin(dom, [BI[n] for n in ['uarmL', 'uarmR', 'farmL', 'farmR']]) | ARMZ_
def facemat(q):
    if EDGE[q].any() and not EDGE[q].all():
        er = [r_ for r_ in R[q][EDGE[q]] if r_ in ('shirt', 'trousers', 'glove')]
    ne = R[q][~EDGE[q]]
    if ARMD[q].any() and 'shirt' in R[q] and 'skin' in ne: return 'skin'      # ragged sleeve edge: the cuff covers it
    rs = list(R[q]) if EDGE[q].all() or not EDGE[q].any() else list(R[q][~EDGE[q]])
    for m in ['hidden', 'belt', 'glove']:
        if rs.count(m) >= min(2, len(rs)): return m
    if 'trousers' in rs and 'sock' in rs: return 'trousers'
    return max(sorted(set(rs), key=lambda m: PRI.index(m) if m in PRI else 9), key=rs.count)
NQ = vnormals(Q, TR)
PV, NV, UV, WV, MV = [], [], [], [], []
def addv(p, n, uv, w):
    PV.append(p); NV.append(n); UV.append(uv); WV.append(w); return len(PV) - 1
for q, qt in zip(FQ, BFT):
    m = facemat(q); ids = []
    for v, t in zip(q, qt):
        k = (v, t, m in ('skin',))
        if k not in key: key[k] = addv(P[v] if (m == 'skin' and (ARMD[v] or not EDGE[v])) else Q[v], N0[v] if m == 'skin' else NQ[v], VT[t], W[v])
        ids.append(key[k])
    out_idx[m] += [ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]]
# cap
headW = np.zeros(len(simple)); headW[BI['head']] = 1
import cap as capmod
scalp = P[headV & (y > eyeY + 0.03) & (R == 'skin')]
CVx, CTx, CUV, capC, capR = capmod.build(scalp, eyeY, headC[0])
print('cap ellipsoid', capC.round(3), capR.round(3))
CNx = vnormals(CVx, CTx); cbase = len(PV)
for k in range(len(CVx)): addv(CVx[k], CNx[k], CUV[k], headW)
out_idx['cap'] += list((CTx + cbase).ravel())
# hair shells: four layers over the hair region, alpha-tested against golfer-hair.png
hfi = np.where((HF[FQ] > 0.0).any(1) & headV[FQ].all(1))[0]
huv = VT[np.array(BFT, dtype=object)[hfi].tolist()].reshape(-1, 2) if False else np.array([VT[t] for fi in hfi for t in BFT[fi]])
HLO = huv.min(0) - 0.01; HHI = huv.max(0) + 0.01
for li, off in enumerate([0.0012, 0.0026, 0.0040, 0.0054][:int(os.environ.get('NHAIR', 4))]):
    hk = {}; lst = out_idx.setdefault('hair%d' % (li + 1), [])
    for fi in hfi:
        ids = []
        for v, t in zip(FQ[fi], BFT[fi]):
            if (v, t) not in hk: hk[(v, t)] = addv(P[v] + N0[v] * off * (0.3 + 0.7 * HF[v]), N0[v], (VT[t] - HLO) / (HHI - HLO), W[v])
            ids.append(hk[(v, t)])
        lst += [ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]]
print('hair faces', len(hfi))
col, nm = capmod.paint(); col.resize((512, 512), Image.LANCZOS).save(OUT + 'golfer-cap.jpg', quality=88); nm.resize((512, 512), Image.LANCZOS).save(OUT + 'golfer-cap-n.jpg', quality=88)
for Vx_, Tx_, Wx_, m_ in [(CV, CT, CW, 'shirt'), (PV_, PT, PW, 'shirt'), (BV, BT_, BWt, 'button')]:
    Nx_ = vnormals(Vx_, Tx_); b0 = len(PV)
    for k in range(len(Vx_)): addv(Vx_[k], Nx_[k], [0, 0], Wx_[k])
    out_idx[m_] += list((Tx_ + b0).ravel())
# ---------- hem bands: ribbed sleeve cuffs and a leather belt with buckle, built as clean rings over the garment edges ----------
def ring_band(o, d, t0, t1, pts, clear, NT=64, thick=0.0025, roll=True, ptsW=None, scale_t=None):
    d = d / np.linalg.norm(d); u = np.cross(d, [0, 0, 1.0])
    if np.linalg.norm(u) < 0.2: u = np.cross(d, [1.0, 0, 0])
    u /= np.linalg.norm(u); v = np.cross(d, u)
    rel = pts - o; t = rel @ d; sel = (t > t0 - 0.012) & (t < t1 + 0.012); rel = rel[sel]
    ang = np.arctan2(rel @ v, rel @ u); rad = np.hypot(rel @ u, rel @ v)
    keep = rad < np.percentile(rad, 50) * 1.6; ang, rad = ang[keep], rad[keep]
    th = np.linspace(-np.pi, np.pi, NT, endpoint=False); r = np.zeros(NT)
    for k, a in enumerate(th):
        w = np.abs(((ang - a) + np.pi) % (2 * np.pi) - np.pi) < 0.22
        r[k] = rad[w].max() if w.any() else rad.max()
    for _ in range(6): r = np.maximum(r, 0.5 * r + 0.25 * (np.roll(r, 1) + np.roll(r, -1)))
    for _ in range(4): r = 0.5 * r + 0.25 * (np.roll(r, 1) + np.roll(r, -1))
    r += clear
    # profile: outer face t0->t1, rolled edges, inner face back
    prof = [(t0, -thick * 0.6), (t0 - 0.0012, 0.0), (t0, thick * 0.4), (t1, thick * 0.4), (t1 + 0.0012, 0.0), (t1, -thick * 0.6)]
    V_ = []; UVr = []
    for k, a in enumerate(th):
        rd = np.cos(a) * u + np.sin(a) * v
        for j, (tt, dr) in enumerate(prof): V_.append(o + d * tt + rd * (r[k] + dr)); UVr.append([k / NT, j / (len(prof) - 1)])
    V_ = np.array(V_); NPf_ = len(prof); T_ = []
    for k in range(NT):
        k1 = (k + 1) % NT
        for j in range(NPf_):
            j1 = (j + 1) % NPf_
            T_ += [[k * NPf_ + j, k1 * NPf_ + j, k1 * NPf_ + j1], [k * NPf_ + j, k1 * NPf_ + j1, k * NPf_ + j1]]
    T_ = np.array(T_)
    ctr = o + d * ((V_ - o) @ d)[:, None]
    n_ = np.cross(V_[T_[:, 1]] - V_[T_[:, 0]], V_[T_[:, 2]] - V_[T_[:, 0]]); fc = V_[T_].mean(1); cf = o + d * (((fc - o) @ d))[:, None]
    fl = (n_ * (fc - cf)).sum(1) < 0
    # inner faces (the last profile segment pair) should face inward: handled by DoubleSide-free trick — flip only outer-facing test on outer rows
    T_[fl] = T_[fl][:, [0, 2, 1]]
    return V_, T_, np.array(UVr), (o, d, u, v, th, r)
bodyTree = cKDTree(P)
def weights_at(V_):
    dd, ii = bodyTree.query(V_, k=6); w = 1 / np.maximum(dd, 1e-4); w /= w.sum(1, keepdims=True)
    return (W[ii] * w[:, :, None]).sum(1)
BANDS = []
for sd in SIDES:
    h, t = rest['uarm' + sd]; L = np.linalg.norm(t - h)
    zone = np.isin(dom, [BI['uarm' + sd], BI['farm' + sd]]) & ((P[:, 0] > 0) == (sd == 'L'))
    pts = np.vstack([Q[zone & (R == 'shirt')], P[zone]])
    Vb, Tb, Ub, info = ring_band(h, t - h, 0.43 * L, 0.50 * L, pts, 0.0020)
    BANDS.append((Vb, Tb, Ub, weights_at(Vb), 'cuff'))
hc = np.array([0, waistY - 0.004, 0])
zone = (np.abs(y - hc[1]) < 0.05) & np.isin(dom, [BI['hips'], BI['spine'], BI['thighL'], BI['thighR']])
pts = np.vstack([Q[zone & np.isin(R, ['trousers', 'belt', 'shirt'])], P[zone]])
hc[2] = (pts[:, 2].min() + pts[:, 2].max()) / 2
print('belt pts', len(pts), np.ptp(pts, 0).round(3)); Vb, Tb, Ub, binfo = ring_band(hc - [0, 0.016, 0], np.array([0, 1.0, 0]), 0.0, 0.032, pts, 0.0025, NT=96, thick=0.0035)
print('belt r', binfo[5].min().round(3), binfo[5].max().round(3), 'hc', hc.round(3), 'pts x', pts[:,0].min().round(3), pts[:,0].max().round(3)); BANDS.append((Vb, Tb, Ub, weights_at(Vb), 'belt'))
# buckle: a brushed metal frame at the front of the belt
bo, bd, bu, bv, bth, br = binfo
fk = np.argmin(np.abs(((bth - np.arctan2(1.0 * (bv @ [0, 0, 1]), bu @ [0, 0, 1])) + np.pi) % (2 * np.pi) - np.pi))
fdir = np.cos(bth[fk]) * bu + np.sin(bth[fk]) * bv; side_ = np.cross(bd, fdir)
bc = bo + bd * 0.016 + fdir * (br[fk] + 0.0045)
BV2 = []; BT2 = []
def box(c, ax, ay, az):
    b0 = len(BV2)
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1): BV2.append(c + ax * sx + ay * sy + az * sz)
    for f in [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]:
        a_, b_, c_, d_ = [b0 + i for i in f]; BT2.extend([[a_, b_, c_], [a_, c_, d_]])
hw_, hh_, bt_, fz = 0.024, 0.021, 0.0035, 0.0018
box(bc + bd * (hh_ - bt_ / 2), side_ * hw_, bd * bt_ / 2, fdir * fz)
box(bc - bd * (hh_ - bt_ / 2), side_ * hw_, bd * bt_ / 2, fdir * fz)
box(bc + side_ * (hw_ - bt_ / 2), side_ * bt_ / 2, bd * hh_, fdir * fz)
box(bc - side_ * (hw_ - bt_ / 2), side_ * bt_ / 2, bd * hh_, fdir * fz)
box(bc + side_ * 0.004, side_ * 0.0012, bd * (hh_ - 0.002), fdir * fz * 0.8)    # prong
BV2 = np.array(BV2); BT2 = np.array(BT2)
n_ = np.cross(BV2[BT2[:, 1]] - BV2[BT2[:, 0]], BV2[BT2[:, 2]] - BV2[BT2[:, 0]])
# boxes are built consistently; make sure they face outward from each box centre
for bi in range(len(BT2) // 12):
    seg = BT2[bi * 12:(bi + 1) * 12]; c_ = BV2[seg].reshape(-1, 3).mean(0)
    nn = np.cross(BV2[seg[:, 1]] - BV2[seg[:, 0]], BV2[seg[:, 2]] - BV2[seg[:, 0]]); fl = (nn * (BV2[seg].mean(1) - c_)).sum(1) < 0
    seg[fl] = seg[fl][:, [0, 2, 1]]; BT2[bi * 12:(bi + 1) * 12] = seg
BANDS.append((BV2, BT2, np.zeros((len(BV2), 2)), weights_at(BV2), 'buckle'))
# belt loops on the trousers
for la_ in np.radians([-150, -95, -40, 40, 95, 150]):
    a0 = bth[fk] + la_; k = int(np.argmin(np.abs(((bth - a0) + np.pi) % (2 * np.pi) - np.pi)))
    fd_ = np.cos(bth[k]) * bu + np.sin(bth[k]) * bv; sd2 = np.cross(bd, fd_)
    c_ = bo + bd * 0.016 + fd_ * (br[k] + 0.0042); b0 = len(BV2)
    BVl = []; BTl = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1): BVl.append(c_ + sd2 * 0.005 * sx + bd * 0.021 * sy + fd_ * 0.0012 * sz)
    for f in [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]:
        a_, b_, c2_, d_ = f; BTl.extend([[a_, b_, c2_], [a_, c2_, d_]])
    BVl = np.array(BVl); BTl = np.array(BTl); cc_ = BVl.mean(0)
    nn = np.cross(BVl[BTl[:, 1]] - BVl[BTl[:, 0]], BVl[BTl[:, 2]] - BVl[BTl[:, 0]]); fl = (nn * (BVl[BTl].mean(1) - cc_)).sum(1) < 0; BTl[fl] = BTl[fl][:, [0, 2, 1]]
    BANDS.append((BVl, BTl, np.zeros((8, 2)), weights_at(BVl), 'trousers'))
for Vb, Tb, Ub, Wb, m_ in BANDS:
    Nb = vnormals(Vb, Tb); b0 = len(PV)
    for k in range(len(Vb)): addv(Vb[k], Nb[k], Ub[k], Wb[k])
    out_idx.setdefault(m_, []); out_idx[m_] += list((Tb + b0).ravel())
# ---------- golf shoes: lofted from the foot's own measurements ----------
def add_part(Vx, tris_mat, Wx, smoothN=True):
    Nx = vnormals(Vx, np.concatenate([t for t in tris_mat.values() if len(t)]))
    base = len(PV)
    for k in range(len(Vx)): addv(Vx[k], Nx[k], [0, 0], Wx[k])
    for m, t in tris_mat.items():
        if len(t): out_idx[m] += list((np.asarray(t) + base).ravel())
def loft(rings, cap0=True, cap1=True):
    """rings: (S, M, 3) -> verts, quads as tris (outward if rings go back->front and angles run counter-clockwise seen from the front)"""
    S, Mr, _ = rings.shape; V = rings.reshape(-1, 3); T = []
    for i in range(S - 1):
        for j in range(Mr):
            a, b, c, d = i * Mr + j, i * Mr + (j + 1) % Mr, (i + 1) * Mr + (j + 1) % Mr, (i + 1) * Mr + j
            T += [[a, b, c], [a, c, d]]
    extra = []
    for k, (on, ri) in enumerate([(cap0, 0), (cap1, S - 1)]):
        if not on: continue
        ci = len(V) + len(extra); extra.append(rings[ri].mean(0))
        for j in range(Mr):
            a, b = ri * Mr + j, ri * Mr + (j + 1) % Mr
            T.append([ci, b, a] if k == 0 else [ci, a, b])
    return np.vstack([V] + ([np.array(extra)] if extra else [])), np.array(T)
def orient(V, T):
    c = V.mean(0); n = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]]); f = V[T].mean(1) - c
    if (np.sign((n * f).sum(1))).sum() < 0: T = T[:, [0, 2, 1]]
    return T
import shoes
for sd in SIDES:
    side = (P[:, 0] > 0) if sd == 'L' else (P[:, 0] <= 0)
    sh_ = shoes.build(P[(R == 'hidden') & side])
    Wx = np.zeros((len(sh_['V']), len(simple))); Wx[:, BI['foot' + sd]] = 1
    upw = np.clip((sh_['yl'] - 0.065) / 0.03, 0, 1) * np.clip((0.4 - sh_['fv']) / 0.2, 0, 1) * 0.35
    Wx[:, BI['foot' + sd]] -= upw; Wx[:, BI['shin' + sd]] += upw
    Nx = vnormals(sh_['V'], sh_['T']); base = len(PV)
    for k in range(len(sh_['V'])): addv(sh_['V'][k], Nx[k], sh_['UV'][k], Wx[k])
    out_idx['shoe'] += list((sh_['T'] + base).ravel())
    if sd == 'L':
        col, nm = shoes.paint(sh_); col.save(OUT + 'golfer-shoe.jpg', quality=88); nm.save(OUT + 'golfer-shoe-n.jpg', quality=92)
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
img = np.zeros((TS, TS, 8)); wsum = np.zeros((TS, TS))
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
XP = img[..., 4:7].reshape(-1, 3); HWt = img[..., 7].reshape(-1)
hairA = (hair_field(XP, HWt) * mask.reshape(-1)).reshape(TS, TS)
img = img[..., :3]
hm_ = hairA[..., None]; img = img * (1 - 0.8 * hm_) + np.array([0.16, 0.12, 0.09]) * 0.8 * hm_
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
# hair: strands in the head's uv space; alpha = density (thins out at the hairline)
HS = 1024
ha = np.asarray(Image.fromarray((np.clip(hairA, 0, 1) * 255).astype(np.uint8)).resize((HS, HS), Image.BILINEAR).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2))) / 255.0
sn = rng.random((HS, HS))
st = np.asarray(Image.fromarray((sn * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))) / 255.0
strands = np.zeros((HS, HS))
for k in range(9): strands += np.roll(st, k - 4, 0)          # short vertical strokes
strands = (strands / 9 - 0.5) * 5 + 0.5
strands = np.clip(strands, 0, 1)
A = np.clip(ha * (0.35 + 0.9 * strands), 0, 1)
base = np.array([46, 34, 25.0]) * (0.75 + 0.5 * strands[..., None]) + (rng.random((HS, HS, 1)) - 0.5) * 10
hairImg = np.dstack([np.clip(base, 0, 255), A * 255]).astype(np.uint8)
x0, x1 = int(HLO[0] * HS), int(HHI[0] * HS); y0, y1 = int((1 - HHI[1]) * HS), int((1 - HLO[1]) * HS)
hairImg = hairImg[y0:y1, x0:x1]; hairImg[hairImg[..., 3] < 8, :3] = [46, 34, 25]
print('hair tex', hairImg.shape)
Image.fromarray(hairImg, 'RGBA').quantize(48, method=Image.FASTOCTREE).save(OUT + 'golfer-hair.png', optimize=True)

# ---------- write ----------
out_idx['hidden'] = []
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
import shutil; shutil.copy(OUT + 'golfer.bin', OUT + 'golfer-mesh.wasm')
import shutil; shutil.copy(OUT + 'golfer.bin', OUT + 'golfer-mesh.wasm')
