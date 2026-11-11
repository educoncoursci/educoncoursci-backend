// ============================================================
//  services/nettoyageFlux.js
//  Nettoyage du contenu qui vient de l'EXTÉRIEUR (flux RSS, résultats
//  de recherche) avant de l'enregistrer en base.
//
//  Un site tiers piraté ou malveillant pourrait y glisser du HTML ou un
//  lien « javascript: » qui s'exécuterait chez tes visiteurs.
//  - texteSur() : décode les entités (&#8217; → ’), retire toutes les balises
//    HTML et les < > restants. Un titre normal n'est PAS modifié (les
//    empreintes anti-doublon restent donc identiques).
//  - urlSure()  : accepte uniquement http:// et https:// ; renvoie l'adresse
//    d'origine (non normalisée) ou null.
// ============================================================

const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decoderEntites(texte) {
  return texte
    .replace(/&#(\d{1,7});/g, (m, n) => { const c = parseInt(n, 10); return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : ""; })
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, h) => { const c = parseInt(h, 16); return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : ""; })
    .replace(/&([a-z]+);/gi, (m, nom) => (ENTITES[nom.toLowerCase()] !== undefined ? ENTITES[nom.toLowerCase()] : m));
}

function texteSur(valeur, max = 2000) {
  if (valeur === null || valeur === undefined) return "";
  return decoderEntites(String(valeur))
    .replace(/<[^>]*>/g, "")   // balises complètes
    .replace(/[<>]/g, "")      // chevrons isolés
    .trim()
    .slice(0, max);
}

function urlSure(valeur) {
  if (typeof valeur !== "string") return null;
  const brute = valeur.trim();
  if (!brute || brute.length > 2000 || /[\s<>"']/.test(brute)) return null;
  try {
    const u = new URL(brute);
    return u.protocol === "http:" || u.protocol === "https:" ? brute : null;
  } catch {
    return null;
  }
}

module.exports = { texteSur, urlSure };
