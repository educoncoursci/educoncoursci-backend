// ============================================================
//  models/Message.js
//  Lot 15 — Messagerie privée entre candidats.
// ============================================================

const { query } = require("../config/database");

const Message = {
  // ── Récupère ou crée la conversation entre deux utilisateurs ──
  async trouverOuCreerConversation(userIdA, userIdB) {
    const [user1_id, user2_id] = [userIdA, userIdB].sort((a, b) => a - b);

    const existante = await query(
      `SELECT * FROM conversations WHERE user1_id = $1 AND user2_id = $2`,
      [user1_id, user2_id],
    );
    if (existante.rows[0]) return existante.rows[0];

    const result = await query(
      `INSERT INTO conversations (user1_id, user2_id) VALUES ($1, $2) RETURNING *`,
      [user1_id, user2_id],
    );
    return result.rows[0];
  },

  async findConversationById(id) {
    const result = await query(`SELECT * FROM conversations WHERE id = $1`, [id]);
    return result.rows[0] || null;
  },

  // ── Liste des conversations d'un utilisateur, avec dernier message ──
  async listerConversations(userId) {
    const result = await query(
      `SELECT c.*,
              u.id AS autre_id, u.nom AS autre_nom,
              (SELECT contenu FROM messages_prives WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS dernier_message,
              (SELECT created_at FROM messages_prives WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS dernier_message_date,
              (SELECT COUNT(*) FROM messages_prives WHERE conversation_id = c.id AND lu = FALSE AND expediteur_id != $1) AS non_lus
       FROM conversations c
       JOIN users u ON u.id = (CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END)
       WHERE c.user1_id = $1 OR c.user2_id = $1
       ORDER BY COALESCE(
         (SELECT created_at FROM messages_prives WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
         c.created_at
       ) DESC`,
      [userId],
    );
    return result.rows;
  },

  // ── Messages d'une conversation ─────────────────────────────
  async listerMessages(conversationId) {
    const result = await query(
      `SELECT m.*, u.nom AS expediteur_nom
       FROM messages_prives m
       JOIN users u ON u.id = m.expediteur_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId],
    );
    return result.rows;
  },

  async envoyerMessage(conversationId, expediteurId, contenu) {
    const result = await query(
      `INSERT INTO messages_prives (conversation_id, expediteur_id, contenu)
       VALUES ($1, $2, $3) RETURNING *`,
      [conversationId, expediteurId, contenu],
    );
    await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);
    return result.rows[0];
  },

  async marquerLus(conversationId, userId) {
    await query(
      `UPDATE messages_prives SET lu = TRUE
       WHERE conversation_id = $1 AND expediteur_id != $2 AND lu = FALSE`,
      [conversationId, userId],
    );
  },

  async compterNonLus(userId) {
    const result = await query(
      `SELECT COUNT(*) FROM messages_prives m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE (c.user1_id = $1 OR c.user2_id = $1) AND m.expediteur_id != $1 AND m.lu = FALSE`,
      [userId],
    );
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = Message;
