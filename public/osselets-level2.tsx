// Jeu 2 — Écrire avec les os (24 trous → 24 lettres)
// - THREE global (chargé par ta page)
// - GLTFLoader détecté de manière robuste (+ fallback injection si absent)
// - Occlusion réelle : si un mesh masque un trou, le point est pâle et la lettre n’est pas dessinée.

;(() => {
  const { useEffect, useRef, useState } = React;
  const T = (window as any).THREE as typeof THREE;

  const GLB = "/assets/games/osselets/level2/3d/astragalus.glb";
  const W = 960, H = 540, DPR_MAX = 2.5;
  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  async function ensureGLTFLoader(): Promise<any> {
    const win = window as any;
    if (win.THREE?.GLTFLoader) return win.THREE.GLTFLoader;
    if (win.GLTFLoader) return win.GLTFLoader;
    // Fallback : injecte le script des examples (même version que THREE de ta page)
    await new Promise<void>((res,rej)=>{
      const s=document.createElement('script');
      s.src="https://unpkg.com/three@0.149.0/examples/js/loaders/GLTFLoader.js";
      s.onload=()=>res(); s.onerror=()=>rej(new Error("GLTFLoader load error"));
      document.head.appendChild(s);
    });
    return (win.THREE?.GLTFLoader || win.GLTFLoader);
  }

  function L2(){
    const wrapRef = useRef<HTMLDivElement|null>(null);
    const glRef   = useRef<HTMLCanvasElement|null>(null);
    const hudRef  = useRef<HTMLCanvasElement|null>(null);

    const rendererRef = useRef<THREE.WebGLRenderer|null>(null);
    const sceneRef    = useRef<THREE.Scene|null>(null);
    const camRef      = useRef<THREE.PerspectiveCamera|null>(null);
    const modelRef    = useRef<THREE.Object3D|null>(null);
    const anchorsRef  = useRef<THREE.Object3D[]>([]);
    const rayRef      = useRef<THREE.Raycaster|null>(null);
    const ctxRef      = useRef<CanvasRenderingContext2D|null>(null);
    const view        = useRef({ w:W, h:H, dpr:1 });

    const holes = useRef<{x:number;y:number;label:string;hidden:boolean}[]>([]);
    const [ready,setReady] = useState(false);

    // Resize
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

    // Init 3D
    useEffect(()=>{
      let cancelled=false;
      (async()=>{
        const cv=glRef.current!, hud=hudRef.current!;
        if(!cv||!hud||!T) return;

        const renderer=new T.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
        renderer.outputColorSpace=T.SRGBColorSpace;
        renderer.setPixelRatio(view.current.dpr);
        renderer.setSize(view.current.w, view.current.h,false);
        rendererRef.current=renderer;

        const scene=new T.Scene(); scene.background=null;
        const cam=new T.PerspectiveCamera(45, view.current.w/view.current.h, 0.1, 50);
        cam.position.set(2.0,1.3,2.3); cam.lookAt(0,0.25,0);
        scene.add(new T.AmbientLight(0xffffff,.75));
        const dir=new T.DirectionalLight(0xffffff,.9); dir.position.set(2.4,3.3,2.6); scene.add(dir);
        sceneRef.current=scene; camRef.current=cam;

        rayRef.current=new T.Raycaster(undefined as any, undefined as any, 0.01, 100);

        const GLTFCtor = await ensureGLTFLoader();
        if (typeof GLTFCtor !== "function"){ console.error("[L2] GLTFLoader indisponible."); return; }
        const loader=new (GLTFCtor as any)();

        loader.load(GLB,(gltf:any)=>{
          if (cancelled) return;
          const root=gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!root) return;

          root.traverse((o:any)=>{
            if (o.isMesh){
              if(!o.material || !o.material.isMeshStandardMaterial)
                o.material=new T.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
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

          const anchors:THREE.Object3D[]=[];
          root.traverse((n:any)=>{ const nm=(n.name||"").toLowerCase(); if(/^hole[_\s-]?/.test(nm)) anchors.push(n); });
          anchorsRef.current=anchors.slice(0,24);

          setReady(true);
          animate();
        }, undefined, (e:any)=>console.warn("[L2] GLB load error", e));

        function animate(){
          if (cancelled) return;
          if (modelRef.current) modelRef.current.rotation.y += 0.0038;
          project(); drawHUD();
          renderer.render(scene, cam);
          requestAnimationFrame(animate);
        }
      })();
      return ()=>{ cancelled=true; };
    },[]);

    // Projection + occlusion
    function project(){
      const cam=camRef.current!, rc=rayRef.current!, model=modelRef.current!;
      const anchors=anchorsRef.current||[];
      const {w,h}=view.current;
      if (!cam || !rc || !model) return;

      if (!anchors.length){
        holes.current=new Array(24).fill(0).map((_,i)=>{
          const t=(i/24)*Math.PI*2, R=220;
          return { x:W/2+Math.cos(t)*R, y:H/2+Math.sin(t)*R, label:GREEK[i], hidden:false };
        });
        return;
      }

      const camPos=new T.Vector3(); cam.getWorldPosition(camPos);
      const world=new T.Vector3(), dir=new T.Vector3(), v=new T.Vector3();
      const sx=W/w, sy=H/h;

      holes.current=anchors.map((n,i)=>{
        n.getWorldPosition(world);

        // occlusion : si un hit est avant le trou → hidden
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
        <canvas ref={hudRef} width={W} height={H} style={{position:"absolute", inset:0}}/>
        {!ready && <div style={{marginTop:8, fontSize:12, color:"#9bb2d4"}}>Chargement du modèle…</div>}
      </div>
    );
  }

  // @ts-ignore
  (window as any).AstragalusLevel2 = L2;
})();
