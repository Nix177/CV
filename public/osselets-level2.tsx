/* public/osselets-level2.tsx */
/* global React, ReactDOM, THREE, GLTFLoader, OrbitControls */

(function () {
  const { useEffect, useRef, useState } = React;

  // ---------- utils ----------
  function tryPaths(paths) {
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

  function makeTextSprite(txt, size) {
    const S = size || 38;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const pad = 10;
    ctx.font = S + "px ui-sans-serif, system-ui";
    const w = Math.ceil(ctx.measureText(txt).width) + pad * 2;
    const h = S + pad * 2;
    canvas.width = w; canvas.height = h;

    ctx.font = S + "px ui-sans-serif, system-ui";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = "#172554";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, w / 2, h / 2);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    const scale = 0.25;
    spr.scale.set((w / h) * scale, 1 * scale, 1 * scale);
    return spr;
  }

  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  function AstragalusLevel2() {
    const hostRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const camRef = useRef(null);
    const controlsRef = useRef(null);
    const modelRef = useRef(null);
    const frameRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [err, setErr] = useState(null);

    useEffect(function mount() {
      const host = hostRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1220);
      sceneRef.current = scene;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
      else renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      rendererRef.current = renderer;
      host.appendChild(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
      camera.position.set(0.9, 0.6, 1.4);
      camRef.current = camera;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.6));
      const key = new THREE.DirectionalLight(0xffffff, 0.8);
      key.position.set(2, 2.2, 2.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshStandardMaterial({ color: 0x0b2439, roughness: 1, metalness: 0 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // OrbitControls (compat global)
      try {
        var ControlsCtor = (THREE && THREE.OrbitControls) || window.OrbitControls;
        if (ControlsCtor) {
          const controls = new ControlsCtor(camera, renderer.domElement);
          controls.enableDamping = true;
          controls.enablePan = false;
          controls.minDistance = 0.35;
          controls.maxDistance = 3.2;
          controls.target.set(0, 0.18, 0);
          controlsRef.current = controls;
        }
      } catch (e) {
        console.warn("[L2] OrbitControls indisponible", e);
      }

      const resize = () => {
        // Remplit le cadre ; si parent n’a pas de hauteur, aspect 16/9 via largeur
        const w = host.clientWidth || 640;
        const h = host.clientHeight || Math.round((w * 9) / 16);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      // --- GLTFLoader (sans optional chaining sur new) ---
      var LoaderCtor = (THREE && THREE.GLTFLoader) || window.GLTFLoader;
      if (!LoaderCtor) {
        setErr("GLTFLoader manquant");
      } else {
        const loader = new LoaderCtor();
        const candidates = [
          "/assets/games/osselets/level2/3d/astragalus.glb",
          "/assets/games/osselets/level3/3d/astragalus.glb",
          "/assets/games/osselets/3d/astragalus.glb",
          "/assets/games/osselets/models/astragalus.glb",
          "/assets/games/osselets/astragalus.glb",
        ];
        tryPaths(candidates)
          .then((url) => new Promise(function (resolve, reject) {
            loader.load(url, function (g) { resolve(g.scene || (g.scenes && g.scenes[0]) || g); }, undefined, reject);
          }))
          .then(function (obj) {
            obj.traverse(function (n) {
              if (n.isMesh) {
                n.castShadow = true; n.receiveShadow = true;
                if (n.material) {
                  n.material.depthWrite = true;
                  n.material.depthTest = true;
                  n.material.transparent = false;
                }
              }
            });
            var box = new THREE.Box3().setFromObject(obj);
            var size = new THREE.Vector3();
            box.getSize(size);
            var scale = 0.35 / Math.max(0.001, Math.max(size.x, size.y, size.z));
            obj.scale.setScalar(scale);
            box.setFromObject(obj);
            var center = new THREE.Vector3();
            box.getCenter(center);
            obj.position.sub(center);
            obj.position.y = 0.18;
            scene.add(obj);
            modelRef.current = obj;

            // Anneau de lettres (occlus par l’os)
            var ringR = 0.75;
            var group = new THREE.Group();
            for (var i = 0; i < 24; i++) {
              var a = (i / 24) * Math.PI * 2;
              var s = makeTextSprite(GREEK[i], 40);
              s.position.set(Math.cos(a) * ringR, 0.35, Math.sin(a) * ringR);
              s.renderOrder = 0;
              group.add(s);
            }
            scene.add(group);

            setReady(true);
          })
          .catch(function (e) {
            console.warn("[L2] Échec chargement GLB", e);
            setErr("Modèle introuvable");
          });
      }

      const loop = () => {
        frameRef.current = requestAnimationFrame(loop);
        if (controlsRef.current && controlsRef.current.update) controlsRef.current.update();
        renderer.render(scene, camera);
      };
      loop();

      return function cleanup() {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        if (controlsRef.current && controlsRef.current.dispose) controlsRef.current.dispose();
        ro.disconnect();
        try { host.removeChild(renderer.domElement); } catch (e) {}
        renderer.dispose();
      };
    }, []);

    // Drag pour déplacer l’os (plan caméra)
    useEffect(function drag() {
      if (!ready) return;
      const host = hostRef.current;
      const renderer = rendererRef.current;
      const cam = camRef.current;
      const obj = modelRef.current;
      if (!host || !renderer || !cam || !obj) return;

      let dragging = false, lastX = 0, lastY = 0;
      const v = new THREE.Vector3();

      function onDown(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; host.setPointerCapture(e.pointerId); }
      function onMove(e) {
        if (!dragging) return;
        const dx = (e.clientX - lastX) / (host.clientWidth || 1);
        const dy = (e.clientY - lastY) / (host.clientHeight || 1);
        lastX = e.clientX; lastY = e.clientY;
        const dist = cam.position.distanceTo(obj.position);
        v.setFromMatrixColumn(cam.matrix, 0).multiplyScalar(-dx * dist * 0.8); obj.position.add(v);
        v.setFromMatrixColumn(cam.matrix, 1).multiplyScalar(dy * dist * 0.8);  obj.position.add(v);
        obj.position.y = Math.max(0.05, Math.min(0.8, obj.position.y));
      }
      function onUp(e) { dragging = false; try { host.releasePointerCapture(e.pointerId); } catch (ex) {} }

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
      <div ref={hostRef} style={{ width: "100%", height: "100%", position: "relative", aspectRatio: "16 / 9" }}>
        {!ready && !err && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#cfe2ff" }}>Chargement…</div>
        )}
        {err && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fecaca" }}>{err}</div>
        )}
      </div>
    );
  }

  // Expose: composant + helpers de montage pour tes boutons « Lancer »
  window.AstragalusLevel2 = AstragalusLevel2;
  window.launchOsseletsLevel2 = function (container) {
    var node = typeof container === "string" ? document.getElementById(container) : container;
    if (!node) return;
    if (ReactDOM.createRoot) ReactDOM.createRoot(node).render(React.createElement(AstragalusLevel2));
    else ReactDOM.render(React.createElement(AstragalusLevel2), node);
  };
  window.startOsseletsLevel2 = window.launchOsseletsLevel2; // alias
})();
