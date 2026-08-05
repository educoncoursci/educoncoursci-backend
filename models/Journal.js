// ============================================================
//  models/Journal.js
//  Journal d'activité admin (Lot 4). Écriture non bloquante :
//  un échec d'écriture du journal ne doit jamais faire échouer
//  l'action métier elle-même.
// ============================================================

const { query } = require("../config/database");

const Journal = {
  async enregistrer(userId, userNom, action, cibleType, cibleId, details) {
    try {
      await query(
        `INSERT INTO journal_activite (user_id, user_nom, action, cible_type, cible_id, details)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [userId || null, userNom || null, action, cibleType || null, cibleId || null, details || null],
      );
    } catch (err) {
      console.error("Erreur écriture journal d'activité :", err.message);
    }
  },

  async findAll({ action, cibleType, limit = 100, offset = 0 } = {}) {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (action) {
      conditions.push(`action = $${idx++}`);
      params.push(action);
    }
    if (cibleType) {
      conditions.push(`cible_type = $${idx++}`);
      params.push(cibleType);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const result = await query(
      `SELECT * FROM journal_activite ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );
    return result.rows;
  },

  async count() {
    const result = await query("SELECT COUNT(*) FROM journal_activite");
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = Journal;
