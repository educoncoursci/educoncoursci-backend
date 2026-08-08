// ============================================================
//  controllers/alertePreferenceController.js
//  Module 4 — Préférences d'alertes (canaux + catégories).
// ============================================================

const AlertePreference = require("../models/AlertePreference");

exports.mesPreferences = async (req, res) => {
  try {
    const prefs = await AlertePreference.findByUser(req.user.id);
    res.json({ preferences: prefs });
  } catch (err) {
    console.error("Erreur lecture préférences alertes :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.definirPreferences = async (req, res) => {
  try {
    const { canalEmail, canalWhatsapp, whatsappNumero, canalSms, smsNumero, canalPush, categories } = req.body;

    if (canalWhatsapp && !whatsappNumero) {
      return res.status(400).json({
        error: "Un numéro WhatsApp est requis pour activer ce canal.",
      });
    }
    if (canalSms && !smsNumero) {
      return res.status(400).json({
        error: "Un numéro de téléphone est requis pour activer les alertes SMS.",
      });
    }

    const prefs = await AlertePreference.upsert(req.user.id, {
      canalEmail,
      canalWhatsapp,
      whatsappNumero,
      canalSms,
      smsNumero,
      canalPush,
      categories,
    });

    res.json({ message: "Préférences enregistrées.", preferences: prefs });
  } catch (err) {
    console.error("Erreur enregistrement préférences alertes :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
