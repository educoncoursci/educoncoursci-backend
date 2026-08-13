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

// ── Trouver une transaction par son id (validation admin) ────
async findById(id) {
const result = await query("SELECT * FROM transactions WHERE id = $1", [id]);
return result.rows[0] || null;
},

// ── Trouver une transaction par son tx_id (webhook CinetPay) ──
async findByTxId(txId) {
const result = await query("SELECT * FROM transactions WHERE tx_id = $1", [txId.toUpperCase()]);
return result.rows[0] || null;
},

// ── Changer le statut d'une transaction (admin valide/rejette) ─
async updateStatut(id, statut) {
const result = await query(
`UPDATE transactions SET statut = $1 WHERE id = $2 RETURNING *`,
[statut, id]
);
return result.rows[0] || null;
},

// ── Marque comme "échoué" les transactions restées "en attente"
// trop longtemps (ex: client qui ferme l'onglet avant de payer, ou
// qui abandonne dans Wave/CinetPay sans jamais aller au bout). Sans
// ça, ces transactions restent indéfiniment "en attente" — elles
// polluent /admin/paiements avec des demandes fantômes, et rien ne
// dit à l'utilisateur que sa tentative n'a pas abouti. Un client qui
// paie réellement via Wave ou CinetPay le fait en quelques minutes,
// donc 24h est une marge large avant de considérer l'essai comme
// abandonné. Retourne le nombre de transactions marquées.
async marquerExpireesCommeEchouees(heuresMax = 24) {
const result = await query(
`UPDATE transactions
 SET statut = 'échoué'
 WHERE statut = 'en attente'
   AND date < NOW() - INTERVAL '1 hour' * $1
 RETURNING id, tx_id, email, plan`,
[heuresMax],
);
return result.rows;
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

// ── Nombre de transactions correspondant à un filtre de statut,
//    indépendant de LIMIT/OFFSET (pagination admin). Sans ça, le
//    total retourné par allTransactions() n'était que la taille de
//    LA PAGE courante (transactions.length, plafonnée à `limit`),
//    jamais le vrai total — même limitation que trouvée et corrigée
//    sur Emploi.findAll(). Distincte de count() ci-dessus, qui
//    compte TOUJOURS toutes les transactions sans filtre.
async countAvecFiltre(statut) {
const sql = statut
  ? "SELECT COUNT(*)::int AS total FROM transactions WHERE statut = $1"
  : "SELECT COUNT(*)::int AS total FROM transactions";
const result = await query(sql, statut ? [statut] : []);
return result.rows[0].total;
},
};

module.exports = Transaction;