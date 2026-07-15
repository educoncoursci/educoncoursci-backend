// ============================================================
//  middleware/auth.js
//  Vérifie le token JWT envoyé dans le header Authorization.
//  Si valide, attache l'utilisateur décodé sur req.user et
//  laisse passer la requête. Sinon, renvoie une erreur 401.
//  Usage : router.get("/me", auth, controller)
// ============================================================

const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
try {
const entete = req.headers.authorization;

if (!entete || !entete.startsWith("Bearer ")) {
  return res.status(401).json({
    error: "Accès refusé. Aucun token fourni."
  });
}

const token = entete.split(" ")[1];

const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded;

next();

} catch (err) {
if (err.name === "TokenExpiredError") {
  return res.status(401).json({ error: "Session expirée. Reconnecte-toi." });
}
return res.status(401).json({ error: "Token invalide." });
}
};

module.exports = auth;
