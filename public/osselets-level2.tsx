// Jeu 2 — Écrire avec les os (24 trous → 24 lettres)
// - AUCUN import/ESM. Utilise window.THREE fourni par <script> CDN.
// - Attente robuste du loader (cherche THREE.GLTFLoader et window.GLTFLoader).
// - Fallback : injecte GLTFLoader.js si absent, puis réessaie.
// - Occlusion correcte : raycaster caméra→trou ; si un mesh est avant le trou, la lettre est masquée.

;(() => {
  const { useEffect, useRef, useState } = React;
  const T = (window as any).THREE as any;

  // --- Constantes / assets (garde tes chemins) ---
  const GLB = "/assets/games/osselets/level2/3d/astragalus.glb";
  const W = 960, H = 540, DPR_MAX = 2.5;
  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  // --- utilitaires loader (tolérant + fallback d’injection) ---
  function injectScriptOnce(src: string, id: string) {
    return new Promise<void>((resolve, reject) => {
      if (document.getElementById(id)) return resolve();
      const s = document.createElement("script");
      s.id = id; s.src = src; s.async = true; s.crossOrigin = "anonymous";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("GLTFLoader load error"));
      document.head.appendChild(s);
    });
  }

  async function ensureGLTFLoader(): Promise<any> {
    const w = window as any;
    const THREE = w.THREE;
    // 1) déjà présent ?
    let Ctor = THREE?.GLTFLoader || w.GLTFLoader;
    if (typeof Ctor === "function") {
      if (THREE && !THREE.GLTFLoader) THREE.GLTFLoader = Ctor;
      return Ctor;
    }
    // 2) fallback : injecter le script examples/js (même version que ta page)
    const url = "https://unpkg.com/three@0.149.0/examples/js/loaders/GLTFLoader.js";
    await injectScriptOnce(url, "__gltfloader_fallback__");
    // 3) re-check
    Ctor = (w.THREE?.GLTFLoader) || w.GLTFLoader;
    if (typeof Ctor === "function") {
      if (THREE && !THREE.GLTFLoader) THREE.GLTFLoader = Ctor;
      return Ctor;
    }
    throw new Error("GLTFLoader introuvable après injection (vérifie le réseau/CSP).");
  }

  function AstragalusLevel2() {
    const wrapRef = useRef<HTMLDivElement|null>(null);
    const glRef   = useRef<HTMLCanvasElement|null>(null);
    const hudRef  = useRef<HTMLCanvasElement|null>(null);

    const rendererRef = useRef<any>(null);
    const sceneRef    = useRef<any>(null);
    const camRef      = useRef<any>(null);
    const modelRef    = useRef<any>(null);
    const anchorsRef  = useRef<any[]>([]);
    const rayRef      = useRef<any>(null);
    const ctxRef      = useRef<CanvasRenderingContext2D|null>(null);
    const view        = useRef({ w:W, h:H, dpr:1 });

    const holes = useRef<{x:number;y:number;label:string;hidden:boolean}[]>([]);
    const rafRef = useRef<number>(0);
    const [ready,setReady] = useState(false);

    // --- Resize / DPR ---
    useEffect(()=>{
      const onResize=()=>{
        const w=Math.max(320,(wrapRef.current?.clientWidth ?? W)|0);
        const h=Math.round(w*(H/W));
        const dpr=Math.max(1, Math.min(DPR_MAX, window.devicePixelRatio||1));
        view.current={w,h,dpr};

        const r=rendererRef.current, cv=glRef.current, hud=hudRef.current, cam=camRef.current;
        if(!r||!cv||!hud||!cam) return;

        r.setPixelRatio(dpr); r.setSize(w,h,false);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        cam.aspect=w/h; cam.updateProjectionMatrix();

        hud.width=Math.floor(w*dpr); hud.height=Math.floor(h*dpr);
        hud.style.width=w+"px"; hud.style.height=h+"px";
        const ctx=hud.getContext("2d")!;
        ctx.setTransform((w*dpr)/W,0,0,(h*dpr)/H,0,0);
        ctxRef.current=ctx;
      };
      onResize();
      const ro = (window as any).ResizeObserver ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener('resize', onResize);
      return ()=>{ ro?.disconnect(); window.removeEventListener('resize', onResize); };
    },[]);

    // --- Init 3D & modèle ---
    useEffect(()=>{
      let cancelled=false;
      (async()=>{
        if (!T) { console.warn("[L2] THREE absent"); return; }
        const cv=glRef.current!, hud=hudRef.current!;
        if(!cv||!hud) return;

        const GLTF = await ensureGLTFLoader(); // ← robuste
        const renderer=new T.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
        if ("outputColorSpace" in renderer) renderer.outputColorSpace=T.SRGBColorSpace;
        else renderer.outputEncoding = T.sRGBEncoding;
        renderer.setPixelRatio(view.current.dpr);
        renderer.setSize(view.current.w, view.current.h,false);
        rendererRef.current=renderer;

        const scene=new T.Scene(); scene.background=null;
        const cam=new T.PerspectiveCamera(45, view.current.w/view.current.h, 0.1, 50);
        cam.position.set(2.0,1.3,2.3); cam.lookAt(0,0.25,0);
        scene.add(new T.AmbientLight(0xffffff,.75));
        const dir=new T.DirectionalLight(0xffffff,.9); dir.position.set(2.4,3.3,2.6); scene.add(dir);
        sceneRef.current=scene; camRef.current=cam;

        rayRef.current=new T.Raycaster(undefined, undefined, 0.01, 100);

        const loader = new GLTF();
        loader.load(GLB,(gltf:any)=>{
          if (cancelled) return;
          const root=gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!root) return;

          root.traverse((o:any)=>{
            if (o.isMesh){
              if(!o.material || !o.material.isMeshStandardMaterial)
                o.material=new T.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
              o.castShadow=false; o.receiveShadow=false;
            }
          });

          // scale & center
          const box=new T.Box3().setFromObject(root);
          const s=1.2/Math.max(...box.getSize(new T.Vector3()).toArray());
          root.scale.setScalar(s);
          box.setFromObject(root);
          root.position.sub(box.getCenter(new T.Vector3()));

          scene.add(root);
          modelRef.current=root;

          // 24 "Hole_*" si disponibles
          const anchors:any[]=[];
          root.traverse((n:any)=>{ const nm=(n.name||"").toLowerCase(); if(/^hole[\s_-]?/.test(nm)) anchors.push(n); });
          anchorsRef.current=(anchors.length>=24?anchors.slice(0,24):anchors);

          setReady(true);
          animate();
        }, undefined, (e:any)=>console.warn("[L2] GLB load error", e));

        function animate(){
          if (cancelled) return;
          if (modelRef.current) modelRef.current.rotation.y += 0.0038;
          project(); drawHUD();
          renderer.render(scene, cam);
          rafRef.current = requestAnimationFrame(animate);
        }
      })();

      return ()=>{
        cancelled=true;
        cancelAnimationFrame(rafRef.current);
        try { rendererRef.current?.dispose?.(); } catch {}
      };
    },[]);

    // --- Projection écran + Occlusion ---
    function project(){
      const cam=camRef.current, rc=rayRef.current, model=modelRef.current;
      const anchors=anchorsRef.current||[];
      const {w,h}=view.current;
      if (!cam || !rc || !model) return;

      if (!anchors.length){
        // fallback : cercle régulier
        holes.current=new Array(24).fill(0).map((_,i)=>{
          const t=(i/24)*Math.PI*2, R=220;
          return { x:W/2+Math.cos(t)*R, y:H/2+Math.sin(t)*R, label:GREEK[i], hidden:false };
        });
        return;
      }

      const camPos=new T.Vector3(); cam.getWorldPosition(camPos);
      const world=new T.Vector3(), dir=new T.Vector3(), v=new T.Vector3();
      const sx=W/w, sy=H/h;

      holes.current=anchors.map((n:any,i:number)=>{
        n.getWorldPosition(world);

        // occlusion : 1er hit avant le trou -> caché
        let hidden=false;
        dir.copy(world).sub(camPos).normalize();
        rc.set(camPos,dir);
        const hits=rc.intersectObject(model,true);
        if (hits && hits.length){
          const dHole=camPos.distanceTo(world);
          if (hits[0].distance < dHole - 1e-3) hidden=true;
        }

        v.copy(world).project(cam);
        const px=(v.x*0.5+0.5)*w, py=(-v.y*0.5+0.5)*h;
        return { x:px*sx, y:py*sy, label:GREEK[i]||"", hidden };
      });
    }

    function drawHUD(){
      const ctx=ctxRef.current; if(!ctx) return;
      ctx.clearRect(0,0,W,H);
      for(const p of holes.current){
        ctx.beginPath();
        ctx.fillStyle = p.hidden ? "rgba(14,165,233,.35)" : "#0ea5e9";
        ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill();
        if(!p.hidden && p.label){
          ctx.fillStyle="#e6f1ff"; ctx.font="12px ui-sans-serif, system-ui";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(p.label,p.x,p.y);
        }
      }
    }

    return (
      <div ref={wrapRef} style={{position:"relative"}}>
        <canvas ref={glRef}  width={W} height={H} style={{display:"block", borderRadius:12, background:"transparent"}}/>
        <canvas ref={hudRef} width={W} height={H} style={{position:"absolute", inset:0, pointerEvents:"none"}}/>
        {!ready && <div style={{marginTop:8, fontSize:12, color:"#9bb2d4"}}>Chargement du modèle…</div>}
      </div>
    );
  }

  (window as any).AstragalusLevel2 = AstragalusLevel2;
})();
