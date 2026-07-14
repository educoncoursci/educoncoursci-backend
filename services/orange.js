// ============================================================
//  services/orange.js
//  Validation et traitement des paiements Orange Money CI
// ============================================================

const Orange = {

// ── Valide le format d’un ID de transaction Orange Money ────
// Formats acceptés : suite de 7 à 15 chiffres, ou OM-XXXXXXX
validerFormatId(txId) {
if (!txId || typeof txId !== “string”) return false;
const clean = txId.trim().toUpperCase();
return /^([0-9]{7,15}|OM-[A-Z0-9]{4,15})$/.test(clean);
},

// ── Nettoie et normalise un ID Orange Money ─────────────────
normaliserTxId(txId) {
return txId.trim().toUpperCase();
},

// ── Calcule la durée Premium selon le plan ──────────────────
getDureePlan(plan) {
const plans = {
“1 Mois”:   30,
“3 Mois”:   90,
“12 Mois”: 365,
};
return plans[plan] || 30;
},

// ── Calcule le montant attendu selon le plan ────────────────
getMontantPlan(plan) {
const montants = {
“1 Mois”:   2000,
“3 Mois”:   5000,
“12 Mois”: 15000,
};
return montants[plan] || null;
},

// ── Calcule la date d’expiration du Premium ─────────────────
calculerExpiration(dureeJours) {
const expiration = new Date();
expiration.setDate(expiration.getDate() + dureeJours);
return expiration.toISOString().split(“T”)[0];
},

// ── Retourne les instructions de paiement Orange Money ──────
getInstructions(plan, numeroOM) {
const montant = Orange.getMontantPlan(plan);
const numero  = numeroOM || process.env.OM_NUMERO;
return {
moyen:   “Orange Money CI”,
numero,
montant: `${montant?.toLocaleString("fr-CI")} FCFA`,
etapes: [
`Compose le #150*1*1*${numero}*${montant}# sur ton téléphone Orange`,
“Ou ouvre l’app Orange Money → Paiement marchand”,
`Saisis le numéro marchand : ${numero}`,
`Entre le montant exact : ${montant?.toLocaleString("fr-CI")} FCFA`,
“Confirme avec ton code PIN Orange Money”,
“Note l’identifiant de transaction reçu par SMS”,
“Reviens sur le site et saisis cet identifiant”,
],
ussd:           `#150*1*1*${numero}*${montant}#`,
format_exemple: “987654321”,
};
},
};

module.exports = Orange;