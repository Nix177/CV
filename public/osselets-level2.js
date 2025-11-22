/* ============================================================================
 * public/osselets-level2.js — L2 « Écrire avec les os »
 * * - Charge /assets/games/osselets/level2/3d/astragalus.glb
 * - Fallback automatique si GLTFLoader est bloqué (AdBlock)
 * - Collecte 24 ancres "Hole_*" (6 par face)
 * - HUD 2D avec projection + occlusion réelle
 * - Gameplay : Relier les lettres dans l'ordre pour former le mot cible
 * ==========================================================================*/

(() => {
  const DEBUG = /[?&]__L2_DEBUG=on\b/.test(location.search) || window.__L2_DEBUG;
  const log = (...a) => DEBUG && console.log('[L2]', ...a);

  /* ----------------------- Config ----------------------- */
  const BASE = "/assets/games/osselets/level2/";
  const MODEL = BASE + "3d/astragalus.glb";
  const WORDS_JS = BASE + "3d/letters.json";

  const VIEW = { W: 960, H: 540, DPR_MAX: 2.5 };
  
  // Visuels HUD
  const DOT_R = 11;
  const HIT_R = 22;
  const DOT_A = 0.8;      // Transparence des points non validés
  const DOT_A_H = 0.15;   // Transparence si caché derrière l'os
  
  // Contrôles
  const ROT_STEP = 0.08;
  const ZOOM_MIN = 0.9, ZOOM_MAX = 1.8;

  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  /* ----------------------- Utils ----------------------- */
  const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
  const fetchJSON = (u) => fetch(u, {cache:"no-store"}).then(r => r.ok ? r.json() : null).catch(() => null);

  function waitForGlobal(name, cb, tries = 60) {
    const g = window && window[name];
    if (g) return cb(g);
    if (tries <= 0) { 
      console.error('[L2] Global introuvable:', name); 
      return; 
    }
    setTimeout(() => waitForGlobal(name, cb, tries - 1), 125);
  }

  function frameToObject(THREE, cam, obj, margin = 1.25) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cam.fov * (Math.PI/180);
    let dist = (maxDim/2) / Math.tan(fov/2);
    dist *= margin;
    cam.position.set(center.x + dist*0.8, center.y + dist*0.6, center.z + dist);
    cam.near = dist/100;
    cam.far = dist*10;
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }

  function normalizeAndCenter(THREE, target, aimMaxDim = 2.2) {
    const box = new THREE.Box3().setFromObject(target);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (maxDim > 0.0001) ? (aimMaxDim / maxDim) : 1;
    target.position.sub(center);
    target.scale.setScalar(scale);
    target.updateMatrixWorld(true);
    log('normalize: maxDim=%.3f scale=%.3f', maxDim, scale);
  }

  function collectHoles(root) {
    const out = [];
    root.traverse(n => {
      const nm = (n.name || '');
      if (/^hole[_\s-]?/i.test(nm)) out.push(n);
    });
    out.sort((a,b) => (a.name||'').localeCompare(b.name||''));
    return out;
  }

  function makeNudgePad() {
    const pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;right:18px;bottom:18px;display:grid;grid-template-columns:repeat(3,44px);grid-auto-rows:44px;gap:10px;background:#0b2237;border:1px solid #ffffff22;border-radius:12px;padding:14px;';
    
    const mk = (txt, title = '') => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.style.cssText = 'width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;font-size:18px;';
      b.textContent = txt;
      b.title = title;
      return b;
    };
    const up = mk('↑', 'Rotation X+');
    const dw = mk('↓', 'Rotation X−');
    const lf = mk('←', 'Rotation Y−');
    const rg = mk('→', 'Rotation Y+'); 
    const rs = mk('⟲', 'Recadrer');
    const zi = mk('+',  'Zoom +');
    const zo = mk('−',  'Zoom −');
    pad.appendChild(document.createElement('div'));
    pad.appendChild(up);
    pad.appendChild(document.createElement('div'));
    pad.appendChild(lf);
    pad.appendChild(rs);
    pad.appendChild(rg);
    pad.appendChild(zo);
    pad.appendChild(dw);
    pad.appendChild(zi);
    
    return { pad, up, dw, lf, rg, rs, zi, zo };
  }

  /* ----------------------- Main Mount ----------------------- */
  async function mount(rootEl) {
    log('mount() - démarrage');

    return new Promise((resolve) => {
      waitForGlobal('THREE', async (THREE) => {
        
        /* --- GESTION ROBUSTE DU CHARGEMENT (Multi-CDN) --- */
        let GLTFLoader = THREE.GLTFLoader || window.GLTFLoader;

        if (!GLTFLoader) {
          log('GLTFLoader manquant. Tentative de secours (v0.147.0)...');
          const BACKUP_URLS = [
            'https://unpkg.com/three@0.147.0/examples/js/loaders/GLTFLoader.js',
            'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js',
            'https://rawcdn.githack.com/mrdoob/three.js/r147/examples/js/loaders/GLTFLoader.js'
          ];

          for (const url of BACKUP_URLS) {
            if (THREE.GLTFLoader || window.GLTFLoader) break;
            try {
              log('Essai chargement:', url);
              await new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = url;
                s.onload = res;
                s.onerror = rej;
                document.head.appendChild(s);
              });
              await new Promise(r => setTimeout(r, 50));
            } catch (e) {
              log('Échec sur:', url);
            }
          }
          GLTFLoader = THREE.GLTFLoader || window.GLTFLoader;
        }

        if (!GLTFLoader) {
          console.error('[L2] Fatal: Impossible de charger GLTFLoader après 3 tentatives.');
        } else {
          log('GLTFLoader actif.');
        }
        /* ---------------------------------------------------------- */
          
        // DOM setup
        rootEl.innerHTML = '';
        rootEl.style.position = 'relative';
        rootEl.style.minHeight = '54vh';

        const gl = document.createElement('canvas');
        gl.width = VIEW.W;
        gl.height = VIEW.H;
        gl.style.cssText = 'display:block;border-radius:12px;background:transparent;width:100%;height:auto;';
        rootEl.appendChild(gl);

        const hud = document.createElement('canvas');
        hud.width = VIEW.W;
        hud.height = VIEW.H;
        hud.style.cssText = 'position:absolute;inset:0;pointer-events:auto;';
        rootEl.appendChild(hud);

        const uiBar = document.createElement('div');
        uiBar.style.cssText = 'position:absolute;left:18px;bottom:18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;z-index:10;';
        rootEl.appendChild(uiBar);

        const btnReset = document.createElement('button');
        btnReset.className = 'btn';
        btnReset.textContent = 'Réinitialiser';

        const btnNext = document.createElement('button');
        btnNext.className = 'btn';
        btnNext.textContent = 'Mot suivant';

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn';
        btnEdit.textContent = '✎  Éditer lettres';
        btnEdit.style.display = 'none'; 

        const labelBox = document.createElement('div');
        labelBox.style.cssText = 'color:#e6f1ff;font-size:15px;background:#0b2237cc;padding:8px 14px;border-radius:8px;border:1px solid #ffffff22;margin-right:6px;';
        labelBox.innerHTML = 'Chargement...';

        uiBar.append(labelBox, btnReset, btnNext, btnEdit);

        const panel = document.createElement('div');
        panel.style.cssText = 'position:absolute;right:18px;top:18px;width:260px;max-height:min(70vh,600px);overflow:auto;background:#0b2237;border:1px solid #ffffff22;border-radius:12px;padding:12px;display:none;z-index:10;';
        panel.innerHTML = '<div style="font-weight:700;margin-bottom:8px">Lettres par trou</div>';
        rootEl.appendChild(panel);

        const { pad, up, dw, lf, rg, rs, zi, zo } = makeNudgePad();
        rootEl.appendChild(pad);

        // Renderer
        const renderer = new THREE.WebGLRenderer({canvas: gl, antialias: true, alpha: true});
        renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
        renderer.setPixelRatio(clamp(devicePixelRatio || 1, 1, VIEW.DPR_MAX));
        renderer.setSize(VIEW.W, VIEW.H, false);

        // Scene/Camera
        const scene = new THREE.Scene();
        scene.background = null;
        
        const cam = new THREE.PerspectiveCamera(45, VIEW.W/VIEW.H, 0.01, 100);
        
        // --- CORRECTION ÉCLAIRAGE : Moins fort pour éviter le "tout blanc" ---
        scene.add(new THREE.AmbientLight(0xffffff, 0.45)); 
        const dir = new THREE.DirectionalLight(0xffffff, 0.65);
        dir.position.set(2.4, 3.4, 2.6);
        scene.add(dir);

        const pivot = new THREE.Group();
        scene.add(pivot);

        // Load words/letters config
        const cfg = await fetchJSON(WORDS_JS);
        const WORDS = (cfg && Array.isArray(cfg.words) && cfg.words.length) ? cfg.words : [
          { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
          { gr:"ΝΙΚΗ", en:"NIKĒ", hint:"Victoire — élan de réussite." },
          { gr:"ΜΑΤΙ", en:"MATI", hint:"« Mauvais œil » — apotropaïon." }
        ];
        
        const LETTERS = (cfg && Array.isArray(cfg.letters) && cfg.letters.length === 24) 
          ? cfg.letters 
          : GREEK.slice();
        
        let wordIdx = 0;
        let currentTargetWord = "";
        let currentTargetHint = "";

        function refreshTitle(currentProgress = []) {
          const w = WORDS[wordIdx % WORDS.length];
          currentTargetWord = w.gr; // ex: "ΕΛΠΙΣ"
          currentTargetHint = w.hint;

          let display = "";
          for(let i=0; i<currentTargetWord.length; i++) {
             if(i < currentProgress.length) {
               display += `<span style="color:#4ade80;font-weight:bold">${currentTargetWord[i]}</span> `;
             } else {
               display += "_ ";
             }
          }

          labelBox.innerHTML = `
            <div style="font-size:12px;opacity:.7;margin-bottom:2px">Objectif : ${w.en}</div>
            <div style="font-size:18px;letter-spacing:2px;">${display}</div>
            <div style="font-size:11px;opacity:.6;margin-top:4px">${w.hint}</div>
          `;
        }

        // Load model
        if (!GLTFLoader) return; 
        const loader = new GLTFLoader();
        
        loader.load(MODEL, (gltf) => {
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root) {
            console.error('[L2] Modèle vide');
            return;
          }

          root.traverse(o => {
            if (o.isMesh) {
              if (!o.material || !o.material.isMeshStandardMaterial) {
                o.material = new THREE.MeshStandardMaterial({
                  color: 0xebe0d0, // Beige os légèrement foncé
                  roughness: 0.7,
                  metalness: 0.0
                });
              }
              o.castShadow = false;
              o.receiveShadow = false;
            }
          });

          const modelWrap = new THREE.Group();
          modelWrap.add(root);
          pivot.add(modelWrap);

          normalizeAndCenter(THREE, modelWrap, 2.25);
          frameToObject(THREE, cam, modelWrap, 1.35);

          const anchors = collectHoles(modelWrap);
          log('anchors trouvés:', anchors.length);

          // HUD state
          const ctx = hud.getContext('2d');
          const currentPath = []; // indices des trous validés
          const hiddenFlags = new Array(anchors.length).fill(false);
          const worldPos = anchors.map(() => new THREE.Vector3());
          const ray = new THREE.Raycaster(undefined, undefined, 0.01, 100);

          refreshTitle(currentPath);

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
          }
          syncSizes();
          const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(syncSizes) : null;
          if (ro) ro.observe(rootEl);
          window.addEventListener('resize', syncSizes);

          function projectHolesAndOcclusion() {
            pivot.updateMatrixWorld(true);
            cam.updateMatrixWorld(true);
            const camPos = new THREE.Vector3();
            cam.getWorldPosition(camPos);
            const dir = new THREE.Vector3();

            for (let i = 0; i < anchors.length; i++) {
              const n = anchors[i];
              n.getWorldPosition(worldPos[i]);
              hiddenFlags[i] = false;
              dir.copy(worldPos[i]).sub(camPos).normalize();
              ray.set(camPos, dir);
              const hits = ray.intersectObject(modelWrap, true);
              if (hits && hits.length) {
                const dHole = camPos.distanceTo(worldPos[i]);
                if (hits[0].distance < dHole - 1e-3) hiddenFlags[i] = true;
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

            // 1. Dessiner le fil (path)
            if (currentPath.length > 0) {
              ctx.lineWidth = 4;
              ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)'; // Vert clair
              ctx.beginPath();
              for (let k = 0; k < currentPath.length; k++) {
                const idx = currentPath[k];
                const p = worldToHud(worldPos[idx].x, worldPos[idx].y, worldPos[idx].z);
                if (k === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
              }
              ctx.stroke();
            }

            // 2. Dessiner les points ET LES LETTRES
            for (let i = 0; i < anchors.length; i++) {
              const wp = worldPos[i];
              const scr = worldToHud(wp.x, wp.y, wp.z);
              const isHidden = hiddenFlags[i];
              const isSelected = currentPath.includes(i);
              
              // Afficher si sélectionné OU visible (non caché par l'os)
              if (isSelected || !isHidden) {
                // Rond
                const alpha = isSelected ? 1.0 : (isHidden ? 0.2 : DOT_A);
                ctx.beginPath();
                if (isSelected) ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`; // Vert
                else ctx.fillStyle = `rgba(14,165,233,${alpha})`; // Bleu
                ctx.arc(scr.x, scr.y, DOT_R, 0, Math.PI * 2);
                ctx.fill();

                // Lettre (Correction : on affiche toujours si le point est visible)
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.round(DOT_R * 1.3)}px ui-sans-serif, system-ui`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const letter = LETTERS[i % LETTERS.length];
                ctx.fillText(letter, scr.x, scr.y + 1);
              }
            }
          }

          function pickNearest(clientX, clientY) {
            const rect = hud.getBoundingClientRect();
            const px = (clientX - rect.left) * (hud.width / rect.width);
            const py = (clientY - rect.top) * (hud.height / rect.height);
            let best = -1, bd = Infinity;
            for (let i = 0; i < anchors.length; i++) {
              if (hiddenFlags[i]) continue; // On ne peut pas cliquer à travers l'os
              const wp = worldPos[i];
              const p = worldToHud(wp.x, wp.y, wp.z);
              const d = Math.hypot(p.x - px, p.y - py);
              if (d < bd) { bd = d; best = i; }
            }
            return (bd <= HIT_R) ? best : -1;
          }

          function onClick(e) {
            if (currentPath.length >= currentTargetWord.length) return;

            const idx = pickNearest(e.clientX, e.clientY);
            if (idx >= 0) {
              const letterClicked = LETTERS[idx % LETTERS.length];
              const letterExpected = currentTargetWord[currentPath.length];

              if (letterClicked === letterExpected) {
                currentPath.push(idx);
                refreshTitle(currentPath);
                
                if (currentPath.length === currentTargetWord.length) {
                  setTimeout(() => {
                     alert("Bravo ! Mot complet : " + currentTargetWord);
                     wordIdx = (wordIdx + 1) % WORDS.length;
                     reset();
                  }, 250);
                }
              } else {
                log('Mauvais trou. Attendu:', letterExpected, 'Cliqué:', letterClicked);
              }
            }
          }

          function onContext(e) {
            e.preventDefault();
            if (currentPath.length > 0) {
              currentPath.pop();
              refreshTitle(currentPath);
            }
          }

          hud.addEventListener('click', onClick);
          hud.addEventListener('contextmenu', onContext);

          function reset() {
            currentPath.length = 0;
            refreshTitle(currentPath);
            pivot.rotation.set(0, 0, 0);
            frameToObject(THREE, cam, modelWrap, 1.35);
            cam.zoom = clamp(cam.zoom, ZOOM_MIN, ZOOM_MAX);
            cam.updateProjectionMatrix();
          }

          btnReset.addEventListener('click', reset);
          btnNext.addEventListener('click', () => {
            wordIdx = (wordIdx + 1) % WORDS.length;
            reset();
          });

          // Contrôles Pad
          up.addEventListener('click', () => { pivot.rotation.x += ROT_STEP; });
          dw.addEventListener('click', () => { pivot.rotation.x -= ROT_STEP; });
          lf.addEventListener('click', () => { pivot.rotation.y -= ROT_STEP; });
          rg.addEventListener('click', () => { pivot.rotation.y += ROT_STEP; });
          rs.addEventListener('click', reset);
          zi.addEventListener('click', () => { cam.zoom = clamp(cam.zoom * 1.12, ZOOM_MIN, ZOOM_MAX); cam.updateProjectionMatrix(); });
          zo.addEventListener('click', () => { cam.zoom = clamp(cam.zoom / 1.12, ZOOM_MIN, ZOOM_MAX); cam.updateProjectionMatrix(); });

          let raf = 0;
          (function loop() {
            projectHolesAndOcclusion();
            renderer.render(scene, cam);
            drawHUD();
            raf = requestAnimationFrame(loop);
          })();

          // Info footer
          const foot = document.createElement('div');
          foot.style.cssText = 'position:absolute;left:18px;top:18px;color:#9bb2d4;font-size:12px;opacity:.8;display:none';
          rootEl.appendChild(foot);

          log('Jeu initialisé avec succès');

          resolve({
            destroy() {
              cancelAnimationFrame(raf);
              ro?.disconnect();
              window.removeEventListener('resize', syncSizes);
              try {
                hud.removeEventListener('click', onClick);
                hud.removeEventListener('contextmenu', onContext);
              } catch {}
              try { renderer.dispose(); } catch {}
              rootEl.innerHTML = '';
              log('destroyed');
            }
          });
        }, 
        (progress) => {
          if (progress && progress.total) {
            // log('chargement:', Math.round((progress.loaded / progress.total) * 100) + '%');
          }
        },
        (err) => {
          console.error('[L2] Erreur de chargement:', err);
          rootEl.innerHTML = '<div style="color:#ff6b6b;padding:20px;text-align:center;">Erreur de chargement du modèle 3D</div>';
        });

      });
    });
  }

  window.OsseletsLevel2 = { mount };
  log('script chargé, timestamp:', Date.now());
})();
