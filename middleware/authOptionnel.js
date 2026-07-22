// ============================================================
//  middleware/authOptionnel.js
//  Comme middleware/auth.js, mais ne bloque JAMAIS la requête.
//  Si un token valide est présent, attache req.user. Sinon,
//  laisse passer avec req.user = null (accès public).
//  Usage : router.get("/search", authOptionnel, controller)
// ============================================================

const jwt = require("jsonwebtoken");

const authOptionnel = (req, res, next) => {
  try {
    const entete = req.headers.authorization;

    if (!entete || !entete.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = entete.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    req.user = null; // token invalide ou expiré → traité comme non connecté, sans bloquer
  }
  next();
};

module.exports = authOptionnel;
