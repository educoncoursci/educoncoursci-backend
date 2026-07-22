// ============================================================
//  models/Emploi.js
//  Toutes les requêtes SQL concernant les tables offres_emploi,
//  candidatures et alertes_emploi.
//  Utilisé par emploiController.js et adminController.js
// ============================================================

const { query } = require("../config/database");

const Emploi = {
  // ── Créer une offre d'emploi (admin) ────────────────────────
  async create({
    titre, entreprise, typeContrat, ville, secteur, description,
    profilRecherche, salaire, experience, dateLimite,
    emailContact, lienExterne, statut,
  }) {
    const result = await query(
      `INSERT INTO offres_emploi
        (titre, entreprise, type_contrat, ville, secteur, description,
         profil_recherche, salaire, experience, date_limite,
         email_contact, lien_externe, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        titre, entreprise, typeContrat, ville || "Abidjan", secteur, description,
        profilRecherche, salaire, experience, dateLimite,
        emailContact, lienExterne, statut || "publié",
      ],
    );
    return result.rows[0];
  },

  // ── Liste des offres avec filtres ───────────────────────────
  async findAll({ typeContrat, ville, secteur, search, statut, limit = 20, offset = 0 } = {}) {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (typeContrat) {
      conditions.push(`type_contrat = $${idx++}`);
      params.push(typeContrat);
    }
    if (ville) {
      conditions.push(`ville ILIKE $${idx++}`);
      params.push(`%${ville}%`);
    }
    if (secteur) {
      conditions.push(`secteur ILIKE $${idx++}`);
      params.push(`%${secteur}%`);
    }
    if (statut) {
      conditions.push(`statut = $${idx++}`);
      params.push(statut);
    } else {
      conditions.push(`statut = 'publié'`); // par défaut, on ne montre que les offres publiées
    }
    if (search) {
      conditions.push(`(titre ILIKE $${idx} OR entreprise ILIKE $${idx++})`);
      params.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const result = await query(
      `SELECT * FROM offres_emploi
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );
    return result.rows;
  },

  // ── Trouver une offre par ID ─────────────────────────────────
  async findById(id) {
    const result = await query(`SELECT * FROM offres_emploi WHERE id = $1`, [id]);
    return result.rows[0] || null;
  },

  // ── Modifier une offre (admin) ───────────────────────────────
  async update(id, fields) {
    const {
      titre, entreprise, typeContrat, ville, secteur, description,
      profilRecherche, salaire, experience, dateLimite,
      emailContact, lienExterne, statut,
    } = fields;

    const result = await query(
      `UPDATE offres_emploi SET
        titre            = COALESCE($1,  titre),
        entreprise       = COALESCE($2,  entreprise),
        type_contrat     = COALESCE($3,  type_contrat),
        ville            = COALESCE($4,  ville),
        secteur          = COALESCE($5,  secteur),
        description      = COALESCE($6,  description),
        profil_recherche = COALESCE($7,  profil_recherche),
        salaire          = COALESCE($8,  salaire),
        experience       = COALESCE($9,  experience),
        date_limite      = COALESCE($10, date_limite),
        email_contact    = COALESCE($11, email_contact),
        lien_externe     = COALESCE($12, lien_externe),
        statut           = COALESCE($13, statut)
       WHERE id = $14
       RETURNING *`,
      [
        titre, entreprise, typeContrat, ville, secteur, description,
        profilRecherche, salaire, experience, dateLimite,
        emailContact, lienExterne, statut, id,
      ],
    );
    return result.rows[0] || null;
  },

  // ── Supprimer une offre (admin) ──────────────────────────────
  async delete(id) {
    await query(`DELETE FROM offres_emploi WHERE id = $1`, [id]);
  },

  // ── Incrémenter le compteur de vues ──────────────────────────
  async incrementerVues(id) {
    await query(`UPDATE offres_emploi SET vues = vues + 1 WHERE id = $1`, [id]);
  },

  // ── Compter les offres (stats admin) ─────────────────────────
  async count() {
    const result = await query(`SELECT COUNT(*) FROM offres_emploi`);
    return parseInt(result.rows[0].count, 10);
  },

  // ═══════════════════════════════════════════════════════════
  //  CANDIDATURES
  // ═══════════════════════════════════════════════════════════

  // ── Postuler à une offre ─────────────────────────────────────
  async postuler({ userId, offreId, cvSnapshot, message }) {
    const result = await query(
      `INSERT INTO candidatures (user_id, offre_id, cv_snapshot, message)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, offre_id) DO NOTHING
       RETURNING *`,
      [userId, offreId, cvSnapshot || null, message || null],
    );
    return result.rows[0] || null; // null = candidature déjà existante
  },

  // ── Mes candidatures (utilisateur connecté) ──────────────────
  async findCandidaturesParUser(userId) {
    const result = await query(
      `SELECT c.*, o.titre AS offre_titre, o.entreprise, o.type_contrat, o.statut AS offre_statut
       FROM candidatures c
       JOIN offres_emploi o ON o.id = c.offre_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  // ── Candidatures reçues pour une offre (admin) ───────────────
  async findCandidaturesParOffre(offreId) {
    const result = await query(
      `SELECT c.*, u.nom AS candidat_nom, u.email AS candidat_email
       FROM candidatures c
       JOIN users u ON u.id = c.user_id
       WHERE c.offre_id = $1
       ORDER BY c.created_at DESC`,
      [offreId],
    );
    return result.rows;
  },

  // ═══════════════════════════════════════════════════════════
  //  ALERTES EMPLOI
  // ═══════════════════════════════════════════════════════════

  async creerAlerte({ userId, motCle, typeContrat, ville }) {
    const result = await query(
      `INSERT INTO alertes_emploi (user_id, mot_cle, type_contrat, ville)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [userId, motCle || null, typeContrat || null, ville || null],
    );
    return result.rows[0];
  },

  async findAlertesParUser(userId) {
    const result = await query(
      `SELECT * FROM alertes_emploi WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  async supprimerAlerte(id, userId) {
    await query(`DELETE FROM alertes_emploi WHERE id = $1 AND user_id = $2`, [id, userId]);
  },
};

module.exports = Emploi;
