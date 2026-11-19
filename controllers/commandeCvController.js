// ============================================================
//  controllers/commandeCvController.js
//  CV et lettres de motivation vendus à l'acte :
//   1. le CV est généré et stocké côté serveur ;
//   2. le client ne voit qu'un aperçu partiel (le reste est brouillé
//      CÔTÉ SERVEUR : le vrai texte n'est jamais envoyé) ;
//   3. il paie par Wave / Orange Money et saisit son identifiant de
//      transaction (usage unique) ;
//   4. l'admin valide le paiement → le PDF devient téléchargeable.
//  La source de vérité du paiement est la transaction liée : la commande
//  est « payée » si et seulement si cette transaction est « validé ».
// ============================================================

const { query } = require("../config/database");
const { genererCV, genererLM, genererRedaction, genererQuestionsEntretien, analyserEntretien } = require("../services/claude");
const { genererCVStructure, genererPDFTexte, supprimerFichier } = require("../services/pdf");
const { obtenirModele, MODELES_CV, PALETTES_DESIGN } = require("../config/modelesCv");
const { genererCVDesign, lirePhoto } = require("../services/cvDesign");
const { TYPES_CV, TYPES_LM } = require("../config/typesCv");

const { TYPES_REDACTION, estRedaction, champsRequis, tousLesChamps, listerPourClient } = require("../config/typesRedaction");

const { PACKS, estPack } = require("../config/packs");

const ID_SIMULATION = "entretien-simulation";
const NB_QUESTIONS = 8;

const estLettre = (id) => Object.prototype.hasOwnProperty.call(TYPES_LM, id);
const Transaction = require("../models/Transaction");
const Journal = require("../models/Journal");
const Wave = require("../services/wave");
const Orange = require("../services/orange");
const Email = require("../services/email");

const MAX_LIGNES_LISTE = 15;
const PART_VISIBLE = 0.3; // proportion du texte montrée en clair

const SERVICES = { wave: Wave, orange: Orange };
const LABELS = { wave: "Wave", orange: "Orange Money" };
const EXEMPLES = { wave: "T_5L7D2SFHD3VMTIPJ", orange: "987654321" };

function echapper(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function enSilence(promesse, contexte) {
  Promise.resolve(promesse).catch((e) => console.error(`E-mail non envoyé (${contexte}) :`, e.message));
}

// ── Aperçu partiel : début en clair, suite brouillée ────────────
// Le texte caché est remplacé par des caractères aléatoires de même
// forme (espaces, ponctuation et longueur des mots conservés) : le
// rendu flouté ressemble à du texte, mais rien de réel ne quitte le
// serveur.
function brouiller(texte) {
  return texte.replace(/[A-Za-zÀ-ÿ]/g, (c) => {
    const lettres = c === c.toUpperCase() ? "ABCDEFGHIJKLMNOPRSTUV" : "abcdeghilmnoprstuv";
    return lettres[Math.floor(Math.random() * lettres.length)];
  }).replace(/[0-9]/g, () => String(Math.floor(Math.random() * 10)));
}

function construireApercu(contenu) {
  const lignes = String(contenu || "").split("\n");
  const total = lignes.join("\n").length;
  const limite = Math.max(120, Math.floor(total * PART_VISIBLE));
  let cumul = 0;
  let coupe = 0;
  for (; coupe < lignes.length; coupe++) {
    if (cumul + lignes[coupe].length > limite && coupe > 0) break;
    cumul += lignes[coupe].length + 1;
  }
  const visible = lignes.slice(0, coupe).join("\n");
  const cache = brouiller(lignes.slice(coupe).join("\n")).slice(0, 900);
  return { visible, flou: cache };
}

// GET /api/cv/redaction/types — champs de saisie des courriers et documents (public)
exports.typesRedaction = (req, res) => res.json({ types: listerPourClient() });

// ── Lecture d'une commande avec l'état de son paiement ──────────
async function chargerCommande(id, userId) {
  const r = await query(
    `SELECT c.*, t.statut AS tx_statut, t.moyen AS tx_moyen,
            p.nom AS produit_nom, COALESCE(pk.prix_fcfa, p.prix_fcfa) AS prix_fcfa,
            pk.nom AS pack_nom, p.actif AS produit_actif
     FROM commandes_cv c
     LEFT JOIN transactions t ON t.id = c.transaction_id
     LEFT JOIN produits p ON p.id = c.produit_id
     LEFT JOIN produits pk ON pk.id = c.pack_id
     WHERE c.id = $1 AND c.user_id = $2`,
    [id, userId],
  );
  return r.rows[0] || null;
}

function etatPaiement(c) {
  if (!c.transaction_id) return "a_payer";
  if (c.tx_statut === "validé") return "valide";
  if (c.tx_statut === "échoué") return "rejete";
  return "en_verification"; // « en attente » ou « à vérifier »
}

function nomAffiche(c) {
  const base = c.produit_nom || TYPES_REDACTION[c.produit_id]?.titre || c.produit_id;
  return c.pack_nom ? `${c.pack_nom} · ${base}` : base;
}


// Choix de présentation du CV : modèle « design » et photo (facultative).
// Ni l'un ni l'autre ne passent par l'IA ; on ne garde que des valeurs valides.
function nettoyerChoixDesign(donnees) {
  const id = String(donnees.modele || "");
  if (MODELES_CV[id]?.design) donnees.modele = id; else delete donnees.modele;
  // Couleur choisie (s'applique aussi à la présentation sobre) : cohérente avec le modèle design s'il y en a un
  const pal = String(donnees.palette || "");
  if (donnees.modele) donnees.palette = MODELES_CV[donnees.modele].palette;
  else if (PALETTES_DESIGN[pal]) donnees.palette = pal;
  else delete donnees.palette;
  if (donnees.photo && lirePhoto(donnees.photo)) donnees.photo = String(donnees.photo).trim(); else delete donnees.photo;
  return donnees;
}

function vueCommande(c) {
  const etat = etatPaiement(c);
  const vue = {
    id: c.id,
    type: c.produit_id,
    nom: nomAffiche(c),
    groupe_id: c.groupe_id || null,
    pack: c.pack_nom || null,
    etat,
    prix_fcfa: c.prix_fcfa,
    date: c.created_at,
    paiement: {
      wave_numero: process.env.WAVE_NUMERO || null,
      orange_numero: process.env.OM_NUMERO || null,
    },
  };
  if (etat === "valide") {
    vue.contenu = c.contenu;
    if (c.produit_id === ID_SIMULATION) {
      try { vue.questions = JSON.parse(c.donnees).questions || []; } catch { vue.questions = []; }
      try { vue.resultat = c.resultat ? JSON.parse(c.resultat) : null; } catch { vue.resultat = null; }
    }
  } else {
    vue.apercu = construireApercu(c.contenu);
  }
  return vue;
}

// ════════════════════════════════════════════════════════════
//  POST /api/cv/commande — génère et enregistre le CV
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
  try {
    const { type, ...donnees } = req.body || {};
    nettoyerChoixDesign(donnees);
    const lettre = estLettre(type);
    const redaction = estRedaction(type);
    const def = redaction ? TYPES_REDACTION[type] : lettre ? TYPES_LM[type] : TYPES_CV[type];
    if (!def) return res.status(400).json({ error: "Type de document invalide." });

    const produit = (await query(`SELECT * FROM produits WHERE id = $1 AND actif = TRUE`, [type])).rows[0];
    if (!produit) return res.status(400).json({ error: "Ce document n'est pas disponible pour le moment." });

    let contenu;
    if (redaction) {
      const manquants = champsRequis(type).filter((c) => !String(donnees[c.id] || "").trim());
      if (manquants.length) {
        return res.status(400).json({ error: `Champs requis manquants : ${manquants.map((c) => c.label).join(", ")}.` });
      }
      contenu = await genererRedaction(def, donnees, tousLesChamps(type));
    } else if (lettre) {
      if (!donnees.nom || !donnees.poste || !donnees.organisation) {
        return res.status(400).json({ error: "Le nom, le poste visé et l'organisation sont requis." });
      }
      if (!donnees.motivation) {
        return res.status(400).json({ error: "La motivation principale est requise." });
      }
      donnees.type = def.spontanee ? "spontanee" : "candidature";
      contenu = await genererLM(donnees, { consigne: def.consigne, tokens: def.tokens });
    } else {
      if (!donnees.nom || !donnees.poste) {
        return res.status(400).json({ error: "Le nom complet et le poste recherché sont requis." });
      }
      if (!Array.isArray(donnees.experiences) || !Array.isArray(donnees.formations)) {
        return res.status(400).json({ error: "Les expériences et les formations sont requises." });
      }
      donnees.experiences = donnees.experiences.slice(0, MAX_LIGNES_LISTE);
      donnees.formations = donnees.formations.slice(0, MAX_LIGNES_LISTE);
      contenu = await genererCV(donnees, { consigne: def.consigne, tokens: def.tokens });
    }
    if (!contenu) return res.status(500).json({ error: "La rédaction a échoué. Réessayez dans quelques secondes." });

    const ins = await query(
      `INSERT INTO commandes_cv (user_id, produit_id, donnees, contenu) VALUES ($1,$2,$3,$4) RETURNING id`,
      [req.user.id, type, JSON.stringify(donnees), contenu],
    );
    const commande = await chargerCommande(ins.rows[0].id, req.user.id);
    res.status(201).json({ commande: vueCommande(commande) });
  } catch (err) {
    console.error("Erreur création commande CV :", err.message);
    if (String(err.message).includes("API")) {
      return res.status(503).json({ error: "Service temporairement indisponible. Réessayez dans quelques instants." });
    }
    res.status(500).json({ error: "Erreur lors de la création du document." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/cv/commande/pack — génère tous les documents d'un pack
//  (un seul paiement pour l'ensemble)
// ════════════════════════════════════════════════════════════
exports.creerPack = async (req, res) => {
  try {
    const { pack, ...donnees } = req.body || {};
    nettoyerChoixDesign(donnees);
    if (!estPack(pack)) return res.status(400).json({ error: "Pack invalide." });
    const produit = (await query(`SELECT * FROM produits WHERE id = $1 AND actif = TRUE`, [pack])).rows[0];
    if (!produit) return res.status(400).json({ error: "Ce pack n'est pas disponible pour le moment." });

    const elements = PACKS[pack].elements;
    const avecLettre = elements.some(estLettre);
    const avecEntretien = elements.includes(ID_SIMULATION);
    if (!donnees.nom || !donnees.poste) return res.status(400).json({ error: "Le nom complet et le poste recherché sont requis." });
    if (!avecEntretien) {
      if (!Array.isArray(donnees.experiences) || !Array.isArray(donnees.formations)) {
        return res.status(400).json({ error: "Les expériences et les formations sont requises." });
      }
      if (avecLettre && (!donnees.organisation || !donnees.motivation)) {
        return res.status(400).json({ error: "L'organisation visée et votre motivation sont requises pour les lettres du pack." });
      }
      donnees.experiences = donnees.experiences.slice(0, MAX_LIGNES_LISTE);
      donnees.formations = donnees.formations.slice(0, MAX_LIGNES_LISTE);
    } else if (!donnees.profil) {
      return res.status(400).json({ error: "Décrivez votre profil (formation, expériences, atouts) pour personnaliser l'entretien." });
    }

    const champsBonus = [{ id: "inquietudes", label: "Inquiétudes" }, { id: "organisation", label: "Organisation" }, { id: "nom", label: "Nom" }, { id: "poste", label: "Poste recherché" }, { id: "profil", label: "Profil" }, { id: "competences", label: "Compétences" }, { id: "langues", label: "Langues" }];
    const contenus = await Promise.all(elements.map((el) => {
      if (TYPES_CV[el]) return genererCV(donnees, { consigne: TYPES_CV[el].consigne, tokens: TYPES_CV[el].tokens });
      if (TYPES_LM[el]) return genererLM({ ...donnees, type: TYPES_LM[el].spontanee ? "spontanee" : "candidature" }, { consigne: TYPES_LM[el].consigne, tokens: TYPES_LM[el].tokens });
      if (el === ID_SIMULATION) return genererQuestionsEntretien(donnees, NB_QUESTIONS);
      return genererRedaction(TYPES_REDACTION[el], donnees, champsBonus);
    }));
    if (contenus.some((c) => !c)) return res.status(500).json({ error: "La rédaction a échoué. Réessayez dans quelques secondes." });

    let groupe = null;
    const ids = [];
    for (let i = 0; i < elements.length; i++) {
      let donneesLigne = donnees;
      let contenu = contenus[i];
      if (elements[i] === ID_SIMULATION) {
        // contenus[i] est la liste de questions : on la range dans les données et on bâtit le texte d'aperçu
        donneesLigne = { ...donnees, questions: contenus[i] };
        contenu = contenus[i].map((q, k) => `Question ${k + 1}\n${q}`).join("\n\n");
      }
      const ins = await query(
        `INSERT INTO commandes_cv (user_id, produit_id, donnees, contenu, pack_id, groupe_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [req.user.id, elements[i], JSON.stringify(donneesLigne), contenu, pack, groupe],
      );
      const id = ins.rows[0].id;
      if (groupe === null) { groupe = id; await query(`UPDATE commandes_cv SET groupe_id = $1 WHERE id = $1`, [id]); }
      ids.push(id);
    }
    const documents = [];
    for (const id of ids) documents.push(vueCommande(await chargerCommande(id, req.user.id)));
    res.status(201).json({ groupe_id: groupe, pack: produit.nom, documents });
  } catch (err) {
    console.error("Erreur création pack :", err.message);
    if (String(err.message).includes("API")) return res.status(503).json({ error: "Service temporairement indisponible. Réessayez dans quelques instants." });
    res.status(500).json({ error: "Erreur lors de la création du pack." });
  }
};

// GET /api/cv/commande/pack/:gid — documents d'un pack
exports.lirePack = async (req, res) => {
  try {
    const gid = parseInt(req.params.gid, 10) || 0;
    const r = await query(`SELECT id FROM commandes_cv WHERE groupe_id = $1 AND user_id = $2 ORDER BY id`, [gid, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Pack introuvable." });
    const documents = [];
    for (const row of r.rows) documents.push(vueCommande(await chargerCommande(row.id, req.user.id)));
    res.json({ groupe_id: gid, pack: documents[0].pack, documents });
  } catch (err) {
    console.error("Erreur lecture pack :", err.message);
    res.status(500).json({ error: "Erreur lors de la lecture du pack." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/cv/commande/simulation — génère les questions
//  (les questions suivantes sont masquées tant que le paiement n'est
//  pas validé ; l'analyse des réponses n'a lieu qu'après paiement)
// ════════════════════════════════════════════════════════════
exports.creerSimulation = async (req, res) => {
  try {
    const donnees = { ...(req.body || {}) };
    delete donnees.type;
    if (!donnees.nom || !donnees.poste) return res.status(400).json({ error: "Votre nom et le poste visé sont requis." });
    const produit = (await query(`SELECT * FROM produits WHERE id = $1 AND actif = TRUE`, [ID_SIMULATION])).rows[0];
    if (!produit) return res.status(400).json({ error: "La simulation n'est pas disponible pour le moment." });

    const questions = await genererQuestionsEntretien(donnees, NB_QUESTIONS);
    if (!questions) return res.status(500).json({ error: "La préparation de l'entretien a échoué. Réessayez dans quelques secondes." });
    donnees.questions = questions;
    const contenu = questions.map((q, i) => `Question ${i + 1}\n${q}`).join("\n\n");

    const ins = await query(
      `INSERT INTO commandes_cv (user_id, produit_id, donnees, contenu) VALUES ($1,$2,$3,$4) RETURNING id`,
      [req.user.id, ID_SIMULATION, JSON.stringify(donnees), contenu],
    );
    res.status(201).json({ commande: vueCommande(await chargerCommande(ins.rows[0].id, req.user.id)) });
  } catch (err) {
    console.error("Erreur création simulation :", err.message);
    if (String(err.message).includes("API")) return res.status(503).json({ error: "Service temporairement indisponible. Réessayez dans quelques instants." });
    res.status(500).json({ error: "Erreur lors de la préparation de la simulation." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/cv/commande/:id/repondre — analyse des réponses (payée)
// ════════════════════════════════════════════════════════════
exports.repondre = async (req, res) => {
  try {
    const c = await chargerCommande(parseInt(req.params.id, 10) || 0, req.user.id);
    if (!c || c.produit_id !== ID_SIMULATION) return res.status(404).json({ error: "Simulation introuvable." });
    if (etatPaiement(c) !== "valide") return res.status(402).json({ error: "La simulation sera disponible après validation de votre paiement." });
    if (c.resultat) return res.status(409).json({ error: "Cette simulation a déjà été analysée." });

    const donnees = JSON.parse(c.donnees);
    const questions = donnees.questions || [];
    const reponses = Array.isArray(req.body?.reponses) ? req.body.reponses.slice(0, questions.length).map((r) => String(r || "").trim().slice(0, 2000)) : [];
    if (!reponses.some((r) => r.length > 0)) return res.status(400).json({ error: "Répondez à au moins une question." });
    while (reponses.length < questions.length) reponses.push("");

    const resultat = await analyserEntretien(donnees, questions, reponses);
    if (!resultat) return res.status(500).json({ error: "L'analyse a échoué. Réessayez dans quelques secondes." });
    // Une seule analyse enregistrée par simulation, même en cas de double envoi simultané
    const maj = await query(`UPDATE commandes_cv SET reponses = $1, resultat = $2 WHERE id = $3 AND resultat IS NULL RETURNING id`, [JSON.stringify(reponses), JSON.stringify(resultat), c.id]);
    if (!maj.rows.length) return res.status(409).json({ error: "Cette simulation a déjà été analysée." });
    res.json({ commande: vueCommande(await chargerCommande(c.id, req.user.id)) });
  } catch (err) {
    console.error("Erreur analyse simulation :", err.message);
    res.status(500).json({ error: "Erreur lors de l'analyse de vos réponses." });
  }
};

function rapportEntretien(c) {
  const d = JSON.parse(c.donnees);
  const r = JSON.parse(c.resultat);
  const L = [];
  L.push(`RAPPORT DE SIMULATION D'ENTRETIEN`, "", `Candidat : ${d.nom}`, `Poste visé : ${d.poste}`);
  if (d.organisation) L.push(`Organisation : ${d.organisation}`);
  L.push("", `NOTE GLOBALE : ${r.note} / 100`, "", r.conclusion || "");
  if (r.pointsForts?.length) { L.push("", "POINTS FORTS"); r.pointsForts.forEach((p) => L.push(`- ${p}`)); }
  if (r.axesAmelioration?.length) { L.push("", "AXES D'AMÉLIORATION"); r.axesAmelioration.forEach((p) => L.push(`- ${p}`)); }
  L.push("", "DÉTAIL PAR QUESTION");
  const reps = c.reponses ? JSON.parse(c.reponses) : [];
  (d.questions || []).forEach((q, i) => {
    L.push("", `Question ${i + 1} (${r.questions[i]?.note ?? 0}/10) : ${q}`, `Votre réponse : ${reps[i] || "(pas de réponse)"}`,
      `Analyse : ${r.questions[i]?.commentaire || ""}`, `Pour progresser : ${r.questions[i]?.amelioration || ""}`);
  });
  return L.join("\n");
}

// ════════════════════════════════════════════════════════════
//  GET /api/cv/commande — mes CV commandés
// ════════════════════════════════════════════════════════════
exports.lister = async (req, res) => {
  try {
    const r = await query(
      `SELECT c.id, c.produit_id, c.created_at, c.transaction_id, t.statut AS tx_statut,
              p.nom AS produit_nom, COALESCE(pk.prix_fcfa, p.prix_fcfa) AS prix_fcfa, pk.nom AS pack_nom
       FROM commandes_cv c
       LEFT JOIN transactions t ON t.id = c.transaction_id
       LEFT JOIN produits p ON p.id = c.produit_id
       LEFT JOIN produits pk ON pk.id = c.pack_id
       WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT 50`,
      [req.user.id],
    );
    res.json({
      commandes: r.rows.map((c) => ({
        id: c.id, type: c.produit_id, nom: nomAffiche(c),
        prix_fcfa: c.prix_fcfa, date: c.created_at, etat: etatPaiement(c),
      })),
    });
  } catch (err) {
    console.error("Erreur liste commandes CV :", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération de vos CV." });
  }
};

// ════════════════════════════════════════════════════════════
//  GET /api/cv/commande/:id
// ════════════════════════════════════════════════════════════
exports.lire = async (req, res) => {
  try {
    const c = await chargerCommande(parseInt(req.params.id, 10) || 0, req.user.id);
    if (!c) return res.status(404).json({ error: "Document introuvable." });
    res.json({ commande: vueCommande(c) });
  } catch (err) {
    console.error("Erreur lecture commande CV :", err.message);
    res.status(500).json({ error: "Erreur lors de la lecture du document." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/cv/commande/:id/payer — identifiant de transaction
// ════════════════════════════════════════════════════════════
exports.payer = async (req, res) => {
  try {
    const { moyen, txId } = req.body || {};
    const service = SERVICES[moyen];
    if (!service) return res.status(400).json({ error: "Moyen de paiement invalide (Wave ou Orange Money)." });
    if (!txId || typeof txId !== "string") return res.status(400).json({ error: "L'identifiant de transaction est requis." });

    const c = await chargerCommande(parseInt(req.params.id, 10) || 0, req.user.id);
    if (!c) return res.status(404).json({ error: "Document introuvable." });

    const etat = etatPaiement(c);
    if (etat === "valide") return res.status(409).json({ error: "Ce document est déjà payé." });
    if (etat === "en_verification") return res.status(409).json({ error: "Votre paiement est déjà en cours de vérification." });
    if (!Number.isInteger(c.prix_fcfa)) return res.status(400).json({ error: "Tarif indisponible pour ce document." });

    const txNormalise = service.normaliserTxId(txId);
    if (!service.validerFormatId(txNormalise)) {
      return res.status(400).json({
        error: `Format d'identifiant invalide pour ${LABELS[moyen]}. Exemple attendu : ${EXEMPLES[moyen]}`,
      });
    }
    if (await Transaction.txIdDejaUtilise(txNormalise)) {
      return res.status(409).json({ error: "Cet identifiant de transaction a déjà été utilisé. Si c'est une erreur, contactez le support." });
    }

    let transaction;
    try {
      transaction = await Transaction.create({
        txId: txNormalise, userId: req.user.id, email: req.user.email,
        moyen: `${LABELS[moyen]} CI`, plan: c.pack_id || c.produit_id, montant: c.prix_fcfa, statut: "en attente",
      });
    } catch (e) {
      if (e.code === "23505") return res.status(409).json({ error: "Cet identifiant de transaction a déjà été utilisé." });
      throw e;
    }
    await query(`UPDATE commandes_cv SET transaction_id = $1 WHERE id = $2 OR ($3::int IS NOT NULL AND groupe_id = $3 AND user_id = $4)`, [transaction.id, c.id, c.groupe_id || null, req.user.id]);

    // Alerte admin (même circuit que les abonnements)
    if (process.env.ADMIN_EMAIL) {
      const lien = `${process.env.FRONTEND_URL || ""}/admin/paiements.html`;
      enSilence(Email.envoyer({
        to: process.env.ADMIN_EMAIL,
        subject: `💰 Paiement à valider — ${c.pack_nom || c.produit_nom} (${c.prix_fcfa} FCFA)`,
        text: `Client : ${echapper(req.user.email)}<br>Produit : ${echapper(c.pack_nom || c.produit_nom)}<br>` +
              `Montant : ${echapper(c.prix_fcfa)} FCFA<br>Moyen : ${echapper(transaction.moyen)}<br>` +
              `Identifiant : ${echapper(txNormalise)}<br><br>Vérifiez la réception des fonds puis valide : <a href="${lien}">${lien}</a>`,
      }), "alerte admin paiement");
    }

    res.json({
      message: "Identifiant reçu. Votre paiement est en cours de vérification (24 h maximum). Votre document sera téléchargeable dès la validation.",
      etat: "en_verification",
    });
  } catch (err) {
    console.error("Erreur paiement commande CV :", err.message);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du paiement." });
  }
};

// ════════════════════════════════════════════════════════════
//  GET /api/cv/commande/:id/pdf — réservé aux CV payés et validés
// ════════════════════════════════════════════════════════════
exports.telechargerPDF = async (req, res) => {
  let chemin = null;
  try {
    const c = await chargerCommande(parseInt(req.params.id, 10) || 0, req.user.id);
    if (!c) return res.status(404).json({ error: "Document introuvable." });
    if (etatPaiement(c) !== "valide") {
      return res.status(402).json({ error: "Ce document sera téléchargeable après validation de votre paiement." });
    }
    if (c.produit_id === ID_SIMULATION) {
      if (!c.resultat) return res.status(409).json({ error: "Répondez d'abord aux questions pour obtenir votre rapport." });
      const d = JSON.parse(c.donnees);
      const base = String(d.nom || "rapport").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "rapport";
      chemin = await genererPDFTexte(rapportEntretien(c), `ENTRETIEN_${base}_${Date.now()}`, "lm", null, { data: d, modele: null, titre: "Rapport de simulation d'entretien" });
      return res.download(chemin, `Rapport_entretien_${base}.pdf`, (err) => {
        supprimerFichier(chemin);
        if (err && !res.headersSent) res.status(500).json({ error: "Erreur lors du téléchargement du PDF." });
      });
    }
    const donnees = JSON.parse(c.donnees);
    const lettre = estLettre(c.produit_id) || estRedaction(c.produit_id);
    const nom = String(donnees.nom || "document").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "document";
    if (lettre) {
      chemin = await genererPDFTexte(c.contenu, `DOC_${nom}_${Date.now()}`, "lm", null, { data: donnees, modele: null, titre: TYPES_REDACTION[c.produit_id]?.titre });
    } else {
      if (donnees.modele && MODELES_CV[donnees.modele]?.design) {
        chemin = await genererCVDesign(donnees, c.contenu, obtenirModele(donnees.modele));
      } else {
        const base = obtenirModele(TYPES_CV[c.produit_id]?.modele) || obtenirModele("ats_classique_1");
        const pal = PALETTES_DESIGN[donnees.palette];
        // Présentation sobre : seule la couleur des titres et des filets change (mise en page inchangée)
        const modele = pal ? { ...base, couleurs: { ...base.couleurs, primaire: pal.primaire, accent: pal.secondaire } } : base;
        chemin = await genererCVStructure(donnees, c.contenu, modele);
      }
    }
    const prefixe = c.produit_id.startsWith("cv-") ? "CV" : c.produit_id.startsWith("lm-") ? "LM" : estRedaction(c.produit_id) ? "DOC" : "CV";
    res.download(chemin, `${prefixe}_${nom}.pdf`, (err) => {
      supprimerFichier(chemin);
      if (err && !res.headersSent) res.status(500).json({ error: "Erreur lors du téléchargement du PDF." });
    });
  } catch (err) {
    console.error("Erreur PDF commande CV :", err.message);
    if (chemin) supprimerFichier(chemin);
    if (!res.headersSent) res.status(500).json({ error: "Erreur lors de la génération du PDF." });
  }
};

// ════════════════════════════════════════════════════════════
//  Appelé par paymentController.validerTransaction quand la
//  transaction concerne un CV : valide le paiement SANS activer
//  de Premium.
// ════════════════════════════════════════════════════════════
exports.confirmerPaiementCv = async (req, res, transaction) => {
  const maj = await Transaction.updateStatut(transaction.id, "validé");
  Journal.enregistrer(req.user.id, req.user.nom, "validation", "transaction", transaction.id,
    `${transaction.email} — ${transaction.plan} (${transaction.montant} FCFA)`);
  if (transaction.email) {
    enSilence(Email.envoyer({
      to: transaction.email,
      subject: "Paiement confirmé — votre document est prêt",
      text: `Bonjour,<br><br>Votre paiement est confirmé. Vous pouvez maintenant télécharger votre document en PDF depuis la page ` +
            `<a href="${process.env.FRONTEND_URL || ""}/cv-generator.html">CV et lettre</a> (rubrique « Mes documents »).`,
    }), "confirmation paiement CV");
  }
  res.json({ message: `Paiement validé pour ${transaction.email} — ${transaction.plan}. Aucun abonnement Premium activé.`, transaction: maj });
};
