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

// Diagnostic : PostgreSQL n'expose en détail que la PREMIÈRE erreur
// d'une transaction — toutes les commandes suivantes échouent avec le
// message générique "current transaction is aborted" (code 25P02), qui
// ne dit rien sur la vraie cause. On intercepte donc chaque appel
// individuellement pour savoir exactement laquelle des ~66 requêtes de
// cette fonction a échoué en premier, avec un extrait de son SQL.
let numeroRequete = 0;
const queryOriginal = client.query.bind(client);
client.query = async (...args) => {
  numeroRequete++;
  try {
    return await queryOriginal(...args);
  } catch (err) {
    if (err.code !== "25P02") {
      // Erreur d'origine (pas juste la conséquence du blocage) — celle
      // qui nous intéresse vraiment.
      const sql = typeof args[0] === "string" ? args[0] : "";
      console.error(`❌ Requête #${numeroRequete} en échec (premier extrait) :`, sql.trim().slice(0, 200).replace(/\s+/g, " "));
    }
    throw err;
  }
};

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

// Table : candidatures_concours (Lot 8 — suivi de candidature aux concours,
// workflow personnel multi-étapes "Enregistré → Admission". Nom distinct de
// la table "candidatures" ci-dessus qui concerne les offres d'emploi, pour
// ne pas entrer en collision avec ce module existant.)
await client.query(`
  CREATE TABLE IF NOT EXISTS candidatures_concours (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    concours_id  INTEGER NOT NULL REFERENCES concours(id) ON DELETE CASCADE,
    statut       VARCHAR(30) DEFAULT 'enregistre'
                 CHECK (statut IN ('enregistre', 'dossier_soumis', 'dossier_valide',
                                    'convoque', 'compose', 'admis', 'non_admis')),
    notes        TEXT,
    historique   TEXT DEFAULT '[]',
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, concours_id)
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

// Table : actualites (alimentée en continu par le flux RSS + ajouts admin)
await client.query(`
  CREATE TABLE IF NOT EXISTS actualites (
    id          SERIAL PRIMARY KEY,
    titre       VARCHAR(300) NOT NULL,
    tag         VARCHAR(60)  DEFAULT 'Actualité',
    source_nom  VARCHAR(150),
    source_url  TEXT,
    lien        TEXT,
    hash        VARCHAR(64) UNIQUE NOT NULL,
    publie_le   TIMESTAMP DEFAULT NOW(),
    actif       BOOLEAN DEFAULT TRUE,
    ordre       INTEGER DEFAULT 0,
    origine     VARCHAR(20) DEFAULT 'auto' CHECK (origine IN ('auto', 'manuel')),
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);


// Table : structures (organismes organisateurs — ENA, INFAS, CAFOP, Police...)
await client.query(`
  CREATE TABLE IF NOT EXISTS structures (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(200) NOT NULL,
    sigle       VARCHAR(30),
    ministere   VARCHAR(150),
    description TEXT,
    site_web    TEXT,
    logo_url    TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : matieres (matières de composition — Culture générale, Droit...)
await client.query(`
  CREATE TABLE IF NOT EXISTS matieres (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(150) NOT NULL UNIQUE,
    categorie   VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : diplomes (référentiel des diplômes acceptés — BEPC, BAC, Licence...)
await client.query(`
  CREATE TABLE IF NOT EXISTS diplomes (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(100) NOT NULL UNIQUE,
    niveau      INTEGER,
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Relation concours ↔ matières (plusieurs matières par concours)
await client.query(`
  CREATE TABLE IF NOT EXISTS concours_matieres (
    concours_id INTEGER NOT NULL REFERENCES concours(id) ON DELETE CASCADE,
    matiere_id  INTEGER NOT NULL REFERENCES matieres(id) ON DELETE CASCADE,
    coefficient INTEGER,
    PRIMARY KEY (concours_id, matiere_id)
  );
`);

// Relation concours ↔ diplômes acceptés (plusieurs diplômes par concours)
await client.query(`
  CREATE TABLE IF NOT EXISTS concours_diplomes (
    concours_id INTEGER NOT NULL REFERENCES concours(id) ON DELETE CASCADE,
    diplome_id  INTEGER NOT NULL REFERENCES diplomes(id) ON DELETE CASCADE,
    PRIMARY KEY (concours_id, diplome_id)
  );
`);

// Table : alertes_preferences (Module 4 — canaux et catégories suivies)
await client.query(`
  CREATE TABLE IF NOT EXISTS alertes_preferences (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    canal_email      BOOLEAN DEFAULT TRUE,
    canal_whatsapp   BOOLEAN DEFAULT FALSE,
    whatsapp_numero  VARCHAR(20),
    categories       JSONB DEFAULT '[]',
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
  );
`);

// Table : rappels_envoyes (déduplication J-7/J-3/J-1 — évite les
// doublons entre un déclenchement manuel admin et le cron automatique)
await client.query(`
  CREATE TABLE IF NOT EXISTS rappels_envoyes (
    id             SERIAL PRIMARY KEY,
    concours_id    INTEGER NOT NULL REFERENCES concours(id) ON DELETE CASCADE,
    jours_restants INTEGER NOT NULL,
    envoye_le      DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (concours_id, jours_restants, envoye_le)
  );
`);

// Table : whatsapp_envois (file d'attente — envoi manuel/semi-automatique
// tant qu'aucune API WhatsApp Business officielle n'est configurée)
await client.query(`
  CREATE TABLE IF NOT EXISTS whatsapp_envois (
    id          SERIAL PRIMARY KEY,
    numero      VARCHAR(20) NOT NULL,
    message     TEXT NOT NULL,
    statut      VARCHAR(20) DEFAULT 'à_envoyer' CHECK (statut IN ('à_envoyer', 'envoyé', 'échoué')),
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : sms_envois (Lot 11 — file d'attente SMS, même logique de
// dégradation gracieuse que whatsapp_envois tant qu'aucune passerelle
// SMS officielle n'est configurée)
await client.query(`
  CREATE TABLE IF NOT EXISTS sms_envois (
    id          SERIAL PRIMARY KEY,
    numero      VARCHAR(20) NOT NULL,
    message     TEXT NOT NULL,
    statut      VARCHAR(20) DEFAULT 'à_envoyer' CHECK (statut IN ('à_envoyer', 'envoyé', 'échoué')),
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : push_subscriptions (Lot 11 — abonnements aux notifications
// Push Web du navigateur, format standard Web Push/VAPID)
await client.query(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Ajoute les canaux SMS/Push aux préférences d'alertes si absents (Lot 11)
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='alertes_preferences' AND column_name='canal_sms'
    ) THEN
      ALTER TABLE alertes_preferences ADD COLUMN canal_sms BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='alertes_preferences' AND column_name='sms_numero'
    ) THEN
      ALTER TABLE alertes_preferences ADD COLUMN sms_numero VARCHAR(20);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='alertes_preferences' AND column_name='canal_push'
    ) THEN
      ALTER TABLE alertes_preferences ADD COLUMN canal_push BOOLEAN DEFAULT FALSE;
    END IF;
  END $$;
`);

// Table : ia_generations (suivi du quota IA gratuit par utilisateur)
await client.query(`
  CREATE TABLE IF NOT EXISTS ia_generations (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_ia_generations_user_date
  ON ia_generations (user_id, created_at);
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
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='videos' AND column_name='origine'
    ) THEN
      ALTER TABLE videos ADD COLUMN origine VARCHAR(20) DEFAULT 'lien'
        CHECK (origine IN ('lien', 'upload'));
    END IF;
  END $$;
`);

// Ajoute les colonnes de traçabilité de source à offres_emploi si absentes
// (nécessaires pour l'agrégation automatique depuis des flux externes :
//  Educarriere et autres plateformes proposant un flux RSS/XML public)
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='offres_emploi' AND column_name='source_nom'
    ) THEN
      ALTER TABLE offres_emploi ADD COLUMN source_nom VARCHAR(150);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='offres_emploi' AND column_name='source_url'
    ) THEN
      ALTER TABLE offres_emploi ADD COLUMN source_url TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='offres_emploi' AND column_name='hash'
    ) THEN
      ALTER TABLE offres_emploi ADD COLUMN hash VARCHAR(64) UNIQUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='offres_emploi' AND column_name='origine'
    ) THEN
      ALTER TABLE offres_emploi ADD COLUMN origine VARCHAR(20) DEFAULT 'manuel'
        CHECK (origine IN ('auto', 'manuel'));
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='offres_emploi' AND column_name='image_url'
    ) THEN
      ALTER TABLE offres_emploi ADD COLUMN image_url TEXT;
    END IF;
  END $$;
`);

// Ajoute les colonnes de réinitialisation de mot de passe à users
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='reset_token'
    ) THEN
      ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) UNIQUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='reset_token_expire'
    ) THEN
      ALTER TABLE users ADD COLUMN reset_token_expire TIMESTAMP;
    END IF;
  END $$;
`);

// Ajoute structure_id à concours si absent (lien optionnel vers la
// nouvelle table structures — le champ texte "organisme" existant
// n'est pas touché, pour ne rien casser côté affichage actuel)
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='structure_id'
    ) THEN
      ALTER TABLE concours ADD COLUMN structure_id INTEGER REFERENCES structures(id) ON DELETE SET NULL;
    END IF;
  END $$;
`);

// Ajoute des critères d'éligibilité à concours si absents (Module 3 —
// moteur d'éligibilité). Additif, valeurs par défaut neutres qui ne
// changent le comportement d'aucun concours existant.
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='age_min'
    ) THEN
      ALTER TABLE concours ADD COLUMN age_min INTEGER;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='age_max'
    ) THEN
      ALTER TABLE concours ADD COLUMN age_max INTEGER;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='sexe'
    ) THEN
      ALTER TABLE concours ADD COLUMN sexe VARCHAR(20) DEFAULT 'tous';
    END IF;
  END $$;
`);

// Ajoute le type de document (sujet/corrigé/cours/fiche) à pdfs si absent
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='pdfs' AND column_name='type'
    ) THEN
      ALTER TABLE pdfs ADD COLUMN type VARCHAR(30) DEFAULT 'cours';
    END IF;
  END $$;
`);

// Relation PDF ↔ concours (Module 6 — un PDF peut concerner plusieurs concours)
await client.query(`
  CREATE TABLE IF NOT EXISTS concours_pdfs (
    concours_id INTEGER NOT NULL REFERENCES concours(id) ON DELETE CASCADE,
    pdf_id      INTEGER NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
    PRIMARY KEY (concours_id, pdf_id)
  );
`);

// Table : consultations_pdf (Module 7 — suivi de progression : "documents
// consultés"). Un utilisateur peut consulter le même PDF plusieurs fois ;
// on garde chaque évènement, le comptage "distinct" se fait à la lecture.
await client.query(`
  CREATE TABLE IF NOT EXISTS consultations_pdf (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pdf_id      INTEGER NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : newsletter_abonnes (Lot 2 — page d'accueil)
await client.query(`
  CREATE TABLE IF NOT EXISTS newsletter_abonnes (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(150) UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : temoignages (Lot 2 — page d'accueil). Vide par défaut : on
// n'invente jamais de faux témoignages, l'admin ajoute les vrais retours
// d'utilisateurs au fil de l'eau ; la section reste masquée tant qu'il
// n'y en a aucun de publié.
await client.query(`
  CREATE TABLE IF NOT EXISTS temoignages (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(100) NOT NULL,
    role        VARCHAR(150),
    texte       TEXT NOT NULL,
    note        INTEGER CHECK (note BETWEEN 1 AND 5) DEFAULT 5,
    statut      VARCHAR(20) DEFAULT 'publié' CHECK (statut IN ('publié', 'brouillon')),
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : journal_activite (Lot 4 — journal d'activité admin)
await client.query(`
  CREATE TABLE IF NOT EXISTS journal_activite (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_nom    VARCHAR(150),
    action      VARCHAR(100) NOT NULL,
    cible_type  VARCHAR(50),
    cible_id    INTEGER,
    details     TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_journal_activite_date
  ON journal_activite (created_at DESC);
`);

// Table : forum_sujets (Lot 13 — communauté, forum d'entraide)
await client.query(`
  CREATE TABLE IF NOT EXISTS forum_sujets (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titre       VARCHAR(200) NOT NULL,
    contenu     TEXT NOT NULL,
    categorie   VARCHAR(30) DEFAULT 'general'
                CHECK (categorie IN ('general', 'entraide', 'question', 'actualite')),
    concours_id INTEGER REFERENCES concours(id) ON DELETE SET NULL,
    epingle     BOOLEAN DEFAULT FALSE,
    vues        INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
  );
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_forum_sujets_date
  ON forum_sujets (epingle DESC, created_at DESC);
`);

// Table : forum_reponses (Lot 13 — réponses aux sujets du forum)
await client.query(`
  CREATE TABLE IF NOT EXISTS forum_reponses (
    id          SERIAL PRIMARY KEY,
    sujet_id    INTEGER NOT NULL REFERENCES forum_sujets(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contenu     TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_forum_reponses_sujet
  ON forum_reponses (sujet_id, created_at ASC);
`);

// Table : partenaires (Lot 14 — Marketplace, gestion des partenaires)
await client.query(`
  CREATE TABLE IF NOT EXISTS partenaires (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(150) NOT NULL,
    description TEXT,
    logo_url    TEXT,
    email       VARCHAR(150),
    telephone   VARCHAR(20),
    site_web    TEXT,
    statut      VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Table : offres_marketplace (Lot 14 — offres proposées par les partenaires :
// cours particuliers, formations, packs de préparation, matériel…)
await client.query(`
  CREATE TABLE IF NOT EXISTS offres_marketplace (
    id            SERIAL PRIMARY KEY,
    partenaire_id INTEGER NOT NULL REFERENCES partenaires(id) ON DELETE CASCADE,
    titre         VARCHAR(200) NOT NULL,
    description   TEXT NOT NULL,
    categorie     VARCHAR(30) DEFAULT 'autre'
                  CHECK (categorie IN ('cours_particuliers', 'formation', 'pack_preparation', 'materiel', 'autre')),
    prix          INTEGER,
    prix_unite    VARCHAR(30) DEFAULT 'forfait',
    image_url     TEXT,
    lien_externe  TEXT,
    statut        VARCHAR(20) DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente', 'publiee', 'rejetee')),
    created_at    TIMESTAMP DEFAULT NOW()
  );
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_offres_marketplace_statut
  ON offres_marketplace (statut, created_at DESC);
`);

// Table : marketplace_contacts (Lot 14 — demandes de contact/devis envoyées
// à un partenaire à propos d'une offre. Pas de paiement en ligne pour cette
// première version : la transaction se fait directement entre le candidat
// et le partenaire, EduConcoursCI met simplement en relation.)
await client.query(`
  CREATE TABLE IF NOT EXISTS marketplace_contacts (
    id         SERIAL PRIMARY KEY,
    offre_id   INTEGER NOT NULL REFERENCES offres_marketplace(id) ON DELETE CASCADE,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    nom        VARCHAR(150) NOT NULL,
    email      VARCHAR(150) NOT NULL,
    telephone  VARCHAR(20),
    message    TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
`);

// Table : conversations (Lot 15 — messagerie privée entre candidats).
// user1_id < user2_id toujours (imposé en code), pour garantir qu'une
// seule conversation existe entre deux personnes données.
await client.query(`
  CREATE TABLE IF NOT EXISTS conversations (
    id         SERIAL PRIMARY KEY,
    user1_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
  );
`);

// Table : messages_prives (Lot 15 — messages échangés dans une conversation)
await client.query(`
  CREATE TABLE IF NOT EXISTS messages_prives (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    expediteur_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contenu         TEXT NOT NULL,
    lu              BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
  );
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_messages_prives_conversation
  ON messages_prives (conversation_id, created_at ASC);
`);

// Table : categories (Lot 4 — gestion des catégories dédiée). Le champ
// texte concours.categorie n'est PAS touché (rien de cassé) — cette
// table est un référentiel géré en plus, pré-rempli avec les catégories
// déjà utilisées par les concours existants (voir migration ci-dessous).
await client.query(`
  CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icone       VARCHAR(50) DEFAULT 'institution',
    created_at  TIMESTAMP DEFAULT NOW()
  );
`);

// Pré-remplissage de categories avec les catégories déjà utilisées par
// les concours existants — pour que la gestion dédiée démarre avec les
// valeurs réelles du site plutôt qu'une liste vide.
await client.query(`
  INSERT INTO categories (nom)
  SELECT DISTINCT categorie FROM concours WHERE categorie IS NOT NULL AND categorie != ''
  ON CONFLICT (nom) DO NOTHING;
`);

// Table : concours_sources (Lot 18 — sources RSS surveillées pour
// détecter automatiquement de nouveaux concours publiés)
await client.query(`
  CREATE TABLE IF NOT EXISTS concours_sources (
    id         SERIAL PRIMARY KEY,
    nom        VARCHAR(150) NOT NULL,
    url        TEXT NOT NULL UNIQUE,
    actif      BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
  );
`);

// Table : concours_suggestions (Lot 18 — file de validation. Un
// concours détecté automatiquement n'est JAMAIS publié directement :
// une mauvaise date extraite pourrait induire en erreur des milliers
// de candidats. Il atterrit ici, un admin le valide ou le rejette en
// un clic — c'est la seule étape humaine qui reste dans la chaîne.)
await client.query(`
  CREATE TABLE IF NOT EXISTS concours_suggestions (
    id              SERIAL PRIMARY KEY,
    titre           VARCHAR(300) NOT NULL,
    extrait         TEXT,
    source_nom      VARCHAR(150),
    source_url      TEXT,
    lien            TEXT,
    hash            VARCHAR(64) UNIQUE NOT NULL,
    statut          VARCHAR(20) DEFAULT 'en_attente'
                    CHECK (statut IN ('en_attente', 'approuvee', 'rejetee')),
    concours_id_cree INTEGER REFERENCES concours(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT NOW()
  );
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_concours_suggestions_statut
  ON concours_suggestions (statut, created_at DESC);
`);

// Ajoute des colonnes DATE fiables pour ouverture/clôture (Lot 18 —
// automatisation du statut). Les colonnes historiques `ouverture` et
// `cloture` (VARCHAR, texte libre affiché partout dans le frontend)
// sont conservées telles quelles pour ne rien casser ; ces nouvelles
// colonnes DATE servent de source de vérité pour calculer le statut
// automatiquement. Un import "best effort" tente de déduire les dates
// à partir du texte existant, sans jamais rien écraser d'incertain.
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='date_ouverture'
    ) THEN
      ALTER TABLE concours ADD COLUMN date_ouverture DATE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='date_cloture'
    ) THEN
      ALTER TABLE concours ADD COLUMN date_cloture DATE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='statut_auto'
    ) THEN
      -- Si TRUE (par défaut), le statut est recalculé chaque nuit à
      -- partir de date_ouverture/date_cloture. Un admin peut le passer
      -- à FALSE pour forcer un statut manuel (cas particulier, report...).
      ALTER TABLE concours ADD COLUMN statut_auto BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='date_verifiee'
    ) THEN
      -- FALSE = dates saisies à titre indicatif (ex: bibliothèque de
      -- départ scripts/seed-concours-ci.js, basée sur le calendrier
      -- habituel de chaque concours), pas encore confirmées contre un
      -- communiqué officiel de l'année en cours. Un admin passe ce
      -- champ à TRUE dans /admin/concours une fois la date vérifiée —
      -- ça fait disparaître le badge d'alerte correspondant.
      ALTER TABLE concours ADD COLUMN date_verifiee BOOLEAN DEFAULT TRUE;
    END IF;
  END $$;
`);

// Contrainte anti-doublon (Lot 18 — répond directement au problème
// "certains concours sont répétés") : un même titre ne peut plus être
// enregistré deux fois pour le même organisme. Posée en best-effort :
// si des doublons existent déjà, on log un avertissement au lieu de
// bloquer le démarrage (l'admin doit alors les nettoyer manuellement
// avant que la contrainte puisse être appliquée).
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'concours_titre_organisme_uniq'
    ) THEN
      ALTER TABLE concours ADD CONSTRAINT concours_titre_organisme_uniq UNIQUE (titre, organisme);
    END IF;
  EXCEPTION WHEN unique_violation OR others THEN
    RAISE NOTICE 'Contrainte anti-doublon concours non posée (doublons existants à nettoyer manuellement).';
  END $$;
`).catch((err) => console.warn("⚠️  Contrainte anti-doublon concours non posée :", err.message));

// Catalogue de référence (Lot 18) — les grands concours récurrents de
// Côte d'Ivoire, pour que la plateforme ne parte jamais d'une liste
// vide même avant que la détection automatique ou un admin n'aient
// renseigné les dates précises de la session en cours. Volontairement
// SANS dates exactes (date_ouverture/date_cloture laissées NULL,
// statut_auto = FALSE) : seules les vraies dates officielles doivent
// déclencher un changement de statut automatique — celles ci-dessous
// sont des fenêtres indicatives à confirmer par un admin. Ne s'exécute
// qu'une fois par concours grâce à ON CONFLICT DO NOTHING (contrainte
// ci-dessus), donc aucun risque de doublon au redémarrage.
const CATALOGUE_REFERENCE = [
  { titre: "Concours CAFOP — Instituteur adjoint", organisme: "CAFOP (Centre d'Animation et de Formation Pédagogique)", categorie: "Enseignement", niveau: "BEPC", ouverture: "Décembre (indicatif, à confirmer)", cloture: "Février (indicatif, à confirmer)" },
  { titre: "Concours ENA — Cycles moyen supérieur et supérieur", organisme: "École Nationale d'Administration (ENA)", categorie: "Administration", niveau: "Bac+2 à Bac+4 selon le cycle", ouverture: "Mars (indicatif, à confirmer)", cloture: "Avril (indicatif, à confirmer)" },
  { titre: "Concours ENS — Professeur de collège/lycée", organisme: "École Normale Supérieure (ENS)", categorie: "Enseignement", niveau: "Licence/Bac+3", ouverture: "Février (indicatif, à confirmer)", cloture: "Avril (indicatif, à confirmer)" },
  { titre: "Concours INFAS — Auxiliaire de santé, infirmier, sage-femme", organisme: "Institut National de Formation des Agents de Santé (INFAS)", categorie: "Santé", niveau: "BEPC à Bac selon la filière", ouverture: "Juin (indicatif, à confirmer)", cloture: "Juillet (indicatif, à confirmer)" },
  { titre: "Concours administratifs — Fonction Publique", organisme: "Ministère de la Fonction Publique et de la Modernisation de l'Administration", categorie: "Fonction Publique", niveau: "Variable selon le poste (BEPC à Bac+5)", ouverture: "Mars (indicatif, à confirmer)", cloture: "Avril/Juin (indicatif, à confirmer)" },
  { titre: "Concours Police Nationale — Sous-officier", organisme: "Police Nationale de Côte d'Ivoire", categorie: "Sécurité", niveau: "BEPC/Bac selon le grade visé", ouverture: null, cloture: null },
  { titre: "Concours Gendarmerie Nationale — Sous-officier", organisme: "Gendarmerie Nationale de Côte d'Ivoire", categorie: "Sécurité", niveau: "BEPC/Bac selon le grade visé", ouverture: null, cloture: null },
  { titre: "Concours Douanes Ivoiriennes", organisme: "Direction Générale des Douanes", categorie: "Sécurité", niveau: "BEPC/Bac selon le grade visé", ouverture: null, cloture: null },
  { titre: "Concours Eaux et Forêts", organisme: "Ministère des Eaux et Forêts", categorie: "Sécurité", niveau: "BEPC/Bac selon le grade visé", ouverture: "Annonce attendue en début d'année (à confirmer)", cloture: null },
  { titre: "Concours de recrutement militaire", organisme: "Ministère de la Défense de Côte d'Ivoire", categorie: "Armée", niveau: "Variable selon le corps", ouverture: null, cloture: null },
  { titre: "Concours INFJ — Magistrat et greffier", organisme: "Institut National de Formation Judiciaire (INFJ)", categorie: "Justice", niveau: "Licence en droit (magistrat) / BEPC-Bac (greffier)", ouverture: null, cloture: null },
  { titre: "Concours INJS — Formation aux métiers du sport et de la jeunesse", organisme: "Institut National de la Jeunesse et des Sports (INJS)", categorie: "Jeunesse et Sports", niveau: "BEPC à Bac selon la filière", ouverture: null, cloture: null },
  { titre: "Concours IPNETP — Enseignement technique et professionnel", organisme: "Institut Pédagogique National de l'Enseignement Technique et Professionnel (IPNETP)", categorie: "Enseignement", niveau: "Bac à Bac+3 selon la filière", ouverture: null, cloture: null },
  { titre: "Concours INSFS — Travail social", organisme: "Institut National Supérieur de Formation Sociale (INSFS)", categorie: "Social", niveau: "BEPC à Bac selon la filière", ouverture: null, cloture: null },
  { titre: "Concours ENSTP — Travaux publics", organisme: "École Nationale Supérieure des Travaux Publics (ENSTP)", categorie: "Ingénierie", niveau: "Bac à Bac+2 selon la filière", ouverture: null, cloture: null },
];

// Vérifie si la contrainte anti-doublon a réellement pu être posée
// juste au-dessus — si la base contient déjà des doublons préexistants
// (ancienne version du projet, avant cette protection), elle ne l'a
// pas été, et un ON CONFLICT dessus échouerait aussitôt ("no unique or
// exclusion constraint matching..."), cassant toute la transaction
// pour le reste du démarrage. On adapte donc la requête d'insertion
// du catalogue selon que la contrainte existe vraiment ou non.
const contrainteExiste = await client.query(
  `SELECT 1 FROM pg_constraint WHERE conname = 'concours_titre_organisme_uniq'`,
);
const peutUtiliserOnConflict = contrainteExiste.rows.length > 0;
if (!peutUtiliserOnConflict) {
  console.warn("⚠️  Contrainte anti-doublon absente (doublons existants en base) — le catalogue de référence utilise une vérification manuelle à la place de ON CONFLICT.");
  const doublons = await client.query(`
    SELECT titre, organisme, COUNT(*) as nombre
    FROM concours
    GROUP BY titre, organisme
    HAVING COUNT(*) > 1
  `);
  if (doublons.rows.length > 0) {
    console.warn(`⚠️  ${doublons.rows.length} concours en double détecté(s) en base — à nettoyer depuis /admin/concours :`);
    doublons.rows.forEach((d) => console.warn(`   - "${d.titre}" (${d.organisme}) : ${d.nombre} exemplaires`));
  }
}

for (const c of CATALOGUE_REFERENCE) {
  if (peutUtiliserOnConflict) {
    await client.query(
      `INSERT INTO concours (titre, organisme, categorie, niveau, ouverture, cloture, statut, statut_auto, conditions)
       VALUES ($1,$2,$3,$4,$5,$6,'à venir', FALSE, $7)
       ON CONFLICT (titre, organisme) DO NOTHING`,
      [
        c.titre, c.organisme, c.categorie, c.niveau, c.ouverture, c.cloture,
        "Dates et conditions précises à confirmer sur le communiqué officiel de l'organisme — fiche créée à titre indicatif pour référencer ce concours récurrent, complétez-la dès l'ouverture officielle de la session.",
      ],
    ).catch((err) => {
      console.error(`❌ Insertion catalogue concours échouée pour "${c.titre}" :`, err.message);
      if (err.code)       console.error("   Code PostgreSQL :", err.code);
      if (err.detail)     console.error("   Détail :", err.detail);
      if (err.hint)       console.error("   Suggestion :", err.hint);
      if (err.constraint) console.error("   Contrainte concernée :", err.constraint);
      throw err;
    });
  } else {
    // Repli sans ON CONFLICT : vérifie manuellement l'existence avant
    // d'insérer, pour rester tout aussi non-duplicant.
    const existeDeja = await client.query(
      `SELECT 1 FROM concours WHERE titre = $1 AND organisme = $2`,
      [c.titre, c.organisme],
    );
    if (existeDeja.rows.length === 0) {
      await client.query(
        `INSERT INTO concours (titre, organisme, categorie, niveau, ouverture, cloture, statut, statut_auto, conditions)
         VALUES ($1,$2,$3,$4,$5,$6,'à venir', FALSE, $7)`,
        [
          c.titre, c.organisme, c.categorie, c.niveau, c.ouverture, c.cloture,
          "Dates et conditions précises à confirmer sur le communiqué officiel de l'organisme — fiche créée à titre indicatif pour référencer ce concours récurrent, complétez-la dès l'ouverture officielle de la session.",
        ],
      ).catch((err) => {
        console.error(`❌ Insertion catalogue concours échouée pour "${c.titre}" :`, err.message);
        throw err;
      });
    }
  }
}

// Import "best effort" ponctuel : pour les concours déjà en base sans
// date_ouverture/date_cloture, on tente de parser le texte existant
// (formats "15 mars 2026" ou "2026-03-15"). Ne touche jamais aux lignes
// déjà pourvues d'une vraie date, et ignore silencieusement ce qu'il
// n'arrive pas à comprendre (mieux vaut une date absente qu'une date
// fausse déduite au hasard).
await client.query(`
  UPDATE concours
  SET date_cloture = to_date(cloture, 'DD Month YYYY')
  WHERE date_cloture IS NULL
    AND cloture ~* '^[0-9]{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) [0-9]{4}$'
`).catch(() => {}); // la locale FR de to_date() n'est pas garantie sur tous les serveurs Postgres — on ignore l'échec plutôt que de bloquer le démarrage
await client.query(`
  UPDATE concours
  SET date_cloture = cloture::date
  WHERE date_cloture IS NULL AND cloture ~ '^\\d{4}-\\d{2}-\\d{2}$'
`).catch(() => {});
await client.query(`
  UPDATE concours
  SET date_ouverture = ouverture::date
  WHERE date_ouverture IS NULL AND ouverture ~ '^\\d{4}-\\d{2}-\\d{2}$'
`).catch(() => {});

// Ajoute les champs "fiche enrichie" à concours si absents (Lot 7 —
// historique, salaire/débouchés, adresse pour la carte, communiqués
// officiels et FAQ spécifique au concours). Additif et nullable/vide
// par défaut : n'affecte aucun concours existant, les sections
// correspondantes restent simplement masquées côté fiche tant que
// l'admin n'a rien renseigné.
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='historique'
    ) THEN
      ALTER TABLE concours ADD COLUMN historique TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='salaire'
    ) THEN
      ALTER TABLE concours ADD COLUMN salaire TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='debouches'
    ) THEN
      ALTER TABLE concours ADD COLUMN debouches TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='adresse'
    ) THEN
      ALTER TABLE concours ADD COLUMN adresse TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='communiques'
    ) THEN
      ALTER TABLE concours ADD COLUMN communiques TEXT DEFAULT '[]';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='concours' AND column_name='faq'
    ) THEN
      ALTER TABLE concours ADD COLUMN faq TEXT DEFAULT '[]';
    END IF;
  END $$;
`);

// Ajoute les champs 2FA à users si absents (Lot 16 — authentification
// à deux facteurs, application TOTP type Google Authenticator)
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='two_factor_secret'
    ) THEN
      ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='two_factor_enabled'
    ) THEN
      ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='two_factor_recovery_codes'
    ) THEN
      ALTER TABLE users ADD COLUMN two_factor_recovery_codes TEXT DEFAULT '[]';
    END IF;
  END $$;
`);

// Ajoute photo_url à users si absent (Lot 6 — photo de profil)
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='photo_url'
    ) THEN
      ALTER TABLE users ADD COLUMN photo_url TEXT;
    END IF;
  END $$;
`);

await client.query("COMMIT");
console.log("✅ Tables PostgreSQL initialisées");

// Crée le compte admin par défaut s'il n'existe pas
await createDefaultAdmin();

} catch (err) {
await client.query("ROLLBACK");
// err.message seul est souvent trop vague pour PostgreSQL (ex: "current
// transaction is aborted" masque la vraie erreur qui a déclenché le
// rollback). err.detail/err.hint/err.position/err.code pointent
// précisément la commande, la colonne ou la contrainte en cause.
console.error("❌ Erreur initialisation base de données :", err.message);
if (err.code)     console.error("   Code PostgreSQL :", err.code);
if (err.detail)   console.error("   Détail :", err.detail);
if (err.hint)      console.error("   Suggestion :", err.hint);
if (err.table)     console.error("   Table concernée :", err.table);
if (err.constraint) console.error("   Contrainte concernée :", err.constraint);
if (err.position)  console.error("   Position dans la requête :", err.position);
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