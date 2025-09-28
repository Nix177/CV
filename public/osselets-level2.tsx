/* L2 — osselets-level2.tsx (isolé) */
(() => {
  const ReactL2 = window.React;
  const { useEffect: useEffectL2, useRef: useRefL2, useState: useStateL2 } = ReactL2;

  // ---- Util: charger une seule fois les scripts UMD des "examples" de three ----
  function loadScriptOnceL2(id, src) {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) return resolve();
      const s = document.createElement("script");
      s.id = id; s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error("fail "+src));
      document.head.appendChild(s);
    });
  }
  async function ensureThreeExtrasL2() {
    if (!window.THREE) throw new Error("[L2] THREE global manquant (importe three.min.js avant).");
    const REV = window.THREE.REVISION || "158";
    const base = `https://unpkg.com/three@0.${REV}.0/examples/js`;
    const needs = [];
    if (!window.THREE.OrbitControls) needs.push(loadScriptOnceL2("__ex_orbit_l2", `${base}/controls/OrbitControls.js`));
    if (!window.THREE.GLTFLoader)    needs.push(loadScriptOnceL2("__ex_gltf_l2",   `${base}/loaders/GLTFLoader.js`));
    await Promise.all(needs);
  }

  // --- quelques chemins candidats pour ton modèle (tu peux en ajouter) ---
  const GLB_CANDIDATES_L2 = [
    "/assets/games/osselets/models/astragalus.glb",
    "/assets/games/osselets/3d/astragalus.glb",
    "/assets/osselets/astragalus.glb",
  ];

  function OsseletsLevel2() {
    const wrapRef   = useRefL2(null);
    const started   = useRefL2(false);
    const rendererR = useRefL2(null);
    const sceneR    = useRefL2(null);
    const cameraR   = useRefL2(null);
    const controlsR = useRefL2(null);
    const meshRef   = useRefL2(null);  // l’os
    const dragRef   = useRefL2({ dragging:false, plane:null, offset:new THREE.Vector3() });
    const animRef   = useRefL2({ req:0 });

    // labels grecs (24)
    const GREEK = "Α,Β,Γ,Δ,Ε,Ζ,Η,Θ,Ι,Κ,Λ,Μ,Ν,Ξ,Ο,Π,Ρ,Σ,Τ,Υ,Φ,Χ,Ψ,Ω".split(",");

    function makeTextSpriteL2(text) {
      const size = 128, c = document.createElement("canvas"); c.width = c.height = size;
      const ctx = c.getContext("2d"); ctx.clearRect(0,0,size,size);
      ctx.fillStyle = "#111"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.font = "bold 84px ui-sans-serif, system-ui";
      ctx.fillText(text, size/2, size/2);
      const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
      const spr = new THREE.Sprite(mat);
      spr.scale.set(0.14, 0.14, 1);
      return spr;
    }

    function fitRendererL2() {
      const wrap = wrapRef.current, renderer = rendererR.current, camera = cameraR.current;
      if (!wrap || !renderer || !camera) return;
      const w = wrap.clientWidth, h = wrap.clientHeight || Math.round(w * 9/16);
      renderer.setSize(w, h, false);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    }

    async function loadFirstL2(loader, paths) {
      for (const p of paths) {
        try { return await loader.loadAsync(p); } catch (e) {}
      }
      throw new Error("loadFirst failed");
    }

    useEffectL2(() => {
      if (started.current) return;
      started.current = true;

      let disposed = false;

      (async () => {
        await ensureThreeExtrasL2();

        const wrap = wrapRef.current;
        const scene = sceneR.current = new THREE.Scene();
        scene.background = new THREE.Color(0xf4f4f5);

        const camera = cameraR.current = new THREE.PerspectiveCamera(50, 16/9, 0.1, 100);
        camera.position.set(1.4, 0.9, 1.6);

        const renderer = rendererR.current = new THREE.WebGLRenderer({ antialias: true, alpha:false });
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        wrap.appendChild(renderer.domElement);

        const controls = controlsR.current = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.target.set(0, 0.16, 0);

        // lumières
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.9));
        const dir = new THREE.DirectionalLight(0xffffff, 1.1);
        dir.position.set(2,3,2); dir.castShadow = true; scene.add(dir);

        // sol
        const g = new THREE.PlaneGeometry(4, 2.4);
        const m = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: .95, metalness: 0 });
        const ground = new THREE.Mesh(g, m); ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

        // 24 “trous” : on pose des repères + lettres 3D (occlusion OK)
        const holes = new THREE.Group(); scene.add(holes);
        const cols = 6, rows = 4, sx = 0.20, sy = 0.20, ox = -((cols-1)*sx)/2, oy = -((rows-1)*sy)/2, y = 0.05;
        for (let r=0; r<rows; r++){
          for (let c=0; c<cols; c++){
            const i = r*cols + c;
            const spr = makeTextSpriteL2(GREEK[i]);
            spr.position.set(ox + c*sx, y + 0.001, oy + r*sy);
            holes.add(spr);
          }
        }

        // charge l’osselet (GLB)
        const loader = new THREE.GLTFLoader();
        let glb = null;
        try { glb = await loadFirstL2(loader, GLB_CANDIDATES_L2); }
        catch (e) { console.warn("[L2] gltfloader load fail:", e); }

        let bone = null;
        if (glb) {
          bone = glb.scene || glb.scenes?.[0];
          bone.traverse(n=>{ if (n.isMesh) { n.castShadow = true; n.material.depthTest = true; n.material.depthWrite = true; }});
          // taille / pose
          const s = 0.22;
          bone.scale.setScalar(s);
          bone.position.set(-0.6, 0.16, -0.2);
          bone.rotation.set(0, Math.PI*0.35, 0);
          scene.add(bone);
        } else {
          // fallback visuel
          const geo = new THREE.SphereGeometry(0.12, 32, 20);
          const mat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1 });
          bone = new THREE.Mesh(geo, mat); bone.castShadow = true; bone.position.set(-0.6, 0.12, -0.2);
          scene.add(bone);
        }
        meshRef.current = bone;

        // drag & drop simple (déplace dans le plan XZ)
        const ray = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -0.12);
        dragRef.current.plane = plane;

        const onDown = (ev) => {
          if (!meshRef.current) return;
          const rect = renderer.domElement.getBoundingClientRect();
          ndc.x = ((ev.clientX - rect.left) / rect.width)*2 - 1;
          ndc.y = -((ev.clientY - rect.top) / rect.height)*2 + 1;
          ray.setFromCamera(ndc, camera);
          const hits = ray.intersectObject(meshRef.current, true);
          if (hits.length) {
            const hit = hits[0];
            dragRef.current.dragging = true;
            const p = new THREE.Vector3();
            ray.ray.intersectPlane(plane, p);
            dragRef.current.offset.copy(p).sub(meshRef.current.position);
          }
        };
        const onMove = (ev) => {
          if (!dragRef.current.dragging) return;
          const rect = renderer.domElement.getBoundingClientRect();
          ndc.x = ((ev.clientX - rect.left) / rect.width)*2 - 1;
          ndc.y = -((ev.clientY - rect.top) / rect.height)*2 + 1;
          ray.setFromCamera(ndc, camera);
          const p = new THREE.Vector3();
          ray.ray.intersectPlane(plane, p);
          p.sub(dragRef.current.offset);
          // limite
          p.x = Math.max(-1.2, Math.min(1.2, p.x));
          p.z = Math.max(-0.8, Math.min(0.8, p.z));
          p.y = meshRef.current.position.y;
          meshRef.current.position.copy(p);
        };
        const onUp = ()=>{ dragRef.current.dragging=false; };

        renderer.domElement.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);

        // animation
        const clock = new THREE.Clock();
        const frame = () => {
          const dt = clock.getDelta();
          controls.update();
          renderer.render(scene, camera);
          animRef.current.req = requestAnimationFrame(frame);
        };
        fitRendererL2();
        const ro = new ResizeObserver(fitRendererL2); ro.observe(wrap);
        animRef.current.req = requestAnimationFrame(frame);

        // hook global éventuel pour un bouton “Lancer”
        window.L2_throw = () => {
          if (!meshRef.current) return;
          // petite impulsion et rotation
          meshRef.current.position.y = 0.25;
          meshRef.current.rotation.x += 0.6 + Math.random()*0.8;
          meshRef.current.rotation.y += 0.6 + Math.random()*0.8;
          meshRef.current.rotation.z += 0.6 + Math.random()*0.8;
        };

        // cleanup
        return () => {
          try { ro.disconnect(); } catch {}
          cancelAnimationFrame(animRef.current.req);
          renderer.domElement.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          renderer.dispose();
          wrap.removeChild(renderer.domElement);
        };
      })();

      return () => {
        if (disposed) return;
        disposed = true;
      };
    }, []);

    // le conteneur prend toute la place disponible
    return (
      <div ref={wrapRef} style={{position:"relative", width:"100%", height:"min(70vh, 720px)", border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden"}} />
    );
  }

  // export global pour ton HTML
  window.OsseletsLevel2 = OsseletsLevel2;
})();
