// ============================================================
//  scripts/corriger-logos-et-categorie-insfs.js
//  Corrige deux problèmes précis signalés par l'utilisateur :
//
//  1. Logos manquants — les concours de seed-concours-ci.js ne
//     sont liés à aucune ligne de la table `structures` (aucun
//     structure_id n'a jamais été renseigné), donc même une fois
//     qu'un logo existe quelque part, aucune fiche concours ne
//     peut l'afficher. Ce script crée/complète une ligne
//     `structures` avec le bon logo_url pour chacun des 9
//     organismes fournis, puis relie chaque concours existant à
//     sa structure via `organisme ILIKE`.
//
//  2. Catégorie INSFS — les 4 concours INSFS (Éducateurs
//     Préscolaires, EPA, Éducateurs Spécialisés, MESP) étaient
//     catégorisés "Santé & Social" dans seed-concours-ci.js,
//     mélangeant travail social et domaine médical. Corrigé ici à
//     "Travail Social" pour toute ligne déjà en base avec l'ancien
//     libellé (seed-concours-ci.js est aussi corrigé pour les
//     prochaines exécutions, mais ne touche jamais les lignes déjà
//     insérées).
//
//  Sûr à exécuter plusieurs fois (upsert sur les structures,
//  UPDATE ciblé sur organisme/catégorie) — ne touche à aucune
//  autre donnée. Nécessite que les images soient déployées sous
//  /assets/concours-logos/ sur le site en ligne.
//
//  La logique est exportée en fonction (appliquerCorrectionsLogos)
//  pour être appelable de deux façons :
//    - en une seule commande combinée avec le seed des concours :
//        npm run concours:seed   (seed-concours-ci.js l'appelle
//                                  automatiquement à la fin)
//    - seule, si besoin de la relancer isolément :
//        npm run corriger:insfs
//  Le bloc tout en bas (exécution directe uniquement) gère la
//  connexion/fermeture de la base quand ce fichier est lancé lui-
//  même ; quand il est simplement `require()` par un autre script
//  déjà connecté, c'est CE script appelant qui garde la main sur
//  initDatabase()/pool.end() pour éviter une double init.
// ============================================================

const { query } = require("../config/database");

// Un mot-clé suffisamment unique (présent dans organisme) pour
// retrouver tous les concours de chaque institution, quelle que
// soit la formulation exacte utilisée par titre.
const ORGANISMES = [
  {
    nom: "École Normale Supérieure (ENS) Abidjan",
    sigle: "ENS",
    motCle: "École Normale Supérieure",
    logoUrl: "/assets/concours-logos/ens.jpeg",
  },
  {
    nom: "Institut National de Formation Judiciaire (INFJ)",
    sigle: "INFJ",
    motCle: "Institut National de Formation Judiciaire",
    logoUrl: "/assets/concours-logos/infj.jpeg",
  },
  {
    nom: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    sigle: "MFP",
    motCle: "Ministère de la Fonction Publique et de la Modernisation de l'Administration",
    logoUrl: "/assets/concours-logos/mfp.jpeg",
  },
  {
    nom: "Institut National de la Jeunesse et des Sports (INJS)",
    sigle: "INJS",
    motCle: "Institut National de la Jeunesse et des Sports",
    logoUrl: "/assets/concours-logos/injs.jpeg",
  },
  {
    nom: "Direction Générale des Douanes",
    sigle: "Douanes CI",
    motCle: "Douanes",
    logoUrl: "/assets/concours-logos/douanes-ivoiriennes.jpeg",
  },
  {
    nom: "Gendarmerie Nationale de Côte d'Ivoire",
    sigle: "Gendarmerie",
    motCle: "Gendarmerie Nationale",
    logoUrl: "/assets/concours-logos/gendarmerie-nationale.jpeg",
  },
  {
    nom: "Institut National de Formation des Agents de Santé (INFAS)",
    sigle: "INFAS",
    motCle: "Institut National de Formation des Agents de Santé",
    logoUrl: "/assets/concours-logos/infas.jpeg",
  },
  {
    nom: "Institut National Supérieur de Formation Sociale (INSFS)",
    sigle: "INSFS",
    motCle: "Institut National Supérieur de Formation Sociale",
    logoUrl: "/assets/concours-logos/insfs.jpeg",
  },
  {
    nom: "École Nationale de Police (ENP)",
    sigle: "Police",
    motCle: "École Nationale de Police",
    logoUrl: "/assets/concours-logos/police-nationale.jpeg",
  },
];

// ── Fonction principale, réutilisable ─────────────────────────
// Suppose que initDatabase() a déjà été appelé par l'appelant (ou
// que les tables existent déjà). N'appelle jamais pool.end() —
// c'est à l'appelant (CLI direct ci-dessous, ou seed-concours-ci.js)
// de gérer le cycle de vie de la connexion.
async function appliquerCorrectionsLogos() {
  console.log("🖼️  Association des logos officiels aux organismes...\n");

  let structuresLiees = 0;
  let concoursLies = 0;

  // Traite les motifs du plus spécifique au plus générique, mesuré
  // par le NOMBRE de concours qu'ils touchent (ascendant) — pas par
  // la longueur du texte du motif, qui est un mauvais indicateur ici :
  // le motif "MFP" est un texte long mais très générique (il matche
  // large), tandis que le motif "Douanes" est un texte court mais
  // très spécifique (il ne matche qu'un seul concours). Certains
  // organismes se recoupent en texte — l'organisme des Douanes
  // commence par le même préfixe que celui du Ministère de la
  // Fonction Publique — donc si le motif générique "MFP" était
  // traité en premier, il capterait aussi le concours Douanes avant
  // que le motif spécifique n'ait pu s'appliquer, puisque la mise à
  // jour ne touche plus (voir plus bas) que les concours encore
  // `structure_id IS NULL`. Compter les correspondances réelles
  // avant de trier élimine ce piège quel que soit le texte utilisé.
  const organismesAvecNbCorrespondances = [];
  for (const o of ORGANISMES) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM concours WHERE organisme ILIKE $1`,
      [`%${o.motCle}%`],
    );
    organismesAvecNbCorrespondances.push({ ...o, nbCorrespondances: rows[0].n });
  }
  const organismesTriesParSpecificite = organismesAvecNbCorrespondances.sort(
    (a, b) => a.nbCorrespondances - b.nbCorrespondances,
  );

  for (const o of organismesTriesParSpecificite) {
    // Upsert de la structure : si une ligne portant déjà ce sigle
    // existe, on complète seulement son logo_url (COALESCE ne
    // l'écrase jamais avec `null`, mais on veut ici FORCER la mise
    // à jour du logo même si un logo différent était déjà présent,
    // car l'image donnée par l'utilisateur fait autorité) — d'où un
    // UPDATE explicite plutôt qu'un COALESCE pour cette colonne.
    const existante = await query(
      `SELECT id FROM structures WHERE sigle = $1 OR nom = $2 LIMIT 1`,
      [o.sigle, o.nom],
    );

    let structureId;
    if (existante.rows[0]) {
      structureId = existante.rows[0].id;
      await query(`UPDATE structures SET logo_url = $1 WHERE id = $2`, [o.logoUrl, structureId]);
      console.log(`  ↷ Structure "${o.sigle}" déjà présente (id ${structureId}) — logo mis à jour`);
    } else {
      const creee = await query(
        `INSERT INTO structures (nom, sigle, logo_url) VALUES ($1,$2,$3) RETURNING id`,
        [o.nom, o.sigle, o.logoUrl],
      );
      structureId = creee.rows[0].id;
      console.log(`  ✅ Structure "${o.sigle}" créée (id ${structureId})`);
    }
    structuresLiees++;

    // Relie tous les concours existants dont l'organisme correspond.
    // Condition volontairement stricte : `structure_id IS NULL`
    // uniquement — jamais d'écrasement d'un lien déjà posé, que ce
    // soit par un admin manuellement OU par une étape précédente de
    // CETTE migration. Sans cette restriction, un organisme au motif
    // large (ex. "Ministère de la Fonction Publique...") pourrait
    // voler le lien d'un concours dont l'organisme contient aussi ce
    // texte en préfixe mais correspond en réalité à une entité plus
    // précise (ex. "...— Direction Générale des Douanes") si celle-ci
    // était traitée avant dans la liste ORGANISMES — le résultat
    // dépendrait alors silencieusement de l'ordre du tableau.
    const lien = await query(
      `UPDATE concours SET structure_id = $1
       WHERE organisme ILIKE $2 AND structure_id IS NULL`,
      [structureId, `%${o.motCle}%`],
    );
    concoursLies += lien.rowCount;
    if (lien.rowCount > 0) {
      console.log(`     → ${lien.rowCount} concours relié(s) à ce logo`);
    }
  }

  console.log(`\n✅ ${structuresLiees} structure(s) traitée(s), ${concoursLies} concours relié(s) à un logo au total.\n`);

  // ── Correction de catégorie INSFS ────────────────────────────
  // Le mot "Santé" ne doit apparaître dans aucune catégorie d'un
  // concours INSFS — l'INSFS forme des travailleurs sociaux, pas
  // des professionnels de santé (à ne pas confondre avec l'INFAS,
  // qui lui est bien un institut de formation aux métiers de la
  // santé, et reste donc inchangé par cette requête).
  console.log("🏷️  Correction de la catégorie des concours INSFS...\n");
  const correction = await query(
    `UPDATE concours SET categorie = 'Travail Social'
     WHERE organisme ILIKE '%Institut National Supérieur de Formation Sociale%'
       AND categorie != 'Travail Social'
     RETURNING id, titre, categorie`,
  );
  if (correction.rows.length === 0) {
    console.log("  ↷ Aucun concours INSFS à corriger (déjà classé « Travail Social » ou aucune fiche INSFS en base).");
  } else {
    correction.rows.forEach((c) => console.log(`  ✅ #${c.id} "${c.titre}" → catégorie "${c.categorie}"`));
  }

  console.log("\n✅ Logos et catégorie INSFS à jour.");

  return { structuresLiees, concoursLies, insfsCorrigees: correction.rows.length };
}

module.exports = { appliquerCorrectionsLogos, ORGANISMES };

// ── Exécution directe : `node scripts/corriger-logos-et-categorie-insfs.js`
// ou `npm run corriger:insfs` — gère elle-même la connexion à la base,
// contrairement à appliquerCorrectionsLogos() qui suppose une base déjà
// initialisée par l'appelant (cas de l'appel depuis seed-concours-ci.js).
if (require.main === module) {
  require("dotenv").config();
  const { initDatabase, pool } = require("../config/database");

  (async () => {
    try {
      await initDatabase();
      await appliquerCorrectionsLogos();
    } catch (err) {
      console.error("❌ Erreur lors de la correction des logos/catégorie :", err.message);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  })();
}
