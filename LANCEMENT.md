# Guide de lancement — ProInsertion

Déploiement actuel : **backend sur Render** (service gratuit, sans accès Shell),
**frontend sur Netlify**, base **PostgreSQL**. Tout se fait depuis GitHub et les
tableaux de bord Render / Netlify : aucune console n'est nécessaire.

---

## 1. Mettre à jour le code

1. Sur GitHub, dépose les fichiers modifiés dans le bon dépôt
   (`educoncoursci-backend` ou `educoncoursci-frontend`), en gardant les chemins.
2. Render et Netlify redéploient automatiquement à chaque commit.
3. Vérifie le déploiement : Render → onglet **Logs** (aucune erreur rouge au
   démarrage) et ouvre `https://<ton-backend>.onrender.com/api/health`.

## 2. Variables d'environnement (Render → Environment)

**Obligatoires** (le serveur ne démarre pas ou personne ne peut se connecter sans elles) :
`DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_URL`
(`FRONTEND_URL` doit être exactement l'URL Netlify, sinon le site ne peut pas appeler l'API).

**Importantes** :
- `ANTHROPIC_API_KEY` — CV, lettres, assistant et générateur de QCM par IA.
- `BREVO_API_KEY` et `EMAIL_FROM` — e-mails (alertes de paiement, confirmations).
  `ADMIN_EMAIL` reçoit l'alerte à chaque nouveau paiement à valider.
- `WAVE_NUMERO`, `OM_NUMERO` (et `MTN_NUMERO`, `MOOV_NUMERO` si utilisés) — numéros affichés pour le paiement manuel.
- `WAVE_API_KEY` et `WAVE_WEBHOOK_SECRET` — uniquement si tu actives le paiement Wave automatique.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — envoi de PDF, photos et vidéos.

**Optionnelles** : `QCM_IA_MAX_PAR_JOUR` (30 par défaut), `ACADEMIE_IA_MAX_PAR_JOUR` (40 par défaut), `QUOTA_IA_GRATUIT_JOUR`,
`CLAUDE_MODEL_QCM`, `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` + `EMPLOI_FLUX_URLS`
(détection automatique d'offres d'emploi), `CINETPAY_*` (inactif tant que le compte n'est pas ouvert).

Après toute modification de variable, Render redémarre le service.

## 3. À savoir sur l'hébergement gratuit Render

- Le service **se met en veille** après une période sans visite : le premier chargement est lent.
- Les tâches planifiées (rappels de clôture, mise à jour des statuts de concours,
  détection de nouveaux concours/offres, actualités) **ne tournent que lorsque le service est réveillé**.
  Pour une plateforme avec de vrais utilisateurs, un plan payant ou un service de
  « ping » régulier évite ce problème.

## 4. Paiements (validation manuelle)

1. Le client paie par Wave ou Orange Money et saisit l'identifiant de transaction sur la page Boutique.
2. Tu reçois un e-mail d'alerte (via `ADMIN_EMAIL`).
3. Vérifie la réception des fonds, puis valide ou rejette dans **/admin/paiements.html**.
   Le client est prévenu par e-mail dans les deux cas.

## 5. Alimenter le contenu (sans console)

- **Concours** : **/admin/concours** (ajout, modification, dates ; onglet *Sources & Suggestions*
  pour valider les concours détectés). Les statuts (ouvert, à venir, fermé) se calculent
  automatiquement à partir des dates d'ouverture et de clôture.
  Vérifie toujours les dates sur la source officielle (ex. fonctionpublique.gouv.ci) avant de publier.
- **QCM** : **/admin/qcm-ia.html** — génère des brouillons avec l'IA, relis chaque
  question, puis publie. Rien n'est visible du public avant ta validation.
- **Académie** : **/admin/academie.html** — génère le plan d'un cours avec l'IA, rédige
  chaque leçon (texte, points clés, exercices) avec l'IA, relis, puis publie.
  Les premières leçons de chaque cours sont gratuites (réglable), la suite est Premium.
  Les tables sont créées automatiquement au démarrage. Public : `/academie.html`.
  Le lien « Académie » n'est volontairement pas dans le menu du site : ajoute-le
  (`js/layout.js`) une fois quelques cours publiés.
- **Tarifs et produits** : **/admin/tarifs.html**. Toute la grille ProInsertion (CV, lettres, packs,
  entretiens, documents, accompagnement, abonnement, offres recruteurs) est enregistrée avec son
  identifiant, sa catégorie, sa description et son prix fixe. Tu modifies noms, descriptions et prix
  sans toucher au code ; tes modifications ne sont jamais écrasées au redémarrage. Un produit n'apparaît
  sur l'accueil (section « Nos tarifs ») que s'il est **actif** : active-le quand le service est prêt.
- **Offres soumises par les entreprises** : **/admin/offres-soumises.html**.
  Une entreprise inscrite remplit `/publier-offre.html` ; tu reçois un e-mail d'alerte (`ADMIN_EMAIL`).
  Tu étudies la demande, tu peux corriger le texte, tu convens du tarif avec l'entreprise (hors site :
  Wave / Orange Money), puis tu cliques **Publier** : l'offre apparaît sur la page Emploi et l'entreprise
  est prévenue par e-mail. Tu enregistres le tarif et l'encaissement pour suivre tes revenus
  (cartes « Encaissé » et « À encaisser »). Les candidats postulent directement chez l'entreprise
  (lien, ou bouton « Postuler par e-mail »). Les tables sont créées automatiquement au démarrage.
- **Actualités, offres d'emploi, PDF, vidéos** : pages correspondantes du menu admin.

## 6. Réseaux sociaux et statistiques de visite (frontend)

Tout se règle en un seul endroit : le bloc **`window.SITE_CONFIG`**, tout en haut de
`js/layout.js` (dépôt frontend).

- **Réseaux sociaux** : colle l'adresse complète (qui commence par `https://`) de ta
  chaîne WhatsApp, de ta page Facebook, de ton compte TikTok, etc. Seuls les liens
  renseignés apparaissent dans le pied de page ; l'accueil affiche en plus un bandeau
  « Rejoindre la chaîne WhatsApp » si `whatsappChaine` est rempli.
- **Statistiques** : renseigne `analytics`.
  - Cloudflare Web Analytics (sans cookies, recommandé) : `fournisseur: "cloudflare"`
    et `id` = le jeton fourni par Cloudflare pour ton site.
  - Google Analytics : `fournisseur: "ga4"` et `id` = l'identifiant `G-XXXXXXXXXX`.
  Tant que ces champs sont vides, aucun suivi n'est actif.
- Après modification, commit sur GitHub : Netlify redéploie seul.

## 7. Sécurité : ce qui est en place et ce que tu dois faire

**Déjà en place dans le code**
- Seuls les inscrits accèdent à leur compte, leurs CV, paiements et scores ; l'administration est
  réservée au rôle admin, **revérifié en base à chaque appel** (un admin supprimé ou rétrogradé
  perd l'accès immédiatement).
- Session administrateur limitée à 12 h ; le jeton temporaire de la double authentification
  (2FA) ne peut plus servir de session.
- Protection contre la devinette de mot de passe **compte par compte** (8 échecs = blocage 15 min),
  sans pénaliser les abonnés qui partagent une même adresse IP mobile.
- Noms et e-mails vérifiés à l'inscription (les caractères servant à injecter du code sont refusés) ;
  les textes sont échappés dans l'espace admin et le classement ; mot de passe de 8 caractères minimum.
- Les détails techniques des erreurs serveur ne sont visibles que par l'admin.
- Le contenu importé depuis l'extérieur (flux RSS d'actualités, d'emplois et de concours) est nettoyé
  à l'arrivée : balises HTML retirées, seuls les liens `http(s)://` sont acceptés. À l'affichage,
  les textes de toutes les pages sont échappés et les liens/images passent par un contrôle d'adresse.
- Fichiers envoyés : l'extension est déduite du type accepté (plus de « photo.html »).
- Les pages publiques (concours, premières leçons) restent publiques : sinon ni Google ni tes
  futurs visiteurs ne les verraient. Seules les actions et données personnelles exigent un compte.

**À faire de ton côté (c'est là que se jouent la plupart des piratages)**
1. **Active la double authentification (2FA) sur ton compte admin du site** (page de profil), puis
   sur GitHub, Render, Netlify, Cloudflare, Brevo, Cloudinary et ton compte Anthropic.
2. Utilise un mot de passe long et unique pour chacun de ces comptes (un gestionnaire de mots
   de passe aide).
3. Dans GitHub, Render et Netlify : ne garde comme membres que les personnes qui en ont besoin ;
   dépôts en **privé**.
4. Si une personne a eu accès à tes dépôts ou tableaux de bord et ne doit plus l'avoir :
   retire son accès, puis change `JWT_SECRET` (cela déconnecte tout le monde), le mot de passe de la
   base de données et les clés API (Anthropic, Brevo, Cloudinary, Wave).
5. `JWT_SECRET` doit être une longue chaîne aléatoire (32 caractères ou plus).
6. Supprime la variable `DIAGNOSTIC_SECRET` de Render dès que tu n'en as plus besoin.
7. Dans la console Anthropic, **fixe un plafond de dépense mensuel** pour limiter les dégâts en cas d'abus.
8. N'écris jamais de clé ou de mot de passe dans le code ou dans un message : le code du site
   (frontend) est lisible par n'importe qui dans son navigateur.

## 8. Test avant de communiquer publiquement

1. Crée un compte test, génère un CV et une lettre, télécharge le PDF et le Word.
2. Fais un paiement test : alerte reçue, validation, e-mail de confirmation client.
3. Passe un QCM publié de bout en bout (correction, score).
4. Ouvre le site sur un téléphone : pages concours, boutique, CV.

## 9. Identité ProInsertion : ce qui a changé et ce qui reste à décider

- Le nom visible (menus, titres, e-mails, PDF, notifications, admin) est maintenant **ProInsertion**,
  avec le slogan « Votre avenir professionnel commence ici. ».
- **Volontairement inchangés** (les changer casserait le site) : l'adresse `educoncoursci.netlify.app`,
  les noms des dépôts GitHub et du service Render, le dossier Cloudinary `educoncoursci/`.
- Les adresses e-mail `support@proinsertionci.ci` et `noreply@educoncoursci.ci` sont conservées : à
  remplacer le jour où tu auras ton propre nom de domaine ProInsertion.
- **Service worker** : le nom du cache est passé à `proinsertion-v3`. À chaque déploiement qui modifie
  `js/api.js`, `js/auth.js`, `js/main.js`, `index.html` ou les feuilles de style, incrémente ce numéro
  dans `sw.js` (v4, v5…), sinon les visiteurs déjà venus continuent de voir l'ancienne version.
- Pour changer l'adresse du site : Netlify → *Domain management* (renommer le site ou brancher un
  domaine). Après cela, mets à jour `FRONTEND_URL` sur Render et les adresses du `sitemap.xml`.

## 10. Ce qui n'est pas bloquant

- CinetPay (en attente d'un compte entreprise), SMS, WhatsApp API, notifications push.
- Nom de domaine personnalisé : l'URL Netlify fonctionne très bien pour démarrer.

## Vérifications après chaque déploiement

1. `npm ls multer` doit afficher `multer@2.0.2`, et le serveur doit démarrer sans erreur.
2. Envoyez une photo de profil, un PDF (administration) et une offre en PDF (analyse d'offre) ; essayez aussi un fichier refusé (.txt, ou image de plus de 5 Mo) : un message clair doit s'afficher.
3. Créez un compte test : l'e-mail de confirmation doit arriver (`FRONTEND_URL` doit être défini) et le lien doit confirmer l'adresse. Tant qu'elle n'est pas confirmée, le paiement est refusé.
4. Effectuez un petit paiement réel et vérifiez que le compte passe en premium.
5. Les comptes créés avant la vérification d'e-mail sont considérés comme vérifiés.
6. Page « Examen blanc » : terminez une épreuve de 5 questions ou plus ; le score affiché est calculé par le serveur et apparaît dans « Mes scores ».
7. Bibliothèque : téléchargez un PDF gratuit et un PDF Premium (compte abonné), puis testez l'export des utilisateurs en administration : le fichier doit se télécharger sans que le jeton apparaisse dans l'adresse.
8. Profil → « Déconnecter les autres appareils » : connectez-vous sur deux navigateurs, utilisez le bouton sur l'un, l'autre doit demander de se reconnecter.

## Boutiques d'applications
- Page publique de suppression de compte : /supprimer-compte.html (renseigner CONTACT_EMAIL).
- Bouton « Installer l'application » : pied de page et accueil.
- Android : coller l'empreinte SHA-256 dans .well-known/assetlinks.json après création du compte Play.
- Fiche pas à pas : kit-boutiques/FICHE-BOUTIQUES.md.

## Déploiement GitHub → Render (à lire)
- Le dépôt doit contenir TOUS les fichiers du ZIP, y compris les nouveaux (ex. services/sessionUtilisateur.js, services/cvDesign.js, services/cvStructure.js, middleware/*). Une erreur « Cannot find module » signifie qu'un fichier n'a pas été ajouté : `git add -A` puis `git commit` puis `git push`.
- Versionnez aussi package-lock.json (créé par `npm install`).
- Modèles de CV avec photo : config/modelesCv.js (30 modèles : 5 mises en page × 6 couleurs).
- Modèles de CV : 5 mises en page (Latéral, Prestige, Classique, Élégant, Moderne) × 6 couleurs (Bleu marine, Anthracite, Bleu pétrole, Vert forêt, Bordeaux, Ardoise : couleurs sobres à fort contraste ; la couleur s’applique aussi à la présentation Sobre). Pour ajouter une couleur : une ligne dans PALETTES_DESIGN (config/modelesCv.js).
