// ============================================================
//  services/wave.js
//  Validation et traitement des paiements Wave CI
// ============================================================

const Wave = {

// ── Valide le format d'un ID de transaction Wave ────────────
// Formats acceptés : WA-XXXXXXXXXX / W-XXXXXXXXX / WV-XXXXXXXXX
validerFormatId(txId) {
if (!txId || typeof txId !== "string") return false;
const clean = txId.trim().toUpperCase();
return /^(WA|W|WV)-[A-Z0-9]{4,20}$/.test(clean);
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

// ── Retourne les instructions de paiement Wave ──────────────
getInstructions(plan, numeroWave) {
const montant = Wave.getMontantPlan(plan);
return {
moyen:      "Wave CI",
numero:     numeroWave || process.env.WAVE_NUMERO,
montant:    `${montant?.toLocaleString("fr-CI")} FCFA`,
etapes: [
"Ouvre l'application Wave sur ton téléphone",
`Envoie exactement ${montant?.toLocaleString("fr-CI")} FCFA au numéro ${numeroWave || process.env.WAVE_NUMERO}`,
"Note l'identifiant de transaction reçu par SMS (ex: WA-AB12345678)",
"Reviens sur le site et saisis cet identifiant pour activer ton compte",
],
format_exemple: "WA-AB12345678",
};
},
};

module.exports = Wave;