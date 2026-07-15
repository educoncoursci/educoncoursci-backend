// ============================================================
//  routes/concours.js
//  Préfixe : /api/concours
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/concoursController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

// Routes publiques (lecture)
router.get("/",         ctrl.liste);   // GET /api/concours
router.get("/ouverts",  ctrl.ouverts); // GET /api/concours/ouverts
router.get("/:id",      ctrl.detail);  // GET /api/concours/:id

// Routes protégées admin (écriture)
router.post(  "/",    auth, admin, ctrl.creer);      // POST   /api/concours
router.patch( "/:id", auth, admin, ctrl.modifier);   // PATCH  /api/concours/:id
router.delete("/:id", auth, admin, ctrl.supprimer);  // DELETE /api/concours/:id

module.exports = router;