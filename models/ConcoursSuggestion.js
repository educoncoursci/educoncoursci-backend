// ============================================================
//  models/ConcoursSuggestion.js
//  Lot 18 — File de validation des concours détectés automatiquement.
// ============================================================

const { query } = require("../config/database");

const ConcoursSuggestion = {
  async creer({ titre, extrait, sourceNom, sourceUrl, lien, hash }) {
    const result = await query(
      `INSERT INTO concours_suggestions (titre, extrait, source_nom, source_url, lien, hash)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (hash) DO NOTHING RETURNING *`,
      [titre, extrait || null, sourceNom || null, sourceUrl || null, lien || null, hash],
    );
    return result.rows[0] || null;
  },

  async findEnAttente() {
    const result = await query(
      `SELECT * FROM concours_suggestions WHERE statut = 'en_attente' ORDER BY created_at DESC LIMIT 100`,
    );
    return result.rows;
  },

  async findById(id) {
    const result = await query(`SELECT * FROM concours_suggestions WHERE id = $1`, [id]);
    return result.rows[0] || null;
  },

  async marquerApprouvee(id, concoursId) {
    await query(
      `UPDATE concours_suggestions SET statut = 'approuvee', concours_id_cree = $1 WHERE id = $2`,
      [concoursId, id],
    );
  },

  async marquerRejetee(id) {
    await query(`UPDATE concours_suggestions SET statut = 'rejetee' WHERE id = $1`, [id]);
  },

  async compterEnAttente() {
    const result = await query(`SELECT COUNT(*) FROM concours_suggestions WHERE statut = 'en_attente'`);
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = ConcoursSuggestion;
