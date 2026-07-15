// ============================================================
//  models/Score.js
//  Requêtes SQL pour la table scores.
// ============================================================

const { query } = require("../config/database");

const Score = {

// ── Enregistrer un score ─────────────────────────────────────
async create({ userId, qcmId, qcmTitre, score, total }) {
const pourcentage = Math.round((score / total) * 100);
const result = await query(
`INSERT INTO scores (user_id, qcm_id, qcm_titre, score, total, pourcentage) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
[userId, qcmId, qcmTitre, score, total, pourcentage]
);
return result.rows[0];
},

// ── Historique d'un utilisateur ─────────────────────────────
async findByUser(userId, { limit = 20, offset = 0 } = {}) {
const result = await query(
`SELECT s.*, q.titre as qcm_titre_actuel FROM scores s LEFT JOIN qcm q ON s.qcm_id = q.id WHERE s.user_id = $1 ORDER BY s.date DESC LIMIT $2 OFFSET $3`,
[userId, limit, offset]
);
return result.rows;
},

// ── Meilleur score d'un utilisateur sur un QCM ───────────────
async meilleurScore(userId, qcmId) {
const result = await query(
`SELECT MAX(pourcentage) as meilleur FROM scores WHERE user_id = $1 AND qcm_id = $2`,
[userId, qcmId]
);
return result.rows[0]?.meilleur || 0;
},

// ── Statistiques globales d'un utilisateur ───────────────────
async statsUtilisateur(userId) {
const result = await query(
`SELECT COUNT(*) as total_tentatives, ROUND(AVG(pourcentage), 0) as moyenne, MAX(pourcentage) as meilleur, COUNT(DISTINCT qcm_id) as qcm_distincts FROM scores WHERE user_id = $1`,
[userId]
);
return result.rows[0];
},

// ── Total des tentatives (stats admin) ───────────────────────
async count() {
const result = await query("SELECT COUNT(*) FROM scores");
return parseInt(result.rows[0].count, 10);
},
};

module.exports = Score;