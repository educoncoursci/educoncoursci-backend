// ============================================================
//  routes/alertes.js
//  Préfixe : /api/alertes
//  Préférences d'alertes personnelles (Module 4).
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/alertePreferenceController");
const auth    = require("../middleware/auth");

router.get("/preferences",   auth, ctrl.mesPreferences);      // GET /api/alertes/preferences
router.put("/preferences",   auth, ctrl.definirPreferences);  // PUT /api/alertes/preferences

module.exports = router;
