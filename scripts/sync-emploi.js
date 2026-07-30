// ============================================================
//  scripts/sync-emploi.js
//  Déclenche manuellement une synchronisation des offres
//  d'emploi depuis les flux externes configurés (EMPLOI_FLUX_URLS).
//  Usage : npm run emploi:sync
// ============================================================

require("dotenv").config();
const { initDatabase, pool } = require("../config/database");
const { synchroniser } = require("../services/emploiFeed");

(async () => {
  try {
    await initDatabase();
    const nombre = await synchroniser();
    console.log(`✅ Synchronisation terminée : ${nombre} nouvelle(s) offre(s) ajoutée(s).`);
  } catch (err) {
    console.error("❌ Erreur de synchronisation :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
