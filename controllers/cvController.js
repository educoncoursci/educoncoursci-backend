// ============================================================
//  controllers/cvController.js
//  Gère : génération CV, génération LM, export PDF
// ============================================================

const { genererCV, genererLM, genererConseilRevision } = require("../services/claude");
const { genererPDFTexte, genererCVStructure, supprimerFichier } = require("../services/pdf");

// ════════════════════════════════════════════════════════════
//  POST /api/cv/generate — Générer un CV via Claude IA
// ════════════════════════════════════════════════════════════
exports.generateCV = async (req, res) => {
try {
const {
nom, email, telephone, ville, pays,
poste, profil,
experiences, formations,
competences, langues, loisirs,
} = req.body;

// Validations minimales
if (!nom || !poste) {
  return res.status(400).json({
    error: "Le nom complet et le poste recherché sont requis."
  });
}
if (!experiences || !Array.isArray(experiences)) {
  return res.status(400).json({
    error: "Au moins une expérience professionnelle est requise."
  });
}
if (!formations || !Array.isArray(formations)) {
  return res.status(400).json({
    error: "Au moins une formation est requise."
  });
}

// Appel à Claude
const contenuCV = await genererCV(req.body);

if (!contenuCV) {
  return res.status(500).json({
    error: "La génération du CV a échoué. Réessaie dans quelques secondes."
  });
}

res.json({
  message: "CV généré avec succès.",
  cv:      contenuCV,
  type:    "cv",
});

} catch (err) {
console.error("Erreur génération CV :", err.message);

// Message spécifique si la clé API est manquante
if (err.message.includes("API")) {
  return res.status(503).json({
    error: "Service IA temporairement indisponible. Réessaie dans quelques instants."
  });
}

res.status(500).json({ error: "Erreur lors de la génération du CV." });

}
};

// ════════════════════════════════════════════════════════════
//  POST /api/lm/generate — Générer une LM via Claude IA
// ════════════════════════════════════════════════════════════
exports.generateLM = async (req, res) => {
try {
const {
nom, poste, organisation,
destinataire, type,
motivation, experience,
} = req.body;

if (!nom || !poste || !organisation) {
  return res.status(400).json({
    error: "Le nom, le poste visé et l'organisation sont requis."
  });
}
if (!motivation) {
  return res.status(400).json({
    error: "La motivation principale est requise pour générer une lettre convaincante."
  });
}

const contenuLM = await genererLM(req.body);

if (!contenuLM) {
  return res.status(500).json({
    error: "La génération de la lettre a échoué. Réessaie dans quelques secondes."
  });
}

res.json({
  message: "Lettre de motivation générée avec succès.",
  lm:      contenuLM,
  type:    "lm",
});

} catch (err) {
console.error("Erreur génération LM :", err.message);
if (err.message.includes("API")) {
return res.status(503).json({
error: "Service IA temporairement indisponible."
});
}
res.status(500).json({ error: "Erreur lors de la génération de la lettre." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/cv/pdf — Exporter le CV ou LM en PDF
// ════════════════════════════════════════════════════════════
exports.exportPDF = async (req, res) => {
let filePath = null;
try {
const { contenu, type, data, style } = req.body;
// type  : "cv" | "lm"
// style : "simple" | "structure" (CV avec mise en page colonnes)

if (!contenu) {
  return res.status(400).json({ error: "Le contenu est requis pour générer le PDF." });
}

const nomBase = data?.nom
  ? data.nom.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
  : "document";

const nomFichier = `${type === "cv" ? "CV" : "LM"}_${nomBase}_${Date.now()}`;

// CV structuré avec colonnes colorées
if (type === "cv" && style === "structure" && data) {
  filePath = await genererCVStructure(data, contenu);
} else {
  // PDF simple avec le texte brut mis en forme
  filePath = await genererPDFTexte(contenu, nomFichier, type);
}

const labelFichier = type === "cv"
  ? `CV_${nomBase}.pdf`
  : `LM_${nomBase}.pdf`;

// Envoie le fichier et le supprime après
res.download(filePath, labelFichier, (err) => {
  supprimerFichier(filePath);
  if (err && !res.headersSent) {
    res.status(500).json({ error: "Erreur lors du téléchargement du PDF." });
  }
});

} catch (err) {
console.error("Erreur export PDF :", err.message);
if (filePath) supprimerFichier(filePath);
res.status(500).json({ error: "Erreur lors de la génération du PDF." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/cv/conseil — Conseil de révision personnalisé (bonus)
// ════════════════════════════════════════════════════════════
exports.conseilRevision = async (req, res) => {
try {
const { matiere, score, total } = req.body;

if (!matiere || score === undefined || !total) {
  return res.status(400).json({
    error: "Matière, score et total sont requis."
  });
}

const conseil = await genererConseilRevision(matiere, score, total);

res.json({
  message: "Conseil généré avec succès.",
  conseil,
});

} catch (err) {
console.error("Erreur conseil révision :", err.message);
res.status(500).json({ error: "Erreur lors de la génération du conseil." });
}
};