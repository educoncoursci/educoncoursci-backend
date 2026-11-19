// ============================================================
//  services/cvStructure.js
//  Transforme le texte d'un CV (rédigé par l'IA) en sections structurées
//  pour les modèles « design » (services/cvDesign.js).
//
//  Aucune dépendance : testable sans pdfkit.
//  Règle d'or : on ne perd JAMAIS de contenu. Ce qui n'est pas reconnu
//  est conservé sous forme de paragraphe.
//
//  Sortie : [{ titre, cle, genre, blocs: [...] }]
//   bloc.t = "entree"  → { titre, sous, dates, puces[], textes[] }
//          = "puces"   → { items[] }
//          = "texte"   → { lignes[] }  (un paragraphe)
//          = "liste"   → { items: [{ label, niveau }] }
// ============================================================

const {
  estSeparateur, estTitreSection, estPuce, texteSansPuce, RUBRIQUES,
} = require("./cvTexte");

// Polices standard PDF (WinAnsi) : on retire ce qu'elles ne savent pas afficher.
function pourPolice(texte) {
  return String(texte || "")
    .replace(/[   ]/g, " ")
    .replace(/[^ -~¡-ÿŒœ–—‘’“”•…€]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Dates ────────────────────────────────────────────────────
const MOIS = "janvier|janv|jan|f[ée]vrier|f[ée]vr|f[ée]v|mars|mar|avril|avr|mai|juin|juillet|juil|ao[uû]t|aou|septembre|sept|sep|octobre|oct|novembre|nov|d[ée]cembre|d[ée]c";
const ANNEE = "(?:19|20)\\d{2}";
const DEBUT = `(?:(?:${MOIS})\\.?\\s+)?(?:\\d{1,2}\\/)?${ANNEE}`;
const FIN = `(?:${DEBUT}|pr[ée]sent|actuel(?:lement)?|aujourd.hui|en\\s+cours|ce\\s+jour)`;
const PLAGE = new RegExp(`\\(?\\s*(${DEBUT})\\s*(?:[–—-]|\\bà\\b|\\bau\\b|\\bto\\b)\\s*(${FIN})\\s*\\)?`, "i");
const ANNEE_FINALE = new RegExp(`\\(\\s*(${ANNEE})\\s*\\)\\s*$`);
const ANNEE_SEULE = new RegExp(`^\\s*(${ANNEE})\\s*$`);

function nettoyerBords(s) {
  return String(s || "").replace(/^[\s|—–\-·,:;()]+/, "").replace(/[\s|—–\-·,:;(]+$/, "").trim();
}

// { dates: "Jan 2022 – Présent" | null, reste: "texte sans la date" }
function extraireDates(ligne) {
  const l = String(ligne || "");
  const m = PLAGE.exec(l);
  if (m) {
    const dates = `${m[1].trim()} – ${m[2].trim()}`;
    return { dates, reste: nettoyerBords(l.slice(0, m.index) + " " + l.slice(m.index + m[0].length)) };
  }
  const f = ANNEE_FINALE.exec(l);
  if (f) return { dates: f[1], reste: nettoyerBords(l.slice(0, f.index)) };
  const s = ANNEE_SEULE.exec(l);
  if (s) return { dates: s[1], reste: "" };
  return { dates: null, reste: l.trim() };
}

// ── Titres de rubrique ───────────────────────────────────────
function cleSection(titre) {
  const t = String(titre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/^(profil|resume|objectif|presentation|a propos)/.test(t)) return "profil";
  if (/^(experience|parcours|stage)/.test(t)) return "experience";
  if (/^(formation|diplome|etude|cursus)/.test(t)) return "formation";
  if (/^(competence|atout|savoir)/.test(t)) return "competences";
  if (/^langue/.test(t)) return "langues";
  if (/^qualite/.test(t)) return "qualites";
  if (/^(informatique|outil|logiciel|bureautique)/.test(t)) return "informatique";
  if (/^(loisir|centre|interet)/.test(t)) return "loisirs";
  if (/^certification/.test(t)) return "certifications";
  return "autre";
}

function genreSection(cle) {
  if (cle === "profil") return "texte";
  if (["competences", "langues", "loisirs", "qualites", "informatique"].includes(cle)) return "liste";
  return "entrees";
}

function estEnTete(brute) {
  const l = String(brute || "").trim();
  if (!l || estPuce(l)) return false;
  if (estTitreSection(l)) return true;
  const propre = l.replace(/^[^A-Za-zÀ-ÿ]+/, "").replace(/[\s:–—\-═─=]+$/, "").trim();
  const nbMots = propre.split(/\s+/).length;
  return RUBRIQUES.test(propre) && nbMots <= 5 && propre.length < 50 && !/[:.,;0-9@]/.test(propre);
}

function formaterTitre(brute) {
  let t = String(brute || "").replace(/^[^A-Za-zÀ-ÿ]+/, "").replace(/[\s:–—\-═─=]+$/, "").trim();
  if (t === t.toUpperCase()) {
    t = t.toLocaleLowerCase("fr-FR");
    t = t.charAt(0).toLocaleUpperCase("fr-FR") + t.slice(1);
  }
  return pourPolice(t);
}

// ── Éléments de liste (compétences, langues, loisirs) ────────
const NIVEAU = /^(expert|avanc[ée]|interm[ée]diaire|d[ée]butant|courant|bilingue|natif|maternel(?:le)?|notions?|bon|bonne|moyen|excellent|professionnel(?:le)?|scolaire|[abc][12](?:\s*\(.*\))?|\d\s*\/\s*\d+|\d{1,3}\s*%|ma[iî]trise|confirm[ée]|op[ée]rationnel(?:le)?|technique)$/i;

function elementListe(texte) {
  const t = pourPolice(texte);
  let m = /^(.{2,60}?)\s*(?::|—|–|\s-\s)\s*(.{1,40})$/.exec(t);
  if (m && NIVEAU.test(m[2].trim())) return { label: m[1].trim(), niveau: m[2].trim() };
  m = /^(.{2,60}?)\s*\(([^)]{1,24})\)$/.exec(t);
  if (m && NIVEAU.test(m[2].trim())) return { label: m[1].trim(), niveau: m[2].trim() };
  return { label: t, niveau: "" };
}

function elementsDeLigne(texte) {
  const t = pourPolice(texte);
  // « Excel, Word, Gestion d'équipe » : plusieurs éléments sur une ligne, sans libellé de catégorie
  if (!t.includes(":") && !/[()]/.test(t) && (t.match(/,/g) || []).length >= 2) {
    return t.split(",").map((x) => x.trim()).filter(Boolean).map((x) => ({ label: x, niveau: "" }));
  }
  return [elementListe(t)];
}

const SEPARATEUR_TITRE = /\s+[—–|·@]\s+|\s+-\s+|\s+chez\s+/i;

function separerTitre(reste) {
  const m = SEPARATEUR_TITRE.exec(reste);
  if (!m) return { titre: reste, sous: "" };
  return { titre: reste.slice(0, m.index).trim(), sous: nettoyerBords(reste.slice(m.index + m[0].length)) };
}

// ── Analyse ──────────────────────────────────────────────────
function analyser(lignes) {
  const sections = [];
  let sec = null;
  let entree = null;
  let apresVide = true;

  const ouvrir = (titre) => {
    const cle = cleSection(titre);
    sec = { titre, cle, genre: genreSection(cle), blocs: [] };
    sections.push(sec);
    entree = null;
    apresVide = true;
  };
  const dernier = () => sec.blocs[sec.blocs.length - 1];

  const liste = (lignes || []).map((l) => String(l ?? ""));

  for (let i = 0; i < liste.length; i++) {
    const brute = liste[i].trim();
    if (!brute) { apresVide = true; continue; }
    if (estSeparateur(brute)) continue;

    if (estEnTete(brute)) {
      const titre = formaterTitre(brute);
      if (titre) { ouvrir(titre); continue; }
    }
    if (!sec) ouvrir("");

    // ── Puce ──
    if (estPuce(brute)) {
      const texte = pourPolice(texteSansPuce(brute));
      if (!texte) continue;
      if (sec.genre === "liste") {
        let b = dernier();
        if (!b || b.t !== "liste") { b = { t: "liste", items: [] }; sec.blocs.push(b); }
        b.items.push(...elementsDeLigne(texte));
      } else if (entree) {
        entree.puces.push(texte);
      } else {
        let b = dernier();
        if (!b || b.t !== "puces" || apresVide) { b = { t: "puces", items: [] }; sec.blocs.push(b); }
        b.items.push(texte);
      }
      apresVide = false;
      continue;
    }

    const texte = pourPolice(brute.replace(/^[^A-Za-zÀ-ÿ0-9(]+/, ""));
    if (!texte) { apresVide = false; continue; }

    // ── Rubrique en liste (une ligne = un ou plusieurs éléments) ──
    if (sec.genre === "liste") {
      let b = dernier();
      if (!b || b.t !== "liste") { b = { t: "liste", items: [] }; sec.blocs.push(b); }
      b.items.push(...elementsDeLigne(texte));
      apresVide = false;
      continue;
    }

    // ── Rubrique de texte (profil) ──
    if (sec.genre === "texte") {
      const b = dernier();
      if (b && b.t === "texte" && !apresVide) b.lignes.push(texte);
      else sec.blocs.push({ t: "texte", lignes: [texte] });
      apresVide = false;
      continue;
    }

    // ── Rubrique d'entrées (expériences, formations…) ──
    const d = extraireDates(texte);
    if (d.dates && !d.reste && entree && !entree.dates) { entree.dates = d.dates; apresVide = false; continue; }

    // Les 3 lignes qui suivent (sans ligne vide) contiennent-elles une puce ou une date ?
    let indices = false;
    for (let j = i + 1; j < Math.min(liste.length, i + 4); j++) {
      const t = liste[j].trim();
      if (!t) break;
      if (estSeparateur(t)) continue;
      if (estPuce(t) || extraireDates(t).dates !== null) { indices = true; break; }
    }
    const nouvelle =
      d.dates !== null ||
      ((apresVide || !entree) && (indices || SEPARATEUR_TITRE.test(texte)));

    if (nouvelle) {
      const { titre, sous } = separerTitre(d.reste || texte);
      entree = { t: "entree", titre: titre || d.reste || texte, sous, dates: d.dates || "", puces: [], textes: [] };
      sec.blocs.push(entree);
    } else if (entree && !entree.sous && !entree.puces.length && !entree.textes.length && !apresVide && texte.length <= 100) {
      entree.sous = nettoyerBords(texte);
    } else if (entree) {
      entree.textes.push(texte);
    } else {
      sec.blocs.push({ t: "texte", lignes: [texte] });
    }
    apresVide = false;
  }

  return sections.filter((s) => s.blocs.length);
}

module.exports = { analyser, extraireDates, elementListe, elementsDeLigne, formaterTitre, cleSection, pourPolice };
