/* ============================================================================
 * public/osselets-level2.js  —  L2 « Écrire avec les os »
 *
 * - Pur JS (aucun JSX/TS requis).
 * - Three + GLTFLoader via import() ESM (pinné) — aucune balise <script> ajoutée.
 * - Charge /assets/games/osselets/level2/3d/astragalus.glb
 *   et collecte les 24 ancres nommées "Hole_*" (6 par face).
 * - Affiche 24 pastilles projetées en 2D sur un HUD (avec occlusion réelle).
 * - Clic sur une pastille → ajoute un point au "fil" (trait) pour épeler un mot.
 * - Flèches overlay pour tourner l’os (↑ ↓ ← →) + (↻) reset rotation.
 * - Panneau « Éditer lettres » pour remplacer l’étiquette de chaque trou.
 *
 * Correctifs clés (alignement des points) :
 *  1) Normalisation/centrage appliqués à un WRAPPER ("modelWrap") qui
 *     contient TOUT le modèle (mesh + empties/ancres) → plus aucun décalage.
 *  2) pivot.updateMatrixWorld(true) + cam.updateMatrixWorld(true) juste
 *     avant la projection → matrices monde à jour.
 *  3) HUD dimensionné sur la TAILLE DU DRAWING BUFFER (pas seulement CSS).
 *
 * Pour activer les logs : ajouter ?__L2_DEBUG=on à l’URL.
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
  const DOT_R   = 11;       // rayon des marqueurs (pixels réels)
  const HIT_R   = 22;       // rayon de sélection
  const DOT_A   = 0.95;     // opacité des points visibles
  const DOT_A_H = 0.40;     // opacité si caché par occlusion

  // Rotations manuelles (overlay)
  const ROT_STEP = 0.08;    // radians par clic sur flèche
  const ZOOM_MIN = 0.9, ZOOM_MAX = 1.8;

  // Alphabet par défaut
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

  // Encadre la caméra (perspective) autour d’un objet pivot + marge
  function frameToObject(THREE, cam, obj, margin=1.25) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cam.fov * (Math.PI/180);
    let dist = (maxDim/2) / Math.tan(fov/2);
    dist *= margin;

    // Positionne la caméra sur une diagonale douce
    cam.position.set(center.x + dist*0.8, center.y + dist*0.6, center.z + dist);
    cam.near = dist/100;
    cam.far  = dist*10;
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }

  // Normalise l’échelle et recentre l’objet (appliqué au WRAP)
  function normalizeAndCenter(THREE, target, aimMaxDim=2.2) {
    const box = new THREE.Box3().setFromObject(target);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (maxDim > 0.0001) ? (aimMaxDim / maxDim) : 1;
    target.position.sub(center);      // centre l’objet autour de (0,0,0)
    target.scale.setScalar(scale);    // mise à l’échelle
    target.updateMatrixWorld(true);
    log('normalize: maxDim=%.3f scale=%.3f center=', maxDim, scale, center);
  }

  // Collecte des anchors "Hole_*"
  function collectHoles(root) {
    const out = [];
    root.traverse(n => {
      const nm = (n.name||'');
      if (/^hole[_\s-]?/i.test(nm)) out.push(n);
    });
    return out;
  }

  // Création de l’UI flèches + reset + zoom
  function makeNudgePad() {
    const pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;right:18px;bottom:18px;display:grid;grid-template-columns:repeat(3,44px);grid-auto-rows:44px;gap:10px;background:#0b2237; border:1px solid #ffffff22; border-radius:12px; padding:14px;';
    const mk = (txt, title='') => {
      const b = document.createElement('button');
      b.className='btn';
      b.style.cssText='width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;';
      b.textContent=txt; b.title=title; return b;
    };
    const up=mk('↑','Rotation X+'), dw=mk('↓','Rotation X-'), lf=mk('←','Rotation Y-'), rg=mk('→','Rotation Y+'), rs=mk('↻','Reset'), zi=mk('+','Zoom +'), zo=mk('−','Zoom −');
    // grille :     .  ↑  .
    //              ←  ↻  →
    //              −  ↓  +
    pad.appendChild(document.createElement('div'));
    pad.appendChild(up);     pad.appendChild(document.createElement('div'));
    pad.appendChild(lf);     pad.appendChild(rs);    pad.appendChild(rg);
    pad.appendChild(zo);     pad.appendChild(dw);    pad.appendChild(zi);
    return { pad, up, dw, lf, rg, rs, zi, zo };
  }

  /* ------------------------------- Jeu -------------------------------- */
  async function mount(rootEl) {
    log('mount()');

    // 1) Libs
    const { THREE, GLTFLoader } = await libs();

    // 2) DOM
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

    const btnReset = document.createElement('button');
    btnReset.className='btn'; btnReset.textContent='Réinitialiser';

    const btnNext = document.createElement('button');
    btnNext.className='btn'; btnNext.textContent='Mot suivant';

    const btnEdit = document.createElement('button');
    btnEdit.className='btn'; btnEdit.textContent='✎  Éditer lettres';

    const labelBox = document.createElement('div');
    labelBox.style.cssText='color:#9bb2d4;font-size:14px;margin-right:6px;';
    labelBox.textContent = 'Mot : —';

    uiBar.append(labelBox, btnReset, btnNext, btnEdit);

    // Panneau lettres
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;right:18px;top:18px;width:260px;max-height:min(70vh,600px);overflow:auto;background:#0b2237;border:1px solid #ffffff22;border-radius:12px;padding:12px;display:none;';
    panel.innerHTML = '<div style="font-weight:700;margin-bottom:8px">Lettres par trou</div>';
    rootEl.appendChild(panel);

    // Nudge pad
    const { pad, up, dw, lf, rg, rs, zi, zo } = makeNudgePad(); rootEl.appendChild(pad);

    // 3) Renderer
    const renderer = new THREE.WebGLRenderer({canvas:gl, antialias:true, alpha:true});
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(clamp(devicePixelRatio||1,1,VIEW.DPR_MAX));
    renderer.setSize(VIEW.W, VIEW.H, false);

    // 4) Scène / caméra / pivot
    const scene = new THREE.Scene();
    scene.background = null;
    const cam = new THREE.PerspectiveCamera(45, VIEW.W/VIEW.H, 0.01, 100);
    scene.add(new THREE.AmbientLight(0xffffff, .78));
    const dir = new THREE.DirectionalLight(0xffffff,.95); dir.position.set(2.4,3.4,2.6); scene.add(dir);

    const pivot = new THREE.Group(); scene.add(pivot);

    // 5) Mots + lettres
    const cfg = await fetchJSON(WORDS_JS);
    const WORDS = (cfg && Array.isArray(cfg.words) && cfg.words.length) ? cfg.words : [
      { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
      { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
      { gr:"ΜΑΤΙ",  en:"MATI",  hint:"« Mauvais œil » — apotropaïon." }
    ];
    const LETTERS = (cfg && Array.isArray(cfg.letters) && cfg.letters.length===24) ? cfg.letters : GREEK.slice();
    let wordIdx = 0;

    function refreshTitle() {
      const w = WORDS[wordIdx%WORDS.length];
      labelBox.textContent = `Mot : ${w.gr} (${w.en})`;
      labelBox.setAttribute('title', `Indice : ${w.hint||''}`);
    }
    refreshTitle();

    // 6) Modèle
    const loader = new GLTFLoader();
    const root = await new Promise((res,rej)=>{
      loader.load(MODEL, gltf=>{
        const r = gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!r) return rej(new Error('Modèle vide'));
        // matériaux standard
        r.traverse(o=>{
          if (o.isMesh){
            if (!o.material || !o.material.isMeshStandardMaterial)
              o.material = new THREE.MeshStandardMaterial({color:0xf7efe7, roughness:.62, metalness:.05});
            o.castShadow=false; o.receiveShadow=false;
          }
        });
        res(r);
      }, (ev)=>{ if (ev && ev.total) log('GLB progress:', ev.loaded,'/',ev.total); }, err=>rej(err));
    });

    // WRAP (correction : tout le modèle, anchors inclus, sous un seul parent)
    const modelWrap = new THREE.Group();
    modelWrap.add(root);
    pivot.add(modelWrap);

    // Normalise + centre au niveau du WRAP (pas directement sur root)
    normalizeAndCenter(THREE, modelWrap, 2.25);
    frameToObject(THREE, cam, modelWrap, 1.35);

    // Anchors
    const anchors = collectHoles(modelWrap);
    log('anchors Hole_* found:', anchors.length, anchors.map(a=>a.name));
    if (anchors.length !== 24) {
      // on continue quand même, mais en info
      console.warn('[L2] Attendu 24 ancres Hole_* — trouvé:', anchors.length);
    }

    // 7) États HUD
    const ctx = hud.getContext('2d');
    const current = [];  // indices sélectionnés (fil)
    const hiddenFlags = new Array(anchors.length).fill(false);  // occlusion par Raycaster
    const worldPos = anchors.map(()=>new THREE.Vector3());

    // Raycaster pour occlusion
    const ray = new THREE.Raycaster(undefined, undefined, 0.01, 100);

    // 8) Sizing cohérent (GL buffer ↔ HUD pixels)
    const viewSize = { cssW: VIEW.W, cssH: VIEW.H, dpr: clamp(devicePixelRatio||1,1,VIEW.DPR_MAX) };

    function syncSizes() {
      // CSS size choisi : largeur du conteneur (responsive) + ratio 16/9
      const w = Math.max(320, rootEl.clientWidth|0);
      const h = Math.round(w * (VIEW.H/VIEW.W));
      const dpr = clamp(devicePixelRatio||1,1,VIEW.DPR_MAX);

      // Renderer → ajuste le drawing buffer
      renderer.setPixelRatio(dpr);
      renderer.setSize(w,h,false);

      // HUD doit correspondre au DRAWING BUFFER (en pixels réels)
      const db = new THREE.Vector2();
      renderer.getDrawingBufferSize(db);
      hud.width  = db.x | 0;
      hud.height = db.y | 0;
      hud.style.width  = w+'px';
      hud.style.height = h+'px';

      // Mémorise la taille CSS pour infos/debug
      viewSize.cssW = w; viewSize.cssH = h; viewSize.dpr = dpr;
      log('resize:', {w,h,dpr});
    }
    syncSizes();
    const ro = (typeof ResizeObserver!=='undefined') ? new ResizeObserver(syncSizes) : null;
    if (ro) ro.observe(rootEl);
    window.addEventListener('resize', syncSizes);

    // 9) Dessin HUD (avec occlusion réelle)
    function projectHolesAndOcclusion() {
      // IMPORTANT : matrices à jour avant toute lecture de world position
      pivot.updateMatrixWorld(true);
      cam.updateMatrixWorld(true);

      // position de la caméra
      const camPos = new THREE.Vector3(); cam.getWorldPosition(camPos);
      const dir = new THREE.Vector3();

      for (let i=0;i<anchors.length;i++){
        const n = anchors[i];
        n.getWorldPosition(worldPos[i]);

        // Occlusion : ray du cam vers la position du trou
        hiddenFlags[i] = false;
        dir.copy(worldPos[i]).sub(camPos).normalize();
        ray.set(camPos, dir);
        const hits = ray.intersectObject(modelWrap, true);
        if (hits && hits.length){
          const dHole = camPos.distanceTo(worldPos[i]);
          if (hits[0].distance < dHole - 1e-3) hiddenFlags[i] = true;
        }
      }
    }

    function worldToHud(x,y,z){
      const v = new THREE.Vector3(x,y,z).project(cam);
      const px = ( v.x*0.5 + 0.5 ) * hud.width;
      const py = ( -v.y*0.5 + 0.5 ) * hud.height;
      return {x:px, y:py};
    }

    function drawHUD() {
      ctx.clearRect(0,0,hud.width,hud.height);

      // 1) Fil (liaisons entre pastilles sélectionnées)
      if (current.length>0){
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(96,165,250,0.92)';
        ctx.beginPath();
        for (let k=0;k<current.length;k++){
          const idx = current[k];
          const p = worldToHud(worldPos[idx].x, worldPos[idx].y, worldPos[idx].z);
          if (k===0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // 2) Pastilles
      for (let i=0;i<anchors.length;i++){
        const wp = worldPos[i];
        const scr = worldToHud(wp.x, wp.y, wp.z);
        const alpha = hiddenFlags[i] ? DOT_A_H : DOT_A;

        // disque
        ctx.beginPath();
        ctx.fillStyle = `rgba(14,165,233,${alpha})`;
        ctx.arc(scr.x, scr.y, DOT_R, 0, Math.PI*2);
        ctx.fill();

        // lettre
        ctx.fillStyle = 'rgba(230,241,255,1)';
        ctx.font = `${Math.round(DOT_R*1.2)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        const letter = LETTERS[i % LETTERS.length];
        ctx.fillText(letter, scr.x, scr.y+0.5);
      }
      DEBUG && log('hud drawn: hidden', hiddenFlags.filter(Boolean).length, '/', anchors.length);
    }

    // 10) Interaction (clic → ajoute au fil ; clic droit → retire)
    function pickNearest(clientX, clientY){
      const rect = hud.getBoundingClientRect();
      const px = (clientX - rect.left) * (hud.width/rect.width);
      const py = (clientY - rect.top ) * (hud.height/rect.height);
      let best=-1, bd=Infinity;
      for (let i=0;i<anchors.length;i++){
        if (hiddenFlags[i]) continue; // on interdit le pick si caché (optionnel)
        const wp = worldPos[i]; const p = worldToHud(wp.x, wp.y, wp.z);
        const d = Math.hypot(p.x-px, p.y-py);
        if (d < bd){ bd=d; best=i; }
      }
      return (bd<=HIT_R) ? best : -1;
    }

    function onClick(e){
      const idx = pickNearest(e.clientX, e.clientY);
      if (idx>=0) current.push(idx);
    }
    function onContext(e){
      e.preventDefault();
      current.pop();
    }
    hud.addEventListener('click', onClick);
    hud.addEventListener('contextmenu', onContext);

    // 11) Boutons
    function reset(){
      current.length = 0;
      // remet une pose « douce »
      pivot.rotation.set(0,0,0);
      frameToObject(THREE, cam, modelWrap, 1.35);
      cam.zoom = clamp(cam.zoom, ZOOM_MIN, ZOOM_MAX);
      cam.updateProjectionMatrix();
    }
    btnReset.addEventListener('click', reset);

    btnNext.addEventListener('click', ()=>{
      wordIdx = (wordIdx+1)%WORDS.length;
      refreshTitle();
      reset();
    });

    // Panneau d’édition des lettres
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
        inp.addEventListener('input',()=>{ LETTERS[i]=inp.value.toUpperCase().slice(0,2); });
        list.append(lab, inp);
      }
      panel.appendChild(list);
    }
    btnEdit.addEventListener('click', ()=>{
      const show = panel.style.display==='none';
      if (show) rebuildPanel();
      panel.style.display = show ? 'block' : 'none';
    });

    // 12) Nudge pad (rotations + zoom)
    up.addEventListener('click', ()=>{ pivot.rotation.x += ROT_STEP; });
    dw.addEventListener('click', ()=>{ pivot.rotation.x -= ROT_STEP; });
    lf.addEventListener('click', ()=>{ pivot.rotation.y -= ROT_STEP; });
    rg.addEventListener('click', ()=>{ pivot.rotation.y += ROT_STEP; });
    rs.addEventListener('click', ()=>{ pivot.rotation.set(0,0,0); frameToObject(THREE, cam, modelWrap, 1.35); });
    zi.addEventListener('click', ()=>{ cam.zoom = clamp(cam.zoom*1.12, ZOOM_MIN, ZOOM_MAX); cam.updateProjectionMatrix(); });
    zo.addEventListener('click', ()=>{ cam.zoom = clamp(cam.zoom/1.12, ZOOM_MIN, ZOOM_MAX); cam.updateProjectionMatrix(); });

    // 13) Boucle d’animation
    let raf = 0;
    (function loop(){
      projectHolesAndOcclusion();
      renderer.render(scene, cam);
      drawHUD();
      raf = requestAnimationFrame(loop);
    })();

    // 14) Texte d’info discret
    const foot = document.createElement('div');
    foot.style.cssText='position:absolute;left:18px;bottom:66px;color:#9bb2d4;font-size:12px;opacity:.9;';
    foot.innerHTML = `Modèle : <code>level2/3d/astragalus.glb</code> — nœuds <code>Hole_*</code> (24). Occlusion réelle, fil cliquable.`;
    rootEl.appendChild(foot);

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
