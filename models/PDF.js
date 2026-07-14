// ============================================================
//  models/PDF.js
//  Toutes les requêtes SQL concernant la table pdfs.
//  Utilisé par pdfController.js et adminController.js
// ============================================================

const { query } = require("../config/database");

const PDF = {
  // ── Créer un PDF ────────────────────────────────────────────
  async create({
    titre,
    categorie,
    matiere,
    pages,
    taille,
    url,
    description,
    premium,
    statut,
  }) {
    const result = await query(
      `INSERT INTO pdfs
        (titre, categorie, matiere, pages, taille, url, description, premium, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        titre,
        categorie || "Général",
        matiere || "",
        pages || 0,
        taille || "",
        url,
        description || "",
        premium || false,
        statut || "publié",
      ],
    );
    return result.rows[0];
  },

  // ── Liste des PDFs avec filtres ─────────────────────────────
  async findAll({
    categorie,
    premium,
    statut = "publié",
    search,
    limit = 50,
    offset = 0,
  } = {}) {
    let conditions = [`statut = $1`];
    let params = [statut];
    let idx = 2;

    if (categorie) {
      conditions.push(`categorie = $${idx++}`);
      params.push(categorie);
    }
    if (premium !== undefined) {
      conditions.push(`premium = $${idx++}`);
      params.push(premium);
    }
    if (search) {
      conditions.push(
        `(LOWER(titre) LIKE $${idx} OR LOWER(matiere) LIKE $${idx++})`,
      );
      params.push(`%${search.toLowerCase()}%`);
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT * FROM pdfs
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );
    return result.rows;
  },

  // ── Tous les PDFs y compris brouillons (admin) ───────────────
  async findAllAdmin({ limit = 100, offset = 0 } = {}) {
    const result = await query(
      `SELECT * FROM pdfs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  },

  // ── Trouver un PDF par ID ────────────────────────────────────
  async findById(id) {
    const result = await query(`SELECT * FROM pdfs WHERE id = $1`, [id]);
    return result.rows[0] || null;
  },

  // ── Modifier un PDF ──────────────────────────────────────────
  async update(
    id,
    {
      titre,
      categorie,
      matiere,
      pages,
      taille,
      url,
      description,
      premium,
      statut,
    },
  ) {
    const result = await query(
      `UPDATE pdfs SET
        titre       = COALESCE($1,  titre),
        categorie   = COALESCE($2,  categorie),
        matiere     = COALESCE($3,  matiere),
        pages       = COALESCE($4,  pages),
        taille      = COALESCE($5,  taille),
        url         = COALESCE($6,  url),
        description = COALESCE($7,  description),
        premium     = COALESCE($8,  premium),
        statut      = COALESCE($9,  statut)
       WHERE id = $10
       RETURNING *`,
      [
        titre,
        categorie,
        matiere,
        pages,
        taille,
        url,
        description,
        premium,
        statut,
        id,
      ],
    );
    return result.rows[0] || null;
  },

  // ── Incrémenter le compteur de téléchargements ──────────────
  async incrementerTelechargement(id) {
    const result = await query(
      `UPDATE pdfs
       SET telechargements = telechargements + 1
       WHERE id = $1
       RETURNING telechargements`,
      [id],
    );
    return result.rows[0]?.telechargements;
  },

  // ── Supprimer un PDF ─────────────────────────────────────────
  async delete(id) {
    await query(`DELETE FROM pdfs WHERE id = $1`, [id]);
  },

  // ── Changer le statut publié/brouillon ──────────────────────
  async toggleStatut(id) {
    const result = await query(
      `UPDATE pdfs
       SET statut = CASE WHEN statut = 'publié' THEN 'brouillon' ELSE 'publié' END
       WHERE id = $1
       RETURNING id, statut`,
      [id],
    );
    return result.rows[0];
  },

  // ── Stats (admin) ────────────────────────────────────────────
  async count() {
    const result = await query(`SELECT COUNT(*) FROM pdfs`);
    return parseInt(result.rows[0].count, 10);
  },

  async totalTelechargements() {
    const result = await query(
      `SELECT COALESCE(SUM(telechargements), 0) AS total FROM pdfs`,
    );
    return parseInt(result.rows[0].total, 10);
  },
};

module.exports = PDF;
