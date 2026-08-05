// ============================================================
//  routes/marketplace.js
//  Préfixe : /api/marketplace
//  Lot 14 — Marketplace (façade publique).
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/marketplaceController");
const authOptionnel = require("../middleware/authOptionnel");

router.get("/offres",     ctrl.listerOffres);   // GET  /api/marketplace/offres
router.get("/offres/:id", ctrl.detailOffre);    // GET  /api/marketplace/offres/:id
router.post("/offres/:id/contact", authOptionnel, ctrl.contacterPartenaire); // POST /api/marketplace/offres/:id/contact

module.exports = router;
