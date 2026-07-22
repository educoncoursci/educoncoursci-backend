// ============================================================
//  config/urgencesSociales.js
//  Numéros d'urgence et d'assistance sociale en Côte d'Ivoire.
//  Vérifiés via sources multiples (Pulse CI, PdoC, Fratmat) —
//  à re-vérifier périodiquement, ces numéros peuvent évoluer.
// ============================================================

const NUMEROS_URGENCE = [
  { numero: "185", nom: "SAMU", description: "Urgences médicales graves", categorie: "vitale" },
  { numero: "180", nom: "Sapeurs-Pompiers", description: "Incendies, accidents, sauvetage", categorie: "vitale" },
  { numero: "111", nom: "Police Secours", description: "Sécurité, agression, danger immédiat", categorie: "vitale" },
  { numero: "170", nom: "Gendarmerie Nationale", description: "Sécurité en zone rurale/périurbaine", categorie: "vitale" },
  { numero: "139", nom: "Assistance psychologique et écoute", description: "Détresse psychologique, difficultés personnelles — écoute confidentielle", categorie: "psychosocial" },
  { numero: "116", nom: "Allô Enfance en Détresse", description: "Enfants en danger, maltraitance, violence", categorie: "protection" },
  { numero: "1308", nom: "Ministère de la Femme, Famille et Enfant", description: "Violences faites aux femmes et aux enfants", categorie: "protection" },
  { numero: "1396", nom: "CNPS", description: "Sécurité sociale, prestations, pensions", categorie: "administratif" },
];

module.exports = { NUMEROS_URGENCE };
