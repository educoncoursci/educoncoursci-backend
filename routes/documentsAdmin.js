// ============================================================
//  routes/documentsAdmin.js
//  Préfixe : /api/documents-admin
//  Documents administratifs : Demande, Attestation, Courrier,
//  Compte rendu, Procès-verbal.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/documentsAdminController");
const auth    = require("../middleware/auth");

// GET  /api/documents-admin/types    — Liste des types disponibles (public)
router.get("/types", ctrl.listerTypes);

// POST /api/documents-admin/generate — Générer un document (connecté requis)
router.post("/generate", auth, ctrl.genererDocument);

// POST /api/documents-admin/pdf      — Exporter en PDF (connecté requis)
router.post("/pdf", auth, ctrl.exportPDF);

// POST /api/documents-admin/docx     — Exporter en Word (connecté requis)
router.post("/docx", auth, ctrl.exportDOCX);

module.exports = router;
