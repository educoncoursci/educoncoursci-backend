// ============================================================
//  routes/notifs.js
//  Préfixe : /api/notifs
//  Alias des routes de notification (montées aussi dans admin)
//  Permet d'appeler /api/notifs/… depuis le frontend public
// ============================================================

const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const admin   = require("../middleware/admin");
const notifs  = require("../controllers/notifController");

// Toutes les routes notifs nécessitent d'être admin
router.use(auth, admin);

router.post("/send",            notifs.envoyer);        // POST /api/notifs/send
router.post("/alerte-concours", notifs.alerteConcours); // POST /api/notifs/alerte-concours
router.post("/rappels",         notifs.envoyerRappels); // POST /api/notifs/rappels
router.get( "/whatsapp-file",         notifs.fileWhatsapp);         // GET   /api/notifs/whatsapp-file
router.patch("/whatsapp-file/:id",    notifs.marquerWhatsappEnvoye); // PATCH /api/notifs/whatsapp-file/:id
router.get( "/sms-file",              notifs.fileSms);              // GET   /api/notifs/sms-file
router.patch("/sms-file/:id",         notifs.marquerSmsEnvoye);     // PATCH /api/notifs/sms-file/:id
router.get( "/history",         notifs.historique);     // GET  /api/notifs/history

module.exports = router;