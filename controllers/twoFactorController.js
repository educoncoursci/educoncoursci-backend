// ============================================================
//  controllers/twoFactorController.js
//  Lot 16 — Authentification à deux facteurs (TOTP, type Google
//  Authenticator / Authy). Ajoute une étape de vérification au
//  login sans dépendre d'un envoi SMS/email (fonctionne hors-ligne
//  côté candidat une fois l'app configurée).
// ============================================================

const speakeasy = require("speakeasy");
const qrcode    = require("qrcode");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const crypto    = require("crypto");
const User      = require("../models/User");

function genererCodesRecuperation(nombre = 8) {
  return Array.from({ length: nombre }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g).join("-"),
  );
}

function genererToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nom: user.nom, role: user.role, premium: user.premium },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

// ════════════════════════════════════════════════════════════
//  POST /api/auth/2fa/setup — Démarre la configuration (connecté)
//  Retourne un QR code à scanner + le secret en clair (saisie
//  manuelle possible). La 2FA n'est PAS encore active à ce stade.
// ════════════════════════════════════════════════════════════
exports.setup = async (req, res) => {
  try {
    const utilisateur = await User.findAvecSecretDeuxFacteur(req.user.id);
    if (utilisateur.two_factor_enabled) {
      return res.status(400).json({ error: "La 2FA est déjà activée sur ce compte." });
    }

    const secret = speakeasy.generateSecret({
      name: `EduConcoursCI (${utilisateur.email})`,
      length: 20,
    });

    await User.setDeuxFacteurSecretEnAttente(req.user.id, secret.base32);
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({ qrCodeUrl, secret: secret.base32 });
  } catch (err) {
    console.error("Erreur setup 2FA :", err.message);
    res.status(500).json({ error: "Erreur lors de la configuration de la 2FA." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/auth/2fa/confirm — Valide le premier code et active
//  la 2FA. Retourne les codes de récupération (à sauvegarder,
//  affichés une seule fois).
// ════════════════════════════════════════════════════════════
exports.confirmer = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Le code à 6 chiffres est requis." });
    }

    const utilisateur = await User.findAvecSecretDeuxFacteur(req.user.id);
    if (!utilisateur.two_factor_secret) {
      return res.status(400).json({ error: "Aucune configuration en attente. Relance la configuration." });
    }

    const valide = speakeasy.totp.verify({
      secret: utilisateur.two_factor_secret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!valide) {
      return res.status(400).json({ error: "Code invalide. Vérifie l'heure de ton téléphone et réessaie." });
    }

    const codesRecuperation = genererCodesRecuperation();
    const hashes = await Promise.all(codesRecuperation.map((c) => bcrypt.hash(c, 10)));
    await User.activerDeuxFacteur(req.user.id, hashes);

    res.json({
      message: "2FA activée avec succès.",
      codesRecuperation,
    });
  } catch (err) {
    console.error("Erreur confirmation 2FA :", err.message);
    res.status(500).json({ error: "Erreur lors de l'activation de la 2FA." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/auth/2fa/disable — Désactive la 2FA (mot de passe requis)
// ════════════════════════════════════════════════════════════
exports.desactiver = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Mot de passe requis pour désactiver la 2FA." });
    }

    const utilisateur = await User.findByEmail(req.user.email);
    const motDePasseCorrect = await bcrypt.compare(password, utilisateur.password_hash);
    if (!motDePasseCorrect) {
      return res.status(401).json({ error: "Mot de passe incorrect." });
    }

    await User.desactiverDeuxFacteur(req.user.id);
    res.json({ message: "2FA désactivée." });
  } catch (err) {
    console.error("Erreur désactivation 2FA :", err.message);
    res.status(500).json({ error: "Erreur lors de la désactivation de la 2FA." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/auth/2fa/verify-login — Étape 2 du login (public,
//  protégé par le tempToken émis à l'étape 1). Accepte un code
//  TOTP ou, à défaut, un code de récupération à usage unique.
// ════════════════════════════════════════════════════════════
exports.verifierLogin = async (req, res) => {
  try {
    const { tempToken, token, codeRecuperation } = req.body;
    if (!tempToken || (!token && !codeRecuperation)) {
      return res.status(400).json({ error: "Code de vérification requis." });
    }

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Session de connexion expirée. Reconnecte-toi." });
    }
    if (payload.purpose !== "2fa-pending") {
      return res.status(401).json({ error: "Jeton invalide." });
    }

    const utilisateur = await User.findAvecSecretDeuxFacteur(payload.id);
    if (!utilisateur || !utilisateur.two_factor_enabled) {
      return res.status(400).json({ error: "2FA non active sur ce compte." });
    }

    let verifie = false;

    if (token) {
      verifie = speakeasy.totp.verify({
        secret: utilisateur.two_factor_secret,
        encoding: "base32",
        token,
        window: 1,
      });
    } else if (codeRecuperation) {
      const hashes = JSON.parse(utilisateur.two_factor_recovery_codes || "[]");
      for (let i = 0; i < hashes.length; i++) {
        if (await bcrypt.compare(codeRecuperation.toUpperCase(), hashes[i])) {
          verifie = true;
          hashes.splice(i, 1); // usage unique — on le retire
          await User.definirCodesRecuperation(payload.id, hashes);
          break;
        }
      }
    }

    if (!verifie) {
      return res.status(401).json({ error: "Code incorrect." });
    }

    // Ré-utilise les infos complètes de l'utilisateur pour le JWT final
    const complet = await User.findByEmail(utilisateur.email);
    let premium = complet.premium;
    if (premium && complet.premium_expire && new Date(complet.premium_expire) < new Date()) {
      await User.setPremium(complet.id, { premium: false, plan: null, expire: null });
      premium = false;
    }

    const jwtFinal = genererToken({ ...complet, premium });

    res.json({
      message: "Connexion réussie.",
      token: jwtFinal,
      user: {
        id: complet.id, nom: complet.nom, email: complet.email, role: complet.role,
        premium, premium_plan: complet.premium_plan, premium_expire: complet.premium_expire,
        photo_url: complet.photo_url,
      },
    });
  } catch (err) {
    console.error("Erreur vérification login 2FA :", err.message);
    res.status(500).json({ error: "Erreur lors de la vérification." });
  }
};
