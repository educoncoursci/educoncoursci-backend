// ============================================================
//  routes/assistantConcours.js
//  Préfixe : /api/assistant-concours
//  Assistant d'information sur les concours (connecté requis).
//  Service GRATUIT : aucune différence Premium/gratuit. Une limite
//  quotidienne identique pour tous protège seulement contre l'abus
//  (compteur propre, indépendant des services CV/lettres).
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/assistantConcoursController");
const auth    = require("../middleware/auth");
const { query } = require("../config/database");

const LIMITE_JOUR = parseInt(process.env.ASSISTANT_CONCOURS_MAX_PAR_JOUR, 10) || 30;

async function limiteAbus(req, res, next) {
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS n FROM ia_generations WHERE user_id = $1 AND type = 'assistant-concours' AND created_at >= CURRENT_DATE`,
      [req.user.id],
    );
    if (r.rows[0].n >= LIMITE_JOUR) {
      return res.status(429).json({ error: `Limite de ${LIMITE_JOUR} questions par jour atteinte. Revenez demain.` });
    }
    await query(`INSERT INTO ia_generations (user_id, type) VALUES ($1, 'assistant-concours')`, [req.user.id]);
    next();
  } catch (err) {
    console.error("Erreur limite assistant concours :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
}

router.post("/", auth, limiteAbus, ctrl.demander);

module.exports = router;
