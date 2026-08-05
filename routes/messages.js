// ============================================================
//  routes/messages.js
//  Préfixe : /api/messages
//  Lot 15 — Messagerie privée entre candidats (connecté requis).
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/messageController");
const auth    = require("../middleware/auth");

router.get("/conversations",              auth, ctrl.listerConversations);   // GET  /api/messages/conversations
router.post("/conversations",             auth, ctrl.demarrerConversation);  // POST /api/messages/conversations
router.get("/conversations/:id",          auth, ctrl.detailConversation);    // GET  /api/messages/conversations/:id
router.post("/conversations/:id/messages", auth, ctrl.envoyerMessage);       // POST /api/messages/conversations/:id/messages
router.get("/non-lus",                    auth, ctrl.compterNonLus);         // GET  /api/messages/non-lus

module.exports = router;
