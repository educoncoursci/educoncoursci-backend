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

// ── Retourne le lien de paiement Wave Business (générique, tous plans) ──
// Configuré via la variable d'environnement WAVE_LIEN_PAIEMENT.
// Tant que cette variable n'est pas remplie, retourne null (mode manuel utilisé à la place).
getLienPaiement() {
return process.env.WAVE_LIEN_PAIEMENT || null;
},

// ── Retourne les instructions de paiement Wave ──────────────
getInstructions(plan, numeroWave) {
const montant = Wave.getMontantPlan(plan);
const lienPaiement = Wave.getLienPaiement();

// Si un vrai lien de paiement Wave Business existe pour ce plan,
// on privilégie ce mode (plus simple et plus fiable pour le client)
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
      "Reviens sur cette page une fois le paiement effectué",
    ],
  };
}

// Sinon, mode manuel (comme actuellement)
return {
moyen:      "Wave CI",
numero:     numeroWave || process.env.WAVE_NUMERO,
montant:    `${montant?.toLocaleString("fr-CI")} FCFA`,
modePaiement: "manuel",
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