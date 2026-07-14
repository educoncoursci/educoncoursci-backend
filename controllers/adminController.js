// ============================================================
//  controllers/adminController.js
//  Tableau de bord admin : stats globales, gestion utilisateurs
// ============================================================

const User        = require(”../models/User”);
const Concours    = require(”../models/Concours”);
const PDF         = require(”../models/PDF”);
const Video       = require(”../models/Video”);
const QCM         = require(”../models/QCM”);
const Score       = require(”../models/Score”);
const Transaction = require(”../models/Transaction”);
const { query }   = require(”../config/database”);

// ════════════════════════════════════════════════════════════
//  GET /api/admin/stats — Statistiques globales du tableau de bord
// ════════════════════════════════════════════════════════════
exports.stats = async (req, res) => {
try {
// Récupère toutes les stats en parallèle
const [
totalUsers,
totalPremium,
totalConcours,
totalPDFs,
totalVideos,
totalQCM,
totalScores,
revenusTotal,
revenusQMois,
totalTransactions,
dernieresTransactions,
derniersInscrits,
] = await Promise.all([
User.count(),
User.countPremium(),
Concours.count(),
PDF.count(),
Video.count(),
QCM.count(),
Score.count(),
Transaction.totalRevenus(),
Transaction.revenusduMois(),
Transaction.count(),
Transaction.findAll({ limit: 5 }),
User.findAll({ limit: 5 }),
]);

```
// Revenus des 6 derniers mois pour le graphique
const graphiqueResult = await query(`
  SELECT
    TO_CHAR(date_trunc('month', date), 'Mon YYYY') AS mois,
    COALESCE(SUM(montant), 0) AS revenus,
    COUNT(*) AS transactions
  FROM transactions
  WHERE statut = 'validé'
    AND date >= NOW() - INTERVAL '6 months'
  GROUP BY date_trunc('month', date)
  ORDER BY date_trunc('month', date) ASC
`);

// Répartition des plans Premium
const plansResult = await query(`
  SELECT premium_plan, COUNT(*) as total
  FROM users
  WHERE premium = TRUE AND premium_plan IS NOT NULL
  GROUP BY premium_plan
`);

// Répartition des moyens de paiement
const moyensResult = await query(`
  SELECT moyen, COUNT(*) as total, SUM(montant) as revenus
  FROM transactions
  WHERE statut = 'validé'
  GROUP BY moyen
`);

res.json({
  utilisateurs: {
    total:   totalUsers,
    premium: totalPremium,
    gratuit: totalUsers - totalPremium,
    tauxConversion: totalUsers > 0
      ? Math.round((totalPremium / totalUsers) * 100)
      : 0,
  },
  contenu: {
    concours: totalConcours,
    pdfs:     totalPDFs,
    videos:   totalVideos,
    qcm:      totalQCM,
    scores:   totalScores,
  },
  finances: {
    revenus_total:       revenusTotal,
    revenus_mois:        revenusQMois,
    total_transactions:  totalTransactions,
    revenus_formate:     `${revenusTotal.toLocaleString("fr-CI")} FCFA`,
    revenus_mois_formate:`${revenusQMois.toLocaleString("fr-CI")} FCFA`,
  },
  graphique:           graphiqueResult.rows,
  repartition_plans:   plansResult.rows,
  repartition_moyens:  moyensResult.rows,
  derniers_inscrits:   derniersInscrits,
  dernieres_transactions: dernieresTransactions,
});
```

} catch (err) {
console.error(“Erreur stats admin :”, err.message);
res.status(500).json({ error: “Erreur lors de la récupération des statistiques.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/admin/users — Liste de tous les utilisateurs
// ════════════════════════════════════════════════════════════
exports.getUsers = async (req, res) => {
try {
const { limit, offset, recherche } = req.query;
let utilisateurs;

```
if (recherche) {
  const result = await query(
    `SELECT id, nom, email, role, premium, premium_plan,
            premium_expire, date_inscription
     FROM users
     WHERE nom ILIKE $1 OR email ILIKE $1
     ORDER BY date_inscription DESC
     LIMIT $2 OFFSET $3`,
    [`%${recherche}%`, parseInt(limit) || 50, parseInt(offset) || 0]
  );
  utilisateurs = result.rows;
} else {
  utilisateurs = await User.findAll({
    limit:  parseInt(limit)  || 50,
    offset: parseInt(offset) || 0,
  });
}

res.json({
  total:        utilisateurs.length,
  utilisateurs,
});
```

} catch (err) {
console.error(“Erreur getUsers admin :”, err.message);
res.status(500).json({ error: “Erreur serveur.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/admin/abonnes — Liste des abonnés Premium
// ════════════════════════════════════════════════════════════
exports.getAbonnes = async (req, res) => {
try {
const abonnes = await User.findPremium();
const revenus = await Transaction.totalRevenus();

```
res.json({
  total:   abonnes.length,
  revenus: `${revenus.toLocaleString("fr-CI")} FCFA`,
  abonnes,
});
```

} catch (err) {
console.error(“Erreur getAbonnes :”, err.message);
res.status(500).json({ error: “Erreur serveur.” });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/admin/users/:id — Modifier un utilisateur
// ════════════════════════════════════════════════════════════
exports.updateUser = async (req, res) => {
try {
const { id }   = req.params;
const { role, premium, premium_plan, premium_expire } = req.body;

```
const user = await User.findById(id);
if (!user) {
  return res.status(404).json({ error: "Utilisateur introuvable." });
}

// Empêche de modifier son propre rôle admin
if (parseInt(id) === req.user.id && role && role !== "admin") {
  return res.status(403).json({
    error: "Tu ne peux pas retirer ton propre rôle admin."
  });
}

// Mise à jour du rôle
if (role) await User.setRole(id, role);

// Mise à jour du Premium
if (premium !== undefined) {
  await User.setPremium(id, {
    premium: premium === true || premium === "true",
    plan:    premium_plan || null,
    expire:  premium_expire || null,
  });
}

const userMisAJour = await User.findById(id);
res.json({
  message: "Utilisateur mis à jour avec succès.",
  user:    userMisAJour,
});
```

} catch (err) {
console.error(“Erreur updateUser admin :”, err.message);
res.status(500).json({ error: “Erreur lors de la mise à jour.” });
}
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/admin/users/:id — Supprimer un utilisateur
// ════════════════════════════════════════════════════════════
exports.deleteUser = async (req, res) => {
try {
const { id } = req.params;

```
// Empêche de se supprimer soi-même
if (parseInt(id) === req.user.id) {
  return res.status(403).json({
    error: "Tu ne peux pas supprimer ton propre compte admin."
  });
}

const user = await User.findById(id);
if (!user) {
  return res.status(404).json({ error: "Utilisateur introuvable." });
}

await User.delete(id);
res.json({
  message: `Utilisateur ${user.nom} (${user.email}) supprimé avec succès.`
});
```

} catch (err) {
console.error(“Erreur deleteUser admin :”, err.message);
res.status(500).json({ error: “Erreur lors de la suppression.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/admin/scores — Tous les scores (classement général)
// ════════════════════════════════════════════════════════════
exports.getScores = async (req, res) => {
try {
const result = await query(`SELECT s.id, s.score, s.total, s.pourcentage, s.qcm_titre, s.date, u.nom AS user_nom, u.email AS user_email FROM scores s JOIN users u ON s.user_id = u.id ORDER BY s.pourcentage DESC, s.date DESC LIMIT $1`, [parseInt(req.query.limit) || 100]);

```
res.json({
  total:  result.rows.length,
  scores: result.rows,
});
```

} catch (err) {
console.error(“Erreur getScores admin :”, err.message);
res.status(500).json({ error: “Erreur serveur.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/admin/export/users — Exporte les utilisateurs CSV
// ════════════════════════════════════════════════════════════
exports.exportUsers = async (req, res) => {
try {
const utilisateurs = await User.findAll({ limit: 10000 });

```
// Génère le CSV
const entetes  = ["ID", "Nom", "Email", "Role", "Premium", "Plan", "Expiration", "Inscription"];
const lignes   = utilisateurs.map(u => [
  u.id, u.nom, u.email, u.role,
  u.premium ? "Oui" : "Non",
  u.premium_plan  || "",
  u.premium_expire|| "",
  new Date(u.date_inscription).toLocaleDateString("fr-FR"),
].map(v => `"${v}"`).join(","));

const csv = [entetes.join(","), ...lignes].join("\n");

res.setHeader("Content-Type", "text/csv; charset=utf-8");
res.setHeader("Content-Disposition",
  `attachment; filename="utilisateurs_${Date.now()}.csv"`);
res.send("\uFEFF" + csv); // BOM pour Excel
```

} catch (err) {
console.error(“Erreur export CSV :”, err.message);
res.status(500).json({ error: “Erreur lors de l’export.” });
}
};