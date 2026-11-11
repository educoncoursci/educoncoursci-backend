// ============================================================
//  controllers/qcmIAController.js
//  Générateur de QCM par IA — réservé à l'administrateur.
//
//  Flux : générer → brouillon → relecture humaine (question par
//  question) → publication. Rien n'est publié sans que CHAQUE
//  question ait été marquée "vérifiée" (contrôle côté serveur).
//
//  Réutilise la table `qcm` existante (statut 'brouillon' / 'publié'),
//  donc aucune migration de base de données.
// ============================================================

const { query } = require("../config/database");
const Journal = require("../models/Journal");
const { genererQuestions } = require("../services/qcmIAClaude");

const NIVEAUX = ["CEPE", "BEPC", "BAC", "BAC+2", "Licence", "Master"];
const DIFFICULTES = ["Facile", "Moyen", "Difficile"];
const MAX_QUESTIONS_PAR_LOT = 10;
const LIMITE_JOUR = parseInt(process.env.QCM_IA_MAX_PAR_JOUR, 10) || 30;

function parseQuestions(json) {
  try {
    const q = JSON.parse(json || "[]");
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function formater(row) {
  return { ...row, questions: parseQuestions(row.questions_json), questions_json: undefined };
}

// Valide les questions envoyées par l'éditeur (relecture manuelle).
function validerQuestionsEditees(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return "Au moins une question est requise.";
  }
  for (const [i, q] of questions.entries()) {
    const n = i + 1;
    if (!q || typeof q.question !== "string" || q.question.trim().length < 5) {
      return `Question ${n} : énoncé trop court.`;
    }
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
      return `Question ${n} : entre 2 et 6 options requises.`;
    }
    if (q.options.some((o) => typeof o !== "string" || o.trim() === "")) {
      return `Question ${n} : une option est vide.`;
    }
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) {
      return `Question ${n} : deux options sont identiques.`;
    }
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) {
      return `Question ${n} : index de bonne réponse invalide.`;
    }
    if (typeof q.explication !== "string" || q.explication.trim() === "") {
      return `Question ${n} : l'explication est requise.`;
    }
  }
  return null;
}

function nettoyerQuestionPourStockage(q) {
  return {
    question: q.question.trim(),
    options: q.options.map((o) => o.trim()),
    correct: q.correct,
    explication: q.explication.trim(),
    source: q.source === "ia" ? "ia" : "manuel",
    verifiee: q.verifiee === true,
    a_verifier: q.a_verifier === true,
    note_verification: typeof q.note_verification === "string" ? q.note_verification.slice(0, 300) : "",
  };
}

// ── POST /api/qcm-ia/generer ────────────────────────────────
exports.generer = async (req, res) => {
  try {
    const matiere = String(req.body.matiere || "").trim();
    const theme = String(req.body.theme || "").trim();
    const concours = String(req.body.concours || "").trim();
    const niveau = NIVEAUX.includes(req.body.niveau) ? req.body.niveau : "BAC";
    const difficulte = DIFFICULTES.includes(req.body.difficulte) ? req.body.difficulte : "Moyen";
    const nombre = Math.min(
      Math.max(parseInt(req.body.nombre, 10) || MAX_QUESTIONS_PAR_LOT, 1),
      MAX_QUESTIONS_PAR_LOT,
    );

    if (matiere.length < 2 || matiere.length > 100) {
      return res.status(400).json({ error: "La matière est requise (2 à 100 caractères)." });
    }
    if (theme.length > 150 || concours.length > 150) {
      return res.status(400).json({ error: "Thème ou concours trop long (150 caractères max)." });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "Clé ANTHROPIC_API_KEY absente sur le serveur." });
    }

    // Garde-fou de coût : nombre de générations par jour
    const jour = await query(
      `SELECT COUNT(*) FROM ia_generations
       WHERE user_id = $1 AND type = 'qcm-ia' AND created_at >= CURRENT_DATE`,
      [req.user.id],
    );
    if (parseInt(jour.rows[0].count, 10) >= LIMITE_JOUR) {
      return res.status(429).json({
        error: `Limite de ${LIMITE_JOUR} générations par jour atteinte (modifiable via QCM_IA_MAX_PAR_JOUR).`,
      });
    }
    // Compté avant l'appel : l'API facture même si la réponse est inutilisable.
    await query(`INSERT INTO ia_generations (user_id, type) VALUES ($1, 'qcm-ia')`, [req.user.id]);

    const resultat = await genererQuestions({ matiere, theme, concours, niveau, difficulte, nombre });

    if (resultat.questions.length === 0) {
      return res.status(502).json({
        error: "L'IA n'a produit aucune question valide. Réessaie ou précise le thème.",
      });
    }

    const titre = `${matiere}${theme ? " — " + theme : ""} (IA ${new Date().toLocaleDateString("fr-FR")})`.slice(0, 200);
    const insertion = await query(
      `INSERT INTO qcm (titre, matiere, difficulte, statut, questions_json, premium)
       VALUES ($1, $2, $3, 'brouillon', $4, FALSE)
       RETURNING *`,
      [titre, matiere, difficulte, JSON.stringify(resultat.questions)],
    );
    const qcm = formater(insertion.rows[0]);

    Journal.enregistrer(
      req.user.id, req.user.nom, "génération IA", "qcm", qcm.id,
      `${matiere}${theme ? " / " + theme : ""} — ${resultat.questions.length} question(s) en brouillon`,
    );

    res.status(201).json({
      message: `${resultat.questions.length} question(s) générée(s) en brouillon.`,
      rejetees: resultat.rejetees,
      qcm,
    });
  } catch (err) {
    console.error("Erreur génération QCM IA :", err.message);
    res.status(500).json({ error: err.message || "Erreur lors de la génération." });
  }
};

// ── GET /api/qcm-ia/brouillons ──────────────────────────────
exports.brouillons = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, titre, matiere, difficulte, premium, questions_json, created_at
       FROM qcm WHERE statut = 'brouillon' ORDER BY created_at DESC LIMIT 200`,
    );
    const brouillons = result.rows.map((r) => {
      const questions = parseQuestions(r.questions_json);
      return {
        id: r.id,
        titre: r.titre,
        matiere: r.matiere,
        difficulte: r.difficulte,
        premium: r.premium,
        created_at: r.created_at,
        nb_questions: questions.length,
        nb_verifiees: questions.filter((q) => q.verifiee === true).length,
      };
    });
    res.json({ total: brouillons.length, brouillons });
  } catch (err) {
    console.error("Erreur liste brouillons :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des brouillons." });
  }
};

// ── GET /api/qcm-ia/:id — QCM complet avec réponses (admin) ─
exports.detail = async (req, res) => {
  try {
    const result = await query(`SELECT * FROM qcm WHERE id = $1`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "QCM introuvable." });
    res.json({ qcm: formater(result.rows[0]) });
  } catch (err) {
    console.error("Erreur détail brouillon :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ── PUT /api/qcm-ia/:id — Enregistrer la relecture ──────────
exports.sauvegarder = async (req, res) => {
  try {
    const existant = await query(`SELECT id, statut FROM qcm WHERE id = $1`, [req.params.id]);
    if (!existant.rows[0]) return res.status(404).json({ error: "QCM introuvable." });
    if (existant.rows[0].statut !== "brouillon") {
      return res.status(409).json({ error: "Ce QCM est déjà publié : modifie-le depuis la page QCM." });
    }

    const { titre, matiere, difficulte, premium, questions } = req.body;
    const erreur = validerQuestionsEditees(questions);
    if (erreur) return res.status(400).json({ error: erreur });
    if (!titre || !String(titre).trim() || !matiere || !String(matiere).trim()) {
      return res.status(400).json({ error: "Titre et matière sont requis." });
    }
    if (!DIFFICULTES.includes(difficulte)) {
      return res.status(400).json({ error: "Difficulté invalide." });
    }

    const result = await query(
      `UPDATE qcm SET titre = $1, matiere = $2, difficulte = $3, premium = $4, questions_json = $5
       WHERE id = $6 RETURNING *`,
      [
        String(titre).trim().slice(0, 200),
        String(matiere).trim().slice(0, 100),
        difficulte,
        premium === true,
        JSON.stringify(questions.map(nettoyerQuestionPourStockage)),
        req.params.id,
      ],
    );
    res.json({ message: "Brouillon enregistré.", qcm: formater(result.rows[0]) });
  } catch (err) {
    console.error("Erreur sauvegarde brouillon :", err.message);
    res.status(500).json({ error: "Erreur lors de l'enregistrement." });
  }
};

// ── POST /api/qcm-ia/:id/publier ────────────────────────────
//  Refuse si une seule question n'est pas marquée "vérifiée".
//  Retire les champs de relecture avant de rendre le QCM public.
exports.publier = async (req, res) => {
  try {
    const result = await query(`SELECT * FROM qcm WHERE id = $1`, [req.params.id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "QCM introuvable." });
    if (row.statut === "publié") return res.status(409).json({ error: "Ce QCM est déjà publié." });

    const questions = parseQuestions(row.questions_json);
    const erreur = validerQuestionsEditees(questions);
    if (erreur) return res.status(400).json({ error: erreur });

    const nonVerifiees = questions.filter((q) => q.verifiee !== true).length;
    if (nonVerifiees > 0) {
      return res.status(400).json({
        error: `${nonVerifiees} question(s) pas encore marquée(s) « vérifiée ». Relis-les puis enregistre avant de publier.`,
      });
    }

    const propres = questions.map((q) => ({
      question: q.question,
      options: q.options,
      correct: q.correct,
      explication: q.explication,
    }));

    const maj = await query(
      `UPDATE qcm SET statut = 'publié', questions_json = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(propres), req.params.id],
    );

    Journal.enregistrer(
      req.user.id, req.user.nom, "publication", "qcm", row.id,
      `${row.titre} — ${propres.length} question(s)`,
    );
    res.json({ message: "QCM publié.", qcm: formater(maj.rows[0]) });
  } catch (err) {
    console.error("Erreur publication QCM :", err.message);
    res.status(500).json({ error: "Erreur lors de la publication." });
  }
};
