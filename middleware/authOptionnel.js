// ============================================================
//  middleware/authOptionnel.js
//  Comme middleware/auth.js, mais ne bloque JAMAIS la requête.
//  Si un token valide est présent, attache req.user (rôle et Premium
//  relus en base). Sinon, laisse passer avec req.user = null.
//  Usage : router.get("/search", authOptionnel, controller)
// ============================================================

const jwt = require("jsonwebtoken");
const sessions = require("../services/sessionUtilisateur");

const authOptionnel = async (req, res, next) => {
  req.user = null;
  try {
    const entete = req.headers.authorization;
    if (entete && entete.startsWith("Bearer ")) {
      const decoded = jwt.verify(entete.split(" ")[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
      if (!decoded.purpose) req.user = await sessions.verifier(decoded);
    }
  } catch {
    req.user = null; // token invalide, expiré ou base indisponible → traité comme non connecté
  }
  next();
};

module.exports = authOptionnel;
