// ============================================================
//  services/cvTexte.js
//  Fonctions communes aux exports PDF et Word des CV / lettres.
//  Aucune dépendance : testable sans pdfkit ni docx.
//
//  Objectifs (compatibilité ATS) :
//   - un en-tête fiable construit à partir du formulaire, avec des
//     libellés en clair (« E-mail : », « Téléphone : ») plutôt que
//     des pictogrammes que les logiciels de tri lisent mal ;
//   - pas de doublon : l'en-tête écrit par l'IA est retiré quand
//     l'en-tête du formulaire est utilisé ;
//   - détection fiable des titres de section et des puces.
// ============================================================

// Rubriques usuelles d'un CV (début de ligne, accents facultatifs).
const RUBRIQUES = /^(profil|r[ée]sum[ée]|objectif|exp[ée]riences?|parcours|formations?|dipl[oô]mes?|comp[ée]tences?|langues?|loisirs?|centres?\s+d.int[ée]r[êe]ts?|certifications?|r[ée]f[ée]rences?|informations?\s+compl[ée]mentaires?|atouts?)\b/i;

// Retire les décorations en début de ligne (═, ─, puces, emoji, chiffres de liste).
function nettoyerDebut(ligne) {
  return String(ligne || "")
    .trim()
    .replace(/^[^A-Za-zÀ-ÿ]+/, "")
    .trim();
}

// Ligne de séparation : ═══, ───, ---, ===
function estSeparateur(ligne) {
  return /^[═─=\-_]{3,}\s*$/.test(String(ligne || "").trim());
}

// Titre de section : ligne en majuscules, assez courte, avec au moins 3 lettres.
// (Un numéro de téléphone ou une date en « majuscules » n'est donc plus pris pour un titre.)
function estTitreSection(ligne) {
  const l = String(ligne || "").trim();
  const lettres = l.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return (
    l.length > 3 &&
    l.length < 60 &&
    lettres.length >= 3 &&
    l === l.toUpperCase() &&
    !/^[0-9]/.test(l) &&
    !estSeparateur(l)
  );
}

// Puce : « • texte », « - texte », « – texte », « * texte ».
function estPuce(ligne) {
  return /^[•·▪●◦‣*\-–—]\s+\S/.test(String(ligne || "").trim());
}

function texteSansPuce(ligne) {
  return String(ligne || "").trim().replace(/^[•·▪●◦‣*\-–—]\s+/, "");
}

// En-tête fiable construit à partir des champs du formulaire.
function construireEntete(data = {}) {
  const nettoyer = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
  const contacts = [];
  if (nettoyer(data.email))     contacts.push(`E-mail : ${nettoyer(data.email)}`);
  if (nettoyer(data.telephone)) contacts.push(`Téléphone : ${nettoyer(data.telephone)}`);
  if (nettoyer(data.ville))     contacts.push(`Ville : ${nettoyer(data.ville)}`);
  return {
    nom: nettoyer(data.nom),
    poste: nettoyer(data.poste),
    contact: contacts.join("  |  "),
  };
}

// Sépare l'en-tête écrit par l'IA (nom, poste, coordonnées) du corps du CV.
//   - Rubrique usuelle trouvée : { corps: lignes à partir de cette rubrique, rubriqueTrouvee: true }
//   - Sinon (format inattendu) : { corps: toutes les lignes, rubriqueTrouvee: false }
//     — on ne perd jamais de contenu.
function extraireCorpsCV(contenuIA) {
  const lignes = String(contenuIA || "").split("\n");
  for (let i = 0; i < lignes.length; i++) {
    const brute = lignes[i].trim();
    if (!brute || estSeparateur(brute) || brute.includes("@")) continue;
    const propre = nettoyerDebut(brute);
    const nbMots = propre.split(/\s+/).length;
    if (RUBRIQUES.test(propre) && nbMots <= 6 && propre.length < 60) {
      return { corps: lignes.slice(i), rubriqueTrouvee: true };
    }
  }
  return { corps: lignes, rubriqueTrouvee: false };
}

// L'en-tête de l'IA figure-t-il dans les premières lignes (nom ou e-mail du candidat) ?
function aEnteteIA(lignes, data = {}) {
  const debut = lignes.slice(0, 12).join("\n").toLowerCase();
  const nom = String(data.nom || "").trim().toLowerCase();
  const email = String(data.email || "").trim().toLowerCase();
  return Boolean((nom && debut.includes(nom)) || (email && debut.includes(email)));
}

// Prépare ce qu'il faut écrire dans le fichier :
//   { entete: {nom, poste, contact} | null, lignes: [...] }
// - Avec les données du formulaire : l'en-tête fiable remplace celui de l'IA (retiré
//   s'il est reconnu), donc jamais de doublon.
// - Sans données, ou si l'IA a produit un format inattendu : le texte est gardé tel quel.
function preparerCorpsCV(contenuIA, data) {
  const toutes = String(contenuIA || "").split("\n");
  if (!data || !String(data.nom || "").trim()) {
    return { entete: null, lignes: toutes };
  }
  const ext = extraireCorpsCV(contenuIA);
  if (ext.rubriqueTrouvee) {
    return { entete: construireEntete(data), lignes: ext.corps };
  }
  return {
    entete: aEnteteIA(toutes, data) ? null : construireEntete(data),
    lignes: toutes,
  };
}

module.exports = {
  preparerCorpsCV,
  estSeparateur,
  estTitreSection,
  estPuce,
  texteSansPuce,
  construireEntete,
  extraireCorpsCV,
};
