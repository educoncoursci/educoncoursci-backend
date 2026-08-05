// ============================================================
//  services/moov.js
//  Lot 17 — Validation et traitement des paiements Moov Money CI.
//  Même logique manuelle que Wave/Orange/MTN : le candidat paie
//  directement au numéro marchand, saisit l'ID de transaction
//  reçu par SMS, un admin valide.
// ============================================================

const Moov = {

// ── Valide le format d'un ID de transaction Moov Money ───────
// Formats acceptés : suite de 6 à 15 chiffres, ou MV-XXXXXXX
validerFormatId(txId) {
if (!txId || typeof txId !== "string") return false;
const clean = txId.trim().toUpperCase();
return /^([0-9]{6,15}|MV-[A-Z0-9]{4,15})$/.test(clean);
},

normaliserTxId(txId) {
return txId.trim().toUpperCase();
},

getDureePlan(plan) {
const plans = {
"1 Mois":   30,
"3 Mois":   90,
"12 Mois": 365,
};
return plans[plan] || 30;
},

getMontantPlan(plan) {
const montants = {
"1 Mois":   2000,
"3 Mois":   5000,
"12 Mois": 15000,
};
return montants[plan] || null;
},

calculerExpiration(dureeJours) {
const expiration = new Date();
expiration.setDate(expiration.getDate() + dureeJours);
return expiration.toISOString().split("T")[0];
},

getInstructions(plan, numeroMoov) {
const montant = Moov.getMontantPlan(plan);
return {
moyen:        "Moov Money",
numero:       numeroMoov || process.env.MOOV_NUMERO,
montant:      `${montant?.toLocaleString("fr-CI")} FCFA`,
modePaiement: "manuel",
etapes: [
"Compose #155# sur ton téléphone Moov (ou ouvre l'app Moov Money)",
`Envoie exactement ${montant?.toLocaleString("fr-CI")} FCFA au numéro ${numeroMoov || process.env.MOOV_NUMERO}`,
"Note l'identifiant de transaction reçu par SMS",
"Reviens sur le site et saisis cet identifiant pour activer ton compte",
],
format_exemple: "MV-AB1234567",
};
},
};

module.exports = Moov;
