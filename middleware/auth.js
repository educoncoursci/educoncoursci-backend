// ============================================================
//  middleware/auth.js
//  Vérifie le token JWT envoyé dans le header Authorization,
//  puis relit l'état réel du compte (rôle, Premium, compte supprimé,
//  mot de passe changé) via services/sessionUtilisateur.js.
//  Si valide, attache l'utilisateur sur req.user. Sinon : 401.
//  Usage : router.get("/me", auth, controller)
// ============================================================

const jwt = require("jsonwebtoken");
const sessions = require("../services/sessionUtilisateur");

const auth = async (req, res, next) => {
  const entete = req.headers.authorization;
  if (!entete || !entete.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Accès refusé. Aucun token fourni." });
  }

  let decoded;
  try {
    decoded = jwt.verify(entete.split(" ")[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
    }
    return res.status(401).json({ error: "Token invalide." });
  }

  // Le jeton temporaire délivré entre le mot de passe et le code 2FA n'est
  // valable que pour /2fa/verify-login : il ne doit jamais ouvrir une session.
  if (decoded.purpose) return res.status(401).json({ error: "Token invalide." });

  try {
    const utilisateur = await sessions.verifier(decoded);
    if (!utilisateur) return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
    req.user = utilisateur;
    next();
  } catch (err) {
    console.error("Erreur vérification session :", err.message);
    res.status(503).json({ error: "Service temporairement indisponible." });
  }
};

module.exports = auth;
