// ============================================================
//  controllers/actualiteController.js
//  Gère : carrousel public, liste admin, CRUD manuel,
//  déclenchement manuel de la synchronisation du flux RSS.
// ============================================================

const Actualite = require("../models/Actualite");
const { synchroniser } = require("../services/actualitesFeed");

// ════════════════════════════════════════════════════════════
//  GET /api/actualites/carrousel — Données du carrousel (public)
// ════════════════════════════════════════════════════════════
exports.carrousel = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
    const actualites = await Actualite.findCarrousel(limit);
    res.json({ total: actualites.length, actualites });
  } catch (err) {
    console.error("Erreur carrousel actualités :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des actualités." });
  }
};

// ════════════════════════════════════════════════════════════
//  GET /api/actualites — Liste complète (admin)
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
  try {
    const { tag, origine, actif, limit, offset } = req.query;
    let filtrerActif;
    if (actif !== undefined) filtrerActif = actif === "true";

    const actualites = await Actualite.findAll({
      tag,
      origine,
      actif: filtrerActif,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    res.json({ total: actualites.length, actualites });
  } catch (err) {
    console.error("Erreur liste actualités :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des actualités." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/actualites — Ajout manuel (admin)
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
  try {
    const { titre, tag, source_nom, source_url, lien, publie_le, actif, ordre } = req.body;
    if (!titre) return res.status(400).json({ error: "Le titre est requis." });

    const actualite = await Actualite.create({
      titre, tag, source_nom, source_url, lien, publie_le, actif, ordre,
    });
    res.status(201).json({ message: "Actualité ajoutée avec succès.", actualite });
  } catch (err) {
    console.error("Erreur créer actualité :", err.message);
    res.status(500).json({ error: "Erreur lors de l'ajout de l'actualité." });
  }
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/actualites/:id — Modifier (admin)
// ════════════════════════════════════════════════════════════
exports.modifier = async (req, res) => {
  try {
    const existante = await Actualite.findById(req.params.id);
    if (!existante) return res.status(404).json({ error: "Actualité introuvable." });

    const modifiee = await Actualite.update(req.params.id, req.body);
    res.json({ message: "Actualité modifiée avec succès.", actualite: modifiee });
  } catch (err) {
    console.error("Erreur modifier actualité :", err.message);
    res.status(500).json({ error: "Erreur lors de la modification." });
  }
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/actualites/:id — Supprimer (admin)
// ════════════════════════════════════════════════════════════
exports.supprimer = async (req, res) => {
  try {
    const existante = await Actualite.findById(req.params.id);
    if (!existante) return res.status(404).json({ error: "Actualité introuvable." });

    await Actualite.delete(req.params.id);
    res.json({ message: "Actualité supprimée avec succès." });
  } catch (err) {
    console.error("Erreur supprimer actualité :", err.message);
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/actualites/actualiser — Forcer la synchro (admin)
// ════════════════════════════════════════════════════════════
exports.actualiser = async (req, res) => {
  try {
    const nombreAjoutees = await synchroniser();
    res.json({
      message: `Synchronisation terminée : ${nombreAjoutees} nouvelle(s) actualité(s).`,
      ajoutees: nombreAjoutees,
    });
  } catch (err) {
    console.error("Erreur actualisation manuelle :", err.message);
    res.status(500).json({ error: "Erreur lors de la synchronisation du flux." });
  }
};
