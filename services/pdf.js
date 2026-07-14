// ============================================================
//  services/pdf.js
//  Génère des fichiers PDF téléchargeables avec PDFKit.
//  Utilisé pour les CV et Lettres de Motivation générés par l’IA.
// ============================================================

const PDFDocument = require(“pdfkit”);
const path        = require(“path”);
const fs          = require(“fs”);

// Crée le dossier de stockage si nécessaire
const storageDir = path.join(__dirname, “../storage/generated”);
if (!fs.existsSync(storageDir)) {
fs.mkdirSync(storageDir, { recursive: true });
}

// ── Couleurs & styles EduConcoursCI ──────────────────────────
const COULEURS = {
primaire:    “#1A6B3C”,
secondaire:  “#0A6EBD”,
accent:      “#F5820D”,
texte:       “#1A1A2E”,
gris:        “#666666”,
grisClair:   “#F4F6F9”,
blanc:       “#FFFFFF”,
};

// ════════════════════════════════════════════════════════════
//  Génère un PDF à partir d’un texte brut (CV ou LM)
// ════════════════════════════════════════════════════════════
async function genererPDFTexte(contenu, nomFichier, type = “cv”) {
return new Promise((resolve, reject) => {
const filePath = path.join(storageDir, `${nomFichier}.pdf`);
const doc      = new PDFDocument({
size:    “A4”,
margins: { top: 50, bottom: 50, left: 60, right: 60 },
});

```
const stream = fs.createWriteStream(filePath);
doc.pipe(stream);

// ── En-tête avec logo/titre ───────────────────────────────
doc.rect(0, 0, doc.page.width, 80).fill(COULEURS.primaire);

doc.fillColor(COULEURS.blanc)
   .fontSize(22)
   .font("Helvetica-Bold")
   .text(
     type === "cv" ? "CURRICULUM VITAE" : "LETTRE DE MOTIVATION",
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
```

});
}

// ════════════════════════════════════════════════════════════
//  Génère un CV en PDF avec mise en page structurée
// ════════════════════════════════════════════════════════════
async function genererCVStructure(data, contenuIA) {
return new Promise((resolve, reject) => {
const nomFichier = `CV_${data.nom.replace(/\s+/g, "_")}_${Date.now()}`;
const filePath   = path.join(storageDir, `${nomFichier}.pdf`);
const doc        = new PDFDocument({
size:    “A4”,
margins: { top: 0, bottom: 50, left: 0, right: 0 },
});

```
const stream = fs.createWriteStream(filePath);
doc.pipe(stream);

const largeur  = doc.page.width;
const largeCol = largeur * 0.35; // Colonne gauche 35%

// ── Colonne gauche (fond coloré) ──────────────────────────
doc.rect(0, 0, largeCol, doc.page.height).fill(COULEURS.primaire);

// Photo placeholder
doc.circle(largeCol / 2, 90, 45)
   .fill(COULEURS.blanc);
doc.fillColor(COULEURS.primaire)
   .fontSize(28)
   .text(data.nom[0].toUpperCase(), largeCol / 2 - 10, 73);

// Nom dans la colonne gauche
doc.fillColor(COULEURS.blanc)
   .fontSize(13)
   .font("Helvetica-Bold")
   .text(data.nom.toUpperCase(), 15, 150, {
     width: largeCol - 30,
     align: "center",
   });

doc.fontSize(10)
   .font("Helvetica")
   .text(data.poste || "", 15, 175, {
     width: largeCol - 30,
     align: "center",
   });

// Coordonnées
let yGauche = 210;
doc.fontSize(9).font("Helvetica-Bold").text("CONTACT", 20, yGauche);
yGauche += 16;

const contacts = [
  data.email    ? `✉ ${data.email}`    : null,
  data.telephone? `☎ ${data.telephone}`: null,
  data.ville    ? `📍 ${data.ville}`   : null,
].filter(Boolean);

for (const c of contacts) {
  doc.font("Helvetica").fontSize(8).text(c, 20, yGauche, { width: largeCol - 35 });
  yGauche += 14;
}

// Compétences
if (data.competences) {
  yGauche += 10;
  doc.fontSize(9).font("Helvetica-Bold").text("COMPÉTENCES", 20, yGauche);
  yGauche += 14;
  const comps = data.competences.split(",").map(c => c.trim()).filter(Boolean);
  for (const comp of comps.slice(0, 8)) {
    doc.rect(20, yGauche, largeCol - 40, 14).fill("rgba(255,255,255,0.15)");
    doc.fillColor(COULEURS.blanc).fontSize(8).font("Helvetica")
       .text(comp, 25, yGauche + 3, { width: largeCol - 50 });
    yGauche += 18;
  }
}

// Langues
if (data.langues) {
  yGauche += 10;
  doc.fillColor(COULEURS.blanc).fontSize(9).font("Helvetica-Bold")
     .text("LANGUES", 20, yGauche);
  yGauche += 14;
  doc.fontSize(8).font("Helvetica")
     .text(data.langues, 20, yGauche, { width: largeCol - 35 });
}

// ── Colonne droite (contenu principal) ───────────────────
const xDroite = largeCol + 25;
const largeurDroite = largeur - largeCol - 50;
let yDroite = 30;

// Profil
if (data.profil) {
  doc.fillColor(COULEURS.primaire).fontSize(12).font("Helvetica-Bold")
     .text("PROFIL PROFESSIONNEL", xDroite, yDroite, { width: largeurDroite });
  yDroite += 18;
  doc.fillColor(COULEURS.texte).fontSize(9).font("Helvetica")
     .text(data.profil, xDroite, yDroite, {
       width: largeurDroite,
       align: "justify",
     });
  yDroite = doc.y + 15;
}

// Expériences
if (data.experiences?.length) {
  doc.fillColor(COULEURS.primaire).fontSize(12).font("Helvetica-Bold")
     .text("EXPÉRIENCES PROFESSIONNELLES", xDroite, yDroite, { width: largeurDroite });
  yDroite += 18;

  for (const exp of data.experiences) {
    doc.fillColor(COULEURS.texte).fontSize(10).font("Helvetica-Bold")
       .text(exp.poste, xDroite, yDroite, { width: largeurDroite });
    yDroite = doc.y;
    doc.fillColor(COULEURS.secondaire).fontSize(9).font("Helvetica")
       .text(`${exp.entreprise} | ${exp.debut} – ${exp.fin || "Présent"}`,
             xDroite, yDroite, { width: largeurDroite });
    yDroite = doc.y + 3;
    if (exp.description) {
      doc.fillColor(COULEURS.gris).fontSize(8)
         .text(exp.description, xDroite, yDroite, {
           width: largeurDroite,
           align: "justify",
         });
      yDroite = doc.y + 10;
    }
  }
  yDroite += 5;
}

// Formations
if (data.formations?.length) {
  doc.fillColor(COULEURS.primaire).fontSize(12).font("Helvetica-Bold")
     .text("FORMATIONS", xDroite, yDroite, { width: largeurDroite });
  yDroite += 18;

  for (const f of data.formations) {
    doc.fillColor(COULEURS.texte).fontSize(10).font("Helvetica-Bold")
       .text(f.diplome, xDroite, yDroite, { width: largeurDroite });
    yDroite = doc.y;
    doc.fillColor(COULEURS.gris).fontSize(9).font("Helvetica")
       .text(`${f.etablissement} — ${f.annee}${f.mention ? ` — ${f.mention}` : ""}`,
             xDroite, yDroite, { width: largeurDroite });
    yDroite = doc.y + 10;
  }
}

// Pied de page
doc.rect(largeCol, doc.page.height - 30, largeur - largeCol, 30)
   .fill(COULEURS.grisClair);
doc.fillColor(COULEURS.gris).fontSize(7)
   .text(
     `CV généré par EduConcoursCI — ${new Date().toLocaleDateString("fr-FR")}`,
     xDroite, doc.page.height - 20,
     { width: largeurDroite, align: "right" }
   );

doc.end();
stream.on("finish", () => resolve(filePath));
stream.on("error",  reject);
```

});
}

// ── Supprime un fichier généré après téléchargement ──────────
function supprimerFichier(filePath) {
try {
if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
} catch (err) {
console.error(“Erreur suppression fichier temporaire :”, err.message);
}
}

module.exports = { genererPDFTexte, genererCVStructure, supprimerFichier };