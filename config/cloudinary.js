// ============================================================
//  config/cloudinary.js
//  Configuration Cloudinary — stockage permanent des fichiers
//  uploadés (PDF, vidéos, photos), pour remplacer le disque local
//  de Render qui est ÉPHÉMÈRE (tout fichier stocké sur le disque
//  disparaît au prochain redéploiement, sauf volume persistant
//  payant).
//
//  Cloudinary offre un plan gratuit jusqu'à 25 Go de stockage et
//  25 Go de bande passante/mois — largement suffisant pour
//  démarrer. Compte gratuit : https://cloudinary.com
//
//  Configuré si les 3 variables CLOUDINARY_* sont présentes ; sinon
//  l'app bascule automatiquement sur le stockage disque local
//  (middleware/upload.js), pour ne jamais empêcher le démarrage.
// ============================================================

const cloudinary = require("cloudinary").v2;

function cloudinaryConfigure() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

if (cloudinaryConfigure()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log("✅ Cloudinary configuré — les fichiers uploadés seront stockés de façon permanente.");
} else {
  console.warn(
    "⚠️  Cloudinary NON configuré (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / " +
    "CLOUDINARY_API_SECRET absentes) — les fichiers uploadés seront stockés sur le " +
    "disque local de Render et seront PERDUS au prochain redéploiement. " +
    "Configure ces 3 variables pour un stockage permanent (voir .env.example).",
  );
}

module.exports = { cloudinary, cloudinaryConfigure };
