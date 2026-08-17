// ============================================================
//  models/Concours.js
//  Toutes les requêtes SQL concernant la table concours.
//  Utilisé par concoursController.js et adminController.js
// ============================================================

const { query } = require("../config/database");

// ── Lot 18 : dates fiables → texte affiché + statut automatique ──
const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
function formaterDateFr(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}
function calculerStatutDepuisDates(dateOuverture, dateCloture) {
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  if (dateOuverture && aujourdHui < new Date(dateOuverture)) return "à venir";
  if (dateCloture && aujourdHui > new Date(dateCloture)) return "fermé";
  return "ouvert";
}

// ── Trouve la structure la plus spécifique correspondant à un
//    organisme donné, parmi celles déjà en base (utilisée par create()
//    et update() pour le rattachement automatique au logo — voir leurs
//    commentaires). Reproduit le même principe que
//    scripts/corriger-logos-et-categorie-insfs.js : plusieurs
//    structures peuvent matcher le même organisme composé (ex.
//    "Ministère de la Fonction Publique... — Direction Générale des
//    Douanes" contient à la fois le nom du ministère ET celui de la
//    direction) — on ne peut pas se fier à la longueur du nom pour
//    départager (le nom officiel complet d'un ministère est souvent
//    PLUS LONG que celui d'une direction pourtant plus spécifique).
//    Le signal fiable est plutôt : combien de concours EN BASE
//    correspondent déjà à ce motif — la structure la plus spécifique
//    est celle qui en concerne le moins.
async function trouverStructureCorrespondante(organisme) {
  const candidats = await query(
    `SELECT id, nom, sigle FROM structures
     WHERE $1 ILIKE '%' || nom || '%'
        OR (sigle IS NOT NULL AND sigle <> '' AND $1 ILIKE '%' || sigle || '%')`,
    [organisme],
  );
  if (candidats.rows.length === 0) return null;
  if (candidats.rows.length === 1) return candidats.rows[0].id;

  let meilleur = null;
  for (const c of candidats.rows) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM concours WHERE organisme ILIKE '%' || $1 || '%'`,
      [c.nom],
    );
    const n = rows[0].n;
    if (!meilleur || n < meilleur.n) meilleur = { id: c.id, n };
  }
  return meilleur.id;
}

const Concours = {
  // ── Créer un concours ───────────────────────────────────────
  async create({
    titre,
    organisme,
    categorie,
    ouverture,
    cloture,
    frais,
    fraisDetail,
    places,
    niveau,
    conditions,
    pieces,
    centres,
    premium,
    statut,
    couleur,
    structureId,
    ageMin,
    ageMax,
    sexe,
    historique,
    salaire,
    debouches,
    adresse,
    communiques,
    faq,
    dateOuverture,
    dateCloture,
    statutAuto,
    dateVerifiee,
    lienOfficiel,
  }) {
    // Lot 18 — si de vraies dates sont fournies, elles priment : on en
    // déduit le texte affiché et le statut automatiquement, plutôt que
    // de faire confiance à un texte libre potentiellement incohérent.
    const ouvertureTexte = dateOuverture ? formaterDateFr(dateOuverture) : ouverture;
    const clotureTexte   = dateCloture   ? formaterDateFr(dateCloture)   : cloture;
    const statutCalcule  = (dateOuverture || dateCloture) && statutAuto !== false
      ? calculerStatutDepuisDates(dateOuverture, dateCloture)
      : statut;

    // Rattachement automatique au logo de l'organisme (structures.id) :
    // sans ça, seuls les concours passés par scripts/seed-concours-ci.js
    // (qui appelle explicitement corriger-logos-et-categorie-insfs.js à
    // la fin) recevaient un logo. Un concours créé par n'importe quelle
    // AUTRE voie — approbation d'une suggestion détectée automatiquement
    // par services/concoursFeed.js (concoursSourcesController.
    // approuverSuggestion), ou simple création manuelle depuis
    // /admin/concours — n'avait, lui, JAMAIS de structure_id et donc
    // jamais de logo, même quand une structure correspondante existait
    // déjà en base avec son logo renseigné. Ce correctif s'applique une
    // seule fois ici, dans create(), plutôt que d'être dupliqué dans
    // chacun de ces contrôleurs — la même logique s'applique alors
    // automatiquement partout où un concours peut naître.
    // ORDER BY LENGTH(nom) DESC : en cas de plusieurs structures dont le
    // nom apparaît dans l'organisme (ex. la structure générique
    // "Ministère de la Fonction Publique..." ET une structure plus
    // spécifique "...Direction Générale des Douanes" contenant elle
    // aussi ce préfixe), le nom le plus long — donc le plus spécifique —
    // gagne, pour ne jamais attribuer par erreur le logo générique du
    // ministère à un concours qui a en réalité sa propre structure dédiée.
    let structureIdFinal = structureId || null;
    if (!structureIdFinal && organisme) {
      structureIdFinal = await trouverStructureCorrespondante(organisme);
    }

    const result = await query(
      `INSERT INTO concours
        (titre, organisme, categorie, ouverture, cloture, frais, frais_detail, places,
         niveau, conditions, pieces, centres, premium, statut, couleur,
         structure_id, age_min, age_max, sexe,
         historique, salaire, debouches, adresse, communiques, faq,
         date_ouverture, date_cloture, statut_auto, date_verifiee, lien_officiel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
               $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
       RETURNING *`,
      [
        titre,
        organisme,
        categorie,
        ouvertureTexte,
        clotureTexte,
        // `frais === undefined` (jamais fourni) → 0 par défaut (comportement
        // historique inchangé). `frais === null` (explicitement "montant
        // inconnu/variable", ex. INSFS) → NULL en base, PAS 0 : `0`
        // signifie "gratuit confirmé", NULL signifie "on ne sait pas" —
        // les deux ne doivent jamais être confondus (`frais || 0`
        // écrasait auparavant silencieusement null en 0).
        frais === undefined ? 0 : frais,
        fraisDetail || null,
        places || null,
        niveau,
        conditions,
        JSON.stringify(pieces || []),
        JSON.stringify(centres || []),
        premium || false,
        // Avant : `statutCalcule || "à venir"` — un concours sans AUCUNE
        // date connue ET sans statut explicite se voyait forcé à
        // "à venir" par défaut, ce qui laisse croire à tort qu'une
        // ouverture est prévue alors qu'on n'en sait tout simplement
        // rien. "information non confirmée" reflète honnêtement cette
        // absence d'information fiable, conformément à la consigne :
        // ne jamais déduire un statut optimiste par défaut.
        statutCalcule || "information non confirmée",
        couleur || "#1A6B3C",
        structureIdFinal,
        ageMin || null,
        ageMax || null,
        sexe || "tous",
        historique || null,
        salaire || null,
        debouches || null,
        adresse || null,
        JSON.stringify(communiques || []),
        JSON.stringify(faq || []),
        dateOuverture || null,
        dateCloture || null,
        statutAuto !== false,
        dateVerifiee !== false,
        lienOfficiel || null,
      ],
    );
    return formatConcours(result.rows[0]);
  },

  // ── Liste tous les concours avec filtres ────────────────────
  async findAll({
    categorie,
    statut,
    premium,
    search,
    structureId,
    limit = 50,
    offset = 0,
  } = {}) {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (categorie) {
      conditions.push(`categorie = $${idx++}`);
      params.push(categorie);
    }
    if (statut) {
      conditions.push(`statut = $${idx++}`);
      params.push(statut);
    }
    if (premium !== undefined) {
      conditions.push(`premium = $${idx++}`);
      params.push(premium);
    }
    if (structureId) {
      conditions.push(`structure_id = $${idx++}`);
      params.push(structureId);
    }
    if (search) {
      conditions.push(
        `(LOWER(titre) LIKE $${idx} OR LOWER(organisme) LIKE $${idx++})`,
      );
      params.push(`%${search.toLowerCase()}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    // LEFT JOIN structures : sans cette jointure, le logo officiel de
    // l'organisme (structures.logo_url) n'était disponible que sur la
    // fiche détail (findByIdEnrichi), jamais sur la liste/les cartes de
    // concours — qui affichaient donc toujours le badge coloré générique
    // à la place du vrai logo, même quand celui-ci était renseigné.
    // Pas de préfixe de table nécessaire dans `where` : aucune des
    // colonnes filtrées (categorie, statut, premium, structure_id,
    // titre, organisme) n'existe dans `structures`, donc pas d'ambiguïté.
    const result = await query(
      `SELECT concours.*, s.logo_url AS structure_logo_url, s.sigle AS structure_sigle
       FROM concours
       LEFT JOIN structures s ON s.id = concours.structure_id
       ${where}
       ORDER BY concours.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );
    return result.rows.map(formatConcours);
  },

  // ── Trouver un concours par ID ──────────────────────────────
  // Même jointure que findAll() (voir commentaire plus haut) — sans
  // elle, structure_logo_url était toujours absent des résultats de
  // findById(), y compris pour findByIdEnrichi() qui s'appuie dessus
  // avant de fusionner l'objet `structure` complet par-dessus.
  async findById(id) {
    const result = await query(
      `SELECT concours.*, s.logo_url AS structure_logo_url, s.sigle AS structure_sigle
       FROM concours
       LEFT JOIN structures s ON s.id = concours.structure_id
       WHERE concours.id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    return formatConcours(result.rows[0]);
  },

  // ── Modifier un concours ─────────────────────────────────────
  async update(id, fields) {
    const {
      titre,
      organisme,
      categorie,
      ouverture,
      cloture,
      frais,
      fraisDetail,
      places,
      niveau,
      conditions,
      pieces,
      centres,
      premium,
      statut,
      couleur,
      structureId,
      ageMin,
      ageMax,
      sexe,
      historique,
      salaire,
      debouches,
      adresse,
      communiques,
      faq,
      dateOuverture,
      dateCloture,
      statutAuto,
      dateVerifiee,
      lienOfficiel,
      // Explicite : quand true, force `frais` à NULL même si aucune
      // nouvelle valeur n'est fournie. Sans ce flag, il n'existait
      // aucun moyen de repasser un concours d'un montant connu à
      // "inconnu/variable" via ce formulaire : `COALESCE($6, frais)`
      // ignore silencieusement un `frais` à `null` et garde l'ancienne
      // valeur, puisque COALESCE ne peut pas distinguer "pas fourni"
      // de "explicitement remis à zéro/inconnu".
      razFrais,
    } = fields;

    // Lot 18 — si une nouvelle date est fournie, on régénère le texte
    // affiché et (sauf désactivation explicite) le statut à partir
    // d'elle, plutôt que de laisser un texte libre désynchronisé.
    const ouvertureFinale = dateOuverture ? formaterDateFr(dateOuverture) : ouverture;
    const clotureFinale   = dateCloture   ? formaterDateFr(dateCloture)   : cloture;
    const statutFinal = (dateOuverture || dateCloture) && statutAuto !== false && !statut
      ? calculerStatutDepuisDates(dateOuverture, dateCloture)
      : statut;
    // Si l'admin fournit explicitement dateVerifiee, on le respecte tel
    // quel. Sinon, corriger une date (ouverture ou clôture) vaut
    // vérification implicite — l'admin qui corrige une date l'a fait
    // parce qu'il l'a confirmée quelque part, pas besoin d'une case à
    // cocher séparée en plus du geste de correction lui-même.
    const dateVerifieeFinale = dateVerifiee !== undefined
      ? dateVerifiee
      : (dateOuverture || dateCloture) ? true : undefined;

    // Même rattachement automatique au logo que dans create() (voir son
    // commentaire pour le détail) — utile ici quand un admin corrige
    // l'organisme d'un concours qui n'avait encore aucun logo (ex. une
    // suggestion approuvée avant ce correctif, ou une faute de frappe
    // dans l'organisme qui empêchait la correspondance). Ne s'active que
    // si `organisme` fait partie de cette mise à jour ET qu'aucun
    // structureId n'est fourni explicitement — un admin qui choisit
    // volontairement une structure via /admin/referentiels reste
    // toujours prioritaire sur cette déduction automatique.
    let structureIdFinal = structureId;
    if (!structureIdFinal && organisme) {
      structureIdFinal = await trouverStructureCorrespondante(organisme);
    }

    const result = await query(
      `UPDATE concours SET
        titre        = COALESCE($1,  titre),
        organisme    = COALESCE($2,  organisme),
        categorie    = COALESCE($3,  categorie),
        ouverture    = COALESCE($4,  ouverture),
        cloture      = COALESCE($5,  cloture),
        frais        = CASE WHEN $31 THEN NULL ELSE COALESCE($6, frais) END,
        frais_detail = COALESCE($7,  frais_detail),
        places       = COALESCE($8, places),
        niveau       = COALESCE($9,  niveau),
        conditions   = COALESCE($10,  conditions),
        pieces       = COALESCE($11, pieces),
        centres      = COALESCE($12, centres),
        premium      = COALESCE($13, premium),
        statut       = COALESCE($14, statut),
        couleur      = COALESCE($15, couleur),
        structure_id = COALESCE($16, structure_id),
        age_min      = COALESCE($17, age_min),
        age_max      = COALESCE($18, age_max),
        sexe         = COALESCE($19, sexe),
        historique   = COALESCE($20, historique),
        salaire      = COALESCE($21, salaire),
        debouches    = COALESCE($22, debouches),
        adresse      = COALESCE($23, adresse),
        communiques  = COALESCE($24, communiques),
        faq          = COALESCE($25, faq),
        date_ouverture = COALESCE($26, date_ouverture),
        date_cloture   = COALESCE($27, date_cloture),
        statut_auto    = COALESCE($28, statut_auto),
        date_verifiee  = COALESCE($29, date_verifiee),
        lien_officiel  = COALESCE($30, lien_officiel)
       WHERE id = $32
       RETURNING *`,
      [
        titre,
        organisme,
        categorie,
        ouvertureFinale,
        clotureFinale,
        frais,
        fraisDetail,
        places,
        niveau,
        conditions,
        pieces ? JSON.stringify(pieces) : null,
        centres ? JSON.stringify(centres) : null,
        premium,
        statutFinal,
        couleur,
        structureIdFinal,
        ageMin,
        ageMax,
        sexe,
        historique,
        salaire,
        debouches,
        adresse,
        communiques ? JSON.stringify(communiques) : null,
        faq ? JSON.stringify(faq) : null,
        dateOuverture,
        dateCloture,
        statutAuto,
        dateVerifieeFinale,
        lienOfficiel,
        razFrais === true, // $31 — CASE WHEN doit recevoir un booléen strict
        id,
      ],
    );
    if (!result.rows[0]) return null;
    return formatConcours(result.rows[0]);
  },

  // ── Trouver un concours enrichi (structure + matières + diplômes) ──
  // Base pour la fiche concours complète du Module 2 et pour le futur
  // moteur d'éligibilité (Module 3). N'affecte pas findById() existant.
  async findByIdEnrichi(id) {
    const base = await this.findById(id);
    if (!base) return null;

    const Matiere  = require("./Matiere");
    const Diplome  = require("./Diplome");

    const [structureRes, matieres, diplomes] = await Promise.all([
      base.structure_id
        ? query("SELECT * FROM structures WHERE id = $1", [base.structure_id])
        : Promise.resolve({ rows: [] }),
      Matiere.findByConcours(id),
      Diplome.findByConcours(id),
    ]);

    return {
      ...base,
      structure: structureRes.rows[0] || null,
      matieres,
      diplomes,
    };
  },

  // ── Supprimer un concours ────────────────────────────────────
  async delete(id) {
    await query(`DELETE FROM concours WHERE id = $1`, [id]);
  },

  // ── Concours ouverts (pour la page d'accueil) ───────────────
  async findOuverts(limit = 6) {
    const result = await query(
      `SELECT * FROM concours
       WHERE statut = 'ouvert'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(formatConcours);
  },

  // ── Liste des catégories distinctes (pour les filtres) ───────
  async getCategories() {
    const result = await query(
      `SELECT DISTINCT categorie FROM concours
       WHERE categorie IS NOT NULL AND categorie != ''
       ORDER BY categorie`,
    );
    return result.rows.map((r) => r.categorie);
  },

  // ── Compter les concours (stats admin) ──────────────────────
  async count() {
    const result = await query(`SELECT COUNT(*) FROM concours`);
    return parseInt(result.rows[0].count, 10);
  },

  async countOuverts() {
    const result = await query(
      `SELECT COUNT(*) FROM concours WHERE statut = 'ouvert'`,
    );
    return parseInt(result.rows[0].count, 10);
  },
};

// ── Parse les colonnes JSON avant de renvoyer ────────────────
function formatConcours(row) {
  if (!row) return null;
  return {
    ...row,
    pieces: tryParse(row.pieces, []),
    centres: tryParse(row.centres, []),
    communiques: tryParse(row.communiques, []),
    faq: tryParse(row.faq, []),
  };
}

function tryParse(val, fallback) {
  try {
    return JSON.parse(val || "[]");
  } catch {
    return fallback;
  }
}

module.exports = Concours;
