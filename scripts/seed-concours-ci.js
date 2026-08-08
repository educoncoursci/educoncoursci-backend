// ============================================================
//  scripts/seed-concours-ci.js
//  Bibliothèque de départ des grandes institutions organisatrices
//  de concours en Côte d'Ivoire (Lot 18). À exécuter une fois :
//    npm run concours:seed
//
//  Objectif : que les pages "En cours / À venir / Terminés" aient
//  du contenu réel dès le départ, avant même que le scraper
//  automatique (services/concoursFeed.js) ait détecté quoi que ce
//  soit — et avant même qu'un admin n'ait validé la moindre
//  suggestion depuis la file d'attente.
//
//  Architecture Lot 18 : chaque fiche est créée avec de vraies
//  dates (dateOuverture/dateCloture) et statutAuto=true — le
//  statut initial est donc calculé correctement dès la création
//  (Concours.create), puis maintenu à jour au fil du temps par
//  services/concoursStatutScheduler.js (cron quotidien). Un admin
//  qui a besoin de figer un statut peut décocher "Statut auto"
//  depuis /admin/concours.
//
//  ⚠️ Les dates ci-dessous sont des exemples plausibles construits
//  à partir du calendrier habituel de chaque concours (beaucoup se
//  tiennent chaque année sur des périodes similaires), PAS des
//  dates officiellement confirmées pour l'édition en cours. Un
//  admin doit vérifier/ajuster chaque fiche via /admin/concours
//  dès que le communiqué officiel de l'année est publié.
//
//  Rejouable sans risque : la contrainte d'unicité SQL sur
//  (titre, organisme) — concours_titre_organisme_uniq — empêche
//  tout doublon ; les conflits sont simplement ignorés et comptés.
// ============================================================

require("dotenv").config();
const { initDatabase, pool } = require("../config/database");
const Concours = require("../models/Concours");

const AN = new Date().getFullYear();

const INSTITUTIONS = [
  {
    titre: "Concours ENA — Cycle Moyen",
    organisme: "École Nationale d'Administration (ENA)",
    categorie: "Administration",
    niveau: "BAC",
    ageMin: 18, ageMax: 30,
    frais: 5000,
    dateOuverture: `${AN}-02-10`, dateCloture: `${AN}-04-15`,
    conditions: "Être de nationalité ivoirienne. Titulaire du Baccalauréat toutes séries. Limite d'âge : 30 ans.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Copie légalisée du BAC", "Casier judiciaire", "Certificat médical", "4 photos d'identité"],
    centres: ["Abidjan — ENA Cocody"],
    couleur: "#7B2FBE",
  },
  {
    titre: "Concours ENA — Cycle Moyen Supérieur",
    organisme: "École Nationale d'Administration (ENA)",
    categorie: "Administration",
    niveau: "BAC+2",
    ageMin: 18, ageMax: 35,
    frais: 5000,
    dateOuverture: `${AN}-02-10`, dateCloture: `${AN}-04-15`,
    conditions: "Titulaire d'un diplôme de niveau BTS, DUT ou Licence. Nationalité ivoirienne.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme légalisé", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — ENA Cocody"],
    couleur: "#7B2FBE",
  },
  {
    titre: "Concours CAFOP IA (Instituteurs Adjoints)",
    organisme: "Centre d'Animation et de Formation Pédagogique (CAFOP)",
    categorie: "Enseignement",
    niveau: "BEPC",
    ageMin: 18, ageMax: 30,
    frais: 3000,
    dateOuverture: `${AN}-01-15`, dateCloture: `${AN}-03-10`,
    conditions: "Titulaire du BEPC. Nationalité ivoirienne. Aptitude physique requise.",
    pieces: ["Extrait de naissance", "Copie du BEPC", "Casier judiciaire", "Certificat médical", "4 photos"],
    centres: ["Abidjan", "Bouaké", "Daloa", "Korhogo", "Man", "Yamoussoukro"],
    couleur: "#1A6B3C",
  },
  {
    titre: "Concours INFAS — Auxiliaires de Santé",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BEPC",
    ageMin: 17, ageMax: 30,
    frais: 4000,
    dateOuverture: `${AN}-03-01`, dateCloture: `${AN}-05-15`,
    conditions: "Titulaire du BEPC minimum. Visite médicale complète obligatoire.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie BEPC ou BAC", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — INFAS Adjamé", "Bouaké — INFAS Bouaké"],
    couleur: "#D9000D",
  },
  {
    titre: "Concours INSFS — Éducateur Préscolaire",
    organisme: "Institut National Supérieur de Formation Sociale (INSFS)",
    categorie: "Santé & Social",
    niveau: "BAC",
    ageMin: 18, ageMax: 35,
    frais: 5000,
    dateOuverture: `${AN}-04-01`, dateCloture: `${AN}-06-15`,
    conditions: "Titulaire du Baccalauréat toutes séries. Nationalité ivoirienne.",
    pieces: ["Acte de naissance", "Copie du BAC", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — INSFS Cocody"],
    couleur: "#F5820D",
  },
  {
    titre: "Concours INSFS — Assistant Social Adjoint",
    organisme: "Institut National Supérieur de Formation Sociale (INSFS)",
    categorie: "Santé & Social",
    niveau: "BAC",
    ageMin: 18, ageMax: 35,
    frais: 5000,
    dateOuverture: `${AN}-01-15`, dateCloture: `${AN}-03-31`,
    conditions: "Être de nationalité ivoirienne. Avoir moins de 35 ans. Titulaire du Baccalauréat.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Copie du BAC", "Casier judiciaire", "Certificat médical", "4 photos", "CV"],
    centres: ["Abidjan — INSFS Cocody", "Bouaké", "Korhogo", "San-Pédro"],
    couleur: "#1A6B3C",
  },
  {
    titre: "Concours INJS — Jeunesse et Sports",
    organisme: "Institut National de la Jeunesse et des Sports (INJS)",
    categorie: "Fonction publique",
    niveau: "BAC",
    ageMin: 18, ageMax: 30,
    frais: 3000,
    dateOuverture: `${AN}-02-20`, dateCloture: `${AN}-04-30`,
    conditions: "Titulaire du Baccalauréat. Bonne condition physique (épreuves sportives).",
    pieces: ["Acte de naissance", "Copie du BAC", "Certificat médical d'aptitude sportive", "Casier judiciaire"],
    centres: ["Abidjan — INJS Yopougon"],
    couleur: "#0A6EBD",
  },
  {
    titre: "Concours ENS — Professeur de Collège",
    organisme: "École Normale Supérieure (ENS)",
    categorie: "Enseignement",
    niveau: "Licence",
    ageMin: 18, ageMax: 35,
    frais: 3000,
    dateOuverture: `${AN}-02-12`, dateCloture: `${AN}-04-01`,
    conditions: "Titulaire d'une Licence dans la discipline concernée.",
    pieces: ["Acte de naissance", "Diplôme légalisé", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — ENS Cocody"],
    couleur: "#1A6B3C",
  },
  {
    titre: "Concours ENS — Éducateur",
    organisme: "École Normale Supérieure (ENS)",
    categorie: "Enseignement",
    niveau: "BAC",
    ageMin: 18, ageMax: 30,
    frais: 3000,
    dateOuverture: `${AN}-02-12`, dateCloture: `${AN}-04-01`,
    conditions: "Titulaire du Baccalauréat toutes séries.",
    pieces: ["Acte de naissance", "Copie du BAC", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — ENS Cocody"],
    couleur: "#1A6B3C",
  },
  {
    titre: "Concours Police Nationale — Sous-officier",
    organisme: "Police Nationale de Côte d'Ivoire",
    categorie: "Sécurité & Défense",
    niveau: "BEPC",
    ageMin: 18, ageMax: 25,
    frais: 3000,
    dateOuverture: `${AN}-01-20`, dateCloture: `${AN}-03-20`,
    conditions: "Nationalité ivoirienne. Taille minimale 1m70 (H) / 1m65 (F). Aptitude physique.",
    pieces: ["Acte de naissance", "Nationalité ivoirienne", "Copie du BEPC", "Casier judiciaire vierge", "Certificat médical", "Certificat de résidence"],
    centres: ["Abidjan — ENP Cocody", "Bouaké", "Daloa"],
    couleur: "#0A6EBD",
  },
  {
    titre: "Concours Gendarmerie Nationale",
    organisme: "Gendarmerie Nationale de Côte d'Ivoire",
    categorie: "Sécurité & Défense",
    niveau: "BEPC",
    ageMin: 18, ageMax: 25,
    frais: 3000,
    dateOuverture: `${AN}-01-25`, dateCloture: `${AN}-03-25`,
    conditions: "Nationalité ivoirienne. Aptitude physique. Casier judiciaire vierge.",
    pieces: ["Acte de naissance", "Copie du BEPC", "Casier judiciaire vierge", "Certificat médical"],
    centres: ["Abidjan — École de Gendarmerie", "Bouaké"],
    couleur: "#0A6EBD",
  },
  {
    titre: "Concours Agent des Douanes",
    organisme: "Direction Générale des Douanes de Côte d'Ivoire",
    categorie: "Sécurité & Défense",
    niveau: "BEPC",
    ageMin: 18, ageMax: 28,
    frais: 5000,
    dateOuverture: `${AN}-03-05`, dateCloture: `${AN}-05-05`,
    conditions: "Nationalité ivoirienne. Aptitude physique requise.",
    pieces: ["Acte de naissance", "Copie du BEPC ou BAC", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — Direction Générale des Douanes"],
    couleur: "#0A6EBD",
  },
  {
    titre: "Concours Agent des Eaux et Forêts",
    organisme: "Direction Générale des Eaux et Forêts",
    categorie: "Fonction publique",
    niveau: "BEPC",
    ageMin: 18, ageMax: 28,
    frais: 3000,
    dateOuverture: `${AN}-02-01`, dateCloture: `${AN}-04-01`,
    conditions: "Nationalité ivoirienne. Aptitude physique (missions de terrain).",
    pieces: ["Acte de naissance", "Copie du diplôme requis", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — Direction Centrale Eaux et Forêts"],
    couleur: "#1A6B3C",
  },
  {
    titre: "Concours Fonction Publique — Catégorie B",
    organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    categorie: "Fonction publique",
    niveau: "BAC+2",
    ageMin: 18, ageMax: 40,
    frais: 6000,
    dateOuverture: `${AN}-04-15`, dateCloture: `${AN}-06-30`,
    conditions: "Diplôme de niveau BAC+2 minimum. N'avoir jamais été révoqué de la Fonction Publique.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme requis légalisé", "Casier judiciaire bulletin n°3", "Certificat médical", "CV détaillé"],
    centres: ["Abidjan — Ministère Fonction Publique (Plateau)", "Bouaké", "Man"],
    couleur: "#7B2FBE",
    premium: true,
  },
  {
    titre: "Concours Fonction Publique — Catégorie C",
    organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    categorie: "Fonction publique",
    niveau: "BEPC",
    ageMin: 18, ageMax: 40,
    frais: 5000,
    dateOuverture: `${AN}-04-15`, dateCloture: `${AN}-06-30`,
    conditions: "Titulaire du BEPC minimum. N'avoir jamais été révoqué de la Fonction Publique.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme requis", "Casier judiciaire", "Certificat médical", "CV"],
    centres: ["Abidjan — Ministère Fonction Publique (Plateau)"],
    couleur: "#7B2FBE",
  },
  {
    titre: "Recrutement Militaire des Forces Armées (FACI)",
    organisme: "Forces Armées de Côte d'Ivoire (FACI)",
    categorie: "Sécurité & Défense",
    niveau: "BEPC",
    ageMin: 18, ageMax: 25,
    frais: 0,
    dateOuverture: `${AN}-01-10`, dateCloture: `${AN}-02-28`,
    conditions: "Nationalité ivoirienne. Excellente condition physique. Casier judiciaire vierge.",
    pieces: ["Acte de naissance", "Copie du BEPC", "Casier judiciaire vierge", "Certificat médical d'aptitude"],
    centres: ["Abidjan — Camp militaire", "Bouaké — Camp militaire", "Korhogo"],
    couleur: "#0A6EBD",
  },
  {
    titre: "Concours IPNETP — Professeur d'Enseignement Technique",
    organisme: "Institut Pédagogique National de l'Enseignement Technique et Professionnel (IPNETP)",
    categorie: "Enseignement",
    niveau: "BAC+2",
    ageMin: 18, ageMax: 35,
    frais: 3000,
    dateOuverture: `${AN}-03-10`, dateCloture: `${AN}-05-10`,
    conditions: "Diplôme technique de niveau BTS ou Licence selon la spécialité.",
    pieces: ["Acte de naissance", "Diplôme légalisé", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — IPNETP Cocody"],
    couleur: "#1A6B3C",
  },
  {
    titre: "Concours ENSTP — Techniciens des Travaux Publics",
    organisme: "École Nationale Supérieure des Travaux Publics (ENSTP)",
    categorie: "Administration",
    niveau: "BAC",
    ageMin: 18, ageMax: 28,
    frais: 4000,
    dateOuverture: `${AN}-03-15`, dateCloture: `${AN}-05-15`,
    conditions: "Titulaire du Baccalauréat série scientifique ou technique.",
    pieces: ["Acte de naissance", "Copie du BAC", "Casier judiciaire", "Certificat médical"],
    centres: ["Yamoussoukro — ENSTP"],
    couleur: "#7B2FBE",
  },
  {
    titre: "Concours INFJ — Garde Pénitentiaire",
    organisme: "Institut National de Formation Judiciaire (INFJ)",
    categorie: "Sécurité & Défense",
    niveau: "BEPC",
    ageMin: 18, ageMax: 28,
    frais: 5000,
    dateOuverture: `${AN}-02-05`, dateCloture: `${AN}-04-05`,
    conditions: "Titulaire du BEPC. Aptitude physique requise.",
    pieces: ["Acte de naissance", "Copie du BEPC", "Casier judiciaire vierge", "Certificat médical"],
    centres: ["Abidjan — INFJ"],
    couleur: "#0A6EBD",
  },
  {
    titre: "Concours INFJ — Secrétaire des Greffes et Parquets",
    organisme: "Institut National de Formation Judiciaire (INFJ)",
    categorie: "Administration",
    niveau: "BAC",
    ageMin: 18, ageMax: 30,
    frais: 5000,
    dateOuverture: `${AN}-02-05`, dateCloture: `${AN}-04-05`,
    conditions: "Titulaire du Baccalauréat toutes séries.",
    pieces: ["Acte de naissance", "Copie du BAC", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — INFJ"],
    couleur: "#7B2FBE",
  },
  {
    titre: "Concours de la Magistrature",
    organisme: "Institut National de Formation Judiciaire (INFJ)",
    categorie: "Administration",
    niveau: "Licence",
    ageMin: 21, ageMax: 35,
    frais: 5000,
    dateOuverture: `${AN}-01-10`, dateCloture: `${AN}-02-28`,
    conditions: "Titulaire d'un Master en Droit. Nationalité ivoirienne. Bonne moralité.",
    pieces: ["Acte de naissance", "Diplôme de Master en Droit légalisé", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — INFJ"],
    couleur: "#F5820D",
  },
  {
    titre: "Test d'entrée INP-HB — Grandes Écoles d'Ingénieurs",
    organisme: "Institut National Polytechnique Félix Houphouët-Boigny (INP-HB)",
    categorie: "Administration",
    niveau: "BAC",
    ageMin: 17, ageMax: 22,
    frais: 20000,
    dateOuverture: `${AN}-07-01`, dateCloture: `${AN}-08-20`,
    conditions: "Titulaire du Baccalauréat série C, D, E ou technique. Dossier scolaire compétitif.",
    pieces: ["Acte de naissance", "Copie du BAC", "Bulletins scolaires", "4 photos"],
    centres: ["Yamoussoukro — INP-HB"],
    couleur: "#7B2FBE",
    premium: true,
  },
];

(async () => {
  try {
    await initDatabase();
    console.log(`🎓 Chargement de la bibliothèque de concours de Côte d'Ivoire (${INSTITUTIONS.length} fiches)...\n`);

    let creees = 0;
    let ignorees = 0;

    for (const c of INSTITUTIONS) {
      try {
        await Concours.create({
          titre: c.titre,
          organisme: c.organisme,
          categorie: c.categorie,
          niveau: c.niveau,
          ageMin: c.ageMin,
          ageMax: c.ageMax,
          frais: c.frais,
          premium: c.premium || false,
          couleur: c.couleur,
          conditions: c.conditions,
          pieces: c.pieces,
          centres: c.centres,
          dateOuverture: c.dateOuverture,
          dateCloture: c.dateCloture,
          statutAuto: true,
          // Dates plausibles construites à partir du calendrier habituel
          // de chaque concours, pas confirmées contre un communiqué
          // officiel de l'année en cours — marquées "à vérifier" pour que
          // l'admin les voie clairement dans /admin/concours.
          dateVerifiee: false,
        });
        creees++;
        console.log(`  ✅ ${c.titre}`);
      } catch (err) {
        // Conflit sur (titre, organisme) = déjà présent, on ignore
        // silencieusement ; toute autre erreur est affichée pour
        // pouvoir être corrigée.
        if (err.message && err.message.includes("concours_titre_organisme_uniq")) {
          ignorees++;
          console.log(`  ↷ ${c.titre} (déjà présent, ignoré)`);
        } else {
          console.error(`  ❌ ${c.titre} — ${err.message}`);
        }
      }
    }

    console.log(`\n✅ Terminé : ${creees} nouvelle(s) fiche(s) créée(s), ${ignorees} déjà présente(s) sur ${INSTITUTIONS.length}.`);
    console.log("ℹ️  Pense à vérifier/ajuster les dates de chaque fiche via /admin/concours dès que le communiqué officiel de l'année est publié.");
  } catch (err) {
    console.error("❌ Erreur lors du chargement de la bibliothèque :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
