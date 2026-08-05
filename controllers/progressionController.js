// ============================================================
//  controllers/progressionController.js
//  Module 7 — Suivi de progression du candidat.
//  Lit uniquement les données déjà générées par les QCM, les
//  examens blancs, les favoris et les consultations de documents —
//  ne modifie aucun de ces moteurs.
// ============================================================

const User    = require("../models/User");
const Concours = require("../models/Concours");
const Score   = require("../models/Score");
const PDF     = require("../models/PDF");
const { calculerBadges, DEFINITIONS } = require("../services/badges");
const { genererCertificatPDF, supprimerFichier } = require("../services/pdf");

const SEUIL_FAIBLE = 60; // en-dessous de ce %, une matière est considérée comme un point faible

exports.monTableauDeBord = async (req, res) => {
try {
const userId = req.user.id;

const [favorisIds, statsGlobales, statsParMatiere, examensBlancs, documentsConsultes] =
  await Promise.all([
    User.getFavoris(userId),
    Score.statsUtilisateur(userId),
    Score.statsParMatiere(userId),
    Score.countExamensBlancs(userId),
    PDF.compterDocumentsConsultes(userId),
  ]);

// Concours suivis (favoris) — on ne remonte que les infos utiles à
// l'affichage, pas les fiches complètes.
let concoursSuivis = [];
if (Array.isArray(favorisIds) && favorisIds.length > 0) {
  const resultats = await Promise.all(
    favorisIds.map((id) => Concours.findById(id).catch(() => null)),
  );
  concoursSuivis = resultats
    .filter(Boolean)
    .map((c) => ({ id: c.id, titre: c.titre, statut: c.statut, cloture: c.cloture }));
}

// Niveau de préparation global (estimé) — moyenne pondérée simple :
// moyenne des scores QCM (hors examens blancs, calcul par matière déjà
// fait), sans invention de données là où il n'y en a pas.
const moyenneGlobale = statsGlobales?.moyenne != null ? Number(statsGlobales.moyenne) : null;
let niveauGlobal = null;
if (moyenneGlobale != null) {
  niveauGlobal =
    moyenneGlobale >= 80 ? "Très bon niveau" :
    moyenneGlobale >= 60 ? "Bon niveau, encore des points à consolider" :
    moyenneGlobale >= 40 ? "Niveau moyen — entraînement recommandé" :
    "Débutant — beaucoup de marge de progression";
}

// Recommandations personnalisées : matières les plus faibles avec
// au moins une tentative, jusqu'à 3.
const recommandations = statsParMatiere
  .filter((m) => Number(m.moyenne) < SEUIL_FAIBLE)
  .slice(0, 3)
  .map((m) => ({
    matiere: m.matiere,
    moyenne: Number(m.moyenne),
    message: `Tu es à ${m.moyenne}% en ${m.matiere} — reprends des QCM sur cette matière pour progresser.`,
  }));

// Badges (Lot 5) — calculés à partir des stats déjà chargées, aucune
// requête supplémentaire.
const badges = calculerBadges({
  total_tentatives: statsGlobales?.total_tentatives || 0,
  moyenne: moyenneGlobale || 0,
  meilleur: statsGlobales?.meilleur || 0,
  examensBlancs: examensBlancs,
});

res.json({
  concoursSuivis,
  statsParMatiere: statsParMatiere.map((m) => ({ ...m, moyenne: Number(m.moyenne) })),
  examensBlancsRealises: examensBlancs,
  documentsConsultes,
  totalTentativesQcm: statsGlobales?.total_tentatives ? Number(statsGlobales.total_tentatives) : 0,
  moyenneGlobale,
  niveauGlobal,
  recommandations,
  badges,
});

} catch (err) {
console.error("Erreur tableau de bord progression :", err.message);
res.status(500).json({ error: "Erreur lors du calcul de ta progression." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/progression/classement — Classement général (public)
//  Lot 5 — espace préparation.
// ════════════════════════════════════════════════════════════
exports.classement = async (req, res) => {
try {
const classement = await Score.classement({ minTentatives: 3, limite: 20 });
res.json({
  classement: classement.map((c, i) => ({
    rang: i + 1,
    nom: c.nom,
    moyenne: Number(c.moyenne),
    totalTentatives: Number(c.total_tentatives),
  })),
});
} catch (err) {
console.error("Erreur classement :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

const DATE_FR = () => new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// ════════════════════════════════════════════════════════════
//  GET /api/progression/certificat/badge/:badgeId — Lot 12
//  Certificat PDF pour un badge effectivement débloqué par le
//  candidat connecté (aucun badge non atteint ne peut être généré).
// ════════════════════════════════════════════════════════════
exports.certificatBadge = async (req, res) => {
  let filePath = null;
  try {
    const definition = DEFINITIONS.find((d) => d.id === req.params.badgeId);
    if (!definition) {
      return res.status(404).json({ error: "Badge inconnu." });
    }

    const userId = req.user.id;
    const [statsGlobales, examensBlancs, user] = await Promise.all([
      Score.statsUtilisateur(userId),
      Score.countExamensBlancs(userId),
      User.findById(userId),
    ]);

    const badges = calculerBadges({
      total_tentatives: statsGlobales?.total_tentatives || 0,
      moyenne: statsGlobales?.moyenne || 0,
      meilleur: statsGlobales?.meilleur || 0,
      examensBlancs,
    });
    const badge = badges.find((b) => b.id === req.params.badgeId);

    if (!badge?.debloque) {
      return res.status(403).json({ error: "Ce badge n'est pas encore débloqué sur ton compte." });
    }

    const nomFichier = `certificat_badge_${req.params.badgeId}_${userId}_${Date.now()}`;
    filePath = await genererCertificatPDF(nomFichier, {
      titre: `${definition.icone} Badge « ${definition.nom} »`,
      sousTitre: "Espace préparation EduConcoursCI",
      nomCandidat: user?.nom || "Candidat EduConcoursCI",
      detail: definition.description,
      date: DATE_FR(),
    });

    res.download(filePath, `certificat-${req.params.badgeId}.pdf`, (err) => {
      supprimerFichier(filePath);
      if (err && !res.headersSent) {
        res.status(500).json({ error: "Erreur lors du téléchargement du certificat." });
      }
    });
  } catch (err) {
    console.error("Erreur certificat badge :", err.message);
    if (filePath) supprimerFichier(filePath);
    res.status(500).json({ error: "Erreur lors de la génération du certificat." });
  }
};

// ════════════════════════════════════════════════════════════
//  GET /api/progression/certificat/examen/:scoreId — Lot 12
//  Certificat PDF pour un examen blanc réussi (≥ 50%), appartenant
//  bien au candidat connecté.
// ════════════════════════════════════════════════════════════
exports.certificatExamen = async (req, res) => {
  let filePath = null;
  try {
    const score = await Score.findById(req.params.scoreId);
    if (!score || score.user_id !== req.user.id) {
      return res.status(404).json({ error: "Résultat introuvable." });
    }
    if (score.qcm_id !== null) {
      return res.status(400).json({ error: "Ce certificat n'est disponible que pour les examens blancs." });
    }
    if (Number(score.pourcentage) < 50) {
      return res.status(403).json({ error: "Un score d'au moins 50% est requis pour obtenir ce certificat." });
    }

    const user = await User.findById(req.user.id);
    const nomFichier = `certificat_examen_${score.id}_${Date.now()}`;
    filePath = await genererCertificatPDF(nomFichier, {
      titre: "🏅 Certificat de réussite",
      sousTitre: "Examen blanc — Espace préparation EduConcoursCI",
      nomCandidat: user?.nom || "Candidat EduConcoursCI",
      detail: `${score.qcm_titre || "Examen blanc"} — Score obtenu : ${score.pourcentage}% (${score.score}/${score.total})`,
      date: new Date(score.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    });

    res.download(filePath, `certificat-examen-${score.id}.pdf`, (err) => {
      supprimerFichier(filePath);
      if (err && !res.headersSent) {
        res.status(500).json({ error: "Erreur lors du téléchargement du certificat." });
      }
    });
  } catch (err) {
    console.error("Erreur certificat examen :", err.message);
    if (filePath) supprimerFichier(filePath);
    res.status(500).json({ error: "Erreur lors de la génération du certificat." });
  }
};
