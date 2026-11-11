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
//  - Le compteur est en mémoire : il repart à zéro si le service
//    redémarre (acceptable ; la limite par IP reste en complément).
// ============================================================

const MAX_ECHECS = 8;
const FENETRE_MS = 15 * 60 * 1000;
const MAX_ENTREES = 5000;

const echecs = new Map(); // email → { n, debut }

function cle(req) {
  return String(req.body?.email ?? "").toLowerCase().trim().slice(0, 254);
}

function purger() {
  if (echecs.size <= MAX_ENTREES) return;
  const maintenant = Date.now();
  for (const [k, v] of echecs) {
    if (maintenant - v.debut > FENETRE_MS) echecs.delete(k);
  }
  // Toujours trop plein : on retire les plus anciennes entrées
  while (echecs.size > MAX_ENTREES) {
    echecs.delete(echecs.keys().next().value);
  }
}

function limiteConnexionParEmail(req, res, next) {
  if (req.method !== "POST") return next();
  const k = cle(req);
  if (!k) return next();

  const maintenant = Date.now();
  let entree = echecs.get(k);
  if (entree && maintenant - entree.debut > FENETRE_MS) {
    echecs.delete(k);
    entree = undefined;
  }

  if (entree && entree.n >= MAX_ECHECS) {
    const minutes = Math.max(1, Math.ceil((FENETRE_MS - (maintenant - entree.debut)) / 60000));
    res.set("Retry-After", String(minutes * 60));
    return res.status(429).json({
      error: `Trop de tentatives pour ce compte. Réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
    });
  }

  res.on("finish", () => {
    if (res.statusCode === 401) {
      const courant = echecs.get(k);
      if (courant && Date.now() - courant.debut <= FENETRE_MS) courant.n += 1;
      else echecs.set(k, { n: 1, debut: Date.now() });
      purger();
    } else if (res.statusCode < 400) {
      echecs.delete(k);
    }
  });
  next();
}

module.exports = { limiteConnexionParEmail, MAX_ECHECS, _reinitialiser: () => echecs.clear() };
