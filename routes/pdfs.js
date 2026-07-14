// ============================================================
//  routes/pdfs.js
//  Préfixe : /api/pdfs
// ============================================================

const express = require(“express”);
const router  = express.Router();
const ctrl    = require(”../controllers/pdfController”);
const auth    = require(”../middleware/auth”);
const admin   = require(”../middleware/admin”);
const upload  = require(”../middleware/upload”);

// Lecture publique (l’URL des PDFs Premium est masquée)
router.get(”/”,                ctrl.liste);      // GET /api/pdfs
router.get(”/:id”,             ctrl.detail);     // GET /api/pdfs/:id
router.get(”/:id/download”,    auth, ctrl.telecharger); // GET /api/pdfs/:id/download (connecté)

// Écriture admin uniquement
router.post(  “/”,    auth, admin, upload, ctrl.creer);     // POST   /api/pdfs
router.patch( “/:id”, auth, admin, ctrl.modifier);           // PATCH  /api/pdfs/:id
router.delete(”/:id”, auth, admin, ctrl.supprimer);          // DELETE /api/pdfs/:id

module.exports = router;