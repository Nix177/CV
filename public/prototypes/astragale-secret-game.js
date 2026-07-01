(() => {
  const LANG = window.ASTRAGALE_LANG || document.documentElement.lang || "fr";
  const ASTRAGALE_EMBED = /[?&]embed=1\b/.test(location.search);
  if (ASTRAGALE_EMBED) document.documentElement.classList.add("astragale-embed");
  const MODEL_URL = "/assets/astragalus_holes_anchors_copy.glb";
  const VIEW = { minZoom: 0.85, maxZoom: 1.55, dprMax: 2 };
  const FACE_ORDER = ["bassin", "dos", "membres", "ventre"];
  const FACE_YAWS = { bassin: 0.1, dos: Math.PI, membres: -Math.PI / 2, ventre: Math.PI / 2 };
  const LATIN24 = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");

  const I18N = {
    fr: {
      langName: "Français",
      eyebrow: "Prototype du site - vrai modèle 3D",
      title: "Écrire avec les os - Fil & alphabet",
      intro: "Un os percé peut cacher un message. Tourne l'astragale, suis le fil et retrouve le mot secret.",
      badges: ["Prototype pédagogique", "Histoire antique", "3D interactive", "À améliorer / en stabilisation"],
      tutorialTitle: "Tutoriel",
      tutorial: ["Tourne l'objet.", "Trouve le début du fil.", "Clique les trous dans l'ordre pour révéler les lettres."],
      distinctionTitle: "Historique ou adaptation ?",
      historical: "Historique : Énée le Tacticien, au 4e siècle av. J.-C., décrit un astragale percé de 24 trous, six sur chaque face. Les trous correspondent aux 24 lettres grecques. Un fil passe dans les trous du message ; le destinataire suit ou défait le fil pour relever les lettres.",
      adapted: "Adaptation pédagogique : ce prototype utilise des lettres latines et des mots de la langue de la page sur 24 positions, pour garder les 24 trous. Ce n'est pas présenté comme le système antique grec.",
      recenter: "Recentrer",
      nextFace: "Voir face suivante",
      zoomOut: "Zoom arrière",
      zoomIn: "Zoom avant",
      levelTitle: "Progression",
      level: "Niveau",
      helperTitle: "Aides optionnelles",
      xray: "Mode rayon X",
      wordHint: "Indice sur le mot",
      score: "Score",
      helps: "Aides",
      mistakes: "Erreurs",
      answerTitle: "Réponse",
      validate: "Valider",
      undo: "Annuler un trou",
      faceTitle: "Carte des faces",
      faceNote: "La carte indique la face regardée et les trous déjà choisis. Elle ne donne pas automatiquement la solution.",
      resultTitle: "Bilan",
      nextWord: "Mot suivant",
      targetWord: "Mot à écrire",
      bravo: "Bravo !",
      stageNote: "Souris/tactile : glisser pour tourner, molette pour zoomer. Clavier : flèches pour tourner, WASD pour déplacer la vue, +/-, R, F, Entrée.",
      loading: "Chargement du modèle astragalus_holes_anchors_copy.glb et des anchors Hole_*...",
      missingThree: "Three.js ou GLTFLoader n'est pas chargé. Vérifie la connexion aux CDN utilisés par la page de test.",
      missingAnchors: "Le modèle est chargé, mais les 24 anchors Hole_* n'ont pas été trouvés.",
      loaded: count => `Modèle chargé : ${count} anchors de trous détectés.`,
      feedbackStart: "Suis le fil depuis le nœud doré, puis clique le premier trou.",
      feedbackCorrect: "Bon trou. Continue le fil.",
      feedbackReady: "Le mot est complet. Tu peux valider.",
      feedbackWrong: "Ce trou ne correspond pas à la prochaine lettre. Observe le fil et la face active.",
      feedbackTooShort: "Il manque encore des lettres. Suis le fil jusqu'au prochain trou.",
      feedbackSuccess: "Bravo, le message est retrouvé.",
      hint: "Indice",
      found: "Mot",
      translation: "Traduction",
      modernNotice: "Adaptation pédagogique moderne, non historique.",
      faceNames: { bassin: "Bassin", dos: "Dos", membres: "Membres", ventre: "Ventre" }
    },
    en: {
      langName: "English",
      eyebrow: "Site prototype - real 3D model",
      title: "Write with the bones - Thread & alphabet",
      intro: "A pierced bone can hide a message. Rotate the astragalus, follow the thread, and recover the secret word.",
      badges: ["Educational prototype", "Ancient history", "Interactive 3D", "Needs improvement / stabilizing"],
      tutorialTitle: "Tutorial",
      tutorial: ["Rotate the object.", "Find the start of the thread.", "Click the holes in order to reveal the letters."],
      distinctionTitle: "Historical or adapted?",
      historical: "Historical: Aeneas Tacticus, in the 4th century BCE, describes an astragalus pierced with 24 holes, six on each face. The holes correspond to the 24 Greek letters. A thread passes through the holes of the message; the recipient follows or unwinds it to read the letters.",
      adapted: "Educational adaptation: this prototype uses Latin letters and words from the page language on 24 positions, preserving the 24 holes. It is not presented as the ancient Greek system.",
      recenter: "Recenter",
      nextFace: "Next face",
      zoomOut: "Zoom out",
      zoomIn: "Zoom in",
      levelTitle: "Progression",
      level: "Level",
      helperTitle: "Optional aids",
      xray: "X-ray mode",
      wordHint: "Word hint",
      score: "Score",
      helps: "Aids",
      mistakes: "Mistakes",
      answerTitle: "Answer",
      validate: "Validate",
      undo: "Undo one hole",
      faceTitle: "Face map",
      faceNote: "The map shows the current face and already chosen holes. It does not automatically give the solution.",
      resultTitle: "Recap",
      nextWord: "Next word",
      targetWord: "Word to write",
      bravo: "Great!",
      stageNote: "Mouse/touch: drag to rotate, wheel to zoom. Keyboard: arrows to rotate, WASD to pan the view, +/-, R, F, Enter.",
      loading: "Loading astragalus_holes_anchors_copy.glb and Hole_* anchors...",
      missingThree: "Three.js or GLTFLoader is not loaded. Check access to the CDNs used by this test page.",
      missingAnchors: "The model loaded, but the 24 Hole_* anchors were not found.",
      loaded: count => `Model loaded: ${count} hole anchors detected.`,
      feedbackStart: "Follow the thread from the golden knot, then click the first hole.",
      feedbackCorrect: "Correct hole. Keep following the thread.",
      feedbackReady: "The word is complete. You can validate it.",
      feedbackWrong: "That hole is not the next letter. Watch the thread and the active face.",
      feedbackTooShort: "Some letters are still missing. Follow the thread to the next hole.",
      feedbackSuccess: "Well done, the message has been recovered.",
      hint: "Hint",
      found: "Word",
      translation: "Translation",
      modernNotice: "Modern educational adaptation, not historical.",
      faceNames: { bassin: "Pelvis", dos: "Back", membres: "Limbs", ventre: "Belly" }
    },
    de: {
      langName: "Deutsch",
      eyebrow: "Website-Prototyp - echtes 3D-Modell",
      title: "Mit den Knochen schreiben - Faden & Alphabet",
      intro: "Ein durchbohrter Knochen kann eine Botschaft verbergen. Drehe den Astragalus, folge dem Faden und finde das geheime Wort.",
      badges: ["Pädagogischer Prototyp", "Antike Geschichte", "Interaktive 3D", "Zu verbessern / in Stabilisierung"],
      tutorialTitle: "Tutorial",
      tutorial: ["Drehe das Objekt.", "Finde den Anfang des Fadens.", "Klicke die Löcher der Reihe nach an, um die Buchstaben aufzudecken."],
      distinctionTitle: "Historisch oder angepasst?",
      historical: "Historisch: Aineias Taktikos beschreibt im 4. Jh. v. Chr. einen Astragalus mit 24 Löchern, sechs auf jeder Seite. Die Löcher entsprechen den 24 griechischen Buchstaben. Ein Faden läuft durch die Löcher der Botschaft; die empfangende Person folgt ihm oder wickelt ihn ab, um die Buchstaben zu lesen.",
      adapted: "Pädagogische Anpassung: Dieser Prototyp nutzt lateinische Buchstaben und Wörter der Seitensprache auf 24 Positionen, damit die 24 Löcher erhalten bleiben. Das wird nicht als antikes griechisches System dargestellt.",
      recenter: "Zentrieren",
      nextFace: "Nächste Seite",
      zoomOut: "Herauszoomen",
      zoomIn: "Hineinzoomen",
      levelTitle: "Progression",
      level: "Niveau",
      helperTitle: "Optionale Hilfen",
      xray: "Röntgenmodus",
      wordHint: "Worthinweis",
      score: "Punkte",
      helps: "Hilfen",
      mistakes: "Fehler",
      answerTitle: "Antwort",
      validate: "Prüfen",
      undo: "Ein Loch zurück",
      faceTitle: "Seitenkarte",
      faceNote: "Die Karte zeigt die betrachtete Seite und bereits gewählte Löcher. Sie verrät nicht automatisch die Lösung.",
      resultTitle: "Bilanz",
      nextWord: "Nächstes Wort",
      targetWord: "Zu schreibendes Wort",
      bravo: "Bravo!",
      stageNote: "Maus/Touch: ziehen zum Drehen, Mausrad zum Zoomen. Tastatur: Pfeile zum Drehen, WASD zum Verschieben, +/-, R, F, Enter.",
      loading: "Lade astragalus_holes_anchors_copy.glb und Hole_*-Anchors...",
      missingThree: "Three.js oder GLTFLoader ist nicht geladen. Prüfe den Zugriff auf die CDNs dieser Testseite.",
      missingAnchors: "Das Modell wurde geladen, aber die 24 Hole_*-Anchors wurden nicht gefunden.",
      loaded: count => `Modell geladen: ${count} Loch-Anchors erkannt.`,
      feedbackStart: "Folge dem Faden ab dem goldenen Knoten und klicke dann das erste Loch an.",
      feedbackCorrect: "Richtiges Loch. Folge dem Faden weiter.",
      feedbackReady: "Das Wort ist vollständig. Du kannst es prüfen.",
      feedbackWrong: "Dieses Loch ist nicht der nächste Buchstabe. Achte auf den Faden und die aktive Seite.",
      feedbackTooShort: "Es fehlen noch Buchstaben. Folge dem Faden bis zum nächsten Loch.",
      feedbackSuccess: "Sehr gut, die Botschaft ist entschlüsselt.",
      hint: "Hinweis",
      found: "Wort",
      translation: "Übersetzung",
      modernNotice: "Moderne pädagogische Anpassung, nicht historisch.",
      faceNames: { bassin: "Becken", dos: "Rücken", membres: "Gliedmaßen", ventre: "Bauch" }
    }
  };


  const UI_PATCH = {
    fr: {
      tutorial: [
        "Exemples 1 à 4 : clique les trous dans l'ordre du mot donné.",
        "La carte lettres-trous indique quelle lettre correspond à chaque trou.",
        "Mode décodage : suis le fil, lis les lettres sur la carte, puis tape le mot trouvé."
      ],
      helperTitle: "Options utiles",
      xray: "Voir le fil derrière l'os",
      wordHint: "Indice",
      faceTitle: "Carte lettres-trous",
      faceNote: "Carte précomplétée : chaque lettre indique le trou correspondant. En mode décodage, elle sert à lire le fil sans afficher de lettres sur l'osselet.",
      targetWord: "Mot à écrire",
      decodeTargetWord: "Mot à décoder",
      decodePlaceholder: "Tape le mot trouvé",
      clearAnswer: "Effacer",
      feedbackStart: "Clique les trous dans l'ordre du mot affiché.",
      feedbackDecodeStart: "Suis le fil, lis les lettres sur la carte, puis tape le mot trouvé.",
      feedbackDecodeWrong: "Ce n'est pas encore le bon mot. Compare chaque trou relié avec la carte des lettres.",
      feedbackDecodeSuccess: "Bravo, le mot codé par le fil est retrouvé.",
      faceRecto: "Recto",
      faceVerso: "Verso",
      mapSideNote: "lettres visibles sur la carte, pas sur l'osselet",
      writeResult: "Exemple d'écriture : le fil relie les trous du mot donné.",
      decodeResult: "Décodage : le mot est lu en suivant le fil et la carte des lettres."
    },
    en: {
      tutorial: [
        "Examples 1 to 4: click the holes in the order of the given word.",
        "The letter-hole map shows which letter belongs to each hole.",
        "Decode mode: follow the thread, read the letters on the map, then type the word you found."
      ],
      helperTitle: "Useful options",
      xray: "Show thread behind the bone",
      wordHint: "Hint",
      faceTitle: "Letter-hole map",
      faceNote: "Pre-filled map: each letter marks its matching hole. In decode mode, it lets you read the thread without showing letters on the astragalus.",
      targetWord: "Word to write",
      decodeTargetWord: "Word to decode",
      decodePlaceholder: "Type the word you found",
      clearAnswer: "Clear",
      feedbackStart: "Click the holes in the order of the displayed word.",
      feedbackDecodeStart: "Follow the thread, read the letters on the map, then type the word you found.",
      feedbackDecodeWrong: "That is not the word yet. Compare each threaded hole with the letter map.",
      feedbackDecodeSuccess: "Well done, the word encoded by the thread has been recovered.",
      faceRecto: "Front",
      faceVerso: "Back",
      mapSideNote: "letters visible on the map, not on the astragalus",
      writeResult: "Writing example: the thread links the holes of the given word.",
      decodeResult: "Decoding: the word is read by following the thread and the letter map."
    },
    de: {
      tutorial: [
        "Beispiele 1 bis 4: Klicke die Löcher in der Reihenfolge des vorgegebenen Wortes.",
        "Die Buchstaben-Loch-Karte zeigt, welcher Buchstabe zu welchem Loch gehört.",
        "Decodiermodus: Folge dem Faden, lies die Buchstaben auf der Karte und tippe das gefundene Wort ein."
      ],
      helperTitle: "Nützliche Optionen",
      xray: "Faden hinter dem Knochen zeigen",
      wordHint: "Hinweis",
      faceTitle: "Buchstaben-Loch-Karte",
      faceNote: "Vorausgefüllte Karte: Jeder Buchstabe markiert sein Loch. Im Decodiermodus liest man damit den Faden, ohne Buchstaben auf dem Astragalus anzuzeigen.",
      targetWord: "Zu schreibendes Wort",
      decodeTargetWord: "Zu decodierendes Wort",
      decodePlaceholder: "Gefundenes Wort eintippen",
      clearAnswer: "Löschen",
      feedbackStart: "Klicke die Löcher in der Reihenfolge des angezeigten Wortes.",
      feedbackDecodeStart: "Folge dem Faden, lies die Buchstaben auf der Karte und tippe das gefundene Wort ein.",
      feedbackDecodeWrong: "Das ist noch nicht das richtige Wort. Vergleiche jedes Loch am Faden mit der Buchstabenkarte.",
      feedbackDecodeSuccess: "Bravo, das vom Faden codierte Wort wurde gefunden.",
      faceRecto: "Vorderseite",
      faceVerso: "Rückseite",
      mapSideNote: "Buchstaben auf der Karte, nicht auf dem Astragalus",
      writeResult: "Schreibbeispiel: Der Faden verbindet die Löcher des vorgegebenen Wortes.",
      decodeResult: "Decodierung: Das Wort wird über den Faden und die Buchstabenkarte gelesen."
    }
  };
  for (const lang of Object.keys(UI_PATCH)) Object.assign(I18N[lang], UI_PATCH[lang]);

  const LEVELS = [
    {
      id: 1, mode: "write",
      navTitle: { fr: "Exemple 1", en: "Example 1", de: "Beispiel 1" },
      words: { fr: "OBJET", en: "BONES", de: "FADEN" },
      translations: { fr: "mot donné pour apprendre à passer le fil", en: "given word for learning the thread path", de: "vorgegebenes Wort zum Führen des Fadens" },
      hint: { fr: "Suis simplement les lettres du mot affiché.", en: "Just follow the letters of the displayed word.", de: "Folge einfach den Buchstaben des angezeigten Wortes." },
      setup: { showLetters: true, partialLetters: false },
      label: { fr: "Écrire OBJET", en: "Write BONES", de: "FADEN schreiben" }
    },
    {
      id: 2, mode: "write",
      navTitle: { fr: "Exemple 2", en: "Example 2", de: "Beispiel 2" },
      words: { fr: "FIBRE", en: "THREAD", de: "FASER" },
      translations: { fr: "le fil ou la matière qui relie les trous", en: "the thread that links the holes", de: "Faser oder Fadenmaterial, das die Löcher verbindet" },
      hint: { fr: "Cherche chaque lettre sur l'osselet puis clique le trou.", en: "Find each letter on the astragalus, then click its hole.", de: "Suche jeden Buchstaben auf dem Astragalus und klicke sein Loch." },
      setup: { showLetters: true, partialLetters: false },
      label: { fr: "Écrire FIBRE", en: "Write THREAD", de: "FASER schreiben" }
    },
    {
      id: 3, mode: "write",
      navTitle: { fr: "Exemple 3", en: "Example 3", de: "Beispiel 3" },
      words: { fr: "SIGNE", en: "CODES", de: "CODES" },
      translations: { fr: "un signe porte une information", en: "marks can carry information", de: "Codes als geordnete Zeichen" },
      hint: { fr: "Le fil transforme une suite de trous en message.", en: "The thread turns a sequence of holes into a message.", de: "Der Faden verwandelt eine Lochfolge in eine Botschaft." },
      setup: { showLetters: true, partialLetters: false },
      label: { fr: "Écrire SIGNE", en: "Write CODES", de: "CODES schreiben" }
    },
    {
      id: 4, mode: "write",
      navTitle: { fr: "Exemple 4", en: "Example 4", de: "Beispiel 4" },
      words: { fr: "TRACE", en: "TOKEN", de: "DINGE" },
      translations: { fr: "trace laissée par le fil", en: "a small sign carrying meaning", de: "Dinge, objets à observer" },
      hint: { fr: "Dernier exemple guidé avant de lire un mot sans lettres sur l'osselet.", en: "Last guided example before reading a word without letters on the astragalus.", de: "Letztes geführtes Beispiel vor dem Lesen ohne Buchstaben auf dem Astragalus." },
      setup: { showLetters: true, partialLetters: false },
      label: { fr: "Écrire TRACE", en: "Write TOKEN", de: "DINGE schreiben" }
    },
    {
      id: 5, mode: "decode",
      navTitle: { fr: "Décoder", en: "Decode", de: "Decodieren" },
      words: {
        fr: ["OBJET", "TRACE", "SIGNE", "FIBRE", "CODE", "LIEN", "CLEF", "CARTE", "INDEX", "FORME"],
        en: ["BONES", "THREAD", "CODES", "TRACE", "TOKEN", "CIPHER", "CLUE", "MARK", "SHAPE", "FIBER"],
        de: ["FADEN", "FASER", "CODES", "DINGE", "CODEX", "SPUR", "KARTE", "FORM", "MARK", "OBJEKT"]
      },
      translations: { fr: "mot à lire grâce au fil et à la carte", en: "word to read from the thread and map", de: "Wort, das mit Faden und Karte gelesen wird" },
      hint: { fr: "Observe les trous traversés par le fil, puis reporte-toi à la carte.", en: "Look at the holes crossed by the thread, then use the map.", de: "Beobachte die Löcher am Faden und nutze dann die Karte." },
      setup: { showLetters: false, partialLetters: false },
      label: { fr: "10 mots à trouver, sans lettres sur l'osselet", en: "10 words to find, no letters on the astragalus", de: "10 Wörter finden, ohne Buchstaben auf dem Astragalus" }
    }
  ];

  const tr = I18N[LANG] || I18N.fr;
  const state = {
    levelIndex: 0,
    path: [],
    mistakes: 0,
    helpers: new Set(),
    answerText: "",
    decodeIndex: 0,
    showLetters: true,
    xray: false,
    hint: false,
    hover: -1,
    face: "bassin",
    flash: null,
    solved: false,
    dragging: false,
    lastPointer: null
  };

  const els = {
    canvas: document.getElementById("modelCanvas"),
    hud: document.getElementById("hudCanvas"),
    statusBadges: document.getElementById("statusBadges"),
    tutorialList: document.getElementById("tutorialList"),
    distinctionText: document.getElementById("distinctionText"),
    stageNote: document.getElementById("stageNote"),
    loadingNote: document.getElementById("loadingNote"),
    targetWordPanel: document.getElementById("targetWordPanel"),
    celebration: document.getElementById("celebration"),
    levelGrid: document.getElementById("levelGrid"),
    hintText: document.getElementById("hintText"),
    answerSlots: document.getElementById("answerSlots"),
    feedback: document.getElementById("feedback"),
    faceMap: document.getElementById("faceMap"),
    resultPanel: document.getElementById("resultPanel"),
    resultWord: document.getElementById("resultWord"),
    resultTranslation: document.getElementById("resultTranslation"),
    resultHistory: document.getElementById("resultHistory"),
    scoreValue: document.getElementById("scoreValue"),
    helpValue: document.getElementById("helpValue"),
    mistakeValue: document.getElementById("mistakeValue")
  };

  const game = {
    THREE: null,
    renderer: null,
    scene: null,
    camera: null,
    pivot: null,
    modelWrap: null,
    anchors: [],
    anchorMeshes: [],
    occluders: [],
    worldPos: [],
    hidden: [],
    projected: [],
    raycaster: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    targetPan: { x: 0, y: 0 },
    targetRot: { x: 0.18, y: 0.1 },
    raf: 0
  };

  function level() { return LEVELS[state.levelIndex]; }
  function alphabet() { return LATIN24; }
  function localizedWords(item = level()) {
    const source = item.words || item.word || "";
    if (typeof source === "string") return source;
    return source[LANG] || source.fr || "";
  }
  function decodeWords(item = level()) {
    const words = localizedWords(item);
    return Array.isArray(words) ? words : [words];
  }
  function isDecodeMode() { return level().mode === "decode"; }
  function word() {
    const words = decodeWords();
    return words[state.decodeIndex % words.length] || "";
  }
  function normalizeWord(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-X]/g, "");
  }
  function translit() {
    return word();
  }
  function sequence() {
    const letters = alphabet();
    return normalizeWord(word()).split("").map(letter => letters.indexOf(letter)).filter(index => index >= 0);
  }

  function initText() {
    document.querySelectorAll("[data-i18n]").forEach(node => {
      const key = node.dataset.i18n;
      if (typeof tr[key] === "string") node.textContent = tr[key];
    });
    els.statusBadges.replaceChildren(...tr.badges.map(text => el("span", "badge", text)));
    els.tutorialList.replaceChildren(...tr.tutorial.map(text => el("li", "", text)));
    els.distinctionText.textContent = `${tr.historical} ${tr.adapted}`;
    els.stageNote.textContent = tr.stageNote;
    els.loadingNote.textContent = tr.loading;
    document.querySelectorAll("[data-lang-link]").forEach(link => {
      if (link.dataset.langLink === LANG) link.setAttribute("aria-current", "page");
    });
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function showLoadError(message) {
    els.loadingNote.textContent = message;
    els.loadingNote.classList.add("is-error");
  }

  function checkDependencies() {
    const THREE = window.THREE;
    const GLTFLoader = THREE && (THREE.GLTFLoader || window.GLTFLoader);
    if (!THREE || !GLTFLoader) {
      showLoadError(tr.missingThree);
      return null;
    }
    return { THREE, GLTFLoader };
  }

  function initThree(THREE) {
    game.THREE = THREE;
    game.renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: true });
    game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, VIEW.dprMax));
    if ("outputColorSpace" in game.renderer) game.renderer.outputColorSpace = THREE.SRGBColorSpace;

    game.scene = new THREE.Scene();
    game.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.01, 100);
    game.camera.position.set(0, 0.25, 4.6);

    game.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(2.2, 3.4, 2.8);
    game.scene.add(key);
    const fill = new THREE.DirectionalLight(0xf0e5d2, 0.38);
    fill.position.set(-2.4, 1.8, -2.2);
    game.scene.add(fill);

    game.pivot = new THREE.Group();
    game.scene.add(game.pivot);
    game.raycaster = new THREE.Raycaster();
    syncSizes();
  }

  function loadModel(GLTFLoader) {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(MODEL_URL, resolve, undefined, reject);
    });
  }

  function normalizeModel(root) {
    const THREE = game.THREE;
    const wrap = new THREE.Group();
    wrap.add(root);
    const box = new THREE.Box3().setFromObject(wrap);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2.45 / maxDim : 1;
    wrap.position.sub(center);
    wrap.scale.setScalar(scale);
    wrap.updateMatrixWorld(true);
    game.modelWrap = wrap;
    game.pivot.add(wrap);
  }

  function createBoneTexture(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const base = ctx.createLinearGradient(0, 0, 256, 256);
    base.addColorStop(0, "#f3ead8");
    base.addColorStop(0.45, "#d9c7aa");
    base.addColorStop(1, "#b99b78");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const alpha = Math.random() * 0.055;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(80, 54, 34, ${alpha})` : `rgba(255, 255, 245, ${alpha})`;
      ctx.fillRect(x, y, Math.random() * 1.8 + 0.4, Math.random() * 1.8 + 0.4);
    }

    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      const y = Math.random() * 256;
      ctx.moveTo(-20, y);
      for (let x = 0; x <= 280; x += 32) {
        ctx.lineTo(x, y + Math.sin((x + i * 23) * 0.035) * (5 + Math.random() * 5));
      }
      ctx.lineWidth = Math.random() * 1.4 + 0.5;
      ctx.strokeStyle = `rgba(96, 67, 43, ${Math.random() * 0.08 + 0.035})`;
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.8, 1.8);
    texture.needsUpdate = true;
    return texture;
  }

  function prepareModel(root) {
    const THREE = game.THREE;
    const boneTexture = createBoneTexture(THREE);
    const boneMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0e4ce,
      map: boneTexture,
      bumpMap: boneTexture,
      bumpScale: 0.018,
      roughness: 0.94,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: false
    });
    root.traverse(node => {
      const name = node.name || "";
      if (node.isMesh && !/^Hole_/i.test(name)) {
        node.material = boneMaterial.clone();
        node.material.map = boneTexture;
        node.material.bumpMap = boneTexture;
        node.material.side = THREE.DoubleSide;
        node.material.needsUpdate = true;
        game.occluders.push(node);
      }
    });
  }

  function collectAnchors(root) {
    const anchors = [];
    root.traverse(node => {
      if (/^Hole_/i.test(node.name || "")) anchors.push(node);
    });
    anchors.sort((a, b) => {
      const pa = anchorParts(a.name);
      const pb = anchorParts(b.name);
      const fa = FACE_ORDER.indexOf(pa.face);
      const fb = FACE_ORDER.indexOf(pb.face);
      return fa === fb ? pa.number - pb.number : fa - fb;
    });
    return anchors;
  }

  function anchorParts(name) {
    const match = /^Hole_([A-Za-z]+)_(\d+)/.exec(name || "");
    return { face: match ? match[1].toLowerCase() : "", number: match ? Number(match[2]) : 0 };
  }

  function addAnchorMarkers() {
    const THREE = game.THREE;
    const geom = new THREE.SphereGeometry(0.035, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x0ea5a3, transparent: true, opacity: 0.92, depthTest: false });
    game.anchorMeshes = game.anchors.map((anchor, index) => {
      const mesh = new THREE.Mesh(geom, mat.clone());
      mesh.name = `Clickable_${anchor.name}`;
      mesh.renderOrder = 10;
      anchor.add(mesh);
      mesh.userData.holeIndex = index;
      return mesh;
    });
  }

  function updateAnchorMarkers() {
    const selected = new Set(state.path);
    game.anchorMeshes.forEach((mesh, index) => {
      const selectedHole = selected.has(index);
      const hover = state.hover === index;
      mesh.scale.setScalar(hover ? 1.55 : selectedHole ? 1.35 : 1);
      mesh.material.color.set(selectedHole ? 0x22c55e : hover ? 0xfacc15 : 0x0ea5a3);
      mesh.material.opacity = game.hidden[index] && !state.xray && !selectedHole ? 0.16 : 0.92;
      mesh.material.depthTest = !state.xray;
    });
  }

  async function start() {
    initText();
    renderUi();
    const deps = checkDependencies();
    if (!deps) return;
    initThree(deps.THREE);
    try {
      const gltf = await loadModel(deps.GLTFLoader);
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) throw new Error("Empty GLB scene");
      prepareModel(root);
      normalizeModel(root);
      game.anchors = collectAnchors(game.modelWrap);
      if (game.anchors.length !== 24) {
        showLoadError(`${tr.missingAnchors} (${game.anchors.length}/24)`);
        return;
      }
      game.worldPos = game.anchors.map(() => new deps.THREE.Vector3());
      game.hidden = game.anchors.map(() => false);
      addAnchorMarkers();
      els.loadingNote.textContent = tr.loaded(game.anchors.length);
      setLevel(0);
      bindEvents();
      loop();
    } catch (error) {
      showLoadError(`${tr.missingThree} ${error.message || error}`);
    }
  }

  function bindEvents() {
    document.getElementById("btnRecenter").addEventListener("click", recenter);
    document.getElementById("btnNextFace").addEventListener("click", nextFace);
    document.getElementById("btnZoomOut").addEventListener("click", () => changeZoom(0.9));
    document.getElementById("btnZoomIn").addEventListener("click", () => changeZoom(1.1));
    document.getElementById("btnValidate").addEventListener("click", validate);
    document.getElementById("btnUndo").addEventListener("click", undo);
    document.getElementById("btnNextWord").addEventListener("click", nextStep);
    document.querySelectorAll("[data-helper]").forEach(button => {
      button.addEventListener("click", () => toggleHelper(button.dataset.helper));
    });

    els.hud.addEventListener("pointerdown", pointerDown);
    els.hud.addEventListener("pointermove", pointerMove);
    els.hud.addEventListener("pointerup", pointerUp);
    els.hud.addEventListener("pointercancel", pointerUp);
    els.hud.addEventListener("mouseleave", () => { state.hover = -1; renderUi(); });
    els.hud.addEventListener("wheel", event => {
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? 1.06 : 0.94);
    }, { passive: false });
    els.hud.addEventListener("keydown", keyDown);
    window.addEventListener("resize", syncSizes);
  }

  function syncSizes() {
    const stage = els.canvas.parentElement;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, VIEW.dprMax);
    const w = Math.max(320, Math.round(rect.width));
    const h = Math.max(360, Math.round(rect.height));
    game.renderer?.setSize(w, h, false);
    [els.canvas, els.hud].forEach(canvas => {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    });
    if (game.camera) {
      game.camera.aspect = w / h;
      game.camera.updateProjectionMatrix();
    }
  }

  function loop() {
    const THREE = game.THREE;
    if (!THREE) return;
    game.pivot.rotation.x += (game.targetRot.x - game.pivot.rotation.x) * 0.12;
    game.pivot.rotation.y += angleDelta(game.pivot.rotation.y, game.targetRot.y) * 0.12;
    game.pan.x += (game.targetPan.x - game.pan.x) * 0.18;
    game.pan.y += (game.targetPan.y - game.pan.y) * 0.18;
    game.pivot.position.set(game.pan.x, game.pan.y, 0);
    game.camera.zoom += (game.zoom - game.camera.zoom) * 0.18;
    game.camera.updateProjectionMatrix();
    projectAnchors();
    updateAnchorMarkers();
    game.renderer.render(game.scene, game.camera);
    drawHud();
    game.raf = requestAnimationFrame(loop);
  }

  function projectAnchors() {
    const THREE = game.THREE;
    const cameraPos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const screen = new THREE.Vector3();
    game.camera.getWorldPosition(cameraPos);
    game.pivot.updateMatrixWorld(true);
    game.camera.updateMatrixWorld(true);

    game.projected = game.anchors.map((anchor, index) => {
      anchor.getWorldPosition(game.worldPos[index]);
      const wp = game.worldPos[index];
      dir.copy(wp).sub(cameraPos).normalize();
      game.raycaster.set(cameraPos, dir);
      const hits = game.raycaster.intersectObjects(game.occluders, true);
      const dist = cameraPos.distanceTo(wp);
      game.hidden[index] = hits.length > 0 && hits[0].distance < dist - 0.08;
      screen.copy(wp).project(game.camera);
      const onScreen = screen.z > -1 && screen.z < 1;
      const readable = onScreen && !game.hidden[index];
      return {
        index,
        face: anchorParts(anchor.name).face,
        x: (screen.x * 0.5 + 0.5) * els.hud.width,
        y: (-screen.y * 0.5 + 0.5) * els.hud.height,
        z: screen.z,
        visible: onScreen && (readable || state.xray || state.path.includes(index)),
        readable
      };
    });

    const facing = FACE_ORDER.map(face => {
      const faceAnchors = game.projected.filter(point => point.face === face);
      const visibleCount = faceAnchors.filter(point => !game.hidden[point.index]).length;
      const avgZ = faceAnchors.reduce((sum, point) => sum + point.z, 0) / Math.max(1, faceAnchors.length);
      return { face, score: visibleCount * 10 - avgZ };
    }).sort((a, b) => b.score - a.score)[0];
    if (facing && facing.face !== state.face) {
      state.face = facing.face;
      renderFaceMap();
    }
  }

  function drawHud() {
    const ctx = els.hud.getContext("2d");
    ctx.clearRect(0, 0, els.hud.width, els.hud.height);
    drawThread(ctx);
    drawHoleLabels(ctx);
  }

  function drawThread(ctx) {
    const points = sequence().map(index => game.projected[index]).filter(Boolean);
    if (points.length < 2) return;
    drawPath(ctx, points, "rgba(250, 204, 21, .92)", state.xray ? [16, 10] : [], 8);
    if (state.path.length > 1) {
      drawPath(ctx, state.path.map(index => game.projected[index]).filter(Boolean), "rgba(34, 197, 94, .96)", [], 10);
    }
    const start = points[0];
    if (start && start.visible) {
      ctx.beginPath();
      ctx.arc(start.x, start.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = "#facc15";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#78350f";
      ctx.stroke();
    }
  }

  function drawPath(ctx, points, color, dash, width) {
    ctx.save();
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dash);
    ctx.beginPath();
    let started = false;
    for (const point of points) {
      if (!point.visible && !state.xray) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(point.x, point.y);
        started = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.strokeStyle = "rgba(25, 18, 10, .42)";
    ctx.lineWidth = width + 4;
    ctx.stroke();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  function drawHoleLabels(ctx) {
    const letters = alphabet();
    const now = performance.now();
    for (const point of [...game.projected].sort((a, b) => b.z - a.z)) {
      if (!point.visible) continue;
      const selected = state.path.includes(point.index);
      const hover = state.hover === point.index;
      const showLetter = !isDecodeMode() && point.readable && !!level().setup.showLetters;
      const radius = hover ? 24 : 19;

      ctx.save();
      ctx.globalAlpha = game.hidden[point.index] && state.xray ? 0.52 : 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#16a34a" : "#0ea5a3";
      ctx.fill();
      ctx.lineWidth = hover ? 6 : 4;
      ctx.strokeStyle = hover ? "#fde047" : "rgba(255,255,255,.9)";
      ctx.stroke();

      if (state.flash && state.flash.index === point.index && state.flash.until > now) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 12, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = state.flash.good ? "rgba(34,197,94,.94)" : "rgba(239,68,68,.94)";
        ctx.stroke();
      }

      if (showLetter) {
        ctx.fillStyle = "#fff";
        ctx.font = "800 " + Math.round(radius * .86) + "px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letters[point.index], point.x, point.y + 1);
      }
      ctx.restore();
    }
  }

  function setLevel(index, options = {}) {
    state.levelIndex = index;
    if (!options.keepDecodeIndex) state.decodeIndex = 0;
    state.path = [];
    state.answerText = "";
    state.mistakes = 0;
    state.helpers = new Set();
    state.solved = false;
    state.showLetters = !!level().setup.showLetters;
    state.xray = false;
    state.hint = false;
    state.hover = -1;
    state.flash = null;
    els.resultPanel.classList.remove("is-visible");
    feedback(isDecodeMode() ? tr.feedbackDecodeStart : tr.feedbackStart);
    recenter();
    renderUi();
  }

  function recenter() {
    game.targetRot.x = 0.18;
    game.targetRot.y = FACE_YAWS[state.face] || 0;
    game.targetPan.x = 0;
    game.targetPan.y = 0;
    game.zoom = 1;
  }

  function nextFace() {
    const index = (FACE_ORDER.indexOf(state.face) + 1) % FACE_ORDER.length;
    state.face = FACE_ORDER[index];
    game.targetRot.x = 0.18;
    game.targetRot.y = FACE_YAWS[state.face];
    renderFaceMap();
  }

  function changeZoom(multiplier) {
    game.zoom = clamp(game.zoom * multiplier, VIEW.minZoom, VIEW.maxZoom);
  }

  function panView(dx, dy) {
    game.targetPan.x = clamp(game.targetPan.x + dx, -1.25, 1.25);
    game.targetPan.y = clamp(game.targetPan.y + dy, -0.95, 0.95);
  }

  function toggleHelper(name) {
    if (name === "hint") {
      state.hint = !state.hint;
      if (state.hint) state.helpers.add(name);
    } else {
      state[name] = !state[name];
      if (state[name] && !level().setup[name]) state.helpers.add(name);
    }
    renderUi();
  }

  function nextStep() {
    if (isDecodeMode()) {
      const total = decodeWords().length;
      state.decodeIndex = (state.decodeIndex + 1) % total;
      setLevel(state.levelIndex, { keepDecodeIndex: true });
    } else {
      setLevel((state.levelIndex + 1) % LEVELS.length);
    }
  }

  function clickHole(index) {
    if (state.solved) return;
    if (isDecodeMode()) {
      state.flash = { index, good: sequence().includes(index), until: performance.now() + 520 };
      feedback(tr.feedbackDecodeStart);
      renderUi();
      return;
    }
    const seq = sequence();
    if (state.path.length >= seq.length) {
      feedback(tr.feedbackReady, "good");
      return;
    }
    const expected = seq[state.path.length];
    if (index === expected) {
      state.path.push(index);
      state.flash = { index, good: true, until: performance.now() + 520 };
      feedback(state.path.length === seq.length ? tr.feedbackReady : tr.feedbackCorrect, "good");
      if (state.path.length === seq.length) {
        finishWord();
      }
    } else {
      state.mistakes += 1;
      state.flash = { index, good: false, until: performance.now() + 520 };
      feedback(tr.feedbackWrong, "bad");
    }
    renderUi();
  }

  function validate() {
    if (isDecodeMode()) {
      const ok = normalizeWord(state.answerText) === normalizeWord(word());
      if (!ok) {
        state.mistakes += 1;
        feedback(tr.feedbackDecodeWrong, "bad");
        renderScore();
        return;
      }
      state.solved = true;
      finishWord();
      return;
    }
    const seq = sequence();
    const ok = state.path.length === seq.length && state.path.every((index, i) => index === seq[i]);
    if (!ok) {
      state.mistakes += 1;
      feedback(state.path.length < seq.length ? tr.feedbackTooShort : tr.feedbackWrong, "bad");
      renderScore();
      return;
    }
    state.solved = true;
    finishWord();
  }

  function undo() {
    if (isDecodeMode()) {
      state.answerText = "";
      feedback(tr.feedbackDecodeStart);
      renderUi();
      return;
    }
    if (!state.path.length) return;
    state.path.pop();
    state.solved = false;
    els.resultPanel.classList.remove("is-visible");
    feedback(tr.feedbackStart);
    renderUi();
  }

  function feedback(text, kind = "") {
    els.feedback.textContent = text;
    els.feedback.className = `feedback${kind ? ` ${kind}` : ""}`;
  }

  function showResult() {
    els.resultPanel.classList.add("is-visible");
    const displayWord = word();
    const displayTranslit = translit();
    els.resultWord.textContent = displayTranslit && displayTranslit !== displayWord
      ? tr.found + " : " + displayWord + " (" + displayTranslit + ")"
      : tr.found + " : " + displayWord;
    els.resultTranslation.textContent = tr.translation + " : " + (level().translations[LANG] || level().translations.fr);
    els.resultHistory.textContent = isDecodeMode() ? tr.decodeResult : tr.writeResult;
  }

  function finishWord() {
    if (state.solved && els.celebration?.classList.contains("is-visible")) return;
    state.solved = true;
    feedback(isDecodeMode() ? tr.feedbackDecodeSuccess : tr.feedbackSuccess, "good");
    showResult();
    renderScore();
    showCelebration();
    window.setTimeout(nextStep, 1350);
  }

  function showCelebration() {
    if (!els.celebration) return;
    els.celebration.textContent = tr.bravo;
    els.celebration.classList.add("is-visible");
    window.setTimeout(() => {
      els.celebration?.classList.remove("is-visible");
    }, 1050);
  }

  function renderUi() {
    renderTargetWord();
    renderLevels();
    renderHelpers();
    renderAnswer();
    renderFaceMap();
    renderScore();
    renderHint();
  }

  function renderTargetWord() {
    if (!els.targetWordPanel) return;
    const label = el("span", "", isDecodeMode() ? tr.decodeTargetWord : tr.targetWord);
    const letters = el("div", "target-letters");
    if (isDecodeMode()) {
      const progress = el("span", "target-meta", (state.decodeIndex + 1) + "/" + decodeWords().length);
      for (let i = 0; i < sequence().length; i++) {
        letters.appendChild(el("b", "target-letter is-hidden", "?"));
      }
      els.targetWordPanel.replaceChildren(label, progress, letters);
      return;
    }
    for (const letter of word()) {
      letters.appendChild(el("b", "target-letter", letter));
    }
    els.targetWordPanel.replaceChildren(label, letters);
  }

  function renderLevels() {
    els.levelGrid.replaceChildren(...LEVELS.map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level-btn";
      button.setAttribute("aria-pressed", String(index === state.levelIndex));
      const title = item.navTitle?.[LANG] || item.navTitle?.fr || (tr.level + " " + item.id);
      let label = item.label[LANG] || item.label.fr;
      if (item.mode === "decode" && index === state.levelIndex) label += " · " + (state.decodeIndex + 1) + "/" + decodeWords(item).length;
      button.innerHTML = "<strong>" + title + "</strong><span>" + label + "</span>";
      button.addEventListener("click", () => setLevel(index));
      return button;
    }));
  }

  function renderHelpers() {
    document.querySelectorAll("[data-helper]").forEach(button => {
      const name = button.dataset.helper;
      button.textContent = tr[button.dataset.i18n] || button.textContent;
      button.setAttribute("aria-pressed", String(name === "hint" ? state.hint : !!state[name]));
    });
  }

  function renderAnswer() {
    const letters = alphabet();
    const undoButton = document.getElementById("btnUndo");
    if (undoButton) undoButton.textContent = isDecodeMode() ? tr.clearAnswer : tr.undo;
    els.answerSlots.classList.toggle("is-decode", isDecodeMode());
    if (isDecodeMode()) {
      const input = document.createElement("input");
      input.className = "decode-input";
      input.type = "text";
      input.value = state.answerText;
      input.placeholder = tr.decodePlaceholder;
      input.autocomplete = "off";
      input.spellcheck = false;
      input.maxLength = Math.max(8, word().length + 2);
      input.addEventListener("input", event => {
        state.answerText = event.target.value.toUpperCase();
      });
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          validate();
        }
      });
      els.answerSlots.replaceChildren(input);
      return;
    }
    els.answerSlots.replaceChildren(...sequence().map((holeIndex, i) => {
      const slot = el("span", "slot" + (state.path.length > i ? " is-filled" : ""));
      slot.textContent = state.path.length > i ? letters[holeIndex] : "";
      return slot;
    }));
  }

  function renderFaceMap() {
    const selected = new Set(state.path);
    const letters = alphabet();
    const sides = [
      { label: tr.faceRecto, faces: ["bassin", "ventre"] },
      { label: tr.faceVerso, faces: ["dos", "membres"] }
    ];
    els.faceMap.replaceChildren(...sides.map(side => {
      const cell = el("div", "face-cell" + (side.faces.includes(state.face) ? " active" : ""));
      cell.appendChild(el("span", "side-title", side.label));
      cell.appendChild(el("p", "map-side-note", tr.mapSideNote));
      side.faces.forEach(face => {
        const sub = el("div", "face-subface" + (face === state.face ? " active" : ""));
        sub.appendChild(el("span", "face-name", tr.faceNames[face] || face));
        const grid = el("div", "dot-grid");
        for (let i = 0; i < 6; i++) {
          const globalIndex = FACE_ORDER.indexOf(face) * 6 + i;
          const dot = el("i", "mini-dot", letters[globalIndex]);
          if (selected.has(globalIndex)) dot.classList.add("used");
          grid.appendChild(dot);
        }
        sub.appendChild(grid);
        cell.appendChild(sub);
      });
      return cell;
    }));
  }

  function renderScore() {
    els.scoreValue.textContent = Math.max(0, 100 - state.helpers.size * 10 - state.mistakes * 6);
    els.helpValue.textContent = state.helpers.size;
    els.mistakeValue.textContent = state.mistakes;
  }

  function renderHint() {
    els.hintText.textContent = state.hint ? tr.hint + " : " + (level().hint[LANG] || level().hint.fr) : "";
  }

  function pointerPoint(event) {
    const rect = els.hud.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (els.hud.width / rect.width),
      y: (event.clientY - rect.top) * (els.hud.height / rect.height)
    };
  }

  function nearestHole(event) {
    const p = pointerPoint(event);
    let best = -1;
    let dist = Infinity;
    for (const point of game.projected) {
      if (!point.visible) continue;
      const d = Math.hypot(point.x - p.x, point.y - p.y);
      if (d < dist) {
        best = point.index;
        dist = d;
      }
    }
    return dist <= 36 ? best : -1;
  }

  function pointerDown(event) {
    els.hud.setPointerCapture(event.pointerId);
    state.dragging = true;
    state.lastPointer = { x: event.clientX, y: event.clientY, sx: event.clientX, sy: event.clientY };
    els.hud.classList.add("is-dragging");
  }

  function pointerMove(event) {
    if (state.dragging && state.lastPointer) {
      event.preventDefault();
      const dx = event.clientX - state.lastPointer.x;
      const dy = event.clientY - state.lastPointer.y;
      game.targetRot.y += dx * 0.008;
      game.targetRot.x += dy * 0.008;
      state.lastPointer.x = event.clientX;
      state.lastPointer.y = event.clientY;
    } else {
      const hover = nearestHole(event);
      if (hover !== state.hover) state.hover = hover;
    }
  }

  function pointerUp(event) {
    const start = state.lastPointer;
    state.dragging = false;
    state.lastPointer = null;
    els.hud.classList.remove("is-dragging");
    try { els.hud.releasePointerCapture(event.pointerId); } catch {}
    if (!start) return;
    const moved = Math.hypot(event.clientX - start.sx, event.clientY - start.sy);
    if (moved < 7) {
      const index = nearestHole(event);
      if (index >= 0) clickHole(index);
    }
  }

  function keyDown(event) {
    if (event.key === "ArrowLeft") game.targetRot.y -= 0.16;
    else if (event.key === "ArrowRight") game.targetRot.y += 0.16;
    else if (event.key === "ArrowUp") game.targetRot.x -= 0.16;
    else if (event.key === "ArrowDown") game.targetRot.x += 0.16;
    else if (event.key === "+" || event.key === "=") changeZoom(1.08);
    else if (event.key === "-" || event.key === "_") changeZoom(0.92);
    else if (event.key.toLowerCase() === "a") panView(-0.12, 0);
    else if (event.key.toLowerCase() === "d") panView(0.12, 0);
    else if (event.key.toLowerCase() === "w") panView(0, 0.12);
    else if (event.key.toLowerCase() === "s") panView(0, -0.12);
    else if (event.key.toLowerCase() === "r") recenter();
    else if (event.key.toLowerCase() === "f") nextFace();
    else if (event.key === "Enter") validate();
    else return;
    event.preventDefault();
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function angleDelta(from, to) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }

  start();
})();
