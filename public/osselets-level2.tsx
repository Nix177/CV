/* global React, THREE */
const { useEffect, useRef, useState } = React;

const L2_MODEL = "/assets/games/osselets/level2/3d/astragalus.glb";
const GREEK = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ".split("");

// --- helpers
function loadGLB(url) {
  return new Promise((resolve, reject) => {
    try {
      const loader = new THREE.GLTFLoader();
      loader.load(url, (g) => resolve(g), undefined, (e) => reject(e));
    } catch (e) { reject(e); }
  });
}

function fitToParent(renderer, camera, holder) {
  const ro = new ResizeObserver(() => {
    const w = holder.clientWidth;
    const h = holder.clientHeight || Math.max(360, Math.round(w * 9 / 16));
    holder.style.height = `${h}px`;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(holder);
  return ro;
}

// sprite lettre
function makeLetterSprite(char) {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  // disque bleu
  ctx.fillStyle = "#0ea5e9";
  ctx.beginPath(); ctx.arc(size/2, size/2, size*0.46, 0, Math.PI*2); ctx.fill();
  // lettre blanche
  ctx.fillStyle = "#fff";
  ctx.font = "bold 34px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(char, size/2, size/2);

  const tex = new THREE.CanvasTexture(c);
  const mtl = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true });
  const spr = new THREE.Sprite(mtl);
  spr.scale.setScalar(0.08); // taille fixe dans la scène
  spr.renderOrder = 2;
  return spr;
}

function OsseletsLevel2() {
  const holderRef = useRef(null);
  const canvasRef = useRef(null);
  const [hint, setHint] = useState({ word: "ΕΛΠΙΣ (ELPIS)", clue: "Espoir — bon présage." });

  useEffect(() => {
    const holder = holderRef.current;
    const canvas = canvasRef.current;
    if (!holder || !canvas) return;

    // scène de base
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07131f);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    camera.position.set(0.0, 0.35, 1.25);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;

    const ro = fitToParent(renderer, camera, holder);

    // lumière
    scene.add(new THREE.HemisphereLight(0xbfdcff, 0x101418, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(1.5, 1.2, 0.8);
    scene.add(key);

    // sol discret
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshStandardMaterial({ color: 0x0e1e2e, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.22;
    ground.receiveShadow = true;
    scene.add(ground);

    let mesh = null;
    const letters = []; // {anchor:Object3D, sprite:Sprite}

    (async () => {
      const glb = await loadGLB(L2_MODEL);

      // mesh principal
      glb.scene.traverse((n) => {
        if (n.isMesh && !mesh) mesh = n;
      });
      if (!mesh) throw new Error("Mesh non trouvé");
      mesh.castShadow = true;
      mesh.position.set(0, -0.05, 0);
      mesh.scale.setScalar(0.9);
      scene.add(mesh);

      // ancres "Hole_*"
      const anchors = [];
      glb.scene.traverse((n) => { if (/^Hole_/i.test(n.name)) anchors.push(n); });

      // une lettre par ancre (max 24)
      for (let i = 0; i < anchors.length && i < 24; i++) {
        const a = anchors[i];
        const s = makeLetterSprite(GREEK[i] || "?");
        s.userData.anchor = a;
        scene.add(s);
        letters.push({ anchor: a, sprite: s });
      }
    })().catch((e) => console.error("[L2] load fail:", e));

    // interaction: drag pour tourner l’osselet
    let dragging = false, last = new THREE.Vector2();
    function onDown(ev) {
      dragging = true;
      const x = ("touches" in ev ? ev.touches[0].clientX : ev.clientX);
      const y = ("touches" in ev ? ev.touches[0].clientY : ev.clientY);
      last.set(x, y);
      ev.preventDefault();
    }
    function onMove(ev) {
      if (!dragging || !mesh) return;
      const x = ("touches" in ev ? ev.touches[0].clientX : ev.clientX);
      const y = ("touches" in ev ? ev.touches[0].clientY : ev.clientY);
      const dx = (x - last.x) / (holder.clientWidth);
      const dy = (y - last.y) / (holder.clientHeight);
      last.set(x, y);
      // rotation douce
      mesh.rotation.y -= dx * Math.PI;
      mesh.rotation.x -= dy * Math.PI * 0.6;
      mesh.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, mesh.rotation.x));
    }
    function onUp() { dragging = false; }

    holder.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    holder.addEventListener("touchstart", onDown, { passive: false });
    holder.addEventListener("touchmove", onMove, { passive: false });
    holder.addEventListener("touchend", onUp);

    // boucle
    let raf;
    function loop() {
      // placer/masquer les lettres selon visibilité
      if (mesh && letters.length) {
        const qMesh = mesh.quaternion.clone();
        const camPos = camera.position.clone();
        for (const { anchor, sprite } of letters) {
          // position monde de l’ancre relative au mesh
          const wp = new THREE.Vector3().setFromMatrixPosition(anchor.matrixWorld);
          sprite.position.copy(wp);

          // normale locale de l’ancre (+Y) -> monde
          const n = new THREE.Vector3(0, 1, 0).applyQuaternion(qMesh.clone().multiply(anchor.quaternion)).normalize();
          const toCam = camPos.clone().sub(wp).normalize();
          const facing = n.dot(toCam); // >0 => vers caméra
          const visible = facing > 0.25; // cache l’arrière

          sprite.visible = visible;
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      holder.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      holder.removeEventListener("touchstart", onDown);
      holder.removeEventListener("touchmove", onMove);
      holder.removeEventListener("touchend", onUp);
    };
  }, []);

  return (
    <div>
      <div ref={holderRef} style={{
        width: "100%",
        height: "min(62vh, 560px)",
        borderRadius: 12,
        overflow: "hidden",
        background: "linear-gradient(180deg,#081726,#0a1a29)"
      }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 14, color: "#9fb9d6" }}>
        Mot : <b>{hint.word}</b><br/>
        Indice : {hint.clue}
      </div>
    </div>
  );
}

// @ts-ignore
window.OsseletsLevel2 = OsseletsLevel2;
