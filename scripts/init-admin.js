// ============================================================
//  scripts/init-admin.js
//  Désigne manuellement UN SEUL compte administrateur du site.
//  Réutilise la même logique que le bootstrap automatique au
//  démarrage du serveur (services/adminBootstrap.js).
//
//  Usage :
//    npm run admin:init                       (utilise ADMIN_EMAIL ou la valeur par défaut)
//    node scripts/init-admin.js autre@mail.ci  (e-mail précis en argument)
// ============================================================

require("dotenv").config();
const { initDatabase, pool } = require("../config/database");
const { assurerAdminUnique } = require("../services/adminBootstrap");

(async () => {
  try {
    await initDatabase();
    const emailArg = process.argv[2];

    const resultat = await assurerAdminUnique(emailArg);

    console.log(`\n🔐 Configuration de l'administrateur unique : ${resultat.email}\n`);

    console.log("=== Administrateur(s) AVANT modification ===");
    if (resultat.avant.length === 0) {
      console.log("  Aucun compte n'avait le rôle admin.");
    } else {
      resultat.avant.forEach((u) => console.log(`  #${u.id}  ${u.nom}  <${u.email}>`));
    }

    if (!resultat.ok) {
      console.log(`\n❌ ${resultat.message}\n`);
      process.exitCode = 1;
      return;
    }

    console.log(`\n✅ ${resultat.message}`);
    if (resultat.retrogrades.length > 0) {
      console.log(`✅ ${resultat.retrogrades.length} compte(s) rétrogradé(s) en utilisateur standard :`);
      resultat.retrogrades.forEach((u) => console.log(`   - ${u.nom}  <${u.email}>`));
    } else {
      console.log("ℹ️  Aucun autre compte n'avait le rôle admin (rien à rétrograder).");
    }

    console.log("\n=== Administrateur(s) APRÈS modification (doit être 1 seul) ===");
    resultat.apres.forEach((u) => console.log(`  #${u.id}  ${u.nom}  <${u.email}>`));
    if (resultat.apres.length !== 1) {
      console.log("\n⚠️  Attention : il devrait y avoir exactement 1 administrateur, vérifie manuellement.");
    }

    console.log(
      "\n➡️  Le compte doit se déconnecter puis se reconnecter pour que le nouveau rôle soit pris en compte.\n",
    );
  } catch (err) {
    console.error("❌ Erreur :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
