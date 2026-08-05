// ============================================================
//  routes/progression.js
//  Préfixe : /api/progression
//  Module 7 — Suivi de progression du candidat (connecté requis).
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/progressionController");
const auth    = require("../middleware/auth");

router.get("/", auth, ctrl.monTableauDeBord); // GET /api/progression
router.get("/classement", ctrl.classement);   // GET /api/progression/classement (public)
router.get("/certificat/badge/:badgeId", auth, ctrl.certificatBadge);   // GET /api/progression/certificat/badge/:badgeId
router.get("/certificat/examen/:scoreId", auth, ctrl.certificatExamen); // GET /api/progression/certificat/examen/:scoreId

module.exports = router;
