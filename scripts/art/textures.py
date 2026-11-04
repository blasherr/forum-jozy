"""Textures procédurales du site : papier, cuir, bois, sceaux de cire, grain.
Tout est généré ici : aucune image tierce, donc aucun problème de droits.
Usage : python scripts/art/textures.py <dossier-de-sortie>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage as ndi

OUT = Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "public/textures")
OUT.mkdir(parents=True, exist_ok=True)


def spectral(size, beta, seed):
    """Bruit fractal périodique (se répète sans couture) par synthèse spectrale."""
    h, w = (size, size) if isinstance(size, int) else size
    rng = np.random.default_rng(seed)
    white = rng.normal(size=(h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    f = np.sqrt(fx**2 + fy**2)
    f[0, 0] = 1
    spec = np.fft.rfft2(white) / f ** (beta / 2)
    spec[0, 0] = 0
    out = np.fft.irfft2(spec, s=(h, w))
    return (out - out.mean()) / out.std()


def norm(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-9)


def emboss(height, strength=1.0, light=(-0.6, -0.7)):
    gy, gx = np.gradient(height)
    shade = gx * light[0] + gy * light[1]
    return shade * strength


def save(rgb, name, quality=82):
    arr = np.clip(rgb, 0, 1)
    Image.fromarray((arr * 255 + 0.5).astype(np.uint8)).save(OUT / name, quality=quality, method=6)
    print("ok", name)


def lerp(a, b, t):
    return a + (b - a) * t


def rgb(hexstr):
    h = hexstr.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)])


# ---------------------------------------------------------------- papier
def fibers(size, count, seed, wrap=True):
    rng = np.random.default_rng(seed)
    scale = 2
    im = Image.new("L", (size * scale, size * scale), 0)
    d = ImageDraw.Draw(im)
    for _ in range(count):
        x, y = rng.uniform(0, size * scale, 2)
        ang = rng.uniform(0, np.pi)
        ln = rng.uniform(12, 70)
        pts = []
        for s in np.linspace(0, 1, 7):
            ang += rng.normal(0, 0.18)
            pts.append((x + np.cos(ang) * ln * s, y + np.sin(ang) * ln * s))
        d.line(pts, fill=int(rng.uniform(60, 190)), width=1)
    im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255


def paper(size=1024, seed=7, tone=("#e2cfa6", "#c9ad7b", "#a98757"), name="paper.webp"):
    light, mid, dark = (rgb(c) for c in tone)
    mottle = spectral(size, 2.6, seed)
    cloud = spectral(size, 3.4, seed + 1)
    grain = spectral(size, 0.8, seed + 2)
    fine = spectral(size, 0.2, seed + 3)
    fib = fibers(size, 5200, seed + 4)

    t = norm(mottle * 0.7 + cloud * 0.9)
    base = lerp(light[None, None], mid[None, None], (t**1.4)[..., None])

    # taches d'humidité et rousseurs
    stain = norm(spectral(size, 3.0, seed + 5))
    stain = np.clip((stain - 0.62) * 5, 0, 1)
    edge = np.abs(ndi.gaussian_filter(stain, 1.2, mode="wrap") - ndi.gaussian_filter(stain, 6, mode="wrap"))
    base = lerp(base, dark[None, None], (stain * 0.16 + np.clip(edge * 1.6, 0, 0.3))[..., None])

    rng = np.random.default_rng(seed + 6)
    fox = np.zeros((size, size), dtype=np.float32)
    for _ in range(170):
        x, y = rng.integers(0, size, 2)
        fox[y, x] = rng.uniform(0.4, 1)
    fox = ndi.gaussian_filter(fox, 2.2, mode="wrap") * 30
    fox = np.clip(fox, 0, 1) * norm(fine)
    base = lerp(base, rgb("#8a5a2b")[None, None], (fox * 0.55)[..., None])

    # relief de la pâte à papier
    relief = grain * 0.5 + fine * 0.3 + fib * 1.5
    shade = emboss(ndi.gaussian_filter(relief, 0.7, mode="wrap"), 0.19)
    base = base * (1 + shade[..., None]) - (fib * 0.04)[..., None]
    base += (fine * 0.009)[..., None]
    save(base, name, 80)


# ---------------------------------------------------------------- cuir
def worley(size, cells, seed):
    rng = np.random.default_rng(seed)
    pts = rng.uniform(0, size, (cells, 2))
    pts = np.concatenate([pts + [dx * size, dy * size] for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    from scipy.spatial import cKDTree

    tree = cKDTree(pts)
    yy, xx = np.mgrid[0:size, 0:size]
    d, _ = tree.query(np.stack([xx.ravel(), yy.ravel()], 1), k=2)
    return (d[:, 1] - d[:, 0]).reshape(size, size)


def leather(size=1024, seed=21, color="#3a2214", name="leather.webp"):
    cell = worley(size, 5200, seed)
    warp = spectral(size, 2.8, seed + 1)
    wx = ndi.map_coordinates(
        cell,
        np.mgrid[0:size, 0:size] + np.stack([warp * 4, np.roll(warp, 300, 0) * 4]),
        order=1,
        mode="wrap",
    )
    pebble = np.clip(wx / 5.5, 0, 1) ** 0.55
    h = ndi.gaussian_filter(pebble, 0.9, mode="wrap")
    crease = np.clip(1 - np.abs(spectral(size, 2.2, seed + 2)) * 6, 0, 1) ** 3
    h = h - crease * 0.6
    shade = emboss(h, 2.4)
    tone = norm(spectral(size, 3.0, seed + 3))
    base = rgb(color)[None, None] * (0.72 + 0.56 * tone[..., None])
    out = base * (1 + shade[..., None]) * (0.62 + 0.38 * h[..., None])
    out += (np.clip(shade, 0, 1) ** 2 * 0.1)[..., None]
    save(out, name, 78)


# ---------------------------------------------------------------- bois
def wood(w=1536, h=768, planks=4, seed=33, name="wood.webp", dark="#21130a", mid="#4a2c17"):
    rows = []
    ph = h // planks
    rng = np.random.default_rng(seed)
    for i in range(planks):
        s = seed + i * 11
        lo = spectral((ph, w), 2.4, s)
        wavy = ndi.gaussian_filter(lo, (6, 90), mode="wrap")
        yy = np.arange(ph)[:, None] / ph
        rings = np.sin((yy * rng.uniform(16, 30) + wavy * 2.2) * np.pi * 2)
        streak = spectral((ph, w), 1.6, s + 1)
        streak = ndi.gaussian_filter(streak, (0.7, 34), mode="wrap")
        v = norm(rings * 0.55 + streak * 1.3)
        c = lerp(rgb(dark)[None, None], rgb(mid)[None, None], (v**1.3)[..., None])
        c *= rng.uniform(0.82, 1.08)
        pores = np.clip(ndi.gaussian_filter(spectral((ph, w), 0.2, s + 2), (0.5, 9), mode="wrap") * 1.6 - 0.8, 0, 1)
        c *= (1 - pores * 0.3)[..., None]
        bevel = np.minimum(np.arange(ph), np.arange(ph)[::-1])[:, None] / 3
        c *= np.clip(bevel, 0.12, 1)[..., None] if False else (0.45 + 0.55 * np.clip(bevel, 0, 1))[..., None]
        highlight = (np.arange(ph) == 1)[:, None]
        c += highlight[..., None] * 0.05
        rows.append(np.roll(c, rng.integers(0, w), axis=1))
    img = np.concatenate(rows, 0)
    save(img, name, 78)


# ---------------------------------------------------------------- sceaux de cire
def seal(letters, color, name, size=512, seed=1, font_path=r"C:\Windows\Fonts\georgiab.ttf"):
    ss = 2
    n = size * ss
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n] / n - 0.5
    ang = np.arctan2(yy, xx)
    r = np.sqrt(xx**2 + yy**2)
    # contour irrégulier de cire écrasée
    wob = np.zeros_like(ang)
    for k in range(3, 19):
        wob += rng.normal(0, 0.042 / np.sqrt(k)) * np.sin(ang * k + rng.uniform(0, 6.28))
    outer = 0.415 + wob * 0.65
    mask = (r < outer).astype(np.float32)

    # coulures
    blobs = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(blobs)
    for _ in range(7):
        a = rng.uniform(0, 6.28)
        rr = rng.uniform(0.36, 0.43) * n
        cx, cy = n / 2 + np.cos(a) * rr, n / 2 + np.sin(a) * rr
        q = rng.uniform(0.025, 0.06) * n
        d.ellipse([cx - q, cy - q, cx + q, cy + q], fill=255)
    mask = np.maximum(mask, np.asarray(blobs, dtype=np.float32) / 255)
    mask = ndi.gaussian_filter(mask, 7 * ss)
    mask = (mask > 0.5).astype(np.float32)

    dist = ndi.distance_transform_edt(mask) / n
    dome = np.clip(dist / 0.05, 0, 1) ** 0.6

    # cuvette centrale frappée par le cachet
    stamp_r = 0.315
    bowl = np.clip((stamp_r - r) / 0.022, 0, 1)
    height = dome * 1.0 - bowl * 0.42

    # anneaux gravés
    ring1 = np.exp(-(((r - 0.285) / 0.0052) ** 2))
    ring2 = np.exp(-(((r - 0.264) / 0.0030) ** 2))
    height += (ring1 * 0.17 + ring2 * 0.1) * bowl

    # perles et crans autour du cachet
    dots = np.zeros_like(r)
    for i in range(48):
        a = i / 48 * 6.283
        dots += np.exp(-(((xx - np.cos(a) * 0.298) ** 2 + (yy - np.sin(a) * 0.298) ** 2) / 0.00002))
    height += dots * 0.12 * bowl

    # lettres en relief : le monogramme du logo s'il existe, sinon une police
    lim = Image.new("L", (n, n), 0)
    logo = Path("public/brand/nf-mask.png")
    if logo.exists():
        mark = Image.open(logo).convert("L")
        lw = int(n * 0.44)
        mark = mark.resize((lw, round(lw * mark.height / mark.width)), Image.LANCZOS)
        lim.paste(mark, ((n - mark.width) // 2, (n - mark.height) // 2))
    else:
        ld = ImageDraw.Draw(lim)
        font = ImageFont.truetype(font_path, int(n * (0.3 if len(letters) <= 2 else 0.22)))
        box = ld.textbbox((0, 0), letters, font=font)
        ld.text(((n - box[2] - box[0]) / 2, (n - box[3] - box[1]) / 2), letters, fill=255, font=font)
    letter = np.asarray(lim, dtype=np.float32) / 255
    relief = ndi.gaussian_filter(letter, 2.4 * ss) * 0.42 + ndi.gaussian_filter(letter, 0.7 * ss) * 0.12
    height += relief * bowl

    wrinkle = ndi.gaussian_filter(rng.normal(size=(n, n)), 18 * ss)
    wrinkle /= wrinkle.std()
    micro = ndi.gaussian_filter(rng.normal(size=(n, n)), 3 * ss)
    micro /= micro.std()
    height += wrinkle * 0.05 + micro * 0.006
    height = ndi.gaussian_filter(height, 1.2 * ss)

    gy, gx = np.gradient(height * n * 0.022)
    nz = 1 / np.sqrt(gx**2 + gy**2 + 1)
    nx, ny = -gx * nz, -gy * nz
    L = np.array([-0.45, -0.62, 0.64])
    L /= np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    H = L + np.array([0, 0, 1])
    H /= np.linalg.norm(H)
    spec = np.clip(nx * H[0] + ny * H[1] + nz * H[2], 0, 1)
    gloss = spec**42 * 0.75 + spec**11 * 0.18

    base = rgb(color)
    sss = rgb(color) * 1.55  # transmission dans la cire fine
    edge_thin = np.exp(-dist / 0.018)
    col = base[None, None] * (0.22 + 1.05 * diff[..., None])
    col = lerp(col, np.clip(sss, 0, 1)[None, None] * (0.4 + diff[..., None]), (edge_thin * 0.28)[..., None])
    col += gloss[..., None] * np.array([1.0, 0.92, 0.84])
    alpha = ndi.gaussian_filter(mask, 0.8 * ss)
    out = np.dstack([np.clip(col, 0, 1), alpha])
    im = Image.fromarray((out * 255).astype(np.uint8), "RGBA").resize((size, size), Image.LANCZOS)

    # ombre portée douce
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    a = im.getchannel("A").filter(ImageFilter.GaussianBlur(9))
    shadow.putalpha(a.point(lambda v: int(v * 0.5)))
    canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
    canvas.alpha_composite(shadow, (5, 8))
    canvas.alpha_composite(im)
    canvas.save(OUT / name, quality=88, method=6)
    print("ok", name)


# ---------------------------------------------------------------- grain d'encre & voile
def grunge(size=512, seed=55, name="grunge.png"):
    """Masque d'usure pour les tampons et les titres imprimés."""
    n = norm(spectral(size, 1.1, seed))
    m = norm(spectral(size, 2.6, seed + 1))
    keep = np.clip((n * 0.55 + m * 0.45 - 0.3) * 7, 0, 1)
    speck = np.clip((norm(spectral(size, 0.1, seed + 2)) - 0.33) * 16, 0, 1)
    a = keep * speck
    im = np.dstack([np.zeros_like(a), np.zeros_like(a), np.zeros_like(a), a])
    Image.fromarray((im * 255).astype(np.uint8), "RGBA").save(OUT / name, optimize=True)
    print("ok", name)


def dust(size=1024, seed=70, name="dust.webp"):
    rng = np.random.default_rng(seed)
    pts = np.zeros((size, size), np.float32)
    for _ in range(900):
        x, y = rng.integers(0, size, 2)
        pts[y, x] = rng.uniform(0.3, 1)
    a = ndi.gaussian_filter(pts, 0.8, mode="wrap") * 3 + ndi.gaussian_filter(pts, 2.2, mode="wrap") * 5
    haze = norm(spectral(size, 3.2, seed + 1)) ** 2.4 * 0.5
    a = np.clip(a + haze * 0.3, 0, 1)
    col = np.ones((size, size, 3)) * rgb("#f3d3a3")
    Image.fromarray((np.dstack([col, a]) * 255).astype(np.uint8), "RGBA").save(OUT / name, quality=70, method=6)
    print("ok", name)


if __name__ == "__main__":
    if "--seals" not in sys.argv:
        paper()
        paper(seed=19, tone=("#efe2c4", "#ddc99f", "#b89a6a"), name="paper-light.webp")
        paper(seed=31, tone=("#b89b6e", "#94754b", "#5f4526"), name="paper-aged.webp")
        leather()
        leather(seed=25, color="#1e120b", name="leather-dark.webp")
        wood()
        wood(seed=44, name="wood-dark.webp", dark="#120a05", mid="#2d1a0d")
        grunge()
        dust()
    seal("NF", "#7d1512", "seal-red.webp", seed=3)
    seal("NF", "#1e1a18", "seal-black.webp", seed=5)
    seal("NF", "#8a6516", "seal-gold.webp", seed=9)
    seal("NF", "#1d3b2c", "seal-green.webp", seed=12)
    seal("NF", "#1b2c4d", "seal-blue.webp", seed=16)
