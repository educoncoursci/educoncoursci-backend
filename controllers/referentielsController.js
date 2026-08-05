// ============================================================
//  controllers/referentielsController.js
//  Gère : structures (organismes), matières, diplômes.
//  Lecture publique, écriture réservée aux admins.
// ============================================================

const Structure = require("../models/Structure");
const Matiere   = require("../models/Matiere");
const Diplome   = require("../models/Diplome");
const Categorie = require("../models/Categorie");
const Journal   = require("../models/Journal");

// ── Structures ────────────────────────────────────────────────
exports.listerStructures = async (req, res) => {
  try {
    const structures = await Structure.findAll();
    res.json({ structures });
  } catch (err) {
    console.error("Erreur listerStructures :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.creerStructure = async (req, res) => {
  try {
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: "Le nom est requis." });
    const structure = await Structure.create(req.body);
    Journal.enregistrer(req.user.id, req.user.nom, "création", "structure", structure.id, structure.nom);
    res.status(201).json({ structure });
  } catch (err) {
    console.error("Erreur creerStructure :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.modifierStructure = async (req, res) => {
  try {
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: "Le nom est requis." });
    const structure = await Structure.update(req.params.id, req.body);
    if (!structure) return res.status(404).json({ error: "Structure introuvable." });
    Journal.enregistrer(req.user.id, req.user.nom, "modification", "structure", structure.id, structure.nom);
    res.json({ structure });
  } catch (err) {
    console.error("Erreur modifierStructure :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.supprimerStructure = async (req, res) => {
  try {
    const ok = await Structure.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: "Structure introuvable." });
    Journal.enregistrer(req.user.id, req.user.nom, "suppression", "structure", req.params.id, null);
    res.json({ message: "Structure supprimée." });
  } catch (err) {
    console.error("Erreur supprimerStructure :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ── Matières ──────────────────────────────────────────────────
exports.listerMatieres = async (req, res) => {
  try {
    const matieres = await Matiere.findAll();
    res.json({ matieres });
  } catch (err) {
    console.error("Erreur listerMatieres :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.creerMatiere = async (req, res) => {
  try {
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: "Le nom est requis." });
    const matiere = await Matiere.create(req.body);
    Journal.enregistrer(req.user.id, req.user.nom, "création", "matiere", matiere.id, matiere.nom);
    res.status(201).json({ matiere });
  } catch (err) {
    console.error("Erreur creerMatiere :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.supprimerMatiere = async (req, res) => {
  try {
    const ok = await Matiere.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: "Matière introuvable." });
    Journal.enregistrer(req.user.id, req.user.nom, "suppression", "matiere", req.params.id, null);
    res.json({ message: "Matière supprimée." });
  } catch (err) {
    console.error("Erreur supprimerMatiere :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ── Diplômes ──────────────────────────────────────────────────
exports.listerDiplomes = async (req, res) => {
  try {
    const diplomes = await Diplome.findAll();
    res.json({ diplomes });
  } catch (err) {
    console.error("Erreur listerDiplomes :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.creerDiplome = async (req, res) => {
  try {
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: "Le nom est requis." });
    const diplome = await Diplome.create(req.body);
    Journal.enregistrer(req.user.id, req.user.nom, "création", "diplome", diplome.id, diplome.nom);
    res.status(201).json({ diplome });
  } catch (err) {
    console.error("Erreur creerDiplome :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.supprimerDiplome = async (req, res) => {
  try {
    const ok = await Diplome.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: "Diplôme introuvable." });
    Journal.enregistrer(req.user.id, req.user.nom, "suppression", "diplome", req.params.id, null);
    res.json({ message: "Diplôme supprimé." });
  } catch (err) {
    console.error("Erreur supprimerDiplome :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ── Catégories (Lot 4) ───────────────────────────────────────
exports.listerCategories = async (req, res) => {
  try {
    const categories = await Categorie.findAll();
    res.json({ categories });
  } catch (err) {
    console.error("Erreur listerCategories :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.creerCategorie = async (req, res) => {
  try {
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: "Le nom est requis." });
    const categorie = await Categorie.create(req.body);
    Journal.enregistrer(req.user.id, req.user.nom, "création", "categorie", categorie.id, categorie.nom);
    res.status(201).json({ categorie });
  } catch (err) {
    console.error("Erreur creerCategorie :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.supprimerCategorie = async (req, res) => {
  try {
    const ok = await Categorie.supprimer(req.params.id);
    if (!ok) return res.status(404).json({ error: "Catégorie introuvable." });
    Journal.enregistrer(req.user.id, req.user.nom, "suppression", "categorie", req.params.id, null);
    res.json({ message: "Catégorie supprimée." });
  } catch (err) {
    console.error("Erreur supprimerCategorie :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
