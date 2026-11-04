"""Prépare les captures du jeu : retire le filigrane et l'interface, réduit, convertit en WebP.
Usage : python scripts/art/photos.py <dossier source> <dossier de sortie>
"""
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "image")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "src/db/seed-data/img")
OUT.mkdir(parents=True, exist_ok=True)

# Filigrane RedM en haut à droite sur toutes les captures ; infobulle du barman en bas de la première.
TOP = 64
BOTTOM = {1: 190}

for n in range(1, 8):
    im = Image.open(SRC / f"image{n}.png").convert("RGB")
    w, h = im.size
    im = im.crop((0, TOP, w, h - BOTTOM.get(n, 0)))
    ratio = 1920 / im.width
    im = im.resize((1920, round(im.height * ratio)), Image.LANCZOS)
    im.save(OUT / f"photo-{n}.webp", quality=80, method=6)
    print(f"photo-{n}.webp", im.size, (OUT / f"photo-{n}.webp").stat().st_size // 1024, "Ko")
