#!/usr/bin/env python3
"""
Traite le logo source 'Logo Eaumalik.jpeg' (fond noir) pour l'intégrer à l'app :
  1. Détecte l'arrière-plan (noir) et le rend transparent (transition douce aux bords).
  2. Améliore la qualité : upscale 2x (LANCZOS) + netteté (unsharp mask) + léger contraste.
Sortie : public/logo.png (remplace l'ancien logo transparent).
"""
import os
from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "..", "Produits", "Logo Eaumalik.jpeg")
OUT = os.path.join(ROOT, "public", "logo.png")

# 1) Charger la source
src = Image.open(SRC).convert("RGB")
W, H = src.size
px = src.load()

# 2) Fond noir -> transparent (feathering pour des bords propres)
out = Image.new("RGBA", (W, H))
opx = out.load()
LO, HI = 25, 70  # seuils de luminance max pour la transition
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        mx = max(r, g, b)
        if mx < LO:
            opx[x, y] = (r, g, b, 0)
        elif mx < HI:
            a = int((mx - LO) / (HI - LO) * 255)
            opx[x, y] = (r, g, b, a)
        else:
            opx[x, y] = (r, g, b, 255)

# 3) Amélioration qualité : upscale 2x + netteté + contraste
scale = 2
up = out.resize((W * scale, H * scale), Image.LANCZOS)

# 3b) Recadrage sur le contenu (supprime le padding transparent pour un
#     asset au ratio du mot-symbole, utilisable tel quel dans une navbar).
upx = up.load()
uw, uh = up.size
minx, miny, maxx, maxy = uw, uh, 0, 0
for y in range(uh):
    for x in range(uw):
        if upx[x, y][3] > 10:
            minx = min(minx, x); maxx = max(maxx, x)
            miny = min(miny, y); maxy = max(maxy, y)
margin = int(40 * scale)  # marge en pixels (espace 2x) pour ne pas couper les bords
minx = max(0, minx - margin); miny = max(0, miny - margin)
maxx = min(uw, maxx + margin); maxy = min(uh, maxy + margin)
cropped = up.crop((minx, miny, maxx, maxy))

sharp = cropped.filter(ImageFilter.UnsharpMask(radius=1.5, percent=160, threshold=3))
sharp = ImageEnhance.Contrast(sharp).enhance(1.08)

sharp.save(OUT, "PNG", optimize=True)
print(f"Saved {OUT}  size={sharp.size} mode={sharp.mode}")

# Vérification rapide
v = sharp.load()
sw, sh = sharp.size
trans = sum(1 for y in range(0, sh, 8) for x in range(0, sw, 8) if v[x, y][3] < 10)
tot = sum(1 for y in range(0, sh, 8) for x in range(0, sw, 8))
print(f"transparent fraction: {trans/tot:.3f}")
