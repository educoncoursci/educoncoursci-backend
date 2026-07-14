// ============================================================
//  services/claude.js
//  Appel à l’API Anthropic (Claude) pour générer CV et LM.
//  La clé API reste côté serveur — jamais exposée au frontend.
// ============================================================

const fetch = require(“node-fetch”);

const ANTHROPIC_URL = “https://api.anthropic.com/v1/messages”;
const MODEL         = “claude-sonnet-4-6”;

// ── Appel générique à l’API Claude ───────────────────────────
async function appelClaude(prompt, maxTokens = 1500) {
const response = await fetch(ANTHROPIC_URL, {
method:  “POST”,
headers: {
“Content-Type”:         “application/json”,
“x-api-key”:            process.env.ANTHROPIC_API_KEY,
“anthropic-version”:    “2023-06-01”,
},
body: JSON.stringify({
model:      MODEL,
max_tokens: maxTokens,
messages:   [{ role: “user”, content: prompt }],
}),
});

if (!response.ok) {
const err = await response.json();
throw new Error(`Erreur API Claude : ${err.error?.message || response.statusText}`);
}

const data = await response.json();
return data.content?.find(b => b.type === “text”)?.text || “”;
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
(entreprises privées, ONG internationales, Fonction Publique de Côte d’Ivoire).

═══════════════════════════════════════
INFORMATIONS DU CANDIDAT
═══════════════════════════════════════
Nom complet     : ${nom}
E-mail          : ${email || “Non renseigné”}
Téléphone       : ${telephone || “Non renseigné”}
Ville / Pays    : ${ville || “Abidjan”}, ${pays || “Côte d’Ivoire”}
Poste recherché : ${poste}
Profil résumé   : ${profil || “À compléter”}

═══════════════════════════════════════
EXPÉRIENCES PROFESSIONNELLES
═══════════════════════════════════════
${experiences.map((e, i) =>
`${i + 1}. ${e.poste} — ${e.entreprise} (${e.debut} – ${e.fin || "Présent"}) ${e.description || "Missions à préciser"}`
).join(”\n”)}

═══════════════════════════════════════
FORMATIONS
═══════════════════════════════════════
${formations.map((f, i) =>
`${i + 1}. ${f.diplome} — ${f.etablissement} (${f.annee})${f.mention ? ` — Mention : ${f.mention}` : ""}`
).join(”\n”)}

═══════════════════════════════════════
COMPÉTENCES    : ${competences || “À préciser”}
LANGUES        : ${langues || “Français (courant)”}
LOISIRS        : ${loisirs || “Non renseigné”}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════

- Rédige un CV complet et professionnel en français administratif de haut niveau
- Structure : En-tête > Profil professionnel > Expériences > Formations > Compétences > Langues > Loisirs
- Utilise des verbes d’action forts et des formulations percutantes
- Adapte le ton aux recruteurs ivoiriens (entreprises, ONG, administrations)
- Présente le texte avec des séparateurs clairs (═══, ───, etc.)
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
E-mail       : ${email || “Non renseigné”}
Téléphone    : ${telephone || “Non renseigné”}
Ville        : ${ville || “Abidjan, Côte d’Ivoire”}

═══════════════════════════════════════
INFORMATIONS SUR LE POSTE
═══════════════════════════════════════
Type           : ${type === “spontanee” ? “Candidature spontanée” : “Réponse à une offre d’emploi”}
Poste visé     : ${poste}
Organisation   : ${organisation}
Destinataire   : ${destinataire || “Monsieur/Madame le Directeur(rice) des Ressources Humaines”}

═══════════════════════════════════════
ARGUMENTS DU CANDIDAT
═══════════════════════════════════════
Motivation principale       : ${motivation || “À préciser”}
Expérience / Formation clé  : ${experience || “À préciser”}
Atout 1                     : ${atout1 || “À préciser”}
Atout 2                     : ${atout2 || “”}
Atout 3                     : ${atout3 || “”}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════

- Rédige une lettre formelle complète (~300-380 mots)
- Structure : En-tête > Objet > Introduction percutante > Corps (2-3 §) > Conclusion > Formule de politesse
- Style : élégant, formel, confiant sans arrogance
- Met en valeur les atouts du candidat de façon naturelle et convaincante
- Utilise les formules de politesse ivoiriennes / francophones appropriées
- Ne génère QUE la lettre, sans commentaire ni explication autour`;
  
  return appelClaude(prompt, 1400);
  }

// ════════════════════════════════════════════════════════════
//  Génère un conseil de révision personnalisé (bonus)
// ════════════════════════════════════════════════════════════
async function genererConseilRevision(matiere, scoreActuel, total) {
const pourcentage = Math.round((scoreActuel / total) * 100);

const prompt = `Tu es un formateur expert en préparation aux concours de la Fonction Publique de Côte d’Ivoire.

Un candidat vient d’obtenir ${scoreActuel}/${total} (${pourcentage}%) en ${matiere}.

Donne-lui :

1. Une évaluation courte et bienveillante de son niveau (2 phrases max)
1. Les 3 points clés à revoir en priorité pour ${matiere}
1. Une méthode concrète de révision adaptée aux concours CI (3 étapes max)
1. Un message d’encouragement personnalisé (1 phrase)

Réponds en français, de façon directe et pratique. Maximum 150 mots au total.`;

return appelClaude(prompt, 400);
}

module.exports = { genererCV, genererLM, genererConseilRevision };