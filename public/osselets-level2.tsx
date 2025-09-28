/* public/osselets-level2.tsx */
(function () {
  // Tout est encapsulé : aucune re-déclaration globale possible
  const { useEffect, useRef, useState } = React;

  type V2 = { x: number; y: number };
  type Hole = { obj: THREE.Object3D; world: THREE.Vector3; label: string; index: number; sprite: THREE.Sprite };

  const BASE = "/assets/games/osselets/";
  const MODEL = BASE + "level2/3d/astragalus.glb";
  const LETTERS = [
    "Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ",
    "Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"
  ];

  function AstragalusLevel2() {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const controlsRef = useRef<any | null>(null);
    const frameRef = useRef<number | null>(null);
    const holesRef = useRef<Hole[]>([]);
    const lineRef = useRef<THREE.Line | null>(null);
    const pickingRay = useRef(new THREE.Raycaster());
    const pointerNDC = useRef(new THREE.Vector2());
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [msg, setMsg] = useState<string>("Chargement du modèle 3D...");

    // Layout / resize
    useEffect(() => {
      const wrap = wrapRef.current;
      if (!wrap || !window.THREE) return;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputEncoding = THREE.sRGBEncoding;
      rendererRef.current = renderer;
      wrap.appendChild(renderer.domElement);

      // Scene & camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x081320);
      sceneRef.current = scene;

      const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
      cam.position.set(0.9, 0.7, 1.4);
      cameraRef.current = cam;

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir = new THREE.DirectionalLight(0xffffff, 0.9);
      dir.position.set(1.2, 1.4, 0.8);
      scene.add(dir);

      // Controls
      const controls = new (THREE as any).OrbitControls(cam, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 0.1, 0);
      controlsRef.current = controls;

      const onResize = () => {
        const w = wrap.clientWidth;
        const h = Math.max(360, Math.floor(w * 9 / 16)); // 16:9 plein cadre
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      };
      onResize();
      const ro = new (window as any).ResizeObserver(onResize);
      ro.observe(wrap);
      window.addEventListener("resize", onResize);

      // Load model
      const loader = new (THREE as any).GLTFLoader();
      loader.load(MODEL, (gltf: any) => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) {
          setStatus("error");
          setMsg("Modèle vide.");
          return;
        }
        root.traverse((o: any) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.material.depthWrite = true; }});
        // Mise à l'échelle douce (le modèle d’exemple est petit)
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);
        const targetW = 0.9; // ~90 cm « virtuels »
        const s = targetW / Math.max(0.001, size.length());
        root.scale.setScalar(s);
        // Recentrage
        const c = new THREE.Vector3();
        new THREE.Box3().setFromObject(root).getCenter(c);
        root.position.sub(c);
        scene.add(root);

        // ===== Trholes (24) =====
        // On essaie des noms courants ; sinon fallback cercle
        const anchorRegex = /(Hole|trou|ancre|anchor)[\s_]?(\d+)?/i;
        const anchors: THREE.Object3D[] = [];
        root.traverse((o: any) => {
          if (anchorRegex.test(o.name)) anchors.push(o);
        });

        let centers: THREE.Vector3[] = [];
        if (anchors.length >= 24) {
          // Prend les 24 premiers, ordonnés par nom
          anchors.sort((a: any, b: any) => (a.name > b.name ? 1 : -1));
          centers = anchors.slice(0, 24).map(n => n.getWorldPosition(new THREE.Vector3()));
        } else {
          // --- Fallback : 24 points en cercle ---
          centers = [];
          const r = 0.26, cz = 0; // rayon et léger décalage
          for (let i = 0; i < 24; i++) {
            const t = (i / 24) * Math.PI * 2;
            centers.push(new THREE.Vector3(Math.cos(t) * r, 0.1 + (Math.sin(t) * 0.04), cz + Math.sin(t) * r * 0.8));
          }
        }

        // Mat sprite lettres (occlusion par l’os : depthTest = true)
        const makeSprite = (txt: string) => {
          const CAN = document.createElement("canvas");
          CAN.width = 128; CAN.height = 128;
          const cx = CAN.getContext("2d")!;
          cx.clearRect(0, 0, 128, 128);
          cx.fillStyle = "#0ea5e9";
          cx.beginPath();
          cx.arc(64, 64, 50, 0, Math.PI * 2);
          cx.fill();
          cx.fillStyle = "#fff";
          cx.font = "bold 64px system-ui,Segoe UI,Arial";
          cx.textAlign = "center";
          cx.textBaseline = "middle";
          cx.fillText(txt, 64, 68);
          const tex = new THREE.CanvasTexture(CAN);
          const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true });
          const sp = new THREE.Sprite(mat);
          sp.scale.set(0.10, 0.10, 0.10);
          sp.renderOrder = 2; // après l’os mais soumis au depthTest
          return sp;
        };

        const holes: Hole[] = centers.map((p, i) => {
          const sp = makeSprite(LETTERS[i % LETTERS.length]);
          sp.position.copy(p);
          scene.add(sp);
          return { obj: sp, world: p.clone(), label: LETTERS[i % LETTERS.length], index: i, sprite: sp };
        });
        holesRef.current = holes;

        // Ligne (chemin)
        const lineGeo = new THREE.BufferGeometry().setFromPoints([]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.9, depthTest: true });
        const line = new THREE.Line(lineGeo, lineMat);
        line.renderOrder = 3;
        scene.add(line);
        lineRef.current = line;

        setStatus("ready");
        setMsg("Prêt.");
      }, undefined, (e: any) => {
        console.warn("[L2] load fail:", e);
        setStatus("error");
        setMsg("Impossible de charger le modèle (GLTF).");
      });

      // Pointer events
      const picks: THREE.Vector3[] = [];
      const updateLine = () => {
        if (!lineRef.current) return;
        lineRef.current.geometry.dispose();
        if (picks.length === 0) {
          lineRef.current.geometry = new THREE.BufferGeometry().setFromPoints([]);
        } else {
          lineRef.current.geometry = new THREE.BufferGeometry().setFromPoints(picks);
        }
      };

      const onPointer = (e: PointerEvent) => {
        if (!renderer || !cameraRef.current) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNDC.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNDC.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        pickingRay.current.setFromCamera(pointerNDC.current, cameraRef.current);
        // Set pick on sprites
        let best: { hole: Hole; dist: number } | null = null;
        for (const h of holesRef.current) {
          // Ray-sphere approx
          const to = new THREE.Vector3();
          const c = h.sprite.getWorldPosition(to);
          const d = pickingRay.current.ray.distanceToPoint(c);
          if (d < 0.08 && (!best || d < best.dist)) best = { hole: h, dist: d };
        }
        // halo
        holesRef.current.forEach(h => (h.sprite.material as any).opacity = 1);
        if (best) (best.hole.sprite.material as any).opacity = 0.75;
      };

      const onClick = (e: MouseEvent) => {
        if (!renderer || !cameraRef.current) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNDC.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNDC.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        pickingRay.current.setFromCamera(pointerNDC.current, cameraRef.current);
        let best: { hole: Hole; dist: number } | null = null;
        for (const h of holesRef.current) {
          const c = h.sprite.getWorldPosition(new THREE.Vector3());
          const d = pickingRay.current.ray.distanceToPoint(c);
          if (d < 0.08 && (!best || d < best.dist)) best = { hole: h, dist: d };
        }
        if (best) {
          picks.push(best.hole.sprite.getWorldPosition(new THREE.Vector3()));
          updateLine();
        }
      };

      renderer.domElement.addEventListener("pointermove", onPointer);
      renderer.domElement.addEventListener("click", onClick);

      // loop
      const loop = () => {
        controls.update();
        renderer.render(scene, cameraRef.current!);
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);

      // cleanup
      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        renderer.domElement.removeEventListener("pointermove", onPointer);
        renderer.domElement.removeEventListener("click", onClick);
        ro.disconnect();
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        wrap.removeChild(renderer.domElement);
      };
    }, []);

    const reset = () => {
      // Réinitialise uniquement la ligne
      if (lineRef.current) {
        lineRef.current.geometry.dispose();
        lineRef.current.geometry = new THREE.BufferGeometry().setFromPoints([]);
      }
    };

    return (
      <div ref={wrapRef} style={{ width: "100%", height: "auto", minHeight: "54vh", position: "relative", outline: "none" }}>
        <div style={{ position: "absolute", left: 12, bottom: 12, display: "flex", gap: 8, zIndex: 5 }}>
          <button onClick={reset} style={btn()}>Réinitialiser</button>
        </div>
        <div style={hud()}>
          <strong>Écrire avec les os — Fil & alphabet</strong>
          <span style={{ opacity: .8 }}>{status === "loading" ? msg : "Clique les pastilles pour tracer un fil."}</span>
        </div>
      </div>
    );
  }

  // Petits styles inline
  const btn = () => ({
    padding: "8px 12px",
    border: "1px solid #ffffff44",
    background: "#0b1f33",
    color: "#e6f1ff",
    borderRadius: 10,
    cursor: "pointer"
  } as React.CSSProperties);

  const hud = () => ({
    position: "absolute" as const,
    left: 12, top: 12, right: 12,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 10, padding: "8px 10px",
    borderRadius: 10, border: "1px solid #ffffff22", background: "rgba(6,18,30,.55)",
    color: "#e6f1ff", zIndex: 5
  });

  // Expose une seule fois
  (window as any).AstragalusLevel2 = AstragalusLevel2;
})();
