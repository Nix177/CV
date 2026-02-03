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
    image: "/assets/portfolio/thumbs/telescope-onstep.png",
    tags: ["Hardware", "Astronomie", "DIY"],
    url: "#",
    i18n: {
      fr: {
        title: "Télescope OnStep (WIP)",
        description: "Motorisation GoTo d'une monture équatoriale avec OnStep (ESP32). Impression 3D, électronique et calibration."
      },
      en: {
        title: "OnStep Telescope (WIP)",
        description: "GoTo motorization of an equatorial mount with OnStep (ESP32). 3D printing, electronics, and calibration."
      },
      de: {
        title: "OnStep Teleskop (WIP)",
        description: "GoTo-Motorisierung einer Äquatorialmontierung mit OnStep (ESP32). 3D-Druck, Elektronik und Kalibrierung."
      }
    }
  },
  {
    id: "robotarm",
    image: "/assets/portfolio/thumbs/robot-arm.png",
    tags: ["Robotics", "3D Print", "ROS"],
    url: "#",
    i18n: {
      fr: {
        title: "Robot & Bras Robotisé (WIP)",
        description: "Bras 6 axes et rover mobile imprimés en 3D. Expérimentations avec ROS, cinématique inverse et vision."
      },
      en: {
        title: "Robot & Robotic Arm (WIP)",
        description: "3D printed 6-axis arm and mobile rover. Experiments with ROS, inverse kinematics, and computer vision."
      },
      de: {
        title: "Roboter & Roboterarm (WIP)",
        description: "3D-gedruckter 6-Achsen-Arm und mobiler Rover. Experimente mit ROS, inverser Kinematik und Vision."
      }
    }
  },
  {
    id: "bm800",
    image: "/assets/portfolio/thumbs/bm800-mod.png",
    tags: ["Audio", "Electronics", "PCB"],
    url: "#",
    i18n: {
      fr: {
        title: "BM-800 Mod (WIP)",
        description: "Upgrade complet d'un micro bon marché : circuit Schoeps/Alice, capsule RK-47 pour une qualité studio."
      },
      en: {
        title: "BM-800 Mod (WIP)",
        description: "Complete upgrade of a cheap mic: Schoeps/Alice circuit, RK-47 capsule for studio quality."
      },
      de: {
        title: "BM-800 Mod (WIP)",
        description: "Komplettes Upgrade eines billigen Mikrofons: Schoeps/Alice-Schaltung, RK-47-Kapsel für Studioqualität."
      }
    }
  }
];

// Compat éventuelle pour anciens scripts
window.PORTFOLIO = { items: window.portfolioData };
window.PORTFOLIO_ITEMS = window.portfolioData;
