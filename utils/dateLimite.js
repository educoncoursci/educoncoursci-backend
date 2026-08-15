// ============================================================
//  utils/dateLimite.js
//  Reconnaissance best-effort d'une date limite dans un texte
//  libre (RSS, résultat de recherche, saisie admin). Utilisé par
//  services/emploiFeed.js (agrégation) et emploiController.js
//  (saisie manuelle) pour remplir date_limite_date, la colonne
//  DATE exploitable en SQL pour calculer l'expiration.
//
//  IMPORTANT : ne DEVINE jamais une date — retourne null si rien de
//  fiable n'est trouvé, conformément à la consigne "si une information
//  n'est pas disponible sur la source, ne l'invente pas" (point 4 du
//  cahier des charges Emploi). Une offre sans date_limite_date connue
//  n'est jamais traitée comme expirée automatiquement (voir
//  models/Emploi.js — le seul risque d'un faux négatif ici est de ne
//  pas détecter une date réelle, jamais d'en inventer une).
// ============================================================

const MOIS_FR = {
  "janvier": 0, "février": 1, "fevrier": 1, "mars": 2, "avril": 3, "mai": 4,
  "juin": 5, "juillet": 6, "août": 7, "aout": 7, "septembre": 8,
  "octobre": 9, "novembre": 10, "décembre": 11, "decembre": 11,
};

function dateValide(annee, moisIndex, jour) {
  if (moisIndex < 0 || moisIndex > 11 || jour < 1 || jour > 31) return null;
  const d = new Date(Date.UTC(annee, moisIndex, jour));
  // Rejette les dates manifestement erronées (ex: 31 février) — Date
  // "corrige" silencieusement en débordant sur le mois suivant.
  if (d.getUTCMonth() !== moisIndex || d.getUTCDate() !== jour) return null;
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// Cherche un motif de date explicite (pas de déduction relative type
// "dans 15 jours" — trop ambigu selon la date de scraping vs la date
// de publication réelle).
function extraireDateLimite(texte) {
  if (!texte) return null;
  const t = texte.toLowerCase();

  // Formats numériques JJ/MM/AAAA ou JJ-MM-AAAA
  let m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (m) {
    const [, j, mo, a] = m;
    return dateValide(parseInt(a, 10), parseInt(mo, 10) - 1, parseInt(j, 10));
  }

  // Format ISO AAAA-MM-JJ
  m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const [, a, mo, j] = m;
    return dateValide(parseInt(a, 10), parseInt(mo, 10) - 1, parseInt(j, 10));
  }

  // Format littéral "30 septembre 2026" (avec ou sans "avant le", "au")
  const moisPattern = Object.keys(MOIS_FR).join("|");
  m = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${moisPattern})\\s+(\\d{4})\\b`));
  if (m) {
    const [, j, moisNom, a] = m;
    return dateValide(parseInt(a, 10), MOIS_FR[moisNom], parseInt(j, 10));
  }

  return null;
}

module.exports = { extraireDateLimite };
