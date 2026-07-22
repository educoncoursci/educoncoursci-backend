// ============================================================
//  services/documentsSociauxClaude.js
//  Génération de documents de travail social via Claude IA :
//  Rapport social, Demande d'aide, Fiche de liaison, Projet
//  d'intervention.
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

const AVERTISSEMENT_CONFIDENTIALITE =
  "Ce document contient des informations à caractère personnel et confidentiel. " +
  "Il doit être conservé et transmis dans le respect du secret professionnel et " +
  "des règles de protection des données personnelles.";

// ════════════════════════════════════════════════════════════
//  Rapport social
// ════════════════════════════════════════════════════════════
async function genererRapportSocial(data) {
  const { redacteur, beneficiaire, situation, besoins, actionsMenees, date } = data;

  const prompt = `Tu es un(e) travailleur(se) social(e) ivoirien(ne) expérimenté(e), formé(e) selon les
standards professionnels du travail social (type INSFS). Rédige un rapport social
professionnel, factuel et bienveillant en français.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Rédacteur    : ${redacteur || "Non renseigné"}
Date         : ${date || new Date().toLocaleDateString("fr-FR")}
Bénéficiaire : ${beneficiaire}

═══════════════════════════════════════
SITUATION OBSERVÉE
═══════════════════════════════════════
${situation}

═══════════════════════════════════════
BESOINS IDENTIFIÉS
═══════════════════════════════════════
${besoins}

═══════════════════════════════════════
ACTIONS DÉJÀ MENÉES
═══════════════════════════════════════
${actionsMenees || "Aucune action menée à ce jour."}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════
Structure le rapport ainsi :
1. IDENTIFICATION (bénéficiaire, contexte de la demande/du suivi)
2. SITUATION SOCIALE (reformulée de façon factuelle et neutre à partir des éléments fournis)
3. BESOINS IDENTIFIÉS ET ANALYSE
4. ACTIONS MENÉES ET RECOMMANDATIONS
5. CONCLUSION

- Ton professionnel, factuel, respectueux de la dignité de la personne — jamais de jugement de valeur
- Ne jamais inventer de détails non fournis (pas de diagnostic médical/psychologique non mentionné)
- Termine par cette mention exacte : "${AVERTISSEMENT_CONFIDENTIALITE}"
- Ne génère QUE le rapport, sans commentaire autour`;

  return appelClaude(prompt, 2200);
}

// ════════════════════════════════════════════════════════════
//  Demande d'aide sociale
// ════════════════════════════════════════════════════════════
async function genererDemandeAideSociale(data) {
  const { demandeur, typeAide, motif, situationFamiliale, institution, ville, date } = data;

  const prompt = `Tu es un(e) assistant(e) social(e) ivoirien(ne) qui aide un(e) usager(e) à rédiger
une demande d'aide sociale formelle et respectueuse en français.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Demandeur       : ${demandeur}
Type d'aide demandée : ${typeAide}
Institution destinataire : ${institution || "Institution compétente"}
Ville/Date      : ${ville || "Abidjan"}, le ${date || new Date().toLocaleDateString("fr-FR")}

═══════════════════════════════════════
MOTIF DE LA DEMANDE
═══════════════════════════════════════
${motif}

═══════════════════════════════════════
SITUATION FAMILIALE/PERSONNELLE
═══════════════════════════════════════
${situationFamiliale || "Non précisée."}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
- Structure classique de demande administrative : en-tête, destinataire, objet, corps (contexte + demande claire et digne), formule de politesse, signature
- Ton respectueux et digne, sans misérabilisme ni dramatisation excessive
- Ne génère QUE la lettre, sans commentaire autour`;

  return appelClaude(prompt, 1200);
}

// ════════════════════════════════════════════════════════════
//  Fiche de liaison
// ════════════════════════════════════════════════════════════
async function genererFicheLiaison(data) {
  const { redacteur, beneficiaire, structureDestinataire, motifTransmission, elementsATransmettre, date } = data;

  const prompt = `Tu es un(e) travailleur(se) social(e) ivoirien(ne). Rédige une fiche de liaison
professionnelle et concise en français, destinée à transmettre des informations
utiles à un(e) autre professionnel(le) ou structure.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Rédacteur              : ${redacteur || "Non renseigné"}
Date                   : ${date || new Date().toLocaleDateString("fr-FR")}
Bénéficiaire concerné  : ${beneficiaire}
Structure destinataire : ${structureDestinataire}

═══════════════════════════════════════
MOTIF DE LA TRANSMISSION
═══════════════════════════════════════
${motifTransmission}

═══════════════════════════════════════
ÉLÉMENTS À TRANSMETTRE
═══════════════════════════════════════
${elementsATransmettre || "Voir motif ci-dessus."}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
- Format court et structuré : identification, motif, informations essentielles, action attendue de la structure destinataire
- Ton factuel et professionnel, va à l'essentiel
- Termine par cette mention exacte : "${AVERTISSEMENT_CONFIDENTIALITE}"
- Ne génère QUE la fiche, sans commentaire autour`;

  return appelClaude(prompt, 1000);
}

// ════════════════════════════════════════════════════════════
//  Projet d'intervention sociale
// ════════════════════════════════════════════════════════════
async function genererProjetIntervention(data) {
  const { redacteur, beneficiaire, contexte, objectifs, actionsEnvisagees, echeance, date } = data;

  const prompt = `Tu es un(e) travailleur(se) social(e) ivoirien(ne) expérimenté(e). Rédige un
projet d'intervention sociale structuré et professionnel en français.

═══════════════════════════════════════
INFORMATIONS
═══════════════════════════════════════
Rédacteur    : ${redacteur || "Non renseigné"}
Date         : ${date || new Date().toLocaleDateString("fr-FR")}
Bénéficiaire : ${beneficiaire}
Échéance envisagée : ${echeance || "À définir"}

═══════════════════════════════════════
CONTEXTE
═══════════════════════════════════════
${contexte || "Non précisé."}

═══════════════════════════════════════
OBJECTIFS DE L'INTERVENTION
═══════════════════════════════════════
${objectifs}

═══════════════════════════════════════
ACTIONS ENVISAGÉES
═══════════════════════════════════════
${actionsEnvisagees}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════
Structure le projet ainsi :
1. CONTEXTE ET JUSTIFICATION
2. OBJECTIFS (généraux et spécifiques)
3. ACTIONS ET MOYENS À MOBILISER
4. CALENDRIER PRÉVISIONNEL
5. MODALITÉS DE SUIVI ET D'ÉVALUATION

- Ton professionnel, concret et actionnable
- Ne jamais inventer de moyens ou partenaires non mentionnés
- Termine par cette mention exacte : "${AVERTISSEMENT_CONFIDENTIALITE}"
- Ne génère QUE le projet, sans commentaire autour`;

  return appelClaude(prompt, 2200);
}

module.exports = {
  genererRapportSocial,
  genererDemandeAideSociale,
  genererFicheLiaison,
  genererProjetIntervention,
};
