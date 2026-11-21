// ============================================================
//  controllers/suiviCandidatureController.js
//  Suivi personnel des candidatures d'emploi (connecté requis).
//  Les noms de colonnes de la requête de modification viennent d'une
//  liste fixe (modèle) ; les valeurs sont toujours validées ici.
// ============================================================
const Suivi = require("../models/SuiviCandidature");

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const jourValide = (v) => {
  if (typeof v !== "string" || !JOUR.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const texte = (v, max) => (typeof v === "string" ? v.trim().slice(0, max + 1) : null);

/** Valide les champs reçus ; retourne { erreur } ou { donnees } (champs absents = non modifiés en PATCH). */
function valider(corps, creation) {
  const b = corps && typeof corps === "object" ? corps : {};
  const d = {};

  if (creation || "poste" in b) {
    const poste = texte(b.poste, 150);
    if (!poste || poste.length < 2 || poste.length > 150) return { erreur: "Le poste est requis (2 à 150 caractères)." };
    d.poste = poste;
  }
  if (creation || "organisme" in b) {
    const o = b.organisme === undefined || b.organisme === null || b.organisme === "" ? null : texte(b.organisme, 150);
    if (o !== null && o.length > 150) return { erreur: "Nom de l'organisme trop long (150 caractères maximum)." };
    d.organisme = o;
  }
  if (creation || "lien" in b) {
    let l = b.lien === undefined || b.lien === null || b.lien === "" ? null : texte(b.lien, 500);
    if (l !== null && (l.length > 500 || /[\s'"<>\\]/.test(l) || !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(l))) {
      return { erreur: "Lien invalide : adresse complète commençant par http:// ou https://." };
    }
    d.lien = l;
  }
  if (creation || "statut" in b) {
    const s = b.statut === undefined ? "a_envoyer" : b.statut;
    if (!Suivi.STATUTS.includes(s)) return { erreur: "Statut invalide." };
    d.statut = s;
  }
  for (const k of ["date_candidature", "relance_le"]) {
    if (creation || k in b) {
      const v = b[k] === undefined || b[k] === null || b[k] === "" ? null : b[k];
      if (v !== null && !jourValide(v)) return { erreur: "Date invalide (format AAAA-MM-JJ)." };
      d[k] = v;
    }
  }
  if (creation || "notes" in b) {
    const n = b.notes === undefined || b.notes === null || b.notes === "" ? null : texte(b.notes, 1000);
    if (n !== null && n.length > 1000) return { erreur: "Notes trop longues (1 000 caractères maximum)." };
    d.notes = n;
  }
  return { donnees: d };
}

const idValide = (v) => (/^\d{1,9}$/.test(String(v)) ? Number(v) : null);

exports.lister = async (req, res) => {
  try {
    const suivis = await Suivi.lister(req.user.id);
    res.json({ total: suivis.length, suivis });
  } catch (err) {
    console.error("Erreur liste suivi candidatures :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération de votre suivi." });
  }
};

exports.creer = async (req, res) => {
  try {
    const { erreur, donnees } = valider(req.body, true);
    if (erreur) return res.status(400).json({ error: erreur });
    if ((await Suivi.compter(req.user.id)) >= Suivi.MAX_PAR_MEMBRE) {
      return res.status(400).json({ error: `Limite de ${Suivi.MAX_PAR_MEMBRE} candidatures suivies atteinte. Supprimez les plus anciennes.` });
    }
    const suivi = await Suivi.creer(req.user.id, donnees);
    res.status(201).json({ message: "Candidature ajoutée à votre suivi.", suivi });
  } catch (err) {
    console.error("Erreur création suivi candidature :", err.message);
    res.status(500).json({ error: "Erreur lors de l'ajout au suivi." });
  }
};

exports.modifier = async (req, res) => {
  try {
    const id = idValide(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant invalide." });
    const { erreur, donnees } = valider(req.body, false);
    if (erreur) return res.status(400).json({ error: erreur });
    if (!Object.keys(donnees).length) return res.status(400).json({ error: "Aucune modification fournie." });
    const suivi = await Suivi.modifier(id, req.user.id, donnees);
    if (!suivi) return res.status(404).json({ error: "Candidature introuvable." });
    res.json({ message: "Suivi mis à jour.", suivi });
  } catch (err) {
    console.error("Erreur modification suivi candidature :", err.message);
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
};

exports.supprimer = async (req, res) => {
  try {
    const id = idValide(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant invalide." });
    const ok = await Suivi.supprimer(id, req.user.id);
    if (!ok) return res.status(404).json({ error: "Candidature introuvable." });
    res.json({ message: "Candidature retirée de votre suivi." });
  } catch (err) {
    console.error("Erreur suppression suivi candidature :", err.message);
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
};
