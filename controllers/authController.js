// ============================================================
//  controllers/authController.js
//  Inscription, connexion, déconnexion, profil connecté.
// ============================================================

const bcrypt = require(“bcryptjs”);
const jwt    = require(“jsonwebtoken”);
const User   = require(”../models/User”);

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
{ expiresIn: process.env.JWT_EXPIRES_IN || “7d” }
);
}

// ── POST /api/auth/register ───────────────────────────────────
const register = async (req, res) => {
try {
const { nom, email, password } = req.body;

```
// Validation des champs
if (!nom || !email || !password) {
  return res.status(400).json({
    error: "Nom, e-mail et mot de passe sont requis."
  });
}
if (password.length < 6) {
  return res.status(400).json({
    error: "Le mot de passe doit contenir au moins 6 caractères."
  });
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
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

res.status(201).json({
  message: "Compte créé avec succès. Bienvenue sur EduConcoursCI !",
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
```

} catch (err) {
console.error(“Erreur register :”, err.message);
res.status(500).json({ error: “Erreur lors de la création du compte.” });
}
};

// ── POST /api/auth/login ──────────────────────────────────────
const login = async (req, res) => {
try {
const { email, password } = req.body;

```
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

// Vérifier si le Premium a expiré
let premium = user.premium;
if (premium && user.premium_expire) {
  const expire = new Date(user.premium_expire);
  if (expire < new Date()) {
    // Premium expiré — on le désactive automatiquement
    await User.setPremium(user.id, {
      premium: false,
      plan:    null,
      expire:  null,
    });
    premium = false;
  }
}

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
  },
});
```

} catch (err) {
console.error(“Erreur login :”, err.message);
res.status(500).json({ error: “Erreur lors de la connexion.” });
}
};

// ── GET /api/auth/me ──────────────────────────────────────────
const me = async (req, res) => {
try {
const user = await User.findById(req.user.id);
if (!user) {
return res.status(404).json({ error: “Utilisateur introuvable.” });
}

```
res.json({
  user: {
    id:             user.id,
    nom:            user.nom,
    email:          user.email,
    role:           user.role,
    premium:        user.premium,
    premium_plan:   user.premium_plan,
    premium_expire: user.premium_expire,
    date_inscription: user.date_inscription,
    favoris:  JSON.parse(user.favoris_json  || "[]"),
    scores:   JSON.parse(user.scores_json   || "[]"),
  },
});
```

} catch (err) {
console.error(“Erreur me :”, err.message);
res.status(500).json({ error: “Erreur lors de la récupération du profil.” });
}
};

// ── POST /api/auth/logout ─────────────────────────────────────
// Côté serveur il n’y a rien à faire (JWT stateless).
// Le client doit supprimer le token de son localStorage.
const logout = (req, res) => {
res.json({ message: “Déconnexion réussie.” });
};

// ── POST /api/auth/change-password ───────────────────────────
const changePassword = async (req, res) => {
try {
const { ancienPassword, nouveauPassword } = req.body;

```
if (!ancienPassword || !nouveauPassword) {
  return res.status(400).json({
    error: "Ancien et nouveau mot de passe requis."
  });
}
if (nouveauPassword.length < 6) {
  return res.status(400).json({
    error: "Le nouveau mot de passe doit contenir au moins 6 caractères."
  });
}

// Récupérer l'utilisateur avec son hash
const user = await User.findByEmail(req.user.email);
const correct = await bcrypt.compare(ancienPassword, user.password_hash);
if (!correct) {
  return res.status(401).json({
    error: "Ancien mot de passe incorrect."
  });
}

const newHash = await bcrypt.hash(nouveauPassword, 12);
await require("../config/database").query(
  "UPDATE users SET password_hash = $1 WHERE id = $2",
  [newHash, req.user.id]
);

res.json({ message: "Mot de passe modifié avec succès." });
```

} catch (err) {
console.error(“Erreur changePassword :”, err.message);
res.status(500).json({ error: “Erreur lors du changement de mot de passe.” });
}
};

module.exports = { register, login, me, logout, changePassword };