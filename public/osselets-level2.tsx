// Jeu 2 — Écrire avec les os (24 trous ↔ 24 lettres)
// - Utilise THREE global (inclus par la page) → pas d'import/ESM
// - Masque les lettres si le trou est occlus par le modèle (raycaster)

;(() => {
  const { useEffect, useRef, useState } = React;
  const _THREE = (window as any).THREE;             // <= évite "THREE déjà déclaré"
  const GLTFLoader = (_THREE as any).GLTFLoader;

  const BASE     = "/assets/games/osselets/level2/";
  const MODEL    = BASE + "3d/astragalus.glb";
  const WIDTH    = 960, HEIGHT = 540, DPR_MAX = 2.5;

  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  function AstragalusLevel2() {
    const wrapRef = useRef<HTMLDivElement|null>(null);
    const glRef   = useRef<HTMLCanvasElement|null>(null);
    const hudRef  = useRef<HTMLCanvasElement|null>(null);

    const rendererRef = useRef<any>(null);
    const sceneRef    = useRef<any>(null);
    const cameraRef   = useRef<any>(null);
    const modelRef    = useRef<any>(null);
    const anchorsRef  = useRef<any[]>([]);
    const rayRef      = useRef<any>(null);

    const holes = useRef<{x:number;y:number;label:string;hidden:boolean}[]>([]);

    const view = useRef({ w:WIDTH, h:HEIGHT, dpr:1 });
    const ctxRef = useRef<CanvasRenderingContext2D|null>(null);

    const [ready, setReady] = useState(false);

    // Resize
    useEffect(() => {
      const onResize = () => {
        const w = Math.max(320, (wrapRef.current?.clientWidth ?? WIDTH)|0);
        const h = Math.round(w * (HEIGHT / WIDTH));
        const dpr = Math.max(1, Math.min(DPR_MAX, window.devicePixelRatio || 1));
        view.current = { w, h, dpr };

        const r = rendererRef.current, cv = glRef.current, hud = hudRef.current, cam = cameraRef.current;
        if (r && cv && hud && cam) {
          r.setPixelRatio(dpr); r.setSize(w, h, false);
          cv.style.width = w + "px"; cv.style.height = h + "px";
          cam.aspect = w / h; cam.updateProjectionMatrix();

          hud.width = Math.floor(w * dpr); hud.height = Math.floor(h * dpr);
          hud.style.width = w + "px"; hud.style.height = h + "px";
          const ctx = hud.getContext("2d")!;
          // Normalise pour dessiner en repère WIDTH×HEIGHT
          ctx.setTransform((w*dpr)/WIDTH, 0, 0, (h*dpr)/HEIGHT, 0, 0);
          ctxRef.current = ctx;
        }
      };
      onResize();
      const ro = (window as any).ResizeObserver ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener('resize', onResize);
      return () => { ro?.disconnect(); window.removeEventListener('resize', onResize); };
    }, []);

    // Init 3D
    useEffect(() => {
      let cancelled = false;

      const cv = glRef.current!;
      const hud = hudRef.current!;
      if (!cv || !hud) return;

      // Renderer / Scene / Camera
      const renderer = new _THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      renderer.setPixelRatio(view.current.dpr);
      renderer.setSize(view.current.w, view.current.h, false);
      renderer.outputColorSpace = _THREE.SRGBColorSpace;
      rendererRef.current = renderer;

      const scene = new _THREE.Scene(); scene.background = null;
      const cam = new _THREE.PerspectiveCamera(45, view.current.w / view.current.h, 0.1, 50);
      cam.position.set(2.0, 1.3, 2.3);
      cam.lookAt(0, 0.25, 0);
      scene.add(new _THREE.AmbientLight(0xffffff, .75));
      const dir = new _THREE.DirectionalLight(0xffffff, .9); dir.position.set(2.4, 3.3, 2.6); scene.add(dir);

      sceneRef.current = scene; cameraRef.current = cam;
      rayRef.current = new _THREE.Raycaster(undefined as any, undefined as any, 0.01, 100);

      // Modèle
      const loader = new GLTFLoader();
      loader.load(MODEL, (gltf:any) => {
        if (cancelled) return;
        const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!root) return;

        // Matériaux sobres
        root.traverse((o:any) => {
          if (o.isMesh) {
            if (!o.material || !o.material.isMeshStandardMaterial) {
              o.material = new _THREE.MeshStandardMaterial({ color: 0xf7efe7, roughness: .6, metalness: .05 });
            }
          }
        });

        // mise à l’échelle et centrage
        const box = new _THREE.Box3().setFromObject(root);
        const s = 1.2 / Math.max(...box.getSize(new _THREE.Vector3()).toArray());
        root.scale.setScalar(s);
        box.setFromObject(root);
        root.position.sub(box.getCenter(new _THREE.Vector3()));

        scene.add(root);
        modelRef.current = root;

        // Récupère les ancres (tous nœuds Hole_*)
        const anchors:any[] = [];
        root.traverse((n:any) => {
          const nm = (n.name || "").toLowerCase();
          if (/^hole[_\s-]?/.test(nm)) anchors.push(n);
        });
        anchorsRef.current = anchors;

        setReady(true);
        animate();
      }, undefined, (err:any) => console.warn("[L2] load error", err));

      function animate(){
        if (cancelled) return;
        if (modelRef.current) modelRef.current.rotation.y += 0.0038;
        projectHoles(); drawHUD();
        renderer.render(sceneRef.current, cameraRef.current);
        requestAnimationFrame(animate);
      }

      return () => { cancelled = true; };
    }, []);

    // Projection + occlusion
    function projectHoles(){
      const cam = cameraRef.current, rc = rayRef.current, model = modelRef.current;
      const anchors = anchorsRef.current || [];
      const { w, h } = view.current;
      if (!cam || !rc || !model) return;

      if (!anchors.length) {
        // Fallback cercle de 24 points
        holes.current = new Array(24).fill(0).map((_, i) => {
          const t = (i / 24) * Math.PI * 2, R = 220;
          return { x: WIDTH/2 + Math.cos(t)*R, y: HEIGHT/2 + Math.sin(t)*R, label: GREEK[i], hidden:false };
        });
        return;
      }

      const camPos = new _THREE.Vector3(); cam.getWorldPosition(camPos);
      const world  = new _THREE.Vector3();
      const dir    = new _THREE.Vector3();
      const v      = new _THREE.Vector3();
      const sx = WIDTH / w, sy = HEIGHT / h;

      holes.current = anchors.slice(0,24).map((n:any, i:number) => {
        // position monde
        n.getWorldPosition(world);

        // test d’occlusion (rayon caméra → trou, mesh rencontré avant ?)
        let hidden = false;
        dir.copy(world).sub(camPos).normalize();
        rc.set(camPos, dir);
        const hits = rc.intersectObject(model, true);
        if (hits && hits.length) {
          const dHole = camPos.distanceTo(world);
          if (hits[0].distance < dHole - 1e-3) hidden = true;
        }

        // projection écran
        v.copy(world).project(cam);
        const px = (v.x * 0.5 + 0.5) * w;
        const py = (-v.y * 0.5 + 0.5) * h;

        return { x: px * sx, y: py * sy, label: GREEK[i] ?? "", hidden };
      });
    }

    function drawHUD(){
      const ctx = ctxRef.current; if (!ctx) return;
      ctx.clearRect(0,0,WIDTH,HEIGHT);

      // points + lettres
      for (const p of holes.current) {
        // point : bleu vif si visible, pâle si caché
        ctx.beginPath();
        ctx.fillStyle = p.hidden ? "rgba(14,165,233,.35)" : "#0ea5e9";
        ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill();

        if (!p.hidden && p.label) {
          ctx.fillStyle="#e6f1ff"; ctx.font="12px ui-sans-serif, system-ui";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(p.label, p.x, p.y);
        }
      }
    }

    return (
      <div ref={wrapRef} style={{position:"relative"}}>
        <canvas ref={glRef}  width={WIDTH} height={HEIGHT} style={{display:"block", borderRadius:12, background:"transparent"}}/>
        <canvas ref={hudRef} width={WIDTH} height={HEIGHT} style={{position:"absolute", inset:0, pointerEvents:"auto"}}/>
        {!ready && <div style={{marginTop:8, fontSize:12, color:"#9bb2d4"}}>Chargement du modèle…</div>}
      </div>
    );
  }

  // @ts-ignore
  (window as any).AstragalusLevel2 = AstragalusLevel2;
})();
