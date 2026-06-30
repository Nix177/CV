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
      eyebrow: "Prototype local - vrai modèle 3D du site",
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
      showA: "Afficher A",
      showLetters: "Afficher les lettres",
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
      eyebrow: "Local prototype - real 3D model from the site",
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
      showA: "Show A",
      showLetters: "Show letters",
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
      eyebrow: "Lokaler Prototyp - echtes 3D-Modell der Website",
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
      showA: "A anzeigen",
      showLetters: "Buchstaben anzeigen",
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

  const LEVELS = [
    {
      id: 1, mode: "adapted",
      words: { fr: "OBJET", en: "BONES", de: "FADEN" },
      translations: { fr: "objet ancien à observer", en: "bones, the project material", de: "Faden, der die Botschaft trägt" },
      hint: { fr: "Ce que l'on observe au musée ou en classe.", en: "The project is built around this kind of material.", de: "Damit wird die geheime Botschaft geführt." },
      setup: { showA: true, showLetters: true, partialLetters: false },
      label: { fr: "5 lettres, mot du projet", en: "5 letters, project word", de: "5 Buchstaben, Projektwort" }
    },
    {
      id: 2, mode: "adapted",
      words: { fr: "FIBRE", en: "THREAD", de: "KNOCH" },
      translations: { fr: "fil ou matière qui guide le message", en: "thread", de: "début de Knochen, os" },
      hint: { fr: "Pense à ce qui relie les trous.", en: "It passes through the holes.", de: "Es renvoie au Knochen, l'os." },
      setup: { showA: true, showLetters: false, partialLetters: true },
      label: { fr: "5-6 lettres, lettres partielles", en: "5-6 letters, partial labels", de: "5-6 Buchstaben, teils sichtbar" }
    },
    {
      id: 3, mode: "adapted",
      words: { fr: "SIGNE", en: "CODES", de: "CODES" },
      translations: { fr: "marque qui porte une information", en: "marks that carry information", de: "Codes" },
      hint: { fr: "Un trou peut devenir une marque à lire.", en: "A hole can become one of these.", de: "Damit kann man eine Botschaft verschlüsseln." },
      setup: { showA: true, showLetters: false, partialLetters: false },
      label: { fr: "Mot simple de lecture", en: "Simple reading word", de: "Einfaches Code-Wort" }
    },
    {
      id: 4, mode: "adapted",
      words: { fr: "TRACE", en: "TOKEN", de: "DINGE" },
      translations: { fr: "trace laissée par le fil", en: "marker or coded token", de: "Dinge, objets à observer" },
      hint: { fr: "Ce que le fil laisse à suivre.", en: "A small sign that can carry meaning.", de: "Objekte, die man beschreiben und ordnen kann." },
      setup: { showA: true, showLetters: false, partialLetters: true },
      label: { fr: "Adaptation pédagogique", en: "Educational adaptation", de: "Pädagogische Anpassung" }
    },
    {
      id: 5, mode: "adapted",
      words: { fr: "CODES", en: "CIPHER", de: "CODEX" },
      translations: { fr: "messages codés", en: "encoded message system", de: "Code-Buch oder codierte Ordnung" },
      hint: { fr: "Le jeu entraîne à écrire ce type de message.", en: "This is another word for a coded message system.", de: "Ein kurzes Wort für eine codierte Ordnung." },
      setup: { showA: false, showLetters: false, partialLetters: false },
      label: { fr: "Défi sans A visible", en: "Challenge, no visible A", de: "Herausforderung ohne A" }
    }
  ];

  const tr = I18N[LANG] || I18N.fr;
  const state = {
    levelIndex: 0,
    path: [],
    mistakes: 0,
    helpers: new Set(),
    showA: true,
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
  function word() { return level().words ? level().words[LANG] || level().words.fr : level().word; }
  function translit() {
    return word();
  }
  function sequence() {
    const letters = alphabet();
    return word().split("").map(letter => letters.indexOf(letter)).filter(index => index >= 0);
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
    const seq = new Set(state.path);
    const letters = alphabet();
    game.anchorMeshes.forEach((mesh, index) => {
      const selected = seq.has(index);
      const hover = state.hover === index;
      const aVisible = state.showA && letters[index] === "A";
      mesh.scale.setScalar(hover ? 1.55 : selected ? 1.35 : aVisible ? 1.18 : 1);
      mesh.material.color.set(selected ? 0x22c55e : hover ? 0xfacc15 : 0x0ea5a3);
      mesh.material.opacity = game.hidden[index] && !state.xray && !selected ? 0.16 : 0.92;
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
    document.getElementById("btnNextWord").addEventListener("click", () => setLevel((state.levelIndex + 1) % LEVELS.length));
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
      const isA = letters[point.index] === "A";
      const showLetter = point.readable && (
        state.showLetters ||
        (state.showA && isA) ||
        selected ||
        hover ||
        (level().setup.partialLetters && point.face === state.face && point.index % 2 === 0)
      );
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
        ctx.font = `800 ${Math.round(radius * .86)}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letters[point.index], point.x, point.y + 1);
      }
      ctx.restore();
    }
  }

  function setLevel(index) {
    state.levelIndex = index;
    state.path = [];
    state.mistakes = 0;
    state.helpers = new Set();
    state.solved = false;
    state.showA = !!level().setup.showA;
    state.showLetters = !!level().setup.showLetters;
    state.xray = false;
    state.hint = false;
    state.hover = -1;
    state.flash = null;
    els.resultPanel.classList.remove("is-visible");
    feedback(tr.feedbackStart);
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

  function clickHole(index) {
    if (state.solved) return;
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
      ? `${tr.found} : ${displayWord} (${displayTranslit})`
      : `${tr.found} : ${displayWord}`;
    els.resultTranslation.textContent = `${tr.translation} : ${level().translations[LANG] || level().translations.fr}`;
    els.resultHistory.textContent = level().mode === "adapted" ? tr.modernNotice : tr.historical;
  }

  function finishWord() {
    if (state.solved && els.celebration?.classList.contains("is-visible")) return;
    state.solved = true;
    feedback(tr.feedbackSuccess, "good");
    showResult();
    renderScore();
    showCelebration();
    window.setTimeout(() => {
      setLevel((state.levelIndex + 1) % LEVELS.length);
    }, 1350);
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
    const label = el("span", "", tr.targetWord);
    const letters = el("div", "target-letters");
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
      button.innerHTML = `<strong>${tr.level} ${item.id}</strong><span>${item.label[LANG] || item.label.fr}</span>`;
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
    els.answerSlots.replaceChildren(...sequence().map((holeIndex, i) => {
      const slot = el("span", `slot${state.path.length > i ? " is-filled" : ""}`);
      slot.textContent = state.path.length > i ? letters[holeIndex] : "";
      return slot;
    }));
  }

  function renderFaceMap() {
    const selected = new Set(state.path);
    els.faceMap.replaceChildren(...FACE_ORDER.map(face => {
      const cell = el("div", `face-cell${face === state.face ? " active" : ""}`);
      cell.appendChild(el("span", "", tr.faceNames[face] || face));
      const grid = el("div", "dot-grid");
      for (let i = 0; i < 6; i++) {
        const dot = el("i", "mini-dot");
        const globalIndex = FACE_ORDER.indexOf(face) * 6 + i;
        if (selected.has(globalIndex)) dot.classList.add("used");
        grid.appendChild(dot);
      }
      cell.appendChild(grid);
      return cell;
    }));
  }

  function renderScore() {
    els.scoreValue.textContent = Math.max(0, 100 - state.helpers.size * 10 - state.mistakes * 6);
    els.helpValue.textContent = state.helpers.size;
    els.mistakeValue.textContent = state.mistakes;
  }

  function renderHint() {
    els.hintText.textContent = state.hint ? `${tr.hint} : ${level().hint[LANG] || level().hint.fr}` : "";
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
