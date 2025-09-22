/* public/portfolio-data.js
   Données i18n pour le portfolio. Garder ce schéma :
   - image : chemin de la vignette locale
   - tags  : liste non traduite
   - url   : (optionnel) URL commune à toutes les langues
   - i18n.{fr|en|de}.{title, description, url?} :
       si i18n.X.url est présent, on l’utilise ; sinon on retombe sur item.url.
*/

// UPDATE: données corrigées (URLs)
window.portfolioData = [
  {
    id: "adwall",
    image: "/assets/portfolio/thumbs/adwall-thumb.webp",
    tags: ["Web", "Éducation", "Outil"],
    // Lien unique pour toutes les langues
    url: "https://www.adwall.net/",
    i18n: {
      fr: {
        title: "AdWall — mur d'affiches éducatives",
        description: "Mur numérique pour ressources, critères et rappels (classe et école)."
      },
      en: {
        title: "AdWall — educational poster wall",
        description: "Digital wall for resources, success criteria and reminders (class & school)."
      },
      de: {
        title: "AdWall — Plakatwand für den Unterricht",
        description: "Digitale Wand für Materialien, Erfolgskriterien und Erinnerungen (Klasse & Schule)."
      }
    }
  },
  {
    id: "documate",
    image: "/assets/portfolio/thumbs/documate-thumb.webp",
    tags: ["Web", "Generator", "Docs"],
    i18n: {
      fr: {
        title: "Documate — générateur de docs pédagogiques",
        description: "Séquences, rubriques et supports rapides.",
        url: "https://documate.work/fr/"
      },
      en: {
        title: "Documate — teaching document generator",
        description: "Sequences, rubrics and handouts in minutes.",
        url: "https://documate.work/"
      },
      de: {
        title: "Documate — Generator für Unterrichtsdokumente",
        description: "Sequenzen, Beurteilungsraster und Unterlagen in wenigen Minuten.",
        url: "https://documate.work/de/"
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
        url: "https://petnamegenerator.github.io/petname/?lang=fr"
      },
      en: {
        title: "PetNames — tiny JS app",
        description: "Name classroom characters / mascots.",
        url: "https://petnamegenerator.github.io/petname/?lang=en"
      },
      de: {
        title: "PetNames — kleine JS-App",
        description: "Namen für Figuren / Maskottchen im Unterricht.",
        url: "https://petnamegenerator.github.io/petname/?lang=de"
      }
    }
  }
];

// Compat éventuelle pour anciens scripts
window.PORTFOLIO = { items: window.portfolioData };
window.PORTFOLIO_ITEMS = window.portfolioData;
