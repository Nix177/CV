// public/osselets-level2.tsx
// LEVEL 2 — « Écrire avec les os » (24 trous / 4 faces opposées)
// - Modèle troué : /assets/games/osselets/level2/3d/astragalus.glb (nœuds Hole_*)
// - Projette les nœuds en 2D (960×540). Fallback cercle si ancres absentes.
// - Chargement Three.js/GLTFLoader via ES Modules (docs officielles) avec import() et ?module.
// - Isolé dans une IIFE pour éviter tout “Identifier ... already been declared”.

;(() => {
  const { useEffect, useRef, useState } = React;

  /* -------------------- Chemins & constantes -------------------- */
  const L2_BASE   = "/assets/games/osselets/level2/";
  const MODEL_URL = L2_BASE + "3d/astragalus.glb";
  const LETTERS_URL = L2_BASE + "3d/letters.json"; // optionnel

  const L2_W = 960, L2_H = 540, DPR_MAX = 2.5;
  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  /* -------------------- Loader Three — ES Modules (docs) -------------------- */
  // https://threejs.org/docs/#examples/en/loaders/GLTFLoader
  // Import dynamique depuis unpkg avec ?module (réécrit les imports “bare”).
  function ensureThreeESM(){
    if (window.__threeESMPromise) return window.__threeESMPromise;
    const V = "0.158.0";
    const threeURL  = `https://unpkg.com/three@${V}/build/three.module.js?module`;
    const gltfURL   = `https://unpkg.com/three@${V}/examples/jsm/loaders/GLTFLoader.js?module`;
    window.__threeESMPromise = (async ()=>{
      const THREE = await import(threeURL);
      const { GLTFLoader } = await import(gltfURL);
      return { THREE, GLTFLoader };
    })().catch((e)=>{ console.error("[L2] three esm load fail:", e); return null; });
    return window.__threeESMPromise;
  }

  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  function AstragalusLevel2(){
    const wrapRef = useRef(null);
    const glCanvasRef = useRef(null);
    const hudRef = useRef(null);
    const ctxRef = useRef(null);

    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const modelRef = useRef(null);
    const anchorsRef = useRef([]);

    const THREEref = useRef(null);

    const holes = useRef([]);           // [{x,y,label,index}]
    const currentLine = useRef<number[]>([]);

    const sizeRef = useRef({ w:L2_W, h:L2_H, dpr:1 });

    const [ready,setReady] = useState(false);
    const [msg,setMsg] = useState("24 trous (6 par face) reliés aux 24 lettres grecques. Suis le fil pour épeler un mot.");
    const [wordIdx,setWordIdx] = useState(0);
    const WORDS = useRef([
      { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
      { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
      { gr:"ΜΑΤΙ",  en:"MATI",  hint:"Mauvais œil — apotropaïon." }
    ]);

    /* ---------- Resize ---------- */
    useEffect(()=>{
      function onResize(){
        const wrap=wrapRef.current, glc=glCanvasRef.current, hud=hudRef.current, renderer=rendererRef.current, cam=cameraRef.current;
        if (!wrap || !glc || !hud) return;
        const w=Math.max(320, wrap.clientWidth|0);
        const h=Math.round(w*(L2_H/L2_W));
        const dpr=clamp(window.devicePixelRatio||1,1,DPR_MAX);
        sizeRef.current={w,h,dpr};

        if (renderer){ renderer.setPixelRatio(dpr); renderer.setSize(w,h,false); glc.style.width=w+"px"; glc.style.height=h+"px"; }
        if (cam){ cam.aspect=w/h; cam.updateProjectionMatrix(); }

        hud.width=Math.floor(w*dpr); hud.height=Math.floor(h*dpr);
        hud.style.width=w+"px"; hud.style.height=h+"px";
        const ctx=hud.getContext("2d");
        ctx.setTransform((w*dpr)/L2_W,0,0,(h*dpr)/L2_H,0,0);
        ctxRef.current=ctx;
      }
      onResize();
      const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener("resize", onResize);
      return ()=>{ if(ro) ro.disconnect(); window.removeEventListener("resize", onResize); };
    },[]);

    /* ---------- Init Three + modèle ---------- */
    useEffect(()=>{
      let canceled=false;
      (async ()=>{
        const libs = await ensureThreeESM();
        if (!libs){ setMsg("Impossible de charger Three.js/GLTFLoader."); return; }
        const { THREE, GLTFLoader } = libs;
        THREEref.current = THREE;

        // Renderer
        const glc=glCanvasRef.current;
        const renderer=new THREE.WebGLRenderer({ canvas:glc, antialias:true, alpha:true });
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        rendererRef.current=renderer;

        // Scene / Caméra
        const scene = new THREE.Scene(); scene.background=new THREE.Color(0x0b1220);
        const cam = new THREE.PerspectiveCamera(45,16/9,0.1,50);
        cam.position.set(2.0,1.3,2.3); cam.lookAt(0,0.25,0);
        scene.add(new THREE.AmbientLight(0xffffff,0.55));
        const dir = new THREE.DirectionalLight(0xffffff,0.8); dir.position.set(2.5,3.5,2.5); scene.add(dir);

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(8,4.5), new THREE.MeshBasicMaterial({color:0x071425}));
        floor.rotation.x=-Math.PI/2; floor.position.y=-0.02; scene.add(floor);

        sceneRef.current=scene; cameraRef.current=cam;

        // Config optionnelle
        const cfg = await fetchJSON(LETTERS_URL);
        if (cfg?.words?.length) WORDS.current = cfg.words.slice(0,6);

        // Modèle
        const loader = new GLTFLoader();
        loader.load(MODEL_URL, (gltf)=>{
          if (canceled) return;
          const root = gltf.scene || gltf.scenes?.[0];
          if (!root){ setMsg("Modèle vide."); return; }

          root.traverse(o=>{
            // matériau simple lisible
            if (o.isMesh){
              o.material = new THREE.MeshStandardMaterial({ color:0xf7efe7, roughness:0.6, metalness:0.05 });
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

          // ancres
          const anchors=[];
          root.traverse(n=>{ if(/^Hole_/i.test(n.name)) anchors.push(n); });
          anchorsRef.current = anchors;

          setReady(true);
          loop();
        }, undefined, (err)=>{ console.error("[L2] GLB load error:", err); setMsg("Échec chargement : "+MODEL_URL); });

        function loop(){
          if (canceled) return;
          if (modelRef.current) modelRef.current.rotation.y += 0.0035;
          projectHoles();
          renderer.render(scene,cameraRef.current);
          drawHUD();
          requestAnimationFrame(loop);
        }
      })();

      return ()=>{ canceled=true; };
    },[]);

    /* ---------- Projection trous ---------- */
    function projectHoles(){
      const THREE=THREEref.current; const cam=cameraRef.current;
      if (!THREE || !cam) return;
      const anchors = anchorsRef.current||[];
      const v = new THREE.Vector3();

      if (anchors.length===24){
        const {w,h}=sizeRef.current, sx=L2_W/w, sy=L2_H/h;
        holes.current = anchors.map((n,i)=>{
          n.getWorldPosition(v);
          v.project(cam);
          const px=(v.x*0.5+0.5)*w, py=(-v.y*0.5+0.5)*h;
          return { x:px*sx, y:py*sy, label:GREEK[i], index:i };
        });
      } else if (holes.current.length!==24){
        // Fallback cercle 2D
        const cx=L2_W/2, cy=L2_H/2, R=Math.min(L2_W,L2_H)*0.38;
        holes.current = Array.from({length:24},(_,i)=>{
          const a=(i/24)*Math.PI*2 - Math.PI/2;
          return { x:cx+Math.cos(a)*R, y:cy+Math.sin(a)*R, label:GREEK[i], index:i };
        });
      }
    }

    /* ---------- HUD ---------- */
    function drawHUD(){
      const ctx=ctxRef.current; if(!ctx) return;
      ctx.clearRect(0,0,L2_W,L2_H);
      const g=ctx.createLinearGradient(0,0,0,L2_H); g.addColorStop(0,"#071425"); g.addColorStop(1,"#05111f");
      ctx.fillStyle=g; ctx.fillRect(0,0,L2_W,L2_H);

      // fil
      ctx.strokeStyle="#60a5fa"; ctx.lineWidth=2;
      if (currentLine.current.length>1){
        ctx.beginPath();
        const p0=holes.current[currentLine.current[0]]; ctx.moveTo(p0.x,p0.y);
        for(let k=1;k<currentLine.current.length;k++){ const p=holes.current[currentLine.current[k]]; ctx.lineTo(p.x,p.y); }
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
      ctx.fillText(`Mot : ${w.gr} (${w.en})`, 16, L2_H-40);
      ctx.fillStyle="#9cc0ff"; ctx.font="12px ui-sans-serif, system-ui";
      ctx.fillText(`Indice : ${w.hint}`, 16, L2_H-18);
    }

    /* ---------- Clics ---------- */
    useEffect(()=>{
      function onClick(e){
        const hud=hudRef.current; if(!hud) return;
        const r=hud.getBoundingClientRect();
        const {w,h}=sizeRef.current;
        const cx=(e.clientX-r.left)*(w/r.width), cy=(e.clientY-r.top)*(h/r.height);
        const x=cx*(L2_W/w), y=cy*(L2_H/h);
        let best=-1,bd=24;
        for(let i=0;i<holes.current.length;i++){ const p=holes.current[i]; const d=Math.hypot(p.x-x,p.y-y); if(d<bd){bd=d; best=i;} }
        if (best>=0 && bd<24) currentLine.current.push(best);
      }
      const hud=hudRef.current; hud?.addEventListener("click",onClick);
      return ()=>hud?.removeEventListener("click",onClick);
    },[]);

    function reset(){ currentLine.current.length=0; setMsg("Réinitialisé. Clique les points."); }
    function nextWord(){ currentLine.current.length=0; setWordIdx(i=>(i+1)%(WORDS.current.length||1)); }

    /* ---------- UI ---------- */
    return (
      <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#061426,#0b1f33)", color:"#e6f1ff"}}>
        <div className="max-w-5xl mx-auto" style={{padding:"16px"}}>
          <h1 className="text-xl sm:text-2xl" style={{fontWeight:700, marginBottom:6}}>Écrire avec les os — Fil & alphabet</h1>
          <p style={{color:"#cfe2ff", margin:"0 0 10px"}}>{msg}</p>

          <div ref={wrapRef} style={{position:"relative", border:"1px solid #ffffff22", borderRadius:12, overflow:"hidden", background:"#04121f"}}>
            <canvas ref={glCanvasRef} />
            <canvas ref={hudRef} style={{position:"absolute", inset:0}} />

            {!ready && (
              <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center", background:"rgba(0,0,0,.35)"}}>
                <div style={{background:"#0b2237", border:"1px solid #ffffff22", borderRadius:10, padding:"10px 12px"}}>
                  Chargement du modèle 3D (trous)…
                </div>
              </div>
            )}
          </div>

          <div style={{display:"flex", gap:8, marginTop:10}}>
            <button onClick={reset} style={{border:"1px solid #ffffff33", background:"#0b1f33", color:"#e6f1ff", padding:"8px 12px", borderRadius:10}}>Réinitialiser</button>
            <button onClick={nextWord} style={{border:"1px solid #ffffff33", background:"#0b1f33", color:"#e6f1ff", padding:"8px 12px", borderRadius:10}}>Mot suivant</button>
          </div>

          <div style={{fontSize:12, color:"#9cc0ff", marginTop:8}}>
            Modèle : <code>level2/3d/astragalus.glb</code> (ancres <code>Hole_ventre_01..06</code>, <code>Hole_dos_01..06</code>, <code>Hole_bassin_01..06</code>, <code>Hole_membres_01..06</code>). Fallback cercle si absent.
          </div>
        </div>
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel2 = AstragalusLevel2;
})();
