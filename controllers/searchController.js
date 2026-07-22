// ============================================================
//  controllers/searchController.js
//  Recherche universelle : concours, PDFs, vidéos, QCM et
//  types de documents (Pro/Admin) en une seule requête.
// ============================================================

const { query } = require("../config/database");
const { listerTypes: listerTypesDocumentsPro } = require("../config/typesDocuments");
const { listerTypesAdmin } = require("../config/typesDocumentsAdmin");

// ════════════════════════════════════════════════════════════
//  GET /api/search?q=... — Recherche universelle
// ════════════════════════════════════════════════════════════
exports.rechercher = async (req, res) => {
  try {
    const termeBrut = (req.query.q || "").trim();

    if (termeBrut.length < 2) {
      return res.status(400).json({
        error: "Le terme de recherche doit contenir au moins 2 caractères."
      });
    }

    const terme = `%${termeBrut}%`;
    const estPremium = req.user?.premium || false;

    // ── Recherches en base, en parallèle ────────────────────
    const [concoursRes, pdfsRes, videosRes, qcmRes] = await Promise.all([
      query(
        `SELECT id, titre, organisme, categorie, statut
         FROM concours
         WHERE (titre ILIKE $1 OR organisme ILIKE $1 OR categorie ILIKE $1)
         ORDER BY created_at DESC LIMIT 5`,
        [terme]
      ),
      query(
        `SELECT id, titre, categorie, matiere, premium
         FROM pdfs
         WHERE statut = 'publié' AND (titre ILIKE $1 OR categorie ILIKE $1 OR matiere ILIKE $1)
         ORDER BY created_at DESC LIMIT 5`,
        [terme]
      ),
      query(
        `SELECT id, titre, categorie, premium
         FROM videos
         WHERE statut = 'publié' AND (titre ILIKE $1 OR categorie ILIKE $1)
         ORDER BY created_at DESC LIMIT 5`,
        [terme]
      ),
      query(
        `SELECT id, titre, matiere, difficulte, premium
         FROM qcm
         WHERE statut = 'publié' AND (titre ILIKE $1 OR matiere ILIKE $1)
         ORDER BY created_at DESC LIMIT 5`,
        [terme]
      ),
    ]);

    // ── Recherche dans les catalogues statiques (documents) ──
    const termeMinuscule = termeBrut.toLowerCase();
    const documentsProTrouves = listerTypesDocumentsPro().filter(t =>
      t.nom.toLowerCase().includes(termeMinuscule) ||
      t.description.toLowerCase().includes(termeMinuscule)
    );
    const documentsAdminTrouves = listerTypesAdmin().filter(t =>
      t.nom.toLowerCase().includes(termeMinuscule) ||
      t.description.toLowerCase().includes(termeMinuscule)
    );

    // ── Masque les résultats premium pour les non-abonnés (juste un badge, pas de blocage total) ──
    const marquerVerrouille = (item) => ({
      ...item,
      verrouille: item.premium && !estPremium,
    });

    const resultats = {
      concours: concoursRes.rows.map(c => ({
        type: "concours", id: c.id, titre: c.titre,
        sousTitre: `${c.organisme} · ${c.categorie}`,
        statut: c.statut,
        lien: `/concours-details.html?id=${c.id}`,
      })),
      documents: pdfsRes.rows.map(marquerVerrouille).map(p => ({
        type: "document", id: p.id, titre: p.titre,
        sousTitre: [p.categorie, p.matiere].filter(Boolean).join(" · "),
        verrouille: p.verrouille,
        lien: `/bibliotheque.html?pdf=${p.id}`,
      })),
      videos: videosRes.rows.map(marquerVerrouille).map(v => ({
        type: "video", id: v.id, titre: v.titre,
        sousTitre: v.categorie,
        verrouille: v.verrouille,
        lien: `/videos.html?video=${v.id}`,
      })),
      qcm: qcmRes.rows.map(marquerVerrouille).map(q => ({
        type: "qcm", id: q.id, titre: q.titre,
        sousTitre: `${q.matiere} · ${q.difficulte}`,
        verrouille: q.verrouille,
        lien: `/quiz.html?qcm=${q.id}`,
      })),
      documentsGenerables: [
        ...documentsProTrouves.map(t => ({
          type: "document_generable", id: t.id, titre: t.nom,
          sousTitre: "Document Professionnel",
          lien: `/documents-pro.html#${t.id}`,
        })),
        ...documentsAdminTrouves.map(t => ({
          type: "document_generable", id: t.id, titre: t.nom,
          sousTitre: "Document Administratif",
          lien: `/documents-admin.html#${t.id}`,
        })),
      ],
    };

    const total =
      resultats.concours.length + resultats.documents.length +
      resultats.videos.length + resultats.qcm.length +
      resultats.documentsGenerables.length;

    res.json({ terme: termeBrut, total, resultats });
  } catch (err) {
    console.error("Erreur recherche universelle :", err.message);
    res.status(500).json({ error: "Erreur lors de la recherche." });
  }
};
