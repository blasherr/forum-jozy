"""Prépare les objets des designs réalistes à partir de photos de matières réelles (Poly Haven, ambientCG, CC0).

  python -I real_compose.py <dossier des photos> <dossier de sortie> [objet ...]

Pour chaque objet : un relief (forme, biseaux, vis, coutures), puis couleur, rugosité et détail de surface
tirés des photos. real_render.py éclaire ensuite le tout. La matière vient des photos, la crasse se dépose
dans les creux et l'usure sur les arêtes, comme sur un objet réel.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[2]
TEX = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "out").mkdir(exist_ok=True)
ONLY = set(sys.argv[3:])
JOBS = []


# ---------------------------- Lecture et placage des photos ----------------------------
def photo(name, kind="diff"):
    return np.asarray(Image.open(TEX / f"{name}__{kind}.jpg").convert("RGB"), dtype=np.float32) / 255


def paper_map(pid, kind="Color"):
    return np.asarray(Image.open(TEX / pid / f"{pid}_2K-JPG_{kind}.jpg").convert("RGB"), dtype=np.float32) / 255


def resized(img, scale):
    h, w = img.shape[:2]
    out = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    return np.asarray(out, dtype=np.float32) / 255


def lay(img, width, height, scale=1.0, seed=0):
    """Plaque une photo répétable sur une surface, à l'échelle voulue, avec un décalage aléatoire."""
    img = resized(img, scale)
    rng = np.random.default_rng(seed)
    img = np.roll(img, (rng.integers(img.shape[0]), rng.integers(img.shape[1])), (0, 1))
    reps = (height // img.shape[0] + 1, width // img.shape[1] + 1)
    return np.tile(img, (*reps, 1))[:height, :width]


def lum(img):
    return img[..., 0] * 0.3 + img[..., 1] * 0.59 + img[..., 2] * 0.11


def norm(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-6)


def noise(shape, sigma, seed):
    rng = np.random.default_rng(seed)
    return norm(ndi.gaussian_filter(rng.standard_normal(shape), sigma, mode="wrap"))


def plank_band(name, index, vertical=False):
    """Isole une seule planche dans une photo de bardage : on repère les joints sombres."""
    img = photo(name)
    nor = photo(name, "nor")
    if vertical:
        img = np.rot90(img)
        nor = np.rot90(nor)
        rotated = nor.copy()
        rotated[..., 0] = 1 - nor[..., 1]
        rotated[..., 1] = nor[..., 0]
        nor = rotated
    profile = ndi.gaussian_filter1d(lum(img).mean(axis=1), 5)
    minima = [i for i in range(40, len(profile) - 40) if profile[i] == profile[i - 40:i + 41].min()]
    gaps = [m for a, m in zip([-999] + minima, minima) if m - a > 100]
    index = index % (len(gaps) - 1)
    top, bottom = gaps[index] + 12, gaps[index + 1] - 12
    return img[top:bottom], nor[top:bottom]


# ---------------------------- Formes ----------------------------
def grid(width, height):
    return np.mgrid[0:height, 0:width].astype(np.float32)


def rrect(width, height, cx, cy, hw, hh, r):
    """Distance signée à un rectangle arrondi : négative à l'intérieur."""
    y, x = grid(width, height)
    qx = np.abs(x - cx) - hw + r
    qy = np.abs(y - cy) - hh + r
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def smooth(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def bevel(sd, width):
    """Profil d'arête : 0 sur le bord, 1 une fois le biseau passé."""
    t = np.clip(-sd / width, 0, 1)
    return np.sqrt(1 - (1 - t) ** 2)


def groove(sd, at, half):
    """Gravure en V le long d'un contour."""
    return np.clip(1 - np.abs(sd + at) / half, 0, 1)


def add_screw(z, cavity, cx, cy, radius, height, angle):
    h, w = z.shape
    y, x = grid(w, h)
    d = np.hypot(x - cx, y - cy)
    base = z[int(cy), int(cx)]
    dome = np.sqrt(np.clip(1 - (d / radius) ** 2, 0, 1)) * height
    inside = d < radius
    z[inside] = base + dome[inside] + 1.6
    ca, sa = np.cos(angle), np.sin(angle)
    across = np.abs(-(x - cx) * sa + (y - cy) * ca)
    along = np.abs((x - cx) * ca + (y - cy) * sa)
    slot = (across < radius * 0.17) & (along < radius * 0.88)
    z[slot] -= height * 0.95
    cavity[slot] += 1
    ring = np.exp(-(((d - radius - 1) / 2.4) ** 2))
    cavity += ring * 0.8


def scratches(width, height, count, seed, length=170):
    """Rayures fines d'un objet manipulé pendant des années."""
    rng = np.random.default_rng(seed)
    img = Image.new("L", (width, height), 0)
    from PIL import ImageDraw

    draw = ImageDraw.Draw(img)
    for _ in range(count):
        x, y = rng.uniform(0, width), rng.uniform(0, height)
        a = rng.normal(0, 0.5) + (np.pi / 2 if rng.random() < 0.25 else 0)
        n = rng.uniform(0.2, 1) * length
        draw.line((x, y, x + np.cos(a) * n, y + np.sin(a) * n), fill=int(rng.uniform(60, 240)), width=1)
    return np.asarray(img, dtype=np.float32) / 255


def grime(z, sigma=7.0):
    """Creux (crasse) et arêtes (usure) tirés du relief lui-même."""
    wide = ndi.gaussian_filter(z, sigma)
    return np.clip(wide - z, 0, None), np.clip(z - wide, 0, None)


def save_png(path, arr):
    arr = np.clip(arr, 0, 1)
    if arr.ndim == 2:
        arr = np.dstack([arr] * 3)
    Image.fromarray((arr * 255 + 0.5).astype(np.uint8)).save(path)


def job(name, z, mask, albedo, rough, normal=None, metal=None, **opts):
    if ONLY and name not in ONLY:
        return
    height, width = z.shape
    np.save(OUT / f"{name}_h.npy", z.astype(np.float32))
    np.save(OUT / f"{name}_m.npy", mask)
    save_png(OUT / f"{name}_a.png", albedo)
    save_png(OUT / f"{name}_r.png", rough)
    entry = {
        "name": name,
        "height": str(OUT / f"{name}_h.npy"),
        "mask": str(OUT / f"{name}_m.npy"),
        "albedo": str(OUT / f"{name}_a.png"),
        "rough": str(OUT / f"{name}_r.png"),
        "size": [width, height],
        "out": str(OUT / "out" / f"{name}.png"),
    }
    if normal is not None:
        save_png(OUT / f"{name}_n.png", normal)
        entry["normal"] = str(OUT / f"{name}_n.png")
    if metal is not None:
        save_png(OUT / f"{name}_mt.png", metal)
        entry["metal_map"] = str(OUT / f"{name}_mt.png")
    entry.update(opts)
    JOBS.append(entry)


def wanted(name):
    return not ONLY or name in ONLY


# ---------------------------- Plaques de métal ----------------------------
def plate(name, kind, seed, w=960, h=210, margin=22, screws=True, **opts):
    sd = rrect(w, h, w / 2, h / 2, w / 2 - margin, h / 2 - margin, 10) + (noise((h, w), 40, seed) - 0.5) * 1.6
    mask = sd < 1
    z = bevel(sd, 5) * 12
    cavity = np.zeros((h, w), np.float32)
    cut = groove(sd, 21, 3.4)
    z -= cut * 2.8
    cavity += cut
    z += (noise((h, w), 16, seed + 1) - 0.5) * 1.5
    z += (noise((h, w), 70, seed + 5) - 0.5) * 2.2
    rng = np.random.default_rng(seed)
    if screws:
        for cx, cy in ((margin + 42, margin + 42), (w - margin - 42, margin + 42), (margin + 42, h - margin - 42), (w - margin - 42, h - margin - 42)):
            add_screw(z, cavity, cx, cy, 17, 6, rng.uniform(0, np.pi))
    z = ndi.gaussian_filter(z, 0.6)
    hollow, ridge = grime(z, 5)
    wear = np.clip(ridge / 1.8, 0, 1)
    dirt = np.clip(hollow / 1.6, 0, 1)

    rust = lay(photo("rust_coarse_01"), w, h, 0.9, seed)
    spots = norm(lum(lay(photo("rusty_metal_02"), w, h, 0.7, seed + 3)))
    lines = scratches(w, h, 500, seed + 4)
    tarn = np.clip((1 - norm(lum(rust))) * 0.6 + (1 - spots) * 0.6 - 0.2, 0, 1)
    tarn = ndi.gaussian_filter(tarn, 1.2)

    if kind == "brass":
        clean = np.array((0.74, 0.54, 0.25), np.float32)
        old = np.array((0.27, 0.185, 0.085), np.float32)
        mix = np.clip(tarn * 1.05 + dirt * 1.0 - wear * 1.1 - lines * 0.5, 0, 1)[..., None]
        albedo = clean * (1 - mix) + old * mix
        rough = np.clip(0.26 + mix[..., 0] * 0.5 + lines * 0.2 - wear * 0.1, 0.12, 0.95)
        metal = None
        extra = {"metallic": 1.0}
    else:
        steel = np.array((0.2, 0.195, 0.19), np.float32)
        oxide = rust * np.array((0.74, 0.62, 0.55), np.float32)
        mix = np.clip(tarn * 1.5 + dirt * 0.8 - wear * 1.3 - 0.12, 0, 1)
        mix = smooth(0.25, 0.75, mix)
        albedo = steel * (1 - mix[..., None]) + oxide * mix[..., None]
        albedo *= (1 + wear * 0.8)[..., None]
        rough = np.clip(0.4 + mix * 0.5 - wear * 0.14 + lines * 0.1, 0.15, 0.97)
        metal = np.clip(1 - mix * 1.1, 0, 1)
        extra = {}
    detail = lay(photo("rust_coarse_01", "nor"), w, h, 0.9, seed)
    job(name, z, mask, albedo, rough, detail, metal, normal_strength=0.55, **extra, **opts)


# ---------------------------- Étiquettes de bois ----------------------------
def tag(name, source, index, seed, vertical=False, w=960, h=210, margin=20, tone=1.0, grade=(1, 1, 1), **opts):
    """Planche sciée à la main, dans le fil du bois : bords francs et légèrement mâchés."""
    img, nor = plank_band(source, index, vertical)
    scale = (h - margin) / img.shape[0] * 1.08
    color = lay(img, w, h, scale, seed) * tone * np.array(grade, np.float32)
    detail = lay(nor, w, h, scale, seed)
    sd = rrect(w, h, w / 2, h / 2, w / 2 - margin, h / 2 - margin, 6)
    sd = sd + (noise((h, w), 26, seed) - 0.5) * 5 + (noise((h, w), 3.5, seed + 1) - 0.5) * 3.4
    mask = sd < 1
    grain = norm(ndi.gaussian_filter(lum(color), 1.0))
    z = bevel(sd, 5) * 16 + (grain - 0.5) * 3.5
    z = ndi.gaussian_filter(z, 0.5)
    hollow, _ = grime(z, 5)
    color = color * (1 - np.clip(hollow / 2.6, 0, 1) * 0.5)[..., None]
    char = smooth(-20, -1, sd)
    color = color * (1 - char * 0.74)[..., None]
    rough = np.clip(0.66 + (1 - grain) * 0.2 + char * 0.2, 0, 1)
    job(name, z, mask, color, rough, detail, metallic=0.0, normal_strength=1.0, specular=0.3, **opts)


def nail(name, seed, size=180, **opts):
    """Clou forgé : tête à quatre pans martelée, posée de travers."""
    h = w = size
    c = size / 2
    y, x = grid(w, h)
    ang = np.deg2rad(np.random.default_rng(seed).uniform(10, 40))
    u = (x - c) * np.cos(ang) + (y - c) * np.sin(ang)
    v = -(x - c) * np.sin(ang) + (y - c) * np.cos(ang)
    half = size * 0.3
    box = np.maximum(np.abs(u), np.abs(v))
    d = box + (noise((h, w), 12, seed) - 0.5) * 6 - half
    mask = d < 1
    z = bevel(d, 3) * 6 + np.clip(half - box, 0, None) * 0.62
    z = z + (noise((h, w), 5, seed + 1) - 0.5) * 2.4
    z = ndi.gaussian_filter(z, 0.9)
    rust = lay(photo("rust_coarse_01"), w, h, 0.5, seed)
    hollow, ridge = grime(z, 4)
    albedo = np.clip(rust * 0.3 + np.array((0.05, 0.047, 0.044), np.float32), 0, 1) * (1 + np.clip(ridge, 0, 1) * 0.9)[..., None]
    rough = np.clip(0.42 + norm(lum(rust)) * 0.34, 0, 1)
    nor = lay(photo("rust_coarse_01", "nor"), w, h, 0.5, seed)
    job(name, z, mask, albedo, rough, nor, metallic=0.7, normal_strength=0.9, **opts)


# ---------------------------- Papier ----------------------------
M = 1024  # toutes les photos sont ramenées à cette période pour se répéter sans raccord
PAD = 200


def wrapped(a, width, height):
    ys = (np.arange(height) - PAD) % a.shape[0]
    xs = (np.arange(width) - PAD) % a.shape[1]
    return a[np.ix_(ys, xs)]


def sheet_colors(seed, kind):
    """Papier : fibres de Paper006, plis de Paper003, taches et piqûres tirées de vraies photos de rouille."""
    fibers = lay(paper_map("Paper006"), M, M, 0.5, seed)
    fine = lum(fibers) - ndi.gaussian_filter(lum(fibers), 14, mode="wrap")
    crease = lum(lay(paper_map("Paper003"), M, M, 0.5, seed + 1))
    crease = crease - ndi.gaussian_filter(crease, 60, mode="wrap")
    stain = norm(ndi.gaussian_filter(lum(lay(photo("rust_coarse_01"), M, M, 0.5, seed + 2)), 12, mode="wrap"))
    fox = 1 - norm(ndi.gaussian_filter(lum(lay(photo("rusty_metal_02"), M, M, 0.5, seed + 3)), 1.0, mode="wrap"))
    fox = smooth(0.42, 0.78, fox)
    if kind == "cream":
        base = np.array((0.965, 0.915, 0.79), np.float32)
        brown = np.array((0.72, 0.56, 0.35), np.float32)
        s, f = 0.26, 0.16
    else:
        base = np.array((0.87, 0.77, 0.58), np.float32)
        brown = np.array((0.52, 0.36, 0.19), np.float32)
        s, f = 0.5, 0.34
    amount = np.clip((1 - stain) * s + fox * f, 0, 1)[..., None]
    color = base * (1 - amount) + brown * amount
    color = color * (1 + (fine * 2.2 + crease * 0.9))[..., None]
    return color


def flat_tile(name, seed, kind, **opts):
    """Le corps de la feuille : même papier et même lumière que les bords, répétable à l'infini."""
    color = sheet_colors(seed, kind)
    nor = lay(paper_map("Paper003", "NormalGL"), M, M, 0.5, seed + 1)
    z = np.zeros((M, M), np.float32)
    job(name, z, np.ones((M, M), bool), color, np.full((M, M), 0.86, np.float32), nor, metallic=0.0, normal_strength=0.8, specular=0.25, shadow=False, **opts)


def torn_sheet(name, seed, kind, inset=70, **opts):
    w = h = M + 2 * PAD
    tear = (noise((M, M), 34, seed) - 0.5) * 24 + (noise((M, M), 10, seed + 1) - 0.5) * 16 + (noise((M, M), 2.6, seed + 2) - 0.5) * 9
    sd = rrect(w, h, w / 2, h / 2, w / 2 - inset, h / 2 - inset, 2) + wrapped(tear, w, h)
    mask = sd < 0.5
    color = wrapped(sheet_colors(seed, kind), w, h)
    # La déchirure laisse voir l'âme plus claire et plus fibreuse du papier
    rim = smooth(-9, -1.5, sd) * (0.7 + wrapped(noise((M, M), 1.6, seed + 3), w, h) * 0.6)
    color = color * (1 - np.clip(rim, 0, 1)[..., None]) + np.array((0.95, 0.91, 0.82), np.float32) * np.clip(rim, 0, 1)[..., None]
    # Bords noircis par la poussière et les mains
    dust = smooth(-110, -6, sd) * (0.45 + 0.55 * wrapped(noise((M, M), 30, seed + 4), w, h))
    color = color * (1 - dust * (0.2 if kind == "cream" else 0.34))[..., None]
    crumple = wrapped(lum(lay(paper_map("Paper003", "Displacement"), M, M, 0.5, seed + 1)), w, h)
    lift = wrapped(noise((M, M), 60, seed + 5), w, h)
    z = 1.5 + (crumple - crumple.mean()) * 14 + (lift - 0.5) * 14
    z = z + smooth(-90, -8, sd) * (wrapped(noise((M, M), 40, seed + 6), w, h) - 0.25) * 12
    z = np.maximum(z - z.min() + 1, 1)
    z = ndi.gaussian_filter(z, 0.7)
    nor = wrapped(lay(paper_map("Paper003", "NormalGL"), M, M, 0.5, seed + 1), w, h)
    rough = np.full((h, w), 0.86, np.float32)
    job(name, z, mask, color, rough, nor, metallic=0.0, normal_strength=0.8, specular=0.25, **opts)


def lacquer(seed):
    wood = lay(photo("wood_table_worn"), M, M, 0.5, seed)
    return wood * np.array((0.3, 0.22, 0.18), np.float32)


def lacquer_tile(name, seed, **opts):
    color = lacquer(seed)
    nor = lay(photo("wood_table_worn", "nor"), M, M, 0.5, seed)
    z = np.zeros((M, M), np.float32)
    job(name, z, np.ones((M, M), bool), color, np.full((M, M), 0.56, np.float32), nor, metallic=0.0, normal_strength=0.5, specular=0.1, shadow=False, **opts)


def lacquer_card(name, seed, inset=60, corner=120, **opts):
    """Panneau de bois laqué noir, filet doré à la feuille, coins de laiton vissés."""
    w = h = M + 2 * PAD
    sd = rrect(w, h, w / 2, h / 2, w / 2 - inset, h / 2 - inset, 2)
    mask = sd < 0.5
    color = wrapped(lacquer(seed), w, h)
    z = bevel(sd, 6) * 12
    y, x = grid(w, h)
    dx = np.minimum(x - inset, w - inset - 1 - x)
    dy = np.minimum(y - inset, h - inset - 1 - y)
    tri = dx + dy
    brass = (tri < corner) & (dx >= -10) & (dy >= -10)
    mask = mask | brass
    edge = np.minimum(np.minimum(dx + 10, dy + 10), corner - tri)
    z = np.where(brass, bevel(-edge, 4) * 7 + 14, z)

    tone = wrapped(lay(photo("rust_coarse_01"), M, M, 0.5, seed), w, h)
    tarn = np.clip((1 - norm(lum(tone))) * 0.9, 0, 1)
    lines = wrapped(scratches(M, M, 900, seed + 1), w, h)
    tarn = np.clip(tarn - lines * 0.5, 0, 1)
    metal_col = np.array((0.74, 0.54, 0.25), np.float32) * (1 - tarn[..., None]) + np.array((0.25, 0.17, 0.08), np.float32) * tarn[..., None]

    gold = np.clip(groove(sd, 34, 2.4) + groove(sd, 43, 1.1), 0, 1)
    loss = smooth(0.28, 0.46, wrapped(noise((M, M), 2.2, seed + 2), w, h))
    gold = gold * loss
    color = color * (1 - gold[..., None]) + np.array((0.88, 0.66, 0.3), np.float32) * gold[..., None]
    color = np.where(brass[..., None], metal_col, color)
    metal = np.where(brass, 1.0, gold * 0.3).astype(np.float32)
    rough = np.where(brass, 0.3 + tarn * 0.4, np.where(gold > 0.4, 0.46, 0.52))
    cavity = np.zeros((h, w), np.float32)
    rng = np.random.default_rng(seed)
    for cx, cy in ((inset + 30, inset + 30), (w - inset - 30, inset + 30), (inset + 30, h - inset - 30), (w - inset - 30, h - inset - 30)):
        add_screw(z, cavity, cx, cy, 12, 4.5, rng.uniform(0, 3))
    z = ndi.gaussian_filter(z, 0.6)
    nor_a = wrapped(lay(photo("wood_table_worn", "nor"), M, M, 0.5, seed), w, h)
    nor_b = wrapped(lay(photo("rust_coarse_01", "nor"), M, M, 0.5, seed), w, h)
    nor = np.where(brass[..., None], nor_b, nor_a)
    job(name, z, mask, color, rough, nor, metal, normal_strength=0.5, specular=0.1, **opts)


def tape(name, seed, w=420, h=130, **opts):
    """Bande de papier kraft gommé, déchirée aux deux bouts."""
    y, x = grid(w, h)
    n = noise((h, w), 4, seed)
    sd = np.maximum(np.abs(x - w / 2) - w / 2 + 28 + (n - 0.5) * 34, np.abs(y - h / 2) - h / 2 + 22 + (noise((h, w), 30, seed + 1) - 0.5) * 3)
    mask = sd < 0.5
    color = lay(paper_map("Paper004"), w, h, 0.8, seed) * np.array((0.92, 0.84, 0.72), np.float32)
    z = bevel(sd, 3) * 2.4 + lum(lay(paper_map("Paper004", "Displacement"), w, h, 0.8, seed)) * 1.5
    nor = lay(paper_map("Paper004", "NormalGL"), w, h, 0.8, seed)
    job(name, z, mask, color, np.full((h, w), 0.8, np.float32), nor, metallic=0.0, specular=0.25, **opts)


# ---------------------------- Cuir ----------------------------
def stitched(name, tone, seed, w=960, h=220, margin=22, pitch=30, source="fabric_leather_02", thread=(0.6, 0.53, 0.4), **opts):
    """Patte de cuir épais, bords roulés, surpiqûre régulière : les points tombent juste à chaque raccord."""
    sd = rrect(w, h, w / 2, h / 2, w / 2 - margin, h / 2 - margin, 16) + (noise((h, w), 40, seed) - 0.5) * 2.5
    mask = sd < 1
    color = resized(photo(source)[300 + seed * 3:580 + seed * 3, 860:2000], w / 1140)[:h, :w] * np.array(tone, np.float32)
    nor = resized(photo(source, "nor")[300 + seed * 3:580 + seed * 3, 860:2000], w / 1140)[:h, :w]
    z = bevel(sd, 9) * 16 + (noise((h, w), 22, seed + 2) - 0.5) * 3.4

    y, x = grid(w, h)
    at = 26
    run = groove(sd, at, 6.5)
    z -= run * 3.2
    # Position le long du contour : points réguliers sur les quatre côtés
    along = np.where(np.abs(y - h / 2) >= h / 2 - margin - at - 2, x, y) + w
    phase = np.mod(along, pitch) / pitch
    on = (phase > 0.16) & (phase < 0.84) & (np.abs(sd + at) < 3.4)
    profile = np.sqrt(np.clip(1 - ((np.abs(sd + at)) / 3.6) ** 2, 0, 1)) * np.abs(np.sin(np.clip((phase - 0.16) / 0.68, 0, 1) * np.pi)) ** 0.4
    z = z + on * profile * 4.6
    holes = (~on) & (np.abs(sd + at) < 3) & ((phase <= 0.16) | (phase >= 0.84))
    z[holes] -= 2.4
    z = ndi.gaussian_filter(z, 0.5)
    hollow, ridge = grime(z, 6)
    color = color * (1 - np.clip(hollow / 2.6, 0, 1) * 0.55)[..., None] * (1 + np.clip(ridge / 3, 0, 1) * 0.22)[..., None]
    color = np.where(on[..., None], np.array(thread, np.float32) * (0.82 + 0.18 * profile[..., None]), color)
    rough = np.where(on, 0.75, 0.48 + (1 - norm(lum(color))) * 0.16)
    nor = np.where(on[..., None], np.array((0.5, 0.5, 1.0), np.float32), nor)
    job(name, z, mask, color, rough, nor, metallic=0.0, normal_strength=0.8, specular=0.45, **opts)


def seal(name, color, seed, size=440, **opts):
    """Cachet de cire : coulée irrégulière, anneau pressé, monogramme du serveur en relief."""
    h = w = size
    c = size / 2
    y, x = grid(w, h)
    r = np.hypot(x - c, y - c)
    a = np.arctan2(y - c, x - c)
    rng = np.random.default_rng(seed)
    wob = sum(rng.uniform(3, 11) * np.sin(a * k + rng.uniform(0, 6.3)) for k in (2, 3, 5, 7)) + (noise((h, w), 9, seed + 7) - 0.5) * 9
    sd = r - (size * 0.415 + wob)
    mask = sd < 0.5
    z = bevel(sd, 26) * 40
    stamp_r = size * 0.285
    dish = smooth(stamp_r + 10, stamp_r - 6, r)
    z -= dish * 15
    ring = np.exp(-(((r - stamp_r + 15) / 3.4) ** 2))
    z += ring * 5.5
    logo = Image.open(ROOT / "public" / "brand" / "nf-mask.png").convert("L")
    logo = logo.crop(logo.getbbox())
    mark_w = int(stamp_r * 1.34)
    mark_h = int(mark_w * logo.height / logo.width)
    alpha = np.asarray(logo.resize((mark_w, mark_h), Image.LANCZOS), dtype=np.float32) / 255
    if alpha.mean() > 0.5:
        alpha = 1 - alpha
    letters = np.zeros((h, w), np.float32)
    ox, oy = int(c - mark_w / 2), int(c - mark_h / 2)
    letters[oy:oy + mark_h, ox:ox + mark_w] = alpha
    z += ndi.gaussian_filter(letters, 1.6) * 9
    z += (noise((h, w), 9, seed) - 0.5) * 2.6
    z = ndi.gaussian_filter(z, 1.0)
    hollow, ridge = grime(z, 7)
    base = np.array(color, np.float32)
    albedo = base * (1 + np.clip(ridge / 8, 0, 1) * 0.5)[..., None] * (1 - np.clip(hollow / 7, 0, 1) * 0.4)[..., None]
    albedo = albedo * (0.92 + 0.14 * noise((h, w), 3, seed + 1))[..., None]
    rough = 0.36 + noise((h, w), 6, seed + 2) * 0.22
    job(name, z, mask, albedo, rough, metallic=0.0, specular=0.42, sss=0.2, sss_scale=0.015, **opts)


def signboard(name, seed, w=1500, h=560, margin=26, **opts):
    """Enseigne de saloon : planches sombres vernies, filet doré à la feuille, clous de laiton."""
    sd = rrect(w, h, w / 2, h / 2, w / 2 - margin, h / 2 - margin, 8) + (noise((h, w), 40, seed) - 0.5) * 2.5
    mask = sd < 1
    wood = lay(photo("weathered_plank_siding"), w, h, 1.0, seed) * np.array((0.42, 0.31, 0.24), np.float32)
    nor = lay(photo("weathered_plank_siding", "nor"), w, h, 1.0, seed)
    planks = norm(ndi.gaussian_filter(lum(wood), 1.2))
    z = bevel(sd, 8) * 26 + (planks - 0.5) * 5
    inner = groove(sd, 34, 6)
    z -= inner * 5
    gilt = np.clip(groove(sd, 54, 3.4) + groove(sd, 66, 1.6), 0, 1)
    cavity = np.zeros((h, w), np.float32)
    rng = np.random.default_rng(seed)
    z = ndi.gaussian_filter(z, 0.7)
    for cx, cy in ((margin + 27, margin + 27), (w - margin - 27, margin + 27), (margin + 27, h - margin - 27), (w - margin - 27, h - margin - 27)):
        add_screw(z, cavity, cx, cy, 13, 7, rng.uniform(0, 3))
    hollow, ridge = grime(z, 9)
    wood = wood * (1 - np.clip(hollow / 4, 0, 1) * 0.6)[..., None] * (1 + np.clip(ridge / 5, 0, 1) * 0.4)[..., None]
    loss = smooth(0.26, 0.44, noise((h, w), 2.4, seed + 3))
    leaf = gilt * loss
    gold = np.array((0.88, 0.66, 0.3), np.float32)
    color = wood * (1 - leaf[..., None]) + gold * leaf[..., None]
    rough = np.where(leaf > 0.4, 0.44, 0.56)
    metal = np.clip(leaf * 0.3, 0, 1)
    job(name, z, mask, color, rough, nor, metal, normal_strength=0.7, specular=0.25, **opts)


def journal(name, seed, w=1800, h=1120, **opts):
    """Carnet ouvert sur la table : couverture de cuir, deux pages bombées qui plongent vers la reliure."""
    cover = rrect(w, h, w / 2, h / 2, w / 2 - 34, h / 2 - 34, 26) + (noise((h, w), 50, seed) - 0.5) * 3
    mask = cover < 1
    z = bevel(cover, 12) * 16
    leather = lay(photo("fabric_leather_02"), w, h, 1.0, seed) * np.array((0.42, 0.3, 0.22), np.float32)
    leather_n = lay(photo("fabric_leather_02", "nor"), w, h, 1.0, seed)
    y, x = grid(w, h)
    sheet_sd = rrect(w, h, w / 2, h / 2, w / 2 - 66, h / 2 - 62, 10) + (noise((h, w), 20, seed + 1) - 0.5) * 3
    page = sheet_sd < 0
    t = np.abs(x - w / 2) / (w / 2 - 66)
    # Bombé des pages : forte pente près de la reliure, plus plat vers le bord
    curve = (1 - np.exp(-t * 7.5)) * 54 - t * 20
    stack = 16 + curve
    stack = stack + (noise((h, w), 80, seed + 2) - 0.5) * 7
    page_z = stack + bevel(sheet_sd, 3) * 3
    # Tranche du bloc de pages : fines lignes parallèles au bord
    z = np.where(page, page_z, z)
    color = np.tile(sheet_colors(seed + 3, "cream"), (2, 2, 1))[:h, :w]
    gutter = np.exp(-t * 34)
    color = color * (1 - gutter * 0.32)[..., None]
    lines = 0.5 + 0.5 * np.sin(sheet_sd * 2.3)
    edge_band = smooth(-26, -1, sheet_sd)
    color = color * (1 - edge_band * lines * 0.3)[..., None]
    final = np.where(page[..., None], color, leather)
    rough = np.where(page, 0.84, 0.46)
    nor = np.where(page[..., None], lay(paper_map("Paper003", "NormalGL"), w, h, 0.9, seed), leather_n)
    z = ndi.gaussian_filter(z, 0.8)
    job(name, z, mask, final, rough, nor, metallic=0.0, normal_strength=0.6, specular=0.3, **opts)


def relit(img, nor, k=1.3):
    n = nor * 2 - 1
    light = np.array((-0.42, 0.62, 0.66), np.float32)
    light = light / np.linalg.norm(light)
    shade = np.clip((n * light).sum(2), 0, 1) / light[2]
    return img * (shade[..., None] ** k)


def flat(name, img, width=None):
    if ONLY and name not in ONLY:
        return
    out = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8))
    if width:
        out = out.resize((width, round(out.height * width / out.width)), Image.LANCZOS)
    out.save(OUT / "out" / f"{name}.png")


def tint(img, rgb):
    return img * np.array(rgb, np.float32)


flat("wall-saloon", tint(relit(photo("weathered_plank_siding"), photo("weathered_plank_siding", "nor")), (0.86, 0.72, 0.6)), 1200)
flat("wall-barn", tint(relit(photo("weathered_planks"), photo("weathered_planks", "nor")), (0.98, 0.95, 0.9)), 1200)
flat("wall-leather", tint(relit(photo("brown_leather"), photo("brown_leather", "nor"), 1.8), (0.74, 0.66, 0.6)), 1200)
img, nor = plank_band("weathered_plank_siding", 2)
flat("beam-saloon", tint(relit(img, nor), (0.66, 0.54, 0.44)))
img, nor = plank_band("dark_planks", 2)
flat("beam-barn", tint(relit(img, nor), (0.7, 0.62, 0.54)))
leather = relit(photo("fabric_leather_02"), photo("fabric_leather_02", "nor"), 1.5)
flat("band-leather", tint(leather[900:1100], (0.42, 0.31, 0.24)))

WOOD_LIGHT = dict(hdri="courtyard.exr", world=0.75, sun=3.4, sun_dir=(0.4, -0.75, -1.0))
ROOM_LIGHT = dict(hdri="interior.exr", world=0.9, sun=2.6, sun_dir=(0.45, -0.7, -1.0))
PAPER_LIGHT = dict(hdri="studio.exr", world=0.75, sun=2.6, sun_dir=(0.55, -0.85, -1.0), sun_angle=4)
CREAM_LIGHT = dict(PAPER_LIGHT, exposure=1.28)
LEATHER_LIGHT = dict(ROOM_LIGHT, world=0.6)
WAX_LIGHT = dict(ROOM_LIGHT, world=0.42, sun=2.2)
LACQUER_LIGHT = dict(ROOM_LIGHT, world=0.42, sun=2.0)

plate("brass", "brass", 11, **ROOM_LIGHT)
plate("iron", "iron", 12, **ROOM_LIGHT)
tag("tag-raw", "wood_planks_dirt", 2, 21, vertical=True, **WOOD_LIGHT)
tag("tag-dark", "old_planks_02", 2, 22, vertical=True, grade=(0.6, 0.53, 0.46), **WOOD_LIGHT)
tag("tag-red", "worn_planks", 1, 23, vertical=True, **WOOD_LIGHT)
nail("nail", 31, **WOOD_LIGHT)
torn_sheet("sheet-cream", 41, "cream", **CREAM_LIGHT)
flat_tile("tile-cream", 41, "cream", **CREAM_LIGHT)
torn_sheet("sheet-aged", 42, "aged", **PAPER_LIGHT)
flat_tile("tile-aged", 42, "aged", **PAPER_LIGHT)
lacquer_card("card-lacquer", 44, **LACQUER_LIGHT)
lacquer_tile("tile-lacquer", 44, **LACQUER_LIGHT)
tape("tape", 45, **CREAM_LIGHT)
stitched("leather-tan", (0.78, 0.6, 0.46), 51, **LEATHER_LIGHT)
stitched("leather-dark", (0.3, 0.215, 0.165), 52, **LEATHER_LIGHT)
for key, tint_rgb in (("red", (0.34, 0.012, 0.012)), ("black", (0.012, 0.012, 0.014)), ("gold", (0.42, 0.24, 0.04)), ("green", (0.025, 0.11, 0.05)), ("blue", (0.025, 0.065, 0.17))):
    seal(f"seal-{key}", tint_rgb, 60 + len(key), **WAX_LIGHT)
signboard("signboard", 71, **LACQUER_LIGHT)
journal("journal", 81, **CREAM_LIGHT)

json.dump(JOBS, open(OUT / "jobs.json", "w", encoding="utf8"), indent=1)
print("objets", [j["name"] for j in JOBS])
