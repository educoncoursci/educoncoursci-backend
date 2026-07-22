// ============================================================
//  routes/search.js
//  Préfixe : /api/search
//  Recherche universelle — accessible publiquement, mais le
//  statut premium de l'utilisateur (si connecté) affine
//  l'affichage des contenus verrouillés.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/searchController");
const authOptionnel = require("../middleware/authOptionnel");

// GET /api/search?q=terme — Recherche universelle (public, auth optionnelle)
router.get("/", authOptionnel, ctrl.rechercher);

module.exports = router;
