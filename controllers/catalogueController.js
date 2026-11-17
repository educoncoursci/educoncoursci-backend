// ============================================================
//  controllers/catalogueController.js
//  Catalogue des produits et tarifs. Le prix affiché au public — et plus
//  tard le prix facturé — vient TOUJOURS de cette table : l'administrateur
//  peut le modifier sans toucher au code.
// ============================================================

const { query } = require("../config/database");
const Journal = require("../models/Journal");
const { CATEGORIES } = require("../config/catalogueSeed");
const { nettoyerTexte } = require("../middleware/neutraliser");

const parseListe = (v) => { try { const l = JSON.parse(v || "[]"); return Array.isArray(l) ? l : []; } catch { return []; } };

function formater(row, parId) {
  const composition = parseListe(row.composition);
  let economie = null;
  if (composition.length) {
    const prix = composition.map((id) => parId[id]?.prix_fcfa);
    if (prix.every((p) => Number.isInteger(p))) {
      const somme = prix.reduce((a, b) => a + b, 0);
      if (somme > row.prix_fcfa) economie = somme - row.prix_fcfa;
    }
  }
  return {
    id: row.id,
    categorie: row.categorie,
    nom: row.nom,
    description: row.description,
    prix_fcfa: row.prix_fcfa,
    periodicite: row.periodicite,
    composition: composition.map((id) => ({ id, nom: parId[id]?.nom || id })),
    inclus: parseListe(row.inclus),
    economie_fcfa: economie,
  };
}

async function tousLesProduits() {
  const r = await query(`SELECT * FROM produits ORDER BY ordre ASC, id ASC`);
  const parId = Object.fromEntries(r.rows.map((p) => [p.id, p]));
  return { lignes: r.rows, parId };
}

// GET /api/catalogue — produits actifs, groupés par catégorie (public)
exports.catalogue = async (req, res) => {
  try {
    const { lignes, parId } = await tousLesProduits();
    const categories = CATEGORIES
      .map((c) => ({
        id: c.id,
        nom: c.nom,
        produits: lignes.filter((p) => p.categorie === c.id && p.actif).map((p) => formater(p, parId)),
      }))
      .filter((c) => c.produits.length);
    res.json({ categories });
  } catch (err) {
    console.error("Erreur catalogue :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des tarifs." });
  }
};

// GET /api/catalogue/admin/produits — tous les produits (admin)
exports.adminListe = async (req, res) => {
  try {
    const { lignes, parId } = await tousLesProduits();
    res.json({
      categories: CATEGORIES,
      produits: lignes.map((p) => ({ ...formater(p, parId), actif: p.actif === true || p.actif === 1, modifie_par_admin: p.modifie_par_admin === true || p.modifie_par_admin === 1 })),
    });
  } catch (err) {
    console.error("Erreur liste produits :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// PUT /api/catalogue/admin/produits/:id  { nom, description, prix_fcfa, actif }
exports.adminModifier = async (req, res) => {
  try {
    const existant = (await query(`SELECT * FROM produits WHERE id = $1`, [req.params.id])).rows[0];
    if (!existant) return res.status(404).json({ error: "Produit introuvable." });

    const nom = nettoyerTexte(req.body?.nom, 150);
    const description = nettoyerTexte(req.body?.description, 500);
    const prix = Number(req.body?.prix_fcfa);
    if (nom.length < 3) return res.status(400).json({ error: "Le nom du produit est requis (3 caractères minimum)." });
    if (!Number.isInteger(prix) || prix < 0 || prix > 1000000) {
      return res.status(400).json({ error: "Prix invalide : nombre entier de FCFA entre 0 et 1 000 000." });
    }
    if (typeof req.body?.actif !== "boolean") return res.status(400).json({ error: "Indique si le produit est actif (true/false)." });

    await query(
      `UPDATE produits SET nom=$1, description=$2, prix_fcfa=$3, actif=$4, modifie_par_admin=TRUE, updated_at=NOW() WHERE id=$5`,
      [nom, description, prix, req.body.actif, existant.id],
    );
    Journal.enregistrer(req.user.id, req.user.nom, "modification", "tarif", null,
      `${existant.id} : ${existant.prix_fcfa} → ${prix} FCFA${req.body.actif ? "" : " (désactivé)"}`);
    res.json({ message: "Produit mis à jour." });
  } catch (err) {
    console.error("Erreur modification produit :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
