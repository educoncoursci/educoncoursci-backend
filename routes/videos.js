// ============================================================
//  routes/videos.js
//  Préfixe : /api/videos
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/videoController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");
const { uploadVideo, handleUploadError } = require("../middleware/upload");

// Lecture publique
router.get("/",    ctrl.liste);       // GET /api/videos
router.get("/:id", ctrl.detail);      // GET /api/videos/:id

// Écriture admin
router.post(  "/",    auth, admin, uploadVideo.single("fichier"), handleUploadError, ctrl.creer);  // POST   /api/videos
router.patch( "/:id", auth, admin, ctrl.modifier);   // PATCH  /api/videos/:id
router.delete("/:id", auth, admin, ctrl.supprimer);  // DELETE /api/videos/:id

module.exports = router;