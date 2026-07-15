// ============================================================
//  middleware/admin.js
//  Vérifie que l'utilisateur connecté est admin.
//  Doit être utilisé APRÈS le middleware auth.
//  Usage : router.post("/concours", auth, admin, controller)
// ============================================================

const admin = (req, res, next) => {
if (!req.user) {
return res.status(401).json({
error: "Accès refusé. Connecte-toi pour continuer."
});
}

if (req.user.role !== "admin") {
return res.status(403).json({
error: "Accès refusé. Droits administrateur requis."
});
}

next();
};

module.exports = admin;