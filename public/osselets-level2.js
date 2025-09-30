/* ============================================================================
 * public/osselets-level2.js  —  L2 « Écrire avec les os » (v4)
 *
 * Fix 1 — Alignement pastilles:
 *   - HUD dimensionné sur le drawing buffer du renderer
 *   - Contexte 2D mis à l’échelle (ctx.setTransform) pour dessiner en px CSS
 *
 * Fix 2 — Fil initial:
 *   - Génération automatique d’un chemin à partir du mot (WORDS[wordIdx].gr)
 *   - Mapping lettres -> indices de LETTERS (24) avec gestion des doublons
 *
 * Conserve: flèches, reset, zoom, panneau Éditer lettres, occlusion réelle.
 * Activer les logs: ajouter ?__L2_DEBUG=on à l’URL.
 * ==========================================================================*/

(() => {
  const DEBUG = /[?&]__L2_DEBUG=on\b/.test(location.search);
  const log   = (...a) => DEBUG && console.log('[L2]', ...a);

  /* ----------------------- Chemins & constantes ----------------------- */
  const BASE     = "/assets/games/osselets/level2/";
  const MODEL    = BASE + "3d/astragalus.glb";
  const WORDS_JS = BASE + "3d/letters.json";   // optionnel: { words:[{gr,en,hint}], letters:[...] }

  const VIEW = { W: 960, H: 540, DPR_MAX: 2.5 };
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;

  // HUD
  const DOT_R   = 11;       // rayon marqueurs (en px CSS, via setTransform)
  const HIT_R   = 22;       // rayon de sélection
  const DOT_A   = 0.95;     // opacité visible
  const DOT_A_H = 0.40;     // opacité si occlus

  // Rotations manuelles (overlay)
  const ROT_STEP = 0.08;    // radians par clic
  const ZOOM_MIN = 0.9, ZOOM_MAX = 1.8;

  // Alphabet par défaut (24)
  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  /* ------------------------ Import ESM (une fois) --------------------- */
  async function libs() {
    const w = window;
    if (w.__L2_LIBS) return w.__L2_LIBS;
    log('importing ESM three@%s', THREE_VER);
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    w.__L2_LIBS = { THREE, GLTFLoader };
    return w.__L2_LIBS;
  }

  /* --------------------------- Utilitaires ---------------------------- */
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  function frameToObject(THREE, cam, obj, margin=1.25) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cam.fov * (Math.PI/180);
    let dist = (maxDim/2) / Math.tan(fov/2);
    dist *= margin;
    cam.position.set(center.x + dist*0.8, center.y + dist*0.6, center.z + dist);
    cam.near = dist/100; cam.far = dist*10;
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }

  function normalizeAndCenter(THREE, target, aimMaxDim=2.2) {
    const box = new THREE.Box3().setFromObject(target);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (maxDim > 0.0001) ? (aimMaxDim / maxDim) : 1;
    target.position.sub(center);
    target.scale.setScalar(scale);
    target.updateMatrixWorld(true);
    log('normalize: maxDim=%.3f scale=%.3f center=', maxDim, scale, center);
  }

  function collectHoles(root) {
    const out = [];
    root.traverse(n => { if (/^hole[_\s-]?/i.test(n.name||'')) out.push(n); });
    return out;
  }

  function makeNudgePad() {
    const pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;right:18px;bottom:18px;display:grid;grid-template-columns:repeat(3,44px);grid-auto-rows:44px;gap:10px;background:#0b2237;border:1px solid #ffffff22;border-radius:12px;padding:14px;';
    const mk = (txt, title='') => {
      const b = document.createElement('button');
      b.className='btn';
      b.style.cssText='width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;';
      b.textContent=txt; b.title=title; return b;
    };
    const up=mk('↑','Rotation X+'), dw=mk('↓','Rotation X-'), lf=mk('←','Rotation Y-'), rg=mk('→','Rotation Y+'), rs=mk('↻','Reset'), zi=mk('+','Zoom +'), zo=mk('−','Zoom −');
    pad.appendChild(document.createElement('div')); pad.appendChild(up); pad.appendChild(document.createElement('div'));
    pad.appendChild(lf); pad.appendChild(rs); pad.appendChild(rg);
    pad.appendChild(zo); pad.appendChild(dw); pad.appendChild(zi);
    return { pad, up, dw, lf, rg, rs, zi, zo };
  }

  /* ------------------------------- Jeu -------------------------------- */
  async function mount(rootEl) {
    log('mount()');

    const { THREE, GLTFLoader } = await libs();

    // DOM
    rootEl.innerHTML = '';
    rootEl.style.position = 'relative';

    const gl = document.createElement('canvas');
    gl.width = VIEW.W; gl.height = VIEW.H;
    gl.style.cssText = 'display:block;border-radius:12px;background:transparent;';
    rootEl.appendChild(gl);

    const hud = document.createElement('canvas');
    hud.width = VIEW.W; hud.height = VIEW.H;
    hud.style.cssText = 'position:absolute;inset:0;pointer-events:auto;';
    rootEl.appendChild(hud);

    const uiBar = document.createElement('div');
    uiBar.style.cssText = 'position:absolute;left:18px;bottom:18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
    rootEl.appendChild(uiBar);

    const btnReset = document.createElement('button'); btnReset.className='btn'; btnReset.textContent='Réinitialiser';
    const btnNext  = document.createElement('button'); btnNext.className='btn';  btnNext.textContent='Mot suivant';
    const btnEdit  = document.createElement('button'); btnEdit.className='btn';  btnEdit.textContent='✎  Éditer lettres';
    const labelBox = document.createElement('div');   labelBox.style.cssText='color:#9bb2d4;font-size:14px;margin-right:6px;'; labelBox.textContent='Mot : —';
    uiBar.append(labelBox, btnReset, btnNext, btnEdit);

    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;right:18px;top:18px;width:260px;max-height:min(70vh,600px);overflow:auto;background:#0b2237;border:1px solid #ffffff22;border-radius:12px;padding:12px;display:none;';
    panel.innerHTML = '<div style="font-weight:700;margin-bottom:8px">Lettres par trou</div>';
    rootEl.appendChild(panel);

    const { pad, up, dw, lf, rg, rs, zi, zo } = makeNudgePad(); rootEl.appendChild(pad);

    // Renderer
    const renderer = new THREE.WebGLRenderer({canvas:gl, antialias:true, alpha:true});
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(clamp(devicePixelRatio||1,1,VIEW.DPR_MAX));
    renderer.setSize(VIEW.W, VIEW.H, false);

    // Scène / caméra / pivot
    const scene = new THREE.Scene(); scene.background = null;
    const cam = new THREE.PerspectiveCamera(45, VIEW.W/VIEW.H, 0.01, 100);
    scene.add(new THREE.AmbientLight(0xffffff, .78));
    const dir = new THREE.DirectionalLight(0xffffff,.95); dir.position.set(2.4,3.4,2.6); scene.add(dir);
    const pivot = new THREE.Group(); scene.add(pivot);

    // Mots + lettres
    const cfg = await fetchJSON(WORDS_JS);
    const WORDS = (cfg?.words?.length) ? cfg.words : [
      { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
      { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
      { gr:"ΜΑΤΙ",  en:"MATI",  hint:"« Mauvais œil » — apotropaïon." }
    ];
    const LETTERS = (cfg?.letters?.length===24) ? cfg.letters.slice() : GREEK.slice();
    let wordIdx = 0;

    function refreshTitle() {
      const w = WORDS[wordIdx%WORDS.length];
      labelBox.textContent = `Mot : ${w.gr} (${w.en})`;
      labelBox.setAttribute('title', `Indice : ${w.hint||''}`);
    }
    refreshTitle();

    // Modèle
    const loader = new GLTFLoader();
    const root = await new Promise((res,rej)=>{
      loader.load(MODEL, gltf=>{
        const r = gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!r) return rej(new Error('Modèle vide'));
        r.traverse(o=>{
          if (o.isMesh){
            if (!o.material || !o.material.isMeshStandardMaterial)
              o.material = new THREE.MeshStandardMaterial({color:0xf7efe7, roughness:.62, metalness:.05});
            o.castShadow=false; o.receiveShadow=false;
          }
        });
        res(r);
      }, (ev)=>{ if (ev?.total) log('GLB progress:', ev.loaded,'/',ev.total); }, err=>rej(err));
    });

    // WRAP (mesh + ancres)
    const modelWrap = new THREE.Group();
    modelWrap.add(root);
    pivot.add(modelWrap);

    normalizeAndCenter(THREE, modelWrap, 2.25);
    frameToObject(THREE, cam, modelWrap, 1.35);

    // Ancres
    const anchors = collectHoles(modelWrap);
    log('anchors Hole_* found:', anchors.length, anchors.map(a=>a.name));
    if (anchors.length !== 24) console.warn('[L2] Attendu 24 ancres Hole_* — trouvé:', anchors.length);

    // États HUD
    const ctx = hud.getContext('2d');
    const current = [];                                  // indices sélectionnés (fil)
    const hiddenFlags = new Array(anchors.length).fill(false);
    const worldPos = anchors.map(()=>new THREE.Vector3());
    const ray = new THREE.Raycaster(undefined, undefined, 0.01, 100);

    // Taille CSS <-> drawing buffer & transform du contexte
    const viewSize = { cssW: VIEW.W, cssH: VIEW.H, dpr: clamp(devicePixelRatio||1,1,VIEW.DPR_MAX) };
    let scaleX = 1, scaleY = 1;

    function syncSizes() {
      const w = Math.max(320, rootEl.clientWidth|0);
      const h = Math.round(w * (VIEW.H/VIEW.W));
      const dpr = clamp(devicePixelRatio||1,1,VIEW.DPR_MAX);

      renderer.setPixelRatio(dpr);
      renderer.setSize(w,h,false);

      // HUD = exactement la taille du drawing buffer
      const db = new THREE.Vector2();
      renderer.getDrawingBufferSize(db);
      hud.width  = db.x | 0;
      hud.height = db.y | 0;
      hud.style.width  = w+'px';
      hud.style.height = h+'px';

      // On dessine en "px CSS" grâce à une transform
      scaleX = hud.width  / w;
      scaleY = hud.height / h;
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

      viewSize.cssW = w; viewSize.cssH = h; viewSize.dpr = dpr;
      log('resize:', {w,h,dpr});
    }
    syncSizes();
    const ro = (typeof ResizeObserver!=='undefined') ? new ResizeObserver(syncSizes) : null;
    if (ro) ro.observe(rootEl);
    window.addEventListener('resize', syncSizes);

    // Projection & occlusion
    function updateWorldAndOcclusion() {
      pivot.updateMatrixWorld(true);
      cam.updateMatrixWorld(true);
      const camPos = new THREE.Vector3(); cam.getWorldPosition(camPos);
      const dir = new THREE.Vector3();

      for (let i=0;i<anchors.length;i++){
        const n = anchors[i];
        n.getWorldPosition(worldPos[i]);

        hiddenFlags[i] = false;
        dir.copy(worldPos[i]).sub(camPos).normalize();
        ray.set(camPos, dir);
        const hits = ray.intersectObject(modelWrap, true);
        if (hits?.length){
          const dHole = camPos.distanceTo(worldPos[i]);
          if (hits[0].distance < dHole - 1e-3) hiddenFlags[i] = true;
        }
      }
    }

    function worldToCssXY(v){
      const p = v.clone().project(cam);
      return {
        x: ( p.x*0.5 + 0.5 ) * viewSize.cssW,
        y: (-p.y*0.5 + 0.5 ) * viewSize.cssH
      };
    }

    // Fil par défaut pour le mot courant (lettres grecques)
    function buildDefaultPathForWord() {
      current.length = 0;
      const w = WORDS[wordIdx%WORDS.length];
      const lettersInWord = (w.gr || '').split('').map(s => s.toUpperCase());
      const used = new Map(); // lettre -> combien déjà pris

      for (const ch of lettersInWord) {
        // indices où LETTERS[i] == ch
        const matches = [];
        for (let i=0;i<LETTERS.length;i++) if ((LETTERS[i]||'').toUpperCase()===ch) matches.push(i);
        if (!matches.length) continue;

        const k = used.get(ch) || 0;
        const idx = matches[Math.min(k, matches.length-1)];
        used.set(ch, k+1);
        if (idx>=0) current.push(idx);
      }
      if (current.length===0) {
        // fallback: petite boucle sur les 4 premiers trous visibles
        for (let i=0;i<anchors.length && current.length<4;i++) if (!hiddenFlags[i]) current.push(i);
      }
    }

    // Dessin HUD (en px CSS grâce au setTransform)
    function drawHUD() {
      ctx.clearRect(0,0, viewSize.cssW, viewSize.cssH);

      // Lignes (fil)
      if (current.length>0){
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(96,165,250,0.92)';
        ctx.beginPath();
        for (let k=0;k<current.length;k++){
          const p = worldToCssXY(worldPos[current[k]]);
          if (k===0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Pastilles + lettres
      for (let i=0;i<anchors.length;i++){
        const p = worldToCssXY(worldPos[i]);
        const alpha = hiddenFlags[i] ? DOT_A_H : DOT_A;
        ctx.beginPath();
        ctx.fillStyle = `rgba(14,165,233,${alpha})`;
        ctx.arc(p.x, p.y, DOT_R, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = 'rgba(230,241,255,1)';
        ctx.font = `${Math.round(DOT_R*1.2)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(LETTERS[i]||'', p.x, p.y+0.5);
      }
      DEBUG && log('hud drawn: hidden', hiddenFlags.filter(Boolean).length, '/', anchors.length);
    }

    // Picking (clic gauche ajoute au fil, clic droit retire)
    function pickNearest(clientX, clientY){
      const rect = hud.getBoundingClientRect();
      // coordonnées en px CSS sur le HUD
      const px = (clientX - rect.left);
      const py = (clientY - rect.top );
      let best=-1, bd=Infinity;
      for (let i=0;i<anchors.length;i++){
        if (hiddenFlags[i]) continue; // pas de pick sur les trous cachés
        const p = worldToCssXY(worldPos[i]);
        const d = Math.hypot(p.x-px, p.y-py);
        if (d < bd){ bd=d; best=i; }
      }
      return (bd<=HIT_R) ? best : -1;
    }

    function onClick(e){ const idx = pickNearest(e.clientX, e.clientY); if (idx>=0) current.push(idx); }
    function onContext(e){ e.preventDefault(); current.pop(); }
    hud.addEventListener('click', onClick);
    hud.addEventListener('contextmenu', onContext);

    // Boutons
    function reset(){
      current.length = 0;
      pivot.rotation.set(0,0,0);
      frameToObject(THREE, cam, modelWrap, 1.35);
      cam.zoom = clamp(cam.zoom, ZOOM_MIN, ZOOM_MAX);
      cam.updateProjectionMatrix();
      // régénère un fil par défaut pour le mot courant
      updateWorldAndOcclusion();
      buildDefaultPathForWord();
    }
    btnReset.addEventListener('click', reset);

    btnNext.addEventListener('click', ()=>{
      wordIdx = (wordIdx+1)%WORDS.length;
      refreshTitle();
      reset();
    });

    function rebuildPanel(){
      panel.innerHTML = '<div style="font-weight:700;margin-bottom:8px">Lettres par trou</div>';
      const list = document.createElement('div');
      list.style.cssText='display:grid;grid-template-columns:1fr 70px;gap:6px;';
      for (let i=0;i<anchors.length;i++){
        const lab = document.createElement('div');
        lab.style.cssText='opacity:.8;font-size:12px;';
        lab.textContent = anchors[i].name || `Hole_${i+1}`;
        const inp = document.createElement('input');
        inp.value = LETTERS[i] || '';
        inp.maxLength = 2;
        inp.style.cssText='width:70px;background:#001225;color:#e6f1ff;border:1px solid #ffffff25;border-radius:8px;padding:6px 8px;';
        inp.addEventListener('input',()=>{
          LETTERS[i]=inp.value.toUpperCase().slice(0,2);
          // si on édite, on peut aussi régénérer le fil par défaut
          updateWorldAndOcclusion();
          buildDefaultPathForWord();
        });
        list.append(lab, inp);
      }
      panel.appendChild(list);
    }
    btnEdit.addEventListener('click', ()=>{
      const show = panel.style.display==='none';
      if (show) rebuildPanel();
      panel.style.display = show ? 'block' : 'none';
    });

    // Nudge pad
    up.addEventListener('click', ()=>{ pivot.rotation.x += ROT_STEP; });
    dw.addEventListener('click', ()=>{ pivot.rotation.x -= ROT_STEP; });
    lf.addEventListener('click', ()=>{ pivot.rotation.y -= ROT_STEP; });
    rg.addEventListener('click', ()=>{ pivot.rotation.y += ROT_STEP; });
    rs.addEventListener('click', ()=>{ pivot.rotation.set(0,0,0); frameToObject(THREE, cam, modelWrap, 1.35); });
    zi.addEventListener('click', ()=>{ cam.zoom = clamp(cam.zoom*1.12, ZOOM_MIN, ZOOM_MAX); cam.updateProjectionMatrix(); });
    zo.addEventListener('click', ()=>{ cam.zoom = clamp(cam.zoom/1.12, ZOOM_MIN, ZOOM_MAX); cam.updateProjectionMatrix(); });

    // Boucle
    let raf = 0;
    (function loop(){
      updateWorldAndOcclusion();
      renderer.render(scene, cam);
      drawHUD();
      raf = requestAnimationFrame(loop);
    })();

    // Légende discrète
    const foot = document.createElement('div');
    foot.style.cssText='position:absolute;left:18px;bottom:66px;color:#9bb2d4;font-size:12px;opacity:.9;';
    foot.innerHTML = `Modèle : <code>level2/3d/astragalus.glb</code> — nœuds <code>Hole_*</code> (24). Occlusion réelle, fil cliquable.`;
    rootEl.appendChild(foot);

    // --- Fil initial dès le montage ---
    updateWorldAndOcclusion();
    buildDefaultPathForWord();

    return {
      destroy(){
        cancelAnimationFrame(raf);
        ro?.disconnect(); window.removeEventListener('resize', syncSizes);
        try { hud.removeEventListener('click', onClick); hud.removeEventListener('contextmenu', onContext); } catch {}
        try { renderer.dispose(); } catch {}
        rootEl.innerHTML = '';
      }
    };
  }

  // API globale
  window.OsseletsLevel2 = { mount };
  log('script loaded, ts:', Date.now());
  log('global set: window.OsseletsLevel2');
})();
