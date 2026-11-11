// ============================================================
//  routes/recruteurs.js — Espace recruteurs
//  Préfixe : /api/recruteurs
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/recruteursController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

router.param("id", (req, res, next, id) => {
  if (/^\d+$/.test(id)) return next();
  return res.status(404).json({ error: "Introuvable." });
});

// ── Entreprise inscrite ──
router.post("/offres",     auth, ctrl.soumettre);  // POST /api/recruteurs/offres
router.get( "/mes-offres", auth, ctrl.mesOffres);  // GET  /api/recruteurs/mes-offres

// ── Admin ──
router.get(  "/admin/stats",                auth, admin, ctrl.adminStats);
router.get(  "/admin/offres",               auth, admin, ctrl.adminListe);
router.get(  "/admin/offres/:id",           auth, admin, ctrl.adminDetail);
router.put(  "/admin/offres/:id",           auth, admin, ctrl.adminModifier);
router.post( "/admin/offres/:id/accepter",  auth, admin, ctrl.adminAccepter);
router.post( "/admin/offres/:id/refuser",   auth, admin, ctrl.adminRefuser);
router.patch("/admin/offres/:id/paiement",  auth, admin, ctrl.adminPaiement);

module.exports = router;
