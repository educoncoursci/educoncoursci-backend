// ============================================================
//  controllers/concoursController.js
//  Gère : liste, détail, recherche, CRUD concours
// ============================================================

const Concours = require(”../models/Concours”);

// ════════════════════════════════════════════════════════════
//  GET /api/concours — Liste avec filtres
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
try {
const { categorie, statut, recherche, premium, limit, offset } = req.query;

```
// Les utilisateurs non-premium ne voient que le contenu gratuit
let filtrerPremium;
if (premium !== undefined) {
  filtrerPremium = premium === "true";
}

const concours = await Concours.findAll({
  categorie,
  statut,
  recherche,
  premium: filtrerPremium,
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
```

} catch (err) {
console.error(“Erreur liste concours :”, err.message);
res.status(500).json({ error: “Erreur lors de la récupération des concours.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/concours/:id — Fiche détaillée
// ════════════════════════════════════════════════════════════
exports.detail = async (req, res) => {
try {
const concours = await Concours.findById(req.params.id);
if (!concours) {
return res.status(404).json({ error: “Concours introuvable.” });
}

```
// Parse les colonnes JSON stockées en texte
concours.pieces  = JSON.parse(concours.pieces  || "[]");
concours.centres = JSON.parse(concours.centres || "[]");

// Vérifie si le contenu est Premium et si l'utilisateur a accès
if (concours.premium && req.user && !req.user.premium) {
  return res.status(403).json({
    error:   "Contenu réservé aux abonnés Premium.",
    premium: true,
  });
}

res.json({ concours });
```

} catch (err) {
console.error(“Erreur détail concours :”, err.message);
res.status(500).json({ error: “Erreur lors de la récupération du concours.” });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/concours — Créer (admin)
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
try {
const champs = req.body;

```
if (!champs.titre || !champs.organisme || !champs.categorie) {
  return res.status(400).json({
    error: "Titre, organisme et catégorie sont requis."
  });
}

const nouveau = await Concours.create(champs);
res.status(201).json({
  message:  "Concours créé avec succès.",
  concours: nouveau,
});
```

} catch (err) {
console.error(“Erreur créer concours :”, err.message);
res.status(500).json({ error: “Erreur lors de la création du concours.” });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/concours/:id — Modifier (admin)
// ════════════════════════════════════════════════════════════
exports.modifier = async (req, res) => {
try {
const concours = await Concours.findById(req.params.id);
if (!concours) {
return res.status(404).json({ error: “Concours introuvable.” });
}

```
const modifie = await Concours.update(req.params.id, req.body);
res.json({
  message:  "Concours modifié avec succès.",
  concours: modifie,
});
```

} catch (err) {
console.error(“Erreur modifier concours :”, err.message);
res.status(500).json({ error: “Erreur lors de la modification du concours.” });
}
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/concours/:id — Supprimer (admin)
// ════════════════════════════════════════════════════════════
exports.supprimer = async (req, res) => {
try {
const concours = await Concours.findById(req.params.id);
if (!concours) {
return res.status(404).json({ error: “Concours introuvable.” });
}

```
await Concours.delete(req.params.id);
res.json({ message: "Concours supprimé avec succès." });
```

} catch (err) {
console.error(“Erreur supprimer concours :”, err.message);
res.status(500).json({ error: “Erreur lors de la suppression du concours.” });
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
console.error(“Erreur concours ouverts :”, err.message);
res.status(500).json({ error: “Erreur serveur.” });
}
};