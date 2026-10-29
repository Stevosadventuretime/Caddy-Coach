# Tour-average adjustments for a captured swing (tempo, turn), the club, and the rig's derived joints.
import numpy as np
from scipy.ndimage import gaussian_filter1d

UP = np.array([0, 1.0, 0])
UPPER = ['neck', 'head', 'ls', 'le', 'lw', 'lh', 'ts', 'te', 'tw', 'th']
PH = ['address', 'takeaway', 'half', 'top', 'down', 'impact', 'through', 'finish']
TOP_SH, TOP_HIP, IMP_HIP, IMP_SH = 90.0, 45.0, -40.0, -22.5
CLEN = 0.89

def _unit(v): return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)
def _ss(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)

def _rot(axis, deg):
    a = np.radians(deg); k = axis / np.linalg.norm(axis); K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * K @ K

def _ang(line, axis, ref):
    pl = line - np.outer(line @ axis, axis); r = ref - axis * (ref @ axis)
    pl = _unit(pl); r = r / np.linalg.norm(r)
    return np.degrees(np.arctan2(np.cross(r, pl) @ axis, pl @ r))

def measure_turns(J, ph):
    """shoulder turn about the address spine axis and hip turn about vertical, degrees, + = turned back"""
    a = ph['address']; spine = _unit(J['neck'][a] - J['pel'][a])
    sl = J['ls'] - J['ts']; hl = J['lhip'] - J['thip']
    S = _ang(sl, spine, sl[a]); H = _ang(hl, UP, hl[a]); sg = 1 if S[ph['top']] > 0 else -1
    return S * sg, H * sg, sg

def retime(J, ph, fps, out_fps=60):
    a, t, i, f = ph['address'], ph['top'], ph['impact'], ph['finish']; n = len(J['pel'])
    start = max(0, a - int(0.6 * fps)); end = min(n - 1, f + int(1.0 * fps))
    src = np.array([start, a, t, i, f, end], float)
    ta = (a - start) / fps; tgt = np.array([0, ta, ta + 0.75, ta + 1.0, ta + 1.0 + (f - i) / fps, ta + 1.0 + (end - i) / fps])
    # speed of source frames per output second, smoothed so the change of pace at impact isn't a jolt
    T = np.arange(0, tgt[-1] + 1e-9, 1 / out_fps); rate = np.interp(T, (tgt[:-1] + tgt[1:]) / 2, np.diff(src) / np.diff(tgt))
    seg = np.searchsorted(tgt, T, side='right') - 1; seg = np.clip(seg, 0, len(tgt) - 2)
    raw = np.array([(src[k + 1] - src[k]) / (tgt[k + 1] - tgt[k]) for k in seg])
    rate = gaussian_filter1d(raw, 2.0)
    s = np.r_[0, np.cumsum((rate[:-1] + rate[1:]) / 2 / out_fps)] + start
    # pin the knots exactly: piecewise-linear correction between them
    kn = np.searchsorted(T, tgt - 1e-9).clip(0, len(T) - 1)
    s = s + np.interp(np.arange(len(T)), kn, src - s[kn])
    s = np.clip(s, 0, n - 1)
    i0 = np.floor(s).astype(int); i1 = np.minimum(i0 + 1, n - 1); w = (s - i0)[:, None]
    out = {k: v[i0] * (1 - w) + v[i1] * w for k, v in J.items()}
    newph = {k: int(np.argmin(np.abs(s - ph[k]))) for k in PH}
    return out, newph

def _legs(J, B):
    from retarget import _ik
    for sd in 'lt':
        pole = _unit(J[sd + 'k'] - (J[sd + 'hip'] + J[sd + 'a']) / 2)
        J[sd + 'k'], _ = _ik(J[sd + 'hip'], J[sd + 'a'], B['thigh'], B['shin'], pole)

def turns(J, ph, B):
    J = {k: v.copy() for k, v in J.items()}; n = len(J['pel']); fr = np.arange(n)
    for _ in range(3):
        S, H, sg = measure_turns(J, ph)
        # finish: turn the chest to face the target
        f = ph['finish']; Lt = _unit(J['ls'][f] - J['ts'][f]); s = _unit(J['neck'][f] - J['pel'][f]); F = np.cross(Lt, s); Fh = _unit(F * [1, 0, 1])
        fin = np.degrees(np.arctan2(np.cross(Fh, [1, 0, 0]) @ UP, Fh @ [1, 0, 0]))
        keys = [ph['address'], ph['top'], ph['impact'], ph['finish']]
        dS = [0, TOP_SH - S[ph['top']], IMP_SH - S[ph['impact']], fin * sg]
        dH = [0, TOP_HIP - H[ph['top']], IMP_HIP - H[ph['impact']], 0]
        def curve(vals):
            out = np.zeros(n)
            for k in range(len(keys) - 1):
                m = (fr >= keys[k]) & (fr <= keys[k + 1]); u = _ss((fr[m] - keys[k]) / max(keys[k + 1] - keys[k], 1))
                out[m] = vals[k] + (vals[k + 1] - vals[k]) * u
            out[fr > keys[-1]] = vals[-1]; return out
        cS, cH = curve(dS), curve(dH)
        if max(abs(np.array(dS[:3]))) < 0.5 and max(abs(np.array(dH[:3]))) < 0.5 and abs(dS[3]) < 2: break
        for j in range(n):
            p = J['pel'][j]; Rh = _rot(UP, cH[j] * sg)
            for k in UPPER + ['lhip', 'thip']: J[k][j] = p + Rh @ (J[k][j] - p)
            ax = _unit(J['neck'][j] - p); Rs = _rot(ax, (cS[j] - cH[j]) * sg)
            for k in UPPER: J[k][j] = p + Rs @ (J[k][j] - p)
        _legs(J, B)
    return J

HINGE = dict(address=28, takeaway=45, half=85, top=80, down=85, impact=24, through=-80, finish=-115)   # negative: the wrists re-hinge the other way after impact   # forearm-to-shaft angle

BALL_Y = 0.03
BEND = 32.0         # spine forward bend at address (pelvis to neck, from vertical)

def ball_for(J, ph):
    """the ball sits where the club rests at address, on the ground straight out toward the ball (+z)"""
    A = J['lh'][ph['address']]
    return np.array([A[0], BALL_Y, A[2] + np.sqrt(max(CLEN ** 2 - (A[1] - BALL_Y) ** 2, 0))])

def reach(J, ph, B, out_fps=60):
    """let the club reach the ball at impact: a little more bend from the hips (not a squat) to bring the hands down,
    then a small slide of the body (not the feet) for what's left; both blended in and out around impact"""
    J = {k: v.copy() for k, v in J.items()}; n = len(J['pel']); fr = np.arange(n); i = ph['impact']
    ball = ball_for(J, ph); X = np.array([1.0, 0, 0])
    w = _ss(1 - np.abs(fr - i) / (0.15 * out_fps))
    def bent(th):
        p = J['pel'][i]; R = _rot(X, th); return p + R @ (J['lh'][i] - p)
    lo, hi = -15.0, 25.0                                   # extra bend (deg) so the hands are at club length from the ball
    for _ in range(30):
        mid = (lo + hi) / 2
        if np.linalg.norm(ball - bent(mid)) > CLEN: lo = mid
        else: hi = mid
    th = min((lo + hi) / 2, 9.0)                           # no more than a little extra bend; the body slides for the rest
    for j in np.where(w > 0)[0]:
        p = J['pel'][j]; R = _rot(X, th * w[j])
        for k in UPPER: J[k][j] = p + R @ (J[k][j] - p)
    v = ball - J['lh'][i]; need = v - _unit(v) * CLEN; need[1] = max(need[1], -0.018)   # sink at most 1.8 cm (no squat)
    for k in UPPER + ['pel', 'lhip', 'thip']: J[k] = J[k] + w[:, None] * need
    _legs(J, B)
    return J

def _shaft(J, ph):
    """shaft direction: the lead forearm turned about the swing plane's normal by the wrist hinge for each phase"""
    n = len(J['lh']); fr = np.arange(n)
    seg = slice(ph['address'], ph['finish'] + 1); P = J['lh'][seg] - J['lh'][seg].mean(0)
    N = np.linalg.svd(P, full_matrices=False)[2][2]
    hinge = np.interp(fr, [ph[k] for k in PH], [HINGE[k] for k in PH])
    fa = _unit(J['lw'] - J['le'])
    def dirs(sg): return np.array([_rot(N, sg * hinge[j]) @ fa[j] for j in range(n)])
    h = ph['half']; dp, dm = dirs(1), dirs(-1)
    d = dp if (J['lh'][h] + dp[h] * CLEN)[1] > (J['lh'][h] + dm[h] * CLEN)[1] else dm
    return _unit(gaussian_filter1d(d, 1.5, axis=0))

def grip(J, ph, B):
    """both hands on the grip: centred where the captured hands are, 8 cm apart along the shaft, arms bent to reach
    (if the grip is out of reach it comes in toward the shoulders until both arms reach it)"""
    from retarget import _ik
    J = {k: v.copy() for k, v in J.items()}; d = _shaft(J, ph); L = B['uarm'] + B['forearm'] - 0.005
    off = {sd: J[sd + 'h'] - J[sd + 'w'] for sd in 'lt'}
    g = (J['lh'] + J['th']) / 2; mid = (J['ls'] + J['ts']) / 2
    for j in range(len(g)):
        for _ in range(40):
            lw = g[j] - d[j] * 0.04 - off['l'][j]; tw = g[j] + d[j] * 0.04 - off['t'][j]
            if np.linalg.norm(lw - J['ls'][j]) <= L and np.linalg.norm(tw - J['ts'][j]) <= L: break
            g[j] = g[j] + (mid[j] - g[j]) * 0.05
    g = gaussian_filter1d(g, 1.0, axis=0)
    for sd, sg in (('l', -1), ('t', 1)):
        J[sd + 'h'] = g + d * 0.04 * sg; J[sd + 'w'] = J[sd + 'h'] - off[sd]
        pole = _unit(gaussian_filter1d(J[sd + 'e'] - (J[sd + 's'] + J[sd + 'w']) / 2, 2.0, axis=0))
        J[sd + 'e'], _ = _ik(J[sd + 's'], J[sd + 'w'], B['uarm'], B['forearm'], pole)
    return J

def club(J, ph, out_fps=60):
    J = {k: v.copy() for k, v in J.items()}; n = len(J['lh']); fr = np.arange(n)
    d = _shaft(J, ph)
    ball = ball_for(J, ph)
    # the wrists set the clubhead on the ball at address and impact (blended in and out)
    for k, win in ((ph['address'], 0.25), (ph['impact'], 0.08)):
        need = _unit(ball - J['lh'][k]); ax = np.cross(d[k], need); s_ = np.linalg.norm(ax)
        if s_ < 1e-9: continue
        full = np.degrees(np.arctan2(s_, d[k] @ need)); ax = ax / s_
        w = _ss(1 - np.abs(fr - k) / (win * out_fps))
        for j in np.where(w > 0)[0]: d[j] = _rot(ax, full * w[j]) @ d[j]
    J['sd'] = d; J['club'] = np.stack([J['lh'] - d * 0.06, J['lh'] + d * CLEN], 1)
    # keep the trail hand on the shaft after the wrist correction (the trail arm follows it)
    from retarget import _ik
    ua = np.linalg.norm(J['te'][0] - J['ts'][0]); fa = np.linalg.norm(J['tw'][0] - J['te'][0])
    hand = J['th'] - J['tw']; J['th'] = J['lh'] + d * 0.08; J['tw'] = J['th'] - hand
    J['te'], _ = _ik(J['ts'], J['tw'], ua, fa, _unit(J['te'] - (J['ts'] + J['tw']) / 2))
    J['clubhead'] = J['club'][:, 1]; J['hands'] = (J['lh'] + J['th']) / 2
    return J, ball

def _bend(J):
    sp = J['neck'] - J['pel']; return np.degrees(np.arctan2(np.hypot(sp[:, 0], sp[:, 2]), sp[:, 1]))

def posture(J, ph, B):
    """bend from the hips like a golfer and keep that spine angle through impact (the capture stands nearly upright
    and stands up further through the ball); the bend eases off into the finish"""
    J = {k: v.copy() for k, v in J.items()}; n = len(J['pel']); fr = np.arange(n)
    rise = _ss((fr - ph['impact']) / max(ph['finish'] - ph['impact'], 1))
    target = BEND * (1 - rise) + 12.0 * rise                                  # golfers stand up into the finish
    delta = np.maximum(0.0, target - _bend(J))
    delta = gaussian_filter1d(delta, 3.0)
    drop = np.stack([np.zeros(n), -0.06 * delta / 25, -0.05 * delta / 25], 1)
    for k in UPPER + ['pel', 'lhip', 'thip']: J[k] = J[k] + drop
    X = np.array([1.0, 0, 0])
    for j in range(n):
        R = _rot(X, delta[j]); p = J['pel'][j]
        for k in UPPER: J[k][j] = p + R @ (J[k][j] - p)
    _legs(J, B)
    return J

def frames(J, ph, ball):
    J = {k: v.copy() for k, v in J.items()}
    s = _unit(J['neck'] - J['pel']); H = _unit(J['lhip'] - J['thip'])
    Lt = J['ls'] - J['ts']; Lt = _unit(Lt - s * (Lt * s).sum(1, keepdims=True)); F = _unit(np.cross(Lt, s))
    Fh = _unit(np.cross(H, UP)); c0 = J['pel'] + Fh * 0.16 + [0, 0.04, 0]
    J.update(s=s, H=H, Lt=Lt, F=F, Fh=Fh, chest=J['pel'] + s * 0.5, belt=np.stack([c0 - H * 0.55, c0 + H * 0.55], 1))
    J['seat'] = J['pel'] - Fh * 0.13 + [0, -0.05, 0]; J['bum'] = J['seat']
    look = _unit(ball - J['head']); bodyF = _unit(F * [1, 0.3, 1])
    n = len(s); fr = np.arange(n); w = _ss((fr - ph['impact']) / max(ph['through'] + (ph['finish'] - ph['through']) // 2 - ph['impact'], 1))[:, None]
    J['face'] = _unit(look * (1 - w) + bodyF * w)
    for sd in 'lt': J[sd + 'kp'] = _unit(J[sd + 'k'] - (J[sd + 'hip'] + J[sd + 'a']) / 2)
    return J
