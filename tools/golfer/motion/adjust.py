# Tour-average adjustments for a captured swing (tempo, turn), the club, and the rig's derived joints.
import numpy as np
from scipy.ndimage import gaussian_filter1d

UP = np.array([0, 1.0, 0])
UPPER = ['neck', 'head', 'ls', 'le', 'lw', 'lh', 'ts', 'te', 'tw', 'th']
PH = ['address', 'takeaway', 'half', 'top', 'down', 'impact', 'through', 'finish']
# skilled golfers (Okuda et al. 2010; Chu et al. 2010): shoulders ~98-102 and pelvis ~48 turned at the top; at impact
# the pelvis is ~38 open and the shoulders ~12 open
TOP_SH, TOP_HIP, IMP_HIP, IMP_SH = 98.0, 48.0, -38.0, -12.0
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
    head0 = J['head'].copy()
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
    # keep the head steady. Turning the hips about the pelvis swung the head (which sits forward of the pelvis) round
    # in an arc of 15-20 cm; good players' heads barely move. The whole body above the feet slides so the head follows
    # half of the capture's own drift (the amateur's head wandered 10-17 cm), and the knees re-solve.
    a = ph['address']; want = head0[a] + 0.5 * (head0 - head0[a]); d = want - J['head']; d[:, 1] = 0
    d = gaussian_filter1d(d, 2.0, axis=0)
    for k in UPPER + ['pel', 'lhip', 'thip', 'chest', 'seat', 'bum']:
        if k in J: J[k] = J[k] + d
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
    """let the club reach the ball at impact. The capture's hands arrive high and ahead of the ball, about 8 cm too far
    from it. A good player delivers the club with the arms, head still: so the lead arm swings down about its shoulder
    until the grip is a club's length from the ball. Only what the arm cannot reach is made up by the body: a little
    more bend from the hips, then a small slide (not the feet). All of it is blended in and out around impact.
    (This used to be done with the body alone, which dipped the head 10-17 cm through the ball.)"""
    J = {k: v.copy() for k, v in J.items()}; n = len(J['pel']); fr = np.arange(n); i = ph['impact']
    ball = ball_for(J, ph); X = np.array([1.0, 0, 0])
    w = _ss(1 - np.abs(fr - i) / (0.15 * out_fps))
    # 1) the arm: turn shoulder->grip toward the ball until |grip - ball| = club length (triangle shoulder, grip, ball)
    sh = J['ls'][i]; g = J['lh'][i] - sh; b = ball - sh; Dg, Db = np.linalg.norm(g), np.linalg.norm(b)
    a0 = np.degrees(np.arccos(np.clip(g @ b / (Dg * Db), -1, 1)))
    c = (Dg * Dg + Db * Db - CLEN * CLEN) / (2 * Dg * Db)
    a1 = np.degrees(np.arccos(np.clip(c, -1, 1))) if c < 1 else 0.0          # c >= 1: out of reach even in line
    ax = np.cross(g, b)
    if np.linalg.norm(ax) > 1e-9 and a0 > a1:
        for j in np.where(w > 0)[0]:
            R = _rot(ax, (a0 - a1) * w[j]); p = J['ls'][j]
            for k in ('le', 'lw', 'lh'): J[k][j] = p + R @ (J[k][j] - p)
    # 2) the body, for whatever is left
    def bent(th):
        p = J['pel'][i]; R = _rot(X, th); return p + R @ (J['lh'][i] - p)
    if np.linalg.norm(ball - J['lh'][i]) > CLEN + 0.003:
        lo, hi = 0.0, 25.0
        for _ in range(30):
            mid = (lo + hi) / 2
            if np.linalg.norm(ball - bent(mid)) > CLEN: lo = mid
            else: hi = mid
        th = min((lo + hi) / 2, 9.0)                       # no more than a little extra bend; the body slides for the rest
        for j in np.where(w > 0)[0]:
            p = J['pel'][j]; R = _rot(X, th * w[j])
            for k in UPPER: J[k][j] = p + R @ (J[k][j] - p)
    v = ball - J['lh'][i]; need = v - _unit(v) * CLEN; need[1] = max(need[1], -0.018)   # sink at most 1.8 cm (no squat)
    if np.linalg.norm(need) > 0.003:
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

HAND_RHO, HAND_ALONG = 0.096, -0.014   # wrist's distance from the shaft's line, and its offset along the shaft (metres)
LEAD_ANGLE = dict(address=166, takeaway=170, half=170, top=162, down=166, impact=172)   # lead elbow (deg) good players keep

def _side(g, sh, el, d):
    """which side of the shaft a wrist sits: toward its own elbow and shoulder, square to the shaft (as golfer.js does)"""
    v = (el - g) + (sh - g); return _unit(v - d * (v * d).sum(1, keepdims=True))

def grip(J, ph, B):
    """both hands on the grip, 7 cm apart along the shaft (touching). The grip is placed from the lead arm: the lead hand stays
    where the capture put it, or further out along the arm if the capture had that elbow bent more than good players
    do (up to impact; after that it folds as captured). The trail hand sits below it on the shaft; if it can't reach,
    the trail shoulder comes forward/down to it (the lead arm is never pulled in to make room).
    (The old version centred the grip between the hands and pulled it toward the shoulders until both arms reached,
    which bent the lead elbow to ~120 degrees at impact: the main reason the golfer looked floppy.)"""
    from retarget import _ik
    J = {k: v.copy() for k, v in J.items()}; d = _shaft(J, ph); n = len(d); fr = np.arange(n)
    ua, fa = B['uarm'], B['forearm']; L = ua + fa - 0.005
    off = {sd: J[sd + 'h'] - J[sd + 'w'] for sd in 'lt'}
    # how straight the lead arm should be at each frame: tour values up to impact, then the capture's own fold
    keys = [k for k in LEAD_ANGLE if k in ph]
    want_ang = np.interp(fr, [ph[k] for k in keys], [LEAD_ANGLE[k] for k in keys])
    keep = _ss((fr - ph['impact']) / max(1, (ph['through'] - ph['impact'])))      # 0 up to impact -> 1 by 'through'
    reach = np.sqrt(ua * ua + fa * fa - 2 * ua * fa * np.cos(np.radians(want_ang)))
    lw0 = J['lw']; v = lw0 - J['ls']; dist = np.linalg.norm(v, axis=1)
    target = np.where(dist < reach, reach, dist) * (1 - keep) + dist * keep
    # smooth the arm's length, not the hand's position (smoothing positions cuts the corner of the fast downswing arc)
    target = gaussian_filter1d(np.minimum(target, L), 1.0)
    lw = J['ls'] + _unit(v) * target[:, None]
    # the grip point on the shaft (lh) is set in club(), a hand's width out from this wrist; until then it sits on it
    J['lw'] = lw; J['lh'] = lw.copy()
    J['th'] = J['lh'] + d * 0.07; J['tw'] = J['th'].copy()
    # trail shoulder reaches for the trail hand when it's out of reach
    tv = J['tw'] - J['ts']; td = np.linalg.norm(tv, axis=1); over = np.maximum(0, td - L)
    J['ts'] = J['ts'] + _unit(tv) * gaussian_filter1d(over, 1.0)[:, None]
    for sd in 'lt':
        pole = _unit(gaussian_filter1d(J[sd + 'e'] - (J[sd + 's'] + J[sd + 'w']) / 2, 2.0, axis=0))
        J[sd + 'e'], _ = _ik(J[sd + 's'], J[sd + 'w'], ua, fa, pole)
    return J

def club(J, ph, out_fps=60):
    """the shaft, the grip point and the ball. A hand is not a point: the shaft lies in the curled fingers, HAND_RHO
    from the wrist (measured on the golfer's mesh, golfer.js gripLine), on the far side from the elbow and shoulder. So
    the lead wrist (lw) stays where the straight arm puts it and the shaft's grip point (lh) sits a hand further out.
    (Before, the wrist itself was on the shaft, so the drawn hand, which needs that room, pulled the arm into a bend.)"""
    J = {k: v.copy() for k, v in J.items()}; n = len(J['lh']); fr = np.arange(n)
    d_raw = _shaft(J, ph); lw = J['lw']
    for _it in range(5):
        d = d_raw.copy(); ball = ball_for(J, ph)
        # the wrists set the clubhead on the ball at address and impact (blended in and out)
        for k, win in ((ph['address'], 0.25), (ph['impact'], 0.08)):
            need = _unit(ball - J['lh'][k]); ax = np.cross(d[k], need); s_ = np.linalg.norm(ax)
            if s_ < 1e-9: continue
            full = np.degrees(np.arctan2(s_, d[k] @ need)); ax = ax / s_
            w = _ss(1 - np.abs(fr - k) / (win * out_fps))
            for j in np.where(w > 0)[0]: d[j] = _rot(ax, full * w[j]) @ d[j]
        # the shaft never goes through his head or neck: in the follow-through it used to pass 2-11 cm from the centre of
        # the head (through it). Each frame it swings about the hands, away from the head, until it clears; then it's
        # smoothed so it eases round rather than jumping.
        d0 = d.copy()
        for j in range(n):
            for _ in range(60):
                worst = None
                for k, r in (('head', 0.17), ('neck', 0.12)):
                    p = J[k][j]; a = J['lh'][j]; t = np.clip((p - a) @ d[j], 0, CLEN); q = a + d[j] * t; gap = np.linalg.norm(p - q)
                    if gap < r and (worst is None or r - gap > worst[0]): worst = (r - gap, p, q, a, t)
                if worst is None: break
                _, p, q, a, t = worst; away = _unit(q - p) if np.linalg.norm(q - p) > 1e-6 else _unit(np.cross(d[j], UP))
                ax = np.cross(d[j], away)
                if np.linalg.norm(ax) < 1e-9: break
                d[j] = _rot(_unit(ax), 2.0) @ d[j]
        d = _unit(d0 + gaussian_filter1d(d - d0, 2.0, axis=0))
        g = J['lh']
        for _ in range(3): g = lw - _side(g, J['ls'], J['le'], d) * HAND_RHO - d * HAND_ALONG
        J['lh'] = g
        # the last centimetre or two at impact: the wrist eases along the line to the ball so the head meets it exactly
        i = ph['impact']; v = ball - g[i]; e = np.linalg.norm(v) - CLEN
        if abs(e) > 0.002 and _it < 4:
            from retarget import _ik
            wi = _ss(1 - np.abs(fr - i) / (0.08 * out_fps))[:, None]; lw = lw + wi * _unit(v) * e; J['lw'] = lw
            ual, fal = np.linalg.norm(J['le'][0] - J['ls'][0]), np.linalg.norm(J['lw'][0] - J['le'][0])
            J['le'], _ = _ik(J['ls'], lw, ual, fal, _unit(J['le'] - (J['ls'] + lw) / 2))
    J['sd'] = d; J['club'] = np.stack([J['lh'] - d * 0.06, J['lh'] + d * CLEN], 1)
    # keep the trail hand on the shaft after the wrist correction (the trail arm follows it)
    from retarget import _ik
    ua = np.linalg.norm(J['te'][0] - J['ts'][0]); fa = np.linalg.norm(J['tw'][0] - J['te'][0])
    J['th'] = J['lh'] + d * 0.07; J['tw'] = J['th'] + _side(J['th'], J['ts'], J['te'], d) * HAND_RHO + d * HAND_ALONG
    # the trail arm: the shaft fixes the hand, so through impact the elbow snapped straight in two frames and bent
    # back 45 deg after (a pump). Ease that angle over time and let the trail shoulder give the few cm it takes.
    r = np.linalg.norm(J['tw'] - J['ts'], axis=1)
    th = np.degrees(np.arccos(np.clip((ua * ua + fa * fa - np.minimum(r, ua + fa) ** 2) / (2 * ua * fa), -1, 1)))
    th = gaussian_filter1d(np.minimum(th, 172.0), 2.0, mode='nearest')
    want = np.sqrt(ua * ua + fa * fa - 2 * ua * fa * np.cos(np.radians(th)))
    want = np.clip(want, r - 0.03, r + 0.03)                                  # a shoulder gives a few cm, no more
    J['ts'] = J['tw'] + _unit(J['ts'] - J['tw']) * want[:, None]
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

NECK_YAW, NECK_PITCH = (55.0, 80.0), (-55.0, 30.0)
HEAD_RATE = 9.0          # deg per 60 fps frame (540 deg/s, about a golfer's head coming up and round after impact)   # how far a head turns (soft limit, hard limit) and nods against the chest

def _neck(face, s, Lt, F, sigma=1.5):
    """keep the look inside what a neck allows against the chest, then smooth it in time. Without this the chest,
    turning ~1000 deg/s through impact, drags a clamped head round in two frames (a 40 deg/frame whip)."""
    def knee(v, a, m):
        u = np.abs(v); return np.where(u <= a, v, np.sign(v) * (a + (m - a) * np.tanh((u - a) / (m - a))))
    yaw = np.degrees(np.arctan2((face * Lt).sum(1), (face * F).sum(1)))
    pit = np.degrees(np.arcsin(np.clip((face * s).sum(1), -1, 1)))
    yaw = knee(yaw, *NECK_YAW); pit = np.clip(pit, *NECK_PITCH)
    y, p = np.radians(yaw)[:, None], np.radians(pit)[:, None]
    out = _unit(Lt * np.sin(y) * np.cos(p) + F * np.cos(y) * np.cos(p) + s * np.sin(p))
    # a head turns at most ~HEAD_RATE deg a frame; a forward then a backward pass keeps to that and starts the turn a
    # touch early instead of arriving late (which would let the turning chest drag it)
    m = np.radians(HEAD_RATE)
    def step(a, b):
        c = np.clip(a @ b, -1, 1); t = np.arccos(c)
        if t <= m: return b
        k = np.sin(m) / np.sin(t); return _unit(a * (np.sin(t - m) / np.sin(t)) + b * k)
    h = out.copy()
    for i in range(1, len(h)): h[i] = step(h[i - 1], out[i])
    for i in range(len(h) - 2, -1, -1): h[i] = step(h[i + 1], h[i])
    return _unit(gaussian_filter1d(h, sigma, axis=0, mode='nearest'))

def frames(J, ph, ball):
    J = {k: v.copy() for k, v in J.items()}
    s = _unit(J['neck'] - J['pel']); H = _unit(J['lhip'] - J['thip'])
    Lt = J['ls'] - J['ts']; Lt = _unit(Lt - s * (Lt * s).sum(1, keepdims=True)); F = _unit(np.cross(Lt, s))
    Fh = _unit(np.cross(H, UP)); c0 = J['pel'] + Fh * 0.16 + [0, 0.04, 0]
    J.update(s=s, H=H, Lt=Lt, F=F, Fh=Fh, chest=J['pel'] + s * 0.5, belt=np.stack([c0 - H * 0.55, c0 + H * 0.55], 1))
    J['seat'] = J['pel'] - Fh * 0.13 + [0, -0.05, 0]; J['bum'] = J['seat']
    look = _unit(ball - J['head']); bodyF = _unit(F * [1, 0.3, 1])
    n = len(s); fr = np.arange(n); # the head stays down through impact, then comes up and round with the body all the way to the finish. (It used to
    # catch up by half-way to the finish, which in a drill's quick follow-through whipped it round in two frames.)
    w = _ss((fr - ph['impact'] - 2) / max(ph['finish'] - ph['impact'] - 2, 1))[:, None]
    J['face'] = _neck(_unit(look * (1 - w) + bodyF * w), s, Lt, F)
    for sd in 'lt': J[sd + 'kp'] = _unit(J[sd + 'k'] - (J[sd + 'hip'] + J[sd + 'a']) / 2)
    return J

