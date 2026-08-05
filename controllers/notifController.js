// ============================================================
//  controllers/notifController.js
//  Gère : envoi de notifications e-mail, historique
// ============================================================

const { query }                    = require("../config/database");
const User                         = require("../models/User");
const Concours                     = require("../models/Concours");
const AlertePreference             = require("../models/AlertePreference");
const { envoyerWhatsapp }          = require("../services/whatsapp");
const { envoyerSMS }                = require("../services/sms");
const { envoyerPushMasse }          = require("../services/push");
const {
envoyerNotificationAdmin,
envoyerAlerteConcours,
envoyerRappelCloture,
} = require("../services/email");

// ════════════════════════════════════════════════════════════
//  POST /api/notifs/send — Envoyer une notification (admin)
// ════════════════════════════════════════════════════════════
exports.envoyer = async (req, res) => {
try {
const { titre, message, cible, urgent } = req.body;

if (!titre || !message) {
  return res.status(400).json({
    error: "Titre et message sont requis."
  });
}

// Récupère les destinataires selon la cible
let destinataires = [];

if (cible === "premium") {
  destinataires = await User.findAllPremium();
} else if (cible === "gratuit") {
  const tous = await User.findAll({ limit: 1000 });
  destinataires = tous.filter(u => !u.premium);
} else {
  // "tous" par défaut
  destinataires = await User.findAll({ limit: 1000 });
}

if (destinataires.length === 0) {
  return res.status(404).json({
    error: "Aucun destinataire trouvé pour cette cible."
  });
}

// Envoi des e-mails
const resultat = await envoyerNotificationAdmin(
  destinataires,
  { titre, message, urgent: urgent === true || urgent === "true" }
);

// Enregistre la notification dans la base
await query(
  `INSERT INTO notifications (titre, message, cible, urgent)
   VALUES ($1, $2, $3, $4)`,
  [titre, message, cible || "tous", urgent || false]
);

res.json({
  message:       `Notification envoyée à ${resultat.envoyes} utilisateur(s).`,
  envoyes:       resultat.envoyes,
  echecs:        resultat.echecs,
  total:         resultat.total,
  destinataires: destinataires.length,
});

} catch (err) {
console.error("Erreur envoi notification :", err.message);
res.status(500).json({ error: "Erreur lors de l'envoi de la notification." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/notifs/alerte-concours — Alerte nouveau concours
// ════════════════════════════════════════════════════════════
exports.alerteConcours = async (req, res) => {
try {
const { concoursId, cible } = req.body;

if (!concoursId) {
  return res.status(400).json({ error: "concoursId est requis." });
}

const concours = await Concours.findById(concoursId);
if (!concours) {
  return res.status(404).json({ error: "Concours introuvable." });
}

// Destinataires respectant leurs préférences de catégorie et de canal
// (Module 4) — un utilisateur sans préférences explicites reçoit
// l'email par défaut, comme avant ce module.
let destinataires = await AlertePreference.findDestinatairesPourConcours(concours.categorie);
if (cible === "premium") {
  const idsPremium = new Set((await User.findAllPremium()).map((u) => u.id));
  destinataires = destinataires.filter((u) => idsPremium.has(u.id));
}

// Envoi email (pour ceux qui ont le canal email activé)
const destinatairesEmail = destinataires.filter((u) => u.canal_email);
const resultatsEmail = await Promise.allSettled(
  destinatairesEmail.map(u =>
    envoyerAlerteConcours(u.email, u.nom, concours)
  )
);
const succesEmail = resultatsEmail.filter(r => r.status === "fulfilled").length;
const echecsEmail = resultatsEmail.filter(r => r.status === "rejected").length;

// Envoi WhatsApp (pour ceux qui ont le canal activé + un numéro renseigné)
const destinatairesWhatsapp = destinataires.filter((u) => u.canal_whatsapp && u.whatsapp_numero);
const messageWhatsapp = `🔔 Nouveau concours EduConcoursCI : ${concours.titre} (${concours.organisme}). Clôture : ${concours.cloture || "à préciser"}. Plus d'infos : https://educoncoursci.netlify.app/concours-detail.html?id=${concours.id}`;
const resultatsWhatsapp = await Promise.allSettled(
  destinatairesWhatsapp.map(u => envoyerWhatsapp(u.whatsapp_numero, messageWhatsapp))
);
const succesWhatsapp = resultatsWhatsapp.filter(
  (r) => r.status === "fulfilled" && ["envoyé", "mis_en_file"].includes(r.value?.statut),
).length;

// Envoi SMS (pour ceux qui ont le canal activé + un numéro renseigné)
const destinatairesSms = destinataires.filter((u) => u.canal_sms && u.sms_numero);
const messageSms = `EduConcoursCI : nouveau concours "${concours.titre}" (${concours.organisme}). Clôture : ${concours.cloture || "à préciser"}. Détails sur educoncoursci.netlify.app`;
const resultatsSms = await Promise.allSettled(
  destinatairesSms.map(u => envoyerSMS(u.sms_numero, messageSms))
);
const succesSms = resultatsSms.filter(
  (r) => r.status === "fulfilled" && ["envoyé", "mis_en_file"].includes(r.value?.statut),
).length;

// Envoi Push Web (pour ceux qui ont le canal activé)
const destinatairesPush = destinataires.filter((u) => u.canal_push);
const resultatPush = await envoyerPushMasse(
  destinatairesPush.map((u) => u.id),
  {
    titre: "🔔 Nouveau concours",
    message: `${concours.titre} — ${concours.organisme}`,
    url: `/concours-detail.html?id=${concours.id}`,
  },
);

// Enregistre la notification
await query(
  `INSERT INTO notifications (titre, message, cible, urgent)
   VALUES ($1, $2, $3, $4)`,
  [
    `Nouveau concours : ${concours.titre}`,
    `Alerte automatique pour le concours ${concours.titre} (${concours.organisme})`,
    cible || "tous",
    false,
  ]
);

res.json({
  message: `Alerte concours envoyée à ${succesEmail} e-mail(s), ${succesWhatsapp} WhatsApp, ${succesSms} SMS et ${resultatPush.envoyes} push.`,
  envoyes: succesEmail,
  echecs: echecsEmail,
  whatsapp: succesWhatsapp,
  sms: succesSms,
  push: resultatPush.envoyes,
  concours: concours.titre,
});

} catch (err) {
console.error("Erreur alerte concours :", err.message);
res.status(500).json({ error: "Erreur lors de l'envoi de l'alerte." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/notifs/rappels — Rappels clôture J-7 (automatique)
// ════════════════════════════════════════════════════════════
exports.envoyerRappels = async (req, res) => {
try {
const resultat = await envoyerRappelsCloture();
if (resultat.rappels.length === 0) {
  return res.json({ message: "Aucun concours à rappeler aujourd'hui.", rappels: [] });
}
res.json({
  message: `${resultat.rappels.length} rappel(s) envoyé(s).`,
  rappels: resultat.rappels,
});
} catch (err) {
console.error("Erreur rappels clôture :", err.message);
res.status(500).json({ error: "Erreur lors de l'envoi des rappels." });
}
};

// ── Logique partagée (déclenchement manuel admin OU cron automatique) ──
// Exportée pour être appelée par services/rappelsScheduler.js.
async function envoyerRappelsCloture() {
// Trouve les concours qui ferment dans 7, 3 ou 1 jour(s)
const result = await query(`SELECT * FROM concours WHERE statut = 'ouvert' AND cloture IS NOT NULL AND cloture != ''`);

const concoursAlertes = [];

for (const concours of result.rows) {
  const dateCloture = new Date(concours.cloture);
  if (isNaN(dateCloture.getTime())) continue;

  const joursRestants = Math.ceil(
    (dateCloture - new Date()) / (1000 * 60 * 60 * 24)
  );

  if (![7, 3, 1].includes(joursRestants)) continue;

  // Déduplication : si ce rappel a déjà été envoyé aujourd'hui pour ce
  // concours (déclenchement manuel + cron le même jour), on saute.
  let dejaEnvoye = false;
  try {
    await query(
      `INSERT INTO rappels_envoyes (concours_id, jours_restants) VALUES ($1, $2)`,
      [concours.id, joursRestants],
    );
  } catch (err) {
    if (err.code === "23505") { // violation de contrainte UNIQUE
      dejaEnvoye = true;
    } else {
      throw err;
    }
  }
  if (dejaEnvoye) continue;

  const destinataires = await AlertePreference.findDestinatairesPourConcours(concours.categorie);

  const destinatairesEmail = destinataires.filter((u) => u.canal_email);
  const resultatsEmail = await Promise.allSettled(
    destinatairesEmail.map(u =>
      envoyerRappelCloture(u.email, u.nom, concours, joursRestants)
    )
  );
  const succesEmail = resultatsEmail.filter(r => r.status === "fulfilled").length;

  const destinatairesWhatsapp = destinataires.filter((u) => u.canal_whatsapp && u.whatsapp_numero);
  const messageWhatsapp = `⏰ Rappel EduConcoursCI : il reste ${joursRestants} jour(s) pour t'inscrire à "${concours.titre}" (${concours.organisme}). Clôture le ${concours.cloture}.`;
  const resultatsWhatsapp = await Promise.allSettled(
    destinatairesWhatsapp.map(u => envoyerWhatsapp(u.whatsapp_numero, messageWhatsapp))
  );
  const succesWhatsapp = resultatsWhatsapp.filter(
    (r) => r.status === "fulfilled" && ["envoyé", "mis_en_file"].includes(r.value?.statut),
  ).length;

  const destinatairesSms = destinataires.filter((u) => u.canal_sms && u.sms_numero);
  const messageSms = `EduConcoursCI : plus que ${joursRestants} jour(s) pour t'inscrire à "${concours.titre}" (clôture le ${concours.cloture}).`;
  const resultatsSms = await Promise.allSettled(
    destinatairesSms.map(u => envoyerSMS(u.sms_numero, messageSms))
  );
  const succesSms = resultatsSms.filter(
    (r) => r.status === "fulfilled" && ["envoyé", "mis_en_file"].includes(r.value?.statut),
  ).length;

  const destinatairesPush = destinataires.filter((u) => u.canal_push);
  const resultatPush = await envoyerPushMasse(
    destinatairesPush.map((u) => u.id),
    {
      titre: `⏰ J-${joursRestants} avant clôture`,
      message: concours.titre,
      url: `/concours-detail.html?id=${concours.id}`,
    },
  );

  concoursAlertes.push({
    concours:      concours.titre,
    joursRestants,
    envoyes:       succesEmail,
    whatsapp:      succesWhatsapp,
    sms:           succesSms,
    push:          resultatPush.envoyes,
  });
}

return { rappels: concoursAlertes };
}

// Exportée pour services/rappelsScheduler.js (exécution automatique quotidienne)
exports.envoyerRappelsCloture = envoyerRappelsCloture;

// ════════════════════════════════════════════════════════════
//  GET /api/notifs/whatsapp-file — File d'attente WhatsApp (admin)
//  Tant que l'API WhatsApp Business n'est pas configurée, les
//  messages atterrissent ici pour un envoi manuel via WhatsApp
//  Web/Business par un membre de l'équipe.
// ════════════════════════════════════════════════════════════
exports.fileWhatsapp = async (req, res) => {
try {
const result = await query(
  `SELECT * FROM whatsapp_envois WHERE statut = 'à_envoyer' ORDER BY created_at ASC LIMIT 200`
);
res.json({ total: result.rows.length, envois: result.rows });
} catch (err) {
console.error("Erreur lecture file WhatsApp :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/notifs/whatsapp-file/:id — Marquer comme envoyé (admin)
// ════════════════════════════════════════════════════════════
exports.marquerWhatsappEnvoye = async (req, res) => {
try {
const result = await query(
  `UPDATE whatsapp_envois SET statut = 'envoyé' WHERE id = $1 RETURNING *`,
  [req.params.id],
);
if (!result.rows[0]) {
  return res.status(404).json({ error: "Entrée introuvable." });
}
res.json({ message: "Marqué comme envoyé.", envoi: result.rows[0] });
} catch (err) {
console.error("Erreur maj file WhatsApp :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/notifs/sms-file — File d'attente SMS (admin)
//  Tant qu'aucune passerelle SMS officielle n'est configurée, les
//  messages atterrissent ici pour un envoi manuel ultérieur.
// ════════════════════════════════════════════════════════════
exports.fileSms = async (req, res) => {
try {
const result = await query(
  `SELECT * FROM sms_envois WHERE statut = 'à_envoyer' ORDER BY created_at ASC LIMIT 200`
);
res.json({ total: result.rows.length, envois: result.rows });
} catch (err) {
console.error("Erreur lecture file SMS :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/notifs/sms-file/:id — Marquer comme envoyé (admin)
// ════════════════════════════════════════════════════════════
exports.marquerSmsEnvoye = async (req, res) => {
try {
const result = await query(
  `UPDATE sms_envois SET statut = 'envoyé' WHERE id = $1 RETURNING *`,
  [req.params.id],
);
if (!result.rows[0]) {
  return res.status(404).json({ error: "Entrée introuvable." });
}
res.json({ message: "Marqué comme envoyé.", envoi: result.rows[0] });
} catch (err) {
console.error("Erreur maj file SMS :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/notifs/history — Historique des notifications (admin)
// ════════════════════════════════════════════════════════════
exports.historique = async (req, res) => {
try {
const { limit, offset } = req.query;
const result = await query(
`SELECT * FROM notifications ORDER BY date DESC LIMIT $1 OFFSET $2`,
[parseInt(limit) || 50, parseInt(offset) || 0]
);

res.json({
  total:         result.rows.length,
  notifications: result.rows,
});

} catch (err) {
console.error("Erreur historique notifications :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};