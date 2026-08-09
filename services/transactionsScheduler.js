// ============================================================
//  services/transactionsScheduler.js
//  Marque automatiquement comme "échoué" les transactions restées
//  "en attente" plus de 24h — typiquement un client qui a démarré
//  un paiement (mode manuel, CinetPay ou Wave API) mais ne l'a
//  jamais terminé (onglet fermé, abandon dans Wave/CinetPay).
//
//  Sans ce nettoyage, ces transactions restent indéfiniment visibles
//  dans /admin/paiements comme des demandes "en attente" jamais
//  traitées, et rien ne signale à l'utilisateur que sa tentative n'a
//  pas abouti — il peut simplement réessayer depuis /paiement.html.
// ============================================================

const cron = require("node-cron");

function demarrerPlanification() {
  // Toutes les heures — plus fréquent que les autres tâches
  // planifiées du projet, pour ne pas laisser les transactions
  // fantômes traîner trop longtemps dans l'admin.
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
  });

  console.log("🕒 Nettoyage automatique des transactions abandonnées activé (toutes les heures).");
}

module.exports = { demarrerPlanification };
