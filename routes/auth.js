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
} = require("../controllers/authController");

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

// POST /api/auth/forgot-password ← Demander un lien de réinitialisation
router.post("/forgot-password", forgotPassword);

// POST /api/auth/reset-password  ← Définir un nouveau mot de passe via le lien reçu
router.post("/reset-password", resetPassword);

module.exports = router;