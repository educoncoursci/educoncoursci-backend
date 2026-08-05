// ============================================================
//  models/Temoignage.js
//  Témoignages utilisateurs (Lot 2 — page d'accueil). Table vide
//  par défaut — jamais de contenu inventé, uniquement de vrais
//  retours saisis par un admin.
// ============================================================

const { query } = require("../config/database");

const Temoignage = {
  async findPublies() {
    const result = await query(
      `SELECT * FROM temoignages WHERE statut = 'publié' ORDER BY created_at DESC LIMIT 12`,
    );
    return result.rows;
  },

  async findAll() {
    const result = await query(`SELECT * FROM temoignages ORDER BY created_at DESC`);
    return result.rows;
  },

  async create({ nom, role, texte, note, statut }) {
    const result = await query(
      `INSERT INTO temoignages (nom, role, texte, note, statut)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nom, role || null, texte, note || 5, statut || "publié"],
    );
    return result.rows[0];
  },

  async update(id, { nom, role, texte, note, statut }) {
    const result = await query(
      `UPDATE temoignages SET
        nom = COALESCE($1, nom), role = COALESCE($2, role),
        texte = COALESCE($3, texte), note = COALESCE($4, note),
        statut = COALESCE($5, statut)
       WHERE id = $6 RETURNING *`,
      [nom, role, texte, note, statut, id],
    );
    return result.rows[0] || null;
  },

  async supprimer(id) {
    const result = await query(
      "DELETE FROM temoignages WHERE id = $1 RETURNING id",
      [id],
    );
    return result.rows.length > 0;
  },
};

module.exports = Temoignage;
