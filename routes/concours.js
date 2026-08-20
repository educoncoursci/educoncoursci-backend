// ============================================================
//  routes/concours.js
//  Préfixe : /api/concours
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/concoursController");
const auth    = require("../middleware/auth");
const authOptionnel = require("../middleware/authOptionnel");
const admin   = require("../middleware/admin");

// Routes publiques (lecture)
router.get("/",         ctrl.liste);   // GET /api/concours
router.get("/ouverts",  ctrl.ouverts); // GET /api/concours/ouverts
router.get("/stats",    ctrl.stats);   // GET /api/concours/stats — AVANT /:id, sinon "stats" serait interprété comme un id

// Admin — lance la bibliothèque de concours vérifiés (scripts/seed-
// concours-ci.js) sans avoir besoin d'un accès Shell à l'hébergeur
// (indisponible sur le plan gratuit Render). Idempotent : rejouable
// sans risque, les doublons sont ignorés (contrainte SQL unique sur
// titre+organisme), jamais créés deux fois.
router.post("/reseeder", auth, admin, ctrl.reseeder); // POST /api/concours/reseeder — AVANT /:id
// authOptionnel : sans ça req.user n'était jamais défini ici, donc la
// vérification Premium dans ctrl.detail ne se déclenchait jamais — le
// contenu Premium des fiches concours était visible par tout le monde.
router.get("/:id",      authOptionnel, ctrl.detail);  // GET /api/concours/:id

// Routes protégées admin (écriture)
router.post(  "/",    auth, admin, ctrl.creer);      // POST   /api/concours
router.patch( "/:id", auth, admin, ctrl.modifier);   // PATCH  /api/concours/:id
router.delete("/:id", auth, admin, ctrl.supprimer);  // DELETE /api/concours/:id

module.exports = router;