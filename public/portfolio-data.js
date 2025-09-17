// public/portfolio-data.js
// Unifie l’API attendue : on exporte à la fois window.portfolioData ET window.PORTFOLIO
// (pour compatibilité avec d’anciens scripts).

window.portfolioData = [
  {
    id: "adwall",
    title: "AdWall — mur d'affiches éducatives",
    description: "Mur numérique pour ressources, critères et rappels (classe et école).",
    url: "https://adwall.net",
    tags: ["Outil", "Classe", "Web"]
  },
  {
    id: "documate",
    title: "Documate — générateur de docs pédagogiques",
    description: "Séquences, rubriques et supports rapides.",
    url: "https://documate.work",
    tags: ["Générateur", "Docs", "Web"]
  },
  {
    id: "petnames",
    title: "PetNames — mini-app JS",
    description: "Nommer des personnages / mascottes en classe.",
    url: "https://nix177.github.io/petnames/",
    tags: ["JS", "Demo", "GitHub Pages"]
  }
];

// Compat primaire (si d’autres scripts s’attendent à .items)
window.PORTFOLIO = { items: window.portfolioData };
// Compat secondaire (si un ancien nommage traîne)
window.PORTFOLIO_ITEMS = window.portfolioData;
