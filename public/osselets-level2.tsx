// /public/osselets-level2.js
// LEVEL 2 — « Écrire avec les os » (24 trous / 4 faces opposées)
// - Pur JS (aucun JSX/TS).
// - Imports ESM (three + GLTFLoader) via esm.sh, mais **réutilise** si déjà chargés (ex: L3).
// - Modèle: /assets/games/osselets/level2/3d/astragalus.glb, ancres "Hole_*" (24).
// - Occlusion réelle: lettres **non visibles** à travers l’os (raycaster).
// - HUD 2D cliquable (fil, mot, indice). Boutons: Réinitialiser / Mot suivant.
//
// API globale: window.OsseletsLevel2.mount(rootEl)

(() => {
  const MODEL_PATH   = "/assets/games/osselets/level2/3d/astragalus.glb";
  const WORDS_JSON   = "/assets/games/osselets/level2/3d/letters.json";
  const VIEW         = { W: 960, H: 540, DPR_MAX: 2.5 };

  // ------- Imports / réutilisation -------
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;

  async function ensureThreeGLTF(){
    // 1) Si le L3 a déjà importé (Three + GLTFLoader + Cannon)
    if (window.__OX_PHYS_V2) {
      const { THREE, GLTFLoader } = window.__OX_PHYS_V2;
      if (THREE && GLTFLoader) return { THREE, GLTFLoader };
    }
    // 2) Si la page a injecté THREE & GLTFLoader en global (scripts <script>)
    if (window.THREE && window.GLTFLoader) {
      return { THREE: window.THREE, GLTFLoader: window.GLTFLoader };
    }
    // 3) Sinon, import ESM (et mémorise pour réutilisation)
    if (window.__LxThree) return window.__LxThree;
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    window.__LxThree = { THREE, GLTFLoader };
    return window.__LxThree;
  }

  // ------- Utils -------
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  // Alphabet grec (fallback si pas de JSON)
  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  function buildCenteredTemplate(baseRoot, THREE){
    const root = baseRoot.clone(true);
    const box  = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const pivot = new THREE.Group();
    root.position.sub(center); // pivot au centre
    // scale léger (optionnel) — on stabilise la taille dans la vue
    const target = 1.6; // taille approx. max
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale  = target / maxDim;
    root.scale.setScalar(scale);
    pivot.add(root);
    return { pivot, inner: root };
  }

  function collectHoles(root){
    const list=[];
    root.traverse(n=>{
      const nm = (n.name||"").toLowerCase();
      if (/^hole[_\s-]?/.test(nm)) list.push(n);
    });
    // Tri stable par nom → ordre déterministe (associé aux 24 lettres)
    list.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
    return list;
  }

  function projectWorldToCanvas(THREE, cam, world, w, h){
    const v = new THREE.Vector3().copy(world).project(cam);
    return { x:(v.x*0.5+0.5)*w, y:(-v.y*0.5+0.5)*h };
  }

  function makeRayOcclusion(THREE, cam, modelRoot){
    const rc = new THREE.Raycaster(undefined, undefined, 0.01, 100);
    const camPos = new THREE.Vector3();
    return function isHidden(worldPos){
      cam.getWorldPosition(camPos);
      const dir = new THREE.Vector3().copy(worldPos).sub(camPos).normalize();
      rc.set(camPos, dir);
      const hits = rc.intersectObject(modelRoot, true);
      if (!hits || !hits.length) return false;
      const dHole = camPos.distanceTo(worldPos);
      return hits[0].distance < dHole - 1e-3;
    };
  }

  // -------- Jeu / Montage --------
  async function mount(rootEl){
    const { THREE, GLTFLoader } = await ensureThreeGLTF();
    const T = THREE;

    // UI / Canvases
    rootEl.innerHTML = "";
    rootEl.style.position = "relative";

    const cv3d = document.createElement("canvas");
    cv3d.width = VIEW.W; cv3d.height = VIEW.H;
    cv3d.style.cssText = "display:block;border-radius:12px;background:transparent;";
    rootEl.appendChild(cv3d);

    const hud = document.createElement("canvas");
    hud.width = VIEW.W; hud.height = VIEW.H;
    hud.style.cssText = "position:absolute;inset:0;pointer-events:auto;";
    rootEl.appendChild(hud);

    const ui = document.createElement("div");
    ui.style.cssText = "display:flex;gap:8px;margin-top:10px";
    const btnReset = document.createElement("button"); btnReset.className="btn"; btnReset.textContent="Réinitialiser";
    const btnNext  = document.createElement("button"); btnNext.className="btn"; btnNext.textContent="Mot suivant";
    // petit panneau d’info
    const info = document.createElement("div");
    info.style.cssText = "font-size:12px;color:#9cc0ff;margin-top:8px";
    info.textContent = "Modèle : level2/3d/astragalus.glb — nœuds Hole_* (24). Occlusion réelle, fil cliquable.";
    rootEl.appendChild(ui); ui.append(btnReset, btnNext); rootEl.appendChild(info);

    // Renderer / Scene / Camera
    const renderer = new T.WebGLRenderer({ canvas: cv3d, antialias: true, alpha: true });
    const scene = new T.Scene(); scene.background = null;
    const cam   = new T.PerspectiveCamera(45, 16/9, 0.1, 50);
    cam.position.set(2.0, 1.3, 2.3); cam.lookAt(0, 0.25, 0);

    scene.add(new T.AmbientLight(0xffffff, .7));
    const dir = new T.DirectionalLight(0xffffff, .9); dir.position.set(2.4, 3.3, 2.6); scene.add(dir);

    // Responsive
    let view = { w: VIEW.W, h: VIEW.H, dpr: 1 };
    function onResize(){
      const w = Math.max(320, rootEl.clientWidth|0);
      const h = Math.round(w * (VIEW.H/VIEW.W));
      const d = clamp(window.devicePixelRatio||1, 1, VIEW.DPR_MAX);
      view = { w, h, dpr: d };

      renderer.setPixelRatio(d);
      renderer.setSize(w, h, false);
      cv3d.style.width = w+"px"; cv3d.style.height = h+"px";

      hud.width = Math.floor(w*d); hud.height = Math.floor(h*d);
      hud.style.width = w+"px"; hud.style.height = h+"px";
      const ctx = hud.getContext("2d");
      ctx.setTransform((w*d)/VIEW.W, 0, 0, (h*d)/VIEW.H, 0, 0);

      cam.aspect = w/h; cam.updateProjectionMatrix();
    }
    onResize();
    const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(rootEl); window.addEventListener("resize", onResize);

    // Données mots (optionnel)
    const wordsCfg = await fetchJSON(WORDS_JSON);
    const WORDS = (wordsCfg && wordsCfg.words && wordsCfg.words.length)
      ? wordsCfg.words.slice(0, 24)  // sanity
      : [
          { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
          { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
          { gr:"ΜΑΤΙ",  en:"MATI",  hint:"« Mauvais œil » — apotropaïon." }
        ];
    let wordIdx = 0;

    // Modèle
    const loader = new GLTFLoader();
    const root = await new Promise((res,rej)=>{
      loader.load(MODEL_PATH, (gltf)=>{
        const r = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!r) return rej(new Error("Modèle vide"));
        r.traverse(o=>{
          if (o.isMesh){
            if (!o.material || !o.material.isMeshStandardMaterial)
              o.material = new T.MeshStandardMaterial({ color:0xf7efe7, roughness:.6, metalness:.05 });
          }
        });
        res(r);
      }, undefined, err=>rej(err));
    });

    // Pivot centré (tourne autour de lui-même → cohérence visuelle)
    const { pivot, inner } = buildCenteredTemplate(root, T);
    scene.add(pivot);

    // Collecte des 24 ancres
    const anchors = collectHoles(pivot);
    const has24 = anchors.length === 24;

    // Projo + occlusion
    const ctx = hud.getContext("2d");
    const isHidden = makeRayOcclusion(T, cam, pivot);

    // État du tracé (indices d’ancres cliquées)
    let path = [];

    function drawHUD(){
      ctx.clearRect(0,0,VIEW.W,VIEW.H);

      const w = WORDS[wordIdx] || WORDS[0];

      // Fil
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 2;
      if (path.length > 1){
        ctx.beginPath();
        const p0 = anchors[path[0]];
        if (p0){
          const wp0 = new T.Vector3(); p0.getWorldPosition(wp0);
          const s0 = projectWorldToCanvas(T, cam, wp0, VIEW.W, VIEW.H);
          ctx.moveTo(s0.x, s0.y);
          for (let i=1;i<path.length;i++){
            const pi = anchors[path[i]]; if (!pi) continue;
            const wpi = new T.Vector3(); pi.getWorldPosition(wpi);
            const si  = projectWorldToCanvas(T, cam, wpi, VIEW.W, VIEW.H);
            ctx.lineTo(si.x, si.y);
          }
          ctx.stroke();
        }
      }

      // Points + lettres (masque si occlus)
      for (let i=0;i<anchors.length;i++){
        const a = anchors[i];
        const wp = new T.Vector3(); a.getWorldPosition(wp);
        const s  = projectWorldToCanvas(T, cam, wp, VIEW.W, VIEW.H);
        const hidden = isHidden(wp);

        // pastille
        ctx.beginPath();
        ctx.fillStyle = hidden ? "rgba(14,165,233,.35)" : "#0ea5e9";
        ctx.arc(s.x, s.y, 10, 0, Math.PI*2); ctx.fill();

        // étiquette (si pas masquée)
        if (!hidden){
          ctx.fillStyle = "#e6f1ff";
          ctx.font = "12px ui-sans-serif, system-ui";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const lab = has24 ? GREEK[i] : String(i+1);
          ctx.fillText(lab, s.x, s.y);
        }
      }

      // Pied : mot + indice
      ctx.fillStyle="#e6f1ff"; ctx.font="16px ui-sans-serif, system-ui";
      ctx.textAlign="start"; ctx.textBaseline="alphabetic";
      ctx.fillText("Mot : " + w.gr + " (" + w.en + ")", 16, VIEW.H - 40);
      ctx.fillStyle="#9cc0ff"; ctx.font="12px ui-sans-serif, system-ui";
      ctx.fillText("Indice : " + w.hint, 16, VIEW.H - 18);
    }

    // Clic HUD → plus proche ancre visible
    function onClick(e){
      const r = hud.getBoundingClientRect();
      const px = (e.clientX - r.left) * (view.w / r.width);
      const py = (e.clientY - r.top)  * (view.h / r.height);
      const x = px * (VIEW.W / view.w);
      const y = py * (VIEW.H / view.h);
      let best = -1, bd = 9999;

      for (let i=0;i<anchors.length;i++){
        const a = anchors[i];
        const wp = new T.Vector3(); a.getWorldPosition(wp);
        if (isHidden(wp)) continue; // pas cliquable si masqué
        const s  = projectWorldToCanvas(T, cam, wp, VIEW.W, VIEW.H);
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < bd){ bd = d; best = i; }
      }
      if (best >= 0 && bd < 24) { path.push(best); }
    }
    hud.addEventListener("click", onClick);

    // Boutons
    btnReset.addEventListener("click", ()=>{ path = []; });
    btnNext .addEventListener("click", ()=>{ wordIdx = (wordIdx + 1) % WORDS.length; path = []; });

    // Loop
    let req = 0;
    function loop(){
      pivot.rotation.y += 0.0035; // rotation douce (le pivot est centré → tourne sur lui-même)
      renderer.render(scene, cam);
      drawHUD();
      req = requestAnimationFrame(loop);
    }
    // Première mise au point (projections correctes)
    renderer.setPixelRatio(clamp(window.devicePixelRatio||1,1,VIEW.DPR_MAX));
    renderer.setSize(view.w, view.h, false);
    loop();

    // API destroy
    return {
      destroy(){
        try { cancelAnimationFrame(req); } catch {}
        ro?.disconnect(); window.removeEventListener("resize", onResize);
        try { renderer.dispose(); } catch {}
        hud.removeEventListener("click", onClick);
        rootEl.innerHTML = "";
      }
    };
  }

  // Expose
  window.OsseletsLevel2 = { mount };
})();
