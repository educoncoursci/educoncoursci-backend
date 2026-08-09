// ============================================================
//  services/concoursFeed.js
//  Lot 18 — Détecte automatiquement de nouveaux concours publiés,
//  à partir de flux RSS (mêmes principes que services/actualitesFeed.js
//  et services/emploiFeed.js déjà en place).
//
//  Différence volontaire avec ces deux services : ici, rien n'est
//  publié automatiquement. Chaque détection atterrit dans
//  `concours_suggestions` (file de validation), et c'est un admin
//  qui approuve ou rejette en un clic. Une mauvaise date de concours
//  publiée par erreur peut faire louper un examen à des milliers de
//  candidats — le risque n'est pas comparable à un article d'actu.
//
//  Les sources sont gérées en base (table concours_sources, modifiable
//  depuis l'admin sans toucher au code, onglet "Sources" de
//  /admin/concours) — c'est la méthode recommandée pour ajouter des
//  sources, car aucune source de secours par défaut n'est fournie ici.
//
//  ⚠️ Recherche effectuée (08/2026) pour trouver des flux RSS fiables
//  de médias ivoiriens (Fraternité Matin, Abidjan.net, AIP) : aucune
//  URL de flux RSS actuelle et fonctionnelle n'a pu être confirmée
//  avec certitude — ces sites ont soit changé de plateforme (Fraternité
//  Matin a migré vers beta.fratmat.info), soit bloquent l'accès
//  automatisé (robots.txt), soit n'ont pas de flux RSS identifiable.
//  Plutôt que d'inclure des URLs devinées et probablement cassées
//  (comme l'ancienne liste qui produisait des erreurs 404 en
//  production), aucune source de secours par défaut n'est fournie :
//  sans configuration explicite dans /admin/concours → Sources, ce
//  service ne détecte simplement rien, sans erreur ni fausse
//  information. La détection automatique dépend donc d'un admin qui
//  ajoute au moins une source RSS valide (vérifiée manuellement au
//  préalable, par exemple en collant l'URL dans un lecteur RSS) —
//  voir aussi scripts/verifier-sources-rss.js pour tester une URL
//  avant de l'ajouter.
// ============================================================

const Parser = require("rss-parser");
const cron   = require("node-cron");
const crypto = require("crypto");
const ConcoursSource     = require("../models/ConcoursSource");
const ConcoursSuggestion = require("../models/ConcoursSuggestion");

const parser = new Parser({ timeout: 10000 });

// ── Mots-clés resserrés sur les concours eux-mêmes (plus stricts
// que ceux d'actualitesFeed, pour limiter le bruit dans la file
// de validation) ─────────────────────────────────────────────
// Note : "enstp" volontairement absent — cet établissement n'existe
// plus sous ce nom depuis 1996 (fusionné dans l'INP-HB, devenu
// l'ESTP) ; un flux qui en parlerait relaierait probablement une
// confusion avec l'ENSTP de Yaoundé (Cameroun), pas la CI.
const MOTS_CLES_CONCOURS = [
  "concours", "cafop", "ena ", "ena,", "infas", "insfs", "injs",
  "recrutement fonction publique", "concours direct", "concours professionnel",
  "gendarmerie", "police nationale", "douanes ivoiriennes", "eaux et forêts",
  "ipnetp", "école normale", "grande école", "concours administratif",
  "inp-hb", "infj", "magistrature", "faci", "forces armées",
];

function correspond(titre) {
  const t = (titre || "").toLowerCase();
  return MOTS_CLES_CONCOURS.some((mot) => t.includes(mot));
}

function hacher(titre, lien) {
  return crypto.createHash("sha256").update(`${titre}|${lien}`).digest("hex");
}

async function chargerSources() {
  // Aucune source de secours par défaut (voir note en tête de
  // fichier) — uniquement les sources explicitement ajoutées par un
  // admin depuis /admin/concours → Sources & Suggestions.
  return await ConcoursSource.findActives().catch(() => []);
}

async function lireFlux(source) {
  try {
    const flux = await parser.parseURL(source.url);
    return (flux.items || [])
      .filter((item) => item.title && correspond(item.title))
      .slice(0, 15)
      .map((item) => ({
        titre: item.title.trim().slice(0, 300),
        extrait: (item.contentSnippet || item.content || "").trim().slice(0, 500),
        sourceNom: source.nom,
        sourceUrl: source.url,
        lien: item.link || null,
        hash: hacher(item.title.trim(), item.link || source.url),
      }));
  } catch (err) {
    console.error(`Erreur lecture flux concours "${source.nom}" :`, err.message);
    return [];
  }
}

async function detecterNouveauxConcours() {
  const sources = await chargerSources();
  let totalDetectes = 0;

  for (const source of sources) {
    const items = await lireFlux(source);
    for (const item of items) {
      const cree = await ConcoursSuggestion.creer(item);
      if (cree) totalDetectes++;
    }
  }

  if (totalDetectes > 0) {
    console.log(`🔎 ${totalDetectes} nouvelle(s) suggestion(s) de concours détectée(s), en attente de validation admin.`);
  }
  return totalDetectes;
}

function demarrerPlanification() {
  // Un premier passage 1 minute après le démarrage
  setTimeout(() => {
    detecterNouveauxConcours().catch((err) =>
      console.error("Erreur détection concours (démarrage) :", err.message),
    );
  }, 60000);

  // Puis toutes les 6 heures
  cron.schedule("0 */6 * * *", () => {
    detecterNouveauxConcours().catch((err) =>
      console.error("Erreur détection concours (planifié) :", err.message),
    );
  });

  console.log("🔎 Détection automatique de nouveaux concours activée (toutes les 6h).");
}

module.exports = { detecterNouveauxConcours, demarrerPlanification };
