// ============================================================
//  controllers/authController.js
//  Inscription, connexion, déconnexion, profil connecté.
// ============================================================

const bcrypt = require("bcryptjs");
const { nomValide, emailValide } = require("../middleware/neutraliser");
const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const User   = require("../models/User");

// ── Générer un token JWT ──────────────────────────────────────
function genererToken(user) {
return jwt.sign(
{
id:      user.id,
email:   user.email,
nom:     user.nom,
role:    user.role,
premium: user.premium,
},
process.env.JWT_SECRET,
// Session administrateur plus courte : un jeton volé reste utilisable moins longtemps
  { algorithm: "HS256", expiresIn: user.role === "admin" ? "12h" : (process.env.JWT_EXPIRES_IN || "7d") }
);
}

// ── Vérifie si le Premium d'un utilisateur a expiré et le
//    désactive en base le cas échéant. Utilisée par /login ET /me
//    (avant ce correctif, seule /login faisait cette vérification :
//    un abonnement expiré restait affiché "Premium" indéfiniment
//    tant que l'utilisateur ne se déconnectait/reconnectait pas,
//    puisque /me — rappelée à chaque chargement de page par
//    rafraîchirProfil() — renvoyait premium tel quel sans contrôle
//    de date). Renvoie le statut premium à jour (bool).
async function verifierEtExpirerPremiumSiBesoin(user) {
let premium = user.premium;
if (premium && user.premium_expire) {
const expire = new Date(user.premium_expire);
if (expire < new Date()) {
  await User.setPremium(user.id, { premium: false, plan: null, expire: null });
  premium = false;
  user.premium_plan   = null;
  user.premium_expire = null;
}
}
return premium;
}

// ── POST /api/auth/register ───────────────────────────────────
// Envoie (sans jamais faire échouer la requête) le lien de confirmation d'e-mail.
function envoyerLienVerification(user) {
  const lien = `${process.env.FRONTEND_URL || "https://proinsertionci.netlify.app"}/auth/verifier-email.html?token=${user.jetonVerification}`;
  Promise.resolve()
    .then(() => require("../services/email").envoyerVerificationEmail(user, lien))
    .catch((e) => console.error(`❌ ÉCHEC ENVOI E-MAIL DE VÉRIFICATION — ${user.email} — ${e.message}`));
}

const register = async (req, res) => {
try {
const { nom, email, password } = req.body;

// Validation des champs
if (!nom || !email || !password) {
  return res.status(400).json({
    error: "Nom, e-mail et mot de passe sont requis."
  });
}
if (typeof nom !== "string" || !nomValide(nom)) {
  return res.status(400).json({
    error: "Nom invalide : lettres, chiffres, espaces, tirets et apostrophes uniquement (2 à 80 caractères)."
  });
}
if (typeof password !== "string" || password.length < 8 || password.length > 200) {
  return res.status(400).json({
    error: "Le mot de passe doit contenir au moins 8 caractères."
  });
}

if (!emailValide(email)) {
  return res.status(400).json({ error: "Adresse e-mail invalide." });
}

// Vérifier si l'email existe déjà
const existe = await User.emailExiste(email.toLowerCase());
if (existe) {
  return res.status(409).json({
    error: "Un compte existe déjà avec cet e-mail."
  });
}

// Hacher le mot de passe (12 rounds = bon équilibre sécurité/vitesse)
const passwordHash = await bcrypt.hash(password, 12);

// Créer l'utilisateur
const user = await User.create({
  nom:          nom.trim(),
  email:        email.toLowerCase().trim(),
  passwordHash,
});

// Générer le token
const token = genererToken({ ...user, role: "user", premium: false });

envoyerLienVerification(user);

res.status(201).json({
  message: "Compte créé avec succès. Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien qu'il contient pour valider votre adresse.",
  email_verifie: false,
  token,
  user: {
    id:              user.id,
    nom:             user.nom,
    email:           user.email,
    role:            user.role || "user",
    premium:         user.premium || false,
    date_inscription: user.date_inscription,
  },
});

} catch (err) {
console.error("Erreur register :", err.message);
res.status(500).json({ error: "Erreur lors de la création du compte." });
}
};

// ── POST /api/auth/login ──────────────────────────────────────
const login = async (req, res) => {
try {
const { email, password } = req.body;

if (!email || !password) {
  return res.status(400).json({
    error: "E-mail et mot de passe requis."
  });
}

// Trouver l'utilisateur
const user = await User.findByEmail(email.toLowerCase().trim());
if (!user) {
  return res.status(401).json({
    error: "E-mail ou mot de passe incorrect."
  });
}

// Vérifier le mot de passe
const motDePasseCorrect = await bcrypt.compare(password, user.password_hash);
if (!motDePasseCorrect) {
  return res.status(401).json({
    error: "E-mail ou mot de passe incorrect."
  });
}

// 2FA activée ? On ne délivre pas le token final tout de suite —
// le front doit d'abord passer par /api/auth/2fa/verify-login
if (user.two_factor_enabled) {
  const tempToken = jwt.sign(
    { id: user.id, purpose: "2fa-pending" },
    process.env.JWT_SECRET,
    { expiresIn: "10m" },
  );
  return res.json({ requires2FA: true, tempToken });
}

// Vérifier si le Premium a expiré
const premium = await verifierEtExpirerPremiumSiBesoin(user);

// Générer le token
const token = genererToken({ ...user, premium });

res.json({
  message: "Connexion réussie.",
  token,
  user: {
    id:             user.id,
    nom:            user.nom,
    email:          user.email,
    role:           user.role,
    premium,
    premium_plan:   user.premium_plan,
    premium_expire: user.premium_expire,
    photo_url:      user.photo_url,
    email_verifie:  user.email_verified !== false,
  },
});

} catch (err) {
console.error("Erreur login :", err.message);
res.status(500).json({ error: "Erreur lors de la connexion." });
}
};

// ── GET /api/auth/me ──────────────────────────────────────────
const me = async (req, res) => {
try {
const user = await User.findById(req.user.id);
if (!user) {
return res.status(404).json({ error: "Utilisateur introuvable." });
}

// Même vérification qu'au login : sans ça, un abonnement expiré
// restait affiché "Premium" à chaque rafraîchissement de page tant
// que l'utilisateur ne se déconnectait/reconnectait pas.
const premium = await verifierEtExpirerPremiumSiBesoin(user);

res.json({
  user: {
    id:             user.id,
    nom:            user.nom,
    email:          user.email,
    role:           user.role,
    premium,
    premium_plan:   user.premium_plan,
    premium_expire: user.premium_expire,
    date_inscription: user.date_inscription,
    photo_url: user.photo_url,
    favoris:  JSON.parse(user.favoris_json  || "[]"),
    scores:   JSON.parse(user.scores_json   || "[]"),
    two_factor_enabled: user.two_factor_enabled || false,
    email_verifie: user.email_verified !== false,
  },
});

} catch (err) {
console.error("Erreur me :", err.message);
res.status(500).json({ error: "Erreur lors de la récupération du profil." });
}
};

// ── POST /api/auth/logout ─────────────────────────────────────
// Côté serveur il n'y a rien à faire (JWT stateless).
// Le client doit supprimer le token de son localStorage.
const logout = (req, res) => {
res.json({ message: "Déconnexion réussie." });
};

// ── POST /api/auth/change-password ───────────────────────────
const changePassword = async (req, res) => {
try {
const { ancienPassword, nouveauPassword } = req.body;

if (!ancienPassword || !nouveauPassword) {
  return res.status(400).json({
    error: "Ancien et nouveau mot de passe requis."
  });
}
if (nouveauPassword.length < 8) {
  return res.status(400).json({
    error: "Le nouveau mot de passe doit contenir au moins 8 caractères."
  });
}

// Récupérer l'utilisateur avec son hash
const user = await User.findByEmail(req.user.email);
const correct = await bcrypt.compare(ancienPassword, user.password_hash);
if (!correct) {
  // 403 et non 401 : le navigateur traite tout 401 comme « session expirée »
  // et déconnecterait l'utilisateur pour une simple faute de frappe.
  return res.status(403).json({
    error: "Ancien mot de passe incorrect."
  });
}

const newHash = await bcrypt.hash(nouveauPassword, 12);
await User.updatePassword(req.user.id, newHash); // invalide aussi les autres sessions ouvertes

// Nouveau jeton pour la session en cours (les anciens, y compris volés, ne sont plus acceptés)
const compte = await User.findById(req.user.id);
const token = genererToken({ id: compte.id, email: compte.email, nom: compte.nom, role: compte.role, premium: compte.premium });

res.json({ message: "Mot de passe modifié avec succès.", token });

} catch (err) {
console.error("Erreur changePassword :", err.message);
res.status(500).json({ error: "Erreur lors du changement de mot de passe." });
}
};

// ════════════════════════════════════════════════════════════
//  Mot de passe oublié — étape 1 : demander le lien
// ════════════════════════════════════════════════════════════
const forgotPassword = async (req, res) => {
try {
const { email } = req.body;
if (!email) {
  return res.status(400).json({ error: "E-mail requis." });
}

// Réponse volontairement identique que le compte existe ou non
// (évite de révéler quels e-mails sont inscrits sur le site).
const reponseGenerique = {
  message: "Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé.",
};

const user = await User.findByEmail(email.toLowerCase().trim());
if (!user) {
  return res.json(reponseGenerique);
}

const token  = crypto.randomBytes(32).toString("hex");
const expire = new Date(Date.now() + 60 * 60 * 1000); // valable 1h

await User.setResetToken(user.email, token, expire);

const lienReset = `${process.env.FRONTEND_URL || "https://proinsertionci.netlify.app"}/auth/reset-password.html?token=${token}`;

try {
  await require("../services/email").envoyerResetMotDePasse(user, lienReset);
} catch (errEmail) {
  // L'échec d'envoi d'e-mail ne doit jamais faire planter la requête
  // ni révéler d'information au client — mais côté serveur ce log doit
  // être impossible à rater dans les logs Render, car c'est la SEULE
  // trace disponible d'un e-mail de reset qui n'est jamais parti.
  console.error(
    `❌❌❌ ÉCHEC ENVOI E-MAIL RÉINITIALISATION (utilisateur ne recevra rien) — destinataire : ${user.email} — ${errEmail.message}`,
  );
}

res.json(reponseGenerique);

} catch (err) {
console.error("Erreur forgotPassword :", err.message);
res.status(500).json({ error: "Erreur lors de la demande de réinitialisation." });
}
};

// ════════════════════════════════════════════════════════════
//  Mot de passe oublié — étape 2 : définir le nouveau mot de passe
// ════════════════════════════════════════════════════════════
const resetPassword = async (req, res) => {
try {
const { token, password } = req.body;
if (!token || !password) {
  return res.status(400).json({ error: "Token et nouveau mot de passe requis." });
}
if (password.length < 8) {
  return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
}

const user = await User.findByResetToken(token);
if (!user) {
  return res.status(400).json({ error: "Lien invalide ou expiré. Refais une demande de réinitialisation." });
}

const passwordHash = await bcrypt.hash(password, 12);
await User.resetPassword(user.id, passwordHash);

res.json({ message: "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter." });

} catch (err) {
console.error("Erreur resetPassword :", err.message);
res.status(500).json({ error: "Erreur lors de la réinitialisation du mot de passe." });
}
};

// ── POST /api/auth/verify-email — confirme l'adresse via le lien reçu ──
const verifyEmail = async (req, res) => {
  try {
    const jeton = req.body && req.body.token;
    if (typeof jeton !== "string" || jeton.length < 20 || jeton.length > 200) {
      return res.status(400).json({ error: "Lien invalide." });
    }
    const u = await User.confirmerEmail(jeton);
    if (!u) return res.status(400).json({ error: "Lien invalide ou expiré. Demandez un nouvel e-mail de confirmation depuis votre espace." });
    require("../services/sessionUtilisateur").oublier(u.id);
    res.json({ message: "Adresse e-mail confirmée. Merci !" });
  } catch (err) {
    console.error("Erreur verifyEmail :", err.message);
    res.status(500).json({ error: "Erreur lors de la confirmation." });
  }
};

// ── POST /api/auth/resend-verification (connecté) ──
const resendVerification = async (req, res) => {
  try {
    if (await User.emailVerifie(req.user.id)) return res.json({ message: "Votre adresse est déjà confirmée." });
    const u = await User.renouvelerVerification(req.user.id);
    if (!u) return res.status(429).json({ error: "Un e-mail vient d'être envoyé. Patientez une minute avant de redemander." });
    envoyerLienVerification(u);
    res.json({ message: "E-mail de confirmation renvoyé. Pensez à vérifier vos courriers indésirables." });
  } catch (err) {
    console.error("Erreur resendVerification :", err.message);
    res.status(500).json({ error: "Erreur lors de l'envoi." });
  }
};

// ── DELETE /api/auth/account — suppression du compte par son titulaire ──
// Exige le mot de passe (un jeton volé ne suffit pas). Les comptes
// administrateur ne peuvent pas être supprimés ici (évite de perdre
// l'accès à l'administration par erreur).
const supprimerMonCompte = async (req, res) => {
  try {
    const { password, confirmation } = req.body || {};
    if (typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Mot de passe requis pour supprimer votre compte." });
    }
    if (confirmation !== "SUPPRIMER") {
      return res.status(400).json({ error: "Tapez SUPPRIMER pour confirmer." });
    }
    if (req.user.role === "admin") {
      return res.status(403).json({ error: "Un compte administrateur ne peut pas être supprimé ici." });
    }
    const user = await User.findByEmail(req.user.email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(403).json({ error: "Mot de passe incorrect." }); // 403 : un 401 déconnecterait le navigateur
    }
    await User.delete(req.user.id);
    console.log(`🗑️  Compte supprimé à la demande de son titulaire (id ${req.user.id})`);
    res.json({ message: "Votre compte et vos données personnelles ont été supprimés." });
  } catch (err) {
    console.error("Erreur supprimerMonCompte :", err.message);
    res.status(500).json({ error: "Erreur lors de la suppression du compte." });
  }
};

// ── POST /api/auth/logout-all — déconnecte tous les appareils ──
const logoutAll = async (req, res) => {
  try {
    await User.deconnecterPartout(req.user.id);
    const compte = await User.findById(req.user.id);
    const token = genererToken({ id: compte.id, email: compte.email, nom: compte.nom, role: compte.role, premium: compte.premium });
    res.json({ message: "Tous vos autres appareils ont été déconnectés.", token });
  } catch (err) {
    console.error("Erreur logoutAll :", err.message);
    res.status(500).json({ error: "Erreur lors de la déconnexion." });
  }
};

module.exports = { supprimerMonCompte, logoutAll, verifyEmail, resendVerification, register, login, me, logout, changePassword, forgotPassword, resetPassword };