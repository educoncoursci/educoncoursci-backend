// ============================================================
//  models/Newsletter.js
//  Abonnés newsletter (Lot 2 — page d'accueil).
// ============================================================

const { query } = require("../config/database");

const Newsletter = {
  async inscrire(email) {
    const result = await query(
      `INSERT INTO newsletter_abonnes (email) VALUES ($1)
       ON CONFLICT (email) DO NOTHING
       RETURNING *`,
      [email],
    );
    return result.rows[0] || null; // null = déjà inscrit
  },

  async findAll({ limit = 100, offset = 0 } = {}) {
    const result = await query(
      `SELECT * FROM newsletter_abonnes ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  },

  async count() {
    const result = await query("SELECT COUNT(*) FROM newsletter_abonnes");
    return parseInt(result.rows[0].count, 10);
  },

  async supprimer(id) {
    const result = await query(
      "DELETE FROM newsletter_abonnes WHERE id = $1 RETURNING id",
      [id],
    );
    return result.rows.length > 0;
  },
};

module.exports = Newsletter;
