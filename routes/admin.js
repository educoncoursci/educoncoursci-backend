// ============================================================
//  routes/admin.js
//  Toutes les routes admin + notifications
//  Préfixe : /api/admin  et  /api/notifs
// ============================================================

const express = require("express");
const router  = express.Router();
const admin   = require("../controllers/adminController");
const notifs  = require("../controllers/notifController");
const market  = require("../controllers/adminMarketplaceController");
const { recalculerStatuts } = require("../services/concoursStatutScheduler");
const sourcesConcours = require("../controllers/concoursSourcesController");
const auth    = require("../middleware/auth");
const isAdmin = require("../middleware/admin");

// Toutes les routes de ce fichier nécessitent
// d'être connecté ET d'être admin
router.use(auth, isAdmin);

// ── Statistiques ─────────────────────────────────────────────
router.get("/stats",    admin.stats);      // GET /api/admin/stats
router.get("/journal",  admin.journal);    // GET /api/admin/journal

// ── Utilisateurs ─────────────────────────────────────────────
router.get("/users",         admin.getUsers);    // GET /api/admin/users
router.get("/abonnes",       admin.getAbonnes);  // GET /api/admin/abonnes
router.patch("/users/:id",   admin.updateUser);  // PATCH /api/admin/users/:id
router.delete("/users/:id",  admin.deleteUser);  // DELETE /api/admin/users/:id

// ── Scores & classements ──────────────────────────────────────
router.get("/scores", admin.getScores); // GET /api/admin/scores

// ── Export CSV ───────────────────────────────────────────────
router.get("/export/users", admin.exportUsers); // GET /api/admin/export/users

// ── Notifications ─────────────────────────────────────────────
router.post("/notifs/send",            notifs.envoyer);         // POST /api/admin/notifs/send
router.post("/notifs/alerte-concours", notifs.alerteConcours);  // POST /api/admin/notifs/alerte-concours
router.post("/notifs/rappels",         notifs.envoyerRappels);  // POST /api/admin/notifs/rappels
router.get( "/notifs/whatsapp-file",        notifs.fileWhatsapp);         // GET   /api/admin/notifs/whatsapp-file
router.patch("/notifs/whatsapp-file/:id",   notifs.marquerWhatsappEnvoye); // PATCH /api/admin/notifs/whatsapp-file/:id
router.get( "/notifs/sms-file",             notifs.fileSms);              // GET   /api/admin/notifs/sms-file
router.patch("/notifs/sms-file/:id",        notifs.marquerSmsEnvoye);     // PATCH /api/admin/notifs/sms-file/:id
router.get( "/notifs/history",         notifs.historique);      // GET  /api/admin/notifs/history

// ── Automatisation statut concours (Lot 18) ──────────────────
router.post("/concours/recalculer-statuts", async (req, res) => {
  try {
    const total = await recalculerStatuts();
    res.json({ message: `${total} concours mis à jour.`, total });
  } catch (err) {
    console.error("Erreur recalcul statuts (admin) :", err.message);
    res.status(500).json({ error: "Erreur lors du recalcul." });
  }
}); // POST /api/admin/concours/recalculer-statuts

// ── Sources et suggestions de concours (Lot 18) ──────────────
router.get(   "/concours-sources",           sourcesConcours.listerSources);
router.post(  "/concours-sources",           sourcesConcours.ajouterSource);
router.patch( "/concours-sources/:id",       sourcesConcours.basculerSource);
router.delete("/concours-sources/:id",       sourcesConcours.supprimerSource);
router.post(  "/concours-sources/detecter",  sourcesConcours.declencherDetection);
router.get(   "/concours-suggestions",           sourcesConcours.listerSuggestions);
router.post(  "/concours-suggestions/:id/approuver", sourcesConcours.approuverSuggestion);
router.post(  "/concours-suggestions/:id/rejeter",   sourcesConcours.rejeterSuggestion);

// ── Marketplace (Lot 14) ─────────────────────────────────────
router.get(   "/partenaires",     market.listerPartenaires);   // GET    /api/admin/partenaires
router.post(  "/partenaires",     market.creerPartenaire);     // POST   /api/admin/partenaires
router.put(   "/partenaires/:id", market.modifierPartenaire);  // PUT    /api/admin/partenaires/:id
router.delete("/partenaires/:id", market.supprimerPartenaire); // DELETE /api/admin/partenaires/:id

router.get(   "/marketplace/offres",          market.listerOffres);   // GET    /api/admin/marketplace/offres
router.post(  "/marketplace/offres",          market.creerOffre);     // POST   /api/admin/marketplace/offres
router.put(   "/marketplace/offres/:id",      market.modifierOffre);  // PUT    /api/admin/marketplace/offres/:id
router.delete("/marketplace/offres/:id",      market.supprimerOffre); // DELETE /api/admin/marketplace/offres/:id
router.get(   "/marketplace/offres/:id/contacts", market.contactsOffre); // GET  /api/admin/marketplace/offres/:id/contacts

module.exports = router;