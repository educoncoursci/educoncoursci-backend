// ============================================================
//  services/badges.js
//  Lot 5 — Badges de l'espace préparation.
//  Calculés à la volée à partir des scores et examens blancs déjà
//  enregistrés — aucune nouvelle table, aucune modification du
//  moteur de QCM. Un badge une fois débloqué reste acquis (les
//  critères ne redescendent jamais en dessous de ce qui a été réellement
//  atteint, puisqu'ils se basent sur des totaux cumulés).
// ============================================================

const DEFINITIONS = [
  {
    id: "premier-pas",
    nom: "Premier pas",
    description: "Complète ton premier QCM",
    icone: "🎯",
    critere: (s) => s.total_tentatives >= 1,
  },
  {
    id: "assidu",
    nom: "Assidu",
    description: "10 QCM complétés",
    icone: "📚",
    critere: (s) => s.total_tentatives >= 10,
  },
  {
    id: "marathonien",
    nom: "Marathonien",
    description: "50 QCM complétés",
    icone: "🏃",
    critere: (s) => s.total_tentatives >= 50,
  },
  {
    id: "sans-faute",
    nom: "Sans faute",
    description: "Un QCM réussi à 100%",
    icone: "💯",
    critere: (s) => s.meilleur >= 100,
  },
  {
    id: "expert",
    nom: "Expert",
    description: "Moyenne ≥ 80% sur au moins 5 QCM",
    icone: "🏆",
    critere: (s) => s.total_tentatives >= 5 && s.moyenne >= 80,
  },
  {
    id: "examinateur",
    nom: "Prêt pour le jour J",
    description: "3 examens blancs réalisés",
    icone: "⏱️",
    critere: (s) => s.examensBlancs >= 3,
  },
];

function calculerBadges({ total_tentatives = 0, moyenne = 0, meilleur = 0, examensBlancs = 0 }) {
  const stats = {
    total_tentatives: Number(total_tentatives) || 0,
    moyenne: Number(moyenne) || 0,
    meilleur: Number(meilleur) || 0,
    examensBlancs: Number(examensBlancs) || 0,
  };

  return DEFINITIONS.map((def) => ({
    id: def.id,
    nom: def.nom,
    description: def.description,
    icone: def.icone,
    debloque: def.critere(stats),
  }));
}

module.exports = { calculerBadges, DEFINITIONS };
