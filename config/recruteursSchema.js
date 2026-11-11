// ============================================================
//  config/recruteursSchema.js
//  Table des offres d'emploi SOUMISES par des entreprises inscrites.
//  Une soumission n'est jamais publiée automatiquement : l'admin la
//  valide (et convient du tarif) avant qu'elle devienne une vraie offre.
//  Créée au démarrage si absente (CREATE IF NOT EXISTS).
// ============================================================

const { query } = require("./database");

async function initRecruteursTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS offres_soumises (
      id                SERIAL PRIMARY KEY,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entreprise        VARCHAR(150) NOT NULL,
      contact_nom       VARCHAR(100) NOT NULL,
      contact_email     VARCHAR(150) NOT NULL,
      contact_telephone VARCHAR(40),
      titre             VARCHAR(200) NOT NULL,
      type_contrat      VARCHAR(30) NOT NULL,
      ville             VARCHAR(100) DEFAULT 'Abidjan',
      secteur           VARCHAR(100),
      description       TEXT NOT NULL,
      profil_recherche  TEXT,
      salaire           VARCHAR(100),
      date_limite       VARCHAR(100),
      candidature       VARCHAR(300) NOT NULL,
      statut            VARCHAR(20) NOT NULL DEFAULT 'en_attente',
      motif_refus       TEXT,
      tarif_fcfa        INTEGER,
      paye              BOOLEAN NOT NULL DEFAULT FALSE,
      offre_id          INTEGER,
      created_at        TIMESTAMP DEFAULT NOW(),
      traitee_le        TIMESTAMP
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_offres_soumises_user ON offres_soumises (user_id, created_at);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_offres_soumises_statut ON offres_soumises (statut, created_at);`);
}

module.exports = { initRecruteursTables };
