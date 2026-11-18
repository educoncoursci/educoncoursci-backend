// ============================================================
//  middleware/limiteConnexion.js
//  Protection contre les tentatives de devinette de mot de passe,
//  COMPTE PAR COMPTE (par adresse e-mail).
//
//  Pourquoi par e-mail et non par adresse IP : sur les réseaux mobiles
//  d'Afrique de l'Ouest, des milliers d'abonnés partagent la même
//  adresse IP publique. Limiter par IP bloquerait des utilisateurs
//  honnêtes ; limiter par compte protège chaque compte sans pénaliser
//  les autres.
//
//  - Seuls les ÉCHECS (réponse 401) sont comptés.
//  - Après MAX_ECHECS échecs dans la fenêtre, le compte est bloqué
//    quelques minutes (même avec le bon mot de passe).
//  - Une connexion réussie remet le compteur à zéro.
//  - Le compteur est stocké en base PostgreSQL : il survit aux
//    redémarrages et aux déploiements, et reste exact même si le
//    service tourne sur plusieurs instances.
//  - Si la base est momentanément injoignable, la limite par compte
//    est suspendue (la limite par IP du serveur reste active) plutôt
//    que de bloquer toutes les connexions.
// ============================================================

const { query } = require("../config/database");

const MAX_ECHECS = 8;
const FENETRE_MIN = 15;
const FENETRE_MS = FENETRE_MIN * 60 * 1000;

function cle(req) {
  return String(req.body?.email ?? "").toLowerCase().trim().slice(0, 254);
}

let dernierePurge = 0;
async function purger() {
  if (Date.now() - dernierePurge < 10 * 60 * 1000) return;
  dernierePurge = Date.now();
  await query(`DELETE FROM tentatives_connexion WHERE debut < NOW() - INTERVAL '${FENETRE_MIN} minutes'`);
}

async function limiteConnexionParEmail(req, res, next) {
  if (req.method !== "POST") return next();
  const k = cle(req);
  if (!k) return next();

  try {
    const r = await query(
      `SELECT n, EXTRACT(EPOCH FROM (NOW() - debut)) * 1000 AS ecoule_ms
         FROM tentatives_connexion WHERE cle = $1`,
      [k],
    );
    const e = r.rows[0];
    if (e && Number(e.ecoule_ms) <= FENETRE_MS && e.n >= MAX_ECHECS) {
      const minutes = Math.max(1, Math.ceil((FENETRE_MS - Number(e.ecoule_ms)) / 60000));
      res.set("Retry-After", String(minutes * 60));
      return res.status(429).json({
        error: `Trop de tentatives pour ce compte. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
      });
    }
  } catch (err) {
    console.error("limiteConnexion (lecture) :", err.message);
    return next();
  }

  res.on("finish", () => {
    const enregistrer = async () => {
      if (res.statusCode === 401) {
        // Incrément atomique : une fenêtre expirée repart à 1
        await query(
          `INSERT INTO tentatives_connexion (cle, n, debut) VALUES ($1, 1, NOW())
           ON CONFLICT (cle) DO UPDATE SET
             n     = CASE WHEN tentatives_connexion.debut < NOW() - INTERVAL '${FENETRE_MIN} minutes' THEN 1 ELSE tentatives_connexion.n + 1 END,
             debut = CASE WHEN tentatives_connexion.debut < NOW() - INTERVAL '${FENETRE_MIN} minutes' THEN NOW() ELSE tentatives_connexion.debut END`,
          [k],
        );
        await purger();
      } else if (res.statusCode < 400) {
        await query(`DELETE FROM tentatives_connexion WHERE cle = $1`, [k]);
      }
    };
    enregistrer().catch((err) => console.error("limiteConnexion (écriture) :", err.message));
  });
  next();
}

module.exports = {
  limiteConnexionParEmail,
  MAX_ECHECS,
  _reinitialiser: () => query(`DELETE FROM tentatives_connexion`),
};
