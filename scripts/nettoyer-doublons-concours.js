// ============================================================
//  scripts/nettoyer-doublons-concours.js
//  Détecte et supprime automatiquement TOUS les doublons de
//  concours (même titre + même organisme), peu importe leur
//  formulation exacte — contrairement à
//  scripts/corriger-fiches-obsoletes.js qui cible des titres
//  précis, celui-ci détecte n'importe quel doublon présent en
//  base au moment de l'exécution.
//
//  Pourquoi ce script existe : la contrainte SQL anti-doublon
//  (concours_titre_organisme_uniq) ne peut être posée QUE si la
//  base ne contient déjà aucun doublon — sinon PostgreSQL refuse
//  de la créer, et le message "Contrainte anti-doublon absente"
//  apparaît dans les logs à chaque démarrage. Ce script casse ce
//  cercle : il nettoie d'abord les doublons existants, ce qui
//  permet ensuite à initDatabase() de poser la contrainte avec
//  succès au prochain redémarrage.
//
//  Règle de conservation : pour chaque paire (titre, organisme) en
//  double, garde l'exemplaire avec l'id le PLUS ÉLEVÉ (= le plus
//  récemment créé, donc le plus probablement à jour) et supprime
//  les autres.
//
//  Usage : node scripts/nettoyer-doublons-concours.js
// ============================================================

require("dotenv").config();
const { query, initDatabase, pool } = require("../config/database");

(async () => {
  try {
    await initDatabase();
    console.log("\n🔍 Recherche des doublons de concours (même titre + même organisme)…\n");

    const doublons = await query(`
      SELECT titre, organisme, COUNT(*) as nombre, array_agg(id ORDER BY id) as ids
      FROM concours
      GROUP BY titre, organisme
      HAVING COUNT(*) > 1
    `);

    if (doublons.rows.length === 0) {
      console.log("✅ Aucun doublon détecté — rien à nettoyer.");
      console.log("   Si le message \"Contrainte anti-doublon absente\" persiste dans tes logs,");
      console.log("   redémarre le service backend (Render) pour qu'initDatabase() repose la contrainte.");
      return;
    }

    console.log(`⚠️  ${doublons.rows.length} groupe(s) de doublons détecté(s) :\n`);

    let totalSupprimes = 0;
    for (const d of doublons.rows) {
      const idsAConserver = d.ids[d.ids.length - 1]; // le plus récent (id le plus élevé)
      const idsASupprimer = d.ids.slice(0, -1);

      console.log(`  "${d.titre}" (${d.organisme})`);
      console.log(`    ${d.nombre} exemplaires trouvés — conservation de l'id ${idsAConserver}, suppression de : ${idsASupprimer.join(", ")}`);

      const resultat = await query(
        `DELETE FROM concours WHERE id = ANY($1::int[]) RETURNING id`,
        [idsASupprimer],
      );
      totalSupprimes += resultat.rows.length;
    }

    console.log(`\n✅ Terminé : ${totalSupprimes} doublon(s) supprimé(s).`);
    console.log("ℹ️  Redémarre le service backend (Render) pour que la contrainte anti-doublon");
    console.log("   soit posée avec succès au prochain démarrage (elle ne peut pas");
    console.log("   être créée tant que des doublons existent en base).");
  } catch (err) {
    console.error("❌ Erreur lors du nettoyage des doublons :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
