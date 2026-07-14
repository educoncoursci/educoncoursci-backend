// ============================================================
//  controllers/paymentController.js
//  Gère : instructions paiement, vérification ID transaction,
//         activation Premium, historique, résiliation
// ============================================================

const Transaction = require(”../models/Transaction”);
const User        = require(”../models/User”);
const Wave        = require(”../services/wave”);
const Orange      = require(”../services/orange”);

// Plans disponibles
const PLANS = {
“1 Mois”:  { montant: 2000,  dureeJours: 30  },
“3 Mois”:  { montant: 5000,  dureeJours: 90  },
“12 Mois”: { montant: 15000, dureeJours: 365 },
};

// ════════════════════════════════════════════════════════════
//  GET /api/payment/plans — Plans & instructions de paiement
// ════════════════════════════════════════════════════════════
exports.getPlans = async (req, res) => {
try {
const { plan } = req.query;

```
const plans = Object.entries(PLANS).map(([label, data]) => ({
  label,
  montant:     data.montant,
  dureeJours:  data.dureeJours,
  montantFormate: `${data.montant.toLocaleString("fr-CI")} FCFA`,
}));

// Si un plan est précisé, retourne aussi les instructions de paiement
let instructions = null;
if (plan && PLANS[plan]) {
  instructions = {
    wave:   Wave.getInstructions(plan),
    orange: Orange.getInstructions(plan),
  };
}

res.json({ plans, instructions });
```

} catch (err) {
console.error(“Erreur getPlans :”, err.message);
res.status(500).json({ error: “Erreur serveur.” });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/payment/verify — Vérifier l’ID + activer Premium
// ════════════════════════════════════════════════════════════
exports.verify = async (req, res) => {
try {
const { txId, moyen, plan } = req.body;

```
// ── Validations de base ───────────────────────────────────
if (!txId || !moyen || !plan) {
  return res.status(400).json({
    error: "Identifiant de transaction, moyen de paiement et plan sont requis."
  });
}

if (!PLANS[plan]) {
  return res.status(400).json({
    error: `Plan invalide. Plans disponibles : ${Object.keys(PLANS).join(", ")}`
  });
}

// ── Normaliser l'ID ───────────────────────────────────────
const txIdNormalise = moyen === "wave"
  ? Wave.normaliserTxId(txId)
  : Orange.normaliserTxId(txId);

// ── Valider le format selon le moyen de paiement ─────────
let formatValide = false;
if (moyen === "wave") {
  formatValide = Wave.validerFormatId(txIdNormalise);
} else if (moyen === "orange") {
  formatValide = Orange.validerFormatId(txIdNormalise);
} else {
  return res.status(400).json({
    error: "Moyen de paiement invalide. Utilise 'wave' ou 'orange'."
  });
}

if (!formatValide) {
  const exemple = moyen === "wave" ? "WA-AB12345678" : "987654321";
  return res.status(400).json({
    error: `Format d'identifiant invalide pour ${moyen === "wave" ? "Wave" : "Orange Money"}. Exemple attendu : ${exemple}`
  });
}

// ── Vérifier que cet ID n'a pas déjà été utilisé ─────────
const dejaUtilise = await Transaction.txIdDejaUtilise(txIdNormalise);
if (dejaUtilise) {
  return res.status(409).json({
    error: "Cet identifiant de transaction a déjà été utilisé pour activer un compte. Si c'est une erreur, contacte le support."
  });
}

// ── Calculer expiration & enregistrer la transaction ──────
const { dureeJours, montant } = PLANS[plan];
const expiration = moyen === "wave"
  ? Wave.calculerExpiration(dureeJours)
  : Orange.calculerExpiration(dureeJours);

await Transaction.create({
  txId:    txIdNormalise,
  userId:  req.user.id,
  email:   req.user.email,
  moyen:   moyen === "wave" ? "Wave CI" : "Orange Money CI",
  plan,
  montant,
  statut:  "validé",
});

// ── Activer le Premium sur le profil utilisateur ──────────
const userMisAJour = await User.setPremium(req.user.id, {
  premium: true,
  plan,
  expire:  expiration,
});

res.json({
  message:    `Paiement validé ! Ton abonnement Premium ${plan} est maintenant actif.`,
  premium:    true,
  plan,
  expiration,
  user:       userMisAJour,
  transaction: {
    txId:   txIdNormalise,
    moyen:  moyen === "wave" ? "Wave CI" : "Orange Money CI",
    plan,
    montant,
    date:   new Date().toLocaleDateString("fr-FR"),
  },
});
```

} catch (err) {
console.error(“Erreur vérification paiement :”, err.message);
res.status(500).json({ error: “Erreur lors de la vérification du paiement.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/payment/history — Historique paiements utilisateur
// ════════════════════════════════════════════════════════════
exports.history = async (req, res) => {
try {
const transactions = await Transaction.findByUser(req.user.id);
res.json({ transactions });

} catch (err) {
console.error(“Erreur historique paiements :”, err.message);
res.status(500).json({ error: “Erreur lors de la récupération de l’historique.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/payment/all — Toutes les transactions (admin)
// ════════════════════════════════════════════════════════════
exports.allTransactions = async (req, res) => {
try {
const { statut, limit, offset } = req.query;
const transactions = await Transaction.findAll({
statut,
limit:  parseInt(limit)  || 100,
offset: parseInt(offset) || 0,
});

```
const revenus      = await Transaction.totalRevenus();
const revenusQMois = await Transaction.revenusduMois();

res.json({
  total:        transactions.length,
  revenus_total: revenus,
  revenus_mois:  revenusQMois,
  transactions,
});
```

} catch (err) {
console.error(“Erreur all transactions :”, err.message);
res.status(500).json({ error: “Erreur serveur.” });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/payment/resiliation — Résilier un abonnement (admin)
// ════════════════════════════════════════════════════════════
exports.resilier = async (req, res) => {
try {
const { userId } = req.body;
if (!userId) {
return res.status(400).json({ error: “userId requis.” });
}

```
const user = await User.findById(userId);
if (!user) {
  return res.status(404).json({ error: "Utilisateur introuvable." });
}

await User.setPremium(userId, {
  premium: false,
  plan:    null,
  expire:  null,
});

res.json({
  message: `Abonnement de ${user.nom} (${user.email}) résilié avec succès.`
});
```

} catch (err) {
console.error(“Erreur résiliation :”, err.message);
res.status(500).json({ error: “Erreur lors de la résiliation.” });
}
};