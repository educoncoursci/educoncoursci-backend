// ============================================================
//  config/typesCv.js
//  Les 6 types de CV vendus à l'acte. Le PRIX ne vient jamais d'ici :
//  il est lu dans la table `produits` (modifiable par l'admin).
//  Ici : la consigne de rédaction et le modèle de mise en page.
// ============================================================

const TYPES_CV = {
  "cv-classique": {
    modele: "ats_classique_1",
    tokens: 1800,
    consigne: "Style CLASSIQUE : mise en page sobre, phrases courtes et factuelles, une page, idéal premier emploi ou stage.",
  },
  "cv-moderne": {
    modele: "ong_social_1",
    tokens: 1800,
    consigne: "Style MODERNE : profil accrocheur, formulations dynamiques, rubriques bien aérées, ton actuel et soigné.",
  },
  "cv-professionnel": {
    modele: "ats_classique_2",
    tokens: 2400,
    consigne: "Style PROFESSIONNEL DÉVELOPPÉ : détaille chaque expérience (missions, responsabilités) uniquement à partir des informations fournies, deux pages maximum.",
  },
  "cv-ats": {
    modele: "ats_classique_1",
    tokens: 1800,
    consigne: "Style COMPATIBLE ATS : texte simple, intitulés de rubriques standards (Profil, Expériences, Formations, Compétences, Langues), aucun symbole décoratif, mots-clés du poste repris naturellement.",
  },
  "cv-international": {
    modele: "international_1",
    tokens: 2000,
    consigne: "Style INTERNATIONAL : format adapté aux organisations et entreprises internationales, sobre, orienté résultats, sans photo ni état civil détaillé.",
  },
  "cv-bilingue": {
    modele: "international_2",
    tokens: 3600,
    consigne: "Style BILINGUE : rédige le CV complet en FRANÇAIS, puis le CV complet en ANGLAIS (traduction fidèle, sans rien ajouter), séparés par une ligne « ══════ ENGLISH VERSION ══════ ».",
  },
};

// Lettres de motivation vendues à l'acte (même parcours que les CV).
const TYPES_LM = {
  "lm-classique":      { spontanee: false, tokens: 1400, consigne: "Lettre CLASSIQUE : structure formelle et professionnelle, adaptée au poste visé." },
  "lm-personnalisee":  { spontanee: false, tokens: 1500, consigne: "Lettre PERSONNALISÉE : construite à partir du parcours du candidat et des spécificités de l'organisation visée, accroche propre à cette organisation." },
  "lm-internationale": { spontanee: false, tokens: 1500, consigne: "Lettre INTERNATIONALE : ton direct et orienté résultats, usages des candidatures auprès d'organisations et d'entreprises internationales." },
  "lm-spontanee":      { spontanee: true,  tokens: 1400, consigne: "Candidature SPONTANÉE : présente le candidat à une organisation qui n'a pas publié d'offre, sans prétendre répondre à une annonce." },
  "lm-stage":          { spontanee: false, tokens: 1400, consigne: "Lettre de DEMANDE DE STAGE : formule clairement une demande de stage (objectifs d'apprentissage, disponibilité), ton respectueux d'un étudiant ou jeune diplômé." },
  "lm-ong":            { spontanee: false, tokens: 1500, consigne: "Lettre pour une ONG ou une organisation humanitaire / sociale : met en avant l'engagement, les valeurs, le travail de terrain et d'équipe, uniquement à partir des informations fournies." },
  "lm-administration": { spontanee: false, tokens: 1400, consigne: "Lettre pour une ADMINISTRATION ou la Fonction Publique : ton très formel, formules administratives ivoiriennes (« J'ai l'honneur de solliciter… »), sens du service public, sans rien inventer." },
  "lm-emploi":         { spontanee: false, tokens: 1400, consigne: "Lettre de DEMANDE D'EMPLOI : claire, convaincante et directe, centrée sur l'adéquation avec l'emploi demandé." },
};

const idsTypesCv = () => Object.keys(TYPES_CV);
const idsTypesLm = () => Object.keys(TYPES_LM);

module.exports = { TYPES_CV, TYPES_LM, idsTypesCv, idsTypesLm };
