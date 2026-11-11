// ============================================================
//  server.js
//  Point d'entrée du backend EduConcoursCI
//  Lance le serveur Express, connecte la base de données,
//  monte toutes les routes API.
// ============================================================

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");
const path       = require("path");
const { initDatabase } = require("./config/database");

const app = express();

// Render (comme la plupart des hébergeurs modernes) place le serveur
// derrière un proxy inverse, qui ajoute un en-tête X-Forwarded-For avec
// la vraie IP du visiteur. Sans cette ligne, Express n'y fait pas
// confiance par défaut (sécurité), ce qui fait planter
// express-rate-limit (il en a besoin pour identifier qui fait quoi) —
// erreur ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. "1" = fait confiance au
// premier proxy uniquement (celui de Render), pas à toute la chaîne,
// ce qui reste sûr contre une IP falsifiée par le visiteur lui-même.
app.set("trust proxy", 1);

// ── Sécurité ──────────────────────────────────────────────────
app.use(helmet());

// Limite générale : 600 requêtes / 15 min par adresse IP.
// (Une page du site fait plusieurs appels, et de nombreux abonnés mobiles
// partagent la même IP : 100 était trop bas et bloquait des utilisateurs honnêtes.)
const limiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 600,
message: { error: "Trop de requêtes, réessaie dans 15 minutes." },
});
app.use("/api/", limiter);

// ── Limites ciblées sur l'authentification ────────────────────
// Seuls les ÉCHECS comptent pour la connexion (skipSuccessfulRequests), et la
// protection fine se fait COMPTE PAR COMPTE (middleware/limiteConnexion.js),
// pour ne pas pénaliser les utilisateurs qui partagent une IP mobile.
const msgTentatives = { error: "Trop de tentatives, réessaie plus tard." };
const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, skipSuccessfulRequests: true, message: msgTentatives });
const limite2FA = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, skipSuccessfulRequests: true, message: msgTentatives });
const limiteInscription = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: msgTentatives });
const limiteMotDePasseOublie = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: msgTentatives });
// Formulaires publics sans compte (newsletter, contact partenaire) : anti-spam
const limiteFormulairePublic = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: msgTentatives });
const { limiteConnexionParEmail } = require("./middleware/limiteConnexion");

// ── CORS ──────────────────────────────────────────────────────
// Autorise les appels depuis ton frontend Netlify
const originesAutorisees = [
"http://localhost:5500",
"http://localhost:3000",
process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
origin: (origin, callback) => {
// Autorise les appels sans origine (ex: Postman, mobile)
if (!origin || originesAutorisees.includes(origin)) {
callback(null, true);
} else {
// Journalisé côté serveur (visible dans les logs de ton hébergeur) —
// ça permet de savoir immédiatement si un problème de connexion
// frontend/backend vient de CORS (ex: FRONTEND_URL mal configurée)
// plutôt que de deviner depuis la console du navigateur seule.
console.warn(`⚠️  CORS refusé pour l'origine "${origin}" — vérifie FRONTEND_URL sur ton hébergeur. Origines autorisées : ${originesAutorisees.join(", ")}`);
callback(new Error("CORS non autorisé pour cette origine"));
}
},
credentials: true,
}));

// ── Parsers ───────────────────────────────────────────────────
// L'option verify capture le corps brut de la requête dans
// req.rawBody, nécessaire pour vérifier la signature HMAC-SHA256 du
// webhook Wave (controllers/paymentController.js → webhookWave) —
// le JSON re-sérialisé par Express ne redonnerait pas exactement le
// même buffer que celui signé par Wave (ordre des clés, espaces).
// N'affecte aucune autre route : req.body reste disponible partout
// comme avant, req.rawBody est juste une info supplémentaire.
app.use(express.json({
  limit: "2mb",
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Messages d'erreur 500 : jamais de détails techniques pour le public ──
// Beaucoup de routes renvoient err.message tel quel (noms de tables, requêtes SQL…).
// Pour tout visiteur autre que l'administrateur, le détail est remplacé par un message
// générique ; le détail réel reste dans les journaux du serveur.
app.use((req, res, next) => {
  const jsonOriginal = res.json.bind(res);
  res.json = (corps) => {
    if (
      res.statusCode === 500 &&
      process.env.NODE_ENV !== "development" &&
      corps && typeof corps === "object" && typeof corps.error === "string" &&
      req.user?.role !== "admin"
    ) {
      console.error(`Erreur 500 (${req.method} ${req.originalUrl}) : ${corps.error}`);
      corps = { ...corps, error: "Une erreur est survenue. Réessaie dans un instant." };
    }
    return jsonOriginal(corps);
  };
  next();
});

// ── Fichiers statiques (PDFs uploadés) ───────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Routes API ────────────────────────────────────────────────
app.use("/api/auth/login",            limiteLogin, limiteConnexionParEmail);
app.use("/api/auth/register",         limiteInscription);
app.use("/api/auth/forgot-password",  limiteMotDePasseOublie);
app.use("/api/auth/reset-password",   limiteMotDePasseOublie);
app.use("/api/auth/2fa/verify-login", limite2FA);
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/vitrine/newsletter", limiteFormulairePublic);
app.post("/api/marketplace/offres/:id/contact", limiteFormulairePublic);
app.use("/api/users",    require("./routes/users"));
app.use("/api/concours", require("./routes/concours"));
app.use("/api/referentiels", require("./routes/referentiels"));
app.use("/api/eligibilite", require("./routes/eligibilite"));
app.use("/api/alertes", require("./routes/alertes"));
app.use("/api/progression", require("./routes/progression"));
app.use("/api/candidatures-concours", require("./routes/candidaturesConcours"));
app.use("/api/assistant-concours", require("./routes/assistantConcours"));
app.use("/api/push", require("./routes/push"));
app.use("/api/forum", require("./routes/forum"));
app.use("/api/marketplace", require("./routes/marketplace"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/vitrine", require("./routes/vitrine"));
app.use("/api/pdfs",     require("./routes/pdfs"));
app.use("/api/videos",   require("./routes/videos"));
app.use("/api/qcm",      require("./routes/qcm"));
app.use("/api/qcm-ia",   require("./routes/qcmIA")); // Générateur de QCM par IA (admin)
app.use("/api/academie", require("./routes/academie")); // Académie : cours, leçons, progression
app.use("/api/recruteurs", require("./routes/recruteurs")); // Espace recruteurs : offres soumises
app.use("/api/payment",  require("./routes/payment"));
app.use("/api/cv",       require("./routes/cv"));
app.use("/api/documents", require("./routes/documents"));
app.use("/api/documents-admin", require("./routes/documentsAdmin"));
app.use("/api/search", require("./routes/search"));
app.use("/api/emploi", require("./routes/emploi"));
app.use("/api/assistance-sociale", require("./routes/assistanceSociale"));
app.use("/api/notifs",   require("./routes/notifs"));
app.use("/api/actualites", require("./routes/actualites"));
app.use("/api/admin",    require("./routes/admin"));
app.use("/api/diagnostic", require("./routes/diagnostic"));

// ── Route de santé (vérifier que le serveur tourne) ───────────
app.get("/api/health", (req, res) => {
res.json({
status:  "ok",
service: "EduConcoursCI API",
version: "1.0.0",
date:    new Date().toLocaleDateString("fr-FR"),
});
});

// ── Route 404 (route non trouvée) ─────────────────────────────
app.use((req, res) => {
res.status(404).json({ error: "Route introuvable." });
});

// ── Gestion globale des erreurs ───────────────────────────────
app.use((err, req, res, next) => {
console.error("Erreur serveur :", err.message);
res.status(err.status || 500).json({
error: process.env.NODE_ENV === "production"
? "Une erreur interne est survenue."
: err.message,
});
});

// ── Démarrage ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function start() {
try {
await initDatabase(); // Crée les tables si nécessaire
// Tables des modules Académie et recruteurs : chacune est indépendante, et une
// erreur ici ne doit jamais empêcher le reste du site de démarrer.
for (const [nom, creer] of [
  ["Académie", () => require("./config/academieSchema").initAcademieTables()],
  ["recruteurs", () => require("./config/recruteursSchema").initRecruteursTables()],
]) {
  try {
    await creer();
  } catch (err) {
    console.error(`⚠️ Tables ${nom} non créées :`, err.message);
  }
}

// Garantit qu'akone97@hotmail.com (ou ADMIN_EMAIL) est l'unique admin.
// Best-effort : si le compte n'existe pas encore, on log un avertissement
// sans bloquer le démarrage du serveur (il suffira de redémarrer une fois
// le compte créé, ou de lancer `npm run admin:init` manuellement).
try {
  const { assurerAdminUnique, demarrerVerificationPeriodique } = require("./services/adminBootstrap");
  const resultat = await assurerAdminUnique();
  if (resultat.ok) {
    console.log(`👑 Admin unique confirmé : ${resultat.message}`);
  } else {
    console.warn(`⚠️  ${resultat.message}`);
  }
  demarrerVerificationPeriodique(); // revérifie toutes les 10 min (auto-résolution si le compte est créé après coup)
} catch (err) {
  console.warn("⚠️  Vérification admin au démarrage impossible :", err.message);
}

require("./services/actualitesFeed").demarrerPlanification(); // Flux d'actualités en continu
require("./services/emploiFeed").demarrerPlanification();      // Agrégation des offres d'emploi externes
require("./services/rappelsScheduler").demarrerPlanification(); // Rappels de clôture J-7/J-3/J-1 (Module 4)
require("./services/transactionsScheduler").demarrerPlanification(); // Nettoyage des transactions de paiement abandonnées
require("./services/concoursStatutScheduler").demarrerPlanification(); // Lot 18 — statut automatique des concours
require("./services/concoursFeed").demarrerPlanification(); // Lot 18 — détection automatique de nouveaux concours
app.listen(PORT, () => {
console.log(`🚀 Serveur EduConcoursCI démarré sur le port ${PORT}`);
console.log(`📡 API disponible : http://localhost:${PORT}/api/health`);
console.log(`🌍 Environnement  : ${process.env.NODE_ENV || "development"}`);
});
} catch (err) {
console.error("❌ Impossible de démarrer le serveur :", err.message);
process.exit(1);
}
}

start();