// ============================================================
//  middleware/upload.js
//  Configuration Multer pour l'upload de fichiers (PDF et vidéos).
//  - PDF   : 20 MB par défaut, uniquement application/pdf.
//  - Vidéo : 200 MB par défaut, formats vidéo courants (mp4/webm/mov).
// ============================================================

const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

// ── Fabrique générique : crée un middleware Multer pour un
//    sous-dossier /uploads/<dossier> donné ────────────────────
function creerUploadeur({ dossier, mimetypesAutorises, messageErreur, maxSizeMb }) {
  const uploadDir = path.join(__dirname, `../uploads/${dossier}`);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Nom unique : timestamp + nom nettoyé
      const ext      = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9-*]/g, "*")
        .substring(0, 60);
      const fileName = `${Date.now()}_${baseName}${ext}`;
      cb(null, fileName);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (mimetypesAutorises.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(messageErreur), false);
    }
  };

  const maxSize = maxSizeMb * 1024 * 1024;

  return multer({ storage, fileFilter, limits: { fileSize: maxSize } });
}

// ── Upload PDF (documents) ─────────────────────────────────────
const upload = creerUploadeur({
  dossier: "pdf",
  mimetypesAutorises: ["application/pdf"],
  messageErreur: "Seuls les fichiers PDF sont acceptés.",
  maxSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB) || 20,
});

// ── Upload Vidéo ─────────────────────────────────────────────
// ⚠️ Important : le disque de la plupart des hébergeurs (dont
// Railway) est éphémère — un fichier stocké ici est perdu au
// prochain redéploiement, sauf volume persistant configuré.
// C'est pourquoi le lien YouTube reste la méthode recommandée
// dans l'admin ; l'upload direct est une option secondaire pour
// les cas où YouTube ne convient pas (voir admin/videos.html).
const uploadVideo = creerUploadeur({
  dossier: "videos",
  mimetypesAutorises: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
  messageErreur: "Formats acceptés : MP4, WebM, MOV.",
  maxSizeMb: parseInt(process.env.MAX_VIDEO_SIZE_MB) || 200,
});

// ── Gestion des erreurs Multer (partagée) ──────────────────────
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: `Fichier trop lourd. Maximum : ${process.env.MAX_FILE_SIZE_MB || 20} MB (PDF) / ${process.env.MAX_VIDEO_SIZE_MB || 200} MB (vidéo).`,
      });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

module.exports = { upload, uploadVideo, handleUploadError };
