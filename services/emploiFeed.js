// ============================================================
//  services/emploiFeed.js
//  Agrège automatiquement des offres d'emploi/stages externes
//  vers la table `offres_emploi`, sur le même principe que
//  services/actualitesFeed.js (dédoublonnage par hash + par clé
//  normalisée inter-sources, planification via cron).
//
//  DEUX SOURCES POSSIBLES, COMBINABLES :
//
//  1. Flux RSS/XML (EMPLOI_FLUX_URLS)
//     Pour tout site d'emploi qui publie un flux RSS public
//     (certains sites WordPress/CMS le font même sans l'annoncer).
//
//  2. Google Custom Search API (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX)
//     C'est la façon LÉGALE de "chercher via Google" sur des sites
//     précis (Jobivoire, Emploi.ci, Educarriere, Agence Emploi
//     Jeunes...) : on utilise l'API officielle de Google
//     (Programmable Search Engine), jamais un scraping direct de ces
//     sites ni de la page de résultats Google elle-même. Gratuite
//     jusqu'à 100 requêtes/jour, payante au-delà. Configuration :
//       a. https://programmablesearchengine.google.com/ → créer un
//          moteur de recherche, le restreindre aux sites voulus
//          → récupérer l'identifiant "cx".
//       b. https://console.cloud.google.com/apis/library/customsearch.googleapis.com
//          → activer l'API, créer une clé API.
//       c. Renseigner GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX, et
//          GOOGLE_SEARCH_REQUETES dans .env (voir chargerRequetesGoogle
//          ci-dessous pour la liste par défaut).
//
//  ⚠️ POURQUOI PAS DE SCRAPING DIRECT DE JOBIVOIRE / EMPLOI.CI ?
//  Ces deux plateformes n'exposent aucun flux RSS ni API publique
//  documentée (vérifié — aucune trouvée), et leurs conditions
//  d'utilisation ne mentionnent pas d'autorisation explicite pour un
//  robot tiers à republier leurs annonces. Un scraping direct de leurs
//  pages HTML serait donc une extraction non autorisée. La méthode
//  conforme retenue ici est de les interroger via l'API Google Custom
//  Search restreinte à leur domaine (site:jobivoire.ci, site:emploi.ci)
//  — EduConcoursCI ne récupère alors que ce que Google a déjà indexé
//  publiquement, via une API que Google autorise explicitement pour cet
//  usage, exactement comme pour Educarriere et l'Agence Emploi Jeunes.
//
//  ⚠️ LinkedIn Jobs : aucune des deux méthodes ci-dessus n'y donne
//  accès. LinkedIn interdit explicitement le scraping dans ses
//  conditions d'utilisation, et sa Jobs API officielle n'est
//  accessible que via un partenariat entreprise (non disponible en
//  self-service). Aucune offre LinkedIn n'est donc récupérée ici —
//  c'est une limite réelle et documentée, pas un oubli.
//
//  ⚠️ "Google Jobs" (l'encart d'offres qui s'affiche dans Google
//  Search) n'a pas d'API publique de LECTURE pour un site tiers comme
//  EduConcoursCI — au contraire, ce sont les sites d'offres qui
//  soumettent leurs propres annonces à Google via des données
//  structurées (schema.org/JobPosting) pour y apparaître. On ne peut
//  donc pas "récupérer depuis Google Jobs" au sens where l'énoncé
//  l'entend ; l'API Custom Search ci-dessus est la façon légitime la
//  plus proche de "chercher via Google" pour un agrégateur tiers.
// ============================================================

const Parser = require("rss-parser");
const cron   = require("node-cron");
const crypto = require("crypto");
const Emploi = require("../models/Emploi");
const { extraireDateLimite } = require("../utils/dateLimite");

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

// ── Type d'opportunité (distinct du type de contrat) : emploi / stage
//    / alternance / freelance — point 4 du cahier des charges Emploi ─
function devinerTypeOpportunite(typeContrat) {
  const map = { Stage: "stage", Alternance: "alternance", Freelance: "freelance" };
  return map[typeContrat] || "emploi";
}

// ── Devine la ville à partir du titre (par défaut Abidjan) ────
const VILLES_CI = [
  "Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Korhogo",
  "Daloa", "Man", "Gagnoa", "Abengourou", "Divo",
];

// ── Correspondance ville → région (districts/régions administratifs
//    ivoiriens) pour permettre le filtre "région" du point 7. Ce n'est
//    volontairement PAS une liste exhaustive des ~30 régions du pays :
//    seulement celles des villes que l'on sait effectivement détecter
//    ci-dessus. Une ville absente de cette liste garde region = null
//    plutôt qu'une région devinée au hasard.
const REGION_PAR_VILLE = {
  "Abidjan": "District Autonome d'Abidjan",
  "Yamoussoukro": "District Autonome de Yamoussoukro",
  "Bouaké": "Région du Gbêkê",
  "Daloa": "Région du Haut-Sassandra",
  "San-Pédro": "Région de San-Pédro",
  "Korhogo": "Région du Poro",
  "Man": "Région du Tonkpi",
  "Gagnoa": "Région du Gôh",
  "Abengourou": "Région de l'Indénié-Djuablin",
  "Divo": "Région du Lôh-Djiboua",
};

function devinerVille(titre) {
  const t = titre || "";
  return VILLES_CI.find((v) => t.includes(v)) || "Abidjan";
}

function devinerRegion(ville) {
  return REGION_PAR_VILLE[ville] || null;
}

// ── Niveau d'études : uniquement si un motif reconnu apparaît dans le
//    texte, jamais deviné (point 4 : ne pas inventer une information
//    absente de la source) ──────────────────────────────────────────
const NIVEAUX_ETUDES = [
  { motif: /\bbac\s*\+\s*5\b|\bmaster\s*2\b|\bmastère\b/i, niveau: "Bac+5 / Master" },
  { motif: /\bbac\s*\+\s*4\b|\bmaster\s*1\b/i, niveau: "Bac+4" },
  { motif: /\bbac\s*\+\s*3\b|\blicence\b/i, niveau: "Bac+3 / Licence" },
  { motif: /\bbac\s*\+\s*2\b|\bbts\b|\bdut\b/i, niveau: "Bac+2 / BTS-DUT" },
  { motif: /\bdoctorat\b|\bphd\b/i, niveau: "Doctorat" },
  { motif: /\bingénieur\b/i, niveau: "Bac+5 / Ingénieur" },
  { motif: /\bcap\b|\bbepc\b/i, niveau: "CAP / BEPC" },
  { motif: /\bbac(?!\s*\+)\b/i, niveau: "Baccalauréat" },
];
function devinerNiveauEtudes(texte) {
  const t = texte || "";
  const trouve = NIVEAUX_ETUDES.find((n) => n.motif.test(t));
  return trouve ? trouve.niveau : null;
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
// Renvoie { entries, erreur } plutôt qu'un simple tableau : synchroniser()
// a besoin de distinguer "0 offre trouvée" (succès, source vide) d'une
// vraie panne, pour journaliser correctement dans sync_log_emploi (point
// 13 — l'admin doit voir précisément quelle source a échoué et pourquoi).
async function lireFlux(source) {
  try {
    const flux = await parser.parseURL(source.url);
    const entries = (flux.items || [])
      .filter((item) => item.title && estUneOffreValide(item.title))
      .slice(0, 30)
      .map((item) => {
        const titre = item.title.trim().slice(0, 200);
        const lien = item.link || null;
        const image =
          item.enclosure?.url ||
          item["media:content"]?.$?.url ||
          null;
        const typeContrat = devinerTypeContrat(titre);
        const ville = devinerVille(titre);
        const texteComplet = `${titre} ${item.contentSnippet || item.content || ""}`;
        return {
          titre,
          entreprise: source.nom,
          typeContrat,
          typeOpportunite: devinerTypeOpportunite(typeContrat),
          ville,
          region: devinerRegion(ville),
          niveauEtudes: devinerNiveauEtudes(texteComplet),
          description: (item.contentSnippet || item.content || titre).slice(0, 2000),
          dateLimite: extraireDateLimite(texteComplet) ? extraireDateLimite(texteComplet) : null,
          dateLimiteDate: extraireDateLimite(texteComplet),
          lienExterne: lien,
          sourceNom: source.nom,
          sourceUrl: source.url,
          imageUrl: image,
          identifiantExterne: item.guid || lien,
          hash: hacher(titre, lien || ""),
        };
      });
    return { entries, erreur: null };
  } catch (err) {
    // Une source en panne ne doit jamais bloquer les autres
    console.warn(`⚠️  Flux emploi indisponible (${source.nom}) :`, err.message);
    return { entries: [], erreur: err.message };
  }
}

// ── SOURCE 2 : Google Custom Search API (sites autorisés) ─────
function googleSearchConfigure() {
  return Boolean(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX);
}

// Requêtes ciblées avec l'opérateur site: sur les plateformes emploi
// légitimes identifiées pour la Côte d'Ivoire (voir liste complète et
// statut gratuit/payant en tête de fichier). Jobivoire et Emploi.ci
// sont les deux sources prioritaires demandées, intégrées ici via
// Google Custom Search puisqu'aucune des deux ne publie de flux RSS
// ou d'API publique (voir note en tête de fichier).
//
// Site d'actualité : Abidjan.net, le plus grand portail d'actualité
// ivoirien, a bien une rubrique Emploi ACTIVE et alimentée quotidien-
// nement (annonces.abidjan.net/emplois — plus de 60 000 annonces,
// vérifié) — c'est le cas que ce commentaire documente explicitement
// car c'est le type de source mentionné. Mais ce n'est pas un flux
// RSS : Abidjan.net ne propose de flux RSS que pour ses rubriques
// d'ACTUALITÉ (politique, économie, société...), jamais pour les
// petites annonces d'emploi elles-mêmes, et son lien de menu
// "Emplois" renvoie en réalité vers un site tiers du même groupe
// (jobafrique.com), qui n'affichait aucune offre pour la Côte
// d'Ivoire au moment de la vérification. La rubrique
// annonces.abidjan.net/emplois est donc intégrée ici via Google
// Custom Search, comme les autres — le filtre estUneOffreValide()
// ci-dessus reste essentiel sur cette source, car ses annonces sont
// des dépôts libres d'internautes (qualité et sérieux variables,
// contrairement à un site emploi dédié).
//
// CoinAfrique, Afribaba, Jumia Deals et les groupes Facebook restent
// volontairement exclus de cette liste par défaut : ce sont des
// petites annonces informelles, sans structure d'offre standardisée,
// plus difficiles à filtrer proprement et plus exposées aux fausses
// annonces — un admin peut les ajouter explicitement via
// GOOGLE_SEARCH_REQUETES s'il le souhaite, en connaissance de cause.
// LinkedIn est exclu car son scraping est interdit par ses CGU (voir
// note de tête de fichier).
function chargerRequetesGoogle() {
  if (process.env.GOOGLE_SEARCH_REQUETES) {
    return process.env.GOOGLE_SEARCH_REQUETES.split(",").map((q) => q.trim()).filter(Boolean);
  }
  return [
    "site:jobivoire.ci offre emploi",
    "site:emploi.ci recrutement",
    "site:annonces.abidjan.net/emplois offre",
    "site:projobivoire.com offre emploi",
    "site:emploi.educarriere.ci recrutement",
    "site:agenceemploijeunes.ci offre",
    "site:rmo-jobcenter.com offre emploi",
    "site:novojob.com/cote-d-ivoire",
    "site:jobmejobs.com Côte d'Ivoire",
    "site:ci.trabajo.org",
    "site:fr.indeed.com emploi Côte d'Ivoire",
  ];
}

async function rechercherViaGoogle(requete) {
  if (!googleSearchConfigure()) return { entries: [], erreur: null };
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
      return { entries: [], erreur: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const entries = (data.items || [])
      .filter((item) => item.title && estUneOffreValide(item.title))
      .map((item) => {
        const domaine = new URL(item.link).hostname.replace("www.", "");
        const titre = item.title.trim().slice(0, 200);
        const typeContrat = devinerTypeContrat(titre + " " + (item.snippet || ""));
        const ville = devinerVille(titre + " " + (item.snippet || ""));
        const texteComplet = `${titre} ${item.snippet || ""}`;
        return {
          titre,
          entreprise: deviserEntrepriseDepuisDomaine(domaine),
          typeContrat,
          typeOpportunite: devinerTypeOpportunite(typeContrat),
          ville,
          region: devinerRegion(ville),
          niveauEtudes: devinerNiveauEtudes(texteComplet),
          description: (item.snippet || titre).slice(0, 2000),
          dateLimite: extraireDateLimite(texteComplet),
          dateLimiteDate: extraireDateLimite(texteComplet),
          lienExterne: item.link,
          sourceNom: domaine,
          sourceUrl: item.link,
          imageUrl: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src || null,
          identifiantExterne: item.link,
          hash: hacher(titre, item.link),
        };
      });
    return { entries, erreur: null };
  } catch (err) {
    console.warn("⚠️  Google Custom Search indisponible :", err.message);
    return { entries: [], erreur: err.message };
  }
}

// ── Synchronise toutes les sources et alimente la base ────────
// Journalise CHAQUE source individuellement dans sync_log_emploi (succès
// ou erreur) — c'est ce journal que l'admin consulte pour voir en un
// coup d'œil quelles sources fonctionnent (point 13 du cahier des
// charges), plutôt que de devoir lire les logs serveur.
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
    const { entries, erreur } = await lireFlux(source);
    const nb = entries.length ? await Emploi.upsertDepuisFlux(entries) : 0;
    total += nb;
    await Emploi.logSynchro({
      sourceNom: source.nom,
      statut: erreur ? "erreur" : "succes",
      nombreOffres: nb,
      messageErreur: erreur,
    }).catch(() => {}); // le journal ne doit jamais faire échouer la synchro elle-même
  }

  for (const requete of requetesGoogle) {
    const { entries, erreur } = await rechercherViaGoogle(requete);
    const nb = entries.length ? await Emploi.upsertDepuisFlux(entries) : 0;
    total += nb;
    await Emploi.logSynchro({
      sourceNom: `Google Custom Search — ${requete}`,
      statut: erreur ? "erreur" : "succes",
      nombreOffres: nb,
      messageErreur: erreur,
    }).catch(() => {});
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
