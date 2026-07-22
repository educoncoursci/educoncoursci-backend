// ============================================================
//  services/docx.js
//  Génère des fichiers Word (.docx) téléchargeables pour les
//  CV et Lettres de Motivation, via la librairie "docx".
// ============================================================

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType,
} = require("docx");
const path = require("path");
const fs   = require("fs");

const storageDir = path.join(__dirname, "../storage/generated");
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// ── Convertit une couleur hex "#RRGGBB" en hex sans # (attendu par docx) ──
function hexSansDiese(hex) {
  return (hex || "1A6B3C").replace("#", "");
}

// ════════════════════════════════════════════════════════════
//  Génère un CV en .docx, en respectant les couleurs du modèle
// ════════════════════════════════════════════════════════════
async function genererCVDocx(data, contenuIA, modele) {
  const couleurPrimaire = hexSansDiese(modele?.couleurs?.primaire);
  const couleurAccent   = hexSansDiese(modele?.couleurs?.accent);

  const enfants = [];

  // ── En-tête : nom + poste ──────────────────────────────────
  enfants.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: (data.nom || "").toUpperCase(),
          bold: true,
          size: 36,
          color: couleurPrimaire,
        }),
      ],
    })
  );

  if (data.poste) {
    enfants.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 150 },
        children: [
          new TextRun({ text: data.poste, size: 24, color: couleurAccent, italics: true }),
        ],
      })
    );
  }

  // ── Coordonnées ────────────────────────────────────────────
  const contacts = [data.email, data.telephone, data.ville].filter(Boolean).join("  •  ");
  if (contacts) {
    enfants.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: contacts, size: 20, color: "555555" })],
      })
    );
  }

  // ── Corps du CV : parsing simple du texte généré par l'IA ──
  const lignes = (contenuIA || "").split("\n");
  for (const ligneBrute of lignes) {
    const ligne = ligneBrute.trim();

    if (!ligne) {
      enfants.push(new Paragraph({ text: "" }));
      continue;
    }

    // Ligne de séparation (═══, ───) → ignorée (le docx a déjà sa propre mise en forme)
    if (/^[═─=\-]{3,}/.test(ligne)) {
      continue;
    }

    // Titre de section en majuscules
    if (ligne === ligne.toUpperCase() && ligne.length > 3 && ligne.length < 60 && !/^[0-9]/.test(ligne)) {
      enfants.push(
        new Paragraph({
          spacing: { before: 200, after: 100 },
          border: {
            bottom: { color: couleurPrimaire, space: 2, style: BorderStyle.SINGLE, size: 6 },
          },
          children: [
            new TextRun({ text: ligne, bold: true, size: 24, color: couleurPrimaire }),
          ],
        })
      );
      continue;
    }

    // Ligne normale
    enfants.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: ligne, size: 20, color: "1A1A2E" })],
      })
    );
  }

  const doc = new Document({
    sections: [{ properties: {}, children: enfants }],
  });

  const nomBase = (data.nom || "document").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  const filePath = path.join(storageDir, `CV_${nomBase}_${Date.now()}.docx`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

// ════════════════════════════════════════════════════════════
//  Génère une Lettre de Motivation en .docx (mise en page simple)
// ════════════════════════════════════════════════════════════
async function genererLMDocx(contenuIA, nomBase) {
  const enfants = [];
  const lignes = (contenuIA || "").split("\n");

  for (const ligneBrute of lignes) {
    const ligne = ligneBrute.trim();
    if (!ligne) {
      enfants.push(new Paragraph({ text: "" }));
      continue;
    }
    enfants.push(
      new Paragraph({
        spacing: { after: 120 },
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: ligne, size: 22, color: "1A1A2E" })],
      })
    );
  }

  const doc = new Document({
    sections: [{ properties: {}, children: enfants }],
  });

  const filePath = path.join(storageDir, `LM_${nomBase}_${Date.now()}.docx`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

// ════════════════════════════════════════════════════════════
//  Génère un document professionnel générique en .docx
//  (Business Plan, Devis, Facture, Rapport, Contrat, Présentation)
// ════════════════════════════════════════════════════════════
async function genererDocumentDocx(contenu, nomBase) {
  const enfants = [];
  const lignes = (contenu || "").split("\n");

  for (const ligneBrute of lignes) {
    const ligne = ligneBrute.trim();

    if (!ligne) {
      enfants.push(new Paragraph({ text: "" }));
      continue;
    }

    // Ligne de séparation → ignorée (mise en forme docx native à la place)
    if (/^[═─=\-]{3,}/.test(ligne)) {
      continue;
    }

    // Titre de section en majuscules
    if (ligne === ligne.toUpperCase() && ligne.length > 3 && ligne.length < 70 && !/^[0-9]/.test(ligne)) {
      enfants.push(
        new Paragraph({
          spacing: { before: 220, after: 110 },
          border: {
            bottom: { color: "1A6B3C", space: 2, style: BorderStyle.SINGLE, size: 6 },
          },
          children: [
            new TextRun({ text: ligne, bold: true, size: 26, color: "1A6B3C" }),
          ],
        })
      );
      continue;
    }

    enfants.push(
      new Paragraph({
        spacing: { after: 100 },
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: ligne, size: 21, color: "1A1A2E" })],
      })
    );
  }

  const doc = new Document({
    sections: [{ properties: {}, children: enfants }],
  });

  const filePath = path.join(storageDir, `${nomBase}_${Date.now()}.docx`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

module.exports = { genererCVDocx, genererLMDocx, genererDocumentDocx };
