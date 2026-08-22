// ============================================================
//  controllers/pdfController.js
//  Gère : liste, téléchargement, upload, CRUD PDFs
// ============================================================

const path = require("path");
const fs   = require("fs");
const PDF  = require("../models/PDF");

// ════════════════════════════════════════════════════════════
//  GET /api/pdfs — Liste avec filtres
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
try {
const { categorie, premium, recherche, type, concoursId, limit, offset } = req.query;

let filtrerPremium;
if (premium !== undefined) filtrerPremium = premium === "true";

const pdfs = await PDF.findAll({
  categorie,
  premium:  filtrerPremium,
  recherche,
  type,
  concoursId: concoursId ? parseInt(concoursId) : undefined,
  limit:    parseInt(limit)  || 50,
  offset:   parseInt(offset) || 0,
});

// Masque l'URL réelle des PDFs Premium pour les non-abonnés
const pdfsFiltres = pdfs.map(pdf => {
  if (pdf.premium && (req.user ? (req.user.role !== "admin" && !req.user.premium) : true)) {
    const { url, ...sanUrl } = pdf;
    return { ...sanUrl, url: null, verrouille: true };
  }
  return { ...pdf, verrouille: false };
});

res.json({
  total: pdfsFiltres.length,
  pdfs:  pdfsFiltres,
});

} catch (err) {
console.error("Erreur liste PDFs :", err.message);
res.status(500).json({ error: "Erreur lors de la récupération des PDFs." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/pdfs/:id — Détail d'un PDF
// ════════════════════════════════════════════════════════════
exports.detail = async (req, res) => {
try {
const pdf = await PDF.findById(req.params.id);
if (!pdf) return res.status(404).json({ error: "PDF introuvable." });

if (pdf.premium && req.user && req.user.role !== "admin" && !req.user.premium) {
  return res.status(403).json({
    error:   "Contenu réservé aux abonnés Premium.",
    premium: true,
  });
}

const concoursIds = await PDF.findConcoursIds(pdf.id);

res.json({ pdf: { ...pdf, concoursIds } });

} catch (err) {
console.error("Erreur détail PDF :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/pdfs/:id/download — Télécharger un PDF
// ════════════════════════════════════════════════════════════
exports.telecharger = async (req, res) => {
try {
const pdf = await PDF.findById(req.params.id);
if (!pdf) return res.status(404).json({ error: "PDF introuvable." });

// Vérifie les droits Premium
if (pdf.premium && (req.user ? (req.user.role !== "admin" && !req.user.premium) : true)) {
  return res.status(403).json({
    error:   "Abonnement Premium requis pour télécharger ce document.",
    premium: true,
  });
}

// Incrémenter le compteur
await PDF.incrementerTelechargement(pdf.id);

// Suivi de progression (Module 7) — n'enregistre que pour les connectés
if (req.user) {
  PDF.enregistrerConsultation(req.user.id, pdf.id).catch((err) =>
    console.error("Erreur enregistrement consultation PDF :", err.message),
  );
}

// Si l'URL est un lien externe (Drive, etc.), rediriger
if (pdf.url.startsWith("http")) {
  return res.redirect(pdf.url);
}

// Si c'est un fichier local uploadé
const filePath = path.join(__dirname, "../uploads/pdf", path.basename(pdf.url));
if (!fs.existsSync(filePath)) {
  return res.status(404).json({ error: "Fichier introuvable sur le serveur." });
}

res.download(filePath, `${pdf.titre}.pdf`);

} catch (err) {
console.error("Erreur téléchargement PDF :", err.message);
res.status(500).json({ error: "Erreur lors du téléchargement." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/pdfs — Créer / Uploader un PDF (admin)
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
try {
const data = { ...req.body };

// Si un fichier est uploadé via Multer
if (req.file) {
  // Cloudinary renvoie une URL complète dans .path (ou .secure_url selon
  // la version) ; le stockage disque local ne fournit que .filename.
  data.url    = req.file.path || `/uploads/pdf/${req.file.filename}`;
  data.taille = `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`;
}

if (!data.titre) {
  return res.status(400).json({ error: "Le titre est requis." });
}
if (!data.url) {
  return res.status(400).json({
    error: "Un fichier PDF ou une URL externe est requis."
  });
}

data.premium = data.premium === "true" || data.premium === true;

// concoursIds arrive en JSON string via FormData (upload), ou en tableau
// direct si jamais envoyé en JSON classique — on gère les deux.
let concoursIds = [];
if (data.concoursIds) {
  try {
    concoursIds = typeof data.concoursIds === "string"
      ? JSON.parse(data.concoursIds)
      : data.concoursIds;
  } catch { concoursIds = []; }
  delete data.concoursIds;
}

const pdf = await PDF.create(data);

if (Array.isArray(concoursIds) && concoursIds.length > 0) {
  await PDF.definirConcours(pdf.id, concoursIds);
}

res.status(201).json({
  message: "PDF ajouté avec succès.",
  pdf,
});

} catch (err) {
console.error("Erreur créer PDF :", err.message);
res.status(500).json({ error: "Erreur lors de l'ajout du PDF." });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/pdfs/:id — Modifier (admin)
// ════════════════════════════════════════════════════════════
exports.modifier = async (req, res) => {
try {
const pdf = await PDF.findById(req.params.id);
if (!pdf) return res.status(404).json({ error: "PDF introuvable." });

const modifie = await PDF.update(req.params.id, req.body);

if (Array.isArray(req.body.concoursIds)) {
  await PDF.definirConcours(req.params.id, req.body.concoursIds);
}

res.json({ message: "PDF modifié avec succès.", pdf: modifie });

} catch (err) {
console.error("Erreur modifier PDF :", err.message);
res.status(500).json({ error: "Erreur lors de la modification." });
}
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/pdfs/:id — Supprimer (admin)
// ════════════════════════════════════════════════════════════
exports.supprimer = async (req, res) => {
try {
const pdf = await PDF.findById(req.params.id);
if (!pdf) return res.status(404).json({ error: "PDF introuvable." });

// Supprimer le fichier local si c'est un upload
if (pdf.url && pdf.url.startsWith("/uploads/")) {
  const filePath = path.join(__dirname, "..", pdf.url);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

await PDF.delete(req.params.id);
res.json({ message: "PDF supprimé avec succès." });

} catch (err) {
console.error("Erreur supprimer PDF :", err.message);
res.status(500).json({ error: "Erreur lors de la suppression." });
}
};