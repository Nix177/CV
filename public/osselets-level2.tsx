/* public/osselets-level2.tsx */
/* global React, ReactDOM, THREE, GLTFLoader */

(function () {
  const { useEffect, useRef, useState } = React;

  // -------- helpers --------
  function tryPaths(paths: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let i = 0;
      const next = () => {
        if (i >= paths.length) return reject(new Error("no candidate path"));
        const url = paths[i++];
        fetch(url, { method: "HEAD", cache: "no-store" })
          .then((r) => (r.ok ? resolve(url) : next()))
          .catch(next);
      };
      next();
    });
  }

  // Crée un sprite texte 3D (lettres grecques), occlus par l’os (depthTest: true)
  function makeTextSprite(txt: string, size = 38, color = "#172554") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const pad = 10;
    ctx.font = `${size}px ui-sans-serif, system-ui`;
    const w = Math.ceil(ctx.measureText(txt).width) + pad * 2;
    const h = size + pad * 2;
    canvas.width = w;
    canvas.height = h;

    ctx.font = `${size}px ui-sans-serif, system-ui`;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, w / 2, h / 2);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    // On fixe l’échelle pour rester lisible
    const S = 0.25;
    spr.scale.set((w / h) * S, 1 * S, 1 * S);
    return spr;
  }

  const GREEK = [
    "Α", "Β", "Γ", "Δ", "Ε", "Ζ",
    "Η", "Θ", "Ι", "Κ", "Λ", "Μ",
    "Ν", "Ξ", "Ο", "Π", "Ρ", "Σ",
    "Τ", "Υ", "Φ", "Χ", "Ψ", "Ω",
  ];

  function AstragalusLevel2() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const camRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<any>(null);
    const modelRef = useRef<THREE.Object3D | null>(null);
    const frameRef = useRef<number | null>(null);
    const [ready, setReady] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
      const host = hostRef.current!;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1220);
      sceneRef.current = scene;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.outputColorSpace = (THREE as any).SRGBColorSpace || (THREE as any).sRGBEncoding;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      rendererRef.current = renderer;
      host.appendChild(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
      camera.position.set(0.9, 0.6, 1.4);
      camRef.current = camera;

      // Eclairage doux
      scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.6));
      const key = new THREE.DirectionalLight(0xffffff, 0.8);
      key.position.set(2, 2.2, 2.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);

      // Sol
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshStandardMaterial({ color: 0x0b2439, roughness: 1, metalness: 0 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // OrbitControls (globals examples/js)
      let controls: any;
      try {
        controls = new (THREE as any).OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.minDistance = 0.35;
        controls.maxDistance = 3.2;
        controls.target.set(0, 0.18, 0);
        controlsRef.current = controls;
      } catch (e) {
        // Si examples non chargés
        console.warn("[L2] OrbitControls indisponible :", e);
      }

      // Resize
      const resize = () => {
        const w = host.clientWidth || 640;
        const h = host.clientHeight || 360;
        renderer.setSize(w, h, false);
        if (camera) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      // Charge le modèle d’astragale
      const loader = new (THREE as any).GLTFLoader?.() || new (window as any).GLTFLoader?.();
      if (!loader) {
        setErr("GLTFLoader manquant");
      } else {
        const candidates = [
          "/assets/games/osselets/level2/3d/astragalus.glb",
          "/assets/games/osselets/level3/3d/astragalus.glb",
          "/assets/games/osselets/3d/astragalus.glb",
          "/assets/games/osselets/models/astragalus.glb",
          "/assets/games/osselets/astragalus.glb",
        ];
        tryPaths(candidates)
          .then((url) => new Promise<THREE.Object3D>((resolve, reject) => {
            loader.load(
              url,
              (g: any) => resolve(g.scene || g.scenes?.[0] || g),
              undefined,
              reject
            );
          }))
          .then((obj) => {
            // Matériaux opaques (pour que les lettres soient bien occultées)
            obj.traverse((n: any) => {
              if (n.isMesh) {
                n.castShadow = true;
                n.receiveShadow = true;
                if (n.material) {
                  n.material.depthWrite = true;
                  n.material.depthTest = true;
                  n.material.transparent = false;
                }
              }
            });

            // Normalisation d’échelle
            const box = new THREE.Box3().setFromObject(obj);
            const size = new THREE.Vector3();
            box.getSize(size);
            const scale = 0.35 / Math.max(0.001, Math.max(size.x, size.y, size.z));
            obj.scale.setScalar(scale);
            box.setFromObject(obj);
            const center = new THREE.Vector3();
            box.getCenter(center);
            obj.position.sub(center); // centrer
            obj.position.y = 0.18;
            scene.add(obj);
            modelRef.current = obj;

            // Anneau de 24 lettres autour de l’os (non visibles « à travers » grâce à depthTest)
            const ringR = 0.75;
            const group = new THREE.Group();
            for (let i = 0; i < 24; i++) {
              const a = (i / 24) * Math.PI * 2;
              const s = makeTextSprite(GREEK[i], 40);
              s.position.set(Math.cos(a) * ringR, 0.35, Math.sin(a) * ringR);
              s.renderOrder = 0; // sous l’os si nécessaire
              group.add(s);
            }
            scene.add(group);

            setReady(true);
          })
          .catch((e) => {
            console.warn("[L2] Échec chargement GLB", e);
            setErr("Modèle introuvable");
          });
      }

      // Boucle
      const loop = () => {
        frameRef.current = requestAnimationFrame(loop);
        if (controlsRef.current) controlsRef.current.update();
        renderer.render(scene, camera);
      };
      loop();

      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        if (controlsRef.current) controlsRef.current.dispose?.();
        ro.disconnect();
        try { host.removeChild(renderer.domElement); } catch {}
        renderer.dispose();
      };
    }, []);

    // Interaction « saisir / bouger » : translation latérale douce
    useEffect(() => {
      const host = hostRef.current!;
      const renderer = rendererRef.current!;
      const cam = camRef.current!;
      const obj = modelRef.current;

      if (!host || !renderer || !cam) return;

      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const v = new THREE.Vector3();

      const onDown = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        host.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging || !obj) return;
        const dx = (e.clientX - lastX) / (host.clientWidth || 1);
        const dy = (e.clientY - lastY) / (host.clientHeight || 1);
        lastX = e.clientX; lastY = e.clientY;

        // Déplacement dans le plan de la caméra (pan simple)
        const dist = cam.position.distanceTo(obj.position);
        v.setFromMatrixColumn(cam.matrix, 0); // x cam
        v.multiplyScalar(-dx * dist * 0.8);
        obj.position.add(v);

        v.setFromMatrixColumn(cam.matrix, 1); // y cam
        v.multiplyScalar(dy * dist * 0.8);
        obj.position.add(v);

        // Garde hauteur raisonnable
        obj.position.y = Math.max(0.05, Math.min(0.8, obj.position.y));
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        try { host.releasePointerCapture(e.pointerId); } catch {}
      };

      host.addEventListener("pointerdown", onDown);
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerup", onUp);
      host.addEventListener("pointercancel", onUp);

      return () => {
        host.removeEventListener("pointerdown", onDown);
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerup", onUp);
        host.removeEventListener("pointercancel", onUp);
      };
    }, [ready]);

    return (
      <div ref={hostRef} style={{ width: "100%", height: "100%" }}>
        {!ready && !err && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#cfe2ff" }}>
            Chargement…
          </div>
        )}
        {err && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fecaca" }}>
            {err}
          </div>
        )}
      </div>
    );
  }

  // Expose pour le bouton « Lancer »
  // @ts-ignore
  (window as any).AstragalusLevel2 = AstragalusLevel2;
})();
