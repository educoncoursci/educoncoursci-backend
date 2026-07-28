// ============================================================
//  models/Actualite.js
//  Toutes les requêtes SQL concernant la table actualites.
//  Alimentée en continu par services/actualitesFeed.js (flux RSS)
//  + gérable manuellement par l'admin.
//  Utilisé par actualiteController.js
// ============================================================

const { query } = require("../config/database");

const Actualite = {
  // ── Liste des actualités actives pour le carrousel ──────────
  async findCarrousel(limit = 8) {
    const result = await query(
      `SELECT id, titre, tag, source_nom, lien, publie_le
       FROM actualites
       WHERE actif = TRUE
       ORDER BY publie_le DESC NULLS LAST, ordre ASC, created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  },

  // ── Liste complète avec filtres (admin) ─────────────────────
  async findAll({ tag, origine, actif, limit = 50, offset = 0 } = {}) {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (tag) {
      conditions.push(`tag = $${idx++}`);
      params.push(tag);
    }
    if (origine) {
      conditions.push(`origine = $${idx++}`);
      params.push(origine);
    }
    if (actif !== undefined) {
      conditions.push(`actif = $${idx++}`);
      params.push(actif);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const result = await query(
      `SELECT * FROM actualites
       ${where}
       ORDER BY publie_le DESC NULLS LAST, created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );
    return result.rows;
  },

  async findById(id) {
    const result = await query(`SELECT * FROM actualites WHERE id = $1`, [id]);
    return result.rows[0] || null;
  },

  // ── Ajout manuel (admin) ────────────────────────────────────
  async create({ titre, tag, source_nom, source_url, lien, publie_le, actif, ordre }) {
    const crypto = require("crypto");
    const hash = crypto
      .createHash("sha256")
      .update(`manuel:${titre}:${Date.now()}`)
      .digest("hex");

    const result = await query(
      `INSERT INTO actualites
        (titre, tag, source_nom, source_url, lien, hash, publie_le, actif, ordre, origine)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manuel')
       RETURNING *`,
      [
        titre,
        tag || "Actualité",
        source_nom || null,
        source_url || null,
        lien || null,
        hash,
        publie_le || new Date(),
        actif === undefined ? true : actif,
        ordre || 0,
      ],
    );
    return result.rows[0];
  },

  async update(id, fields) {
    const { titre, tag, source_nom, source_url, lien, publie_le, actif, ordre } = fields;
    const result = await query(
      `UPDATE actualites SET
        titre      = COALESCE($1, titre),
        tag        = COALESCE($2, tag),
        source_nom = COALESCE($3, source_nom),
        source_url = COALESCE($4, source_url),
        lien       = COALESCE($5, lien),
        publie_le  = COALESCE($6, publie_le),
        actif      = COALESCE($7, actif),
        ordre      = COALESCE($8, ordre)
       WHERE id = $9
       RETURNING *`,
      [titre, tag, source_nom, source_url, lien, publie_le, actif, ordre, id],
    );
    return result.rows[0] || null;
  },

  async delete(id) {
    await query(`DELETE FROM actualites WHERE id = $1`, [id]);
  },

  // ── Insertion en masse depuis le flux RSS (ignore les doublons) ──
  // entries : [{ titre, tag, source_nom, source_url, lien, hash, publie_le }]
  async upsertDepuisFlux(entries) {
    if (!entries || !entries.length) return 0;
    let inserees = 0;

    for (const e of entries) {
      const result = await query(
        `INSERT INTO actualites
          (titre, tag, source_nom, source_url, lien, hash, publie_le, actif, origine)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,'auto')
         ON CONFLICT (hash) DO NOTHING
         RETURNING id`,
        [e.titre, e.tag, e.source_nom, e.source_url, e.lien, e.hash, e.publie_le],
      );
      if (result.rows.length) inserees++;
    }
    return inserees;
  },

  // ── Purge les vieilles actualités auto (garde la base légère) ──
  async purgerAnciennes(joursConserves = 60) {
    await query(
      `DELETE FROM actualites
       WHERE origine = 'auto'
       AND publie_le < NOW() - INTERVAL '${parseInt(joursConserves, 10)} days'`,
    );
  },

  async count() {
    const result = await query(`SELECT COUNT(*) FROM actualites`);
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = Actualite;
