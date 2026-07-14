// ============================================================
//  routes/cv.js
//  Préfixe : /api/cv  et  /api/lm
// ============================================================

const express = require(“express”);
const router  = express.Router();
const ctrl    = require(”../controllers/cvController”);
const auth    = require(”../middleware/auth”);

// POST /api/cv/generate  — Générer un CV (connecté requis)
router.post(”/generate”, auth, ctrl.generateCV);

// POST /api/lm/generate  — Générer une LM (connecté requis)
// Note : monté sur /api/cv dans server.js → accessible via /api/cv/lm/generate
router.post(”/lm/generate”, auth, ctrl.generateLM);

// POST /api/cv/pdf  — Exporter en PDF (connecté requis)
router.post(”/pdf”, auth, ctrl.exportPDF);

// POST /api/cv/conseil  — Conseil de révision IA (connecté requis)
router.post(”/conseil”, auth, ctrl.conseilRevision);

module.exports = router;