// ============================================================
//  routes/cv.js
//  Préfixe : /api/cv  et  /api/lm
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/cvController");
const auth    = require("../middleware/auth");
const quotaIA = require("../middleware/quotaIA");
const exigerPremium = require("../middleware/exigerPremium");

// GET /api/cv/modeles  — Liste des modèles de CV disponibles (public)
router.get("/modeles", ctrl.listerModeles);

// POST /api/cv/generate  — Générer un CV (connecté requis)
router.post("/generate", auth, quotaIA("cv"), ctrl.generateCV);

// POST /api/lm/generate  — Générer une LM (connecté requis)
// Note : monté sur /api/cv dans server.js → accessible via /api/cv/lm/generate
router.post("/lm/generate", auth, quotaIA("lm"), ctrl.generateLM);

// POST /api/cv/pdf  — Exporter en PDF (connecté requis ; le contrôleur
// vérifie lui-même si le modèle choisi est premium, cf. cvController.js)
router.post("/pdf", auth, ctrl.exportPDF);

// POST /api/cv/docx  — Exporter en Word (connecté requis ; même contrôle)
router.post("/docx", auth, ctrl.exportDOCX);

// POST /api/cv/analyse-ats  — Score et analyse ATS du CV (Premium)
// Fonctionnalité à forte valeur ajoutée réservée aux abonnés : avant ce
// correctif, elle était accessible en illimité à tous les comptes
// gratuits, sans aucune restriction.
router.post("/analyse-ats", auth, exigerPremium, ctrl.analyserATS);

// POST /api/cv/adapter-offre  — Adapte un CV existant à une offre d'emploi (Premium)
// Même correctif : fonctionnalité premium explicitement demandée par
// l'utilisateur, auparavant totalement gratuite et illimitée.
router.post("/adapter-offre", auth, exigerPremium, ctrl.adapterOffre);

// POST /api/cv/conseil  — Conseil de révision IA (connecté requis, reste
// gratuit : correspond aux "conseils simples" de l'offre gratuite)
router.post("/conseil", auth, ctrl.conseilRevision);

module.exports = router;