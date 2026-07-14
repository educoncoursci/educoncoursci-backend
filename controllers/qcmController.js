// ============================================================
//  controllers/qcmController.js
//  Gère : liste, détail, soumission score, CRUD QCM
// ============================================================

const QCM   = require(”../models/QCM”);
const Score = require(”../models/Score”);

// ════════════════════════════════════════════════════════════
//  GET /api/qcm — Liste des QCM disponibles
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
try {
const { matiere, difficulte, premium, limit, offset } = req.query;

```
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
  verrouille: q.premium && (!req.user || !req.user.premium),
}));

res.json({ total: liste.length, qcm: liste });
```

} catch (err) {
console.error(“Erreur liste QCM :”, err.message);
res.status(500).json({ error: “Erreur lors de la récupération des QCM.” });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/qcm/:id — QCM complet avec questions
// ════════════════════════════════════════════════════════════
exports.detail = async (req, res) => {
try {
const qcm = await QCM.findById(req.params.id);
if (!qcm) {
return res.status(404).json({ error: “QCM introuvable.” });
}

```
// Vérifie les droits Premium
if (qcm.premium && (!req.user || !req.user.premium)) {
  return res.status(403).json({
    error:   "Contenu réservé aux abonnés Premium.",
    premium: true,
  });
}

// On n'envoie PAS les bonnes réponses au frontend avant soumission
// pour éviter la triche (inspection réseau)
const questionsSansReponses = qcm.questions.map(q => ({
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
```

} catch (err) {
console.error(“Erreur détail QCM :”, err.message);
res.status(500).json({ error: “Erreur serveur.” });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/qcm/:id/score — Soumettre les réponses + correction
// ════════════════════════════════════════════════════════════
exports.soumettre = async (req, res) => {
try {
const { reponses } = req.body;
// reponses = { “0”: 2, “1”: 0, “2”: 3, … } (index question: index réponse choisie)

```
if (!reponses || typeof reponses !== "object") {
  return res.status(400).json({ error: "Réponses manquantes ou format invalide." });
}

const qcm = await QCM.findById(req.params.id);
if (!qcm) {
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
```

} catch (err) {
console.error(“Erreur soumission QCM :”, err.message);
res.status(500).json({ error: “Erreur lors de la correction.” });
}
};

// Retourne la mention selon le pourcentage
function getMention(pourcentage) {
if (pourcentage >= 90) return “Excellent 🏆”;
if (pourcentage >= 75) return “Très bien 🥇”;
if (pourcentage >= 60) return “Bien 👍”;
if (pourcentage >= 50) return “Passable ✅”;
return “À revoir 📚”;
}

// ════════════════════════════════════════════════════════════
//  POST /api/qcm — Créer un QCM (admin)
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
try {
const { titre, matiere, difficulte, statut, questions, premium } = req.body;

```
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
```

} catch (err) {
console.error(“Erreur créer QCM :”, err.message);
res.status(500).json({ error: “Erreur lors de la création du QCM.” });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/qcm/:id — Modifier (admin)
// ════════════════════════════════════════════════════════════
exports.modifier = async (req, res) => {
try {
const qcm = await QCM.findById(req.params.id);
if (!qcm) return res.status(404).json({ error: “QCM introuvable.” });

```
const modifie = await QCM.update(req.params.id, req.body);
res.json({ message: "QCM modifié avec succès.", qcm: modifie });
```

} catch (err) {
console.error(“Erreur modifier QCM :”, err.message);
res.status(500).json({ error: “Erreur lors de la modification.” });
}
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/qcm/:id — Supprimer (admin)
// ════════════════════════════════════════════════════════════
exports.supprimer = async (req, res) => {
try {
const qcm = await QCM.findById(req.params.id);
if (!qcm) return res.status(404).json({ error: “QCM introuvable.” });

```
await QCM.delete(req.params.id);
res.json({ message: "QCM supprimé avec succès." });
```

} catch (err) {
console.error(“Erreur supprimer QCM :”, err.message);
res.status(500).json({ error: “Erreur lors de la suppression.” });
}
};