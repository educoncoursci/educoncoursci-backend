// ============================================================
//  controllers/documentsController.js
//  Gère : génération et export des documents professionnels
//  (Business Plan, Devis, Facture, Rapport, Contrat, Présentation)
// ============================================================

const {
  genererBusinessPlan, genererDevis, genererFacture,
  genererRapport, genererContrat, genererPresentation,
} = require("../services/documentsClaude");
const { genererPDFTexte, supprimerFichier } = require("../services/pdf");
const { genererDocumentDocx } = require("../services/docx");
const { listerTypes, obtenirType } = require("../config/typesDocuments");

const GENERATEURS = {
  business_plan: genererBusinessPlan,
  devis: genererDevis,
  facture: genererFacture,
  rapport: genererRapport,
  contrat: genererContrat,
  presentation: genererPresentation,
};

// ════════════════════════════════════════════════════════════
//  GET /api/documents/types — Liste des types de documents (public)
// ════════════════════════════════════════════════════════════
exports.listerTypes = (req, res) => {
  try {
    res.json({ types: listerTypes() });
  } catch (err) {
    console.error("Erreur liste types documents :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des types de documents." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/documents/generate — Générer un document professionnel
// ════════════════════════════════════════════════════════════
exports.genererDocument = async (req, res) => {
  try {
    const { type, ...donnees } = req.body;

    if (!type || !GENERATEURS[type]) {
      return res.status(400).json({
        error: "Type de document invalide. Types disponibles : " + Object.keys(GENERATEURS).join(", ")
      });
    }

    const typeInfo = obtenirType(type);
    const champsManquants = (typeInfo.champsRequis || []).filter(champ => {
      const valeur = donnees[champ];
      return valeur === undefined || valeur === null || valeur === "" ||
             (Array.isArray(valeur) && valeur.length === 0);
    });

    if (champsManquants.length > 0) {
      return res.status(400).json({
        error: `Champs requis manquants : ${champsManquants.join(", ")}`
      });
    }

    const contenu = await GENERATEURS[type](donnees);

    if (!contenu) {
      return res.status(500).json({
        error: "La génération du document a échoué. Réessaie dans quelques secondes."
      });
    }

    res.json({
      message: "Document généré avec succès.",
      document: contenu,
      type,
    });
  } catch (err) {
    console.error("Erreur génération document :", err.message);
    if (err.message.includes("API")) {
      return res.status(503).json({
        error: "Service IA temporairement indisponible. Réessaie dans quelques instants."
      });
    }
    res.status(500).json({ error: "Erreur lors de la génération du document." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/documents/pdf — Exporter un document en PDF
// ════════════════════════════════════════════════════════════
exports.exportPDF = async (req, res) => {
  let filePath = null;
  try {
    const { contenu, type, titreDocument } = req.body;

    if (!contenu || !type) {
      return res.status(400).json({ error: "Le contenu et le type sont requis." });
    }

    const typeInfo = obtenirType(type);
    const nomBase = (titreDocument || typeInfo?.nom || "document")
      .replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");

    const nomFichier = `${nomBase}_${Date.now()}`;
    filePath = await genererPDFTexte(contenu, nomFichier, "document", typeInfo?.nom?.toUpperCase());

    res.download(filePath, `${nomBase}.pdf`, (err) => {
      supprimerFichier(filePath);
      if (err && !res.headersSent) {
        res.status(500).json({ error: "Erreur lors du téléchargement du PDF." });
      }
    });
  } catch (err) {
    console.error("Erreur export PDF document :", err.message);
    if (filePath) supprimerFichier(filePath);
    res.status(500).json({ error: "Erreur lors de la génération du PDF." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/documents/docx — Exporter un document en Word
// ════════════════════════════════════════════════════════════
exports.exportDOCX = async (req, res) => {
  let filePath = null;
  try {
    const { contenu, type, titreDocument } = req.body;

    if (!contenu || !type) {
      return res.status(400).json({ error: "Le contenu et le type sont requis." });
    }

    const typeInfo = obtenirType(type);
    const nomBase = (titreDocument || typeInfo?.nom || "document")
      .replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");

    filePath = await genererDocumentDocx(contenu, nomBase);

    res.download(filePath, `${nomBase}.docx`, (err) => {
      supprimerFichier(filePath);
      if (err && !res.headersSent) {
        res.status(500).json({ error: "Erreur lors du téléchargement du document Word." });
      }
    });
  } catch (err) {
    console.error("Erreur export DOCX document :", err.message);
    if (filePath) supprimerFichier(filePath);
    res.status(500).json({ error: "Erreur lors de la génération du document Word." });
  }
};
