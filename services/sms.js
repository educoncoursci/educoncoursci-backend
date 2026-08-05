// ============================================================
//  services/sms.js
//  Lot 11 — Envoi d'alertes SMS.
//
//  Si SMS_API_URL, SMS_API_KEY et SMS_SENDER sont définis dans
//  .env, envoie réellement via une passerelle SMS générique
//  compatible HTTP (la plupart des agrégateurs SMS ivoiriens/
//  panafricains exposent une API de ce type). Sinon, place le
//  message dans la table sms_envois pour un envoi manuel ou
//  semi-automatique ultérieur — comportement par défaut tant que
//  le compte de la passerelle SMS n'est pas configuré, exactement
//  comme services/whatsapp.js.
// ============================================================

const { query } = require("../config/database");
const fetch = require("node-fetch");

const API_URL = process.env.SMS_API_URL;
const API_KEY = process.env.SMS_API_KEY;
const SENDER  = process.env.SMS_SENDER || "EduConcCI";
const API_CONFIGUREE = Boolean(API_URL && API_KEY);

async function envoyerSMS(numero, message) {
  if (!numero) return { statut: "ignoré", raison: "numéro manquant" };

  if (!API_CONFIGUREE) {
    await query(
      `INSERT INTO sms_envois (numero, message, statut) VALUES ($1, $2, 'à_envoyer')`,
      [numero, message],
    );
    return { statut: "mis_en_file" };
  }

  try {
    const reponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sender: SENDER, to: numero, message }),
    });
    if (!reponse.ok) {
      const detail = await reponse.text();
      throw new Error(`Passerelle SMS a répondu ${reponse.status} : ${detail}`);
    }
    return { statut: "envoyé" };
  } catch (err) {
    console.error("Erreur envoi SMS :", err.message);
    await query(
      `INSERT INTO sms_envois (numero, message, statut) VALUES ($1, $2, 'échoué')`,
      [numero, message],
    );
    return { statut: "échoué", erreur: err.message };
  }
}

module.exports = { envoyerSMS, API_CONFIGUREE };
