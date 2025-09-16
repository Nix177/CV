// portfolio-data.js
window.portfolioItems = [
  {
    id: "documate",
    title: "Documate",
    blurb: "Assistant de documents : simplifier, expliquer, guider (multi-langues).",
    url: "https://documate.work",     // ← vérifie/ajuste si besoin
    repo: null,                       // ex: "https://github.com/…"
    image: "./assets/portfolio/documate.jpg", // optionnel (screenshot)
    tags: ["Site", "IA", "UX simple"],
    allowEmbed: true                  // false si le site bloque l’iframe
  },
  {
    id: "adwall",
    title: "AdWall",
    blurb: "Mur d’idées publicitaires : prompts, slogans, concepts visuels.",
    url: "https://adwall.net",    // ← AJOUTE L’URL RÉELLE
    repo: null,
    image: "./assets/portfolio/adwall.jpg",
    tags: ["Idéation", "Génératif"],
    allowEmbed: false
  },
  {
    id: "petnames",
    title: "Petnames API",
    blurb: "Générateur de noms d’animaux (API + petite UI).",
    url: "https://nix177.github.io/petnames/fr/",  // ← AJOUTE L’URL RÉELLE
    repo: null,
    image: "./assets/portfolio/petnames.jpg",
    tags: ["API", "Front minimal"],
    allowEmbed: true
  }
];
