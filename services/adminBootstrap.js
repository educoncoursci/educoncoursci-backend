// ============================================================
//  services/adminBootstrap.js
//  Garantit qu'UN SEUL compte a le rôle admin : celui défini par
//  ADMIN_EMAIL (ou la valeur par défaut ci-dessous). Rétrograde
//  automatiquement tout autre compte qui aurait le rôle admin.
//
//  Utilisé par :
//  - server.js : exécuté à chaque démarrage du serveur (idempotent,
//    donc sans danger si le serveur redémarre plusieurs fois).
//  - scripts/init-admin.js : exécution manuelle via `npm run admin:init`.
// ============================================================

const { query } = require("../config/database");
const cron = require("node-cron");

const EMAIL_PAR_DEFAUT = "akone97@hotmail.com";

async function assurerAdminUnique(emailCible) {
  const email = (emailCible || process.env.ADMIN_EMAIL || EMAIL_PAR_DEFAUT)
    .toLowerCase()
    .trim();

  const avant = await query(
    `SELECT id, nom, email FROM users WHERE role = 'admin' ORDER BY id`,
  );

  const cible = await query(
    `SELECT id, nom, email, role FROM users WHERE email = $1`,
    [email],
  );

  if (cible.rows.length === 0) {
    return {
      ok: false,
      email,
      avant: avant.rows,
      message: `Aucun compte trouvé avec l'e-mail ${email}. Le compte doit d'abord être créé via l'inscription du site.`,
    };
  }

  const retrogrades = await query(
    `UPDATE users SET role = 'user'
     WHERE role = 'admin' AND email != $1
     RETURNING id, nom, email`,
    [email],
  );

  const promu = await query(
    `UPDATE users SET role = 'admin' WHERE email = $1
     RETURNING id, nom, email, role`,
    [email],
  );

  const apres = await query(
    `SELECT id, nom, email FROM users WHERE role = 'admin' ORDER BY id`,
  );

  return {
    ok: true,
    email,
    avant: avant.rows,
    promu: promu.rows[0],
    retrogrades: retrogrades.rows,
    apres: apres.rows,
    message: `${promu.rows[0].nom} <${promu.rows[0].email}> est administrateur.`,
  };
}

module.exports = { assurerAdminUnique, EMAIL_PAR_DEFAUT, demarrerVerificationPeriodique };

// ── Revérifie périodiquement (toutes les 10 min) ────────────────
// Utile si le compte cible n'existe pas encore au démarrage du
// serveur : dès qu'il est créé (inscription normale sur le site),
// il est promu admin au prochain passage, sans avoir à redémarrer
// ni redéployer le serveur.
function demarrerVerificationPeriodique() {
  cron.schedule("*/10 * * * *", async () => {
    try {
      const resultat = await assurerAdminUnique();
      if (resultat.ok) {
        console.log(`👑 Admin unique confirmé : ${resultat.message}`);
      }
      // Si le compte n'existe pas encore, on se tait (évite le bruit
      // dans les logs) — le message a déjà été affiché au démarrage.
    } catch (err) {
      console.warn("⚠️  Vérification admin périodique impossible :", err.message);
    }
  });
}
