// ============================================================
//  controllers/assistanceSocialeController.js
//  Gère : annuaire des structures, numéros d'urgence,
//  génération de documents sociaux, et assistant IA social.
// ============================================================

const {
  genererRapportSocial, genererDemandeAideSociale,
  genererFicheLiaison, genererProjetIntervention,
} = require("../services/documentsSociauxClaude");
const { genererPDFTexte, supprimerFichier } = require("../services/pdf");
const { genererDocumentDocx } = require("../services/docx");
const { listerTypesSociaux, obtenirTypeSocial } = require("../config/typesDocumentsSociaux");
const { STRUCTURES_AIDE } = require("../config/structuresAide");
const { NUMEROS_URGENCE } = require("../config/urgencesSociales");
const { repondreAssistantSocial } = require("../services/assistantSocialClaude");

const GENERATEURS = {
  rapport_social: genererRapportSocial,
  demande_aide_sociale: genererDemandeAideSociale,
  fiche_liaison: genererFicheLiaison,
  projet_intervention: genererProjetIntervention,
};

// ════════════════════════════════════════════════════════════
//  GET /api/assistance-sociale/urgences — Numéros d'urgence (public)
// ════════════════════════════════════════════════════════════
exports.urgences = (req, res) => {
  res.json({ numeros: NUMEROS_URGENCE });
};

// ════════════════════════════════════════════════════════════
//  GET /api/assistance-sociale/structures — Annuaire (public)
// ════════════════════════════════════════════════════════════
exports.structures = (req, res) => {
  const { categorie } = req.query;
  let structures = STRUCTURES_AIDE;
  if (categorie) {
    structures = structures.filter(s =>
      s.categorie.toLowerCase().includes(categorie.toLowerCase())
    );
  }
  res.json({ total: structures.length, structures });
};

// ════════════════════════════════════════════════════════════
//  GET /api/assistance-sociale/documents/types — Types (public)
// ════════════════════════════════════════════════════════════
exports.listerTypes = (req, res) => {
  try {
    res.json({ types: listerTypesSociaux() });
  } catch (err) {
    console.error("Erreur liste types documents sociaux :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des types de documents." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/assistance-sociale/documents/generate — Générer
// ════════════════════════════════════════════════════════════
exports.genererDocument = async (req, res) => {
  try {
    const { type, ...donnees } = req.body;

    if (!type || !GENERATEURS[type]) {
      return res.status(400).json({
        error: "Type de document invalide. Types disponibles : " + Object.keys(GENERATEURS).join(", ")
      });
    }

    const typeInfo = obtenirTypeSocial(type);
    const champsManquants = (typeInfo.champsRequis || []).filter(champ => {
      const valeur = donnees[champ];
      return valeur === undefined || valeur === null || valeur === "";
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

    res.json({ message: "Document généré avec succès.", document: contenu, type });
  } catch (err) {
    console.error("Erreur génération document social :", err.message);
    if (err.message.includes("API")) {
      return res.status(503).json({
        error: "Service IA temporairement indisponible. Réessaie dans quelques instants."
      });
    }
    res.status(500).json({ error: "Erreur lors de la génération du document." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/assistance-sociale/documents/pdf — Export PDF
// ════════════════════════════════════════════════════════════
exports.exportPDF = async (req, res) => {
  let filePath = null;
  try {
    const { contenu, type, titreDocument } = req.body;
    if (!contenu || !type) {
      return res.status(400).json({ error: "Le contenu et le type sont requis." });
    }
    const typeInfo = obtenirTypeSocial(type);
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
    console.error("Erreur export PDF document social :", err.message);
    if (filePath) supprimerFichier(filePath);
    res.status(500).json({ error: "Erreur lors de la génération du PDF." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/assistance-sociale/documents/docx — Export Word
// ════════════════════════════════════════════════════════════
exports.exportDOCX = async (req, res) => {
  let filePath = null;
  try {
    const { contenu, type, titreDocument } = req.body;
    if (!contenu || !type) {
      return res.status(400).json({ error: "Le contenu et le type sont requis." });
    }
    const typeInfo = obtenirTypeSocial(type);
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
    console.error("Erreur export DOCX document social :", err.message);
    if (filePath) supprimerFichier(filePath);
    res.status(500).json({ error: "Erreur lors de la génération du document Word." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/assistance-sociale/assistant — Assistant IA social
// ════════════════════════════════════════════════════════════
exports.assistant = async (req, res) => {
  try {
    const { message, historique } = req.body;

    if (!message || message.trim().length < 2) {
      return res.status(400).json({ error: "Le message est requis." });
    }

    const reponse = await repondreAssistantSocial(message, historique || []);
    res.json(reponse);
  } catch (err) {
    console.error("Erreur assistant social IA :", err.message);
    if (err.message.includes("API")) {
      return res.status(503).json({ error: "Service IA temporairement indisponible." });
    }
    res.status(500).json({ error: "Erreur lors de la réponse de l'assistant." });
  }
};
