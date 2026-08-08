// ============================================================
//  services/concoursStatutScheduler.js
//  Lot 18 — Calcule et met à jour automatiquement le statut de
//  chaque concours (à venir / ouvert / fermé) à partir de ses
//  vraies dates (date_ouverture / date_cloture), sans aucune
//  intervention manuelle. C'est ce mécanisme qui répond au
//  problème "les concours en cours ne sont pas correctement
//  détectés" et "les concours à venir ne sont pas bien séparés".
//
//  Règles :
//  - Ne touche jamais un concours dont statut_auto = FALSE (un
//    admin a choisi de garder la main dessus — report, cas
//    particulier...).
//  - Ne touche jamais un concours au statut "résultats" (c'est un
//    statut manuel, publié par un admin quand les résultats
//    sortent — pas déductible d'une date).
//  - Ne touche jamais un concours sans date_ouverture NI
//    date_cloture renseignées (rien à calculer — reste sur le
//    statut choisi manuellement à la création).
//  - Régénère aussi le texte affiché (ouverture/cloture) à partir
//    des vraies dates, pour que tout le frontend existant (qui
//    lit ces champs comme du texte) reste toujours synchronisé
//    sans qu'aucune page n'ait eu besoin d'être modifiée.
// ============================================================

const cron = require("node-cron");
const { query } = require("../config/database");

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formaterDateFr(date) {
  const d = new Date(date);
  return `${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function calculerStatut(dateOuverture, dateCloture, aujourdHui) {
  if (dateOuverture && aujourdHui < new Date(dateOuverture)) return "à venir";
  if (dateCloture && aujourdHui > new Date(dateCloture)) return "fermé";
  return "ouvert";
}

async function recalculerStatuts() {
  const result = await query(
    `SELECT id, titre, statut, date_ouverture, date_cloture
     FROM concours
     WHERE statut_auto = TRUE
       AND statut != 'résultats'
       AND (date_ouverture IS NOT NULL OR date_cloture IS NOT NULL)`,
  );

  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);

  let misAJour = 0;

  for (const concours of result.rows) {
    const nouveauStatut = calculerStatut(concours.date_ouverture, concours.date_cloture, aujourdHui);
    const nouveauTexteOuverture = concours.date_ouverture ? formaterDateFr(concours.date_ouverture) : null;
    const nouveauTexteCloture   = concours.date_cloture   ? formaterDateFr(concours.date_cloture)   : null;

    if (nouveauStatut !== concours.statut) {
      await query(
        `UPDATE concours SET statut = $1,
           ouverture = COALESCE($2, ouverture),
           cloture   = COALESCE($3, cloture)
         WHERE id = $4`,
        [nouveauStatut, nouveauTexteOuverture, nouveauTexteCloture, concours.id],
      );
      misAJour++;
    }
  }

  if (misAJour > 0) {
    console.log(`🗓️  Statuts concours recalculés automatiquement : ${misAJour} concours mis à jour.`);
  }
  return misAJour;
}

function demarrerPlanification() {
  // Un premier passage 30s après le démarrage (rattrape tout ce qui a
  // changé de statut pendant que le serveur était éteint)
  setTimeout(() => {
    recalculerStatuts().catch((err) =>
      console.error("Erreur recalcul statuts concours (démarrage) :", err.message),
    );
  }, 30000);

  // Puis une fois par jour à 00h05 (heure serveur)
  cron.schedule("5 0 * * *", () => {
    recalculerStatuts().catch((err) =>
      console.error("Erreur recalcul statuts concours (planifié) :", err.message),
    );
  });

  console.log("🕒 Automatisation du statut des concours activée (recalcul quotidien).");
}

module.exports = { recalculerStatuts, demarrerPlanification };
