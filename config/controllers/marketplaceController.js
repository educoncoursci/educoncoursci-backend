// ============================================================
//  controllers/marketplaceController.js
//  Lot 14 — Marketplace (façade publique). Liste/détail des
//  offres publiées et envoi d'une demande de contact/devis au
//  partenaire. Aucun paiement en ligne dans cette première
//  version — EduConcoursCI met en relation, la transaction se
//  fait directement entre le candidat et le partenaire.
// ============================================================

const OffreMarketplace = require("../models/OffreMarketplace");

// ════════════════════════════════════════════════════════════
//  GET /api/marketplace/offres — Liste des offres publiées (public)
// ════════════════════════════════════════════════════════════
exports.listerOffres = async (req, res) => {
  try {
    const { categorie, page = 1 } = req.query;
    const limit = 20;
    const offset = (parseInt(page, 10) - 1) * limit;

    const [offres, total] = await Promise.all([
      OffreMarketplace.findPubliees({ categorie, limit, offset }),
      OffreMarketplace.countPubliees(categorie),
    ]);

    res.json({ offres, total, page: parseInt(page, 10), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Erreur liste offres marketplace :", err.message);
    res.status(500).json({ error: "Erreur lors du chargement de la marketplace." });
  }
};

// ════════════════════════════════════════════════════════════
//  GET /api/marketplace/offres/:id — Détail d'une offre (public)
// ════════════════════════════════════════════════════════════
exports.detailOffre = async (req, res) => {
  try {
    const offre = await OffreMarketplace.findById(req.params.id);
    if (!offre || offre.statut !== "publiee") {
      return res.status(404).json({ error: "Offre introuvable." });
    }
    res.json({ offre });
  } catch (err) {
    console.error("Erreur détail offre marketplace :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/marketplace/offres/:id/contact — Demande de devis
//  (authOptionnel — utilisable connecté ou non, mais nom/email requis)
// ════════════════════════════════════════════════════════════
exports.contacterPartenaire = async (req, res) => {
  try {
    const offre = await OffreMarketplace.findById(req.params.id);
    if (!offre || offre.statut !== "publiee") {
      return res.status(404).json({ error: "Offre introuvable." });
    }

    const { nom, email, telephone, message } = req.body;
    if (!nom || !email) {
      return res.status(400).json({ error: "Nom et email sont requis." });
    }

    const contact = await OffreMarketplace.creerContact({
      offreId: req.params.id,
      userId: req.user?.id || null,
      nom,
      email,
      telephone,
      message,
    });

    res.status(201).json({
      message: `Ta demande a été transmise à ${offre.partenaire_nom}. Il te recontactera directement.`,
      contact,
    });
  } catch (err) {
    console.error("Erreur contact marketplace :", err.message);
    res.status(500).json({ error: "Erreur lors de l'envoi de la demande." });
  }
};
