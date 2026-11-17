// ============================================================
//  routes/catalogue.js — Catalogue des produits et tarifs
//  Préfixe : /api/catalogue
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/catalogueController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

router.get("/", ctrl.catalogue);                                                    // public : produits actifs
router.get("/admin/produits",     auth, admin, ctrl.adminListe);                    // admin
router.put("/admin/produits/:id", auth, admin, ctrl.adminModifier);                 // admin

module.exports = router;
