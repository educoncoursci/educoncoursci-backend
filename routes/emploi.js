// ============================================================
//  routes/emploi.js
//  Préfixe : /api/emploi
//  Offres d'emploi, candidatures et alertes.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/emploiController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

// ── Routes spécifiques (AVANT /:id, sinon Express les confond) ──
// GET  /api/emploi/mes-candidatures — Mes candidatures (connecté)
router.get("/mes-candidatures", auth, ctrl.mesCandidatures);

// Alertes emploi (connecté)
router.post("/alertes",          auth, ctrl.creerAlerte);
router.get("/alertes",           auth, ctrl.mesAlertes);
router.delete("/alertes/:id",    auth, ctrl.supprimerAlerte);

// ── Routes publiques ──────────────────────────────────────────
// GET  /api/emploi — Liste des offres avec filtres
router.get("/", ctrl.liste);

// GET  /api/emploi/:id — Détail d'une offre
router.get("/:id", ctrl.detail);

// POST /api/emploi/:id/postuler — Postuler (connecté)
router.post("/:id/postuler", auth, ctrl.postuler);

// ── Routes admin ──────────────────────────────────────────────
router.post("/",   auth, admin, ctrl.creer);
router.put("/:id", auth, admin, ctrl.modifier);
router.delete("/:id", auth, admin, ctrl.supprimer);
router.get("/:id/candidatures", auth, admin, ctrl.candidaturesRecues);

module.exports = router;
