// ============================================================
//  models/ConcoursSource.js
//  Lot 18 — Sources RSS surveillées pour détecter automatiquement
//  de nouveaux concours (gérées par l'admin, sans toucher au code).
// ============================================================

const { query } = require("../config/database");

const ConcoursSource = {
  async findActives() {
    const result = await query(`SELECT * FROM concours_sources WHERE actif = TRUE`);
    return result.rows;
  },

  async findAll() {
    const result = await query(`SELECT * FROM concours_sources ORDER BY created_at DESC`);
    return result.rows;
  },

  async create({ nom, url }) {
    const result = await query(
      `INSERT INTO concours_sources (nom, url) VALUES ($1, $2)
       ON CONFLICT (url) DO NOTHING RETURNING *`,
      [nom, url],
    );
    return result.rows[0] || null;
  },

  async toggleActif(id, actif) {
    const result = await query(
      `UPDATE concours_sources SET actif = $1 WHERE id = $2 RETURNING *`,
      [actif, id],
    );
    return result.rows[0] || null;
  },

  async supprimer(id) {
    const result = await query(`DELETE FROM concours_sources WHERE id = $1 RETURNING id`, [id]);
    return result.rows.length > 0;
  },
};

module.exports = ConcoursSource;
