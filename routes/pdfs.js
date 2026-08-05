// ============================================================
//  routes/pdfs.js
//  Préfixe : /api/pdfs
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/pdfController");
const auth    = require("../middleware/auth");
const authOptionnel = require("../middleware/authOptionnel");
const admin   = require("../middleware/admin");
const { upload, handleUploadError } = require("../middleware/upload");

// Lecture publique (l'URL des PDFs Premium est masquée pour les non-abonnés)
// authOptionnel : sans ça, req.user n'était jamais défini ici, donc les
// abonnés Premium voyaient TOUS les PDFs Premium comme verrouillés dans
// la bibliothèque, alors qu'ils y avaient droit.
router.get("/",                authOptionnel, ctrl.liste);      // GET /api/pdfs
router.get("/:id",             authOptionnel, ctrl.detail);     // GET /api/pdfs/:id
router.get("/:id/download",    auth, ctrl.telecharger); // GET /api/pdfs/:id/download (connecté)

// Écriture admin uniquement
router.post(  "/",    auth, admin, upload.single("fichier"), handleUploadError, ctrl.creer);     // POST   /api/pdfs
router.patch( "/:id", auth, admin, ctrl.modifier);           // PATCH  /api/pdfs/:id
router.delete("/:id", auth, admin, ctrl.supprimer);          // DELETE /api/pdfs/:id

module.exports = router;