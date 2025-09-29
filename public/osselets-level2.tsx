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

  function AstragalusLevel2(props:{stage?: 'preview' | 'play'}){
    const wrapRef    = useRef(null);
    const glRef      = useRef(null);
    const hudRef     = useRef(null);
    const rendererRef= useRef<any>(null);
    const sceneRef   = useRef<any>(null);
    const cameraRef  = useRef<any>(null);
    const modelRef   = useRef<any>(null);
    const anchorsRef = useRef<any[]>([]);
    const holes      = useRef<any[]>([]);
    const current    = useRef<number[]>([]);
    const viewSize   = useRef({w:CANVAS_W,h:CANVAS_H,dpr:1});
    const ctxRef     = useRef<CanvasRenderingContext2D|null>(null);
    const THREEref   = useRef(null);
    const rayRef     = useRef(null);

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

    /* ---------- Init Three / Modèle ---------- */
    useEffect(()=>{
      let canceled=false;
      (async ()=>{
        const { THREE, GLTFLoader } = await ensureThreeOnce();
        const gl=glRef.current, hud=hudRef.current; if(!gl||!hud) return;

        const renderer = new THREE.WebGLRenderer({canvas:gl, antialias:true, alpha:true});
        renderer.setPixelRatio(viewSize.current.dpr);
        renderer.setSize(viewSize.current.w, viewSize.current.h, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        rendererRef.current=renderer;

        const scene = new THREE.Scene();
        scene.background = null;
        const cam = new THREE.PerspectiveCamera(45,16/9,0.1,50);
        cam.position.set(2.0,1.3,2.3); cam.lookAt(0,0.25,0);
        scene.add(new THREE.AmbientLight(0xffffff,.7));
        const dir = new THREE.DirectionalLight(0xffffff,.9); dir.position.set(2.4,3.3,2.6); scene.add(dir);

        sceneRef.current=scene; cameraRef.current=cam;

        const cfg = await fetchJSON(WORDS_JS);
        if (cfg?.words?.length) WORDS.current = cfg.words.slice(0,6);

        // Modèle
        const { GLTFLoader: GL } = { GLTFLoader };
        const loader = new GL();
        const libs = await ensureThreeOnce(); const { THREE } = libs; THREEref.current = THREE;
        rayRef.current = new THREE.Raycaster(undefined, undefined, 0.01, 100); // raycaster pour occlusion

        loader.load(MODEL, (gltf)=>{
          if (canceled) return;
          const root=gltf.scene || (gltf.scenes && gltf.scenes[0]);
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
          const baseS = 1.2/Math.max(...box.getSize(new THREE.Vector3()).toArray());
          const stage = (props && props.stage) || 'play';
          const scaleMul = stage==='preview' ? 0.45 : 1.0;
          root.scale.setScalar(baseS * scaleMul);
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
        }, undefined, (err)=>{ console.error("[L2] GLB load error", err); setMsg("Échec chargement du modèle."); fallbackIfNeeded(); });

        function animate(){
          let canceled=false;
          (function loop(){
            if (canceled) return;
            if (modelRef.current) modelRef.current.rotation.y += 0.0038;
            projectHoles();
            renderer.render(scene,cameraRef.current);
            drawHUD();
            requestAnimationFrame(loop);
          })();
          return ()=>{ canceled=true; };
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
        const camPos = new THREE.Vector3(); cam.getWorldPosition(camPos);
        const dir    = new THREE.Vector3();
        const world  = new THREE.Vector3();
        const rc     = rayRef.current;
        holes.current = anchors.map((n,i)=>{
          // position monde
          n.getWorldPosition(world);

          // test d’occlusion
          let hidden = false;
          if (rc && modelRef.current){
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
          return { x:px*sx, y:py*sy, label:GREEK[i], index:i, hidden };
        });
      } else if (holes.current.length!==24){
        fallbackIfNeeded();
      }
    }

    function fallbackIfNeeded(){
      if (holes.current.length===24) return;
      // cercle par défaut = 24 points
      holes.current = new Array(24).fill(0).map((_,i)=>{
        const t = (i/24)*Math.PI*2, R=220;
        return { x:CANVAS_W/2+Math.cos(t)*R, y:CANVAS_H/2+Math.sin(t)*R, label:GREEK[i], index:i, hidden:false };
      });
    }

    /* ---------- HUD ---------- */
    function drawHUD(){
      const ctx=ctxRef.current; if(!ctx) return;
      ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
      const stage = (props && props.stage) || 'play';
      if (stage==='preview'){
        // Only a subtle hint in preview, no letters
        ctx.fillStyle="#9cc0ff"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="alphabetic";
        ctx.fillText("Clique à nouveau sur Lancer pour démarrer", CANVAS_W/2, CANVAS_H-22);
        return;
      }

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
        ctx.beginPath();
        ctx.fillStyle = p.hidden ? "rgba(14,165,233,.35)" : "#0ea5e9";
        ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill();
        if (!p.hidden) {
          ctx.fillStyle="#e6f1ff"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(p.label,p.x,p.y);
        }
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
      return ()=>{ if (hud) hud.removeEventListener("click",onClick); };
    },[]);

    function reset(){ current.current = []; }
    function nextWord(){ setWordIdx(i=>(i+1)%WORDS.current.length); reset(); }

    return (
      <div ref={wrapRef} style={{position:"relative"}}>
        <canvas ref={glRef} width={CANVAS_W} height={CANVAS_H} style={{display:"block", borderRadius:12, background:"transparent"}}/>
        <canvas ref={hudRef} width={CANVAS_W} height={CANVAS_H} style={{position:"absolute", inset:0, pointerEvents:"auto"}}/>

        <div style={{display:"flex", gap:8, marginTop:10}}>
          <button onClick={reset} style={{border:"1px solid #2d3b52", background:"#0b1f33", color:"#e6f1ff", padding:"8px 12px", borderRadius:10}}>Réinitialiser</button>
          <button onClick={nextWord} style={{border:"1px solid #2d3b52", background:"#0b1f33", color:"#e6f1ff", padding:"8px 12px", borderRadius:10}}>Mot suivant</button>
        </div>

        <div style={{fontSize:12, color:"#9cc0ff", marginTop:8}}>
          Modèle : <code>level2/3d/astragalus.glb</code> — nœuds <code>Hole_…</code> (24). Fallback cercle si absent.
        </div>
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel2 = AstragalusLevel2;
})();
