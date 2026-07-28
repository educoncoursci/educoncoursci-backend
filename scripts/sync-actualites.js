// ============================================================
//  scripts/sync-actualites.js
//  Déclenche manuellement une synchronisation du flux
//  d'actualités (utile en local ou pour un premier remplissage
//  après déploiement).
//  Usage : npm run actualites:sync
// ============================================================

require("dotenv").config();
const { initDatabase, pool } = require("../config/database");
const { synchroniser } = require("../services/actualitesFeed");

(async () => {
  try {
    await initDatabase();
    const nombre = await synchroniser();
    console.log(`✅ Synchronisation terminée : ${nombre} nouvelle(s) actualité(s) ajoutée(s).`);
  } catch (err) {
    console.error("❌ Erreur de synchronisation :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
