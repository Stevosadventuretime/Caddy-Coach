# Minimal BVH reader with forward kinematics: world joint positions per frame, in metres, y up.
# Made for the CMU motion-capture BVH conversion (frame 0 is a T-pose added by the converter; it is dropped).
import numpy as np

def _euler(order, angs):
    R = np.eye(3)
    for ax, a in zip(order, np.radians(angs)):
        c, s = np.cos(a), np.sin(a)
        R = R @ np.array({'X': [[1, 0, 0], [0, c, -s], [0, s, c]], 'Y': [[c, 0, s], [0, 1, 0], [-s, 0, c]], 'Z': [[c, -s, 0], [s, c, 0], [0, 0, 1]]}[ax])
    return R

def _parse(path):
    with open(path) as fh: tok = fh.read().split()
    i = 0; joints = []; stack = []
    while tok[i] != 'MOTION':
        t = tok[i]
        if t in ('ROOT', 'JOINT'): joints.append({'name': tok[i + 1], 'parent': stack[-1] if stack else -1}); i += 2
        elif t == 'End': joints.append({'name': joints[stack[-1]]['name'] + '_end', 'parent': stack[-1]}); i += 2
        elif t == '{': stack.append(len(joints) - 1); i += 1
        elif t == '}': stack.pop(); i += 1
        elif t == 'OFFSET': joints[-1]['off'] = np.array(list(map(float, tok[i + 1:i + 4]))); i += 4
        elif t == 'CHANNELS': n = int(tok[i + 1]); joints[-1]['ch'] = tok[i + 2:i + 2 + n]; i += 2 + n
        else: i += 1
    nf = int(tok[i + 2]); ft = float(tok[i + 5])
    data = np.array(tok[i + 6:i + 6 + nf * sum(len(j.get('ch', [])) for j in joints)], float).reshape(nf, -1)
    return joints, data, ft

def load(path, height=1.75):
    """(names, pos[F, J, 3] metres, frame_time). Frame 0 (T-pose) is used for scale, then dropped."""
    joints, data, ft = _parse(path); nf = len(data)
    pos = np.zeros((nf, len(joints), 3)); rot = [None] * len(joints); col = 0
    for j, J in enumerate(joints):
        ch = J.get('ch', []); vals = data[:, col:col + len(ch)]; col += len(ch)
        tr = np.zeros((nf, 3)); order = ''.join(c[0] for c in ch if c.endswith('rotation')); ra = []
        for k, c in enumerate(ch):
            if c.endswith('position'): tr[:, 'XYZ'.index(c[0])] = vals[:, k]
            else: ra.append(vals[:, k])
        Rl = np.array([_euler(order, a) for a in np.array(ra).T]) if order else np.tile(np.eye(3), (nf, 1, 1))
        if J['parent'] < 0: pos[:, j] = J['off'] + tr; rot[j] = Rl
        else: p = J['parent']; pos[:, j] = pos[:, p] + np.einsum('fij,j->fi', rot[p], J['off']); rot[j] = rot[p] @ Rl
    names = [J['name'] for J in joints]; ix = {n: i for i, n in enumerate(names)}
    head_top = pos[0, ix['Head_end'] if 'Head_end' in ix else ix['Head'], 1]
    k = height / (head_top - pos[0, :, 1].min())
    pos = pos[1:] * k
    ground = np.median(pos[:, :, 1].min(axis=1))        # the feet are planted for most of a swing
    return names, pos - [0, ground, 0], ft
