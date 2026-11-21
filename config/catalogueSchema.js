// ============================================================
//  config/catalogueSchema.js
//  Table des produits et tarifs de ProInsertion CI. Créée au démarrage
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
  // Séparation concours (gratuits) / services payants : reformule l'ancienne description
  // sans toucher aux produits que l'administrateur a modifiés lui-même.
  await query(
    `UPDATE produits SET description = $1, updated_at = NOW()
     WHERE id = 'lm-administration' AND modifie_par_admin = FALSE AND description ILIKE '%concours%'`,
    ["Lettre au ton administratif formel pour une candidature auprès d'une administration ou de la fonction publique."],
  );
  // Abonnement : plus de « contenus Premium » ; prix aligné sur la formule 1 Mois réellement facturée (2 000 FCFA, voir config/plans.js)
  await query(
    `UPDATE produits SET description = $1, prix_fcfa = 2000, updated_at = NOW()
     WHERE id = 'abonnement-premium' AND modifie_par_admin = FALSE`,
    ["Outils de candidature (CV, lettres, analyse et adaptation aux offres) sans limite quotidienne."],
  );
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
