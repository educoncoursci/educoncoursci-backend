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
`SELECT s.*, q.titre as qcm_titre_actuel, q.matiere FROM scores s LEFT JOIN qcm q ON s.qcm_id = q.id WHERE s.user_id = $1 ORDER BY s.date DESC LIMIT $2 OFFSET $3`,
[userId, limit, offset]
);
return result.rows;
},

// ── Une tentative précise (pour génération de certificat) ────
async findById(id) {
const result = await query(`SELECT * FROM scores WHERE id = $1`, [id]);
return result.rows[0] || null;
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

// ── Score moyen par matière (Module 7 — suivi de progression) ──
// Exclut les examens blancs (qcm_id NULL, multi-matières donc non
// rattachables à une seule matière).
async statsParMatiere(userId) {
const result = await query(
`SELECT q.matiere,
        ROUND(AVG(s.pourcentage)) AS moyenne,
        COUNT(*) AS tentatives
 FROM scores s
 JOIN qcm q ON q.id = s.qcm_id
 WHERE s.user_id = $1
 GROUP BY q.matiere
 ORDER BY moyenne ASC`,
[userId]
);
return result.rows;
},

// ── Nombre d'examens blancs réalisés (scores sans qcm_id précis) ──
async countExamensBlancs(userId) {
const result = await query(
`SELECT COUNT(*) FROM scores WHERE user_id = $1 AND qcm_id IS NULL`,
[userId]
);
return parseInt(result.rows[0].count, 10);
},

// ── Classement général (Lot 5 — espace préparation) ──────────
// Seuil minimum de tentatives pour éviter qu'un seul score chanceux
// ne place quelqu'un en tête. N'inclut pas les examens blancs (score
// multi-matières, moins comparable à un QCM classique).
async classement({ minTentatives = 3, limite = 20 } = {}) {
const result = await query(
`SELECT u.id, u.nom,
        COUNT(*) AS total_tentatives,
        ROUND(AVG(s.pourcentage)) AS moyenne
 FROM scores s
 JOIN users u ON u.id = s.user_id
 WHERE s.qcm_id IS NOT NULL
 GROUP BY u.id, u.nom
 HAVING COUNT(*) >= $1
 ORDER BY moyenne DESC, total_tentatives DESC
 LIMIT $2`,
[minTentatives, limite]
);
return result.rows;
},

// ── Total des tentatives (stats admin) ───────────────────────
async count() {
const result = await query("SELECT COUNT(*) FROM scores");
return parseInt(result.rows[0].count, 10);
},
};

module.exports = Score;