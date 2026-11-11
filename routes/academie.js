// ============================================================
//  routes/academie.js — Académie EduConcoursCI
//  Préfixe : /api/academie
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/academieController");
const auth    = require("../middleware/auth");
const authOptionnel = require("../middleware/authOptionnel");
const admin   = require("../middleware/admin");

// Un identifiant non numérique n'est jamais valide : 404 propre plutôt qu'une erreur SQL.
router.param("id", (req, res, next, id) => {
  if (/^\d+$/.test(id)) return next();
  return res.status(404).json({ error: "Introuvable." });
});

// ── Public (authOptionnel : l'accès Premium dépend du compte) ──
router.get( "/cours",                authOptionnel, ctrl.listeCours);    // GET  /api/academie/cours
router.get( "/cours/:id",            authOptionnel, ctrl.detailCours);   // GET  /api/academie/cours/:id
router.get( "/lecons/:id",           authOptionnel, ctrl.detailLecon);   // GET  /api/academie/lecons/:id
router.post("/lecons/:id/terminer",  auth,          ctrl.terminerLecon); // POST /api/academie/lecons/:id/terminer

// ── Admin : création assistée par IA, relecture, publication ──
router.get(   "/admin/cours",                 auth, admin, ctrl.adminListe);
router.get(   "/admin/cours/:id",             auth, admin, ctrl.adminDetail);
router.put(   "/admin/cours/:id",             auth, admin, ctrl.adminSauvegarder);
router.delete("/admin/cours/:id",             auth, admin, ctrl.adminSupprimer);
router.post(  "/admin/cours/:id/publier",     auth, admin, ctrl.adminPublier);
router.post(  "/admin/cours/:id/depublier",   auth, admin, ctrl.adminDepublier);
router.post(  "/admin/plan",                  auth, admin, ctrl.adminPlan);
router.post(  "/admin/lecons/:id/generer",    auth, admin, ctrl.adminGenererLecon);

module.exports = router;
