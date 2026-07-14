// ============================================================
//  models/QCM.js
//  Toutes les requêtes SQL concernant la table qcm.
//  Les questions sont stockées en JSON dans questions_json.
//  Utilisé par qcmController.js et adminController.js
// ============================================================

const { query } = require("../config/database");

const QCM = {
  // ── Créer un QCM ────────────────────────────────────────────
  async create({ titre, matiere, difficulte, statut, questions, premium }) {
    const result = await query(
      `INSERT INTO qcm
        (titre, matiere, difficulte, statut, questions_json, premium)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        titre,
        matiere,
        difficulte || "Moyen",
        statut || "publié",
        JSON.stringify(questions || []),
        premium || false,
      ],
    );
    return formatQCM(result.rows[0]);
  },

  // ── Liste des QCM disponibles (sans les questions pour alléger) ─
  async findAll({
    matiere,
    difficulte,
    premium,
    statut = "publié",
    limit = 50,
    offset = 0,
  } = {}) {
    let conditions = [`statut = $1`];
    let params = [statut];
    let idx = 2;

    if (matiere) {
      conditions.push(`matiere = $${idx++}`);
      params.push(matiere);
    }
    if (difficulte) {
      conditions.push(`difficulte = $${idx++}`);
      params.push(difficulte);
    }
    if (premium !== undefined) {
      conditions.push(`premium = $${idx++}`);
      params.push(premium);
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT id, titre, matiere, difficulte, statut, premium, tentatives,
              created_at,
              jsonb_array_length(questions_json::jsonb) AS nb_questions
       FROM qcm
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );
    return result.rows;
  },

  // ── Tous les QCM y compris brouillons (admin) ───────────────
  async findAllAdmin({ limit = 100, offset = 0 } = {}) {
    const result = await query(
      `SELECT id, titre, matiere, difficulte, statut, premium, tentatives,
              created_at,
              jsonb_array_length(questions_json::jsonb) AS nb_questions
       FROM qcm
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  },

  // ── Trouver un QCM par ID avec toutes les questions ─────────
  async findById(id) {
    const result = await query(`SELECT * FROM qcm WHERE id = $1`, [id]);
    if (!result.rows[0]) return null;
    return formatQCM(result.rows[0]);
  },

  // ── Trouver un QCM par ID SANS les bonnes réponses ──────────
  // Utilisé pour servir le QCM aux utilisateurs (sécurité)
  async findByIdSansReponses(id) {
    const result = await query(
      `SELECT * FROM qcm WHERE id = $1 AND statut = 'publié'`,
      [id],
    );
    if (!result.rows[0]) return null;
    const qcm = formatQCM(result.rows[0]);

    // Retire la propriété "correct" et "explication" de chaque question
    qcm.questions = qcm.questions.map((q) => ({
      q: q.q,
      options: q.options,
      // correct et explication ne sont PAS envoyés
    }));

    return qcm;
  },

  // ── Modifier un QCM ─────────────────────────────────────────
  async update(id, { titre, matiere, difficulte, statut, questions, premium }) {
    const result = await query(
      `UPDATE qcm SET
        titre          = COALESCE($1, titre),
        matiere        = COALESCE($2, matiere),
        difficulte     = COALESCE($3, difficulte),
        statut         = COALESCE($4, statut),
        questions_json = COALESCE($5, questions_json),
        premium        = COALESCE($6, premium)
       WHERE id = $7
       RETURNING *`,
      [
        titre,
        matiere,
        difficulte,
        statut,
        questions ? JSON.stringify(questions) : null,
        premium,
        id,
      ],
    );
    if (!result.rows[0]) return null;
    return formatQCM(result.rows[0]);
  },

  // ── Changer le statut publié/brouillon ──────────────────────
  async toggleStatut(id) {
    const result = await query(
      `UPDATE qcm
       SET statut = CASE WHEN statut = 'publié' THEN 'brouillon' ELSE 'publié' END
       WHERE id = $1
       RETURNING id, statut`,
      [id],
    );
    return result.rows[0];
  },

  // ── Incrémenter le compteur de tentatives ───────────────────
  async incrementerTentatives(id) {
    await query(`UPDATE qcm SET tentatives = tentatives + 1 WHERE id = $1`, [
      id,
    ]);
  },

  // ── Supprimer un QCM ────────────────────────────────────────
  async delete(id) {
    await query(`DELETE FROM qcm WHERE id = $1`, [id]);
  },

  // ── Stats (admin) ────────────────────────────────────────────
  async count() {
    const result = await query(`SELECT COUNT(*) FROM qcm`);
    return parseInt(result.rows[0].count, 10);
  },

  async totalTentatives() {
    const result = await query(
      `SELECT COALESCE(SUM(tentatives), 0) AS total FROM qcm`,
    );
    return parseInt(result.rows[0].total, 10);
  },
};

// ── Parse questions_json avant de renvoyer ──────────────────
function formatQCM(row) {
  if (!row) return null;
  return {
    ...row,
    questions: tryParse(row.questions_json, []),
  };
}

function tryParse(val, fallback) {
  try {
    return JSON.parse(val || "[]");
  } catch {
    return fallback;
  }
}

module.exports = QCM;
