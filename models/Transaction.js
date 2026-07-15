// ============================================================
//  models/Transaction.js
//  Requêtes SQL pour la table transactions.
// ============================================================

const { query } = require("../config/database");

const Transaction = {

// ── Créer une transaction ────────────────────────────────────
async create({ txId, userId, email, moyen, plan, montant, statut = "validé" }) {
const result = await query(
`INSERT INTO transactions (tx_id, user_id, email, moyen, plan, montant, statut) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
[txId.toUpperCase(), userId, email, moyen, plan, montant, statut]
);
return result.rows[0];
},

// ── Vérifier si un ID de transaction existe déjà ─────────────
// Essentiel pour éviter qu'un même paiement active 2 comptes
async txIdDejaUtilise(txId) {
const result = await query(
"SELECT id FROM transactions WHERE tx_id = $1",
[txId.toUpperCase()]
);
return result.rows.length > 0;
},

// ── Historique d'un utilisateur ─────────────────────────────
async findByUser(userId) {
const result = await query(
`SELECT id, tx_id, moyen, plan, montant, statut, date FROM transactions WHERE user_id = $1 ORDER BY date DESC`,
[userId]
);
return result.rows;
},

// ── Toutes les transactions (admin) ──────────────────────────
async findAll({ statut, limit = 100, offset = 0 } = {}) {
let sql = `SELECT t.*, u.nom as user_nom FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE 1=1`;
const values = [];
let i = 1;

if (statut) { sql += ` AND t.statut = $${i++}`; values.push(statut); }
sql += ` ORDER BY t.date DESC LIMIT $${i++} OFFSET $${i++}`;
values.push(limit, offset);

const result = await query(sql, values);
return result.rows;

},

// ── Total des revenus (stats admin) ──────────────────────────
async totalRevenus() {
const result = await query(
"SELECT COALESCE(SUM(montant), 0) AS total FROM transactions WHERE statut = 'validé'"
);
return parseInt(result.rows[0].total, 10);
},

// ── Revenus du mois en cours ─────────────────────────────────
async revenusduMois() {
const result = await query(
`SELECT COALESCE(SUM(montant), 0) AS total FROM transactions WHERE statut = 'validé' AND date >= date_trunc('month', NOW())`
);
return parseInt(result.rows[0].total, 10);
},

// ── Nombre total de transactions ─────────────────────────────
async count() {
const result = await query("SELECT COUNT(*) FROM transactions");
return parseInt(result.rows[0].count, 10);
},
};

module.exports = Transaction;