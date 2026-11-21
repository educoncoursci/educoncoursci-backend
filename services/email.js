// ============================================================
//  services/email.js
//  Envoi d'e-mails via l'API HTTPS de Brevo (ex-Sendinblue).
//  Utilisé pour : bienvenue, paiement, alertes concours,
//                 scores QCM, rappels clôture, reset mot de passe.
//
//  ⚠️ Pourquoi l'API HTTPS et pas le SMTP (Gmail/Yahoo) ?
//  Render (comme Railway avant lui) bloque les connexions SMTP sortantes sur son plan
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
                      letter-spacing:0.5px;">🎓 ProInsertion CI</h1>
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
            ProInsertion CI · Votre avenir professionnel commence ici.<br>Abidjan, Côte d'Ivoire<br>
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
  `Configure cette variable dans les Environment Variables de votre hébergeur (Render) pour activer l'envoi réel.`,
);
return { simule: true, to, subject };
}

const nomExpediteur = (process.env.EMAIL_FROM || "ProInsertion CI <noreply@educoncoursci.ci>")
.match(/^(.*?)\s*<(.+)>$/);
const senderName  = nomExpediteur ? nomExpediteur[1].trim() : "ProInsertion CI";
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
// .env.example). On construit un message d'erreur détaillé (code +
// message Brevo + expéditeur utilisé) pour qu'il soit immédiatement
// exploitable dans les logs Render, sans avoir à reproduire l'appel
// manuellement pour comprendre la cause.
const detail = data.message || JSON.stringify(data);
const erreur = new Error(
  `Erreur Brevo (HTTP ${response.status}, code: ${data.code || "inconnu"}) : ${detail} ` +
  `| Expéditeur utilisé : ${senderEmail} — vérifiez qu'il est EXACTEMENT celui validé dans Brevo (Paramètres → Expéditeurs).`,
);
erreur.brevoStatus = response.status;
erreur.brevoCode = data.code;
throw erreur;
}

console.log(`✅ E-mail envoyé → ${to} | Sujet: ${subject} | id: ${data.messageId}`);
return { messageId: data.messageId, to };
}


// ════════════════════════════════════════════════════════════
//  Templates e-mail spécifiques
// ════════════════════════════════════════════════════════════

// ── 1. Bienvenue ─────────────────────────────────────────────
async function envoyerBienvenue(user) {
const html = templateBase("Bienvenue sur ProInsertion CI !", `<h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;"> Bienvenue, ${user.nom} ! 🎉 </h2> <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 16px;"> Votre compte a été créé avec succès sur <strong>ProInsertion CI</strong>, la plateforme de référence pour la préparation aux concours de Côte d'Ivoire. </p> <div style="background:#F0FDF4;border-radius:12px;padding:18px;margin:20px 0;"> <p style="margin:0 0 10px;font-weight:700;color:#1A6B3C;">Vous avez maintenant accès à :</p> <ul style="margin:0;padding-left:20px;color:#333;line-height:1.9;font-size:14px;"> <li>📋 La liste complète des concours de Côte d'Ivoire</li> <li>🧠 Des QCM de préparation gratuits</li> <li>💼 Des offres d'emploi et un générateur de CV et lettres</li> </ul> </div> <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 20px;"> Pour profiter de tous les outils, passe en <strong>Premium</strong> dès 2 000 FCFA/mois. </p> <div style="text-align:center;margin:24px 0;"> <a href="${process.env.FRONTEND_URL || "https://proinsertionci.netlify.app"}" style="background:linear-gradient(90deg,#1A6B3C,#0A6EBD);color:#fff; text-decoration:none;padding:14px 28px;border-radius:10px; font-weight:700;font-size:15px;display:inline-block;"> Accéder à la plateforme → </a> </div>`);

return envoyer({
to:      user.email,
subject: "Bienvenue sur ProInsertion CI ! 🎓",
html,
});
}

// ── 2. Confirmation de paiement ──────────────────────────────
async function envoyerConfirmationPaiement(user, transaction) {
const html = templateBase("Paiement validé — ProInsertion CI", `<h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;"> Paiement validé ! ✅ </h2> <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;"> Bonjour <strong>${user.nom}</strong>, votre abonnement <strong>Premium ${transaction.plan}</strong> est maintenant actif. </p> <div style="background:#F9FAFB;border-radius:12px;padding:18px;margin:0 0 20px;"> <table width="100%" cellpadding="0" cellspacing="0"> ${[ ["Plan",      `Premium ${transaction.plan}`], ["Montant",    `${transaction.montant?.toLocaleString("fr-CI")} FCFA`], ["Moyen",      transaction.moyen], ["Référence",  transaction.txId], ["Date",       new Date().toLocaleDateString("fr-FR")], ["Expiration", transaction.expiration || "Voir votre profil"], ].map(([k, v]) => `
<tr>
<td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #E5E7EB;">${k}</td>
<td style="padding:8px 0;font-weight:700;font-size:13px;border-bottom:1px solid #E5E7EB;text-align:right;">${v}</td>
</tr>
`).join("")} </table> </div> <div style="background:#EFF6FF;border-radius:12px;padding:16px;margin:0 0 20px;"> <p style="margin:0 0 8px;font-weight:700;color:#0A6EBD;">Vous avez maintenant accès à :</p> <p style="margin:0;color:#333;font-size:13px;line-height:1.8;"> ⭐ Tous les avantages de votre formule Premium </p> </div> <div style="text-align:center;"> <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#F5820D;color:#fff;text-decoration:none; padding:14px 28px;border-radius:10px;font-weight:700; font-size:15px;display:inline-block;"> Accéder à mon espace Premium ⭐ </a> </div> `);

return envoyer({
to:      user.email,
subject: `✅ Paiement validé — Premium ${transaction.plan} actif`,
html,
});
}

// ── 3. Alerte nouveau concours ───────────────────────────────
async function envoyerAlerteConcours(email, nom, concours) {
const html = templateBase("Nouveau concours disponible", `<h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;"> 🏛️ Nouveau concours disponible ! </h2> <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;"> Bonjour <strong>${nom}</strong>, un nouveau concours vient d'être publié sur ProInsertion CI. </p> <div style="background:#F0FDF4;border-radius:12px;padding:20px;margin:0 0 20px; border-left:4px solid #1A6B3C;"> <h3 style="margin:0 0 12px;color:#1A6B3C;font-size:16px;">${concours.titre}</h3> <table width="100%" cellpadding="0" cellspacing="0"> ${[ ["🏢 Organisme", concours.organisme], ["📂 Catégorie", concours.categorie], ["📅 Ouverture", concours.ouverture || "Voir le site"], ["⏰ Clôture",   concours.cloture   || "Voir le site"], ["💰 Frais",     concours.frais ?`${concours.frais.toLocaleString("fr-CI")} FCFA`: "Gratuit"], ["🎓 Niveau",    concours.niveau || "Voir le site"], ].map(([k, v]) =>`
<tr>
<td style="padding:6px 0;color:#555;font-size:13px;">${k}</td>
<td style="padding:6px 0;font-weight:600;font-size:13px;text-align:right;">${v}</td>
</tr>
`).join("")} </table> </div> <div style="text-align:center;"> <a href="${process.env.FRONTEND_URL}/concours-detail.html?id=${concours.id}" style="background:linear-gradient(90deg,#1A6B3C,#0A6EBD);color:#fff; text-decoration:none;padding:14px 28px;border-radius:10px; font-weight:700;font-size:15px;display:inline-block;"> Voir les détails du concours → </a> </div> `);

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

const html = templateBase("Votre résultat QCM", `<h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;"> Votre résultat QCM 🧠 </h2> <p style="color:#333;font-size:15px;margin:0 0 20px;"> Bonjour <strong>${user.nom}</strong>, voici votre résultat pour le QCM <em>${resultat.qcmTitre}</em>. </p> <div style="text-align:center;padding:24px;background:#F9FAFB; border-radius:16px;margin:0 0 20px;"> <div style="font-size:52px;font-weight:900;color:${couleur};"> ${resultat.pourcentage}% </div> <div style="font-size:18px;color:#333;margin:8px 0;"> ${resultat.score} / ${resultat.total} bonnes réponses </div> <div style="font-size:16px;font-weight:700;color:${couleur};"> ${resultat.mention} </div> </div> ${resultat.conseil ?`
<div style="background:#EFF6FF;border-radius:12px;padding:16px;margin:0 0 20px;">
<p style="margin:0 0 6px;font-weight:700;color:#0A6EBD;">💡 Conseil personnalisé :</p>
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
const html = templateBase("Rappel : clôture imminente", `<h2 style="color:#D9000D;font-size:20px;margin:0 0 16px;"> ⏰ Rappel : Il reste ${joursRestants} jour${joursRestants > 1 ? "s" : ""} ! </h2> <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;"> Bonjour <strong>${nom}</strong>, la date limite d'inscription au concours ci-dessous approche. Ne ratez pas cette opportunité ! </p> <div style="background:#FEF2F2;border-radius:12px;padding:20px;margin:0 0 20px; border-left:4px solid #D9000D;"> <h3 style="margin:0 0 8px;color:#D9000D;">${concours.titre}</h3> <p style="margin:0;color:#555;font-size:14px;"> ⏰ Date limite : <strong>${concours.cloture}</strong> | 🏢 Organisme : <strong>${concours.organisme}</strong> </p> </div> <div style="text-align:center;"> <a href="${process.env.FRONTEND_URL}/concours-detail.html?id=${concours.id}" style="background:#D9000D;color:#fff;text-decoration:none; padding:14px 28px;border-radius:10px;font-weight:700; font-size:15px;display:inline-block;"> Voir les pièces à fournir → </a> </div>`);

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
</div>`: ""} <h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;">${titre}</h2> <div style="color:#333;font-size:15px;line-height:1.8;white-space:pre-line;"> ${message} </div> <div style="text-align:center;margin-top:24px;"> <a href="${process.env.FRONTEND_URL}" style="background:linear-gradient(90deg,#1A6B3C,#0A6EBD);color:#fff; text-decoration:none;padding:14px 28px;border-radius:10px; font-weight:700;font-size:15px;display:inline-block;"> Voir sur ProInsertion CI → </a> </div>`);

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
const html = templateBase("Réinitialisation de mot de passe — ProInsertion CI", `
  <h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;">Réinitialisation de votre mot de passe 🔑</h2>
  <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;">
    Bonjour <strong>${user.nom}</strong>, vous avez demandé à réinitialiser votre mot de passe sur ProInsertion CI.
    Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
  </p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${lienReset}" style="background-color:#1A6B3C;background:linear-gradient(90deg,#1A6B3C,#0A6EBD);color:#ffffff !important;
      text-decoration:none;padding:14px 28px;border-radius:10px;border:1px solid #1A6B3C;
      font-weight:700;font-size:15px;display:inline-block;mso-padding-alt:0;">
      <!--[if mso]>&nbsp;<![endif]-->Réinitialiser mon mot de passe →<!--[if mso]>&nbsp;<![endif]-->
    </a>
  </div>
  <p style="color:#333;font-size:13px;line-height:1.6;margin:0 0 20px;word-break:break-all;">
    Si le bouton ne s'affiche pas, copie-colle ce lien dans votre navigateur :<br>
    <a href="${lienReset}" style="color:#0A6EBD;">${lienReset}</a>
  </p>
  <p style="color:#888;font-size:13px;line-height:1.7;margin:20px 0 0;">
    Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail —
    votre mot de passe actuel reste inchangé.
  </p>
`);

return envoyer({
to:      user.email,
subject: "🔑 Réinitialisation de votre mot de passe",
html,
});
}

// ── Vérification d'adresse e-mail ─────────────────────────────
async function envoyerVerificationEmail(user, lien) {
const nom = String(user.nom || "").replace(/[<>&"]/g, "");
const html = templateBase("Confirmez votre adresse e-mail — ProInsertion CI", `
  <h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;">Confirmez votre adresse e-mail ✉️</h2>
  <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;">
    Bonjour <strong>${nom}</strong>, merci de vous être inscrit(e) sur ProInsertion CI.
    Pour activer toutes les fonctionnalités de votre compte, confirmez votre adresse e-mail.
  </p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${lien}" style="background-color:#1A6B3C;background:linear-gradient(90deg,#1A6B3C,#0A6EBD);color:#ffffff !important;
      text-decoration:none;padding:14px 28px;border-radius:10px;border:1px solid #1A6B3C;
      font-weight:700;font-size:15px;display:inline-block;">Confirmer mon adresse e-mail →</a>
  </div>
  <p style="color:#333;font-size:13px;line-height:1.6;margin:0 0 20px;word-break:break-all;">
    Si le bouton ne s'affiche pas, copiez-collez ce lien dans votre navigateur :<br>
    <a href="${lien}" style="color:#0A6EBD;">${lien}</a>
  </p>
  <p style="color:#888;font-size:13px;line-height:1.7;margin:20px 0 0;">
    Ce lien est valable 48 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet e-mail.
  </p>
`);
return envoyer({ to: user.email, subject: "✉️ Confirmez votre adresse e-mail — ProInsertion CI", html });
}

// ── E-mail de confirmation d'inscription à la newsletter ─────────
// Manquait entièrement jusqu'ici : le contrôleur (vitrineController.
// inscrireNewsletter) enregistrait bien l'adresse en base, mais
// n'envoyait jamais aucun e-mail — l'utilisateur n'avait donc aucune
// confirmation dans sa boîte mail, seulement le message affiché sur
// le site lui-même.
async function envoyerConfirmationNewsletter(email) {
const html = templateBase("Inscription confirmée — ProInsertion CI", `
  <h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;">Inscription confirmée ! 📬</h2>
  <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px;">
    Merci de vous être inscrit(e) à la newsletter de ProInsertion CI. Vous recevrez désormais un résumé
    des nouveaux concours et des actualités importantes directement dans cette boîte mail.
  </p>
  <p style="color:#888;font-size:13px;line-height:1.7;margin:20px 0 0;">
    Vous n'êtes pas à l'origine de cette inscription ? Ignore simplement cet e-mail, ou contactez-nous
    pour être retiré(e) de la liste.
  </p>
`);

return envoyer({
to:      email,
subject: "📬 Inscription à la newsletter ProInsertion CI confirmée",
html,
});
}

// ── Alertes emploi : résumé quotidien des nouvelles offres ──
const echapper = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
async function envoyerAlertesEmploi(email, nom, offres) {
const base = process.env.FRONTEND_URL || "https://proinsertionci.netlify.app";
const lignes = offres.map((o) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;"><strong style="color:#1A6B3C;">${echapper(o.titre)}</strong><br><span style="color:#555;font-size:13px;">${echapper(o.entreprise)} · ${echapper(o.type_contrat)}${o.ville ? " · " + echapper(o.ville) : ""}</span></td></tr>`).join("");
const html = templateBase("Nouvelles offres pour vous", `<h2 style="color:#1A6B3C;font-size:20px;margin:0 0 16px;">Nouvelles offres correspondant à vos alertes</h2><p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 16px;">Bonjour <strong>${echapper(nom)}</strong>, ${offres.length} nouvelle${offres.length > 1 ? "s offres correspondent" : " offre correspond"} à vos alertes emploi.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px;">${lignes}</table><div style="text-align:center;"><a href="${base}/emploi.html" style="background:#1A6B3C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;">Voir les offres →</a></div><p style="color:#888;font-size:12px;margin:20px 0 0;">Vous pouvez modifier ou supprimer vos alertes à tout moment depuis la page Offres d'emploi.</p>`);
return envoyer({ to: email, subject: `${offres.length} nouvelle${offres.length > 1 ? "s offres" : " offre"} pour vous — ProInsertion CI`, html });
}

// ── Rappels personnels : relances à faire + fin d'abonnement ──
async function envoyerRappelsPersonnels(email, nom, { relances = [], expiration = null }) {
const base = process.env.FRONTEND_URL || "https://proinsertionci.netlify.app";
let blocs = "";
if (relances.length) {
  const lignes = relances.map((r) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;"><strong style="color:#1A6B3C;">${echapper(r.poste)}</strong><br><span style="color:#555;font-size:13px;">${echapper(r.organisme || "")}${r.organisme ? " · " : ""}relance prévue le ${echapper(String(r.relance_le).split("-").reverse().join("/"))}</span></td></tr>`).join("");
  blocs += `<h3 style="color:#1A6B3C;font-size:16px;margin:0 0 8px;">Candidatures à relancer</h3><table style="width:100%;border-collapse:collapse;margin:0 0 20px;">${lignes}</table><div style="text-align:center;margin:0 0 20px;"><a href="${base}/dashboard/suivi-candidatures.html" style="background:#1A6B3C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;">Ouvrir mon suivi →</a></div>`;
}
if (expiration) {
  blocs += `<h3 style="color:#B45309;font-size:16px;margin:0 0 8px;">Votre abonnement Premium se termine bientôt</h3><p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 16px;">Il reste ${expiration.jours} jour${expiration.jours > 1 ? "s" : ""} (jusqu'au ${echapper(expiration.date)}). Vous pouvez le renouveler à tout moment depuis la page des formules.</p><div style="text-align:center;margin:0 0 20px;"><a href="${base}/boutique.html" style="background:#B45309;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;">Voir les formules →</a></div>`;
}
const html = templateBase("Vos rappels du jour", `<p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 16px;">Bonjour <strong>${echapper(nom)}</strong>, voici vos rappels du jour.</p>${blocs}<p style="color:#888;font-size:12px;margin:20px 0 0;">Vous pouvez désactiver ces rappels à tout moment dans <a href="${base}/dashboard/profil.html" style="color:#888;">votre profil</a>.</p>`);
return envoyer({ to: email, subject: "Vos rappels du jour — ProInsertion CI", html });
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
envoyerVerificationEmail,
envoyerConfirmationNewsletter,
envoyerAlertesEmploi,
envoyerRappelsPersonnels,
emailConfigure,
getTransporter,
};