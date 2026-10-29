# Put a CMU swing into the drill world (x to the target, y up, z to the ball) and onto the golfer's own proportions.
import json, struct
import numpy as np

def _ix(names): return {n: i for i, n in enumerate(names)}
def _unit(v): return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)

def golfer_bones(mesh_path):
    """Bone lengths and rest landmarks of the 3D golfer, read from golfer-mesh.wasm."""
    b = open(mesh_path, 'rb').read(); n = struct.unpack('<I', b[4:8])[0]; meta = json.loads(b[8:8 + n])
    B = {x['n']: (np.array(x['h']), np.array(x['t'])) for x in meta['bones']}
    L = lambda a, b=None: float(np.linalg.norm(B[a][1] - B[a][0])) if b is None else float(np.linalg.norm(B[b][1] - B[a][0]))
    pel = B['hips'][0]
    return dict(thigh=L('thighL'), shin=L('shinL'), foot=L('footL'), uarm=L('uarmL'), forearm=L('farmL', 'ftwL'), hand=L('handL'),
                hipw=float(abs(B['thighL'][0][0])), torso=float(np.linalg.norm(B['neck'][0] - pel)),
                shoulder=B['uarmL'][0] - pel, height=float(B['head'][1][1]), ankle=float(B['footL'][0][1]))

def to_world(names, pos, ph):
    """Rotate about y so the address hip line points to +x and the golfer faces +z; mid-ankles at the origin."""
    ix = _ix(names); a = ph['address']
    hip = pos[a, ix['LeftUpLeg']] - pos[a, ix['RightUpLeg']]; ang = np.arctan2(hip[2], hip[0])
    c, s = np.cos(ang), np.sin(ang); R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])      # turns hip onto +x
    W = pos @ R.T
    pel = (W[a, ix['LeftUpLeg']] + W[a, ix['RightUpLeg']]) / 2; hands = (W[a, ix['LeftHand']] + W[a, ix['RightHand']]) / 2
    if hands[2] < pel[2]: W[..., 2] *= -1          # the BVH's handedness: make sure the hands are on the ball side
    mid = (W[a, ix['LeftFoot']] + W[a, ix['RightFoot']]) / 2
    return W - [mid[0], 0, mid[2]]

def _ik(A, T, a, b, pole):
    d = T - A; L = np.linalg.norm(d, axis=-1, keepdims=True); dr = d / np.maximum(L, 1e-9)
    L = np.clip(L, abs(a - b) + 1e-4, a + b - 1e-4)
    along = (a * a - b * b + L * L) / (2 * L); h = np.sqrt(np.maximum(0, a * a - along * along))
    p = pole - dr * (pole * dr).sum(-1, keepdims=True); p = _unit(p)
    return A + dr * along + p * h, A + dr * L

def to_golfer(W, names, B, ph, fps):
    ix = _ix(names); g = lambda n: W[:, ix[n]]
    # overall size first, so the pelvis travels the right distances
    # size the capture by leg length, so the pelvis sits at a height the golfer's legs can reach
    leg = lambda S: np.median(np.linalg.norm(g(S + 'Leg') - g(S + 'UpLeg'), axis=1) + np.linalg.norm(g(S + 'Foot') - g(S + 'Leg'), axis=1))
    k = (B['thigh'] + B['shin']) / ((leg('Left') + leg('Right')) / 2)
    W = W * k; g = lambda n: W[:, ix[n]]
    J = {}
    hipC = (g('LeftUpLeg') + g('RightUpLeg')) / 2
    H = _unit(g('LeftUpLeg') - g('RightUpLeg')); J['pel'] = hipC
    s = _unit(g('Neck') - hipC); J['neck'] = hipC + s * B['torso']
    J['head'] = J['neck'] + _unit(g('Head') - g('Neck')) * 0.13
    Lt = g('LeftArm') - g('RightArm'); Lt = _unit(Lt - s * (Lt * s).sum(-1, keepdims=True)); F = _unit(np.cross(Lt, s))
    sh = B['shoulder']                                                     # rest offset of the lead shoulder from the pelvis
    # square stance: the capture's trail foot stands ~20 cm nearer the ball (open); put both balls of the feet on one
    # line parallel to the target line, at their mean distance from the ball, by sliding each foot toward/away from it
    a0 = ph['address']; tz = {S: g(S + 'ToeBase')[a0, 2] for S in ('Left', 'Right')}; mz = (tz['Left'] + tz['Right']) / 2
    for side, sg, S in (('l', 1, 'Left'), ('t', -1, 'Right')):
        J[side + 'hip'] = hipC + H * B['hipw'] * sg
        J[side + 's'] = hipC + s * sh[1] + Lt * sh[0] * sg + F * sh[2]
        J[side + 'e'] = J[side + 's'] + _unit(g(S + 'ForeArm') - g(S + 'Arm')) * B['uarm']
        J[side + 'w'] = J[side + 'e'] + _unit(g(S + 'Hand') - g(S + 'ForeArm')) * B['forearm']
        J[side + 'h'] = J[side + 'w'] + _unit(g(S + 'FingerBase') - g(S + 'Hand')) * B['hand'] * 0.55
        # feet: the ball of the foot stays put while it's planted (the heel may lift, as in the capture);
        # the ankle sits where the capture has it relative to the ball of the foot, and the leg bends to reach it
        toe = g(S + 'ToeBase').copy(); toe[:, 2] += mz - tz[S]
        # a golfer's feet don't slide: the lead foot's ball stays put the whole swing; the trail foot's until impact,
        # after which it follows the capture as the trail foot rolls up onto its toe (blended so it never jumps)
        n = len(toe); a0 = ph['address']; lock = toe.copy(); hold = toe[a0, [0, 2]]
        w = np.ones(n) if side == 'l' else np.clip(1 - (np.arange(n) - ph['impact']) / (0.15 * fps), 0, 1)
        follow = toe[:, [0, 2]] - (toe[ph['impact'], [0, 2]] - hold) if side == 't' else toe[:, [0, 2]]
        lock[:, [0, 2]] = w[:, None] * hold + (1 - w[:, None]) * follow
        ankC = g(S + 'Foot') + [0, 0, mz - tz[S]]; fdir = _unit(toe - ankC)
        tgt = lock - fdir * B['foot']
        pole = _unit(g(S + 'Leg') - (g(S + 'UpLeg') + ankC) / 2)
        J[side + 'k'], J[side + 'a'] = _ik(J[side + 'hip'], tgt, B['thigh'], B['shin'], pole)
        J[side + 't'] = J[side + 'a'] + fdir * B['foot']
        J[side + 'hl'] = J[side + 'a'] - fdir * 0.06 + np.array([0, -0.05, 0])
    # ground: planted toes at y = 0.02, like the rig
    a = ph['address']; dy = 0.02 - (J['lt'][a, 1] + J['tt'][a, 1]) / 2
    for n in J: J[n] = J[n] + [0, dy, 0]
    return J
