// ============================================================
//  services/emploiFeed.js
//  Agrège automatiquement des offres d'emploi/stages externes
//  vers la table `offres_emploi`, sur le même principe que
//  services/actualitesFeed.js (dédoublonnage par hash,
//  planification via cron).
//
//  DEUX SOURCES POSSIBLES, COMBINABLES :
//
//  1. Flux RSS/XML (EMPLOI_FLUX_URLS)
//     Pour tout site d'emploi qui publie un flux RSS public
//     (certains sites WordPress/CMS le font même sans l'annoncer).
//
//  2. Google Custom Search API (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX)
//     C'est la façon LÉGALE de "chercher via Google" sur des sites
//     précis (Educarriere, Emploi Jeunes, etc.) : on utilise l'API
//     officielle de Google (Programmable Search Engine), pas un
//     scraping de la page de résultats. Gratuite jusqu'à 100
//     requêtes/jour, payante au-delà. Configuration :
//       a. https://programmablesearchengine.google.com/ → créer un
//          moteur de recherche, le restreindre aux sites voulus
//          (ex: educarriere.ci, emploijeunes.ci, indeed.ci...)
//          → récupérer l'identifiant "cx".
//       b. https://console.cloud.google.com/apis/library/customsearch.googleapis.com
//          → activer l'API, créer une clé API.
//       c. Renseigner GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX, et
//          GOOGLE_SEARCH_REQUETES (ex: "emploi CDI Abidjan,recrutement
//          stage Côte d'Ivoire") dans .env.
//
//  ⚠️ LinkedIn : aucune des deux méthodes ci-dessus n'y donne accès.
//  LinkedIn interdit explicitement le scraping dans ses conditions
//  d'utilisation, et son Jobs API officielle n'est accessible que
//  via un partenariat entreprise (non disponible en self-service).
//  Aucune offre LinkedIn n'est donc récupérée ici — c'est une
//  limite réelle, pas un oubli.
// ============================================================

const Parser = require("rss-parser");
const cron   = require("node-cron");
const crypto = require("crypto");
const Emploi = require("../models/Emploi");

const parser = new Parser({ timeout: 10000 });

// ── Sources RSS par défaut (modifiables sans toucher au code) ─
// Vide par défaut : à renseigner via EMPLOI_FLUX_URLS une fois
// une ou plusieurs URLs de flux RSS confirmées en ligne.
const SOURCES_RSS_PAR_DEFAUT = [];

function chargerSourcesRSS() {
  if (process.env.EMPLOI_FLUX_URLS) {
    return process.env.EMPLOI_FLUX_URLS.split(",")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ nom: new URL(url).hostname.replace("www.", ""), url }));
  }
  return SOURCES_RSS_PAR_DEFAUT;
}

// ── Mots-clés qui ne doivent PAS apparaître (annonces hors-sujet) ─
const MOTS_EXCLUS = [
  "appel d'offre", "appel d’offre", "avis de marché", "consultation",
];

function estUneOffreValide(titre) {
  const t = (titre || "").toLowerCase();
  return !MOTS_EXCLUS.some((mot) => t.includes(mot));
}

// ── Devine le type de contrat à partir du titre ───────────────
function devinerTypeContrat(titre) {
  const t = (titre || "").toLowerCase();
  if (t.includes("stage") || t.includes("stagiaire")) return "Stage";
  if (t.includes("alternance")) return "Alternance";
  if (t.includes("freelance") || t.includes("consultant")) return "Freelance";
  if (t.includes("cdd")) return "CDD";
  return "CDI";
}

// ── Devine la ville à partir du titre (par défaut Abidjan) ────
const VILLES_CI = [
  "Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Korhogo",
  "Daloa", "Man", "Gagnoa", "Abengourou", "Divo",
];
function devinerVille(titre) {
  const t = titre || "";
  return VILLES_CI.find((v) => t.includes(v)) || "Abidjan";
}

// ── Devine un nom d'entreprise à partir du domaine source ─────
function deviserEntrepriseDepuisDomaine(domaine) {
  return domaine
    .replace(/\.(ci|com|net|org)$/, "")
    .split(".")[0]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function hacher(titre, lien) {
  return crypto.createHash("sha256").update(`${titre}|${lien}`).digest("hex");
}

// ── SOURCE 1 : Récupère et met en forme un flux RSS d'offres ──
async function lireFlux(source) {
  try {
    const flux = await parser.parseURL(source.url);
    return (flux.items || [])
      .filter((item) => item.title && estUneOffreValide(item.title))
      .slice(0, 30)
      .map((item) => {
        const titre = item.title.trim().slice(0, 200);
        const lien = item.link || null;
        const image =
          item.enclosure?.url ||
          item["media:content"]?.$?.url ||
          null;
        return {
          titre,
          entreprise: source.nom,
          typeContrat: devinerTypeContrat(titre),
          ville: devinerVille(titre),
          description: (item.contentSnippet || item.content || titre).slice(0, 2000),
          dateLimite: null,
          lienExterne: lien,
          sourceNom: source.nom,
          sourceUrl: source.url,
          imageUrl: image,
          hash: hacher(titre, lien || ""),
        };
      });
  } catch (err) {
    // Une source en panne ne doit jamais bloquer les autres
    console.warn(`⚠️  Flux emploi indisponible (${source.nom}) :`, err.message);
    return [];
  }
}

// ── SOURCE 2 : Google Custom Search API (sites autorisés) ─────
function googleSearchConfigure() {
  return Boolean(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX);
}

function chargerRequetesGoogle() {
  if (process.env.GOOGLE_SEARCH_REQUETES) {
    return process.env.GOOGLE_SEARCH_REQUETES.split(",").map((q) => q.trim()).filter(Boolean);
  }
  // Requêtes ciblées avec l'opérateur site: sur les plateformes emploi
  // légitimes identifiées pour la Côte d'Ivoire (voir liste complète
  // et statut gratuit/payant en tête de fichier). CoinAfrique, Afribaba,
  // Jumia Deals et les groupes Facebook sont volontairement exclus de
  // cette liste par défaut : ce sont des petites annonces informelles,
  // sans structure d'offre standardisée, plus difficiles à filtrer
  // proprement et plus exposées aux fausses annonces — un admin peut
  // les ajouter explicitement via GOOGLE_SEARCH_REQUETES s'il le
  // souhaite, en connaissance de cause. LinkedIn est exclu car son
  // scraping est interdit par ses CGU (voir note de tête de fichier).
  return [
    "site:emploi.educarriere.ci recrutement",
    "site:rmo-jobcenter.com offre emploi",
    "site:novojob.com/cote-d-ivoire",
    "site:jobmejobs.com Côte d'Ivoire",
    "site:ci.trabajo.org",
    "site:fr.indeed.com emploi Côte d'Ivoire",
    "site:agenceemploijeunes.ci offre",
  ];
}

async function rechercherViaGoogle(requete) {
  if (!googleSearchConfigure()) return [];
  try {
    const params = new URLSearchParams({
      key: process.env.GOOGLE_SEARCH_API_KEY,
      cx:  process.env.GOOGLE_SEARCH_CX,
      q:   requete,
      num: "10",
    });
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    if (!res.ok) {
      const erreur = await res.text();
      console.warn(`⚠️  Google Custom Search a répondu ${res.status} :`, erreur.slice(0, 300));
      return [];
    }
    const data = await res.json();
    return (data.items || [])
      .filter((item) => item.title && estUneOffreValide(item.title))
      .map((item) => {
        const domaine = new URL(item.link).hostname.replace("www.", "");
        const titre = item.title.trim().slice(0, 200);
        return {
          titre,
          entreprise: deviserEntrepriseDepuisDomaine(domaine),
          typeContrat: devinerTypeContrat(titre + " " + (item.snippet || "")),
          ville: devinerVille(titre + " " + (item.snippet || "")),
          description: (item.snippet || titre).slice(0, 2000),
          dateLimite: null,
          lienExterne: item.link,
          sourceNom: domaine,
          sourceUrl: item.link,
          imageUrl: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src || null,
          hash: hacher(titre, item.link),
        };
      });
  } catch (err) {
    console.warn("⚠️  Google Custom Search indisponible :", err.message);
    return [];
  }
}

// ── Synchronise toutes les sources et alimente la base ────────
async function synchroniser() {
  const sourcesRSS = chargerSourcesRSS();
  const requetesGoogle = googleSearchConfigure() ? chargerRequetesGoogle() : [];

  if (!sourcesRSS.length && !requetesGoogle.length) {
    console.log(
      "ℹ️  Aucune source emploi configurée (EMPLOI_FLUX_URLS et GOOGLE_SEARCH_API_KEY/CX vides).",
    );
    return 0;
  }

  let total = 0;

  for (const source of sourcesRSS) {
    const entries = await lireFlux(source);
    if (entries.length) total += await Emploi.upsertDepuisFlux(entries);
  }

  for (const requete of requetesGoogle) {
    const entries = await rechercherViaGoogle(requete);
    if (entries.length) total += await Emploi.upsertDepuisFlux(entries);
  }

  if (total > 0) {
    console.log(`💼 Offres d'emploi : ${total} nouvelle(s) offre(s) agrégée(s).`);
  }
  return total;
}

// ── Planifie la synchronisation automatique ───────────────────
function demarrerPlanification() {
  if (!process.env.EMPLOI_FLUX_URLS && !googleSearchConfigure()) return; // rien à planifier tant que non configuré

  setTimeout(() => {
    synchroniser().catch((err) =>
      console.error("Erreur synchronisation emploi (démarrage) :", err.message),
    );
  }, 20000);

  // Toutes les heures (les offres bougent moins vite que l'actualité)
  cron.schedule("0 * * * *", () => {
    synchroniser().catch((err) =>
      console.error("Erreur synchronisation emploi (planifiée) :", err.message),
    );
  });

  console.log("🕒 Planification des offres d'emploi activée (toutes les heures).");
}

module.exports = { synchroniser, demarrerPlanification };
