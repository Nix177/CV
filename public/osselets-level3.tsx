/* public/osselets-level3.tsx */
(function () {
  const { useEffect, useRef, useState } = React;

  type Die = {
    root: THREE.Object3D;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    quat: THREE.Quaternion;
    angVel: THREE.Vector3;
    radius: number;
    asleep: boolean;
  };

  const BASE = "/assets/games/osselets/";
  const MODEL = BASE + "level3/3d/astragalus_faces.glb"; // ton modèle

  // Utilitaires
  const tmpV = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function length2(v: THREE.Vector3) { return v.x*v.x + v.y*v.y + v.z*v.z; }

  function AstragalusLevel3() {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const controlsRef = useRef<any | null>(null);
    const diceRef = useRef<Die[]>([]);
    const facesRef = useRef<{ value: number; node: THREE.Object3D; normal: THREE.Vector3; }[]>([]);
    const frameRef = useRef<number | null>(null);
    const [status, setStatus] = useState<"loading"|"ready"|"error">("loading");
    const [msg, setMsg] = useState<string>("Chargement du modèle 3D…");
    const [score, setScore] = useState<number | null>(null);

    // init
    useEffect(() => {
      const wrap = wrapRef.current!;
      if (!wrap || !window.THREE) return;

      // renderer
      const rnd = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      rnd.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      rnd.outputEncoding = THREE.sRGBEncoding;
      rendererRef.current = rnd;
      wrap.appendChild(rnd.domElement);

      // scene + camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf4f6fb);
      sceneRef.current = scene;

      const cam = new THREE.PerspectiveCamera(45, 16/9, 0.1, 100);
      cam.position.set(1.9, 1.2, 2.3);
      cameraRef.current = cam;

      // lights
      scene.add(new THREE.HemisphereLight(0xffffff, 0x99aacc, 0.9));
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(1.2, 2.0, 1.0);
      dir.castShadow = false;
      scene.add(dir);

      // ground
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshPhongMaterial({ color: 0xdee6f5, shininess: 8 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0;
      ground.receiveShadow = true;
      scene.add(ground);

      // controls
      const ctrl = new (THREE as any).OrbitControls(cam, rnd.domElement);
      ctrl.enableDamping = true;
      ctrl.maxPolarAngle = Math.PI * 0.495;
      ctrl.target.set(0, 0.18, 0);
      controlsRef.current = ctrl;

      // resize
      const onResize = () => {
        const w = wrap.clientWidth;
        const h = Math.max(420, Math.floor(w * 9/16));
        rnd.setSize(w, h, false);
        cam.aspect = w/h;
        cam.updateProjectionMatrix();
      };
      onResize();
      const ro = new (window as any).ResizeObserver(onResize);
      ro.observe(wrap);
      window.addEventListener("resize", onResize);

      // load model
      const loader = new (THREE as any).GLTFLoader();
      loader.load(MODEL, (gltf: any) => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) { setStatus("error"); setMsg("Modèle GLB vide."); return; }

        // Normalisation (échelle & centrage)
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3(); box.getSize(size);
        const scale = 0.9 / Math.max(0.001, size.length());
        root.scale.setScalar(scale);
        const c = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getCenter(c);
        root.position.sub(c);

        // Prépare un prototype à cloner pour chaque dé
        const proto = new THREE.Group();
        root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }});
        proto.add(root);

        // Récupère les ancres de faces si présentes
        const faces: { value:number; node:THREE.Object3D; normal:THREE.Vector3 }[] = [];
        const faceRegex = /(face[\s_]?|f_?)(1|3|4|6)/i;
        proto.traverse((o: any) => {
          const m = faceRegex.exec(o.name);
          if (m) {
            const v = Number(m[2]);
            faces.push({ value: v, node: o, normal: new THREE.Vector3(0,1,0) });
          }
        });
        // Si on a des ancres, calcule leur normale locale (y+ du nœud)
        if (faces.length) {
          faces.forEach(f => {
            const n = new THREE.Vector3(0, 1, 0);
            f.node.updateWorldMatrix(true, true);
            const mat = new THREE.Matrix3().setFromMatrix4(f.node.matrixWorld);
            f.normal = n.applyMatrix3(mat).normalize();
          });
        } else {
          // Fallback : 4 directions fixes (assez proches des 4 faces nominales)
          faces.push(
            { value:1, node: proto, normal: new THREE.Vector3( 0.3,  0.9,  0.1 ).normalize() },
            { value:3, node: proto, normal: new THREE.Vector3(-0.2,  0.95, 0.25).normalize() },
            { value:4, node: proto, normal: new THREE.Vector3( 0.2,  0.95,-0.25).normalize() },
            { value:6, node: proto, normal: new THREE.Vector3(-0.3,  0.9, -0.1).normalize() },
          );
        }
        facesRef.current = faces;

        // Crée 4 dés
        const dice: Die[] = [];
        for (let i = 0; i < 4; i++) {
          const g = proto.clone(true);
          scene.add(g);
          const d: Die = {
            root: g,
            pos: new THREE.Vector3((i - 1.5) * 0.35, 0.6 + i * 0.02, -0.25 + Math.random() * 0.5),
            vel: new THREE.Vector3(),
            quat: new THREE.Quaternion(),
            angVel: new THREE.Vector3(),
            radius: 0.17,
            asleep: false
          };
          g.position.copy(d.pos);
          dice.push(d);
        }
        diceRef.current = dice;

        setStatus("ready");
        setMsg("Prêt. Clique « Lancer » pour jeter les os.");
      }, undefined, (err: any) => {
        console.warn("[L3] GLB load error:", err);
        setStatus("error");
        setMsg("Impossible de charger le modèle (GLTF).");
      });

      // loop
      const loop = () => {
        stepPhysics(1/60);
        controlsRef.current?.update();
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);

      // cleanup
      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        ro.disconnect();
        window.removeEventListener("resize", onResize);
        rnd.dispose();
        wrap.removeChild(rnd.domElement);
      };
    }, []);

    // ===== Physique simple =====
    const GRAV = -9.81 * 0.25;           // gravité « douce »
    const RESTITUTION = 0.25;            // rebond
    const FRICTION = 0.98;               // frottement sol
    const AIR = 0.995;                   // amortissement air
    const SEP = 0.55;                    // séparation horizontale (anti-empilement)

    function stepPhysics(dt: number) {
      const dice = diceRef.current;
      if (!dice.length) return;

      let allAsleep = true;

      for (let i = 0; i < dice.length; i++) {
        const d = dice[i];

        // intégration simple (position)
        d.vel.y += GRAV * dt;

        d.pos.addScaledVector(d.vel, dt);
        // Rotation (approx. : Euler à partir d’angVel)
        const ang = d.angVel.clone().multiplyScalar(dt);
        const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(ang.x, ang.y, ang.z, "XYZ"));
        d.quat.multiply(dq);

        // Sol (y=0)
        if (d.pos.y < 0.0) {
          d.pos.y = 0.0;
          if (d.vel.y < 0) d.vel.y *= -RESTITUTION;
          d.vel.x *= FRICTION;
          d.vel.z *= FRICTION;
          d.angVel.multiplyScalar(0.96);
        }

        // Air drag
        d.vel.multiplyScalar(AIR);
        d.angVel.multiplyScalar(AIR);

        // Applique au mesh
        d.root.position.copy(d.pos);
        d.root.quaternion.copy(d.quat);

        // Snap quand quasi au repos
        const moving = (length2(d.vel) > 0.0003) || (length2(d.angVel) > 0.0003) || d.pos.y > 0.001;
        if (!moving && d.pos.y <= 0.001) {
          // Cherche la face la plus proche du +Y
          const best = faceUp(d.root);
          // ajuste doucement pour que la face soit à plat
          if (best) {
            const q = alignNormalToUp(best.normal.clone().applyQuaternion(d.root.quaternion));
            d.quat.slerp(q.multiply(d.quat), 0.2);
          }
          d.asleep = true;
        } else {
          d.asleep = false;
        }
        if (!d.asleep) allAsleep = false;
      }

      // Anti-empilement horizontal (simple séparation 2D dans le plan XZ)
      for (let i = 0; i < dice.length; i++) {
        for (let j = i + 1; j < dice.length; j++) {
          const a = dice[i], b = dice[j];
          const dx = b.pos.x - a.pos.x;
          const dz = b.pos.z - a.pos.z;
          const dist2 = dx*dx + dz*dz;
          const minD = (a.radius + b.radius) * SEP;
          if (dist2 < minD*minD) {
            const dist = Math.sqrt(dist2) || 0.0001;
            const nx = dx / dist, nz = dz / dist;
            const push = (minD - dist) * 0.5;
            a.pos.x -= nx * push; a.pos.z -= nz * push;
            b.pos.x += nx * push; b.pos.z += nz * push;
            // petit frottement latéral
            a.vel.x *= 0.95; a.vel.z *= 0.95;
            b.vel.x *= 0.95; b.vel.z *= 0.95;
          }
        }
      }

      // Score si tout est stoppé
      if (allAsleep && dice.length) {
        const values = dice.map(d => {
          const f = faceUp(d.root);
          return f ? f.value : 0;
        });
        setScore(values.reduce((s, v) => s + v, 0));
      } else if (score !== null) {
        setScore(null);
      }
    }

    function alignNormalToUp(n: THREE.Vector3) {
      // rotation qui amène n -> +Y
      const axis = new THREE.Vector3().crossVectors(n, UP);
      const dot = THREE.MathUtils.clamp(n.dot(UP), -1, 1);
      const angle = Math.acos(dot);
      if (axis.lengthSq() < 1e-6 || !isFinite(angle)) return new THREE.Quaternion(); // identité
      axis.normalize();
      return new THREE.Quaternion().setFromAxisAngle(axis, angle);
    }

    function faceUp(obj: THREE.Object3D) {
      // Compare les normales de faces au +Y dans le monde du dé
      let best: { value: number; normal: THREE.Vector3; dot: number } | null = null;
      for (const f of facesRef.current) {
        const wn = f.normal.clone().applyQuaternion(obj.quaternion).normalize();
        const d = wn.dot(UP);
        if (!best || d > best.dot) best = { value: f.value, normal: f.normal.clone(), dot: d };
      }
      return best;
    }

    // ===== Actions =====
    const throwDice = () => {
      const dice = diceRef.current;
      if (!dice.length) return;
      setScore(null);
      dice.forEach((d, i) => {
        d.pos.set((i - 1.5) * 0.32, 0.8 + Math.random()*0.2, -0.2 + Math.random()*0.4);
        d.vel.set((Math.random()-0.5)*0.8, 1.2 + Math.random()*0.4, (Math.random()-0.5)*0.8);
        d.quat.set(0,0,0,1);
        d.angVel.set((Math.random()-0.5)*8, (Math.random()-0.5)*8, (Math.random()-0.5)*8);
        d.asleep = false;
        d.root.position.copy(d.pos);
        d.root.quaternion.copy(d.quat);
      });
    };

    const reset = () => {
      const dice = diceRef.current;
      if (!dice.length) return;
      setScore(null);
      dice.forEach((d, i) => {
        d.pos.set((i-1.5)*0.35, 0.18, -0.25 + i*0.12);
        d.vel.set(0,0,0);
        d.quat.set(0,0,0,1);
        d.angVel.set(0,0,0);
        d.asleep = true;
        d.root.position.copy(d.pos);
        d.root.quaternion.copy(d.quat);
      });
    };

    return (
      <div ref={wrapRef} style={{ width:"100%", minHeight:"54vh", position:"relative" }}>
        <div style={hud()}>
          <strong>Rouler les os — Vénus, Canis, Senio…</strong>
          <span style={{opacity:.8}}>{status === "loading" ? "Chargement…" : "Faces {1,3,4,6}. Lance et lis les faces vers le haut."}</span>
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            <button onClick={throwDice} disabled={status!=="ready"} style={btnPrimary(status==="ready")}>Lancer</button>
            <button onClick={reset} disabled={status!=="ready"} style={btn()}>Réinitialiser</button>
            {score!==null && <span className="badge" style={badge()}>Score : {score}</span>}
          </div>
        </div>
      </div>
    );
  }

  // Styles HUD
  const hud = () => ({
    position: "absolute" as const,
    left: 12, top: 12, right: 12,
    display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between",
    padding: "8px 10px", borderRadius: 10,
    border: "1px solid #00000022", background: "rgba(255,255,255,.85)",
    color: "#0b2237", zIndex: 5
  });
  const btn = (disabled=false) => ({
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #223",
    background: "#0b1f33",
    color: "#e6f1ff",
    opacity: disabled ? .6 : 1,
    cursor: disabled ? "default" : "pointer"
  } as React.CSSProperties);
  const btnPrimary = (enabled=true) => ({
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: enabled ? "#2563eb" : "#445",
    color: "#fff",
    cursor: enabled ? "pointer" : "default"
  } as React.CSSProperties);
  const badge = () => ({
    border: "1px solid #223",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 14,
    background: "#0b1f33",
    color: "#e6f1ff"
  } as React.CSSProperties);

  (window as any).AstragalusLevel3 = AstragalusLevel3;
})();
