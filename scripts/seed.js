// ============================================================
//  scripts/seed.js
//  Insère des données de démonstration dans la base de données
//  Usage : node scripts/seed.js
// ============================================================

require("dotenv").config();
const { query, initDatabase } = require("../config/database");
const bcrypt = require("bcryptjs");

async function seed() {
console.log("🌱 Démarrage du seed EduConcoursCI…\n");

try {
// Initialise les tables
await initDatabase();
console.log("✅ Base de données initialisée\n");

// ── 1. Utilisateurs de test ──────────────────────────────
console.log("👥 Création des utilisateurs...");

const hash = await bcrypt.hash("Test1234!", 12);

// Utilisateur gratuit
await query(`
  INSERT INTO users (nom, email, password_hash, role, premium)
  VALUES ($1, $2, $3, 'user', false)
  ON CONFLICT (email) DO NOTHING`,
  ["Koffi Kouassi", "koffi@test.ci", hash]
);

// Utilisateur Premium
const expire = new Date();
expire.setMonth(expire.getMonth() + 3);
await query(`
  INSERT INTO users (nom, email, password_hash, role, premium, premium_plan, premium_expire)
  VALUES ($1, $2, $3, 'user', true, '3 Mois', $4)
  ON CONFLICT (email) DO NOTHING`,
  ["Aminata Coulibaly", "aminata@test.ci", hash, expire.toISOString().split("T")[0]]
);

console.log("  ✅ 2 utilisateurs de test créés (mot de passe : Test1234!)");

// ── 2. Concours ──────────────────────────────────────────
console.log("\n🏛️ Création des concours...");

const concours = [
  {
    titre: "Concours de recrutement d'Assistants Sociaux Adjoints",
    organisme: "Ministère de la Solidarité et de la Lutte contre la Pauvreté",
    categorie: "Travail Social",
    statut: "ouvert",
    niveau: "BAC+3",
    places: 150,
    frais: 5000,
    ouverture: "15/01/2026",
    cloture: "31/03/2026",
    premium: false,
    couleur: "#1A6B3C",
    conditions: "Être de nationalité ivoirienne\nAvoir moins de 35 ans\nTitulaire du Diplôme d'État d'Assistant Social",
    pieces: JSON.stringify([
      "Extrait de naissance ou jugement supplétif",
      "Certificat de nationalité ivoirienne",
      "Copie légalisée du diplôme",
      "Casier judiciaire de moins de 3 mois",
      "Certificat médical d'aptitude physique",
      "4 photos d'identité récentes",
      "Curriculum Vitae"
    ]),
    centres: JSON.stringify([
      "Abidjan — Ministère de la Solidarité (Plateau)",
      "Bouaké — Direction Régionale",
      "Korhogo — Direction Régionale",
      "San-Pédro — Direction Régionale"
    ])
  },
  {
    titre: "Concours d'entrée à l'École Nationale de Police (ENP)",
    organisme: "Ministère de l'Intérieur et de la Sécurité",
    categorie: "Sécurité",
    statut: "ouvert",
    niveau: "BEPC",
    places: 500,
    frais: 3000,
    ouverture: "01/02/2026",
    cloture: "30/04/2026",
    premium: false,
    couleur: "#0A6EBD",
    conditions: "Être de nationalité ivoirienne\nAvoir entre 18 et 25 ans\nTitulaire du BEPC ou équivalent\nTaille minimale : 1m70 (H) / 1m65 (F)\nApte physiquement",
    pieces: JSON.stringify([
      "Acte de naissance",
      "Nationalité ivoirienne",
      "Copie du BEPC",
      "Casier judiciaire vierge",
      "Certificat médical",
      "Certificat de résidence",
      "4 photos d'identité"
    ]),
    centres: JSON.stringify([
      "Abidjan — ENP Cocody",
      "Bouaké — Commissariat Central",
      "Daloa — Direction Régionale"
    ])
  },
  {
    titre: "Concours de recrutement à la Fonction Publique — Catégorie B",
    organisme: "Ministère de la Fonction Publique",
    categorie: "Fonction Publique",
    statut: "à venir",
    niveau: "BAC+2",
    places: 800,
    frais: 6000,
    ouverture: "15/04/2026",
    cloture: "30/06/2026",
    premium: true,
    couleur: "#7B2FBE",
    conditions: "Être de nationalité ivoirienne\nAvoir moins de 40 ans\nTitulaire d'un diplôme de niveau BAC+2 minimum\nN'avoir jamais été révoqué de la Fonction Publique",
    pieces: JSON.stringify([
      "Extrait de naissance",
      "Certificat de nationalité",
      "Diplôme requis (copie légalisée)",
      "Casier judiciaire bulletin n°3",
      "Certificat médical d'aptitude",
      "CV détaillé",
      "4 photos d'identité"
    ]),
    centres: JSON.stringify([
      "Abidjan — Ministère Fonction Publique (Plateau)",
      "Abidjan — CNFP Yopougon",
      "Bouaké — Direction Régionale",
      "Man — Direction Régionale"
    ])
  },
  {
    titre: "Concours d'entrée à l'INFAS (Institut National de Formation des Agents de Santé)",
    organisme: "Ministère de la Santé et de l'Hygiène Publique",
    categorie: "Santé",
    statut: "ouvert",
    niveau: "BAC",
    places: 300,
    frais: 4000,
    ouverture: "01/03/2026",
    cloture: "15/05/2026",
    premium: false,
    couleur: "#D9000D",
    conditions: "Être de nationalité ivoirienne\nAvoir entre 17 et 30 ans\nTitulaire du BAC série D ou C",
    pieces: JSON.stringify([
      "Acte de naissance",
      "Attestation de nationalité",
      "Copie du Baccalauréat",
      "Casier judiciaire vierge",
      "Visite médicale complète",
      "4 photos d'identité"
    ]),
    centres: JSON.stringify([
      "Abidjan — INFAS Adjamé",
      "Bouaké — INFAS Bouaké",
      "Daloa — Centre annexe"
    ])
  },
  {
    titre: "Concours d'entrée à l'INSFS — Formation Travail Social",
    organisme: "Institut National Supérieur de Formation Sociale (INSFS)",
    categorie: "Travail Social",
    statut: "résultats",
    niveau: "BAC",
    places: 200,
    frais: 5000,
    ouverture: "15/09/2025",
    cloture: "30/11/2025",
    premium: false,
    couleur: "#F5820D",
    conditions: "Être de nationalité ivoirienne\nAvoir le Baccalauréat toutes séries",
    pieces: JSON.stringify([
      "Acte de naissance",
      "Copie du BAC",
      "Casier judiciaire",
      "Certificat médical"
    ]),
    centres: JSON.stringify(["Abidjan — INSFS Cocody"])
  },
];

for (const c of concours) {
  await query(`
    INSERT INTO concours (titre, organisme, categorie, statut, niveau, places, frais,
      ouverture, cloture, premium, couleur, conditions, pieces, centres)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT DO NOTHING`,
    [c.titre, c.organisme, c.categorie, c.statut, c.niveau, c.places, c.frais,
     c.ouverture, c.cloture, c.premium, c.couleur, c.conditions, c.pieces, c.centres]
  );
}
console.log(`  ✅ ${concours.length} concours créés`);

// ── 3. PDFs de démonstration ─────────────────────────────
console.log("\n📄 Création des PDFs...");

const pdfs = [
  { titre: "Annales BAC 2024 — Toutes séries", categorie: "BAC", premium: false, pages: 120, taille: "8.2 MB", url: "https://example.com/bac-2024.pdf", telechargements: 1247 },
  { titre: "Sujets corrigés BEPC 2023-2024", categorie: "BEPC", premium: false, pages: 85, taille: "5.6 MB", url: "https://example.com/bepc-2024.pdf", telechargements: 832 },
  { titre: "Cours complet de Culture Générale — Concours CI", categorie: "Fonction Publique", premium: true, pages: 210, taille: "12.4 MB", url: "https://example.com/culture-gen.pdf", telechargements: 543 },
  { titre: "Fiches de révision Logique et Raisonnement", categorie: "Concours", premium: false, pages: 45, taille: "3.1 MB", url: "https://example.com/logique.pdf", telechargements: 2103 },
  { titre: "Manuel de Travail Social — Méthodes et Pratiques CI", categorie: "Travail Social", premium: true, pages: 180, taille: "9.8 MB", url: "https://example.com/ts-manuel.pdf", telechargements: 412 },
  { titre: "Droit Administratif Ivoirien — Cours et Exercices", categorie: "Fonction Publique", premium: true, pages: 156, taille: "7.3 MB", url: "https://example.com/droit-admin.pdf", telechargements: 289 },
  { titre: "Annales Concours Police 2022-2024", categorie: "Police", premium: true, pages: 95, taille: "6.2 MB", url: "https://example.com/police-annales.pdf", telechargements: 671 },
  { titre: "Guide de Préparation INFAS — Sciences de la Santé", categorie: "INFAS", premium: false, pages: 68, taille: "4.5 MB", url: "https://example.com/infas-guide.pdf", telechargements: 934 },
];

for (const p of pdfs) {
  await query(`
    INSERT INTO pdfs (titre, categorie, premium, pages, taille, url, telechargements)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT DO NOTHING`,
    [p.titre, p.categorie, p.premium, p.pages, p.taille, p.url, p.telechargements]
  );
}
console.log(`  ✅ ${pdfs.length} PDFs créés`);

// ── 4. Vidéos YouTube de démonstration ──────────────────
console.log("\n🎬 Création des vidéos...");

const videos = [
  { titre: "50 questions de culture générale pour concours de la fonction publique", categorie: "Culture Générale", ytId: "fQPCCVxJz4E", duree: "", premium: false, vues: 3421 },
  { titre: "CV et lettre de motivation : les conseils d'un recruteur", categorie: "CV & Emploi", ytId: "XgNbAPyLb8U", duree: "", premium: false, vues: 2107 },
  { titre: "Comment rédiger une lettre de motivation qui captive les recruteurs", categorie: "CV & Emploi", ytId: "8TbfmbLJrDw", duree: "", premium: false, vues: 1589 },
  { titre: "Réussir l'oral de son concours : 40 questions pour s'entraîner (catégories A, B, C)", categorie: "Entretien Oral", ytId: "bk-oXiC1CRM", duree: "", premium: true, vues: 876 },
  { titre: "Oral de concours fonction publique : 7 secrets pour le réussir", categorie: "Entretien Oral", ytId: "vwrHXelwxp4", duree: "", premium: true, vues: 654 },
  { titre: "Présentez-vous à l'oral : les 7 erreurs fatales à éviter", categorie: "Entretien Oral", ytId: "BffD0I3aBAE", duree: "", premium: false, vues: 2341 },
];

for (const v of videos) {
  const ytId = v.ytId;
  await query(`
    INSERT INTO videos (titre, categorie, url, youtube_id, miniature, duree, premium, vues)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT DO NOTHING`,
    [v.titre, v.categorie, `https://www.youtube.com/watch?v=${ytId}`, ytId,
     `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
     v.duree, v.premium, v.vues]
  );
}
console.log(`  ✅ ${videos.length} vidéos créées`);

// ── 5. QCM de démonstration ──────────────────────────────
console.log("\n📝 Création des QCM...");

const qcmData = [
  {
    titre: "Culture Générale — Côte d'Ivoire",
    matiere: "Culture Générale",
    difficulte: "Facile",
    premium: false,
    statut: "publié",
    questions: [
      { question: "Quelle est la capitale politique de la Côte d'Ivoire ?", options: ["Abidjan","Yamoussoukro","Bouaké","Daloa"], correct: 1, explication: "Yamoussoukro est la capitale politique officielle depuis 1983, bien qu'Abidjan reste la capitale économique." },
      { question: "En quelle année la Côte d'Ivoire a-t-elle proclamé son indépendance ?", options: ["1958","1960","1962","1964"], correct: 1, explication: "La Côte d'Ivoire a accédé à l'indépendance le 7 août 1960 sous Félix Houphouët-Boigny." },
      { question: "Quel est le fleuve le plus long de Côte d'Ivoire ?", options: ["Bandama","Sassandra","Comoé","Cavally"], correct: 2, explication: "La Comoé est le plus long fleuve avec ~1 160 km, prenant sa source au Burkina Faso." },
      { question: "Combien de régions compte la Côte d'Ivoire depuis 2011 ?", options: ["14","19","31","33"], correct: 3, explication: "33 régions réparties en 14 districts depuis la réforme administrative de 2011." },
      { question: "Quelle est la monnaie de la Côte d'Ivoire ?", options: ["Cedi","Naira","Franc CFA","Dalasi"], correct: 2, explication: "La Côte d'Ivoire utilise le Franc CFA (XOF) dans le cadre de l'UEMOA." },
    ]
  },
  {
    titre: "Logique — Séries Numériques",
    matiere: "Logique",
    difficulte: "Moyen",
    premium: false,
    statut: "publié",
    questions: [
      { question: "Complète : 3, 7, 13, 21, 31, ?", options: ["41","43","45","47"], correct: 1, explication: "Les différences sont +4, +6, +8, +10, +12. Donc 31+12=43." },
      { question: "Si ABCD = 1234, alors DCBA = ?", options: ["4321","3214","2143","1234"], correct: 0, explication: "On inverse simplement l'ordre des lettres donc des chiffres : DCBA = 4321." },
      { question: "Un robinet remplit un réservoir en 6h, un autre en 4h. Ensemble, en combien de temps ?", options: ["2h","2h24","3h","5h"], correct: 1, explication: "Débit combiné = 1/6+1/4 = 5/12. Temps = 12/5 = 2h24min." },
      { question: "Quelle figure complète : ○ △ □ ○ △ ?", options: ["○","△","□","◇"], correct: 2, explication: "La séquence ○ △ □ se répète. Après ○ △, vient □." },
      { question: "Si tous les A sont B et aucun B n'est C, alors :", options: ["Aucun A n'est C","Tous les C sont A","Certains A sont C","Tous les A sont C"], correct: 0, explication: "Si A⊂B et B∩C=∅, alors A∩C=∅ : aucun A n'est C." },
    ]
  },
  {
    titre: "Travail Social — Pratiques Professionnelles",
    matiere: "Travail Social",
    difficulte: "Moyen",
    premium: false,
    statut: "publié",
    questions: [
      { question: "Que signifie A.V.E.C. en travail social ?", options: ["Accueil, Validation, Écoute, Contrat","Analyse, Visite, Évaluation, Conseil","Accueil, Visite, Évaluation, Contrat","Analyse, Validation, Écoute, Conseil"], correct: 0, explication: "A.V.E.C. : Accueil, Validation, Écoute, Contrat — méthode d'accompagnement social." },
      { question: "Le travail social repose principalement sur quel principe éthique ?", options: ["L'autorité","L'autodétermination","La dépendance","La surveillance"], correct: 1, explication: "L'autodétermination : le bénéficiaire a le droit de prendre ses propres décisions." },
      { question: "Quelle institution forme les Assistants Sociaux en Côte d'Ivoire ?", options: ["UFHB","CAFOP","INSFS","ENS"], correct: 2, explication: "L'INSFS (Institut National Supérieur de Formation Sociale) forme les travailleurs sociaux CI." },
      { question: "Le diagnostic social participatif implique :", options: ["Seul l'expert analyse","La communauté participe à l'analyse","Le médecin diagnostique","L'administration décide"], correct: 1, explication: "Le diagnostic social participatif implique activement la communauté dans l'identification de ses besoins." },
      { question: "Quel est le rôle principal d'un Assistant Social en Côte d'Ivoire ?", options: ["Distribuer des aides financières","Accompagner et orienter les personnes en difficulté","Gérer les hôpitaux","Enseigner dans les écoles"], correct: 1, explication: "L'AS accompagne, oriente et aide les personnes ou familles en difficulté sociale à retrouver leur autonomie." },
    ]
  },
  {
    titre: "Mathématiques — Calcul et Proportionnalité",
    matiere: "Mathématiques",
    difficulte: "Facile",
    premium: false,
    statut: "publié",
    questions: [
      { question: "25% de 80 000 FCFA = ?", options: ["15 000 F","20 000 F","25 000 F","30 000 F"], correct: 1, explication: "25% × 80 000 = 0.25 × 80 000 = 20 000 FCFA." },
      { question: "Si 5 ouvriers font un travail en 12 jours, combien de jours pour 3 ouvriers ?", options: ["15","18","20","24"], correct: 2, explication: "Travail = 5×12 = 60 jours-ouvrier. Pour 3 ouvriers : 60÷3 = 20 jours." },
      { question: "Résoudre 3x - 9 = 0 → x = ?", options: ["2","3","4","6"], correct: 1, explication: "3x = 9 → x = 3." },
      { question: "Un article coûte 12 500 F après réduction de 20%. Quel était le prix initial ?", options: ["14 500 F","15 000 F","15 625 F","16 000 F"], correct: 2, explication: "Prix initial × 0,80 = 12 500 → Prix initial = 12 500 ÷ 0,80 = 15 625 FCFA." },
      { question: "PGCD(60, 84) = ?", options: ["6","10","12","14"], correct: 2, explication: "60 = 2²×3×5 et 84 = 2²×3×7. PGCD = 2²×3 = 12." },
    ]
  },
  {
    titre: "Culture Générale Avancée — Institutions CI",
    matiere: "Culture Générale",
    difficulte: "Difficile",
    premium: true,
    statut: "publié",
    questions: [
      { question: "Quelle loi régit le Statut Général de la Fonction Publique CI ?", options: ["Loi n°92-570 du 11/09/1992","Loi n°95-696 du 07/09/1995","Décret n°2020-01 du 05/01/2020","Loi n°60-315 du 21/09/1960"], correct: 0, explication: "La Loi n°92-570 du 11 septembre 1992 régit le Statut Général de la Fonction Publique de CI." },
      { question: "Combien de pays membres compte l'UEMOA ?", options: ["6","7","8","9"], correct: 2, explication: "L'UEMOA compte 8 membres : Bénin, Burkina Faso, CI, Guinée-Bissau, Mali, Niger, Sénégal, Togo." },
      { question: "Quelle année a été créée l'UEMOA ?", options: ["1990","1993","1994","1996"], correct: 2, explication: "L'UEMOA a été créée par le Traité de Dakar le 10 janvier 1994." },
      { question: "La superficie de la Côte d'Ivoire est d'environ :", options: ["212 000 km²","322 463 km²","403 000 km²","512 000 km²"], correct: 1, explication: "La Côte d'Ivoire couvre exactement 322 463 km²." },
      { question: "Quel est le PIB nominal approximatif de la CI en 2024 ?", options: ["25 milliards USD","45 milliards USD","75 milliards USD","120 milliards USD"], correct: 2, explication: "Le PIB nominal CI était d'environ 75 milliards USD en 2024, faisant d'elle la 1ère économie UEMOA." },
    ]
  },
];

for (const q of qcmData) {
  await query(`
    INSERT INTO qcm (titre, matiere, difficulte, premium, statut, questions_json)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT DO NOTHING`,
    [q.titre, q.matiere, q.difficulte, q.premium, q.statut, JSON.stringify(q.questions)]
  );
}
console.log(`  ✅ ${qcmData.length} QCM créés (${qcmData.reduce((s,q)=>s+q.questions.length,0)} questions au total)`);

// ── 6. Transaction de démonstration ─────────────────────
console.log("\n💳 Création d'une transaction de démonstration...");
const userResult = await query("SELECT id FROM users WHERE email = 'aminata@test.ci'");
if (userResult.rows.length > 0) {
  const userId = userResult.rows[0].id;
  await query(`
    INSERT INTO transactions (tx_id, user_id, email, moyen, plan, montant, statut)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT DO NOTHING`,
    ["WA-DEMO123456", userId, "aminata@test.ci", "Wave CI", "3 Mois", 5000, "validé"]
  );
  console.log("  ✅ Transaction de démonstration créée");
}

// ── Résumé final ─────────────────────────────────────────
console.log("\n════════════════════════════════════════");
console.log("🎉 SEED TERMINÉ AVEC SUCCÈS !");
console.log("════════════════════════════════════════");
console.log("");
console.log("📋 Comptes de test créés :");
console.log("   Gratuit  : koffi@test.ci     / Test1234!");
console.log("   Premium  : aminata@test.ci   / Test1234!");
console.log("   Admin    : (voir ADMIN_EMAIL dans .env)");
console.log("");
console.log("🚀 Lance le serveur : npm start");
console.log("🌐 Frontend       : ouvre index.html dans un navigateur");

} catch (err) {
console.error("\n❌ Erreur lors du seed :", err.message);
console.error(err.stack);
process.exit(1);
}

process.exit(0);
}

seed();