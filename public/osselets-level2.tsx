/* global React, THREE, GLTFLoader, OrbitControls */
/* Level 2 — Fil & alphabet : affichage simple du GLB + caméra orbit */

(function () {
  function AstragalusLevel2() {
    const hostRef = React.useRef(null);

    React.useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      // --- Scene de base
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1b2a);

      const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
      camera.position.set(0.6, 0.45, 1.2);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      host.appendChild(renderer.domElement);

      // Sol doux
      const g = new THREE.PlaneGeometry(6, 6);
      const m = new THREE.MeshPhongMaterial({ color: 0x3b6a83, shininess: 10 });
      const ground = new THREE.Mesh(g, m);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.05;
      ground.receiveShadow = true;
      scene.add(ground);

      // Lights
      const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 0.7);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 0.9);
      dir.position.set(1.2, 1.6, 1.0);
      dir.castShadow = true;
      scene.add(dir);

      // OrbitControls si dispo
      let controls = null;
      if (THREE && THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
      }

      // Resize
      function fit() {
        const w = host.clientWidth || 800;
        const h = Math.max(host.clientHeight, Math.round(w * 9 / 16));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      fit();
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
      if (ro) ro.observe(host);
      window.addEventListener("resize", fit);

      // GLB
      const modelUrl   = "/assets/games/osselets/level2/3d/astragalus.glb";
      const LoaderCtor = (window.GLTFLoader) || (THREE && THREE.GLTFLoader);
      if (!LoaderCtor) {
        const msg = makeLabel("GLTFLoader manquant", "#ffdddd");
        msg.position.set(0, 0.05, 0);
        scene.add(msg);
      } else {
        const loader = new LoaderCtor();
        loader.load(
          modelUrl,
          function (gltf) {
            const root = gltf.scene || gltf.scenes?.[0];
            if (root) {
              root.traverse((n) => {
                if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
              });
              root.scale.set(0.8, 0.8, 0.8);
              scene.add(root);
            }
          },
          undefined,
          function (err) {
            const msg = makeLabel("Erreur chargement GLB", "#ffdddd");
            msg.position.set(0, 0.05, 0);
            scene.add(msg);
            // console.warn("[L2] GLB error:", err);
          }
        );
      }

      // Boucle
      let raf = 0;
      const tick = () => {
        if (controls) controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      // Cleanup
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", fit);
        if (ro) ro.disconnect();
        if (controls && controls.dispose) controls.dispose();
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      };
    }, []);

    // conteneur plein
    return React.createElement("div", {
      ref: hostRef,
      style: { width: "100%", minHeight: "54vh", height: "54vh", position: "relative" },
    });
  }

  // Petit helper pour texte (sprite canvas)
  function makeLabel(text, bg) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const pad = 8;
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = 28;
    c.width = w; c.height = h;
    ctx.fillStyle = bg || "rgba(255,255,255,0.9)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#112233";
    ctx.fillText(text, pad, 19);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    return new THREE.Sprite(mat);
  }

  // Expose global
  window.AstragalusLevel2 = AstragalusLevel2;
})();
