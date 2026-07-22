// ============================================================
//  routes/cv.js
//  Préfixe : /api/cv  et  /api/lm
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/cvController");
const auth    = require("../middleware/auth");

// GET /api/cv/modeles  — Liste des modèles de CV disponibles (public)
router.get("/modeles", ctrl.listerModeles);

// POST /api/cv/generate  — Générer un CV (connecté requis)
router.post("/generate", auth, ctrl.generateCV);

// POST /api/lm/generate  — Générer une LM (connecté requis)
// Note : monté sur /api/cv dans server.js → accessible via /api/cv/lm/generate
router.post("/lm/generate", auth, ctrl.generateLM);

// POST /api/cv/pdf  — Exporter en PDF (connecté requis)
router.post("/pdf", auth, ctrl.exportPDF);

// POST /api/cv/docx  — Exporter en Word (connecté requis)
router.post("/docx", auth, ctrl.exportDOCX);

// POST /api/cv/analyse-ats  — Score et analyse ATS du CV (connecté requis)
router.post("/analyse-ats", auth, ctrl.analyserATS);

// POST /api/cv/adapter-offre  — Adapte un CV existant à une offre d'emploi (connecté requis)
router.post("/adapter-offre", auth, ctrl.adapterOffre);

// POST /api/cv/conseil  — Conseil de révision IA (connecté requis)
router.post("/conseil", auth, ctrl.conseilRevision);

module.exports = router;