// ============================================================
//  routes/suiviCandidatures.js
//  Préfixe : /api/suivi-candidatures — suivi personnel (connecté requis).
// ============================================================
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/suiviCandidatureController");
const auth    = require("../middleware/auth");

router.get("/",       auth, ctrl.lister);
router.post("/",      auth, ctrl.creer);
router.patch("/:id",  auth, ctrl.modifier);
router.delete("/:id", auth, ctrl.supprimer);

module.exports = router;
