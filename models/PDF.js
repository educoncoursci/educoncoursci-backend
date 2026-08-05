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
    type,
  }) {
    const result = await query(
      `INSERT INTO pdfs
        (titre, categorie, matiere, pages, taille, url, description, premium, statut, type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
        type || "cours",
      ],
    );
    return result.rows[0];
  },

  // ── Relier un PDF à une liste de concours (remplace les liens existants) ──
  async definirConcours(pdfId, concoursIds = []) {
    await query("DELETE FROM concours_pdfs WHERE pdf_id = $1", [pdfId]);
    for (const concoursId of concoursIds) {
      await query(
        "INSERT INTO concours_pdfs (concours_id, pdf_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [concoursId, pdfId],
      );
    }
  },

  async findConcoursIds(pdfId) {
    const result = await query(
      "SELECT concours_id FROM concours_pdfs WHERE pdf_id = $1",
      [pdfId],
    );
    return result.rows.map((r) => r.concours_id);
  },

  // ── PDFs liés à un concours donné (pour la fiche concours) ──
  async findByConcours(concoursId, { statut = "publié" } = {}) {
    const result = await query(
      `SELECT p.* FROM pdfs p
       JOIN concours_pdfs cp ON cp.pdf_id = p.id
       WHERE cp.concours_id = $1 AND p.statut = $2
       ORDER BY p.type, p.titre`,
      [concoursId, statut],
    );
    return result.rows;
  },

  // ── Liste des PDFs avec filtres ─────────────────────────────
  async findAll({
    categorie,
    premium,
    statut = "publié",
    search,
    type,
    concoursId,
    limit = 50,
    offset = 0,
  } = {}) {
    let conditions = [`p.statut = $1`];
    let params = [statut];
    let idx = 2;
    let jointure = "";

    if (categorie) {
      conditions.push(`p.categorie = $${idx++}`);
      params.push(categorie);
    }
    if (premium !== undefined) {
      conditions.push(`p.premium = $${idx++}`);
      params.push(premium);
    }
    if (type) {
      conditions.push(`p.type = $${idx++}`);
      params.push(type);
    }
    if (search) {
      conditions.push(
        `(LOWER(p.titre) LIKE $${idx} OR LOWER(p.matiere) LIKE $${idx++})`,
      );
      params.push(`%${search.toLowerCase()}%`);
    }
    if (concoursId) {
      jointure = `JOIN concours_pdfs cp ON cp.pdf_id = p.id AND cp.concours_id = $${idx++}`;
      params.push(concoursId);
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT p.* FROM pdfs p
       ${jointure}
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.created_at DESC
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
      type,
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
        statut      = COALESCE($9,  statut),
        type        = COALESCE($10, type)
       WHERE id = $11
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
        type,
        id,
      ],
    );
    return result.rows[0] || null;
  },

  // ── Enregistrer une consultation (Module 7 — suivi de progression) ──
  async enregistrerConsultation(userId, pdfId) {
    await query(
      "INSERT INTO consultations_pdf (user_id, pdf_id) VALUES ($1, $2)",
      [userId, pdfId],
    );
  },

  async compterDocumentsConsultes(userId) {
    const result = await query(
      "SELECT COUNT(DISTINCT pdf_id) FROM consultations_pdf WHERE user_id = $1",
      [userId],
    );
    return parseInt(result.rows[0].count, 10);
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
