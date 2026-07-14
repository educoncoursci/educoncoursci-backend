// ============================================================
//  routes/admin.js
//  Toutes les routes admin + notifications
//  Préfixe : /api/admin  et  /api/notifs
// ============================================================

const express = require(“express”);
const router  = express.Router();
const admin   = require(”../controllers/adminController”);
const notifs  = require(”../controllers/notifController”);
const auth    = require(”../middleware/auth”);
const isAdmin = require(”../middleware/admin”);

// Toutes les routes de ce fichier nécessitent
// d’être connecté ET d’être admin
router.use(auth, isAdmin);

// ── Statistiques ─────────────────────────────────────────────
router.get(”/stats”,    admin.stats);      // GET /api/admin/stats

// ── Utilisateurs ─────────────────────────────────────────────
router.get(”/users”,         admin.getUsers);    // GET /api/admin/users
router.get(”/abonnes”,       admin.getAbonnes);  // GET /api/admin/abonnes
router.patch(”/users/:id”,   admin.updateUser);  // PATCH /api/admin/users/:id
router.delete(”/users/:id”,  admin.deleteUser);  // DELETE /api/admin/users/:id

// ── Scores & classements ──────────────────────────────────────
router.get(”/scores”, admin.getScores); // GET /api/admin/scores

// ── Export CSV ───────────────────────────────────────────────
router.get(”/export/users”, admin.exportUsers); // GET /api/admin/export/users

// ── Notifications ─────────────────────────────────────────────
router.post(”/notifs/send”,            notifs.envoyer);         // POST /api/admin/notifs/send
router.post(”/notifs/alerte-concours”, notifs.alerteConcours);  // POST /api/admin/notifs/alerte-concours
router.post(”/notifs/rappels”,         notifs.envoyerRappels);  // POST /api/admin/notifs/rappels
router.get( “/notifs/history”,         notifs.historique);      // GET  /api/admin/notifs/history

module.exports = router;