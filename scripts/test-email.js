// ============================================================
//  scripts/test-email.js
//  Diagnostique la configuration Brevo et envoie un e-mail de
//  test réel, pour identifier précisément pourquoi les e-mails
//  (ex: réinitialisation de mot de passe) ne partent pas.
//
//  Usage :
//    node scripts/test-email.js ton.adresse@exemple.com
// ============================================================

require("dotenv").config();
const { emailConfigure, envoyer } = require("../services/email");

const destinataire = process.argv[2];

(async () => {
  console.log("\n🔍 Diagnostic de la configuration e-mail (Brevo)\n");

  // ── 1. Variables d'environnement ────────────────────────────
  console.log("=== Variables d'environnement ===");
  console.log(`  BREVO_API_KEY : ${process.env.BREVO_API_KEY ? "***" + process.env.BREVO_API_KEY.slice(-4) + " (définie)" : "❌ NON DÉFINIE"}`);
  console.log(`  EMAIL_FROM    : ${process.env.EMAIL_FROM || "(non défini → noreply@educoncoursci.ci par défaut)"}`);

  if (!emailConfigure()) {
    console.log(
      "\n❌ BREVO_API_KEY n'est pas configurée.",
    );
    console.log(
      "   Sans cette variable, aucun e-mail n'est réellement envoyé (le code le simule silencieusement).",
    );
    console.log(
      "   1. Crée un compte gratuit sur https://www.brevo.com (300 emails/jour gratuits)",
    );
    console.log(
      "   2. Récupère ta clé API : Paramètres → Clés API → Générer une nouvelle clé",
    );
    console.log(
      "   3. Vérifie ton adresse d'expédition (obligatoire) : Paramètres → Expéditeurs",
    );
    console.log(
      "      → l'adresse dans EMAIL_FROM doit être exactement celle vérifiée là-bas.",
    );
    console.log(
      "   4. Configure BREVO_API_KEY sur Railway → Variables puis relance ce script.\n",
    );
    process.exitCode = 1;
    return;
  }

  // ── 2. Envoi d'un e-mail de test réel ───────────────────────
  if (!destinataire) {
    console.log(
      "\nℹ️  BREVO_API_KEY configurée. Pour tester l'envoi réel d'un e-mail, relance avec :",
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
    console.log("\nCauses les plus fréquentes avec Brevo :");
    console.log(
      "  1. L'adresse dans EMAIL_FROM n'est pas un expéditeur VÉRIFIÉ dans Brevo —",
    );
    console.log(
      "     va sur Paramètres → Expéditeurs et vérifie que l'adresse y figure exactement.",
    );
    console.log(
      "  2. La clé BREVO_API_KEY est invalide ou expirée — régénère-en une nouvelle.",
    );
    console.log(
      "  3. Le quota gratuit de 300 emails/jour est dépassé.",
    );
    process.exitCode = 1;
  }
})();
