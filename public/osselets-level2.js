// /public/osselets-level2.js  — build: debug-v3
(() => {
  const MODEL_PATH = "/assets/games/osselets/level2/3d/astragalus.glb";
  const WORDS_JSON = "/assets/games/osselets/level2/3d/letters.json";
  const VIEW       = { W: 960, H: 540, DPR_MAX: 2.5 };

  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;

  const DBG = !!window.__L2_DEBUG;
  const log  = (...a)=>{ if (DBG) console.log("[L2]", ...a); };
  const info = (...a)=>{ if (DBG) console.info("[L2]", ...a); };
  const warn = (...a)=>{ if (DBG) console.warn("[L2]", ...a); };
  const err  = (...a)=>{ if (DBG) console.error("[L2]", ...a); };

  info("script loaded, ts:", Date.now());

  async function ensureThreeGLTF(){
    // 1) Réutilisation paquet physique v2 s'il existe
    if (window.__OX_PHYS_V2) {
      const { THREE, GLTFLoader } = window.__OX_PHYS_V2;
      if (THREE && GLTFLoader) { info("using __OX_PHYS_V2"); return { THREE, GLTFLoader }; }
    }
    // 2) Globaux déjà injectés (ton HTML) — évite les imports ESM et le warning "multiple instances"
    if (window.THREE && window.GLTFLoader) {
      info("using window.THREE + window.GLTFLoader (0.149.0)");
      return { THREE: window.THREE, GLTFLoader: window.GLTFLoader };
    }
    // 3) Fallback ESM
    if (window.__LxThree) { info("using cached __LxThree"); return window.__LxThree; }
    info("importing ESM three@%s", THREE_VER);
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    window.__LxThree = { THREE, GLTFLoader };
    return window.__LxThree;
  }

  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  function buildCenteredTemplate(baseRoot, THREE){
    const root = baseRoot.clone(true);
    const box  = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const pivot = new THREE.Group();
    root.position.sub(center);
    const target = 1.6;
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale  = target / maxDim;
    root.scale.setScalar(scale);
    pivot.add(root);
    info("normalize: maxDim=%.3f scale=%.3f center=", maxDim, scale, center);
    return { pivot, inner: root };
  }

  function collectHoles(root){
    const list=[];
    root.traverse(n=>{
      const nm = (n.name||"").toLowerCase();
      if (/^hole[_\s-]?/.test(nm)) list.push(n);
    });
    list.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
    info("anchors Hole_* found:", list.length, list.map(n=>n.name));
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

  async function mount(rootEl){
    console.group("[L2] mount()");
    try {
      const { THREE, GLTFLoader } = await ensureThreeGLTF();
      const T = THREE;

      rootEl.innerHTML = "";
      rootEl.style.position = "relative";

      const cv3d = document.createElement("canvas");
      cv3d.width = VIEW.W; cv3d.height = VIEW.H;
      cv3d.style.cssText = "display:block;border-radius:12px;background:transparent;";
      rootEl.appendChild(cv3d);

      const hud = document.createElement("canvas");
      hud.width = VIEW.W; hud.height = VIEW.H;
      hud.style.cssText = "position:absolute;inset:0;pointer-events:auto;z-index:3;";
      rootEl.appendChild(hud);

      const ui = document.createElement("div");
      ui.style.cssText = "position:absolute;left:12px;bottom:12px;display:flex;gap:8px;z-index:4;align-items:center";
      const btnReset = document.createElement("button"); btnReset.className="btn"; btnReset.textContent="Réinitialiser";
      const btnNext  = document.createElement("button"); btnNext.className="btn"; btnNext.textContent="Mot suivant";
      ui.append(btnReset, btnNext); rootEl.appendChild(ui);

      const foot = document.createElement("div");
      foot.style.cssText="position:absolute;left:12px;bottom:64px;z-index:4;font-size:12px;color:#9cc0ff";
      foot.textContent = "Modèle : level2/3d/astragalus.glb — nœuds Hole_* (24). Occlusion réelle, fil cliquable.";
      rootEl.appendChild(foot);

      // Renderer/Scene/Camera
      const renderer = new T.WebGLRenderer({ canvas: cv3d, antialias: true, alpha: true });
      const scene = new T.Scene(); scene.background = null;
      const cam   = new T.PerspectiveCamera(45, 16/9, 0.1, 50);
      cam.position.set(2.0, 1.3, 2.3); cam.lookAt(0, 0.25, 0);
      scene.add(new T.AmbientLight(0xffffff, .7));
      const dir = new T.DirectionalLight(0xffffff, .9); dir.position.set(2.4, 3.3, 2.6); scene.add(dir);

      let view = { w: VIEW.W, h: VIEW.H, dpr: 1 };
      function onResize(){
        const w = Math.max(320, rootEl.clientWidth|0);
        const h = Math.round(w * (VIEW.H/VIEW.W));
        const d = clamp(window.devicePixelRatio||1, 1, VIEW.DPR_MAX);
        view = { w,h,dpr:d };
        renderer.setPixelRatio(d);
        renderer.setSize(w, h, false);
        cv3d.style.width = w+"px"; cv3d.style.height = h+"px";
        hud.width  = Math.floor(w*d);
        hud.height = Math.floor(h*d);
        hud.style.width  = w+"px";
        hud.style.height = h+"px";
        const ctx = hud.getContext("2d");
        ctx.setTransform((w*d)/VIEW.W, 0, 0, (h*d)/VIEW.H, 0, 0);
        cam.aspect = w/h; cam.updateProjectionMatrix();
        log("resize:", {w,h,dpr:d});
      }
      onResize();
      const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
      if (ro) ro.observe(rootEl); window.addEventListener("resize", onResize);

      // Words
      const wordsCfg = await fetchJSON(WORDS_JSON);
      const WORDS = (wordsCfg && wordsCfg.words && wordsCfg.words.length)
        ? wordsCfg.words.slice(0, 24)
        : [
            { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
            { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
            { gr:"ΜΑΤΙ",  en:"MATI",  hint:"« Mauvais œil » — apotropaïon." }
          ];
      let wordIdx = 0;
      log("words loaded:", WORDS.length);

      // Model load + progress
      const loader = new GLTFLoader();
      const root = await new Promise((res,rej)=>{
        loader.load(
          MODEL_PATH,
          (gltf)=>{
            const r = gltf.scene || (gltf.scenes && gltf.scenes[0]);
            if (!r) return rej(new Error("Modèle vide"));
            r.traverse(o=>{
              if (o.isMesh){
                if (!o.material || !o.material.isMeshStandardMaterial)
                  o.material = new T.MeshStandardMaterial({ color:0xf7efe7, roughness:.6, metalness:.05 });
              }
            });
            res(r);
          },
          (xhr)=>{ log("GLB progress:", xhr?.loaded, "/", xhr?.total); },
          (e)=>{ rej(e); }
        );
      }).catch(e=>{ err("GLB load failed:", e); throw e; });

      // Pivot centré
      const { pivot } = buildCenteredTemplate(root, T);
      scene.add(pivot);

      // Anchors
      let anchors = collectHoles(pivot);
      if (anchors.length !== 24) {
        warn(`expected 24 holes, got ${anchors.length} — using circular fallback`);
        anchors = [];
        for (let i=0;i<24;i++){
          const g=new T.Object3D();
          const t=(i/24)*Math.PI*2, R=0.9;
          g.position.set(Math.cos(t)*R, 0, Math.sin(t)*R);
          pivot.add(g); anchors.push(g);
        }
      }

      // Projection + occlusion
      const ctx = hud.getContext("2d");
      const isHidden = makeRayOcclusion(T, cam, pivot);
      let path = [];

      function drawHUD(){
        ctx.clearRect(0,0,VIEW.W,VIEW.H);
        // Fil
        ctx.strokeStyle="#60a5fa"; ctx.lineWidth=2;
        if (path.length>1){
          ctx.beginPath();
          const wp0 = new T.Vector3(); anchors[path[0]].getWorldPosition(wp0);
          let s = projectWorldToCanvas(T, cam, wp0, VIEW.W, VIEW.H);
          ctx.moveTo(s.x,s.y);
          for (let i=1;i<path.length;i++){
            const wpi = new T.Vector3(); anchors[path[i]].getWorldPosition(wpi);
            s = projectWorldToCanvas(T, cam, wpi, VIEW.W, VIEW.H);
            ctx.lineTo(s.x,s.y);
          }
          ctx.stroke();
        }
        // Points + lettres
        let hiddenCount=0;
        for (let i=0;i<anchors.length;i++){
          const wp = new T.Vector3(); anchors[i].getWorldPosition(wp);
          const scr = projectWorldToCanvas(T, cam, wp, VIEW.W, VIEW.H);
          const hidden = isHidden(wp); if (hidden) hiddenCount++;
          ctx.beginPath();
          ctx.fillStyle = hidden ? "rgba(14,165,233,.35)" : "#0ea5e9";
          ctx.arc(scr.x, scr.y, 10, 0, Math.PI*2); ctx.fill();
          if (!hidden){
            const GREEK=["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];
            ctx.fillStyle="#e6f1ff";
            ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
            ctx.fillText(GREEK[i], scr.x, scr.y);
          }
        }
        log("hud drawn: hidden", hiddenCount, "/", anchors.length);
        // Pied
        const w = WORDS[wordIdx] || WORDS[0];
        ctx.fillStyle="#e6f1ff"; ctx.font="16px ui-sans-serif, system-ui";
        ctx.textAlign="start"; ctx.textBaseline="alphabetic";
        ctx.fillText(`Mot : ${w.gr} (${w.en})`, 16, VIEW.H-40);
        ctx.fillStyle="#9cc0ff"; ctx.font="12px ui-sans-serif, system-ui";
        ctx.fillText(`Indice : ${w.hint}`, 16, VIEW.H-18);
      }

      function onClick(e){
        const r = hud.getBoundingClientRect();
        const px = (e.clientX - r.left) * (view.w / r.width);
        const py = (e.clientY - r.top)  * (view.h / r.height);
        const x = px * (VIEW.W / view.w);
        const y = py * (VIEW.H / view.h);
        let best=-1, bd=1e9, bestScr=null;
        for (let i=0;i<anchors.length;i++){
          const wp = new T.Vector3(); anchors[i].getWorldPosition(wp);
          if (isHidden(wp)) continue;
          const scr = projectWorldToCanvas(T, cam, wp, VIEW.W, VIEW.H);
          const d = Math.hypot(scr.x-x, scr.y-y);
          if (d<bd){ bd=d; best=i; bestScr=scr; }
        }
        if (best>=0 && bd<24){
          path.push(best);
          log("click → hole", best, "dist", Math.round(bd), "at", bestScr);
        } else {
          log("click ignored dist", Math.round(bd));
        }
      }
      hud.addEventListener("click", onClick);

      btnReset.addEventListener("click", ()=>{ path=[]; log("reset path"); });
      btnNext .addEventListener("click", ()=>{ wordIdx=(wordIdx+1)%WORDS.length; path=[]; log("next word", wordIdx); });

      let req = 0;
      function loop(){
        // rotation douce autour de son centre
        pivot.rotation.y += 0.0035;
        renderer.render(scene, cam);
        drawHUD();
        req = requestAnimationFrame(loop);
      }
      renderer.setPixelRatio(clamp(window.devicePixelRatio||1,1,VIEW.DPR_MAX));
      renderer.setSize(view.w, view.h, false);
      loop();

      // expose pour test en console
      window.__L2 = { renderer, scene, cam, pivot, anchors, click:onClick, destroy };

      function destroy(){
        try { cancelAnimationFrame(req); } catch {}
        ro?.disconnect(); window.removeEventListener("resize", onResize);
        try { renderer.dispose(); } catch {}
        hud.removeEventListener("click", onClick);
        rootEl.innerHTML = "";
        log("destroyed");
      }

      console.groupEnd();
      return { destroy };
    } catch (e) {
      err("mount failed:", e);
      console.groupEnd();
      throw e;
    }
  }

  window.OsseletsLevel2 = { mount };
  info("global set: window.OsseletsLevel2");
})();
