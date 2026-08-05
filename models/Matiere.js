// ============================================================
//  models/Matiere.js
//  Requêtes SQL pour la table matieres.
// ============================================================

const { query } = require("../config/database");

const Matiere = {
  async findAll() {
    const result = await query("SELECT * FROM matieres ORDER BY nom ASC");
    return result.rows;
  },

  async findById(id) {
    const result = await query("SELECT * FROM matieres WHERE id = $1", [id]);
    return result.rows[0] || null;
  },

  async create({ nom, categorie }) {
    const result = await query(
      `INSERT INTO matieres (nom, categorie) VALUES ($1,$2)
       ON CONFLICT (nom) DO UPDATE SET categorie = EXCLUDED.categorie
       RETURNING *`,
      [nom, categorie || null]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await query("DELETE FROM matieres WHERE id = $1 RETURNING id", [id]);
    return result.rows.length > 0;
  },

  // ── Relier une liste de matières à un concours (remplace les liens existants) ──
  async definirPourConcours(concoursId, matiereIds = []) {
    await query("DELETE FROM concours_matieres WHERE concours_id = $1", [concoursId]);
    for (const matiereId of matiereIds) {
      await query(
        "INSERT INTO concours_matieres (concours_id, matiere_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [concoursId, matiereId]
      );
    }
  },

  async findByConcours(concoursId) {
    const result = await query(
      `SELECT m.* FROM matieres m
       JOIN concours_matieres cm ON cm.matiere_id = m.id
       WHERE cm.concours_id = $1 ORDER BY m.nom ASC`,
      [concoursId]
    );
    return result.rows;
  },
};

module.exports = Matiere;
