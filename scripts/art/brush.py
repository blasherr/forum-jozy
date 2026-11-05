"""Coups de pinceau du design « Sang & Cendre » : poils secs sur les bords, peinture pleine au centre."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, gaussian_filter1d

OUT = Path(__file__).resolve().parents[2] / "public" / "textures"
RED = np.array([204, 30, 38], dtype=float)


def normalize(a):
    return (a - a.min()) / (a.max() - a.min())


def stroke(width, height, seed, lead=0.07, tail=0.2, solid=0.62):
    rng = np.random.default_rng(seed)
    v = np.linspace(-1, 1, height)

    # Chaque rangée de poils pose et lève le pinceau à un endroit différent
    start = lead * width * (0.4 + normalize(gaussian_filter1d(rng.random(height), height / 90)) * 1.3) + np.abs(v) ** 3 * width * 0.05
    stop = width * (1 - tail * (0.15 + normalize(gaussian_filter1d(rng.random(height), height / 120)) * 0.85)) - np.abs(v) ** 3 * width * 0.09

    # Traînées allongées dans le sens du geste
    fine = normalize(gaussian_filter(rng.random((height, width)), sigma=(0.8, width / 22)))
    broad = normalize(gaussian_filter(rng.random((height, width)), sigma=(height / 34, width / 7)))
    bristle = 0.62 * fine + 0.38 * broad

    x = np.arange(width)[None, :]
    t = (x - start[:, None]) / (stop - start)[:, None]
    body = np.clip(t, 0, 1) * (t < 1) * (t > 0)
    dry = np.clip((body - solid) / (1 - solid), 0, 1) ** 1.3 + np.clip((0.05 - body) / 0.05, 0, 1) * (t > 0)
    # Les bords haut et bas portent moins de peinture
    edge = np.clip((np.abs(v) - 0.72) / 0.28, 0, 1)[:, None] ** 1.6

    threshold = 0.18 + 0.55 * dry + 0.62 * edge
    alpha = np.clip((bristle - threshold) * 14, 0, 1) * (t > 0) * (t < 1)
    alpha = gaussian_filter(alpha, 0.6)

    shade = 0.84 + 0.2 * fine
    rgb = np.clip(RED[None, None, :] * shade[:, :, None], 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


stroke(900, 150, 1847).save(OUT / "brush-red.webp", quality=82, method=6)
stroke(2000, 760, 1848, lead=0.06, tail=0.14, solid=0.74).save(OUT / "brush-wide.webp", quality=78, method=6)
print("ok")
