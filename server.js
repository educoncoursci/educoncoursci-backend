// ============================================================
//  server.js
//  Point d’entrée du backend EduConcoursCI
//  Lance le serveur Express, connecte la base de données,
//  monte toutes les routes API.
// ============================================================

require(“dotenv”).config();
const express    = require(“express”);
const cors       = require(“cors”);
const helmet     = require(“helmet”);
const rateLimit  = require(“express-rate-limit”);
const path       = require(“path”);
const { initDatabase } = require(”./config/database”);

const app = express();

// ── Sécurité ──────────────────────────────────────────────────
app.use(helmet());

// Limite les requêtes : max 100 par 15 minutes par IP
const limiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 100,
message: { error: “Trop de requêtes, réessaie dans 15 minutes.” },
});
app.use(”/api/”, limiter);

// Limite plus stricte sur l’authentification : 10 tentatives / 15 min
const authLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 10,
message: { error: “Trop de tentatives de connexion, réessaie plus tard.” },
});

// ── CORS ──────────────────────────────────────────────────────
// Autorise les appels depuis ton frontend Netlify
const originesAutorisees = [
“http://localhost:5500”,
“http://localhost:3000”,
process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
origin: (origin, callback) => {
// Autorise les appels sans origine (ex: Postman, mobile)
if (!origin || originesAutorisees.includes(origin)) {
callback(null, true);
} else {
callback(new Error(“CORS non autorisé pour cette origine”));
}
},
credentials: true,
}));

// ── Parsers ───────────────────────────────────────────────────
app.use(express.json({ limit: “10mb” }));
app.use(express.urlencoded({ extended: true, limit: “10mb” }));

// ── Fichiers statiques (PDFs uploadés) ───────────────────────
app.use(”/uploads”, express.static(path.join(__dirname, “uploads”)));

// ── Routes API ────────────────────────────────────────────────
app.use(”/api/auth”,     authLimiter, require(”./routes/auth”));
app.use(”/api/users”,    require(”./routes/users”));
app.use(”/api/concours”, require(”./routes/concours”));
app.use(”/api/pdfs”,     require(”./routes/pdfs”));
app.use(”/api/videos”,   require(”./routes/videos”));
app.use(”/api/qcm”,      require(”./routes/qcm”));
app.use(”/api/payment”,  require(”./routes/payment”));
app.use(”/api/cv”,       require(”./routes/cv”));
app.use(”/api/notifs”,   require(”./routes/notifs”));
app.use(”/api/admin”,    require(”./routes/admin”));

// ── Route de santé (vérifier que le serveur tourne) ───────────
app.get(”/api/health”, (req, res) => {
res.json({
status:  “ok”,
service: “EduConcoursCI API”,
version: “1.0.0”,
date:    new Date().toLocaleDateString(“fr-FR”),
});
});

// ── Route 404 (route non trouvée) ─────────────────────────────
app.use((req, res) => {
res.status(404).json({ error: “Route introuvable.” });
});

// ── Gestion globale des erreurs ───────────────────────────────
app.use((err, req, res, next) => {
console.error(“Erreur serveur :”, err.message);
res.status(err.status || 500).json({
error: process.env.NODE_ENV === “production”
? “Une erreur interne est survenue.”
: err.message,
});
});

// ── Démarrage ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function start() {
try {
await initDatabase(); // Crée les tables si nécessaire
app.listen(PORT, () => {
console.log(`🚀 Serveur EduConcoursCI démarré sur le port ${PORT}`);
console.log(`📡 API disponible : http://localhost:${PORT}/api/health`);
console.log(`🌍 Environnement  : ${process.env.NODE_ENV || "development"}`);
});
} catch (err) {
console.error(“❌ Impossible de démarrer le serveur :”, err.message);
process.exit(1);
}
}

start();