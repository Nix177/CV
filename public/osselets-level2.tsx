(() => {
  // ===== Minimal guards =====
  const T = window.THREE;
  if (!T) { console.error("[L2] THREE non disponible"); return; }
  const GLTFCls = window.GLTFLoader || (T && T.GLTFLoader);
  // ---------- Config ----------
  const MODEL_CANDIDATES = [
    "/assets/games/osselets/models/astragalus.glb",
    "/assets/games/osselets/3d/astragalus.glb",
    "/assets/games/osselets/audio/img/astragalus.glb",
  ];
  const BG_COLOR = 0xf7f6f3;
  const GROUND_COLOR = 0xe9e7e1;
  const LETTER_COLOR = "#0f172a";
  const LETTERS = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ".split(""); // 24

  // ---------- State ----------
  let _container = null, _renderer = null, _scene = null, _camera = null, _raf = 0;
  let _root = null, _bone = null, _drag = null, _ray = null, _mouse = null, _plane = null;
  let _resizeObs = null, _running = false, _modelUrl = null;

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
    r.setClearColor(BG_COLOR, 1);
    return r;
  }

  // simple orbit (drag = rotation caméra autour de cible)
  const orbit = {
    target: new T.Vector3(0, 0.1, 0),
    phi: Math.PI * 0.22,
    theta: Math.PI * 0.28,
    dist: 1.4,
    update() {
      const s = Math.max(0.6, Math.min(3.0, this.dist));
      const x = this.target.x + s * Math.sin(this.theta) * Math.cos(this.phi);
      const y = this.target.y + s * Math.sin(this.phi);
      const z = this.target.z + s * Math.cos(this.theta) * Math.cos(this.phi);
      _camera.position.set(x, y, z);
      _camera.lookAt(this.target);
    },
  };

  function addLights(scene) {
    scene.add(new T.AmbientLight(0xffffff, 0.75));
    const dir = new T.DirectionalLight(0xffffff, 1.0);
    dir.position.set(2, 3, 2);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);
  }

  // labels = sprites 2D dessinés sur canvas → depthTest ON pour être masqués par l’osselet
  function makeLetterSprite(char) {
    const cvs = document.createElement("canvas");
    const s = 256;
    cvs.width = cvs.height = s;
    const ctx = cvs.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = LETTER_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 180px ui-sans-serif, system-ui";
    ctx.fillText(char, s / 2, s / 2 + 6);
    const tex = new T.CanvasTexture(cvs);
    tex.anisotropy = 4;
    const mat = new T.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true });
    const sp = new T.Sprite(mat);
    sp.scale.set(0.08, 0.08, 0.08);
    return sp;
  }

  function placeLetters(scene) {
    const group = new T.Group();
    // cercle régulier + un léger bruit pour éviter chevauchement optique
    const R = 0.5;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const sp = makeLetterSprite(LETTERS[i]);
      const x = Math.cos(a) * R * 0.95;
      const z = Math.sin(a) * R * 0.95;
      sp.position.set(x, 0.001, z);
      group.add(sp);
    }
    scene.add(group);
  }

  function addGround(scene) {
    const g = new T.PlaneGeometry(4, 4);
    const m = new T.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 0.95, metalness: 0.0 });
    const mesh = new T.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    return mesh;
  }

  function loadFirst(urls) {
    return new Promise(async (resolve, reject) => {
      if (!GLTFCls) return reject(new Error("GLTFLoader indisponible"));
      const loader = new GLTFCls();
      let done = false;
      const tryUrl = (u) =>
        new Promise((ok, ko) => {
          loader.load(
            u,
            (g) => ok({ ok: true, g, u }),
            undefined,
            () => ok({ ok: false, u })
          );
        });
      for (const u of urls) {
        // eslint-disable-next-line no-await-in-loop
        const res = await tryUrl(u);
        if (res.ok) {
          done = true;
          resolve(res);
          break;
        }
      }
      if (!done) reject(new Error("loadFirst failed"));
    });
  }

  function attachDrag(mesh, plane) {
    _ray = new T.Raycaster();
    _mouse = new T.Vector2();
    _drag = {
      active: false,
      y: 0.08,
    };
    const dom = _renderer.domElement;
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    function ndc(ev) {
      const r = dom.getBoundingClientRect();
      _mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      _mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    }
    function onDown(ev) {
      ndc(ev);
      _ray.setFromCamera(_mouse, _camera);
      const it = _ray.intersectObject(mesh, true);
      if (it && it.length) {
        _drag.active = true;
      }
    }
    function onMove(ev) {
      if (!_drag.active) return;
      ndc(ev);
      _ray.setFromCamera(_mouse, _camera);
      const it = _ray.intersectObject(plane, true);
      if (it && it.length) {
        const p = it[0].point;
        mesh.position.x = p.x;
        mesh.position.z = p.z;
        mesh.position.y = _drag.y;
      }
    }
    function onUp() {
      _drag.active = false;
    }
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }

  function frame() {
    orbit.update();
    _renderer.render(_scene, _camera);
    if (_running) _raf = requestAnimationFrame(frame);
  }

  async function init(container) {
    _container = typeof container === "string" ? document.querySelector(container) : container;
    if (!_container) { console.error("[L2] container introuvable"); return; }

    // scene
    _scene = new T.Scene();
    _scene.fog = new T.Fog(BG_COLOR, 3, 8);

    _camera = new T.PerspectiveCamera(45, 16 / 9, 0.01, 100);
    _renderer = makeRenderer();
    _renderer.shadowMap.enabled = true;

    _container.innerHTML = "";
    _container.appendChild(_renderer.domElement);

    addLights(_scene);
    _root = new T.Group();
    _scene.add(_root);

    const ground = addGround(_scene);
    placeLetters(_scene);

    // plane pour le drag (XZ)
    _plane = new T.Mesh(
      new T.PlaneGeometry(10, 10),
      new T.MeshBasicMaterial({ visible: false })
    );
    _plane.rotation.x = -Math.PI / 2;
    _scene.add(_plane);

    // caméra
    orbit.dist = 1.35;
    orbit.phi = Math.PI * 0.28;
    orbit.theta = Math.PI * 0.28;
    orbit.target.set(0, 0.06, 0);

    fitRenderer();
    _resizeObs = new ResizeObserver(fitRenderer);
    _resizeObs.observe(_container);

    // modèle
    try {
      const urls = _modelUrl ? [_modelUrl] : MODEL_CANDIDATES;
      const { g } = await loadFirst(urls);
      _bone = g.scene || g.scenes?.[0];
      _bone.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material) {
            o.material.depthTest = true; // important pour masquer les lettres
            o.material.depthWrite = true;
            o.material.transparent = !!o.material.transparent;
          }
        }
      });
      // échelle & pose
      const box = new T.Box3().setFromObject(_bone);
      const size = box.getSize(new T.Vector3()).length();
      const scale = 0.18 / size;
      _bone.scale.setScalar(scale);
      _bone.position.set(0, 0.08, 0);
      _bone.rotation.set(0.25, 0.3, 0);
      _root.add(_bone);

      // drag
      const detach = attachDrag(_bone, _plane);
      _bone.userData._detachDrag = detach;
    } catch (e) {
      console.error("[L2] GLB load error", e);
    }

    _running = true;
    _raf = requestAnimationFrame(frame);
  }

  function stop() {
    _running = false;
    if (_raf) cancelAnimationFrame(_raf);
    if (_resizeObs && _container) { try { _resizeObs.unobserve(_container); } catch (_) {} }
    if (_bone?.userData?._detachDrag) _bone.userData._detachDrag();
    if (_renderer?.domElement?.parentNode) _renderer.domElement.parentNode.removeChild(_renderer.domElement);
    _renderer?.dispose?.();
    _scene = _camera = _renderer = _container = null;
  }

  // --------- Public API ---------
  window.OsseletsLevel2 = {
    start: init,
    stop,
    setModelUrl(u) { _modelUrl = u; },
  };
})();
