// ============================================================
//  routes/assistanceSociale.js
//  Préfixe : /api/assistance-sociale
//  Annuaire, urgences, documents sociaux, assistant IA.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/assistanceSocialeController");
const auth    = require("../middleware/auth");
const authOptionnel = require("../middleware/authOptionnel");
const rateLimit = require("express-rate-limit");

// L'assistant appelle l'IA (service payant). Il reste volontairement accessible
// sans compte (une personne en détresse ne doit pas être bloquée par une
// connexion), mais fortement plafonné pour éviter les abus et maîtriser le coût :
//  - visiteur sans compte : 10 messages / heure (par adresse IP) ;
//  - inscrit : 40 messages / heure (par compte) ;
//  - taille des messages et de l'historique bornée.
const msgLimite = { error: "Limite de messages atteinte pour cette heure. Réessaie plus tard. En cas d'urgence, appelle les numéros d'urgence." };
const limiteAssistantInvite = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, skip: (req) => !!req.user, message: msgLimite });
const limiteAssistantMembre = rateLimit({
  windowMs: 60 * 60 * 1000, max: 40, skip: (req) => !req.user,
  keyGenerator: (req) => `assistant-${req.user.id}`, message: msgLimite,
});
function borner(req, res, next) {
  const b = req.body || {};
  if (typeof b.message !== "string") return res.status(400).json({ error: "Le message est requis." });
  b.message = b.message.slice(0, 2000);
  b.historique = (Array.isArray(b.historique) ? b.historique : []).slice(-10).map((h) => ({
    ...h,
    content: typeof h?.content === "string" ? h.content.slice(0, 2000) : "",
    contenu: typeof h?.contenu === "string" ? h.contenu.slice(0, 2000) : h?.contenu,
    text: typeof h?.text === "string" ? h.text.slice(0, 2000) : h?.text,
  }));
  req.body = b;
  next();
}

// ── Public ────────────────────────────────────────────────────
router.get("/urgences",   ctrl.urgences);
router.get("/structures", ctrl.structures);
router.get("/documents/types", ctrl.listerTypes);

// ── Connecté requis ───────────────────────────────────────────
router.post("/documents/generate", auth, ctrl.genererDocument);
router.post("/documents/pdf",      auth, ctrl.exportPDF);
router.post("/documents/docx",     auth, ctrl.exportDOCX);

// ── Assistant IA (auth optionnelle — accessible même sans compte,
//    car une personne en détresse ne doit jamais être bloquée par
//    une exigence de connexion) ──────────────────────────────────
router.post("/assistant", authOptionnel, borner, limiteAssistantInvite, limiteAssistantMembre, ctrl.assistant);

module.exports = router;
