// /osselets-level2.tsx
// LEVEL 2 — « Écrire avec les os » (24 trous / 4 faces opposées)
// - AUCUN import ESM ici : on utilise les GLOBALS fournis par ton HTML : window.THREE, window.GLTFLoader, THREE.OrbitControls.
// - Modèle centré/normalisé, occlusion réelle pour cacher les lettres derrière le mesh.
// - Interaction : cliquer les trous → on “file” un mot (Undo/Reset). Panel pour éditer la lettre de chaque trou (persisté en localStorage).
// - Debug panel : bbox/axes/indices/occlusion/autorotate/recenter.

;(() => {
  const { useEffect, useRef, useState } = React;

  /* -------------------- Chemins & constantes -------------------- */
  const BASE       = "/assets/games/osselets/level2/";
  const MODEL      = BASE + "3d/astragalus.glb";      // modèle avec nœuds Hole_*
  const STORAGEKEY = "osseletsL2Letters";

  const CANVAS_W = 960, CANVAS_H = 540, DPR_MAX = 2.5;

  const GREEK_DEFAULT = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  // helpers
  const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

  // “attendre” les globals si nécessaire
  function waitForGlobals(maxTries=40, delay=100): Promise<{THREE:any, GLTFLoader:any, OrbitCtrls:any}>{
    return new Promise((resolve, reject)=>{
      let tries=0;
      const tick=()=>{
        const THREE = (window as any).THREE;
        const GLTFLoader = THREE?.GLTFLoader || (window as any).GLTFLoader;
        const OrbitCtrls = THREE?.OrbitControls;
        if (THREE && GLTFLoader && OrbitCtrls) return resolve({THREE, GLTFLoader, OrbitCtrls});
        tries++;
        if (tries>maxTries) return reject(new Error("Globals THREE/GLTFLoader/OrbitControls introuvables (vérifie l’ordre des <script>)."));
        setTimeout(tick, delay);
      };
      tick();
    });
  }

  function AstragalusLevel2(){
    const wrapRef    = useRef<HTMLDivElement|null>(null);
    const glRef      = useRef<HTMLCanvasElement|null>(null);
    const hudRef     = useRef<HTMLCanvasElement|null>(null);

    const rendererRef= useRef<any>(null);
    const sceneRef   = useRef<any>(null);
    const cameraRef  = useRef<any>(null);
    const controlsRef= useRef<any>(null);

    const modelRef   = useRef<any>(null);
    const anchorsRef = useRef<any[]>([]);
    const holes      = useRef<any[]>([]);
    const current    = useRef<number[]>([]);
    const viewSize   = useRef({w:CANVAS_W,h:CANVAS_H,dpr:1});
    const ctxRef     = useRef<CanvasRenderingContext2D|null>(null);
    const THREEref   = useRef<any>(null);
    const rayRef     = useRef<any>(null);
    const bboxHelper = useRef<any>(null);
    const axesHelper = useRef<any>(null);

    // UI state
    const [ready,setReady] = useState(false);
    const [debugOpen,setDebugOpen] = useState(false);
    const [lettersOpen,setLettersOpen] = useState(false);
    const [letters,setLetters] = useState<string[]>(() => {
      try {
        const saved = localStorage.getItem(STORAGEKEY);
        if (saved){ const arr=JSON.parse(saved); if (Array.isArray(arr) && arr.length===24) return arr; }
      } catch {}
      return [...GREEK_DEFAULT];
    });
    const [word,setWord] = useState<{gr:string,en:string,hint:string}>({gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage."});

    // Debug toggles
    const dbg = useRef({
      showIndices: false,
      ignoreOcclusion: false,
      showBBox: false,
      showAxes: false,
      autoRotate: false
    });

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
        // scale logique → garde un repère 960x540 pour les calculs
        ctx.setTransform((w*dpr)/CANVAS_W,0,0,(h*dpr)/CANVAS_H,0,0);
        ctxRef.current=ctx;
      }
      onResize();
      const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener("resize", onResize);
      return ()=>{ if(ro) ro.disconnect(); window.removeEventListener("resize", onResize); };
    },[]);

    /* ---------- Init Three / Modèle ---------- */
    useEffect(()=>{
      let canceled=false;
      (async ()=>{
        const { THREE, GLTFLoader, OrbitCtrls } = await waitForGlobals();
        THREEref.current = THREE;

        // renderer
        const cv=glRef.current, hud=hudRef.current; if(!cv||!hud) return;
        const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
        renderer.setPixelRatio(viewSize.current.dpr);
        renderer.setSize(viewSize.current.w, viewSize.current.h, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        rendererRef.current=renderer;

        // scene + camera + controls
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0d2436); // fond sombre
        const cam = new THREE.PerspectiveCamera(45,16/9,0.1,50);
        cam.position.set(2.0,1.3,2.3); cam.lookAt(0,0.25,0);
        scene.add(new THREE.AmbientLight(0xffffff,.7));
        const dir = new THREE.DirectionalLight(0xffffff,.9); dir.position.set(2.4,3.3,2.6); scene.add(dir);
        sceneRef.current=scene; cameraRef.current=cam;

        const ctrls = new OrbitCtrls(cam, cv);
        ctrls.enablePan = false;
        ctrls.enableDamping = true;
        ctrls.dampingFactor = 0.08;
        ctrls.rotateSpeed = 0.7;
        ctrls.minDistance = 1.1;
        ctrls.maxDistance = 4.2;
        controlsRef.current = ctrls;

        // helpers (masqués par défaut)
        axesHelper.current = new THREE.AxesHelper(0.6); axesHelper.current.visible=false; scene.add(axesHelper.current);

        // modèle
        const loader = new (THREE.GLTFLoader || GLTFLoader)();
        loader.load(MODEL, (gltf:any)=>{
          if (canceled) return;
          const root=gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root){ console.warn("[L2] Modèle vide."); return; }

          // matériaux/ombres
          root.traverse((o:any)=>{
            if (o.isMesh){
              if (!o.material || !o.material.isMeshStandardMaterial)
                o.material = new THREE.MeshStandardMaterial({ color:0xf7efe7, roughness:.6, metalness:.05 });
              o.castShadow=false; o.receiveShadow=false;
            }
          });

          // centrage + scale
          const box=new THREE.Box3().setFromObject(root);
          const size=box.getSize(new THREE.Vector3());
          const center=box.getCenter(new THREE.Vector3());
          const targetW = 1.6; // largeur visuelle cible
          const s = targetW / Math.max(size.x, size.y, size.z);
          root.scale.setScalar(s);
          root.position.sub(center.multiplyScalar(s)); // centre à l’origine
          root.position.y -= -0.15; // léger offset visuel

          scene.add(root);
          modelRef.current=root;

          // bbox helper (créé après scale)
          bboxHelper.current = new THREE.Box3Helper(new THREE.Box3().setFromObject(root), 0x3b82f6);
          bboxHelper.current.visible = false;
          scene.add(bboxHelper.current);

          // collecter les 24 ancres : Hole_*
          const anchors:any[]=[];
          root.traverse((n:any)=>{ if(/^hole[_\s-]?\d+/i.test(n.name||"")) anchors.push(n); });
          // fallback si nommage différent : tous “Hole”
          if (anchors.length===0) root.traverse((n:any)=>{ if(/^hole/i.test(n.name||"")) anchors.push(n); });

          // si pas exactement 24, on prendra un fallback cercle en HUD
          anchorsRef.current = anchors;

          // raycaster pour occlusion
          rayRef.current = new THREE.Raycaster(undefined, undefined, 0.01, 100);

          setReady(true);
          animate();
        }, undefined, (err:any)=>{ console.error("[L2] GLB load error", err); });

        function animate(){
          let dead=false;
          (function loop(){
            if (dead) return;
            if (dbg.current.autoRotate && modelRef.current){
              modelRef.current.rotation.y += 0.0035;
            }
            controlsRef.current?.update?.();

            // helpers live update
            if (bboxHelper.current && modelRef.current){
              bboxHelper.current.box.setFromObject(modelRef.current);
              bboxHelper.current.updateMatrixWorld(true);
            }
            axesHelper.current.position.set(0,0,0);

            renderer.render(scene, cameraRef.current);
            projectHoles();
            drawHUD();
            requestAnimationFrame(loop);
          })();
          return ()=>{ dead=true; };
        }
      })();
      return ()=>{ canceled=true; };
    },[]);

    /* ---------- Projection des trous + occlusion ---------- */
    function projectHoles(){
      const THREE=THREEref.current, cam=cameraRef.current;
      if (!THREE || !cam) return;
      const anchors=anchorsRef.current||[], v=new THREE.Vector3();

      // fallback si pas d’ancres → cercle
      if (!anchors.length){
        if (holes.current.length!==24){
          holes.current = new Array(24).fill(0).map((_,i)=>{
            const t = (i/24)*Math.PI*2, R=220;
            return { x:CANVAS_W/2+Math.cos(t)*R, y:CANVAS_H/2+Math.sin(t)*R, label:letters[i]||GREEK_DEFAULT[i], index:i, hidden:false, world:null };
          });
        }
        return;
      }

      const {w,h}=viewSize.current, sx=CANVAS_W/w, sy=CANVAS_H/h;
      const camPos = new THREE.Vector3(); cam.getWorldPosition(camPos);
      const dir    = new THREE.Vector3();
      const world  = new THREE.Vector3();
      const rc     = rayRef.current;

      holes.current = anchors.slice(0,24).map((n:any,i:number)=>{
        // position monde
        n.getWorldPosition(world);

        // test d’occlusion
        let hidden = false;
        if (rc && modelRef.current && !dbg.current.ignoreOcclusion){
          dir.copy(world).sub(camPos).normalize();
          rc.set(camPos, dir);
          const hits = rc.intersectObject(modelRef.current, true);
          if (hits && hits.length){
            const dHole = camPos.distanceTo(world);
            if (hits[0].distance < dHole - 1e-3) hidden = true;
          }
        }

        // projection écran
        v.copy(world).project(cam);
        const px=(v.x*0.5+0.5)*w, py=(-v.y*0.5+0.5)*h;
        return { x:px*sx, y:py*sy, label:(letters[i]||GREEK_DEFAULT[i]), index:i, hidden, world:world.clone() };
      });
    }

    /* ---------- HUD : fil, points, panneaux ---------- */
    function drawHUD(){
      const ctx=ctxRef.current; if(!ctx) return;
      ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

      // fil
      ctx.strokeStyle="#60a5fa"; ctx.lineWidth=2;
      if (current.current.length>1){
        ctx.beginPath();
        const s=current.current[0], p=holes.current[s];
        if(p) ctx.moveTo(p.x,p.y);
        for(let k=1;k<current.current.length;k++){ const p=holes.current[current.current[k]]; if(p) ctx.lineTo(p.x,p.y); }
        ctx.stroke();
      }

      // points + lettres
      for(const p of holes.current){
        if (!p) continue;
        ctx.beginPath();
        const alpha = p.hidden ? 0.35 : 1.0;
        ctx.fillStyle = `rgba(14,165,233,${alpha})`;
        ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill();

        // lettres/indices
        ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
        if (!p.hidden || dbg.current.ignoreOcclusion){
          ctx.fillStyle="#e6f1ff"; 
          ctx.fillText(p.label,p.x,p.y);
        }
        if (dbg.current.showIndices){
          ctx.fillStyle=p.hidden?"#7aa7d1":"#94a3b8";
          ctx.fillText(String(p.index+1), p.x, p.y-16);
        }
      }
    }

    /* ---------- Clics ---------- */
    useEffect(()=>{
      function pickHole(e:MouseEvent){
        const hud=hudRef.current; if(!hud) return;
        const r=hud.getBoundingClientRect(), {w,h}=viewSize.current;
        const px=(e.clientX-r.left)*(w/r.width), py=(e.clientY-r.top)*(h/r.height);
        const x=px*(CANVAS_W/w), y=py*(CANVAS_H/h);
        let best=-1,bd=26;
        for(let i=0;i<holes.current.length;i++){ const p=holes.current[i]; if(!p) continue; const d=Math.hypot(p.x-x,p.y-y); if(d<bd){bd=d; best=i;} }
        if (best>=0 && bd<24){
          current.current.push(best);
        }
      }
      const hud=hudRef.current; if (hud) hud.addEventListener("click",pickHole);
      return ()=>{ if (hud) hud.removeEventListener("click",pickHole); };
    },[]);

    function resetPath(){ current.current = []; }
    function undo(){ current.current.pop(); }

    function saveLetters(next:string[]){
      setLetters(next);
      try { localStorage.setItem(STORAGEKEY, JSON.stringify(next)); } catch {}
    }

    function nudge(dx=0, dy=0){
      if (!modelRef.current) return;
      modelRef.current.rotation.y += dx;
      modelRef.current.rotation.x += dy;
    }

    function recenter(){
      const THREE=THREEref.current; if(!THREE || !modelRef.current) return;
      const root=modelRef.current;
      const box=new THREE.Box3().setFromObject(root);
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      const targetW=1.6;
      const s = targetW / Math.max(size.x, size.y, size.z);
      root.scale.setScalar(s);
      root.position.sub(center.multiplyScalar(s));
      root.position.y -= -0.15;
    }

    /* ---------- UI ---------- */
    const Panel = () => (
      <div style={{position:"absolute", left:16, bottom:16, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
        <div style={{background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:12, padding:"10px 12px"}}>
          <div style={{fontWeight:600, marginBottom:4}}>Mot : {word.gr} ({word.en})</div>
          <div style={{fontSize:12, color:"#9cc0ff"}}>Indice : {word.hint}</div>
          <div style={{display:"flex", gap:8, marginTop:8}}>
            <button className="btn" onClick={resetPath}>Réinitialiser</button>
            <button className="btn" onClick={undo}>Annuler</button>
            <button className="btn" onClick={()=>setLettersOpen(v=>!v)}>{lettersOpen?"Fermer lettres":"Lettres…"}</button>
            <button className="btn" onClick={()=>setDebugOpen(v=>!v)}>{debugOpen?"Fermer debug":"Debug…"}</button>
          </div>
        </div>

        {/* flèches de nudge */}
        <div style={{display:"grid", gridTemplateColumns:"32px 32px 32px", gap:4}}>
          <div />
          <button className="btn" title="↑" onClick={()=>nudge(0,-0.06)}>↑</button>
          <div />
          <button className="btn" title="←" onClick={()=>nudge(-0.08,0)}>←</button>
          <button className="btn" title="•" onClick={()=>{}}>•</button>
          <button className="btn" title="→" onClick={()=>nudge(0.08,0)}>→</button>
          <div />
          <button className="btn" title="↓" onClick={()=>nudge(0,0.06)}>↓</button>
          <div />
        </div>
      </div>
    );

    const LettersPanel = () => (
      <div style={{position:"absolute", right:16, bottom:16, width:280, maxWidth:"95%", background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:12, padding:"10px 12px", display:lettersOpen?"block":"none"}}>
        <div style={{fontWeight:700, marginBottom:6}}>Lettres par trou (1..24)</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, maxHeight:240, overflow:"auto", paddingRight:4}}>
          {new Array(24).fill(0).map((_,i)=>(
            <div key={i} style={{display:"flex", alignItems:"center", gap:6}}>
              <span className="badge" style={{minWidth:26, textAlign:"center"}}>{i+1}</span>
              <input
                value={letters[i]||""}
                onChange={e=>{
                  const v=e.target.value.trim().slice(0,2)||"";
                  const next=[...letters]; next[i]=v||GREEK_DEFAULT[i];
                  saveLetters(next);
                }}
                style={{flex:1, background:"#072033", border:"1px solid #1f3247", color:"#e6f1ff", borderRadius:8, padding:"4px 6px"}}
                placeholder={GREEK_DEFAULT[i]}
              />
            </div>
          ))}
        </div>
        <div style={{display:"flex", gap:8, marginTop:8}}>
          <button className="btn" onClick={()=>{ saveLetters([...GREEK_DEFAULT]); }}>Grecs par défaut</button>
          <button className="btn" onClick={()=>{ saveLetters(new Array(24).fill("")); }}>Vider</button>
        </div>
      </div>
    );

    const DebugPanel = () => (
      <div style={{position:"absolute", right:16, top:16, width:280, maxWidth:"95%", background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:12, padding:"10px 12px", display:debugOpen?"block":"none"}}>
        <div style={{fontWeight:700, marginBottom:6}}>Debug</div>
        <label style={{display:"flex", alignItems:"center", gap:8, margin:"6px 0"}}>
          <input type="checkbox" onChange={e=>{ dbg.current.ignoreOcclusion=e.target.checked; }} /> Ignorer l’occlusion
        </label>
        <label style={{display:"flex", alignItems:"center", gap:8, margin:"6px 0"}}>
          <input type="checkbox" onChange={e=>{ dbg.current.showIndices=e.target.checked; }} /> Afficher les indices (1..24)
        </label>
        <label style={{display:"flex", alignItems:"center", gap:8, margin:"6px 0"}}>
          <input type="checkbox" onChange={e=>{ dbg.current.showBBox=e.target.checked; if(bboxHelper.current) bboxHelper.current.visible=e.target.checked; }} /> BBox
        </label>
        <label style={{display:"flex", alignItems:"center", gap:8, margin:"6px 0"}}>
          <input type="checkbox" onChange={e=>{ dbg.current.showAxes=e.target.checked; if(axesHelper.current) axesHelper.current.visible=e.target.checked; }} /> Axes
        </label>
        <label style={{display:"flex", alignItems:"center", gap:8, margin:"6px 0"}}>
          <input type="checkbox" onChange={e=>{ dbg.current.autoRotate=e.target.checked; }} /> Auto-rotation
        </label>
        <div style={{display:"flex", gap:8, marginTop:8}}>
          <button className="btn" onClick={recenter}>Recentrer</button>
          <button className="btn" onClick={resetPath}>Reset fil</button>
        </div>
      </div>
    );

    return (
      <div ref={wrapRef} style={{position:"relative"}}>
        <canvas ref={glRef}  width={CANVAS_W} height={CANVAS_H} style={{display:"block", borderRadius:12, background:"transparent"}}/>
        <canvas ref={hudRef} width={CANVAS_W} height={CANVAS_H} style={{position:"absolute", inset:0, pointerEvents:"auto"}}/>

        <Panel />
        <LettersPanel />
        <DebugPanel />

        <div style={{fontSize:12, color:"#9cc0ff", marginTop:8}}>
          Modèle : <code>level2/3d/astragalus.glb</code> — nœuds <code>Hole_…</code> (24). Occlusion réelle, fil cliquable. Lettres éditables (sauvegarde locale).
        </div>
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel2 = AstragalusLevel2;
})();
