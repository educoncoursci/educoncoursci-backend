// ============================================================
//  controllers/adminMarketplaceController.js
//  Lot 14 — Administration de la Marketplace : gestion des
//  partenaires et modération des offres.
// ============================================================

const Partenaire = require("../models/Partenaire");
const OffreMarketplace = require("../models/OffreMarketplace");

// ── Partenaires ──────────────────────────────────────────────
exports.listerPartenaires = async (req, res) => {
  try {
    const partenaires = await Partenaire.findAll();
    res.json({ total: partenaires.length, partenaires });
  } catch (err) {
    console.error("Erreur liste partenaires :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.creerPartenaire = async (req, res) => {
  try {
    if (!req.body.nom) {
      return res.status(400).json({ error: "Le nom du partenaire est requis." });
    }
    const partenaire = await Partenaire.create(req.body);
    res.status(201).json({ message: "Partenaire créé.", partenaire });
  } catch (err) {
    console.error("Erreur création partenaire :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.modifierPartenaire = async (req, res) => {
  try {
    const partenaire = await Partenaire.update(req.params.id, req.body);
    if (!partenaire) return res.status(404).json({ error: "Partenaire introuvable." });
    res.json({ message: "Partenaire mis à jour.", partenaire });
  } catch (err) {
    console.error("Erreur modification partenaire :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.supprimerPartenaire = async (req, res) => {
  try {
    const ok = await Partenaire.supprimer(req.params.id);
    if (!ok) return res.status(404).json({ error: "Partenaire introuvable." });
    res.json({ message: "Partenaire supprimé (et ses offres avec lui)." });
  } catch (err) {
    console.error("Erreur suppression partenaire :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ── Offres ───────────────────────────────────────────────────
exports.listerOffres = async (req, res) => {
  try {
    const offres = await OffreMarketplace.findAll();
    res.json({ total: offres.length, offres });
  } catch (err) {
    console.error("Erreur liste offres (admin) :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.creerOffre = async (req, res) => {
  try {
    const { partenaireId, titre, description } = req.body;
    if (!partenaireId || !titre || !description) {
      return res.status(400).json({ error: "partenaireId, titre et description sont requis." });
    }
    const offre = await OffreMarketplace.create(req.body);
    res.status(201).json({ message: "Offre créée.", offre });
  } catch (err) {
    console.error("Erreur création offre :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.modifierOffre = async (req, res) => {
  try {
    const offre = await OffreMarketplace.update(req.params.id, req.body);
    if (!offre) return res.status(404).json({ error: "Offre introuvable." });
    res.json({ message: "Offre mise à jour.", offre });
  } catch (err) {
    console.error("Erreur modification offre :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.supprimerOffre = async (req, res) => {
  try {
    const ok = await OffreMarketplace.supprimer(req.params.id);
    if (!ok) return res.status(404).json({ error: "Offre introuvable." });
    res.json({ message: "Offre supprimée." });
  } catch (err) {
    console.error("Erreur suppression offre :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

exports.contactsOffre = async (req, res) => {
  try {
    const contacts = await OffreMarketplace.findContactsParOffre(req.params.id);
    res.json({ total: contacts.length, contacts });
  } catch (err) {
    console.error("Erreur contacts offre :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
