# Guide de lancement — EduConcoursCI

Toi : déploiement déjà en place (Railway pour le backend, Netlify pour
le frontend, connectés à GitHub). Ce guide couvre donc uniquement la
mise à jour de ce déploiement existant avec le code le plus récent,
pas une création depuis zéro.

CinetPay est volontairement laissé de côté pour l'instant, le temps
d'obtenir le registre de commerce — voir la section dédiée plus bas.
Le site reste pleinement fonctionnel sans, grâce au mode de paiement
manuel (Wave/Orange/MTN/Moov) déjà intégré.

---

## Étape 1 — Mettre à jour le code sur GitHub

1. Remplace le contenu de ton dépôt backend par les fichiers du zip
   `educoncoursci-backend-LOT18.zip`, remplace le contenu de ton dépôt
   frontend par ceux de `educoncoursci-frontend-LOT18.zip`.
2. `git add . && git commit -m "..." && git push` sur chacun des deux
   dépôts. Railway et Netlify redéploient automatiquement à chaque
   push — rien à faire de plus de ce côté.

---

## Étape 2 — Vérifier les variables sur Railway

Rien à recréer, juste à vérifier que ce qui existe est complet.
Va sur ton service backend Railway → onglet "Variables" et compare
avec `.env.example` (fourni dans le zip backend) :

- `DATABASE_URL` — normalement déjà présente si tu as une base
  PostgreSQL reliée au projet.
- `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — doivent déjà exister
  si le site tournait avant. Ne les change pas sans raison : changer
  `JWT_SECRET` déconnecte tous les utilisateurs déjà connectés.
- `FRONTEND_URL` — doit correspondre exactement à ton URL Netlify
  réelle (sans slash final), sinon les appels API depuis le site
  seront bloqués par CORS.
- Numéros de paiement manuel — voir étape 4 ci-dessous.

Si une variable manque, ajoute-la puis redéploie (Railway le fait
souvent automatiquement dès qu'une variable change).

---

## Étape 3 — Vérifier que le backend redémarre proprement

Après le push, va dans Railway → onglet "Deployments" → vérifie que
le déploiement passe au vert. Les nouvelles colonnes de base de
données (comme `date_verifiee`, ajoutée dans cette mise à jour) se
créent **automatiquement** au démarrage — rien à migrer à la main,
`initDatabase()` s'en charge à chaque lancement du serveur.

En cas d'échec, regarde les logs du déploiement : la cause la plus
fréquente est une variable d'environnement manquante.

---

## Étape 4 — Renseigner tes numéros de paiement manuel

C'est le point qui te permet d'encaisser dès maintenant, sans
attendre CinetPay. Dans les Variables Railway, renseigne ce que tu as
déjà (inutile d'attendre d'avoir les quatre) :

```
WAVE_NUMERO=
WAVE_LIEN_PAIEMENT=     (optionnel — un lien Wave Business si tu en as un)
OM_NUMERO=
MTN_NUMERO=
MOOV_NUMERO=
```

Ce sont tes numéros marchands personnels/professionnels sur chaque
service. Dès qu'un numéro est renseigné, l'option correspondante
apparaît automatiquement sur `/paiement.html` — pas besoin de
toucher au code.

Le parcours pour l'utilisateur : il choisit son plan et son opérateur,
paie au numéro affiché, saisit l'identifiant de transaction reçu par
SMS, puis toi (admin) valides depuis `/admin/paiements` — l'abonnement
Premium s'active à ce moment-là.

---

## Étape 5 — CinetPay, à faire plus tard

Quand ton registre de commerce sera prêt : crée un compte sur
https://cinetpay.com (section "Devenir marchand"), puis renseigne
dans Railway :

```
CINETPAY_API_KEY=
CINETPAY_SITE_ID=
CINETPAY_NOTIFY_URL=https://<ton-backend>.up.railway.app/api/payment/cinetpay/webhook
CINETPAY_RETURN_URL=https://<ton-frontend>.netlify.app/dashboard/paiements.html
```

Dès que ces deux clés sont présentes, le bouton "Payer en ligne par
carte bancaire" apparaît tout seul sur la page de paiement, en plus
du mode manuel qui continue de fonctionner. Aucune autre action de
ta part, aucun redéploiement de code nécessaire — uniquement ces
variables à ajouter.

---

## Étape 6 — Peupler la bibliothèque de concours (si pas déjà fait)

Si ta base ne contient pas encore les concours de départ, lance une
fois, via le Shell Railway de ton service backend (ou en local avec
ton `.env` pointant vers la base de production) :

```
npm run concours:seed
```

Ça ajoute 23 concours (ENA, CAFOP, INFAS, Police, etc.) avec des
dates estimées. Ensuite, sur `/admin/concours`, le bouton
"⚠️ Dates à vérifier" te montre lesquelles corriger au fil des vrais
communiqués officiels.

---

## Étape 7 — Test avant de communiquer publiquement

1. Ouvre le site depuis ton URL Netlify, vérifie que les pages
   concours s'affichent bien (signe que le lien avec Railway
   fonctionne).
2. Fais toi-même un paiement test avec le circuit manuel : choisis
   un plan, un opérateur, entre un faux ID de transaction, vérifie
   que ça apparaît bien dans `/admin/paiements` pour validation.
3. Valide ce paiement test depuis l'admin, vérifie que le compte
   passe bien en Premium.

---

## Ce qui n'est pas bloquant

- CinetPay (voir étape 5) — le mode manuel suffit pour démarrer.
- Clé Anthropic (assistant IA) — le reste du site fonctionne sans.
- Clés Google Search, SMS, WhatsApp, notifications push — tout ça
  peut être ajouté progressivement après le lancement.
- Nom de domaine personnalisé — l'URL Netlify actuelle fonctionne
  très bien pour démarrer et valider le marché.
