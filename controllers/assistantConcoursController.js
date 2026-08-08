// ============================================================
//  controllers/assistantConcoursController.js
//  Lot 10 — Assistant IA généraliste concours (Q&A).
// ============================================================

const { repondreAssistantConcours } = require("../services/assistantConcoursClaude");
const Concours = require("../models/Concours");

// ════════════════════════════════════════════════════════════
//  POST /api/assistant-concours — Poser une question
// ════════════════════════════════════════════════════════════
exports.demander = async (req, res) => {
  try {
    const { message, historique, concoursId } = req.body;

    if (!message || message.trim().length < 2) {
      return res.status(400).json({ error: "Le message est requis." });
    }

    let contexteConcours = null;
    if (concoursId) {
      contexteConcours = await Concours.findById(concoursId).catch(() => null);
    }

    const reponse = await repondreAssistantConcours(message, historique || [], contexteConcours);
    res.json(reponse);
  } catch (err) {
    console.error("Erreur assistant IA concours :", err.message);
    if (err.message.includes("API")) {
      return res.status(503).json({ error: "Service IA temporairement indisponible. Réessaie dans quelques instants." });
    }
    res.status(500).json({ error: "Erreur lors de la réponse de l'assistant." });
  }
};
