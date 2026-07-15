// ============================================================
//  controllers/videoController.js
//  Gère : liste, détail, vues, CRUD vidéos
// ============================================================

const Video = require("../models/Video");

// Extrait l'ID YouTube d'une URL
function getYoutubeId(url) {
const match = url.match(
/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
);
return match ? match[1] : null;
}

// ════════════════════════════════════════════════════════════
//  GET /api/videos — Liste
// ════════════════════════════════════════════════════════════
exports.liste = async (req, res) => {
try {
const { categorie, premium, limit, offset } = req.query;

let filtrerPremium;
if (premium !== undefined) filtrerPremium = premium === "true";

const videos = await Video.findAll({
  categorie,
  premium:  filtrerPremium,
  limit:    parseInt(limit)  || 50,
  offset:   parseInt(offset) || 0,
});

// Ajoute l'ID YouTube et la miniature pour chaque vidéo
const videosFormatees = videos.map(v => {
  const ytId = getYoutubeId(v.url || "");
  const verrouille = v.premium && (!req.user || !req.user.premium);
  return {
    ...v,
    youtube_id: ytId,
    miniature:  ytId
      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      : null,
    url:        verrouille ? null : v.url,
    verrouille,
  };
});

res.json({ total: videosFormatees.length, videos: videosFormatees });

} catch (err) {
console.error("Erreur liste vidéos :", err.message);
res.status(500).json({ error: "Erreur lors de la récupération des vidéos." });
}
};

// ════════════════════════════════════════════════════════════
//  GET /api/videos/:id — Détail + incrémenter vues
// ════════════════════════════════════════════════════════════
exports.detail = async (req, res) => {
try {
const video = await Video.findById(req.params.id);
if (!video) return res.status(404).json({ error: "Vidéo introuvable." });

if (video.premium && (!req.user || !req.user.premium)) {
  return res.status(403).json({
    error:   "Contenu réservé aux abonnés Premium.",
    premium: true,
  });
}

// Incrémenter les vues
await Video.incrementerVues(video.id);

const ytId = getYoutubeId(video.url || "");
res.json({
  video: {
    ...video,
    youtube_id: ytId,
    miniature:  ytId
      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      : null,
  },
});

} catch (err) {
console.error("Erreur détail vidéo :", err.message);
res.status(500).json({ error: "Erreur serveur." });
}
};

// ════════════════════════════════════════════════════════════
//  POST /api/videos — Créer (admin)
// ════════════════════════════════════════════════════════════
exports.creer = async (req, res) => {
try {
const { titre, categorie, duree, url, description, premium, statut } = req.body;

if (!titre || !url) {
  return res.status(400).json({ error: "Titre et URL sont requis." });
}

const video = await Video.create({
  titre, categorie, duree, url, description,
  premium: premium === "true" || premium === true,
  statut,
});

res.status(201).json({ message: "Vidéo ajoutée avec succès.", video });

} catch (err) {
console.error("Erreur créer vidéo :", err.message);
res.status(500).json({ error: "Erreur lors de l'ajout de la vidéo." });
}
};

// ════════════════════════════════════════════════════════════
//  PATCH /api/videos/:id — Modifier (admin)
// ════════════════════════════════════════════════════════════
exports.modifier = async (req, res) => {
try {
const video = await Video.findById(req.params.id);
if (!video) return res.status(404).json({ error: "Vidéo introuvable." });

const modifiee = await Video.update(req.params.id, req.body);
res.json({ message: "Vidéo modifiée avec succès.", video: modifiee });

} catch (err) {
console.error("Erreur modifier vidéo :", err.message);
res.status(500).json({ error: "Erreur lors de la modification." });
}
};

// ════════════════════════════════════════════════════════════
//  DELETE /api/videos/:id — Supprimer (admin)
// ════════════════════════════════════════════════════════════
exports.supprimer = async (req, res) => {
try {
const video = await Video.findById(req.params.id);
if (!video) return res.status(404).json({ error: "Vidéo introuvable." });

await Video.delete(req.params.id);
res.json({ message: "Vidéo supprimée avec succès." });

} catch (err) {
console.error("Erreur supprimer vidéo :", err.message);
res.status(500).json({ error: "Erreur lors de la suppression." });
}
};