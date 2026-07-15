// ============================================================
//  controllers/notifController.js
//  Gère : envoi de notifications e-mail, historique
// ============================================================

const { query }                    = require("../config/database");
const User                         = require("../models/User");
const Concours                     = require("../models/Concours");
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
  destinataires = await User.findPremium();
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

// Récupère les destinataires
let destinataires = [];
if (cible === "premium") {
  destinataires = await User.findPremium();
} else {
  destinataires = await User.findAll({ limit: 1000 });
}

// Envoi en parallèle
const resultats = await Promise.allSettled(
  destinataires.map(u =>
    envoyerAlerteConcours(u.email, u.nom, concours)
  )
);

const succes = resultats.filter(r => r.status === "fulfilled").length;
const echecs = resultats.filter(r => r.status === "rejected").length;

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
  message: `Alerte concours envoyée à ${succes} utilisateur(s).`,
  envoyes: succes,
  echecs,
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
// Trouve les concours qui ferment dans 7 jours
const result = await query(`SELECT * FROM concours WHERE statut = 'ouvert' AND cloture IS NOT NULL AND cloture != ''`);

const concoursAlertes = [];
const utilisateurs    = await User.findAll({ limit: 1000 });

for (const concours of result.rows) {
  // Tente de parser la date de clôture
  const dateCloture = new Date(concours.cloture);
  if (isNaN(dateCloture.getTime())) continue;

  const joursRestants = Math.ceil(
    (dateCloture - new Date()) / (1000 * 60 * 60 * 24)
  );

  if (joursRestants === 7 || joursRestants === 3 || joursRestants === 1) {
    // Envoie les rappels à tous les utilisateurs
    const resultats = await Promise.allSettled(
      utilisateurs.map(u =>
        envoyerRappelCloture(u.email, u.nom, concours, joursRestants)
      )
    );

    const succes = resultats.filter(r => r.status === "fulfilled").length;
    concoursAlertes.push({
      concours:      concours.titre,
      joursRestants,
      envoyes:       succes,
    });
  }
}

if (concoursAlertes.length === 0) {
  return res.json({
    message: "Aucun concours à rappeler aujourd'hui.",
    rappels: [],
  });
}

res.json({
  message: `${concoursAlertes.length} rappel(s) envoyé(s).`,
  rappels: concoursAlertes,
});

} catch (err) {
console.error("Erreur rappels clôture :", err.message);
res.status(500).json({ error: "Erreur lors de l'envoi des rappels." });
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