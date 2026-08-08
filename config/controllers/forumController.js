// ============================================================
//  controllers/forumController.js
//  Lot 13 — Communauté : forum d'entraide entre candidats.
//  Lecture publique, écriture réservée aux comptes connectés,
//  suppression réservée à l'auteur ou à un admin.
// ============================================================

const Forum = require("../models/Forum");

// ════════════════════════════════════════════════════════════
//  GET /api/forum/sujets — Liste des sujets (public)
// ════════════════════════════════════════════════════════════
exports.listerSujets = async (req, res) => {
  try {
    const { categorie, concoursId, recherche, page = 1 } = req.query;
    const limit = 20;
    const offset = (parseInt(page, 10) - 1) * limit;

    const [sujets, total] = await Promise.all([
      Forum.listerSujets({ categorie, concoursId, recherche, limit, offset }),
      Forum.count({ categorie, concoursId }),
    ]);

    res.json({ sujets, total, page: parseInt(page, 10), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Erreur liste sujets forum :", err.message);
    res.status(500).json({ error: "Erreur lors du chargement du forum." });
  }
};

// ════════════════════════════════════════════════════════════
//  GET /api/forum/sujets/:id — Détail d'un sujet + réponses (public)
// ════════════════════════════════════════════════════════════
exports.detailSujet = async (req, res) => {
  try {
    const sujet = await Forum.findSujetById(req.params.id);
    if (!sujet) {
      return res.status(404).json({ error: "Sujet introuvable." });
    }
    await Forum.incrementerVues(req.params.id);
    const reponses = await Forum.listerReponses(req.params.id);
    res.json({ sujet: { ...sujet, vues: sujet.vues + 1 }, reponses });
  } catch (err) {
    console.error("Erreur détail sujet forum :", err.message);
    res.status(500).json({ error: "Erreur lors du chargement du sujet." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/forum/sujets — Créer un sujet (connecté requis)
// ════════════════════════════════════════════════════════════
exports.creerSujet = async (req, res) => {
  try {
    const { titre, contenu, categorie, concoursId } = req.body;

    if (!titre || titre.trim().length < 5) {
      return res.status(400).json({ error: "Le titre doit contenir au moins 5 caractères." });
    }
    if (!contenu || contenu.trim().length < 10) {
      return res.status(400).json({ error: "Le message doit contenir au moins 10 caractères." });
    }

    const sujet = await Forum.creerSujet(req.user.id, {
      titre: titre.trim(),
      contenu: contenu.trim(),
      categorie,
      concoursId,
    });
    res.status(201).json({ message: "Sujet publié.", sujet });
  } catch (err) {
    console.error("Erreur création sujet forum :", err.message);
    res.status(500).json({ error: "Erreur lors de la publication du sujet." });
  }
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/forum/sujets/:id — Supprimer un sujet (auteur ou admin)
// ════════════════════════════════════════════════════════════
exports.supprimerSujet = async (req, res) => {
  try {
    const sujet = await Forum.findSujetById(req.params.id);
    if (!sujet) {
      return res.status(404).json({ error: "Sujet introuvable." });
    }
    if (sujet.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Tu ne peux supprimer que tes propres sujets." });
    }
    await Forum.supprimerSujet(req.params.id);
    res.json({ message: "Sujet supprimé." });
  } catch (err) {
    console.error("Erreur suppression sujet forum :", err.message);
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/forum/sujets/:id/epingler — Épingler/désépingler (admin)
// ════════════════════════════════════════════════════════════
exports.epinglerSujet = async (req, res) => {
  try {
    const sujet = await Forum.epingler(req.params.id, req.body.epingle !== false);
    if (!sujet) {
      return res.status(404).json({ error: "Sujet introuvable." });
    }
    res.json({ message: sujet.epingle ? "Sujet épinglé." : "Sujet désépinglé.", sujet });
  } catch (err) {
    console.error("Erreur épinglage sujet forum :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/forum/sujets/:id/reponses — Répondre (connecté requis)
// ════════════════════════════════════════════════════════════
exports.repondre = async (req, res) => {
  try {
    const sujet = await Forum.findSujetById(req.params.id);
    if (!sujet) {
      return res.status(404).json({ error: "Sujet introuvable." });
    }
    const { contenu } = req.body;
    if (!contenu || contenu.trim().length < 2) {
      return res.status(400).json({ error: "La réponse est trop courte." });
    }
    const reponse = await Forum.repondre(req.params.id, req.user.id, contenu.trim());
    res.status(201).json({ message: "Réponse publiée.", reponse: { ...reponse, auteur_nom: req.user.nom } });
  } catch (err) {
    console.error("Erreur réponse forum :", err.message);
    res.status(500).json({ error: "Erreur lors de la publication de la réponse." });
  }
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/forum/reponses/:id — Supprimer une réponse (auteur ou admin)
// ════════════════════════════════════════════════════════════
exports.supprimerReponse = async (req, res) => {
  try {
    const reponse = await Forum.findReponseById(req.params.id);
    if (!reponse) {
      return res.status(404).json({ error: "Réponse introuvable." });
    }
    if (reponse.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Tu ne peux supprimer que tes propres réponses." });
    }
    await Forum.supprimerReponse(req.params.id);
    res.json({ message: "Réponse supprimée." });
  } catch (err) {
    console.error("Erreur suppression réponse forum :", err.message);
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
};
