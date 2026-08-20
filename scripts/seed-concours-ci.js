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

// Note : toutes les fiches ci-dessous utilisent désormais des dates
// vérifiées en dur (issues de sources officielles réelles) plutôt
// qu'un calcul dynamique sur l'année courante — voir le commentaire
// de chaque fiche pour sa source. Les quelques fiches sans date
// confirmée (Police, Douanes, IPNETP, INJS) ont volontairement
// dateOuverture/dateCloture à null plutôt qu'une date inventée.

const INSTITUTIONS = [
  {
    titre: "Concours ENA — Cycle Moyen (BAC/BT)",
    organisme: "École Nationale d'Administration (ENA)",
    categorie: "Administration",
    niveau: "BAC ou BT",
    ageMin: 18, ageMax: 43,
    frais: 27500,
    // Session "2027" (le concours porte le nom de l'année de sortie,
    // pas d'ouverture) confirmée par communiqué officiel du 23/03/2026
    // de la Ministre de la Fonction Publique (source : allAfrica).
    // Inscriptions en ligne 16/03-30/04/2026, prise de vue jusqu'au
    // 6/05/2026. Concours terminé pour cette session au 08/08/2026.
    // Frais : 10 000 FCFA droit de candidature + 17 500 FCFA frais
    // annexes = 27 500 FCFA. Plateforme unifiée : fonctionpublique.gouv.ci
    // et ena.ci.
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Nationalité ivoirienne. Âgé de 18 à 43 ans au 31 décembre 2025. Titulaire du Baccalauréat ou d'un BT reconnu par le ministère de l'Éducation Nationale.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Copie légalisée du BAC ou BT", "Casier judiciaire", "Certificat médical", "4 photos d'identité"],
    centres: ["Abidjan — ENA Cocody"],
    couleur: "#7B2FBE",
    lienOfficiel: "https://www.fonctionpublique.gouv.ci/",
    dateVerifiee: true,
  },
  {
    titre: "Concours ENA — Cycle Supérieur (diplôme second cycle sup.)",
    organisme: "École Nationale d'Administration (ENA)",
    categorie: "Administration",
    niveau: "Diplôme de fin d'études du 2nd cycle de l'enseignement supérieur",
    ageMin: 18, ageMax: 43,
    frais: 27500,
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Nationalité ivoirienne. Âgé de 18 à 43 ans au 31 décembre 2025. Titulaire d'un diplôme de fin d'études du second cycle de l'enseignement supérieur, reconnu par le ministère en charge de l'Enseignement Supérieur (ou diplôme étranger avec attestation d'équivalence).",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme légalisé (+ attestation d'équivalence si obtenu à l'étranger)", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — ENA Cocody"],
    couleur: "#7B2FBE",
    lienOfficiel: "https://www.fonctionpublique.gouv.ci/",
    dateVerifiee: true,
  },
  {
    titre: "Concours ENA — Cycle Moyen Supérieur (Licence/BTS/DUT)",
    organisme: "École Nationale d'Administration (ENA)",
    categorie: "Administration",
    niveau: "Licence, BTS ou DUT (toutes spécialités)",
    ageMin: 18, ageMax: 40,
    frais: 27500,
    // 3ᵉ cycle direct de l'ENA, manquant entre les deux fiches Cycle
    // Moyen / Cycle Supérieur déjà présentes — même session "entrée en
    // 2027" (16/03-30/04/2026), confirmé sur blog.ivoire-juriste.com
    // (22/03/2026) et ablanian.ci. Tranche d'âge distincte des deux
    // autres cycles : né(e) entre le 01/01/1986 et le 31/12/2007.
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Nationalité ivoirienne. Né(e) entre le 01/01/1986 et le 31/12/2007 (18 à 40 ans au 31 décembre 2025). Titulaire d'une Licence, d'un BTS ou d'un DUT (toutes spécialités), ou titre admis en équivalence.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme légalisé (+ attestation d'équivalence si obtenu à l'étranger)", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — ENA Cocody"],
    couleur: "#7B2FBE",
    lienOfficiel: "https://www.fonctionpublique.gouv.ci/",
    dateVerifiee: true,
  },
  {
    titre: "Concours CAFOP-IA (Instituteurs Adjoints)",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA)",
    categorie: "Enseignement",
    niveau: "BEPC",
    ageMin: 18, ageMax: 38,
    frais: 38000,
    // Session 2026 confirmée par plusieurs sources concordantes
    // (linfodrome.com, 7info.ci, men-deco.org, yessouan.ci) —
    // préinscription 8/10 déc. 2025, dépôt dossiers jusqu'au 11 mars
    // 2026, épreuves écrites le 11 avril 2026, résultats définitifs
    // le 19 juin 2026. Concours terminé pour cette session au
    // 08/08/2026. Frais : 10 000 FCFA inscription (Trésor public) +
    // 28 000 FCFA visite médicale (Orange/MTN/Wave Money).
    dateOuverture: "2025-12-08", dateCloture: "2026-03-11",
    conditions: "Nationalité ivoirienne. Âgé de 18 à 38 ans au 31 décembre 2025. Titulaire du BEPC. Aptitude médicale obligatoire (CMU non exigée pour ce concours).",
    pieces: ["Extrait d'acte de naissance original (- d'1 an)", "Photocopie de la pièce d'identité ou attestation d'identité valide", "Photocopie de l'attestation de réussite ou du diplôme de BEPC", "Reçu du droit d'inscription (10 000 FCFA, Trésor public)", "Certificat de visite médicale (28 000 FCFA)", "Enveloppe A4 préaffranchie Poste CI"],
    centres: ["Abidjan", "Bouaké", "Daloa", "Korhogo", "Man", "Yamoussoukro"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://cafop.ciconcours.com/",
    dateVerifiee: true,
  },
  {
    titre: "ACE — Adjoint au Chef d'Établissement",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA) — DECO",
    categorie: "Enseignement",
    niveau: "Réservé aux enseignants en fonction (voir arrêté d'ouverture)",
    frais: null,
    // Examen professionnel de promotion interne, PAS un concours ouvert
    // au grand public — réservé aux enseignants déjà en poste.
    // Résultats du 2e tour publiés le 16/05/2026 (men-deco.org/
    // actualite/actu-deco/resultats-second-tour-ace-adc). Dates
    // précises d'ouverture/clôture des inscriptions non retrouvées
    // avec certitude ⇒ statut fixé manuellement plutôt que deviné à
    // partir de dates incertaines (statutAuto: false).
    statut: "fermé", statutAuto: false,
    conditions: "Réservé aux personnels enseignants du Ministère de l'Éducation Nationale déjà en fonction. Voir l'arrêté d'ouverture du concours pour les conditions précises (ancienneté, corps d'origine...).",
    centres: ["Abidjan"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://www.men-deco.org/",
    dateVerifiee: true,
  },
  {
    titre: "ADC — Adjoint au Directeur de CAFOP",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA) — DECO",
    categorie: "Enseignement",
    niveau: "Réservé aux enseignants en fonction (voir arrêté d'ouverture)",
    frais: null,
    statut: "fermé", statutAuto: false,
    conditions: "Réservé aux personnels enseignants du Ministère de l'Éducation Nationale déjà en fonction. Voir l'arrêté d'ouverture du concours pour les conditions précises.",
    centres: ["Abidjan"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://www.men-deco.org/",
    dateVerifiee: true,
  },
  {
    titre: "CAP — Épreuves Écrites (Certificat d'Aptitude Pédagogique)",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA) — DECO",
    categorie: "Enseignement",
    niveau: "Réservé aux enseignants en fonction (voir arrêté d'ouverture)",
    frais: null,
    // Résultats confirmés disponibles le 07/05/2026 (communiqué DECO
    // "Résultats CAP et CEAP session 2026 disponibles").
    statut: "fermé", statutAuto: false,
    conditions: "Réservé aux personnels enseignants du Ministère de l'Éducation Nationale. Voir l'arrêté d'ouverture pour les conditions précises.",
    centres: ["Abidjan"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://epedago.men-deco.org/",
    dateVerifiee: true,
  },
  {
    titre: "CAP — Intégration Fonction Publique (CAP/FP)",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA) — DECO",
    categorie: "Enseignement",
    niveau: "Réservé aux titulaires du CAP",
    frais: null,
    // "Inscription fermée" confirmé sur epedago.men-deco.org (portail
    // officiel des examens et concours pédagogiques).
    statut: "fermé", statutAuto: false,
    conditions: "Réservé aux titulaires du CAP souhaitant une intégration dans la Fonction publique. Voir l'arrêté d'ouverture pour les conditions précises.",
    centres: ["Abidjan"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://epedago.men-deco.org/",
    dateVerifiee: true,
  },
  {
    titre: "CAP — Titularisation (Public) / Intégration (Privé)",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA) — DECO",
    categorie: "Enseignement",
    niveau: "Réservé aux titulaires du CAP",
    frais: null,
    // "Ouverture des préinscriptions" au moment de la vérification
    // (epedago.men-deco.org) — seul concours de ce bloc encore
    // potentiellement accessible ; date de clôture non retrouvée avec
    // certitude, donc statut fixé manuellement plutôt qu'un calcul
    // par date incertain. À reconfirmer périodiquement.
    statut: "information non confirmée", statutAuto: false,
    conditions: "Réservé aux titulaires du CAP (secteur public : titularisation ; secteur privé : intégration). Voir l'arrêté d'ouverture pour les conditions précises.",
    centres: ["Abidjan"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://epedago.men-deco.org/",
    dateVerifiee: true,
  },
  {
    titre: "CEAP — Épreuves Écrites (Certificat Élémentaire d'Aptitude Pédagogique)",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA) — DECO",
    categorie: "Enseignement",
    niveau: "Réservé aux enseignants en fonction (voir arrêté d'ouverture)",
    frais: null,
    // Résultats confirmés disponibles le 07/05/2026 (même communiqué
    // que le CAP ci-dessus).
    statut: "fermé", statutAuto: false,
    conditions: "Réservé aux personnels enseignants du Ministère de l'Éducation Nationale. Voir l'arrêté d'ouverture pour les conditions précises.",
    centres: ["Abidjan"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://epedago.men-deco.org/",
    dateVerifiee: true,
  },
  {
    titre: "CEAP — Titularisation (Public) / Intégration (Privé)",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA) — DECO",
    categorie: "Enseignement",
    niveau: "Réservé aux titulaires du CEAP",
    frais: null,
    // "Ouverture des préinscriptions" au moment de la vérification —
    // même remarque que CAP Titularisation ci-dessus.
    statut: "information non confirmée", statutAuto: false,
    conditions: "Réservé aux titulaires du CEAP (secteur public : titularisation ; secteur privé : intégration). Voir l'arrêté d'ouverture pour les conditions précises.",
    centres: ["Abidjan"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://epedago.men-deco.org/",
    dateVerifiee: true,
  },
  {
    titre: "CEAP — Titulaire du DIAS",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA) — DECO",
    categorie: "Enseignement",
    niveau: "Réservé aux titulaires du DIAS",
    frais: null,
    // "Inscription fermée" confirmé sur epedago.men-deco.org.
    statut: "fermé", statutAuto: false,
    conditions: "Réservé aux titulaires du Diplôme d'Instituteur Adjoint Stagiaire (DIAS). Voir l'arrêté d'ouverture pour les conditions précises.",
    centres: ["Abidjan"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://epedago.men-deco.org/",
    dateVerifiee: true,
  },
  {
    titre: "DIAS — Diplôme d'Instituteur Adjoint Stagiaire",
    organisme: "Ministère de l'Éducation Nationale et de l'Alphabétisation (MENA) — DECO",
    categorie: "Enseignement",
    niveau: "Réservé aux Instituteurs Adjoints Stagiaires",
    frais: null,
    // Résultats confirmés publiés le 24/07/2026 (communiqué DECO
    // "RÉSULTATS DU DIAS 2026").
    statut: "fermé", statutAuto: false,
    conditions: "Réservé aux Instituteurs Adjoints Stagiaires ayant achevé leur formation en CAFOP. Voir l'arrêté d'ouverture pour les conditions précises.",
    centres: ["Abidjan"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://www.men-deco.org/",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFAS — Auxiliaires de Santé (niveau BEPC)",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BEPC ou CAP Sanitaire agréé",
    ageMin: 18, ageMax: 35,
    frais: 40000,
    // Session 2026 confirmée par plusieurs sources concordantes
    // (infas.ciconcours.com, lelephantci.com 10/05 et 23/05/2026) —
    // un seul concours de niveau BEPC ouvert cette session. Frais :
    // 28 000 FCFA visite médicale + 12 000 FCFA inscription.
    // Convocations disponibles depuis le 8 août 2026 — la période de
    // préinscription proprement dite est donc déjà terminée.
    dateOuverture: "2026-05-22", dateCloture: "2026-06-22",
    conditions: "Titulaire du BEPC ou d'un CAP Sanitaire agréé par l'État. Aucune candidature sous réserve du BEPC autorisée.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BEPC ou CAP Sanitaire", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan — INFAS Adjamé", "Bouaké — INFAS Bouaké"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/",
    dateVerifiee: true, // Sources multiples concordantes (mai-août 2026), voir commentaire ci-dessus
  },
  {
    titre: "Concours INFAS — Infirmiers et Infirmières",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BAC (toutes séries) ou BT Sciences Médico-Sociales",
    ageMin: 18, ageMax: 32,
    frais: 40000, // 28 000 FCFA visite médicale + 12 000 FCFA concours
    // Vérifié directement sur infas.ciconcours.com/details/1 (fiche
    // officielle) le 18/08/2026 — remplace une ancienne entrée
    // générique "IDE, Sage-Femme, Technicien Supérieur" qui fusionnait
    // à tort 9 filières distinctes en une seule fiche, et dont la date
    // de clôture (22/06) ne correspondait plus à celle publiée par
    // l'INFAS pour cette session (29/06). Aujourd'hui (18/08/2026), la
    // période d'inscription est déjà passée — le concours est donc
    // "Terminé" (statut calculé automatiquement par les dates), pas
    // "en cours", même si convocations/compositions restent en cours
    // de traitement côté INFAS.
    dateOuverture: "2026-05-22", dateCloture: "2026-06-29",
    conditions: "Né(e) entre le 01/01/1994 et le 31/12/2008 (18 à 32 ans), nationalité ivoirienne. Titulaire du Bac (toutes séries : A, C, D, E, F, G1, G2, B) ou d'un BT Sciences Médico-Sociales, obtenu entre 2013 et 2025.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BAC ou BT Sciences Médico-Sociales", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan", "Bouaké", "Korhogo", "Daloa", "Abengourou", "Agboville", "Aboisso", "Man"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/details/1",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFAS — Sages-Femmes et Maïeuticiens",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BAC (toutes séries) ou BT Sciences Médico-Sociales",
    ageMin: 18, ageMax: 32,
    frais: 40000,
    dateOuverture: "2026-05-22", dateCloture: "2026-06-29",
    conditions: "Né(e) entre le 01/01/1994 et le 31/12/2008 (18 à 32 ans), nationalité ivoirienne. Titulaire du Bac (toutes séries : A, C, D, E, F, G1, G2, B) ou d'un BT Sciences Médico-Sociales, obtenu entre 2013 et 2025.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BAC ou BT Sciences Médico-Sociales", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan", "Bouaké", "Korhogo", "Daloa", "Abengourou", "Agboville", "Aboisso", "Man"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/details/1",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFAS — Secrétaires Médicaux",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BAC G1 ou BT Secrétariat Bureautique",
    ageMin: 18, ageMax: 32,
    frais: 40000,
    dateOuverture: "2026-05-22", dateCloture: "2026-06-29",
    conditions: "Né(e) entre le 01/01/1994 et le 31/12/2008 (18 à 32 ans), nationalité ivoirienne. Titulaire du BAC G1 ou d'un BT Secrétariat Bureautique, obtenu entre 2013 et 2025.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BAC G1 ou BT Secrétariat Bureautique", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan", "Bouaké", "Korhogo", "Daloa", "Abengourou", "Agboville", "Aboisso", "Man"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/details/1",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFAS — Technicien Supérieur de Santé (Biologie Médicale)",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BAC C, D, E, F ou B",
    ageMin: 18, ageMax: 32,
    frais: 40000,
    dateOuverture: "2026-05-22", dateCloture: "2026-06-29",
    conditions: "Né(e) entre le 01/01/1994 et le 31/12/2008 (18 à 32 ans), nationalité ivoirienne. Titulaire du BAC C, D, E, F ou B, obtenu entre 2013 et 2025.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BAC", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan", "Bouaké", "Korhogo", "Daloa", "Abengourou", "Agboville", "Aboisso", "Man"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/details/1",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFAS — Technicien Supérieur de Santé (Biomédical)",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BAC C, D, E, F, B ou BT Électronique",
    ageMin: 18, ageMax: 32,
    frais: 40000,
    dateOuverture: "2026-05-22", dateCloture: "2026-06-29",
    conditions: "Né(e) entre le 01/01/1994 et le 31/12/2008 (18 à 32 ans), nationalité ivoirienne. Titulaire du BAC C, D, E, F, B ou d'un BT Électronique, obtenu entre 2013 et 2025.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BAC ou BT Électronique", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan", "Bouaké", "Korhogo", "Daloa", "Abengourou", "Agboville", "Aboisso", "Man"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/details/1",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFAS — Technicien Supérieur de Santé (Hygiène et Assainissement)",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BAC C, D, E, F ou B",
    ageMin: 18, ageMax: 32,
    frais: 40000,
    dateOuverture: "2026-05-22", dateCloture: "2026-06-29",
    conditions: "Né(e) entre le 01/01/1994 et le 31/12/2008 (18 à 32 ans), nationalité ivoirienne. Titulaire du BAC C, D, E, F ou B, obtenu entre 2013 et 2025.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BAC", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan", "Bouaké", "Korhogo", "Daloa", "Abengourou", "Agboville", "Aboisso", "Man"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/details/1",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFAS — Technicien Supérieur de Santé (Imagerie Médicale)",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BAC C, D, E, F ou B",
    ageMin: 18, ageMax: 32,
    frais: 40000,
    dateOuverture: "2026-05-22", dateCloture: "2026-06-29",
    conditions: "Né(e) entre le 01/01/1994 et le 31/12/2008 (18 à 32 ans), nationalité ivoirienne. Titulaire du BAC C, D, E, F ou B, obtenu entre 2013 et 2025.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BAC", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan", "Bouaké", "Korhogo", "Daloa", "Abengourou", "Agboville", "Aboisso", "Man"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/details/1",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFAS — Technicien Supérieur de Santé (Masso-Kinésithérapie)",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BAC C, D, E, F ou B",
    ageMin: 18, ageMax: 32,
    frais: 40000,
    dateOuverture: "2026-05-22", dateCloture: "2026-06-29",
    conditions: "Né(e) entre le 01/01/1994 et le 31/12/2008 (18 à 32 ans), nationalité ivoirienne. Titulaire du BAC C, D, E, F ou B, obtenu entre 2013 et 2025.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BAC", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan", "Bouaké", "Korhogo", "Daloa", "Abengourou", "Agboville", "Aboisso", "Man"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/details/1",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFAS — Technicien Supérieur de Santé (Préparateurs et Gestionnaires en Pharmacie)",
    organisme: "Institut National de Formation des Agents de Santé (INFAS)",
    categorie: "Santé & Social",
    niveau: "BAC C, D, E, F ou B",
    ageMin: 18, ageMax: 32,
    frais: 40000,
    dateOuverture: "2026-05-22", dateCloture: "2026-06-29",
    conditions: "Né(e) entre le 01/01/1994 et le 31/12/2008 (18 à 32 ans), nationalité ivoirienne. Titulaire du BAC C, D, E, F ou B, obtenu entre 2013 et 2025.",
    pieces: ["Acte de naissance", "Attestation de nationalité", "Copie du BAC", "Casier judiciaire", "Certificat de visite médicale", "Reçu de paiement (40 000 FCFA)"],
    centres: ["Abidjan", "Bouaké", "Korhogo", "Daloa", "Abengourou", "Agboville", "Aboisso", "Man"],
    couleur: "#D9000D",
    lienOfficiel: "https://infas.ciconcours.com/details/1",
    dateVerifiee: true,
  },
  {
    titre: "Concours INSFS — Éducateurs Préscolaires (EP)",
    organisme: "Institut National Supérieur de Formation Sociale (INSFS)",
    categorie: "Travail Social",
    niveau: "BAC ou BT sciences médico-sociales",
    ageMin: 18, ageMax: 36,
    // Le montant TOTAL par filière n'est pas confirmé pour la session
    // 2026 (seule la fourchette globale 43 500 – 48 500 FCFA l'est,
    // par plusieurs sources concordantes sur la session 2026 même).
    // Consigne explicite : ne jamais estimer un montant précis à
    // partir d'anciennes sessions — `frais` reste donc vide plutôt que
    // d'inventer un chiffre, et frais_detail donne toute l'information
    // réellement confirmée pour 2026, en signalant clairement la part
    // encore à vérifier filière par filière.
    frais: null,
    fraisDetail: "Frais de visite médicale : 33 000 FCFA (confirmé pour la session 2026, payé une seule fois même en cas de candidature à plusieurs filières)\nFrais d'inscription : variable selon la filière (entre 10 500 et 15 500 FCFA, montant exact par filière non confirmé officiellement pour 2026)\nTotal estimé : entre 43 500 et 48 500 FCFA selon la filière — vérifier le montant exact de cette filière sur insfs.ciconcours.com avant paiement.",
    // Session 2026 confirmée par communiqué officiel du Ministère de
    // l'Emploi, de la Protection Sociale et de la Formation
    // Professionnelle (29/04/2026) — source : infs-ci.org et
    // fratmat.info (11/05/2026).
    dateOuverture: "2026-05-11", dateCloture: "2026-09-14",
    conditions: "Être de nationalité ivoirienne ou ressortissant CEDEAO. Être âgé de 18 à 36 ans au 31 décembre 2026. Titulaire du BAC ou d'un BT en sciences médico-sociales. Épreuves écrites le 10 octobre 2026 (sous réserve de confirmation officielle).",
    pieces: ["Extrait de naissance ou jugement supplétif (- d'1 an)", "Certificat de nationalité ivoirienne (- de 5 ans)", "Casier judiciaire (- de 3 mois)", "Certificat de visite médicale (médecin agréé INSFS)", "Diplôme ou titre exigé légalisé (- d'1 an)", "Carte CMU ou récépissé d'enrôlement", "CNI, récépissé CNI ou attestation d'identité valide", "Reçus de paiement des droits"],
    centres: ["Abidjan — INSFS Cocody"],
    couleur: "#F5820D",
    lienOfficiel: "https://insfs.ciconcours.com/",
    dateVerifiee: true, // Sources : communiqué ministériel du 29/04/2026 + fratmat.info du 11/05/2026 + nouvelle-afrique.net du 04/06/2026 (fourchette de frais)
  },
  {
    titre: "Concours INSFS — Éducateurs Préscolaires Adjoints (EPA)",
    organisme: "Institut National Supérieur de Formation Sociale (INSFS)",
    categorie: "Travail Social",
    niveau: "BEPC ou CAP sanitaire et social",
    ageMin: 18, ageMax: 36,
    frais: null,
    fraisDetail: "Frais de visite médicale : 33 000 FCFA (confirmé pour la session 2026, payé une seule fois même en cas de candidature à plusieurs filières)\nFrais d'inscription : variable selon la filière (entre 10 500 et 15 500 FCFA, montant exact par filière non confirmé officiellement pour 2026)\nTotal estimé : entre 43 500 et 48 500 FCFA selon la filière — vérifier le montant exact de cette filière sur insfs.ciconcours.com avant paiement.",
    dateOuverture: "2026-05-11", dateCloture: "2026-09-14",
    conditions: "Être de nationalité ivoirienne ou ressortissant CEDEAO. Être âgé de 18 à 36 ans au 31 décembre 2026. Titulaire du BEPC ou d'un CAP sanitaire et social. Épreuves écrites le 11 octobre 2026 (sous réserve de confirmation officielle).",
    pieces: ["Extrait de naissance ou jugement supplétif (- d'1 an)", "Certificat de nationalité ivoirienne (- de 5 ans)", "Casier judiciaire (- de 3 mois)", "Certificat de visite médicale (médecin agréé INSFS)", "Diplôme ou titre exigé légalisé (- d'1 an)", "Carte CMU ou récépissé d'enrôlement", "CNI, récépissé CNI ou attestation d'identité valide", "Reçus de paiement des droits"],
    centres: ["Abidjan — INSFS Cocody"],
    couleur: "#F5820D",
    lienOfficiel: "https://insfs.ciconcours.com/",
    dateVerifiee: true, // Sources : communiqué ministériel du 29/04/2026 + fratmat.info du 11/05/2026 + nouvelle-afrique.net du 04/06/2026 (fourchette de frais)
  },
  {
    titre: "Concours INSFS — Éducateurs Spécialisés (ES)",
    organisme: "Institut National Supérieur de Formation Sociale (INSFS)",
    categorie: "Travail Social",
    niveau: "Bac+2 (BTS, DUT ou Licence 2)",
    ageMin: 18, ageMax: 36,
    frais: null,
    fraisDetail: "Frais de visite médicale : 33 000 FCFA (confirmé pour la session 2026, payé une seule fois même en cas de candidature à plusieurs filières)\nFrais d'inscription : variable selon la filière (entre 10 500 et 15 500 FCFA, montant exact par filière non confirmé officiellement pour 2026)\nTotal estimé : entre 43 500 et 48 500 FCFA selon la filière — vérifier le montant exact de cette filière sur insfs.ciconcours.com avant paiement.",
    dateOuverture: "2026-05-11", dateCloture: "2026-09-14",
    conditions: "Être de nationalité ivoirienne ou ressortissant CEDEAO. Être âgé de 18 à 36 ans au 31 décembre 2026. Titulaire d'un diplôme Bac+2 (BTS, DUT ou Licence 2). Épreuves écrites le 4 octobre 2026 (sous réserve de confirmation officielle).",
    pieces: ["Extrait de naissance ou jugement supplétif (- d'1 an)", "Certificat de nationalité ivoirienne (- de 5 ans)", "Casier judiciaire (- de 3 mois)", "Certificat de visite médicale (médecin agréé INSFS)", "Diplôme ou titre exigé légalisé (- d'1 an)", "Carte CMU ou récépissé d'enrôlement", "CNI, récépissé CNI ou attestation d'identité valide", "Reçus de paiement des droits"],
    centres: ["Abidjan — INSFS Cocody"],
    couleur: "#F5820D",
    lienOfficiel: "https://insfs.ciconcours.com/",
    dateVerifiee: true, // Sources : communiqué ministériel du 29/04/2026 + fratmat.info du 11/05/2026 + nouvelle-afrique.net du 04/06/2026 (fourchette de frais)
  },
  {
    titre: "Concours INSFS — Maîtres d'Éducation Spécialisée (MESP)",
    organisme: "Institut National Supérieur de Formation Sociale (INSFS)",
    categorie: "Travail Social",
    niveau: "BAC ou BT sciences médico-sociales",
    ageMin: 18, ageMax: 36,
    frais: null,
    fraisDetail: "Frais de visite médicale : 33 000 FCFA (confirmé pour la session 2026, payé une seule fois même en cas de candidature à plusieurs filières)\nFrais d'inscription : variable selon la filière (entre 10 500 et 15 500 FCFA, montant exact par filière non confirmé officiellement pour 2026)\nTotal estimé : entre 43 500 et 48 500 FCFA selon la filière — vérifier le montant exact de cette filière sur insfs.ciconcours.com avant paiement.",
    dateOuverture: "2026-05-11", dateCloture: "2026-09-14",
    conditions: "Être de nationalité ivoirienne ou ressortissant CEDEAO. Être âgé de 18 à 36 ans au 31 décembre 2026. Titulaire du BAC ou d'un BT en sciences médico-sociales. Épreuves écrites le 3 octobre 2026 (sous réserve de confirmation officielle).",
    pieces: ["Extrait de naissance ou jugement supplétif (- d'1 an)", "Certificat de nationalité ivoirienne (- de 5 ans)", "Casier judiciaire (- de 3 mois)", "Certificat de visite médicale (médecin agréé INSFS)", "Diplôme ou titre exigé légalisé (- d'1 an)", "Carte CMU ou récépissé d'enrôlement", "CNI, récépissé CNI ou attestation d'identité valide", "Reçus de paiement des droits"],
    centres: ["Abidjan — INSFS Cocody"],
    couleur: "#F5820D",
    lienOfficiel: "https://insfs.ciconcours.com/",
    dateVerifiee: true, // Sources : communiqué ministériel du 29/04/2026 + fratmat.info du 11/05/2026 + nouvelle-afrique.net du 04/06/2026 (fourchette de frais)
  },
  {
    // Concours DISTINCT des 4 filières INSFS ci-dessus : celui-ci est un
    // recrutement de la FONCTION PUBLIQUE (pas une formation INSFS),
    // ouvert aux titulaires du diplôme d'État délivré par l'INSFS après
    // leurs études. Inscriptions confirmées closes pour la session
    // 2026 (16 mars → 30 avril/8 mai 2026, largement passé au
    // 13/08/2026) — statut "fermé" explicite, jamais déduit comme
    // "ouvert" simplement parce qu'il a existé les années précédentes.
    titre: "Concours de recrutement — Assistant Social",
    organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    categorie: "Fonction publique",
    niveau: "Diplôme d'État d'Assistant Social (délivré par l'INSFS)",
    ageMin: 18, ageMax: 42,
    frais: 31000,
    fraisDetail: "Frais de préinscription : 23 500 FCFA\nKit numérique : 7 500 FCFA\nTotal obligatoire : 31 000 FCFA",
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Être de nationalité ivoirienne. Être titulaire du Diplôme d'État d'Assistant Social délivré par l'Institut National Supérieur de Formation Sociale (INSFS) — ne pas confondre avec les concours directs d'entrée en formation à l'INSFS ci-dessus. Né(e) entre le 31/12/1983 et le 01/01/2008.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme d'État d'Assistant Social (INSFS)", "Casier judiciaire", "Certificat médical", "CV"],
    centres: ["Abidjan et villes-centres — Fonction Publique"],
    couleur: "#7B2FBE",
    statut: "fermé",
    lienOfficiel: "https://gucaci.ciconcours.com/concours-2026/liste-concours/MEMFPMA/2/1",
    dateVerifiee: true, // Source : liste officielle des concours administratifs 2026 (gucaci.ciconcours.com) + ablanian.ci — inscriptions closes le 30/04-08/05/2026
  },
  {
    titre: "Concours de recrutement — Assistant Social Adjoint",
    organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    categorie: "Fonction publique",
    niveau: "Diplôme d'État d'Assistant Social Adjoint (délivré par l'INSFS)",
    ageMin: 18, ageMax: 42,
    frais: 31000,
    fraisDetail: "Frais de préinscription : 23 500 FCFA\nKit numérique : 7 500 FCFA\nTotal obligatoire : 31 000 FCFA",
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Être de nationalité ivoirienne. Être titulaire du Diplôme d'État d'Assistant Social Adjoint délivré par l'Institut National Supérieur de Formation Sociale (INSFS) — ne pas confondre avec les concours directs d'entrée en formation à l'INSFS ci-dessus. Né(e) entre le 31/12/1983 et le 01/01/2008.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme d'État d'Assistant Social Adjoint (INSFS)", "Casier judiciaire", "Certificat médical", "CV"],
    centres: ["Abidjan et villes-centres — Fonction Publique"],
    couleur: "#7B2FBE",
    statut: "fermé",
    lienOfficiel: "https://gucaci.ciconcours.com/concours-2026/liste-concours/MEMFPMA/2/1",
    dateVerifiee: true, // Source : liste officielle des concours administratifs 2026 (gucaci.ciconcours.com) + ablanian.ci — inscriptions closes le 30/04-08/05/2026
  },
  {
    titre: "Concours INJS — Professeur de Collège d'EPS (PC-EPS)",
    organisme: "Institut National de la Jeunesse et des Sports (INJS)",
    categorie: "Fonction publique",
    niveau: "BAC",
    ageMin: 18, ageMax: 30,
    frais: 3000,
    // Plateforme officielle confirmée : concours.injsabidjan.net
    // (source : ablanian.ci/concours_admin, youthmedia.net, 06/2026).
    // Formation de 3 ans. Je n'ai pas trouvé de date précise de
    // clôture pour la session 2026 dans mes recherches — à vérifier
    // directement sur le site officiel avant publication, plutôt que
    // d'afficher une date non confirmée.
    dateOuverture: null, dateCloture: null,
    conditions: "Titulaire du Baccalauréat (attestation de réussite ou diplôme). Certificat de visite médicale d'aptitude délivré exclusivement par le Centre de la Médecine du Sport de l'INJS. Bulletins de Seconde, Première et Terminale (ou livret scolaire).",
    pieces: ["Attestation de réussite ou diplôme du Baccalauréat", "Bulletins de Seconde, Première et Terminale (ou livret scolaire)", "Certificat de visite médicale d'aptitude sportive (Centre de Médecine du Sport de l'INJS)", "Demande d'inscription (fiche bleue) adressée au Directeur Général de l'INJS"],
    centres: ["Abidjan — INJS Marcory (salle 4)"],
    couleur: "#0A6EBD",
    lienOfficiel: "https://concours.injsabidjan.net/preinscription.php",
    dateVerifiee: false,
  },
  {
    titre: "Concours ENS — Professeur de Collège (CAP-PC)",
    organisme: "École Normale Supérieure (ENS) Abidjan",
    categorie: "Enseignement",
    niveau: "DEUG 2 / Licence selon discipline",
    ageMin: 18, ageMax: 39,
    frais: 3000,
    // Session 2026 : clôture des inscriptions confirmée au 12 avril
    // 2026 (lelivretdesconcours.com), ouverture officielle le 3 mai
    // 2026 par le Ministre de l'Enseignement Supérieur, épreuves du
    // 3 au 10 mai 2026, résultats définitifs déjà publiés sur
    // ens.mesrs-ci.net au 08/08/2026 — ce concours est donc terminé
    // pour cette session. Date d'ouverture des inscriptions non
    // trouvée avec certitude ; estimée à ~2 mois avant clôture.
    dateOuverture: "2026-02-12", dateCloture: "2026-04-12",
    conditions: "Nationalité ivoirienne ou ressortissant CEDEAO. Titulaire d'un diplôme DEUG 2/Licence selon la discipline (Anglais, Géographie/Histoire, Lettres Modernes, Mathématiques, SVT ou Sciences Physiques, Espagnol). N'avoir jamais fait l'objet d'une condamnation pénale.",
    pieces: ["Acte de naissance", "Diplôme légalisé", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — ENS Cocody"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://ens.mesrs-ci.net/",
    dateVerifiee: true,
  },
  {
    titre: "Concours ENS — Éducateur",
    organisme: "École Normale Supérieure (ENS) Abidjan",
    categorie: "Enseignement",
    niveau: "BAC",
    ageMin: 18, ageMax: 39,
    frais: 3000,
    dateOuverture: "2026-02-12", dateCloture: "2026-04-12",
    conditions: "Nationalité ivoirienne ou ressortissant CEDEAO. Titulaire du Baccalauréat. N'avoir jamais fait l'objet d'une condamnation pénale.",
    pieces: ["Acte de naissance", "Copie du BAC", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — ENS Cocody"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://ens.mesrs-ci.net/",
    dateVerifiee: true,
  },
  {
    titre: "Concours Police Nationale — Sous-officier (ENP)",
    organisme: "École Nationale de Police (ENP) — Ministère de l'Intérieur et de la Sécurité",
    categorie: "Sécurité & Défense",
    niveau: "BEPC",
    ageMin: 18, ageMax: 30,
    frais: 10000,
    // Ré-vérifié le 19/08/2026 : Ablanian.ci (la référence que tu
    // utilises) confirme elle-même sur sa page d'accueil que "le
    // dernier lancement du concours de police [direct, Officier]
    // date de 2024" — aucune session directe grand public n'a donc
    // été relancée en 2026 au moment de cette vérification. Un
    // article (affairage.ci, 03/05/2026) annonçait la Police Nationale
    // "sur le point de lancer" un concours direct de sous-officiers
    // 2026 (18-26 ans, né entre 2000-2006, extensible à 30 ans) mais
    // sans dates d'inscription confirmées à ce jour. Le site officiel
    // (police.ciconcours.com) n'affiche que des examens PROFESSIONNELS
    // (réservés aux policiers en poste, inscriptions déjà closes). Le
    // concours PROFESSIONNEL des Commissaires de Police, lui, est
    // confirmé ouvert au titre de 2026 (KOACI, 19/07/2026) — voir la
    // fiche séparée ci-dessous. Dates de CETTE fiche (concours direct
    // grand public) toujours non confirmées — à vérifier manuellement
    // sur police.ciconcours.com avant publication.
    dateOuverture: null, dateCloture: null,
    conditions: "Nationalité ivoirienne. Titulaire du BEPC, du BAC, d'une Licence ou d'une Maîtrise selon le corps visé. Carte CMU (ou récépissé d'enrôlement) désormais obligatoire. Engagement décennal à servir dans la Police Nationale (10 ans).",
    pieces: ["Certificat de nationalité ivoirienne (- de 6 mois)", "Extrait d'acte de naissance ou jugement supplétif original", "Diplôme requis légalisé + original", "CNI en cours de validité (recto-verso) ou récépissé d'enrôlement", "Fiche de candidature imprimée après inscription en ligne", "Carte CMU ou récépissé d'enrôlement"],
    centres: ["Abidjan — École de Police"],
    couleur: "#0A6EBD",
    lienOfficiel: "https://police.ciconcours.com/",
    dateVerifiee: false,
  },
  {
    titre: "Concours Professionnel — Commissaires de Police",
    organisme: "École Nationale de Police (ENP) — Ministère de l'Intérieur et de la Sécurité",
    categorie: "Sécurité & Défense",
    niveau: "Baccalauréat",
    frais: null,
    // Concours PROFESSIONNEL réservé aux Officiers de Police déjà en
    // fonction, pas au grand public — confirmé ouvert au titre de
    // l'année 2026 par KOACI (19/07/2026) : candidats titulaires du
    // BAC, âgés de 49 ans au plus au 01/01/2026, en activité et
    // justifiant d'au moins 5 années de service dans le corps des
    // Officiers de Police. Dates précises d'ouverture/clôture des
    // inscriptions non précisées dans la source — statut fixé
    // manuellement (statutAuto: false) plutôt que deviné.
    statut: "fermé", statutAuto: false,
    conditions: "Réservé aux Officiers de Police en activité, titulaires du Baccalauréat, âgés de 49 ans au plus au 1er janvier 2026, justifiant d'au moins 5 années de service effectif dans le corps des Officiers de Police.",
    centres: ["Abidjan — École de Police"],
    couleur: "#0A6EBD",
    lienOfficiel: "https://police.ciconcours.com/",
    dateVerifiee: true,
  },
  {
    titre: "Concours Sous-Officiers de la Gendarmerie Nationale",
    organisme: "Ministère de la Défense — Gendarmerie Nationale de Côte d'Ivoire",
    categorie: "Sécurité & Défense",
    niveau: "BEPC",
    ageMin: 18, ageMax: 25,
    frais: 30000,
    // Session 2026 confirmée par une douzaine de sources concordantes
    // (AIP, KOACI, AllAfrica, FratMat, Afriquinfos, defense.ciconcours.net…)
    // — communiqué d'ouverture publié le 26 mars 2026 par le Ministre de
    // la Défense, inscriptions en ligne effectivement ouvertes du 30
    // mars au 19 avril 2026 (dateOuverture ci-dessous = vraie date de
    // début des inscriptions, pas celle du communiqué d'annonce).
    // 2 800 places disponibles pour cette session. Frais corrigés à
    // 30 000 FCFA (non remboursables) — la valeur précédente de cette
    // fiche (10 000 FCFA) était erronée. Visite médicale 26 mai-16
    // juin 2026, dépôt des dossiers 6-14 juillet 2026, épreuves
    // sportives/pratiques 7-16 juillet 2026 — concours en phase
    // avancée (post-dépôt de dossiers) au 08/08/2026.
    dateOuverture: "2026-03-30", dateCloture: "2026-04-19",
    conditions: "Nationalité ivoirienne. Âgé de 18 à 25 ans au 31 décembre 2026. Titulaire du BEPC ou diplôme équivalent. Taille minimale 1,68 m. Aptitude physique. Inscription exclusivement en ligne, procédure 100% dématérialisée — aucun intermédiaire ne peut garantir l'admission.",
    pieces: ["Acte de naissance", "Copie du BEPC ou diplôme équivalent", "Casier judiciaire vierge", "Certificat médical (visite du 26 mai au 16 juin 2026)"],
    centres: ["Abidjan — École de Gendarmerie", "Bouaké"],
    couleur: "#0A6EBD",
    lienOfficiel: "https://defense.ciconcours.net/",
    dateVerifiee: true,
  },
  {
    titre: "Concours d'Agents d'Encadrement des Douanes",
    organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration — Direction Générale des Douanes",
    categorie: "Sécurité & Défense",
    niveau: "BEPC/BAC selon le grade",
    ageMin: 18, ageMax: 28,
    frais: 10000,
    // Contrairement à ce qu'une ancienne version de cette fiche
    // supposait, les Douanes n'ont pas de plateforme d'inscription
    // séparée — le recrutement direct passe par le portail centralisé
    // Fonction Publique / GUCACI (gucaci.ciconcours.com,
    // fonctionpublique.gouv.ci), aux côtés de l'ENA et des autres
    // concours administratifs. Aucune session "concours direct" grand
    // public confirmée avec dates précises pour 2026 au 08/08/2026 —
    // seul un concours PROFESSIONNEL EXCEPTIONNEL (réservé aux
    // contrôleurs déjà en poste, 15 postes d'Inspecteur, inscriptions
    // 16 mars-30 avril 2026) a été trouvé. Dates à vérifier.
    dateOuverture: null, dateCloture: null,
    conditions: "Nationalité ivoirienne. Conditions et niveau exigé variables selon le grade visé (agent, contrôleur, inspecteur) — voir communiqué d'ouverture officiel avant candidature.",
    pieces: ["Acte de naissance", "Copie du diplôme requis selon le grade", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan"],
    couleur: "#0A6EBD",
    lienOfficiel: "https://gucaci.ciconcours.com/",
    dateVerifiee: false,
  },
  {
    titre: "Concours Sous-Officiers des Eaux et Forêts",
    organisme: "Ministère des Eaux et Forêts",
    categorie: "Fonction publique",
    niveau: "BEPC",
    ageMin: 18, ageMax: 30,
    frais: 15000,
    // Session 2026 confirmée par le communiqué officiel du ministère
    // (eauxetforets.gouv.ci) et 4 autres sources concordantes —
    // inscriptions en ligne 16 mars-30 avril 2026 sur
    // minef.ciconcours.com. 750 places. Concours terminé pour cette
    // session au 08/08/2026. Frais : 10 000 FCFA inscription + 2 500
    // pochette + 2 500 photo numérique = 15 000 FCFA.
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Nationalité ivoirienne. Né(e) entre le 1er janvier 1996 et le 31 décembre 2007 (18-30 ans au 31/12/2025). Titulaire du BEPC ou diplôme équivalent. Taille minimale 1,65 m (H) / 1,60 m (F). Bonne constitution physique, champ visuel normal.",
    pieces: ["Demande manuscrite adressée au Ministre des Eaux et Forêts", "Fiche d'inscription en ligne imprimée", "Extrait d'acte de naissance", "Copie du BEPC ou diplôme équivalent", "Certificat médical", "Reçu de paiement (15 000 FCFA, mobile money)"],
    centres: ["Abidjan — Sebroko (ancien siège ONUCI, Attécoubé)"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://minef.ciconcours.com/",
    dateVerifiee: true,
  },
  {
    titre: "Concours Officiers des Eaux et Forêts",
    organisme: "Ministère des Eaux et Forêts",
    categorie: "Fonction publique",
    niveau: "BAC",
    ageMin: 18, ageMax: 30,
    frais: 20000,
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Nationalité ivoirienne. Né(e) entre le 1er janvier 1996 et le 31 décembre 2007 (18-30 ans au 31/12/2025). Titulaire du BAC (toutes spécialités) ou BT (toutes spécialités). Taille minimale 1,65 m (H) / 1,60 m (F). Bonne constitution physique, champ visuel normal.",
    pieces: ["Demande manuscrite adressée au Ministre des Eaux et Forêts", "Fiche d'inscription en ligne imprimée", "Extrait d'acte de naissance", "Copie du BAC ou BT", "Certificat médical", "Reçu de paiement (20 000 FCFA, mobile money)"],
    centres: ["Abidjan — Sebroko (ancien siège ONUCI, Attécoubé)"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://minef.ciconcours.com/",
    dateVerifiee: true,
  },
  {
    titre: "Concours Fonction Publique — Catégorie A (BAC+3 minimum)",
    organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    categorie: "Fonction publique",
    niveau: "BAC+3 minimum",
    ageMin: 18, ageMax: 40,
    frais: 15000,
    // Session 2026 confirmée par communiqué officiel du 11/03/2026
    // (point presse de la Ministre, fonctionpublique.gouv.ci) et
    // guidedufonctionnaire.com — inscriptions en ligne 16/03-30/04/2026
    // sur concours.gouv.ci, plus de 400 concours administratifs
    // ouverts. Épreuves écrites du 27 juin au 9 août 2026 (samedis et
    // dimanches). Ré-vérifié le 18/08/2026 : 423 concours 2026 au
    // total (199 recrutement direct + 224 promotion professionnelle,
    // source simoon-cv.com/gouv.ci) ; résultats publiés en 4 vagues
    // (21/07, 04/08, mi-août, 01/09/2026 sur gucaci.ciconcours.com) —
    // les deux premières vagues sont déjà publiées à cette date, les
    // deux dernières restent à venir. Le concours reste donc "fermé"
    // (inscriptions closes depuis le 30/04) même si le traitement des
    // résultats se poursuit encore par vagues successives.
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Nationalité ivoirienne. Diplôme de l'enseignement supérieur BAC+3 minimum. N'avoir jamais été révoqué de la Fonction Publique. Catégorie A regroupe les grades A3 à A7 (cadres supérieurs).",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme requis légalisé", "Casier judiciaire bulletin n°3", "Certificat médical", "CV détaillé"],
    centres: ["Abidjan — Ministère Fonction Publique (Plateau)", "Bouaké", "Man"],
    couleur: "#7B2FBE",
    premium: true,
    lienOfficiel: "https://concours.gouv.ci/",
    dateVerifiee: true,
  },
  {
    titre: "Concours Fonction Publique — Catégorie B (BAC à BAC+2)",
    organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    categorie: "Fonction publique",
    niveau: "BAC à BAC+2",
    ageMin: 18, ageMax: 40,
    frais: 10000,
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Nationalité ivoirienne. Diplôme de niveau BAC à BAC+2 selon le grade (B1 à B3 : secrétaire adjoint administratif, adjoint administratif, maître d'éducation surveillée...). N'avoir jamais été révoqué de la Fonction Publique.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme requis légalisé", "Casier judiciaire bulletin n°3", "Certificat médical", "CV détaillé"],
    centres: ["Abidjan — Ministère Fonction Publique (Plateau)", "Bouaké", "Man"],
    couleur: "#7B2FBE",
    premium: true,
    lienOfficiel: "https://concours.gouv.ci/",
    dateVerifiee: true,
  },
  {
    titre: "Concours Fonction Publique — Catégorie C (BEPC à CAP)",
    organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    categorie: "Fonction publique",
    niveau: "BEPC à CAP",
    ageMin: 18, ageMax: 40,
    frais: 8000,
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Nationalité ivoirienne. Titulaire du BEPC, d'un CAP ou diplôme équivalent selon le grade visé. N'avoir jamais été révoqué de la Fonction Publique.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme requis", "Casier judiciaire", "Certificat médical", "CV"],
    centres: ["Abidjan — Ministère Fonction Publique (Plateau)"],
    couleur: "#7B2FBE",
    lienOfficiel: "https://concours.gouv.ci/",
    dateVerifiee: true,
  },
  {
    titre: "Concours Fonction Publique — Auxiliaire Social (Catégorie D)",
    organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    categorie: "Fonction publique",
    niveau: "Niveau Catégorie D (exécution)",
    ageMin: 18, ageMax: 40,
    frais: 5000,
    // Concours distinct des filières INSFS (EP, EPA, ES, MESP) — c'est
    // un concours administratif classique de catégorie D (exécution,
    // grade D1), pas une formation INSFS. Confirmé listé explicitement
    // dans le catalogue des concours administratifs 2026
    // (guidedufonctionnaire.com).
    dateOuverture: "2026-03-16", dateCloture: "2026-04-30",
    conditions: "Nationalité ivoirienne. Niveau requis pour la catégorie D (exécution), grade D1. N'avoir jamais été révoqué de la Fonction Publique.",
    pieces: ["Extrait de naissance", "Certificat de nationalité", "Diplôme ou attestation requis", "Casier judiciaire", "Certificat médical", "CV"],
    centres: ["Abidjan — Ministère Fonction Publique (Plateau)"],
    couleur: "#7B2FBE",
    lienOfficiel: "https://concours.gouv.ci/",
    dateVerifiee: true,
  },
  {
    titre: "Recrutement Militaire du Rang — Forces Armées (FACI)",
    organisme: "Ministère de la Défense — État-Major Général des Armées (FACI)",
    categorie: "Sécurité & Défense",
    niveau: "CEPE + niveau 4ème minimum",
    ageMin: 18, ageMax: 23,
    frais: 0,
    // Session 2026 confirmée par communiqué officiel du 27/01/2026
    // (Général Lassina Doumbia, Chef d'État-Major) et 6 sources
    // concordantes (KOACI, AIP, lavenir.ci...) — présélection en
    // région 9 février-8 mars 2026, sélection définitive à Abidjan
    // (Akouédo) mi-mars/avril selon les sources, début de formation le
    // 15 avril 2026. Concours terminé pour cette session au 08/08/2026.
    // Inscription entièrement gratuite.
    dateOuverture: "2026-02-09", dateCloture: "2026-03-08",
    conditions: "Nationalité ivoirienne. Né(e) entre le 1er janvier 2003 et le 31 décembre 2007 (18-23 ans). Niveau CEPE ou équivalent + niveau 4ème minimum. Taille minimale 1,70 m, hommes et femmes sans distinction. Épreuves physiques : course d'endurance (8 km hommes / 6 km femmes), montée à la corde, 50 abdominaux minimum.",
    pieces: ["Acte de naissance authentifié", "Certificat de nationalité", "Casier judiciaire", "Diplôme du CEPE ou équivalent authentifié", "Certificat de scolarité attestant du niveau"],
    centres: ["Daloa — 2e Bataillon d'Infanterie", "San-Pédro — Bataillon de Sécurisation du Sud-Ouest", "Man — Bataillon de Sécurisation de l'Ouest", "Guiglo — PC Opération Frontières Étanches", "Odienné — Bataillon de Sécurisation du Nord-Ouest", "Korhogo — 4e Région Militaire", "Bouaké — 3e Région Militaire", "Yamoussoukro — Garde Républicaine", "Abidjan — Akouédo (sélection définitive)"],
    couleur: "#0A6EBD",
    lienOfficiel: "https://www.defense.gouv.ci/",
    dateVerifiee: true,
  },
  {
    titre: "Concours IPNETP — Professeur d'Enseignement Technique (CAP)",
    organisme: "Institut Pédagogique National de l'Enseignement Technique et Professionnel (IPNETP)",
    categorie: "Enseignement",
    niveau: "Variable selon spécialité (BT à Master)",
    ageMin: 18, ageMax: 39,
    frais: 20000,
    // Confirmé "ouvert au titre de la session 2026" par
    // lelivretdesconcours.com et plusieurs concours par spécialité
    // annoncés au fil de l'année (ex: Transport/Logistique/Transit
    // annoncé le 13/03/2026, âge 18-39 ans) — mais je n'ai pas trouvé
    // de date de clôture précise et fiable pour une session généraliste
    // 2026 à la date du 08/08/2026. L'IPNETP recrute par vagues
    // successives selon les spécialités (CAP-PLP, CAP-PC, CAP-PL...),
    // donc plusieurs concours peuvent être ouverts à des moments
    // différents dans l'année — dates à vérifier au cas par cas.
    dateOuverture: null, dateCloture: null,
    conditions: "Nationalité ivoirienne. Âgé de 18 à 39 ans au 1er janvier de l'année du concours. Diplôme technique requis variable selon la spécialité visée (BT, BTS, Licence, Master selon le niveau de formation).",
    pieces: ["Acte de naissance", "Diplôme technique légalisé selon la spécialité", "Casier judiciaire", "Certificat médical"],
    centres: ["Abidjan — IPNETP Cocody"],
    couleur: "#1A6B3C",
    lienOfficiel: "https://ipnetp.ci/",
    dateVerifiee: false,
  },
  {
    titre: "Concours INFJ — Garde Pénitentiaire (EPP)",
    organisme: "Institut National de Formation Judiciaire (INFJ)",
    categorie: "Sécurité & Défense",
    niveau: "BEPC",
    ageMin: 18, ageMax: 28,
    frais: 55000,
    // Session 2026 confirmée par le communiqué officiel PDF de l'INFJ
    // (infj.ciconcours.com/uploads/communiques/1/CD_MAGISTRATURE.pdf,
    // consulté 08/2026) — "Concours Directs (EPP, EG, EPPJEJ)" :
    // inscription en ligne 12/02-31/03/2026, dépôt de dossiers jusqu'au
    // 15/05/2026. Concours terminé pour cette session au 08/08/2026.
    // Frais détaillés (source Ablanian) : 22 500 droit + 5 000 pochette
    // + 2 500 prise de vue + 25 000 visite médicale = 55 000 FCFA.
    dateOuverture: "2026-02-12", dateCloture: "2026-03-31",
    conditions: "Nationalité ivoirienne. Titulaire du BEPC. Aptitude physique requise. Voir arrêté d'ouverture pour les conditions complètes.",
    pieces: ["Demande manuscrite adressée au Ministre de la Justice", "Extrait d'acte de naissance (- de 6 mois)", "Certificat de nationalité ivoirienne", "Casier judiciaire (- de 3 mois)", "CV", "Copie légalisée du BEPC", "Déclaration sur l'honneur", "Certificat de visite et contre-visite médicale INFJ"],
    centres: ["Abidjan — INFJ"],
    couleur: "#0A6EBD",
    lienOfficiel: "https://infj.ciconcours.com/",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFJ — Secrétaire des Greffes et Parquets (EG)",
    organisme: "Institut National de Formation Judiciaire (INFJ)",
    categorie: "Administration",
    niveau: "BAC",
    ageMin: 18, ageMax: 30,
    frais: 55000,
    dateOuverture: "2026-02-12", dateCloture: "2026-03-31",
    conditions: "Nationalité ivoirienne. Titulaire du Baccalauréat toutes séries. Voir arrêté d'ouverture pour les conditions complètes.",
    pieces: ["Demande manuscrite adressée au Ministre de la Justice", "Extrait d'acte de naissance (- de 6 mois)", "Certificat de nationalité ivoirienne", "Casier judiciaire (- de 3 mois)", "CV", "Copie légalisée du BAC", "Déclaration sur l'honneur", "Certificat de visite et contre-visite médicale INFJ"],
    centres: ["Abidjan — INFJ"],
    couleur: "#7B2FBE",
    lienOfficiel: "https://infj.ciconcours.com/",
    dateVerifiee: true,
  },
  {
    titre: "Concours INFJ — Attaché des Greffes et Parquets (Cycle Moyen Supérieur)",
    organisme: "Institut National de Formation Judiciaire (INFJ)",
    categorie: "Administration",
    niveau: "BAC+2 ou Licence",
    ageMin: 18, ageMax: 35,
    frais: 55000,
    // Corps distinct du "Secrétaire des Greffes et Parquets" (cycle
    // moyen, niveau BAC) ci-dessus — l'INFJ publie deux communiqués
    // PDF séparés (ATTACHES vs SECRETAIRES DES GREFFES ET PARQUETS)
    // avec le même calendrier "Concours Directs" mais des niveaux de
    // diplôme différents. Vérifié le 18/08/2026 sur
    // infj.ciconcours.com/uploads/communiques/1/ATTACHES%20DES%20
    // GREFFES%20ET%20PARQUETS%20-%20GREFFES.pdf : inscription en ligne
    // 12/02-31/03/2026 (12/02-17/04/2026 pour la visite médicale selon
    // youthmedia.net). Concours terminé pour cette session au
    // 18/08/2026.
    dateOuverture: "2026-02-12", dateCloture: "2026-03-31",
    conditions: "Nationalité ivoirienne. Titulaire d'un diplôme BAC+2 ou Licence. Voir arrêté d'ouverture pour les conditions complètes.",
    pieces: ["Demande manuscrite adressée au Ministre de la Justice", "Extrait d'acte de naissance (- de 6 mois)", "Certificat de nationalité ivoirienne", "Casier judiciaire (- de 3 mois)", "CV", "Copie légalisée du diplôme BAC+2/Licence", "Déclaration sur l'honneur", "Certificat de visite et contre-visite médicale INFJ"],
    centres: ["Abidjan — INFJ"],
    couleur: "#7B2FBE",
    lienOfficiel: "https://infj.ciconcours.com/",
    dateVerifiee: true,
  },
  {
    titre: "Concours de la Magistrature",
    organisme: "Institut National de Formation Judiciaire (INFJ)",
    categorie: "Administration",
    niveau: "Master en Droit",
    ageMin: 21, ageMax: 35,
    frais: 55000,
    // Session 2026 : inscription en ligne 12/02-19/03/2026, dépôt de
    // dossiers jusqu'au 3/04/2026. Épreuves écrites de présélection le
    // 25/04/2026, compositions de fin juin à septembre 2026. Concours
    // en cours de délibération au 08/08/2026 (source : ouestin.com,
    // infj.ciconcours.com).
    dateOuverture: "2026-02-12", dateCloture: "2026-03-19",
    conditions: "Nationalité ivoirienne. Titulaire d'un Master en Droit. Bonne moralité. Voir arrêté d'ouverture pour les conditions complètes.",
    pieces: ["Demande manuscrite adressée au Ministre de la Justice", "Extrait d'acte de naissance (- de 6 mois)", "Certificat de nationalité ivoirienne", "Casier judiciaire (- de 3 mois)", "CV", "Copie légalisée du Master en Droit", "Déclaration sur l'honneur", "Certificat de visite et contre-visite médicale INFJ"],
    centres: ["Abidjan — INFJ"],
    couleur: "#F5820D",
    lienOfficiel: "https://infj.ciconcours.com/",
    dateVerifiee: true,
  },
  {
    titre: "Concours direct INP-HB — Cycle BAC/BT (Classes préparatoires)",
    organisme: "Institut National Polytechnique Félix Houphouët-Boigny (INP-HB)",
    categorie: "Administration",
    niveau: "BAC ou BT",
    ageMin: 17, ageMax: 22,
    frais: 19000,
    // Session 2026 confirmée par sources multiples concordantes
    // (fratmat.info, allAfrica, communiqué du DG INP-HB du 19/06/2026)
    // — préinscription en ligne 2-22 juillet 2026, dépôt des dossiers
    // 9-25 juillet 2026 à Yamoussoukro. Concours terminé pour cette
    // session au 08/08/2026 (en phase de résultats). Important : l'INP-HB
    // organise en réalité 6 concours distincts par an (BAC/BT, Ingénieur,
    // CPGE, DTS, ITA, CAE/ESCA) — cette fiche ne couvre que le concours
    // BAC/BT, le plus accessible aux nouveaux bacheliers.
    dateOuverture: "2026-07-02", dateCloture: "2026-07-22",
    conditions: "Titulaire du Baccalauréat, du BT ou d'un diplôme équivalent de la session en cours. Âgé de 22 ans au plus au 31 décembre (cycle long) ou 24 ans au plus (cycle court DTS).",
    pieces: ["Fiche de préinscription en ligne imprimée et signée", "Copie de l'attestation de succès au BAC/BT", "Extrait de naissance (- d'1 an)", "Bulletins scolaires", "4 photos d'identité"],
    centres: ["Yamoussoukro — INP-HB (siège)", "Abidjan — Antenne Cocody Riviera Bonoumin"],
    couleur: "#7B2FBE",
    premium: true,
    lienOfficiel: "https://www.inphb.ci/",
    dateVerifiee: true,
  },
];

// ── Fonction exportable : NE ferme JAMAIS le pool elle-même ────
// Contrairement à l'ancienne version qui appelait pool.end() en fin
// de script, cette fonction est aussi appelée depuis
// controllers/concoursController.js (route admin /api/concours/
// reseeder) PENDANT que le serveur tourne — fermer le pool partagé
// depuis là planterait toutes les requêtes suivantes du serveur
// entier, pas juste ce script. Le pool.end() n'a lieu que plus bas,
// dans le bloc `if (require.main === module)`, réservé à l'exécution
// en ligne de commande (`npm run concours:seed`).
async function ensemencerConcours() {
  await initDatabase();
  console.log(`🎓 Chargement de la bibliothèque de concours de Côte d'Ivoire (${INSTITUTIONS.length} fiches)...\n`);

  let creees = 0;
  let ignorees = 0;
  const erreurs = [];

  for (const c of INSTITUTIONS) {
      // Si aucune date n'est fournie du tout (cas rare : source
      // consultée mais aucune session 2026 confirmée trouvée), le
      // calcul automatique de statut retomberait par défaut sur
      // "ouvert" — c'est trompeur, ça affiche un concours comme actif
      // alors qu'on n'en a aucune confirmation. Si la fiche fournit un
      // statut explicite (ex: "fermé" pour un concours confirmé non
      // lancé cette année, voir Assistant Social ci-dessous), on le
      // respecte tel quel plutôt que d'imposer un statut par défaut.
      // Sinon, on utilise "information non confirmée" — jamais "à
      // venir", qui laisserait croire à tort qu'une ouverture est
      // prévue alors qu'on n'en sait tout simplement rien — et on
      // désactive le recalcul automatique tant qu'un admin n'aura pas
      // renseigné de vraies dates.
      const aucuneDateConnue = !c.dateOuverture && !c.dateCloture;
      const statutParDefaut = c.statut || (aucuneDateConnue ? "information non confirmée" : undefined);
      // c.statutAuto est respecté quand une fiche le précise
      // explicitement (ex: les entrées CAFOP/ACE/CEAP ci-dessus, qui
      // veulent un statut manuel même si elles n'ont pas de dates
      // connues aujourd'hui mais pourraient en recevoir plus tard) —
      // sinon, retombe sur la règle historique : pas de dates connues
      // ⇒ pas de recalcul automatique tant qu'aucune vraie date n'est
      // renseignée.
      const statutAutoFinal = c.statutAuto !== undefined ? c.statutAuto : !aucuneDateConnue;

      try {
        await Concours.create({
          titre: c.titre,
          organisme: c.organisme,
          categorie: c.categorie,
          niveau: c.niveau,
          ageMin: c.ageMin,
          ageMax: c.ageMax,
          frais: c.frais,
          fraisDetail: c.fraisDetail,
          premium: c.premium || false,
          couleur: c.couleur,
          conditions: c.conditions,
          pieces: c.pieces,
          centres: c.centres,
          dateOuverture: c.dateOuverture,
          dateCloture: c.dateCloture,
          statut: statutParDefaut,
          statutAuto: statutAutoFinal,
          lienOfficiel: c.lienOfficiel || null,
          // Les fiches qui portent un commentaire de source vérifiée dans
          // le tableau ci-dessus (ex: INSFS, avec date et référence de
          // communiqué officiel) sont marquées vérifiées d'office ;
          // toutes les autres restent des dates plausibles estimées à
          // partir du calendrier habituel de chaque concours, PAS
          // confirmées contre un communiqué officiel de l'année en
          // cours — marquées "à vérifier" pour que l'admin les voie
          // clairement dans /admin/concours.
          dateVerifiee: c.dateVerifiee === true,
        });
        creees++;
        console.log(`  ✅ ${c.titre}`);
      } catch (err) {
        // Conflit sur (titre, organisme) = déjà présent, on ignore
        // silencieusement ; toute autre erreur est collectée pour être
        // remontée à l'appelant (CLI ou réponse HTTP admin) plutôt que
        // simplement affichée dans une console que l'admin ne voit pas
        // quand ce code tourne côté route HTTP.
        if (err.message && err.message.includes("concours_titre_organisme_uniq")) {
          ignorees++;
          console.log(`  ↷ ${c.titre} (déjà présent, ignoré)`);
        } else {
          console.error(`  ❌ ${c.titre} — ${err.message}`);
          erreurs.push({ titre: c.titre, message: err.message });
        }
      }
  }

  console.log(`\n✅ Terminé : ${creees} nouvelle(s) fiche(s) créée(s), ${ignorees} déjà présente(s) sur ${INSTITUTIONS.length}.`);
  console.log("ℹ️  Pense à vérifier/ajuster les dates de chaque fiche via /admin/concours dès que le communiqué officiel de l'année est publié.");

  // ── Logos officiels + correction catégorie INSFS ──────────────
  // Intégré directement ici pour qu'une seule commande —
  // `npm run concours:seed` — suffise à la fois à créer/mettre à
  // jour les fiches concours ET à leur associer le bon logo
  // d'organisme (table structures) et corriger la catégorie des
  // concours INSFS (Travail Social, jamais Santé & Social). Voir
  // scripts/corriger-logos-et-categorie-insfs.js pour le détail —
  // cette même logique reste aussi disponible seule via
  // `npm run corriger:insfs` si besoin de la relancer isolément.
  const { appliquerCorrectionsLogos } = require("./corriger-logos-et-categorie-insfs");
  console.log("\n──────────────────────────────────────────────\n");
  await appliquerCorrectionsLogos();

  return { total: INSTITUTIONS.length, creees, ignorees, erreurs };
}

module.exports = { ensemencerConcours };

// ── Exécution en ligne de commande (`npm run concours:seed`) ────
// Le pool ne se ferme QUE dans ce cas précis — jamais quand la
// fonction est importée et appelée depuis le serveur en marche (voir
// commentaire au-dessus de ensemencerConcours).
if (require.main === module) {
  (async () => {
    try {
      const resume = await ensemencerConcours();
      if (resume.erreurs.length) {
        console.log(`\n⚠️  ${resume.erreurs.length} erreur(s) rencontrée(s) :`);
        resume.erreurs.forEach((e) => console.log(`   - ${e.titre} : ${e.message}`));
      }
    } catch (err) {
      console.error("❌ Erreur lors du chargement de la bibliothèque :", err.message);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  })();
}
