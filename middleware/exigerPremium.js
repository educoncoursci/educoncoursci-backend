// ============================================================
//  middleware/exigerPremium.js
//  Réserve une route aux comptes Premium actifs (admins compris).
//  Contrairement à quotaIA (qui laisse un quota gratuit quotidien),
//  celui-ci bloque intégralement l'accès aux non-Premium — pour les
//  fonctionnalités à forte valeur ajoutée (analyse ATS, adaptation
//  d'une offre, modèles de CV premium...) qui doivent rester des
//  arguments d'abonnement, pas juste être rate-limitées.
//  Usage : router.post("/analyse-ats", auth, exigerPremium, ctrl.analyserATS)
// ============================================================

const User = require("../models/User");

async function exigerPremium(req, res, next) {
  try {
    if (!req.user) return next(); // sécurité : le middleware auth doit passer avant

    if (req.user.role === "admin") return next();

    const estPremiumActif = await User.estPremiumActif(req.user.id);

    if (estPremiumActif) return next();

    return res.status(403).json({
      error: "Cette fonctionnalité est réservée aux comptes Premium.",
      premiumRequis: true,
    });
  } catch (err) {
    console.error("Erreur exigerPremium :", err.message);
    // Fonctionnalité premium payante : en cas de doute technique sur le
    // statut, on bloque par prudence plutôt que de laisser passer un
    // accès qui devrait être payant (comportement inverse de quotaIA,
    // volontairement, puisqu'ici l'enjeu est la monétisation et pas
    // seulement la protection contre l'abus).
    return res.status(503).json({ error: "Impossible de vérifier ton statut Premium pour le moment. Réessaie dans un instant." });
  }
}

module.exports = exigerPremium;
