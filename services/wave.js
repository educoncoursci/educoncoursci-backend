// ============================================================
//  services/wave.js
//  Validation et traitement des paiements Wave CI
//
//  DEUX MODES, COMBINABLES SELON CE QUI EST CONFIGURÉ :
//
//  1. API Wave Business (WAVE_API_KEY) — RECOMMANDÉ
//     Utilise l'API officielle Wave Checkout (docs.wave.com/checkout)
//     pour créer une session de paiement avec un MONTANT PRÉCIS
//     attaché. L'utilisateur arrive dans Wave avec le montant déjà
//     rempli, paie, et un webhook confirme automatiquement — même
//     principe que l'intégration CinetPay déjà en place. Nécessite un
//     compte Wave Business et une clé API (voir docs.wave.com).
//
//  2. Lien de paiement statique (WAVE_LIEN_PAIEMENT) — mode de secours
//     Un lien généré une fois dans l'app Wave (ex: pay.wave.com/m/...).
//     ⚠️ Ce lien NE transmet PAS de montant précis — Wave l'affiche
//     comme un QR code/paiement générique où le client doit saisir
//     lui-même le montant. C'est ce qui causait le problème signalé
//     ("paiement qui ouvre Wave sans montant associé"). Ce mode reste
//     disponible en repli si aucune clé API n'est configurée, mais
//     l'API (mode 1) est la méthode recommandée dès qu'un compte Wave
//     Business est disponible.
//
//  3. Mode manuel (WAVE_NUMERO) — toujours disponible en dernier
//     recours, même sans compte Wave Business : virement au numéro
//     affiché, ID de transaction saisi manuellement, validation admin.
// ============================================================

const fetch = require("node-fetch");
const crypto = require("crypto");

const API_URL_CHECKOUT = "https://api.wave.com/v1/checkout/sessions";

const API_KEY = process.env.WAVE_API_KEY;
const WEBHOOK_SECRET = process.env.WAVE_WEBHOOK_SECRET;
const API_CONFIGUREE = Boolean(API_KEY);

const Wave = {
API_CONFIGUREE,

// ── Valide le format d'un ID de transaction Wave (mode manuel) ──
// Format réel confirmé par l'utilisateur (08/2026) : préfixe "T_"
// suivi de caractères alphanumériques majuscules (ex:
// T_5L7D2SFHD3VMTIPJ). On reste souple sur la longueur de la partie
// après le préfixe (10 à 24 caractères) plutôt que de figer un
// nombre exact, pour ne pas rejeter par erreur un vrai identifiant
// si sa longueur varie légèrement selon le type de transaction.
validerFormatId(txId) {
if (!txId || typeof txId !== "string") return false;
const clean = txId.trim().toUpperCase();
return /^T_[A-Z0-9]{10,24}$/.test(clean);
},

// ── Nettoie et normalise un ID Wave ─────────────────────────
normaliserTxId(txId) {
return txId.trim().toUpperCase();
},

// ── Calcule la durée Premium selon le plan ──────────────────
getDureePlan(plan) {
const plans = {
"1 Mois":   30,
"3 Mois":   90,
"12 Mois": 365,
};
return plans[plan] || 30;
},

// ── Calcule le montant attendu selon le plan ────────────────
getMontantPlan(plan) {
const montants = {
"1 Mois":   2000,
"3 Mois":   5000,
"12 Mois": 15000,
};
return montants[plan] || null;
},

// ── Calcule la date d'expiration du Premium ─────────────────
calculerExpiration(dureeJours) {
const expiration = new Date();
expiration.setDate(expiration.getDate() + dureeJours);
return expiration.toISOString().split("T")[0]; // Format YYYY-MM-DD
},

// ── Retourne le lien de paiement Wave (mode 2 — ta situation
// actuelle sans RCCM). VÉRIFIÉ AUPRÈS DE L'UTILISATEUR (08/2026) :
// dans l'app Wave, l'option "montant (optionnel)" au moment de
// partager un lien ne modifie PAS l'URL du lien elle-même — c'est
// uniquement une info utilisée pour pré-remplir un message
// d'accompagnement (SMS/WhatsApp), pas une donnée transmise au
// client qui clique sur le lien depuis un site web. Concrètement :
// un seul lien Wave existe pour ce compte, il est générique, et le
// montant doit être saisi manuellement par le client dans Wave quel
// que soit le plan choisi sur le site (voir les étapes affichées à
// l'utilisateur plus bas, qui reflètent honnêtement ce comportement).
// Un montant pré-rempli automatiquement n'est possible qu'avec l'API
// Wave Business (mode 1 ci-dessus), qui nécessite le RCCM.
getLienPaiement() {
return process.env.WAVE_LIEN_PAIEMENT || null;
},

// ── MODE 1 (recommandé) : crée une vraie session de paiement Wave
// avec le montant exact attaché, via l'API officielle Wave Checkout.
// Retourne l'URL de paiement à laquelle rediriger l'utilisateur —
// il y arrive avec le montant déjà rempli, rien à saisir. ──────
async creerSessionPaiement({ transactionId, montant, successUrl, errorUrl }) {
if (!API_CONFIGUREE) {
  throw new Error("L'API Wave Business n'est pas configurée sur ce serveur.");
}

const response = await fetch(API_URL_CHECKOUT, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: String(montant),
    currency: "XOF",
    client_reference: transactionId,
    success_url: successUrl || process.env.WAVE_SUCCESS_URL,
    error_url: errorUrl || process.env.WAVE_ERROR_URL,
  }),
});

const data = await response.json();
if (!response.ok) {
  throw new Error(data.message || `Erreur Wave Checkout (${response.status})`);
}

return { paymentUrl: data.wave_launch_url, sessionId: data.id };
},

// ── MODE 1 : vérifie le statut réel d'une session auprès de Wave ──
// Ne jamais faire confiance au corps du webhook seul — on revérifie
// systématiquement auprès de l'API avant d'activer quoi que ce soit,
// même principe que verifierPaiement() de CinetPay.
async verifierSessionPaiement(sessionId) {
if (!API_CONFIGUREE) {
  throw new Error("L'API Wave Business n'est pas configurée sur ce serveur.");
}

const response = await fetch(`${API_URL_CHECKOUT}/${sessionId}`, {
  headers: { "Authorization": `Bearer ${API_KEY}` },
});
const data = await response.json();

return {
  succes: data.checkout_status === "complete" && data.payment_status === "succeeded",
  statutBrut: data.checkout_status,
  montant: data.amount,
  clientReference: data.client_reference,
};
},

// ── Vérifie la signature HMAC-SHA256 d'un webhook Wave, pour
// s'assurer qu'il vient bien de Wave et n'a pas été forgé par un
// tiers. Voir docs.wave.com/webhook — le payload signé est le corps
// BRUT de la requête (pas le JSON re-sérialisé, l'ordre des clés et
// les espaces changeraient la signature). ──────────────────────
verifierSignatureWebhook(corpsBrut, signatureRecue) {
if (!WEBHOOK_SECRET) return false;
const attendu = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(corpsBrut)
  .digest("hex");
// Comparaison à temps constant pour éviter les attaques par timing
try {
  return crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(signatureRecue || ""));
} catch {
  return false; // longueurs différentes = signature invalide
}
},

// ── Retourne les instructions de paiement Wave (choisit le meilleur
// mode disponible : API > lien statique > manuel) ──────────────
getInstructions(plan, numeroWave) {
const montant = Wave.getMontantPlan(plan);

// Mode 1 (recommandé) : l'appelant (paymentController) crée la
// session via creerSessionPaiement() plutôt que d'utiliser ces
// instructions statiques — ce champ signale juste au frontend
// d'utiliser ce parcours.
if (API_CONFIGUREE) {
  return {
    moyen:        "Wave CI",
    montant:      `${montant?.toLocaleString("fr-CI")} FCFA`,
    modePaiement: "api",
    etapes: [
      "Clique sur le bouton \"Payer avec Wave\" ci-dessous",
      `Tu arrives directement dans Wave avec le montant de ${montant?.toLocaleString("fr-CI")} FCFA déjà rempli`,
      "Confirme le paiement avec ton code Wave",
      "Ton Premium s'active automatiquement, sans rien saisir de plus",
    ],
  };
}

const lienPaiement = Wave.getLienPaiement();

// Mode 2 (ta situation actuelle sans RCCM) : lien Wave générique —
// le montant doit être saisi par le client dans Wave lui-même (voir
// le commentaire de getLienPaiement() ci-dessus pour le détail
// vérifié de ce comportement).
if (lienPaiement) {
  return {
    moyen:        "Wave CI",
    montant:      `${montant?.toLocaleString("fr-CI")} FCFA`,
    lienPaiement,
    modePaiement: "lien",
    etapes: [
      "Clique sur le bouton \"Payer avec Wave\" ci-dessous",
      `Une fois sur Wave, saisis exactement ${montant?.toLocaleString("fr-CI")} FCFA`,
      "Confirme le paiement avec ton code Wave",
      "Note l'identifiant de transaction reçu par SMS (ex: T_5L7D2SFHD3VMTIPJ)",
      "Reviens sur cette page et saisis cet identifiant ci-dessous pour activer ton Premium",
    ],
  };
}

// Mode 3 (dernier recours) : virement manuel au numéro affiché
return {
moyen:      "Wave CI",
numero:     numeroWave || process.env.WAVE_NUMERO,
montant:    `${montant?.toLocaleString("fr-CI")} FCFA`,
modePaiement: "manuel",
etapes: [
"Ouvre l'application Wave sur ton téléphone",
`Envoie exactement ${montant?.toLocaleString("fr-CI")} FCFA au numéro ${numeroWave || process.env.WAVE_NUMERO}`,
"Note l'identifiant de transaction reçu par SMS (ex: T_5L7D2SFHD3VMTIPJ)",
"Reviens sur le site et saisis cet identifiant pour activer ton compte",
],
format_exemple: "T_5L7D2SFHD3VMTIPJ",
};
},
};

module.exports = Wave;