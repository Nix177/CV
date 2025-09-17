// public/portfolio-data.js
window.PORTFOLIO_ITEMS = [
  {
    id: 'adwall',
    title: "AdWall — mur d'affiches éducatives",
    desc: "Mur numérique pour ressources, critères et rappels (classe et école).",
    url: "https://adwall.net",
    preview: false,       // X-Frame-Options probable → on évite l’embed
    icon: "🧱"
  },
  {
    id: 'documate',
    title: "Documate — générateur de docs pédagogiques",
    desc: "Séquences, rubriques et supports rapides.",
    url: "https://documate.work",
    preview: false,       // souvent no-embed → on ouvre dans un nouvel onglet
    icon: "🧩"
  },
  {
    id: 'petnames',
    title: "PetNames — mini-app JS",
    desc: "Nommer des personnages / mascottes en classe.",
    url: "https://nix177.github.io/petnames/",
    preview: true,        // GitHub Pages autorise généralement l’embed
    icon: "🐾"
  }
];
