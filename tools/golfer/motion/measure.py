# Swing phases and turn angles from motion-capture joint positions; choosing the best CMU swing.
import numpy as np
import bvh

TARGET = dict(shTop=90.0, hipTop=45.0, hipImp=-40.0, shImp=-22.0)

def _ix(names): return {n: i for i, n in enumerate(names)}
def _hands(names, pos):
    ix = _ix(names); return (pos[:, ix['LeftHand']] + pos[:, ix['RightHand']]) / 2

def phases(names, pos, fps):
    h = _hands(names, pos); hy = h[:, 1]
    v = np.r_[0, np.linalg.norm(np.diff(h, axis=0), axis=1)] * fps
    vmax = int(np.argmax(v)); top = int(np.argmax(hy[:vmax]))
    lo = hy[:top].min(); rng = hy[top] - lo
    address = int(np.where(hy[:top] < lo + 0.03 * rng)[0][-1])
    impact = top + int(np.argmin(hy[top:top + int(0.9 * fps)]))
    finish = impact + int(np.argmax(hy[impact:impact + int(1.2 * fps)]))
    up = lambda f: address + int(np.argmax(hy[address:top + 1] >= hy[address] + f * (hy[top] - hy[address])))
    down = top + int(np.argmax(hy[top:impact + 1] <= hy[address] + 0.6 * (hy[top] - hy[address])))
    through = impact + int(np.argmax(hy[impact:finish + 1] >= hy[impact] + 0.6 * (hy[finish] - hy[impact])))
    return dict(address=address, takeaway=up(0.25), half=up(0.6), top=top, down=down, impact=impact, through=through, finish=finish)

def _angles(line, axis, ref):
    """signed angle (deg) of each line about axis, relative to ref, after projecting onto the plane normal to axis"""
    pl = line - np.outer(line @ axis, axis); r = ref - axis * (ref @ axis)
    pl /= np.linalg.norm(pl, axis=1, keepdims=True); r /= np.linalg.norm(r)
    return np.degrees(np.arctan2((np.cross(r, pl) @ axis), pl @ r))

def turns(names, pos, ph, fps=120.0):
    ix = _ix(names); a = ph['address']
    pel = (pos[:, ix['LeftUpLeg']] + pos[:, ix['RightUpLeg']]) / 2; msh = (pos[:, ix['LeftArm']] + pos[:, ix['RightArm']]) / 2
    spine = msh[a] - pel[a]; spine /= np.linalg.norm(spine)
    hipl = pos[:, ix['LeftUpLeg']] - pos[:, ix['RightUpLeg']]; shl = pos[:, ix['LeftArm']] - pos[:, ix['RightArm']]
    up = np.array([0, 1.0, 0])
    S = _angles(shl, spine, shl[a]); H = _angles(hipl, up, hipl[a])
    # sign: turning back (away from the target) is positive; the backswing turns the shoulders back
    sg = 1 if S[ph['top']] > 0 else -1; S, H = S * sg, H * sg
    t, i, f = ph['top'], ph['impact'], ph['finish']
    return dict(shTop=S[t], hipTop=H[t], shImp=S[i], hipImp=H[i], shFin=S[f], hipFin=H[f],
                back_s=(t - a) / fps, down_s=(i - t) / fps, tempo=(t - a) / max(i - t, 1))

def glitchy(names, pos, ph):
    jump = np.linalg.norm(np.diff(pos, axis=0), axis=2).max() > 0.15
    ix = _ix(names); a, tk = ph['address'], ph['takeaway']; seg = slice(max(0, a - 30), tk)
    slide = max(np.linalg.norm(pos[seg, ix[n]] - pos[a, ix[n]], axis=1).max() for n in ('LeftFoot', 'RightFoot'))
    return bool(jump or slide > 0.03)

def choose(paths):
    best, bs = None, 1e9
    for p in paths:
        n, pos, ft = bvh.load(p); ph = phases(n, pos, 1 / ft)
        if glitchy(n, pos, ph): continue
        t = turns(n, pos, ph, 1 / ft)
        score = sum(abs(t[k] - v) for k, v in TARGET.items()) + 20 * abs(t['tempo'] - 3)
        if score < bs: best, bs = p, score
    return best
