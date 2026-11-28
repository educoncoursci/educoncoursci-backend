// ============================================================
//  config/commandeCvSchema.js
//  Table des CV commandés à l'acte. Le contenu complet reste TOUJOURS
//  côté serveur ; le client ne reçoit qu'un aperçu partiel tant que le
//  paiement n'est pas validé par l'admin.
// ============================================================

const { query } = require("./database");
const { idsTypesCv, idsTypesLm } = require("./typesCv");
const { idsTypesRedaction } = require("./typesRedaction");
const { idsPacks } = require("./packs");

async function initCommandesCv() {
  await query(`
    CREATE TABLE IF NOT EXISTS commandes_cv (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      produit_id     VARCHAR(60) NOT NULL,
      donnees        TEXT NOT NULL,
      contenu        TEXT NOT NULL,
      transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
      created_at     TIMESTAMP DEFAULT NOW()
    );
  `);
  // Téléphone du payeur et libellé du service, communs à TOUS les paiements (Premium et services à l'acte)
  await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS telephone VARCHAR(20)`);
  await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS service VARCHAR(160)`);
  await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notifier_client BOOLEAN NOT NULL DEFAULT FALSE`);
  // E-mail de contact du client (pour lui envoyer son document) et numéro de commande copié sur la transaction
  await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS email_client VARCHAR(160)`);
  await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference VARCHAR(30)`);
  // Identifiant unique de commande (ex. PI-261127-3F9A7C21), attribué automatiquement à chaque commande,
  // y compris aux commandes déjà existantes (valeur par défaut évaluée ligne par ligne).
  await query(`ALTER TABLE commandes_cv ADD COLUMN IF NOT EXISTS reference VARCHAR(30)
    DEFAULT ('PI-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)))`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_commandes_cv_reference ON commandes_cv (reference)`);
  // Packs : plusieurs documents, un seul paiement (groupe_id = id du premier document)
  await query(`ALTER TABLE commandes_cv ADD COLUMN IF NOT EXISTS groupe_id INTEGER`);
  await query(`ALTER TABLE commandes_cv ADD COLUMN IF NOT EXISTS pack_id VARCHAR(60)`);
  // Simulation d'entretien : réponses du candidat et analyse (JSON)
  await query(`ALTER TABLE commandes_cv ADD COLUMN IF NOT EXISTS reponses TEXT`);
  await query(`ALTER TABLE commandes_cv ADD COLUMN IF NOT EXISTS resultat TEXT`);
  await query(`CREATE INDEX IF NOT EXISTS idx_commandes_cv_groupe ON commandes_cv (groupe_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_commandes_cv_user ON commandes_cv (user_id, created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_commandes_cv_tx ON commandes_cv (transaction_id);`);

  // Prix de lancement de la simulation : 3 000 → 1 500 F. N'agit que sur le prix d'origine
  // non modifié par l'admin (jamais sur un tarif que l'admin a fixé lui-même).
  await query(`UPDATE produits SET prix_fcfa = 1500 WHERE id = 'entretien-simulation' AND prix_fcfa = 3000 AND modifie_par_admin = FALSE`);

  // Les 6 types de CV et les 6 types de lettres et les 14 courriers/documents, 2 services d'accompagnement et 4 packs sont désormais vendus : on les active, sauf si
  // l'admin les a déjà modifiés lui-même (ses choix ne sont jamais écrasés).
  await require("./catalogueSchema").activerProduits([...idsTypesCv(), ...idsTypesLm(), ...idsTypesRedaction().filter((i) => !i.startsWith("bonus-")), ...idsPacks(), "entretien-simulation"]);
}

module.exports = { initCommandesCv };
