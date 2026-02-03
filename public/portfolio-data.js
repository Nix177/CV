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
        description: "Mur numérique pour tests sur les google ads (en cours)."
      },
      en: {
        title: "AdWall — educational poster wall",
        description: "Digital wall for Google Ads testing (in progress)."
      },
      de: {
        title: "AdWall — Plakatwand für den Unterricht",
        description: "Digitale Wand für Google-Ads-Tests (in Arbeit)."
      }
    }
  },
  {
    id: "documate",
    image: "/assets/portfolio/thumbs/documate-thumb.webp",
    tags: ["Web", "Generator", "Docs"],
    i18n: {
      fr: {
        title: "Documate — explication de documents",
        description: "Explique à partir de texte, photo, fichiers, avec chatbot.",
        url: "https://documate.work/fr/"
      },
      en: {
        title: "Documate — explain documents",
        description: "Explain documents from text, pictures, files; with chatbot.",
        url: "https://documate.work/"
      },
      de: {
        title: "Documate — Dokumente erklären",
        description: "Dokumente aus Text, Bildern und Dateien erklären – mit Chatbot.",
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
        title: "PetNames — mini-app JS, IA",
        description: "Nommer des animaux de compagnie / personnages / mascottes.",
        url: "https://petnamegenerator.github.io/petname/?lang=fr"
      },
      en: {
        title: "PetNames — tiny JS app, AI",
        description: "Name pets / characters / mascots.",
        url: "https://petnamegenerator.github.io/petname/?lang=en"
      },
      de: {
        title: "PetNames — kleine JS/KI-App",
        description: "Haustiere / Figuren / Maskottchen benennen.",
        url: "https://petnamegenerator.github.io/petname/?lang=de"
      }
    }
  },
  {
    id: "telescope",
    image: "/assets/portfolio/thumbs/telescope-onstep-v2.png",
    tags: ["Hardware", "Astronomie", "DIY"],
    url: "https://www.thingiverse.com/thing:5531109",
    i18n: {
      fr: {
        title: "Télescope OnStep (WIP)",
        description: "Motorisation GoTo d'une monture équatoriale avec OnStep (ESP32). Projet en cours basé sur le design Thingiverse #5531109."
      },
      en: {
        title: "OnStep Telescope (WIP)",
        description: "GoTo motorization of an equatorial mount with OnStep (ESP32). Work in progress based on Thingiverse #5531109."
      },
      de: {
        title: "OnStep Teleskop (WIP)",
        description: "GoTo-Motorisierung einer Äquatorialmontierung mit OnStep (ESP32). Laufendes Projekt basierend auf Thingiverse #5531109."
      }
    }
  },
  {
    id: "robotarm",
    image: "/assets/portfolio/thumbs/rover-blue.jpg",
    tags: ["Robotics", "3D Print", "ROS"],
    url: "http://www.eezyrobots.it/eba_mk2.html",
    i18n: {
      fr: {
        title: "Robot & Bras Robotisé (WIP)",
        description: "Rover autonome (photo) avec intégration prévue du bras EezyBotArm MK2. Projet en cours (ROS, vision)."
      },
      en: {
        title: "Robot & Robotic Arm (WIP)",
        description: "Autonomous rover (pictured) with planned EezyBotArm MK2 integration. Work in progress (ROS, vision)."
      },
      de: {
        title: "Roboter & Roboterarm (WIP)",
        description: "Autonomer Rover (im Bild) mit geplanter EezyBotArm MK2 Integration. Laufendes Projekt (ROS, Vision)."
      }
    }
  },
  {
    id: "bm800",
    image: "/assets/portfolio/thumbs/bm800-kit.png",
    tags: ["Audio", "Electronics", "PCB"],
    url: "https://audioimprov.com/AudioImprov/Mics/Entries/2013/8/8_Mic-Parts_RK-47.html",
    i18n: {
      fr: {
        title: "BM-800 Mod (WIP)",
        description: "Upgrade complet d'un micro BM-800. Projet en cours inspiré par le mod Schoeps/Alice et capsule RK-47."
      },
      en: {
        title: "BM-800 Mod (WIP)",
        description: "Complete upgrade of a BM-800 mic. Work in progress inspired by Schoeps/Alice mod and RK-47 capsule."
      },
      de: {
        title: "BM-800 Mod (WIP)",
        description: "Komplettes Upgrade eines BM-800. Laufendes Projekt inspiriert vom Schoeps/Alice Mod und RK-47 Kapsel."
      }
    }
  }
];

// Compat éventuelle pour anciens scripts
window.PORTFOLIO = { items: window.portfolioData };
window.PORTFOLIO_ITEMS = window.portfolioData;
