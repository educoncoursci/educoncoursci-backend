// ============================================================
//  services/alertesEmploi.js
//  Envoi quotidien d'UN e-mail récapitulatif par membre pour les
//  nouvelles offres correspondant à ses alertes.
//  - uniquement e-mails vérifiés ; offres publiées après le dernier envoi
//  - la date de dernier envoi n'avance QU'APRÈS un envoi réussi
//  - plafonds : 10 offres par e-mail, 500 membres par passage
// ============================================================
const cron = require("node-cron");
const Emploi = require("../models/Emploi");
const emailService = require("./email");

const MAX_MEMBRES = 500;

async function envoyerAlertes() {
  const alertes = await Emploi.alertesActivesAvecEmail();
  const parMembre = new Map();
  for (const a of alertes) {
    if (!parMembre.has(a.user_id)) parMembre.set(a.user_id, []);
    parMembre.get(a.user_id).push(a);
  }
  let envoyes = 0, echecs = 0, traites = 0;
  for (const [, liste] of parMembre) {
    if (++traites > MAX_MEMBRES) break;
    try {
      const vues = new Map();
      for (const a of liste) {
        for (const o of await Emploi.offresPourAlerte(a)) vues.set(o.id, o);
      }
      if (vues.size) {
        const offres = [...vues.values()].slice(0, 10);
        await emailService.envoyerAlertesEmploi(liste[0].email, liste[0].nom, offres);
        envoyes++;
      }
      // Avance la date même sans nouvelle offre ; en cas d'échec d'envoi on passe au catch et rien n'avance.
      await Emploi.marquerAlertesNotifiees(liste.map((a) => a.id));
    } catch (err) {
      echecs++;
      console.error("Erreur alerte emploi (membre " + liste[0].user_id + ") :", err.message);
    }
  }
  return { membres: parMembre.size, envoyes, echecs };
}

function demarrerPlanification() {
  cron.schedule("30 8 * * *", async () => {
    try {
      const r = await envoyerAlertes();
      if (r.envoyes || r.echecs) console.log(`📬 Alertes emploi : ${r.envoyes} e-mail(s) envoyé(s), ${r.echecs} échec(s).`);
    } catch (err) {
      console.error("Erreur alertes emploi (cron) :", err.message);
    }
  });
  console.log("🕒 Alertes emploi par e-mail activées (tous les jours à 8h30).");
}

module.exports = { envoyerAlertes, demarrerPlanification };
