# Tileable micro-detail normal maps: polo pique knit, trouser twill, skin pores.
import numpy as np
from PIL import Image
S = 256
rng = np.random.default_rng(11)
X, Y = np.meshgrid(np.arange(S) / S, np.arange(S) / S)
def blur_wrap(a, r):
    f = np.fft.fft2(a); kx = np.fft.fftfreq(S)[None, :]; ky = np.fft.fftfreq(S)[:, None]
    return np.real(np.fft.ifft2(f * np.exp(-(kx ** 2 + ky ** 2) * (2 * np.pi * r) ** 2 / 2)))
def to_normal(h, k):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * k; gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * k
    n = np.stack([-gx, gy, np.ones_like(h)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))
# pique: offset rows of small cells
C = 12
cx = (X * C) % 1; row = np.floor(Y * C * 1.5); cy = (Y * C * 1.5) % 1
cx = (cx + 0.5 * (row % 2)) % 1
h = np.clip(1 - ((cx - 0.5) ** 2 + (cy - 0.5) ** 2 * 1.4) * 5.5, 0, 1) ** 0.7
h += blur_wrap(rng.random((S, S)), 1.0) * 0.6
to_normal(blur_wrap(h, 0.8), 2.2).save('out/golfer-pique.jpg', quality=92)
# twill: diagonal ribs
t = np.sin(2 * np.pi * (X * 24 + Y * 24)) * 0.5 + 0.5
t = t ** 1.5 + blur_wrap(rng.random((S, S)), 0.7) * 0.5
to_normal(blur_wrap(t, 0.7), 1.6).save('out/golfer-twill.jpg', quality=92)
# skin: pores + fine creases
p = np.zeros((S, S))
pts = rng.random((900, 2))
for px, py in pts:
    dx = ((X - px + 0.5) % 1) - 0.5; dy = ((Y - py + 0.5) % 1) - 0.5
    p -= np.exp(-(dx * dx + dy * dy) / (2 * 0.0035 ** 2))
cre = blur_wrap(rng.normal(size=(S, S)), 2.5); cre = -np.abs(cre) * 3
p = p * 0.7 + cre * 0.5 + blur_wrap(rng.normal(size=(S, S)), 0.8) * 0.3
to_normal(blur_wrap(p, 0.6), 2.0).save('out/golfer-pores.jpg', quality=92)
print('ok')
