// ============================================================
//  config/modelesCv.js
//  Catalogue des modèles de CV disponibles (Document AI Pro).
//  2 variantes par catégorie pour commencer — d'autres seront
//  ajoutées progressivement sans casser les modèles existants.
// ============================================================

const MODELES_CV = {
  // ── CV ATS Classique ─────────────────────────────────────
  ats_classique_1: {
    nom: "ATS Classique — Sobre",
    categorie: "ATS Classique",
    description: "Mise en page simple et épurée, optimisée pour les logiciels de tri automatique (ATS).",
    layout: "simple",
    couleurs: { primaire: "#1A1A2E", secondaire: "#444444", accent: "#1A6B3C" },
    premium: false,
  },
  ats_classique_2: {
    nom: "ATS Classique — Ligne bleue",
    categorie: "ATS Classique",
    description: "Structure identique, liseré bleu discret pour se démarquer sans nuire à la lecture ATS.",
    layout: "simple",
    couleurs: { primaire: "#1A1A2E", secondaire: "#444444", accent: "#0A6EBD" },
    premium: false,
  },

  // ── CV ONG / Social ──────────────────────────────────────
  ong_social_1: {
    nom: "ONG & Social — Engagement",
    categorie: "ONG/Social",
    description: "Met en avant les missions de terrain, le bénévolat et l'impact social.",
    layout: "structure",
    couleurs: { primaire: "#1A6B3C", secondaire: "#2D8659", accent: "#F5820D" },
    premium: false,
  },
  ong_social_2: {
    nom: "ONG & Social — Solidaire",
    categorie: "ONG/Social",
    description: "Variante chaleureuse avec accent sur les valeurs et l'engagement humain.",
    layout: "structure",
    couleurs: { primaire: "#0F5132", secondaire: "#1A6B3C", accent: "#D97706" },
    premium: false,
  },

  // ── CV International ─────────────────────────────────────
  international_1: {
    nom: "International — Executive",
    categorie: "International",
    description: "Format compact et sobre, proche des standards anglo-saxons (Europass friendly).",
    layout: "structure",
    couleurs: { primaire: "#0A2540", secondaire: "#0A6EBD", accent: "#64748B" },
    premium: true,
  },
  international_2: {
    nom: "International — Global",
    categorie: "International",
    description: "Mise en page bilingue-friendly, idéale pour les candidatures multinationales.",
    layout: "structure",
    couleurs: { primaire: "#1E3A5F", secondaire: "#2C5F8A", accent: "#C0392B" },
    premium: true,
  },

  // ── CV Tech ───────────────────────────────────────────────
  tech_1: {
    nom: "Tech — Développeur",
    categorie: "Tech",
    description: "Met en avant les compétences techniques, stacks et projets.",
    layout: "structure",
    couleurs: { primaire: "#111827", secondaire: "#1F2937", accent: "#22C55E" },
    premium: false,
  },
  tech_2: {
    nom: "Tech — Dark Mode",
    categorie: "Tech",
    description: "Variante inspirée des interfaces sombres, moderne et technique.",
    layout: "structure",
    couleurs: { primaire: "#0D1117", secondaire: "#161B22", accent: "#58A6FF" },
    premium: true,
  },

  // ── CV Commercial ─────────────────────────────────────────
  commercial_1: {
    nom: "Commercial — Performance",
    categorie: "Commercial",
    description: "Met en avant les résultats chiffrés, objectifs atteints et négociation.",
    layout: "structure",
    couleurs: { primaire: "#7C2D12", secondaire: "#9A3412", accent: "#F59E0B" },
    premium: false,
  },
  commercial_2: {
    nom: "Commercial — Dynamique",
    categorie: "Commercial",
    description: "Variante vive et impactante pour les profils vente/business development.",
    layout: "structure",
    couleurs: { primaire: "#991B1B", secondaire: "#B91C1C", accent: "#FBBF24" },
    premium: true,
  },

  // ── CV Jeune diplômé ──────────────────────────────────────
  jeune_diplome_1: {
    nom: "Jeune diplômé — Première étape",
    categorie: "Jeune diplômé",
    description: "Valorise formations, stages et projets académiques pour profils sans grande expérience.",
    layout: "simple",
    couleurs: { primaire: "#1A6B3C", secondaire: "#0A6EBD", accent: "#F5820D" },
    premium: false,
  },
  jeune_diplome_2: {
    nom: "Jeune diplômé — Nouvelle génération",
    categorie: "Jeune diplômé",
    description: "Design frais et coloré pour candidatures à un premier emploi ou stage.",
    layout: "structure",
    couleurs: { primaire: "#6D28D9", secondaire: "#7C3AED", accent: "#F5820D" },
    premium: false,
  },
};

// Regroupement par catégorie (pour affichage frontend organisé)
function listerParCategorie() {
  const parCategorie = {};
  for (const [id, modele] of Object.entries(MODELES_CV)) {
    if (!parCategorie[modele.categorie]) parCategorie[modele.categorie] = [];
    parCategorie[modele.categorie].push({ id, ...modele });
  }
  return parCategorie;
}

function obtenirModele(id) {
  return MODELES_CV[id] || MODELES_CV.ats_classique_1; // repli sûr par défaut
}

module.exports = { MODELES_CV, listerParCategorie, obtenirModele };
