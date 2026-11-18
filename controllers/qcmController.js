// ============================================================
//  controllers/qcmController.js
//  Gère : liste, détail, soumission score, CRUD QCM
// ============================================================

const QCM   = require("../models/QCM");
const Score = require("../models/Score");

// ════════════════════════════════════════════════════════════
//  GET /api/qcm — Liste des QCM disponibles
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
try {
const { matiere, difficulte, premium, limit, offset } = req.query;

let filtrerPremium;
if (premium !== undefined) filtrerPremium = premium === "true";

const qcmListe = await QCM.findAll({
  matiere,
  difficulte,
  premium:  filtrerPremium,
  limit:    parseInt(limit)  || 50,
  offset:   parseInt(offset) || 0,
});

// Marque les QCM verrouillés pour les non-Premium
const liste = qcmListe.map(q => ({
  ...q,
  verrouille: q.premium && (req.user ? (req.user.role !== "admin" && !req.user.premium) : true),
}));

res.json({ total: liste.length, qcm: liste });

} catch (err) {
console.error("Erreur liste QCM :", err.message);
res.status(500).json({ error: "Erreur lors de la récupération des QCM." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/qcm/:id — QCM complet avec questions
// ════════════════════════════════════════════════════════════
exports.detail = async (req, res) => {
try {
const qcm = await QCM.findById(req.params.id);
if (!qcm) {
return res.status(404).json({ error: "QCM introuvable." });
}

// Un brouillon (ex. généré par IA, pas encore relu) n'est visible que par l'admin
if (qcm.statut !== "publié" && req.user?.role !== "admin") {
return res.status(404).json({ error: "QCM introuvable." });
}

// Vérifie les droits Premium
if (qcm.premium && (req.user ? (req.user.role !== "admin" && !req.user.premium) : true)) {
  return res.status(403).json({
    error:   "Contenu réservé aux abonnés Premium.",
    premium: true,
  });
}

// On n'envoie PAS les bonnes réponses au frontend avant soumission
// pour éviter la triche (inspection réseau)
const questionsSansReponses = qcm.questions.map((q, index) => ({
  index,
  id:          q.id,
  question:    q.question,
  options:     q.options,
  explication: null, // masquée jusqu'à correction
}));

res.json({
  qcm: {
    ...qcm,
    questions:       questionsSansReponses,
    questions_json:  undefined,
  },
});

} catch (err) {
console.error("Erreur détail QCM :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/qcm/:id/score — Soumettre les réponses + correction
// ════════════════════════════════════════════════════════════
exports.soumettre = async (req, res) => {
try {
const { reponses } = req.body;
// reponses = { "0": 2, "1": 0, "2": 3, … } (index question: index réponse choisie)

if (!reponses || typeof reponses !== "object") {
  return res.status(400).json({ error: "Réponses manquantes ou format invalide." });
}

const qcm = await QCM.findById(req.params.id);
if (!qcm || (qcm.statut !== "publié" && req.user?.role !== "admin")) {
  return res.status(404).json({ error: "QCM introuvable." });
}

// Correction automatique
let score = 0;
const corrections = qcm.questions.map((q, index) => {
  const reponseUtilisateur = parseInt(reponses[index]);
  const estCorrecte        = reponseUtilisateur === q.correct;
  if (estCorrecte) score++;
  return {
    question:            q.question,
    reponse_utilisateur: reponseUtilisateur,
    bonne_reponse:       q.correct,
    est_correcte:        estCorrecte,
    explication:         q.explication || null,
  };
});

const total       = qcm.questions.length;
const pourcentage = Math.round((score / total) * 100);

// Incrémenter les tentatives du QCM
await QCM.incrementerTentatives(qcm.id);

// Enregistrer le score si l'utilisateur est connecté
let scoreEnregistre = null;
if (req.user) {
  scoreEnregistre = await Score.create({
    userId:    req.user.id,
    qcmId:     qcm.id,
    qcmTitre:  qcm.titre,
    score,
    total,
  });
}

res.json({
  score,
  total,
  pourcentage,
  mention:     getMention(pourcentage),
  corrections,
  score_id:    scoreEnregistre?.id || null,
});

} catch (err) {
console.error("Erreur soumission QCM :", err.message);
res.status(500).json({ error: "Erreur lors de la correction." });
}
};

// Retourne la mention selon le pourcentage
function getMention(pourcentage) {
if (pourcentage >= 90) return "Excellent 🏆";
if (pourcentage >= 75) return "Très bien 🥇";
if (pourcentage >= 60) return "Bien 👍";
if (pourcentage >= 50) return "Passable ✅";
return "À revoir 📚";
}

// ════════════════════════════════════════════════════════════
//  POST /api/qcm — Créer un QCM (admin)
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
try {
const { titre, matiere, difficulte, statut, questions, premium } = req.body;

if (!titre || !matiere) {
  return res.status(400).json({ error: "Titre et matière sont requis." });
}
if (!questions || !Array.isArray(questions) || questions.length === 0) {
  return res.status(400).json({ error: "Au moins une question est requise." });
}

// Valide le format de chaque question
for (const [i, q] of questions.entries()) {
  if (!q.question || !q.options || q.options.length < 2) {
    return res.status(400).json({
      error: `Question ${i + 1} invalide : énoncé et au moins 2 options requis.`
    });
  }
  if (q.correct === undefined || q.correct < 0 || q.correct >= q.options.length) {
    return res.status(400).json({
      error: `Question ${i + 1} : index de bonne réponse invalide.`
    });
  }
}

const qcm = await QCM.create({
  titre, matiere, difficulte, statut, questions,
  premium: premium === true || premium === "true",
});

res.status(201).json({ message: "QCM créé avec succès.", qcm });

} catch (err) {
console.error("Erreur créer QCM :", err.message);
res.status(500).json({ error: "Erreur lors de la création du QCM." });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/qcm/:id — Modifier (admin)
// ════════════════════════════════════════════════════════════
exports.modifier = async (req, res) => {
try {
const qcm = await QCM.findById(req.params.id);
if (!qcm) return res.status(404).json({ error: "QCM introuvable." });

const modifie = await QCM.update(req.params.id, req.body);
res.json({ message: "QCM modifié avec succès.", qcm: modifie });

} catch (err) {
console.error("Erreur modifier QCM :", err.message);
res.status(500).json({ error: "Erreur lors de la modification." });
}
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/qcm/:id — Supprimer (admin)
// ════════════════════════════════════════════════════════════
exports.supprimer = async (req, res) => {
try {
const qcm = await QCM.findById(req.params.id);
if (!qcm) return res.status(404).json({ error: "QCM introuvable." });

await QCM.delete(req.params.id);
res.json({ message: "QCM supprimé avec succès." });

} catch (err) {
console.error("Erreur supprimer QCM :", err.message);
res.status(500).json({ error: "Erreur lors de la suppression." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/qcm/examen-blanc/score — Enregistrer un examen blanc
//  (Module 7). L'examen blanc combine plusieurs matières et n'est
//  donc pas rattaché à un seul QCM (qcm_id reste NULL) — il compte
//  dans "examens blancs réalisés" mais pas dans le détail par matière.
//  Ne modifie pas le moteur de QCM existant, réutilise juste le
//  modèle Score déjà en place.
// ════════════════════════════════════════════════════════════
exports.soumettreExamenBlanc = async (req, res) => {
// Ancienne méthode : le navigateur envoyait lui-même son score, donc n'importe
// qui pouvait s'attribuer 100 %. Le score est désormais calculé par le serveur
// (POST /api/qcm/examen-blanc/corriger) ; cette route n'accepte plus de score.
return res.status(410).json({
  error: "Cette méthode n'est plus disponible. Actualisez la page pour utiliser la nouvelle correction.",
});
};

// ════════════════════════════════════════════════════════════
//  POST /api/qcm/examen-blanc/corriger — Correction d'un examen blanc
//  Le navigateur envoie uniquement les réponses choisies :
//    { reponses: [ { qcmId, index, reponse }, … ] }
//  Le serveur retrouve les questions, applique les mêmes règles d'accès
//  que la lecture d'un QCM (publié, Premium), corrige, renvoie le détail
//  et enregistre le score si l'utilisateur est connecté.
// ════════════════════════════════════════════════════════════
exports.corrigerExamenBlanc = async (req, res) => {
try {
  const { reponses } = req.body || {};
  if (!Array.isArray(reponses) || reponses.length === 0 || reponses.length > 100) {
    return res.status(400).json({ error: "Réponses manquantes ou trop nombreuses (100 maximum)." });
  }

  // Dédoublonne (qcmId + index) : une question ne compte qu'une fois
  const vues = new Map();
  for (const r of reponses) {
    const qcmId = Number.parseInt(r && r.qcmId, 10);
    const index = Number.parseInt(r && r.index, 10);
    if (!Number.isInteger(qcmId) || !Number.isInteger(index) || qcmId <= 0 || index < 0) {
      return res.status(400).json({ error: "Réponse invalide." });
    }
    const choix = r.reponse === null || r.reponse === undefined ? null : Number.parseInt(r.reponse, 10);
    vues.set(`${qcmId}:${index}`, { qcmId, index, choix: Number.isInteger(choix) ? choix : null });
  }

  const ids = [...new Set([...vues.values()].map((v) => v.qcmId))];
  if (ids.length > 20) return res.status(400).json({ error: "Trop de matières dans une même épreuve." });

  const qcms = new Map();
  for (const id of ids) {
    const qcm = await QCM.findById(id);
    if (!qcm || qcm.statut !== "publié") continue;
    const acces = !qcm.premium || (req.user && (req.user.role === "admin" || req.user.premium));
    if (acces) qcms.set(id, qcm);
  }

  let score = 0;
  const corrections = [];
  for (const v of vues.values()) {
    const qcm = qcms.get(v.qcmId);
    const q = qcm && qcm.questions[v.index];
    if (!q) continue; // question inconnue ou réservée : ignorée, jamais comptée
    const ok = v.choix === q.correct;
    if (ok) score++;
    corrections.push({
      qcmId: v.qcmId,
      index: v.index,
      matiere: qcm.matiere,
      question: q.question,
      options: q.options,
      rep: v.choix,
      correct: q.correct,
      ok,
      explication: q.explication || null,
    });
  }

  const total = corrections.length;
  if (total === 0) return res.status(400).json({ error: "Aucune question valide dans cette épreuve." });
  const pourcentage = Math.round((score / total) * 100);

  // Enregistré dans la progression seulement si l'épreuve est assez longue
  // pour avoir un sens (évite les « examens » d'une seule question).
  let enregistre = null;
  if (req.user && total >= 5) {
    enregistre = await Score.create({
      userId: req.user.id,
      qcmId: null,
      qcmTitre: `Examen blanc — ${new Date().toLocaleDateString("fr-FR")}`,
      score,
      total,
    });
  }

  res.json({ score, total, pourcentage, mention: getMention(pourcentage), corrections, enregistre: !!enregistre });
} catch (err) {
  console.error("Erreur correction examen blanc :", err.message);
  res.status(500).json({ error: "Erreur lors de la correction." });
}
};
