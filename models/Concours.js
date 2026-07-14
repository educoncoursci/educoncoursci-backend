// ============================================================
//  models/Concours.js
//  Toutes les requêtes SQL concernant la table concours.
//  Utilisé par concoursController.js et adminController.js
// ============================================================

const { query } = require("../config/database");

const Concours = {
  // ── Créer un concours ───────────────────────────────────────
  async create({
    titre,
    organisme,
    categorie,
    ouverture,
    cloture,
    frais,
    places,
    niveau,
    conditions,
    pieces,
    centres,
    premium,
    statut,
    couleur,
  }) {
    const result = await query(
      `INSERT INTO concours
        (titre, organisme, categorie, ouverture, cloture, frais, places,
         niveau, conditions, pieces, centres, premium, statut, couleur)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        titre,
        organisme,
        categorie,
        ouverture,
        cloture,
        frais || 0,
        places || null,
        niveau,
        conditions,
        JSON.stringify(pieces || []),
        JSON.stringify(centres || []),
        premium || false,
        statut || "à venir",
        couleur || "#1A6B3C",
      ],
    );
    return formatConcours(result.rows[0]);
  },

  // ── Liste tous les concours avec filtres ────────────────────
  async findAll({
    categorie,
    statut,
    premium,
    search,
    limit = 50,
    offset = 0,
  } = {}) {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (categorie) {
      conditions.push(`categorie = $${idx++}`);
      params.push(categorie);
    }
    if (statut) {
      conditions.push(`statut = $${idx++}`);
      params.push(statut);
    }
    if (premium !== undefined) {
      conditions.push(`premium = $${idx++}`);
      params.push(premium);
    }
    if (search) {
      conditions.push(
        `(LOWER(titre) LIKE $${idx} OR LOWER(organisme) LIKE $${idx++})`,
      );
      params.push(`%${search.toLowerCase()}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const result = await query(
      `SELECT * FROM concours
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );
    return result.rows.map(formatConcours);
  },

  // ── Trouver un concours par ID ──────────────────────────────
  async findById(id) {
    const result = await query(`SELECT * FROM concours WHERE id = $1`, [id]);
    if (!result.rows[0]) return null;
    return formatConcours(result.rows[0]);
  },

  // ── Modifier un concours ─────────────────────────────────────
  async update(id, fields) {
    const {
      titre,
      organisme,
      categorie,
      ouverture,
      cloture,
      frais,
      places,
      niveau,
      conditions,
      pieces,
      centres,
      premium,
      statut,
      couleur,
    } = fields;

    const result = await query(
      `UPDATE concours SET
        titre      = COALESCE($1,  titre),
        organisme  = COALESCE($2,  organisme),
        categorie  = COALESCE($3,  categorie),
        ouverture  = COALESCE($4,  ouverture),
        cloture    = COALESCE($5,  cloture),
        frais      = COALESCE($6,  frais),
        places     = COALESCE($7,  places),
        niveau     = COALESCE($8,  niveau),
        conditions = COALESCE($9,  conditions),
        pieces     = COALESCE($10, pieces),
        centres    = COALESCE($11, centres),
        premium    = COALESCE($12, premium),
        statut     = COALESCE($13, statut),
        couleur    = COALESCE($14, couleur)
       WHERE id = $15
       RETURNING *`,
      [
        titre,
        organisme,
        categorie,
        ouverture,
        cloture,
        frais,
        places,
        niveau,
        conditions,
        pieces ? JSON.stringify(pieces) : null,
        centres ? JSON.stringify(centres) : null,
        premium,
        statut,
        couleur,
        id,
      ],
    );
    if (!result.rows[0]) return null;
    return formatConcours(result.rows[0]);
  },

  // ── Supprimer un concours ────────────────────────────────────
  async delete(id) {
    await query(`DELETE FROM concours WHERE id = $1`, [id]);
  },

  // ── Concours ouverts (pour la page d'accueil) ───────────────
  async findOuverts(limit = 6) {
    const result = await query(
      `SELECT * FROM concours
       WHERE statut = 'ouvert'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(formatConcours);
  },

  // ── Compter les concours (stats admin) ──────────────────────
  async count() {
    const result = await query(`SELECT COUNT(*) FROM concours`);
    return parseInt(result.rows[0].count, 10);
  },

  async countOuverts() {
    const result = await query(
      `SELECT COUNT(*) FROM concours WHERE statut = 'ouvert'`,
    );
    return parseInt(result.rows[0].count, 10);
  },
};

// ── Parse les colonnes JSON avant de renvoyer ────────────────
function formatConcours(row) {
  if (!row) return null;
  return {
    ...row,
    pieces: tryParse(row.pieces, []),
    centres: tryParse(row.centres, []),
  };
}

function tryParse(val, fallback) {
  try {
    return JSON.parse(val || "[]");
  } catch {
    return fallback;
  }
}

module.exports = Concours;
