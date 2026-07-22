// ============================================================
//  services/documentsClaude.js
//  Génération de documents professionnels via Claude IA :
//  Business Plan, Devis, Facture, Rapport, Contrat, Présentation.
//  Réutilise le même appel API que services/claude.js.
// ============================================================

const fetch = require("node-fetch");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL         = "claude-sonnet-4-6";

async function appelClaude(prompt, maxTokens = 1800) {
  const response = await fetch(ANTHROPIC_URL, {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: maxTokens,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Erreur API Claude : ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content?.find(b => b.type === "text")?.text || "";
}

// ════════════════════════════════════════════════════════════
//  Business Plan
// ════════════════════════════════════════════════════════════
async function genererBusinessPlan(data) {
  const {
    nomEntreprise, secteur, description, marcheCible,
    produitsServices, strategie, projections, ville,
  } = data;

  const prompt = `Tu es un consultant en création d'entreprise expérimenté en Côte d'Ivoire.
Rédige un business plan structuré et professionnel en français.

═══════════════════════════════════════
INFORMATIONS DU PROJET
═══════════════════════════════════════
Nom de l'entreprise  : ${nomEntreprise}
Secteur d'activité   : ${secteur}
Ville                : ${ville || "Abidjan, Côte d'Ivoire"}
Description du projet: ${description}
Marché cible         : ${marcheCible || "À définir"}
Produits/Services    : ${produitsServices || "À préciser"}
Éléments de stratégie: ${strategie || "À préciser"}
Projections/Budget   : ${projections || "À estimer"}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════
Structure le document ainsi :
1. RÉSUMÉ EXÉCUTIF
2. PRÉSENTATION DU PROJET
3. ÉTUDE DE MARCHÉ (contexte ivoirien, opportunités, concurrence)
4. STRATÉGIE COMMERCIALE ET MARKETING
5. ORGANISATION ET RESSOURCES HUMAINES
6. PLAN FINANCIER PRÉVISIONNEL (estimations réalistes, en FCFA)
7. ANALYSE DES RISQUES
8. CONCLUSION

- Adapte le contenu au contexte économique ivoirien
- Utilise des estimations réalistes en FCFA, présentées comme des ordres de grandeur indicatifs (pas des chiffres garantis)
- Reste concret et actionnable, évite le jargon creux
- Utilise des séparateurs clairs (═══, ───) entre les sections
- Ne génère QUE le business plan, sans commentaire autour`;

  return appelClaude(prompt, 3000);
}

// ════════════════════════════════════════════════════════════
//  Devis
// ════════════════════════════════════════════════════════════
async function genererDevis(data) {
  const { emetteur, client, articles, conditions, validite, numero } = data;

  const listeArticles = (articles || [])
    .map((a, i) => `${i + 1}. ${a.designation} — Qté: ${a.quantite} — Prix unitaire: ${a.prixUnitaire} FCFA`)
    .join("\n");

  const totalEstime = (articles || []).reduce(
    (acc, a) => acc + (Number(a.quantite) || 0) * (Number(a.prixUnitaire) || 0), 0
  );

  const prompt = `Tu es un assistant administratif expert en documents commerciaux ivoiriens.
Rédige un devis professionnel complet et bien structuré en français.

═══════════════════════════════════════
ÉMETTEUR
═══════════════════════════════════════
${emetteur}

═══════════════════════════════════════
CLIENT
═══════════════════════════════════════
${client}

═══════════════════════════════════════
DEVIS N° ${numero || "À définir"}
═══════════════════════════════════════
${listeArticles}

TOTAL ESTIMÉ : ${totalEstime.toLocaleString("fr-FR")} FCFA

═══════════════════════════════════════
CONDITIONS
═══════════════════════════════════════
Validité de l'offre : ${validite || "30 jours"}
Conditions particulières : ${conditions || "Paiement à la commande, sauf accord contraire."}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
- Présente ce devis de façon professionnelle et formelle
- Inclus un tableau clair des articles avec quantités, prix unitaires et sous-totaux
- Calcule et affiche le total de façon visible
- Ajoute les mentions légales usuelles ivoiriennes (devis valable X jours, TVA le cas échéant)
- Ne génère QUE le devis, sans commentaire autour`;

  return appelClaude(prompt, 1500);
}

// ════════════════════════════════════════════════════════════
//  Facture
// ════════════════════════════════════════════════════════════
async function genererFacture(data) {
  const { emetteur, client, articles, modePaiement, echeance, numero } = data;

  const listeArticles = (articles || [])
    .map((a, i) => `${i + 1}. ${a.designation} — Qté: ${a.quantite} — Prix unitaire: ${a.prixUnitaire} FCFA`)
    .join("\n");

  const totalEstime = (articles || []).reduce(
    (acc, a) => acc + (Number(a.quantite) || 0) * (Number(a.prixUnitaire) || 0), 0
  );

  const prompt = `Tu es un assistant administratif expert en documents commerciaux ivoiriens.
Rédige une facture professionnelle complète et bien structurée en français.

═══════════════════════════════════════
ÉMETTEUR
═══════════════════════════════════════
${emetteur}

═══════════════════════════════════════
CLIENT
═══════════════════════════════════════
${client}

═══════════════════════════════════════
FACTURE N° ${numero || "À définir"}
═══════════════════════════════════════
${listeArticles}

TOTAL : ${totalEstime.toLocaleString("fr-FR")} FCFA

═══════════════════════════════════════
MODALITÉS
═══════════════════════════════════════
Mode de paiement : ${modePaiement || "Wave / Orange Money / Virement"}
Échéance de paiement : ${echeance || "À réception"}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
- Présente cette facture de façon professionnelle et formelle
- Inclus un tableau clair des articles avec quantités, prix unitaires et sous-totaux
- Affiche clairement le montant total dû
- Ajoute les mentions légales usuelles ivoiriennes
- Ne génère QUE la facture, sans commentaire autour`;

  return appelClaude(prompt, 1500);
}

// ════════════════════════════════════════════════════════════
//  Rapport
// ════════════════════════════════════════════════════════════
async function genererRapport(data) {
  const { titre, auteur, contexte, objectifs, contenu, recommandations, date } = data;

  const prompt = `Tu es un rédacteur professionnel expert en rapports d'activité et d'étude.
Rédige un rapport structuré et professionnel en français.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Titre du rapport : ${titre}
Auteur           : ${auteur || "Non renseigné"}
Date             : ${date || new Date().toLocaleDateString("fr-FR")}

═══════════════════════════════════════
CONTEXTE
═══════════════════════════════════════
${contexte}

═══════════════════════════════════════
OBJECTIFS
═══════════════════════════════════════
${objectifs || "À préciser"}

═══════════════════════════════════════
CONTENU / CONSTATS
═══════════════════════════════════════
${contenu}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════
Structure le rapport ainsi :
1. INTRODUCTION (contexte et objectifs)
2. DÉVELOPPEMENT (constats, analyse détaillée à partir du contenu fourni)
3. RECOMMANDATIONS ${recommandations ? `(en t'appuyant sur : ${recommandations})` : ""}
4. CONCLUSION

- Ton professionnel et factuel
- Structure claire avec séparateurs (═══, ───)
- Ne génère QUE le rapport, sans commentaire autour`;

  return appelClaude(prompt, 2200);
}

// ════════════════════════════════════════════════════════════
//  Contrat (simple, informatif — pas un contrat juridique final)
// ════════════════════════════════════════════════════════════
async function genererContrat(data) {
  const { typeContrat, partieA, partieB, objet, duree, conditions, ville } = data;

  const prompt = `Tu es un assistant juridique administratif ivoirien (PAS un avocat).
Rédige un modèle de contrat simple et clair en français, à titre indicatif.

═══════════════════════════════════════
INFORMATIONS DU CONTRAT
═══════════════════════════════════════
Type de contrat : ${typeContrat}
Ville            : ${ville || "Abidjan, Côte d'Ivoire"}
Partie A (première partie)  : ${partieA}
Partie B (deuxième partie)  : ${partieB}
Objet du contrat : ${objet}
Durée            : ${duree || "À préciser"}
Conditions particulières : ${conditions || "Aucune condition particulière."}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════
- Structure classique : Préambule > Identification des parties > Objet > Clauses (obligations de chaque partie, durée, résiliation, litiges) > Signatures
- Ton formel et juridique de base, adapté au droit ivoirien courant
- Inclus une clause de résolution des litiges (juridiction compétente d'Abidjan par défaut)
- Termine par un avertissement clair au candidat : "Ce document est un modèle indicatif. Il est fortement recommandé de le faire vérifier par un juriste ou notaire avant signature."
- Ne génère QUE le contrat (avec l'avertissement final inclus), sans commentaire autour`;

  return appelClaude(prompt, 2000);
}

// ════════════════════════════════════════════════════════════
//  Présentation (plan de slides structuré)
// ════════════════════════════════════════════════════════════
async function genererPresentation(data) {
  const { titre, sujet, public: publicCible, nbSlides, ton } = data;

  const prompt = `Tu es un expert en création de présentations professionnelles (type PowerPoint).
Construis un plan de présentation structuré et clair en français.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Titre               : ${titre}
Sujet à développer  : ${sujet}
Public visé         : ${publicCible || "Professionnel général"}
Nombre de slides visé : ${nbSlides || "8 à 10"}
Ton souhaité        : ${ton || "Professionnel et clair"}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
Pour chaque slide, indique :
- Le numéro et le titre de la slide
- Les 3 à 5 points clés à afficher (puces courtes, pas de paragraphes)
- Une suggestion de visuel si pertinent (graphique, image, icône)

Structure attendue : Slide de titre > Introduction/Contexte > Corps (plusieurs slides selon le sujet) > Conclusion/Appel à l'action > Slide de remerciement/questions

Présente chaque slide avec un séparateur clair (─── SLIDE N ───).
Ne génère QUE le plan de présentation, sans commentaire autour.`;

  return appelClaude(prompt, 2000);
}

module.exports = {
  genererBusinessPlan,
  genererDevis,
  genererFacture,
  genererRapport,
  genererContrat,
  genererPresentation,
};
