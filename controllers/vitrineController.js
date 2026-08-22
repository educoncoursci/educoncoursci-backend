// ============================================================
//  controllers/vitrineController.js
//  Lot 2 — Contenu de la page d'accueil : statistiques publiques
//  (agrégats non sensibles uniquement — jamais de revenus, emails
//  ou données personnelles), newsletter, témoignages.
// ============================================================

const User      = require("../models/User");
const Concours  = require("../models/Concours");
const QCM       = require("../models/QCM");
const PDF       = require("../models/PDF");
const Newsletter = require("../models/Newsletter");
const Temoignage = require("../models/Temoignage");
const emailService = require("../services/email");

// ── GET /api/vitrine/stats — Statistiques publiques (page d'accueil) ──
exports.statsPubliques = async (req, res) => {
try {
const [totalUtilisateurs, totalConcours, concoursOuverts, totalQCM, totalPDFs] =
  await Promise.all([
    User.count(),
    Concours.count(),
    Concours.countOuverts(),
    QCM.count(),
    PDF.count(),
  ]);

res.json({
  totalUtilisateurs,
  totalConcours,
  concoursOuverts,
  totalQCM,
  totalPDFs,
});

} catch (err) {
console.error("Erreur stats publiques :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ── POST /api/vitrine/newsletter — Inscription newsletter (public) ──
exports.inscrireNewsletter = async (req, res) => {
try {
const { email } = req.body;
if (!email || !/\S+@\S+\.\S+/.test(email)) {
  return res.status(400).json({ error: "Adresse e-mail invalide." });
}

const inscription = await Newsletter.inscrire(email.toLowerCase().trim());
if (!inscription) {
  return res.json({ message: "Tu es déjà inscrit à la newsletter !", dejaInscrit: true });
}

// Non bloquant : une éventuelle erreur d'envoi (Brevo non configurée,
// panne temporaire...) ne doit jamais faire échouer l'inscription
// elle-même — l'adresse est déjà bien enregistrée en base à ce stade.
// Même principe que forgotPassword dans authController.js.
emailService.envoyerConfirmationNewsletter(email.toLowerCase().trim())
  .catch((err) => console.error("Erreur envoi confirmation newsletter :", err.message));

res.status(201).json({ message: "Inscription à la newsletter réussie !" });

} catch (err) {
console.error("Erreur inscription newsletter :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ── GET /api/vitrine/newsletter — Liste des abonnés (admin) ──
exports.listerNewsletter = async (req, res) => {
try {
const [abonnes, total] = await Promise.all([
  Newsletter.findAll(req.query),
  Newsletter.count(),
]);
res.json({ total, abonnes });
} catch (err) {
console.error("Erreur liste newsletter :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ── GET /api/vitrine/temoignages — Témoignages publiés (public) ──
exports.temoignagesPublics = async (req, res) => {
try {
const temoignages = await Temoignage.findPublies();
res.json({ temoignages });
} catch (err) {
console.error("Erreur témoignages publics :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ── Admin : gestion des témoignages ──
exports.listerTemoignagesAdmin = async (req, res) => {
try {
const temoignages = await Temoignage.findAll();
res.json({ temoignages });
} catch (err) {
res.status(500).json({ error: "Erreur serveur." });
}
};

exports.creerTemoignage = async (req, res) => {
try {
const { nom, texte } = req.body;
if (!nom || !texte) {
  return res.status(400).json({ error: "Nom et texte du témoignage requis." });
}
const temoignage = await Temoignage.create(req.body);
res.status(201).json({ temoignage });
} catch (err) {
res.status(500).json({ error: "Erreur serveur." });
}
};

exports.modifierTemoignage = async (req, res) => {
try {
const temoignage = await Temoignage.update(req.params.id, req.body);
if (!temoignage) return res.status(404).json({ error: "Témoignage introuvable." });
res.json({ temoignage });
} catch (err) {
res.status(500).json({ error: "Erreur serveur." });
}
};

exports.supprimerTemoignage = async (req, res) => {
try {
const ok = await Temoignage.supprimer(req.params.id);
if (!ok) return res.status(404).json({ error: "Témoignage introuvable." });
res.json({ message: "Témoignage supprimé." });
} catch (err) {
res.status(500).json({ error: "Erreur serveur." });
}
};
