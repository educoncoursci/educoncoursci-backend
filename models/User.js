// ============================================================
//  models/User.js
//  Toutes les requêtes SQL concernant la table users.
//  Utilisé par authController.js et userController.js
// ============================================================

const { query } = require("../config/database");

const User = {
  // ── Créer un nouvel utilisateur ─────────────────────────────
  async create({ nom, email, passwordHash }) {
    const result = await query(
      `INSERT INTO users (nom, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nom, email, role, premium, date_inscription`,
      [nom, email, passwordHash],
    );
    return result.rows[0];
  },

  // ── Trouver un utilisateur par e-mail ───────────────────────
  async findByEmail(email) {
    const result = await query(`SELECT * FROM users WHERE email = $1`, [email]);
    return result.rows[0] || null;
  },

  // ── Trouver un utilisateur par ID ───────────────────────────
  async findById(id) {
    const result = await query(
      `SELECT id, nom, email, role, premium, premium_plan,
              premium_expire, date_inscription, favoris_json, scores_json,
              two_factor_enabled
       FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  // ── 2FA : lecture du secret/codes (usage interne uniquement) ──
  async findAvecSecretDeuxFacteur(id) {
    const result = await query(
      `SELECT id, nom, email, two_factor_secret, two_factor_enabled, two_factor_recovery_codes
       FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  // ── Mettre à jour le profil ─────────────────────────────────
  async updateProfil(id, { nom, email }) {
    const result = await query(
      `UPDATE users
       SET nom = COALESCE($1, nom),
           email = COALESCE($2, email)
       WHERE id = $3
       RETURNING id, nom, email, role, premium, premium_plan, premium_expire`,
      [nom, email, id],
    );
    return result.rows[0];
  },

  // ── Mettre à jour le mot de passe ───────────────────────────
  async updatePassword(id, passwordHash) {
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      id,
    ]);
  },

  // ── Activer/désactiver le Premium (utilisée par le paiement,
  //     l'admin, et la désactivation auto à l'expiration) ──────
  async setPremium(id, { premium, plan, expire }) {
    const result = await query(
      `UPDATE users
       SET premium = $1, premium_plan = $2, premium_expire = $3
       WHERE id = $4
       RETURNING id, nom, email, role, premium, premium_plan, premium_expire`,
      [premium, plan || null, expire || null, id],
    );
    return result.rows[0];
  },

  // ── Photo de profil (Lot 6) ──────────────────────────────────
async setPhoto(id, photoUrl) {
const result = await query(
  `UPDATE users SET photo_url = $1 WHERE id = $2 RETURNING id, nom, email, photo_url`,
  [photoUrl, id],
);
return result.rows[0];
},

// ── 2FA (Lot 16) ─────────────────────────────────────────────
// Enregistre un secret TOTP en attente de confirmation (2FA pas
// encore active tant que l'utilisateur n'a pas validé un code).
async setDeuxFacteurSecretEnAttente(id, secret) {
  await query(`UPDATE users SET two_factor_secret = $1 WHERE id = $2`, [secret, id]);
},

async activerDeuxFacteur(id, codesRecuperationHashes) {
  await query(
    `UPDATE users SET two_factor_enabled = TRUE, two_factor_recovery_codes = $1 WHERE id = $2`,
    [JSON.stringify(codesRecuperationHashes), id],
  );
},

async desactiverDeuxFacteur(id) {
  await query(
    `UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_recovery_codes = '[]' WHERE id = $1`,
    [id],
  );
},

async definirCodesRecuperation(id, codesRecuperationHashes) {
  await query(
    `UPDATE users SET two_factor_recovery_codes = $1 WHERE id = $2`,
    [JSON.stringify(codesRecuperationHashes), id],
  );
},

// ── Activer le Premium ──────────────────────────────────────
  async activerPremium(id, { plan, dureeJours }) {
    const expire = new Date();
    expire.setDate(expire.getDate() + dureeJours);

    const result = await query(
      `UPDATE users
       SET premium = TRUE,
           premium_plan = $1,
           premium_expire = $2
       WHERE id = $3
       RETURNING id, nom, email, premium, premium_plan, premium_expire`,
      [plan, expire.toISOString().split("T")[0], id],
    );
    return result.rows[0];
  },

  // ── Changer le rôle d'un utilisateur (user/admin) ────────────
  async setRole(id, role) {
    const result = await query(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, nom, email, role`,
      [role, id],
    );
    return result.rows[0];
  },

  // ── Résilier le Premium ─────────────────────────────────────
  async resilierPremium(id) {
    const result = await query(
      `UPDATE users
       SET premium = FALSE,
           premium_plan = NULL,
           premium_expire = NULL
       WHERE id = $1
       RETURNING id, nom, email, premium`,
      [id],
    );
    return result.rows[0];
  },

  // ── Sauvegarder les favoris (JSON) ──────────────────────────
  async updateFavoris(id, favorisJson) {
    await query(`UPDATE users SET favoris_json = $1 WHERE id = $2`, [
      JSON.stringify(favorisJson),
      id,
    ]);
  },

  // ── Récupérer les favoris ───────────────────────────────────
  async getFavoris(id) {
    const result = await query(`SELECT favoris_json FROM users WHERE id = $1`, [
      id,
    ]);
    if (!result.rows[0]) return [];
    try {
      return JSON.parse(result.rows[0].favoris_json || "[]");
    } catch {
      return [];
    }
  },

  // ── Liste tous les utilisateurs (admin) ─────────────────────
  async findAll({ limit = 50, offset = 0 } = {}) {
    const result = await query(
      `SELECT id, nom, email, role, premium, premium_plan,
              premium_expire, date_inscription
       FROM users
       ORDER BY date_inscription DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  },

  // ── Liste les abonnés Premium (admin) ───────────────────────
  async findAllPremium() {
    const result = await query(
      `SELECT id, nom, email, premium_plan, premium_expire, date_inscription
       FROM users
       WHERE premium = TRUE
       ORDER BY date_inscription DESC`,
    );
    return result.rows;
  },

  // ── Réinitialisation de mot de passe ─────────────────────────
  async setResetToken(email, token, expireDate) {
    const result = await query(
      `UPDATE users SET reset_token = $1, reset_token_expire = $2
       WHERE email = $3
       RETURNING id, nom, email`,
      [token, expireDate, email],
    );
    return result.rows[0] || null;
  },

  async findByResetToken(token) {
    const result = await query(
      `SELECT id, nom, email FROM users
       WHERE reset_token = $1 AND reset_token_expire > NOW()`,
      [token],
    );
    return result.rows[0] || null;
  },

  async resetPassword(id, passwordHash) {
    const result = await query(
      `UPDATE users
       SET password_hash = $1, reset_token = NULL, reset_token_expire = NULL
       WHERE id = $2
       RETURNING id, nom, email`,
      [passwordHash, id],
    );
    return result.rows[0];
  },

  // ── Compter les utilisateurs (stats admin) ──────────────────
  async count() {
    const result = await query(`SELECT COUNT(*) FROM users`);
    return parseInt(result.rows[0].count, 10);
  },

  async countPremium() {
    const result = await query(
      `SELECT COUNT(*) FROM users WHERE premium = TRUE`,
    );
    return parseInt(result.rows[0].count, 10);
  },

  // ── Supprimer un utilisateur (admin) ────────────────────────
  async delete(id) {
    await query(`DELETE FROM users WHERE id = $1`, [id]);
  },

  // ── Vérifier si un e-mail existe déjà ──────────────────────
  async emailExiste(email) {
    const result = await query(`SELECT id FROM users WHERE email = $1`, [
      email,
    ]);
    return result.rows.length > 0;
  },

  // ── Statut Premium actif, revérifié en base à chaque appel ─────
  // Ne fait jamais confiance au flag `premium` du token JWT (req.user),
  // qui peut être périmé (abonnement expiré depuis, ou changé par un
  // admin) tant que l'utilisateur ne s'est pas reconnecté. Centralise
  // ici la logique auparavant dupliquée à l'identique dans
  // middleware/quotaIA.js et middleware/exigerPremium.js.
  async estPremiumActif(userId) {
    const result = await query(
      "SELECT premium, premium_expire FROM users WHERE id = $1",
      [userId],
    );
    const user = result.rows[0];
    return !!(
      user?.premium &&
      (!user.premium_expire || new Date(user.premium_expire) >= new Date())
    );
  },
};

module.exports = User;
