// ============================================================
//  services/mtn.js
//  Lot 17 — Validation et traitement des paiements MTN Money CI.
//  Même logique manuelle que Wave/Orange (services/wave.js,
//  services/orange.js) : le candidat paie directement au numéro
//  marchand, saisit l'ID de transaction reçu par SMS, un admin
//  valide. Aucun compte API MTN MoMo requis pour ce mode.
// ============================================================

const MTN = {

// ── Valide le format d'un ID de transaction MTN Money ───────
// Formats acceptés : suite de 8 à 15 chiffres, ou MP-XXXXXXX / MTN-XXXXXXX
validerFormatId(txId) {
if (!txId || typeof txId !== "string") return false;
const clean = txId.trim().toUpperCase();
return /^([0-9]{8,15}|(MP|MTN)-[A-Z0-9]{4,15})$/.test(clean);
},

// ── Nettoie et normalise un ID MTN Money ─────────────────────
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
return expiration.toISOString().split("T")[0];
},

// ── Retourne les instructions de paiement MTN Money ──────────
getInstructions(plan, numeroMtn) {
const montant = MTN.getMontantPlan(plan);
return {
moyen:        "MTN Money",
numero:       numeroMtn || process.env.MTN_NUMERO,
montant:      `${montant?.toLocaleString("fr-CI")} FCFA`,
modePaiement: "manuel",
etapes: [
"Compose *133# sur ton téléphone MTN (ou ouvre l'app MoMo)",
`Envoie exactement ${montant?.toLocaleString("fr-CI")} FCFA au numéro ${numeroMtn || process.env.MTN_NUMERO}`,
"Note l'identifiant de transaction reçu par SMS",
"Reviens sur le site et saisis cet identifiant pour activer ton compte",
],
format_exemple: "MP-AB1234567",
};
},
};

module.exports = MTN;
