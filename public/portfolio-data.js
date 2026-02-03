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
    url: "#",
    i18n: {
      fr: {
        title: "Télescope OnStep (WIP)",
        description: "Motorisation GoTo d'une monture équatoriale avec OnStep (ESP32). Impression 3D (modèle Thingiverse), électronique personnalisée."
      },
      en: {
        title: "OnStep Telescope (WIP)",
        description: "GoTo motorization of an equatorial mount with OnStep (ESP32). 3D printing (Thingiverse), custom electronics."
      },
      de: {
        title: "OnStep Teleskop (WIP)",
        description: "GoTo-Motorisierung einer Äquatorialmontierung mit OnStep (ESP32). 3D-Druck (Thingiverse), Elektronik."
      }
    }
  },
  {
    id: "robotarm",
    image: "/assets/portfolio/thumbs/rover-blue.jpg",
    tags: ["Robotics", "3D Print", "ROS"],
    url: "#",
    i18n: {
      fr: {
        title: "Robot & Bras Robotisé (WIP)",
        description: "Rover autonome (châssis bleu imprimé 3D) avec projet d'intégration d'un bras Eezybotarm MK2. IA et cinématique."
      },
      en: {
        title: "Robot & Robotic Arm (WIP)",
        description: "Autonomous rover (blue 3D printed chassis) with planned Eezybotarm MK2 integration. AI and kinematics."
      },
      de: {
        title: "Roboter & Roboterarm (WIP)",
        description: "Autonomer Rover (blaues 3D-Druck-Chassis) mit geplanter Eezybotarm MK2-Integration. KI und Kinematik."
      }
    }
  },
  {
    id: "bm800",
    image: "/assets/portfolio/thumbs/bm800-kit.png",
    tags: ["Audio", "Electronics", "PCB"],
    url: "#",
    i18n: {
      fr: {
        title: "BM-800 Mod (WIP)",
        description: "Upgrade d'un kit BM-800 standard : remplacement du circuit par une PCB Schoeps/Alice et capsule RK-47."
      },
      en: {
        title: "BM-800 Mod (WIP)",
        description: "Upgrade of a standard BM-800 kit: circuit replacement with Schoeps/Alice PCB and RK-47 capsule."
      },
      de: {
        title: "BM-800 Mod (WIP)",
        description: "Upgrade eines Standard-BM-800-Kits: Schaltungsaustausch durch Schoeps/Alice-PCB und RK-47-Kapsel."
      }
    }
  }
];

// Compat éventuelle pour anciens scripts
window.PORTFOLIO = { items: window.portfolioData };
window.PORTFOLIO_ITEMS = window.portfolioData;
