// ============================================================
//  scripts/deploy-check.js
//  Vérifie que les variables d'environnement nécessaires sont
//  présentes avant un déploiement, avec un niveau de gravité par
//  variable — pour éviter de découvrir un oubli après coup, en
//  production. Ne modifie rien, ne se connecte à rien : lecture
//  seule de process.env.
//
//  Doit être exécuté LÀ OÙ vivent les vraies variables (ex: un
//  shell Render avec les Environment Variables déjà chargées, ou
//  un .env local rempli manuellement) — lancé sans ça, tout
//  apparaîtra "manquant" alors que ce serait correctement configuré
//  en production.
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

// Chaque entrée active RÉELLEMENT un moyen de paiement — sert au calcul
// "au moins un moyen configuré" plus bas. Ne pas y mettre les URLs ou
// secrets qui ne font qu'accompagner un moyen déjà activé par ailleurs
// (ex: WAVE_WEBHOOK_SECRET n'active rien à lui seul).
const PAIEMENT_MOYENS = [
  ["WAVE_NUMERO", "Aucun moyen de paiement Wave (mode manuel) configuré."],
  ["WAVE_LIEN_PAIEMENT", "Pas de lien marchand Wave — repli sur numéro simple si WAVE_NUMERO est présent."],
  ["WAVE_API_KEY", "Paiement Wave automatique (montant pré-rempli, activation sans saisie) non actif — le mode manuel/lien reste disponible."],
  ["OM_NUMERO", "Aucun moyen de paiement Orange Money configuré."],
  ["MTN_NUMERO", "Aucun moyen de paiement MTN Money configuré."],
  ["MOOV_NUMERO", "Aucun moyen de paiement Moov Money configuré."],
  ["CINETPAY_API_KEY", "Paiement automatique par carte non actif — le mode manuel reste disponible."],
  ["CINETPAY_SITE_ID", "Paiement automatique par carte non actif — le mode manuel reste disponible."],
];

const OPTIONNEL = [
  ["BREVO_API_KEY", "Les emails transactionnels (bienvenue, reçu de paiement, reset mot de passe...) ne partiront pas."],
  ["ANTHROPIC_API_KEY", "L'assistant IA sera indisponible."],
  ["GOOGLE_SEARCH_API_KEY", "La détection automatique de nouveaux concours restera limitée aux flux RSS."],
  ["VAPID_PUBLIC_KEY", "Les notifications push navigateur seront indisponibles."],
  ["SMS_API_KEY", "Les rappels par SMS seront indisponibles (les emails suffisent)."],
];

function present(nom) {
  return Boolean(process.env[nom] && process.env[nom].trim() !== "");
}

function verifierGroupe(titre, variables, icone) {
  console.log(`\n${titre}`);
  let manquantes = 0;
  for (const [nom, consequence] of variables) {
    if (present(nom)) {
      console.log(`  ✅ ${nom}`);
    } else {
      manquantes++;
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
  "❌",
);
const manquantesPaiement = verifierGroupe(
  "🟠 PAIEMENT — au moins un moyen doit être présent pour encaisser",
  PAIEMENT_MOYENS,
  "⚠️ ",
);
const manquantesOptionnelles = verifierGroupe(
  "🟡 OPTIONNEL — améliore l'expérience, non bloquant",
  OPTIONNEL,
  "⚠️ ",
);

// ── Réglages associés, vérifiés séparément car ils n'activent rien à
//    eux seuls, mais peuvent SILENCIEUSEMENT casser un moyen déjà actif
//    — en particulier après une migration d'hébergeur (Railway → Render
//    ou autre), où ces URLs peuvent pointer vers un domaine mort sans
//    qu'aucune erreur ne remonte côté site : le paiement a l'air de
//    fonctionner pour le client, mais le Premium ne s'active jamais. ──
console.log("\n🔗 URLS ET SECRETS ASSOCIÉS — sensibles à un changement d'hébergeur");
let critiquesAssocies = 0;

if (present("WAVE_API_KEY") && !present("WAVE_WEBHOOK_SECRET")) {
  critiquesAssocies++;
  console.log("  ❌ WAVE_WEBHOOK_SECRET — manquante alors que WAVE_API_KEY est configurée : les webhooks Wave seront REJETÉS (signature invalide), le Premium ne s'activera JAMAIS automatiquement même si le client paie réellement.");
} else if (present("WAVE_WEBHOOK_SECRET")) {
  console.log("  ✅ WAVE_WEBHOOK_SECRET");
}

if (present("WAVE_API_KEY")) {
  for (const nom of ["WAVE_SUCCESS_URL", "WAVE_ERROR_URL"]) {
    if (present(nom)) {
      console.log(`  ✅ ${nom} → ${process.env[nom]}`);
    } else {
      console.log(`  ⚠️  ${nom} — absente, repli automatique sur FRONTEND_URL (${process.env.FRONTEND_URL || "non configurée !"}) + le chemin par défaut. Vérifie que FRONTEND_URL est bien ton domaine ACTUEL.`);
    }
  }
}

if (present("CINETPAY_API_KEY")) {
  if (present("CINETPAY_NOTIFY_URL")) {
    console.log(`  ✅ CINETPAY_NOTIFY_URL → ${process.env.CINETPAY_NOTIFY_URL}`);
    console.log("     ⚠️  Vérifie AUSSI que cette même URL est enregistrée dans le tableau de bord CinetPay lui-même (externe à ce serveur) — sinon CinetPay ne saura jamais où notifier un paiement réussi.");
  } else {
    critiquesAssocies++;
    console.log("  ❌ CINETPAY_NOTIFY_URL — manquante alors que CinetPay est configuré : CinetPay n'aura aucune URL à notifier, le Premium ne s'activera jamais automatiquement sur un paiement par carte/mobile money via CinetPay.");
  }
  if (present("CINETPAY_RETURN_URL")) {
    console.log(`  ✅ CINETPAY_RETURN_URL → ${process.env.CINETPAY_RETURN_URL}`);
  } else {
    console.log("  ⚠️  CINETPAY_RETURN_URL — absente : le client sera redirigé après paiement vers une URL de repli définie dans le tableau de bord CinetPay, potentiellement obsolète après une migration d'hébergeur.");
  }
}

console.log("\n" + "=".repeat(60));

// Au moins UN moyen de paiement doit être configuré (Wave, OM, MTN,
// Moov ou CinetPay) — sinon le site ne peut littéralement encaisser
// aucun paiement, ce qui bloque la génération de revenus même si le
// serveur démarre sans problème.
const auMoinsUnPaiement = PAIEMENT_MOYENS.some(([nom]) => present(nom));

if (manquantesIndispensables > 0) {
  console.log(`\n❌ ${manquantesIndispensables} variable(s) indispensable(s) manquante(s) — le déploiement va échouer.`);
  process.exitCode = 1;
} else if (!auMoinsUnPaiement) {
  console.log("\n⚠️  Le serveur démarrera, mais AUCUN moyen de paiement n'est configuré — impossible d'encaisser quoi que ce soit pour le moment.");
  process.exitCode = 1;
} else if (critiquesAssocies > 0) {
  // Le serveur démarre, un moyen de paiement EST configuré, mais l'un
  // d'eux est cassé de façon invisible pour un visiteur (webhook non
  // fonctionnel) — ce cas mérite d'être aussi visible qu'un vrai
  // blocage, pas noyé sous un "✅ Prêt" qui rassurerait à tort.
  console.log(`\n❌ ${critiquesAssocies} réglage(s) critique(s) manquant(s) pour qu'un moyen de paiement déjà activé fonctionne réellement (voir 🔗 ci-dessus) — un client pourrait payer sans jamais recevoir son Premium.`);
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
