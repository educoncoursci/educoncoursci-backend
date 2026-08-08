// ============================================================
//  scripts/deploy-check.js
//  Vérifie que les variables d'environnement nécessaires sont
//  présentes avant un déploiement, avec un niveau de gravité par
//  variable — pour éviter de découvrir un oubli après coup, en
//  production. Ne modifie rien, ne se connecte à rien : lecture
//  seule de process.env.
//
//  Usage : npm run check
// ============================================================

require("dotenv").config();

const INDISPENSABLE = [
  ["DATABASE_URL", "Sans elle, le serveur ne peut pas se connecter à la base et ne démarre pas."],
  ["JWT_SECRET", "Sans elle, personne ne peut se connecter (génère la tienne avec : node scripts/generer-jwt-secret.js)."],
  ["ADMIN_EMAIL", "Nécessaire pour créer le tout premier compte admin au démarrage."],
  ["ADMIN_PASSWORD", "Nécessaire pour créer le tout premier compte admin au démarrage."],
  ["FRONTEND_URL", "Sans elle, le site (CORS) ne peut pas appeler l'API — tout appel sera bloqué."],
];

const PAIEMENT = [
  ["WAVE_NUMERO", "Aucun moyen de paiement Wave configuré."],
  ["WAVE_LIEN_PAIEMENT", "Pas de lien marchand Wave — repli sur numéro simple si WAVE_NUMERO est présent."],
  ["OM_NUMERO", "Aucun moyen de paiement Orange Money configuré."],
  ["MTN_NUMERO", "Aucun moyen de paiement MTN Money configuré."],
  ["MOOV_NUMERO", "Aucun moyen de paiement Moov Money configuré."],
  ["CINETPAY_API_KEY", "Paiement automatique par carte non actif — le mode manuel reste disponible."],
  ["CINETPAY_SITE_ID", "Paiement automatique par carte non actif — le mode manuel reste disponible."],
];

const OPTIONNEL = [
  ["EMAIL_HOST", "Les emails transactionnels (bienvenue, reçu de paiement...) ne partiront pas."],
  ["EMAIL_USER", "Les emails transactionnels (bienvenue, reçu de paiement...) ne partiront pas."],
  ["ANTHROPIC_API_KEY", "L'assistant IA sera indisponible."],
  ["GOOGLE_SEARCH_API_KEY", "La détection automatique de nouveaux concours restera limitée aux flux RSS."],
  ["VAPID_PUBLIC_KEY", "Les notifications push navigateur seront indisponibles."],
  ["SMS_API_KEY", "Les rappels par SMS seront indisponibles (les emails suffisent)."],
];

function verifierGroupe(titre, variables, bloquant) {
  console.log(`\n${titre}`);
  let manquantes = 0;
  for (const [nom, consequence] of variables) {
    const present = !!process.env[nom] && process.env[nom].trim() !== "";
    if (present) {
      console.log(`  ✅ ${nom}`);
    } else {
      manquantes++;
      const icone = bloquant ? "❌" : "⚠️ ";
      console.log(`  ${icone} ${nom} — manquante. ${consequence}`);
    }
  }
  return manquantes;
}

console.log("🔍 Vérification pré-déploiement — EduConcoursCI\n");
console.log("=".repeat(60));

const manquantesIndispensables = verifierGroupe(
  "🔴 INDISPENSABLE — le site ne démarre pas sans ça",
  INDISPENSABLE,
  true,
);
const manquantesPaiement = verifierGroupe(
  "🟠 PAIEMENT — au moins un moyen doit être présent pour encaisser",
  PAIEMENT,
  false,
);
const manquantesOptionnelles = verifierGroupe(
  "🟡 OPTIONNEL — améliore l'expérience, non bloquant",
  OPTIONNEL,
  false,
);

console.log("\n" + "=".repeat(60));

// Au moins UN moyen de paiement doit être configuré (Wave, OM, MTN,
// Moov ou CinetPay) — sinon le site ne peut littéralement encaisser
// aucun paiement, ce qui bloque la génération de revenus même si le
// serveur démarre sans problème.
const auMoinsUnPaiement = PAIEMENT.some(
  ([nom]) => process.env[nom] && process.env[nom].trim() !== "",
);

if (manquantesIndispensables > 0) {
  console.log(`\n❌ ${manquantesIndispensables} variable(s) indispensable(s) manquante(s) — le déploiement va échouer.`);
  process.exitCode = 1;
} else if (!auMoinsUnPaiement) {
  console.log("\n⚠️  Le serveur démarrera, mais AUCUN moyen de paiement n'est configuré — impossible d'encaisser quoi que ce soit pour le moment.");
  process.exitCode = 1;
} else {
  console.log("\n✅ Prêt pour le déploiement.");
  if (manquantesPaiement > 0) {
    console.log(`   (${manquantesPaiement} moyen(s) de paiement supplémentaire(s) pourraient être ajoutés plus tard.)`);
  }
  if (manquantesOptionnelles > 0) {
    console.log(`   (${manquantesOptionnelles} fonctionnalité(s) optionnelle(s) resteront indisponibles pour l'instant.)`);
  }
}
