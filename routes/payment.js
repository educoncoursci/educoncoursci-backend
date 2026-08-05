// ============================================================
//  routes/payment.js
//  Préfixe : /api/payment
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/paymentController");
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");

// Publique : récupérer les plans et instructions
router.get("/plans", ctrl.getPlans); // GET /api/payment/plans

// Connecté requis : vérifier un paiement et activer le Premium
router.post("/verify", auth, ctrl.verify); // POST /api/payment/verify

// Historique personnel de l'utilisateur connecté
router.get("/history", auth, ctrl.history); // GET /api/payment/history

// Admin : voir toutes les transactions
router.get("/all", auth, admin, ctrl.allTransactions); // GET /api/payment/all

// Admin : valider une transaction en attente (active le Premium du client)
router.post("/valider/:id", auth, admin, ctrl.validerTransaction); // POST /api/payment/valider/:id

// Admin : rejeter une transaction en attente
router.post("/rejeter/:id", auth, admin, ctrl.rejeterTransaction); // POST /api/payment/rejeter/:id

// Admin : résilier un abonnement
router.post("/resiliation", auth, admin, ctrl.resilier); // POST /api/payment/resiliation

// ── CinetPay (Lot 17) ─────────────────────────────────────────
router.post("/cinetpay/initier", auth, ctrl.initierCinetPay);  // POST /api/payment/cinetpay/initier
router.post("/cinetpay/webhook", ctrl.webhookCinetPay);        // POST /api/payment/cinetpay/webhook (public — appelé par CinetPay)

module.exports = router;