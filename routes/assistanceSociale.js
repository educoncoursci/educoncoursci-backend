// ============================================================
//  routes/assistanceSociale.js
//  Préfixe : /api/assistance-sociale
//  Annuaire, urgences, documents sociaux, assistant IA.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/assistanceSocialeController");
const auth    = require("../middleware/auth");
const authOptionnel = require("../middleware/authOptionnel");

// ── Public ────────────────────────────────────────────────────
router.get("/urgences",   ctrl.urgences);
router.get("/structures", ctrl.structures);
router.get("/documents/types", ctrl.listerTypes);

// ── Connecté requis ───────────────────────────────────────────
router.post("/documents/generate", auth, ctrl.genererDocument);
router.post("/documents/pdf",      auth, ctrl.exportPDF);
router.post("/documents/docx",     auth, ctrl.exportDOCX);

// ── Assistant IA (auth optionnelle — accessible même sans compte,
//    car une personne en détresse ne doit jamais être bloquée par
//    une exigence de connexion) ──────────────────────────────────
router.post("/assistant", authOptionnel, ctrl.assistant);

module.exports = router;
