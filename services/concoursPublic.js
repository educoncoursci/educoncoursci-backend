// ============================================================
//  services/concoursPublic.js
//  Rubrique publique « Concours » : DEUX onglets seulement.
//
//   en_cours : candidatures officiellement ouvertes
//              (date d'ouverture atteinte, date limite non dépassée)
//   a_venir  : ouverture officielle datée dans les 30 prochains jours
//
//  Tout est calculé À LA LECTURE à partir des dates, à la date du jour en
//  Africa/Abidjan : un concours change donc de rubrique à minuit sans
//  aucune action manuelle et sans dépendre d'une tâche planifiée.
//
//  Règles de fiabilité (aucune information n'est inventée) :
//   • sans source officielle (lien ou référence), un concours n'est JAMAIS
//     publié dans les deux onglets ;
//   • sans date d'ouverture précise, il n'est pas classé (ni « en cours »,
//     ni « à venir ») ;
//   • sans date limite, un concours n'est « en cours » que si un admin a
//     revérifié sa source dans les 30 derniers jours (sinon on ne peut pas
//     exclure qu'il s'agisse d'une ancienne annonce) ;
//   • suspendu / annulé / archivé : jamais publié comme ouvert ou à venir.
// ============================================================

const { query } = require("../config/database");
const { aujourdhuiAbidjan } = require("./concoursStatut");

const FENETRE_A_VENIR_JOURS = 30;
const VALIDITE_VERIFICATION_JOURS = 30;
const NON_COMMUNIQUE = "Information non communiquée officiellement";

/** AAAA-MM-JJ + n jours → AAAA-MM-JJ (arithmétique UTC : aucun décalage d'heure d'été/fuseau). */
function ajouterJours(iso, n) {
  const [a, m, j] = String(iso).slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + n));
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours entiers entre deux dates AAAA-MM-JJ (b - a). */
function ecartJours(a, b) {
  const t = (s) => { const [y, m, j] = String(s).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, j); };
  return Math.round((t(b) - t(a)) / 86400000);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const jourValide = (v) => (typeof v === "string" && ISO.test(v.slice(0, 10)) ? v.slice(0, 10) : null);
const lienValide = (v) => (typeof v === "string" && /^https?:\/\/[^\s]+\.[^\s]+/i.test(v.trim()) ? v.trim() : null);

/** Référence officielle exploitable : un lien http(s) ou, à défaut, une mention de source renseignée. */
function sourceOfficielle(c) {
  const lien = lienValide(c.lien_officiel) || lienValide(c.source_url);
  const mention = typeof c.source_info === "string" && c.source_info.trim().length >= 3 ? c.source_info.trim() : null;
  return { lien, mention, ok: !!(lien || mention) };
}

/**
 * Classe un concours : "en_cours" | "a_venir" | "termine" | null (non publié).
 * Retourne { rubrique, raison } ; `raison` explique pourquoi un concours n'est pas publié
 * (utile à l'administration pour compléter la fiche).
 */
function classer(c, aujourdhui = aujourdhuiAbidjan()) {
  const ouv = jourValide(c.date_ouverture);
  const clo = jourValide(c.date_cloture);
  const ver = jourValide(c.verifie_le);
  const src = sourceOfficielle(c);

  if (c.archive === true) return { rubrique: null, raison: "Archivé" };
  if (["suspendu", "annulé"].includes(c.statut)) return { rubrique: null, raison: "Suspendu ou annulé" };

  // Un concours clôturé reste « terminé » (non affiché dans les deux onglets).
  if (clo && aujourdhui > clo) return { rubrique: "termine", raison: "Date limite dépassée" };
  if (c.statut === "résultats" || c.statut === "en attente de résultats") return { rubrique: "termine", raison: "Candidatures closes" };

  // « Date vérifiée » décochée par l'admin = dates indicatives, non confirmées par un communiqué officiel
  if (c.date_verifiee === false) return { rubrique: null, raison: "Dates indicatives : à confirmer par un communiqué officiel" };
  if (!src.ok) return { rubrique: null, raison: "Source officielle manquante" };
  if (!ouv) return { rubrique: null, raison: "Date d'ouverture officielle non renseignée" };

  if (aujourdhui < ouv) {
    if (ouv <= ajouterJours(aujourdhui, FENETRE_A_VENIR_JOURS)) return { rubrique: "a_venir", raison: "" };
    return { rubrique: null, raison: `Ouverture dans plus de ${FENETRE_A_VENIR_JOURS} jours` };
  }

  // Ouverture atteinte
  if (clo) return { rubrique: "en_cours", raison: "" };
  if (ver && ecartJours(ver, aujourdhui) <= VALIDITE_VERIFICATION_JOURS) return { rubrique: "en_cours", raison: "" };
  return { rubrique: null, raison: "Sans date limite : source à revérifier (moins de 30 jours)" };
}

/** Fiche publique : champs manquants → null (le frontend affiche « Information non communiquée officiellement »). */
function versFichePublique(c, aujourdhui = aujourdhuiAbidjan()) {
  const { rubrique } = classer(c, aujourdhui);
  const ouv = jourValide(c.date_ouverture);
  const clo = jourValide(c.date_cloture);
  const src = sourceOfficielle(c);
  const texte = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const nombre = (v) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : null);
  const age = c.age_max != null ? Number(c.age_max) : null;
  return {
    id: c.id,
    titre: c.titre,
    organisme: texte(c.organisme),
    poste: texte(c.categorie),
    places: nombre(c.places),
    date_ouverture: ouv,
    date_cloture: clo,
    jours_avant_ouverture: ouv && aujourdhui < ouv ? ecartJours(aujourdhui, ouv) : null,
    jours_restants: clo && aujourdhui <= clo ? ecartJours(aujourdhui, clo) : null,
    statut_public: rubrique,
    conditions: texte(c.conditions),
    niveau: texte(c.niveau),
    age_min: c.age_min != null ? Number(c.age_min) : null,
    age_max: age,
    dossier: Array.isArray(c.pieces) && c.pieces.length ? c.pieces : null,
    frais: c.frais != null && Number(c.frais) > 0 ? Number(c.frais) : (Number(c.frais) === 0 && texte(c.frais_detail) ? 0 : null),
    frais_detail: texte(c.frais_detail),
    procedure: texte(c.procedure_inscription),
    lien_inscription: lienValide(c.lien_officiel),
    source_url: lienValide(c.source_url) || lienValide(c.lien_officiel),
    source_mention: src.mention,
    verifie_le: jourValide(c.verifie_le),
    logo: c.structure_logo_url || null,
    sigle: c.structure_sigle || null,
    couleur: c.couleur || null,
    premium: !!c.premium,
  };
}

const COLONNES = `concours.*, s.logo_url AS structure_logo_url, s.sigle AS structure_sigle,
  to_char(concours.date_ouverture, 'YYYY-MM-DD') AS date_ouverture,
  to_char(concours.date_cloture, 'YYYY-MM-DD') AS date_cloture,
  to_char(concours.verifie_le, 'YYYY-MM-DD') AS verifie_le`;

function lignes(rows) {
  return rows.map((r) => {
    let pieces = [];
    if (Array.isArray(r.pieces)) pieces = r.pieces;
    else { try { pieces = JSON.parse(r.pieces || "[]"); } catch { pieces = []; } }
    if (!Array.isArray(pieces)) pieces = [];
    return { ...r, pieces };
  });
}

/** Charge les concours candidats (non archivés) depuis la base. */
async function charger() {
  const r = await query(
    `SELECT ${COLONNES} FROM concours
     LEFT JOIN structures s ON s.id = concours.structure_id
     WHERE COALESCE(concours.archive, FALSE) = FALSE`,
  );
  return lignes(r.rows);
}

/** Les deux onglets, triés : en cours (date limite la plus proche d'abord), à venir (ouverture la plus proche d'abord). */
async function rubriques(aujourdhui = aujourdhuiAbidjan(), source = null) {
  const toutes = source || (await charger());
  const en_cours = [];
  const a_venir = [];
  for (const c of toutes) {
    const { rubrique } = classer(c, aujourdhui);
    if (rubrique === "en_cours") en_cours.push(versFichePublique(c, aujourdhui));
    else if (rubrique === "a_venir") a_venir.push(versFichePublique(c, aujourdhui));
  }
  const parCloture = (a, b) => (a.date_cloture || "9999") < (b.date_cloture || "9999") ? -1 : (a.date_cloture || "9999") > (b.date_cloture || "9999") ? 1 : 0;
  en_cours.sort(parCloture);
  a_venir.sort((a, b) => (a.date_ouverture < b.date_ouverture ? -1 : a.date_ouverture > b.date_ouverture ? 1 : 0));
  return { aujourdhui, fenetre_jours: FENETRE_A_VENIR_JOURS, en_cours, a_venir };
}

/** Fiche seule (détail) : calcule la rubrique du jour. */
function fichePourDetail(c, aujourdhui = aujourdhuiAbidjan()) {
  return versFichePublique(c, aujourdhui);
}

/** Rapport administrateur : pour chaque concours, publié ou non, et pourquoi. */
async function rapportPublication(aujourdhui = aujourdhuiAbidjan()) {
  const r = await query(
    `SELECT ${COLONNES} FROM concours LEFT JOIN structures s ON s.id = concours.structure_id
     ORDER BY concours.created_at DESC`,
  );
  return lignes(r.rows).map((c) => {
    const { rubrique, raison } = classer(c, aujourdhui);
    return { id: c.id, titre: c.titre, organisme: c.organisme, rubrique, raison, date_ouverture: jourValide(c.date_ouverture), date_cloture: jourValide(c.date_cloture) };
  });
}

module.exports = {
  FENETRE_A_VENIR_JOURS, VALIDITE_VERIFICATION_JOURS, NON_COMMUNIQUE,
  ajouterJours, ecartJours, sourceOfficielle, classer, versFichePublique,
  charger, rubriques, fichePourDetail, rapportPublication,
};
