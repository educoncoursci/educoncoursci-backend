// ============================================================
//  models/Partenaire.js
//  Lot 14 — Marketplace : partenaires (organismes de formation,
//  formateurs indépendants, fournisseurs de matériel...).
// ============================================================

const { query } = require("../config/database");

const Partenaire = {
  async findActifs() {
    const result = await query(
      `SELECT * FROM partenaires WHERE statut = 'actif' ORDER BY nom ASC`,
    );
    return result.rows;
  },

  async findAll() {
    const result = await query(`SELECT * FROM partenaires ORDER BY created_at DESC`);
    return result.rows;
  },

  async findById(id) {
    const result = await query(`SELECT * FROM partenaires WHERE id = $1`, [id]);
    return result.rows[0] || null;
  },

  async create({ nom, description, logoUrl, email, telephone, siteWeb, statut }) {
    const result = await query(
      `INSERT INTO partenaires (nom, description, logo_url, email, telephone, site_web, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nom, description || null, logoUrl || null, email || null, telephone || null, siteWeb || null, statut || "actif"],
    );
    return result.rows[0];
  },

  async update(id, { nom, description, logoUrl, email, telephone, siteWeb, statut }) {
    const result = await query(
      `UPDATE partenaires SET
        nom = COALESCE($1, nom), description = COALESCE($2, description),
        logo_url = COALESCE($3, logo_url), email = COALESCE($4, email),
        telephone = COALESCE($5, telephone), site_web = COALESCE($6, site_web),
        statut = COALESCE($7, statut)
       WHERE id = $8 RETURNING *`,
      [nom, description, logoUrl, email, telephone, siteWeb, statut, id],
    );
    return result.rows[0] || null;
  },

  async supprimer(id) {
    const result = await query("DELETE FROM partenaires WHERE id = $1 RETURNING id", [id]);
    return result.rows.length > 0;
  },
};

module.exports = Partenaire;
