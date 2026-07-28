// ============================================================
//  services/actualitesFeed.js
//  Alimente en continu la table `actualites` à partir de flux
//  RSS de médias/institutions ivoiriens, à la manière d'un
//  agrégateur (ex : ablanian.ci).
//
//  Fonctionnement :
//   1. On interroge une liste de flux RSS toutes les X minutes
//      (cron, voir demarrerPlanification()).
//   2. On ne garde que les articles dont le titre correspond à
//      nos thématiques (concours, fonction publique, examens,
//      emploi, bourses...).
//   3. Chaque article est haché (titre + lien) pour éviter les
//      doublons en base (ON CONFLICT DO NOTHING).
//
//  ⚠️ Important : les URLs de flux par défaut ci-dessous sont
//  des flux publics de médias ivoiriens généralistes. Comme cet
//  environnement de développement n'a pas d'accès réseau pour
//  les vérifier en direct, vérifie/ajuste-les une fois en ligne
//  (ex: via un test manuel sur POST /api/actualites/actualiser
//  ou en consultant les logs Railway). Tu peux aussi surcharger
//  entièrement la liste via la variable d'environnement
//  ACTUALITES_FLUX_URLS (séparées par des virgules), par ex.
//  pour brancher un flux ablanian.ci si celui-ci en expose un.
// ============================================================

const Parser = require("rss-parser");
const cron   = require("node-cron");
const crypto = require("crypto");
const Actualite = require("../models/Actualite");

const parser = new Parser({ timeout: 10000 });

// ── Sources par défaut (modifiables sans toucher au code) ────
const SOURCES_PAR_DEFAUT = [
  { nom: "Fraternité Matin", url: "https://www.fratmat.info/feed", tag: "Actualité" },
  { nom: "Abidjan.net",      url: "https://news.abidjan.net/xml/rss.xml", tag: "Actualité" },
  { nom: "AIP",              url: "https://aip.ci/feed/", tag: "Actualité" },
];

function chargerSources() {
  if (process.env.ACTUALITES_FLUX_URLS) {
    return process.env.ACTUALITES_FLUX_URLS.split(",")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ nom: new URL(url).hostname.replace("www.", ""), url, tag: "Actualité" }));
  }
  return SOURCES_PAR_DEFAUT;
}

// ── Mots-clés définissant ce qui intéresse EduConcoursCI ─────
const MOTS_CLES = [
  "concours", "cafop", "ena ", "ena,", "fonction publique", "examen", "bepc",
  "baccalauréat", "bac ", "résultat", "inscription", "recrutement", "emploi",
  "stage", "bourse", "université", "école normale", "gendarmerie", "police",
  "douane", "armée", "enseignant", "instituteur", "guca",
];

function correspondAuxThemes(titre) {
  const t = (titre || "").toLowerCase();
  return MOTS_CLES.some((mot) => t.includes(mot));
}

function devinerTag(titre) {
  const t = (titre || "").toLowerCase();
  if (t.includes("cafop")) return "CAFOP";
  if (t.includes("ena")) return "ENA";
  if (t.includes("résultat")) return "Résultats";
  if (t.includes("emploi") || t.includes("recrutement") || t.includes("stage")) return "Emploi";
  if (t.includes("bourse")) return "Bourses";
  if (t.includes("examen") || t.includes("bac") || t.includes("bepc")) return "Examens";
  return "Actualité";
}

function hacher(titre, lien) {
  return crypto.createHash("sha256").update(`${titre}|${lien}`).digest("hex");
}

// ── Récupère et filtre un flux RSS ────────────────────────────
async function lireFlux(source) {
  try {
    const flux = await parser.parseURL(source.url);
    return (flux.items || [])
      .filter((item) => item.title && correspondAuxThemes(item.title))
      .slice(0, 10)
      .map((item) => ({
        titre: item.title.trim().slice(0, 300),
        tag: devinerTag(item.title),
        source_nom: source.nom,
        source_url: source.url,
        lien: item.link || null,
        hash: hacher(item.title.trim(), item.link || ""),
        publie_le: item.isoDate ? new Date(item.isoDate) : new Date(),
      }));
  } catch (err) {
    // Une source en panne ne doit jamais bloquer les autres
    console.warn(`⚠️  Flux actualités indisponible (${source.nom}) :`, err.message);
    return [];
  }
}

// ── Synchronise toutes les sources et alimente la base ────────
async function synchroniser() {
  const sources = chargerSources();
  let total = 0;

  for (const source of sources) {
    const entries = await lireFlux(source);
    if (entries.length) {
      const inserees = await Actualite.upsertDepuisFlux(entries);
      total += inserees;
    }
  }

  await Actualite.purgerAnciennes(60);

  if (total > 0) {
    console.log(`📰 Actualités : ${total} nouvel(les) article(s) ajouté(s) au carrousel.`);
  }
  return total;
}

// ── Planifie la synchronisation automatique ───────────────────
function demarrerPlanification() {
  // Première synchronisation peu après le démarrage du serveur
  setTimeout(() => {
    synchroniser().catch((err) =>
      console.error("Erreur synchronisation actualités (démarrage) :", err.message),
    );
  }, 15000);

  // Puis toutes les 30 minutes
  cron.schedule("*/30 * * * *", () => {
    synchroniser().catch((err) =>
      console.error("Erreur synchronisation actualités (planifiée) :", err.message),
    );
  });

  console.log("🕒 Planification des actualités activée (toutes les 30 minutes).");
}

module.exports = { synchroniser, demarrerPlanification };
