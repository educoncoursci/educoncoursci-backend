// ============================================================
//  controllers/cvController.js
//  Gère : génération CV, génération LM, export PDF
// ============================================================

const { genererCV, genererLM, genererConseilRevision, analyserATS, adapterCVOffre } = require("../services/claude");
const { genererPDFTexte, genererCVStructure, supprimerFichier } = require("../services/pdf");
const { genererCVDocx, genererLMDocx } = require("../services/docx");
const { listerParCategorie, obtenirModele } = require("../config/modelesCv");

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
const { contenu, type, data, style, modeleId } = req.body;
// type     : "cv" | "lm"
// style    : "simple" | "structure" (CV avec mise en page colonnes)
// modeleId : identifiant du modèle choisi (ex: "tech_1", "ong_social_2"...)

if (!contenu) {
  return res.status(400).json({ error: "Le contenu est requis pour générer le PDF." });
}

const nomBase = data?.nom
  ? data.nom.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
  : "document";

const nomFichier = `${type === "cv" ? "CV" : "LM"}_${nomBase}_${Date.now()}`;

// CV structuré avec colonnes colorées
if (type === "cv" && style === "structure" && data) {
  const modele = obtenirModele(modeleId);
  filePath = await genererCVStructure(data, contenu, modele);
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

// ════════════════════════════════════════════════════════════
//  GET /api/cv/modeles — Liste des modèles de CV (public)
// ════════════════════════════════════════════════════════════
exports.listerModeles = (req, res) => {
try {
const modeles = listerParCategorie();
res.json({ modeles });
} catch (err) {
console.error("Erreur liste modèles :", err.message);
res.status(500).json({ error: "Erreur lors de la récupération des modèles." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/cv/docx — Exporter le CV ou LM en Word (.docx)
// ════════════════════════════════════════════════════════════
exports.exportDOCX = async (req, res) => {
let filePath = null;
try {
const { contenu, type, data, modeleId } = req.body;

if (!contenu) {
  return res.status(400).json({ error: "Le contenu est requis pour générer le document Word." });
}

const nomBase = data?.nom
  ? data.nom.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
  : "document";

if (type === "cv" && data) {
  const modele = obtenirModele(modeleId);
  filePath = await genererCVDocx(data, contenu, modele);
} else {
  filePath = await genererLMDocx(contenu, nomBase);
}

const labelFichier = type === "cv" ? `CV_${nomBase}.docx` : `LM_${nomBase}.docx`;

res.download(filePath, labelFichier, (err) => {
  supprimerFichier(filePath);
  if (err && !res.headersSent) {
    res.status(500).json({ error: "Erreur lors du téléchargement du document Word." });
  }
});
} catch (err) {
console.error("Erreur export DOCX :", err.message);
if (filePath) supprimerFichier(filePath);
res.status(500).json({ error: "Erreur lors de la génération du document Word." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/cv/analyse-ats — Analyse la compatibilité ATS du CV
// ════════════════════════════════════════════════════════════
exports.analyserATS = async (req, res) => {
try {
const { contenuCV, offreEmploi } = req.body;

if (!contenuCV) {
  return res.status(400).json({ error: "Le contenu du CV est requis pour l'analyse." });
}

const analyse = await analyserATS(contenuCV, offreEmploi);

res.json({ message: "Analyse ATS terminée.", analyse });
} catch (err) {
console.error("Erreur analyse ATS :", err.message);
if (err.message.includes("API")) {
  return res.status(503).json({ error: "Service IA temporairement indisponible." });
}
res.status(500).json({ error: "Erreur lors de l'analyse ATS." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/cv/adapter-offre — Adapte un CV existant à une offre
// ════════════════════════════════════════════════════════════
exports.adapterOffre = async (req, res) => {
try {
const { contenuCV, offreEmploi } = req.body;

if (!contenuCV || !offreEmploi) {
  return res.status(400).json({
    error: "Le CV existant et le texte de l'offre d'emploi sont requis."
  });
}

const cvAdapte = await adapterCVOffre(contenuCV, offreEmploi);

res.json({ message: "CV adapté à l'offre avec succès.", cv: cvAdapte });
} catch (err) {
console.error("Erreur adaptation offre :", err.message);
if (err.message.includes("API")) {
  return res.status(503).json({ error: "Service IA temporairement indisponible." });
}
res.status(500).json({ error: "Erreur lors de l'adaptation du CV à l'offre." });
}
};