// ============================================================
//  models/Diplome.js
//  Requêtes SQL pour la table diplomes.
// ============================================================

const { query } = require("../config/database");

const Diplome = {
  async findAll() {
    const result = await query("SELECT * FROM diplomes ORDER BY niveau ASC NULLS LAST, nom ASC");
    return result.rows;
  },

  async findById(id) {
    const result = await query("SELECT * FROM diplomes WHERE id = $1", [id]);
    return result.rows[0] || null;
  },

  async create({ nom, niveau }) {
    const result = await query(
      `INSERT INTO diplomes (nom, niveau) VALUES ($1,$2)
       ON CONFLICT (nom) DO UPDATE SET niveau = EXCLUDED.niveau
       RETURNING *`,
      [nom, niveau ?? null]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await query("DELETE FROM diplomes WHERE id = $1 RETURNING id", [id]);
    return result.rows.length > 0;
  },

  // ── Relier une liste de diplômes acceptés à un concours ─────
  async definirPourConcours(concoursId, diplomeIds = []) {
    await query("DELETE FROM concours_diplomes WHERE concours_id = $1", [concoursId]);
    for (const diplomeId of diplomeIds) {
      await query(
        "INSERT INTO concours_diplomes (concours_id, diplome_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [concoursId, diplomeId]
      );
    }
  },

  async findByConcours(concoursId) {
    const result = await query(
      `SELECT d.* FROM diplomes d
       JOIN concours_diplomes cd ON cd.diplome_id = d.id
       WHERE cd.concours_id = $1 ORDER BY d.niveau ASC NULLS LAST`,
      [concoursId]
    );
    return result.rows;
  },
};

module.exports = Diplome;
