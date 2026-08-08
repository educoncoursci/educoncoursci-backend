// ============================================================
//  controllers/eligibiliteController.js
//  Module 3 — Moteur d'éligibilité intelligent.
// ============================================================

const { calculerEligibilite } = require("../services/eligibilite");

exports.verifier = async (req, res) => {
  try {
    const { age, sexe, diplomeId } = req.body;

    // Tous les critères sont optionnels — un candidat peut ne
    // renseigner que ce qu'il souhaite ; moins il en donne, moins
    // le moteur peut affiner, mais rien n'est bloquant.
    const ageNum = age != null && age !== "" ? parseInt(age) : null;
    if (age != null && age !== "" && (isNaN(ageNum) || ageNum < 10 || ageNum > 80)) {
      return res.status(400).json({ error: "Âge invalide." });
    }
    const sexeValide = ["hommes", "femmes"].includes(sexe) ? sexe : null;
    const diplomeIdNum = diplomeId != null && diplomeId !== "" ? parseInt(diplomeId) : null;

    const resultat = await calculerEligibilite({
      age: ageNum,
      sexe: sexeValide,
      diplomeId: diplomeIdNum,
    });

    res.json(resultat);
  } catch (err) {
    console.error("Erreur moteur d'éligibilité :", err.message);
    res.status(500).json({ error: "Erreur lors du calcul d'éligibilité." });
  }
};
