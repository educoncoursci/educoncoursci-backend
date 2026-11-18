// ============================================================
//  services/sessionUtilisateur.js
//  Le jeton de connexion prouve QUI est l'utilisateur, mais ses
//  droits (rôle, Premium) peuvent avoir changé depuis sa création.
//  Ce service relit l'état réel en base (avec un cache de 30 s
//  pour ne pas charger la base) :
//   - compte supprimé  → session refusée
//   - mot de passe changé après l'émission du jeton → refusée
//   - rôle et Premium toujours à jour (Premium expiré = non Premium)
// ============================================================
const { query } = require("../config/database");

const TTL_MS = 30 * 1000;
const MAX = 5000;
const cache = new Map(); // id → { t, etat }

function jourAbidjan() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Abidjan" }).format(new Date());
}

async function etatUtilisateur(id) {
  const c = cache.get(id);
  if (c && Date.now() - c.t < TTL_MS) return c.etat;
  const r = await query(
    `SELECT role, premium, premium_expire, password_changed_at FROM users WHERE id = $1`,
    [id],
  );
  let etat = null;
  if (r.rows[0]) {
    const u = r.rows[0];
    const exp = u.premium_expire ? new Date(u.premium_expire).toISOString().slice(0, 10) : null;
    etat = {
      role: u.role,
      premium: !!u.premium && (!exp || exp >= jourAbidjan()),
      changeLe: u.password_changed_at ? new Date(u.password_changed_at).getTime() : 0,
    };
  }
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(id, { t: Date.now(), etat });
  return etat;
}

// Retourne l'utilisateur à jour, ou null si la session n'est plus valable.
async function verifier(decoded) {
  const etat = await etatUtilisateur(decoded.id);
  if (!etat) return null;
  if (etat.changeLe && decoded.iat && decoded.iat * 1000 < etat.changeLe - 1000) return null;
  return { ...decoded, role: etat.role, premium: etat.premium };
}

function oublier(id) { cache.delete(Number(id)); cache.delete(id); }

module.exports = { verifier, oublier };
