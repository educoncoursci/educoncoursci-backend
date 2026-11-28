// ============================================================
//  services/alertePaiement.js
//  Circuit UNIQUE d'alerte administrateur quand un client soumet un
//  identifiant de transaction (Premium ET services à l'acte).
//  Trois canaux, tous « au mieux » (une panne n'empêche jamais le paiement
//  d'être enregistré) :
//    1. e-mail détaillé (ADMIN_EMAIL)
//    2. SMS court (ADMIN_TELEPHONE + passerelle SMS configurée, sinon mis en file)
//    3. notification push sur les appareils de l'administrateur
//  Le tableau de bord admin (« Paiements en attente ») affiche en plus un
//  badge, alimenté par la base : voir fe/js/admin-alertes.js.
//  Aucune validation ne se fait par SMS ni par lien : seule l'action
//  authentifiée dans l'espace admin valide un paiement.
// ============================================================

const { query } = require("../config/database");
const Email = require("./email");

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enSilence = (p, ctx) => Promise.resolve(p).catch((e) => console.error(`Alerte paiement (${ctx}) :`, e.message));

function dateHeure(d = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Abidjan", dateStyle: "short", timeStyle: "short" }).format(d);
}

// transaction : ligne de la table transactions ; infos : { nomClient, service }
async function alerterAdmin(transaction, { nomClient, service } = {}) {
  const t = transaction || {};
  const idTx = t.txId || t.tx_id;
  const libelle = service || t.service || t.plan;
  const quand = dateHeure(t.date ? new Date(t.date) : new Date());
  const lien = `${process.env.FRONTEND_URL || ""}/admin/paiements.html`;

  // 1. E-mail
  if (process.env.ADMIN_EMAIL) {
    enSilence(Email.envoyer({
      to: process.env.ADMIN_EMAIL,
      subject: `💰 Paiement à vérifier — ${libelle} (${t.montant} FCFA)`,
      text:
        `Un paiement attend votre vérification.<br><br>` +
        `<strong>Client :</strong> ${esc(nomClient || "—")} (${esc(t.email)})<br>` +
        `<strong>Téléphone :</strong> ${esc(t.telephone || "non renseigné")}<br>` +
        (t.email_client ? `<strong>E-mail de livraison du client :</strong> ${esc(t.email_client)} (document à envoyer sous 24 h après vérification)<br>` : "") +
        (t.reference ? `<strong>N° de commande :</strong> ${esc(t.reference)}<br>` : "") +
        `<strong>Service :</strong> ${esc(libelle)}<br>` +
        `<strong>Montant :</strong> ${esc(t.montant)} FCFA<br>` +
        `<strong>Moyen :</strong> ${esc(t.moyen)}<br>` +
        `<strong>Identifiant de transaction :</strong> ${esc(idTx)}<br>` +
        `<strong>Date :</strong> ${esc(quand)}<br><br>` +
        `Vérifiez d'abord la réception de l'argent sur votre compte marchand, puis validez ou rejetez ici : <a href="${lien}">${lien}</a>`,
    }), "e-mail");
  } else {
    console.warn("ADMIN_EMAIL absent : aucune alerte e-mail pour le paiement en attente.");
  }

  // 2. SMS (court, sans lien de validation)
  if (process.env.ADMIN_TELEPHONE) {
    try {
      const { envoyerSMS } = require("./sms");
      const msg = `ProInsertion : paiement a verifier. ${nomClient || t.email} | ${t.telephone || "tel ?"} | ${libelle} | ${t.montant} F | ${t.moyen} | ID ${idTx} | ${quand}`;
      enSilence(envoyerSMS(process.env.ADMIN_TELEPHONE, msg.slice(0, 300)), "sms");
    } catch (e) { console.error("Alerte paiement (sms) :", e.message); }
  }

  // 3. Notification push aux administrateurs
  try {
    const push = require("./push");
    const admins = await query("SELECT id FROM users WHERE role = 'admin'");
    for (const a of admins.rows) {
      enSilence(push.envoyerPushUtilisateur(a.id, {
        titre: "💰 Paiement à vérifier",
        message: `${nomClient || t.email} — ${libelle} — ${t.montant} FCFA (${t.moyen})`,
        url: "/admin/paiements.html",
      }), "push");
    }
  } catch (e) { console.error("Alerte paiement (push) :", e.message); }
}

// Numéro du payeur : 8 à 15 chiffres, « + » et espaces tolérés. Renvoie null si invalide.
function normaliserTelephone(v) {
  const brut = String(v ?? "").replace(/[\s.\-()]/g, "");
  return /^\+?\d{8,15}$/.test(brut) ? brut : null;
}

// Prévient le CLIENT (dans le site + push) qu'une décision a été prise sur son paiement.
// L'e-mail reste envoyé par ailleurs. « Au mieux » : n'échoue jamais l'action admin.
async function notifierClient(transaction, accepte) {
  try {
    await query("UPDATE transactions SET notifier_client = TRUE WHERE id = $1", [transaction.id]);
  } catch (e) { console.error("Notification client (drapeau) :", e.message); }
  try {
    const push = require("./push");
    const libelle = transaction.service || `Premium ${transaction.plan}`;
    await push.envoyerPushUtilisateur(transaction.user_id, {
      titre: accepte ? "✅ Paiement confirmé" : "⚠️ Paiement à vérifier",
      message: accepte ? `Votre paiement pour ${libelle} est confirmé.` : `Votre paiement pour ${libelle} n'a pas pu être confirmé. Vérifiez l'identifiant et réessayez.`,
      url: "/dashboard/index.html",
    });
  } catch (e) { /* push facultatif */ }
}

module.exports = { alerterAdmin, notifierClient, dateHeure, normaliserTelephone };
