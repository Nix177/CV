// public/osselets-level2.js
// LEVEL 2 — « Écrire avec les os » (24 trous / 4 faces opposées)
// Pur JS (aucun JSX/TS). Expose window.OsseletsLevel2.mount(root).
// ✅ Utilise en priorité THREE UMD r149 + GLTFLoader chargés par ton HTML (pas de double import)
// ✅ Centrage auto + boutons de rotation manuelle
// ✅ Occlusion réelle (Raycaster) : un trou caché n’est pas cliquable
// ✅ Éditeur des 24 lettres (localStorage)
// ✅ FIX: Projection & clics alignés sur les trous (coordonnées HUD = taille *réelle* du canvas)

;(() => {
  const MODEL    = "/assets/games/osselets/level2/3d/astragalus.glb";
  const WORDS_JS = "/assets/games/osselets/level2/3d/letters.json";

  const DPR_MAX = 2.5;

  // Alphabet grec par défaut (24)
  const GREEK_DEFAULT = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  // Fallback ESM si le UMD n’est pas là
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;

  // Debug
  const DBG  = (window.__L2_DEBUG === "on") || /\b__L2_DEBUG=on\b/.test(location.search);
  const log  = (...a)=>{ if (DBG) console.log("[L2]", ...a); };
  const warn = (...a)=>{ console.warn("[L2]", ...a); };
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const now = ()=>performance.now();

  async function fetchJSON(u){
    try{
      const r = await fetch(u, {cache:"no-store"});
      if (!r.ok) return null;
      return await r.json();
    }catch{ return null; }
  }

  // THREE + GLTFLoader: priorité au UMD global présent dans le HTML
  async function ensureThreeGLTF(){
    if (window.__OX_PHYS_V2) {
      const { THREE, GLTFLoader } = window.__OX_PHYS_V2;
      if (THREE && GLTFLoader) return { THREE, GLTFLoader };
    }
    if (window.THREE) {
      const THREE = window.THREE;
      const GLTFLoaderCtor = window.GLTFLoader || THREE.GLTFLoader;
      if (GLTFLoaderCtor) {
        log("using global THREE r%s + GLTFLoader (UMD)", THREE?.REVISION);
        return { THREE, GLTFLoader: GLTFLoaderCtor };
      }
    }
    if (window.__LxThree) return window.__LxThree;
    log("importing ESM three@%s (fallback)", THREE_VER);
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    window.__LxThree = { THREE, GLTFLoader };
    return window.__LxThree;
  }

  // UI helpers
  function el(tag, attrs={}, ...kids){
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs||{})){
      if (k==="style" && typeof v==="object") Object.assign(n.style, v);
      else if (k==="class") n.className = v;
      else if (k.startsWith("on") && typeof v==="function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids) n.append(k);
    return n;
  }

  function buildCenteredTemplate(root){
    root.innerHTML = "";
    root.style.position="relative";
    root.style.outline="none";

    // Canvas 3D
    const canvas = el("canvas");
    canvas.style.cssText = "display:block;border-radius:12px;background:transparent;";
    root.appendChild(canvas);

    // HUD 2D (points + fil)
    const hud = el("canvas");
    Object.assign(hud.style, { position:"absolute", inset:"0px", pointerEvents:"auto" });
    root.appendChild(hud);

    // Footer (titre + boutons)
    const footer = el("div", {style:{position:"absolute", left:"12px", bottom:"12px", display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap"}});
    const infoBox = el("div", {style:{color:"#e6f1ff", fontSize:"15px"}});
    const btnReset = el("button", {class:"btn", style:{border:"1px solid #2d3b52", background:"#0b1f33", color:"#e6f1ff"}}, "Réinitialiser");
    const btnNext  = el("button", {class:"btn", style:{border:"1px solid #2d3b52", background:"#0b1f33", color:"#e6f1ff"}}, "Mot suivant");
    const btnEdit  = el("button", {class:"btn", style:{border:"1px solid #2d3b52", background:"#0b1f33", color:"#e6f1ff"}}, "✏️ Éditer lettres");
    footer.append(infoBox, btnReset, btnNext, btnEdit);
    root.appendChild(footer);

    // Flèches rotation (manuelles)
    const arrows = el("div", {style:{
      position:"absolute", right:"12px", bottom:"12px", display:"grid",
      gridTemplateColumns:"repeat(3,36px)", gridTemplateRows:"repeat(3,36px)", gap:"6px",
      background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:"12px", padding:"8px"
    }});
    const arrowBtn = (txt, title)=>el("button", {
      class:"btn", title, style:{width:"36px", height:"36px", padding:"0", lineHeight:"1", textAlign:"center"}
    }, txt);
    const b = {
      up:    arrowBtn("↑","Tourner +X"),
      left:  arrowBtn("←","Tourner +Y"),
      home:  arrowBtn("⟳","Réinitialiser la vue"),
      right: arrowBtn("→","Tourner -Y"),
      down:  arrowBtn("↓","Tourner -X"),
    };
    arrows.append(el("div"), b.up, el("div"), b.left, b.home, b.right, el("div"), b.down, el("div"));
    root.appendChild(arrows);

    // Panneau éditeur
    const panel = el("div", {style:{
      position:"absolute", right:"12px", top:"12px", width:"320px", maxWidth:"calc(100% - 24px)",
      background:"#081a2bd9", border:"1px solid #ffffff22", borderRadius:"12px", padding:"12px",
      display:"none", color:"#e6f1ff"
    }});
    const panelTitle = el("div", {style:{fontWeight:"700", marginBottom:"8px"}}, "Lettres des 24 trous");
    const grid = el("div", {style:{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"6px", marginBottom:"10px" }});
    const panelRow = el("div", {style:{display:"flex", gap:"6px", justifyContent:"flex-end"}});
    const btnClose = el("button", {class:"btn"}, "Fermer");
    const btnSave  = el("button", {class:"btn"}, "Enregistrer");
    panelRow.append(btnSave, btnClose);
    panel.append(panelTitle, grid, panelRow);
    root.appendChild(panel);

    return { canvas, hud, infoBox, btnReset, btnNext, btnEdit, arrows: b, panel:{box:panel, grid, btnSave, btnClose} };
  }

  // Cadrer la caméra sur l’objet
  function frameToObject(THREE, camera, object, margin = 1.25){
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    const fov = camera.fov * Math.PI/180;
    let dist = (maxDim/2) / Math.tan(fov/2);
    dist *= margin;

    camera.position.copy(center).add(new THREE.Vector3(0.9, 0.8, 1.0).normalize().multiplyScalar(dist));
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }

  async function mount(rootEl){
    log("mount()");

    const { THREE: T, GLTFLoader } = await ensureThreeGLTF();

    // UI
    const ui = buildCenteredTemplate(rootEl);
    const { canvas, hud, infoBox, btnReset, btnNext, btnEdit, arrows, panel } = ui;

    // Renderer / Scene / Camera
    const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:true});
    const scene = new T.Scene(); scene.background = null;
    const cam = new T.PerspectiveCamera(45, 16/9, 0.1, 50);
    scene.add(new T.AmbientLight(0xffffff,.7));
    const dir = new T.DirectionalLight(0xffffff,.9); dir.position.set(2.4,3.3,2.6); scene.add(dir);

    // Données
    let WORDS = [
      { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
      { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
      { gr:"ΜΑΤΙ",  en:"MATI",  hint:"« Mauvais œil » — apotropaïon." }
    ];
    const cfg = await fetchJSON(WORDS_JS);
    if (cfg?.words?.length) WORDS = cfg.words.slice(0, 12);

    let wordIdx = 0;
    function updateFooter(){
      const w = WORDS[wordIdx] || WORDS[0];
      infoBox.innerHTML = `
        <div style="font-weight:600; margin-bottom:4px">Mot : ${w.gr} (${w.en})</div>
        <div style="font-size:12px; color:#9cc0ff">Indice : ${w.hint}</div>
      `;
    }
    updateFooter();

    // Lettres (éditables)
    let letters = (()=>{
      try{
        const raw = localStorage.getItem("l2_letters");
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length===24) return arr;
        }
      }catch{}
      return [...GREEK_DEFAULT];
    })();

    // Panneau éditeur
    function openEditor(){
      panel.grid.innerHTML="";
      for (let i=0;i<24;i++){
        const wrap = el("div", {style:{display:"flex", flexDirection:"column", gap:"4px"}});
        const lbl  = el("label", {style:{fontSize:"11px", opacity:.8}}, String(i+1));
        const inp  = el("input", {value: letters[i]||"", style:{width:"100%", padding:"6px 8px", borderRadius:"8px", border:"1px solid #2d3b52", background:"#0b1f33", color:"#e6f1ff"}});
        wrap.append(lbl, inp);
        panel.grid.append(wrap);
      }
      panel.box.style.display = "block";
    }
    function closeEditor(){ panel.box.style.display="none"; }
    btnEdit.addEventListener("click", openEditor);
    panel.btnClose.addEventListener("click", closeEditor);
    panel.btnSave.addEventListener("click", ()=>{
      const inputs = panel.grid.querySelectorAll("input");
      const next = [];
      inputs.forEach(inp=> next.push((inp.value||"").trim().slice(0,2) || "")); // court
      if (next.length===24){
        letters = next;
        try{ localStorage.setItem("l2_letters", JSON.stringify(letters)); }catch{}
        closeEditor();
      }
    });

    // Pivot pour rotations manuelles
    const pivot = new T.Group(); scene.add(pivot);

    // Modèle
    let model = null;
    let anchors = []; // Hole_* (24)
    let ray = new T.Raycaster(undefined, undefined, 0.01, 100);

    function collectAnchors(root){
      const out=[];
      root.traverse(n=>{
        const nm=(n.name||"");
        if (/^hole[_\s-]*/i.test(nm)) out.push(n);
      });
      return out.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
    }

    function normalizeAndCenter(root){
      const box = new T.Box3().setFromObject(root);
      const size = box.getSize(new T.Vector3());
      const maxDim = Math.max(size.x,size.y,size.z) || 1;
      const scale = 1.75 / maxDim;
      root.scale.setScalar(scale);
      root.updateMatrixWorld(true);
      const box2 = new T.Box3().setFromObject(root);
      const center = box2.getCenter(new T.Vector3());
      root.position.sub(center);
    }

    await new Promise((res,rej)=>{
      const loader = new GLTFLoader();
      loader.load(MODEL, (gltf)=>{
        model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!model) return rej(new Error("Modèle vide"));
        model.traverse(o=>{
          if (o.isMesh){
            if (!o.material || !o.material.isMeshStandardMaterial)
              o.material = new T.MeshStandardMaterial({color:0xf7efe7, roughness:.6, metalness:.05});
          }
        });
        normalizeAndCenter(model);
        pivot.add(model);

        anchors = collectAnchors(model);
        log("anchors Hole_* found:", anchors.length);

        cam.position.set(2.0,1.3,2.3);
        frameToObject(T, cam, pivot, 1.25);
        res();
      }, undefined, err=>rej(err));
    });

    // --- SIZES / RESIZE (⚠️ clé du correct alignement) -----------------------
    function syncSizes(){
      const w = Math.max(320, rootEl.clientWidth|0);
      const h = Math.round(w * (9/16));
      const dpr = clamp(window.devicePixelRatio||1, 1, DPR_MAX);

      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      canvas.style.width = w+"px"; canvas.style.height = h+"px";

      // HUD = exactement la même *taille pixel* que le canvas WebGL
      const buf = renderer.getDrawingBufferSize(new T.Vector2());
      hud.width  = buf.x;  // px réels
      hud.height = buf.y;
      hud.style.width  = w+"px";
      hud.style.height = h+"px";

      cam.aspect = w/h;
      cam.updateProjectionMatrix();

      log("resize -> view: {css:", w,"x",h,"}, {px:", hud.width,"x",hud.height,"}, dpr:", dpr);
    }
    syncSizes();
    const ro = (typeof ResizeObserver!=="undefined") ? new ResizeObserver(syncSizes) : null;
    if (ro) ro.observe(rootEl);
    window.addEventListener("resize", syncSizes);

    // --- Projection trous (NDC -> pixels HUD *réels*) ------------------------
    const ctx = hud.getContext("2d");
    let points = []; // [{x,y,label,index,hidden}]
    function projectHoles(){
      if (!model) return;
      const camPos = new T.Vector3(); cam.getWorldPosition(camPos);
      const world  = new T.Vector3();

      const W = hud.width, H = hud.height; // ⚠️ pixels réels
      points = anchors.map((n,i)=>{
        n.getWorldPosition(world);

        // occlusion
        let hidden=false;
        const dir = world.clone().sub(camPos).normalize();
        ray.set(camPos, dir);
        const hits = ray.intersectObject(model, true);
        if (hits && hits.length){
          const dHole = camPos.distanceTo(world);
          if (hits[0].distance < dHole - 1e-3) hidden = true;
        }

        const v = world.clone().project(cam);
        const px = (v.x*0.5+0.5)*W;
        const py = (-v.y*0.5+0.5)*H;

        return { x:px, y:py, label:letters[i]||"", index:i, hidden };
      });
    }

    // Chemin (fil)
    let path = [];
    function resetPath(){ path.length=0; }

    // Dessin HUD
    let lastHudLog=0;
    function drawHUD(){
      const W=hud.width, H=hud.height;
      ctx.clearRect(0,0,W,H);

      // Fil
      ctx.strokeStyle="#60a5fa"; ctx.lineWidth=Math.max(2, W/640);
      if (path.length>1){
        ctx.beginPath();
        const s=points[path[0]];
        if (s) ctx.moveTo(s.x,s.y);
        for (let i=1;i<path.length;i++){
          const p = points[path[i]];
          if (p) ctx.lineTo(p.x,p.y);
        }
        ctx.stroke();
      }

      // Points
      const R = Math.max(10, Math.round(W/96)); // radius scale avec la taille
      for (const p of points){
        ctx.beginPath();
        ctx.fillStyle = p.hidden ? "rgba(14,165,233,.35)" : "#0ea5e9";
        ctx.arc(p.x, p.y, R, 0, Math.PI*2);
        ctx.fill();

        if (!p.hidden) {
          ctx.fillStyle="#e6f1ff";
          ctx.font = `${Math.max(12, Math.round(W/120))}px ui-sans-serif, system-ui`;
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(p.label, p.x, p.y);
        }
      }

      if (DBG && now()-lastHudLog>800){
        const hiddenCount = points.filter(p=>p.hidden).length;
        log("hud drawn: hidden %d / 24", hiddenCount);
        lastHudLog = now();
      }
    }

    // Animation
    let req=0;
    function loop(){
      projectHoles();
      renderer.render(scene, cam);
      drawHUD();
      req = requestAnimationFrame(loop);
    }
    loop();

    // Clic → plus proche trou visible (coordonnées en pixels HUD *réels*)
    hud.addEventListener("click", (e)=>{
      const r = hud.getBoundingClientRect();
      const x = (e.clientX - r.left) * (hud.width  / r.width);
      const y = (e.clientY - r.top)  * (hud.height / r.height);

      let best=-1, bd=1e9;
      const pickR = Math.max(22, Math.round(hud.width/64)); // seuil adaptatif
      for (let i=0;i<points.length;i++){
        const p = points[i]; if (p.hidden) continue;
        const d = Math.hypot(p.x-x, p.y-y);
        if (d<bd){ bd=d; best=i; }
      }
      if (best>=0 && bd<pickR){
        if (path[path.length-1]!==best) path.push(best);
        if (DBG) log("click → hole", best, points[best]?.label, "dist", Math.round(bd));
      }
    });
    // Undo clic droit
    hud.addEventListener("contextmenu", (e)=>{ e.preventDefault(); path.pop(); });

    // Boutons
    btnReset.addEventListener("click", ()=>{ resetPath(); });
    btnNext.addEventListener("click", ()=>{ wordIdx = (wordIdx+1)%WORDS.length; updateFooter(); resetPath(); });

    // Rotations manuelles
    const STEP = 0.08;
    arrows.up.addEventListener("click",   ()=>{ pivot.rotation.x += STEP; });
    arrows.down.addEventListener("click", ()=>{ pivot.rotation.x -= STEP; });
    arrows.left.addEventListener("click", ()=>{ pivot.rotation.y += STEP; });
    arrows.right.addEventListener("click",()=>{ pivot.rotation.y -= STEP; });
    arrows.home.addEventListener("click", ()=>{ pivot.rotation.set(0,0,0); frameToObject(T, cam, pivot, 1.25); });

    // Info (facultatif)
    const info = el("div", {style:{
      position:"absolute", left:"12px", bottom:"84px", fontSize:"12px", color:"#9cc0ff", opacity:.9, maxWidth:"min(96%, 640px)"
    }});
    info.textContent = "Modèle : level2/3d/astragalus.glb — nœuds Hole_* (24). Occlusion réelle, fil cliquable.";
    rootEl.appendChild(info);

    // Handle de démontage
    return {
      destroy(){
        try{ cancelAnimationFrame(req); }catch{}
        try{ ro?.disconnect(); }catch{}
        try{ window.removeEventListener("resize", syncSizes); }catch{}
        try{ renderer.dispose(); }catch{}
        rootEl.innerHTML="";
      }
    };
  }

  window.OsseletsLevel2 = { mount };
  log("script loaded, ts:", Date.now(), "| global set: window.OsseletsLevel2");
})();
