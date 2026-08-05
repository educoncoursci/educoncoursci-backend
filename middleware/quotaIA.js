// ============================================================
//  middleware/quotaIA.js
//  Limite le nombre d'appels IA (Claude) par jour pour les
//  utilisateurs non-Premium, pour éviter un usage abusif qui
//  facture directement l'API Anthropic sans contrepartie.
//  Les admins et les comptes Premium actifs ne sont pas limités.
//  Usage : router.post("/generate", auth, quotaIA("cv"), ctrl.generate)
// ============================================================

const { query } = require("../config/database");

const LIMITE_GRATUIT_JOUR = parseInt(process.env.QUOTA_IA_GRATUIT_JOUR) || 3;

function quotaIA(type) {
  return async (req, res, next) => {
    try {
      if (!req.user) return next(); // sécurité : le middleware auth doit passer avant

      if (req.user.role === "admin") return next();

      const userRes = await query(
        "SELECT premium, premium_expire FROM users WHERE id = $1",
        [req.user.id]
      );
      const user = userRes.rows[0];
      const estPremiumActif =
        user?.premium &&
        (!user.premium_expire || new Date(user.premium_expire) >= new Date());

      if (estPremiumActif) return next();

      const compteRes = await query(
        `SELECT COUNT(*) FROM ia_generations WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
        [req.user.id]
      );
      const compte = parseInt(compteRes.rows[0].count, 10);

      if (compte >= LIMITE_GRATUIT_JOUR) {
        return res.status(403).json({
          error: `Limite quotidienne de ${LIMITE_GRATUIT_JOUR} générations IA gratuites atteinte. Passe Premium pour un accès illimité.`,
          quotaAtteint: true,
          limite: LIMITE_GRATUIT_JOUR,
        });
      }

      // Enregistré avant l'appel IA : coûte la même chose que la génération
      // réussisse ou échoue côté Anthropic, donc c'est la limite qui compte
      // ici, pas le résultat exact — comportement volontairement prudent.
      await query(`INSERT INTO ia_generations (user_id, type) VALUES ($1, $2)`, [
        req.user.id,
        type,
      ]);

      next();
    } catch (err) {
      console.error("Erreur quotaIA :", err.message);
      // On ne bloque pas le service en cas d'erreur technique du quota
      next();
    }
  };
}

module.exports = quotaIA;
