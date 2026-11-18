// ============================================================
//  models/Video.js
//  Toutes les requêtes SQL concernant la table videos.
//  Utilisé par videoController.js et adminController.js
// ============================================================

const { query } = require("../config/database");

function construireFiltre({ categorie, premium, statut, q }) {
  const conds = [`statut = $1`];
  const params = [statut];
  if (categorie) { params.push(categorie); conds.push(`categorie = $${params.length}`); }
  if (premium !== undefined) { params.push(premium); conds.push(`premium = $${params.length}`); }
  if (q) {
    params.push("%" + String(q).replace(/[\\%_]/g, "\\$&") + "%");
    conds.push(`titre ILIKE $${params.length}`);
  }
  return { where: conds.join(" AND "), params };
}

const Video = {
  // ── Créer une vidéo ─────────────────────────────────────────
  async create({ titre, categorie, duree, url, description, premium, statut, origine }) {
    const result = await query(
      `INSERT INTO videos
        (titre, categorie, duree, url, description, premium, statut, origine)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        titre,
        categorie || "Général",
        duree || "",
        url,
        description || "",
        premium || false,
        statut || "publié",
        origine || "lien",
      ],
    );
    return result.rows[0];
  },

  // ── Liste des vidéos avec filtres ───────────────────────────
  async findAll({
    categorie,
    premium,
    statut = "publié",
    q,
    tri = "recent",
    limit = 50,
    offset = 0,
  } = {}) {
    const { where, params: p0 } = construireFiltre({ categorie, premium, statut, q });
    const ordre = tri === "vues" ? "vues DESC, id DESC"
      : tri === "gratuit" ? "premium ASC, created_at DESC"
      : "created_at DESC";
    const idx0 = p0.length + 1;
    const rows = await query(
      `SELECT * FROM videos WHERE ${where} ORDER BY ${ordre} LIMIT $${idx0} OFFSET $${idx0 + 1}`,
      [...p0, limit, offset],
    );
    return rows.rows.map(ajouterYoutubeId);
  },

  async compter({ categorie, premium, statut = "publié", q } = {}) {
    const { where, params } = construireFiltre({ categorie, premium, statut, q });
    const r = await query(`SELECT COUNT(*)::int AS n FROM videos WHERE ${where}`, params);
    return r.rows[0].n;
  },

  async categories(statut = "publié") {
    const r = await query(
      `SELECT DISTINCT categorie FROM videos WHERE statut = $1 AND categorie IS NOT NULL AND categorie <> '' ORDER BY categorie`,
      [statut],
    );
    return r.rows.map((x) => x.categorie);
  },

  // ── Toutes les vidéos y compris brouillons (admin) ──────────
  async findAllAdmin({ limit = 100, offset = 0 } = {}) {
    const result = await query(
      `SELECT * FROM videos ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows.map(ajouterYoutubeId);
  },

  // ── Trouver une vidéo par ID ─────────────────────────────────
  async findById(id) {
    const result = await query(`SELECT * FROM videos WHERE id = $1`, [id]);
    if (!result.rows[0]) return null;
    return ajouterYoutubeId(result.rows[0]);
  },

  // ── Modifier une vidéo ───────────────────────────────────────
  async update(
    id,
    { titre, categorie, duree, url, description, premium, statut },
  ) {
    const result = await query(
      `UPDATE videos SET
        titre       = COALESCE($1, titre),
        categorie   = COALESCE($2, categorie),
        duree       = COALESCE($3, duree),
        url         = COALESCE($4, url),
        description = COALESCE($5, description),
        premium     = COALESCE($6, premium),
        statut      = COALESCE($7, statut)
       WHERE id = $8
       RETURNING *`,
      [titre, categorie, duree, url, description, premium, statut, id],
    );
    if (!result.rows[0]) return null;
    return ajouterYoutubeId(result.rows[0]);
  },

  // ── Incrémenter le compteur de vues ─────────────────────────
  async incrementerVues(id) {
    const result = await query(
      `UPDATE videos
       SET vues = vues + 1
       WHERE id = $1
       RETURNING vues`,
      [id],
    );
    return result.rows[0]?.vues;
  },

  // ── Changer le statut publié/brouillon ──────────────────────
  async toggleStatut(id) {
    const result = await query(
      `UPDATE videos
       SET statut = CASE WHEN statut = 'publié' THEN 'brouillon' ELSE 'publié' END
       WHERE id = $1
       RETURNING id, statut`,
      [id],
    );
    return result.rows[0];
  },

  // ── Supprimer une vidéo ──────────────────────────────────────
  async delete(id) {
    await query(`DELETE FROM videos WHERE id = $1`, [id]);
  },

  // ── Stats (admin) ────────────────────────────────────────────
  async count() {
    const result = await query(`SELECT COUNT(*) FROM videos`);
    return parseInt(result.rows[0].count, 10);
  },

  async totalVues() {
    const result = await query(
      `SELECT COALESCE(SUM(vues), 0) AS total FROM videos`,
    );
    return parseInt(result.rows[0].total, 10);
  },
};

// ── Extrait l'ID YouTube depuis l'URL ───────────────────────
function ajouterYoutubeId(row) {
  if (!row) return null;
  let youtube_id = null;
  if (row.url) {
    const match = row.url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    if (match) youtube_id = match[1];
  }
  return { ...row, youtube_id };
}

module.exports = Video;
