// ============================================================
//  routes/push.js
//  Préfixe : /api/push
//  Lot 11 — Abonnements aux notifications Push Web.
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/pushController");
const auth    = require("../middleware/auth");

router.get("/vapid-key",   ctrl.vapidKey);          // GET  /api/push/vapid-key (public)
router.post("/subscribe",  auth, ctrl.subscribe);   // POST /api/push/subscribe
router.post("/unsubscribe", auth, ctrl.unsubscribe); // POST /api/push/unsubscribe

module.exports = router;
