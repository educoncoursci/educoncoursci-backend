// ============================================================
//  services/rappelsScheduler.js
//  Module 4 — Déclenche automatiquement les rappels de clôture
//  (J-7/J-3/J-1) une fois par jour, sans intervention admin.
//  La logique elle-même (recherche des concours + envoi + dédup)
//  vit dans controllers/notifController.js pour rester partagée
//  avec le déclenchement manuel depuis l'admin.
// ============================================================

const cron = require("node-cron");

function demarrerPlanification() {
  // Tous les jours à 8h00 (heure du serveur)
  cron.schedule("0 8 * * *", async () => {
    try {
      const { envoyerRappelsCloture } = require("../controllers/notifController");
      const resultat = await envoyerRappelsCloture();
      if (resultat.rappels.length > 0) {
        console.log(`🔔 Rappels clôture envoyés automatiquement : ${resultat.rappels.length} concours concerné(s).`);
      }
    } catch (err) {
      console.error("Erreur rappels clôture (cron) :", err.message);
    }
  });

  console.log("🕒 Planification des rappels de clôture activée (tous les jours à 8h).");
}

module.exports = { demarrerPlanification };
