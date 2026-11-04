"""Paysages de la frontière, 1847 : relief rendu par lancer de rayons sur une carte de hauteurs,
lumière de fin de jour, brume, puis gravure façon presse d'époque.
Usage : python scripts/art/landscape.py <dossier-de-sortie> [mountains|bayou|all]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "public/art")
OUT.mkdir(parents=True, exist_ok=True)
WHICH = sys.argv[2] if len(sys.argv) > 2 else "all"


def spectral(n, beta, seed):
    rng = np.random.default_rng(seed)
    white = rng.normal(size=(n, n))
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.rfftfreq(n)[None, :]
    f = np.sqrt(fx**2 + fy**2)
    f[0, 0] = 1
    spec = np.fft.rfft2(white) / f ** (beta / 2)
    spec[0, 0] = 0
    out = np.fft.irfft2(spec, s=(n, n))
    return (out - out.mean()) / out.std()


def norm(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-9)


def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def bilinear(field, x, y):
    n = field.shape[0]
    xi = np.floor(x).astype(np.int32)
    yi = np.floor(y).astype(np.int32)
    fx = x - xi
    fy = y - yi
    x0, x1 = xi & (n - 1), (xi + 1) & (n - 1)
    y0, y1 = yi & (n - 1), (yi + 1) & (n - 1)
    a = field[y0, x0] * (1 - fx) + field[y0, x1] * fx
    b = field[y1, x0] * (1 - fx) + field[y1, x1] * fx
    return a * (1 - fy) + b * fy


def fbm_clouds(w, h, seed):
    n = 2048
    base = spectral(n, 3.3, seed)
    fine = spectral(n, 2.4, seed + 1)
    yy = np.linspace(0, 1, h)[:, None]
    xx = np.linspace(0, 1, w)[None, :]
    # perspective : les nuages s'écrasent vers l'horizon
    v = (1 / (yy + 0.09) - 1) * 0.11
    u = (xx - 0.5) * (1 / (yy + 0.2)) * 0.34 + 0.5
    uu = (u * n).astype(np.float32)
    vv = np.repeat((v * n).astype(np.float32), w, axis=1)
    uu = np.repeat(uu, 1, axis=0)
    a = bilinear(base, uu, vv)
    b = bilinear(fine, uu * 2.3, vv * 2.3)
    return a * 0.8 + b * 0.35


def fbm1d(n, seed, beta=2.1):
    rng = np.random.default_rng(seed)
    spec = np.fft.rfft(rng.normal(size=n))
    f = np.fft.rfftfreq(n)
    f[0] = 1
    spec = spec / f ** (beta / 2)
    spec[0] = 0
    out = np.fft.irfft(spec, n)
    return (out - out.mean()) / out.std()


def mountains(w=1920, h=1080, seed=4):
    """Chaines de l'Ambarino en plans successifs : la perspective aerienne fait le relief."""
    py, px = np.mgrid[0:h, 0:w].astype(np.float32)
    v = (py + 0.5) / h
    aspect = w / h
    sun_screen = (0.86, 0.5)
    ds = np.sqrt(((px / w - sun_screen[0]) * aspect) ** 2 + (v - sun_screen[1]) ** 2)
    sky = rgb("#1c2138") + (rgb("#6b3650") - rgb("#1c2138")) * smooth(0.0, 0.26, v)[..., None]
    sky = sky + (rgb("#d05a30") - sky) * smooth(0.16, 0.44, v)[..., None]
    sky = sky + (rgb("#ffc77d") - sky) * smooth(0.38, 0.58, v)[..., None]
    sky = sky + rgb("#fff0c7") * (np.exp(-ds * 13) * 1.3 + np.exp(-ds * 3.4) * 0.42)[..., None]
    cl = fbm_clouds(w, h, seed + 8)
    dens = smooth(0.15, 1.5, cl) * (1 - smooth(0.36, 0.52, v))
    under = rgb("#ffb070") * 1.05
    dark = rgb("#30263a")
    col = dark + (under - dark) * smooth(0.08, 0.46, v)[..., None]
    img = sky + (col - sky) * (dens * 0.92)[..., None]

    detail = np.asarray(Image.fromarray(spectral(2048, 2.3, seed + 3).astype(np.float32)).resize((w, h), Image.BILINEAR))
    fog = rgb("#ee9a58")
    layers = [
        (0.1, 0.5, 0.2, 0.62, 3, True),
        (0.26, 0.56, 0.15, 0.7, 11, True),
        (0.44, 0.62, 0.11, 0.78, 21, False),
        (0.62, 0.69, 0.07, 0.86, 31, False),
        (0.8, 0.76, 0.05, 0.94, 41, False),
    ]
    for depth, base, amp, rough, s2, peaks in layers:
        ridge = fbm1d(w * 2, seed + s2, 3.0 - 0.1 * rough)[: w]
        ridged = 1 - np.abs(fbm1d(w * 2, seed + s2 + 1, 2.7)[: w]) * 0.9
        line = (base - (ridge * 0.6 + ridged * 0.55) * amp * 0.5) * h
        mask = smooth(-1.2, 1.2, py - line[None, :])
        below = (py - line[None, :]) / h
        # flancs : lumiere rasante d'un cote, ombre de l'autre
        slope = ndi.gaussian_filter1d(np.gradient(line), 16)[None, :]
        lit = np.clip(0.5 + slope * 0.9 + detail * 0.22, 0, 1)
        far = rgb("#7e4a4a") * (1 - depth) + rgb("#1b130f") * depth
        warm = far + (rgb("#d9783e") - far) * (lit * (1 - depth * 0.55))[..., None]
        rock = warm * (0.84 + 0.2 * np.clip(detail, -1.5, 1.5))[..., None]
        if peaks:
            snow = smooth(0.0, 0.03, 0.05 - below) * smooth(-0.4, 0.5, detail + lit - 0.6)
            rock = rock + (rgb("#ffd9b8") - rock) * (snow * 0.8)[..., None]
        haze = np.exp(-np.clip(below, 0, None) * (9 + depth * 7))
        layer = rock + (fog - rock) * (((1 - depth) * 0.72 + (1 - haze) * (0.5 - depth * 0.42)))[..., None]
        img = img * (1 - mask[..., None]) + layer * mask[..., None]

    save_graded(img * 1.08, h, w, "mountains", seed)


def tonemap(img):
    img = np.clip(img, 0, None)
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((img * (a * img + b)) / (img * (c * img + d) + e), 0, 1)


def pine(draw, x, base, height, rng, color=0):
    """Pin en silhouette : tronc et étages de branches irréguliers."""
    width = height * 0.26
    draw.line([(x, base), (x + rng.normal(0, 1), base - height)], fill=color, width=max(1, int(height * 0.012)))
    tiers = int(height / 7) + 5
    for i in range(tiers):
        f = i / tiers
        y = base - height * (0.1 + f * 0.9)
        half = width * (1 - f) ** 0.86 * rng.uniform(0.62, 1.12) + 1
        for side in (-1, 1):
            tip = (x + side * half, y + half * rng.uniform(0.28, 0.5))
            pts = [(x, y - height * 0.022), tip, (x + side * half * 0.55, y + half * 0.16), (x, y + height * 0.03)]
            draw.polygon(pts, fill=color)
            for _ in range(4):
                s = rng.uniform(0.3, 1)
                px = x + side * half * s
                py = y + half * rng.uniform(0.1, 0.42) * s
                draw.line([(px, py), (px + side * rng.uniform(1, 6), py + rng.uniform(1, 8))], fill=color, width=1)


def rider(draw, x, y, s, color=0):
    """Cavalier à l'arrêt, vu de profil, sur la crête."""
    P = lambda pts: [(x + a * s, y + b * s) for a, b in pts]
    # jambes du cheval
    for pts in (
        [(-1.55, -2.1), (-1.72, -1.2), (-1.5, -0.62), (-1.62, 0.0), (-1.38, 0.0), (-1.28, -0.66), (-1.3, -1.25), (-1.14, -2.0)],
        [(-1.15, -2.1), (-1.08, -1.2), (-1.2, -0.6), (-1.1, 0.0), (-0.88, 0.0), (-0.96, -0.6), (-0.84, -1.2), (-0.8, -2.0)],
        [(1.0, -2.1), (1.06, -1.1), (0.98, -0.5), (1.04, 0.0), (1.26, 0.0), (1.2, -0.5), (1.32, -1.1), (1.36, -2.1)],
        [(1.36, -2.1), (1.52, -1.1), (1.62, -0.5), (1.66, 0.0), (1.88, 0.0), (1.8, -0.5), (1.74, -1.1), (1.7, -2.1)],
    ):
        draw.polygon(P(pts), fill=color)
    # corps, encolure, tête
    body = [
        (-1.9, -2.45), (-1.82, -3.05), (-1.4, -3.3), (-0.6, -3.22), (0.3, -3.2), (1.0, -3.42), (1.42, -3.9), (1.72, -4.5),
        (1.98, -4.86), (2.2, -4.98), (2.3, -5.12), (2.36, -4.94), (2.62, -4.68), (3.02, -4.28), (3.14, -4.04), (3.04, -3.86),
        (2.78, -3.88), (2.42, -4.04), (2.2, -4.0), (2.1, -3.5), (1.9, -2.9), (1.72, -2.4), (1.36, -2.02), (0.5, -1.92),
        (-0.8, -1.96), (-1.5, -2.02),
    ]
    draw.polygon(P(body), fill=color)
    # queue
    draw.polygon(P([(-1.86, -3.0), (-2.2, -2.8), (-2.42, -2.1), (-2.5, -1.3), (-2.32, -1.5), (-2.14, -2.1), (-1.86, -2.5)]), fill=color)
    # cavalier
    rider_pts = [
        (-0.5, -3.24), (-0.28, -3.36), (-0.34, -3.9), (-0.42, -4.5), (-0.3, -5.08), (-0.1, -5.3), (0.26, -5.32), (0.44, -5.1),
        (0.5, -4.6), (0.42, -3.9), (0.5, -3.3), (0.62, -2.8), (0.6, -2.3), (0.4, -2.26), (0.3, -2.8), (0.06, -3.1),
    ]
    draw.polygon(P(rider_pts), fill=color)
    # manteau qui flotte
    draw.polygon(P([(-0.38, -4.7), (-0.82, -3.9), (-1.08, -3.2), (-0.72, -3.24), (-0.42, -3.5)]), fill=color)
    # tête et chapeau
    draw.ellipse(P([(-0.1, -5.86), (0.32, -5.38)]), fill=color)
    draw.polygon(P([(-0.62, -5.62), (-0.12, -5.74), (-0.1, -6.18), (0.08, -6.3), (0.3, -6.18), (0.34, -5.76), (0.84, -5.68), (0.2, -5.54), (-0.2, -5.54)]), fill=color)
    # fusil en travers du dos
    draw.line(P([(-0.74, -5.0), (0.72, -3.82)]), fill=color, width=max(1, int(s * 0.09)))


def save_graded(img, h, w, name, seed):
    ss = 2
    im = Image.fromarray((tonemap(img) * 255).astype(np.uint8)).resize((w * ss, h * ss), Image.LANCZOS)
    layer = Image.new("L", im.size, 255)
    d = ImageDraw.Draw(layer)
    rng = np.random.default_rng(seed + 9)
    W, H = im.size

    def ground(x):
        u = x / W
        return H * (0.91 - 0.12 * np.exp(-(((u - 0.2) / 0.2) ** 2)) + 0.018 * np.sin(u * 9) + 0.007 * np.sin(u * 33))

    # crête de premier plan
    pts = [(x, ground(x)) for x in range(0, W + 8, 8)]
    d.polygon(pts + [(W, H), (0, H)], fill=0)
    # herbes
    for _ in range(7000):
        x = rng.uniform(0, W)
        y = ground(x) + rng.uniform(-2, 34)
        d.line([(x, y), (x + rng.normal(0, 6), y - rng.uniform(5, 24))], fill=0, width=1)
    # pins encadrant la scène
    for x, hh in [(40, 880), (240, 660), (-60, 1000), (420, 430), (610, 300), (2840, 640), (3060, 860), (3640, 1120), (3300, 960), (3540, 740), (2620, 380)]:
        pine(d, x * W / 3840, ground(x * W / 3840) + 18, hh * H / 2160 * 1.14, rng)
    # cavalier sur la crête
    rx = W * 0.27
    rider(d, rx, ground(rx) + 6, H * 0.0205)
    fg = np.asarray(layer.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255

    base = np.asarray(im.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255
    silhouette = rgb("#160c07")
    out = base * fg[..., None] + silhouette * (1 - fg[..., None])
    # bord de la silhouette éclairé par le contre-jour
    rim = np.clip(ndi.gaussian_filter(1 - fg, 2.2) - (1 - fg), 0, 1) * 0.35
    out += rim[..., None] * rgb("#ffae68")

    grade(out, h, w, name, seed)


def grade(out, h, w, name, seed):
    # étalonnage chaud, poussière en suspension, grain argentique et vignette
    lum = (out * [0.3, 0.59, 0.11]).sum(-1, keepdims=True)
    out = out + (lum - out) * -0.08
    out = np.clip(out, 0, 1)
    out = out * out * (3 - 2 * out) * 0.45 + out * 0.55
    out = out * rgb("#fff0dc")
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx / w - 0.5) * 1.1) ** 2 + ((yy / h - 0.5) * 0.95) ** 2)
    out *= (1 - smooth(0.42, 0.86, r) * 0.62)[..., None]
    rng = np.random.default_rng(seed + 100)
    noise = ndi.gaussian_filter(rng.normal(size=(h, w)), 0.65)
    noise /= noise.std()
    out = out + (noise * 0.016 * (0.5 + (1 - lum[..., 0])))[..., None]
    out = np.clip(out, 0, 1)
    arr = (out * 255 + 0.5).astype(np.uint8)
    Image.fromarray(arr).save(OUT / f"{name}.webp", quality=84, method=6)
    Image.fromarray(arr).resize((w // 2, h // 2), Image.LANCZOS).save(OUT / f"{name}-960.webp", quality=78, method=6)
    Image.fromarray(arr).resize((1200, 630), Image.LANCZOS).save(OUT / f"{name}-og.jpg", quality=82)
    engrave(out, name)
    print("ok", name)


def engrave(img, name, size=(1400, 620)):
    """Transforme la scène en gravure sur bois : traits dont l'épaisseur suit la lumière."""
    w, h = size
    lum = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).convert("L").resize((w, h), Image.LANCZOS), dtype=np.float32) / 255
    lum = norm(lum) ** 0.85
    lum = ndi.gaussian_filter(lum, 0.6)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    warp = ndi.gaussian_filter(lum, 7) * 16
    phase = (yy + warp + np.sin(xx / 130) * 4) / 3.6
    lines = np.abs(np.sin(phase * np.pi))
    phase2 = (yy - xx * 0.55 + warp * 0.7) / 3.2
    cross = np.abs(np.sin(phase2 * np.pi))
    ink = (lines > lum * 1.05 + 0.06) | ((cross > lum * 2.1 + 0.34) & (lum < 0.42))
    a = ndi.gaussian_filter(ink.astype(np.float32), 0.45)
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., 0:3] = np.array([28, 18, 12], dtype=np.uint8)
    rgba[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(OUT / f"{name}-engraving.webp", quality=74, method=6)


# ------------------------------------------------------------------ bayou
def cypress(draw, x, base, height, rng, color, moss=True):
    """Cypres chauve : pied cannele, ramure plate et plumeuse, barbe espagnole tombante."""
    lean = rng.normal(0, 0.035) * height
    steps = 46
    left, right = [], []
    w0 = height * 0.036
    flare_l, flare_r = rng.uniform(4.5, 8), rng.uniform(4.5, 8)
    for i in range(steps + 1):
        f = i / steps
        cx = x + lean * f**1.6
        y = base - height * 0.9 * f
        taper = (1 - f) ** 0.8 * 0.92 + 0.08
        bump = rng.normal(0, 0.05) + 0.07 * np.sin(f * 41 + x)
        left.append((cx - w0 * (taper + flare_l * np.exp(-f * 15)) * (1 + bump), y))
        right.append((cx + w0 * (taper + flare_r * np.exp(-f * 13)) * (1 - bump), y))
    draw.polygon(left + right[::-1], fill=color)

    # pneumatophores
    for _ in range(int(rng.uniform(5, 14))):
        kx = x + rng.uniform(-11, 11) * w0
        kh = rng.uniform(0.012, 0.05) * height
        draw.polygon([(kx - kh * 0.32, base + 2), (kx - kh * 0.1, base - kh * 0.8), (kx + rng.normal(0, 1), base - kh), (kx + kh * 0.12, base - kh * 0.7), (kx + kh * 0.32, base + 2)], fill=color)

    def spray(px, py, ln):
        # bouquet plat : une multitude de traits fins, jamais une forme pleine
        n = int(np.clip(ln * 1.15, 24, 150))
        xs = rng.normal(px, ln * 0.62, n)
        ys = rng.normal(py, ln * 0.13, n)
        for a, b in zip(xs, ys):
            l = rng.uniform(0.12, 0.34) * ln
            th = rng.normal(0.25, 0.55)
            draw.line([(a - np.cos(th) * l, b - np.sin(th) * l * 0.5), (a + np.cos(th) * l, b + np.sin(th) * l * 0.5)], fill=color, width=1)

    def limb(px, py, ang, ln, width):
        points = [(px, py)]
        a = ang
        cx_, cy_ = px, py
        for _ in range(6):
            a += rng.normal(0, 0.16)
            cx_ += np.cos(a) * ln / 6
            cy_ += np.sin(a) * ln / 6
            points.append((cx_, cy_))
        for i in range(len(points) - 1):
            draw.line([points[i], points[i + 1]], fill=color, width=max(1, int(width * (1 - i / 7))))
        if width < 1.8 or ln < height * 0.03:
            spray(cx_, cy_, max(ln * 1.3, height * 0.05))
            if moss and rng.random() < 0.8:
                for _ in range(int(rng.uniform(3, 11))):
                    sx = cx_ + rng.normal(0, ln * 0.55)
                    sy = cy_ + rng.normal(0, ln * 0.1)
                    hang = rng.uniform(0.03, 0.17) * height
                    k = rng.normal(0, 3)
                    draw.line([(sx, sy), (sx + k, sy + hang * 0.4), (sx + k * 0.3, sy + hang * 0.75), (sx + k * 0.9 + rng.normal(0, 2), sy + hang)], fill=color, width=1)
            return
        for _ in range(int(rng.uniform(2, 4))):
            t = rng.uniform(0.45, 1)
            i = min(int(t * 6), 6)
            limb(points[i][0], points[i][1], a + rng.choice([-1, 1]) * rng.uniform(0.2, 0.75), ln * rng.uniform(0.5, 0.72), width * 0.62)

    for f in np.linspace(0.46, 1, int(rng.uniform(8, 12))):
        side = rng.choice([-1, 1])
        ang = -np.pi / 2 + side * rng.uniform(0.7, 1.4)
        bx = x + lean * f**1.6
        limb(bx, base - height * 0.9 * f, ang, height * rng.uniform(0.17, 0.3), max(2, height * 0.0065))


def bayou(w=1920, h=1080, seed=12):
    ss = 2
    W, H = w * ss, h * ss
    rng = np.random.default_rng(seed)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    xx = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    horizon = 0.615
    sun = (0.58, 0.525)
    ds = np.sqrt(((xx - sun[0]) * w / h) ** 2 + (yy - sun[1]) ** 2)
    v = yy
    top = rgb("#141b33")
    a = rgb("#5b2c4e")
    b = rgb("#c94f2b")
    c = rgb("#ffb35f")
    sky = np.ones((H, W, 3), np.float32) * top
    sky = sky + (a - sky) * smooth(0.0, 0.28, v)[..., None]
    sky = sky + (b - sky) * smooth(0.22, 0.46, v)[..., None]
    sky = sky + (c - sky) * smooth(0.42, 0.6, v)[..., None]
    sky = sky + rgb("#fff1c8") * (np.exp(-ds * 16) * 1.3 + np.exp(-ds * 4) * 0.4)[..., None]

    cl = fbm_clouds(w, h, seed + 2)
    cl = np.asarray(Image.fromarray(cl.astype(np.float32)).resize((W, H), Image.BILINEAR))
    dens = smooth(0.2, 1.5, cl) * (1 - smooth(0.34, 0.56, yy))
    cc = rgb("#2f2531") + (rgb("#ffab6b") - rgb("#2f2531")) * (smooth(0.1, 0.5, yy) * 0.8)[..., None]
    sky = sky + (cc - sky) * (dens * 0.9)[..., None]

    img = sky.copy()
    line = H * horizon
    fog_col = rgb("#ee8a4e")

    def layer(depth, count, size, y_off, moss=True):
        nonlocal img
        mask = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(mask)
        # rive
        ground = [(x, line + y_off + rng.normal(0, 1.5 + depth * 3) + 6 * np.sin(x * 0.004 + depth * 9)) for x in range(0, W + 24, 24)]
        d.polygon(ground + [(W, line + y_off + 40), (0, line + y_off + 40)], fill=255)
        for _ in range(count):
            x = rng.uniform(-40, W + 40)
            cypress(d, x, line + y_off + rng.uniform(-2, 6), size * rng.uniform(0.7, 1.28), rng, 255, moss)
        m = np.asarray(mask.filter(ImageFilter.GaussianBlur((1 - depth) * 3.2 + 0.4)), dtype=np.float32) / 255
        col = fog_col + (rgb("#120c0a") - fog_col) * depth
        img = img * (1 - m[..., None]) + col * m[..., None]
        # banc de brume entre deux plans
        haze = np.asarray(Image.fromarray(np.abs(spectral(1024, 3.0, int(depth * 100) + seed)).astype(np.float32)).resize((W, H), Image.BILINEAR))
        band = np.exp(-(((yy - (line + y_off * 0.6) / H) / 0.026) ** 2)) * (0.3 + 0.5 * np.clip(haze, 0, 1)) * (0.65 - depth * 0.4)
        img = img + (rgb("#ffcf9d") - img) * band[..., None]

    print("plans d'arbres...")
    layer(0.14, 70, H * 0.11, 0)
    layer(0.3, 42, H * 0.2, H * 0.012)
    layer(0.52, 18, H * 0.36, H * 0.026)
    layer(0.76, 7, H * 0.62, H * 0.05)

    print("reflets...")
    cut = int(H * (horizon + 0.052))
    water = img[:cut][::-1][: H - cut].copy()
    if water.shape[0] < H - cut:
        pad = np.repeat(water[-1:], H - cut - water.shape[0], axis=0)
        water = np.concatenate([water, pad])
    rip = spectral(2048, 2.2, seed + 7)
    rip = np.asarray(Image.fromarray(rip.astype(np.float32)).resize((W, H - cut), Image.BILINEAR))
    depthv = np.linspace(0, 1, H - cut, dtype=np.float32)[:, None]
    shift = (rip * (5 + depthv * 44)).astype(np.int32)
    ri = np.arange(H - cut)[:, None]
    ci = np.clip(np.arange(W)[None, :] + shift, 0, W - 1)
    ro = np.clip(ri + (rip * (3 + depthv * 18)).astype(np.int32), 0, H - cut - 1)
    water = water[ro, ci]
    water = ndi.gaussian_filter(water, (2.6, 0.8, 0))
    water *= (0.62 - depthv * 0.3)[..., None]
    sparkle = np.clip(rip * 0.5 + 0.25, 0, 1) ** 6 * np.exp(-(((xx - sun[0]) / (0.05 + depthv * 0.14)) ** 2)) * 1.3
    water += sparkle[..., None] * rgb("#ffbf7e")
    img[cut:] = water

    # premier plan : barque et grand cyprès en silhouette
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    cypress(d, W * 0.075, H * 0.97, H * 1.08, rng, 255)
    cypress(d, W * 0.93, H * 0.99, H * 1.2, rng, 255)
    # pirogue et batelier, petits dans le decor
    bx, by, s = W * 0.4, H * 0.705, H * 0.0074
    hull = [(bx - 17 * s, by - 2.2 * s), (bx - 14 * s, by + 0.3 * s), (bx - 8 * s, by + 1.2 * s), (bx + 9 * s, by + 1.2 * s), (bx + 15 * s, by + 0.2 * s), (bx + 18.5 * s, by - 2.6 * s), (bx + 13 * s, by - 1.1 * s), (bx - 12 * s, by - 0.9 * s)]
    d.polygon(hull, fill=255)
    fx = bx - 7 * s
    d.polygon([(fx - 1.7 * s, by - 0.9 * s), (fx - 1.2 * s, by - 6.0 * s), (fx + 1.3 * s, by - 6.0 * s), (fx + 1.9 * s, by - 0.9 * s), (fx + 0.8 * s, by - 0.9 * s), (fx + 0.1 * s, by - 4.2 * s), (fx - 0.6 * s, by - 0.9 * s)], fill=255)
    d.polygon([(fx - 1.4 * s, by - 5.6 * s), (fx - 1.9 * s, by - 9.0 * s), (fx - 1.1 * s, by - 10.4 * s), (fx + 1.1 * s, by - 10.4 * s), (fx + 1.7 * s, by - 9.1 * s), (fx + 1.4 * s, by - 5.6 * s)], fill=255)
    d.line([(fx + 1.1 * s, by - 9.8 * s), (fx + 3.1 * s, by - 8.2 * s), (fx + 4.9 * s, by - 9.5 * s)], fill=255, width=int(s * 0.62))
    d.ellipse([fx - 0.9 * s, by - 12.3 * s, fx + 0.9 * s, by - 10.3 * s], fill=255)
    d.ellipse([fx - 2.6 * s, by - 12.0 * s, fx + 2.6 * s, by - 11.2 * s], fill=255)
    d.polygon([(fx - 1.1 * s, by - 11.7 * s), (fx - 0.9 * s, by - 13.2 * s), (fx + 0.9 * s, by - 13.2 * s), (fx + 1.1 * s, by - 11.7 * s)], fill=255)
    d.line([(fx + 8.6 * s, by - 16 * s), (fx - 1.2 * s, by + 9.5 * s)], fill=255, width=max(2, int(s * 0.26)))
    lx, ly = bx + 16.2 * s, by - 5.4 * s
    d.line([(bx + 17.8 * s, by - 2.4 * s), (lx, ly)], fill=255, width=max(2, int(s * 0.3)))
    d.polygon([(0, H), (0, H * 0.94), (W * 0.2, H * 0.965), (W * 0.42, H * 0.992), (W * 0.42, H)], fill=255)
    d.polygon([(W, H), (W, H * 0.93), (W * 0.82, H * 0.97), (W * 0.6, H * 0.995), (W * 0.6, H)], fill=255)
    m = np.asarray(mask.filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32) / 255
    img = img * (1 - m[..., None]) + rgb("#0e0806") * m[..., None]

    yyp, xxp = np.mgrid[0:H, 0:W].astype(np.float32)
    dl = np.sqrt((xxp - lx) ** 2 + (yyp - (ly + 3 * s)) ** 2) / H
    img = img + rgb("#ffb35c") * (np.exp(-dl * 95) * 4.2 + np.exp(-dl * 22) * 0.34)[..., None]
    dr = np.sqrt(((xxp - lx) / 0.5) ** 2 + ((yyp - (by + 30 * s)) / 7) ** 2) / H
    img = img + rgb("#ff9a45") * (np.exp(-dr * 40) * 0.55 * (yyp > by + 2 * s))[..., None]

    print("étalonnage...")
    small = np.asarray(Image.fromarray((tonemap(img * 1.25) * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS), dtype=np.float32) / 255
    grade(small, h, w, "bayou", seed)


if __name__ == "__main__":
    if WHICH in ("mountains", "all"):
        mountains()
    if WHICH in ("bayou", "all"):
        bayou()
