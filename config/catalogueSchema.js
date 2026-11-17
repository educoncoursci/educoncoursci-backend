// ============================================================
//  config/catalogueSchema.js
//  Table des produits et tarifs de ProInsertion. Créée au démarrage
//  (CREATE IF NOT EXISTS) et remplie une seule fois avec la grille
//  de départ : les modifications de l'administrateur sont conservées.
// ============================================================

const { query } = require("./database");
const { PRODUITS } = require("./catalogueSeed");

async function initCatalogue() {
  await query(`
    CREATE TABLE IF NOT EXISTS produits (
      id                 VARCHAR(60) PRIMARY KEY,
      categorie          VARCHAR(40) NOT NULL,
      nom                VARCHAR(150) NOT NULL,
      description        TEXT DEFAULT '',
      prix_fcfa          INTEGER NOT NULL CHECK (prix_fcfa >= 0),
      periodicite        VARCHAR(20),
      composition        TEXT DEFAULT '[]',
      inclus             TEXT DEFAULT '[]',
      ordre              INTEGER NOT NULL DEFAULT 0,
      actif              BOOLEAN NOT NULL DEFAULT FALSE,
      modifie_par_admin  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at         TIMESTAMP DEFAULT NOW(),
      updated_at         TIMESTAMP DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_produits_categorie ON produits (categorie, ordre);`);

  for (const [i, p] of PRODUITS.entries()) {
    await query(
      `INSERT INTO produits (id, categorie, nom, description, prix_fcfa, periodicite, composition, inclus, ordre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.categorie, p.nom, p.description, p.prix_fcfa, p.periodicite,
       JSON.stringify(p.composition), JSON.stringify(p.inclus), i + 1],
    );
  }
}

// Active par défaut des produits dont le service vient de devenir disponible,
// SAUF si l'administrateur les a déjà modifiés lui-même.
async function activerProduits(ids) {
  if (!ids.length) return;
  const marques = ids.map((_, i) => `$${i + 1}`).join(",");
  await query(
    `UPDATE produits SET actif = TRUE, updated_at = NOW()
     WHERE id IN (${marques}) AND modifie_par_admin = FALSE`,
    ids,
  );
}

module.exports = { initCatalogue, activerProduits };
