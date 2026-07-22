// ============================================================
//  routes/documents.js
//  Préfixe : /api/documents
//  Documents professionnels : Business Plan, Devis, Facture,
//  Rapport, Contrat, Présentation.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/documentsController");
const auth    = require("../middleware/auth");

// GET  /api/documents/types    — Liste des types disponibles (public)
router.get("/types", ctrl.listerTypes);

// POST /api/documents/generate — Générer un document (connecté requis)
router.post("/generate", auth, ctrl.genererDocument);

// POST /api/documents/pdf      — Exporter en PDF (connecté requis)
router.post("/pdf", auth, ctrl.exportPDF);

// POST /api/documents/docx     — Exporter en Word (connecté requis)
router.post("/docx", auth, ctrl.exportDOCX);

module.exports = router;
