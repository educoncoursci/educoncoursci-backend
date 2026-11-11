// ============================================================
//  middleware/admin.js
//  Vérifie que l'utilisateur connecté est admin.
//  Doit être utilisé APRÈS le middleware auth.
//  Usage : router.post("/concours", auth, admin, controller)
//
//  Le rôle est revérifié dans la base à chaque appel : si un compte
//  administrateur est supprimé ou rétrogradé, il perd immédiatement
//  l'accès, sans attendre l'expiration de son jeton de connexion.
// ============================================================

const User = require("../models/User");

const admin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Accès refusé. Connecte-toi pour continuer."
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Accès refusé. Droits administrateur requis."
    });
  }

  try {
    const compte = await User.findById(req.user.id);
    if (!compte || compte.role !== "admin") {
      return res.status(403).json({
        error: "Accès refusé. Droits administrateur requis."
      });
    }
  } catch (err) {
    console.error("Erreur vérification admin :", err.message);
    return res.status(500).json({ error: "Erreur serveur." });
  }

  next();
};

module.exports = admin;
