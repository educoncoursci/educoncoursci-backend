// ============================================================
//  routes/eligibilite.js
//  Préfixe : /api/eligibilite
//  Public — pas besoin de compte pour vérifier son éligibilité.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/eligibiliteController");

router.post("/", ctrl.verifier); // POST /api/eligibilite

module.exports = router;
