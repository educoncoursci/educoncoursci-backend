// ============================================================
//  middleware/upload.js
//  Configuration Multer pour l'upload de fichiers (PDF, vidéos,
//  photos).
//
//  Deux modes, choisis automatiquement :
//  - Cloudinary configuré (CLOUDINARY_*) → stockage PERMANENT,
//    les fichiers survivent aux redéploiements. Recommandé.
//    Implémenté directement avec le SDK officiel Cloudinary
//    (upload_stream), sans passer par un paquet tiers de storage
//    Multer — ces paquets (multer-storage-cloudinary et ses forks)
//    ont des dépendances figées sur d'anciennes versions de
//    Cloudinary/Multer qui provoquent des conflits npm ERESOLVE.
//    L'appel direct au SDK est plus simple et plus robuste.
//  - Sinon → disque local (ancien comportement). ⚠️ Le disque de
//    la plupart des hébergeurs (dont Render) est éphémère — un
//    fichier stocké ainsi est perdu au prochain redéploiement,
//    sauf volume persistant configuré. C'est pourquoi le lien
//    YouTube reste la méthode recommandée pour les vidéos, et
//    pourquoi Cloudinary est recommandé pour PDF/photos.
// ============================================================

const multer = require("multer");
const path   = require("path");
const fs     = require("fs");
const { cloudinary, cloudinaryConfigure } = require("../config/cloudinary");

// ── Stockage disque local (fallback si Cloudinary absent) ─────
function creerStorageDisque({ dossier }) {
  const uploadDir = path.join(__dirname, `../uploads/${dossier}`);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext      = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9-_]/g, "_")
        .substring(0, 60);
      const fileName = `${Date.now()}_${baseName}${ext}`;
      cb(null, fileName);
    },
  });
}

// ── Fabrique générique : mémoire (→ Cloudinary) ou disque selon la config ──
function creerUploadeur({ dossier, mimetypesAutorises, messageErreur, maxSizeMb }) {
  // Si Cloudinary est configuré, Multer garde le fichier en mémoire
  // (buffer) le temps de la requête ; on l'enverra ensuite nous-même
  // à Cloudinary via envoyerVersCloudinary() dans le contrôleur.
  // Sinon, on écrit directement sur le disque comme avant.
  const storage = cloudinaryConfigure()
    ? multer.memoryStorage()
    : creerStorageDisque({ dossier });

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
// Le lien YouTube reste la méthode recommandée dans l'admin ;
// l'upload direct est une option secondaire pour les cas où
// YouTube ne convient pas (voir admin/videos.html).
const uploadVideo = creerUploadeur({
  dossier: "videos",
  mimetypesAutorises: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
  messageErreur: "Formats acceptés : MP4, WebM, MOV.",
  maxSizeMb: parseInt(process.env.MAX_VIDEO_SIZE_MB) || 200,
});

// ── Upload Photo de profil ──────────────────────────────────
const uploadPhoto = creerUploadeur({
  dossier: "photos",
  mimetypesAutorises: ["image/jpeg", "image/png", "image/webp"],
  messageErreur: "Formats acceptés : JPG, PNG, WebP.",
  maxSizeMb: parseInt(process.env.MAX_PHOTO_SIZE_MB) || 5,
});

// ── Envoi effectif vers Cloudinary (appelé depuis le contrôleur) ──
// À utiliser uniquement quand cloudinaryConfigure() est vrai (donc
// que req.file vient de multer.memoryStorage() et a un .buffer).
// resourceType : "raw" (PDF), "video" ou "image".
function envoyerVersCloudinary(fichier, { dossier, resourceType }) {
  return new Promise((resolve, reject) => {
    const flux = cloudinary.uploader.upload_stream(
      {
        folder: `educoncoursci/${dossier}`,
        resource_type: resourceType,
        public_id: `${Date.now()}_${path
          .basename(fichier.originalname, path.extname(fichier.originalname))
          .replace(/[^a-zA-Z0-9-_]/g, "_")
          .substring(0, 60)}`,
      },
      (err, resultat) => {
        if (err) return reject(err);
        resolve(resultat);
      },
    );
    flux.end(fichier.buffer);
  });
}

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

module.exports = {
  upload,
  uploadVideo,
  uploadPhoto,
  handleUploadError,
  envoyerVersCloudinary,
  cloudinaryConfigure,
};
