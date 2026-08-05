// ============================================================
//  routes/assistantConcours.js
//  Préfixe : /api/assistant-concours
//  Lot 10 — Assistant IA généraliste concours (connecté requis,
//  quota IA quotidien pour les non-Premium comme les autres
//  fonctionnalités IA de la plateforme).
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/assistantConcoursController");
const auth    = require("../middleware/auth");
const quotaIA = require("../middleware/quotaIA");

router.post("/", auth, quotaIA("assistant-concours"), ctrl.demander);

module.exports = router;
