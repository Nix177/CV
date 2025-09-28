/* global React, THREE, GLTFLoader, OrbitControls */
/* Level 3 — Rouler les os : 4 astragales affichées et posées sur un sol */

(function () {
  function AstragalusLevel3() {
    const hostRef = React.useRef(null);

    React.useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      // Base
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1b2a);

      const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
      camera.position.set(1.2, 0.9, 1.8);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      host.appendChild(renderer.domElement);

      // Sol
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshPhongMaterial({ color: 0x7a8fa0, shininess: 5 })
      );
      plane.rotation.x = -Math.PI / 2;
      plane.receiveShadow = true;
      scene.add(plane);

      // Lumières
      scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.7));
      const sun = new THREE.DirectionalLight(0xffffff, 0.9);
      sun.position.set(2.2, 2.6, 1.5);
      sun.castShadow = true;
      scene.add(sun);

      // OrbitControls
      let controls = null;
      if (THREE && THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minDistance = 0.6;
        controls.maxDistance = 4;
        controls.target.set(0, 0.1, 0);
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

      // Charge 1 GLB puis clone 4 fois
      const modelUrl = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
      const LoaderCtor = (window.GLTFLoader) || (THREE && THREE.GLTFLoader);
      if (!LoaderCtor) {
        scene.add(makeMsg("GLTFLoader manquant", "#ffdddd"));
      } else {
        const loader = new LoaderCtor();
        loader.load(
          modelUrl,
          function (gltf) {
            const src = gltf.scene || gltf.scenes?.[0];
            if (!src) return;

            src.traverse((n) => {
              if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
            });

            const positions = [
              [-0.6, 0.12,  0.2],
              [-0.1, 0.14, -0.1],
              [ 0.4, 0.18,  0.1],
              [ 0.9, 0.16, -0.2],
            ];
            for (let i = 0; i < 4; i++) {
              const c = src.clone(true);
              c.position.set(positions[i][0], positions[i][1], positions[i][2]);
              c.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
              c.scale.set(0.9, 0.9, 0.9);
              scene.add(c);
            }
          },
          undefined,
          function () {
            scene.add(makeMsg("Erreur chargement GLB", "#ffdddd"));
          }
        );
      }

      // Loop
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

    return React.createElement("div", {
      ref: hostRef,
      style: { width: "100%", minHeight: "54vh", height: "54vh", position: "relative" },
    });
  }

  function makeMsg(text, bg) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const pad = 8;
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = 28;
    c.width = w; c.height = h;
    ctx.fillStyle = bg || "rgba(255,255,255,0.95)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#112233";
    ctx.fillText(text, pad, 19);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.position.set(0, 0.05, 0);
    return sp;
  }

  window.AstragalusLevel3 = AstragalusLevel3;
})();
