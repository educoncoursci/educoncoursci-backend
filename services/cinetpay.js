// ============================================================
//  services/cinetpay.js
//  Lot 17 — Intégration CinetPay (agrégateur carte bancaire +
//  mobile money CI). Contrairement à Wave/Orange/MTN/Moov qui
//  restent en vérification manuelle, CinetPay fournit une vraie
//  API avec confirmation automatique par webhook.
//
//  Nécessite un compte marchand CinetPay (CINETPAY_API_KEY et
//  CINETPAY_SITE_ID dans .env). Tant qu'ils ne sont pas configurés,
//  API_CONFIGUREE est false et l'option CinetPay est simplement
//  absente des moyens de paiement proposés — aucun impact sur les
//  moyens manuels existants.
// ============================================================

const fetch = require("node-fetch");

const API_URL_INIT  = "https://api-checkout.cinetpay.com/v2/payment";
const API_URL_CHECK = "https://api-checkout.cinetpay.com/v2/payment/check";

const API_KEY  = process.env.CINETPAY_API_KEY;
const SITE_ID  = process.env.CINETPAY_SITE_ID;
const API_CONFIGUREE = Boolean(API_KEY && SITE_ID);

const CinetPay = {
  API_CONFIGUREE,

  // ── Initialise un paiement — retourne l'URL de paiement CinetPay ──
  async creerPaiement({ transactionId, montant, description, email, nom }) {
    if (!API_CONFIGUREE) {
      throw new Error("CinetPay n'est pas configuré sur ce serveur.");
    }

    const response = await fetch(API_URL_INIT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: API_KEY,
        site_id: SITE_ID,
        transaction_id: transactionId,
        amount: montant,
        currency: "XOF",
        description,
        customer_email: email,
        customer_name: nom || "Candidat EduConcoursCI",
        notify_url: process.env.CINETPAY_NOTIFY_URL,
        return_url: process.env.CINETPAY_RETURN_URL,
        channels: "ALL", // carte bancaire + tout mobile money disponible via CinetPay
      }),
    });

    const data = await response.json();
    if (data.code !== "201") {
      throw new Error(data.message || "Erreur lors de l'initialisation du paiement CinetPay.");
    }

    return { paymentUrl: data.data.payment_url, paymentToken: data.data.payment_token };
  },

  // ── Vérifie le statut réel d'une transaction auprès de CinetPay ──
  async verifierPaiement(transactionId) {
    if (!API_CONFIGUREE) {
      throw new Error("CinetPay n'est pas configuré sur ce serveur.");
    }

    const response = await fetch(API_URL_CHECK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: API_KEY,
        site_id: SITE_ID,
        transaction_id: transactionId,
      }),
    });

    const data = await response.json();
    return {
      succes: data.code === "00" && data.data?.status === "ACCEPTED",
      statutBrut: data.data?.status || data.message,
      montant: data.data?.amount,
      moyen: data.data?.payment_method,
    };
  },
};

module.exports = CinetPay;
