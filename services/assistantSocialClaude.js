// ============================================================
//  services/assistantSocialClaude.js
//  Assistant IA spécialisé en orientation sociale/administrative.
//
//  RÈGLES DE SÉCURITÉ STRICTES :
//  - Ne remplace JAMAIS un professionnel humain (médecin, psy,
//    travailleur social, avocat, policier)
//  - Détecte les signaux de détresse/urgence et affiche
//    systématiquement les numéros d'urgence appropriés, en plus
//    de toute réponse textuelle
//  - Ne donne aucun diagnostic médical ou psychologique
//  - Reste sur l'orientation, l'information générale et
//    l'accompagnement administratif
// ============================================================

const fetch = require("node-fetch");
const { NUMEROS_URGENCE } = require("../config/urgencesSociales");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL         = "claude-sonnet-4-6";

// Mots-clés déclenchant l'affichage systématique des numéros d'urgence,
// en plus de la réponse de l'IA (filet de sécurité indépendant du modèle)
const MOTS_ALERTE = [
  "suicide", "me tuer", "en finir", "plus envie de vivre", "mourir",
  "violence", "battu", "frappé", "maltraitance", "viol", "agressé",
  "danger", "peur pour ma vie", "menace de mort",
];

function detecterAlerte(texte) {
  const t = texte.toLowerCase();
  return MOTS_ALERTE.some(mot => t.includes(mot));
}

function urgencesPertinentes(texte) {
  const t = texte.toLowerCase();
  const pertinentes = [];

  if (/suicide|me tuer|en finir|mourir|plus envie de vivre/.test(t)) {
    pertinentes.push(NUMEROS_URGENCE.find(n => n.numero === "139"));
  }
  if (/enfant|mineur|fille|garçon/.test(t) && /viol|maltrait|danger|battu|frappé/.test(t)) {
    pertinentes.push(NUMEROS_URGENCE.find(n => n.numero === "116"));
  }
  if (/femme|épouse|conjoint|mari/.test(t) && /viol|battu|frappé|violence/.test(t)) {
    pertinentes.push(NUMEROS_URGENCE.find(n => n.numero === "1308"));
  }
  if (/danger immédiat|urgence|en danger maintenant/.test(t)) {
    pertinentes.push(NUMEROS_URGENCE.find(n => n.numero === "111"));
  }

  // Filet par défaut : écoute psychologique + police, si alerte générale sans match précis
  if (pertinentes.length === 0) {
    pertinentes.push(NUMEROS_URGENCE.find(n => n.numero === "139"));
  }

  return pertinentes.filter(Boolean);
}

async function repondreAssistantSocial(message, historique = []) {
  const alerteDetectee = detecterAlerte(message);

  const systemPrompt = `Tu es un assistant d'orientation sociale et administrative pour la plateforme
EduConcoursCI, à destination d'usagers en Côte d'Ivoire. Tu n'es PAS un travailleur
social, un médecin, un psychologue ou un avocat — tu es un outil d'orientation et
d'information générale.

RÈGLES STRICTES QUE TU DOIS TOUJOURS RESPECTER :
- Tu ne poses jamais de diagnostic médical ou psychologique
- Tu ne donnes jamais de conseil juridique définitif — tu orientes vers un professionnel
- Si la personne évoque une détresse, une violence, un danger ou des idées suicidaires,
  tu dois avec empathie l'inviter à contacter immédiatement les services d'urgence
  appropriés (déjà affichés séparément à l'écran, tu peux les mentionner brièvement
  mais ne les invente jamais toi-même)
- Tu restes concis, chaleureux et concret
- Pour les démarches administratives, oriente vers les vraies structures ivoiriennes
  (CNPS, CMU, centres sociaux, ministères) sans inventer de noms d'organismes qui
  n'existent pas
- Tu ne remplaces jamais un rendez-vous avec un vrai professionnel — rappelle-le
  si la situation semble complexe ou grave`;

  const messages = [
    ...historique.slice(-6).map(h => ({ role: h.role, content: h.contenu })),
    { role: "user", content: message },
  ];

  const response = await fetch(ANTHROPIC_URL, {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 700,
      system:     systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Erreur API Claude : ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const texteReponse = data.content?.find(b => b.type === "text")?.text || "";

  return {
    reponse: texteReponse,
    alerte: alerteDetectee,
    numerosUrgence: alerteDetectee ? urgencesPertinentes(message) : [],
  };
}

module.exports = { repondreAssistantSocial };
