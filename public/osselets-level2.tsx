// Jeu 2 — Écrire avec les os (24 trous → 24 lettres)
// Setup : Three global (UMD) + Babel in-browser (pas de bundler)
// Points clés :
//  - Chargement GLTFLoader robuste (global → fetch+eval → <script> injection)
//  - Occlusion réelle : raycaster caméra→trou ; si un mesh est avant, lettre masquée
//  - Aucune dépendance ESM (pas d'import), pas de redéclaration de THREE

;(() => {
  const { useEffect, useRef, useState } = React as any;
  const T: any = (window as any).THREE;

  // === Assets & const ===
  const GLB = "/assets/games/osselets/level2/3d/astragalus.glb";
  const VIEW_W = 960, VIEW_H = 540, DPR_MAX = 2.5;
  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  // === GLTFLoader robust loader ===
  async function ensureGLTFLoader(): Promise<any> {
    const w = window as any;
    if (!w.THREE) throw new Error("THREE non chargé.");
    if (w.THREE.GLTFLoader) return w.THREE.GLTFLoader;
    if (w.GLTFLoader) { w.THREE.GLTFLoader = w.GLTFLoader; return w.GLTFLoader; }

    const url = "https://unpkg.com/three@0.149.0/examples/js/loaders/GLTFLoader.js";

    // 1) fetch + eval (garantit même global que THREE)
    try {
      const res = await fetch(url, { mode: "cors", cache: "force-cache" });
      if (!res.ok) throw new Error("fetch GLTFLoader.js failed");
      const code = await res.text();
      // évalue dans le global courant (Babel utilise déjà eval → CSP probable OK)
      const factory = new Function("window","THREE", code + ";return THREE.GLTFLoader || window.GLTFLoader;");
      const Ctor = factory(w, w.THREE);
      if (Ctor) { w.THREE.GLTFLoader = Ctor; return Ctor; }
    } catch (e) {
      console.warn("[L2] fetch+eval GLTFLoader a échoué, fallback <script>…", e);
    }

    // 2) fallback <script> (au cas où CSP interdit eval)
    await new Promise<void>((resolve, reject) => {
      if (document.getElementById("__gltfloader_fallback__")) return resolve();
      const s = document.createElement("script");
      s.id = "__gltfloader_fallback__";
      s.src = url; s.async = true; s.crossOrigin = "anonymous";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("GLTFLoader non chargé (script)."));
      document.head.appendChild(s);
    });

    const Ctor2 = (w.THREE && w.THREE.GLTFLoader) || w.GLTFLoader;
    if (Ctor2) { w.THREE.GLTFLoader = Ctor2; return Ctor2; }
    throw new Error("GLTFLoader non trouvé (ni window.THREE.GLTFLoader ni window.GLTFLoader).");
  }

  function AstragalusLevel2(){
    // DOM
    const wrapRef = useRef<HTMLDivElement|null>(null);
    const glRef   = useRef<HTMLCanvasElement|null>(null);
    const hudRef  = useRef<HTMLCanvasElement|null>(null);

    // 3D
    const rendererRef = useRef<any>(null);
    const sceneRef    = useRef<any>(null);
    const camRef      = useRef<any>(null);
    const modelRef    = useRef<any>(null);
    const anchorsRef  = useRef<any[]>([]);
    const rayRef      = useRef<any>(null);

    // HUD
    const ctxRef      = useRef<CanvasRenderingContext2D|null>(null);
    const holes       = useRef<{x:number;y:number;label:string;hidden:boolean}[]>([]);
    const view        = useRef({ w:VIEW_W, h:VIEW_H, dpr:1 });

    const rafRef      = useRef<number>(0);
    const [ready,setReady] = useState(false);

    // Resize
    useEffect(()=>{
      const onResize=()=>{
        const w = Math.max(320, (wrapRef.current?.clientWidth ?? VIEW_W)|0);
        const h = Math.round(w*(VIEW_H/VIEW_W));
        const dpr = Math.max(1, Math.min(DPR_MAX, window.devicePixelRatio||1));
        view.current = { w, h, dpr };

        const r=rendererRef.current, cv=glRef.current, hud=hudRef.current, cam=camRef.current;
        if (!r||!cv||!hud||!cam) return;
        r.setPixelRatio(dpr); r.setSize(w,h,false);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        cam.aspect=w/h; cam.updateProjectionMatrix();

        hud.width = Math.floor(w*dpr); hud.height = Math.floor(h*dpr);
        hud.style.width=w+"px"; hud.style.height=h+"px";
        const ctx = hud.getContext("2d")!;
        // transformer le HUD pour un canvas logique 960x540 (confort du dessin)
        ctx.setTransform((w*dpr)/VIEW_W, 0, 0, (h*dpr)/VIEW_H, 0, 0);
        ctxRef.current = ctx;
      };
      onResize();
      const ro = (window as any).ResizeObserver ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener("resize", onResize);
      return ()=>{ ro?.disconnect(); window.removeEventListener("resize", onResize); };
    },[]);

    // Init 3D
    useEffect(()=>{
      let cancelled=false;
      (async()=>{
        if (!T) { console.warn("[L2] THREE absent"); return; }
        const canvas = glRef.current!, hud = hudRef.current!;
        if (!canvas || !hud) return;

        const GLTF = await ensureGLTFLoader();
        const renderer = new T.WebGLRenderer({ canvas, antialias:true, alpha:true });
        if ("outputColorSpace" in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
        else renderer.outputEncoding = T.sRGBEncoding;
        renderer.setPixelRatio(view.current.dpr);
        renderer.setSize(view.current.w, view.current.h, false);
        rendererRef.current = renderer;

        const scene = new T.Scene(); scene.background=null;
        const cam = new T.PerspectiveCamera(45, view.current.w/view.current.h, 0.1, 50);
        cam.position.set(2.0,1.3,2.3); cam.lookAt(0,0.25,0);
        scene.add(new T.AmbientLight(0xffffff,.75));
        const dir = new T.DirectionalLight(0xffffff,.9); dir.position.set(2.4,3.3,2.6); scene.add(dir);

        sceneRef.current = scene; camRef.current = cam;
        rayRef.current = new T.Raycaster(undefined, undefined, 0.01, 100);

        // Charge le modèle
        const loader = new GLTF();
        loader.load(GLB, (gltf:any)=>{
          if (cancelled) return;
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!root) return;

          // Matériaux par défaut
          root.traverse((o:any)=>{
            if (o.isMesh){
              if(!o.material || !o.material.isMeshStandardMaterial)
                o.material = new T.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
              o.castShadow=false; o.receiveShadow=false;
            }
          });

          // scale & center
          const box = new T.Box3().setFromObject(root);
          const s = 1.2/Math.max(...box.getSize(new T.Vector3()).toArray());
          root.scale.setScalar(s);
          box.setFromObject(root);
          root.position.sub(box.getCenter(new T.Vector3()));

          scene.add(root);
          modelRef.current = root;

          // Récupération des ancres "Hole_*"
          const anchors:any[]=[];
          root.traverse((n:any)=>{ const nm=(n.name||"").toLowerCase(); if(/^hole[\s_-]?/.test(nm)) anchors.push(n); });
          anchorsRef.current = (anchors.length>=24?anchors.slice(0,24):anchors);

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

      return ()=>{ cancelled=true; cancelAnimationFrame(rafRef.current); try{ rendererRef.current?.dispose?.(); }catch{} };
    },[]);

    // Projection écran + occlusion
    function project(){
      const cam=camRef.current, rc=rayRef.current, model=modelRef.current;
      const anchors=anchorsRef.current||[];
      const {w,h} = view.current;
      if (!cam || !rc) return;

      // fallback simple si pas d’ancres : 24 points en cercle
      if (!anchors.length){
        holes.current=new Array(24).fill(0).map((_,i)=>{
          const t=(i/24)*Math.PI*2, R=220;
          return { x:VIEW_W/2+Math.cos(t)*R, y:VIEW_H/2+Math.sin(t)*R, label:GREEK[i], hidden:false };
        });
        return;
      }

      const camPos=new T.Vector3(); cam.getWorldPosition(camPos);
      const world=new T.Vector3(), dir=new T.Vector3(), v=new T.Vector3();
      const sx=VIEW_W/w, sy=VIEW_H/h;

      holes.current = anchors.map((n:any,i:number)=>{
        n.getWorldPosition(world);

        // Occlusion : premier hit avant le trou => caché
        let hidden=false;
        if (model){
          dir.copy(world).sub(camPos).normalize();
          rc.set(camPos,dir);
          const hits = rc.intersectObject(model,true);
          if (hits && hits.length){
            const dHole = camPos.distanceTo(world);
            if (hits[0].distance < dHole - 1e-3) hidden = true;
          }
        }

        // Projection
        v.copy(world).project(cam);
        const px=(v.x*0.5+0.5)*w, py=(-v.y*0.5+0.5)*h;
        return { x:px*sx, y:py*sy, label:GREEK[i]||"", hidden };
      });
    }

    function drawHUD(){
      const ctx = ctxRef.current; if(!ctx) return;
      ctx.clearRect(0,0,VIEW_W,VIEW_H);
      for(const p of holes.current){
        // cercle
        ctx.beginPath();
        ctx.fillStyle = p.hidden ? "rgba(14,165,233,.35)" : "#0ea5e9";
        ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill();

        // lettre seulement si visible
        if(!p.hidden && p.label){
          ctx.fillStyle="#e6f1ff"; ctx.font="12px ui-sans-serif, system-ui";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(p.label, p.x, p.y);
        }
      }
    }

    return (
      <div ref={wrapRef} style={{position:"relative"}}>
        <canvas ref={glRef}  width={VIEW_W} height={VIEW_H} style={{display:"block", borderRadius:12, background:"transparent"}}/>
        <canvas ref={hudRef} width={VIEW_W} height={VIEW_H} style={{position:"absolute", inset:0, pointerEvents:"none"}}/>
        {!ready && <div style={{marginTop:8, fontSize:12, color:"#9bb2d4"}}>Chargement du modèle…</div>}
      </div>
    );
  }

  (window as any).AstragalusLevel2 = AstragalusLevel2;
})();
