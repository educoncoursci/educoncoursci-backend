// ============================================================
//  middleware/exigerEmailVerifie.js
//  Les paiements exigent une adresse e-mail confirmée (les
//  confirmations et reçus sont envoyés à cette adresse). Les
//  comptes créés avant cette règle sont considérés vérifiés.
// ============================================================
const User = require("../models/User");

module.exports = async function exigerEmailVerifie(req, res, next) {
  try {
    if (!req.user || req.user.role === "admin") return next();
    if (await User.emailVerifie(req.user.id)) return next();
    return res.status(403).json({
      error: "Confirmez d'abord votre adresse e-mail (lien envoyé à l'inscription) avant de payer.",
      emailNonVerifie: true,
    });
  } catch (err) {
    console.error("Erreur exigerEmailVerifie :", err.message);
    return res.status(503).json({ error: "Vérification impossible pour le moment. Réessayez dans un instant." });
  }
};
