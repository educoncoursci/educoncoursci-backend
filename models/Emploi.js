// ============================================================
//  models/Emploi.js
//  Toutes les requêtes SQL concernant les tables offres_emploi,
//  candidatures, alertes_emploi et sync_log_emploi.
//  Utilisé par emploiController.js et adminController.js
// ============================================================

const { query } = require("../config/database");

// ── Normalisation pour le dédoublonnage inter-sources ──────────
// Une même offre peut être publiée avec une casse, une ponctuation ou
// des espaces différents d'une plateforme à l'autre ("Comptable H/F"
// vs "COMPTABLE (H/F)"). On compare donc une version normalisée
// (minuscules, accents retirés, ponctuation réduite à des espaces)
// de titre+entreprise+ville plutôt que le texte brut.
function normaliser(texte) {
  return (texte || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function construireCleDedup({ titre, entreprise, ville }) {
  return `${normaliser(titre)}|${normaliser(entreprise)}|${normaliser(ville)}`;
}

// `inclureExpirees` peut arriver en string ("true"/"false") depuis une
// query string HTTP — normalise en booléen strict.
function inclireExpireesSafe(valeur) {
  return valeur === true || valeur === "true" || valeur === "1";
}

const Emploi = {
  construireCleDedup,

  // ── Créer une offre d'emploi (admin) ────────────────────────
  async create({
    titre, entreprise, typeContrat, typeOpportunite, ville, region, secteur,
    description, profilRecherche, salaire, experience, niveauEtudes,
    dateLimite, dateLimiteDate, emailContact, lienExterne, statut, imageUrl,
    identifiantExterne, sourceNom, sourceUrl,
  }) {
    const result = await query(
      `INSERT INTO offres_emploi
        (titre, entreprise, type_contrat, type_opportunite, ville, region, secteur,
         description, profil_recherche, salaire, experience, niveau_etudes,
         date_limite, date_limite_date, email_contact, lien_externe, statut,
         image_url, identifiant_externe, cle_dedup, source_nom, source_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        titre, entreprise, typeContrat, typeOpportunite || "emploi", ville || "Abidjan",
        region || null, secteur, description, profilRecherche, salaire, experience,
        niveauEtudes || null, dateLimite || null, dateLimiteDate || null,
        emailContact, lienExterne, statut || "publié", imageUrl || null,
        identifiantExterne || null, construireCleDedup({ titre, entreprise, ville }),
        sourceNom || null, sourceUrl || null,
      ],
    );
    return result.rows[0];
  },

  // ── Construit les conditions WHERE communes à findAll/count ──
  // Comparaison de `statut` insensible à la casse et aux espaces
  // superflus (TRIM+LOWER des deux côtés) : une offre enregistrée
  // avec "Publié", " publié " ou "PUBLIÉ" (saisie admin, import RSS,
  // ancien script de seed…) doit être traitée comme "publié" et pas
  // silencieusement exclue de la page publique par une comparaison
  // stricte `=`. C'est cette exclusion silencieuse qui explique
  // qu'un sous-ensemble seulement des offres réellement publiées
  // remontait sur /emploi.html alors qu'elles apparaissaient dans
  // l'admin (qui, lui, n'applique aucun filtre de statut au chargement).
  //
  // Gestion de l'expiration (point 6 du cahier des charges) : une
  // offre dont date_limite_date est dépassée est traitée comme
  // "expiré" même si son `statut` en base dit encore "publié" — la
  // colonne `statut` ne reflète que fermeture manuelle/brouillon,
  // l'expiration se calcule à la volée à partir de la vraie date.
  // Absence de date_limite_date ⇒ jamais expirée automatiquement
  // (une offre sans date connue n'est pas présumée expirée par son
  // seul âge, conformément au point 6).
  _construireFiltres({
    typeContrat, typeOpportunite, ville, region, secteur, niveauEtudes,
    experience, source, search, statut, inclureExpirees,
  }) {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (typeContrat) {
      conditions.push(`type_contrat = $${idx++}`);
      params.push(typeContrat);
    }
    if (typeOpportunite) {
      conditions.push(`type_opportunite = $${idx++}`);
      params.push(typeOpportunite);
    }
    if (ville) {
      conditions.push(`ville ILIKE $${idx++}`);
      params.push(`%${ville}%`);
    }
    if (region) {
      conditions.push(`region ILIKE $${idx++}`);
      params.push(`%${region}%`);
    }
    if (secteur) {
      conditions.push(`secteur ILIKE $${idx++}`);
      params.push(`%${secteur}%`);
    }
    if (niveauEtudes) {
      conditions.push(`niveau_etudes ILIKE $${idx++}`);
      params.push(`%${niveauEtudes}%`);
    }
    if (experience) {
      conditions.push(`experience ILIKE $${idx++}`);
      params.push(`%${experience}%`);
    }
    if (source) {
      conditions.push(`source_nom ILIKE $${idx++}`);
      params.push(`%${source}%`);
    }
    if (statut) {
      conditions.push(`LOWER(TRIM(statut)) = LOWER(TRIM($${idx++}))`);
      params.push(statut);
    } else {
      conditions.push(`LOWER(TRIM(statut)) = 'publié'`); // par défaut, on ne montre que les offres publiées
    }
    if (!inclireExpireesSafe(inclureExpirees)) {
      // Exclut les offres dont la date limite connue est dépassée,
      // sauf demande explicite (ex: page admin qui veut tout voir).
      conditions.push(`(date_limite_date IS NULL OR date_limite_date >= CURRENT_DATE)`);
    }
    if (search) {
      conditions.push(`(titre ILIKE $${idx} OR entreprise ILIKE $${idx++})`);
      params.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return { where, params, idx };
  },

  // ── Tri des résultats publics ─────────────────────────────────
  // "pertinence" n'a pas de score de recherche dédié (pas de moteur
  // full-text ici) : on l'approxime par la popularité (vues), puis la
  // récence, ce qui reste un signal honnête plutôt qu'un vrai score de
  // pertinence textuel — voir point 7 du cahier des charges.
  _construireTri(tri) {
    if (tri === "ancien") return "ORDER BY created_at ASC";
    if (tri === "pertinence") return "ORDER BY vues DESC, created_at DESC";
    return "ORDER BY created_at DESC"; // "recent" par défaut
  },

  // ── Liste des offres avec filtres ───────────────────────────
  async findAll({
    typeContrat, typeOpportunite, ville, region, secteur, niveauEtudes,
    experience, source, search, statut, inclureExpirees, tri,
    limit = 20, offset = 0,
  } = {}) {
    const { where, params, idx } = this._construireFiltres({
      typeContrat, typeOpportunite, ville, region, secteur, niveauEtudes,
      experience, source, search, statut, inclureExpirees,
    });
    params.push(limit, offset);

    const result = await query(
      `SELECT *,
        (date_limite_date IS NOT NULL AND date_limite_date < CURRENT_DATE) AS expiree,
        (created_at > NOW() - INTERVAL '3 days') AS nouvelle
       FROM offres_emploi
       ${where}
       ${this._construireTri(tri)}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );
    return result.rows;
  },

  // ── Nombre d'offres correspondant aux filtres publics (pagination
  //    de la page Emplois). Indépendant de LIMIT/OFFSET : sans ça, le
  //    "total" renvoyé à la page Emplois n'était jamais que le nombre
  //    d'éléments de LA PAGE courante (offres.length), jamais le vrai
  //    total — impossible de savoir s'il restait des offres à charger
  //    au-delà de la limite.
  //    Distincte de count() ci-dessous, qui compte TOUTES les offres
  //    sans filtre (utilisée par les statistiques admin) : les deux
  //    méthodes cohabitent, ne pas les fusionner sous peine de fausser
  //    soit le total public (filtré), soit le total admin (global).
  async countAvecFiltres({
    typeContrat, typeOpportunite, ville, region, secteur, niveauEtudes,
    experience, source, search, statut, inclureExpirees,
  } = {}) {
    const { where, params } = this._construireFiltres({
      typeContrat, typeOpportunite, ville, region, secteur, niveauEtudes,
      experience, source, search, statut, inclureExpirees,
    });
    const result = await query(
      `SELECT COUNT(*)::int AS total FROM offres_emploi ${where}`,
      params,
    );
    return result.rows[0].total;
  },

  // ── Liste des sources distinctes déjà agrégées (pour le filtre
  //    "Source" côté public et le tableau admin) ───────────────
  async sourcesDisponibles() {
    const result = await query(
      `SELECT DISTINCT source_nom FROM offres_emploi
       WHERE source_nom IS NOT NULL AND source_nom <> ''
       ORDER BY source_nom`,
    );
    return result.rows.map((r) => r.source_nom);
  },

  // ── Trouver une offre par ID ─────────────────────────────────
  async findById(id) {
    const result = await query(
      `SELECT *,
        (date_limite_date IS NOT NULL AND date_limite_date < CURRENT_DATE) AS expiree,
        (created_at > NOW() - INTERVAL '3 days') AS nouvelle
       FROM offres_emploi WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  // ── Modifier une offre (admin) ───────────────────────────────
  async update(id, fields) {
    const {
      titre, entreprise, typeContrat, typeOpportunite, ville, region, secteur,
      description, profilRecherche, salaire, experience, niveauEtudes,
      dateLimite, dateLimiteDate, emailContact, lienExterne, statut, imageUrl,
      identifiantExterne, sourceNom, sourceUrl,
    } = fields;

    const result = await query(
      `UPDATE offres_emploi SET
        titre               = COALESCE($1,  titre),
        entreprise          = COALESCE($2,  entreprise),
        type_contrat        = COALESCE($3,  type_contrat),
        type_opportunite    = COALESCE($4,  type_opportunite),
        ville               = COALESCE($5,  ville),
        region              = COALESCE($6,  region),
        secteur             = COALESCE($7,  secteur),
        description         = COALESCE($8,  description),
        profil_recherche    = COALESCE($9,  profil_recherche),
        salaire             = COALESCE($10, salaire),
        experience          = COALESCE($11, experience),
        niveau_etudes       = COALESCE($12, niveau_etudes),
        date_limite         = COALESCE($13, date_limite),
        date_limite_date    = COALESCE($14, date_limite_date),
        email_contact       = COALESCE($15, email_contact),
        lien_externe        = COALESCE($16, lien_externe),
        statut              = COALESCE($17, statut),
        image_url           = COALESCE($18, image_url),
        identifiant_externe = COALESCE($19, identifiant_externe),
        cle_dedup           = COALESCE($20, cle_dedup),
        source_nom          = COALESCE($21, source_nom),
        source_url          = COALESCE($22, source_url)
       WHERE id = $23
       RETURNING *`,
      [
        titre, entreprise, typeContrat, typeOpportunite, ville, region, secteur,
        description, profilRecherche, salaire, experience, niveauEtudes,
        dateLimite, dateLimiteDate, emailContact, lienExterne, statut, imageUrl,
        identifiantExterne,
        (titre || entreprise || ville) ? construireCleDedup({ titre, entreprise, ville }) : null,
        sourceNom, sourceUrl,
        id,
      ],
    );
    return result.rows[0] || null;
  },

  // ── Supprimer une offre (admin) ──────────────────────────────
  async delete(id) {
    await query(`DELETE FROM offres_emploi WHERE id = $1`, [id]);
  },

  // ── Incrémenter le compteur de vues ──────────────────────────
  async incrementerVues(id) {
    await query(`UPDATE offres_emploi SET vues = vues + 1 WHERE id = $1`, [id]);
  },

  // ── Compter les offres (stats admin) ─────────────────────────
  async count() {
    const result = await query(`SELECT COUNT(*) FROM offres_emploi`);
    return parseInt(result.rows[0].count, 10);
  },

  // ═══════════════════════════════════════════════════════════
  //  AGRÉGATION AUTOMATIQUE — dédoublonnage inter-sources
  // ═══════════════════════════════════════════════════════════
  //
  // Pour chaque offre récupérée d'un flux externe :
  //  1. Si une offre avec le même hash (titre+lien exact) existe déjà
  //     → on l'ignore (ON CONFLICT DO NOTHING), c'est un simple re-fetch
  //     de la même source.
  //  2. Sinon, si une offre ACTIVE (non expirée) avec la même clé de
  //     dédoublonnage normalisée (titre+entreprise+ville) existe déjà,
  //     provenant d'une AUTRE source → ce n'est pas une nouvelle offre
  //     mais la même annonce republiée ailleurs : on n'affiche jamais
  //     deux cartes pour la même offre (point 5 du cahier des charges),
  //     on se contente d'archiver cette source supplémentaire sur
  //     l'offre existante et de rafraîchir sa date de vérification.
  //  3. Sinon, c'est une offre réellement nouvelle → insertion.
  async upsertDepuisFlux(entries) {
    if (!entries || !entries.length) return 0;
    let inserees = 0;

    for (const e of entries) {
      const cleDedup = construireCleDedup({ titre: e.titre, entreprise: e.entreprise, ville: e.ville });

      // Étape 2 : offre équivalente déjà connue, active, autre source ?
      const existante = await query(
        `SELECT id, sources_supplementaires, source_nom FROM offres_emploi
         WHERE cle_dedup = $1
           AND (date_limite_date IS NULL OR date_limite_date >= CURRENT_DATE)
           AND LOWER(TRIM(statut)) = 'publié'
         LIMIT 1`,
        [cleDedup],
      );

      if (existante.rows.length) {
        const offre = existante.rows[0];
        if (offre.source_nom !== e.sourceNom) {
          const dejaListee = (offre.sources_supplementaires || [])
            .some((s) => s.nom === e.sourceNom);
          if (!dejaListee) {
            const sources = [...(offre.sources_supplementaires || []), { nom: e.sourceNom, url: e.sourceUrl }];
            await query(
              `UPDATE offres_emploi SET sources_supplementaires = $1, derniere_verification_le = NOW()
               WHERE id = $2`,
              [JSON.stringify(sources), offre.id],
            );
          } else {
            await query(`UPDATE offres_emploi SET derniere_verification_le = NOW() WHERE id = $1`, [offre.id]);
          }
        }
        continue; // pas de doublon inséré
      }

      // Étape 1/3 : insertion (le hash empêche un doublon exact du même flux)
      const result = await query(
        `INSERT INTO offres_emploi
          (titre, entreprise, type_contrat, type_opportunite, ville, region, secteur,
           description, date_limite, date_limite_date, lien_externe, statut,
           source_nom, source_url, hash, origine, image_url, identifiant_externe, cle_dedup)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'publié',$12,$13,$14,'auto',$15,$16,$17)
         ON CONFLICT (hash) DO NOTHING
         RETURNING id`,
        [
          e.titre, e.entreprise, e.typeContrat || "CDI", e.typeOpportunite || "emploi",
          e.ville || "Abidjan", e.region || null, e.secteur || null, e.description,
          e.dateLimite || null, e.dateLimiteDate || null, e.lienExterne, e.sourceNom,
          e.sourceUrl, e.hash, e.imageUrl || null, e.identifiantExterne || null, cleDedup,
        ],
      );
      if (result.rows.length) inserees++;
    }
    return inserees;
  },

  // ── Journal de synchronisation (admin) ────────────────────────
  async logSynchro({ sourceNom, statut, nombreOffres, messageErreur }) {
    await query(
      `INSERT INTO sync_log_emploi (source_nom, statut, nombre_offres, message_erreur)
       VALUES ($1,$2,$3,$4)`,
      [sourceNom, statut, nombreOffres || 0, messageErreur || null],
    );
  },

  // ── Statistiques d'agrégation (admin — point 13 du cahier des
  //    charges : total, actives, expirées, récupérées récemment,
  //    dernière synchro, dernières erreurs) ──────────────────────
  async getStats() {
    const [totaux, parSource, derniereSynchro, dernieresErreurs, recuperees24h] = await Promise.all([
      query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(statut)) = 'publié'
              AND (date_limite_date IS NULL OR date_limite_date >= CURRENT_DATE)
          )::int AS actives,
          COUNT(*) FILTER (
            WHERE date_limite_date IS NOT NULL AND date_limite_date < CURRENT_DATE
          )::int AS expirees,
          COUNT(*) FILTER (WHERE origine = 'auto')::int AS agregees_auto,
          COUNT(*) FILTER (WHERE origine = 'manuel')::int AS saisies_manuel
        FROM offres_emploi
      `),
      query(`
        SELECT source_nom, COUNT(*)::int AS total
        FROM offres_emploi
        WHERE source_nom IS NOT NULL AND source_nom <> ''
        GROUP BY source_nom
        ORDER BY total DESC
      `),
      query(`SELECT MAX(created_at) AS derniere FROM sync_log_emploi`),
      query(`
        SELECT source_nom, message_erreur, created_at
        FROM sync_log_emploi
        WHERE statut = 'erreur'
        ORDER BY created_at DESC
        LIMIT 10
      `),
      query(`
        SELECT COUNT(*)::int AS total FROM offres_emploi
        WHERE origine = 'auto' AND created_at > NOW() - INTERVAL '24 hours'
      `),
    ]);

    return {
      ...totaux.rows[0],
      recuperees24h: recuperees24h.rows[0].total,
      parSource: parSource.rows,
      derniereSynchro: derniereSynchro.rows[0].derniere,
      dernieresErreurs: dernieresErreurs.rows,
    };
  },

  // ═══════════════════════════════════════════════════════════
  //  CANDIDATURES
  // ═══════════════════════════════════════════════════════════

  // ── Postuler à une offre ─────────────────────────────────────
  async postuler({ userId, offreId, cvSnapshot, message }) {
    const result = await query(
      `INSERT INTO candidatures (user_id, offre_id, cv_snapshot, message)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, offre_id) DO NOTHING
       RETURNING *`,
      [userId, offreId, cvSnapshot || null, message || null],
    );
    return result.rows[0] || null; // null = candidature déjà existante
  },

  // ── Mes candidatures (utilisateur connecté) ──────────────────
  async findCandidaturesParUser(userId) {
    const result = await query(
      `SELECT c.*, o.titre AS offre_titre, o.entreprise, o.type_contrat, o.statut AS offre_statut
       FROM candidatures c
       JOIN offres_emploi o ON o.id = c.offre_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  // ── Candidatures reçues pour une offre (admin) ───────────────
  async findCandidaturesParOffre(offreId) {
    const result = await query(
      `SELECT c.*, u.nom AS candidat_nom, u.email AS candidat_email
       FROM candidatures c
       JOIN users u ON u.id = c.user_id
       WHERE c.offre_id = $1
       ORDER BY c.created_at DESC`,
      [offreId],
    );
    return result.rows;
  },

  // ═══════════════════════════════════════════════════════════
  //  ALERTES EMPLOI
  // ═══════════════════════════════════════════════════════════

  async creerAlerte({ userId, motCle, typeContrat, ville }) {
    const result = await query(
      `INSERT INTO alertes_emploi (user_id, mot_cle, type_contrat, ville)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [userId, motCle || null, typeContrat || null, ville || null],
    );
    return result.rows[0];
  },

  async findAlertesParUser(userId) {
    const result = await query(
      `SELECT * FROM alertes_emploi WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  async supprimerAlerte(id, userId) {
    await query(`DELETE FROM alertes_emploi WHERE id = $1 AND user_id = $2`, [id, userId]);
  },
};

module.exports = Emploi;
