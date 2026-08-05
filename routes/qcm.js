// ============================================================
//  routes/qcm.js
//  Préfixe : /api/qcm
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/qcmController");
const auth    = require("../middleware/auth");
const authOptionnel = require("../middleware/authOptionnel");
const admin   = require("../middleware/admin");

// Lecture publique (questions sans réponses) — authOptionnel : même
// correctif que pdfs.js/videos.js/concours.js (Premium toujours verrouillé
// sans ça, même pour les abonnés).
router.get("/",    authOptionnel, ctrl.liste);   // GET /api/qcm
router.get("/:id", authOptionnel, ctrl.detail);  // GET /api/qcm/:id

// Soumission des réponses — authOptionnel : SANS ce correctif, req.user
// n'était jamais défini ici non plus, donc le score d'un utilisateur
// connecté n'était JAMAIS enregistré en base (silencieusement). Impact
// direct sur "Mes scores" au dashboard et sur le futur suivi de
// progression (Module 7), qui dépend de ces données.
// IMPORTANT : la route spécifique doit être déclarée AVANT /:id/score,
// sinon Express matcherait "examen-blanc" comme valeur de :id et
// appellerait le mauvais controller.
router.post("/examen-blanc/score", authOptionnel, ctrl.soumettreExamenBlanc); // POST /api/qcm/examen-blanc/score
router.post("/:id/score", authOptionnel, ctrl.soumettre); // POST /api/qcm/:id/score

// Écriture admin
router.post(  "/",    auth, admin, ctrl.creer);     // POST   /api/qcm
router.patch( "/:id", auth, admin, ctrl.modifier);  // PATCH  /api/qcm/:id
router.delete("/:id", auth, admin, ctrl.supprimer); // DELETE /api/qcm/:id

module.exports = router;