// ============================================================
//  routes/candidaturesConcours.js
//  Préfixe : /api/candidatures-concours
//  Lot 8 — Suivi de candidature aux concours (connecté requis).
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/candidatureConcoursController");
const auth    = require("../middleware/auth");

router.get("/",     auth, ctrl.mesCandidatures); // GET    /api/candidatures-concours
router.post("/",    auth, ctrl.demarrer);        // POST   /api/candidatures-concours
router.patch("/:id", auth, ctrl.avancer);        // PATCH  /api/candidatures-concours/:id
router.delete("/:id", auth, ctrl.supprimer);     // DELETE /api/candidatures-concours/:id

module.exports = router;
