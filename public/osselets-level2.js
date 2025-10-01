/* ============================================================================
 * Osselets Level 2 - "Écrire avec les os"
 * 
 * Jeu interactif avec modèle 3D d'astragale (osselet grec)
 * - 24 trous avec lettres grecques assignées
 * - Rotation interactive de l'os
 * - Fil pour relier les lettres et écrire des mots
 * - Occlusion réelle des trous cachés
 * - Édition des lettres par trou
 * 
 * IMPORTANT: Requiert Three.js et GLTFLoader chargés globalement
 * ==========================================================================*/

(() => {
  const DEBUG = /[?&]__L2_DEBUG=on\b/.test(location.search);
  const log = (...a) => DEBUG && console.log('[L2]', ...a);

  /* ----------------------- Configuration ----------------------- */
  const BASE = "/assets/games/osselets/level2/";
  const MODEL = BASE + "3d/astragalus.glb";
  const WORDS_JS = BASE + "3d/letters.json";

  const VIEW = { W: 960, H: 540, DPR_MAX: 2.5 };

  // Paramètres visuels HUD
  const DOT_R = 11;
  const HIT_R = 22;
  const DOT_A = 0.95;
  const DOT_A_H = 0.40;

  // Contrôles
  const ROT_STEP = 0.08;
  const ZOOM_MIN = 0.9, ZOOM_MAX = 1.8;

  // Alphabet grec par défaut
  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  /* ----------------------- Utilitaires ----------------------- */
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fetchJSON = (u) => fetch(u, {cache: "no-store"}).then(r => r.ok ? r.json() : null).catch(() => null);

  // Vérifie que Three.js est chargé
  function checkThreeJS() {
    if (typeof THREE === 'undefined') {
      throw new Error('THREE.js non trouvé. Assurez-vous que Three.js est chargé avant ce script.');
    }
    if (typeof THREE.GLTFLoader === 'undefined') {
      throw new Error('GLTFLoader non trouvé. Assurez-vous que GLTFLoader.js est chargé.');
    }
    log('Three.js version:', THREE.REVISION);
    return true;
  }

  // Charge dynamiquement Three.js si nécessaire
  async function ensureThreeJS() {
    if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined') {
      return true;
    }

    log('Chargement dynamique de Three.js...');
    
    // Charge Three.js
    if (typeof THREE === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r158/three.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Échec du chargement de Three.js'));
        document.head.appendChild(script);
      });
    }

    // Charge GLTFLoader
    if (typeof THREE.GLTFLoader === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/loaders/GLTFLoader.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Échec du chargement de GLTFLoader'));
        document.head.appendChild(script);
      });
    }

    return checkThreeJS();
  }

  function frameToObject(cam, obj, margin = 1.25) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cam.fov * (Math.PI / 180);
    let dist = (maxDim / 2) / Math.tan(fov / 2);
    dist *= margin;

    cam.position.set(center.x + dist * 0.8, center.y + dist * 0.6, center.z + dist);
    cam.near = dist / 100;
    cam.far = dist * 10;
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }

  function normalizeAndCenter(target, aimMaxDim = 2.2) {
    const box = new THREE.Box3().setFromObject(target);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (maxDim > 0.0001) ? (aimMaxDim / maxDim) : 1;
    target.position.sub(center);
    target.scale.setScalar(scale);
    target.updateMatrixWorld(true);
    log('Normalisation: maxDim=%.3f scale=%.3f', maxDim, scale);
  }

  function collectHoles(root) {
    const out = [];
    root.traverse(n => {
      const nm = (n.name || '');
      if (/^hole[_\s-]?/i.test(nm)) out.push(n);
    });
    // Tri pour ordre déterministe
    out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return out;
  }

  function makeUI() {
    const style = 'border:1px solid #2d3b52;background:#0b1f33;color:#e6f1ff;padding:8px 12px;border-radius:10px;cursor:pointer;font-family:ui-sans-serif,system-ui;font-size:14px;';
    
    const createButton = (text, title = '') => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.style.cssText = style;
      b.textContent = text;
      b.title = title;
      return b;
    };

    const uiBar = document.createElement('div');
    uiBar.style.cssText = 'position:absolute;left:18px;bottom:18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;z-index:4;';

    const labelBox = document.createElement('div');
    labelBox.style.cssText = 'color:#e6f1ff;font-size:14px;background:#0b2237cc;padding:10px 14px;border-radius:10px;border:1px solid #ffffff22;';
    labelBox.innerHTML = '<div style="font-weight:600;margin-bottom:4px;">Mot : —</div><div style="font-size:12px;opacity:.8;">Cliquez sur les trous pour créer un fil</div>';

    const btnReset = createButton('Réinitialiser', 'Efface le fil et réinitialise la vue');
    const btnNext = createButton('Mot suivant', 'Passe au mot suivant');
    const btnEdit = createButton('✎ Éditer lettres', 'Modifier les lettres assignées aux trous');

    uiBar.append(labelBox, btnReset, btnNext, btnEdit);

    // Pad de contrôle
    const pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;right:18px;bottom:18px;display:grid;grid-template-columns:repeat(3,44px);grid-auto-rows:44px;gap:10px;background:#0b2237cc;border:1px solid #ffffff22;border-radius:12px;padding:14px;z-index:4;';
    
    const makePadBtn = (txt, title = '') => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.style.cssText = 'width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;' + style;
      b.textContent = txt;
      b.title = title;
      return b;
    };

    const up = makePadBtn('↑', 'Rotation haut');
    const dw = makePadBtn('↓', 'Rotation bas');
    const lf = makePadBtn('←', 'Rotation gauche');
    const rg = makePadBtn('→', 'Rotation droite');
    const rs = makePadBtn('↻', 'Réinitialiser rotation');
    const zi = makePadBtn('+', 'Zoom avant');
    const zo = makePadBtn('−', 'Zoom arrière');

    pad.appendChild(document.createElement('div'));
    pad.appendChild(up);
    pad.appendChild(document.createElement('div'));
    pad.appendChild(lf);
    pad.appendChild(rs);
    pad.appendChild(rg);
    pad.appendChild(zo);
    pad.appendChild(dw);
    pad.appendChild(zi);

    return { uiBar, pad, labelBox, btnReset, btnNext, btnEdit, up, dw, lf, rg, rs, zi, zo };
  }

  /* ----------------------- Jeu principal ----------------------- */
  async function mount(rootEl) {
    log('Initialisation du jeu...');

    // Vérifie/charge Three.js
    try {
      await ensureThreeJS();
    } catch (err) {
      rootEl.innerHTML = `<div style="padding:20px;color:#ff6b6b;background:#0b1f33;border-radius:12px;font-family:system-ui;">${err.message}</div>`;
      return { destroy: () => {} };
    }

    // Configuration DOM
    rootEl.innerHTML = '';
    rootEl.style.cssText = 'position:relative;max-width:100%;';

    const gl = document.createElement('canvas');
    gl.width = VIEW.W;
    gl.height = VIEW.H;
    gl.style.cssText = 'display:block;border-radius:12px;background:transparent;width:100%;height:auto;';
    rootEl.appendChild(gl);

    const hud = document.createElement('canvas');
    hud.width = VIEW.W;
    hud.height = VIEW.H;
    hud.style.cssText = 'position:absolute;inset:0;pointer-events:auto;z-index:3;';
    rootEl.appendChild(hud);

    const ui = makeUI();
    rootEl.append(ui.uiBar, ui.pad);

    // Panneau d'édition
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;right:18px;top:18px;width:280px;max-height:70vh;overflow:auto;background:#0b2237cc;border:1px solid #ffffff22;border-radius:12px;padding:12px;display:none;z-index:5;';
    rootEl.appendChild(panel);

    // Initialisation Three.js
    const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
    renderer.setPixelRatio(clamp(devicePixelRatio || 1, 1, VIEW.DPR_MAX));
    renderer.setSize(VIEW.W, VIEW.H, false);

    const scene = new THREE.Scene();
    scene.background = null;
    
    const cam = new THREE.PerspectiveCamera(45, VIEW.W / VIEW.H, 0.01, 100);
    
    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const dir = new THREE.DirectionalLight(0xffffff, 0.95);
    dir.position.set(2.4, 3.4, 2.6);
    scene.add(dir);

    const pivot = new THREE.Group();
    scene.add(pivot);

    // Chargement des mots
    const cfg = await fetchJSON(WORDS_JS);
    const WORDS = (cfg?.words?.length) ? cfg.words : [
      { gr: "ΕΛΠΙΣ", en: "ELPIS", hint: "Espoir — bon présage." },
      { gr: "ΝΙΚΗ", en: "NIKĒ", hint: "Victoire — élan de réussite." },
      { gr: "ΜΑΤΙ", en: "MATI", hint: "« Mauvais œil » — apotropaïon." }
    ];
    const LETTERS = (cfg?.letters?.length === 24) ? cfg.letters : GREEK.slice();
    let wordIdx = 0;

    function updateWordLabel() {
      const w = WORDS[wordIdx % WORDS.length];
      ui.labelBox.innerHTML = `<div style="font-weight:600;margin-bottom:4px;">Mot : ${w.gr} (${w.en})</div><div style="font-size:12px;opacity:.8;">Indice : ${w.hint}</div>`;
    }
    updateWordLabel();

    // Chargement du modèle
    const loader = new THREE.GLTFLoader();
    let root;
    try {
      root = await new Promise((resolve, reject) => {
        loader.load(
          MODEL,
          (gltf) => {
            const r = gltf.scene || (gltf.scenes && gltf.scenes[0]);
            if (!r) return reject(new Error('Modèle vide'));
            
            r.traverse(o => {
              if (o.isMesh) {
                if (!o.material || !o.material.isMeshStandardMaterial) {
                  o.material = new THREE.MeshStandardMaterial({
                    color: 0xf7efe7,
                    roughness: 0.62,
                    metalness: 0.05
                  });
                }
                o.castShadow = false;
                o.receiveShadow = false;
              }
            });
            resolve(r);
          },
          (progress) => {
            if (progress.lengthComputable) {
              log('Chargement:', Math.round(progress.loaded / progress.total * 100) + '%');
            }
          },
          reject
        );
      });
    } catch (err) {
      console.error('[L2] Erreur chargement modèle:', err);
      rootEl.innerHTML = `<div style="padding:20px;color:#ff6b6b;background:#0b1f33;border-radius:12px;font-family:system-ui;">Erreur: Impossible de charger le modèle 3D.<br><small>Chemin: ${MODEL}</small><br><small>${err.message}</small></div>`;
      return { destroy: () => {} };
    }

    const modelWrap = new THREE.Group();
    modelWrap.add(root);
    pivot.add(modelWrap);

    normalizeAndCenter(modelWrap, 2.25);
    frameToObject(cam, modelWrap, 1.35);

    // Collecte des anchors
    const anchors = collectHoles(modelWrap);
    log('Trous trouvés:', anchors.length, anchors.map(a => a.name));
    
    if (anchors.length === 0) {
      console.warn('[L2] Aucun trou trouvé! Création de trous virtuels...');
      // Crée 24 trous virtuels en cercle
      for (let i = 0; i < 24; i++) {
        const dummy = new THREE.Object3D();
        const angle = (i / 24) * Math.PI * 2;
        const radius = 0.9;
        dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        dummy.name = `Hole_${i + 1}`;
        modelWrap.add(dummy);
        anchors.push(dummy);
      }
    } else if (anchors.length !== 24) {
      console.warn(`[L2] ${anchors.length} trous trouvés (24 attendus)`);
    }

    // État du jeu
    const ctx = hud.getContext('2d');
    const currentPath = [];
    const hiddenFlags = new Array(anchors.length).fill(false);
    const worldPos = anchors.map(() => new THREE.Vector3());
    const ray = new THREE.Raycaster(undefined, undefined, 0.01, 100);

    // Gestion du redimensionnement
    function syncSizes() {
      const w = Math.max(320, rootEl.clientWidth | 0);
      const h = Math.round(w * (VIEW.H / VIEW.W));
      const dpr = clamp(devicePixelRatio || 1, 1, VIEW.DPR_MAX);

      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      const db = new THREE.Vector2();
      renderer.getDrawingBufferSize(db);
      hud.width = db.x | 0;
      hud.height = db.y | 0;
      hud.style.width = w + 'px';
      hud.style.height = h + 'px';

      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      
      log('Redimensionnement:', { w, h, dpr });
    }
    syncSizes();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncSizes) : null;
    if (ro) ro.observe(rootEl);
    window.addEventListener('resize', syncSizes);

    // Projection et occlusion
    function projectHolesAndOcclusion() {
      pivot.updateMatrixWorld(true);
      cam.updateMatrixWorld(true);

      const camPos = new THREE.Vector3();
      cam.getWorldPosition(camPos);
      const dir = new THREE.Vector3();

      for (let i = 0; i < anchors.length; i++) {
        anchors[i].getWorldPosition(worldPos[i]);

        hiddenFlags[i] = false;
        dir.copy(worldPos[i]).sub(camPos).normalize();
        ray.set(camPos, dir);
        const hits = ray.intersectObject(modelWrap, true);
        
        if (hits?.length) {
          const dHole = camPos.distanceTo(worldPos[i]);
          if (hits[0].distance < dHole - 1e-3) {
            hiddenFlags[i] = true;
          }
        }
      }
    }

    function worldToHud(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(cam);
      const px = (v.x * 0.5 + 0.5) * hud.width;
      const py = (-v.y * 0.5 + 0.5) * hud.height;
      return { x: px, y: py };
    }

    function drawHUD() {
      ctx.clearRect(0, 0, hud.width, hud.height);

      // Fil
      if (currentPath.length > 0) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(96,165,250,0.92)';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        for (let k = 0; k < currentPath.length; k++) {
          const idx = currentPath[k];
          const wp = worldPos[idx];
          const p = worldToHud(wp.x, wp.y, wp.z);
          if (k === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Pastilles et lettres
      for (let i = 0; i < anchors.length; i++) {
        const wp = worldPos[i];
        const scr = worldToHud(wp.x, wp.y, wp.z);
        const alpha = hiddenFlags[i] ? DOT_A_H : DOT_A;

        // Cercle
        ctx.beginPath();
        ctx.fillStyle = `rgba(14,165,233,${alpha})`;
        ctx.arc(scr.x, scr.y, DOT_R, 0, Math.PI * 2);
        ctx.fill();

        // Lettre
        if (!hiddenFlags[i] || alpha > 0.3) {
          ctx.fillStyle = 'rgba(230,241,255,1)';
          ctx.font = `${Math.round(DOT_R * 1.2)}px ui-sans-serif, system-ui, -apple-system, Segoe UI`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const letter = LETTERS[i % LETTERS.length] || '';
          ctx.fillText(letter, scr.x, scr.y + 0.5);
        }
      }
    }

    // Interaction
    function pickNearest(clientX, clientY) {
      const rect = hud.getBoundingClientRect();
      const px = (clientX - rect.left) * (hud.width / rect.width);
      const py = (clientY - rect.top) * (hud.height / rect.height);
      
      let best = -1, bd = Infinity;
      for (let i = 0; i < anchors.length; i++) {
        if (hiddenFlags[i]) continue;
        const wp = worldPos[i];
        const p = worldToHud(wp.x, wp.y, wp.z);
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return (bd <= HIT_R) ? best : -1;
    }

    hud.addEventListener('click', (e) => {
      const idx = pickNearest(e.clientX, e.clientY);
      if (idx >= 0) {
        currentPath.push(idx);
        log('Trou sélectionné:', idx, LETTERS[idx]);
      }
    });

    hud.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (currentPath.length > 0) {
        const removed = currentPath.pop();
        log('Trou retiré:', removed);
      }
    });

    // Contrôles
    function reset() {
      currentPath.length = 0;
      pivot.rotation.set(0, 0, 0);
      frameToObject(cam, modelWrap, 1.35);
      cam.zoom = 1;
      cam.updateProjectionMatrix();
      log('Reset effectué');
    }

    ui.btnReset.addEventListener('click', reset);
    ui.btnNext.addEventListener('click', () => {
      wordIdx = (wordIdx + 1) % WORDS.length;
      updateWordLabel();
      reset();
    });

    // Panneau d'édition
    function rebuildPanel() {
      panel.innerHTML = '<div style="font-weight:700;margin-bottom:10px;color:#e6f1ff;">Lettres par trou</div>';
      const list = document.createElement('div');
      list.style.cssText = 'display:grid;grid-template-columns:1fr 70px;gap:8px;';
      
      for (let i = 0; i < Math.min(anchors.length, 24); i++) {
        const lab = document.createElement('div');
        lab.style.cssText = 'color:#9bb2d4;font-size:12px;padding:6px 0;';
        lab.textContent = anchors[i]?.name || `Trou ${i + 1}`;
        
        const inp = document.createElement('input');
        inp.value = LETTERS[i] || '';
        inp.maxLength = 2;
        inp.style.cssText = 'width:70px;background:#001225;color:#e6f1ff;border:1px solid #ffffff25;border-radius:8px;padding:6px 8px;font-size:14px;text-align:center;';
        inp.addEventListener('input', () => {
          LETTERS[i] = inp.value.toUpperCase().slice(0, 2);
        });
        
        list.append(lab, inp);
      }
      panel.appendChild(list);
    }

    ui.btnEdit.addEventListener('click', () => {
      const show = panel.style.display === 'none';
      if (show) rebuildPanel();
      panel.style.display = show ? 'block' : 'none';
    });

    // Nudge controls
    ui.up.addEventListener('click', () => { pivot.rotation.x += ROT_STEP; });
    ui.dw.addEventListener('click', () => { pivot.rotation.x -= ROT_STEP; });
    ui.lf.addEventListener('click', () => { pivot.rotation.y -= ROT_STEP; });
    ui.rg.addEventListener('click', () => { pivot.rotation.y += ROT_STEP; });
    ui.rs.addEventListener('click', reset);
    ui.zi.addEventListener('click', () => {
      cam.zoom = clamp(cam.zoom * 1.12, ZOOM_MIN, ZOOM_MAX);
      cam.updateProjectionMatrix();
    });
    ui.zo.addEventListener('click', () => {
      cam.zoom = clamp(cam.zoom / 1.12, ZOOM_MIN, ZOOM_MAX);
      cam.updateProjectionMatrix();
    });

    // Boucle d'animation
    let raf = 0;
    (function loop() {
      projectHolesAndOcclusion();
      renderer.render(scene, cam);
      drawHUD();
      raf = requestAnimationFrame(loop);
    })();

    log('✓ Jeu initialisé avec succès');

    return {
      destroy() {
        cancelAnimationFrame(raf);
        ro?.disconnect();
        window.removeEventListener('resize', syncSizes);
        try { renderer.dispose(); } catch {}
        rootEl.innerHTML = '';
        log('Jeu détruit');
      }
    };
  }

  // API globale
  window.OsseletsLevel2 = { mount };
  log('✓ Script chargé - Usage: await OsseletsLevel2.mount(element)');
})();
