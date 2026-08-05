// ============================================================
//  services/push.js
//  Lot 11 — Notifications Push Web (navigateur), standard
//  Web Push / VAPID. Fonctionne avec la PWA déjà en place.
//
//  Nécessite VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans .env
//  (générables avec `npx web-push generate-vapid-keys`). Tant
//  qu'elles ne sont pas configurées, les envois sont simplement
//  ignorés (aucune file d'attente possible pour du push : un
//  abonnement expiré ou une clé absente ne peut pas être rattrapé
//  plus tard comme un SMS ou un e-mail).
// ============================================================

const webpush = require("web-push");
const { query } = require("../config/database");

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const API_CONFIGUREE = Boolean(PUBLIC_KEY && PRIVATE_KEY);

if (API_CONFIGUREE) {
  webpush.setVapidDetails(
    "mailto:contact@educoncoursci.com",
    PUBLIC_KEY,
    PRIVATE_KEY,
  );
}

// ── Enregistre un abonnement (depuis le navigateur du candidat) ──
async function enregistrerAbonnement(userId, subscription) {
  const { endpoint, keys } = subscription;
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [userId, endpoint, keys.p256dh, keys.auth],
  );
}

async function supprimerAbonnement(endpoint) {
  await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

// ── Envoie une notification push à un utilisateur (tous ses appareils) ──
async function envoyerPushUtilisateur(userId, { titre, message, url }) {
  if (!API_CONFIGUREE) return { statut: "ignoré", raison: "VAPID non configuré" };

  const result = await query(
    `SELECT * FROM push_subscriptions WHERE user_id = $1`,
    [userId],
  );

  let envoyes = 0;
  let echecs = 0;

  await Promise.all(
    result.rows.map(async (abo) => {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          JSON.stringify({ titre, message, url: url || "/" }),
        );
        envoyes++;
      } catch (err) {
        echecs++;
        // Abonnement expiré/révoqué côté navigateur → on le retire
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supprimerAbonnement(abo.endpoint).catch(() => {});
        }
      }
    }),
  );

  return { statut: "traité", envoyes, echecs };
}

// ── Diffusion à plusieurs utilisateurs (notification admin) ──
async function envoyerPushMasse(userIds, contenu) {
  let envoyes = 0;
  let echecs = 0;
  for (const userId of userIds) {
    const res = await envoyerPushUtilisateur(userId, contenu);
    envoyes += res.envoyes || 0;
    echecs += res.echecs || 0;
  }
  return { envoyes, echecs };
}

module.exports = {
  enregistrerAbonnement,
  supprimerAbonnement,
  envoyerPushUtilisateur,
  envoyerPushMasse,
  API_CONFIGUREE,
  PUBLIC_KEY,
};
