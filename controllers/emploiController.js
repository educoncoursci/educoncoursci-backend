// ============================================================
//  controllers/emploiController.js
//  Gère : liste, détail, candidature, alertes, CRUD (admin)
//  des offres d'emploi/stages/freelance.
// ============================================================

const Emploi = require("../models/Emploi");

// ════════════════════════════════════════════════════════════
//  GET /api/emploi — Liste des offres avec filtres (public)
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
try {
const { typeContrat, ville, secteur, recherche, limit, offset } = req.query;

const offres = await Emploi.findAll({
  typeContrat, ville, secteur, search: recherche,
  limit:  parseInt(limit)  || 20,
  offset: parseInt(offset) || 0,
});

res.json({ total: offres.length, offres });

} catch (err) {
console.error("Erreur liste offres emploi :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/emploi/:id — Détail d'une offre (public)
// ════════════════════════════════════════════════════════════
exports.detail = async (req, res) => {
try {
const offre = await Emploi.findById(req.params.id);
if (!offre) {
  return res.status(404).json({ error: "Offre introuvable." });
}
await Emploi.incrementerVues(req.params.id);
res.json({ offre });
} catch (err) {
console.error("Erreur détail offre :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/emploi/:id/postuler — Postuler à une offre (connecté)
// ════════════════════════════════════════════════════════════
exports.postuler = async (req, res) => {
try {
const offre = await Emploi.findById(req.params.id);
if (!offre) {
  return res.status(404).json({ error: "Offre introuvable." });
}
if (offre.statut !== "publié") {
  return res.status(400).json({ error: "Cette offre n'est plus disponible." });
}

const { message, cvSnapshot } = req.body;

const candidature = await Emploi.postuler({
  userId: req.user.id,
  offreId: req.params.id,
  cvSnapshot,
  message,
});

if (!candidature) {
  return res.status(409).json({ error: "Tu as déjà postulé à cette offre." });
}

res.status(201).json({ message: "Candidature envoyée avec succès !", candidature });
} catch (err) {
console.error("Erreur candidature :", err.message);
res.status(500).json({ error: "Erreur lors de l'envoi de la candidature." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/emploi/mes-candidatures — Mes candidatures (connecté)
// ════════════════════════════════════════════════════════════
exports.mesCandidatures = async (req, res) => {
try {
const candidatures = await Emploi.findCandidaturesParUser(req.user.id);
res.json({ total: candidatures.length, candidatures });
} catch (err) {
console.error("Erreur mes candidatures :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  ALERTES EMPLOI (connecté)
// ════════════════════════════════════════════════════════════
exports.creerAlerte = async (req, res) => {
try {
const { motCle, typeContrat, ville } = req.body;

if (!motCle && !typeContrat && !ville) {
  return res.status(400).json({ error: "Précise au moins un critère d'alerte." });
}

const alerte = await Emploi.creerAlerte({ userId: req.user.id, motCle, typeContrat, ville });
res.status(201).json({ message: "Alerte créée avec succès.", alerte });
} catch (err) {
console.error("Erreur création alerte :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

exports.mesAlertes = async (req, res) => {
try {
const alertes = await Emploi.findAlertesParUser(req.user.id);
res.json({ total: alertes.length, alertes });
} catch (err) {
console.error("Erreur liste alertes :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

exports.supprimerAlerte = async (req, res) => {
try {
await Emploi.supprimerAlerte(req.params.id, req.user.id);
res.json({ message: "Alerte supprimée." });
} catch (err) {
console.error("Erreur suppression alerte :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  ADMIN — CRUD des offres
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
try {
const {
  titre, entreprise, typeContrat, ville, secteur, description,
  profilRecherche, salaire, experience, dateLimite,
  emailContact, lienExterne, statut,
} = req.body;

if (!titre || !entreprise || !typeContrat || !description) {
  return res.status(400).json({
    error: "Titre, entreprise, type de contrat et description sont requis."
  });
}

const offre = await Emploi.create({
  titre, entreprise, typeContrat, ville, secteur, description,
  profilRecherche, salaire, experience, dateLimite,
  emailContact, lienExterne, statut,
});

res.status(201).json({ message: "Offre créée avec succès.", offre });
} catch (err) {
console.error("Erreur création offre :", err.message);
res.status(500).json({ error: "Erreur lors de la création de l'offre." });
}
};

exports.modifier = async (req, res) => {
try {
const offre = await Emploi.update(req.params.id, req.body);
if (!offre) {
  return res.status(404).json({ error: "Offre introuvable." });
}
res.json({ message: "Offre modifiée avec succès.", offre });
} catch (err) {
console.error("Erreur modification offre :", err.message);
res.status(500).json({ error: "Erreur lors de la modification." });
}
};

exports.supprimer = async (req, res) => {
try {
await Emploi.delete(req.params.id);
res.json({ message: "Offre supprimée avec succès." });
} catch (err) {
console.error("Erreur suppression offre :", err.message);
res.status(500).json({ error: "Erreur lors de la suppression." });
}
};

exports.candidaturesRecues = async (req, res) => {
try {
const candidatures = await Emploi.findCandidaturesParOffre(req.params.id);
res.json({ total: candidatures.length, candidatures });
} catch (err) {
console.error("Erreur candidatures reçues :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};
