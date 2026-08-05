// ============================================================
//  routes/forum.js
//  Préfixe : /api/forum
//  Lot 13 — Communauté : forum d'entraide entre candidats.
//  Lecture publique, écriture réservée aux comptes connectés.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/forumController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

router.get("/sujets",            ctrl.listerSujets);          // GET    /api/forum/sujets
router.get("/sujets/:id",        ctrl.detailSujet);           // GET    /api/forum/sujets/:id
router.post("/sujets",           auth, ctrl.creerSujet);      // POST   /api/forum/sujets
router.delete("/sujets/:id",     auth, ctrl.supprimerSujet);  // DELETE /api/forum/sujets/:id
router.patch("/sujets/:id/epingler", auth, admin, ctrl.epinglerSujet); // PATCH /api/forum/sujets/:id/epingler

router.post("/sujets/:id/reponses", auth, ctrl.repondre);       // POST   /api/forum/sujets/:id/reponses
router.delete("/reponses/:id",      auth, ctrl.supprimerReponse); // DELETE /api/forum/reponses/:id

module.exports = router;
