// ============================================================
//  services/email.js
//  Envoi d'e-mails via l'API HTTPS de Brevo (ex-Sendinblue).
//  Utilisé pour : bienvenue, paiement, alertes concours,
//                 scores QCM, rappels clôture, reset mot de passe.
//
//  ⚠️ Pourquoi l'API HTTPS et pas le SMTP (Gmail/Yahoo) ?
//  Railway bloque les connexions SMTP sortantes sur son plan
//  gratuit/Hobby (confirmé en production : "Connection timeout" sur
//  smtp.mail.yahoo.com, alors que les identifiants étaient corrects).
//  L'API Brevo passe par une requête HTTPS classique (comme n'importe
//  quel appel à l'API du site) — elle n'est jamais bloquée, gratuite
//  jusqu'à 300 emails/jour. Voir BREVO_API_KEY dans .env.example.
// ============================================================

const fetch = require("node-fetch");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// L'envoi est-il réellement configuré ? (sinon on simule pour ne jamais planter)
function emailConfigure() {
return Boolean(process.env.BREVO_API_KEY);
}

// Conservé pour compatibilité avec scripts/test-email.js — l'ancien
// test appelait getTransporter().verify() (spécifique à Nodemailer/
// SMTP) ; avec l'API HTTPS il n'y a pas de connexion à "vérifier" à
// l'avance de la même façon, donc cette fonction sert seulement à
// exposer l'URL/la config utilisée pour un diagnostic simple.
function getTransporter() {
return {
verify: async () => {
  if (!emailConfigure()) throw new Error("BREVO_API_KEY absente.");
  return true;
},
};
}

// ── Template HTML de base ────────────────────────────────────
function templateBase(titre, contenuHTML) {
return `

<!DOCTYPE html>

<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titre}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:100%;">

      <!-- En-tête -->
      <tr>
        <td style="background:linear-gradient(135deg,#1A6B3C,#0A6EBD);
                    padding:28px 30px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:900;
                      letter-spacing:0.5px;">🎓 EduConcoursCI</h1>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">
            Plateforme de préparation aux concours de Côte d'Ivoire
          </p>
        </td>
      </tr>

      <!-- Corps -->
      <tr>
        <td style="padding:30px 35px;">
          ${contenuHTML}
        </td>
      </tr>

      <!-- Pied de page -->
      <tr>
        <td style="background:#F4F6F9;padding:20px 30px;text-align:center;
                    border-top:1px solid #E5E7EB;">
          <p style="color:#888;font-size:12px;margin:0;line-height:1.6;">
            EduConcoursCI · Abidjan, Côte d'Ivoire<br>
            <a href="#" style="color:#1A6B3C;text-decoration:none;">Se désabonner</a>
          </p>
        </td>
      </tr>

    </table>
  </td>
</tr>

  </table>
</body>
</html>`;
}

// ── Envoi générique ──────────────────────────────────────────
async function envoyer({ to, subject, html, text }) {
// Si BREVO_API_KEY n'est pas configurée, on simule TOUJOURS (peu
// importe NODE_ENV) plutôt que de laisser la requête échouer — sans
// ça, en production sans cette variable, l'envoi échouerait
// silencieusement (erreur avalée par le try/catch appelant) et
// l'utilisateur ne recevrait jamais rien, sans qu'aucune erreur
// claire n'apparaisse dans les logs.
if (!emailConfigure()) {
console.warn(
  `⚠️  E-mail NON envoyé (BREVO_API_KEY absente) → ${to} | Sujet: ${subject}. ` +
  `Configure cette variable sur Railway pour activer l'envoi réel.`,
);
return { simule: true, to, subject };
}

const nomExpediteur = (process.env.EMAIL_FROM || "EduConcoursCI <noreply@educoncoursci.ci>")
.match(/^(.*?)\s*<(.+)>$/);
const senderName  = nomExpediteur ? nomExpediteur[1].trim() : "EduConcoursCI";
const senderEmail = nomExpediteur ? nomExpediteur[2].trim() : (process.env.EMAIL_FROM || "noreply@educoncoursci.ci");

const response = await fetch(BREVO_API_URL, {
method: "POST",
headers: {
  "accept": "application/json",
  "api-key": process.env.BREVO_API_KEY,
  "content-type": "application/json",
},
body: JSON.stringify({
  sender: { name: senderName, email: senderEmail },
  to: [{ email: to }],
  subject,
  htmlContent: html || templateBase(subject, `<p>${text}</p>`),
  textContent: text || subject,
}),
});

const data = await response.json();

if (!response.ok) {
// Cause la plus fréquente à ce stade : l'adresse dans EMAIL_FROM
// n'est pas un expéditeur vérifié dans Brevo (obligatoire — voir
// .env.example). Le message d'erreur de Brevo l'indique clairement.
throw new Error(data.message || `Erreur Brevo (${response.status})`);
}

console.log(`✅ E-mail envoyé → ${to} | Sujet: ${subject} | id: ${data.messageId}`);
return { messageId: data.messageId, to };
}


// ════════════════════════════════════════════════════════════
//  Templates e-mail spécifiques
// ════════════════════════════════════════════════════════════

// ── 1. Bienvenue ─────────────────────────────────────────────
async function envoyerBienvenue(user) {
const html = templateBase("Bienvenue sur EduConcoursCI !", `<h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;"> Bienvenue, ${user.nom} ! 🎉 </h2> <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 16px;"> Ton compte a été créé avec succès sur <strong>EduConcoursCI</strong>, la plateforme de référence pour la préparation aux concours de Côte d'Ivoire. </p> <div style="background:#F0FDF4;border-radius:12px;padding:18px;margin:20px 0;"> <p style="margin:0 0 10px;font-weight:700;color:#1A6B3C;">Tu as maintenant accès à :</p> <ul style="margin:0;padding-left:20px;color:#333;line-height:1.9;font-size:14px;"> <li>📋 La liste complète des concours et examens CI</li> <li>🧠 Des QCM de préparation gratuits</li> <li>📰 Les dernières actualités et alertes</li> <li>📚 Des ressources de préparation</li> </ul> </div> <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 20px;"> Pour accéder aux cours complets, sujets corrigés et vidéos de formation, passe en <strong>Premium</strong> dès 2 000 FCFA/mois. </p> <div style="text-align:center;margin:24px 0;"> <a href="${process.env.FRONTEND_URL || "https://educoncoursci.netlify.app"}" style="background-color:#1A6B3C;color:#ffffff !important; text-decoration:none;padding:14px 28px;border-radius:10px; font-weight:700;font-size:15px;display:inline-block;border:2px solid #1A6B3C;"><span style="color:#ffffff;">Accéder à la plateforme →</span></a> </div>`);

return envoyer({
to:      user.email,
subject: "Bienvenue sur EduConcoursCI ! 🎓",
html,
});
}

// ── 2. Confirmation de paiement ──────────────────────────────
async function envoyerConfirmationPaiement(user, transaction) {
const html = templateBase("Paiement validé — EduConcoursCI", `<h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;"> Paiement validé ! ✅ </h2> <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;"> Bonjour <strong>${user.nom}</strong>, ton abonnement <strong>Premium ${transaction.plan}</strong> est maintenant actif. </p> <div style="background:#F9FAFB;border-radius:12px;padding:18px;margin:0 0 20px;"> <table width="100%" cellpadding="0" cellspacing="0"> ${[ ["Plan",      `Premium ${transaction.plan}`], ["Montant",    `${transaction.montant?.toLocaleString("fr-CI")} FCFA`], ["Moyen",      transaction.moyen], ["Référence",  transaction.txId], ["Date",       new Date().toLocaleDateString("fr-FR")], ["Expiration", transaction.expiration || "Voir votre profil"], ].map(([k, v]) => `
<tr>
<td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #E5E7EB;">${k}</td>
<td style="padding:8px 0;font-weight:700;font-size:13px;border-bottom:1px solid #E5E7EB;text-align:right;">${v}</td>
</tr>
`).join("")} </table> </div> <div style="background:#EFF6FF;border-radius:12px;padding:16px;margin:0 0 20px;"> <p style="margin:0 0 8px;font-weight:700;color:#0A6EBD;">Tu as maintenant accès à :</p> <p style="margin:0;color:#333;font-size:13px;line-height:1.8;"> 📚 Tous les cours PDF · 🎬 Vidéos de formation · 📝 Sujets corrigés · ⏱ Examens blancs · 🤖 Corrections détaillées IA </p> </div> <div style="text-align:center;"> <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#F5820D;color:#fff;text-decoration:none; padding:14px 28px;border-radius:10px;font-weight:700; font-size:15px;display:inline-block;"> Accéder à mon espace Premium ⭐ </a> </div> `);

return envoyer({
to:      user.email,
subject: `✅ Paiement validé — Premium ${transaction.plan} actif`,
html,
});
}

// ── 3. Alerte nouveau concours ───────────────────────────────
async function envoyerAlerteConcours(email, nom, concours) {
const html = templateBase("Nouveau concours disponible", `<h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;"> 🏛️ Nouveau concours disponible ! </h2> <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;"> Bonjour <strong>${nom}</strong>, un nouveau concours vient d'être publié sur EduConcoursCI. </p> <div style="background:#F0FDF4;border-radius:12px;padding:20px;margin:0 0 20px; border-left:4px solid #1A6B3C;"> <h3 style="margin:0 0 12px;color:#1A6B3C;font-size:16px;">${concours.titre}</h3> <table width="100%" cellpadding="0" cellspacing="0"> ${[ ["🏢 Organisme", concours.organisme], ["📂 Catégorie", concours.categorie], ["📅 Ouverture", concours.ouverture || "Voir le site"], ["⏰ Clôture",   concours.cloture   || "Voir le site"], ["💰 Frais",     concours.frais ?`${concours.frais.toLocaleString("fr-CI")} FCFA`: "Gratuit"], ["🎓 Niveau",    concours.niveau || "Voir le site"], ].map(([k, v]) =>`
<tr>
<td style="padding:6px 0;color:#555;font-size:13px;">${k}</td>
<td style="padding:6px 0;font-weight:600;font-size:13px;text-align:right;">${v}</td>
</tr>
`).join("")} </table> </div> <div style="text-align:center;"> <a href="${process.env.FRONTEND_URL}/concours-detail.html?id=${concours.id}" style="background-color:#1A6B3C;color:#ffffff !important; text-decoration:none;padding:14px 28px;border-radius:10px; font-weight:700;font-size:15px;display:inline-block;border:2px solid #1A6B3C;"><span style="color:#ffffff;">Voir les détails du concours →</span></a> </div> `);

return envoyer({
to:      email,
subject: `🏛️ Nouveau concours : ${concours.titre}`,
html,
});
}

// ── 4. Résultat QCM ──────────────────────────────────────────
async function envoyerResultatQCM(user, resultat) {
const couleur = resultat.pourcentage >= 75 ? "#1A6B3C"
: resultat.pourcentage >= 50 ? "#F5820D"
: "#D9000D";

const html = templateBase("Ton résultat QCM", `<h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;"> Ton résultat QCM 🧠 </h2> <p style="color:#333;font-size:15px;margin:0 0 20px;"> Bonjour <strong>${user.nom}</strong>, voici ton résultat pour le QCM <em>${resultat.qcmTitre}</em>. </p> <div style="text-align:center;padding:24px;background:#F9FAFB; border-radius:16px;margin:0 0 20px;"> <div style="font-size:52px;font-weight:900;color:${couleur};"> ${resultat.pourcentage}% </div> <div style="font-size:18px;color:#333;margin:8px 0;"> ${resultat.score} / ${resultat.total} bonnes réponses </div> <div style="font-size:16px;font-weight:700;color:${couleur};"> ${resultat.mention} </div> </div> ${resultat.conseil ?`
<div style="background:#EFF6FF;border-radius:12px;padding:16px;margin:0 0 20px;">
<p style="margin:0 0 6px;font-weight:700;color:#0A6EBD;">💡 Conseil personnalisé IA :</p>
<p style="margin:0;color:#333;font-size:13px;line-height:1.7;">${resultat.conseil}</p>
</div>`: ""} <div style="text-align:center;"> <a href="${process.env.FRONTEND_URL}/preparation.html" style="background:#0A6EBD;color:#fff;text-decoration:none; padding:14px 28px;border-radius:10px;font-weight:700; font-size:15px;display:inline-block;"> Continuer la préparation → </a> </div>`);

return envoyer({
to:      user.email,
subject: `🧠 Résultat QCM : ${resultat.pourcentage}% — ${resultat.mention}`,
html,
});
}

// ── 5. Rappel clôture concours (J-7) ────────────────────────
async function envoyerRappelCloture(email, nom, concours, joursRestants) {
const html = templateBase("Rappel : clôture imminente", `<h2 style="color:#D9000D;font-size:20px;margin:0 0 16px;"> ⏰ Rappel : Il reste ${joursRestants} jour${joursRestants > 1 ? "s" : ""} ! </h2> <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;"> Bonjour <strong>${nom}</strong>, la date limite d'inscription au concours ci-dessous approche. Ne rate pas cette opportunité ! </p> <div style="background:#FEF2F2;border-radius:12px;padding:20px;margin:0 0 20px; border-left:4px solid #D9000D;"> <h3 style="margin:0 0 8px;color:#D9000D;">${concours.titre}</h3> <p style="margin:0;color:#555;font-size:14px;"> ⏰ Date limite : <strong>${concours.cloture}</strong> | 🏢 Organisme : <strong>${concours.organisme}</strong> </p> </div> <div style="text-align:center;"> <a href="${process.env.FRONTEND_URL}/concours-detail.html?id=${concours.id}" style="background:#D9000D;color:#fff;text-decoration:none; padding:14px 28px;border-radius:10px;font-weight:700; font-size:15px;display:inline-block;"> Voir les pièces à fournir → </a> </div>`);

return envoyer({
to:      email,
subject: `⚠️ Plus que ${joursRestants} jour${joursRestants > 1 ? "s" : ""} — ${concours.titre}`,
html,
});
}

// ── 6. Notification manuelle admin ───────────────────────────
async function envoyerNotificationAdmin(destinataires, { titre, message, urgent }) {
const html = templateBase(titre, `${urgent ?`<div style="background:#FEF2F2;border:1px solid #D9000D;border-radius:10px;
padding:12px 16px;margin:0 0 20px;text-align:center;">
<span style="color:#D9000D;font-weight:700;font-size:14px;">🔴 NOTIFICATION URGENTE</span>
</div>`: ""} <h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;">${titre}</h2> <div style="color:#333;font-size:15px;line-height:1.8;white-space:pre-line;"> ${message} </div> <div style="text-align:center;margin-top:24px;"> <a href="${process.env.FRONTEND_URL}" style="background-color:#1A6B3C;color:#ffffff !important; text-decoration:none;padding:14px 28px;border-radius:10px; font-weight:700;font-size:15px;display:inline-block;border:2px solid #1A6B3C;"><span style="color:#ffffff;">Voir sur EduConcoursCI →</span></a> </div>`);

// Envoie à tous les destinataires
const resultats = await Promise.allSettled(
destinataires.map(d => envoyer({
to:      d.email,
subject: urgent ? `🔴 URGENT : ${titre}` : titre,
html,
}))
);

const succes  = resultats.filter(r => r.status === "fulfilled").length;
const echecs  = resultats.filter(r => r.status === "rejected").length;

return { envoyes: succes, echecs, total: destinataires.length };
}

// ── 7. Réinitialisation de mot de passe ───────────────────────
async function envoyerResetMotDePasse(user, lienReset) {
const html = templateBase("Réinitialisation de mot de passe — EduConcoursCI", `
  <h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;">Réinitialisation de ton mot de passe 🔑</h2>
  <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;">
    Bonjour <strong>${user.nom}</strong>, tu as demandé à réinitialiser ton mot de passe sur EduConcoursCI.
    Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe.
  </p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${lienReset}" style="background-color:#1A6B3C;color:#ffffff !important;
      text-decoration:none;padding:14px 28px;border-radius:10px;
      font-weight:700;font-size:15px;display:inline-block;border:2px solid #1A6B3C;">
      <span style="color:#ffffff;">Réinitialiser mon mot de passe →</span>
    </a>
  </div>
  <p style="color:#555;font-size:13px;line-height:1.6;margin:16px 0 0;text-align:center;">
    Si le bouton ne s'affiche pas correctement, copie-colle ce lien dans ton navigateur :<br>
    <a href="${lienReset}" style="color:#0A6EBD;word-break:break-all;">${lienReset}</a>
  </p>
  <p style="color:#888;font-size:13px;line-height:1.7;margin:20px 0 0;">
    Ce lien est valable 1 heure. Si tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail —
    ton mot de passe actuel reste inchangé.
  </p>
`);

return envoyer({
to:      user.email,
subject: "🔑 Réinitialisation de ton mot de passe",
html,
});
}

module.exports = {
envoyer,
envoyerBienvenue,
envoyerConfirmationPaiement,
envoyerAlerteConcours,
envoyerResultatQCM,
envoyerRappelCloture,
envoyerNotificationAdmin,
envoyerResetMotDePasse,
emailConfigure,
getTransporter,
};