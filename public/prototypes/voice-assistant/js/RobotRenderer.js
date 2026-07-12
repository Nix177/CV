export class RobotRenderer {
  constructor({ THREE = globalThis.THREE, container, robot, controller, fallback }) {
    this.THREE = THREE;
    this.container = container;
    this.robot = robot;
    this.controller = controller;
    this.fallback = fallback;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.frameId = 0;
    this.clock = null;
    this.visible = true;
    this.paused = false;
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.listeners = [];
    this.lights = {};
    this.cameraPosition = { x: 0, y: 0.58, z: 8.05 };
  }

  init() {
    if (!this.THREE || !this.container || !this.canUseWebGL()) {
      this.showFallback();
      return false;
    }

    try {
      const THREE = this.THREE;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      this.camera.position.set(this.cameraPosition.x, this.cameraPosition.y, this.cameraPosition.z);
      this.camera.lookAt(0, 0.42, 0);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.88;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.container.appendChild(this.renderer.domElement);

      this.scene.add(this.robot.root);
      this.createLighting();
      this.createGroundShadow();
      this.bindObservers();
      this.resize();
      this.clock = new THREE.Clock();
      this.render();
      return true;
    } catch (error) {
      console.error("Robot renderer initialization failed", error);
      this.showFallback();
      return false;
    }
  }

  canUseWebGL() {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(globalThis.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
    } catch {
      return false;
    }
  }

  createLighting() {
    const THREE = this.THREE;
    const ambient = new THREE.HemisphereLight(0xf5f2e8, 0x5f6770, 1.25);
    ambient.name = "StudioAmbient";

    const key = new THREE.DirectionalLight(0xfff5df, 2.45);
    key.name = "StudioKey";
    key.position.set(4.6, 6.5, 6.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;

    const fill = new THREE.DirectionalLight(0xa7dff2, 1.15);
    fill.name = "StudioFill";
    fill.position.set(-5.5, 3.4, 4.2);

    const rim = new THREE.DirectionalLight(0xb7d8e2, 1.75);
    rim.name = "StudioRim";
    rim.position.set(3.2, 4.6, -5.8);

    this.lights = { ambient, key, fill, rim };
    this.scene.add(ambient, key, fill, rim);
  }

  createGroundShadow() {
    const THREE = this.THREE;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 48),
      new THREE.ShadowMaterial({ color: 0x1d2328, opacity: 0.18 })
    );
    ground.name = "GroundShadow";
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -1.15, 0.05);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  bindObservers() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.visible = Boolean(entries[0]?.isIntersecting);
    }, { threshold: 0.02 });
    this.intersectionObserver.observe(this.container);

    const onVisibility = () => {
      this.paused = document.hidden;
      if (!this.paused && this.clock) this.clock.getDelta();
    };
    document.addEventListener("visibilitychange", onVisibility);
    this.listeners.push([document, "visibilitychange", onVisibility]);

    const onPointerMove = (event) => {
      const rect = this.container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
      this.controller.setPointerTarget(x, y);
    };
    const onPointerLeave = () => this.controller.setPointerTarget(0, 0);
    this.container.addEventListener("pointermove", onPointerMove, { passive: true });
    this.container.addEventListener("pointerleave", onPointerLeave, { passive: true });
    this.listeners.push([this.container, "pointermove", onPointerMove], [this.container, "pointerleave", onPointerLeave]);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setCameraPosition(patch) {
    Object.assign(this.cameraPosition, patch);
    if (!this.camera) return;
    this.camera.position.set(this.cameraPosition.x, this.cameraPosition.y, this.cameraPosition.z);
    this.camera.lookAt(0, 0.42, 0);
  }

  setLightIntensity(name, value) {
    if (this.lights[name]) this.lights[name].intensity = Number(value);
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  render = () => {
    this.frameId = requestAnimationFrame(this.render);
    if (!this.renderer || this.paused || !this.visible) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.controller.update(delta, this.clock.elapsedTime);
    this.renderer.render(this.scene, this.camera);
  };

  showFallback() {
    if (this.fallback) this.fallback.hidden = false;
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    for (const [target, type, listener] of this.listeners) target.removeEventListener(type, listener);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
