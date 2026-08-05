// ============================================================
//  models/AlertePreference.js
//  Préférences d'alertes par utilisateur (Module 4).
//  Un utilisateur sans ligne en base garde le comportement par
//  défaut d'avant ce module : alertes email activées, toutes
//  catégories — pour ne rien casser pour les comptes existants.
// ============================================================

const { query } = require("../config/database");

const DEFAUT = {
  canal_email: true,
  canal_whatsapp: false,
  whatsapp_numero: null,
  canal_sms: false,
  sms_numero: null,
  canal_push: false,
  categories: [],
};

const AlertePreference = {
  async findByUser(userId) {
    const result = await query(
      "SELECT * FROM alertes_preferences WHERE user_id = $1",
      [userId],
    );
    return result.rows[0] || { user_id: userId, ...DEFAUT };
  },

  async upsert(userId, { canalEmail, canalWhatsapp, whatsappNumero, canalSms, smsNumero, canalPush, categories }) {
    const result = await query(
      `INSERT INTO alertes_preferences
         (user_id, canal_email, canal_whatsapp, whatsapp_numero, canal_sms, sms_numero, canal_push, categories, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         canal_email     = EXCLUDED.canal_email,
         canal_whatsapp  = EXCLUDED.canal_whatsapp,
         whatsapp_numero = EXCLUDED.whatsapp_numero,
         canal_sms       = EXCLUDED.canal_sms,
         sms_numero      = EXCLUDED.sms_numero,
         canal_push      = EXCLUDED.canal_push,
         categories      = EXCLUDED.categories,
         updated_at      = NOW()
       RETURNING *`,
      [
        userId,
        canalEmail !== undefined ? canalEmail : true,
        canalWhatsapp || false,
        whatsappNumero || null,
        canalSms || false,
        smsNumero || null,
        canalPush || false,
        JSON.stringify(categories || []),
      ],
    );
    return result.rows[0];
  },

  // ── Utilisateurs à notifier pour un concours donné ──────────
  // Respecte les préférences de catégorie (liste vide = toutes les
  // catégories) et retourne aussi les infos de canal pour chacun.
  async findDestinatairesPourConcours(categorie) {
    const result = await query(
      `SELECT u.id, u.nom, u.email,
              COALESCE(ap.canal_email, TRUE)       AS canal_email,
              COALESCE(ap.canal_whatsapp, FALSE)    AS canal_whatsapp,
              ap.whatsapp_numero,
              COALESCE(ap.canal_sms, FALSE)         AS canal_sms,
              ap.sms_numero,
              COALESCE(ap.canal_push, FALSE)        AS canal_push,
              COALESCE(ap.categories, '[]'::jsonb)  AS categories
       FROM users u
       LEFT JOIN alertes_preferences ap ON ap.user_id = u.id
       WHERE COALESCE(ap.canal_email, TRUE) = TRUE
          OR COALESCE(ap.canal_whatsapp, FALSE) = TRUE
          OR COALESCE(ap.canal_sms, FALSE) = TRUE
          OR COALESCE(ap.canal_push, FALSE) = TRUE`,
    );
    // Filtre par catégorie côté JS (tableau JSON vide = toutes catégories acceptées)
    return result.rows.filter((u) => {
      const cats = Array.isArray(u.categories) ? u.categories : [];
      return cats.length === 0 || cats.includes(categorie) || cats.includes("Tous");
    });
  },
};

module.exports = AlertePreference;
