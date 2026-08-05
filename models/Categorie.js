// ============================================================
//  models/Categorie.js
//  Référentiel des catégories de concours (Lot 4). N'affecte pas
//  le champ texte concours.categorie — vocabulaire géré en plus.
// ============================================================

const { query } = require("../config/database");

const Categorie = {
  async findAll() {
    const result = await query("SELECT * FROM categories ORDER BY nom ASC");
    return result.rows;
  },

  async create({ nom, description, icone }) {
    const result = await query(
      `INSERT INTO categories (nom, description, icone) VALUES ($1,$2,$3)
       ON CONFLICT (nom) DO UPDATE SET description = EXCLUDED.description, icone = EXCLUDED.icone
       RETURNING *`,
      [nom, description || null, icone || "institution"],
    );
    return result.rows[0];
  },

  async supprimer(id) {
    const result = await query(
      "DELETE FROM categories WHERE id = $1 RETURNING id",
      [id],
    );
    return result.rows.length > 0;
  },
};

module.exports = Categorie;
