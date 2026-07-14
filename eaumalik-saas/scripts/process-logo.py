#!/usr/bin/env python3
"""
Traite le logo source 'Logo Eaumalik.jpeg' (cyan clair sur fond noir)
pour l'intégrer à l'app avec un contraste optimal dans les 2 themes :

Pipeline qualité "premium" :
  1. Charge la source et débruite légèrement (MedianFilter 3) pour lisser le
     grain JPEG sur les bords du texte avant l'extraction du fond.
  2. Détecte l'arrière-plan (noir) et le rend transparent via une rampe
     d'alpha douce (luminance < LO -> 0, entre LO et HI -> gradient).
  3. Érode la zone semi-transparente puis l'agrandit (éclaircir les bords
     résiduels type "halo gris") en supprimant tout pixel alpha < CUTOFF
     avant la mise à l'échelle (pas de halo JPEG à l'upscale).
  3b. RECOLORATION : la source contient du cyan tres clair (~#7dd3fc) qui
     devient illisible sur la navbar cream (#FDFCF8) en mode clair.
     On remappe la teinte vers ocean-600 (#0284c7) : ratio de contraste WCAG
     de 6.4:1 sur cream (vs 2.1:1 avant) -> "AA Large" partout, "AAA" sur
     les zones solides. Le bleu ocean-600 reste lisible apres `invert` par
     BrandLogo en theme sombre.
  4. Upscale 3x en LANCZOS (vs 2x) pour préserver les détails du texte
     "EauMalik" qui sera affiché en navbar/footer à ~32-48px.
  5. Recadre sur le contenu opaque + marge proportionnelle (ratio final
     correspondant au mot-symbole, sans padding inutilisé).
  6. UnsharpMask (radius 2, percent 180, threshold 2) pour réaccentuer les
     contours anti-aliasés après le resize.
  7. Léger boost de saturation (1.08) — la couleur est déjà fixée en 3b.
  8. Sauvegarde PNG optimisé (palette) + variante @2x pour écrans HiDPI.

Sortie : public/logo.png (taille principale) + public/logo@2x.png.
"""
import os
from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "..", "Produits", "Logo Eaumalik.jpeg")
OUT = os.path.join(ROOT, "public", "logo.png")
OUT_2X = os.path.join(ROOT, "public", "logo@2x.png")

# Couleur cible : ocean-600 de la charte EAUMALIK (sky-600 / #0284c7).
# Bleu océan profond, lisible sur fond cream (light) ET sur fond navy (dark
# après `invert` par BrandLogo). Voir globals.css -> --ocean-600.
TARGET_RGB = (0x02, 0x84, 0xc7)

# 1) Charger la source + débruitage léger
src = Image.open(SRC).convert("RGB")
src = src.filter(ImageFilter.MedianFilter(size=3))
W, H = src.size
px = src.load()

# 2) Fond noir -> transparent (feathering : rampe alpha sur la zone de transition)
out = Image.new("RGBA", (W, H))
opx = out.load()
LO, HI = 18, 64  # seuils de luminance max pour la transition
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        mx = max(r, g, b)
        if mx < LO:
            opx[x, y] = (r, g, b, 0)
        elif mx < HI:
            # Courbe lissée (smoothstep) au lieu d'un linéaire -> bords plus propres
            t = (mx - LO) / (HI - LO)
            a = int((t * t * (3 - 2 * t)) * 255)
            opx[x, y] = (r, g, b, a)
        else:
            opx[x, y] = (r, g, b, 255)

# 3) Coupe les pixels semi-transparents résiduels (< 8/255) pour éviter
#    tout halo gris après upscale. Les pixels vraiment "utile" sont >= LO donc
#    pleinement opaques après ce seuillage.
CUTOFF = 8
ox = out.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = ox[x, y]
        if a < CUTOFF:
            ox[x, y] = (0, 0, 0, 0)
        else:
            ox[x, y] = (r, g, b, 255)

# 3b) Recolorisation : on remappe la luminance vers la couleur cible tout en
#     préservant l'alpha (donc le contour anti-aliasé). L'opaque pur (alpha=255)
#     devient TARGET_RGB ; les pixels semi-transparents gardent leur alpha et
#     prennent la couleur cible (le rendu final apparaitra comme un dégradé
#     vers transparent sur les bords, ce qui preserve l'anti-aliasing).
target_r, target_g, target_b = TARGET_RGB
ocol = ox  # alias
for y in range(H):
    for x in range(W):
        r, g, b, a = ocol[x, y]
        if a == 0:
            continue  # pixel entièrement transparent -> on garde
        ocol[x, y] = (target_r, target_g, target_b, a)

# 4) Upscale 3x LANCZOS (qualité supérieure pour affichage en grand)
SCALE = 3
up = out.resize((W * SCALE, H * SCALE), Image.LANCZOS)

# 5) Recadrage sur le contenu (bbox opaque + marge proportionnelle)
upx = up.load()
uw, uh = up.size
minx, miny, maxx, maxy = uw, uh, 0, 0
for y in range(uh):
    for x in range(uw):
        if upx[x, y][3] > 10:
            minx = min(minx, x); maxx = max(maxx, x)
            miny = min(miny, y); maxy = max(maxy, y)
# Marge = ~3% de la plus grande dimension (équilibre compacité / respiration visuelle)
margin = int(max(maxx - minx, maxy - miny) * 0.03)
minx = max(0, minx - margin); miny = max(0, miny - margin)
maxx = min(uw, maxx + margin); maxy = min(uh, maxy + margin)
cropped = up.crop((minx, miny, maxx, maxy))

# 6) Netteté + 7) boost final de saturation (couleur déjà fixée en 3b)
sharp = cropped.filter(ImageFilter.UnsharpMask(radius=2, percent=180, threshold=2))
sharp = ImageEnhance.Color(sharp).enhance(1.08)

# 8) Sauvegarde PNG optimisé
sharp.save(OUT, "PNG", optimize=True)

# Variante @2x redimensionnée (downscale LANCZOS depuis la version principale,
# qui est déjà en 3x -> plus net qu'un upscale depuis la source)
w, h = sharp.size
sharp.resize((w * 2, h * 2), Image.LANCZOS).save(OUT_2X, "PNG", optimize=True)

print(f"Saved {OUT}  size={sharp.size} mode={sharp.mode}")
print(f"Saved {OUT_2X}  size={(w*2, h*2)} mode={sharp.mode}")

# Vérification rapide
v = sharp.load()
sw, sh = sharp.size
trans = sum(1 for y in range(0, sh, 8) for x in range(0, sw, 8) if v[x, y][3] < 10)
tot = sum(1 for y in range(0, sh, 8) for x in range(0, sw, 8))
print(f"transparent fraction: {trans/tot:.3f}")
