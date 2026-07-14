// ============================================================
//  scripts/generer-jwt-secret.js
//  Génère une clé JWT_SECRET sécurisée de 64 octets
//  Usage : node scripts/generer-jwt-secret.js
// ============================================================

const crypto = require(“crypto”);

const secret = crypto.randomBytes(64).toString(“hex”);

console.log(””);
console.log(“🔑 JWT_SECRET généré (128 caractères hexadécimaux) :”);
console.log(””);
console.log(secret);
console.log(””);
console.log(“📋 Copie cette ligne dans ton .env Railway :”);
console.log(`JWT_SECRET=${secret}`);
console.log(””);