// ============================================================
//  services/documentsAdminClaude.js
//  Génération de documents administratifs via Claude IA :
//  Demande, Attestation, Courrier, Compte rendu, Procès-verbal.
// ============================================================

const fetch = require("node-fetch");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL         = "claude-sonnet-4-6";

async function appelClaude(prompt, maxTokens = 1500) {
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
//  Demande officielle
// ════════════════════════════════════════════════════════════
async function genererDemande(data) {
  const { expediteur, destinataire, objet, motif, ville, date } = data;

  const prompt = `Tu es un assistant administratif ivoirien expert en correspondance officielle.
Rédige une lettre de demande formelle et professionnelle en français.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Expéditeur   : ${expediteur || "Non renseigné"}
Destinataire : ${destinataire}
Ville/Date   : ${ville || "Abidjan"}, le ${date || new Date().toLocaleDateString("fr-FR")}
Objet        : ${objet}
Motif détaillé de la demande : ${motif}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
- Structure classique administrative ivoirienne : en-tête expéditeur, lieu et date, destinataire, objet, formule d'appel, corps de la lettre (contexte + demande claire), formule de politesse formelle, signature
- Ton respectueux, clair et direct, sans détours inutiles
- Ne génère QUE la lettre, sans commentaire autour`;

  return appelClaude(prompt, 1200);
}

// ════════════════════════════════════════════════════════════
//  Attestation
// ════════════════════════════════════════════════════════════
async function genererAttestation(data) {
  const { typeAttestation, declarant, objet, details, ville, date } = data;

  const prompt = `Tu es un assistant administratif ivoirien expert en documents officiels.
Rédige une attestation formelle en français.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Type d'attestation : ${typeAttestation}
Déclarant (qui atteste) : ${declarant}
Objet de l'attestation : ${objet}
Détails complémentaires : ${details || "Aucun détail supplémentaire."}
Ville/Date : ${ville || "Abidjan"}, le ${date || new Date().toLocaleDateString("fr-FR")}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
- Structure officielle d'attestation : titre centré ("ATTESTATION DE ..." ou "ATTESTATION SUR L'HONNEUR"), formule "Je soussigné(e)...", corps du texte déclaratif, mention "Fait pour servir et valoir ce que de droit", lieu/date, ligne de signature
- Ton solennel et précis, format court et dense
- Ne génère QUE l'attestation, sans commentaire autour`;

  return appelClaude(prompt, 900);
}

// ════════════════════════════════════════════════════════════
//  Courrier administratif
// ════════════════════════════════════════════════════════════
async function genererCourrier(data) {
  const { expediteur, destinataire, objet, contenu, ville, date } = data;

  const prompt = `Tu es un assistant administratif ivoirien expert en correspondance officielle.
Rédige un courrier administratif formel et professionnel en français.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Expéditeur   : ${expediteur || "Non renseigné"}
Destinataire : ${destinataire}
Ville/Date   : ${ville || "Abidjan"}, le ${date || new Date().toLocaleDateString("fr-FR")}
Objet        : ${objet}
Éléments à inclure dans le courrier : ${contenu}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
- Structure classique de courrier officiel : en-tête, lieu/date, destinataire, objet, formule d'appel, corps structuré et clair, formule de politesse, signature
- Adapte le ton selon le contexte (institutionnel, professionnel, associatif)
- Ne génère QUE le courrier, sans commentaire autour`;

  return appelClaude(prompt, 1200);
}

// ════════════════════════════════════════════════════════════
//  Compte rendu de réunion
// ════════════════════════════════════════════════════════════
async function genererCompteRendu(data) {
  const { titreReunion, date, lieu, participants, pointsAbordes, decisions } = data;

  const prompt = `Tu es un secrétaire de séance professionnel expert en comptes rendus.
Rédige un compte rendu de réunion structuré et clair en français.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Titre de la réunion : ${titreReunion}
Date : ${date}
Lieu : ${lieu || "Non précisé"}
Participants : ${participants}

═══════════════════════════════════════
POINTS ABORDÉS
═══════════════════════════════════════
${pointsAbordes}

═══════════════════════════════════════
DÉCISIONS PRISES
═══════════════════════════════════════
${decisions || "À déterminer à partir des points abordés."}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
Structure le compte rendu ainsi :
1. En-tête (titre, date, lieu, participants/absents)
2. ORDRE DU JOUR
3. DÉROULEMENT DE LA RÉUNION (point par point, reformulé clairement à partir des éléments fournis)
4. DÉCISIONS ET ACTIONS À MENER (avec responsable et échéance si mentionné)
5. Prochaine réunion (si pertinent)

- Ton neutre et factuel, pas d'interprétation ajoutée
- Ne génère QUE le compte rendu, sans commentaire autour`;

  return appelClaude(prompt, 1800);
}

// ════════════════════════════════════════════════════════════
//  Procès-verbal
// ════════════════════════════════════════════════════════════
async function genererProcesVerbal(data) {
  const { typeProcesVerbal, date, lieu, participants, decisions, contexte } = data;

  const prompt = `Tu es un assistant juridique administratif ivoirien (PAS un avocat).
Rédige un procès-verbal formel en français, à titre indicatif.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Type de procès-verbal : ${typeProcesVerbal}
Date : ${date}
Lieu : ${lieu || "Non précisé"}
Participants/Membres présents : ${participants}
Contexte : ${contexte || "Non précisé"}

═══════════════════════════════════════
DÉLIBÉRATIONS / DÉCISIONS
═══════════════════════════════════════
${decisions}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
- Structure officielle : en-tête (type, date, lieu), constat de quorum/présence, déroulement des délibérations, décisions actées formellement, clôture, mentions de signature des membres
- Ton solennel et juridique de base
- Termine par : "Ce document est un modèle indicatif. Il est recommandé de le faire valider par les instances compétentes avant diffusion officielle."
- Ne génère QUE le procès-verbal (avec l'avertissement final inclus), sans commentaire autour`;

  return appelClaude(prompt, 2000);
}

module.exports = {
  genererDemande,
  genererAttestation,
  genererCourrier,
  genererCompteRendu,
  genererProcesVerbal,
};
