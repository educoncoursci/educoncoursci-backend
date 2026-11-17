// ============================================================
//  config/concoursSchemaV2.js
//  Colonnes ajoutées à `concours` pour la gestion complète du cycle de
//  vie et la fiabilité des informations (composition, résultats, procédure,
//  conseils, source officielle, date de dernière vérification, archivage).
//  Idempotent : sans effet sur les données existantes.
// ============================================================

const { query } = require("./database");

async function initConcoursV2() {
  const colonnes = [
    ["date_composition", "DATE"],
    ["date_resultats", "DATE"],
    ["procedure_inscription", "TEXT"],
    ["conseils", "TEXT"],
    ["source_info", "TEXT"],
    ["source_url", "TEXT"],
    ["verifie_le", "DATE"],
    ["archive", "BOOLEAN DEFAULT FALSE"],
  ];
  for (const [nom, type] of colonnes) {
    await query(`ALTER TABLE concours ADD COLUMN IF NOT EXISTS ${nom} ${type}`);
  }
  await query(`CREATE INDEX IF NOT EXISTS idx_concours_statut_archive ON concours (statut, archive)`);
}

module.exports = { initConcoursV2 };
