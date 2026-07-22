// ============================================================
//  config/typesDocumentsSociaux.js
//  Documents spécifiques au travail social générables par IA.
//  Complémentaire à typesDocuments.js et typesDocumentsAdmin.js.
// ============================================================

const TYPES_DOCS_SOCIAUX = {
  rapport_social: {
    nom: "Rapport social",
    description: "Rapport d'évaluation de la situation d'une personne ou d'une famille.",
    icone: "liste",
    champsRequis: ["beneficiaire", "situation", "besoins"],
    premium: true,
  },
  demande_aide_sociale: {
    nom: "Demande d'aide sociale",
    description: "Demande formelle d'aide (CMU, allocation, secours) auprès d'une institution.",
    icone: "document",
    champsRequis: ["demandeur", "typeAide", "motif"],
    premium: false,
  },
  fiche_liaison: {
    nom: "Fiche de liaison",
    description: "Fiche de transmission d'informations entre professionnels ou structures.",
    icone: "email",
    champsRequis: ["beneficiaire", "structureDestinataire", "motifTransmission"],
    premium: false,
  },
  projet_intervention: {
    nom: "Projet d'intervention sociale",
    description: "Plan d'accompagnement structuré pour une personne ou une famille suivie.",
    icone: "graphique",
    champsRequis: ["beneficiaire", "objectifs", "actionsEnvisagees"],
    premium: true,
  },
};

function listerTypesSociaux() {
  return Object.entries(TYPES_DOCS_SOCIAUX).map(([id, t]) => ({ id, ...t }));
}

function obtenirTypeSocial(id) {
  return TYPES_DOCS_SOCIAUX[id] || null;
}

module.exports = { TYPES_DOCS_SOCIAUX, listerTypesSociaux, obtenirTypeSocial };
