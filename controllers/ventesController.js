// ============================================================
//  controllers/ventesController.js
//  Tableau de bord des ventes (admin) : chiffre d'affaires, ventes par
//  produit / catégorie / moyen de paiement / jour, paiements à valider.
//  Source : table `transactions` (seuls les paiements « validé » comptent
//  dans le chiffre d'affaires).
// ============================================================

const { query } = require("../config/database");
const { CATEGORIES } = require("../config/catalogueSeed");

const NOMS_CATEGORIES = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.nom]));
const PERIODES = [7, 30, 90, 365];

exports.tableauDeBord = async (req, res) => {
  try {
    const demande = parseInt(req.query.jours, 10);
    const jours = PERIODES.includes(demande) ? demande : 30;
    // Fenêtre : aujourd'hui inclus, jours-1 jours en arrière (début de journée)
    const depuis = `CURRENT_DATE - ($1::int - 1)`;

    const [totaux, produits, moyens, parJour, attente] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS nb, COALESCE(SUM(montant), 0)::int AS ca
         FROM transactions WHERE statut = 'validé' AND date >= ${depuis}`, [jours]),
      query(
        `SELECT t.plan AS plan, p.id AS produit_id, p.nom AS nom, p.categorie AS categorie,
                COUNT(*)::int AS nb, COALESCE(SUM(t.montant), 0)::int AS ca
         FROM transactions t LEFT JOIN produits p ON p.id = t.plan
         WHERE t.statut = 'validé' AND t.date >= ${depuis}
         GROUP BY t.plan, p.id, p.nom, p.categorie ORDER BY ca DESC`, [jours]),
      query(
        `SELECT COALESCE(moyen, 'Autre') AS moyen, COUNT(*)::int AS nb, COALESCE(SUM(montant), 0)::int AS ca
         FROM transactions WHERE statut = 'validé' AND date >= ${depuis}
         GROUP BY COALESCE(moyen, 'Autre') ORDER BY ca DESC`, [jours]),
      query(
        `SELECT to_char(j.jour, 'YYYY-MM-DD') AS jour, COALESCE(v.nb, 0)::int AS nb, COALESCE(v.ca, 0)::int AS ca
         FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') AS j(jour)
         LEFT JOIN (SELECT date::date AS jour, COUNT(*) AS nb, SUM(montant) AS ca
                    FROM transactions WHERE statut = 'validé' GROUP BY date::date) v ON v.jour = j.jour::date
         ORDER BY j.jour`, [jours]),
      query(
        `SELECT t.id, t.email, t.plan, t.montant, t.moyen, t.statut, t.date, p.nom AS produit_nom
         FROM transactions t LEFT JOIN produits p ON p.id = t.plan
         WHERE t.statut IN ('en attente', 'à vérifier') ORDER BY t.date ASC LIMIT 50`),
    ]);

    // Regroupement par catégorie ; les plans hors catalogue (anciens abonnements) → « Abonnements »
    const categories = {};
    const lignesProduits = produits.rows.map((r) => {
      const horsCatalogue = !r.produit_id;
      const cat = horsCatalogue ? "Abonnements" : NOMS_CATEGORIES[r.categorie] || r.categorie;
      categories[cat] = categories[cat] || { categorie: cat, nb: 0, ca: 0 };
      categories[cat].nb += r.nb;
      categories[cat].ca += r.ca;
      return { id: r.produit_id || r.plan || "inconnu", nom: r.nom || `Abonnement (${r.plan || "plan inconnu"})`, categorie: cat, nb: r.nb, ca: r.ca };
    });

    const nb = totaux.rows[0].nb;
    const ca = totaux.rows[0].ca;
    const enAttente = attente.rows;
    res.json({
      jours,
      totaux: {
        ca, nb_ventes: nb,
        panier_moyen: nb ? Math.round(ca / nb) : 0,
        en_attente_nb: enAttente.length,
        en_attente_montant: enAttente.reduce((s, r) => s + r.montant, 0),
      },
      par_produit: lignesProduits,
      par_categorie: Object.values(categories).sort((a, b) => b.ca - a.ca),
      par_moyen: moyens.rows,
      par_jour: parJour.rows,
      a_valider: enAttente.map((r) => ({
        id: r.id, email: r.email, montant: r.montant, moyen: r.moyen, statut: r.statut, date: r.date,
        produit: r.produit_nom || `Abonnement (${r.plan || "?"})`,
      })),
    });
  } catch (err) {
    console.error("Erreur tableau de bord ventes :", err.message);
    res.status(500).json({ error: "Erreur lors du calcul des ventes." });
  }
};
