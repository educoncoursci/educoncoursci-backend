// ============================================================
//  scripts/verifier-sources-rss.js
//  Vérifie qu'une ou plusieurs URLs sont bien de vrais flux RSS
//  fonctionnels, AVANT de les ajouter comme source dans
//  /admin/concours → Sources & Suggestions (ou dans la variable
//  d'environnement ACTUALITES_FLUX_URLS).
//
//  Pourquoi ce script existe : des URLs de flux RSS "plausibles"
//  (ex: https://www.fratmat.info/feed) peuvent sembler correctes
//  mais renvoyer une erreur 404 en production si le site a changé
//  de plateforme ou de structure — ça s'est déjà produit sur ce
//  projet. Ce script permet de le savoir AVANT de configurer quoi
//  que ce soit, plutôt que de le découvrir dans les logs de l'hébergeur
//  après coup.
//
//  Usage :
//    node scripts/verifier-sources-rss.js "https://exemple.com/feed"
//    node scripts/verifier-sources-rss.js "url1" "url2" "url3"
// ============================================================

const Parser = require("rss-parser");
const parser = new Parser({ timeout: 10000 });

const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.log("Usage : node scripts/verifier-sources-rss.js <url1> [url2] [url3] ...");
  console.log("\nExemple :");
  console.log('  node scripts/verifier-sources-rss.js "https://exemple.com/feed"');
  process.exit(1);
}

(async () => {
  console.log(`🔍 Vérification de ${urls.length} URL(s) de flux RSS…\n`);

  let valides = 0;

  for (const url of urls) {
    try {
      const flux = await parser.parseURL(url);
      const nbArticles = (flux.items || []).length;
      console.log(`✅ ${url}`);
      console.log(`   Titre du flux : ${flux.title || "(non précisé)"}`);
      console.log(`   Nombre d'articles trouvés : ${nbArticles}`);
      if (nbArticles > 0) {
        console.log(`   Exemple d'article le plus récent : "${flux.items[0].title}"`);
      } else {
        console.log(`   ⚠️  Flux valide mais vide — vérifie qu'il contient bien du contenu.`);
      }
      valides++;
    } catch (err) {
      console.log(`❌ ${url}`);
      console.log(`   Erreur : ${err.message}`);
      console.log(`   Ce n'est probablement pas un flux RSS valide, ou l'URL a changé.`);
    }
    console.log("");
  }

  console.log(`${"=".repeat(50)}`);
  console.log(`${valides}/${urls.length} URL(s) confirmée(s) comme flux RSS fonctionnels.`);
  if (valides < urls.length) {
    console.log("N'ajoute que les URLs marquées ✅ comme source dans /admin/concours.");
  }
})();
