// ============================================================
//  controllers/pdfController.js
//  Gère : liste, téléchargement, upload, CRUD PDFs
// ============================================================

const path = require(“path”);
const fs   = require(“fs”);
const PDF  = require(”../models/PDF”);

// ════════════════════════════════════════════════════════════
//  GET /api/pdfs — Liste avec filtres
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
try {
const { categorie, premium, recherche, limit, offset } = req.query;

```
let filtrerPremium;
if (premium !== undefined) filtrerPremium = premium === "true";

const pdfs = await PDF.findAll({
  categorie,
  premium:  filtrerPremium,
  recherche,
  limit:    parseInt(limit)  || 50,
  offset:   parseInt(offset) || 0,
});

// Masque l'URL réelle des PDFs Premium pour les non-abonnés
const pdfsFiltres = pdfs.map(pdf => {
  if (pdf.premium && (!req.user || !req.user.premium)) {
    const { url, ...sanUrl } = pdf;
    return { ...sanUrl, url: null, verrouille: true };
  }
  return { ...pdf, verrouille: false };
});

res.json({
  total: pdfsFiltres.length,
  pdfs:  pdfsFiltres,
});
```

} catch (err) {
console.error(“Erreur liste PDFs :”, err.message);
res.status(500).json({ error: “Erreur lors de la récupération des PDFs.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/pdfs/:id — Détail d’un PDF
// ════════════════════════════════════════════════════════════
exports.detail = async (req, res) => {
try {
const pdf = await PDF.findById(req.params.id);
if (!pdf) return res.status(404).json({ error: “PDF introuvable.” });

```
if (pdf.premium && (!req.user || !req.user.premium)) {
  return res.status(403).json({
    error:   "Contenu réservé aux abonnés Premium.",
    premium: true,
  });
}

res.json({ pdf });
```

} catch (err) {
console.error(“Erreur détail PDF :”, err.message);
res.status(500).json({ error: “Erreur serveur.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/pdfs/:id/download — Télécharger un PDF
// ════════════════════════════════════════════════════════════
exports.telecharger = async (req, res) => {
try {
const pdf = await PDF.findById(req.params.id);
if (!pdf) return res.status(404).json({ error: “PDF introuvable.” });

```
// Vérifie les droits Premium
if (pdf.premium && (!req.user || !req.user.premium)) {
  return res.status(403).json({
    error:   "Abonnement Premium requis pour télécharger ce document.",
    premium: true,
  });
}

// Incrémenter le compteur
await PDF.incrementer(pdf.id);

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
```

} catch (err) {
console.error(“Erreur téléchargement PDF :”, err.message);
res.status(500).json({ error: “Erreur lors du téléchargement.” });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/pdfs — Créer / Uploader un PDF (admin)
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
try {
const data = { …req.body };

```
// Si un fichier est uploadé via Multer
if (req.file) {
  data.url    = `/uploads/pdf/${req.file.filename}`;
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
const pdf = await PDF.create(data);

res.status(201).json({
  message: "PDF ajouté avec succès.",
  pdf,
});
```

} catch (err) {
console.error(“Erreur créer PDF :”, err.message);
res.status(500).json({ error: “Erreur lors de l’ajout du PDF.” });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/pdfs/:id — Modifier (admin)
// ════════════════════════════════════════════════════════════
exports.modifier = async (req, res) => {
try {
const pdf = await PDF.findById(req.params.id);
if (!pdf) return res.status(404).json({ error: “PDF introuvable.” });

```
const modifie = await PDF.update(req.params.id, req.body);
res.json({ message: "PDF modifié avec succès.", pdf: modifie });
```

} catch (err) {
console.error(“Erreur modifier PDF :”, err.message);
res.status(500).json({ error: “Erreur lors de la modification.” });
}
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/pdfs/:id — Supprimer (admin)
// ════════════════════════════════════════════════════════════
exports.supprimer = async (req, res) => {
try {
const pdf = await PDF.findById(req.params.id);
if (!pdf) return res.status(404).json({ error: “PDF introuvable.” });

```
// Supprimer le fichier local si c'est un upload
if (pdf.url && pdf.url.startsWith("/uploads/")) {
  const filePath = path.join(__dirname, "..", pdf.url);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

await PDF.delete(req.params.id);
res.json({ message: "PDF supprimé avec succès." });
```

} catch (err) {
console.error(“Erreur supprimer PDF :”, err.message);
res.status(500).json({ error: “Erreur lors de la suppression.” });
}
};