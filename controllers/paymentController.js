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
const { PLANS }   = require("../config/plans");

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

res.json({ plans, instructions, cinetpayDisponible: CinetPay.API_CONFIGUREE, waveApiDisponible: Wave.API_CONFIGUREE });

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
const EXEMPLES_MOYEN = { wave: "T_5L7D2SFHD3VMTIPJ", orange: "987654321", mtn: "MP-AB1234567", moov: "MV-AB1234567" };

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
const [transactions, total] = await Promise.all([
  Transaction.findAll({
    statut,
    limit:  parseInt(limit)  || 100,
    offset: parseInt(offset) || 0,
  }),
  Transaction.countAvecFiltre(statut), // vrai total, indépendant de la pagination
]);

const revenus      = await Transaction.totalRevenus();
const revenusQMois = await Transaction.revenusduMois();

res.json({
  total,
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

    // Défense en profondeur : CinetPay confirme lui-même le montant
    // réellement payé (verification.montant) — on ne l'active QUE s'il
    // correspond exactement au montant attendu pour le plan choisi à
    // l'initiation (transaction.montant, lui-même dérivé de PLANS et
    // jamais modifiable par le client). Sans ce contrôle, n'importe
    // quelle anomalie côté CinetPay ou incohérence de transaction_id
    // activerait le Premium sans jamais vérifier que la somme reçue
    // correspond réellement à la formule attribuée.
    const montantConfirme = Number(verification.montant);
    const montantAttendu  = Number(transaction?.montant);
    const montantCoherent = transaction && montantConfirme === montantAttendu;

    if (verification.succes && transaction && transaction.statut !== "validé") {
      if (!montantCoherent) {
        console.error(
          `Webhook CinetPay : montant incohérent pour la transaction ${transaction.id} ` +
          `(plan "${transaction.plan}", attendu ${montantAttendu} FCFA, CinetPay confirme ${montantConfirme} FCFA). ` +
          `Premium NON activé automatiquement — vérification manuelle requise.`
        );
        await Transaction.updateStatut(transaction.id, "à vérifier");
      } else {
        const { dureeJours } = PLANS[transaction.plan] || {};
        if (dureeJours) {
          const expiration = Wave.calculerExpiration(dureeJours);
          await User.setPremium(transaction.user_id, { premium: true, plan: transaction.plan, expire: expiration });
          await Transaction.updateStatut(transaction.id, "validé");
        }
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

// ════════════════════════════════════════════════════════════
//  POST /api/payment/wave/initier — Démarrer un paiement Wave via
//  l'API officielle Wave Checkout (connecté requis). Le montant est
//  déterminé UNIQUEMENT par le plan choisi (jamais par une valeur
//  envoyée par le frontend) — voir PLANS ci-dessus. Contrairement au
//  lien statique ou au mode manuel, aucune saisie d'ID de transaction
//  n'est nécessaire : Wave confirme lui-même via webhook dès que le
//  paiement aboutit, avec le montant déjà attaché à la session.
// ════════════════════════════════════════════════════════════
exports.initierWave = async (req, res) => {
  try {
    if (!Wave.API_CONFIGUREE) {
      return res.status(503).json({
        error: "Le paiement Wave via API n'est pas encore configuré sur ce serveur. Utilise le mode manuel Wave en attendant.",
      });
    }

    const { plan } = req.body;
    if (!PLANS[plan]) {
      return res.status(400).json({ error: `Plan invalide. Plans disponibles : ${Object.keys(PLANS).join(", ")}` });
    }

    // Le montant vient exclusivement de PLANS[plan], jamais du corps
    // de la requête — un utilisateur ne peut donc pas modifier le
    // montant côté frontend pour payer moins cher.
    const { montant } = PLANS[plan];
    const transactionId = `WV-${req.user.id}-${Date.now()}`;

    const { paymentUrl, sessionId } = await Wave.creerSessionPaiement({
      transactionId,
      montant,
      successUrl: process.env.WAVE_SUCCESS_URL || `${process.env.FRONTEND_URL}/dashboard/paiements.html?statut=succes`,
      errorUrl: process.env.WAVE_ERROR_URL || `${process.env.FRONTEND_URL}/dashboard/paiements.html?statut=echec`,
    });

    await Transaction.create({
      txId: transactionId,
      userId: req.user.id,
      email: req.user.email,
      moyen: "Wave (API)",
      plan,
      montant,
      statut: "en attente",
      // sessionId Wave stocké dans txId côté recherche webhook — voir
      // webhookWave ci-dessous, qui retrouve la transaction par
      // client_reference (= transactionId envoyé à Wave).
    });

    res.json({ paymentUrl, transactionId, sessionId });
  } catch (err) {
    console.error("Erreur initiation Wave :", err.message);
    res.status(500).json({ error: err.message || "Erreur lors de l'initialisation du paiement Wave." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/payment/wave/webhook — Notification Wave (public)
//  Appelé automatiquement par Wave quand un paiement aboutit ou
//  échoue (événement checkout.session.completed). Ne JAMAIS faire
//  confiance au corps de la requête seul : on vérifie d'abord la
//  signature HMAC-SHA256 (WAVE_WEBHOOK_SECRET), PUIS on revérifie le
//  statut auprès de l'API Wave avant d'activer quoi que ce soit —
//  même principe de défense en profondeur que webhookCinetPay.
//
//  Important : la vérification de signature a besoin du corps BRUT
//  de la requête (avant parsing JSON) — voir server.js, qui doit
//  exposer req.rawBody pour cette route spécifiquement.
// ════════════════════════════════════════════════════════════
exports.webhookWave = async (req, res) => {
  try {
    const signature = req.headers["wave-signature"] || req.headers["authorization"]?.replace("Bearer ", "");
    const corpsBrut = req.rawBody || JSON.stringify(req.body);

    if (!Wave.verifierSignatureWebhook(corpsBrut, signature)) {
      console.error("Webhook Wave : signature invalide, requête ignorée.");
      return res.status(401).send("Signature invalide");
    }

    const evenement = req.body;
    if (evenement.type !== "checkout.session.completed") {
      return res.status(200).send("OK"); // événement non pertinent, ignoré sans erreur
    }

    const sessionId = evenement.data?.id;
    const clientReference = evenement.data?.client_reference;
    if (!sessionId || !clientReference) return res.status(400).send("Données manquantes");

    const transaction = await Transaction.findByTxId(clientReference);
    if (!transaction) return res.status(200).send("OK"); // transaction inconnue, on ignore silencieusement

    // Revérification systématique auprès de l'API Wave — jamais de
    // confiance aveugle dans le corps du webhook, même signé.
    const verification = await Wave.verifierSessionPaiement(sessionId);

    // Même défense en profondeur que webhookCinetPay : Wave confirme
    // lui-même le montant réellement payé (verification.montant), on
    // n'active le Premium que s'il correspond exactement au montant
    // attendu de la transaction (dérivé de PLANS à l'initiation).
    const montantConfirme = Number(verification.montant);
    const montantAttendu  = Number(transaction.montant);
    const montantCoherent = montantConfirme === montantAttendu;

    if (verification.succes && transaction.statut !== "validé") {
      if (!montantCoherent) {
        console.error(
          `Webhook Wave : montant incohérent pour la transaction ${transaction.id} ` +
          `(plan "${transaction.plan}", attendu ${montantAttendu} FCFA, Wave confirme ${montantConfirme} FCFA). ` +
          `Premium NON activé automatiquement — vérification manuelle requise.`
        );
        await Transaction.updateStatut(transaction.id, "à vérifier");
      } else {
        const { dureeJours } = PLANS[transaction.plan] || {};
        if (dureeJours) {
          const expiration = Wave.calculerExpiration(dureeJours);
          await User.setPremium(transaction.user_id, { premium: true, plan: transaction.plan, expire: expiration });
          await Transaction.updateStatut(transaction.id, "validé");
        }
      }
    } else if (!verification.succes) {
      await Transaction.updateStatut(transaction.id, "échoué");
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Erreur webhook Wave :", err.message);
    res.status(200).send("OK"); // on renvoie 200 quoi qu'il arrive pour éviter les re-essais en boucle de Wave
  }
};