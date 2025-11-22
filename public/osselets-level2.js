/* ============================================================================
 * public/osselets-level2.js — L2 « Écrire avec les os »
 * * - Charge /assets/games/osselets/level2/3d/astragalus.glb
 * - Fallback automatique si GLTFLoader est bloqué (AdBlock)
 * - Gameplay : Relier les lettres + Rotation intuitive (Trackball/Drag)
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
  const ROT_SPEED = 0.006; // Vitesse de rotation à la souris
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
    // On garde les boutons pour l'accessibilité, mais on peut les réduire ou les cacher si le drag suffit
    const pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;right:18px;bottom:18px;display:grid;grid-template-columns:repeat(3,44px);grid-auto-rows:44px;gap:10px;background:#0b2237;border:1px solid #ffffff22;border-radius:12px;padding:14px;opacity:0.8;transform:scale(0.8);transform-origin:bottom right;';
    
    const mk = (txt, title = '') => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.style.cssText = 'width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;font-size:18px;';
      b.textContent = txt;
      b.title = title;
      return b;
    };
    const rs = mk('⟲', 'Recadrer');
    const zi = mk('+',  'Zoom +');
    const zo = mk('−',  'Zoom −');
    
    // Layout simplifié (juste Zoom et Reset, puisque le drag gère la rotation)
    pad.appendChild(zo);
    pad.appendChild(rs);
    pad.appendChild(zi);
    
    return { pad, rs, zi, zo };
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
              await new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = url;
                s.onload = res;
                s.onerror = rej;
                document.head.appendChild(s);
              });
              await new Promise(r => setTimeout(r, 50));
            } catch (e) {}
          }
          GLTFLoader = THREE.GLTFLoader || window.GLTFLoader;
        }

        if (!GLTFLoader) {
          console.error('[L2] Fatal: Impossible de charger GLTFLoader.');
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
        // IMPORTANT : touch-action: none pour que le drag ne scrolle pas la page sur mobile
        hud.style.cssText = 'position:absolute;inset:0;pointer-events:auto;touch-action:none;cursor:grab;';
        rootEl.appendChild(hud);

        const uiBar = document.createElement('div');
        uiBar.style.cssText = 'position:absolute;left:18px;bottom:18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;z-index:10;pointer-events:none;'; // pointer-events:none pour laisser passer le drag si on clique à côté
        
        // Wrapper pour que les boutons reçoivent quand même les clics
        const btnWrap = (btn) => { btn.style.pointerEvents = 'auto'; return btn; };

        const btnReset = document.createElement('button');
        btnReset.className = 'btn';
        btnReset.textContent = 'Réinitialiser';
        btnWrap(btnReset);

        const btnNext = document.createElement('button');
        btnNext.className = 'btn';
        btnNext.textContent = 'Mot suivant';
        btnWrap(btnNext);

        const labelBox = document.createElement('div');
        labelBox.style.cssText = 'color:#e6f1ff;font-size:15px;background:#0b2237cc;padding:8px 14px;border-radius:8px;border:1px solid #ffffff22;margin-right:6px;pointer-events:auto;';
        labelBox.innerHTML = 'Chargement...';

        uiBar.append(labelBox, btnReset, btnNext);
        rootEl.appendChild(uiBar);

        const { pad, rs, zi, zo } = makeNudgePad();
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
        
        // Eclairage doux
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
                  color: 0xebe0d0,
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

            // 1. Dessiner le fil
            if (currentPath.length > 0) {
              ctx.lineWidth = 4;
              ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
              ctx.beginPath();
              for (let k = 0; k < currentPath.length; k++) {
                const idx = currentPath[k];
                const p = worldToHud(worldPos[idx].x, worldPos[idx].y, worldPos[idx].z);
                if (k === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
              }
              ctx.stroke();
            }

            // 2. Dessiner les points & lettres
            for (let i = 0; i < anchors.length; i++) {
              const wp = worldPos[i];
              const scr = worldToHud(wp.x, wp.y, wp.z);
              const isHidden = hiddenFlags[i];
              const isSelected = currentPath.includes(i);
              
              // On affiche TOUJOURS la lettre si elle n'est pas cachée, 
              // ou si elle est déjà sélectionnée (pour voir le fil).
              if (isSelected || !isHidden) {
                const alpha = isSelected ? 1.0 : DOT_A;
                ctx.beginPath();
                if (isSelected) ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
                else ctx.fillStyle = `rgba(14,165,233,${alpha})`;
                
                ctx.arc(scr.x, scr.y, DOT_R, 0, Math.PI * 2);
                ctx.fill();

                // Lettre
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.round(DOT_R * 1.3)}px ui-sans-serif, system-ui`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const letter = LETTERS[i % LETTERS.length];
                ctx.fillText(letter, scr.x, scr.y + 1);
              }
            }
          }

          // --- GESTION DU DRAG (Rotation) & CLICK ---
          let isDragging = false;
          let startX = 0, startY = 0;
          let lastX = 0, lastY = 0;

          function onPointerDown(e) {
            isDragging = true;
            hud.setPointerCapture(e.pointerId);
            startX = e.clientX;
            startY = e.clientY;
            lastX = e.clientX;
            lastY = e.clientY;
            hud.style.cursor = 'grabbing';
          }

          function onPointerMove(e) {
            if (!isDragging) return;
            e.preventDefault(); // Empêche le scroll sur mobile
            
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            // Rotation "Trackball" (autour des axes du monde = plus intuitif)
            // Axe X souris -> Rotation autour de l'axe Y du monde (vertical)
            // Axe Y souris -> Rotation autour de l'axe X du monde (horizontal)
            pivot.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dx * ROT_SPEED);
            pivot.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), dy * ROT_SPEED);
          }

          function onPointerUp(e) {
            isDragging = false;
            hud.releasePointerCapture(e.pointerId);
            hud.style.cursor = 'grab';

            // Si on a très peu bougé (< 5px), on considère que c'est un CLIC
            const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
            if (dist < 6) {
              handleHoleClick(e.clientX, e.clientY);
            }
          }

          hud.addEventListener('pointerdown', onPointerDown);
          hud.addEventListener('pointermove', onPointerMove);
          hud.addEventListener('pointerup', onPointerUp);

          // Logique de sélection de trou
          function handleHoleClick(cx, cy) {
            if (currentPath.length >= currentTargetWord.length) return;

            const rect = hud.getBoundingClientRect();
            const px = (cx - rect.left) * (hud.width / rect.width);
            const py = (cy - rect.top) * (hud.height / rect.height);
            
            let best = -1, bd = Infinity;
            for (let i = 0; i < anchors.length; i++) {
              if (hiddenFlags[i]) continue; // On ne clique pas à travers l'os
              const wp = worldPos[i];
              const p = worldToHud(wp.x, wp.y, wp.z);
              const d = Math.hypot(p.x - px, p.y - py);
              if (d < bd) { bd = d; best = i; }
            }

            if (best >= 0 && bd <= HIT_R) {
              const idx = best;
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
                // Petit shake visuel du label si possible, ou juste log pour l'instant
              }
            }
          }

          // Clic droit pour annuler
          hud.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (currentPath.length > 0) {
              currentPath.pop();
              refreshTitle(currentPath);
            }
          });

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

          // Contrôles boutons (Zoom/Reset uniquement)
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
                hud.removeEventListener('pointerdown', onPointerDown);
                hud.removeEventListener('pointermove', onPointerMove);
                hud.removeEventListener('pointerup', onPointerUp);
              } catch {}
              try { renderer.dispose(); } catch {}
              rootEl.innerHTML = '';
              log('destroyed');
            }
          });
        }, 
        (progress) => {},
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
