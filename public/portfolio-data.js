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
        description: "Réalisation DIY d'une monture équatoriale motorisée (système OnStep/ESP32). Reproduction adaptée du design Thingiverse #5531109. Pilotage ASCOM/INDI."
      },
      en: {
        title: "OnStep Telescope (GoTo DIY)",
        description: "DIY build of a motorized equatorial mount (OnStep/ESP32 system). Adapted reproduction of Thingiverse design #5531109. ASCOM/INDI control."
      },
      de: {
        title: "OnStep Teleskop (GoTo DIY)",
        description: "DIY-Bau einer motorisierten parallaktischen Montierung (OnStep/ESP32). Angepasste Reproduktion des Designs Thingiverse #5531109. ASCOM/INDI-Steuerung."
      }
    }
  },
  {
    id: "robotarm",
    image: "/assets/portfolio/thumbs/rover-blue.jpg",
    url: "https://www.printables.com/model/678307-esp32-cam-rover-with-robotic-arm",
    extraLinks: [
      { label: "Design Rover (Printables)", url: "https://www.printables.com/model/678307-esp32-cam-rover-with-robotic-arm" },
      { label: "Design Bras (Thingiverse)", url: "https://www.thingiverse.com/thing:1454048" }
    ],
    i18n: {
      fr: {
        title: "Rover & Bras (Architecture Distribuée)",
        description: "Rover 6x6 'Rocker-Bogie' (WildWilly) + Bras EEZYbotARM Mk2. Architecture 'Cerveau (Pi Zero 2W) + Muscles (ESP32)'. Drivers BTS7960 (3S Li-ion). Vision double (Eye-in-hand + Nav)."
      },
      en: {
        title: "Rover & Arm (Distributed Arch)",
        description: "6x6 'Rocker-Bogie' Rover (WildWilly) + EEZYbotARM Mk2. 'Brain (Pi Zero 2W) + Muscle (ESP32)' architecture. BTS7960 drivers (3S Li-ion). Dual Vision (Eye-in-hand + Nav)."
      },
      de: {
        title: "Rover & Arm (Verteilte Architektur)",
        description: "6x6 'Rocker-Bogie' Rover + EEZYbotARM Mk2. 'Brain (Pi Zero 2W) + Muscle (ESP32)' Architektur. BTS7960 Treiber (3S Li-ion). Dual Vision (Eye-in-hand + Nav)."
      }
    }
  },
  {
    id: "agora-multi",
    image: "/assets/portfolio/thumbs/agora-multi.png",
    tags: ["EdTech", "Ethics", "Web", "Collaborative"],
    url: "https://nix177.github.io/agora-numerique/index.html",
    i18n: {
      fr: {
        title: "Agora Numérique (Multi-joueurs)",
        description: "Plateforme collaborative de débats éthiques (Projet BNF - HEP Fribourg). Scénarios immersifs avec dilemmes philosophiques pour enseignement secondaire (Philosophie/Éthique)."
      },
      en: {
        title: "Agora Numérique (Multi-player)",
        description: "Collaborative ethical debate platform (BNF Project - HEP Fribourg). Immersive scenarios with philosophical dilemmas for secondary education (Philosophy/Ethics)."
      },
      de: {
        title: "Agora Numérique (Mehrspieler)",
        description: "Kollaborative Debattenplattform für Ethik (BNF-Projekt - HEP Fribourg). Immersive Szenarien mit philosophischen Dilemmata für Sekundarstufe (Philosophie/Ethik)."
      }
    }
  },
  {
    id: "agora-solo",
    image: "/assets/portfolio/thumbs/agora-solo.png",
    tags: ["EdTech", "Ethics", "Mobile", "Interactive Fiction"],
    url: "https://nix177.github.io/agora-numerique/index.html",
    i18n: {
      fr: {
        title: "Agora Numérique Solo (Livre Interactif)",
        description: "Mode solo 'Livre dont vous êtes le héros' pour débats éthiques. Dilemmes moraux interactifs, prévu pour déploiement Android/iOS."
      },
      en: {
        title: "Agora Numérique Solo (Interactive Book)",
        description: "Solo 'choose-your-own-adventure' mode for ethical debates. Interactive moral dilemmas, planned for Android/iOS deployment."
      },
      de: {
        title: "Agora Numérique Solo (Interaktives Buch)",
        description: "Solo-Modus 'Spielbuch' für ethische Debatten. Interaktive moralische Dilemmata, geplant für Android/iOS-Bereitstellung."
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
        description: "Conversion complète (Mod) basée sur l'architecture 'Alice' (Schoeps CMC5 simplifié). Circuit discret (JFET 2SK117/J305 + PNP A1015) et capsule RK-47 (True Condenser) pour une fidélité studio."
      },
      en: {
        title: "BM-800 Mod (Studio Quality)",
        description: "Full conversion (Mod) based on 'Alice' architecture (simplified Schoeps CMC5). Discrete circuit (JFET 2SK117/J305 + PNP A1015) and RK-47 capsule (True Condenser) for studio fidelity."
      },
      de: {
        title: "BM-800 Mod (Studio Quality)",
        description: "Komplette Umwandlung (Mod) basierend auf 'Alice'-Architektur (vereinfachtes Schoeps CMC5). Diskrete Schaltung (JFET 2SK117/J305 + PNP A1015) und RK-47 Kapsel (True Condenser) für Studioqualität."
      }
    }
  }
];

// Compat éventuelle pour anciens scripts
window.PORTFOLIO = { items: window.portfolioData };
window.PORTFOLIO_ITEMS = window.portfolioData;
