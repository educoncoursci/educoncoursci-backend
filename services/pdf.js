// ============================================================
//  services/pdf.js
//  Génère des fichiers PDF téléchargeables avec PDFKit.
//  Utilisé pour les CV et Lettres de Motivation générés par l'IA.
// ============================================================

const PDFDocument = require("pdfkit");
const path        = require("path");
const fs          = require("fs");
const {
  preparerCorpsCV, estSeparateur, estTitreSection, estPuce, texteSansPuce,
} = require("./cvTexte");

// Crée le dossier de stockage si nécessaire
const storageDir = path.join(__dirname, "../storage/generated");
if (!fs.existsSync(storageDir)) {
fs.mkdirSync(storageDir, { recursive: true });
}

// ── Couleurs & styles EduConcoursCI ──────────────────────────
const COULEURS = {
primaire:    "#1A6B3C",
secondaire:  "#0A6EBD",
accent:      "#F5820D",
texte:       "#1A1A2E",
gris:        "#666666",
grisClair:   "#F4F6F9",
blanc:       "#FFFFFF",
};

// ════════════════════════════════════════════════════════════
//  Génère un PDF à partir d'un texte brut (CV ou LM)
// ════════════════════════════════════════════════════════════
async function genererPDFTexte(contenu, nomFichier, type = "cv", titrePersonnalise = null, options = {}) {
// CV et lettres de motivation : document destiné à un recruteur → rendu sobre,
// sans bandeau ni mention de la plateforme (voir genererPDFProfessionnel).
if (type === "cv" || type === "lm") {
  return genererPDFProfessionnel(contenu, nomFichier, type, options);
}
return new Promise((resolve, reject) => {
const filePath = path.join(storageDir, `${nomFichier}.pdf`);
const doc      = new PDFDocument({
size:    "A4",
margins: { top: 50, bottom: 50, left: 60, right: 60 },
});

const stream = fs.createWriteStream(filePath);
doc.pipe(stream);

const TITRES = { cv: "CURRICULUM VITAE", lm: "LETTRE DE MOTIVATION" };
const titreAffiche = titrePersonnalise || TITRES[type] || "DOCUMENT";

// ── En-tête avec logo/titre ───────────────────────────────
doc.rect(0, 0, doc.page.width, 80).fill(COULEURS.primaire);

doc.fillColor(COULEURS.blanc)
   .fontSize(22)
   .font("Helvetica-Bold")
   .text(
     titreAffiche,
     60, 25,
     { align: "center" }
   );

doc.fontSize(10)
   .font("Helvetica")
   .text("EduConcoursCI — Préparation aux concours CI", 60, 55, { align: "center" });

// ── Corps du document ─────────────────────────────────────
doc.moveDown(3);
doc.fillColor(COULEURS.texte)
   .fontSize(11)
   .font("Helvetica")
   .lineGap(4);

// Découpe le contenu en lignes et applique le formatage
const lignes = contenu.split("\n");
for (const ligne of lignes) {
  const ligneNettoyee = ligne.trim();

  // Ligne de séparation (═══ ou ───)
  if (/^[═─=\-]{3,}/.test(ligneNettoyee)) {
    doc.moveDown(0.3);
    doc.moveTo(60, doc.y)
       .lineTo(doc.page.width - 60, doc.y)
       .strokeColor(COULEURS.primaire)
       .lineWidth(0.5)
       .stroke();
    doc.moveDown(0.3);
    continue;
  }

  // Titre de section en majuscules (ex: EXPÉRIENCES, FORMATIONS)
  if (
    ligneNettoyee === ligneNettoyee.toUpperCase() &&
    ligneNettoyee.length > 3 &&
    ligneNettoyee.length < 60 &&
    !ligneNettoyee.match(/^[0-9]/)
  ) {
    doc.moveDown(0.4);
    doc.fillColor(COULEURS.primaire)
       .fontSize(12)
       .font("Helvetica-Bold")
       .text(ligneNettoyee, { continued: false });
    doc.fillColor(COULEURS.texte)
       .fontSize(11)
       .font("Helvetica");
    doc.moveDown(0.2);
    continue;
  }

  // Ligne vide
  if (ligneNettoyee === "") {
    doc.moveDown(0.4);
    continue;
  }

  // Ligne normale
  doc.text(ligneNettoyee, { align: "justify" });
}

// ── Pied de page ─────────────────────────────────────────
const pageHeight = doc.page.height;
doc.rect(0, pageHeight - 40, doc.page.width, 40).fill(COULEURS.grisClair);
doc.fillColor(COULEURS.gris)
   .fontSize(8)
   .text(
     `Document généré par EduConcoursCI — ${new Date().toLocaleDateString("fr-FR")}`,
     60,
     pageHeight - 26,
     { align: "center" }
   );

doc.end();

stream.on("finish", () => resolve(filePath));
stream.on("error",  reject);

});
}

// ════════════════════════════════════════════════════════════
//  CV et lettres de motivation — rendu professionnel et lisible par les ATS
//
//  Principes :
//   - une seule colonne, vrai texte sélectionnable, polices standard ;
//   - titres de section clairs (Profil, Expériences, Formations, Compétences…) ;
//   - coordonnées en clair (« E-mail : », « Téléphone : »), sans pictogramme ;
//   - aucun bandeau, aucun pied de page, aucune mention de la plateforme ;
//   - le texte rédigé par l'IA est toujours celui du document final.
//  Le modèle choisi ne change que les couleurs et l'alignement de l'en-tête.
// ════════════════════════════════════════════════════════════

// Polices standard PDF (WinAnsi) : on retire ce qu'elles ne savent pas afficher
// (emoji, pictogrammes…), qui apparaîtraient en caractères parasites.
function pourPolice(texte) {
  return String(texte || "")
    .replace(/[\u00A0\u2009\u202F]/g, " ")
    .replace(/[^\u0020-\u007E\u00A1-\u00FF\u0152\u0153\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g, "")
    .trim();
}

function traitHorizontal(doc, couleur, epaisseur) {
  const y = doc.y;
  doc.moveTo(doc.page.margins.left, y)
     .lineTo(doc.page.width - doc.page.margins.right, y)
     .strokeColor(couleur)
     .lineWidth(epaisseur)
     .stroke();
}

function genererPDFProfessionnel(contenu, nomFichier, type, options = {}) {
  return new Promise((resolve, reject) => {
    const { data, modele } = options;
    const filePath = path.join(storageDir, `${nomFichier}.pdf`);
    const estCV = type === "cv";

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 55, right: 55 },
      info: {
        Title: estCV ? `CV ${data?.nom || ""}`.trim() : "Lettre de motivation",
        Author: data?.nom || "",
      },
    });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const couleurs = {
      titre:  modele?.couleurs?.primaire || COULEURS.texte,
      trait:  modele?.couleurs?.accent   || modele?.couleurs?.primaire || COULEURS.texte,
      texte:  COULEURS.texte,
    };
    const align = modele?.layout === "structure" ? "left" : "center";

    const { entete, lignes } = estCV
      ? preparerCorpsCV(contenu, data)
      : { entete: null, lignes: String(contenu || "").split("\n") };

    // ── En-tête du CV (nom, poste, coordonnées en clair) ─────
    if (entete) {
      doc.font("Helvetica-Bold").fontSize(20).fillColor(couleurs.titre)
         .text(pourPolice(entete.nom).toUpperCase(), { align });
      if (entete.poste) {
        doc.font("Helvetica").fontSize(12).fillColor("#444444")
           .text(pourPolice(entete.poste), { align });
      }
      if (entete.contact) {
        doc.font("Helvetica").fontSize(9.5).fillColor("#444444")
           .text(pourPolice(entete.contact), { align });
      }
      doc.moveDown(0.4);
      traitHorizontal(doc, couleurs.trait, 1.2);
      doc.moveDown(0.2);
    }

    // ── Corps ────────────────────────────────────────────────
    let derniereVide = true;
    for (const brute of lignes) {
      const ligne = pourPolice(brute);

      if (!ligne) {
        if (!derniereVide) doc.moveDown(estCV ? 0.3 : 0.8);
        derniereVide = true;
        continue;
      }
      if (estSeparateur(ligne)) continue;
      derniereVide = false;

      if (estCV && estTitreSection(ligne)) {
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold").fontSize(11.5).fillColor(couleurs.titre).text(ligne);
        traitHorizontal(doc, couleurs.trait, 0.6);
        doc.moveDown(0.3);
        continue;
      }

      if (estCV && estPuce(ligne)) {
        doc.font("Helvetica").fontSize(10.5).fillColor(couleurs.texte)
           .text(`\u2022  ${texteSansPuce(ligne)}`, { align: "left", lineGap: 2 });
        continue;
      }

      const gras = !estCV && /^objet\s*:/i.test(ligne);
      doc.font(gras ? "Helvetica-Bold" : "Helvetica")
         .fontSize(estCV ? 10.5 : 11)
         .fillColor(couleurs.texte)
         .text(ligne, { align: "left", lineGap: estCV ? 2 : 3 });
    }

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

// Conservée pour compatibilité avec cvController : même rendu, couleurs du modèle.
async function genererCVStructure(data, contenuIA, modele) {
  const nomSain = String(data?.nom || "cv").replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "");
  return genererPDFProfessionnel(contenuIA, `CV_${nomSain}_${Date.now()}`, "cv", { data, modele });
}

// ── Supprime un fichier généré après téléchargement ──────────
function supprimerFichier(filePath) {
try {
if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
} catch (err) {
console.error("Erreur suppression fichier temporaire :", err.message);
}
}

// ════════════════════════════════════════════════════════════
//  Lot 12 — Génère un certificat PDF (badge ou examen blanc réussi)
//  Mise en page paysage avec cadre décoratif, distincte des
//  documents texte (CV/LM) générés plus haut dans ce fichier.
// ════════════════════════════════════════════════════════════
async function genererCertificatPDF(nomFichier, { titre, sousTitre, nomCandidat, detail, date }) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(storageDir, `${nomFichier}.pdf`);
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 } });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const largeur = doc.page.width;
    const hauteur = doc.page.height;

    // Fond et cadre décoratif
    doc.rect(0, 0, largeur, hauteur).fill(COULEURS.blanc);
    doc.rect(20, 20, largeur - 40, hauteur - 40)
       .lineWidth(3).strokeColor(COULEURS.primaire).stroke();
    doc.rect(28, 28, largeur - 56, hauteur - 56)
       .lineWidth(1).strokeColor(COULEURS.accent).stroke();

    doc.fillColor(COULEURS.primaire)
       .font("Helvetica-Bold").fontSize(14)
       .text("EDUCONCOURSCI", 0, 60, { align: "center" });
    doc.fillColor(COULEURS.gris)
       .font("Helvetica").fontSize(10)
       .text("Préparation aux concours de Côte d'Ivoire", 0, 80, { align: "center" });

    doc.fillColor(COULEURS.texte)
       .font("Helvetica-Bold").fontSize(30)
       .text(titre, 0, 140, { align: "center" });

    if (sousTitre) {
      doc.font("Helvetica").fontSize(13).fillColor(COULEURS.gris)
         .text(sousTitre, 0, 185, { align: "center" });
    }

    doc.font("Helvetica").fontSize(12).fillColor(COULEURS.gris)
       .text("Ce certificat est décerné à", 0, 230, { align: "center" });

    doc.font("Helvetica-Bold").fontSize(24).fillColor(COULEURS.secondaire)
       .text(nomCandidat, 0, 255, { align: "center" });

    if (detail) {
      doc.font("Helvetica").fontSize(13).fillColor(COULEURS.texte)
         .text(detail, 100, 300, { align: "center", width: largeur - 200 });
    }

    doc.font("Helvetica").fontSize(10).fillColor(COULEURS.gris)
       .text(`Délivré le ${date}`, 0, hauteur - 90, { align: "center" });
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(COULEURS.gris)
       .text("Certificat auto-déclaratif généré par EduConcoursCI — ne remplace aucun diplôme ni attestation officielle.", 60, hauteur - 65, { align: "center", width: largeur - 120 });

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

module.exports = { genererPDFTexte, genererCVStructure, genererCertificatPDF, supprimerFichier };