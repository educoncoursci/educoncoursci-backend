// ============================================================
//  config/plans.js
//  Source UNIQUE de vérité pour les formules Premium (montant +
//  durée). Avant ce fichier, PLANS n'existait que localement dans
//  controllers/paymentController.js — inaccessible depuis
//  adminController.js, qui n'avait donc aucun moyen de valider
//  qu'un plan saisi manuellement par un admin (activerPremium())
//  correspondait à une vraie formule, ni de calculer sa durée
//  réelle. Toute la logique d'attribution (paiement client ET
//  activation manuelle admin) doit lire ce fichier, jamais
//  redéfinir sa propre copie des prix/durées.
// ============================================================

const PLANS = {
  "1 Mois":  { montant: 2000,  dureeJours: 30  },
  "3 Mois":  { montant: 5000,  dureeJours: 90  },
  "12 Mois": { montant: 15000, dureeJours: 365 },
};

module.exports = { PLANS };
