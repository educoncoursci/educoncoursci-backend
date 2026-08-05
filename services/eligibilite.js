// ============================================================
//  services/eligibilite.js
//  Moteur d'éligibilité (Module 3 du brief).
//
//  Principe : pour chaque concours ouvert ou à venir, on compare
//  les critères RENSEIGNÉS par le concours (âge, sexe, diplômes
//  acceptés) aux critères fournis par le candidat. Un critère non
//  renseigné côté concours ne bloque jamais (concours ouvert à
//  tous sur ce point) ; un critère non fourni côté candidat n'est
//  simplement pas évalué (on ne pénalise pas l'utilisateur qui
//  préfère ne pas tout renseigner).
//
//  Score = (critères remplis / critères applicables) × 100.
//  Un concours sans aucun critère applicable est considéré comme
//  100% compatible (rien ne l'exclut).
// ============================================================

const { query } = require("../config/database");

async function calculerEligibilite({ age, sexe, diplomeId }) {
  // Récupère tous les concours actionnables (ouverts ou à venir),
  // avec la liste des diplômes acceptés agrégée en une seule requête
  // pour éviter le N+1.
  const result = await query(`
    SELECT
      c.id, c.titre, c.organisme, c.categorie, c.statut, c.niveau,
      c.ouverture, c.cloture, c.age_min, c.age_max, c.sexe, c.couleur, c.premium,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', d.id, 'nom', d.nom))
        FILTER (WHERE d.id IS NOT NULL),
        '[]'
      ) AS diplomes_acceptes
    FROM concours c
    LEFT JOIN concours_diplomes cd ON cd.concours_id = c.id
    LEFT JOIN diplomes d ON d.id = cd.diplome_id
    WHERE c.statut IN ('ouvert', 'à venir')
    GROUP BY c.id
    ORDER BY c.id DESC
  `);

  const accessibles = [];
  const bientotAccessibles = [];
  const incompatibles = [];

  for (const c of result.rows) {
    const raisons = [];
    let critèresApplicables = 0;
    let critèresRemplis = 0;

    // ── Âge ──────────────────────────────────────────────────
    if (c.age_min != null || c.age_max != null) {
      if (age != null) {
        critèresApplicables++;
        const okMin = c.age_min == null || age >= c.age_min;
        const okMax = c.age_max == null || age <= c.age_max;
        if (okMin && okMax) {
          critèresRemplis++;
        } else {
          const borne =
            c.age_min != null && c.age_max != null
              ? `${c.age_min}-${c.age_max} ans`
              : c.age_min != null
                ? `à partir de ${c.age_min} ans`
                : `jusqu'à ${c.age_max} ans`;
          raisons.push(`Âge requis : ${borne} (tu as indiqué ${age} ans)`);
        }
      }
    }

    // ── Sexe ─────────────────────────────────────────────────
    if (c.sexe && c.sexe !== "tous") {
      if (sexe) {
        critèresApplicables++;
        if (sexe === c.sexe) {
          critèresRemplis++;
        } else {
          raisons.push(`Concours réservé : ${c.sexe}`);
        }
      }
    }

    // ── Diplôme ──────────────────────────────────────────────
    if (Array.isArray(c.diplomes_acceptes) && c.diplomes_acceptes.length > 0) {
      if (diplomeId != null) {
        critèresApplicables++;
        const accepte = c.diplomes_acceptes.some((d) => d.id === diplomeId);
        if (accepte) {
          critèresRemplis++;
        } else {
          raisons.push(
            `Diplôme requis parmi : ${c.diplomes_acceptes.map((d) => d.nom).join(", ")}`,
          );
        }
      }
    }

    const score =
      critèresApplicables === 0
        ? 100
        : Math.round((critèresRemplis / critèresApplicables) * 100);

    const fiche = {
      id: c.id,
      titre: c.titre,
      organisme: c.organisme,
      categorie: c.categorie,
      statut: c.statut,
      niveau: c.niveau,
      ouverture: c.ouverture,
      cloture: c.cloture,
      couleur: c.couleur,
      premium: c.premium,
      score,
      raisons,
    };

    if (raisons.length > 0) {
      incompatibles.push(fiche);
    } else if (c.statut === "ouvert") {
      accessibles.push(fiche);
    } else {
      bientotAccessibles.push(fiche);
    }
  }

  // Recommandations : les mieux notées parmi accessibles + bientôt accessibles
  const recommandations = [...accessibles, ...bientotAccessibles]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    accessibles: accessibles.sort((a, b) => b.score - a.score),
    bientotAccessibles: bientotAccessibles.sort((a, b) => b.score - a.score),
    incompatibles: incompatibles.sort((a, b) => b.score - a.score),
    recommandations,
  };
}

module.exports = { calculerEligibilite };
