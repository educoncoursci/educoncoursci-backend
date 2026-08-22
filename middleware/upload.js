// ============================================================
//  middleware/upload.js
//  Configuration Multer pour l'upload de fichiers (PDF, vidéos,
//  photos).
//
//  Deux modes, choisis automatiquement :
//  - Cloudinary configuré (CLOUDINARY_*) → stockage PERMANENT,
//    les fichiers survivent aux redéploiements. Recommandé.
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

// ── Stockage Cloudinary (générique, un dossier par type) ──────
function creerStorageCloudinary({ dossier, resourceType }) {
  // multer-storage-cloudinary-v2 : même API que multer-storage-cloudinary,
  // mais compatible avec cloudinary v2.x (l'original ne fonctionne
  // qu'avec cloudinary v1.x — voir config/cloudinary.js).
  const { CloudinaryStorage } = require("multer-storage-cloudinary-v2");
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `educoncoursci/${dossier}`,
      resource_type: resourceType, // "raw" pour PDF, "video" pour vidéos, "image" pour photos
      public_id: (req, file) => {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext)
          .replace(/[^a-zA-Z0-9-_]/g, "_")
          .substring(0, 60);
        return `${Date.now()}_${baseName}`;
      },
    },
  });
}

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
        .replace(/[^a-zA-Z0-9-*]/g, "*")
        .substring(0, 60);
      const fileName = `${Date.now()}_${baseName}${ext}`;
      cb(null, fileName);
    },
  });
}

// ── Fabrique générique : choisit Cloudinary ou disque selon la config ──
function creerUploadeur({ dossier, resourceType, mimetypesAutorises, messageErreur, maxSizeMb }) {
  const storage = cloudinaryConfigure()
    ? creerStorageCloudinary({ dossier, resourceType })
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
  resourceType: "raw",
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
  resourceType: "video",
  mimetypesAutorises: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
  messageErreur: "Formats acceptés : MP4, WebM, MOV.",
  maxSizeMb: parseInt(process.env.MAX_VIDEO_SIZE_MB) || 200,
});

// ── Upload Photo de profil ──────────────────────────────────
const uploadPhoto = creerUploadeur({
  dossier: "photos",
  resourceType: "image",
  mimetypesAutorises: ["image/jpeg", "image/png", "image/webp"],
  messageErreur: "Formats acceptés : JPG, PNG, WebP.",
  maxSizeMb: parseInt(process.env.MAX_PHOTO_SIZE_MB) || 5,
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

module.exports = { upload, uploadVideo, uploadPhoto, handleUploadError };
