// ============================================================
//  controllers/concoursController.js
//  Gère : liste, détail, recherche, CRUD concours
// ============================================================

const Concours = require("../models/Concours");
const Journal  = require("../models/Journal");

// ════════════════════════════════════════════════════════════
//  GET /api/concours — Liste avec filtres
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
try {
const { categorie, statut, recherche, premium, structureId, limit, offset } = req.query;

// Les utilisateurs non-premium ne voient que le contenu gratuit
let filtrerPremium;
if (premium !== undefined) {
  filtrerPremium = premium === "true";
}

const concours = await Concours.findAll({
  categorie,
  statut,
  search: recherche,
  premium: filtrerPremium,
  structureId: structureId ? parseInt(structureId) : undefined,
  limit:  parseInt(limit)  || 50,
  offset: parseInt(offset) || 0,
});

// Récupère les catégories disponibles pour les filtres frontend
const categories = await Concours.getCategories();

res.json({
  total:      concours.length,
  categories,
  concours,
});

} catch (err) {
console.error("Erreur liste concours :", err.message);
res.status(500).json({ error: "Erreur lors de la récupération des concours." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/concours/:id — Fiche détaillée
// ════════════════════════════════════════════════════════════
exports.detail = async (req, res) => {
try {
const concours = await Concours.findByIdEnrichi(req.params.id);
if (!concours) {
return res.status(404).json({ error: "Concours introuvable." });
}

// NOTE : concours.pieces / concours.centres sont déjà des tableaux
// (parsés par le modèle) — ne pas les re-parser avec JSON.parse ici,
// ça provoquait une erreur 500 systématique sur cette route.

// Vérifie si le contenu est Premium et si l'utilisateur a accès
// (les admins voient toujours tout, y compris pour l'édition en back-office)
if (concours.premium && req.user && req.user.role !== "admin" && !req.user.premium) {
  return res.status(403).json({
    error:   "Contenu réservé aux abonnés Premium.",
    premium: true,
  });
}

res.json({ concours });

} catch (err) {
console.error("Erreur détail concours :", err.message);
res.status(500).json({ error: "Erreur lors de la récupération du concours." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/concours — Créer (admin)
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
try {
const champs = req.body;

if (!champs.titre || !champs.organisme || !champs.categorie) {
  return res.status(400).json({
    error: "Titre, organisme et catégorie sont requis."
  });
}

const nouveau = await Concours.create(champs);

// Relations optionnelles matières / diplômes (Module 1)
const Matiere = require("../models/Matiere");
const Diplome = require("../models/Diplome");
if (Array.isArray(champs.matiereIds)) {
  await Matiere.definirPourConcours(nouveau.id, champs.matiereIds);
}
if (Array.isArray(champs.diplomeIds)) {
  await Diplome.definirPourConcours(nouveau.id, champs.diplomeIds);
}

res.status(201).json({
  message:  "Concours créé avec succès.",
  concours: nouveau,
});
Journal.enregistrer(req.user.id, req.user.nom, "création", "concours", nouveau.id, nouveau.titre);

} catch (err) {
console.error("Erreur créer concours :", err.message);
if (err.code === "23505") {
  return res.status(409).json({
    error: "Un concours avec ce titre et cet organisme existe déjà en base — modifie le titre ou l'organisme, ou édite directement la fiche existante.",
  });
}
res.status(500).json({ error: "Erreur lors de la création du concours." });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/concours/:id — Modifier (admin)
// ════════════════════════════════════════════════════════════
exports.modifier = async (req, res) => {
try {
const concours = await Concours.findById(req.params.id);
if (!concours) {
return res.status(404).json({ error: "Concours introuvable." });
}

const modifie = await Concours.update(req.params.id, req.body);

// Relations optionnelles matières / diplômes (Module 1)
const Matiere = require("../models/Matiere");
const Diplome = require("../models/Diplome");
if (Array.isArray(req.body.matiereIds)) {
  await Matiere.definirPourConcours(req.params.id, req.body.matiereIds);
}
if (Array.isArray(req.body.diplomeIds)) {
  await Diplome.definirPourConcours(req.params.id, req.body.diplomeIds);
}

res.json({
  message:  "Concours modifié avec succès.",
  concours: modifie,
});
Journal.enregistrer(req.user.id, req.user.nom, "modification", "concours", req.params.id, modifie.titre);

} catch (err) {
console.error("Erreur modifier concours :", err.message);
res.status(500).json({ error: "Erreur lors de la modification du concours." });
}
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/concours/:id — Supprimer (admin)
// ════════════════════════════════════════════════════════════
exports.supprimer = async (req, res) => {
try {
const concours = await Concours.findById(req.params.id);
if (!concours) {
return res.status(404).json({ error: "Concours introuvable." });
}

await Concours.delete(req.params.id);
Journal.enregistrer(req.user.id, req.user.nom, "suppression", "concours", req.params.id, concours.titre);
res.json({ message: "Concours supprimé avec succès." });

} catch (err) {
console.error("Erreur supprimer concours :", err.message);
res.status(500).json({ error: "Erreur lors de la suppression du concours." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/concours/ouverts — Concours ouverts (pour alertes)
// ════════════════════════════════════════════════════════════
exports.ouverts = async (req, res) => {
try {
const concours = await Concours.findOuverts();
res.json({ concours });
} catch (err) {
console.error("Erreur concours ouverts :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};