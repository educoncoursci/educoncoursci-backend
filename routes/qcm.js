// ============================================================
//  routes/qcm.js
//  Préfixe : /api/qcm
// ============================================================

const express = require(“express”);
const router  = express.Router();
const ctrl    = require(”../controllers/qcmController”);
const auth    = require(”../middleware/auth”);
const admin   = require(”../middleware/admin”);

// Lecture publique (questions sans réponses)
router.get(”/”,    ctrl.liste);   // GET /api/qcm
router.get(”/:id”, ctrl.detail);  // GET /api/qcm/:id

// Soumission des réponses (connecté requis pour enregistrer le score)
router.post(”/:id/score”, ctrl.soumettre); // POST /api/qcm/:id/score

// Écriture admin
router.post(  “/”,    auth, admin, ctrl.creer);     // POST   /api/qcm
router.patch( “/:id”, auth, admin, ctrl.modifier);  // PATCH  /api/qcm/:id
router.delete(”/:id”, auth, admin, ctrl.supprimer); // DELETE /api/qcm/:id

module.exports = router;