/* public/osselets-level3.tsx */
/* global React, ReactDOM, THREE, GLTFLoader */

(function () {
  const { useEffect, useRef, useState } = React;

  function tryPaths(paths) {
    return new Promise((resolve, reject) => {
      let i = 0;
      const step = () => {
        if (i >= paths.length) return reject(new Error("no candidate path"));
        const url = paths[i++];
        fetch(url, { method: "HEAD", cache: "no-store" })
          .then((r) => (r.ok ? resolve(url) : step()))
          .catch(step);
      };
      step();
    });
  }

  // Rotations discrètes (faces stables)
  var SNAP_ROTATIONS = [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(Math.PI / 2, 0, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
    new THREE.Euler(0, 0, Math.PI / 2),
    new THREE.Euler(0, 0, -Math.PI / 2),
    new THREE.Euler(Math.PI, 0, 0),
  ];
  function nearestSnap(q) {
    var best = 0, bestDot = -Infinity, qt = new THREE.Quaternion();
    for (var i = 0; i < SNAP_ROTATIONS.length; i++) {
      qt.setFromEuler(SNAP_ROTATIONS[i]);
      var d = Math.abs(q.dot(qt));
      if (d > bestDot) { bestDot = d; best = i; }
    }
    return new THREE.Quaternion().setFromEuler(SNAP_ROTATIONS[best]);
  }

  function faceNameFromQuat(q) {
    var up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    var ax = Math.abs(up.x), ay = Math.abs(up.y), az = Math.abs(up.z);
    if (ay >= ax && ay >= az) return "Venus (4)";
    if (ax >= ay && ax >= az) return up.x > 0 ? "Canis (3)" : "Senio (6)";
    return up.z > 0 ? "Vultures (1)" : "Bina (2)";
  }

  function AstragalusLevel3() {
    const hostRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const camRef = useRef(null);
    const bonesRef = useRef([]);
    const frameRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [err, setErr] = useState(null);
    const [score, setScore] = useState("");

    function roll() {
      for (var k = 0; k < bonesRef.current.length; k++) {
        var b = bonesRef.current[k];
        b.resting = false;
        b.vel.set((Math.random() - 0.5) * 1.6, 2 + Math.random() * 1.4, (Math.random() - 0.5) * 1.6);
        b.av.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        b.mesh.position.set((Math.random() - 0.5) * 0.9, 0.45 + Math.random() * 0.3, (Math.random() - 0.5) * 0.9);
        b.mesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
        b.targetQ = undefined;
      }
      setScore("");
    }

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
      camera.position.set(1.3, 1.1, 1.6);
      camRef.current = camera;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 0.85);
      key.position.set(2, 2.4, 2.2);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshStandardMaterial({ color: 0x0b2439, roughness: 1, metalness: 0 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const resize = () => {
        const w = host.clientWidth || 640;
        const h = host.clientHeight || Math.round((w * 9) / 16);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      var LoaderCtor = (THREE && THREE.GLTFLoader) || window.GLTFLoader;
      if (!LoaderCtor) {
        setErr("GLTFLoader manquant");
      } else {
        const loader = new LoaderCtor();
        const candidates = [
          "/assets/games/osselets/level3/3d/astragalus.glb",
          "/assets/games/osselets/3d/astragalus.glb",
          "/assets/games/osselets/models/astragalus.glb",
          "/assets/games/osselets/astragalus.glb",
        ];
        tryPaths(candidates)
          .then((url) => new Promise(function (resolve, reject) {
            loader.load(url, function (g) { resolve(g.scene || (g.scenes && g.scenes[0]) || g); }, undefined, reject);
          }))
          .then(function (base) {
            base.traverse(function (n) {
              if (n.isMesh) {
                n.castShadow = true; n.receiveShadow = true;
                if (n.material) {
                  n.material.depthWrite = true;
                  n.material.depthTest = true;
                  n.material.transparent = false;
                }
              }
            });
            var bbox = new THREE.Box3().setFromObject(base);
            var size = new THREE.Vector3();
            bbox.getSize(size);
            var scale = 0.22 / Math.max(0.001, Math.max(size.x, size.y, size.z));
            base.scale.setScalar(scale);
            bbox.setFromObject(base);
            var center = new THREE.Vector3();
            bbox.getCenter(center);
            base.position.sub(center);

            var N = 4; // mets 5 si tu veux
            var bones = [];
            for (var i = 0; i < N; i++) {
              var obj = base.clone(true);
              obj.position.set((i - (N - 1) / 2) * 0.35, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.35);
              obj.quaternion.setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
              scene.add(obj);
              bones.push({
                mesh: obj,
                vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.6 + Math.random(), (Math.random() - 0.5) * 1.2),
                av: new THREE.Vector3((Math.random() - 0.5) * 5.0, (Math.random() - 0.5) * 5.0, (Math.random() - 0.5) * 5.0),
                resting: false,
                targetQ: undefined,
              });
            }
            bonesRef.current = bones;
            setReady(true);
          })
          .catch(function (e) {
            console.warn("[L3] Échec chargement GLB", e);
            setErr("Modèle introuvable");
          });
      }

      // Simulation simple
      var tmpQ = new THREE.Quaternion();
      var gravity = new THREE.Vector3(0, -9.81, 0);
      const loop = () => {
        frameRef.current = requestAnimationFrame(loop);
        var dt = 1 / 60;

        var bones = bonesRef.current;
        var allRest = true;

        for (var bi = 0; bi < bones.length; bi++) {
          var b = bones[bi];
          if (b.resting) continue;
          allRest = false;

          b.vel.addScaledVector(gravity, dt * 0.25);
          b.mesh.position.addScaledVector(b.vel, dt);

          var ax = b.av.clone().multiplyScalar(dt);
          tmpQ.setFromEuler(new THREE.Euler(ax.x, ax.y, ax.z));
          b.mesh.quaternion.multiply(tmpQ).normalize();

          if (b.mesh.position.y <= 0.02) {
            b.mesh.position.y = 0.02;
            b.vel.y *= -0.25;
            b.vel.x *= 0.5; b.vel.z *= 0.5;
            b.av.multiplyScalar(0.5);

            var speed = b.vel.length() + b.av.length();
            if (speed < 0.25) {
              if (!b.targetQ) b.targetQ = nearestSnap(b.mesh.quaternion);
              b.mesh.quaternion.slerp(b.targetQ, 0.2);
              b.vel.multiplyScalar(0.5);
              b.av.multiplyScalar(0.5);
              if (b.mesh.quaternion.angleTo(b.targetQ) < 0.02) {
                b.mesh.quaternion.copy(b.targetQ);
                b.resting = true;
              }
            }
          }
        }

        // anti-empilement
        for (var i = 0; i < bones.length; i++) {
          for (var j = i + 1; j < bones.length; j++) {
            var A = bones[i], C = bones[j];
            var d = A.mesh.position.clone().sub(C.mesh.position);
            var dist = d.length();
            if (dist > 0 && dist < 0.12) {
              d.normalize();
              var corr = (0.12 - dist) * 0.5;
              A.mesh.position.addScaledVector(d, corr);
              C.mesh.position.addScaledVector(d, -corr);
              A.vel.addScaledVector(d, corr * 2);
              C.vel.addScaledVector(d, -corr * 2);
            }
          }
        }

        if (allRest && bones.length) {
          var labels = bones.map(function (b) { return faceNameFromQuat(b.mesh.quaternion); });
          setScore(labels.join(" • "));
        }

        renderer.render(scene, camera);
      };
      loop();

      return function cleanup() {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        ro.disconnect();
        try { host.removeChild(renderer.domElement); } catch (e) {}
        renderer.dispose();
      };
    }, []);

    return (
      <div ref={hostRef} style={{ width: "100%", height: "100%", position: "relative", aspectRatio: "16 / 9" }}>
        {!ready && !err && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#cfe2ff" }}>Chargement…</div>
        )}
        {err && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fecaca" }}>{err}</div>
        )}
        {ready && (
          <div style={{ position: "absolute", left: 10, bottom: 10, display: "flex", gap: 8 }}>
            <button onClick={roll} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>Lancer</button>
            <div style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #334155", background: "#0b2237", color: "#e6f1ff" }}>
              {score || "—"}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expose: composant + helpers pour tes boutons « Lancer »
  window.AstragalusLevel3 = AstragalusLevel3;
  window.launchOsseletsLevel3 = function (container) {
    var node = typeof container === "string" ? document.getElementById(container) : container;
    if (!node) return;
    if (ReactDOM.createRoot) ReactDOM.createRoot(node).render(React.createElement(AstragalusLevel3));
    else ReactDOM.render(React.createElement(AstragalusLevel3), node);
  };
  window.startOsseletsLevel3 = window.launchOsseletsLevel3; // alias
})();
