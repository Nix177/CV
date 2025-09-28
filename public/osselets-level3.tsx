/* public/osselets-level3.tsx */
/* global React, ReactDOM, THREE, GLTFLoader */

(function () {
  const { useEffect, useRef, useState } = React;

  // -------- utils --------
  function tryPaths(paths: string[]): Promise<string> {
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

  // Orients un os pour « poser » une face vers le haut (snap le plus proche)
  const SNAP_ROTATIONS = [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(Math.PI / 2, 0, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
    new THREE.Euler(0, 0, Math.PI / 2),
    new THREE.Euler(0, 0, -Math.PI / 2),
    new THREE.Euler(Math.PI, 0, 0),
  ];
  function nearestSnap(q: THREE.Quaternion) {
    let best = 0,
      bestDot = -Infinity;
    const qt = new THREE.Quaternion();
    for (let i = 0; i < SNAP_ROTATIONS.length; i++) {
      qt.setFromEuler(SNAP_ROTATIONS[i]);
      const d = Math.abs(q.dot(qt));
      if (d > bestDot) {
        bestDot = d;
        best = i;
      }
    }
    const out = new THREE.Quaternion().setFromEuler(SNAP_ROTATIONS[best]);
    return out;
  }

  // Détermine un score symbolique en fonction de l’orientation « up »
  function faceNameFromQuat(q: THREE.Quaternion): string {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    // 4 états symboliques (approx) selon la composante dominante
    const ax = Math.abs(up.x),
      ay = Math.abs(up.y),
      az = Math.abs(up.z);
    if (ay >= ax && ay >= az) return "Venus (4)";
    if (ax >= ay && ax >= az) return up.x > 0 ? "Canis (3)" : "Senio (6)";
    return up.z > 0 ? "Vultures (1)" : "Bina (2)"; // labels traditionnels approximatifs
  }

  type Bone = {
    mesh: THREE.Object3D;
    vel: THREE.Vector3;
    av: THREE.Vector3;
    resting: boolean;
    targetQ?: THREE.Quaternion;
  };

  function AstragalusLevel3() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const camRef = useRef<THREE.PerspectiveCamera | null>(null);
    const bonesRef = useRef<Bone[]>([]);
    const frameRef = useRef<number | null>(null);
    const [ready, setReady] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [score, setScore] = useState<string>("");

    function roll() {
      // relance tous les osselets
      for (const b of bonesRef.current) {
        b.resting = false;
        b.vel.set((Math.random() - 0.5) * 1.6, 2 + Math.random() * 1.4, (Math.random() - 0.5) * 1.6);
        b.av.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        b.mesh.position.set((Math.random() - 0.5) * 0.9, 0.45 + Math.random() * 0.3, (Math.random() - 0.5) * 0.9);
        b.mesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
        b.targetQ = undefined;
      }
      setScore("");
    }

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
      camera.position.set(1.3, 1.1, 1.6);
      camRef.current = camera;

      // Lights
      scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 0.85);
      key.position.set(2, 2.4, 2.2);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);

      // Ground
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshStandardMaterial({ color: 0x0b2439, roughness: 1, metalness: 0 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Resize
      const resize = () => {
        const w = host.clientWidth || 640;
        const h = host.clientHeight || 360;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      // Load model once, clone N times
      const loader = new (THREE as any).GLTFLoader?.() || new (window as any).GLTFLoader?.();
      if (!loader) {
        setErr("GLTFLoader manquant");
      } else {
        const candidates = [
          "/assets/games/osselets/level3/3d/astragalus.glb",
          "/assets/games/osselets/3d/astragalus.glb",
          "/assets/games/osselets/models/astragalus.glb",
          "/assets/games/osselets/astragalus.glb",
        ];
        tryPaths(candidates)
          .then((url) => new Promise<any>((resolve, reject) => {
            loader.load(
              url,
              (g: any) => resolve(g.scene || g.scenes?.[0] || g),
              undefined,
              reject
            );
          }))
          .then((base: THREE.Object3D) => {
            // Normalize the base bone (scale/center)
            base.traverse((n: any) => {
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
            const bbox = new THREE.Box3().setFromObject(base);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const scale = 0.22 / Math.max(0.001, Math.max(size.x, size.y, size.z));
            base.scale.setScalar(scale);
            bbox.setFromObject(base);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            base.position.sub(center);

            // Create 4 osselets (option 5e possible)
            const N = 4; // passer à 5 si besoin
            const bones: Bone[] = [];
            for (let i = 0; i < N; i++) {
              const obj = base.clone(true);
              obj.position.set((i - (N - 1) / 2) * 0.35, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.35);
              obj.quaternion.setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
              scene.add(obj);
              bones.push({
                mesh: obj,
                vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.6 + Math.random(), (Math.random() - 0.5) * 1.2),
                av: new THREE.Vector3((Math.random() - 0.5) * 5.0, (Math.random() - 0.5) * 5.0, (Math.random() - 0.5) * 5.0),
                resting: false,
              });
            }
            bonesRef.current = bones;
            setReady(true);
          })
          .catch((e) => {
            console.warn("[L3] Échec chargement GLB", e);
            setErr("Modèle introuvable");
          });
      }

      // Simulation simple (sans moteur physique) + snap final
      const tmpQ = new THREE.Quaternion();
      const gravity = new THREE.Vector3(0, -9.81, 0);
      const loop = () => {
        frameRef.current = requestAnimationFrame(loop);
        const dt = 1 / 60;

        const bones = bonesRef.current;
        let allRest = true;

        for (const b of bones) {
          if (b.resting) continue;
          allRest = false;

          // Mouvement
          b.vel.addScaledVector(gravity, dt * 0.25);
          b.mesh.position.addScaledVector(b.vel, dt);

          // Rotation
          const ax = b.av.clone().multiplyScalar(dt);
          tmpQ.setFromEuler(new THREE.Euler(ax.x, ax.y, ax.z));
          b.mesh.quaternion.multiply(tmpQ).normalize();

          // Collision sol (y=0)
          if (b.mesh.position.y <= 0.02) {
            b.mesh.position.y = 0.02;

            // amortissement et frottements pour éviter « empilement »
            b.vel.y *= -0.25;
            b.vel.x *= 0.5;
            b.vel.z *= 0.5;
            b.av.multiplyScalar(0.5);

            // si quasi immobile → snap à une face stable
            const speed = b.vel.length() + b.av.length();
            if (speed < 0.25) {
              if (!b.targetQ) b.targetQ = nearestSnap(b.mesh.quaternion);
              // interpolation douce
              b.mesh.quaternion.slerp(b.targetQ, 0.2);
              // freinage
              b.vel.multiplyScalar(0.5);
              b.av.multiplyScalar(0.5);
              if (b.mesh.quaternion.angleTo(b.targetQ) < 0.02) {
                b.mesh.quaternion.copy(b.targetQ);
                b.resting = true;
              }
            }
          }
        }

        // Évite l’empilement : si deux os trop proches, on les repousse légèrement
        for (let i = 0; i < bones.length; i++) {
          for (let j = i + 1; j < bones.length; j++) {
            const a = bones[i], c = bones[j];
            const d = a.mesh.position.clone().sub(c.mesh.position);
            const dist = d.length();
            if (dist > 0 && dist < 0.12) {
              d.normalize();
              const corr = (0.12 - dist) * 0.5;
              a.mesh.position.addScaledVector(d, corr);
              c.mesh.position.addScaledVector(d, -corr);
              a.vel.addScaledVector(d, corr * 2);
              c.vel.addScaledVector(d, -corr * 2);
            }
          }
        }

        if (allRest && bones.length) {
          // Score / libellés
          const labels = bones.map((b) => faceNameFromQuat(b.mesh.quaternion));
          setScore(labels.join(" • "));
        }

        renderer.render(scene, camera);
      };
      loop();

      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        ro.disconnect();
        try { host.removeChild(renderer.domElement); } catch {}
        renderer.dispose();
      };
    }, []);

    return (
      <div ref={hostRef} style={{ width: "100%", height: "100%", position: "relative" }}>
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
        {ready && (
          <div style={{ position: "absolute", left: 10, bottom: 10, display: "flex", gap: 8 }}>
            <button onClick={roll} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>
              Lancer
            </button>
            <div style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #334155", background: "#0b2237", color: "#e6f1ff" }}>
              {score || "—"}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expose
  // @ts-ignore
  (window as any).AstragalusLevel3 = AstragalusLevel3;
})();
