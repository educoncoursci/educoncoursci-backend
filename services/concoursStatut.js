// ============================================================
//  services/concoursStatut.js
//  Source UNIQUE de vérité pour le statut d'un concours.
//  Le statut est calculé à partir des dates réelles, jamais de l'année,
//  et toujours à la date du jour en Africa/Abidjan (pas celle du serveur).
//
//   à venir                 : aujourd'hui < ouverture des inscriptions
//   ouvert (en cours)       : ouverture ≤ aujourd'hui ≤ clôture
//   fermé (clôturé)         : aujourd'hui > clôture
//   en attente de résultats : aujourd'hui > date de composition (si connue)
//   résultats / suspendu / annulé : statuts MANUELS (événements réels
//                             publiés par un admin), jamais recalculés.
//
//  Rien n'est supposé : sans date de composition on ne prétend pas que
//  les épreuves sont terminées ; sans aucune date on ne touche à rien.
// ============================================================

const { query } = require("../config/database");

const FUSEAU = "Africa/Abidjan";
const STATUTS_MANUELS = ["résultats", "suspendu", "annulé"];

// Groupes d'affichage public (clé API → statuts en base)
const GROUPES = {
  en_cours: ["ouvert"],
  a_venir: ["à venir"],
  cloture: ["fermé"],
  attente_resultats: ["en attente de résultats"],
  resultats: ["résultats"],
  suspendu_annule: ["suspendu", "annulé"],
  non_confirme: ["information non confirmée"],
};

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Date du jour en Africa/Abidjan, au format AAAA-MM-JJ. */
function aujourdhuiAbidjan(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** « 2026-11-16 » → « 16 novembre 2026 » (sans passer par Date : aucun décalage de fuseau possible). */
function formaterDateFr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${MOIS_FR[Number(m[2]) - 1]} ${m[1]}` : null;
}

/**
 * Calcule le statut automatique. Les dates sont des chaînes AAAA-MM-JJ
 * (comparables telles quelles). Retourne null s'il n'y a rien à calculer.
 */
function calculerStatut({ date_ouverture, date_cloture, date_composition }, aujourdhui = aujourdhuiAbidjan()) {
  if (date_composition && aujourdhui > date_composition) return "en attente de résultats";
  if (date_cloture && aujourdhui > date_cloture) return "fermé";
  if (date_ouverture && aujourdhui < date_ouverture) return "à venir";
  if (date_ouverture || date_cloture) return "ouvert";
  return null;
}

const COLONNES_DATES = `id, statut, statut_auto, ouverture, cloture,
  to_char(date_ouverture, 'YYYY-MM-DD') AS date_ouverture,
  to_char(date_cloture, 'YYYY-MM-DD') AS date_cloture,
  to_char(date_composition, 'YYYY-MM-DD') AS date_composition`;

async function appliquer(c, aujourdhui) {
  if (c.statut_auto === false) return false;
  if (STATUTS_MANUELS.includes(c.statut)) return false;
  const nouveau = calculerStatut(c, aujourdhui);
  if (!nouveau) return false;
  const texteOuv = c.date_ouverture ? formaterDateFr(c.date_ouverture) : null;
  const texteClo = c.date_cloture ? formaterDateFr(c.date_cloture) : null;
  const memeTexte = (!texteOuv || texteOuv === c.ouverture) && (!texteClo || texteClo === c.cloture);
  if (nouveau === c.statut && memeTexte) return false;
  await query(
    `UPDATE concours SET statut = $1, ouverture = COALESCE($2, ouverture), cloture = COALESCE($3, cloture) WHERE id = $4`,
    [nouveau, texteOuv, texteClo, c.id],
  );
  return nouveau !== c.statut;
}

/** Recalcule tous les concours en mode automatique. Retourne le nombre de statuts changés. */
async function recalculerTous() {
  const aujourdhui = aujourdhuiAbidjan();
  const r = await query(
    `SELECT ${COLONNES_DATES} FROM concours
     WHERE statut_auto IS DISTINCT FROM FALSE
       AND statut NOT IN ('résultats', 'suspendu', 'annulé')
       AND (date_ouverture IS NOT NULL OR date_cloture IS NOT NULL OR date_composition IS NOT NULL)`,
  );
  let changes = 0;
  for (const c of r.rows) if (await appliquer(c, aujourdhui)) changes++;
  return changes;
}

/** Recalcule un seul concours (après création / modification). */
async function recalculerUn(id) {
  const r = await query(`SELECT ${COLONNES_DATES} FROM concours WHERE id = $1`, [id]);
  if (r.rows[0]) await appliquer(r.rows[0], aujourdhuiAbidjan());
}

// Rafraîchissement « à la lecture » : garantit qu'un concours qui change de
// catégorie à minuit apparaît au bon endroit même si le calcul planifié a
// été manqué (redémarrage, hébergeur en veille). Au plus une fois par minute.
let dernierRafraichissement = 0;
async function rafraichirSiNecessaire() {
  const maintenant = Date.now();
  if (maintenant - dernierRafraichissement < 60 * 1000) return;
  dernierRafraichissement = maintenant;
  try { await recalculerTous(); }
  catch (e) { console.error("Rafraîchissement des statuts concours :", e.message); }
}

module.exports = { FUSEAU, STATUTS_MANUELS, GROUPES, aujourdhuiAbidjan, formaterDateFr, calculerStatut, recalculerTous, recalculerUn, rafraichirSiNecessaire };
