// public/portfolio-data.js
// Données i18n : chaque item peut définir i18n.{fr|en|de}.{title,description,url}
// + image (ta vignette locale). Les tags sont libres (non localisés).

window.portfolioData = [
  {
    id: "adwall",
    image: "/assets/portfolio/thumbs/adwall-thumb.webp",
    tags: ["Web", "Éducation", "Outil"],
    i18n: {
      fr: {
        title: "AdWall — mur d'affiches éducatives",
        description: "Mur numérique pour ressources, critères et rappels (classe et école).",
        url: "https://adwall.net/fr"
      },
      en: {
        title: "AdWall — educational poster wall",
        description: "Digital wall for resources, success criteria and reminders (class & school).",
        url: "https://adwall.net/en"
      },
      de: {
        title: "AdWall — Plakatwand für den Unterricht",
        description: "Digitale Wand für Materialien, Erfolgskriterien und Erinnerungen (Klasse & Schule).",
        url: "https://adwall.net/de"
      }
    }
  },
  {
    id: "documate",
    image: "/assets/portfolio/thumbs/documate-thumb.webp",
    tags: ["Web", "Générateur", "Docs"],
    i18n: {
      fr: {
        title: "Documate — générateur de docs pédagogiques",
        description: "Séquences, rubriques et supports rapides.",
        url: "https://documate.work/fr"
      },
      en: {
        title: "Documate — teaching document generator",
        description: "Sequences, rubrics and handouts in minutes.",
        url: "https://documate.work/en"
      },
      de: {
        title: "Documate — Generator für Unterrichtsdokumente",
        description: "Sequenzen, Beurteilungsraster und Unterlagen in wenigen Minuten.",
        url: "https://documate.work/de"
      }
    }
  },
  {
    id: "petnames",
    image: "/assets/portfolio/thumbs/petnames-thumb.webp",
    tags: ["JS", "Demo", "GitHub Pages"],
    i18n: {
      fr: {
        title: "PetNames — mini-app JS",
        description: "Nommer des personnages / mascottes en classe.",
        url: "https://nix177.github.io/petnames/?lang=fr"
      },
      en: {
        title: "PetNames — tiny JS app",
        description: "Name classroom characters / mascots.",
        url: "https://nix177.github.io/petnames/?lang=en"
      },
      de: {
        title: "PetNames — kleine JS-App",
        description: "Namen für Figuren / Maskottchen im Unterricht.",
        url: "https://nix177.github.io/petnames/?lang=de"
      }
    }
  }
];

// Compat si d’anciens scripts lisent d’autres clés
window.PORTFOLIO = { items: window.portfolioData };
window.PORTFOLIO_ITEMS = window.portfolioData;
