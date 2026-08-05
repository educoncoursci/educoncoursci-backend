// ============================================================
//  routes/vitrine.js
//  Préfixe : /api/vitrine
//  Lot 2 — Contenu de la page d'accueil.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/vitrineController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

// Public
router.get("/stats",        ctrl.statsPubliques);       // GET  /api/vitrine/stats
router.post("/newsletter",  ctrl.inscrireNewsletter);    // POST /api/vitrine/newsletter
router.get("/temoignages",  ctrl.temoignagesPublics);    // GET  /api/vitrine/temoignages

// Admin
router.get("/newsletter/abonnes", auth, admin, ctrl.listerNewsletter);      // GET /api/vitrine/newsletter/abonnes
router.get("/temoignages/tous",   auth, admin, ctrl.listerTemoignagesAdmin); // GET /api/vitrine/temoignages/tous
router.post("/temoignages",       auth, admin, ctrl.creerTemoignage);        // POST /api/vitrine/temoignages
router.patch("/temoignages/:id",  auth, admin, ctrl.modifierTemoignage);     // PATCH /api/vitrine/temoignages/:id
router.delete("/temoignages/:id", auth, admin, ctrl.supprimerTemoignage);    // DELETE /api/vitrine/temoignages/:id

module.exports = router;
