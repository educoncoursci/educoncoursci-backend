// ============================================================
//  models/Structure.js
//  Requêtes SQL pour la table structures (ENA, INFAS, CAFOP...).
// ============================================================

const { query } = require("../config/database");

const Structure = {
  async findAll() {
    const result = await query("SELECT * FROM structures ORDER BY nom ASC");
    return result.rows;
  },

  async findById(id) {
    const result = await query("SELECT * FROM structures WHERE id = $1", [id]);
    return result.rows[0] || null;
  },

  async create({ nom, sigle, ministere, description, siteWeb, logoUrl }) {
    const result = await query(
      `INSERT INTO structures (nom, sigle, ministere, description, site_web, logo_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nom, sigle || null, ministere || null, description || null, siteWeb || null, logoUrl || null]
    );
    return result.rows[0];
  },

  async update(id, { nom, sigle, ministere, description, siteWeb, logoUrl }) {
    const result = await query(
      `UPDATE structures
       SET nom = $1, sigle = $2, ministere = $3, description = $4, site_web = $5, logo_url = $6
       WHERE id = $7 RETURNING *`,
      [nom, sigle || null, ministere || null, description || null, siteWeb || null, logoUrl || null, id]
    );
    return result.rows[0] || null;
  },

  async delete(id) {
    const result = await query("DELETE FROM structures WHERE id = $1 RETURNING id", [id]);
    return result.rows.length > 0;
  },
};

module.exports = Structure;
