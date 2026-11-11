// ============================================================
//  controllers/recruteursController.js
//  Espace recruteurs : une entreprise INSCRITE soumet une offre, l'admin
//  l'étudie, convient du tarif avec elle, puis la publie (elle devient
//  alors une offre normale du module emploi).
//
//  Aucun paiement n'est automatisé à ce stade : la publication est
//  payante mais négociée et encaissée hors site (Wave / Orange Money) ;
//  l'admin enregistre ici le tarif et l'encaissement pour suivre ses revenus.
// ============================================================

const { query } = require("../config/database");
const Emploi = require("../models/Emploi");
const Journal = require("../models/Journal");
const Email = require("../services/email");
const { extraireDateLimite } = require("../utils/dateLimite");
const { emailValide, nomValide, nettoyerTexte } = require("../middleware/neutraliser");
const { urlSure } = require("../services/nettoyageFlux");

const TYPES_CONTRAT = ["CDI", "CDD", "Stage", "Freelance", "Alternance"];
const MAX_SOUMISSIONS_PAR_JOUR = 5;
const DESCRIPTION_MIN = 50;

// ── Utilitaires ─────────────────────────────────────────────
const echapper = (v) => String(v ?? "").replace(/[&<>"'`]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]
));

// E-mails envoyés « en silence » : un échec d'envoi ne doit jamais bloquer l'action.
function envoyerEnSilence(to, subject, html, contexte) {
  if (!to) return;
  Promise.resolve(Email.envoyer({ to, subject, text: html })).catch((err) => {
    console.error(`E-mail non envoyé (${contexte}) :`, err.message);
  });
}

const typeOpportunite = (typeContrat) =>
  ({ Stage: "stage", Alternance: "alternance", Freelance: "freelance" }[typeContrat] || "emploi");

// Valide et nettoie les champs d'une offre. Renvoie { erreur } ou { champs }.
function validerOffre(body) {
  const b = body || {};
  const entreprise = nettoyerTexte(b.entreprise, 150);
  const titre = nettoyerTexte(b.titre, 200);
  const description = nettoyerTexte(b.description, 5000);
  const candidature = String(b.candidature ?? "").trim().slice(0, 300);
  const telephone = String(b.contact_telephone ?? "").trim();

  if (entreprise.length < 2) return { erreur: "Le nom de l'entreprise est requis." };
  if (!nomValide(String(b.contact_nom ?? ""))) return { erreur: "Nom du contact invalide (lettres, espaces, tirets, apostrophes)." };
  if (!emailValide(b.contact_email)) return { erreur: "Adresse e-mail du contact invalide." };
  if (telephone && !/^[0-9+ ().\-]{6,25}$/.test(telephone)) return { erreur: "Numéro de téléphone invalide." };
  if (titre.length < 5) return { erreur: "L'intitulé du poste est requis (5 caractères minimum)." };
  if (!TYPES_CONTRAT.includes(b.type_contrat)) return { erreur: "Type de contrat invalide." };
  if (description.length < DESCRIPTION_MIN) {
    return { erreur: `La description doit contenir au moins ${DESCRIPTION_MIN} caractères.` };
  }
  if (!emailValide(candidature) && !urlSure(candidature)) {
    return { erreur: "Indique une adresse e-mail ou un lien (https://…) pour recevoir les candidatures." };
  }
  return {
    champs: {
      entreprise,
      contact_nom: String(b.contact_nom).trim(),
      contact_email: String(b.contact_email).trim(),
      contact_telephone: telephone || null,
      titre,
      type_contrat: b.type_contrat,
      ville: nettoyerTexte(b.ville, 100) || "Abidjan",
      secteur: nettoyerTexte(b.secteur, 100) || null,
      description,
      profil_recherche: nettoyerTexte(b.profil_recherche, 3000) || null,
      salaire: nettoyerTexte(b.salaire, 100) || null,
      date_limite: nettoyerTexte(b.date_limite, 100) || null,
      candidature,
    },
  };
}

// ════════════════════════════════════════════════════════════
//  ENTREPRISE (utilisateur inscrit)
// ════════════════════════════════════════════════════════════

// POST /api/recruteurs/offres
exports.soumettre = async (req, res) => {
  try {
    const { erreur, champs } = validerOffre(req.body);
    if (erreur) return res.status(400).json({ error: erreur });

    const jour = await query(
      `SELECT COUNT(*) FROM offres_soumises WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
      [req.user.id],
    );
    if (parseInt(jour.rows[0].count, 10) >= MAX_SOUMISSIONS_PAR_JOUR) {
      return res.status(429).json({ error: `Limite de ${MAX_SOUMISSIONS_PAR_JOUR} demandes par jour atteinte.` });
    }

    const r = await query(
      `INSERT INTO offres_soumises
         (user_id, entreprise, contact_nom, contact_email, contact_telephone, titre, type_contrat,
          ville, secteur, description, profil_recherche, salaire, date_limite, candidature)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [req.user.id, champs.entreprise, champs.contact_nom, champs.contact_email, champs.contact_telephone,
       champs.titre, champs.type_contrat, champs.ville, champs.secteur, champs.description,
       champs.profil_recherche, champs.salaire, champs.date_limite, champs.candidature],
    );
    const id = r.rows[0].id;

    const lienAdmin = `${process.env.FRONTEND_URL || ""}/admin/offres-soumises.html`;
    envoyerEnSilence(
      process.env.ADMIN_EMAIL,
      `📩 Nouvelle offre à étudier — ${champs.entreprise}`,
      `Une entreprise demande la publication d'une offre.<br><br>` +
      `<strong>Entreprise :</strong> ${echapper(champs.entreprise)}<br>` +
      `<strong>Poste :</strong> ${echapper(champs.titre)} (${echapper(champs.type_contrat)})<br>` +
      `<strong>Contact :</strong> ${echapper(champs.contact_nom)} — ${echapper(champs.contact_email)}` +
      `${champs.contact_telephone ? " — " + echapper(champs.contact_telephone) : ""}<br><br>` +
      `À étudier ici : <a href="${echapper(lienAdmin)}">${echapper(lienAdmin)}</a>`,
      "alerte admin offre soumise",
    );
    envoyerEnSilence(
      champs.contact_email,
      "Ta demande de publication a bien été reçue",
      `Bonjour ${echapper(champs.contact_nom)},<br><br>` +
      `Nous avons bien reçu ta demande pour le poste « ${echapper(champs.titre)} ». ` +
      `Nous l'étudions et nous te recontactons rapidement pour les conditions de publication ` +
      `(la publication des offres est payante). Tu peux suivre l'état de ta demande depuis ton compte.`,
      "accusé de réception entreprise",
    );

    Journal.enregistrer(req.user.id, req.user.nom, "soumission", "offre", id,
      `${champs.entreprise} — ${champs.titre}`);
    res.status(201).json({ message: "Demande envoyée. Nous te recontactons rapidement.", id });
  } catch (err) {
    console.error("Erreur soumission offre :", err.message);
    res.status(500).json({ error: "Erreur lors de l'envoi de la demande." });
  }
};

// GET /api/recruteurs/mes-offres
exports.mesOffres = async (req, res) => {
  try {
    const r = await query(
      `SELECT id, entreprise, titre, type_contrat, statut, motif_refus, offre_id, created_at
       FROM offres_soumises WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.id],
    );
    res.json({ offres: r.rows });
  } catch (err) {
    console.error("Erreur mes offres :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// ════════════════════════════════════════════════════════════
//  ADMIN
// ════════════════════════════════════════════════════════════

// GET /api/recruteurs/admin/stats
exports.adminStats = async (req, res) => {
  try {
    const r = await query(
      `SELECT
         COUNT(*) FILTER (WHERE statut = 'en_attente') AS en_attente,
         COUNT(*) FILTER (WHERE statut = 'acceptee')   AS acceptees,
         COUNT(*) FILTER (WHERE statut = 'refusee')    AS refusees,
         COALESCE(SUM(tarif_fcfa) FILTER (WHERE paye), 0) AS encaisse,
         COALESCE(SUM(tarif_fcfa) FILTER (WHERE statut = 'acceptee' AND NOT paye), 0) AS a_encaisser
       FROM offres_soumises`,
    );
    const x = r.rows[0];
    const n = (v) => parseInt(v, 10) || 0;
    res.json({
      en_attente: n(x.en_attente), acceptees: n(x.acceptees), refusees: n(x.refusees),
      encaisse_fcfa: n(x.encaisse), a_encaisser_fcfa: n(x.a_encaisser),
    });
  } catch (err) {
    console.error("Erreur stats recruteurs :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// GET /api/recruteurs/admin/offres?statut=en_attente
exports.adminListe = async (req, res) => {
  try {
    const statut = ["en_attente", "acceptee", "refusee"].includes(req.query?.statut) ? req.query.statut : null;
    const r = statut
      ? await query(`SELECT * FROM offres_soumises WHERE statut = $1 ORDER BY created_at DESC LIMIT 200`, [statut])
      : await query(`SELECT * FROM offres_soumises ORDER BY created_at DESC LIMIT 200`);
    res.json({ offres: r.rows });
  } catch (err) {
    console.error("Erreur liste offres soumises :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

async function charger(id) {
  return (await query(`SELECT * FROM offres_soumises WHERE id = $1`, [id])).rows[0] || null;
}

// GET /api/recruteurs/admin/offres/:id
exports.adminDetail = async (req, res) => {
  try {
    const o = await charger(req.params.id);
    if (!o) return res.status(404).json({ error: "Demande introuvable." });
    res.json({ offre: o });
  } catch (err) {
    console.error("Erreur détail offre soumise :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// PUT /api/recruteurs/admin/offres/:id — corriger le texte avant publication
exports.adminModifier = async (req, res) => {
  try {
    const o = await charger(req.params.id);
    if (!o) return res.status(404).json({ error: "Demande introuvable." });
    if (o.statut !== "en_attente") return res.status(409).json({ error: "Cette demande a déjà été traitée." });
    const { erreur, champs } = validerOffre(req.body);
    if (erreur) return res.status(400).json({ error: erreur });
    await query(
      `UPDATE offres_soumises SET entreprise=$1, contact_nom=$2, contact_email=$3, contact_telephone=$4,
         titre=$5, type_contrat=$6, ville=$7, secteur=$8, description=$9, profil_recherche=$10,
         salaire=$11, date_limite=$12, candidature=$13 WHERE id=$14`,
      [champs.entreprise, champs.contact_nom, champs.contact_email, champs.contact_telephone, champs.titre,
       champs.type_contrat, champs.ville, champs.secteur, champs.description, champs.profil_recherche,
       champs.salaire, champs.date_limite, champs.candidature, o.id],
    );
    res.json({ message: "Demande mise à jour.", offre: await charger(o.id) });
  } catch (err) {
    console.error("Erreur modification offre soumise :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

function lireTarif(valeur) {
  if (valeur === undefined || valeur === null || valeur === "") return { tarif: null };
  const n = Number(valeur);
  if (!Number.isInteger(n) || n < 0 || n > 10000000) return { erreur: "Tarif invalide (nombre entier de FCFA)." };
  return { tarif: n };
}

// POST /api/recruteurs/admin/offres/:id/accepter  { tarif_fcfa?, paye? }
exports.adminAccepter = async (req, res) => {
  try {
    const o = await charger(req.params.id);
    if (!o) return res.status(404).json({ error: "Demande introuvable." });
    if (o.statut === "acceptee") return res.status(409).json({ error: "Cette offre est déjà publiée." });
    const { tarif, erreur } = lireTarif(req.body?.tarif_fcfa);
    if (erreur) return res.status(400).json({ error: erreur });
    const paye = req.body?.paye === true;

    const candidatureEstEmail = emailValide(o.candidature);
    const offre = await Emploi.create({
      titre: o.titre,
      entreprise: o.entreprise,
      typeContrat: o.type_contrat,
      typeOpportunite: typeOpportunite(o.type_contrat),
      ville: o.ville,
      secteur: o.secteur,
      description: o.description,
      profilRecherche: o.profil_recherche,
      salaire: o.salaire,
      experience: null,
      niveauEtudes: null,
      dateLimite: o.date_limite,
      dateLimiteDate: o.date_limite ? extraireDateLimite(o.date_limite) : null,
      emailContact: candidatureEstEmail ? o.candidature : null,
      lienExterne: candidatureEstEmail ? null : o.candidature,
      statut: "publié",
      sourceNom: "Entreprise partenaire",
    });

    await query(
      `UPDATE offres_soumises SET statut='acceptee', offre_id=$1, tarif_fcfa=$2, paye=$3,
         motif_refus=NULL, traitee_le=NOW() WHERE id=$4`,
      [offre.id, tarif, paye, o.id],
    );
    Journal.enregistrer(req.user.id, req.user.nom, "publication", "offre", offre.id,
      `${o.entreprise} — ${o.titre}${tarif ? ` — ${tarif} FCFA` : ""}`);

    const lien = `${process.env.FRONTEND_URL || ""}/emploi.html`;
    envoyerEnSilence(
      o.contact_email,
      "Ton offre est publiée sur EduConcoursCI",
      `Bonjour ${echapper(o.contact_nom)},<br><br>` +
      `Ton offre « ${echapper(o.titre)} » est maintenant publiée. ` +
      `Tu peux la retrouver ici : <a href="${echapper(lien)}">${echapper(lien)}</a>.<br><br>Merci de ta confiance !`,
      "offre publiée",
    );
    res.json({ message: "Offre publiée.", offre_id: offre.id });
  } catch (err) {
    console.error("Erreur acceptation offre :", err.message);
    res.status(500).json({ error: "Erreur lors de la publication." });
  }
};

// POST /api/recruteurs/admin/offres/:id/refuser  { motif }
exports.adminRefuser = async (req, res) => {
  try {
    const o = await charger(req.params.id);
    if (!o) return res.status(404).json({ error: "Demande introuvable." });
    if (o.statut === "acceptee") return res.status(409).json({ error: "Cette offre est déjà publiée." });
    const motif = nettoyerTexte(req.body?.motif, 500);
    if (motif.length < 3) return res.status(400).json({ error: "Indique un motif de refus." });

    await query(
      `UPDATE offres_soumises SET statut='refusee', motif_refus=$1, traitee_le=NOW() WHERE id=$2`,
      [motif, o.id],
    );
    Journal.enregistrer(req.user.id, req.user.nom, "refus", "offre", o.id, `${o.entreprise} — ${o.titre}`);
    envoyerEnSilence(
      o.contact_email,
      "À propos de ta demande de publication",
      `Bonjour ${echapper(o.contact_nom)},<br><br>` +
      `Nous ne pouvons pas publier l'offre « ${echapper(o.titre)} » pour le moment.<br>` +
      `<strong>Motif :</strong> ${echapper(motif)}<br><br>` +
      `Tu peux soumettre une nouvelle demande corrigée depuis ton compte.`,
      "offre refusée",
    );
    res.json({ message: "Demande refusée." });
  } catch (err) {
    console.error("Erreur refus offre :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// PATCH /api/recruteurs/admin/offres/:id/paiement  { tarif_fcfa?, paye }
exports.adminPaiement = async (req, res) => {
  try {
    const o = await charger(req.params.id);
    if (!o) return res.status(404).json({ error: "Demande introuvable." });
    const { tarif, erreur } = lireTarif(req.body?.tarif_fcfa);
    if (erreur) return res.status(400).json({ error: erreur });
    if (typeof req.body?.paye !== "boolean") return res.status(400).json({ error: "Indique si le paiement est reçu (paye: true/false)." });
    await query(`UPDATE offres_soumises SET tarif_fcfa=$1, paye=$2 WHERE id=$3`, [tarif, req.body.paye, o.id]);
    Journal.enregistrer(req.user.id, req.user.nom, "paiement", "offre", o.id,
      `${o.entreprise} — ${tarif ?? 0} FCFA — ${req.body.paye ? "encaissé" : "non encaissé"}`);
    res.json({ message: "Paiement enregistré." });
  } catch (err) {
    console.error("Erreur paiement offre :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
