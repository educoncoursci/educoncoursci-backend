// ============================================================
//  controllers/statsController.js
//  Mesure d'audience INTÉGRÉE, respectueuse de la vie privée :
//   - aucun cookie, aucune adresse IP ni user-agent enregistrés
//   - le visiteur n'est reconnu que par une empreinte (HMAC) qui CHANGE
//     CHAQUE JOUR : impossible de le suivre d'un jour à l'autre
//   - signal « Do Not Track » / Global Privacy Control respecté
//   - robots d'indexation ignorés ; pages d'administration jamais comptées
//   - conservation limitée (voir services/statsNettoyage.js)
// ============================================================
const crypto = require("crypto");
const { query } = require("../config/database");

const REGEX_ROBOTS = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch|preview|facebookexternalhit/i;
const REGEX_CHEMIN = /^\/[A-Za-z0-9\-_\/.]{0,79}$/;
const REGEX_SOURCE = /^[a-z0-9_-]{1,30}$/;
const PERIODES = [7, 30, 90];

const jourCourant = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Abidjan" }).format(new Date());

function classerSource(referent, hoteSite) {
  if (!referent) return "direct";
  let h;
  try { h = new URL(String(referent).slice(0, 300)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "direct"; }
  if (hoteSite && h === hoteSite) return "interne";
  if (/(^|\.)(google|bing|yahoo|duckduckgo|ecosia|qwant)\./.test(h)) return "recherche";
  if (/(^|\.)(facebook|fb|instagram)\.(com|me)$/.test(h) || h === "l.facebook.com" || h === "m.facebook.com") return "facebook";
  if (/(^|\.)(linkedin\.com|lnkd\.in)$/.test(h)) return "linkedin";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(h)) return "whatsapp";
  if (/(^|\.)(twitter\.com|x\.com|t\.co)$/.test(h)) return "x";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return "youtube";
  if (/(^|\.)tiktok\.com$/.test(h)) return "tiktok";
  return "autre";
}

function empreinteDuJour(req, jour) {
  const cle = `${process.env.JWT_SECRET || "stats"}|stats|${jour}`;
  return crypto.createHmac("sha256", cle).update(`${req.ip}|${req.get("user-agent") || ""}`).digest("hex").slice(0, 16);
}

// POST /api/stats/visite — anonyme, répond toujours 204 (jamais d'erreur visible)
exports.collecter = async (req, res) => {
  try {
    if (req.get("dnt") === "1" || req.get("sec-gpc") === "1") return res.status(204).end();
    if (REGEX_ROBOTS.test(req.get("user-agent") || "")) return res.status(204).end();
    const b = req.body || {};
    let chemin = typeof b.chemin === "string" ? b.chemin.split(/[?#]/)[0] : "";
    if (chemin === "/") chemin = "/index.html";
    if (!REGEX_CHEMIN.test(chemin) || chemin.includes("//") || chemin.includes("..") || chemin.startsWith("/admin")) return res.status(204).end();
    let source = null;
    if (b.entree === true) {
      source = typeof b.src === "string" && REGEX_SOURCE.test(b.src)
        ? b.src
        : classerSource(b.referent, (req.get("origin") || "").replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase());
      if (source === "interne") source = "direct";
    }
    const jour = jourCourant();
    await query(
      `INSERT INTO stats_hits (jour, chemin, source, visiteur, membre) VALUES ($1::date, $2, $3, $4, $5)`,
      [jour, chemin, source, empreinteDuJour(req, jour), b.membre === true],
    );
  } catch (err) {
    console.error("Erreur stats (collecte) :", err.message);
  }
  res.status(204).end();
};

// GET /api/admin/stats?jours=7|30|90 — réservé aux administrateurs
exports.tableauDeBord = async (req, res) => {
  try {
    const demande = parseInt(req.query.jours, 10);
    const jours = PERIODES.includes(demande) ? demande : 30;
    const depuis = `CURRENT_DATE - ($1::int - 1)`;
    const [parJour, totaux, pages, sources, inscrits, entonnoir] = await Promise.all([
      query(
        `SELECT to_char(j.d, 'YYYY-MM-DD') AS jour,
                COALESCE(COUNT(DISTINCT h.visiteur), 0)::int AS visiteurs,
                COUNT(h.id)::int AS pages_vues
           FROM generate_series(${depuis}, CURRENT_DATE, '1 day') AS j(d)
           LEFT JOIN stats_hits h ON h.jour = j.d::date
          GROUP BY j.d ORDER BY j.d`, [jours]),
      query(
        `SELECT COUNT(*)::int AS pages_vues,
                COUNT(DISTINCT (jour, visiteur))::int AS visiteurs_jour,
                COUNT(DISTINCT (jour, visiteur)) FILTER (WHERE membre)::int AS visiteurs_membres,
                COUNT(DISTINCT (jour, visiteur)) FILTER (WHERE NOT membre)::int AS visiteurs_anonymes
           FROM stats_hits WHERE jour >= ${depuis}`, [jours]),
      query(
        `SELECT chemin, COUNT(*)::int AS vues, COUNT(DISTINCT (jour, visiteur))::int AS visiteurs
           FROM stats_hits WHERE jour >= ${depuis}
          GROUP BY chemin ORDER BY vues DESC LIMIT 15`, [jours]),
      query(
        `SELECT source, COUNT(*)::int AS visites
           FROM stats_hits WHERE jour >= ${depuis} AND source IS NOT NULL
          GROUP BY source ORDER BY visites DESC LIMIT 12`, [jours]),
      query(
        `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS jour, COUNT(*)::int AS nb
           FROM users WHERE created_at::date >= ${depuis} GROUP BY 1 ORDER BY 1`, [jours]),
      query(
        `SELECT
           (SELECT COUNT(DISTINCT (jour, visiteur)) FROM stats_hits WHERE jour >= ${depuis} AND NOT membre)::int AS visiteurs,
           (SELECT COUNT(DISTINCT (jour, visiteur)) FROM stats_hits WHERE jour >= ${depuis} AND chemin = '/auth/register.html')::int AS page_inscription,
           (SELECT COUNT(*) FROM users WHERE created_at::date >= ${depuis})::int AS inscriptions`, [jours]),
    ]);
    res.json({
      jours,
      totaux: totaux.rows[0],
      par_jour: parJour.rows,
      pages: pages.rows,
      sources: sources.rows,
      inscriptions_par_jour: inscrits.rows,
      entonnoir: entonnoir.rows[0],
      note: "Un visiteur est compté une fois par jour (empreinte anonyme renouvelée chaque jour). Sans cookie, sans adresse IP conservée.",
    });
  } catch (err) {
    console.error("Erreur stats (tableau de bord) :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
