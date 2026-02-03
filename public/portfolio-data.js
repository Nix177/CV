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
        title: "Télescope OnStep (GoTo DIY)",
        description: "Transformation d'une monture manuelle en système GoTo intelligent (ESP32, suivi sidéral). Compatible ASCOM/INDI pour pilotage via PC/Tablette."
      },
      en: {
        title: "OnStep Telescope (GoTo DIY)",
        description: "Conversion of a manual mount into an intelligent GoTo system (ESP32, sidereal tracking). ASCOM/INDI compatible for PC/Tablet control."
      },
      de: {
        title: "OnStep Teleskop (GoTo DIY)",
        description: "Umbau einer manuellen Montierung in ein intelligentes GoTo-System (ESP32, siderische Nachführung). ASCOM/INDI-kompatibel."
      }
    }
  },
  {
    id: "robotarm",
    image: "/assets/portfolio/thumbs/rover-blue.jpg",
    tags: ["Robotics", "Micro-ROS", "AI"],
    url: "https://www.printables.com/model/678307-esp32-cam-rover-with-robotic-arm",
    i18n: {
      fr: {
        title: "Rover & Bras (Micro-ROS)",
        description: "Combinaison d'un Rover (navigation autonome, LiDAR) et d'un Bras 6 axes (cinématique inverse). Architecture distribuée via Micro-ROS. Basé sur Thingiverse #1454048 & Printables #678307."
      },
      en: {
        title: "Rover & Arm (Micro-ROS)",
        description: "Combination of a Rover (autonomous navigation, LiDAR) and a 6-axis Arm (inverse kinematics). Distributed architecture via Micro-ROS. Based on Thingiverse #1454048 & Printables #678307."
      },
      de: {
        title: "Rover & Arm (Micro-ROS)",
        description: "Kombination aus Rover (autonome Navigation, LiDAR) und 6-Achsen-Arm (inverse Kinematik). Verteilte Architektur über Micro-ROS. Basierend auf Thingiverse #1454048 & Printables #678307."
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
        title: "BM-800 Mod (Studio Quality)",
        description: "Upgrade complet (circuit Schoeps/Alice + capsule RK-47) pour transformer un micro bon marché en outil de qualité studio."
      },
      en: {
        title: "BM-800 Mod (Studio Quality)",
        description: "Complete upgrade (Schoeps/Alice circuit + RK-47 capsule) to turn a cheap mic into a studio-quality tool."
      },
      de: {
        title: "BM-800 Mod (Studio Quality)",
        description: "Komplettes Upgrade (Schoeps/Alice-Schaltung + RK-47-Kapsel) zur Umwandlung eines billigen Mikrofons in Studioqualität."
      }
    }
  }
];

// Compat éventuelle pour anciens scripts
window.PORTFOLIO = { items: window.portfolioData };
window.PORTFOLIO_ITEMS = window.portfolioData;
