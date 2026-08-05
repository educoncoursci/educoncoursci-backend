// ============================================================
//  services/assistantConcoursClaude.js
//  Assistant IA généraliste concours — répond aux questions sur
//  les concours de la Fonction Publique et grandes écoles de CI.
//
//  RÈGLES DE SÉCURITÉ STRICTES :
//  - Ne garantit JAMAIS une admission ou une réussite
//  - N'invente jamais de dates, de résultats ou de textes
//    officiels — renvoie vers la fiche concours EduConcoursCI ou
//    la source officielle en cas de doute
//  - Rappelle qu'aucun intermédiaire ne peut garantir un concours
//    (numéro vert anti-fraude 1364) si la question laisse penser
//    à une tentative de corruption/piston
//  - Reste centré sur les concours ivoiriens — décline poliment
//    les questions hors-sujet
// ============================================================

const fetch = require("node-fetch");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL         = "claude-sonnet-4-6";

const MOTS_FRAUDE = [
  "piston", "pot-de-vin", "corrompre", "arranger", "payer pour réussir",
  "garantir l'admission", "connexion pour passer", "acheter le concours",
];

function detecterRisqueFraude(texte) {
  const t = texte.toLowerCase();
  return MOTS_FRAUDE.some((mot) => t.includes(mot));
}

async function repondreAssistantConcours(message, historique = [], contexteConcours = null) {
  const contexte = contexteConcours
    ? `\n\nCONTEXTE — le candidat consulte actuellement cette fiche concours :\n` +
      `Titre : ${contexteConcours.titre}\nOrganisme : ${contexteConcours.organisme}\n` +
      `Catégorie : ${contexteConcours.categorie}\nNiveau requis : ${contexteConcours.niveau || "non précisé"}\n` +
      `Conditions : ${contexteConcours.conditions || "non précisées"}\n` +
      `Ouverture : ${contexteConcours.ouverture || "—"}  Clôture : ${contexteConcours.cloture || "—"}\n` +
      `Utilise ce contexte si la question s'y rapporte, mais tu peux aussi répondre à des` +
      ` questions générales sur d'autres concours ivoiriens.`
    : "";

  const systemPrompt = `Tu es l'assistant IA d'EduConcoursCI, spécialisé dans les concours de la
Fonction Publique et des grandes écoles de Côte d'Ivoire (conditions d'accès, épreuves,
pièces à fournir, méthodologie de révision, orientation générale).

RÈGLES STRICTES QUE TU DOIS TOUJOURS RESPECTER :
- Tu ne garantis JAMAIS qu'un candidat sera admis ou réussira — aucun outil ni
  aucune personne ne peut garantir un concours
- Tu n'inventes JAMAIS de dates précises, de résultats, de textes de loi ou
  d'informations chiffrées que tu ne connais pas avec certitude — dans le doute,
  dis-le clairement et invite à vérifier sur la fiche du concours ou la source
  officielle (ministère organisateur)
- Si la question laisse entendre une tentative de piston, corruption ou paiement
  pour "arranger" une admission, tu le déconseilles fermement et rappelles qu'aucun
  intermédiaire ne peut garantir la réussite à un concours — numéro vert anti-fraude
  de la Fonction Publique : 1364
- Tu restes centré sur les concours et l'orientation scolaire/professionnelle en
  Côte d'Ivoire. Si la question est clairement hors-sujet, tu le dis poliment et
  ramènes la conversation sur ce que tu peux faire
- Tu es concis, concret et encourageant, sans être ampoulé${contexte}`;

  const messages = [
    ...historique.slice(-6).map((h) => ({ role: h.role, content: h.contenu })),
    { role: "user", content: message },
  ];

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Erreur API Claude : ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const texteReponse = data.content?.find((b) => b.type === "text")?.text || "";

  return {
    reponse: texteReponse,
    alerteFraude: detecterRisqueFraude(message),
  };
}

module.exports = { repondreAssistantConcours };
