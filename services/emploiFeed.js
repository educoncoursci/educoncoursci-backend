// ============================================================
//  services/emploiFeed.js
//  Agrège automatiquement des offres d'emploi/stages externes
//  vers la table `offres_emploi`, sur le même principe que
//  services/actualitesFeed.js (flux RSS, dédoublonnage par hash,
//  planification via cron).
//
//  ⚠️ Sources compatibles : uniquement des flux RSS/XML publics.
//  - Educarriere.ci, Jobartis, Emploi.ci, RMO, ou tout autre site
//    d'emploi ivoirien/africain qui expose un flux RSS peuvent
//    être branchés ici sans toucher au code, via la variable
//    d'environnement EMPLOI_FLUX_URLS (séparées par des virgules).
//  - LinkedIn et Google pour les emplois ("Google Jobs") ne
//    fournissent PAS de flux public destiné à l'agrégation par
//    des tiers ; les récupérer par scraping viole leurs conditions
//    d'utilisation. Ils ne sont donc pas branchés ici. La bonne
//    pratique pour apparaître sur Google Jobs est inverse : publier
//    ses propres offres avec le balisage schema.org/JobPosting
//    pour que Google les indexe lui-même (voir server.js / SEO).
//  - Cet environnement de développement n'a pas d'accès réseau
//    pour vérifier une URL de flux en direct : teste et ajuste la
//    liste une fois en ligne, comme c'est déjà indiqué pour
//    services/actualitesFeed.js.
// ============================================================

const Parser = require("rss-parser");
const cron   = require("node-cron");
const crypto = require("crypto");
const Emploi = require("../models/Emploi");

const parser = new Parser({ timeout: 10000 });

// ── Sources par défaut (modifiables sans toucher au code) ────
// Vide par défaut : à renseigner via EMPLOI_FLUX_URLS une fois
// une ou plusieurs URLs de flux RSS confirmées en ligne.
const SOURCES_PAR_DEFAUT = [];

function chargerSources() {
  if (process.env.EMPLOI_FLUX_URLS) {
    return process.env.EMPLOI_FLUX_URLS.split(",")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ nom: new URL(url).hostname.replace("www.", ""), url }));
  }
  return SOURCES_PAR_DEFAUT;
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

function hacher(titre, lien) {
  return crypto.createHash("sha256").update(`${titre}|${lien}`).digest("hex");
}

// ── Récupère et met en forme un flux RSS d'offres ──────────────
async function lireFlux(source) {
  try {
    const flux = await parser.parseURL(source.url);
    return (flux.items || [])
      .filter((item) => item.title && estUneOffreValide(item.title))
      .slice(0, 30)
      .map((item) => {
        const titre = item.title.trim().slice(0, 200);
        const lien = item.link || null;
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
          hash: hacher(titre, lien || ""),
        };
      });
  } catch (err) {
    // Une source en panne ne doit jamais bloquer les autres
    console.warn(`⚠️  Flux emploi indisponible (${source.nom}) :`, err.message);
    return [];
  }
}

// ── Synchronise toutes les sources et alimente la base ────────
async function synchroniser() {
  const sources = chargerSources();
  if (!sources.length) {
    console.log(
      "ℹ️  Aucun flux emploi configuré (variable EMPLOI_FLUX_URLS vide).",
    );
    return 0;
  }

  let total = 0;
  for (const source of sources) {
    const entries = await lireFlux(source);
    if (entries.length) {
      const inserees = await Emploi.upsertDepuisFlux(entries);
      total += inserees;
    }
  }

  if (total > 0) {
    console.log(`💼 Offres d'emploi : ${total} nouvelle(s) offre(s) agrégée(s).`);
  }
  return total;
}

// ── Planifie la synchronisation automatique ───────────────────
function demarrerPlanification() {
  if (!process.env.EMPLOI_FLUX_URLS) return; // rien à planifier tant que non configuré

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
