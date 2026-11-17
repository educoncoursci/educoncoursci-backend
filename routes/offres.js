// ============================================================
//  routes/offres.js — Préfixe : /api/offres
//  Analyse d'offre : gratuite avec compte (quota IA gratuit quotidien).
//  Comparaison approfondie avec le CV : Premium.
// ============================================================
const express = require("express");
const multer = require("multer");
const router = express.Router();
const ctrl = require("../controllers/analyseOffreController");
const auth = require("../middleware/auth");
const quotaIA = require("../middleware/quotaIA");
const exigerPremium = require("../middleware/exigerPremium");

// Fichiers gardés en mémoire le temps de la requête, jamais écrits sur disque
const televerser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } })
  .fields([{ name: "offre", maxCount: 1 }, { name: "cv", maxCount: 1 }]);
const avecFichiers = (req, res, next) => televerser(req, res, (err) => {
  if (!err) return next();
  const msg = err.code === "LIMIT_FILE_SIZE" ? "Fichier trop volumineux (5 Mo maximum)." : "Envoi du fichier impossible.";
  res.status(400).json({ error: msg });
});

router.post("/analyser", auth, avecFichiers, quotaIA("offre"), ctrl.analyser);
router.post("/:id/comparer", auth, exigerPremium, avecFichiers, ctrl.comparer);
router.get("/", auth, ctrl.lister);
router.get("/:id", auth, ctrl.lire);
router.delete("/:id", auth, ctrl.supprimer);

module.exports = router;
