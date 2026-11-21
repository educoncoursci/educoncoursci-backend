// ============================================================
//  models/SuiviCandidature.js
//  Suivi PERSONNEL des candidatures d'emploi d'un membre.
//  Toutes les requêtes sont filtrées par user_id : un membre ne
//  peut ni lire, ni modifier, ni supprimer le suivi d'un autre.
// ============================================================
const { query } = require("../config/database");

const STATUTS = ["a_envoyer", "envoyee", "relancee", "entretien", "acceptee", "refusee"];
const MAX_PAR_MEMBRE = 200;

const COLONNES = `id, poste, organisme, lien, statut, notes,
  to_char(date_candidature, 'YYYY-MM-DD') AS date_candidature,
  to_char(relance_le, 'YYYY-MM-DD') AS relance_le,
  created_at, updated_at`;

const SuiviCandidature = {
  STATUTS,
  MAX_PAR_MEMBRE,

  async lister(userId) {
    const r = await query(
      `SELECT ${COLONNES} FROM suivi_candidatures WHERE user_id = $1 ORDER BY updated_at DESC, id DESC`,
      [userId],
    );
    return r.rows;
  },

  async compter(userId) {
    const r = await query(`SELECT COUNT(*)::int AS n FROM suivi_candidatures WHERE user_id = $1`, [userId]);
    return r.rows[0].n;
  },

  async creer(userId, d) {
    const r = await query(
      `INSERT INTO suivi_candidatures (user_id, poste, organisme, lien, statut, date_candidature, relance_le, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${COLONNES}`,
      [userId, d.poste, d.organisme, d.lien, d.statut, d.date_candidature, d.relance_le, d.notes],
    );
    return r.rows[0];
  },

  // Seuls les champs fournis sont modifiés ; la ligne doit appartenir au membre.
  async modifier(id, userId, d) {
    const champs = [];
    const valeurs = [];
    for (const k of ["poste", "organisme", "lien", "statut", "date_candidature", "relance_le", "notes"]) {
      if (Object.prototype.hasOwnProperty.call(d, k)) {
        valeurs.push(d[k]);
        champs.push(`${k} = $${valeurs.length}`);
      }
    }
    if (!champs.length) return null;
    valeurs.push(id, userId);
    const r = await query(
      `UPDATE suivi_candidatures SET ${champs.join(", ")}, updated_at = NOW()
       WHERE id = $${valeurs.length - 1} AND user_id = $${valeurs.length}
       RETURNING ${COLONNES}`,
      valeurs,
    );
    return r.rows[0] || null;
  },

  async supprimer(id, userId) {
    const r = await query(`DELETE FROM suivi_candidatures WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
    return r.rowCount > 0;
  },
};

module.exports = SuiviCandidature;
