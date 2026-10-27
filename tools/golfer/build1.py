# Step 1: load the MakeHuman base mesh, shape a golfer with the macro targets, find the joints.
import numpy as np, json, os, re, collections
D = os.path.dirname(os.path.abspath(__file__)) + '/mh1/makehuman/data/'

def load_obj(p):
    V, VT, F, FT, G = [], [], [], [], []
    g = None
    for l in open(p):
        if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('vt '): VT.append([float(x) for x in l.split()[1:3]])
        elif l.startswith('g '): g = l.split()[1]
        elif l.startswith('f '):
            idx = [w.split('/') for w in l.split()[1:]]
            F.append([int(a[0]) - 1 for a in idx]); FT.append([int(a[1]) - 1 for a in idx]); G.append(g)
    return np.array(V), np.array(VT), F, FT, G

def load_target(name):
    d = {}
    for l in open(D + 'targets/' + name + '.target'):
        if l[:1] in '#\n' or not l.strip(): continue
        a = l.split(); d[int(a[0])] = [float(x) for x in a[1:4]]
    idx = np.array(list(d.keys()), dtype=int); off = np.array(list(d.values()), dtype=float).reshape(-1, 3)
    return idx, off

def golfer_targets(caucasian=0.8, muscle=0.58, weight=0.56, height=0.62, prop=0.6):
    T = []
    mus = [('averagemuscle', 1 - abs(muscle - 0.5) * 2), ('maxmuscle' if muscle > 0.5 else 'minmuscle', abs(muscle - 0.5) * 2)]
    wts = [('averageweight', 1 - abs(weight - 0.5) * 2), ('maxweight' if weight > 0.5 else 'minweight', abs(weight - 0.5) * 2)]
    for m, mw in mus:
        for w, ww in wts:
            k = mw * ww
            if k <= 0: continue
            T.append((f'macrodetails/universal-male-young-{m}-{w}', k))
            h = (height - 0.5) * 2
            T.append((f'macrodetails/height/male-young-{m}-{w}-{"maxheight" if h > 0 else "minheight"}', k * abs(h)))
            T.append((f'macrodetails/proportions/male-young-{m}-{w}-idealproportions', k * prop))
    for race, rw in [('caucasian', caucasian), ('african', (1 - caucasian) / 2), ('asian', (1 - caucasian) / 2)]:
        T.append((f'macrodetails/{race}-male-young', rw))
    return T

def build(extra=()):
    V, VT, F, FT, G = load_obj(D + '3dobjs/base.obj')
    for name, w in golfer_targets() + list(extra):
        if w == 0: continue
        i, o = load_target(name); V[i] += o * w
    return V, VT, F, FT, G

if __name__ == '__main__':
    V, VT, F, FT, G = build()
    sk = json.load(open(D + 'rigs/default.mhskel'))
    J = {k: V[v].mean(0) for k, v in sk['joints'].items()}
    body = [i for i, g in enumerate(G) if g == 'body']
    bv = np.unique(np.array([F[i] for i in body]).ravel())
    lo, hi = V[bv].min(0), V[bv].max(0)
    print('body verts', len(bv), 'faces', len(body), 'bbox', lo.round(2), hi.round(2), 'height dm', (hi[1] - lo[1]).round(2))
    for b in ['root', 'spine05', 'spine01', 'neck01', 'head', 'upperarm01.L', 'lowerarm01.L', 'wrist.L', 'upperleg01.L', 'lowerleg01.L', 'foot.L', 'toe1-1.L', 'clavicle.L', 'shoulder01.L']:
        bb = sk['bones'][b]; print(b, 'parent', bb['parent'], 'head', J[bb['head']].round(2), 'tail', J[bb['tail']].round(2))
