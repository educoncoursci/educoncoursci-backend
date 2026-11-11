// ============================================================
//  controllers/academieController.js
//  Académie EduConcoursCI : cours → leçons (texte, points clés,
//  exercices) → progression de l'utilisateur.
//
//  Accès :
//   - Les premières leçons de chaque cours sont gratuites (champ
//     lecons_gratuites), même sans compte ; la suite est Premium.
//   - Un cours n'est visible du public que s'il est publié.
//   - L'administration (création assistée par IA, relecture,
//     publication) est réservée à l'admin.
// ============================================================

const { query } = require("../config/database");
const User = require("../models/User");
const Journal = require("../models/Journal");
const { genererPlan, genererLecon, NB_LECONS_MIN, NB_LECONS_MAX } = require("../services/academieIAClaude");

const NIVEAUX = ["CEPE", "BEPC", "BAC", "BAC+2", "Licence", "Master"];
const LIMITE_IA_JOUR = parseInt(process.env.ACADEMIE_IA_MAX_PAR_JOUR, 10) || 40;
const CONTENU_MIN_PUBLICATION = 200;

// ── Utilitaires ─────────────────────────────────────────────
function parseJson(valeur, defaut) {
  try {
    const v = JSON.parse(valeur || "");
    return Array.isArray(defaut) ? (Array.isArray(v) ? v : defaut) : v;
  } catch {
    return defaut;
  }
}

const estAdmin = (req) => req.user?.role === "admin";

async function peutLireLecon(req, lecon, cours) {
  if (lecon.ordre <= cours.lecons_gratuites) return true;
  if (!req.user) return false;
  if (estAdmin(req)) return true;
  return User.estPremiumActif(req.user.id);
}

// Exercices servis à l'apprenant : sans les champs de relecture.
function exercicesPublics(json) {
  return parseJson(json, []).map((q) => ({
    question: q.question,
    options: q.options,
    correct: q.correct,
    explication: q.explication,
  }));
}

async function chargerCoursComplet(id) {
  const c = await query(`SELECT * FROM academie_cours WHERE id = $1`, [id]);
  if (!c.rows[0]) return null;
  const l = await query(`SELECT * FROM academie_lecons WHERE cours_id = $1 ORDER BY ordre ASC, id ASC`, [id]);
  return {
    ...c.rows[0],
    lecons: l.rows.map((x) => ({
      id: x.id,
      ordre: x.ordre,
      titre: x.titre,
      objectifs: x.objectifs,
      contenu: x.contenu,
      points_cles: parseJson(x.points_cles, []),
      exercices: parseJson(x.exercices_json, []),
      verifiee: x.verifiee,
    })),
  };
}

// ════════════════════════════════════════════════════════════
//  PUBLIC
// ════════════════════════════════════════════════════════════

// GET /api/academie/cours
exports.listeCours = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.titre, c.description, c.matiere, c.niveau, c.lecons_gratuites,
              (SELECT COUNT(*) FROM academie_lecons l WHERE l.cours_id = c.id)::int AS nb_lecons
       FROM academie_cours c
       WHERE c.statut = 'publié'
       ORDER BY c.created_at DESC`,
    );
    let terminees = {};
    if (req.user) {
      const p = await query(
        `SELECT l.cours_id, COUNT(*)::int AS n
         FROM academie_progression p JOIN academie_lecons l ON l.id = p.lecon_id
         WHERE p.user_id = $1 GROUP BY l.cours_id`,
        [req.user.id],
      );
      terminees = Object.fromEntries(p.rows.map((r) => [r.cours_id, r.n]));
    }
    res.json({
      cours: result.rows.map((c) => ({ ...c, nb_terminees: terminees[c.id] || 0 })),
    });
  } catch (err) {
    console.error("Erreur liste cours :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des cours." });
  }
};

// GET /api/academie/cours/:id
exports.detailCours = async (req, res) => {
  try {
    const cours = await chargerCoursComplet(req.params.id);
    if (!cours || (cours.statut !== "publié" && !estAdmin(req))) {
      return res.status(404).json({ error: "Cours introuvable." });
    }
    let terminees = new Set();
    if (req.user) {
      const p = await query(
        `SELECT p.lecon_id FROM academie_progression p
         JOIN academie_lecons l ON l.id = p.lecon_id
         WHERE p.user_id = $1 AND l.cours_id = $2`,
        [req.user.id, cours.id],
      );
      terminees = new Set(p.rows.map((r) => r.lecon_id));
    }
    res.json({
      cours: {
        id: cours.id,
        titre: cours.titre,
        description: cours.description,
        matiere: cours.matiere,
        niveau: cours.niveau,
        lecons_gratuites: cours.lecons_gratuites,
        lecons: cours.lecons.map((l) => ({
          id: l.id,
          ordre: l.ordre,
          titre: l.titre,
          gratuite: l.ordre <= cours.lecons_gratuites,
          terminee: terminees.has(l.id),
        })),
      },
    });
  } catch (err) {
    console.error("Erreur détail cours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// GET /api/academie/lecons/:id
exports.detailLecon = async (req, res) => {
  try {
    const r = await query(`SELECT * FROM academie_lecons WHERE id = $1`, [req.params.id]);
    const lecon = r.rows[0];
    if (!lecon) return res.status(404).json({ error: "Leçon introuvable." });

    const cours = (await query(`SELECT * FROM academie_cours WHERE id = $1`, [lecon.cours_id])).rows[0];
    if (!cours || (cours.statut !== "publié" && !estAdmin(req))) {
      return res.status(404).json({ error: "Leçon introuvable." });
    }

    const toutes = (await query(
      `SELECT id, ordre, titre FROM academie_lecons WHERE cours_id = $1 ORDER BY ordre ASC, id ASC`,
      [cours.id],
    )).rows;
    const i = toutes.findIndex((l) => l.id === lecon.id);
    const suivante = toutes[i + 1] || null;
    const precedente = toutes[i - 1] || null;

    if (!(await peutLireLecon(req, lecon, cours))) {
      return res.status(403).json({
        error: "Cette leçon est réservée aux abonnés Premium.",
        premium: true,
        connecte: Boolean(req.user),
        lecon: { id: lecon.id, titre: lecon.titre, ordre: lecon.ordre },
        cours: { id: cours.id, titre: cours.titre },
      });
    }

    let terminee = false;
    if (req.user) {
      const p = await query(
        `SELECT 1 FROM academie_progression WHERE user_id = $1 AND lecon_id = $2`,
        [req.user.id, lecon.id],
      );
      terminee = p.rows.length > 0;
    }

    res.json({
      lecon: {
        id: lecon.id,
        ordre: lecon.ordre,
        total: toutes.length,
        titre: lecon.titre,
        contenu: lecon.contenu,
        points_cles: parseJson(lecon.points_cles, []),
        exercices: exercicesPublics(lecon.exercices_json),
      },
      cours: { id: cours.id, titre: cours.titre },
      precedente: precedente && { id: precedente.id, titre: precedente.titre },
      suivante: suivante && {
        id: suivante.id,
        titre: suivante.titre,
        gratuite: suivante.ordre <= cours.lecons_gratuites,
      },
      terminee,
    });
  } catch (err) {
    console.error("Erreur détail leçon :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// POST /api/academie/lecons/:id/terminer  (connecté)
exports.terminerLecon = async (req, res) => {
  try {
    const r = await query(`SELECT * FROM academie_lecons WHERE id = $1`, [req.params.id]);
    const lecon = r.rows[0];
    if (!lecon) return res.status(404).json({ error: "Leçon introuvable." });
    const cours = (await query(`SELECT * FROM academie_cours WHERE id = $1`, [lecon.cours_id])).rows[0];
    if (!cours || (cours.statut !== "publié" && !estAdmin(req))) {
      return res.status(404).json({ error: "Leçon introuvable." });
    }
    if (!(await peutLireLecon(req, lecon, cours))) {
      return res.status(403).json({ error: "Cette leçon est réservée aux abonnés Premium.", premium: true });
    }

    await query(
      `INSERT INTO academie_progression (user_id, lecon_id) VALUES ($1, $2)
       ON CONFLICT (user_id, lecon_id) DO NOTHING`,
      [req.user.id, lecon.id],
    );
    const stats = (await query(
      `SELECT
         (SELECT COUNT(*) FROM academie_lecons WHERE cours_id = $1)::int AS total,
         (SELECT COUNT(*) FROM academie_progression p JOIN academie_lecons l ON l.id = p.lecon_id
           WHERE p.user_id = $2 AND l.cours_id = $1)::int AS terminees`,
      [cours.id, req.user.id],
    )).rows[0];

    res.json({
      message: "Leçon terminée.",
      progression: { terminees: stats.terminees, total: stats.total, cours_termine: stats.terminees >= stats.total },
    });
  } catch (err) {
    console.error("Erreur terminer leçon :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ════════════════════════════════════════════════════════════
//  ADMIN
// ════════════════════════════════════════════════════════════

function validerExercices(exercices) {
  if (!Array.isArray(exercices)) return "Exercices invalides.";
  for (const [i, q] of exercices.entries()) {
    const n = i + 1;
    if (!q || typeof q.question !== "string" || q.question.trim().length < 5) return `Exercice ${n} : énoncé trop court.`;
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) return `Exercice ${n} : 2 à 6 options requises.`;
    if (q.options.some((o) => typeof o !== "string" || o.trim() === "")) return `Exercice ${n} : une option est vide.`;
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) return `Exercice ${n} : deux options identiques.`;
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) return `Exercice ${n} : bonne réponse invalide.`;
    if (typeof q.explication !== "string" || q.explication.trim() === "") return `Exercice ${n} : explication requise.`;
  }
  return null;
}

const nettoyerExercice = (q) => ({
  question: q.question.trim(),
  options: q.options.map((o) => o.trim()),
  correct: q.correct,
  explication: q.explication.trim(),
  a_verifier: q.a_verifier === true,
  note_verification: typeof q.note_verification === "string" ? q.note_verification.slice(0, 300) : "",
});

// GET /api/academie/admin/cours
exports.adminListe = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.titre, c.matiere, c.niveau, c.statut, c.created_at,
              COUNT(l.id)::int AS nb_lecons,
              COUNT(l.id) FILTER (WHERE LENGTH(l.contenu) >= ${CONTENU_MIN_PUBLICATION})::int AS nb_redigees,
              COUNT(l.id) FILTER (WHERE l.verifiee)::int AS nb_verifiees
       FROM academie_cours c LEFT JOIN academie_lecons l ON l.cours_id = c.id
       GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`,
    );
    res.json({ cours: result.rows });
  } catch (err) {
    console.error("Erreur liste admin cours :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des cours." });
  }
};

// GET /api/academie/admin/cours/:id
exports.adminDetail = async (req, res) => {
  try {
    const cours = await chargerCoursComplet(req.params.id);
    if (!cours) return res.status(404).json({ error: "Cours introuvable." });
    res.json({ cours });
  } catch (err) {
    console.error("Erreur détail admin cours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// Garde-fou de coût pour les appels IA
async function verifierQuotaIA(userId) {
  const jour = await query(
    `SELECT COUNT(*) FROM ia_generations
     WHERE user_id = $1 AND type = 'academie-ia' AND created_at >= CURRENT_DATE`,
    [userId],
  );
  if (parseInt(jour.rows[0].count, 10) >= LIMITE_IA_JOUR) {
    const e = new Error(`Limite de ${LIMITE_IA_JOUR} générations par jour atteinte (ACADEMIE_IA_MAX_PAR_JOUR).`);
    e.status = 429;
    throw e;
  }
  // Compté avant l'appel : l'API facture même si la réponse est inutilisable.
  await query(`INSERT INTO ia_generations (user_id, type) VALUES ($1, 'academie-ia')`, [userId]);
}

// POST /api/academie/admin/plan — crée un cours en brouillon à partir d'un plan IA
exports.adminPlan = async (req, res) => {
  try {
    const matiere = String(req.body.matiere || "").trim();
    const theme = String(req.body.theme || "").trim();
    const concours = String(req.body.concours || "").trim();
    const niveau = NIVEAUX.includes(req.body.niveau) ? req.body.niveau : "BAC";
    const nbLecons = Math.min(Math.max(parseInt(req.body.nbLecons, 10) || 6, NB_LECONS_MIN), NB_LECONS_MAX);

    if (matiere.length < 2 || matiere.length > 100) {
      return res.status(400).json({ error: "La matière est requise (2 à 100 caractères)." });
    }
    if (theme.length > 150 || concours.length > 150) {
      return res.status(400).json({ error: "Thème ou concours trop long (150 caractères max)." });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "Clé ANTHROPIC_API_KEY absente sur le serveur." });
    }

    await verifierQuotaIA(req.user.id);
    const plan = await genererPlan({ matiere, theme, niveau, nbLecons, concours });

    const c = await query(
      `INSERT INTO academie_cours (titre, description, matiere, niveau, statut, lecons_gratuites)
       VALUES ($1, $2, $3, $4, 'brouillon', 2) RETURNING id`,
      [plan.titre, plan.description, matiere, niveau],
    );
    const coursId = c.rows[0].id;
    for (const [i, l] of plan.lecons.entries()) {
      await query(
        `INSERT INTO academie_lecons (cours_id, ordre, titre, objectifs) VALUES ($1, $2, $3, $4)`,
        [coursId, i + 1, l.titre, l.objectifs],
      );
    }
    Journal.enregistrer(req.user.id, req.user.nom, "génération IA", "cours", coursId,
      `${plan.titre} — plan de ${plan.lecons.length} leçon(s)`);

    res.status(201).json({
      message: `Plan créé : ${plan.lecons.length} leçons à rédiger.`,
      cours: await chargerCoursComplet(coursId),
    });
  } catch (err) {
    console.error("Erreur plan cours IA :", err.message);
    res.status(err.status || 500).json({ error: err.message || "Erreur lors de la génération." });
  }
};

// POST /api/academie/admin/lecons/:id/generer — rédige le contenu d'une leçon
exports.adminGenererLecon = async (req, res) => {
  try {
    const r = await query(`SELECT * FROM academie_lecons WHERE id = $1`, [req.params.id]);
    const lecon = r.rows[0];
    if (!lecon) return res.status(404).json({ error: "Leçon introuvable." });
    const cours = (await query(`SELECT * FROM academie_cours WHERE id = $1`, [lecon.cours_id])).rows[0];
    const autres = (await query(
      `SELECT titre FROM academie_lecons WHERE cours_id = $1 AND id <> $2 ORDER BY ordre`,
      [cours.id, lecon.id],
    )).rows.map((x) => x.titre);
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "Clé ANTHROPIC_API_KEY absente sur le serveur." });
    }

    await verifierQuotaIA(req.user.id);
    const resultat = await genererLecon({
      cours: { titre: cours.titre, matiere: cours.matiere, niveau: cours.niveau },
      lecon: { titre: lecon.titre, objectifs: lecon.objectifs, ordre: lecon.ordre, total: autres.length + 1 },
      autresTitres: autres,
    });

    const maj = await query(
      `UPDATE academie_lecons
       SET contenu = $1, points_cles = $2, exercices_json = $3, verifiee = FALSE
       WHERE id = $4 RETURNING *`,
      [resultat.contenu, JSON.stringify(resultat.points_cles), JSON.stringify(resultat.exercices), lecon.id],
    );
    Journal.enregistrer(req.user.id, req.user.nom, "génération IA", "leçon", lecon.id,
      `${cours.titre} / ${lecon.titre}`);

    const x = maj.rows[0];
    res.json({
      message: resultat.exercices.length
        ? "Leçon rédigée. Relis-la avant de la valider."
        : "Leçon rédigée, mais aucun exercice valide n'a été produit : ajoutes-en ou régénère.",
      exercicesRejetes: resultat.exercicesRejetes,
      lecon: {
        id: x.id, ordre: x.ordre, titre: x.titre, objectifs: x.objectifs, contenu: x.contenu,
        points_cles: parseJson(x.points_cles, []), exercices: parseJson(x.exercices_json, []), verifiee: x.verifiee,
      },
    });
  } catch (err) {
    console.error("Erreur génération leçon IA :", err.message);
    res.status(err.status || 500).json({ error: err.message || "Erreur lors de la génération." });
  }
};

// PUT /api/academie/admin/cours/:id — enregistre cours + leçons
exports.adminSauvegarder = async (req, res) => {
  try {
    const coursId = parseInt(req.params.id, 10);
    const existant = await query(`SELECT id FROM academie_cours WHERE id = $1`, [coursId]);
    if (!existant.rows[0]) return res.status(404).json({ error: "Cours introuvable." });

    const { titre, description, matiere, niveau, lecons_gratuites, lecons } = req.body;
    if (!titre || !String(titre).trim() || !matiere || !String(matiere).trim()) {
      return res.status(400).json({ error: "Titre et matière sont requis." });
    }
    if (!NIVEAUX.includes(niveau)) return res.status(400).json({ error: "Niveau invalide." });
    const gratuites = parseInt(lecons_gratuites, 10);
    if (!Number.isInteger(gratuites) || gratuites < 0 || gratuites > 20) {
      return res.status(400).json({ error: "Nombre de leçons gratuites invalide (0 à 20)." });
    }
    if (!Array.isArray(lecons) || lecons.length < 1 || lecons.length > 20) {
      return res.status(400).json({ error: "Un cours doit contenir entre 1 et 20 leçons." });
    }
    for (const [i, l] of lecons.entries()) {
      if (!l || typeof l.titre !== "string" || l.titre.trim().length < 3) {
        return res.status(400).json({ error: `Leçon ${i + 1} : titre trop court.` });
      }
      if (typeof l.contenu !== "string" || l.contenu.length > 20000) {
        return res.status(400).json({ error: `Leçon ${i + 1} : contenu invalide (20 000 caractères max).` });
      }
      const erreur = validerExercices(l.exercices || []);
      if (erreur) return res.status(400).json({ error: `Leçon ${i + 1} — ${erreur}` });
    }

    // Les ids reçus doivent appartenir à ce cours
    const idsExistants = new Set(
      (await query(`SELECT id FROM academie_lecons WHERE cours_id = $1`, [coursId])).rows.map((r) => r.id),
    );
    for (const l of lecons) {
      if (l.id !== undefined && l.id !== null && !idsExistants.has(l.id)) {
        return res.status(400).json({ error: "Une leçon n'appartient pas à ce cours." });
      }
    }

    await query(
      `UPDATE academie_cours SET titre = $1, description = $2, matiere = $3, niveau = $4,
         lecons_gratuites = $5, updated_at = NOW() WHERE id = $6`,
      [String(titre).trim().slice(0, 200), String(description || "").trim().slice(0, 1000),
       String(matiere).trim().slice(0, 100), niveau, gratuites, coursId],
    );

    const gardes = new Set(lecons.filter((l) => l.id).map((l) => l.id));
    for (const id of idsExistants) {
      if (!gardes.has(id)) await query(`DELETE FROM academie_lecons WHERE id = $1`, [id]);
    }
    for (const [i, l] of lecons.entries()) {
      const points = JSON.stringify((Array.isArray(l.points_cles) ? l.points_cles : [])
        .map((p) => String(p).trim().slice(0, 300)).filter(Boolean).slice(0, 8));
      const exos = JSON.stringify((l.exercices || []).map(nettoyerExercice));
      const valeurs = [
        i + 1, l.titre.trim().slice(0, 200), String(l.objectifs || "").trim().slice(0, 600),
        l.contenu, points, exos, l.verifiee === true,
      ];
      if (l.id) {
        await query(
          `UPDATE academie_lecons SET ordre=$1, titre=$2, objectifs=$3, contenu=$4, points_cles=$5,
             exercices_json=$6, verifiee=$7 WHERE id=$8 AND cours_id=$9`,
          [...valeurs, l.id, coursId],
        );
      } else {
        await query(
          `INSERT INTO academie_lecons (ordre, titre, objectifs, contenu, points_cles, exercices_json, verifiee, cours_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [...valeurs, coursId],
        );
      }
    }
    res.json({ message: "Cours enregistré.", cours: await chargerCoursComplet(coursId) });
  } catch (err) {
    console.error("Erreur sauvegarde cours :", err.message);
    res.status(500).json({ error: "Erreur lors de l'enregistrement." });
  }
};

// POST /api/academie/admin/cours/:id/publier
exports.adminPublier = async (req, res) => {
  try {
    const cours = await chargerCoursComplet(req.params.id);
    if (!cours) return res.status(404).json({ error: "Cours introuvable." });
    if (cours.statut === "publié") return res.status(409).json({ error: "Ce cours est déjà publié." });
    if (!cours.lecons.length) return res.status(400).json({ error: "Le cours n'a aucune leçon." });

    const vides = cours.lecons.filter((l) => (l.contenu || "").length < CONTENU_MIN_PUBLICATION).length;
    if (vides > 0) {
      return res.status(400).json({ error: `${vides} leçon(s) n'ont pas encore de contenu rédigé.` });
    }
    const nonVerifiees = cours.lecons.filter((l) => !l.verifiee).length;
    if (nonVerifiees > 0) {
      return res.status(400).json({
        error: `${nonVerifiees} leçon(s) pas encore marquée(s) « vérifiée ». Relis-les puis enregistre avant de publier.`,
      });
    }
    await query(`UPDATE academie_cours SET statut = 'publié', updated_at = NOW() WHERE id = $1`, [cours.id]);
    Journal.enregistrer(req.user.id, req.user.nom, "publication", "cours", cours.id,
      `${cours.titre} — ${cours.lecons.length} leçon(s)`);
    res.json({ message: "Cours publié." });
  } catch (err) {
    console.error("Erreur publication cours :", err.message);
    res.status(500).json({ error: "Erreur lors de la publication." });
  }
};

// POST /api/academie/admin/cours/:id/depublier
exports.adminDepublier = async (req, res) => {
  try {
    const r = await query(
      `UPDATE academie_cours SET statut = 'brouillon', updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id],
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Cours introuvable." });
    res.json({ message: "Cours repassé en brouillon." });
  } catch (err) {
    console.error("Erreur dépublication cours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// DELETE /api/academie/admin/cours/:id
exports.adminSupprimer = async (req, res) => {
  try {
    const r = await query(`DELETE FROM academie_cours WHERE id = $1 RETURNING titre`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "Cours introuvable." });
    Journal.enregistrer(req.user.id, req.user.nom, "suppression", "cours", req.params.id, r.rows[0].titre);
    res.json({ message: "Cours supprimé." });
  } catch (err) {
    console.error("Erreur suppression cours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
