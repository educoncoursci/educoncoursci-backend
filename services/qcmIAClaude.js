// ============================================================
//  services/qcmIAClaude.js
//  Génère des questions de QCM avec Claude, puis les VALIDE
//  strictement côté serveur avant de les proposer à l'admin.
//
//  Principe : l'IA ne publie jamais rien. Elle produit des
//  brouillons qu'un humain relit question par question
//  (voir controllers/qcmIAController.js).
// ============================================================

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.CLAUDE_MODEL_QCM || "claude-sonnet-4-6";
const TIMEOUT_MS = 85000;

const NB_OPTIONS = 4;

// Options "fourre-tout" qui cassent le mélange des réponses.
const MOTIFS_OPTIONS_INTERDITES = [
  /toutes les (r[ée]ponses|options|propositions)/i,
  /aucune de(s)? (ces|ci)/i,
  /ci-dessus/i,
  /les deux (premi[èe]res|derni[èe]res)/i,
];

function construirePrompt({ matiere, theme, niveau, difficulte, nombre, concours }) {
  return `Tu es un concepteur de sujets de concours de la fonction publique et d'examens en Côte d'Ivoire.

Rédige ${nombre} questions à choix multiples (QCM), en français, avec ces paramètres :
- Matière : ${matiere}
${theme ? `- Thème précis : ${theme}\n` : ""}${concours ? `- Concours visé : ${concours}\n` : ""}- Niveau d'études visé : ${niveau}
- Difficulté : ${difficulte}

RÈGLES DE QUALITÉ (obligatoires) :
1. Chaque question a exactement ${NB_OPTIONS} options, dont UNE SEULE est correcte et sans ambiguïté.
2. Les mauvaises options doivent être plausibles, mais clairement fausses pour quelqu'un qui connaît le sujet.
3. Interdit : « Toutes les réponses ci-dessus », « Aucune de ces réponses », « Les deux premières », etc.
4. Pose des questions variées (pas deux fois la même idée) et indépendantes les unes des autres.
5. L'explication (1 à 3 phrases) justifie la bonne réponse de façon pédagogique.

RÈGLES ANTI-ERREUR (très importantes) :
6. Ne pose une question factuelle que si tu es CERTAIN du fait. En cas de doute, choisis une autre question.
7. Évite les informations qui changent avec le temps (noms des ministres ou dirigeants actuels, chiffres de population, budgets, résultats récents, dates de concours) sauf si le fait est historique et stable.
8. Pour toute question reposant sur une date, un chiffre précis, un article de loi ou un nom propre, mets "a_verifier": true et explique en une phrase dans "note_verification" ce que l'humain doit contrôler. Sinon mets "a_verifier": false et "note_verification": "".
9. Pour les matières de calcul ou de logique, vérifie toi-même le résultat avant de répondre.

FORMAT DE SORTIE : réponds UNIQUEMENT par un tableau JSON valide, sans texte avant ni après, sans balises de code. Chaque élément a exactement cette forme :
{"question": "…", "options": ["…", "…", "…", "…"], "correct": 0, "explication": "…", "a_verifier": false, "note_verification": ""}
"correct" est l'index (0 à ${NB_OPTIONS - 1}) de la bonne option dans "options".`;
}

function extraireJson(texte) {
  if (!texte) return null;
  let t = texte.trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const debut = t.indexOf("[");
  const fin = t.lastIndexOf("]");
  if (debut === -1 || fin === -1 || fin <= debut) return null;
  try {
    const data = JSON.parse(t.slice(debut, fin + 1));
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function melanger(tableau) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

function normaliser(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Valide UNE question brute produite par l'IA. Retourne la question
// nettoyée (avec options mélangées) ou null si elle est inutilisable.
function validerQuestionIA(brute) {
  if (!brute || typeof brute !== "object") return null;

  const question = typeof brute.question === "string" ? brute.question.trim() : "";
  const explication = typeof brute.explication === "string" ? brute.explication.trim() : "";
  if (question.length < 10 || question.length > 600) return null;
  if (explication.length < 5) return null;

  if (!Array.isArray(brute.options) || brute.options.length !== NB_OPTIONS) return null;
  const options = brute.options.map((o) => (typeof o === "string" ? o.trim() : ""));
  if (options.some((o) => o.length === 0 || o.length > 300)) return null;
  if (new Set(options.map(normaliser)).size !== NB_OPTIONS) return null; // doublons
  if (options.some((o) => MOTIFS_OPTIONS_INTERDITES.some((rx) => rx.test(o)))) return null;

  const correct = Number.isInteger(brute.correct) ? brute.correct : parseInt(brute.correct, 10);
  if (!Number.isInteger(correct) || correct < 0 || correct >= NB_OPTIONS) return null;

  // Mélange les options (l'IA place trop souvent la bonne réponse en B ou C)
  const bonneReponse = options[correct];
  const melangees = melanger(options);

  return {
    question,
    options: melangees,
    correct: melangees.indexOf(bonneReponse),
    explication,
    // Champs de relecture — retirés à la publication
    source: "ia",
    verifiee: false,
    a_verifier: brute.a_verifier === true,
    note_verification:
      typeof brute.note_verification === "string" ? brute.note_verification.trim().slice(0, 300) : "",
  };
}

async function genererQuestions(params) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absente : la génération par IA est indisponible.");
  }

  const controller = new AbortController();
  const minuteur = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 6000,
        temperature: 0.7,
        messages: [{ role: "user", content: construirePrompt(params) }],
      }),
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("La génération a pris trop de temps. Réessaie avec moins de questions.");
    }
    throw err;
  } finally {
    clearTimeout(minuteur);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = (await response.json()).error?.message || detail;
    } catch {
      /* ignore */
    }
    throw new Error(`Erreur API Claude : ${detail}`);
  }

  const data = await response.json();
  const texte = data.content?.find((b) => b.type === "text")?.text || "";
  const brutes = extraireJson(texte);
  if (!brutes) {
    throw new Error("Réponse de l'IA illisible (JSON invalide). Réessaie.");
  }

  const vues = new Set();
  const valides = [];
  for (const b of brutes) {
    const q = validerQuestionIA(b);
    if (!q) continue;
    const cle = normaliser(q.question);
    if (vues.has(cle)) continue;
    vues.add(cle);
    valides.push(q);
  }

  return {
    questions: valides,
    demandees: params.nombre,
    recues: brutes.length,
    rejetees: brutes.length - valides.length,
  };
}

module.exports = { genererQuestions, validerQuestionIA, NB_OPTIONS };
