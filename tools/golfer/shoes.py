# Parametric golf shoe: lofted per foot from the foot's measurements, uv = (heel->toe, round the section).
import numpy as np
from PIL import Image, ImageFilter
from scipy.interpolate import RegularGridInterpolator
NS, MR = 40, 56
def build(fp):
    g = fp[:, 1].min(); low = fp[fp[:, 1] < g + 0.04]
    c2 = low[:, [0, 2]].mean(0); ev, evec = np.linalg.eigh(np.cov((low[:, [0, 2]] - c2).T)); fd = evec[:, -1]
    if fd[1] < 0: fd = -fd
    fwd = np.array([fd[0], 0, fd[1]]); lat = np.array([fd[1], 0, -fd[0]])
    if c2[0] < 0: lat = -lat            # lat points to the outside of each foot
    o = np.array([c2[0], g, c2[1]])
    sv = (fp - o) @ fwd; uv_ = (fp - o) @ lat; yv = fp[:, 1] - g
    s0, s1 = sv.min() - 0.012, sv.max() + 0.010
    tt = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, NS)); st = s0 + (s1 - s0) * tt
    ulo, uhi, yt = [], [], []
    for si in st:
        m = np.abs(sv - si) < 0.014
        if m.sum() < 4: m = np.argsort(np.abs(sv - si))[:12]
        ulo.append(uv_[m].min()); uhi.append(uv_[m].max()); yt.append(yv[m].max())
    ulo, uhi, yt = map(np.array, (ulo, uhi, yt))
    for _ in range(8): ulo, uhi, yt = [np.convolve(np.pad(a, 1, mode='edge'), [0.25, 0.5, 0.25], 'valid') for a in (ulo, uhi, yt)]
    f = tt
    tipT = np.clip((f - 0.84) / 0.16, 0, 1); heelT = np.clip((0.12 - f) / 0.12, 0, 1)
    endK = np.clip(1 - tipT ** 2.0, 0, 1) ** 0.42 * np.sqrt(np.clip(1 - heelT ** 2.2, 0, 1))
    uc = (ulo + uhi) / 2; hw = (uhi - ulo) / 2 + 0.008
    hw = np.maximum(hw, 0.036 + 0.008 * np.sin(np.pi * np.clip(f * 1.2, 0, 1)))
    # the outside of the foot is straighter, the inside curves in at the arch
    top = np.clip(yt + 0.007, 0.046, 0.097)
    top = np.where(f > 0.62, np.minimum(top, 0.050 + 0.027 * np.clip((0.95 - f) / 0.33, 0, 1)), top)
    top = np.convolve(np.pad(top, 2, mode='edge'), np.ones(5) / 5, 'valid')
    bot = 0.013 * tipT ** 1.6 + 0.005 * heelT ** 2
    th = -np.pi / 2 + np.linspace(0, 2 * np.pi, MR + 1)        # seam under the sole
    rings = np.zeros((NS, MR + 1, 3)); YL = np.zeros((NS, MR + 1)); UL = np.zeros((NS, MR + 1))
    for i in range(NS):
        for j, a in enumerate(th):
            ca, sa = np.cos(a), np.sin(a)
            if sa < 0:
                yy = bot[i] + (1 - (-sa) ** 0.16) * 0.021
                uu = np.sign(ca) * np.abs(ca) ** 0.16 * hw[i] * 1.04
            else:
                yy = bot[i] + 0.021 + (top[i] - 0.021 - bot[i]) * sa ** 0.85
                uu = np.sign(ca) * np.abs(ca) ** 0.7 * hw[i] * (1 - 0.2 * sa ** 2)
            ek = endK[i]
            uu *= ek
            if ek < 0.999:     # round the toe and heel in height too
                mid = bot[i] + 0.5 * (top[i] - bot[i]) * 0.8
                yy = mid + (yy - mid) * (0.35 + 0.65 * ek ** 0.5)
            rings[i, j] = o + fwd * st[i] + lat * (uc[i] + uu) + np.array([0, yy, 0])
            YL[i, j] = yy; UL[i, j] = uu / max(hw[i], 1e-6)
    V = rings.reshape(-1, 3); T = []
    for i in range(NS - 1):
        for j in range(MR):
            a, b, c, d = i * (MR + 1) + j, i * (MR + 1) + j + 1, (i + 1) * (MR + 1) + j + 1, (i + 1) * (MR + 1) + j
            T += [[a, b, c], [a, c, d]]
    T = np.array(T)
    cc = V.mean(0); n = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]])
    if (np.sign((n * (V[T].mean(1) - cc)).sum(1))).sum() < 0: T = T[:, [0, 2, 1]]
    UV = np.stack(np.meshgrid(f, np.linspace(0, 1, MR + 1), indexing='ij'), -1).reshape(-1, 2)
    yl = V[:, 1] - g
    return dict(V=V, T=T, UV=UV, yl=yl, fv=UV[:, 0], f=f, YL=YL, UL=UL, top=top, bot=bot)

def paint(sh, W=1024, H=512):
    """colour + height maps in the shoe's uv space; x = heel->toe, y = round the section (0 and 1 = under the sole, 0.5 = top)"""
    f = sh['f']; av = np.linspace(0, 1, MR + 1)
    iy = RegularGridInterpolator((f, av), sh['YL']); iu = RegularGridInterpolator((f, av), sh['UL'])
    X, Y = np.meshgrid((np.arange(W) + 0.5) / W, (np.arange(H) + 0.5) / H)
    pts = np.stack([X.ravel(), Y.ravel()], 1)
    yl = iy(pts).reshape(H, W); ul = iu(pts).reshape(H, W)
    top = np.interp(X, f, sh['top']); bot = np.interp(X, f, sh['bot'])
    a = Y * 2 * np.pi - np.pi / 2; up = np.sin(a) > 0
    under = (~up) & (yl < bot + 0.0025)
    white = np.array([238, 237, 232.0]); navy = np.array([30, 45, 70.0]); grey = np.array([62, 64, 68.0]); mids = np.array([228, 226, 218.0])
    C = np.ones((H, W, 3)) * white; Hh = np.zeros((H, W))
    rel = yl - bot
    # outsole / midsole
    outs = rel < 0.0065; mid = (~outs) & (rel < 0.021)
    C[mid] = mids; C[outs] = grey; Hh[mid] = 0.3
    groove = np.abs(rel - 0.0135) < 0.0006; C[groove] *= 0.82; Hh[groove] -= 0.6
    # spikes and traction lugs under the sole
    gx = (X * 30) % 1; gy = (ul * 3.2) % 1
    lug = under & (((gx - 0.5) ** 2 + (gy - 0.5) ** 2) < 0.08)
    C[under] = np.array([52, 54, 58.0]); C[lug] = np.array([34, 35, 38.0]); Hh[lug] += 1
    for cx, cu in [(0.15, -0.45), (0.15, 0.45), (0.62, -0.55), (0.62, 0.55), (0.74, 0), (0.86, -0.4), (0.86, 0.4)]:
        d = np.hypot((X - cx) * 1.0, (ul - cu) * 0.11)
        sp = under & (d < 0.028); C[sp] = np.array([22, 24, 28.0]); Hh[sp] += 1.5
    upper = up & (rel >= 0.021) | (~up) & (rel >= 0.021)
    # heel counter (navy), curved edge
    hedge = 0.20 + 0.07 * np.clip(rel / 0.08, 0, 1) ** 1.5
    heel = upper & (X < hedge)
    C[heel] = navy; Hh[heel] += 0.5
    # toe cap with a wing-tip edge
    tedge = 0.80 - 0.05 * np.abs(ul) ** 2 + 0.03 * np.clip(rel / 0.05, 0, 1)
    toe = upper & (X > tedge)
    Hh[toe] += 0.5
    # perforations along the toe cap edge and stitching along every panel edge
    def edge_band(dist, w): return np.abs(dist) < w
    perf = upper & edge_band(X - (tedge + 0.018), 0.006) & (((ul * 20) % 1 - 0.5) ** 2 < 0.04)
    C[perf] *= 0.55; Hh[perf] -= 1.2
    for e, off in [(tedge, -0.008), (tedge, 0.008), (hedge, 0.008), (hedge, -0.008)]:
        st = upper & edge_band(X - (e + off), 0.0012) & (((ul * 60 + X * 0) % 1) < 0.6)
        C[st] = C[st] * 0.72; Hh[st] -= 0.5
    rs = upper & edge_band(rel - 0.026, 0.0008) & ((X * 160) % 1 < 0.6)
    C[rs] *= 0.75; Hh[rs] -= 0.4
    # a side stripe panel
    strip = upper & (np.abs(ul) > 0.6) & (X > hedge + 0.012) & (X < tedge - 0.03) & (np.abs(rel - 0.030) < 0.0035)
    C[strip] = navy * 1.1; Hh[strip] += 0.3
    # tongue and laces on the instep
    nearTop = up & (np.abs(ul) < 0.42) & (X > 0.44) & (X < 0.82) & (rel > 0.03)
    C[nearTop] = np.array([226, 226, 222.0]); Hh[nearTop] += 0.2
    for k in range(6):
        cx = 0.47 + k * 0.058
        bar = nearTop & (np.abs(X - cx) < 0.010) & (np.abs(ul) < 0.36)
        prof = np.clip(1 - np.abs(X - cx) / 0.010, 0, 1)
        C[bar] = np.array([250, 250, 248.0]) * (0.85 + 0.15 * prof[bar])[:, None]; Hh[bar] += 1.2 * prof[bar]
        for sg in (-1, 1):
            ey = up & (np.hypot((X - cx) * 1.0, (ul - sg * 0.40) * 0.06) < 0.0065)
            C[ey] = navy * 0.8; Hh[ey] -= 0.8
    # collar padding at the ankle opening
    collar = upper & (np.abs(rel - (top - bot)) < 0.008) & (X < 0.45)
    C[collar] = navy * 0.9
    # soft grime near the sole and leather grain
    rng = np.random.default_rng(3)
    grain = np.array(Image.fromarray((rng.random((H, W)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))) / 255.0
    C *= (0.97 + 0.06 * grain)[:, :, None]; Hh += (grain - 0.5) * 0.15 * upper
    col = Image.fromarray(np.clip(C, 0, 255).astype(np.uint8))
    hm = Image.fromarray(np.clip(128 + Hh * 40, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))
    Hs = np.array(hm, float) / 40.0
    gxh = np.roll(Hs, -1, 1) - np.roll(Hs, 1, 1); gyh = np.roll(Hs, -1, 0) - np.roll(Hs, 1, 0)
    k = 0.9; nx, ny = -gxh * k, gyh * k; nz = np.ones_like(nx); L = np.sqrt(nx * nx + ny * ny + nz * nz)
    nm = np.stack([nx / L, ny / L, nz / L], -1) * 0.5 + 0.5
    return col, Image.fromarray((nm * 255).astype(np.uint8))
