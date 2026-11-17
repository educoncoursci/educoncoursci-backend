// ============================================================
//  controllers/analyseOffreController.js
//  « Analysez une offre d'emploi comme un recruteur » + comparaison CV.
//  Fichiers : PDF / images, en mémoire uniquement, jamais stockés.
// ============================================================
const { query } = require("../config/database");
const { analyserOffre, comparerCVOffre } = require("../services/claude");

const MIMES_OFFRE = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_TEXTE = 15000;

// Vérifie la nature réelle du fichier (octets d'en-tête), pas seulement le type déclaré
function typeReel(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf.slice(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.slice(1, 4).toString("latin1") === "PNG") return "image/png";
  if (buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

function fichierDepuisReq(file, autorises) {
  if (!file) return null;
  const mime = typeReel(file.buffer);
  if (!mime || !autorises.includes(mime)) {
    const e = new Error("Fichier non pris en charge. Envoie un PDF, une capture JPG/PNG/WEBP ou colle le texte."); e.status = 400; throw e;
  }
  return { mime, base64: file.buffer.toString("base64") };
}

const liste = (v) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 300)).slice(0, 12) : []);
const txt = (v, d = "Non précisé") => (typeof v === "string" && v.trim() ? v.trim().slice(0, 400) : d);

function nettoyerAnalyse(a) {
  const c = a.competences || {}, t = a.attentes || {};
  return {
    lisible: true,
    intitule: txt(a.intitule), organisation: txt(a.organisation), lieu: txt(a.lieu), type_contrat: txt(a.type_contrat),
    resume: txt(a.resume, ""),
    competences: { techniques: liste(c.techniques), comportementales: liste(c.comportementales), qualifications: liste(c.qualifications), experiences: liste(c.experiences), outils: liste(c.outils) },
    attentes: { missions: liste(t.missions), responsabilites: liste(t.responsabilites), qualites: liste(t.qualites), mots_cles: liste(t.mots_cles), differenciants: liste(t.differenciants) },
    atouts: liste(a.atouts),
    conseil_candidature: txt(a.conseil_candidature, ""),
  };
}

function erreurIA(err, res, defaut) {
  console.error(defaut, err.message);
  if (err.status === 400) return res.status(400).json({ error: err.message });
  if (/API|IA/.test(err.message) && !/illisible/.test(err.message)) return res.status(503).json({ error: "Service IA temporairement indisponible. Réessaie dans un instant." });
  return res.status(502).json({ error: "L'analyse n'a pas pu être terminée. Réessaie, ou colle le texte de l'offre." });
}

// POST /api/offres/analyser   (multipart : texte? , fichier?)
exports.analyser = async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "Service IA non configuré." });
    const texte = String(req.body.texte || "").trim().slice(0, MAX_TEXTE);
    const fichier = fichierDepuisReq(req.files?.offre?.[0], MIMES_OFFRE);
    if (!texte && !fichier) return res.status(400).json({ error: "Colle le texte de l'offre ou envoie un PDF / une capture d'écran." });
    if (!fichier && texte.length < 80) return res.status(400).json({ error: "Le texte est trop court pour être une offre d'emploi. Colle l'offre complète." });

    const brut = await analyserOffre({ texte, fichier });
    if (brut.lisible === false) return res.status(422).json({ error: `Ce contenu ne semble pas être une offre d'emploi exploitable${brut.raison ? " : " + String(brut.raison).slice(0, 200) : ""}. Essaie avec une image plus nette ou colle le texte.` });
    const analyse = nettoyerAnalyse(brut);
    if (!analyse.competences.techniques.length && !analyse.attentes.missions.length && !analyse.competences.qualifications.length)
      return res.status(422).json({ error: "Impossible d'extraire des informations utiles de ce contenu. Colle le texte complet de l'offre." });

    const r = await query(`INSERT INTO analyses_offres (user_id, intitule, organisation, analyse_json) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
      [req.user.id, analyse.intitule.slice(0, 200), analyse.organisation.slice(0, 200), JSON.stringify(analyse)]);
    res.status(201).json({ id: r.rows[0].id, created_at: r.rows[0].created_at, analyse });
  } catch (err) { erreurIA(err, res, "Erreur analyse offre :"); }
};

// POST /api/offres/:id/comparer   (multipart : cv? fichier PDF, cvTexte?)  — Premium
exports.comparer = async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "Service IA non configuré." });
    const o = await query(`SELECT id, analyse_json FROM analyses_offres WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (!o.rows[0]) return res.status(404).json({ error: "Analyse introuvable." });
    const cvTexte = String(req.body.cvTexte || "").trim().slice(0, MAX_TEXTE);
    const cvFichier = fichierDepuisReq(req.files?.cv?.[0], ["application/pdf"]);
    if (!cvTexte && !cvFichier) return res.status(400).json({ error: "Importe ton CV en PDF ou colle son texte." });

    const brut = await comparerCVOffre({ analyse: JSON.parse(o.rows[0].analyse_json), cvFichier, cvTexte });
    if (brut.lisible === false) return res.status(422).json({ error: `Ce document ne semble pas être un CV exploitable${brut.raison ? " : " + String(brut.raison).slice(0, 200) : ""}. Vérifie que le PDF contient du texte lisible.` });
    const score = Math.max(0, Math.min(100, Math.round(Number(brut.score))));
    if (!Number.isFinite(score)) throw new Error("Réponse IA illisible");
    const comparaison = { score, verdict: txt(brut.verdict, ""), points_forts: liste(brut.points_forts), competences_manquantes: liste(brut.competences_manquantes), a_mieux_valoriser: liste(brut.a_mieux_valoriser), mots_cles_a_ajouter: liste(brut.mots_cles_a_ajouter), ameliorations: liste(brut.ameliorations) };
    await query(`UPDATE analyses_offres SET comparaison = $1 WHERE id = $2`, [JSON.stringify(comparaison), o.rows[0].id]);
    res.json({ id: o.rows[0].id, comparaison });
  } catch (err) { erreurIA(err, res, "Erreur comparaison CV/offre :"); }
};

const lireJSON = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

// GET /api/offres  — historique de l'utilisateur
exports.lister = async (req, res) => {
  try {
    const r = await query(`SELECT id, intitule, organisation, created_at, (comparaison IS NOT NULL) AS compare FROM analyses_offres WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`, [req.user.id]);
    res.json({ analyses: r.rows });
  } catch (err) { console.error("Erreur liste analyses :", err.message); res.status(500).json({ error: "Erreur serveur." }); }
};

// GET /api/offres/:id
exports.lire = async (req, res) => {
  try {
    const r = await query(`SELECT id, analyse_json, comparaison, created_at FROM analyses_offres WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "Analyse introuvable." });
    res.json({ id: r.rows[0].id, created_at: r.rows[0].created_at, analyse: lireJSON(r.rows[0].analyse_json), comparaison: lireJSON(r.rows[0].comparaison) });
  } catch (err) { console.error("Erreur lecture analyse :", err.message); res.status(500).json({ error: "Erreur serveur." }); }
};

// DELETE /api/offres/:id  — droit à l'effacement
exports.supprimer = async (req, res) => {
  try {
    const r = await query(`DELETE FROM analyses_offres WHERE id = $1 AND user_id = $2 RETURNING id`, [req.params.id, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Analyse introuvable." });
    res.json({ message: "Analyse supprimée." });
  } catch (err) { console.error("Erreur suppression analyse :", err.message); res.status(500).json({ error: "Erreur serveur." }); }
};
