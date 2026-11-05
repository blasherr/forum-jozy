"""Transforme les rendus en images pour le site : public/textures/real/.

  python -I real_finish.py <dossier des rendus>

Pour les feuilles : on ne garde que le pourtour. Le milieu devient transparent et le bord intérieur s'efface
en douceur, pour se fondre dans le papier répétable affiché derrière. Le site peut ainsi tendre une feuille
sur n'importe quelle hauteur sans étirer la matière.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RENDERS = Path(sys.argv[1])
DEST = Path(__file__).resolve().parents[2] / "public" / "textures" / "real"
DEST.mkdir(parents=True, exist_ok=True)
SLICE = 200
FADE = 80


def load(name):
    return Image.open(RENDERS / f"{name}.png")


def save(img, name, quality=80):
    path = DEST / f"{name}.webp"
    img.save(path, quality=quality, method=6, alpha_quality=88)
    print(name, img.size, path.stat().st_size // 1024, "Ko")


def fit(name, width, out=None, quality=88):
    img = load(name)
    save(img.resize((width, round(img.height * width / img.width)), Image.LANCZOS), out or name, quality)


def edge(name, out=None, quality=88):
    """Bords d'une feuille pour border-image : tranche de 200 px à l'origine, 150 px une fois réduite."""
    img = load(name).convert("RGBA")
    a = np.asarray(img, dtype=np.float32).copy()
    h, w = a.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    inner = np.minimum(np.minimum(x, w - 1 - x), np.minimum(y, h - 1 - y))
    keep = np.clip((SLICE - inner) / FADE, 0, 1)
    a[..., 3] *= keep
    a[..., :3] *= (a[..., 3:] > 0)
    out_img = Image.fromarray(a.astype(np.uint8), "RGBA").resize((1068, 1068), Image.LANCZOS)
    save(out_img, out or name, quality)


for n in ("brass", "iron", "tag-raw", "tag-dark", "tag-red", "leather-tan", "leather-dark"):
    fit(n, 720)
fit("nail", 72, quality=84)
for n in ("seal-red", "seal-black", "seal-gold", "seal-green", "seal-blue"):
    fit(n, 260, quality=84)
fit("tape", 300, quality=84)
fit("signboard", 1300)
fit("journal", 1600, quality=88)

edge("sheet-cream")
edge("sheet-aged")
edge("card-lacquer")
for n in ("tile-cream", "tile-aged"):
    fit(n, 820, quality=88)
fit("tile-lacquer", 820, quality=88)
for n in ("wall-saloon", "wall-barn", "wall-leather"):
    fit(n, 1200, quality=86)

for n, width in (("beam-saloon", 1600), ("beam-barn", 1600), ("band-leather", 1600)):
    img = load(n).convert("RGB")
    h = max(80, min(190, img.height))
    save(img.resize((width, h), Image.LANCZOS), n, 86)
