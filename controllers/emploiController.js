// ============================================================
//  controllers/emploiController.js
//  Gère : liste, détail, candidature, alertes, CRUD (admin)
//  des offres d'emploi/stages/freelance.
// ============================================================

const Emploi = require("../models/Emploi");
const { extraireDateLimite } = require("../utils/dateLimite");

// ════════════════════════════════════════════════════════════
//  GET /api/emploi — Liste des offres avec filtres (public)
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
try {
const {
  typeContrat, typeOpportunite, ville, region, secteur, niveauEtudes,
  experience, source, recherche, tri, inclureExpirees, limit, offset,
} = req.query;

const filtres = {
  typeContrat, typeOpportunite, ville, region, secteur, niveauEtudes,
  experience, source, search: recherche, tri, inclureExpirees,
};
const limitApplique  = parseInt(limit)  || 50; // avant : 20 — relevé pour ne pas tronquer des listes plus fournies
const offsetApplique = parseInt(offset) || 0;

const [offres, total] = await Promise.all([
  Emploi.findAll({ ...filtres, limit: limitApplique, offset: offsetApplique }),
  Emploi.countAvecFiltres(filtres), // vrai total correspondant aux filtres, indépendant de la pagination
]);

res.json({
  total,                                          // total réel (toutes pages confondues)
  offres,                                          // uniquement les offres de cette page
  hasMore: offsetApplique + offres.length < total, // reste-t-il des offres à charger ?
});

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
  titre, entreprise, typeContrat, typeOpportunite, ville, region, secteur,
  description, profilRecherche, salaire, experience, niveauEtudes, dateLimite,
  emailContact, lienExterne, statut, imageUrl, identifiantExterne,
  sourceNom, sourceUrl,
} = req.body;

if (!titre || !entreprise || !typeContrat || !description) {
  return res.status(400).json({
    error: "Titre, entreprise, type de contrat et description sont requis."
  });
}

// La date limite saisie par l'admin est du texte libre ("30/09/2026",
// "avant fin septembre"...) : on tente de la convertir en vraie DATE
// SQL pour que le calcul automatique d'expiration fonctionne aussi sur
// les offres saisies manuellement, sans jamais bloquer la saisie si le
// texte n'est pas reconnu (date_limite_date reste alors null — l'offre
// n'est simplement pas auto-expirée, voir models/Emploi.js).
const dateLimiteDate = dateLimite ? extraireDateLimite(dateLimite) : null;

const offre = await Emploi.create({
  titre, entreprise, typeContrat, typeOpportunite, ville, region, secteur,
  description, profilRecherche, salaire, experience, niveauEtudes,
  dateLimite, dateLimiteDate, emailContact, lienExterne, statut, imageUrl,
  identifiantExterne, sourceNom, sourceUrl,
});

res.status(201).json({ message: "Offre créée avec succès.", offre });
} catch (err) {
console.error("Erreur création offre :", err.message);
res.status(500).json({ error: "Erreur lors de la création de l'offre." });
}
};

exports.modifier = async (req, res) => {
try {
const champs = { ...req.body };
if (champs.dateLimite) {
  champs.dateLimiteDate = extraireDateLimite(champs.dateLimite);
}
const offre = await Emploi.update(req.params.id, champs);
if (!offre) {
  return res.status(404).json({ error: "Offre introuvable." });
}
res.json({ message: "Offre modifiée avec succès.", offre });
} catch (err) {
console.error("Erreur modification offre :", err.message);
res.status(500).json({ error: "Erreur lors de la modification." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/emploi/sources — Sources déjà agrégées (public, pour
//  alimenter le filtre "Source" de la page Emploi)
// ════════════════════════════════════════════════════════════
exports.sources = async (req, res) => {
try {
const sources = await Emploi.sourcesDisponibles();
res.json({ sources });
} catch (err) {
console.error("Erreur liste sources emploi :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/emploi/stats — Tableau de bord de l'agrégation (admin)
// ════════════════════════════════════════════════════════════
exports.stats = async (req, res) => {
try {
const stats = await Emploi.getStats();
res.json(stats);
} catch (err) {
console.error("Erreur stats emploi :", err.message);
res.status(500).json({ error: "Erreur serveur." });
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

// ════════════════════════════════════════════════════════════
//  POST /api/emploi/actualiser — Déclenche l'agrégation externe (admin)
// ════════════════════════════════════════════════════════════
exports.actualiser = async (req, res) => {
try {
const { synchroniser } = require("../services/emploiFeed");
const nombre = await synchroniser();
res.json({
  message: nombre > 0
    ? `${nombre} nouvelle(s) offre(s) agrégée(s).`
    : "Synchronisation effectuée, aucune nouvelle offre.",
  nombre,
});
} catch (err) {
console.error("Erreur actualisation offres emploi :", err.message);
res.status(500).json({ error: "Erreur lors de l'actualisation des offres." });
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
