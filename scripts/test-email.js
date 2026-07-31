// ============================================================
//  scripts/test-email.js
//  Diagnostique la configuration SMTP et envoie un e-mail de
//  test réel, pour identifier précisément pourquoi les e-mails
//  (ex: réinitialisation de mot de passe) ne partent pas.
//
//  Usage :
//    node scripts/test-email.js ton.adresse@exemple.com
// ============================================================

require("dotenv").config();
const { emailConfigure, getTransporter, envoyer } = require("../services/email");

const destinataire = process.argv[2];

(async () => {
  console.log("\n🔍 Diagnostic de la configuration e-mail\n");

  // ── 1. Variables d'environnement ────────────────────────────
  console.log("=== Variables d'environnement ===");
  console.log(`  EMAIL_HOST : ${process.env.EMAIL_HOST || "(non défini → smtp.gmail.com par défaut)"}`);
  console.log(`  EMAIL_PORT : ${process.env.EMAIL_PORT || "(non défini → 587 par défaut)"}`);
  console.log(`  EMAIL_USER : ${process.env.EMAIL_USER || "❌ NON DÉFINI"}`);
  console.log(`  EMAIL_PASS : ${process.env.EMAIL_PASS ? "***" + process.env.EMAIL_PASS.slice(-4) + " (défini)" : "❌ NON DÉFINI"}`);
  console.log(`  EMAIL_FROM : ${process.env.EMAIL_FROM || "(non défini)"}`);

  if (!emailConfigure()) {
    console.log(
      "\n❌ EMAIL_USER et/ou EMAIL_PASS ne sont pas configurés.",
    );
    console.log(
      "   C'est très probablement la cause du problème : sans ces deux variables,",
    );
    console.log(
      "   aucun e-mail n'est réellement envoyé (le code le simule silencieusement).",
    );
    console.log(
      "   Configure-les sur ton hébergeur (Railway → Variables) puis relance ce script.\n",
    );
    process.exitCode = 1;
    return;
  }

  // ── 2. Test de connexion SMTP (sans envoyer d'e-mail) ───────
  console.log("\n=== Test de connexion SMTP ===");
  try {
    await getTransporter().verify();
    console.log("✅ Connexion SMTP réussie — les identifiants sont valides.");
  } catch (err) {
    console.log("❌ Échec de connexion SMTP :", err.message);
    console.log("\nCauses les plus fréquentes avec Gmail :");
    console.log(
      "  1. Tu utilises ton mot de passe Gmail normal au lieu d'un « mot de passe",
    );
    console.log(
      "     d'application ». Gmail bloque systématiquement les connexions SMTP",
    );
    console.log(
      "     avec le mot de passe du compte — il faut un mot de passe d'application",
    );
    console.log(
      "     à 16 caractères, généré ici : https://myaccount.google.com/apppasswords",
    );
    console.log(
      "     (nécessite la validation en 2 étapes activée sur le compte Google).",
    );
    console.log(
      "  2. EMAIL_USER contient une faute de frappe dans l'adresse.",
    );
    console.log(
      "  3. Le compte Google a bloqué la tentative de connexion (vérifie les",
    );
    console.log(
      "     alertes de sécurité sur https://myaccount.google.com/notifications).",
    );
    console.log(
      "\n💡 Alternative recommandée : un service transactionnel dédié (Brevo,",
    );
    console.log(
      "   Resend, Mailgun...) est plus fiable que Gmail SMTP pour un site en",
    );
    console.log("   production, avec de meilleurs taux de délivrabilité.\n");
    process.exitCode = 1;
    return;
  }

  // ── 3. Envoi d'un e-mail de test réel ───────────────────────
  if (!destinataire) {
    console.log(
      "\nℹ️  Connexion SMTP OK. Pour tester l'envoi réel d'un e-mail, relance avec :",
    );
    console.log("   node scripts/test-email.js ton.adresse@exemple.com\n");
    return;
  }

  console.log(`\n=== Envoi d'un e-mail de test à ${destinataire} ===`);
  try {
    const resultat = await envoyer({
      to: destinataire,
      subject: "✅ Test EduConcoursCI — la configuration e-mail fonctionne",
      html: `<p>Si tu lis ce message, l'envoi d'e-mails depuis EduConcoursCI fonctionne correctement 🎉</p>`,
    });
    console.log("✅ E-mail envoyé avec succès !");
    console.log(`   Identifiant du message : ${resultat.messageId}`);
    console.log(
      "\n➡️  Vérifie la boîte de réception (et le dossier spams) de",
      destinataire,
      "\n",
    );
  } catch (err) {
    console.log("❌ L'envoi a échoué :", err.message);
    process.exitCode = 1;
  }
})();
