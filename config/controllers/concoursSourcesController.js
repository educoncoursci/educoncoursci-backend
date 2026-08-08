// ============================================================
//  controllers/concoursSourcesController.js
//  Lot 18 — Administration des sources RSS et de la file de
//  validation des concours détectés automatiquement.
// ============================================================

const ConcoursSource     = require("../models/ConcoursSource");
const ConcoursSuggestion = require("../models/ConcoursSuggestion");
const Concours           = require("../models/Concours");
const { detecterNouveauxConcours } = require("../services/concoursFeed");

// ── Sources ──────────────────────────────────────────────────
exports.listerSources = async (req, res) => {
  try {
    const sources = await ConcoursSource.findAll();
    res.json({ total: sources.length, sources });
  } catch (err) {
    console.error("Erreur liste sources concours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.ajouterSource = async (req, res) => {
  try {
    const { nom, url } = req.body;
    if (!nom || !url) {
      return res.status(400).json({ error: "nom et url sont requis." });
    }
    const source = await ConcoursSource.create({ nom, url });
    if (!source) {
      return res.status(409).json({ error: "Cette source existe déjà." });
    }
    res.status(201).json({ message: "Source ajoutée.", source });
  } catch (err) {
    console.error("Erreur ajout source concours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.basculerSource = async (req, res) => {
  try {
    const source = await ConcoursSource.toggleActif(req.params.id, req.body.actif !== false);
    if (!source) return res.status(404).json({ error: "Source introuvable." });
    res.json({ message: "Source mise à jour.", source });
  } catch (err) {
    console.error("Erreur bascule source concours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.supprimerSource = async (req, res) => {
  try {
    const ok = await ConcoursSource.supprimer(req.params.id);
    if (!ok) return res.status(404).json({ error: "Source introuvable." });
    res.json({ message: "Source supprimée." });
  } catch (err) {
    console.error("Erreur suppression source concours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ── Déclenchement manuel de la détection (pratique pour tester) ──
exports.declencherDetection = async (req, res) => {
  try {
    const total = await detecterNouveauxConcours();
    res.json({ message: `${total} nouvelle(s) suggestion(s) détectée(s).`, total });
  } catch (err) {
    console.error("Erreur déclenchement détection concours :", err.message);
    res.status(500).json({ error: "Erreur lors de la détection." });
  }
};

// ── Suggestions (file de validation) ────────────────────────
exports.listerSuggestions = async (req, res) => {
  try {
    const suggestions = await ConcoursSuggestion.findEnAttente();
    res.json({ total: suggestions.length, suggestions });
  } catch (err) {
    console.error("Erreur liste suggestions concours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// Rejeter : simple, on marque juste comme rejetée (le hash reste en
// base pour ne pas re-proposer le même article en boucle)
exports.rejeterSuggestion = async (req, res) => {
  try {
    const suggestion = await ConcoursSuggestion.findById(req.params.id);
    if (!suggestion) return res.status(404).json({ error: "Suggestion introuvable." });
    await ConcoursSuggestion.marquerRejetee(req.params.id);
    res.json({ message: "Suggestion rejetée." });
  } catch (err) {
    console.error("Erreur rejet suggestion concours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// Approuver : crée un vrai concours à partir des infos que l'admin a
// complétées dans le formulaire (le titre est pré-rempli depuis la
// suggestion, mais l'admin doit renseigner/valider organisme, dates,
// etc. avant que ce ne soit publié — pas de publication à l'aveugle).
exports.approuverSuggestion = async (req, res) => {
  try {
    const suggestion = await ConcoursSuggestion.findById(req.params.id);
    if (!suggestion) return res.status(404).json({ error: "Suggestion introuvable." });

    const champsConcours = { ...req.body, statutAuto: req.body.statutAuto !== false };
    if (!champsConcours.titre || !champsConcours.organisme || !champsConcours.categorie) {
      return res.status(400).json({ error: "titre, organisme et categorie sont requis pour publier le concours." });
    }

    const concours = await Concours.create(champsConcours);
    await ConcoursSuggestion.marquerApprouvee(req.params.id, concours.id);

    res.status(201).json({ message: "Concours publié à partir de la suggestion.", concours });
  } catch (err) {
    console.error("Erreur approbation suggestion concours :", err.message);
    res.status(500).json({ error: "Erreur lors de la publication du concours." });
  }
};
