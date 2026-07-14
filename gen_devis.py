#!/usr/bin/env python3
# Générateur de devis PDF minimal (sans dépendance) — 1 page A4.
import zlib

W, H = 595.28, 841.89          # A4 en points
M = 40.0                       # marge
LEFT, RIGHT = M, W - M
CW = RIGHT - LEFT              # largeur utile

# Couleurs (RGB 0..1)
DARK   = (0.055, 0.455, 0.565)   # #0e7490
CYAN   = (0.024, 0.714, 0.831)   # #06b6d4
GRAY   = (0.278, 0.333, 0.412)   # #475569
LGRAY  = (0.973, 0.980, 0.988)  # #f8fafc
YEL    = (0.996, 0.976, 0.765)  # #fef9c3
YELB   = (0.792, 0.541, 0.016)  # #ca8a04
DARKT  = (0.059, 0.090, 0.165)  # #0f172a
WHITE  = (1.0, 1.0, 1.0)

def rgb(c):
    return "%.3f %.3f %.3f" % c

# Nettoyage des caractères non latin-1 (WinAnsi safe)
def s(t):
    t = t.replace("\u2014", "-").replace("\u2013", "-")
    t = t.replace("\u2019", "'").replace("\u2018", "'")
    t = t.replace("\u00ab", '"').replace("\u00bb", '"')
    t = t.replace("\u2026", "...")
    return t.encode("latin-1", "replace").decode("latin-1")

ops = []

def rect(x, y, w, h, color):
    ops.append("%s rg" % rgb(color))
    ops.append("%.2f %.2f %.2f %.2f re f" % (x, y, w, h))

def text(x, y, t, font, size, color, spacing=0):
    ops.append("BT")
    ops.append("/%s %.1f Tf" % (font, size))
    ops.append("%s rg" % rgb(color))
    ops.append("1 0 0 1 %.2f %.2f Tm" % (x, y))
    if spacing:
        ops.append("%.2f Tc" % spacing)
    ops.append("(%s) Tj" % s(t))
    ops.append("ET")

def line(x1, y, x2, w, color):
    ops.append("%s RG" % rgb(color))
    ops.append("%.2f w" % w)
    ops.append("%.2f %.2f m %.2f %.2f l S" % (x1, y, x2, y))

# ---------- HEADER ----------
rect(LEFT, H - 70, CW, 30, CYAN)                 # barre cyan
text(LEFT + 8, H - 54, "EAUMALIK SARL", "F2", 18, WHITE)
text(LEFT + 8, H - 64, "Traitement, Purification et Osmose Inverse au Maroc", "F1", 8, (0.9,0.98,1.0))

# Bloc info à droite (badge + numéro + date)
bx = 330
rect(bx, H - 66, 60, 14, LGRAY)
text(bx + 8, H - 55, "DEVIS", "F2", 8, DARK)
text(bx + 75, H - 52, "Devis N° 2026-07-EAU-002", "F2", 13, DARKT)
text(bx + 75, H - 64, "Date d'emission : 14 juillet 2026", "F1", 8, GRAY)
text(bx + 75, H - 74, "Validite : 30 jours", "F1", 8, GRAY)

line(LEFT, H - 78, RIGHT, 1.2, CYAN)

# ---------- BLOCS META ----------
meta_y = H - 92
box_h = 78
bw = (CW - 12) / 2
# Émetteur
rect(LEFT, meta_y - box_h, bw, box_h, LGRAY)
rect(LEFT, meta_y - box_h, 3, box_h, CYAN)
text(LEFT + 10, meta_y - 12, "EMETTEUR", "F2", 7, GRAY)
text(LEFT + 10, meta_y - 26, "EAUMALIK SARL", "F2", 9, DARK)
text(LEFT + 10, meta_y - 38, "23 Rue Boured Eig 3, N5 Roches Noires", "F1", 8, DARKT)
text(LEFT + 10, meta_y - 48, "Casablanca, Maroc", "F1", 8, DARKT)
text(LEFT + 10, meta_y - 58, "ICE : 000000000000000", "F1", 8, DARKT)
text(LEFT + 10, meta_y - 68, "RC Casablanca : 000000", "F1", 8, DARKT)
# Client
cx = LEFT + bw + 12
rect(cx, meta_y - box_h, bw, box_h, LGRAY)
rect(cx, meta_y - box_h, 3, box_h, CYAN)
text(cx + 10, meta_y - 12, "CLIENT", "F2", 7, GRAY)
text(cx + 10, meta_y - 26, "EAUMALIK SARL (auto-prestation)", "F2", 9, DARK)
text(cx + 10, meta_y - 38, "Site : https://eaumalik.com", "F1", 8, DARKT)
text(cx + 10, meta_y - 48, "Domaine : eaumalik.com", "F1", 8, DARKT)
text(cx + 10, meta_y - 58, "Contact : eaumaliksarl@gmail.com", "F1", 8, DARKT)

# ---------- SECTION ----------
sy = meta_y - box_h - 18
text(LEFT, sy, "1  DETAIL DES PRESTATIONS", "F2", 12, DARK)
line(LEFT, sy - 6, RIGHT, 0.6, (0.8,0.835,0.882))

# ---------- TABLEAU ----------
ty = sy - 18
row_h = 22
# en-tête
rect(LEFT, ty - row_h, CW, row_h, DARK)
text(LEFT + 8, ty - 14, "#", "F2", 9, WHITE)
text(LEFT + 50, ty - 14, "Prestation", "F2", 9, WHITE)
text(RIGHT - 8, ty - 14, "Montant (DH HT)", "F2", 9, WHITE, spacing=0)
# lignes
rows = [
    ("1", "Hebergement", "200"),
    ("2", "Achat de domaine (eaumalik.com)", "300"),
    ("3", "Frais de developpement", "500"),
]
yy = ty - row_h
for i, (num, lib, mont) in enumerate(rows):
    if i % 2 == 1:
        rect(LEFT, yy - row_h, CW, row_h, LGRAY)
    text(LEFT + 8, yy - 14, num, "F1", 9, DARKT)
    text(LEFT + 50, yy - 14, lib, "F1", 9, DARKT)
    text(RIGHT - 8, yy - 14, mont, "F1", 9, DARKT)
    yy -= row_h
# total
rect(LEFT, yy - row_h, CW, row_h, DARK)
text(LEFT + 50, yy - 14, "TOTAL", "F2", 11, WHITE)
text(RIGHT - 8, yy - 14, "1 000 DH HT", "F2", 11, WHITE)
yy -= row_h

# ---------- NOTE TVA ----------
ny = yy - 14
rect(LEFT, ny - 26, CW, 26, YEL)
rect(LEFT, ny - 26, 3, 26, YELB)
text(LEFT + 10, ny - 10, "TVA non applicable, article 89-II-12 du CGI (prestation a soi-meme - auto-prestation).", "F1", 8, (0.52,0.30,0.05))
text(LEFT + 10, ny - 19, "Montants exprimes en Dirhams marocains hors taxe.", "F1", 8, (0.52,0.30,0.05))

# ---------- SIGNATURES ----------
sig_y = 120
col_w = (CW - 40) / 2
for i, role in enumerate(["Pour le prestataire", "Pour le client (bon pour accord)"]):
    sx = LEFT + i * (col_w + 40)
    text(sx, sig_y + 40, role, "F2", 9, DARK)
    line(sx, sig_y + 34, sx + col_w, 0.6, DARKT)
    text(sx, sig_y + 22, "EAUMALIK SARL", "F1", 9, GRAY)
    text(sx, sig_y + 10, "Nom : ________________________", "F1", 9, GRAY)
    text(sx, sig_y - 2, "Date : ________________________", "F1", 9, GRAY)
    if i == 1:
        text(sx, sig_y - 14, "(cachet et signature)", "F1", 7, GRAY)

content = "\n".join(ops).encode("latin-1")

# ---------- ASSEMBLAGE PDF ----------
stream = b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream"
objects = {}
objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
objects[2] = b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
objects[3] = (b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] "
              b"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>" % (W, H))
objects[4] = stream
objects[5] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
objects[6] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"

pdf = b"%PDF-1.4\n"
offsets = []
for n in sorted(objects):
    offsets.append(len(pdf))
    pdf += ("%d 0 obj\n" % n).encode("latin-1") + objects[n] + b"\nendobj\n"
xref_pos = len(pdf)
pdf += b"xref\n0 7\n"
pdf += b"0000000000 65535 f \n"
for n in sorted(objects):
    pdf += ("%010d 00000 n \n" % offsets[n - 1]).encode("latin-1")
pdf += b"trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % xref_pos

with open("DEVIS-EAUMALIK-2026-07-002.pdf", "wb") as f:
    f.write(pdf)
print("PDF écrit : DEVIS-EAUMALIK-2026-07-002.pdf (%d octets)" % len(pdf))
