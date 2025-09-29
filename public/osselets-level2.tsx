// @ts-nocheck
// Jeu 2 — Écrire avec les os (24 trous → 24 lettres)
// - No JSX (build-safe sans --jsx)
// - Garde occlusion, chemins, et compat React UMD + Babel in-browser
;(() => {
  const React = (window as any).React;
  const T = (window as any).THREE;

  const GLB = "/assets/games/osselets/level2/3d/astragalus.glb";
  const VIEW_W = 960, VIEW_H = 540, DPR_MAX = 2.5;
  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  async function ensureGLTFLoader() {
    const w = window as any;
    if (!w.THREE) throw new Error("THREE non chargé.");
    if (w.THREE.GLTFLoader) return w.THREE.GLTFLoader;
    if (w.GLTFLoader) { w.THREE.GLTFLoader = w.GLTFLoader; return w.GLTFLoader; }
    const url = "https://unpkg.com/three@0.149.0/examples/js/loaders/GLTFLoader.js";
    try {
      const res = await fetch(url, { mode: "cors", cache: "force-cache" });
      if (!res.ok) throw new Error("fetch GLTFLoader.js failed");
      const code = await res.text();
      const factory = new Function("window","THREE", code + ";return THREE.GLTFLoader || window.GLTFLoader;");
      const Ctor = factory(w, w.THREE);
      if (Ctor) { w.THREE.GLTFLoader = Ctor; return Ctor; }
    } catch {}
    await new Promise<void>((resolve, reject) => {
      if (document.getElementById("__gltfloader_fallback__")) return resolve();
      const s = document.createElement("script");
      s.id = "__gltfloader_fallback__"; s.src = url; s.async = true; s.crossOrigin = "anonymous";
      s.onload = () => resolve(); s.onerror = () => reject(new Error("GLTFLoader non chargé (script)."));
      document.head.appendChild(s);
    });
    const Ctor2 = (w.THREE && w.THREE.GLTFLoader) || w.GLTFLoader;
    if (Ctor2) { w.THREE.GLTFLoader = Ctor2; return Ctor2; }
    throw new Error("GLTFLoader non trouvé.");
  }

  function AstragalusLevel2() {
    const wrapRef = React.useRef(null);
    const glRef   = React.useRef(null);
    const hudRef  = React.useRef(null);

    const rendererRef = React.useRef(null);
    const sceneRef    = React.useRef(null);
    const camRef      = React.useRef(null);
    const modelRef    = React.useRef(null);
    const anchorsRef  = React.useRef([]);
    const rayRef      = React.useRef(null);
    const ctxRef      = React.useRef(null);
    const view        = React.useRef({ w:VIEW_W, h:VIEW_H, dpr:1 });

    const holesRef    = React.useRef([]);
    const rafRef      = React.useRef(0);
    const [ready,setReady] = React.useState(false);

    React.useEffect(()=>{
      const onResize=()=>{
        const w=Math.max(320,(wrapRef.current?.clientWidth ?? VIEW_W)|0);
        const h=Math.round(w*(VIEW_H/VIEW_W));
        const dpr=Math.max(1, Math.min(DPR_MAX, window.devicePixelRatio||1));
        view.current={w,h,dpr};
        const r=rendererRef.current, cv=glRef.current, hud=hudRef.current, cam=camRef.current;
        if(!r||!cv||!hud||!cam) return;
        r.setPixelRatio(dpr); r.setSize(w,h,false);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        cam.aspect=w/h; cam.updateProjectionMatrix();
        hud.width=Math.floor(w*dpr); hud.height=Math.floor(h*dpr);
        hud.style.width=w+"px"; hud.style.height=h+"px";
        const ctx=hud.getContext("2d");
        ctx.setTransform((w*dpr)/VIEW_W,0,0,(h*dpr)/VIEW_H,0,0);
        ctxRef.current=ctx;
      };
      onResize();
      const ro = (window as any).ResizeObserver ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener('resize', onResize);
      return ()=>{ ro?.disconnect(); window.removeEventListener('resize', onResize); };
    },[]);

    React.useEffect(()=>{
      let cancelled=false;
      (async()=>{
        if (!T) return;
        const cv=glRef.current, hud=hudRef.current; if(!cv||!hud) return;

        const GLTF = await ensureGLTFLoader();
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
        loader.load(GLB,(gltf)=>{
          if (cancelled) return;
          const root=gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!root) return;
          root.traverse((o)=>{
            if (o.isMesh){
              if(!o.material || !o.material.isMeshStandardMaterial)
                o.material=new T.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
              o.castShadow=false; o.receiveShadow=false;
            }
          });
          const box=new T.Box3().setFromObject(root);
          const s=1.2/Math.max(...box.getSize(new T.Vector3()).toArray());
          root.scale.setScalar(s);
          box.setFromObject(root);
          root.position.sub(box.getCenter(new T.Vector3()));
          scene.add(root);
          modelRef.current=root;

          const anchors=[];
          root.traverse((n)=>{ const nm=(n.name||"").toLowerCase(); if(/^hole[\s_-]?/.test(nm)) anchors.push(n); });
          anchorsRef.current=(anchors.length>=24?anchors.slice(0,24):anchors);

          setReady(true);
          animate();
        }, undefined, (e)=>console.warn("[L2] GLB load error", e));

        function animate(){
          if (cancelled) return;
          if (modelRef.current) modelRef.current.rotation.y += 0.0038;
          project(); drawHUD();
          renderer.render(scene, cam);
          rafRef.current = requestAnimationFrame(animate);
        }
      })();
      return ()=>{ cancelled=true; cancelAnimationFrame(rafRef.current.current||0); try{ rendererRef.current?.dispose?.(); }catch{} };
    },[]);

    function project(){
      const cam=camRef.current, rc=rayRef.current, model=modelRef.current;
      const anchors=anchorsRef.current||[];
      const {w,h}=view.current;
      if (!cam || !rc) return;

      if (!anchors.length){
        holesRef.current=new Array(24).fill(0).map((_,i)=>{
          const t=(i/24)*Math.PI*2, R=220;
          return { x:VIEW_W/2+Math.cos(t)*R, y:VIEW_H/2+Math.sin(t)*R, label:GREEK[i], hidden:false };
        });
        return;
      }

      const camPos=new T.Vector3(); cam.getWorldPosition(camPos);
      const world=new T.Vector3(), dir=new T.Vector3(), v=new T.Vector3();
      const sx=VIEW_W/w, sy=VIEW_H/h;

      holesRef.current=anchors.map((n,i)=>{
        n.getWorldPosition(world);
        let hidden=false;
        if (model){
          dir.copy(world).sub(camPos).normalize();
          rc.set(camPos,dir);
          const hits=rc.intersectObject(model,true);
          if (hits && hits.length){
            const dHole=camPos.distanceTo(world);
            if (hits[0].distance < dHole - 1e-3) hidden=true;
          }
        }
        v.copy(world).project(cam);
        const px=(v.x*0.5+0.5)*w, py=(-v.y*0.5+0.5)*h;
        return { x:px*sx, y:py*sy, label:GREEK[i]||"", hidden };
      });
    }

    function drawHUD(){
      const ctx=ctxRef.current; if(!ctx) return;
      ctx.clearRect(0,0,VIEW_W,VIEW_H);
      for(const p of holesRef.current){
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

    return React.createElement(
      "div",
      { ref: wrapRef, style:{position:"relative"} },
      React.createElement("canvas", { ref: glRef,  width:VIEW_W, height:VIEW_H, style:{display:"block", borderRadius:12, background:"transparent"} }),
      React.createElement("canvas", { ref: hudRef, width:VIEW_W, height:VIEW_H, style:{position:"absolute", inset:0, pointerEvents:"none"} }),
      !ready && React.createElement("div", { style:{marginTop:8, fontSize:12, color:"#9bb2d4"} }, "Chargement du modèle…")
    );
  }

  (window as any).AstragalusLevel2 = AstragalusLevel2;
})();
