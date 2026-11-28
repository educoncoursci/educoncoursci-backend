// ============================================================
//  config/typesRedaction.js
//  Courriers et documents du catalogue (produits « doc-* »), vendus à
//  l'acte. Chaque type décrit ses champs de saisie (servis au frontend)
//  et sa consigne de rédaction. Le PRIX vient de la table `produits`.
// ============================================================

const T = (id, label, extra = {}) => ({ id, label, type: "text", requis: false, ...extra });
const R = (id, label, extra = {}) => T(id, label, { requis: true, ...extra });
const A = (id, label, extra = {}) => T(id, label, { type: "textarea", ...extra });
const AR = (id, label, extra = {}) => A(id, label, { requis: true, ...extra });

// Champs communs en tête de chaque formulaire
const COMMUNS = [R("nom", "Votre nom complet"), T("ville", "Ville", { placeholder: "Abidjan" }), T("telephone", "Téléphone"), T("email", "E-mail")];

const TYPES_REDACTION = {
  "doc-lettre-relance": {
    titre: "Lettre de relance", tokens: 900,
    consigne: "Lettre de RELANCE polie et brève après une candidature restée sans réponse : rappelle la candidature, réaffirme l'intérêt, propose un échange.",
    champs: [R("organisation", "Organisation"), R("poste", "Poste visé"), T("dateCandidature", "Date de la candidature"), T("destinataire", "Destinataire"), A("precisions", "Précisions utiles")],
  },
  "doc-lettre-recommandation": {
    titre: "Lettre de recommandation", tokens: 1100,
    consigne: "Lettre de RECOMMANDATION professionnelle rédigée du point de vue de l'auteur, uniquement à partir des qualités et faits fournis.",
    champs: [R("personne", "Personne recommandée"), R("objectif", "Objet de la recommandation (poste, formation…)"), R("relation", "Votre lien avec cette personne"), T("periode", "Période de collaboration"), AR("qualites", "Qualités et réalisations à mettre en avant")],
  },
  "doc-lettre-remerciement": {
    titre: "Lettre de remerciement", tokens: 800,
    consigne: "Lettre de REMERCIEMENT après un entretien : remercie, rappelle un point marquant fourni, réaffirme la motivation.",
    champs: [R("organisation", "Organisation"), R("poste", "Poste"), T("destinataire", "Destinataire"), T("dateEntretien", "Date de l'entretien"), A("pointsMarquants", "Points marquants de l'entretien")],
  },
  "doc-demande-conge": {
    titre: "Demande de congé", tokens: 800,
    consigne: "DEMANDE DE CONGÉ adressée à l'employeur : objet, dates, éventuelle organisation de la continuité du travail si elle est fournie.",
    champs: [R("destinataire", "Destinataire (employeur, supérieur)"), T("poste", "Votre poste"), R("typeConge", "Type de congé", { placeholder: "Congé annuel, maladie, exceptionnel…" }), R("dateDebut", "Date de début"), R("dateFin", "Date de fin"), A("motif", "Motif ou précisions")],
  },
  "doc-lettre-demission": {
    titre: "Lettre de démission", tokens: 800,
    consigne: "LETTRE DE DÉMISSION claire, respectueuse et sans polémique, mentionnant la date d'effet et le préavis s'ils sont fournis.",
    champs: [R("destinataire", "Destinataire (employeur)"), R("poste", "Votre poste"), R("dateEffet", "Date d'effet souhaitée"), T("preavis", "Préavis"), A("motif", "Motif (facultatif)")],
  },
  "doc-demande-attestation-travail": {
    titre: "Demande d'attestation de travail", tokens: 700,
    consigne: "DEMANDE D'ATTESTATION DE TRAVAIL adressée à l'employeur, en précisant la finalité.",
    champs: [R("destinataire", "Destinataire (employeur)"), R("poste", "Votre poste"), T("dateEmbauche", "Date d'embauche"), R("finalite", "Finalité de l'attestation", { placeholder: "Dossier de visa, de prêt, de location…" })],
  },
  "doc-demande-explication": {
    titre: "Lettre de demande d'explication", tokens: 900,
    consigne: "Courrier officiel de DEMANDE D'EXPLICATION : expose les faits fournis de façon neutre, formule la demande, fixe le délai de réponse s'il est donné.",
    champs: [R("destinataire", "Destinataire"), R("objet", "Objet"), AR("faits", "Faits et contexte"), T("delai", "Délai de réponse souhaité")],
  },
  "doc-transmission-documents": {
    titre: "Lettre de transmission de documents", tokens: 700,
    consigne: "Courrier d'ACCOMPAGNEMENT pour l'envoi de documents : objet, liste numérotée des pièces jointes, formule de politesse.",
    champs: [R("destinataire", "Destinataire"), R("objet", "Objet de l'envoi"), AR("listeDocuments", "Documents transmis (un par ligne)")],
  },
  "doc-rapport-stage": {
    titre: "Rapport de stage", tokens: 3200,
    consigne: "RAPPORT DE STAGE structuré (introduction, présentation de la structure d'accueil, missions réalisées, compétences acquises, difficultés et solutions, conclusion). Développe uniquement à partir des informations fournies, sans inventer de chiffres ni d'événements.",
    champs: [R("structure", "Structure d'accueil"), R("poste", "Poste ou service"), R("periode", "Période du stage"), T("tuteur", "Tuteur / maître de stage"), AR("missions", "Missions réalisées"), A("competences", "Compétences acquises"), A("difficultes", "Difficultés rencontrées"), A("conclusion", "Bilan personnel")],
  },
  "doc-page-garde": {
    titre: "Page de garde de rapport", tokens: 600,
    consigne: "PAGE DE GARDE de rapport : texte centré, hiérarchisé (établissement, intitulé du document en évidence, auteur, encadreur, année). Aucun autre contenu.",
    champs: [R("titre", "Titre du rapport"), R("typeDocument", "Type de document", { placeholder: "Rapport de stage, mémoire…" }), R("etablissement", "Établissement"), T("filiere", "Filière / diplôme"), T("encadreur", "Encadreur(s)"), R("annee", "Année académique ou date")],
  },
  "doc-projet-professionnel": {
    titre: "Projet professionnel", tokens: 1800,
    consigne: "PROJET PROFESSIONNEL structuré (objectif, parcours, atouts, étapes court/moyen terme, moyens à mobiliser), à partir des seules informations fournies.",
    champs: [R("objectif", "Objectif professionnel"), AR("parcours", "Parcours (formation, expériences)"), AR("competences", "Atouts et compétences"), A("projetsCourtTerme", "Étapes envisagées"), A("moyens", "Moyens à mobiliser")],
  },
  "doc-projet-formation": {
    titre: "Projet de formation", tokens: 1600,
    consigne: "PROJET DE FORMATION structuré (formation visée, motivations, cohérence avec le parcours, débouchés), à partir des seules informations fournies.",
    champs: [R("formationVisee", "Formation visée"), T("etablissement", "Établissement visé"), AR("motivation", "Motivations"), AR("parcours", "Parcours actuel"), A("debouches", "Débouchés envisagés")],
  },
  "doc-discours-professionnel": {
    titre: "Discours professionnel", tokens: 1800,
    consigne: "DISCOURS professionnel prêt à être prononcé : accroche, développement des messages clés, conclusion. Adapte la longueur à la durée indiquée.",
    champs: [R("occasion", "Occasion"), R("public", "Public"), T("duree", "Durée souhaitée", { placeholder: "3 minutes" }), AR("messagesCles", "Messages clés à transmettre"), T("ton", "Ton", { placeholder: "Solennel, chaleureux…" })],
  },
  "doc-biographie-professionnelle": {
    titre: "Biographie professionnelle", tokens: 700,
    consigne: "BIOGRAPHIE PROFESSIONNELLE courte, à la troisième personne, utilisable pour une présentation ou un profil, uniquement à partir des faits fournis.",
    champs: [R("poste", "Fonction actuelle"), AR("parcours", "Parcours et expériences"), A("realisations", "Réalisations marquantes"), T("longueur", "Longueur souhaitée", { placeholder: "80 mots" })],
  },
};

// Services d'accompagnement (produits du catalogue) et contenus bonus des packs.
Object.assign(TYPES_REDACTION, {
  "cv-correction": {
    titre: "CV corrigé et amélioré", tokens: 2200,
    consigne: "CORRECTION et AMÉLIORATION du CV existant : corrige l'orthographe, la grammaire et la structure, reformule les phrases faibles avec des verbes d'action, harmonise les dates. Conserve STRICTEMENT les faits du CV d'origine, sans rien inventer ni ajouter. Ne génère que le CV amélioré.",
    champs: [R("poste", "Poste visé"), AR("cvExistant", "Collez ici le texte de votre CV actuel", { max: 8000 }), A("remarques", "Ce que vous souhaitez améliorer (facultatif)")],
  },
  "cv-optimisation-offre": {
    titre: "CV adapté à l'offre", tokens: 2400,
    consigne: "OPTIMISATION du CV existant pour l'offre d'emploi fournie : reformule et réordonne le CV pour mettre en avant ce qui répond à l'offre, reprends naturellement les mots-clés de l'offre là où ils correspondent à des faits RÉELS du CV. N'invente aucune expérience, compétence ou diplôme. Ne génère que le CV adapté.",
    champs: [R("poste", "Poste visé"), AR("cvExistant", "Collez ici le texte de votre CV actuel", { max: 8000 }), AR("offreEmploi", "Collez ici le texte de l'offre d'emploi", { max: 6000 })],
  },
  "entretien-preparation": {
    titre: "Préparation à un entretien", tokens: 2400,
    consigne: "FICHE DE PRÉPARATION à un entretien d'embauche pour le poste et l'organisation indiqués : présentation à préparer, 10 questions fréquentes avec pistes de réponse fondées UNIQUEMENT sur le profil fourni, questions à poser au recruteur, erreurs à éviter, check-list du jour J. N'invente aucun fait sur l'organisation ni sur le candidat.",
    champs: [R("poste", "Poste visé"), T("organisation", "Organisation"), AR("profil", "Votre profil (formation, expériences, atouts)"), A("inquietudes", "Ce qui vous inquiète pour cet entretien")],
  },
  "bonus-guide-emploi": {
    titre: "Guide de recherche d'emploi", tokens: 2000,
    consigne: "GUIDE PRATIQUE de recherche d'emploi personnalisé pour le poste visé en Côte d'Ivoire : définir sa cible, où chercher (sites d'offres, réseaux, candidatures spontanées), organiser ses candidatures, relances, suivi. Conseils concrets, sans inventer de statistiques ni de noms d'entreprises.",
    champs: [T("poste", "Poste recherché"), A("profil", "Profil"), A("competences", "Compétences")],
  },
  "bonus-conseils-entretien": {
    titre: "Conseils pour réussir un entretien", tokens: 1800,
    consigne: "CONSEILS pour réussir un entretien d'embauche pour le poste visé : préparation, questions fréquentes avec pistes de réponse fondées uniquement sur le profil fourni, tenue et attitude, questions à poser, suivi après l'entretien.",
    champs: [T("poste", "Poste recherché"), A("profil", "Profil"), A("competences", "Compétences")],
  },
});

const estRedaction = (id) => Object.prototype.hasOwnProperty.call(TYPES_REDACTION, id);
const idsTypesRedaction = () => Object.keys(TYPES_REDACTION);

// Définition publique (champs communs + spécifiques)
function listerPourClient() {
  return Object.entries(TYPES_REDACTION).filter(([id]) => !id.startsWith("bonus-")).map(([id, t]) => ({ id, titre: t.titre, champs: [...COMMUNS, ...t.champs] }));
}

function tousLesChamps(id) {
  return [...COMMUNS, ...(TYPES_REDACTION[id]?.champs || [])];
}

function champsRequis(id) {
  return [...COMMUNS, ...(TYPES_REDACTION[id]?.champs || [])].filter((c) => c.requis);
}

module.exports = { TYPES_REDACTION, estRedaction, idsTypesRedaction, listerPourClient, champsRequis, tousLesChamps };
