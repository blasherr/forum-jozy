"""Objets physiques du site : feuilles de papier à bords déchirés, plaques rivetées, clous, brume.
Chaque image est un « 9-slice » : ses bords se répètent sans couture, donc une feuille peut faire
200 ou 8000 pixels de haut sans se déformer, et s'anime sans filtre coûteux.
Usage : python scripts/art/materials.py <dossier-de-sortie>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "public/textures")
OUT.mkdir(parents=True, exist_ok=True)


def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def tile2(n, beta, seed):
    """Bruit fractal 2D périodique de période n."""
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.rfftfreq(n)[None, :]
    f = np.sqrt(fx**2 + fy**2)
    f[0, 0] = 1
    spec = np.fft.rfft2(rng.normal(size=(n, n))) / f ** (beta / 2)
    spec[0, 0] = 0
    out = np.fft.irfft2(spec, s=(n, n))
    return ((out - out.mean()) / out.std()).astype(np.float32)


def tile1(n, beta, seed):
    """Bruit 1D périodique de période n : le bord déchiré boucle parfaitement."""
    rng = np.random.default_rng(seed)
    f = np.fft.rfftfreq(n)
    f[0] = 1
    spec = np.fft.rfft(rng.normal(size=n)) / f ** (beta / 2)
    spec[0] = 0
    out = np.fft.irfft(spec, n)
    return ((out - out.mean()) / out.std()).astype(np.float32)


def composite_shadow(color, alpha, offset=14, blur=16, strength=0.6):
    """Ajoute l'ombre portée et renvoie une image RGBA."""
    soft = ndi.gaussian_filter(np.roll(alpha, offset, axis=0), blur)
    tight = ndi.gaussian_filter(np.roll(alpha, offset // 3, axis=0), blur / 4)
    shade = np.clip(soft * strength + tight * 0.3, 0, 1) * (1 - alpha)
    a = alpha + shade
    shadow_col = np.array([0.07, 0.04, 0.02], dtype=np.float32)
    rgb_out = (color * alpha[..., None] + shadow_col * shade[..., None]) / np.maximum(a, 1e-4)[..., None]
    return np.dstack([np.clip(rgb_out, 0, 1), np.clip(a, 0, 1)])


def save_rgba(arr, name, quality=86):
    Image.fromarray((arr * 255 + 0.5).astype(np.uint8), "RGBA").save(OUT / name, quality=quality, alpha_quality=92, method=6)
    print("ok", name)


def sheet(name, light, mid, edge, seed, S=1400, c=200, m=70):
    """Feuille à bords déchirés. Le centre reste calme : c'est là qu'on lit."""
    P = S - 2 * c
    yy, xx = np.mgrid[0:S, 0:S]
    ix = (xx - c) % P
    iy = (yy - c) % P

    def deckle(s):
        return tile1(P, 2.4, s) * 8 + tile1(P, 1.2, s + 1) * 2.6 + tile1(P, 0.5, s + 2) * 0.9

    left = xx - (m + deckle(seed)[iy])
    right = S - 1 - xx - (m + deckle(seed + 3)[iy])
    top = yy - (m + deckle(seed + 6)[ix])
    bottom = S - 1 - yy - (m + deckle(seed + 9)[ix])
    dist = np.minimum.reduce([left, right, top, bottom]).astype(np.float32)
    alpha = smooth(-1.1, 1.1, dist)

    low = tile2(P, 3.1, seed + 20)
    grain = tile2(P, 1.1, seed + 21)
    fine = tile2(P, 0.2, seed + 22)
    fib = np.zeros((P, P), np.float32)
    rng = np.random.default_rng(seed + 23)
    for _ in range(2600):
        x, y = rng.uniform(0, P, 2)
        a = rng.uniform(0, np.pi)
        for t in range(int(rng.uniform(8, 34))):
            fib[int(y + np.sin(a) * t) % P, int(x + np.cos(a) * t) % P] = 1
            a += rng.normal(0, 0.1)
    fib = ndi.gaussian_filter(fib, 0.7, mode="wrap")
    relief = ndi.gaussian_filter(grain * 0.5 + fine * 0.25 + fib * 2.4, 0.8, mode="wrap")
    gy, gx = np.gradient(relief)
    shade = (-gx * 0.6 - gy * 0.75) * 0.17

    tone = smooth(-1.7, 1.7, low)[iy, ix]
    col = rgb(light) + (rgb(mid) - rgb(light)) * (tone * 0.62)[..., None]
    col = col * (1 + shade[iy, ix] * 0.8 + fine[iy, ix] * 0.0035)[..., None]

    d = np.clip(dist, 0, None)
    burn = np.exp(-d / 24) * 0.62 + np.exp(-d / 110) * 0.16
    col = col + (rgb(edge) - col) * burn[..., None]
    rim = smooth(0, 2.5, dist) * (1 - smooth(2.5, 8, dist))
    col = col + rim[..., None] * 0.09

    save_rgba(composite_shadow(col.astype(np.float32), alpha), name)


def plate(name, face, face2, edge, ink, seed, W=440, H=176, c=70, m=16):
    """Plaque de métal ou de bois laqué : biseau, rivets, patine, rendu avec une vraie lumière."""
    ss = 2
    w, h = W * ss, H * ss
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    qx = np.abs(xx - w / 2) - (w / 2 - (m + 12) * ss)
    qy = np.abs(yy - h / 2) - (h / 2 - (m + 12) * ss)
    sd = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2) + np.minimum(np.maximum(qx, qy), 0) - 12 * ss
    alpha = smooth(0.8, -0.8, sd)
    d = np.clip(-sd, 0, None) / ss

    rng = np.random.default_rng(seed)
    P = 512
    n1 = np.asarray(Image.fromarray(tile2(P, 2.6, seed)).resize((w, h), Image.BICUBIC))
    n2 = tile2(P, 1.2, seed + 1)
    n2 = np.tile(n2, (h // P + 1, w // P + 1))[:h, :w]
    streak = ndi.gaussian_filter(np.tile(tile2(P, 0.4, seed + 2), (h // P + 1, w // P + 1))[:h, :w], (0.6, 18))
    streak /= streak.std()

    height = smooth(0, 7, d) * 1.0 + smooth(8, 11, d) * 0.28 - smooth(11, 14, d) * 0.12
    height = height + n2 * 0.006 + streak * 0.012 + n1 * 0.012

    # griffures
    from PIL import ImageDraw

    sc = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(sc)
    for _ in range(46):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        a = rng.normal(0.05, 0.5)
        ln = rng.uniform(10, 70) * ss
        dr.line([(x, y), (x + np.cos(a) * ln, y + np.sin(a) * ln)], fill=int(rng.uniform(60, 170)), width=1)
    scratches = ndi.gaussian_filter(np.asarray(sc, dtype=np.float32) / 255, 0.6)
    height = height - scratches * 0.03

    # rivets dans les quatre coins
    rivet_mask = np.zeros_like(height)
    for cx in (m + 26, W - m - 26):
        for cy in (m + 24, H - m - 24):
            r = np.sqrt((xx / ss - cx) ** 2 + (yy / ss - cy) ** 2)
            dome = np.sqrt(np.clip(1 - (r / 7.5) ** 2, 0, 1))
            height = height + dome * 0.95 - np.exp(-(((r - 9) / 1.5) ** 2)) * 0.14
            rivet_mask = np.maximum(rivet_mask, smooth(8, 6.5, r))

    height = ndi.gaussian_filter(height, 0.7 * ss)
    gy, gx = np.gradient(height * 3.4)
    nz = 1 / np.sqrt(gx**2 + gy**2 + 1)
    nx, ny = -gx * nz, -gy * nz
    L = np.array([-0.42, -0.66, 0.62])
    L = L / np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    H_v = L + np.array([0, 0, 1])
    H_v = H_v / np.linalg.norm(H_v)
    sp = np.clip(nx * H_v[0] + ny * H_v[1] + nz * H_v[2], 0, 1)

    patina = smooth(-1.4, 1.4, n1 + n2 * 0.18)
    col = rgb(face) + (rgb(face2) - rgb(face)) * patina[..., None]
    rim_band = 1 - smooth(9, 12, d)
    col = col + (rgb(edge) - col) * np.maximum(rim_band, rivet_mask)[..., None]
    grad = (1 - yy / h)[..., None] * 0.22 + 0.9
    col = col * grad * (0.34 + 0.96 * diff[..., None])
    col = col + (sp**60 * 0.46 + sp**14 * 0.1)[..., None] * rgb(ink)
    col = np.clip(col, 0, 1).astype(np.float32)

    out = composite_shadow(col, alpha, offset=6 * ss, blur=5 * ss, strength=0.7)
    im = Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA").resize((W, H), Image.LANCZOS)
    im.save(OUT / name, quality=88, alpha_quality=92, method=6)
    print("ok", name)


def nail(name="nail.webp", S=96):
    ss = 3
    n = S * ss
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    r = np.sqrt((xx - n / 2) ** 2 + (yy - n / 2) ** 2) / (n * 0.3)
    alpha = smooth(1.02, 0.98, r)
    h = np.sqrt(np.clip(1 - r**2, 0, 1)) * 0.55 + ndi.gaussian_filter(np.random.default_rng(3).normal(size=(n, n)), 3 * ss) * 3
    gy, gx = np.gradient(ndi.gaussian_filter(h, 2) * n * 0.05)
    nz = 1 / np.sqrt(gx**2 + gy**2 + 1)
    L = np.array([-0.45, -0.6, 0.66])
    L = L / np.linalg.norm(L)
    diff = np.clip(-gx * nz * L[0] - gy * nz * L[1] + nz * L[2], 0, 1)
    col = rgb("#6f6a62")[None, None] * (0.25 + 0.95 * diff[..., None]) + (diff**22)[..., None] * 0.5
    out = composite_shadow(np.clip(col, 0, 1).astype(np.float32), alpha, offset=4 * ss, blur=3 * ss, strength=0.8)
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA").resize((S, S), Image.LANCZOS).save(OUT / name, quality=88, method=6)
    print("ok", name)


def fog(name="fog.webp", W=2048, H=640, seed=91):
    """Banc de brume : se répète sans couture à l'horizontale."""
    n = tile2(W, 3.3, seed) * 0.8 + tile2(W, 2.4, seed + 1) * 0.35
    n = n[:H]
    v = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    env = np.clip(np.sin(v * np.pi), 0, 1) ** 2.2
    a = smooth(-1.1, 2.0, n) * env * 0.85
    a = ndi.gaussian_filter(a, (14, 26), mode=("nearest", "wrap"))
    col = np.ones((H, W, 3), np.float32) * rgb("#f4dcc0")
    Image.fromarray((np.dstack([col, a]) * 255 + 0.5).astype(np.uint8), "RGBA").save(OUT / name, quality=72, alpha_quality=80, method=6)
    print("ok", name)


if __name__ == "__main__":
    sheet("sheet-paper-light.webp", "#f3ead6", "#e8dcc2", "#8a6238", seed=11)
    sheet("sheet-paper.webp", "#ece0c6", "#dfd0af", "#7c5630", seed=31)
    sheet("sheet-paper-aged.webp", "#e2d3b1", "#d1bd95", "#6a4626", seed=51)
    plate("plate-red.webp", "#8a1a13", "#6c120d", "#b48a45", "#ffd9b0", seed=7)
    plate("plate-iron.webp", "#34302b", "#25211d", "#6f675c", "#e8dcc8", seed=17)
    plate("plate-brass.webp", "#c9a24e", "#a9812f", "#7d5e20", "#fff2cf", seed=27)
    nail()
    fog()
