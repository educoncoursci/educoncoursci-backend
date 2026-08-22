// ============================================================
//  routes/diagnostic.js
//  Diagnostic de la config e-mail (Brevo) accessible par simple
//  requête HTTP — pensé pour les hébergeurs sans accès shell (ex:
//  plan gratuit Render, qui ne donne pas de terminal). Fait le
//  même travail que scripts/test-email.js, mais via le navigateur
//  ou un simple appel curl/Postman, sans rien installer.
//
//  Protégé par un secret (DIAGNOSTIC_SECRET) passé en paramètre
//  d'URL — n'importe qui connaissant l'URL exacte de ton backend
//  ne doit pas pouvoir déclencher un envoi d'e-mail ou lire ta
//  config. Si DIAGNOSTIC_SECRET n'est pas configurée, les deux
//  routes répondent 404 (désactivées par défaut).
//
//  Usage (dans un navigateur ou curl) :
//    GET /api/diagnostic/email?secret=TON_SECRET
//      → affiche l'état de la config (clé présente ? expéditeur ?)
//    GET /api/diagnostic/email/test?secret=TON_SECRET&to=toi@exemple.com
//      → envoie un vrai e-mail de test à cette adresse et rapporte
//        l'erreur Brevo exacte en cas d'échec
//
//  ⚠️ Pense à retirer DIAGNOSTIC_SECRET de Render une fois le
//  problème résolu, ou à changer sa valeur, pour refermer l'accès.
// ============================================================

const express = require("express");
const router = express.Router();
const { emailConfigure, envoyer } = require("../services/email");
const { cloudinary, cloudinaryConfigure } = require("../config/cloudinary");

function secretValide(req) {
  const secret = process.env.DIAGNOSTIC_SECRET;
  return Boolean(secret) && req.query.secret === secret;
}

// ── GET /api/diagnostic/email — état de la config, sans envoyer d'e-mail ──
router.get("/email", (req, res) => {
  if (!secretValide(req)) return res.status(404).json({ error: "Introuvable." });

  const cleDefinie = Boolean(process.env.BREVO_API_KEY);
  const emailFrom = process.env.EMAIL_FROM || "(non défini → noreply@educoncoursci.ci par défaut)";

  res.json({
    BREVO_API_KEY: cleDefinie
      ? `définie (se termine par ...${process.env.BREVO_API_KEY.slice(-4)})`
      : "❌ NON DÉFINIE",
    EMAIL_FROM: emailFrom,
    emailConfigure: emailConfigure(),
    conseil: !cleDefinie
      ? "BREVO_API_KEY absente : aucun e-mail ne peut partir tant qu'elle n'est pas ajoutée sur Render."
      : "Configuration présente. Utilise /api/diagnostic/email/test?secret=...&to=ton@email.com pour un envoi réel et voir l'erreur exacte de Brevo en cas d'échec (cause la plus fréquente : EMAIL_FROM différent de l'adresse vérifiée dans Brevo → Paramètres → Expéditeurs).",
  });
});

// ── GET /api/diagnostic/email/test — envoie un vrai e-mail de test ──
router.get("/email/test", async (req, res) => {
  if (!secretValide(req)) return res.status(404).json({ error: "Introuvable." });

  const destinataire = req.query.to;
  if (!destinataire) {
    return res.status(400).json({ error: "Ajoute ?to=ton@email.com à l'URL pour recevoir le test." });
  }

  if (!emailConfigure()) {
    return res.status(400).json({
      error: "BREVO_API_KEY absente — impossible d'envoyer un test.",
    });
  }

  try {
    const resultat = await envoyer({
      to: destinataire,
      subject: "✅ Test EduConcoursCI — la configuration e-mail fonctionne",
      html: `<p>Si tu lis ce message, l'envoi d'e-mails depuis EduConcoursCI fonctionne correctement 🎉</p>`,
    });
    res.json({
      succes: true,
      message: `E-mail envoyé avec succès à ${destinataire}. Vérifie la boîte de réception (et les spams).`,
      messageId: resultat.messageId,
    });
  } catch (err) {
    res.status(500).json({
      succes: false,
      erreur: err.message,
      conseil:
        "Causes les plus fréquentes chez Brevo : (1) l'adresse dans EMAIL_FROM n'est pas un expéditeur VÉRIFIÉ (Paramètres → Expéditeurs sur brevo.com — elle doit correspondre EXACTEMENT) ; (2) BREVO_API_KEY invalide/expirée ; (3) quota gratuit de 300 e-mails/jour dépassé.",
    });
  }
});

// ── GET /api/diagnostic/stockage — état de la config Cloudinary ──
router.get("/stockage", (req, res) => {
  if (!secretValide(req)) return res.status(404).json({ error: "Introuvable." });

  res.json({
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "❌ NON DÉFINIE",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY
      ? `définie (se termine par ...${process.env.CLOUDINARY_API_KEY.slice(-4)})`
      : "❌ NON DÉFINIE",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? "définie" : "❌ NON DÉFINIE",
    cloudinaryConfigure: cloudinaryConfigure(),
    conseil: cloudinaryConfigure()
      ? "Configuration présente. Utilise /api/diagnostic/stockage/test?secret=... pour un envoi réel de test."
      : "Les 3 variables CLOUDINARY_* sont nécessaires pour un stockage permanent. Sans elles, les fichiers uploadés (PDF, vidéos, photos) sont stockés sur le disque de Render et seront perdus au prochain redéploiement.",
  });
});

// ── GET /api/diagnostic/stockage/test — upload un petit fichier test ──
router.get("/stockage/test", async (req, res) => {
  if (!secretValide(req)) return res.status(404).json({ error: "Introuvable." });

  if (!cloudinaryConfigure()) {
    return res.status(400).json({ error: "Cloudinary non configuré — impossible de tester." });
  }

  try {
    // Upload d'une image transparente 1x1 encodée en base64 — vérifie
    // que les identifiants Cloudinary sont valides sans dépendre d'un
    // vrai fichier.
    const resultat = await cloudinary.uploader.upload(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      { folder: "educoncoursci/test-diagnostic" },
    );
    res.json({
      succes: true,
      message: "Upload de test réussi — Cloudinary fonctionne correctement 🎉",
      url: resultat.secure_url,
    });
  } catch (err) {
    res.status(500).json({
      succes: false,
      erreur: err.message,
      conseil: "Vérifie que CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET correspondent exactement à ton Dashboard Cloudinary.",
    });
  }
});

module.exports = router;
