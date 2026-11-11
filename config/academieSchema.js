// ============================================================
//  config/academieSchema.js
//  Tables de l'Académie EduConcoursCI (cours → leçons → progression).
//  Créées au démarrage si elles n'existent pas (CREATE IF NOT EXISTS) :
//  aucune migration manuelle à lancer, aucune table existante modifiée.
// ============================================================

const { query } = require("./database");

async function initAcademieTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS academie_cours (
      id               SERIAL PRIMARY KEY,
      titre            VARCHAR(200) NOT NULL,
      description      TEXT DEFAULT '',
      matiere          VARCHAR(100) NOT NULL,
      niveau           VARCHAR(30) DEFAULT 'BAC',
      statut           VARCHAR(20) NOT NULL DEFAULT 'brouillon',
      lecons_gratuites INTEGER NOT NULL DEFAULT 2,
      created_at       TIMESTAMP DEFAULT NOW(),
      updated_at       TIMESTAMP DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS academie_lecons (
      id             SERIAL PRIMARY KEY,
      cours_id       INTEGER NOT NULL REFERENCES academie_cours(id) ON DELETE CASCADE,
      ordre          INTEGER NOT NULL,
      titre          VARCHAR(200) NOT NULL,
      objectifs      TEXT DEFAULT '',
      contenu        TEXT DEFAULT '',
      points_cles    TEXT DEFAULT '[]',
      exercices_json TEXT DEFAULT '[]',
      verifiee       BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_academie_lecons_cours ON academie_lecons (cours_id, ordre);`);
  await query(`
    CREATE TABLE IF NOT EXISTS academie_progression (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lecon_id   INTEGER NOT NULL REFERENCES academie_lecons(id) ON DELETE CASCADE,
      termine_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, lecon_id)
    );
  `);
}

module.exports = { initAcademieTables };
