// ============================================================
//  services/rappelsPersonnels.js
//  Envoi quotidien d'UN SEUL e-mail « rappels du jour » par membre :
//   - candidatures à relancer (suivi personnel, relance prévue depuis ≤ 3 jours)
//   - fin d'abonnement Premium (J-7 et J-1)
//  Les rappels de clôture de concours restent gérés par rappelsScheduler.js.
//  - uniquement e-mails vérifiés et membres n'ayant pas désactivé les rappels
//  - la date de dernier envoi n'avance QU'APRÈS un envoi réussi
//  - plafond : 500 membres par passage
// ============================================================
const cron = require("node-cron");
const { query } = require("../config/database");
const emailService = require("./email");

const MAX_MEMBRES = 500;
const aujourdhui = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Abidjan" }).format(new Date());

async function envoyerRappels(jour = aujourdhui()) {
  const { rows: membres } = await query(
    `SELECT u.id, u.nom, u.email, u.premium, to_char(u.premium_expire, 'YYYY-MM-DD') AS premium_expire,
            (u.premium_expire - $1::date) AS jours_restants
       FROM users u
      WHERE u.email_verified = TRUE
        AND u.rappels_email = TRUE
        AND (u.rappels_envoye_le IS NULL OR u.rappels_envoye_le < $1::date)
        AND (
          EXISTS (SELECT 1 FROM suivi_candidatures s
                   WHERE s.user_id = u.id AND s.statut IN ('envoyee','relancee')
                     AND s.relance_le BETWEEN $1::date - 3 AND $1::date)
          OR (u.premium = TRUE AND (u.premium_expire - $1::date) IN (1, 7))
        )
      ORDER BY u.id
      LIMIT ${MAX_MEMBRES}`,
    [jour],
  );
  let envoyes = 0, echecs = 0;
  for (const m of membres) {
    try {
      const { rows: relances } = await query(
        `SELECT poste, organisme, to_char(relance_le, 'YYYY-MM-DD') AS relance_le
           FROM suivi_candidatures
          WHERE user_id = $1 AND statut IN ('envoyee','relancee')
            AND relance_le BETWEEN $2::date - 3 AND $2::date
          ORDER BY relance_le LIMIT 5`,
        [m.id, jour],
      );
      const j = m.jours_restants == null ? null : Number(m.jours_restants);
      const expiration = m.premium && (j === 1 || j === 7)
        ? { jours: j, date: m.premium_expire.split("-").reverse().join("/") } : null;
      if (!relances.length && !expiration) continue;
      await emailService.envoyerRappelsPersonnels(m.email, m.nom, { relances, expiration });
      await query(`UPDATE users SET rappels_envoye_le = $1::date WHERE id = $2`, [jour, m.id]);
      envoyes++;
    } catch (err) {
      echecs++;
      console.error("Erreur rappels personnels (membre " + m.id + ") :", err.message);
    }
  }
  return { candidats: membres.length, envoyes, echecs };
}

function demarrerPlanification() {
  cron.schedule("15 8 * * *", async () => {
    try {
      const r = await envoyerRappels();
      if (r.envoyes || r.echecs) console.log(`📬 Rappels personnels : ${r.envoyes} e-mail(s) envoyé(s), ${r.echecs} échec(s).`);
    } catch (err) {
      console.error("Erreur rappels personnels (cron) :", err.message);
    }
  }, { timezone: "Africa/Abidjan" });
  console.log("🕒 Rappels personnels par e-mail activés (tous les jours à 8h15).");
}

module.exports = { envoyerRappels, demarrerPlanification };
