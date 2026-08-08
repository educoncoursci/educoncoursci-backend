// ============================================================
//  controllers/candidatureConcoursController.js
//  Lot 8 — Suivi de candidature aux concours (workflow personnel).
// ============================================================

const CandidatureConcours = require("../models/CandidatureConcours");
const Concours = require("../models/Concours");

// ════════════════════════════════════════════════════════════
//  GET /api/candidatures-concours — Mes suivis
// ════════════════════════════════════════════════════════════
exports.mesCandidatures = async (req, res) => {
  try {
    const candidatures = await CandidatureConcours.findByUser(req.user.id);
    res.json({ total: candidatures.length, candidatures });
  } catch (err) {
    console.error("Erreur liste candidatures concours :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération de tes suivis." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/candidatures-concours — Démarrer un suivi
// ════════════════════════════════════════════════════════════
exports.demarrer = async (req, res) => {
  try {
    const { concoursId } = req.body;
    if (!concoursId) {
      return res.status(400).json({ error: "concoursId est requis." });
    }
    const concours = await Concours.findById(concoursId);
    if (!concours) {
      return res.status(404).json({ error: "Concours introuvable." });
    }
    const candidature = await CandidatureConcours.demarrer(req.user.id, concoursId);
    res.status(201).json({ message: "Suivi démarré.", candidature });
  } catch (err) {
    console.error("Erreur démarrage candidature concours :", err.message);
    res.status(500).json({ error: "Erreur lors du démarrage du suivi." });
  }
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/candidatures-concours/:id — Faire avancer l'étape
// ════════════════════════════════════════════════════════════
exports.avancer = async (req, res) => {
  try {
    const { statut, notes } = req.body;
    if (statut && !CandidatureConcours.ETAPES.includes(statut) && statut !== "non_admis") {
      return res.status(400).json({ error: "Étape inconnue." });
    }
    const candidature = await CandidatureConcours.avancer(req.params.id, req.user.id, statut, notes);
    if (!candidature) {
      return res.status(404).json({ error: "Suivi introuvable." });
    }
    res.json({ message: "Suivi mis à jour.", candidature });
  } catch (err) {
    console.error("Erreur mise à jour candidature concours :", err.message);
    res.status(500).json({ error: "Erreur lors de la mise à jour du suivi." });
  }
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/candidatures-concours/:id — Abandonner le suivi
// ════════════════════════════════════════════════════════════
exports.supprimer = async (req, res) => {
  try {
    await CandidatureConcours.supprimer(req.params.id, req.user.id);
    res.json({ message: "Suivi supprimé." });
  } catch (err) {
    console.error("Erreur suppression candidature concours :", err.message);
    res.status(500).json({ error: "Erreur lors de la suppression du suivi." });
  }
};
