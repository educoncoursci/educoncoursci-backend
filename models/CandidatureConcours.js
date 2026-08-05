// ============================================================
//  models/CandidatureConcours.js
//  Lot 8 — Suivi de candidature aux concours (workflow personnel
//  multi-étapes "Enregistré → Admission"). Auto-déclaratif : c'est
//  le candidat lui-même qui fait avancer son suivi, EduConcoursCI
//  n'étant pas branché sur les systèmes officiels d'inscription.
// ============================================================

const { query } = require("../config/database");

// Ordre des étapes — utilisé pour valider les transitions et pour
// que le frontend puisse afficher une progression cohérente.
const ETAPES = [
  "enregistre",
  "dossier_soumis",
  "dossier_valide",
  "convoque",
  "compose",
  "admis", // ou "non_admis", étape terminale alternative
];

const CandidatureConcours = {
  ETAPES,

  // ── Démarrer le suivi d'un concours (idempotent) ─────────────
  async demarrer(userId, concoursId) {
    const result = await query(
      `INSERT INTO candidatures_concours (user_id, concours_id, statut, historique)
       VALUES ($1, $2, 'enregistre', $3)
       ON CONFLICT (user_id, concours_id) DO NOTHING
       RETURNING *`,
      [userId, concoursId, JSON.stringify([{ statut: "enregistre", date: new Date().toISOString() }])],
    );
    if (result.rows[0]) return formatCandidature(result.rows[0]);
    // Déjà existant — on renvoie le suivi en cours plutôt qu'une erreur
    return this.findOne(userId, concoursId);
  },

  // ── Liste des suivis d'un utilisateur, avec infos concours ───
  async findByUser(userId) {
    const result = await query(
      `SELECT cc.*, c.titre, c.organisme, c.statut AS concours_statut,
              c.cloture, c.couleur, c.categorie
       FROM candidatures_concours cc
       JOIN concours c ON c.id = cc.concours_id
       WHERE cc.user_id = $1
       ORDER BY cc.updated_at DESC`,
      [userId],
    );
    return result.rows.map(formatCandidature);
  },

  async findOne(userId, concoursId) {
    const result = await query(
      `SELECT * FROM candidatures_concours WHERE user_id = $1 AND concours_id = $2`,
      [userId, concoursId],
    );
    return formatCandidature(result.rows[0]);
  },

  async findById(id) {
    const result = await query(`SELECT * FROM candidatures_concours WHERE id = $1`, [id]);
    return formatCandidature(result.rows[0]);
  },

  // ── Faire avancer (ou corriger) l'étape ───────────────────────
  async avancer(id, userId, statut, notes) {
    const actuel = await query(
      `SELECT * FROM candidatures_concours WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (!actuel.rows[0]) return null; // introuvable ou n'appartient pas à cet utilisateur

    const historique = tryParse(actuel.rows[0].historique, []);
    if (statut && statut !== actuel.rows[0].statut) {
      historique.push({ statut, date: new Date().toISOString() });
    }

    const result = await query(
      `UPDATE candidatures_concours
       SET statut = COALESCE($1, statut),
           notes = COALESCE($2, notes),
           historique = $3,
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [statut || null, notes ?? null, JSON.stringify(historique), id, userId],
    );
    return formatCandidature(result.rows[0]);
  },

  // ── Abandonner le suivi ────────────────────────────────────────
  async supprimer(id, userId) {
    await query(
      `DELETE FROM candidatures_concours WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
  },
};

function formatCandidature(row) {
  if (!row) return null;
  return { ...row, historique: tryParse(row.historique, []) };
}

function tryParse(val, fallback) {
  try {
    return JSON.parse(val || "[]");
  } catch {
    return fallback;
  }
}

module.exports = CandidatureConcours;
