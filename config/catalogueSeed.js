// ============================================================
//  config/catalogueSeed.js
//  Grille de produits et de tarifs de ProInsertion CI (valeurs de départ).
//
//  - Chaque produit a un identifiant unique, un nom, une catégorie,
//    une description et un prix fixe en FCFA.
//  - Ces valeurs ne sont insérées qu'UNE FOIS (ON CONFLICT DO NOTHING) :
//    les prix et textes modifiés ensuite par l'administrateur
//    (admin/tarifs.html) ne sont jamais écrasés par un redémarrage.
//  - Un produit n'est affiché au public que lorsqu'il est « actif » ;
//    il est activé quand le service correspondant est réellement disponible.
// ============================================================

const CATEGORIES = [
  { id: "cv",                       nom: "CV" },
  { id: "lettres",                  nom: "Lettres de motivation" },
  { id: "packs",                    nom: "Packs" },
  { id: "entretiens",               nom: "Entretiens d'embauche" },
  { id: "documents-candidature",    nom: "Documents de candidature" },
  { id: "documents-administratifs", nom: "Documents administratifs" },
  { id: "documents-academiques",    nom: "Documents académiques et professionnels" },
  { id: "accompagnement",           nom: "Accompagnement" },
  { id: "abonnement",               nom: "Abonnement" },
  { id: "recruteurs",               nom: "Recruteurs" },
];

// [id, catégorie, nom, description, prix FCFA, périodicité, composition (ids), inclus (texte)]
const P = (id, categorie, nom, description, prix, extra = {}) => ({
  id, categorie, nom, description, prix_fcfa: prix,
  periodicite: extra.periodicite || null,
  composition: extra.composition || [],
  inclus: extra.inclus || [],
});

const PRODUITS = [
  // ── CV ──
  P("cv-classique", "cv", "CV classique", "Mise en page sobre et lisible, idéale pour un premier emploi ou un stage.", 2000),
  P("cv-moderne", "cv", "CV moderne", "Présentation actuelle et soignée pour valoriser votre profil.", 3000),
  P("cv-professionnel", "cv", "CV professionnel développé", "CV complet qui détaille vos expériences, vos compétences et vos réalisations.", 3000),
  P("cv-ats", "cv", "CV compatible ATS", "Mise en page simple, lisible par les logiciels de tri utilisés par les recruteurs.", 3000),
  P("cv-international", "cv", "CV international", "Format adapté aux candidatures auprès d'organisations et d'entreprises internationales.", 4000),
  P("cv-bilingue", "cv", "CV bilingue", "Votre CV en français et en anglais.", 4500),

  // ── Lettres de motivation ──
  P("lm-classique", "lettres", "Lettre de motivation classique", "Lettre structurée et professionnelle, adaptée au poste visé.", 2000),
  P("lm-personnalisee", "lettres", "Lettre de motivation personnalisée", "Lettre construite à partir de votre parcours et de l'organisation visée.", 2500),
  P("lm-internationale", "lettres", "Lettre de motivation internationale", "Lettre adaptée aux usages des candidatures internationales.", 3000),
  P("lm-spontanee", "lettres", "Lettre de candidature spontanée", "Pour vous présenter à une organisation qui n'a pas publié d'offre.", 2000),
  P("lm-stage", "lettres", "Lettre de demande de stage", "Pour solliciter un stage auprès d'une entreprise ou d'une organisation.", 2000),
  P("lm-ong", "lettres", "Lettre de motivation ONG / humanitaire", "Lettre orientée engagement, valeurs et terrain pour une ONG ou une organisation sociale.", 2500),
  P("lm-administration", "lettres", "Lettre de motivation administration / Fonction Publique", "Lettre au ton administratif formel pour une administration ou un concours de la fonction publique.", 2000),
  P("lm-emploi", "lettres", "Lettre de demande d'emploi", "Pour postuler à un emploi avec une lettre claire et convaincante.", 2000),

  // ── Packs ──
  P("pack-entretien", "packs", "Pack Entretien", "Une fiche de préparation et une simulation complète d'entretien, avec analyse et note sur 100.", 3000,
    { composition: ["entretien-preparation", "entretien-simulation"] }),
  P("pack-essentiel", "packs", "Pack Essentiel", "Un CV classique et une lettre de motivation classique.", 2800,
    { composition: ["cv-classique", "lm-classique"] }),
  P("pack-professionnel", "packs", "Pack Professionnel", "Un CV professionnel développé et une lettre de motivation personnalisée.", 4000,
    { composition: ["cv-professionnel", "lm-personnalisee"] }),
  P("pack-international", "packs", "Pack International", "Un CV international et une lettre de motivation internationale.", 5500,
    { composition: ["cv-international", "lm-internationale"] }),

  // ── Entretiens ──
  P("entretien-preparation", "entretiens", "Préparation à un entretien", "Conseils et questions fréquentes pour préparer votre entretien.", 2500),
  P("entretien-simulation", "entretiens", "Simulation complète d'entretien", "Questions adaptées au poste, analyse de vos réponses, note sur 100 et rapport final.", 1500),

  // ── Documents de candidature (les demandes d'emploi, de stage et la candidature spontanée sont dans « Lettres ») ──
  P("doc-lettre-relance", "documents-candidature", "Lettre de relance", "Pour relancer poliment une organisation après une candidature.", 1500),
  P("doc-lettre-recommandation", "documents-candidature", "Lettre de recommandation", "Lettre de recommandation professionnelle.", 2000),
  P("doc-lettre-remerciement", "documents-candidature", "Lettre de remerciement", "À envoyer après un entretien pour remercier le recruteur.", 1500),

  // ── Documents administratifs ──
  P("doc-demande-conge", "documents-administratifs", "Demande de congé", "Demande de congé adressée à votre employeur.", 1500),
  P("doc-lettre-demission", "documents-administratifs", "Lettre de démission", "Lettre de démission claire et respectueuse.", 2000),
  P("doc-demande-attestation-travail", "documents-administratifs", "Demande d'attestation de travail", "Demande d'attestation de travail à votre employeur.", 1500),
  P("doc-demande-explication", "documents-administratifs", "Lettre de demande d'explication", "Courrier officiel de demande d'explication.", 2000),
  P("doc-transmission-documents", "documents-administratifs", "Lettre de transmission de documents", "Courrier d'accompagnement pour l'envoi de documents.", 1500),

  // ── Documents académiques et professionnels ──
  P("doc-rapport-stage", "documents-academiques", "Rapport de stage", "Rapport de stage structuré à partir de votre expérience.", 3000),
  P("doc-page-garde", "documents-academiques", "Page de garde de rapport", "Page de garde soignée pour vos rapports.", 1500),
  P("doc-projet-professionnel", "documents-academiques", "Projet professionnel", "Présentation structurée de votre projet professionnel.", 3000),
  P("doc-projet-formation", "documents-academiques", "Projet de formation", "Présentation de votre projet de formation.", 3000),
  P("doc-discours-professionnel", "documents-academiques", "Discours professionnel", "Discours adapté à votre événement et à votre public.", 2500),
  P("doc-biographie-professionnelle", "documents-academiques", "Biographie professionnelle", "Courte biographie pour vos présentations et profils.", 2000),

  // ── Accompagnement ──
  P("cv-correction", "accompagnement", "Correction et amélioration de CV", "Votre CV existant relu, corrigé et amélioré.", 2000),
  P("cv-optimisation-offre", "accompagnement", "Optimisation d'un CV pour une offre précise", "Votre CV adapté aux exigences d'une offre d'emploi donnée.", 2500),
  P("pack-recherche-emploi", "accompagnement", "Pack Recherche d'emploi", "Tout pour lancer vos candidatures.", 6000,
    { composition: ["cv-professionnel", "lm-classique", "lm-spontanee"],
      inclus: ["Un guide de recherche d'emploi", "Des conseils pour réussir un entretien"] }),

  // ── Abonnement ──
  P("abonnement-premium", "abonnement", "Abonnement candidat Premium", "Outils de candidature sans limite quotidienne et contenus Premium.", 3000, { periodicite: "mois" }),

  // ── Recruteurs ──
  P("offre-simple", "recruteurs", "Publication d'une offre d'emploi simple", "Votre offre publiée sur la page Emploi.", 6000),
  P("offre-premium", "recruteurs", "Publication d'une offre d'emploi Premium", "Votre offre mise en avant auprès des candidats.", 11000),
];

module.exports = { CATEGORIES, PRODUITS };
