// ============================================================
//  scripts/nettoyer-demo.js
//  Supprime les contenus de démonstration insérés par scripts/seed.js :
//  - les 8 vidéos YouTube de démo (ciblées par leur youtube_id exact)
//  - les 8 PDF factices (url = https://example.com/... — aucun fichier réel)
//  - les offres d'emploi de démo (ciblées par titre + entreprise exacts)
//
//  Ne touche JAMAIS un contenu que tu as ajouté toi-même : chaque
//  suppression cible des identifiants précis, jamais "tout supprimer".
//
//  Usage : npm run demo:nettoyer
// ============================================================

require("dotenv").config();
const { query, initDatabase, pool } = require("../config/database");

// Les mêmes youtube_id que dans scripts/seed.js
const YOUTUBE_ID_DEMO = [
  "fQPCCVxJz4E", "SAxU7Axs3Oo", "JfZonawsxFM", "XgNbAPyLb8U",
  "8TbfmbLJrDw", "bk-oXiC1CRM", "vwrHXelwxp4", "BffD0I3aBAE",
];

(async () => {
  try {
    await initDatabase();
    console.log("\n🧹 Nettoyage des contenus de démonstration…\n");

    // ── Vidéos de démo ───────────────────────────────────────
    const videos = await query(
      `DELETE FROM videos WHERE youtube_id = ANY($1::text[]) RETURNING titre`,
      [YOUTUBE_ID_DEMO],
    );
    console.log(`🎬 Vidéos de démo supprimées : ${videos.rows.length}`);
    videos.rows.forEach((v) => console.log(`   - ${v.titre}`));

    // ── PDF factices (url example.com) ───────────────────────
    const pdfs = await query(
      `DELETE FROM pdfs WHERE url LIKE 'https://example.com/%' RETURNING titre`,
    );
    console.log(`\n📄 PDF factices supprimés : ${pdfs.rows.length}`);
    pdfs.rows.forEach((p) => console.log(`   - ${p.titre}`));

    // ── Offres d'emploi de démo ───────────────────────────────
    const emplois = await query(
      `DELETE FROM offres_emploi
       WHERE origine = 'manuel'
         AND titre IN (
           'Gestionnaire de comptes PME/PMI senior (H/F)',
           'Gestionnaire Immobilier — Property Management Officer (H/F)',
           'Commercial(e) — Pièces de rechange véhicules lourds & engins BTP',
           'Chef Pâtissier Chocolatier (H/F)',
           'Développeur(se) Angular'
         )
       RETURNING titre`,
    );
    console.log(`\n💼 Offres d'emploi de démo supprimées : ${emplois.rows.length}`);
    emplois.rows.forEach((e) => console.log(`   - ${e.titre}`));

    console.log(
      "\n✅ Nettoyage terminé. La base est prête pour tes propres contenus" +
      " (vidéos, PDF, offres) via le panneau d'administration.\n",
    );
    console.log(
      "ℹ️  Non touchés (hors du périmètre de ce nettoyage) : concours, QCM," +
      " comptes de test (koffi@test.ci / aminata@test.ci). Dis-le si tu veux" +
      " aussi les supprimer.\n",
    );
  } catch (err) {
    console.error("❌ Erreur :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
