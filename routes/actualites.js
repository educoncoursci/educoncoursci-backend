// ============================================================
//  routes/actualites.js
//  Préfixe : /api/actualites
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/actualiteController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

// Lecture publique
router.get("/carrousel", ctrl.carrousel); // GET /api/actualites/carrousel
router.get("/",          ctrl.liste);     // GET /api/actualites

// Écriture / gestion admin
router.post(  "/actualiser", auth, admin, ctrl.actualiser); // POST /api/actualites/actualiser
router.post(  "/",           auth, admin, ctrl.creer);
router.patch( "/:id",        auth, admin, ctrl.modifier);
router.delete("/:id",        auth, admin, ctrl.supprimer);

module.exports = router;
