# Six-panel golf cap fitted to the head: crown on a fitted ellipsoid, curved brim with thickness, top button.
import numpy as np
from PIL import Image, ImageFilter
def fit_ellipsoid(X):
    A = np.stack([X[:, 0] ** 2, X[:, 1] ** 2, X[:, 2] ** 2, X[:, 0], X[:, 1], X[:, 2]], 1)
    p = np.linalg.lstsq(A, np.ones(len(X)), rcond=None)[0]
    c = -p[3:] / (2 * p[:3]); k = 1 + (p[3:] ** 2 / (4 * p[:3])).sum()
    r = np.sqrt(k / p[:3]); return c, r
def build(scalp, eyeY, cx0):
    c, r = fit_ellipsoid(scalp); c[0] = cx0
    r = r + 0.011
    NP, NT = 72, 22
    phis = np.linspace(-np.pi, np.pi, NP + 1)                       # 0 = straight forward (+z)
    def band_y(ph):
        y = eyeY + 0.0225 + 0.0325 * np.cos(ph)
        back = np.clip(1 - np.abs((np.abs(ph) - np.pi)) / 0.42, 0, 1)   # the strap opening at the back
        return y + 0.032 * np.sin(back * np.pi / 2) ** 2
    def surf(ph, e):
        front = max(0.0, np.cos(ph)) ** 2 * np.sin(np.clip(e, 0, np.pi / 2) * 2) ** 1.0
        k = 1 + 0.07 * front                                       # structured front panels stand up
        seam = min(abs(((ph - s) + np.pi) % (2 * np.pi) - np.pi) for s in np.radians([0, 60, 120, 180, -60, -120]))
        k *= 1 - 0.006 * np.exp(-(seam / 0.03) ** 2) * (1 - e / (np.pi / 2))
        return c + np.array([r[0] * np.cos(e) * np.sin(ph), r[1] * np.sin(e) * 0.97, r[2] * np.cos(e) * np.cos(ph)]) * k
    V = []; UV = []
    for i, ph in enumerate(phis):
        yb = band_y(ph); e0 = np.arcsin(np.clip((yb - c[1]) / r[1], -0.95, 0.95))
        for j in range(NT + 1):
            t = j / NT; e = e0 + (np.pi / 2 - 1e-3 - e0) * (1 - (1 - t) ** 1.25)
            V.append(surf(ph, e)); UV.append([(ph + np.pi) / (2 * np.pi), 0.5 + 0.5 * t])
    V = np.array(V); UV = np.array(UV); T = []
    for i in range(NP):
        for j in range(NT):
            a, b, cc, d = i * (NT + 1) + j, (i + 1) * (NT + 1) + j, (i + 1) * (NT + 1) + j + 1, i * (NT + 1) + j + 1
            T += [[a, b, cc], [a, cc, d]]
    T = np.array(T)
    # inner surface (sweatband / lining) so the cap has thickness from below
    nin = len(V); Vin = c + (V - c) * 0.985
    V = np.vstack([V, Vin]); UV = np.vstack([UV, np.c_[UV[:, 0], np.full(len(UV), 0.02)]])
    T = np.vstack([T, T[:, [0, 2, 1]] + nin])
    # rim strip joining outer and inner at the band
    for i in range(NP):
        a, b = i * (NT + 1), (i + 1) * (NT + 1)
        T = np.vstack([T, [[a, a + nin, b + nin], [a, b + nin, b]]])
    # brim: D-shaped, pre-curved, tipped down a little
    NB, NR = 41, 8
    span = np.radians(64)
    bphi = np.linspace(-span, span, NB)
    BV = []; BUV = []
    for i, ph in enumerate(bphi):
        root = surf(ph, np.arcsin(np.clip((band_y(ph) - c[1]) / r[1], -0.95, 0.95))) + np.array([0, 0.003, 0]) - np.array([np.sin(ph), 0, np.cos(ph)]) * 0.005
        L = 0.074 * np.cos(ph / span * np.pi / 2) ** 0.6 + 0.011
        outd = np.array([np.sin(ph), 0, np.cos(ph)])
        for j in range(NR + 1):
            t = j / NR; rr = L * t
            lat = (root[0] + outd[0] * rr - c[0])
            y = root[1] - rr * 0.20 - 3.2 * lat ** 2 * t * 0.9 - 0.04 * (np.sin(ph) ** 2) * rr / 0.07 * 0.4
            BV.append([root[0] + outd[0] * rr, y, root[2] + outd[2] * rr]); BUV.append([0.05 + 0.9 * i / (NB - 1), 0.05 + 0.38 * t])
    BV = np.array(BV); BUV = np.array(BUV); th = 0.0045
    base = len(V); top = BV; bot = BV - np.array([0, th, 0])
    V = np.vstack([V, top, bot]); UV = np.vstack([UV, BUV, BUV * [1, 1] + [0, 0]])
    nb = len(BV); BT = []
    for i in range(NB - 1):
        for j in range(NR):
            a, b, cc, d = i * (NR + 1) + j, (i + 1) * (NR + 1) + j, (i + 1) * (NR + 1) + j + 1, i * (NR + 1) + j + 1
            BT += [[base + a, base + d, base + cc], [base + a, base + cc, base + b]]
            BT += [[base + nb + a, base + nb + cc, base + nb + d], [base + nb + a, base + nb + b, base + nb + cc]]
    for i in range(NB - 1):   # outer edge
        a, b = i * (NR + 1) + NR, (i + 1) * (NR + 1) + NR
        BT += [[base + a, base + b, base + nb + b], [base + a, base + nb + b, base + nb + a]]
    for i in (0, NB - 1):     # side ends
        for j in range(NR):
            a, d = i * (NR + 1) + j, i * (NR + 1) + j + 1
            BT += [[base + a, base + nb + a, base + nb + d], [base + a, base + nb + d, base + d]]
    BT = np.array(BT)
    # brim faces: wind to point up for the top and down for the underside
    def fix(T, want):
        n = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]]); f = (n * want(V[T].mean(1))).sum(1) < 0
        T[f] = T[f][:, [0, 2, 1]]; return T
    nt = (NB - 1) * NR * 2
    BTt = BT[:nt * 2]; BTe = BT[nt * 2:]
    up_ = BTt[0::4].tolist() + BTt[1::4].tolist(); dn_ = BTt[2::4].tolist() + BTt[3::4].tolist()
    up_ = fix(np.array(up_), lambda p: np.array([0, 1, 0])); dn_ = fix(np.array(dn_), lambda p: np.array([0, -1, 0]))
    BTe = fix(BTe, lambda p: (p - c) * [1, 0, 1])
    T = fix(T, lambda p: p - c)
    # crown: inner lining faces must point inwards
    nouter = NP * NT * 2
    T[nouter:nouter * 2] = fix(T[nouter:nouter * 2], lambda p: c - p)
    # button
    top_ = surf(0, np.pi / 2 - 1e-3); BTV = []; BTUV = []; bb = len(V)
    for k in range(13):
        a = 2 * np.pi * k / 12
        for h, rr in [(0, 0.0075), (0.004, 0.0068), (0.006, 0.0)]:
            BTV.append(top_ + [rr * np.cos(a), h - 0.001, rr * np.sin(a)]); BTUV.append([0.97, 0.97])
    V = np.vstack([V, BTV]); UV = np.vstack([UV, BTUV]); BTT = []
    for k in range(12):
        for l in range(2):
            a, b = bb + k * 3 + l, bb + (k + 1) * 3 + l
            BTT += [[a, b, b + 1], [a, b + 1, a + 1]]
    BTT = fix(np.array(BTT), lambda p: p - top_ + [0, 0.003, 0])
    T = np.vstack([T, up_, dn_, BTe, BTT])
    return V, T, UV, c, r

def paint(W=1024, H=1024):
    """top half (v 0.5..1): crown, u = azimuth; bottom half: brim"""
    navy = np.array([24, 36, 60.0]); C = np.ones((H, W, 3)) * navy; Hh = np.zeros((H, W))
    X, Y = np.meshgrid((np.arange(W) + 0.5) / W, (np.arange(H) + 0.5) / H)
    rng = np.random.default_rng(5)
    # twill weave
    tw = np.sin((X * 900 + Y * 900) * 1.0) * 0.5 + 0.5
    C *= (0.93 + 0.1 * tw)[:, :, None]; Hh += tw * 0.25
    crown = Y > 0.5; t = (Y - 0.5) * 2
    ph = X * 2 * np.pi - np.pi
    for s in np.radians([0, 60, 120, 180, -60, -120]):
        d = np.abs(((ph - s) + np.pi) % (2 * np.pi) - np.pi) * np.cos(t * np.pi / 2 * 0.98)   # angular -> roughly metric
        seam = crown & (d < 0.004); C[seam] *= 0.6; Hh[seam] -= 1.2
        for off in (-0.012, 0.012):
            st = crown & (np.abs(d - abs(off)) < 0.0018) & ((t * 140) % 1 < 0.6) & (t < 0.97)
            C[st] = C[st] * 0.75 + 15; Hh[st] -= 0.4
        # eyelet on each panel
        pc = s + np.radians(30)
        de = np.hypot(((ph - pc) + np.pi) % (2 * np.pi) - np.pi, (t - 0.78) * 2.2)
        ey = crown & (de < 0.03); C[ey] = navy * 0.5; Hh[ey] -= 1
        eyr = crown & (de >= 0.03) & (de < 0.045); C[eyr] = navy * 1.25 + 10; Hh[eyr] += 0.6
    # rows of stitching round the band
    for tb in (0.035, 0.06):
        st = crown & (np.abs(t - tb) < 0.004) & ((X * 300) % 1 < 0.6); C[st] = C[st] * 0.8 + 18; Hh[st] -= 0.4
    # brim: concentric stitching rows near the root
    brim = Y < 0.5; bt = (Y - 0.05) / 0.38
    for k in range(6):
        st = brim & (np.abs(bt - (0.18 + k * 0.1)) < 0.006) & ((X * 260) % 1 < 0.6); C[st] = C[st] * 0.8 + 16; Hh[st] -= 0.5
    edge = brim & (bt > 0.93); C[edge] *= 0.9
    lining = Y < 0.03; C[lining] = np.array([40, 44, 50.0])
    n = np.array(Image.fromarray((rng.random((H, W)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))) / 255.0
    C *= (0.96 + 0.08 * n)[:, :, None]
    col = Image.fromarray(np.clip(C, 0, 255).astype(np.uint8))
    hm = np.array(Image.fromarray(np.clip(128 + Hh * 40, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), float) / 40
    gx = np.roll(hm, -1, 1) - np.roll(hm, 1, 1); gy = np.roll(hm, -1, 0) - np.roll(hm, 1, 0)
    nx, ny = -gx * 0.8, gy * 0.8; L = np.sqrt(nx * nx + ny * ny + 1)
    nm = np.stack([nx / L, ny / L, 1 / L], -1) * 0.5 + 0.5
    return col, Image.fromarray((nm * 255).astype(np.uint8))
