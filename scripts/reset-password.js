// ============================================================
//  scripts/reset-password.js
//  Réinitialise directement le mot de passe d'un compte, sans
//  passer par l'e-mail. Utile en cas de blocage immédiat (ex:
//  compte admin dont le mot de passe a été oublié).
//
//  Usage :
//    node scripts/reset-password.js akone97@hotmail.com NouveauMotDePasse123
// ============================================================

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { query, initDatabase, pool } = require("../config/database");

const email    = process.argv[2];
const nouveauMdp = process.argv[3];

(async () => {
  try {
    if (!email || !nouveauMdp) {
      console.log("\nUsage : node scripts/reset-password.js <email> <nouveau_mot_de_passe>\n");
      process.exitCode = 1;
      return;
    }
    if (nouveauMdp.length < 6) {
      console.log("\n❌ Le mot de passe doit contenir au moins 6 caractères.\n");
      process.exitCode = 1;
      return;
    }

    await initDatabase();

    const existant = await query(`SELECT id, nom, email FROM users WHERE email = $1`, [
      email.toLowerCase().trim(),
    ]);
    if (existant.rows.length === 0) {
      console.log(`\n❌ Aucun compte trouvé avec l'e-mail ${email}.\n`);
      process.exitCode = 1;
      return;
    }

    const hash = await bcrypt.hash(nouveauMdp, 12);
    await query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expire = NULL WHERE email = $2`,
      [hash, email.toLowerCase().trim()],
    );

    console.log(`\n✅ Mot de passe réinitialisé pour ${existant.rows[0].nom} <${existant.rows[0].email}>.`);
    console.log("   Tu peux maintenant te connecter avec ce nouveau mot de passe.\n");
  } catch (err) {
    console.error("❌ Erreur :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
