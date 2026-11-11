// ============================================================
//  services/claude.js
//  Appel à l'API Anthropic (Claude) pour générer CV et LM.
//  La clé API reste côté serveur — jamais exposée au frontend.
// ============================================================

const fetch = require("node-fetch");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL         = "claude-sonnet-4-6";

// ── Appel générique à l'API Claude ───────────────────────────
async function appelClaude(prompt, maxTokens = 1500) {
const response = await fetch(ANTHROPIC_URL, {
method:  "POST",
headers: {
"Content-Type":         "application/json",
"x-api-key":            process.env.ANTHROPIC_API_KEY,
"anthropic-version":    "2023-06-01",
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
//  Génère un CV professionnel
// ════════════════════════════════════════════════════════════
async function genererCV(data) {
const {
nom, email, telephone, ville, pays,
poste, profil,
experiences, formations,
competences, langues, loisirs,
} = data;

const prompt = `Tu es un expert RH et rédacteur professionnel ivoirien.
Génère un CV professionnel moderne en français, adapté au marché ivoirien
(entreprises privées, ONG internationales, Fonction Publique de Côte d'Ivoire).

═══════════════════════════════════════
INFORMATIONS DU CANDIDAT
═══════════════════════════════════════
Nom complet     : ${nom}
E-mail          : ${email || "Non renseigné"}
Téléphone       : ${telephone || "Non renseigné"}
Ville / Pays    : ${ville || "Abidjan"}, ${pays || "Côte d'Ivoire"}
Poste recherché : ${poste}
Profil résumé   : ${profil || "À compléter"}

═══════════════════════════════════════
EXPÉRIENCES PROFESSIONNELLES
═══════════════════════════════════════
${experiences.map((e, i) =>
`${i + 1}. ${e.poste} — ${e.entreprise} (${e.debut} – ${e.fin || "Présent"}) ${e.description || "Missions à préciser"}`
).join("\n")}

═══════════════════════════════════════
FORMATIONS
═══════════════════════════════════════
${formations.map((f, i) =>
`${i + 1}. ${f.diplome} — ${f.etablissement} (${f.annee})${f.mention ? ` — Mention : ${f.mention}` : ""}`
).join("\n")}

═══════════════════════════════════════
COMPÉTENCES    : ${competences || "À préciser"}
LANGUES        : ${langues || "Français (courant)"}
LOISIRS        : ${loisirs || "Non renseigné"}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════

- Rédige un CV complet et professionnel en français administratif de haut niveau
- Structure : En-tête > Profil professionnel > Expériences > Formations > Compétences > Langues > Loisirs
- Utilise des verbes d'action forts et des formulations percutantes
- Adapte le ton aux recruteurs ivoiriens (entreprises, ONG, administrations)
- Présente le texte avec des séparateurs clairs (═══, ───, etc.)

RÈGLES D'INTÉGRITÉ (obligatoires) :
- N'invente AUCUNE information : ni employeur, ni date, ni diplôme, ni chiffre, ni résultat, ni compétence absents des données ci-dessus
- Reformule et structure uniquement ce qui est fourni. Si une rubrique est vide (« À préciser », « Non renseigné »), OMETS-la entièrement : pas de texte de remplissage, pas de crochets à compléter
- Si une expérience n'a pas de missions détaillées, n'écris que l'intitulé, l'employeur et les dates

RÈGLES DE QUALITÉ :
- Profil professionnel de 3 à 4 lignes, tourné vers le poste recherché, sans pronom « je »
- Expériences et formations par ordre antichronologique (la plus récente d'abord)
- Missions en puces courtes, chacune commençant par un verbe d'action (passé pour les postes terminés, présent pour le poste actuel)
- Reprends naturellement les mots-clés du poste recherché dans le profil et les compétences, sans ajouter de compétences non fournies (lisibilité par les logiciels de tri ATS)
- Regroupe les compétences par catégories si elles dépassent six
- Dates dans un format unique et cohérent ; une page si le candidat a moins de 5 ans d'expérience, deux pages maximum sinon
- Ne génère QUE le CV, sans commentaire ni introduction avant ou après`;
  
  return appelClaude(prompt, 1800);
  }

// ════════════════════════════════════════════════════════════
//  Génère une Lettre de Motivation
// ════════════════════════════════════════════════════════════
async function genererLM(data) {
const {
nom, email, telephone, ville,
destinataire, organisation, poste,
type, motivation, experience,
atout1, atout2, atout3,
} = data;

const prompt = `Tu es un expert en rédaction administrative et professionnelle ivoirienne.
Rédige une lettre de motivation formelle et convaincante en français,
adaptée aux standards des recruteurs ivoiriens (entreprises, ONG, Fonction Publique CI).

═══════════════════════════════════════
INFORMATIONS DU CANDIDAT
═══════════════════════════════════════
Nom complet  : ${nom}
E-mail       : ${email || "Non renseigné"}
Téléphone    : ${telephone || "Non renseigné"}
Ville        : ${ville || "Abidjan, Côte d'Ivoire"}
Date du jour : ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" })}

═══════════════════════════════════════
INFORMATIONS SUR LE POSTE
═══════════════════════════════════════
Type           : ${type === "spontanee" ? "Candidature spontanée" : "Réponse à une offre d'emploi"}
Poste visé     : ${poste}
Organisation   : ${organisation}
Destinataire   : ${destinataire || "Monsieur/Madame le Directeur(rice) des Ressources Humaines"}

═══════════════════════════════════════
ARGUMENTS DU CANDIDAT
═══════════════════════════════════════
Motivation principale       : ${motivation || "À préciser"}
Expérience / Formation clé  : ${experience || "À préciser"}
Atout 1                     : ${atout1 || "À préciser"}
Atout 2                     : ${atout2 || ""}
Atout 3                     : ${atout3 || ""}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════

- Rédige une lettre formelle complète (~300-380 mots)
- Structure : En-tête > Objet > Introduction percutante > Corps (2-3 §) > Conclusion > Formule de politesse
- Style : élégant, formel, confiant sans arrogance
- Met en valeur les atouts du candidat de façon naturelle et convaincante
- Utilise les formules de politesse ivoiriennes / francophones appropriées

RÈGLES D'INTÉGRITÉ (obligatoires) :
- N'invente AUCUN diplôme, expérience, employeur, chiffre ou réalisation absents des informations ci-dessus
- Si un champ est « À préciser » ou vide, n'en parle pas : pas de texte de remplissage ni de crochets à compléter

RÈGLES DE QUALITÉ :
- Place le lieu et la date du jour (ci-dessus) en en-tête, puis un objet précis (ex. « Objet : Candidature au poste de … »)
- Personnalise : mentionne l'organisation et le poste visés dès l'introduction, avec une accroche spécifique plutôt qu'une phrase générique
- Ne recopie pas le CV : relie 2 ou 3 atouts du candidat à ce que le poste demande réellement
- Pour une candidature spontanée, explique l'intérêt pour l'organisation sans prétendre répondre à une offre précise
- Évite les formules creuses (« depuis mon plus jeune âge », « je suis très motivé ») ; préfère des faits tirés des informations fournies
- Termine par une disponibilité pour un entretien, puis la formule de politesse
- Ne génère QUE la lettre, sans commentaire ni explication autour`;
  
  return appelClaude(prompt, 1400);
  }

// ════════════════════════════════════════════════════════════
//  Génère un conseil de révision personnalisé (bonus)
// ════════════════════════════════════════════════════════════
async function genererConseilRevision(matiere, scoreActuel, total) {
const pourcentage = Math.round((scoreActuel / total) * 100);

const prompt = `Tu es un formateur expert en préparation aux concours de la Fonction Publique de Côte d'Ivoire.

Un candidat vient d'obtenir ${scoreActuel}/${total} (${pourcentage}%) en ${matiere}.

Donne-lui :

1. Une évaluation courte et bienveillante de son niveau (2 phrases max)
2. Les 3 points clés à revoir en priorité pour ${matiere}
3. Une méthode concrète de révision adaptée aux concours CI (3 étapes max)
4. Un message d'encouragement personnalisé (1 phrase)

Réponds en français, de façon directe et pratique. Maximum 150 mots au total.`;

return appelClaude(prompt, 400);
}

module.exports = { genererCV, genererLM, genererConseilRevision, analyserATS, adapterCVOffre };

// ════════════════════════════════════════════════════════════
//  Analyse la compatibilité ATS d'un CV (score + recommandations)
// ════════════════════════════════════════════════════════════
async function analyserATS(contenuCV, offreEmploi) {
  const contexteOffre = offreEmploi
    ? `\n\nVoici l'offre d'emploi visée par le candidat :\n"""${offreEmploi}"""\n\nCompare le CV à cette offre précise.`
    : "\n\nAucune offre spécifique fournie — évalue la compatibilité ATS générale du CV.";

  const prompt = `Tu es un expert en systèmes ATS (Applicant Tracking System) et recrutement.

Voici le contenu d'un CV :
"""
${contenuCV}
"""
${contexteOffre}

Analyse ce CV et réponds UNIQUEMENT avec un objet JSON valide (rien d'autre, pas de texte avant/après, pas de balises markdown), avec exactement cette structure :

{
  "score": <nombre entier de 0 à 100>,
  "resume": "<1-2 phrases résumant la compatibilité ATS globale>",
  "pointsForts": ["<point fort 1>", "<point fort 2>", "<point fort 3>"],
  "motsClesManquants": ["<mot-clé 1>", "<mot-clé 2>", "<mot-clé 3>"],
  "recommandations": ["<recommandation concrète 1>", "<recommandation concrète 2>", "<recommandation concrète 3>"]
}

Le score doit refléter : la présence de mots-clés pertinents, la clarté de la structure, l'absence d'éléments qui bloquent les ATS (tableaux complexes, icônes, etc.), et l'adéquation avec l'offre si fournie.`;

  const reponse = await appelClaude(prompt, 800);
  const nettoye = reponse.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(nettoye);
  } catch {
    // Repli si le modèle ne renvoie pas un JSON parfaitement valide
    return {
      score: null,
      resume: "L'analyse n'a pas pu être structurée automatiquement. Réessaie dans quelques instants.",
      pointsForts: [],
      motsClesManquants: [],
      recommandations: [],
    };
  }
}

// ════════════════════════════════════════════════════════════
//  Adapte un CV existant pour coller à une offre d'emploi précise
// ════════════════════════════════════════════════════════════
async function adapterCVOffre(contenuCV, offreEmploi) {
  const prompt = `Tu es un expert RH et coach carrière ivoirien, spécialisé dans l'optimisation ATS.

Voici le CV actuel du candidat :
"""
${contenuCV}
"""

Voici l'offre d'emploi à laquelle il souhaite postuler :
"""
${offreEmploi}
"""

Réécris ce CV pour qu'il corresponde mieux à cette offre précise :
- Reprends la même structure générale (en-tête, profil, expériences, formations, compétences, langues)
- Mets en avant en priorité les expériences et compétences les plus pertinentes pour cette offre
- Intègre naturellement les mots-clés importants de l'offre (sans les inventer s'ils ne correspondent à rien de réel dans le parcours du candidat)
- Ne modifie jamais les faits (dates, noms d'entreprises, diplômes) — reformule seulement la présentation et les priorités
- Garde le même format de présentation avec séparateurs (═══, ───)
- Ne génère QUE le CV adapté, sans commentaire ni explication autour`;

  return appelClaude(prompt, 1800);
}