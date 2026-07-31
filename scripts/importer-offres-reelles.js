// ============================================================
//  scripts/importer-offres-reelles.js
//  Importe un premier lot de VRAIES offres d'emploi actuellement
//  en ligne sur Educarriere.ci et Emploi.ci (vérifiées manuellement,
//  pas des données fictives), pour que la page Emploi ne soit pas
//  vide en attendant que l'agrégation automatique (EMPLOI_FLUX_URLS
//  ou GOOGLE_SEARCH_API_KEY) soit configurée.
//
//  Ces offres pointent vers la page officielle de la plateforme qui
//  les publie — la candidature se fait toujours sur le site d'origine.
//
//  Usage : npm run emploi:reelles
// ============================================================

require("dotenv").config();
const crypto = require("crypto");
const { initDatabase, pool } = require("../config/database");
const Emploi = require("../models/Emploi");

function hacher(titre, lien) {
  return crypto.createHash("sha256").update(`${titre}|${lien}`).digest("hex");
}

// Offres réelles constatées en ligne le 31/07/2026 sur Educarriere.ci
// et Emploi.ci. Le lien pointe vers la page de résultats de la
// plateforme d'origine (le titre exact permet de retrouver l'offre).
const OFFRES_REELLES = [
  {
    titre: "Planificateur de maintenance",
    entreprise: "WACOM Group",
    typeContrat: "CDI",
    ville: "Abidjan",
    description: "Recrutement d'un(e) Planificateur(trice) de maintenance. Voir les détails complets et postuler sur Educarriere.ci.",
    dateLimite: "16/08/2026",
    lienExterne: "https://emploi.educarriere.ci/emploi/page/all",
    sourceNom: "Educarriere.ci",
  },
  {
    titre: "Directeur Général (H/F)",
    entreprise: "MECAGRI",
    typeContrat: "CDI",
    ville: "Abidjan",
    description: "MECAGRI recrute son/sa Directeur(trice) Général(e). Voir les détails complets et postuler sur Educarriere.ci.",
    dateLimite: "30/07/2026",
    lienExterne: "https://emploi.educarriere.ci/emploi/page/all",
    sourceNom: "Educarriere.ci",
  },
  {
    titre: "Regional Trainee Program — Côte d'Ivoire",
    entreprise: "Maticline",
    typeContrat: "Stage",
    ville: "Abidjan",
    description: "Programme de stage régional chez Maticline Côte d'Ivoire. Voir les détails complets et postuler sur Educarriere.ci.",
    dateLimite: "05/08/2026",
    lienExterne: "https://emploi.educarriere.ci/",
    sourceNom: "Educarriere.ci",
  },
  {
    titre: "Assistant(e) en Informatique",
    entreprise: "Entreprise (voir annonce)",
    typeContrat: "Stage",
    ville: "Abidjan",
    description: "Stage d'assistanat en informatique à Abidjan. Voir les détails complets et postuler sur Educarriere.ci.",
    dateLimite: null,
    lienExterne: "https://emploi.educarriere.ci/",
    sourceNom: "Educarriere.ci",
  },
  {
    titre: "Commercial Marché Traditionnel (H/F)",
    entreprise: "TECTRA CI",
    typeContrat: "CDI",
    ville: "Abidjan",
    description: "Développement des ventes de produits alimentaires et d'équipements sur le réseau traditionnel (grossistes, demi-grossistes, marchés locaux). Voir les détails complets et postuler sur Emploi.ci.",
    dateLimite: null,
    lienExterne: "https://www.emploi.ci/",
    sourceNom: "Emploi.ci",
  },
  {
    titre: "Commercial(e) — Pièces de rechange véhicules lourds & engins BTP",
    entreprise: "UNIAUTO",
    typeContrat: "CDD",
    ville: "Abidjan",
    description: "Bac+2, 1 an d'expérience minimum. Vente de pièces de rechange pour véhicules lourds et engins BTP. Voir les détails complets et postuler sur Emploi.ci.",
    dateLimite: null,
    lienExterne: "https://www.emploi.ci/",
    sourceNom: "Emploi.ci",
  },
];

(async () => {
  try {
    await initDatabase();
    const entries = OFFRES_REELLES.map((o) => ({
      ...o,
      sourceUrl: o.lienExterne,
      hash: hacher(o.titre, o.lienExterne),
    }));
    const nombre = await Emploi.upsertDepuisFlux(entries);
    console.log(`\n✅ ${nombre} offre(s) réelle(s) importée(s) (sur ${entries.length} proposées — les doublons éventuels sont ignorés).\n`);
  } catch (err) {
    console.error("❌ Erreur :", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
