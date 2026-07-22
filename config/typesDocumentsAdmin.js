// ============================================================
//  config/typesDocumentsAdmin.js
//  Catalogue des documents administratifs générables.
//  Complémentaire à config/typesDocuments.js (documents pro/business).
//  Ici : documents à caractère officiel/administratif courant.
// ============================================================

const TYPES_DOCS_ADMIN = {
  demande: {
    nom: "Demande officielle",
    description: "Demande écrite à une administration, un employeur ou un établissement.",
    icone: "document",
    champsRequis: ["destinataire", "objet", "motif"],
    premium: false,
  },
  attestation: {
    nom: "Attestation",
    description: "Attestation sur l'honneur, de travail, d'hébergement ou autre.",
    icone: "coche",
    champsRequis: ["typeAttestation", "declarant", "objet"],
    premium: false,
  },
  courrier: {
    nom: "Courrier administratif",
    description: "Lettre formelle à une administration, une entreprise ou une institution.",
    icone: "email",
    champsRequis: ["destinataire", "objet", "contenu"],
    premium: false,
  },
  compte_rendu: {
    nom: "Compte rendu de réunion",
    description: "Synthèse structurée d'une réunion : présents, points abordés, décisions.",
    icone: "liste",
    champsRequis: ["titreReunion", "date", "participants", "pointsAbordes"],
    premium: false,
  },
  proces_verbal: {
    nom: "Procès-verbal",
    description: "Procès-verbal officiel d'assemblée, de constat ou de délibération.",
    icone: "cle",
    champsRequis: ["typeProcesVerbal", "date", "participants", "decisions"],
    premium: true,
  },
};

function listerTypesAdmin() {
  return Object.entries(TYPES_DOCS_ADMIN).map(([id, t]) => ({ id, ...t }));
}

function obtenirTypeAdmin(id) {
  return TYPES_DOCS_ADMIN[id] || null;
}

module.exports = { TYPES_DOCS_ADMIN, listerTypesAdmin, obtenirTypeAdmin };
