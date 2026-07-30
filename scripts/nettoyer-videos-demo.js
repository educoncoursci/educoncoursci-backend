// ============================================================
//  scripts/nettoyer-videos-demo.js
//  Script à usage UNIQUE : supprime les vidéos de démonstration
//  dont le contenu n'a jamais été vérifié comme étant réellement
//  ivoirien (identifiants YouTube ajoutés lors du tout premier
//  seed, jamais confirmés).
//
//  Usage : npm run videos:nettoyer-demo
//  (sans danger : ne supprime que les 8 identifiants précis
//  listés ci-dessous, aucune autre vidéo n'est touchée)
// ============================================================

require("dotenv").config();
const { initDatabase, query, pool } = require("../config/database");

const ANCIENS_IDS_NON_VERIFIES = [
  "fQPCCVxJz4E",
  "SAxU7Axs3Oo",
  "JfZonawsxFM",
  "XgNbAPyLb8U",
  "8TbfmbLJrDw",
  "bk-oXiC1CRM",
  "vwrHXelwxp4",
  "BffD0I3aBAE",
];

(async () => {
  try {
    await initDatabase();
    const result = await query(
      `DELETE FROM videos WHERE youtube_id = ANY($1::text[]) RETURNING titre`,
      [ANCIENS_IDS_NON_VERIFIES],
    );
    console.log(`✅ ${result.rows.length} vidéo(s) de démo non vérifiée(s) supprimée(s) :`);
    result.rows.forEach((r) => console.log(`   - ${r.titre}`));
    if (result.rows.length === 0) {
      console.log("   (aucune trouvée — déjà nettoyé, ou seed jamais exécuté)");
    }
    console.log("\n➡️  Ajoute maintenant de vraies vidéos ivoiriennes vérifiées via /admin/videos.html");
  } catch (err) {
    console.error("❌ Erreur :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
