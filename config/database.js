// ============================================================
//  config/database.js
//  Connexion à PostgreSQL + création automatique des tables
//  au premier démarrage du serveur.
// ============================================================

const { Pool } = require("pg");

// Pool de connexions PostgreSQL
// En production (Railway), DATABASE_URL est fournie automatiquement
const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: process.env.NODE_ENV === "production"
? { rejectUnauthorized: false }
: false,
});

// ── Teste la connexion ────────────────────────────────────────
pool.connect((err, client, release) => {
if (err) {
console.error("❌ Erreur de connexion PostgreSQL :", err.message);
return;
}
release();
console.log("✅ Connexion PostgreSQL établie");
});

// ── Crée toutes les tables si elles n'existent pas ────────────
async function initDatabase() {
const client = await pool.connect();
try {
await client.query("BEGIN");

// Table : utilisateurs
await client.query(`
  CREATE TABLE IF NOT EXISTS users (
    id               SERIAL PRIMARY KEY,
    nom              VARCHAR(100) NOT NULL,
    email            VARCHAR(150) UNIQUE NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    role             VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    premium          BOOLEAN DEFAULT FALSE,
    premium_plan     VARCHAR(50),
    premium_expire   DATE,
    date_inscription TIMESTAMP DEFAULT NOW(),
    favoris_json     TEXT DEFAULT '[]',
    scores_json      TEXT DEFAULT '[]',
    created_at       TIMESTAMP DEFAULT NOW()
  );
`);

// Table : concours
await client.query(`
  CREATE TABLE IF NOT EXISTS concours (
    id          SERIAL PRIMARY KEY,
    titre       VARCHAR(200) NOT NULL,
    organisme   VARCHAR(150) NOT NULL,
    categorie   VARCHAR(100) NOT NULL,
    ouverture   VARCHAR(100),
    cloture     VARCHAR(100),
    frais       INTEGER DEFAULT 0,
    places      INTEGER,
    niveau      VARCHAR(50),
    conditions  TEXT,
    pieces      TEXT DEFAULT '[]',
    centres     TEXT DEFAULT '[]',
    premium     BOOLEAN DEFAULT FALSE,
    statut      VARCHAR(50) DEFAULT 'à venir'
                CHECK (statut IN ('ouvert', 'à venir', 'fermé', 'résultats')),
    couleur     VARCHAR(20) DEFAULT '#1A6B3C',
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : pdfs
await client.query(`
  CREATE TABLE IF NOT EXISTS pdfs (
    id               SERIAL PRIMARY KEY,
    titre            VARCHAR(200) NOT NULL,
    categorie        VARCHAR(100),
    matiere          VARCHAR(100),
    pages            INTEGER DEFAULT 0,
    taille           VARCHAR(20),
    url              TEXT NOT NULL,
    description      TEXT,
    premium          BOOLEAN DEFAULT FALSE,
    statut           VARCHAR(20) DEFAULT 'publié'
                     CHECK (statut IN ('publié', 'brouillon')),
    telechargements  INTEGER DEFAULT 0,
    created_at       TIMESTAMP DEFAULT NOW()
  );
`);

// Table : videos
await client.query(`
  CREATE TABLE IF NOT EXISTS videos (
    id          SERIAL PRIMARY KEY,
    titre       VARCHAR(200) NOT NULL,
    categorie   VARCHAR(100),
    duree       VARCHAR(20),
    url         TEXT NOT NULL,
    description TEXT,
    premium     BOOLEAN DEFAULT FALSE,
    statut      VARCHAR(20) DEFAULT 'publié'
                CHECK (statut IN ('publié', 'brouillon')),
    vues        INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : qcm
await client.query(`
  CREATE TABLE IF NOT EXISTS qcm (
    id             SERIAL PRIMARY KEY,
    titre          VARCHAR(200) NOT NULL,
    matiere        VARCHAR(100) NOT NULL,
    difficulte     VARCHAR(20) DEFAULT 'Moyen'
                   CHECK (difficulte IN ('Facile', 'Moyen', 'Difficile')),
    statut         VARCHAR(20) DEFAULT 'publié'
                   CHECK (statut IN ('publié', 'brouillon')),
    questions_json TEXT NOT NULL DEFAULT '[]',
    tentatives     INTEGER DEFAULT 0,
    premium        BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMP DEFAULT NOW()
  );
`);

// Table : scores
await client.query(`
  CREATE TABLE IF NOT EXISTS scores (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    qcm_id      INTEGER REFERENCES qcm(id) ON DELETE SET NULL,
    qcm_titre   VARCHAR(200),
    score       INTEGER NOT NULL,
    total       INTEGER NOT NULL,
    pourcentage INTEGER NOT NULL,
    date        TIMESTAMP DEFAULT NOW()
  );
`);

// Table : transactions
await client.query(`
  CREATE TABLE IF NOT EXISTS transactions (
    id        SERIAL PRIMARY KEY,
    tx_id     VARCHAR(100) UNIQUE NOT NULL,
    user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email     VARCHAR(150),
    moyen     VARCHAR(50),
    plan      VARCHAR(50),
    montant   INTEGER NOT NULL,
    statut    VARCHAR(20) DEFAULT 'validé'
              CHECK (statut IN ('validé', 'échoué', 'en attente')),
    date      TIMESTAMP DEFAULT NOW()
  );
`);

// Table : notifications
await client.query(`
  CREATE TABLE IF NOT EXISTS notifications (
    id       SERIAL PRIMARY KEY,
    titre    VARCHAR(200) NOT NULL,
    message  TEXT NOT NULL,
    cible    VARCHAR(50) DEFAULT 'tous'
             CHECK (cible IN ('tous', 'premium', 'gratuit')),
    urgent   BOOLEAN DEFAULT FALSE,
    date     TIMESTAMP DEFAULT NOW()
  );
`);

// Table : offres_emploi
await client.query(`
  CREATE TABLE IF NOT EXISTS offres_emploi (
    id              SERIAL PRIMARY KEY,
    titre           VARCHAR(200) NOT NULL,
    entreprise      VARCHAR(150) NOT NULL,
    type_contrat    VARCHAR(30) NOT NULL
                    CHECK (type_contrat IN ('CDI', 'CDD', 'Stage', 'Freelance', 'Alternance')),
    ville           VARCHAR(100) DEFAULT 'Abidjan',
    secteur         VARCHAR(100),
    description     TEXT NOT NULL,
    profil_recherche TEXT,
    salaire         VARCHAR(100),
    experience      VARCHAR(50),
    date_limite     VARCHAR(100),
    email_contact   VARCHAR(150),
    lien_externe    TEXT,
    statut          VARCHAR(20) DEFAULT 'publié'
                    CHECK (statut IN ('publié', 'fermé', 'brouillon')),
    vues            INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
  );
`);

// Table : candidatures (suivi de qui postule à quelle offre)
await client.query(`
  CREATE TABLE IF NOT EXISTS candidatures (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offre_id     INTEGER NOT NULL REFERENCES offres_emploi(id) ON DELETE CASCADE,
    cv_snapshot  TEXT,
    message      TEXT,
    statut       VARCHAR(20) DEFAULT 'envoyée'
                 CHECK (statut IN ('envoyée', 'vue', 'retenue', 'refusée')),
    created_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, offre_id)
  );
`);

// Table : alertes_emploi (préférences de recherche pour notifications)
await client.query(`
  CREATE TABLE IF NOT EXISTS alertes_emploi (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mot_cle      VARCHAR(150),
    type_contrat VARCHAR(30),
    ville        VARCHAR(100),
    actif        BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT NOW()
  );
`);


// ── Migrations : ajout de colonnes si manquantes ─────────────
// Ajoute youtube_id et miniature à la table videos si absents
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='videos' AND column_name='youtube_id'
    ) THEN
      ALTER TABLE videos ADD COLUMN youtube_id VARCHAR(20);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='videos' AND column_name='miniature'
    ) THEN
      ALTER TABLE videos ADD COLUMN miniature TEXT;
    END IF;
  END $$;
`);

await client.query("COMMIT");
console.log("✅ Tables PostgreSQL initialisées");

// Crée le compte admin par défaut s'il n'existe pas
await createDefaultAdmin();

} catch (err) {
await client.query("ROLLBACK");
console.error("❌ Erreur initialisation base de données :", err.message);
throw err;
} finally {
client.release();
}
}

// ── Crée l'admin par défaut au premier lancement ──────────────
async function createDefaultAdmin() {
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;

const existant = await pool.query(
"SELECT id FROM users WHERE email = $1",
[process.env.ADMIN_EMAIL]
);
if (existant.rows.length > 0) return;

const bcrypt = require("bcryptjs");
const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

await pool.query(
`INSERT INTO users (nom, email, password_hash, role, premium) VALUES ($1, $2, $3, 'admin', TRUE)`,
["Administrateur", process.env.ADMIN_EMAIL, hash]
);
console.log("✅ Compte admin créé :", process.env.ADMIN_EMAIL);
}

// ── Helper : exécuter une requête ─────────────────────────────
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query, initDatabase };