;(() => {
  console.info("[L2] build v2 loaded");

  const { useEffect, useRef, useState, useMemo } = React;

  // -------------------- Chemins --------------------
  const BASE   = "/assets/games/osselets/level2/";
  const MODEL  = BASE + "3d/astragalus.glb";
  const WORDSJ = BASE + "3d/letters.json"; // optionnel, format { words:[{gr,en,hint}], letters:["Α","Β",... 24] }

  // -------------------- Constantes vue/HUD --------------------
  const CANVAS_W = 960, CANVAS_H = 540, DPR_MAX = 2.5;
  const DOT_R   = 12;   // rayon (HUD) pour sélection de trou
  const CLICK_R = 22;   // tolérance de clic
  const STROKE  = "#60a5fa";
  const DOT     = "#0ea5e9";
  const DOT_OCC = "rgba(14,165,233,.35)";

  // -------------------- Utils --------------------
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);
  const hasGlobal = (k)=>typeof window!=="undefined" && window[k];

  function getThree() {
    const T = hasGlobal("THREE") && window.THREE;
    if (!T) throw new Error("THREE global manquant. Vérifie <script three.min.js>.");
    return T;
  }
  function getLoader() {
    const T = getThree();
    const GL = (T && T.GLTFLoader) || window.GLTFLoader;
    if (!GL) throw new Error("GLTFLoader global manquant. Vérifie <script examples/js/loaders/GLTFLoader.js>.");
    return GL;
  }
  function getOrbitControls() {
    const T = getThree();
    return (T && T.OrbitControls) || window.OrbitControls || null;
  }

  // Collecte 24 ancres "Hole_*" (toutes faces confondues)
  function collectHoles(root) {
    const list = [];
    root.traverse(n=>{
      const nm = (n.name||"");
      if(/^hole([_\s-].*)?$/i.test(nm)) list.push(n);
    });
    // tri stable par nom pour garder un ordre déterministe
    list.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
    return list;
  }

  // Projette un point 3D vers pixels HUD + occlusion par raycast
  function projectNode(node, cam, T, sceneRoot, hudW, hudH) {
    const v = new T.Vector3(); node.getWorldPosition(v);
    // occlusion (ray depuis caméra -> point)
    let hidden = false;
    if (sceneRoot && cam) {
      const camPos = new T.Vector3(); cam.getWorldPosition(camPos);
      const dir = v.clone().sub(camPos).normalize();
      const rc = new T.Raycaster(camPos, dir, 0.001, 100);
      const hits = rc.intersectObject(sceneRoot, true);
      if (hits && hits.length) {
        const dHole = camPos.distanceTo(v);
        if (hits[0].distance < dHole - 1e-3) hidden = true;
      }
    }
    // projection
    const p = v.clone().project(cam);
    const x = ( p.x * 0.5 + 0.5) * hudW;
    const y = (-p.y * 0.5 + 0.5) * hudH;
    return { x, y, hidden };
  }

  // Recentre & normalise l’échelle
  function normalizeRoot(root, T, targetSize=1.6) {
    const box = new T.Box3().setFromObject(root);
    const size = box.getSize(new T.Vector3());
    const maxS = Math.max(size.x,size.y,size.z) || 1;
    const s = targetSize / maxS;
    root.scale.setScalar(s);
    box.setFromObject(root);
    const c = box.getCenter(new T.Vector3());
    root.position.sub(c);  // centre à l’origine
    root.updateMatrixWorld(true);
  }

  // UI helpers
  function Button({onClick, children, title, style}) {
    return (
      <button onClick={onClick} title={title}
        style={{border:"1px solid #2d3b52", background:"#0b1f33", color:"#e6f1ff", padding:"8px 12px",
                borderRadius:10, cursor:"pointer", ...style}}>
        {children}
      </button>
    );
  }

  function AstragalusLevel2() {
    const wrapRef = useRef(null);
    const glRef   = useRef(null);
    const hudRef  = useRef(null);

    // Three refs
    const rendererRef = useRef(null);
    const sceneRef    = useRef(null);
    const cameraRef   = useRef(null);
    const modelRef    = useRef(null);
    const orbitRef    = useRef(null);

    // Données “trous”
    const holesRef   = useRef([]);           // Array<THREE.Object3D> (length 24)
    const projRef    = useRef([]);           // positions projetées (x,y,hidden)
    const lettersRef = useRef([]);           // 24 lettres configurables
    const pathRef    = useRef([]);           // indices sélectionnés (fil)
    const ctxRef     = useRef(null);

    // État UI
    const [ready, setReady] = useState(false);
    const [msg, setMsg]     = useState("24 trous (6 par face) reliés aux 24 lettres grecques. Suis le fil pour épeler un mot.");
    const [wordIdx, setWordIdx] = useState(0);
    const [showLetters, setShowLetters] = useState(false);
    const [showDebug, setShowDebug] = useState(false);

    const wordsRef = useRef([
      { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
      { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
      { gr:"ΜΑΤΙ",  en:"MATI",  hint:"« Mauvais œil » — apotropaïon." }
    ]);

    const T = useMemo(()=>{ try { return getThree(); } catch(e){ console.error(e); return null; } }, []);
    const Controls = useMemo(()=> getOrbitControls(), []);

    // --------------- Resize ---------------
    useEffect(()=>{
      function onResize() {
        const wrap=wrapRef.current, gl=glRef.current, hud=hudRef.current, r=rendererRef.current, cam=cameraRef.current;
        if (!wrap || !gl || !hud || !r || !cam) return;
        const w = Math.max(320, wrap.clientWidth|0);
        const h = Math.round(w*(CANVAS_H/CANVAS_W));
        const dpr = clamp(window.devicePixelRatio||1,1,DPR_MAX);
        r.setPixelRatio(dpr);
        r.setSize(w,h,false);
        gl.style.width=w+"px"; gl.style.height=h+"px";
        hud.width=Math.floor(w*dpr); hud.height=Math.floor(h*dpr);
        hud.style.width=w+"px"; hud.style.height=h+"px";
        cam.aspect=w/h; cam.updateProjectionMatrix();

        const ctx=hud.getContext("2d"); ctx.setTransform((w*dpr)/CANVAS_W,0,0,(h*dpr)/CANVAS_H,0,0);
        ctxRef.current=ctx;
      }
      onResize();
      const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener("resize", onResize);
      return ()=>{ if (ro) ro.disconnect(); window.removeEventListener("resize", onResize); }
    },[]);

    // --------------- Init Three + modèle ---------------
    useEffect(()=>{
      let canceled=false;
      (async ()=>{
        if (!T) return;
        let GL;
        try { GL = getLoader(); } catch(e){ setMsg("GLTFLoader introuvable."); console.error(e); return; }

        // Renderer/Scene/Camera
        const gl=glRef.current, hud=hudRef.current;
        const r = new T.WebGLRenderer({canvas:gl, antialias:true, alpha:true});
        r.outputColorSpace = T.SRGBColorSpace;
        rendererRef.current = r;

        const scene = new T.Scene(); scene.background=null;
        sceneRef.current=scene;

        const cam = new T.PerspectiveCamera(45,16/9,0.1,60);
        cam.position.set(2.2,1.35,2.6); cam.lookAt(0,0.25,0);
        cameraRef.current=cam;

        // Lumières
        scene.add(new T.AmbientLight(0xffffff,.7));
        const dir = new T.DirectionalLight(0xffffff,.9); dir.position.set(2.8,3.3,2.6);
        scene.add(dir);

        // OrbitControls (si présent)
        if (Controls) {
          const oc = new Controls(cam, gl);
          oc.enableDamping = true;
          oc.dampingFactor = 0.06;
          oc.enablePan = false;
          oc.minDistance = 1.2;
          oc.maxDistance = 6.0;
          oc.minPolarAngle = 0.3;
          oc.maxPolarAngle = Math.PI/2 - 0.12;
          orbitRef.current = oc;
        }

        // Charger éventuels mots/lettres
        try {
          const cfg = await fetchJSON(WORDSJ);
          if (cfg?.words?.length) wordsRef.current = cfg.words.slice(0, 8);
          if (cfg?.letters?.length === 24) lettersRef.current = cfg.letters.slice();
        } catch {}

        // Modèle
        const loader = new GL();
        loader.load(MODEL, (gltf)=>{
          if (canceled) return;
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root){ setMsg("Modèle vide."); return; }

          // Matériaux simples
          root.traverse(o=>{
            if (o.isMesh){
              if (!o.material || !o.material.isMeshStandardMaterial)
                o.material = new T.MeshStandardMaterial({ color:0xf7efe7, roughness:.6, metalness:.05 });
              o.castShadow=false; o.receiveShadow=false;
            }
          });

          normalizeRoot(root, T, 1.7);
          scene.add(root);
          modelRef.current=root;

          const holes = collectHoles(root);
          // si moins de 24: fallback cercle virtuel
          if (holes.length !== 24) {
            console.warn(`[L2] ${holes.length} trous detectés; fallback cercle.`);
            const fake = [];
            for(let i=0;i<24;i++){
              const g=new T.Object3D();
              const t=(i/24)*Math.PI*2, R=0.9;
              g.position.set(Math.cos(t)*R, 0, Math.sin(t)*R);
              root.add(g); fake.push(g);
            }
            holesRef.current=fake;
          } else {
            holesRef.current=holes;
          }

          // lettres par défaut (grec) si non fourni
          if (lettersRef.current.length!==24) {
            lettersRef.current = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];
          }

          setReady(true);
          animate();
        }, undefined, (err)=>{ console.error("[L2] load error",err); setMsg("Échec chargement modèle."); });

        function animate(){
          let stop=false;
          (function loop(){
            if (stop) return;
            orbitRef.current?.update?.();
            renderHUD();
            r.render(scene, cam);
            requestAnimationFrame(loop);
          })();
          return ()=>{ stop=true; };
        }

      })();
      return ()=>{ canceled=true; };
    },[]);

    // --------------- HUD : projection + dessin ---------------
    function renderHUD() {
      const ctx=ctxRef.current, cam=cameraRef.current, model=modelRef.current;
      const gl=glRef.current, hud=hudRef.current;
      if (!ctx || !cam || !gl || !hud) return;

      const w=hud.width, h=hud.height; // pixels device
      // On dessine en coordonnées “figuratives” (CANVAS_W/H) grâce au setTransform
      ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

      // Projeter trous
      const T3 = T; if (!T3) return;
      const list = holesRef.current||[];
      projRef.current = list.map(n => projectNode(n, cam, T3, model, CANVAS_W, CANVAS_H));

      // Lignes (fil)
      ctx.strokeStyle=STROKE; ctx.lineWidth=2;
      if (pathRef.current.length>1) {
        ctx.beginPath();
        const first = projRef.current[pathRef.current[0]];
        ctx.moveTo(first.x, first.y);
        for (let i=1;i<pathRef.current.length;i++){
          const p = projRef.current[pathRef.current[i]];
          ctx.lineTo(p.x,p.y);
        }
        ctx.stroke();
      }

      // Points + lettres
      const letters = lettersRef.current;
      for (let i=0;i<projRef.current.length;i++){
        const p = projRef.current[i];
        ctx.beginPath();
        ctx.fillStyle = p.hidden ? DOT_OCC : DOT;
        ctx.arc(p.x,p.y, DOT_R, 0, Math.PI*2);
        ctx.fill();

        if (!p.hidden) {
          ctx.fillStyle="#e6f1ff";
          ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(letters[i] || "", p.x, p.y);
        }
      }
    }

    // --------------- Interactions ---------------
    // Click sur HUD → ajoute un trou proche au chemin (si visible)
    useEffect(()=>{
      function onClick(e){
        const hud=hudRef.current; if (!hud) return;
        const r=hud.getBoundingClientRect();
        const scaleX = CANVAS_W / r.width, scaleY = CANVAS_H / r.height;
        const x=(e.clientX - r.left)*scaleX, y=(e.clientY - r.top)*scaleY;
        // trouver le trou le plus proche
        let best=-1, bd=1e9;
        for (let i=0;i<projRef.current.length;i++){
          const p=projRef.current[i];
          if (!p || p.hidden) continue; // pas clic sur trous cachés
          const d=Math.hypot(p.x-x, p.y-y);
          if (d<bd){ bd=d; best=i; }
        }
        if (best>=0 && bd<CLICK_R) {
          pathRef.current.push(best);
        }
      }
      const hud=hudRef.current; if (hud) hud.addEventListener("click", onClick);
      return ()=>{ if (hud) hud.removeEventListener("click", onClick); };
    },[]);

    // Nudge (flèches UI) : petites rotations/orients
    function nudge(dx=0, dy=0){
      const cam=cameraRef.current, target=new T.Vector3(0,0,0);
      if (!cam) return;
      const off = new T.Spherical().setFromVector3(cam.position.clone().sub(target));
      off.theta += dx; // gauche/droite
      off.phi   = clamp(off.phi + dy, 0.3, Math.PI/2 - 0.12);
      cam.position.copy(new T.Vector3().setFromSpherical(off).add(target));
      cam.lookAt(target);
    }

    // Recentrer (en cas d’offset modèle)
    function recenter() {
      const root=modelRef.current; if (!root || !T) return;
      normalizeRoot(root, T, 1.7);
    }

    function resetPath(){ pathRef.current=[]; }
    function nextWord(){ setWordIdx(i=>(i+1)%(wordsRef.current.length||1)); resetPath(); }

    // --------------- Panneaux (Lettres & Debug) ---------------
    function LettersPanel(){
      const [local, setLocal] = useState(lettersRef.current.slice(0,24));
      function apply(){ lettersRef.current = local.slice(0,24); }
      return (
        <div style={panelStyle}>
          <div style={panelHead}>Lettres (24 trous)</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8, maxHeight:220, overflow:"auto"}}>
            {local.map((v,i)=>(
              <div key={i} style={{display:"flex", gap:6, alignItems:"center"}}>
                <span style={{opacity:.7, width:22, textAlign:"right"}}>{String(i+1).padStart(2,"0")}</span>
                <input value={v} onChange={e=>{
                  const s=e.target.value.trim(); const x=s.length? s[0].toUpperCase() : "";
                  const nxt=local.slice(); nxt[i]=x; setLocal(nxt);
                }} style={inpStyle} maxLength={2}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex", gap:8, marginTop:10}}>
            <Button onClick={apply}>Appliquer</Button>
            <Button onClick={()=>setLocal(["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"])}>Grec par défaut</Button>
          </div>
        </div>
      );
    }

    function DebugPanel(){
      return (
        <div style={panelStyle}>
          <div style={panelHead}>Debug</div>
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            <Button onClick={recenter}>Recentrer modèle</Button>
            <Button onClick={()=>nudge(-0.08,0)}>◀︎</Button>
            <Button onClick={()=>nudge(+0.08,0)}>▶︎</Button>
            <Button onClick={()=>nudge(0,-0.06)}>▲</Button>
            <Button onClick={()=>nudge(0,+0.06)}>▼</Button>
            {orbitRef.current && <div style={{opacity:.7, fontSize:12}}>Astuce: souris pour tourner (OrbitControls).</div>}
          </div>
        </div>
      );
    }

    const panelStyle = {
      position:"absolute", left:12, bottom:86, zIndex:5,
      background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:12, padding:"10px 12px",
      width: "min(92vw, 480px)", color:"#e6f1ff"
    } as any;
    const panelHead = { fontWeight:700, marginBottom:8 } as any;
    const inpStyle  = { width:40, padding:"6px 8px", borderRadius:8, border:"1px solid #2d3b52", background:"#0b1f33", color:"#e6f1ff" } as any;

    // --------------- Rendu JSX ---------------
    const w = wordsRef.current[wordIdx] || wordsRef.current[0];

    return (
      <div ref={wrapRef} style={{position:"relative"}}>
        {/* Canvas 3D */}
        <canvas ref={glRef} width={CANVAS_W} height={CANVAS_H} style={{display:"block", borderRadius:12, background:"transparent"}}/>
        {/* HUD au-dessus (z-index + pointer-events ON) */}
        <canvas ref={hudRef} width={CANVAS_W} height={CANVAS_H}
          style={{position:"absolute", inset:0, pointerEvents:"auto", zIndex:3}}/>

        {/* Barre d’actions (gauche bas) */}
        <div style={{position:"absolute", left:12, bottom:12, display:"flex", gap:8, zIndex:4, alignItems:"center"}}>
          <div>
            <div style={{fontWeight:600, marginBottom:4}}>Mot : {w.gr} ({w.en})</div>
            <div style={{fontSize:12, opacity:.8}}>Indice : {w.hint}</div>
          </div>
        </div>

        {/* Boutons actions (droite bas) */}
        <div style={{position:"absolute", right:12, bottom:12, display:"flex", gap:8, flexWrap:"wrap", zIndex:4}}>
          <Button onClick={resetPath}>Réinitialiser</Button>
          <Button onClick={nextWord}>Mot suivant</Button>
          <Button onClick={()=>setShowLetters(v=>!v)}>Lettres…</Button>
          <Button onClick={()=>setShowDebug(v=>!v)}>Debug…</Button>
        </div>

        {showLetters && <LettersPanel/>}
        {showDebug && <DebugPanel/>}
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel2 = AstragalusLevel2;
})();
