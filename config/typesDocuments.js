// ============================================================
//  config/typesDocuments.js
//  Catalogue des types de documents professionnels générables
//  (Module Documents Professionnels — extension de Document AI Pro)
// ============================================================

const TYPES_DOCUMENTS = {
  business_plan: {
    nom: "Business Plan",
    description: "Plan d'affaires complet pour lancer ou développer une activité.",
    icone: "graphique",
    champsRequis: ["nomEntreprise", "secteur", "description"],
    premium: true,
  },
  devis: {
    nom: "Devis",
    description: "Proposition commerciale chiffrée à envoyer à un client.",
    icone: "document",
    champsRequis: ["emetteur", "client", "articles"],
    premium: false,
  },
  facture: {
    nom: "Facture",
    description: "Facture professionnelle avec calcul automatique des montants.",
    icone: "portefeuille",
    champsRequis: ["emetteur", "client", "articles"],
    premium: false,
  },
  rapport: {
    nom: "Rapport",
    description: "Rapport d'activité, de mission ou d'étude structuré.",
    icone: "liste",
    champsRequis: ["titre", "contexte", "contenu"],
    premium: false,
  },
  contrat: {
    nom: "Contrat",
    description: "Contrat professionnel simple (prestation, travail, bail...).",
    icone: "cle",
    champsRequis: ["typeContrat", "partieA", "partieB", "objet"],
    premium: true,
  },
  presentation: {
    nom: "Présentation",
    description: "Plan de présentation structuré en diapositives (à exporter ensuite en PPTX si besoin).",
    icone: "graphique",
    champsRequis: ["titre", "sujet"],
    premium: false,
  },
};

function listerTypes() {
  return Object.entries(TYPES_DOCUMENTS).map(([id, t]) => ({ id, ...t }));
}

function obtenirType(id) {
  return TYPES_DOCUMENTS[id] || null;
}

module.exports = { TYPES_DOCUMENTS, listerTypes, obtenirType };
