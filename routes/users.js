// ============================================================
//  routes/users.js
//  Préfixe : /api/users
//  Routes profil utilisateur connecté
// ============================================================

const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const { nomValide, emailValide } = require("../middleware/neutraliser");
const bcrypt  = require("bcryptjs");
const User    = require("../models/User");
const Score   = require("../models/Score");
const { uploadPhoto, handleUploadError, cloudinaryConfigure, envoyerVersCloudinary } = require("../middleware/upload");

// PATCH /api/users/:id/photo — Définir la photo via un lien externe
// (méthode recommandée — pas de risque de perte au redéploiement)
router.patch("/:id/photo", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id) {
  return res.status(403).json({ error: "Accès refusé." });
}
const { photoUrl } = req.body;
if (photoUrl && (typeof photoUrl !== "string" || photoUrl.length > 500 || /[\s'"()<>\\]/.test(photoUrl) || !/^https?:\/\//i.test(photoUrl))) {
  return res.status(400).json({ error: "Lien invalide : il doit commencer par http:// ou https://, sans espace ni guillemet (500 caractères maximum)." });
}
const user = await User.setPhoto(req.params.id, photoUrl || null);
res.json({ message: "Photo de profil mise à jour.", user });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// POST /api/users/:id/photo/upload — Uploader directement un fichier
// Stockage permanent via Cloudinary si configuré, sinon disque local
// (voir middleware/upload.js).
router.post(
  "/:id/photo/upload",
  auth,
  uploadPhoto.single("photo"),
  handleUploadError,
  async (req, res) => {
    try {
      if (parseInt(req.params.id) !== req.user.id) {
        return res.status(403).json({ error: "Accès refusé." });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Aucune image reçue." });
      }
      const photoUrl = cloudinaryConfigure()
        ? (await envoyerVersCloudinary(req.file, { dossier: "photos", resourceType: "image" })).secure_url
        : `/uploads/photos/${req.file.filename}`;
      const user = await User.setPhoto(req.params.id, photoUrl);
      res.json({ message: "Photo de profil mise à jour.", user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/users/:id — Profil public
router.get("/:id", auth, async (req, res) => {
try {
const user = await User.findById(req.params.id);
if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

// Un utilisateur ne peut voir que son propre profil (sauf admin)
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
  return res.status(403).json({ error: "Accès refusé." });
}

const { password_hash, ...profil } = user;
res.json({ user: profil });

} catch (err) {
res.status(500).json({ error: err.message });
}
});

// GET/PATCH /api/users/:id/rappels — préférence « rappels personnels par e-mail » (propre compte uniquement)
router.get("/:id/rappels", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id) return res.status(403).json({ error: "Accès refusé." });
const r = await require("../config/database").query("SELECT rappels_email FROM users WHERE id = $1", [req.user.id]);
res.json({ actif: r.rows[0] ? r.rows[0].rappels_email === true : true });
} catch (err) {
res.status(500).json({ error: "Erreur serveur." });
}
});
router.patch("/:id/rappels", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id) return res.status(403).json({ error: "Accès refusé." });
if (typeof (req.body || {}).actif !== "boolean") return res.status(400).json({ error: "Valeur invalide." });
await require("../config/database").query("UPDATE users SET rappels_email = $1 WHERE id = $2", [req.body.actif, req.user.id]);
res.json({ actif: req.body.actif });
} catch (err) {
res.status(500).json({ error: "Erreur serveur." });
}
});

// PATCH /api/users/:id — Modifier profil
router.patch("/:id", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
return res.status(403).json({ error: "Accès refusé." });
}
// Champs modifiables par l'utilisateur lui-même : nom et email
// uniquement. role/premium ne sont JAMAIS pris depuis req.body ici —
// leur modification passe uniquement par les routes admin dédiées.
const { nom, email, password } = req.body || {};
if (nom !== undefined && (typeof nom !== "string" || !nomValide(nom))) {
  return res.status(400).json({ error: "Nom invalide : lettres, chiffres, espaces, tirets et apostrophes uniquement." });
}
if (email !== undefined && (typeof email !== "string" || !emailValide(email))) {
  return res.status(400).json({ error: "Adresse e-mail invalide." });
}
let emailNormalise = email;
if (email !== undefined) {
  emailNormalise = String(email).toLowerCase().trim();
  const actuel = await User.findById(req.params.id);
  if (actuel && actuel.email !== emailNormalise) {
    // L'adresse e-mail sert à récupérer le compte : un jeton volé (ou une session laissée
    // ouverte) ne doit pas suffire à la remplacer. Le titulaire doit prouver qu'il connaît
    // son mot de passe (un administrateur modifiant le compte d'un autre n'est pas concerné).
    if (parseInt(req.params.id) === req.user.id) {
      const compte = await User.findByEmail(actuel.email);
      if (typeof password !== "string" || !password || !compte || !(await bcrypt.compare(password, compte.password_hash))) {
        return res.status(403).json({ error: "Mot de passe actuel requis et correct pour changer l'adresse e-mail." });
      }
    }
    if (await User.emailExiste(emailNormalise)) {
      return res.status(409).json({ error: "Cette adresse e-mail est déjà utilisée." });
    }
    // Prévient l'ancienne adresse : un changement d'e-mail frauduleux ne doit pas passer inaperçu
    require("../services/email").envoyer({
      to: actuel.email,
      subject: "L'adresse e-mail de votre compte a été modifiée",
      text: `Bonjour,<br><br>L'adresse e-mail de votre compte ProInsertion CI vient d'être remplacée. ` +
            `Si vous n'êtes pas à l'origine de cette modification, contactez-nous immédiatement et changez votre mot de passe.`,
    }).catch((e) => console.error("Alerte changement d'e-mail non envoyée :", e.message));
  }
}
const updated = await User.updateProfil(req.params.id, { nom, email: emailNormalise });
if (updated && updated.email_verified === false) {
  const v = await User.renouvelerVerification(updated.id);
  if (v) {
    const lien = `${process.env.FRONTEND_URL || "https://proinsertionci.netlify.app"}/auth/verifier-email.html?token=${v.jetonVerification}`;
    require("../services/email").envoyerVerificationEmail(v, lien)
      .catch((e) => console.error("E-mail de vérification non envoyé :", e.message));
  }
}
res.json({ message: "Profil mis à jour.", user: updated });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// GET /api/users/:id/scores — Scores d'un utilisateur
router.get("/:id/scores", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
return res.status(403).json({ error: "Accès refusé." });
}
const scores = await Score.findByUser(req.params.id);
res.json({ scores });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// GET /api/users/:id/favoris — Favoris d'un utilisateur
router.get("/:id/favoris", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
return res.status(403).json({ error: "Accès refusé." });
}
const user    = await User.findById(req.params.id);
const favoris = JSON.parse(user?.favoris_json || "[]");
res.json({ favoris });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// PATCH /api/users/:id/favoris — Mettre à jour les favoris
router.patch("/:id/favoris", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id) {
return res.status(403).json({ error: "Accès refusé." });
}
const { favoris } = req.body;
await User.updateFavoris(req.params.id, favoris || []);
res.json({ message: "Favoris mis à jour.", favoris });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// GET /api/users/:id/paiements — Historique paiements
router.get("/:id/paiements", auth, async (req, res) => {
try {
if (parseInt(req.params.id) !== req.user.id && req.user.role !== "admin") {
return res.status(403).json({ error: "Accès refusé." });
}
const Transaction = require("../models/Transaction");
const transactions = await Transaction.findByUser(req.params.id);
res.json({ transactions });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

module.exports = router;