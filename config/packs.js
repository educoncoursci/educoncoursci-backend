// ============================================================
//  config/packs.js — Packs vendus à l'acte : un seul paiement, plusieurs
//  documents. Les éléments « bonus-* » sont rédigés (voir typesRedaction).
//  Prix et noms viennent de la table `produits` (modifiables par l'admin).
// ============================================================
const PACKS = {
  "pack-entretien":        { elements: ["entretien-preparation", "entretien-simulation"] },
  "pack-essentiel":        { elements: ["cv-classique", "lm-classique"] },
  "pack-professionnel":    { elements: ["cv-professionnel", "lm-personnalisee"] },
  "pack-international":    { elements: ["cv-international", "lm-internationale"] },
  "pack-recherche-emploi": { elements: ["cv-professionnel", "lm-classique", "lm-spontanee", "bonus-guide-emploi", "bonus-conseils-entretien"] },
};
const estPack = (id) => Object.prototype.hasOwnProperty.call(PACKS, id);
const idsPacks = () => Object.keys(PACKS);
module.exports = { PACKS, estPack, idsPacks };
