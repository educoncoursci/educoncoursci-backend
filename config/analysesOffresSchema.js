// ============================================================
//  config/analysesOffresSchema.js
//  Historique des analyses d'offres d'un utilisateur. On ne conserve JAMAIS
//  les fichiers envoyés (PDF, captures, CV) : uniquement le résultat de
//  l'analyse, visible et supprimable par son propriétaire.
// ============================================================
const { query } = require("./database");

async function initAnalysesOffres() {
  await query(`
    CREATE TABLE IF NOT EXISTS analyses_offres (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      intitule   VARCHAR(200),
      organisation VARCHAR(200),
      analyse_json TEXT NOT NULL,
      comparaison TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_analyses_offres_user ON analyses_offres (user_id, created_at DESC)`);
}
module.exports = { initAnalysesOffres };
