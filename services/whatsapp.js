// ============================================================
//  services/whatsapp.js
//  Module 4 — Envoi d'alertes WhatsApp.
//
//  Si WHATSAPP_API_TOKEN et WHATSAPP_PHONE_ID sont définis dans
//  .env, envoie réellement via l'API WhatsApp Business Cloud
//  (Meta). Sinon, place le message dans la table whatsapp_envois
//  pour un envoi manuel ou semi-automatique ultérieur — c'est le
//  comportement par défaut tant que le compte WhatsApp Business
//  de l'organisation n'est pas configuré.
// ============================================================

const { query } = require("../config/database");
const fetch = require("node-fetch");

const API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const PHONE_ID  = process.env.WHATSAPP_PHONE_ID;
const API_CONFIGUREE = Boolean(API_TOKEN && PHONE_ID);

async function envoyerWhatsapp(numero, message) {
  if (!numero) return { statut: "ignoré", raison: "numéro manquant" };

  if (!API_CONFIGUREE) {
    // File d'attente — un admin pourra envoyer manuellement via
    // WhatsApp Web/Business en attendant l'intégration officielle.
    await query(
      `INSERT INTO whatsapp_envois (numero, message, statut) VALUES ($1, $2, 'à_envoyer')`,
      [numero, message],
    );
    return { statut: "mis_en_file" };
  }

  try {
    const reponse = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numero,
          type: "text",
          text: { body: message },
        }),
      },
    );
    if (!reponse.ok) {
      const detail = await reponse.text();
      throw new Error(`WhatsApp API a répondu ${reponse.status} : ${detail}`);
    }
    return { statut: "envoyé" };
  } catch (err) {
    console.error("Erreur envoi WhatsApp :", err.message);
    // En cas d'échec de l'API, on garde une trace pour rattraper manuellement
    await query(
      `INSERT INTO whatsapp_envois (numero, message, statut) VALUES ($1, $2, 'échoué')`,
      [numero, message],
    );
    return { statut: "échoué", erreur: err.message };
  }
}

module.exports = { envoyerWhatsapp, API_CONFIGUREE };
