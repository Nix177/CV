(() => {
  const T = window.THREE;
  if (!T) { console.error("[L3] THREE non disponible"); return; }
  const GLTFCls = window.GLTFLoader || (T && T.GLTFLoader);

  // ---------- Config ----------
  const MODEL_CANDIDATES = [
    "/assets/games/osselets/models/astragalus.glb",
    "/assets/games/osselets/3d/astragalus.glb",
    "/assets/games/osselets/audio/img/astragalus.glb",
  ];
  const BG = 0xf7f6f3;
  const GROUND = 0xe9e7e1;
  const COUNT = 4; // mets 5 si tu veux 5 osselets
  const FACE_VALUES = [1, 3, 4, 6]; // 4 faces “stables”

  // ---------- State ----------
  let _container = null, _renderer = null, _scene = null, _camera = null, _raf = 0;
  let _resizeObs = null, _running = false, _modelUrl = null;
  let _root = null, _bones = [], _scoreEl = null;

  // physique simplifiée
  function mkBody(mesh) {
    return {
      mesh,
      v: new T.Vector3(0, 0, 0), // vitesse
      w: new T.Vector3(0, 0, 0), // vitesse angulaire (rad/s) autour x/y/z
      settled: false,
      settleTimer: 0,
      radius: 0.06,
    };
  }

  function fitRenderer() {
    if (!_container || !_renderer) return;
    const w = _container.clientWidth || 800;
    const h = _container.clientHeight || 450;
    _renderer.setSize(w, h, false);
    _camera.aspect = w / h;
    _camera.updateProjectionMatrix();
  }
  function makeRenderer() {
    const r = new T.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setClearColor(BG, 1);
    r.shadowMap.enabled = true;
    return r;
  }
  function addLights(scene) {
    scene.add(new T.AmbientLight(0xffffff, 0.7));
    const d = new T.DirectionalLight(0xffffff, 1.0);
    d.position.set(2, 3, 2);
    d.castShadow = true;
    d.shadow.mapSize.set(1024, 1024);
    scene.add(d);
    const h = new T.HemisphereLight(0xffffff, 0x999999, 0.4);
    scene.add(h);
  }
  function addGround(scene) {
    const g = new T.PlaneGeometry(4, 4);
    const m = new T.MeshStandardMaterial({ color: GROUND, roughness: 0.95, metalness: 0.0 });
    const mesh = new T.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
  }

  function makeScoreEl() {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.right = "10px";
    el.style.top = "10px";
    el.style.font = "600 14px ui-sans-serif, system-ui";
    el.style.background = "rgba(255,255,255,.85)";
    el.style.border = "1px solid #e5e7eb";
    el.style.borderRadius = "10px";
    el.style.padding = "8px 10px";
    el.style.boxShadow = "0 2px 8px rgba(0,0,0,.06)";
    el.textContent = "Score: –";
    return el;
  }

  function faceUpIndex(q) {
    // “snap” vers 4 orientations cibles (à plat sur une face)
    // cibles = rotations autour X ou Z par quarts de tour depuis l’orientation de base
    const targets = [
      new T.Quaternion().setFromEuler(new T.Euler(0, 0, 0)),
      new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0)),
      new T.Quaternion().setFromEuler(new T.Euler(Math.PI, 0, 0)),
      new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0)),
    ];
    let best = 0, bestDot = -1;
    for (let i = 0; i < targets.length; i++) {
      const d = Math.abs(q.dot(targets[i])); // proximité quaternion
      if (d > bestDot) { bestDot = d; best = i; }
    }
    return best; // 0..3
  }

  function snapToStable(body) {
    const m = body.mesh;
    const qi = faceUpIndex(m.quaternion.clone());
    const target = [
      new T.Quaternion().setFromEuler(new T.Euler(0, 0, 0)),
      new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0)),
      new T.Quaternion().setFromEuler(new T.Euler(Math.PI, 0, 0)),
      new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0)),
    ][qi];
    m.quaternion.slerp(target, 0.4);
    // recoller sur le sol
    m.position.y = 0.06;
    return qi;
  }

  function resolvePairs(bodies) {
    // repousser latéralement si chevauchement (approx. sphères)
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const A = bodies[i], B = bodies[j];
        const pa = A.mesh.position, pb = B.mesh.position;
        const dx = pb.x - pa.x, dz = pb.z - pa.z;
        const dist2 = dx * dx + dz * dz;
        const minD = A.radius + B.radius;
        if (dist2 < (minD * minD)) {
          const d = Math.max(0.001, Math.sqrt(dist2));
          const nx = dx / d, nz = dz / d;
          const overlap = minD - d;
          pa.x -= nx * (overlap * 0.5);
          pa.z -= nz * (overlap * 0.5);
          pb.x += nx * (overlap * 0.5);
          pb.z += nz * (overlap * 0.5);
        }
      }
    }
  }

  function throwBones() {
    // réinitialiser
    _bones.forEach((b) => _root.remove(b.mesh));
    _bones.length = 0;

    const area = 0.6;
    for (let i = 0; i < COUNT; i++) {
      const base = _root.userData._astragalus;
      const mesh = base.clone(true);
      mesh.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      mesh.position.set(
        (Math.random() - 0.5) * area,
        0.4 + Math.random() * 0.2,
        (Math.random() - 0.5) * area
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      _root.add(mesh);

      const body = mkBody(mesh);
      body.v.set((Math.random() - 0.5) * 0.6, 0.0, (Math.random() - 0.5) * 0.6);
      body.w.set((Math.random() - 0.5) * 6.0, (Math.random() - 0.5) * 6.0, (Math.random() - 0.5) * 6.0);
      _bones.push(body);
    }
  }

  function step(dt) {
    // simple intégration
    const g = -4.5; // gravité
    for (const b of _bones) {
      if (!b.settled) {
        b.v.y += g * dt;
        b.mesh.position.addScaledVector(b.v, dt);
        // sol
        if (b.mesh.position.y < 0.06) {
          b.mesh.position.y = 0.06;
          b.v.y *= -0.25; // rebond amorti
          b.v.x *= 0.85; b.v.z *= 0.85;
          b.w.multiplyScalar(0.7);
        }
        // friction
        b.v.x *= 0.993; b.v.z *= 0.993;
        // rotation
        const e = new T.Euler(b.w.x * dt, b.w.y * dt, b.w.z * dt, "XYZ");
        b.mesh.quaternion.multiply(new T.Quaternion().setFromEuler(e));

        // near rest ?
        const lin = Math.hypot(b.v.x, b.v.y, b.v.z);
        const ang = Math.hypot(b.w.x, b.w.y, b.w.z);
        if (lin < 0.03 && ang < 0.6) {
          b.settleTimer += dt;
          if (b.settleTimer > 0.25) {
            b.settled = true;
            // snap progressif
            snapToStable(b);
          }
        } else {
          b.settleTimer = 0;
        }
      }
    }
    // glissement latéral si contact
    resolvePairs(_bones);

    // si tout posé → score
    if (_bones.length && _bones.every((b) => b.settled)) {
      let total = 0;
      for (const b of _bones) {
        const idx = faceUpIndex(b.mesh.quaternion.clone());
        total += FACE_VALUES[idx];
      }
      if (_scoreEl) _scoreEl.textContent = `Score: ${total}`;
    } else {
      if (_scoreEl) _scoreEl.textContent = "Score: …";
    }
  }

  function frame(t) {
    const dt = Math.min(1 / 30, (_renderer.clock?.getDelta?.() ?? 0.016));
    step(dt);
    _renderer.render(_scene, _camera);
    if (_running) _raf = requestAnimationFrame(frame);
  }

  async function init(container) {
    _container = typeof container === "string" ? document.querySelector(container) : container;
    if (!_container) { console.error("[L3] container introuvable"); return; }

    _scene = new T.Scene();
    _scene.fog = new T.Fog(BG, 3, 8);

    _camera = new T.PerspectiveCamera(45, 16 / 9, 0.01, 100);
    _renderer = makeRenderer();
    _renderer.clock = new T.Clock();

    _container.innerHTML = "";
    _container.appendChild(_renderer.domElement);
    _scoreEl = makeScoreEl();
    _container.appendChild(_scoreEl);

    addLights(_scene);
    addGround(_scene);

    // caméra
    _camera.position.set(1.1, 0.9, 1.1);
    _camera.lookAt(0, 0.05, 0);

    // resize
    fitRenderer();
    _resizeObs = new ResizeObserver(fitRenderer);
    _resizeObs.observe(_container);

    _root = new T.Group();
    _scene.add(_root);

    // charge modèle une fois
    try {
      if (!GLTFCls) throw new Error("GLTFLoader indisponible");
      const loader = new GLTFCls();
      const urls = _modelUrl ? [_modelUrl] : MODEL_CANDIDATES;
      const base = await new Promise(async (resolve, reject) => {
        let ok = null;
        for (const u of urls) {
          // eslint-disable-next-line no-await-in-loop
          ok = await new Promise((o) =>
            loader.load(u, (g) => o({ g, u }), undefined, () => o(null))
          );
          if (ok) break;
        }
        if (!ok) reject(new Error("load fail")); else resolve(ok.g);
      });
      const astr = (base.scene || base.scenes?.[0]).clone(true);
      astr.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = true;
          if (o.material) { o.material.depthTest = true; o.material.depthWrite = true; }
        }
      });
      // scale to ~12cm diag
      const box = new T.Box3().setFromObject(astr);
      const size = box.getSize(new T.Vector3()).length();
      const scale = 0.18 / size;
      astr.scale.setScalar(scale);
      astr.position.set(0, 0.06, 0);
      _root.userData._astragalus = astr;

      // premier lancer
      throwBones();
    } catch (e) {
      console.error("[L3] GLB load error:", e);
    }

    _running = true;
    _raf = requestAnimationFrame(frame);
  }

  function stop() {
    _running = false;
    if (_raf) cancelAnimationFrame(_raf);
    if (_resizeObs && _container) { try { _resizeObs.unobserve(_container); } catch (_) {} }
    if (_renderer?.domElement?.parentNode) _renderer.domElement.parentNode.removeChild(_renderer.domElement);
    if (_scoreEl?.parentNode) _scoreEl.parentNode.removeChild(_scoreEl);
    _renderer?.dispose?.();
    _scene = _camera = _renderer = _container = _scoreEl = null;
    _bones.length = 0;
  }

  // --------- Public API ---------
  window.OsseletsLevel3 = {
    start: init,
    stop,
    roll() { if (_root?.userData?._astragalus) throwBones(); },
    setModelUrl(u) { _modelUrl = u; },
  };
})();
