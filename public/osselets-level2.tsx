// public/osselets-level2.tsx
// LEVEL 2 — « Écrire avec les os » (24 trous / 4 faces opposées)
// ✅ Zéro “double import”, pas d’injection <script>, un seul loader ESM (pinné).
// ✅ Compatible Babel in-browser : tout est encapsulé dans un IIFE et on utilise import() dynamique.
// ✅ Charge /assets/games/osselets/level2/3d/astragalus.glb, lit les nœuds Hole_* (24 ancres).
// ✅ Fallback cercle si modèle/ancres absents. Boutons : Réinitialiser / Mot suivant.

;(() => {
  const { useEffect, useRef, useState } = React;

  /* -------------------- Chemins & constantes -------------------- */
  const BASE     = "/assets/games/osselets/level2/";
  const MODEL    = BASE + "3d/astragalus.glb";     // votre modèle trous
  const WORDS_JS = BASE + "3d/letters.json";       // optionnel

  const CANVAS_W = 960, CANVAS_H = 540, DPR_MAX = 2.5;

  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  // ESM pins (une seule version → pas de “multiple instances”)
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;

  // Cache global (évite re-import si L3 l’a déjà fait)
  async function ensureThreeOnce(){
    if ((window as any).__LxThree) return (window as any).__LxThree;
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    const out = { THREE, GLTFLoader };
    (window as any).__LxThree = out;
    return out;
  }

  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  function AstragalusLevel2(){
    const wrapRef    = useRef(null);
    const glRef      = useRef(null);
    const hudRef     = useRef(null);
    const ctxRef     = useRef(null);

    const rendererRef= useRef(null);
    const sceneRef   = useRef(null);
    const cameraRef  = useRef(null);
    const modelRef   = useRef(null);
    const anchorsRef = useRef([]);

    const THREEref   = useRef(null);

    const holes      = useRef([]);   // [{x,y,label,index}]
    const current    = useRef([]);   // indices sélectionnés

    const viewSize   = useRef({ w:CANVAS_W, h:CANVAS_H, dpr:1 });

    const [ready,setReady] = useState(false);
    const [msg,setMsg]     = useState("24 trous (6 par face) reliés aux 24 lettres grecques. Suis le fil pour épeler un mot.");
    const [wordIdx,setWordIdx] = useState(0);
    const WORDS = useRef([
      { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
      { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
      { gr:"ΜΑΤΙ",  en:"MATI",  hint:"« Mauvais œil » — apotropaïon." }
    ]);

    /* ---------- Resize ---------- */
    useEffect(()=>{
      function onResize(){
        const wrap=wrapRef.current, cv=glRef.current, hud=hudRef.current, renderer=rendererRef.current, cam=cameraRef.current;
        if (!wrap || !cv || !hud) return;
        const w=Math.max(320, wrap.clientWidth|0);
        const h=Math.round(w*(CANVAS_H/CANVAS_W));
        const dpr=clamp(window.devicePixelRatio||1,1,DPR_MAX);
        viewSize.current={w,h,dpr};

        if (renderer){ renderer.setPixelRatio(dpr); renderer.setSize(w,h,false); cv.style.width=w+"px"; cv.style.height=h+"px"; }
        if (cam){ cam.aspect=w/h; cam.updateProjectionMatrix(); }

        hud.width=Math.floor(w*dpr); hud.height=Math.floor(h*dpr);
        hud.style.width=w+"px"; hud.style.height=h+"px";
        const ctx=hud.getContext("2d");
        ctx.setTransform((w*dpr)/CANVAS_W,0,0,(h*dpr)/CANVAS_H,0,0);
        ctxRef.current=ctx;
      }
      onResize();
      const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener("resize", onResize);
      return ()=>{ if(ro) ro.disconnect(); window.removeEventListener("resize", onResize); };
    },[]);

    /* ---------- Init (Three + modèle) ---------- */
    useEffect(()=>{
      let canceled=false;
      (async ()=>{
        let libs=null;
        try { libs = await ensureThreeOnce(); }
        catch (e){ console.error("[L2] Échec import ESM three:", e); setMsg("Impossible de charger Three.js."); return; }
        const { THREE } = libs; THREEref.current = THREE;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ canvas:glRef.current, antialias:true, alpha:true });
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        rendererRef.current  = renderer;

        // Scene / Camera
        const scene = new THREE.Scene(); scene.background = null;
        const cam = new THREE.PerspectiveCamera(45,16/9,0.1,50);
        cam.position.set(2.0,1.3,2.3); cam.lookAt(0,0.25,0);
        scene.add(new THREE.AmbientLight(0xffffff,.7));
        const dir = new THREE.DirectionalLight(0xffffff,.9); dir.position.set(2.4,3.3,2.6); scene.add(dir);

        sceneRef.current=scene; cameraRef.current=cam;

        const cfg = await fetchJSON(WORDS_JS);
        if (cfg?.words?.length) WORDS.current = cfg.words.slice(0,6);

        // Modèle
        const { GLTFLoader } = libs;
        const loader = new GLTFLoader();
        loader.load(MODEL, (gltf)=>{
          if (canceled) return;
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root){ setMsg("Modèle vide."); return; }

          // matériaux standards (compat WebGLRenderer courant)
          root.traverse((o)=>{
            if (o.isMesh){
              if (!o.material || !o.material.isMeshStandardMaterial)
                o.material = new THREE.MeshStandardMaterial({ color:0xf7efe7, roughness:.6, metalness:.05 });
            }
          });

          // normalisation
          const box=new THREE.Box3().setFromObject(root);
          const s = 1.2/Math.max(...box.getSize(new THREE.Vector3()).toArray());
          root.scale.setScalar(s);
          box.setFromObject(root);
          root.position.sub(box.getCenter(new THREE.Vector3()));

          scene.add(root);
          modelRef.current=root;

          // collecter les 24 ancres : Hole_*
          const anchors=[];
          root.traverse((n)=>{ if(/^hole[_\s-]?/i.test(n.name||"")) anchors.push(n); });
          anchorsRef.current = anchors;

          setReady(true);
          animate();
        }, undefined, (err)=>{ console.error("[L2] GLB load error:", err); setMsg("Échec chargement du modèle."); fallbackIfNeeded(); });

        function animate(){
          if (canceled) return;
          if (modelRef.current) modelRef.current.rotation.y += 0.0038;
          projectHoles();
          renderer.render(scene,cameraRef.current);
          drawHUD();
          requestAnimationFrame(animate);
        }
      })();
      return ()=>{ canceled=true; };
    },[]);

    /* ---------- Projection des trous ---------- */
    function projectHoles(){
      const THREE=THREEref.current, cam=cameraRef.current;
      if (!THREE || !cam) return;
      const anchors=anchorsRef.current||[], v=new THREE.Vector3();
      if (anchors.length===24){
        const {w,h}=viewSize.current, sx=CANVAS_W/w, sy=CANVAS_H/h;
        holes.current = anchors.map((n,i)=>{
          n.getWorldPosition(v); v.project(cam);
          const px=(v.x*0.5+0.5)*w, py=(-v.y*0.5+0.5)*h;
          return { x:px*sx, y:py*sy, label:GREEK[i], index:i };
        });
      } else if (holes.current.length!==24){
        fallbackIfNeeded();
      }
    }
    function fallbackIfNeeded(){
      const cx=CANVAS_W/2, cy=CANVAS_H/2, R=Math.min(CANVAS_W,CANVAS_H)*0.38;
      holes.current = Array(24).fill(0).map((_,i)=>{
        const a=(i/24)*Math.PI*2 - Math.PI/2;
        return { x:cx+Math.cos(a)*R, y:cy+Math.sin(a)*R, label:GREEK[i], index:i };
      });
    }

    /* ---------- HUD ---------- */
    function drawHUD(){
      const ctx=ctxRef.current; if(!ctx) return;
      ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

      // fil
      ctx.strokeStyle="#60a5fa"; ctx.lineWidth=2;
      if (current.current.length>1){
        ctx.beginPath();
        const p0=holes.current[current.current[0]]; if (p0) ctx.moveTo(p0.x,p0.y);
        for (let k=1;k<current.current.length;k++){ const p=holes.current[current.current[k]]; if(p) ctx.lineTo(p.x,p.y); }
        ctx.stroke();
      }

      // points + lettres
      for(const p of holes.current){
        ctx.beginPath(); ctx.fillStyle="#0ea5e9"; ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#e6f1ff"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(p.label,p.x,p.y);
      }

      // pied
      const w=WORDS.current[wordIdx]||WORDS.current[0];
      ctx.fillStyle="#e6f1ff"; ctx.font="16px ui-sans-serif, system-ui"; ctx.textAlign="start"; ctx.textBaseline="alphabetic";
      ctx.fillText("Mot : "+w.gr+" ("+w.en+")", 16, CANVAS_H-40);
      ctx.fillStyle="#9cc0ff"; ctx.font="12px ui-sans-serif, system-ui";
      ctx.fillText("Indice : "+w.hint, 16, CANVAS_H-18);
    }

    /* ---------- Clics ---------- */
    useEffect(()=>{
      function onClick(e){
        const hud=hudRef.current; if(!hud) return;
        const r=hud.getBoundingClientRect(), {w,h}=viewSize.current;
        const px=(e.clientX-r.left)*(w/r.width), py=(e.clientY-r.top)*(h/r.height);
        const x=px*(CANVAS_W/w), y=py*(CANVAS_H/h);
        let best=-1,bd=24;
        for(let i=0;i<holes.current.length;i++){ const p=holes.current[i]; const d=Math.hypot(p.x-x,p.y-y); if(d<bd){bd=d; best=i;} }
        if (best>=0 && bd<24) current.current.push(best);
      }
      const hud=hudRef.current; if (hud) hud.addEventListener("click",onClick);
      return ()=>{ if(hud) hud.removeEventListener("click",onClick); };
    },[]);

    function reset(){ current.current.length=0; setMsg("Réinitialisé. Clique les points."); }
    function nextWord(){ current.current.length=0; setWordIdx((i)=> (i+1)%((WORDS.current?.length)||1)); }

    /* ---------- UI ---------- */
    return (
      <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#061426,#0b1f33)", color:"#e6f1ff"}}>
        <div className="max-w-5xl mx-auto" style={{padding:"16px"}}>
          <h1 className="text-xl sm:text-2xl" style={{fontWeight:700, marginBottom:6}}>Écrire avec les os — Fil & alphabet</h1>
          <p style={{color:"#cfe2ff", margin:"0 0 10px"}}>{msg}</p>

          <div ref={wrapRef} style={{position:"relative", border:"1px solid #ffffff22", borderRadius:12, overflow:"hidden", background:"#04121f"}}>
            <canvas ref={glRef} />
            <canvas ref={hudRef} style={{position:"absolute", inset:0, pointerEvents:"auto"}} />

            {!ready && (
              <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center", background:"rgba(0,0,0,.35)"}}>
                <div style={{background:"#0b2237", border:"1px solid #ffffff22", borderRadius:10, padding:"10px 12px"}}>
                  Chargement du modèle 3D (trous)…
                </div>
              </div>
            )}
          </div>

          <div style={{display:"flex", gap:8, marginTop:10}}>
            <button onClick={reset}    style={{border:"1px solid #ffffff33", background:"#0b1f33", color:"#e6f1ff", padding:"8px 12px", borderRadius:10}}>Réinitialiser</button>
            <button onClick={nextWord} style={{border:"1px solid #ffffff33", background:"#0b1f33", color:"#e6f1ff", padding:"8px 12px", borderRadius:10}}>Mot suivant</button>
          </div>

          <div style={{fontSize:12, color:"#9cc0ff", marginTop:8}}>
            Modèle : <code>level2/3d/astragalus.glb</code> — nœuds <code>Hole_…</code> (24). Fallback cercle si absent.
          </div>
        </div>
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel2 = AstragalusLevel2;
})();
