# -*- coding: utf-8 -*-
"""Génère les icônes d'Histoires et l'image d'aperçu des liens partagés.

Dessin : sur un fond bleu nuit, une frise verticale d'or — un trait, deux
règles aux extrémités, trois jalons dont le médian est plus gros. Le même
dessin que le logo de la page (index.html).

    python build/generer-icones.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(os.path.dirname(ICI), "icons")
NUIT = (30, 42, 68)
NUIT_SOMBRE = (20, 27, 45)
OR = (217, 182, 91)
PAPIER = (244, 239, 230)
E = 4

POLICES_TITRE = [r"C:\Windows\Fonts\constanb.ttf", r"C:\Windows\Fonts\cambriab.ttf", r"C:\Windows\Fonts\georgiab.ttf"]
POLICES_TEXTE = [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"]


def police(chemins, taille):
    for chemin in chemins:
        if os.path.exists(chemin):
            return ImageFont.truetype(chemin, taille)
    return ImageFont.load_default()


def symbole(d, cx, cy, u):
    """u : l'unité (le dessin fait 64 unités de côté, centré en cx, cy)."""
    def p(x, y):
        return (cx + (x - 32) * u, cy + (y - 32) * u)
    ep = 2.2 * u
    d.line([p(32, 11), p(32, 53)], fill=OR, width=round(ep))
    d.line([p(20, 11), p(44, 11)], fill=OR, width=round(ep))
    d.line([p(20, 53), p(44, 53)], fill=OR, width=round(ep))
    for (x, y, r) in [(32, 20, 3.6), (32, 32, 5.4), (32, 44, 3.6)]:
        X, Y = p(x, y)
        d.ellipse([X - r * u, Y - r * u, X + r * u, Y + r * u], fill=OR)
    for (x, y) in [(20, 11), (44, 11), (20, 53), (44, 53)]:
        X, Y = p(x, y)
        r = ep / 2
        d.ellipse([X - r, Y - r, X + r, Y + r], fill=OR)


def icone(cote, masquable=False):
    g = cote * E
    image = Image.new("RGBA", (g, g), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    if masquable:
        d.rectangle([0, 0, g, g], fill=NUIT)
        symbole(d, g / 2, g / 2, g / 64 * 0.72)
    else:
        rayon = g * 14 / 64
        d.rounded_rectangle([g * 2 / 64, g * 2 / 64, g * 62 / 64, g * 62 / 64], radius=rayon, fill=NUIT)
        symbole(d, g / 2, g / 2, g / 64)
    return image.resize((cote, cote), Image.LANCZOS)


def apercu():
    L, H = 1200, 630
    g = Image.new("RGB", (L * 2, H * 2), NUIT)
    d = ImageDraw.Draw(g)
    # un dégradé discret
    for y in range(H * 2):
        t = y / (H * 2)
        c = tuple(round(NUIT[i] * (1 - t) + NUIT_SOMBRE[i] * t) for i in range(3))
        d.line([(0, y), (L * 2, y)], fill=c)
    symbole(d, 300, H, 7.5)
    titre = police(POLICES_TITRE, 150)
    texte = police(POLICES_TEXTE, 56)
    d.text((560, 300), "Histoires", font=titre, fill=PAPIER)
    lignes = ["Rois, empereurs, présidents, chanceliers,", "papes et grands maîtres : des frises", "chronologiques pour le téléphone."]
    y = 520
    for l in lignes:
        d.text((566, y), l, font=texte, fill=(203, 211, 230))
        y += 78
    d.text((566, 820), "cristo67000.github.io/histoires — hors ligne, sans compte, sans publicité", font=police(POLICES_TEXTE, 40), fill=OR)
    return g.resize((L, H), Image.LANCZOS)


def main():
    os.makedirs(SORTIE, exist_ok=True)
    icone(192).save(os.path.join(SORTIE, "icon-192.png"))
    icone(512).save(os.path.join(SORTIE, "icon-512.png"))
    icone(512, masquable=True).save(os.path.join(SORTIE, "icon-maskable-512.png"))
    apercu().save(os.path.join(SORTIE, "apercu-1200x630.png"), optimize=True)
    print("icônes écrites dans", SORTIE)


if __name__ == "__main__":
    main()
