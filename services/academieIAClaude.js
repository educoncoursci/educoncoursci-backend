// ============================================================
//  services/academieIAClaude.js
//  Académie EduConcoursCI — génération assistée par IA :
//    1. genererPlan()  : titre, description et liste des leçons d'un cours
//    2. genererLecon() : texte, points clés et exercices d'UNE leçon
//
//  L'IA ne publie jamais rien : tout arrive en brouillon et doit être
//  relu et marqué « vérifié » par l'administrateur (voir academieController).
//  Les exercices passent par la même validation stricte que les QCM.
// ============================================================

const { validerQuestionIA } = require("./qcmIAClaude");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.CLAUDE_MODEL_QCM || "claude-sonnet-4-6";
const TIMEOUT_MS = 85000;

const NB_LECONS_MIN = 3;
const NB_LECONS_MAX = 10;
const NB_EXERCICES = 3;

// ── Appel API ───────────────────────────────────────────────
async function appelClaude(prompt, maxTokens) {
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
        max_tokens: maxTokens,
        temperature: 0.6,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("La génération a pris trop de temps. Réessaie.");
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
  return data.content?.find((b) => b.type === "text")?.text || "";
}

function extraireObjetJson(texte) {
  if (!texte) return null;
  const t = texte.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const debut = t.indexOf("{");
  const fin = t.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return null;
  try {
    const obj = JSON.parse(t.slice(debut, fin + 1));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

// Appelle Claude et relance UNE fois si le JSON est illisible.
async function appelJson(prompt, maxTokens) {
  for (let essai = 1; essai <= 2; essai++) {
    const obj = extraireObjetJson(await appelClaude(prompt, maxTokens));
    if (obj) return obj;
  }
  throw new Error("Réponse de l'IA illisible (JSON invalide). Réessaie.");
}

const texte = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ── 1. Plan d'un cours ──────────────────────────────────────
function promptPlan({ matiere, theme, niveau, nbLecons, concours }) {
  return `Tu es un concepteur pédagogique pour la préparation aux concours et examens en Côte d'Ivoire.

Conçois le PLAN d'un cours en ${nbLecons} leçons, en français.
- Matière : ${matiere}
${theme ? `- Thème : ${theme}\n` : ""}${concours ? `- Concours visé : ${concours}\n` : ""}- Niveau d'études visé : ${niveau}

RÈGLES :
1. Les leçons suivent une progression logique, du plus simple au plus avancé, sans se répéter.
2. Chaque leçon porte sur UNE notion précise qui se traite en 10 à 15 minutes de lecture.
3. Pour chaque leçon, "objectifs" résume en 1 à 2 phrases ce que l'apprenant saura faire après la leçon.
4. Ne promets pas de contenu dont tu ne seras pas sûr (pas de chiffres, de dates ou de textes de loi précis dans le plan).

FORMAT : réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de cette forme :
{"titre": "…", "description": "2 à 3 phrases présentant le cours", "lecons": [{"titre": "…", "objectifs": "…"}]}`;
}

async function genererPlan(params) {
  const obj = await appelJson(promptPlan(params), 3000);
  const titre = texte(obj.titre, 200);
  const description = texte(obj.description, 1000);
  const lecons = (Array.isArray(obj.lecons) ? obj.lecons : [])
    .map((l) => ({ titre: texte(l?.titre, 200), objectifs: texte(l?.objectifs, 600) }))
    .filter((l) => l.titre.length >= 3)
    .slice(0, NB_LECONS_MAX);

  if (!titre || lecons.length < NB_LECONS_MIN) {
    throw new Error("Le plan généré est incomplet. Réessaie.");
  }
  return { titre, description, lecons };
}

// ── 2. Contenu d'une leçon ──────────────────────────────────
function promptLecon({ cours, lecon, autresTitres }) {
  return `Tu es un professeur qui prépare des candidats aux concours et examens en Côte d'Ivoire. Rédige le contenu de la leçon suivante, en français, avec un ton clair et pédagogique.

COURS : ${cours.titre} (matière : ${cours.matiere}, niveau : ${cours.niveau})
LEÇON ${lecon.ordre} sur ${lecon.total} : ${lecon.titre}
Objectifs : ${lecon.objectifs || "à déduire du titre"}
Autres leçons du cours (ne pas les empiéter) : ${autresTitres.length ? autresTitres.join(" ; ") : "aucune"}

CONTENU ("contenu") — 350 à 550 mots, en texte avec ce balisage simple uniquement :
- "## Titre" pour un titre de partie, "### Titre" pour un sous-titre
- "- " en début de ligne pour une liste à puces, "1. " pour une liste numérotée
- **gras** pour les termes importants
- des paragraphes séparés par une ligne vide
Structure : une courte introduction, 2 à 4 parties, au moins un exemple concret, puis une courte conclusion.

POINTS CLÉS ("points_cles") : 3 à 5 phrases courtes à retenir.

EXERCICES ("exercices") : exactement ${NB_EXERCICES} QCM sur le contenu de la leçon. Chaque QCM a 4 options, une seule correcte, et une explication de 1 à 2 phrases. Interdit : « Toutes les réponses », « Aucune de ces réponses ».

RÈGLES ANTI-ERREUR (très importantes) :
1. N'écris que des faits dont tu es CERTAIN. En cas de doute, reformule de façon générale ou omets le point.
2. N'invente aucun chiffre, date, article de loi, nom ou statistique. Évite les informations qui changent avec le temps.
3. Si une phrase repose sur une date, un chiffre précis, un nom propre ou un texte de loi, ajoute à l'exercice concerné "a_verifier": true et une courte "note_verification". Sinon "a_verifier": false et "note_verification": "".
4. Pour les calculs et la logique, vérifie toi-même les résultats avant de répondre.

FORMAT : réponds UNIQUEMENT par un objet JSON valide (retours à la ligne du contenu écrits \\n, guillemets internes échappés), sans texte autour :
{"contenu": "…", "points_cles": ["…"], "exercices": [{"question": "…", "options": ["…","…","…","…"], "correct": 0, "explication": "…", "a_verifier": false, "note_verification": ""}]}
"correct" est l'index (0 à 3) de la bonne option.`;
}

async function genererLecon(params) {
  const obj = await appelJson(promptLecon(params), 5000);

  const contenu = texte(obj.contenu, 12000);
  if (contenu.length < 300) {
    throw new Error("Le contenu généré est trop court. Réessaie.");
  }
  const points = (Array.isArray(obj.points_cles) ? obj.points_cles : [])
    .map((p) => texte(p, 300))
    .filter(Boolean)
    .slice(0, 6);

  const vues = new Set();
  const exercices = [];
  for (const brut of Array.isArray(obj.exercices) ? obj.exercices : []) {
    const q = validerQuestionIA(brut);
    if (!q) continue;
    const cle = q.question.toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);
    exercices.push(q);
  }

  return {
    contenu,
    points_cles: points,
    exercices,
    exercicesRejetes: (Array.isArray(obj.exercices) ? obj.exercices.length : 0) - exercices.length,
  };
}

module.exports = { genererPlan, genererLecon, NB_LECONS_MIN, NB_LECONS_MAX };
