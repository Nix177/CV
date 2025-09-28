/* global React, THREE */
const { useEffect, useRef, useState } = React;

// ---- Chemins / constantes
const L3_MODEL = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
const FACE_VALUES = { 1: 1, 3: 3, 4: 4, 6: 6 }; // mappage ancre -> valeur
const GRAVITY = 28;
const FRICTION = 0.96;
const BOUNCE = 0.28;
const PLANE_Y = 0;

// ---- tiny loader helper (GLTFLoader global coté page)
function loadGLB(url) {
  return new Promise((resolve, reject) => {
    try {
      const loader = new THREE.GLTFLoader();
      loader.load(url, (g) => resolve(g), undefined, (e) => reject(e));
    } catch (e) {
      reject(e);
    }
  });
}

// ---- util: ajuster rAF au parent
function fitToParent(renderer, camera, holder) {
  const ro = new ResizeObserver(() => {
    const w = holder.clientWidth;
    const h = holder.clientHeight || Math.max(320, Math.round(w * 9 / 16));
    holder.style.height = `${h}px`; // occuper le cadre
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(holder);
  return ro;
}

// ---- calcul face up & snap
function computeBestFaceQ(mesh, faceAnchors) {
  // on cherche l’ancre dont l’axe local +Y est le plus aligné avec +Y monde
  const worldY = new THREE.Vector3(0, 1, 0);
  const qMesh = mesh.quaternion.clone();
  let best = null, bestDot = -1, bestName = null;

  for (const a of faceAnchors) {
    // orientation du +Y de l’ancre dans le monde, une fois le mesh orienté
    const localUp = new THREE.Vector3(0, 1, 0);
    const q = qMesh.clone().multiply(a.quaternion); // orientation locale -> monde
    const upWorld = localUp.clone().applyQuaternion(q).normalize();
    const d = upWorld.dot(worldY);
    if (d > bestDot) { bestDot = d; best = upWorld; bestName = a.name; }
  }
  if (!best) return { qTarget: qMesh.clone(), face: null };

  // quaternion pour aligner ce vecteur sur +Y monde
  const qDelta = new THREE.Quaternion().setFromUnitVectors(best, worldY);
  const qTarget = qDelta.multiply(qMesh);
  // extra: mettre yaw proche de zéro (stabilise la pose)
  const e = new THREE.Euler().setFromQuaternion(qTarget);
  e.z = 0; // pas d’inclinaison latérale
  qTarget.setFromEuler(e);

  // récupérer l’index face depuis le nom "Face_1|3|4|6"
  let face = null;
  const m = /Face_([1346])/.exec(bestName || "");
  if (m) face = Number(m[1]);

  return { qTarget, face };
}

function OsseletsLevel3() {
  const wrapRef = useRef(null);
  const cvsRef  = useRef(null);

  const [busy, setBusy]   = useState(false);
  const [score, setScore] = useState({ values: [], total: 0 });

  useEffect(() => {
    const holder = wrapRef.current;
    const canvas = cvsRef.current;
    if (!holder || !canvas) return;

    // --- scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1b2a);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camera.position.set(0.8, 0.9, 2.2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;

    const hemi = new THREE.HemisphereLight(0xbdd6ff, 0x334455, 0.8);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.castShadow = true;
    dir.position.set(2, 3, 2);
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);

    // sol
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a2b3b, roughness: 0.95, metalness: 0 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    plane.position.y = PLANE_Y;
    scene.add(plane);

    // UI fit
    const ro = fitToParent(renderer, camera, holder);

    // données dés
    const dice = []; // {mesh, vel, avel, settled, face, targetQ, anchors[]}

    let frameId;
    let alive = true;

    // charge modèle
    let baseMesh = null;
    let faceAnchors = [];
    (async () => {
      const glb = await loadGLB(L3_MODEL);
      // cherche premier Mesh
      glb.scene.traverse((n) => {
        if (n.isMesh && !baseMesh) {
          baseMesh = n;
        }
      });
      if (!baseMesh) throw new Error("Mesh non trouvé dans le GLB");

      // récupère les ancres "Face_1/3/4/6" (créées comme Empty/Null dans Blender)
      faceAnchors = [];
      glb.scene.traverse((n) => {
        if (/^Face_[1346]$/i.test(n.name)) faceAnchors.push(n.clone());
      });
      if (!faceAnchors.length) {
        // fallback : 4 orientations canoniques
        const mk = (name, e) => {
          const o = new THREE.Object3D(); o.name = name; o.quaternion.setFromEuler(e); return o;
        };
        faceAnchors = [
          mk("Face_1", new THREE.Euler(0, 0, 0)),
          mk("Face_3", new THREE.Euler(0, Math.PI * 0.5, 0)),
          mk("Face_4", new THREE.Euler(0, Math.PI, 0)),
          mk("Face_6", new THREE.Euler(0, -Math.PI * 0.5, 0)),
        ];
      }

      // petit plateau de départ
      reset();
      render();
    })().catch((e) => {
      console.error("[L3] GLB load error:", e);
    });

    function spawnDie(x) {
      const m = baseMesh.clone(true);
      m.material = Array.isArray(m.material) ? m.material.map((mtl) => mtl.clone()) : m.material.clone();
      m.castShadow = true;
      // échelle raisonnable
      const s = 0.55;
      m.scale.setScalar(s);
      m.position.set(x, 0.65, (Math.random() - 0.5) * 0.3);
      m.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
      scene.add(m);
      return {
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 6 + Math.random() * 1.5, -1.2 - Math.random() * 0.5),
        avel: new THREE.Vector3(Math.random() * 3, Math.random() * 2, Math.random() * 3),
        settled: false,
        face: null,
        targetQ: null,
        cool: 0,
      };
    }

    function launch() {
      if (!baseMesh) return;
      // clear anciens
      dice.forEach((d) => scene.remove(d.mesh));
      dice.length = 0;

      // 4 osselets
      const xs = [-0.45, -0.15, 0.15, 0.45];
      xs.forEach((x) => dice.push(spawnDie(x)));

      setBusy(true);
      setScore({ values: [], total: 0 });
    }

    function reset() {
      // plateau vide + 2 exemples posés
      dice.forEach((d) => scene.remove(d.mesh));
      dice.length = 0;
      for (let i = 0; i < 2; i++) {
        const d = spawnDie(-0.15 + i * 0.35);
        d.vel.set(0, 0, 0); d.avel.set(0, 0, 0);
        d.mesh.position.y = 0.001;
        d.settled = true;
        dice.push(d);
      }
      setBusy(false);
      setScore({ values: [], total: 0 });
    }

    // répulsion 2D simple (évite l’empilement)
    function separateXZ(dt) {
      for (let i = 0; i < dice.length; i++) {
        for (let j = i + 1; j < dice.length; j++) {
          const a = dice[i], b = dice[j];
          const d = b.mesh.position.clone().sub(a.mesh.position);
          d.y = 0;
          const dist = d.length();
          const minD = 0.30; // rayon approx
          if (dist > 0 && dist < minD) {
            const push = d.normalize().multiplyScalar((minD - dist) * 0.5);
            a.mesh.position.addScaledVector(push, -1);
            b.mesh.position.add(push);
          }
        }
      }
    }

    // integration
    function step(dt) {
      if (!dice.length) return;

      separateXZ(dt);

      const eulerTmp = new THREE.Euler();

      let settledAll = true;
      for (const d of dice) {
        if (!d.settled) {
          d.vel.y -= GRAVITY * dt;
          d.mesh.position.addScaledVector(d.vel, dt);
          eulerTmp.set(d.avel.x * dt, d.avel.y * dt, d.avel.z * dt);
          d.mesh.rotateX(eulerTmp.x);
          d.mesh.rotateY(eulerTmp.y);
          d.mesh.rotateZ(eulerTmp.z);

          // collision sol
          if (d.mesh.position.y <= PLANE_Y + 0.001) {
            d.mesh.position.y = PLANE_Y + 0.001;
            d.vel.y = -d.vel.y * BOUNCE;
            d.vel.x *= FRICTION; d.vel.z *= FRICTION;
            d.avel.multiplyScalar(0.92);
          }

          // seuil d’endormissement
          const speed = d.vel.length();
          const rotSp = d.avel.length();
          if (d.mesh.position.y <= PLANE_Y + 0.002 && speed < 0.15 && rotSp < 0.35) {
            // on verrouille vers la face la plus proche du haut
            const { qTarget, face } = computeBestFaceQ(d.mesh, faceAnchors);
            d.targetQ = qTarget;
            d.face = face;
            d.avel.set(0, 0, 0);
            d.vel.multiplyScalar(0.3);
            d.cool = 0.25; // temps de slerp
          }
        }

        // slerp vers la pose cible
        if (d.targetQ) {
          d.cool -= dt;
          d.mesh.quaternion.slerp(d.targetQ, 1 - Math.exp(-6 * dt));
          if (d.cool <= 0) {
            d.mesh.quaternion.copy(d.targetQ);
            d.targetQ = null;
            d.settled = true;
          } else {
            d.settled = false;
          }
        }

        if (!d.settled) settledAll = false;
      }

      if (settledAll && busy) {
        // calc score
        const vals = dice.map((d) => FACE_VALUES[d.face] ?? 0);
        setScore({ values: vals, total: vals.reduce((a, b) => a + b, 0) });
        setBusy(false);
      }
    }

    const clock = new THREE.Clock();
    function render() {
      if (!alive) return;
      const dt = Math.min(0.033, clock.getDelta());
      step(dt);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    frameId = requestAnimationFrame(render);

    // expose boutons
    const api = {
      launch, reset
    };
    holder.__l3 = api;

    return () => {
      alive = false;
      cancelAnimationFrame(frameId);
      ro.disconnect();
      try { renderer.dispose(); } catch {}
    };
  }, []);

  // ---- UI
  return (
    <div ref={wrapRef} style={{
      position: "relative",
      width: "100%",
      height: "min(62vh, 520px)", // 1ère passe, puis ResizeObserver ajuste
      borderRadius: 12,
      overflow: "hidden",
      background: "linear-gradient(180deg,#0f1f2f,#0b1826)"
    }}>
      <canvas ref={cvsRef} style={{ display: "block", width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 8 }}>
        <button onClick={() => wrapRef.current.__l3?.launch()} className="btn primary">Lancer</button>
        <button onClick={() => wrapRef.current.__l3?.reset()} className="btn">Réinitialiser</button>
      </div>
      <div style={{ position: "absolute", left: 12, bottom: 10, color: "#cfe7ff", fontSize: 14, fontWeight: 600 }}>
        {score.values.length ? (
          <span>Résultat : {score.values.join(" + ")} = <span style={{ fontSize: 18 }}>{score.total}</span></span>
        ) : (busy ? "Lancé en cours…" : "Prêt.")}
      </div>
    </div>
  );
}

// @ts-ignore
window.OsseletsLevel3 = OsseletsLevel3;
