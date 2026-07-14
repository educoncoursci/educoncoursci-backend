// ============================================================
//  middleware/upload.js
//  Configuration Multer pour l’upload de fichiers PDF.
//  Limite : 20 MB, uniquement les fichiers PDF.
// ============================================================

const multer = require(“multer”);
const path   = require(“path”);
const fs     = require(“fs”);

// Crée le dossier uploads/pdf s’il n’existe pas
const uploadDir = path.join(__dirname, “../uploads/pdf”);
if (!fs.existsSync(uploadDir)) {
fs.mkdirSync(uploadDir, { recursive: true });
}

// Config du stockage
const storage = multer.diskStorage({
destination: (req, file, cb) => {
cb(null, uploadDir);
},
filename: (req, file, cb) => {
// Nom unique : timestamp + nom nettoyé
const ext      = path.extname(file.originalname);
const baseName = path.basename(file.originalname, ext)
.replace(/[^a-zA-Z0-9-*]/g, “*”)
.substring(0, 60);
const fileName = `${Date.now()}_${baseName}${ext}`;
cb(null, fileName);
},
});

// Filtre : uniquement les PDFs
const fileFilter = (req, file, cb) => {
if (file.mimetype === “application/pdf”) {
cb(null, true);
} else {
cb(new Error(“Seuls les fichiers PDF sont acceptés.”), false);
}
};

// Taille max depuis .env (défaut : 20 MB)
const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024;

const upload = multer({
storage,
fileFilter,
limits: { fileSize: maxSize },
});

// Gestion des erreurs Multer
const handleUploadError = (err, req, res, next) => {
if (err instanceof multer.MulterError) {
if (err.code === “LIMIT_FILE_SIZE”) {
return res.status(400).json({
error: `Fichier trop lourd. Maximum : ${process.env.MAX_FILE_SIZE_MB || 20} MB.`
});
}
return res.status(400).json({ error: err.message });
}
if (err) {
return res.status(400).json({ error: err.message });
}
next();
};

module.exports = { upload, handleUploadError };