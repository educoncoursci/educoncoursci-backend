// ============================================================
//  scripts/corriger-fiches-obsoletes.js
//  Corrige des problèmes précis signalés par l'utilisateur : des
//  fiches génériques avaient été insérées par une ancienne version
//  de scripts/seed-concours-ci.js sans confirmation officielle,
//  avec des dates non-vérifiées et parfois un concours qui n'a
//  jamais existé sous ce nom (ex: "Assistant Social Adjoint" à
//  l'INSFS, qui n'a jamais été lancé).
//
//  Ce script supprime UNIQUEMENT les titres exacts listés ci-dessous,
//  puis il faut relancer le seed pour insérer les fiches corrigées
//  avec des dates et frais confirmés par des sources officielles
//  (voir le commentaire au-dessus de chaque fiche dans
//  seed-concours-ci.js pour la source précise).
//
//  Sûr à exécuter même si ces fiches ont déjà été corrigées ou
//  n'existent pas (DELETE ne fait rien si aucune ligne ne
//  correspond) — mais NE touche à aucune autre fiche concours.
//
//  Usage : node scripts/corriger-fiches-obsoletes.js
// ============================================================

require("dotenv").config();
const { query, initDatabase, pool } = require("../config/database");

const FICHES_A_RETIRER = [
  // ENA — fiches génériques à dates variables (${AN}), âges et frais
  // erronés (30/35 ans et 5 000 FCFA au lieu de 43 ans et 27 500
  // FCFA réels), remplacées avec les vraies dates et conditions de la
  // session confirmées par communiqué officiel du 23/03/2026.
  { titre: "Concours ENA — Cycle Moyen", organisme: "École Nationale d'Administration (ENA)" },
  { titre: "Concours ENA — Cycle Moyen Supérieur", organisme: "École Nationale d'Administration (ENA)" },
  // IPNETP — l'ancienne fiche avait des dates génériques (${AN})
  // présentées comme fiables alors qu'aucune date de clôture précise
  // n'a pu être confirmée (l'IPNETP recrute par vagues selon les
  // spécialités) — retirée pour éviter d'afficher une fausse date.
  { titre: "Concours IPNETP — Professeur d'Enseignement Technique", organisme: "Institut Pédagogique National de l'Enseignement Technique et Professionnel (IPNETP)" },
  // ENSTP — établissement qui n'existe plus sous ce nom depuis 1996
  // (fusionné dans l'INP-HB, devenu l'ESTP, une de ses 6 grandes
  // écoles) ; le concours est en réalité couvert par le concours
  // direct INP-HB déjà présent dans le catalogue. Fiche entièrement
  // retirée, pas remplacée, pour éviter le doublon.
  { titre: "Concours ENSTP — Techniciens des Travaux Publics", organisme: "École Nationale Supérieure des Travaux Publics (ENSTP)" },
  // Eaux et Forêts — l'ancienne fiche mélangeait BEPC et BAC en une
  // seule fiche générique à dates variables (${AN}) et frais très
  // sous-estimés (3 000 au lieu de 15 000/20 000 FCFA), remplacée par
  // deux fiches distinctes (sous-officiers/officiers) avec les vraies
  // dates 2026.
  { titre: "Concours Agent des Eaux et Forêts", organisme: "Direction Générale des Eaux et Forêts" },
  // Fonction Publique B/C — fiches génériques à dates variables (${AN})
  // et frais sous-estimés, remplacées par 4 fiches (A, B, C, Auxiliaire
  // Social D) avec les vraies dates de la session 2026 confirmées.
  { titre: "Concours Fonction Publique — Catégorie B", organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration" },
  { titre: "Concours Fonction Publique — Catégorie C", organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration" },
  // INSFS — "Assistant Social Adjoint" n'a jamais été lancé par
  // l'INSFS ; "Éducateur Préscolaire" générique remplacé par les 4
  // vraies filières (EP, EPA, ES, MESP) de la session 2026.
  { titre: "Concours INSFS — Assistant Social Adjoint", organisme: "Institut National Supérieur de Formation Sociale (INSFS)" },
  { titre: "Concours INSFS — Éducateur Préscolaire", organisme: "Institut National Supérieur de Formation Sociale (INSFS)" },
  // INFAS — fiche générique à dates variables (${AN}) et frais faux
  // (4 000 FCFA au lieu des 40 000 FCFA réels), remplacée par deux
  // fiches distinctes (BEPC / BAC) avec les vraies dates 2026.
  { titre: "Concours INFAS — Auxiliaires de Santé", organisme: "Institut National de Formation des Agents de Santé (INFAS)" },
  // ENS — fiches génériques à dates variables (${AN}), remplacées par
  // les vraies dates de clôture confirmées (12 avril 2026) ; le nom
  // d'organisme a aussi changé ("ENS" -> "ENS Abidjan") donc les
  // anciennes fiches doivent être retirées explicitement.
  { titre: "Concours ENS — Professeur de Collège", organisme: "École Normale Supérieure (ENS)" },
  { titre: "Concours ENS — Éducateur", organisme: "École Normale Supérieure (ENS)" },
  // CAFOP — fiche générique à dates variables (${AN}) et organisme mal
  // nommé (le CAFOP est un établissement, pas l'organisateur du
  // concours qui relève du MENA), remplacée avec les vraies dates
  // 2026 confirmées.
  { titre: "Concours CAFOP IA (Instituteurs Adjoints)", organisme: "Centre d'Animation et de Formation Pédagogique (CAFOP)" },
  // Gendarmerie — fiche générique à dates variables (${AN}), organisme
  // et frais faux (3 000 au lieu de 10 000 FCFA), remplacée par les
  // vraies dates 2026 confirmées.
  { titre: "Concours Gendarmerie Nationale", organisme: "Gendarmerie Nationale de Côte d'Ivoire" },
  // Police — organisme mal nommé (l'organisateur réel est l'École
  // Nationale de Police, pas "la Police Nationale" en tant qu'entité),
  // et dates génériques désormais retirées faute de confirmation.
  { titre: "Concours Police Nationale — Sous-officier", organisme: "Police Nationale de Côte d'Ivoire" },
  // Douanes — l'ancienne fiche supposait à tort une plateforme
  // d'inscription dédiée aux douanes ; en réalité le recrutement passe
  // par le portail centralisé Fonction Publique / GUCACI.
  { titre: "Concours Agent des Douanes", organisme: "Direction Générale des Douanes de Côte d'Ivoire" },
  // INFJ — fiches génériques à dates variables (${AN}) et frais très
  // sous-estimés (5 000 au lieu des 55 000 FCFA réels), remplacées
  // avec les vraies dates et libellés officiels (EPP, EG) 2026.
  { titre: "Concours INFJ — Garde Pénitentiaire", organisme: "Institut National de Formation Judiciaire (INFJ)" },
  { titre: "Concours INFJ — Secrétaire des Greffes et Parquets", organisme: "Institut National de Formation Judiciaire (INFJ)" },
  // Magistrature — même titre conservé mais contenu profondément
  // corrigé (niveau, frais, dates) ; comme Concours.create() insère
  // toujours une nouvelle ligne plutôt que de mettre à jour une
  // existante, l'ancienne fiche aux fausses données doit être retirée
  // explicitement, sinon les deux coexisteraient en base.
  { titre: "Concours de la Magistrature", organisme: "Institut National de Formation Judiciaire (INFJ)" },
  // INP-HB — ancien titre trop générique ("Test d'entrée... Grandes
  // Écoles d'Ingénieurs" alors que l'INP-HB organise 6 concours
  // distincts) et dates variables (${AN}), remplacé par une fiche
  // ciblée sur le concours BAC/BT avec les vraies dates 2026.
  { titre: "Test d'entrée INP-HB — Grandes Écoles d'Ingénieurs", organisme: "Institut National Polytechnique Félix Houphouët-Boigny (INP-HB)" },
  // FACI — ancien titre/organisme imprécis, âge et niveau erronés
  // (18-25 ans, BEPC au lieu de 18-23 ans, CEPE+4ème réels), dates
  // génériques (${AN}), remplacé avec les vraies conditions et dates
  // de la session 2026 confirmées par le communiqué officiel.
  { titre: "Recrutement Militaire des Forces Armées (FACI)", organisme: "Forces Armées de Côte d'Ivoire (FACI)" },
  // Assistant Social INSFS — retiré à la demande explicite de
  // l'utilisateur (le concours existe mais n'est pas lancé cette
  // année ; plutôt que de le garder visible avec un statut "fermé",
  // il ne doit plus apparaître du tout tant qu'une nouvelle session
  // n'est pas officiellement annoncée).
  { titre: "Concours INSFS — Assistant Social (non lancé en 2026)", organisme: "Institut National Supérieur de Formation Sociale (INSFS)" },
];

(async () => {
  try {
    await initDatabase();
    console.log("\n🔧 Correction des fiches concours obsolètes ou non confirmées…\n");

    for (const f of FICHES_A_RETIRER) {
      const result = await query(
        `DELETE FROM concours WHERE titre = $1 AND organisme = $2 RETURNING id`,
        [f.titre, f.organisme],
      );
      if (result.rows.length > 0) {
        console.log(`  🗑️  Retiré : "${f.titre}" (id ${result.rows[0].id})`);
      } else {
        console.log(`  ↷ "${f.titre}" — déjà absent, rien à faire.`);
      }
    }

    console.log("\n✅ Terminé. Lance maintenant `npm run concours:seed` pour ajouter les fiches corrigées si ce n'est pas déjà fait.");
  } catch (err) {
    console.error("❌ Erreur lors de la correction des fiches :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
