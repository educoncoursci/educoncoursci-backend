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