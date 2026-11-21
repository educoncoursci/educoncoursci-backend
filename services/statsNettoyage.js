// Conservation limitée des statistiques d'audience : 400 jours maximum.
const cron = require("node-cron");
const { query } = require("../config/database");

async function nettoyer() {
  const r = await query(`DELETE FROM stats_hits WHERE jour < CURRENT_DATE - 400 RETURNING id`);
  return r.rows.length;
}
function demarrerPlanification() {
  cron.schedule("30 3 * * *", async () => {
    try { await nettoyer(); } catch (err) { console.error("Erreur nettoyage stats :", err.message); }
  }, { timezone: "Africa/Abidjan" });
}
module.exports = { nettoyer, demarrerPlanification };
