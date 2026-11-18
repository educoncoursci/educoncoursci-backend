// ============================================================
//  routes/auth.js
//  Routes d'authentification montées sur /api/auth
// ============================================================

const express    = require("express");
const router     = express.Router();
const auth       = require("../middleware/auth");
const {
register,
login,
me,
logout,
changePassword,
forgotPassword,
resetPassword,
verifyEmail,
resendVerification,
logoutAll,
supprimerMonCompte,
} = require("../controllers/authController");
const deuxFA = require("../controllers/twoFactorController");

// POST /api/auth/register  ← Inscription
router.post("/register", register);

// POST /api/auth/login     ← Connexion
router.post("/login", login);

// POST /api/auth/logout    ← Déconnexion
router.post("/logout", logout);

// GET  /api/auth/me        ← Profil de l'utilisateur connecté
router.get("/me", auth, me);

// POST /api/auth/change-password ← Changer le mot de passe (connecté)
router.post("/change-password", auth, changePassword);

// POST /api/auth/logout-all ← Déconnecter tous les appareils (connecté)
router.post("/logout-all", auth, logoutAll);

// DELETE /api/auth/account ← Supprimer son compte (mot de passe exigé)
router.delete("/account", auth, supprimerMonCompte);

// POST /api/auth/forgot-password ← Demander un lien de réinitialisation
router.post("/forgot-password", forgotPassword);

// POST /api/auth/verify-email ← Confirmer l'adresse e-mail (lien reçu)
router.post("/verify-email", verifyEmail);

// POST /api/auth/resend-verification ← Renvoyer le lien (connecté)
router.post("/resend-verification", auth, resendVerification);

// POST /api/auth/reset-password  ← Définir un nouveau mot de passe via le lien reçu
router.post("/reset-password", resetPassword);

// ── 2FA (Lot 16) ──────────────────────────────────────────────
router.post("/2fa/setup",        auth, deuxFA.setup);         // POST /api/auth/2fa/setup
router.post("/2fa/confirm",      auth, deuxFA.confirmer);     // POST /api/auth/2fa/confirm
router.post("/2fa/disable",      auth, deuxFA.desactiver);    // POST /api/auth/2fa/disable
router.post("/2fa/verify-login", deuxFA.verifierLogin);       // POST /api/auth/2fa/verify-login (public — protégé par tempToken)

module.exports = router;