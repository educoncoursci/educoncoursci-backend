// ============================================================
//  config/structuresAide.js
//  Structures et institutions d'aide sociale en Côte d'Ivoire.
//  Volontairement limité aux institutions publiques/officielles
//  bien identifiées plutôt qu'un annuaire exhaustif d'ONG dont
//  la fiabilité ne peut pas être garantie dans la durée.
//  À compléter et vérifier périodiquement.
// ============================================================

const STRUCTURES_AIDE = [
  {
    nom: "CNPS — Caisse Nationale de Prévoyance Sociale",
    categorie: "Sécurité sociale",
    description: "Déclarations, demandes de bulletins de prestations, pensions et sécurité sociale.",
    telephone: "1396",
    zone: "National",
  },
  {
    nom: "CMU — Couverture Maladie Universelle",
    categorie: "Santé",
    description: "Enrôlement et gestion de la couverture maladie universelle pour tous les Ivoiriens.",
    zone: "National",
  },
  {
    nom: "Ministère de la Femme, de la Famille et de l'Enfant",
    categorie: "Protection des femmes et enfants",
    description: "Lutte contre les violences faites aux femmes et aux enfants, protection de l'enfance.",
    telephone: "1308",
    zone: "National",
  },
  {
    nom: "Ministère de l'Emploi et de la Protection Sociale",
    categorie: "Emploi & protection sociale",
    description: "Informations et assistance sociale et administrative.",
    telephone: "+225 20 32 26 83",
    adresse: "Rue Victor Hugo, Abidjan",
    zone: "Abidjan",
  },
  {
    nom: "Centre d'Accueil et de Réinsertion Sociale",
    categorie: "Réinsertion & précarité",
    description: "Hébergement d'urgence, accompagnement social, réinsertion professionnelle, aide alimentaire.",
    telephone: "+225 20 37 89 23",
    adresse: "Adjamé, Abidjan",
    zone: "Abidjan",
  },
  {
    nom: "IPS-CGRAE",
    categorie: "Sécurité sociale",
    description: "Gestion des pensions et de la sécurité sociale des fonctionnaires et agents de l'État.",
    telephone: "+225 27 20 25 12 12",
    zone: "National",
  },
];

module.exports = { STRUCTURES_AIDE };
