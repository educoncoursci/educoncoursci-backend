// ============================================================
//  services/transactionsScheduler.js
//  Deux tâches de nettoyage liées au paiement, exécutées toutes
//  les heures :
//
//  1. Marque comme "échoué" les transactions restées "en attente"
//     plus de 24h — typiquement un client qui a démarré un paiement
//     (mode manuel, CinetPay ou Wave API) mais ne l'a jamais terminé
//     (onglet fermé, abandon dans Wave/CinetPay). Sans ça, ces
//     transactions restent indéfiniment visibles dans
//     /admin/paiements comme des demandes jamais traitées.
//
//  2. Désactive le Premium des comptes dont la date d'expiration
//     (premium_expire) est dépassée. Sans ça, un compte qui a payé
//     pour "1 Mois" reste marqué premium=true indéfiniment en base
//     après ses 30 jours — rien ne le désactivait automatiquement.
//     Le token JWT (valable 7 jours) peut aussi porter un
//     premium=true périmé entre deux exécutions de ce nettoyage ;
//     c'est un délai acceptable, mais tout contrôle d'accès
//     vraiment critique côté backend doit revérifier premium_expire
//     en base plutôt que de se fier uniquement au token — voir
//     middleware/premium.js.
// ============================================================

const cron = require("node-cron");

function demarrerPlanification() {
  // Toutes les heures — plus fréquent que les autres tâches
  // planifiées du projet, pour ne pas laisser les transactions
  // fantômes ou les Premium expirés traîner trop longtemps.
  cron.schedule("0 * * * *", async () => {
    try {
      const Transaction = require("../models/Transaction");
      const expirees = await Transaction.marquerExpireesCommeEchouees(24);
      if (expirees.length > 0) {
        console.log(`🧹 ${expirees.length} transaction(s) en attente depuis +24h marquée(s) comme échouée(s).`);
      }
    } catch (err) {
      console.error("Erreur nettoyage transactions expirées (cron) :", err.message);
    }

    try {
      const User = require("../models/User");
      const desactives = await User.desactiverPremiumExpires();
      if (desactives.length > 0) {
        console.log(`🧹 ${desactives.length} compte(s) Premium expiré(s) désactivé(s) : ${desactives.map((u) => u.email).join(", ")}`);
      }
    } catch (err) {
      console.error("Erreur désactivation Premium expirés (cron) :", err.message);
    }
  });

  console.log("🕒 Nettoyage automatique des transactions abandonnées et des Premium expirés activé (toutes les heures).");
}

module.exports = { demarrerPlanification };
