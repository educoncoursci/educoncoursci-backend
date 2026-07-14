// ============================================================
//  routes/auth.js
//  Routes d’authentification montées sur /api/auth
// ============================================================

const express    = require(“express”);
const router     = express.Router();
const { auth }   = require(”../middleware/auth”);
const {
register,
login,
me,
logout,
changePassword,
} = require(”../controllers/authController”);

// POST /api/auth/register  ← Inscription
router.post(”/register”, register);

// POST /api/auth/login     ← Connexion
router.post(”/login”, login);

// POST /api/auth/logout    ← Déconnexion
router.post(”/logout”, logout);

// GET  /api/auth/me        ← Profil de l’utilisateur connecté
router.get(”/me”, auth, me);

// POST /api/auth/change-password ← Changer le mot de passe
router.post(”/change-password”, auth, changePassword);

module.exports = router;