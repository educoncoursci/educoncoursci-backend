// ============================================================
//  middleware/premium.js
//  Revérifie le statut Premium DIRECTEMENT EN BASE plutôt que de
//  faire confiance à req.user.premium (qui vient du token JWT,
//  valable 7 jours — un compte peut avoir payé "1 Mois" et donc
//  voir son Premium expirer en base bien avant que son token
//  n'expire lui-même).
//
//  Le nettoyage automatique (services/transactionsScheduler.js,
//  toutes les heures) désactive déjà premium=false en base à
//  l'échéance réelle, mais entre deux exécutions, ou si le cron
//  échoue une fois, un token existant garderait quand même
//  premium=true en mémoire. Pour un contrôle d'accès réellement
//  fiable sur du contenu payant, ce middleware referme cette
//  fenêtre en relisant l'état réel à chaque requête protégée.
//
//  Usage : router.get("/pdfs/:id/telecharger", auth, premium, controller)
//  (à utiliser après auth, sur les endpoints qui donnent
//  effectivement accès à du contenu/une action premium — pas besoin
//  de l'ajouter partout où req.user.premium n'est utilisé que pour
//  du filtrage d'affichage non sensible.)
// ============================================================

const User = require("../models/User");

const premium = async (req, res, next) => {
try {
if (!req.user) {
  return res.status(401).json({ error: "Accès refusé. Connecte-toi pour continuer." });
}

// Un admin garde toujours accès, comme le reste du code existant
// (pdfController, videoController...) le prévoit déjà.
if (req.user.role === "admin") return next();

const user = await User.findById(req.user.id);
if (!user) {
  return res.status(401).json({ error: "Compte introuvable." });
}

const expirePassee = user.premium_expire && new Date(user.premium_expire) < new Date();
const estReellementPremium = user.premium === true && !expirePassee;

if (!estReellementPremium) {
  return res.status(403).json({
    error: "Cette fonctionnalité nécessite un abonnement Premium actif.",
    premiumExpire: expirePassee ? user.premium_expire : null,
  });
}

next();

} catch (err) {
console.error("Erreur vérification Premium :", err.message);
res.status(500).json({ error: "Erreur lors de la vérification de l'abonnement." });
}
};

module.exports = premium;
