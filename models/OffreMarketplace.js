// ============================================================
//  models/OffreMarketplace.js
//  Lot 14 — Marketplace : offres proposées par les partenaires
//  (cours particuliers, formations, packs de préparation, matériel).
// ============================================================

const { query } = require("../config/database");

const OffreMarketplace = {
  async findPubliees({ categorie, limit = 20, offset = 0 } = {}) {
    const conditions = ["om.statut = 'publiee'"];
    const params = [];
    let i = 1;
    if (categorie) {
      conditions.push(`om.categorie = $${i++}`);
      params.push(categorie);
    }
    params.push(limit, offset);
    const result = await query(
      `SELECT om.*, p.nom AS partenaire_nom, p.logo_url AS partenaire_logo
       FROM offres_marketplace om
       JOIN partenaires p ON p.id = om.partenaire_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY om.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      params,
    );
    return result.rows;
  },

  async countPubliees(categorie) {
    const conditions = ["statut = 'publiee'"];
    const params = [];
    if (categorie) { conditions.push("categorie = $1"); params.push(categorie); }
    const result = await query(
      `SELECT COUNT(*) FROM offres_marketplace WHERE ${conditions.join(" AND ")}`,
      params,
    );
    return parseInt(result.rows[0].count, 10);
  },

  async findAll() {
    const result = await query(
      `SELECT om.*, p.nom AS partenaire_nom
       FROM offres_marketplace om
       JOIN partenaires p ON p.id = om.partenaire_id
       ORDER BY om.created_at DESC`,
    );
    return result.rows;
  },

  async findById(id) {
    const result = await query(
      `SELECT om.*, p.nom AS partenaire_nom, p.logo_url AS partenaire_logo,
              p.email AS partenaire_email, p.telephone AS partenaire_telephone
       FROM offres_marketplace om
       JOIN partenaires p ON p.id = om.partenaire_id
       WHERE om.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async create({ partenaireId, titre, description, categorie, prix, prixUnite, imageUrl, lienExterne, statut }) {
    const result = await query(
      `INSERT INTO offres_marketplace
        (partenaire_id, titre, description, categorie, prix, prix_unite, image_url, lien_externe, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        partenaireId, titre, description, categorie || "autre",
        prix || null, prixUnite || "forfait", imageUrl || null, lienExterne || null,
        statut || "en_attente",
      ],
    );
    return result.rows[0];
  },

  async update(id, { titre, description, categorie, prix, prixUnite, imageUrl, lienExterne, statut }) {
    const result = await query(
      `UPDATE offres_marketplace SET
        titre = COALESCE($1, titre), description = COALESCE($2, description),
        categorie = COALESCE($3, categorie), prix = COALESCE($4, prix),
        prix_unite = COALESCE($5, prix_unite), image_url = COALESCE($6, image_url),
        lien_externe = COALESCE($7, lien_externe), statut = COALESCE($8, statut)
       WHERE id = $9 RETURNING *`,
      [titre, description, categorie, prix, prixUnite, imageUrl, lienExterne, statut, id],
    );
    return result.rows[0] || null;
  },

  async supprimer(id) {
    const result = await query("DELETE FROM offres_marketplace WHERE id = $1 RETURNING id", [id]);
    return result.rows.length > 0;
  },

  // ── Demandes de contact/devis ──────────────────────────────
  async creerContact({ offreId, userId, nom, email, telephone, message }) {
    const result = await query(
      `INSERT INTO marketplace_contacts (offre_id, user_id, nom, email, telephone, message)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [offreId, userId || null, nom, email, telephone || null, message || null],
    );
    return result.rows[0];
  },

  async findContactsParOffre(offreId) {
    const result = await query(
      `SELECT * FROM marketplace_contacts WHERE offre_id = $1 ORDER BY created_at DESC`,
      [offreId],
    );
    return result.rows;
  },
};

module.exports = OffreMarketplace;
