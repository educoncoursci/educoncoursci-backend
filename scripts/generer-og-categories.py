#!/usr/bin/env python3
"""
Génère une image de partage social (og:image) par catégorie de concours.
Format 1200x630 (standard OpenGraph), même format que og-image.jpg
générique déjà utilisé sur le site.

Contrairement à un rendu par concours individuel (qui demanderait une
librairie de rasterisation SVG->PNG non testable dans cet environnement
sans accès réseau), cette approche ne dépend d'aucune nouvelle librairie
côté serveur Node : les images sont pré-générées une fois ici et servies
comme fichiers statiques, exactement comme og-image.jpg déjà en place.

Résultat : quand un concours est partagé sur WhatsApp/Facebook/Twitter,
l'aperçu montre au moins le bon visuel de catégorie (couleur + nom de
la catégorie) au lieu d'une image totalement générique — sans montrer
le titre exact du concours (ça resterait dans og:title/og:description,
déjà corrigés pour être dynamiques).
"""

from PIL import Image, ImageDraw, ImageFont

LARGEUR, HAUTEUR = 1200, 630

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Catégories du seed (backend/scripts/seed-concours-ci.js) avec leurs
# couleurs déjà utilisées dans l'app — cohérence visuelle garantie.
CATEGORIES = [
    {"slug": "administration", "nom": "Administration", "couleur": "#7B2FBE", "emoji": "🏛️"},
    {"slug": "enseignement", "nom": "Enseignement", "couleur": "#1A6B3C", "emoji": "🎓"},
    {"slug": "fonction-publique", "nom": "Fonction publique", "couleur": "#0A6EBD", "emoji": "🏢"},
    {"slug": "sante-social", "nom": "Santé & Social", "couleur": "#D9000D", "emoji": "❤️"},
    {"slug": "securite-defense", "nom": "Sécurité & Défense", "couleur": "#0A6EBD", "emoji": "🛡️"},
]


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def assombrir(rgb, facteur=0.55):
    return tuple(int(c * facteur) for c in rgb)


def generer_image(cat, chemin_sortie):
    couleur_rgb = hex_to_rgb(cat["couleur"])
    couleur_sombre = assombrir(couleur_rgb, 0.35)

    img = Image.new("RGB", (LARGEUR, HAUTEUR), couleur_rgb)
    draw = ImageDraw.Draw(img)

    # Dégradé diagonal simple (haut clair -> bas foncé) pour donner du
    # relief sans dépendance graphique supplémentaire.
    for y in range(HAUTEUR):
        ratio = y / HAUTEUR
        r = int(couleur_rgb[0] * (1 - ratio * 0.5) + couleur_sombre[0] * ratio * 0.5)
        g = int(couleur_rgb[1] * (1 - ratio * 0.5) + couleur_sombre[1] * ratio * 0.5)
        b = int(couleur_rgb[2] * (1 - ratio * 0.5) + couleur_sombre[2] * ratio * 0.5)
        draw.line([(0, y), (LARGEUR, y)], fill=(r, g, b))

    # Bandeau blanc semi-transparent en bas pour la marque du site
    bandeau = Image.new("RGBA", (LARGEUR, 110), (255, 255, 255, 235))
    img.paste(bandeau, (0, HAUTEUR - 110), bandeau)
    draw = ImageDraw.Draw(img)

    # Nom de la catégorie, centré
    font_titre = ImageFont.truetype(FONT_BOLD, 88)
    texte = cat["nom"]
    bbox = draw.textbbox((0, 0), texte, font=font_titre)
    largeur_texte = bbox[2] - bbox[0]
    draw.text(
        ((LARGEUR - largeur_texte) / 2, 210),
        texte,
        font=font_titre,
        fill="white",
    )

    # Sous-titre
    font_sous = ImageFont.truetype(FONT_REGULAR, 34)
    sous_titre = "Concours en Côte d'Ivoire"
    bbox2 = draw.textbbox((0, 0), sous_titre, font=font_sous)
    largeur_sous = bbox2[2] - bbox2[0]
    draw.text(
        ((LARGEUR - largeur_sous) / 2, 320),
        sous_titre,
        font=font_sous,
        fill=(255, 255, 255, 220),
    )

    # Marque du site dans le bandeau bas
    font_marque = ImageFont.truetype(FONT_BOLD, 40)
    marque = "EduConcoursCI"
    bbox3 = draw.textbbox((0, 0), marque, font=font_marque)
    largeur_marque = bbox3[2] - bbox3[0]
    draw.text(
        ((LARGEUR - largeur_marque) / 2, HAUTEUR - 85),
        marque,
        font=font_marque,
        fill=couleur_rgb,
    )

    img.save(chemin_sortie, "JPEG", quality=90)
    print(f"  ✅ {chemin_sortie}")


if __name__ == "__main__":
    for cat in CATEGORIES:
        generer_image(cat, f"/home/claude/work2/frontend/assets/og-categories/{cat['slug']}.jpg")
    print(f"\n{len(CATEGORIES)} images générées.")
