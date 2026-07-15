// ============================================================
//  routes/users.js
//  Préfixe : /api/users
//  Routes profil utilisateur connecté
// ============================================================

const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const User    = require("../models/User");
const Score   = require("../models/Score");

// GET /api/users/:id — Profil public
router.get("/:id", auth, async (req, res) => {
try {
const user = await User.findById(req.params.id);
if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

// Un utilisateur ne peut voir que son propre profil (sauf admin)
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
  return res.status(403).json({ error: "Accès refusé." });
}

const { password_hash, ...profil } = user;
res.json({ user: profil });

} catch (err) {
res.status(500).json({ error: err.message });
}
});

// PATCH /api/users/:id — Modifier profil
router.patch("/:id", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
return res.status(403).json({ error: "Accès refusé." });
}
const updated = await User.update(req.params.id, req.body);
res.json({ message: "Profil mis à jour.", user: updated });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// GET /api/users/:id/scores — Scores d'un utilisateur
router.get("/:id/scores", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
return res.status(403).json({ error: "Accès refusé." });
}
const scores = await Score.findByUser(req.params.id);
res.json({ scores });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// GET /api/users/:id/favoris — Favoris d'un utilisateur
router.get("/:id/favoris", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
return res.status(403).json({ error: "Accès refusé." });
}
const user    = await User.findById(req.params.id);
const favoris = JSON.parse(user?.favoris_json || "[]");
res.json({ favoris });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// PATCH /api/users/:id/favoris — Mettre à jour les favoris
router.patch("/:id/favoris", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id) {
return res.status(403).json({ error: "Accès refusé." });
}
const { favoris } = req.body;
await User.updateFavoris(req.params.id, favoris || []);
res.json({ message: "Favoris mis à jour.", favoris });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// GET /api/users/:id/paiements — Historique paiements
router.get("/:id/paiements", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
return res.status(403).json({ error: "Accès refusé." });
}
const Transaction = require("../models/Transaction");
const transactions = await Transaction.findByUser(req.params.id);
res.json({ transactions });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

module.exports = router;