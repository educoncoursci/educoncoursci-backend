// ============================================================
//  routes/qcmIA.js — Générateur de QCM par IA (admin uniquement)
//  Monté sur /api/qcm-ia (voir server.js)
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/qcmIAController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

router.use(auth, admin);

router.post("/generer",      ctrl.generer);      // POST /api/qcm-ia/generer
router.get( "/brouillons",   ctrl.brouillons);   // GET  /api/qcm-ia/brouillons
router.get( "/:id",          ctrl.detail);       // GET  /api/qcm-ia/:id
router.put( "/:id",          ctrl.sauvegarder);  // PUT  /api/qcm-ia/:id
router.post("/:id/publier",  ctrl.publier);      // POST /api/qcm-ia/:id/publier

module.exports = router;
