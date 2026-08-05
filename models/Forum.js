// ============================================================
//  models/Forum.js
//  Lot 13 — Communauté : forum d'entraide entre candidats.
// ============================================================

const { query } = require("../config/database");

const Forum = {
  // ── Sujets ────────────────────────────────────────────────
  async listerSujets({ categorie, concoursId, recherche, limit = 20, offset = 0 } = {}) {
    const conditions = [];
    const params = [];
    let i = 1;

    if (categorie) {
      conditions.push(`fs.categorie = $${i++}`);
      params.push(categorie);
    }
    if (concoursId) {
      conditions.push(`fs.concours_id = $${i++}`);
      params.push(concoursId);
    }
    if (recherche) {
      conditions.push(`(fs.titre ILIKE $${i} OR fs.contenu ILIKE $${i})`);
      params.push(`%${recherche}%`);
      i++;
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    params.push(limit, offset);
    const result = await query(
      `SELECT fs.*, u.nom AS auteur_nom, c.titre AS concours_titre,
              (SELECT COUNT(*) FROM forum_reponses fr WHERE fr.sujet_id = fs.id) AS nb_reponses
       FROM forum_sujets fs
       JOIN users u ON u.id = fs.user_id
       LEFT JOIN concours c ON c.id = fs.concours_id
       ${whereClause}
       ORDER BY fs.epingle DESC, fs.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      params,
    );
    return result.rows;
  },

  async count({ categorie, concoursId } = {}) {
    const conditions = [];
    const params = [];
    let i = 1;
    if (categorie) { conditions.push(`categorie = $${i++}`); params.push(categorie); }
    if (concoursId) { conditions.push(`concours_id = $${i++}`); params.push(concoursId); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await query(`SELECT COUNT(*) FROM forum_sujets ${whereClause}`, params);
    return parseInt(result.rows[0].count, 10);
  },

  async findSujetById(id) {
    const result = await query(
      `SELECT fs.*, u.nom AS auteur_nom, c.titre AS concours_titre
       FROM forum_sujets fs
       JOIN users u ON u.id = fs.user_id
       LEFT JOIN concours c ON c.id = fs.concours_id
       WHERE fs.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async creerSujet(userId, { titre, contenu, categorie, concoursId }) {
    const result = await query(
      `INSERT INTO forum_sujets (user_id, titre, contenu, categorie, concours_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, titre, contenu, categorie || "general", concoursId || null],
    );
    return result.rows[0];
  },

  async incrementerVues(id) {
    await query(`UPDATE forum_sujets SET vues = vues + 1 WHERE id = $1`, [id]);
  },

  async supprimerSujet(id) {
    await query(`DELETE FROM forum_sujets WHERE id = $1`, [id]);
  },

  async epingler(id, epingle) {
    const result = await query(
      `UPDATE forum_sujets SET epingle = $1 WHERE id = $2 RETURNING *`,
      [epingle, id],
    );
    return result.rows[0] || null;
  },

  // ── Réponses ──────────────────────────────────────────────
  async listerReponses(sujetId) {
    const result = await query(
      `SELECT fr.*, u.nom AS auteur_nom
       FROM forum_reponses fr
       JOIN users u ON u.id = fr.user_id
       WHERE fr.sujet_id = $1
       ORDER BY fr.created_at ASC`,
      [sujetId],
    );
    return result.rows;
  },

  async repondre(sujetId, userId, contenu) {
    const result = await query(
      `INSERT INTO forum_reponses (sujet_id, user_id, contenu) VALUES ($1, $2, $3) RETURNING *`,
      [sujetId, userId, contenu],
    );
    await query(`UPDATE forum_sujets SET updated_at = NOW() WHERE id = $1`, [sujetId]);
    return result.rows[0];
  },

  async findReponseById(id) {
    const result = await query(`SELECT * FROM forum_reponses WHERE id = $1`, [id]);
    return result.rows[0] || null;
  },

  async supprimerReponse(id) {
    await query(`DELETE FROM forum_reponses WHERE id = $1`, [id]);
  },
};

module.exports = Forum;
