// ============================================================
//  controllers/pushController.js
//  Lot 11 — Abonnements aux notifications Push Web (navigateur).
// ============================================================

const { enregistrerAbonnement, supprimerAbonnement, PUBLIC_KEY, API_CONFIGUREE } = require("../services/push");

// ════════════════════════════════════════════════════════════
//  GET /api/push/vapid-key — Clé publique VAPID (public)
// ════════════════════════════════════════════════════════════
exports.vapidKey = (req, res) => {
  if (!API_CONFIGUREE) {
    return res.status(503).json({ error: "Les notifications push ne sont pas encore configurées sur ce serveur." });
  }
  res.json({ publicKey: PUBLIC_KEY });
};

// ════════════════════════════════════════════════════════════
//  POST /api/push/subscribe — Enregistrer un abonnement (connecté requis)
// ════════════════════════════════════════════════════════════
exports.subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Abonnement push invalide." });
    }
    await enregistrerAbonnement(req.user.id, subscription);
    res.status(201).json({ message: "Notifications push activées." });
  } catch (err) {
    console.error("Erreur abonnement push :", err.message);
    res.status(500).json({ error: "Erreur lors de l'activation des notifications push." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/push/unsubscribe — Retirer un abonnement (connecté requis)
// ════════════════════════════════════════════════════════════
exports.unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: "endpoint est requis." });
    }
    await supprimerAbonnement(endpoint);
    res.json({ message: "Notifications push désactivées." });
  } catch (err) {
    console.error("Erreur désabonnement push :", err.message);
    res.status(500).json({ error: "Erreur lors de la désactivation des notifications push." });
  }
};
