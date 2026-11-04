"""Prépare l'identité du site à partir des logos officiels du serveur.
Source : image/logo1.png (carré), image/logo2.png (icône), image/logo3.png (bannière).
Usage : python scripts/art/brand.py <dossier-de-sortie>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "public/brand")
OUT.mkdir(parents=True, exist_ok=True)
SRC = Path("image")


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


square = Image.open(SRC / "logo1.png").convert("RGB")
arr = np.asarray(square, dtype=np.float32) / 255

# Les lettres sont le seul élément clair du logo : le fond est noir ou rouge, donc son canal le plus
# faible reste bas, alors qu'il est élevé sur le papier blanc.
low = arr.min(axis=2)
alpha = smooth(0.26, 0.56, low)

# On ne garde que les deux lettres : les éventuels reflets isolés disparaissent.
labels, count = ndi.label(alpha > 0.4)
sizes = ndi.sum(np.ones_like(alpha), labels, range(1, count + 1))
keep = 1 + np.argsort(sizes)[-2:]
region = ndi.binary_dilation(np.isin(labels, keep), iterations=3)
alpha = alpha * region

# Bords : on prolonge la couleur du papier pour éviter un liseré sombre sur fond clair ou photo.
filled = np.stack([ndi.maximum_filter(arr[..., c], size=5) for c in range(3)], axis=2)
color = arr + (filled - arr) * (1 - smooth(0.7, 1.0, alpha))[..., None]

ys, xs = np.nonzero(alpha > 0.05)
pad = 6
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, square.width)
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, square.height)

rgba = np.dstack([color, alpha])[y0:y1, x0:x1]
mark = Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
mark.save(OUT / "nf-mark.webp", quality=92, alpha_quality=95, method=6)
mark.getchannel("A").save(OUT / "nf-mask.png", optimize=True)
print("lettres", mark.size)

square.resize((1024, 1024), Image.LANCZOS).save(OUT / "nf-badge.webp", quality=88, method=6)
square.resize((256, 256), Image.LANCZOS).save(OUT / "nf-badge-256.webp", quality=86, method=6)
square.resize((512, 512), Image.LANCZOS).save(OUT / "nf-badge-512.png", optimize=True)
Image.open(SRC / "logo2.png").convert("RGB").save(OUT / "icon-96.png", optimize=True)

banner = Image.open(SRC / "logo3.png").convert("RGB")
banner.save(OUT / "nf-banner.webp", quality=90, method=6)

# Image de partage sur les réseaux : la bannière, au format attendu (1200 x 630)
ratio = 1200 / banner.width
og = banner.resize((1200, round(banner.height * ratio)), Image.LANCZOS)
top = max(0, (og.height - 630) // 2)
og.crop((0, top, 1200, top + 630)).save(OUT / "og.jpg", quality=88)
print("ok")
