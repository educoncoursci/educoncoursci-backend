// ============================================================
//  routes/referentiels.js
//  Préfixe : /api/referentiels
//  Structures, matières, diplômes — fondations du Module 1
//  (utilisées par les fiches concours enrichies et le futur
//  moteur d'éligibilité).
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/referentielsController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

// ── Public : lecture seule ──────────────────────────────────
router.get("/structures", ctrl.listerStructures);
router.get("/matieres",   ctrl.listerMatieres);
router.get("/diplomes",   ctrl.listerDiplomes);
router.get("/categories", ctrl.listerCategories);

// ── Admin : gestion ──────────────────────────────────────────
router.post("/structures",      auth, admin, ctrl.creerStructure);
router.patch("/structures/:id", auth, admin, ctrl.modifierStructure);
router.delete("/structures/:id", auth, admin, ctrl.supprimerStructure);

router.post("/matieres",        auth, admin, ctrl.creerMatiere);
router.delete("/matieres/:id",  auth, admin, ctrl.supprimerMatiere);

router.post("/diplomes",        auth, admin, ctrl.creerDiplome);
router.delete("/diplomes/:id",  auth, admin, ctrl.supprimerDiplome);

router.post("/categories",      auth, admin, ctrl.creerCategorie);
router.delete("/categories/:id", auth, admin, ctrl.supprimerCategorie);

module.exports = router;
