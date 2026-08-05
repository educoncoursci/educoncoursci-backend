// ============================================================
//  controllers/paymentController.js
//  Gère : instructions paiement, vérification ID transaction,
//         activation Premium, historique, résiliation
// ============================================================

const Transaction = require("../models/Transaction");
const User        = require("../models/User");
const Journal     = require("../models/Journal");
const Wave        = require("../services/wave");
const Orange       = require("../services/orange");
const MTN         = require("../services/mtn");
const Moov        = require("../services/moov");
const CinetPay    = require("../services/cinetpay");

// Plans disponibles
const PLANS = {
"1 Mois":  { montant: 2000,  dureeJours: 30  },
"3 Mois":  { montant: 5000,  dureeJours: 90  },
"12 Mois": { montant: 15000, dureeJours: 365 },
};

// ════════════════════════════════════════════════════════════
//  GET /api/payment/plans — Plans & instructions de paiement
// ════════════════════════════════════════════════════════════
exports.getPlans = async (req, res) => {
try {
const { plan } = req.query;

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
    mtn:    MTN.getInstructions(plan),
    moov:   Moov.getInstructions(plan),
  };
}

res.json({ plans, instructions, cinetpayDisponible: CinetPay.API_CONFIGUREE });

} catch (err) {
console.error("Erreur getPlans :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/payment/verify — Vérifier l'ID + activer Premium
// ════════════════════════════════════════════════════════════
exports.verify = async (req, res) => {
try {
const { txId, moyen, plan } = req.body;

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
const SERVICES_MOYEN = { wave: Wave, orange: Orange, mtn: MTN, moov: Moov };
const service = SERVICES_MOYEN[moyen];
if (!service) {
  return res.status(400).json({
    error: "Moyen de paiement invalide. Utilise 'wave', 'orange', 'mtn' ou 'moov'."
  });
}
const txIdNormalise = service.normaliserTxId(txId);

// ── Valider le format selon le moyen de paiement ─────────
const formatValide = service.validerFormatId(txIdNormalise);

const LABELS_MOYEN = { wave: "Wave", orange: "Orange Money", mtn: "MTN Money", moov: "Moov Money" };
const EXEMPLES_MOYEN = { wave: "WA-AB12345678", orange: "987654321", mtn: "MP-AB1234567", moov: "MV-AB1234567" };

if (!formatValide) {
  return res.status(400).json({
    error: `Format d'identifiant invalide pour ${LABELS_MOYEN[moyen]}. Exemple attendu : ${EXEMPLES_MOYEN[moyen]}`
  });
}

// ── Vérifier que cet ID n'a pas déjà été utilisé ─────────
const dejaUtilise = await Transaction.txIdDejaUtilise(txIdNormalise);
if (dejaUtilise) {
  return res.status(409).json({
    error: "Cet identifiant de transaction a déjà été utilisé pour activer un compte. Si c'est une erreur, contacte le support."
  });
}

// ── Enregistrer la transaction en attente de validation ───
// IMPORTANT : le format de l'ID ne prouve pas que le paiement a eu
// lieu (il peut être inventé). Sans intégration d'un agrégateur
// mobile money officiel (CinetPay, etc.) fournissant un vrai webhook
// de confirmation, la seule vérification fiable est humaine : un
// admin confirme la réception réelle des fonds avant activation.
const { montant } = PLANS[plan];

const transaction = await Transaction.create({
  txId:    txIdNormalise,
  userId:  req.user.id,
  email:   req.user.email,
  moyen:   `${LABELS_MOYEN[moyen]} CI`,
  plan,
  montant,
  statut:  "en attente",
});

res.json({
  message: `Identifiant reçu ! Ton paiement ${LABELS_MOYEN[moyen]} est en cours de vérification par notre équipe. Ton Premium ${plan} sera activé sous peu (généralement quelques heures) une fois le paiement confirmé.`,
  enAttente: true,
  transaction,
});

} catch (err) {
console.error("Erreur vérification paiement :", err.message);
res.status(500).json({ error: "Erreur lors de la vérification du paiement." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/payment/valider/:id — Valider une transaction (admin)
//  Confirme que le paiement a réellement été reçu et active le
//  Premium correspondant sur le compte du client.
// ════════════════════════════════════════════════════════════
exports.validerTransaction = async (req, res) => {
try {
const { id } = req.params;
const transaction = await Transaction.findById(id);

if (!transaction) {
  return res.status(404).json({ error: "Transaction introuvable." });
}
if (transaction.statut === "validé") {
  return res.status(409).json({ error: "Cette transaction est déjà validée." });
}
if (!PLANS[transaction.plan]) {
  return res.status(400).json({ error: "Plan de la transaction invalide." });
}

const { dureeJours } = PLANS[transaction.plan];
const expiration = Wave.calculerExpiration(dureeJours); // même formule pour les deux moyens

const userMisAJour = await User.setPremium(transaction.user_id, {
  premium: true,
  plan:    transaction.plan,
  expire:  expiration,
});

const transactionMiseAJour = await Transaction.updateStatut(id, "validé");

Journal.enregistrer(req.user.id, req.user.nom, "validation", "transaction", id, `${transaction.email} — ${transaction.plan} (${transaction.montant} FCFA)`);

res.json({
  message: `Transaction validée. Premium ${transaction.plan} activé pour ${transaction.email}.`,
  transaction: transactionMiseAJour,
  user: userMisAJour,
});

} catch (err) {
console.error("Erreur validation transaction :", err.message);
res.status(500).json({ error: "Erreur lors de la validation de la transaction." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/payment/rejeter/:id — Rejeter une transaction (admin)
//  Ex : identifiant invalide, paiement introuvable côté Wave/Orange.
// ════════════════════════════════════════════════════════════
exports.rejeterTransaction = async (req, res) => {
try {
const { id } = req.params;
const transaction = await Transaction.findById(id);

if (!transaction) {
  return res.status(404).json({ error: "Transaction introuvable." });
}
if (transaction.statut === "validé") {
  return res.status(409).json({ error: "Impossible de rejeter une transaction déjà validée. Résilie l'abonnement si besoin." });
}

const transactionMiseAJour = await Transaction.updateStatut(id, "échoué");

Journal.enregistrer(req.user.id, req.user.nom, "rejet", "transaction", id, `${transaction.email} — ${transaction.plan}`);

res.json({
  message: "Transaction rejetée.",
  transaction: transactionMiseAJour,
});

} catch (err) {
console.error("Erreur rejet transaction :", err.message);
res.status(500).json({ error: "Erreur lors du rejet de la transaction." });
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
console.error("Erreur historique paiements :", err.message);
res.status(500).json({ error: "Erreur lors de la récupération de l'historique." });
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

const revenus      = await Transaction.totalRevenus();
const revenusQMois = await Transaction.revenusduMois();

res.json({
  total:        transactions.length,
  revenus_total: revenus,
  revenus_mois:  revenusQMois,
  transactions,
});

} catch (err) {
console.error("Erreur all transactions :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/payment/resiliation — Résilier un abonnement (admin)
// ════════════════════════════════════════════════════════════
exports.resilier = async (req, res) => {
try {
const { userId } = req.body;
if (!userId) {
return res.status(400).json({ error: "userId requis." });
}

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

} catch (err) {
console.error("Erreur résiliation :", err.message);
res.status(500).json({ error: "Erreur lors de la résiliation." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/payment/cinetpay/initier — Démarrer un paiement CinetPay
//  (connecté requis). Contrairement aux moyens manuels, aucune saisie
//  d'ID de transaction n'est nécessaire : CinetPay confirme lui-même
//  via webhook dès que le paiement (carte ou mobile money) aboutit.
// ════════════════════════════════════════════════════════════
exports.initierCinetPay = async (req, res) => {
  try {
    if (!CinetPay.API_CONFIGUREE) {
      return res.status(503).json({
        error: "Le paiement en ligne CinetPay n'est pas encore configuré sur ce serveur. Utilise Wave, Orange Money, MTN Money ou Moov Money en attendant.",
      });
    }

    const { plan } = req.body;
    if (!PLANS[plan]) {
      return res.status(400).json({ error: `Plan invalide. Plans disponibles : ${Object.keys(PLANS).join(", ")}` });
    }

    const { montant } = PLANS[plan];
    const transactionId = `CP-${req.user.id}-${Date.now()}`;

    const { paymentUrl } = await CinetPay.creerPaiement({
      transactionId,
      montant,
      description: `Abonnement Premium EduConcoursCI — ${plan}`,
      email: req.user.email,
      nom: req.user.nom,
    });

    await Transaction.create({
      txId: transactionId,
      userId: req.user.id,
      email: req.user.email,
      moyen: "CinetPay",
      plan,
      montant,
      statut: "en attente",
    });

    res.json({ paymentUrl, transactionId });
  } catch (err) {
    console.error("Erreur initiation CinetPay :", err.message);
    res.status(500).json({ error: err.message || "Erreur lors de l'initialisation du paiement." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/payment/cinetpay/webhook — Notification CinetPay (public)
//  Appelé automatiquement par CinetPay quand un paiement aboutit ou
//  échoue. Ne JAMAIS faire confiance au corps de la requête seul :
//  on revérifie systématiquement le statut auprès de l'API CinetPay
//  avant d'activer quoi que ce soit.
// ════════════════════════════════════════════════════════════
exports.webhookCinetPay = async (req, res) => {
  try {
    const transactionId = req.body.cpm_trans_id || req.body.transaction_id;
    if (!transactionId) return res.status(400).send("transaction_id manquant");

    const transaction = await Transaction.findByTxId(transactionId);

    const verification = await CinetPay.verifierPaiement(transactionId);

    if (verification.succes && transaction && transaction.statut !== "validé") {
      const { dureeJours } = PLANS[transaction.plan] || {};
      if (dureeJours) {
        const expiration = Wave.calculerExpiration(dureeJours);
        await User.setPremium(transaction.user_id, { premium: true, plan: transaction.plan, expire: expiration });
        await Transaction.updateStatut(transaction.id, "validé");
      }
    } else if (!verification.succes && transaction) {
      await Transaction.updateStatut(transaction.id, "échoué");
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Erreur webhook CinetPay :", err.message);
    res.status(200).send("OK"); // on renvoie 200 quoi qu'il arrive pour éviter les re-essais en boucle de CinetPay
  }
};