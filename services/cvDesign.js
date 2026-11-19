// ============================================================
//  services/cvDesign.js
//  CV « design » avec photo : 4 mises en page (bandeau, classique,
//  centre, pastille), chacune déclinée en plusieurs couleurs
//  (config/modelesCv.js).
//
//  - Le texte du CV est celui rédigé par l'IA, rangé en sections par
//    services/cvStructure.js (rien n'est ajouté ni retiré).
//  - Vrai texte sélectionnable, polices standard PDF (Helvetica / Times).
//  - La photo est facultative : sans photo, la mise en page se resserre.
//  - Seules les fonctions de base de PDFKit sont utilisées.
// ============================================================

const path = require("path");
const fs   = require("fs");
const { preparerCorpsCV } = require("./cvTexte");
const { analyser, pourPolice } = require("./cvStructure");

const storageDir = path.join(__dirname, "../storage/generated");
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

const A4 = { w: 595.28, h: 841.89 };
const F = {
  sans: "Helvetica", sansG: "Helvetica-Bold", sansI: "Helvetica-Oblique",
  serif: "Times-Roman", serifG: "Times-Bold",
};
const GRIS = "#6B6880";
const TEXTE = "#3A3656";
const TITRE = "#14122B";

// ── Photo : data-URL JPEG/PNG → Buffer (ou null) ─────────────
const PHOTO_MAX_OCTETS = 400 * 1024;
function lirePhoto(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl.trim());
  if (!m) return null;
  let buf;
  try { buf = Buffer.from(m[2], "base64"); } catch { return null; }
  if (!buf.length || buf.length > PHOTO_MAX_OCTETS) return null;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (m[1] === "jpeg" && !jpeg) return null;
  if (m[1] === "png" && !png) return null;
  return buf;
}

// ── Contexte de dessin ───────────────────────────────────────
function creerCtx(doc, couleurs) {
  return {
    doc, c: couleurs,
    y: 0,
    mx: 36,                    // marge gauche / droite
    cw: A4.w - 72,             // largeur utile
    haut: 38,                  // début du contenu sur les pages suivantes
    bas: 42,                   // marge basse
  };
}

function mesurer(ctx, texte, font, taille, largeur, lineGap = 0) {
  ctx.doc.font(font).fontSize(taille);
  return ctx.doc.heightOfString(texte, { width: largeur, lineGap });
}

function largeurTexte(ctx, texte, font, taille, espacement = 0) {
  ctx.doc.font(font).fontSize(taille);
  return ctx.doc.widthOfString(texte) + espacement * Math.max(0, texte.length - 1);
}

function ecrire(ctx, texte, x, y, font, taille, couleur, opts = {}) {
  ctx.doc.font(font).fontSize(taille).fillColor(couleur).text(texte, x, y, opts);
}

function assurer(ctx, h) {
  if (ctx.y + h > A4.h - ctx.bas) {
    if (ctx.nouvellePage) { ctx.nouvellePage(); return; }
    ctx.doc.addPage();
    ctx.y = ctx.haut;
  }
}

// ── Photo (ronde ou carrée arrondie) ─────────────────────────
function dessinerPhoto(ctx, buf, x, y, d, forme, bordure, epaisseur) {
  const doc = ctx.doc;
  doc.save();
  if (forme === "rond") doc.circle(x + d / 2, y + d / 2, d / 2).clip();
  else if (forme === "droit") doc.rect(x, y, d, d).clip();
  else doc.roundedRect(x, y, d, d, d * 0.16).clip();
  try {
    doc.image(buf, x, y, { cover: [d, d], align: "center", valign: "center" });
  } catch (_) { /* image illisible : on laisse l'emplacement vide */ }
  doc.restore();
  doc.save();
  doc.lineWidth(epaisseur).strokeColor(bordure);
  if (forme === "rond") doc.circle(x + d / 2, y + d / 2, d / 2 - epaisseur / 2).stroke();
  else if (forme === "droit") doc.rect(x + epaisseur / 2, y + epaisseur / 2, d - epaisseur, d - epaisseur).stroke();
  else doc.roundedRect(x + epaisseur / 2, y + epaisseur / 2, d - epaisseur, d - epaisseur, d * 0.16).stroke();
  doc.restore();
}

function losange(ctx, cx, cy, r, couleur) {
  ctx.doc.save();
  ctx.doc.polygon([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]).fill(couleur);
  ctx.doc.restore();
}

function point(ctx, cx, cy, r, couleur) {
  ctx.doc.save();
  ctx.doc.circle(cx, cy, r).fill(couleur);
  ctx.doc.restore();
}

function coordonnees(entete) {
  return [entete.email, entete.telephone, entete.ville].map((v) => pourPolice(v)).filter(Boolean);
}

// ════════════════════════════════════════════════════════════
//  Mises en page : en-tête + titre de rubrique
// ════════════════════════════════════════════════════════════

// 1) BANDEAU — grand bandeau coloré, photo ronde, barre dorée sous les titres
const bandeau = {
  forme: "rond",
  entete(ctx, e, photo) {
    const { doc, c, mx } = ctx;
    const D = 68, pad = 26;
    const hh = pad + (photo ? D + 16 : 0) + 28 + 17 + 16 + 20;
    doc.rect(0, 0, A4.w, hh).fill(c.primaire);
    let y = pad;
    if (photo) { dessinerPhoto(ctx, photo, mx, y, D, "rond", "#CFC8E0", 1.6); y += D + 16; }
    ecrire(ctx, pourPolice(e.nom), mx, y, F.serif, 24, "#FFFFFF", { width: ctx.cw, lineBreak: false });
    y += 28;
    if (e.poste) ecrire(ctx, pourPolice(e.poste), mx, y, F.sans, 11.5, "#F3EEDD", { width: ctx.cw, lineBreak: false });
    y += 17;
    let x = mx;
    coordonnees(e).forEach((t, i) => {
      if (i) { point(ctx, x + 8, y + 4.6, 1.5, c.accent); x += 16; }
      ecrire(ctx, t, x, y, F.sans, 9, "#FFFFFF", { lineBreak: false });
      x += largeurTexte(ctx, t, F.sans, 9) + 8;
    });
    ctx.y = hh + 24;
  },
  titre(ctx, t) {
    const { c, mx } = ctx;
    assurer(ctx, 56);
    ecrire(ctx, t, mx, ctx.y, F.serifG, 13.5, c.primaire, { lineBreak: false });
    const yb = ctx.y + 13.5 * 1.116 + 3;
    ctx.doc.roundedRect(mx, yb, 34, 2.4, 1.2).fill(c.accent);
    ctx.y = yb + 11;
  },
};

// 2) CLASSIQUE — sobre : photo ronde, nom, filet épais, titres en petites capitales
const classique = {
  forme: "rond",
  entete(ctx, e, photo) {
    const { doc, c, mx } = ctx;
    let y = 34;
    if (photo) { dessinerPhoto(ctx, photo, mx, y, 56, "rond", "#D3CFDF", 1.2); y += 56 + 14; }
    ecrire(ctx, pourPolice(e.nom), mx, y, F.serif, 27, TITRE, { width: ctx.cw, lineBreak: false });
    y += 31;
    if (e.poste) ecrire(ctx, pourPolice(e.poste), mx, y, F.sans, 11.5, "#5B5675", { width: ctx.cw, lineBreak: false });
    y += 17;
    let x = mx;
    coordonnees(e).forEach((t, i) => {
      if (i) { point(ctx, x + 6, y + 4.6, 1.3, "#5B5675"); x += 13; }
      ecrire(ctx, t, x, y, F.sans, 9, "#5B5675", { lineBreak: false });
      x += largeurTexte(ctx, t, F.sans, 9) + 6;
    });
    y += 20;
    doc.moveTo(mx, y).lineTo(mx + ctx.cw, y).lineWidth(1.6).strokeColor(c.primaire).stroke();
    ctx.y = y + 18;
  },
  titre(ctx, t) {
    const { doc, mx } = ctx;
    assurer(ctx, 50);
    const txt = t.toUpperCase();
    ecrire(ctx, txt, mx, ctx.y, F.serifG, 8.4, ctx.c.primaire, { characterSpacing: 1.6, lineBreak: false });
    const yl = ctx.y + 8.4 * 1.116 + 4;
    doc.moveTo(mx, yl).lineTo(mx + ctx.cw, yl).lineWidth(0.6).strokeColor("#C9C6D3").stroke();
    ctx.y = yl + 9;
  },
};

// 3) CENTRE — élégant : tout centré, losanges, titres espacés entre deux filets
const centre = {
  forme: "rond",
  texteCentre: true,
  entete(ctx, e, photo) {
    const { doc, c } = ctx;
    const cx = A4.w / 2;
    let y = 32;
    if (photo) { dessinerPhoto(ctx, photo, cx - 33, y, 66, "rond", c.primaire, 1); y += 66 + 14; }
    ecrire(ctx, pourPolice(e.nom), 0, y, F.serif, 30, TITRE, { width: A4.w, align: "center", lineBreak: false });
    y += 36;
    if (e.poste) {
      ecrire(ctx, pourPolice(e.poste).toUpperCase(), 0, y, F.sans, 8.8, GRIS, { width: A4.w, align: "center", characterSpacing: 2.2, lineBreak: false });
    }
    y += 16;
    doc.moveTo(cx - 20, y).lineTo(cx + 20, y).lineWidth(0.9).strokeColor(c.primaire).stroke();
    y += 12;
    const items = coordonnees(e);
    const larg = items.map((t) => largeurTexte(ctx, t, F.sans, 9));
    const total = larg.reduce((a, b) => a + b, 0) + Math.max(0, items.length - 1) * 22;
    let x = cx - total / 2;
    items.forEach((t, i) => {
      if (i) { losange(ctx, x + 11, y + 4.6, 2.8, c.primaire); x += 22; }
      ecrire(ctx, t, x, y, F.sans, 9, "#5B5675", { lineBreak: false });
      x += larg[i];
    });
    ctx.y = y + 30;
  },
  titre(ctx, t) {
    const { doc, c } = ctx;
    assurer(ctx, 50);
    const txt = t.toUpperCase();
    const cs = 3;
    const w = largeurTexte(ctx, txt, F.serifG, 9.5, cs);
    const x0 = A4.w / 2 - w / 2;
    ecrire(ctx, txt, x0, ctx.y, F.serifG, 9.5, c.primaire, { characterSpacing: cs, lineBreak: false });
    const ym = ctx.y + 5.4;
    doc.lineWidth(0.7).strokeColor(c.primaire);
    doc.moveTo(x0 - 12 - 28, ym).lineTo(x0 - 12, ym).stroke();
    doc.moveTo(x0 + w + 12, ym).lineTo(x0 + w + 12 + 28, ym).stroke();
    ctx.y += 9.5 * 1.116 + 12;
  },
};

// 4) PASTILLE — bandeau avec coin doré, photo carrée arrondie, titres en pastilles
const pastille = {
  forme: "carre",
  entete(ctx, e, photo) {
    const { doc, c, mx } = ctx;
    const D = 62, pad = 24;
    const hh = pad + (photo ? D + 14 : 0) + 28 + 24 + 14 + 20;
    doc.rect(0, 0, A4.w, hh).fill(c.primaire);
    doc.save();
    doc.rect(0, 0, A4.w, hh).clip();
    doc.roundedRect(A4.w - 80, -34, 112, 118, 34).fill(c.accent);
    doc.restore();
    let y = pad;
    if (photo) { dessinerPhoto(ctx, photo, mx, y, D, "carre", c.accent, 1.4); y += D + 14; }
    ecrire(ctx, pourPolice(e.nom), mx, y, F.serif, 24, "#FFFFFF", { width: ctx.cw - 90, lineBreak: false });
    y += 29;
    if (e.poste) {
      const poste = pourPolice(e.poste);
      const w = largeurTexte(ctx, poste, F.sansG, 9.2) + 22;
      doc.roundedRect(mx, y, w, 17, 8.5).fill(c.accent);
      ecrire(ctx, poste, mx + 11, y + 4.3, F.sansG, 9.2, c.primaire, { lineBreak: false });
    }
    y += 25;
    let x = mx;
    coordonnees(e).forEach((t, i) => {
      if (i) { point(ctx, x + 7, y + 4.6, 1.5, c.accent); x += 14; }
      ecrire(ctx, t, x, y, F.sans, 9, "#FFFFFF", { lineBreak: false });
      x += largeurTexte(ctx, t, F.sans, 9) + 7;
    });
    ctx.y = hh + 24;
  },
  titre(ctx, t) {
    const { doc, c, mx } = ctx;
    assurer(ctx, 52);
    const w = largeurTexte(ctx, t, F.serifG, 10.5) + 30;
    doc.roundedRect(mx, ctx.y, w, 19, 9.5).fill(c.primaire);
    point(ctx, mx + 10, ctx.y + 9.5, 2.3, c.accent);
    ecrire(ctx, t, mx + 19, ctx.y + 4.4, F.serifG, 10.5, "#FFFFFF", { lineBreak: false });
    ctx.y += 19 + 11;
  },
};


// 5) LATÉRAL — colonne colorée à gauche (photo, coordonnées, compétences, langues en barres),
//    bandeau sombre avec le nom, parcours à droite. Deux colonnes indépendantes.
const LARG_LATERALE = 193;
const HAUT_BANDEAU = 102;

function melange(hex, t) { // éclaircit une couleur (t = part de blanc)
  const n = parseInt(hex.slice(1), 16);
  const m = (v) => Math.round(v + (255 - v) * t);
  return "#" + [m((n >> 16) & 255), m((n >> 8) & 255), m(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function niveauVersBarres(niveau) {
  const n = String(niveau || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (!n) return null;
  const cecrl = /^([abc])([12])/.exec(n);
  if (cecrl) return { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6 }[cecrl[1] + cecrl[2]];
  const pct = /^(\d{1,3})\s*%$/.exec(n);
  if (pct) return Math.max(1, Math.min(6, Math.round(Number(pct[1]) / 100 * 6)));
  if (/natif|maternel|bilingue|maitris|excellent|expert/.test(n)) return 6;
  if (/courant|avance|confirme|professionnel|\bbon\b|\bbonne\b/.test(n)) return 5;
  if (/superieur/.test(n)) return 4;
  if (/intermediaire|moyen|operationnel/.test(n)) return 3;
  if (/notion|scolaire|elementaire|debutant/.test(n)) return 2;
  return null;
}

function icone(ctx, type, cx, cy) {
  const { doc } = ctx;
  doc.save();
  doc.lineWidth(0.9).strokeColor("#3B4252");
  if (type === "ville") {
    doc.circle(cx, cy - 1.6, 3.3).stroke();
    doc.polygon([cx - 2.5, cy + 0.6], [cx + 2.5, cy + 0.6], [cx, cy + 4.8]).fill("#3B4252");
    point(ctx, cx, cy - 1.6, 1.1, "#3B4252");
  } else if (type === "telephone") {
    doc.roundedRect(cx - 2.9, cy - 4.8, 5.8, 9.6, 1.3).stroke();
    doc.moveTo(cx - 1.2, cy + 3).lineTo(cx + 1.2, cy + 3).stroke();
  } else {
    doc.rect(cx - 4.8, cy - 3.3, 9.6, 6.6).stroke();
    doc.moveTo(cx - 4.8, cy - 3.3).lineTo(cx, cy + 0.6).lineTo(cx + 4.8, cy - 3.3).stroke();
  }
  doc.restore();
}

function titreLateralGauche(ctx, t) {
  const { doc, c, mx, cw } = ctx;
  assurer(ctx, 44);
  doc.moveTo(mx, ctx.y).lineTo(mx + cw, ctx.y).lineWidth(1.4).strokeColor(c.trait).stroke();
  ecrire(ctx, t.toUpperCase(), mx, ctx.y + 7, F.sansG, 11, TITRE, { width: cw, characterSpacing: 0.3, lineBreak: false });
  ctx.y += 7 + 11 * 1.156 + 8;
}

function titreLateralDroite(ctx, t, avecFiletHaut) {
  const { doc, c, mx, cw } = ctx;
  assurer(ctx, 56);
  let y = ctx.y;
  if (avecFiletHaut) {
    doc.moveTo(mx, y).lineTo(mx + cw, y).lineWidth(1.6).strokeColor(c.primaire).stroke();
    y += 8;
  }
  ecrire(ctx, t.toUpperCase(), mx, y, F.sansG, 13, c.primaire, { width: cw, characterSpacing: 0.3, lineBreak: false });
  ctx.y = y + 13 * 1.156 + 9;
}

function langue(ctx, it) {
  const { doc, c, mx, cw } = ctx;
  const label = pourPolice(it.label);
  const niveau = pourPolice(it.niveau);
  const m = /^([ABC][12])\s*(?:\((.+)\))?$/i.exec(niveau);
  const code = m ? m[1].toUpperCase() : niveau;
  const desc = m && m[2] ? m[2] : "";
  const barres = niveauVersBarres(niveau);
  const cwCode = code ? Math.min(cw * 0.45, largeurTexte(ctx, code, F.sans, 9.5) + 2) : 0;
  const lw = cw - (cwCode ? cwCode + 8 : 0);
  const hl = mesurer(ctx, label, F.sans, 10, lw);
  assurer(ctx, hl + (barres ? 9 : 0) + (desc ? 11 : 0) + 6);
  ecrire(ctx, label, mx, ctx.y, F.sans, 10, TITRE, { width: lw });
  if (code) ecrire(ctx, code, mx + cw - cwCode, ctx.y + 0.5, F.sans, 9.5, "#3B4252", { width: cwCode, align: "right", lineBreak: false });
  ctx.y += hl + 3;
  if (barres) {
    const gap = 2.2, sw = (cw - gap * 5) / 6;
    for (let k = 0; k < 6; k++) {
      doc.rect(mx + k * (sw + gap), ctx.y, sw, 4.2).fill(k < barres ? c.trait : melange(c.clair, 0.6));
    }
    ctx.y += 4.2 + 4;
  }
  if (desc) {
    ecrire(ctx, desc, mx, ctx.y, F.sans, 9, TEXTE, { width: cw, lineBreak: false });
    ctx.y += 11;
  }
  ctx.y += 6;
}

function entreeLaterale(ctx, e) {
  const { mx, cw } = ctx;
  const titre = pourPolice(e.titre), sous = pourPolice(e.sous), dates = pourPolice(e.dates);
  const wt = largeurTexte(ctx, titre, F.sansG, 10);
  const ws = sous ? largeurTexte(ctx, sous, F.sansI, 10) : 0;
  const memeLigne = sous && wt + 14 + ws <= cw;
  const hTitre = memeLigne ? 10 * 1.156 : mesurer(ctx, titre, F.sansG, 10, cw);
  const premiere = e.puces.length ? mesurer(ctx, pourPolice(e.puces[0]), F.sans, 9.5, cw - 12, GAP) : 0;
  assurer(ctx, (dates ? 12.5 : 0) + hTitre + (sous && !memeLigne ? 13 : 0) + premiere + 4);

  if (dates) { ecrire(ctx, dates, mx, ctx.y, F.sans, 9.2, GRIS, { width: cw, lineBreak: false }); ctx.y += 12.5; }
  if (memeLigne) {
    ecrire(ctx, titre, mx, ctx.y, F.sansG, 10, TITRE, { lineBreak: false });
    ecrire(ctx, "-", mx + wt + 4.5, ctx.y, F.sans, 10, TEXTE, { lineBreak: false });
    ecrire(ctx, sous, mx + wt + 14, ctx.y, F.sansI, 10, TEXTE, { lineBreak: false });
    ctx.y += hTitre + 3.5;
  } else {
    ecrire(ctx, titre, mx, ctx.y, F.sansG, 10, TITRE, { width: cw });
    ctx.y += hTitre + 1.5;
    if (sous) {
      const hs = mesurer(ctx, sous, F.sansI, 9.5, cw);
      ecrire(ctx, sous, mx, ctx.y, F.sansI, 9.5, TEXTE, { width: cw });
      ctx.y += hs + 3;
    }
  }
  e.textes.forEach((t) => {
    const txt = pourPolice(t);
    const h = mesurer(ctx, txt, F.sans, 9.5, cw, GAP);
    assurer(ctx, h);
    ecrire(ctx, txt, mx, ctx.y, F.sans, 9.5, TEXTE, { width: cw, lineGap: GAP });
    ctx.y += h + 2.5;
  });
  e.puces.forEach((p) => puceLigne(ctx, pourPolice(p), mx, "#3B4252"));
  ctx.y += 9;
}

function blocsLateraux(ctx, s, gauche) {
  s.blocs.forEach((b) => {
    if (b.t === "texte") paragraphe(ctx, b.lignes.map(pourPolice), false);
    else if (b.t === "puces") b.items.forEach((p) => puceLigne(ctx, pourPolice(p), ctx.mx, "#3B4252"));
    else if (b.t === "entree") {
      if (gauche) {
        puceLigne(ctx, pourPolice([b.titre, b.sous, b.dates].filter(Boolean).join(" – ")), ctx.mx, "#3B4252");
        b.puces.forEach((p) => puceLigne(ctx, pourPolice(p), ctx.mx, "#3B4252"));
      } else entreeLaterale(ctx, b);
    } else if (b.t === "liste") {
      b.items.forEach((it) => {
        if (gauche && s.cle === "langues") langue(ctx, it);
        else puceLigne(ctx, pourPolice(it.niveau ? `${it.label} (${it.niveau})` : it.label), ctx.mx, "#3B4252");
      });
      ctx.y += 4;
    }
  });
}

const lateral = {
  rendreTout(ctx, e, photo, sections) {
    const { doc, c } = ctx;
    const LW = LARG_LATERALE;
    const fondPage = (premiere) => {
      const y0 = premiere ? HAUT_BANDEAU : 0;
      doc.rect(0, y0, LW, A4.h - y0).fill(c.clair);
    };

    // ── Page 1 : bandeau, colonne, photo, nom ──
    doc.rect(0, 0, A4.w, HAUT_BANDEAU).fill(c.primaire);
    fondPage(true);
    const D = 141;
    if (photo) dessinerPhoto(ctx, photo, 26, 10, D, "droit", "#8F98AD", 1.2);
    const xNom = LW + 22, largNom = A4.w - xNom - 28;
    const nom = pourPolice(e.nom);
    let taille = 30;
    while (taille > 16 && largeurTexte(ctx, nom, F.sansG, taille) > largNom) taille -= 1;
    const poste = pourPolice(e.poste);
    const yNom = poste ? 27 : (HAUT_BANDEAU - taille * 1.156) / 2;
    ecrire(ctx, nom, xNom, yNom, F.sansG, taille, "#FFFFFF", { width: largNom, lineBreak: false });
    if (poste) ecrire(ctx, poste, xNom, yNom + taille * 1.156 + 6, F.sans, 11.5, "#DDE1EA", { width: largNom, lineBreak: false });

    ctx.p = 0; ctx.nbPages = 1; ctx.haut = 38;
    ctx.nouvellePage = () => {
      ctx.p += 1;
      if (ctx.p < ctx.nbPages) doc.switchToPage(ctx.p);
      else { doc.addPage(); ctx.nbPages += 1; fondPage(false); }
      ctx.y = ctx.haut;
    };

    // ── Colonne de gauche ──
    const GAUCHE = ["competences", "langues", "loisirs", "qualites"];
    const colG = sections.filter((s) => GAUCHE.includes(s.cle));
    const colD = sections.filter((s) => !GAUCHE.includes(s.cle));
    ctx.mx = 26; ctx.cw = LW - 26 - 20; ctx.T = 9; ctx.ind = 10;
    ctx.y = (photo ? 10 + D : HAUT_BANDEAU) + 26;

    const coord = [["ville", e.ville], ["telephone", e.telephone], ["email", e.email]]
      .map(([t, v]) => [t, pourPolice(v)]).filter(([, v]) => v);
    if (coord.length) {
      titreLateralGauche(ctx, "Coordonnées");
      coord.forEach(([type, v]) => {
        const h = Math.max(11, mesurer(ctx, v, F.sans, 9, ctx.cw - 18));
        assurer(ctx, h);
        icone(ctx, type, ctx.mx + 5, ctx.y + 5.5);
        ecrire(ctx, v, ctx.mx + 18, ctx.y + 1, F.sans, 9, TITRE, { width: ctx.cw - 18 });
        ctx.y += h + 6;
      });
      ctx.y += 8;
    }
    colG.forEach((s) => {
      if (s.titre) titreLateralGauche(ctx, s.titre);
      blocsLateraux(ctx, s, true);
      ctx.y += 10;
    });

    // ── Colonne de droite (on revient en haut de la page 1) ──
    ctx.p = 0;
    doc.switchToPage(0);
    ctx.mx = LW + 22; ctx.cw = A4.w - ctx.mx - 28; ctx.T = 9.5; ctx.ind = 12;
    ctx.y = HAUT_BANDEAU + 26;
    colD.forEach((s, i) => {
      if (s.titre) titreLateralDroite(ctx, s.titre, i > 0);
      blocsLateraux(ctx, s, false);
      ctx.y += 10;
    });
  },
};

const MISES_EN_PAGE = { lateral, bandeau, classique, centre, pastille };

// ════════════════════════════════════════════════════════════
//  Corps : paragraphes, entrées, listes
// ════════════════════════════════════════════════════════════
const T = 10;          // taille du texte courant
const GAP = 2;         // interligne

function paragraphe(ctx, lignes, centre) {
  const texte = lignes.join(" ");
  const t = ctx.T || T;
  const h = mesurer(ctx, texte, F.sans, t, ctx.cw, GAP);
  assurer(ctx, h);
  ecrire(ctx, texte, ctx.mx, ctx.y, F.sans, t, TEXTE, { width: ctx.cw, lineGap: GAP, align: centre ? "center" : "left" });
  ctx.y += h + 7;
}

function puceLigne(ctx, texte, x0, couleurPuce) {
  const ind = ctx.ind || 13;
  const t = ctx.T || T;
  const w = ctx.cw - (x0 - ctx.mx) - ind;
  const h = mesurer(ctx, texte, F.sans, t, w, GAP);
  assurer(ctx, h);
  point(ctx, x0 + 3, ctx.y + t * 0.52, 1.5, couleurPuce);
  ecrire(ctx, texte, x0 + ind, ctx.y, F.sans, t, TEXTE, { width: w, lineGap: GAP });
  ctx.y += h + 2.5;
}

function entree(ctx, e) {
  const { mx, cw } = ctx;
  const titre = pourPolice(e.titre);
  const dates = pourPolice(e.dates);
  const dw = dates ? Math.min(cw * 0.34, largeurTexte(ctx, dates, F.sans, 9.2) + 2) : 0;
  const lw = cw - (dw ? dw + 12 : 0);
  const ht = mesurer(ctx, titre, F.sansG, 11, lw);
  const sous = pourPolice(e.sous);
  const hs = sous ? mesurer(ctx, sous, F.sansI, 9.5, cw) : 0;
  const premiere = e.puces.length ? mesurer(ctx, pourPolice(e.puces[0]), F.sans, T, cw - 13, GAP) : 0;
  assurer(ctx, ht + (hs ? hs + 3 : 0) + premiere + 2);

  ecrire(ctx, titre, mx, ctx.y, F.sansG, 11, TITRE, { width: lw });
  if (dates) ecrire(ctx, dates, mx + cw - dw, ctx.y + 1.4, F.sans, 9.2, GRIS, { width: dw, align: "right", lineBreak: false });
  ctx.y += ht + 1.5;
  if (sous) {
    ecrire(ctx, sous, mx, ctx.y, F.sansI, 9.5, GRIS, { width: cw });
    ctx.y += hs + 3;
  }
  e.textes.forEach((t) => {
    const txt = pourPolice(t);
    const h = mesurer(ctx, txt, F.sans, T, cw, GAP);
    assurer(ctx, h);
    ecrire(ctx, txt, mx, ctx.y, F.sans, T, TEXTE, { width: cw, lineGap: GAP });
    ctx.y += h + 2.5;
  });
  e.puces.forEach((p) => puceLigne(ctx, pourPolice(p), mx, "#9A94B3"));
  ctx.y += 8;
}

function listeDeuxColonnes(ctx, items) {
  const { mx, cw } = ctx;
  const gouttiere = 16;
  const cl = (cw - gouttiere) / 2;
  for (let i = 0; i < items.length; i += 2) {
    const paire = items.slice(i, i + 2).map((it) => pourPolice(it.label));
    const h = Math.max(...paire.map((t) => mesurer(ctx, t, F.sans, T, cl - 13, GAP)));
    assurer(ctx, h);
    paire.forEach((t, k) => {
      const x = mx + k * (cl + gouttiere);
      point(ctx, x + 3, ctx.y + 5.2, 1.5, "#9A94B3");
      ecrire(ctx, t, x + 13, ctx.y, F.sans, T, TEXTE, { width: cl - 13, lineGap: GAP });
    });
    ctx.y += h + 3.5;
  }
  ctx.y += 4;
}

function liste(ctx, items) {
  if (items.length >= 4 && items.every((it) => !it.niveau)) return listeDeuxColonnes(ctx, items);
  const { mx, cw } = ctx;
  items.forEach((it) => {
    const niveau = pourPolice(it.niveau);
    const nw = niveau ? Math.min(cw * 0.3, largeurTexte(ctx, niveau, F.sans, 9.2) + 2) : 0;
    const lw = cw - 13 - (nw ? nw + 10 : 0);
    const h = mesurer(ctx, pourPolice(it.label), F.sans, T, lw, GAP);
    assurer(ctx, h);
    point(ctx, mx + 3, ctx.y + 5.2, 1.5, "#9A94B3");
    ecrire(ctx, pourPolice(it.label), mx + 13, ctx.y, F.sans, T, TEXTE, { width: lw, lineGap: GAP });
    if (niveau) ecrire(ctx, niveau, mx + cw - nw, ctx.y + 0.4, F.sans, 9.2, GRIS, { width: nw, align: "right", lineBreak: false });
    ctx.y += h + 3.5;
  });
  ctx.y += 4;
}

function rendreSection(ctx, mep, s) {
  const apercu = s.titre ? 70 : 20;
  if (s.titre) {
    assurer(ctx, apercu);
    mep.titre(ctx, s.titre);
  }
  s.blocs.forEach((b) => {
    if (b.t === "texte") paragraphe(ctx, b.lignes.map(pourPolice), mep.texteCentre && s.genre === "texte");
    else if (b.t === "puces") b.items.forEach((p) => puceLigne(ctx, pourPolice(p), ctx.mx, "#9A94B3"));
    else if (b.t === "entree") entree(ctx, b);
    else if (b.t === "liste") liste(ctx, b.items);
  });
  ctx.y += 6;
}

// ════════════════════════════════════════════════════════════
//  Point d'entrée
//  data : formulaire (nom, poste, email, telephone, ville, photo…)
//  contenu : texte du CV rédigé par l'IA
//  modele : entrée de config/modelesCv.js (layout, couleurs)
// ════════════════════════════════════════════════════════════
function genererCVDesign(data, contenu, modele) {
  return new Promise((resolve, reject) => {
    try {
      const PDFDocument = require("pdfkit");
      const mep = MISES_EN_PAGE[modele?.layout];
      if (!mep) return reject(new Error("Mise en page inconnue."));
      const nomSain = String(data?.nom || "cv").replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "") || "cv";
      const filePath = path.join(storageDir, `CV_${nomSain}_${Date.now()}.pdf`);

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        bufferPages: !!mep.rendreTout,
        info: { Title: `CV ${data?.nom || ""}`.trim(), Author: data?.nom || "" },
      });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const couleurs = {
        primaire: modele.couleurs?.primaire || "#3B2D5F",
        accent: modele.couleurs?.accent || "#E3D3A0",
        clair: modele.couleurs?.clair || "#E4DFF0",
        trait: modele.couleurs?.trait || "#5B4B8A",
      };
      const ctx = creerCtx(doc, couleurs);
      const photo = lirePhoto(data?.photo);
      const entete = {
        nom: data?.nom || "", poste: data?.poste || "",
        email: data?.email || "", telephone: data?.telephone || "", ville: data?.ville || "",
      };

      // Texte de l'IA : l'en-tête du formulaire remplace celui de l'IA (jamais de doublon)
      const { lignes } = preparerCorpsCV(contenu, data);
      const sections = analyser(lignes);

      if (mep.rendreTout) {
        mep.rendreTout(ctx, entete, photo, sections);
      } else {
        mep.entete(ctx, entete, photo);
        sections.forEach((s) => rendreSection(ctx, mep, s));
      }

      doc.end();
      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { genererCVDesign, lirePhoto, MISES_EN_PAGE };
