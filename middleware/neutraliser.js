// ============================================================
//  middleware/neutraliser.js
//  Validation et nettoyage des textes saisis par les visiteurs.
//
//  Ces textes (noms, e-mails, messages) sont ensuite affichés dans des
//  pages web, notamment dans l'espace administrateur. Un nom ou un
//  e-mail piégé (« <img src=x onerror=… » par exemple) pourrait y
//  exécuter du code. On refuse donc ces caractères dès l'entrée —
//  c'est une protection EN PLUS de l'échappement à l'affichage.
// ============================================================

// E-mail : caractères courants uniquement (pas de < > " ' ( ) espaces…)
const EMAIL_RE = /^[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/;

// Nom : lettres (accents inclus), chiffres, espaces, point, apostrophe, tiret.
// Accepte N'Guessan, Jean-Pierre, Koné, etc.
const NOM_RE = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .'’\-]{1,79}$/u;

function emailValide(valeur) {
  return typeof valeur === "string" && valeur.trim().length <= 254 && EMAIL_RE.test(valeur.trim());
}

function nomValide(valeur) {
  return typeof valeur === "string" && NOM_RE.test(valeur.trim());
}

// Retire < et > d'un texte libre (messages, commentaires) et limite sa taille.
function nettoyerTexte(valeur, max = 2000) {
  return String(valeur ?? "").replace(/[<>]/g, "").slice(0, max).trim();
}

// Middleware : nettoie les champs texte indiqués du corps de la requête.
const neutraliserChamps = (...champs) => (req, res, next) => {
  for (const c of champs) {
    if (typeof req.body?.[c] === "string") req.body[c] = nettoyerTexte(req.body[c]);
  }
  next();
};

// Middleware : refuse un e-mail mal formé (si le champ est présent).
const exigerEmailValide = (req, res, next) => {
  if (req.body?.email !== undefined && !emailValide(req.body.email)) {
    return res.status(400).json({ error: "Adresse e-mail invalide." });
  }
  next();
};

module.exports = { emailValide, nomValide, nettoyerTexte, neutraliserChamps, exigerEmailValide };
