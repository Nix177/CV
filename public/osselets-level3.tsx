/* L3 — osselets-level3.tsx (isolé) */
(() => {
  const ReactL3 = window.React;
  const { useEffect: useEffectL3, useRef: useRefL3, useState: useStateL3 } = ReactL3;

  // ---- charge UMD examples de three (une seule fois) ----
  function loadScriptOnceL3(id, src) {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) return resolve();
      const s = document.createElement("script");
      s.id = id; s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error("fail "+src));
      document.head.appendChild(s);
    });
  }
  async function ensureThreeExtrasL3() {
    if (!window.THREE) throw new Error("[L3] THREE global manquant (importe three.min.js avant).");
    const REV = window.THREE.REVISION || "158";
    const base = `https://unpkg.com/three@0.${REV}.0/examples/js`;
    const needs = [];
    if (!window.THREE.OrbitControls) needs.push(loadScriptOnceL3("__ex_orbit_l3", `${base}/controls/OrbitControls.js`));
    if (!window.THREE.GLTFLoader)    needs.push(loadScriptOnceL3("__ex_gltf_l3",   `${base}/loaders/GLTFLoader.js`));
    await Promise.all(needs);
  }

  const GLB_CANDIDATES_L3 = [
    "/assets/games/osselets/models/astragalus.glb",
    "/assets/games/osselets/3d/astragalus.glb",
    "/assets/osselets/astragalus.glb",
  ];

  // valeurs “romaines” sans 2 ni 5 : associe 4 faces (±Y, ±X)
  const FACE_MAP = [
    { name:"pranes(+Y)",  n:new THREE.Vector3(0, 1, 0), val:4 },
    { name:"huption(-Y)", n:new THREE.Vector3(0,-1, 0), val:3 },
    { name:"ischia(+X)",  n:new THREE.Vector3(1, 0, 0), val:1 },
    { name:"kôla(-X)",    n:new THREE.Vector3(-1,0, 0), val:6 },
  ];

  function OsseletsLevel3() {
    const wrapRef   = useRefL3(null);
    const rendererR = useRefL3(null);
    const sceneR    = useRefL3(null);
    const cameraR   = useRefL3(null);
    const controlsR = useRefL3(null);
    const animRef   = useRefL3({ req:0 });
    const [score, setScore] = useStateL3({ sum:0, by:[] });

    // petit “moteur” maison sur sol (pas d’empilement, glisse)
    const bodiesRef = useRefL3([]);

    function fitRendererL3() {
      const wrap = wrapRef.current, renderer = rendererR.current, camera = cameraR.current;
      if (!wrap || !renderer || !camera) return;
      const w = wrap.clientWidth, h = wrap.clientHeight || Math.round(w * 9/16);
      renderer.setSize(w, h, false);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    }

    async function loadFirstL3(loader, paths) {
      for (const p of paths) {
        try { return await loader.loadAsync(p); } catch (e) {}
      }
      throw new Error("loadFirst failed");
    }

    function computeFaceValue(obj) {
      // choisit la face dont la normale (locale) est la plus proche de +Y monde
      const up = new THREE.Vector3(0,1,0);
      const q = obj.quaternion.clone();
      let best = { dot:-1, val:0, name:"" };
      for (const f of FACE_MAP) {
        const n = f.n.clone().applyQuaternion(q);
        const d = n.dot(up);
        if (d > best.dot) best = { dot:d, val:f.val, name:f.name };
      }
      return best;
    }

    useEffectL3(() => {
      let stop = false;

      (async () => {
        await ensureThreeExtrasL3();

        const wrap = wrapRef.current;
        const scene = sceneR.current = new THREE.Scene();
        scene.background = new THREE.Color(0xf6f6f6);

        const camera = cameraR.current = new THREE.PerspectiveCamera(55, 16/9, 0.05, 100);
        camera.position.set(2.0, 1.6, 2.4);

        const renderer = rendererR.current = new THREE.WebGLRenderer({ antialias:true });
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        wrap.appendChild(renderer.domElement);

        const controls = controlsR.current = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.target.set(0,0.22,0);

        // lumières
        scene.add(new THREE.HemisphereLight(0xffffff, 0x99aabb, 0.9));
        const sun = new THREE.DirectionalLight(0xffffff, 1.1);
        sun.position.set(3,4,2); sun.castShadow = true; scene.add(sun);

        // sol
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(6, 4),
          new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: .95, metalness: 0 })
        );
        ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

        // charge le GLB
        const loader = new THREE.GLTFLoader();
        let glb = null;
        try { glb = await loadFirstL3(loader, GLB_CANDIDATES_L3); }
        catch (e) { console.warn("[L3] GLB load error:", e); }

        const proto = glb ? (glb.scene || glb.scenes?.[0]) : new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 32, 20),
          new THREE.MeshStandardMaterial({ color: 0xd6d3d1 })
        );
        proto.traverse?.(n=>{ if (n.isMesh) { n.castShadow = true; n.material.depthTest=true; n.material.depthWrite=true; }});

        // crée 4 osselets
        const N = 4;
        const bodies = [];
        for (let i=0;i<N;i++){
          const inst = proto.clone(true);
          const s = 0.22; inst.scale.setScalar(s);
          scene.add(inst);
          // état physique simplifié
          bodies.push({
            obj: inst,
            pos: new THREE.Vector3(-0.8 + i*0.55, 0.9 + 0.15*i, -0.3 + 0.12*i),
            vel: new THREE.Vector3(0,0,0),
            ang: new THREE.Vector3(0,0,0),
            angVel: new THREE.Vector3(0,0,0),
            r: 0.15, // rayon approx pour collision au sol
            asleep: false
          });
        }
        bodiesRef.current = bodies;

        // fonction lancer
        const throwAll = () => {
          const rnd = (a,b)=> a + Math.random()*(b-a);
          for (const b of bodiesRef.current){
            b.pos.set(rnd(-0.6,0.6), rnd(0.8,1.2), rnd(-0.4,0.4));
            b.vel.set(rnd(-0.3,0.3), rnd(0.8,1.6), rnd(-0.3,0.3));
            b.ang.set(rnd(0,Math.PI*2), rnd(0,Math.PI*2), rnd(0,Math.PI*2));
            b.angVel.set(rnd(-4,4), rnd(-4,4), rnd(-4,4));
            b.asleep = false;
            b.obj.position.copy(b.pos);
            b.obj.rotation.set(b.ang.x, b.ang.y, b.ang.z);
          }
        };
        // exposé pour ton bouton “Lancer”
        window.L3_throw = throwAll;

        // au chargement : un lancer
        throwAll();

        // simulation
        const tmpQ = new THREE.Quaternion();
        const clock = new THREE.Clock();

        function step(dt) {
          const g = -9.8, floorY = 0; // sol y=0
          const REST = 0.35, FRICTION = 0.86;

          // intégration
          for (const b of bodiesRef.current){
            if (b.asleep) continue;
            // vitesses
            b.vel.y += g * dt;
            b.pos.addScaledVector(b.vel, dt);
            b.ang.addScaledVector(b.angVel, dt);

            // collision sol (glisse, pas d’empilement)
            if (b.pos.y - b.r < floorY){
              b.pos.y = floorY + b.r;
              b.vel.y = -b.vel.y * REST;
              b.vel.x *= FRICTION; b.vel.z *= FRICTION;
              b.angVel.x *= 0.92; b.angVel.y *= 0.92; b.angVel.z *= 0.92;
              // arrêt si très lent
              const sp = Math.hypot(b.vel.x,b.vel.y,b.vel.z);
              const asp = Math.hypot(b.angVel.x,b.angVel.y,b.angVel.z);
              if (sp < 0.15 && asp < 0.6) {
                b.vel.set(0,0,0); b.angVel.set(0,0,0);
                // snap à la face la plus proche
                const obj = b.obj;
                obj.rotation.set(b.ang.x, b.ang.y, b.ang.z);
                const best = computeFaceValue(obj);
                // on oriente cette face “vers le haut”
                // trouve la rot delta qui aligne la normale sur +Y
                const from = FACE_MAP.find(f=>f.val===best.val).n.clone().applyQuaternion(obj.quaternion);
                const to = new THREE.Vector3(0,1,0);
                const axis = new THREE.Vector3().crossVectors(from, to).normalize();
                const angle = Math.acos(Math.max(-1, Math.min(1, from.dot(to))));
                tmpQ.setFromAxisAngle(axis, angle);
                obj.quaternion.premultiply(tmpQ);
                b.asleep = true;
              }
            }

            // pas d’empilement : résolution 2D simple (XZ)
            for (const b2 of bodiesRef.current){
              if (b===b2) continue;
              const dx = b.pos.x - b2.pos.x, dz = b.pos.z - b2.pos.z;
              const dist2 = dx*dx + dz*dz, min = (b.r + b2.r)*1.05;
              if (dist2 > 0 && dist2 < min*min){
                const d = Math.sqrt(dist2) || 1e-3;
                const nx = dx/d, nz = dz/d, push = (min - d) * 0.5;
                b.pos.x += nx*push; b.pos.z += nz*push;
                b2.pos.x -= nx*push; b2.pos.z -= nz*push;
              }
            }

            // applique aux meshes
            b.obj.position.copy(b.pos);
            b.obj.rotation.set(b.ang.x, b.ang.y, b.ang.z);
          }

          // scores quand tout dort
          if (bodiesRef.current.every(b=>b.asleep)) {
            const by = bodiesRef.current.map(b => computeFaceValue(b.obj).val);
            const sum = by.reduce((a,b)=>a+b,0);
            setScore({ sum, by });
          } else {
            setScore(s => (s.by.length ? { sum:0, by:[] } : s));
          }
        }

        const frame = () => {
          const dt = Math.min(0.033, clock.getDelta());
          controls.update();
          step(dt);
          renderer.render(scene, camera);
          animRef.current.req = requestAnimationFrame(frame);
        };

        fitRendererL3();
        const ro = new ResizeObserver(fitRendererL3); ro.observe(wrap);
        animRef.current.req = requestAnimationFrame(frame);

        return () => {
          try{ ro.disconnect(); }catch{}
          cancelAnimationFrame(animRef.current.req);
          renderer.dispose();
          wrap.removeChild(renderer.domElement);
        };
      })();

      return () => { stop = true; };
    }, []);

    return (
      <div ref={wrapRef} style={{position:"relative", width:"100%", height:"min(72vh, 760px)", border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden"}}>
        {/* overlay score */}
        <div style={{position:"absolute", left:10, top:10, padding:"8px 10px", background:"#ffffffcc", border:"1px solid #e5e7eb", borderRadius:10, fontSize:14}}>
          <div><strong>Score</strong>: {score.by.length ? score.sum : "—"}</div>
          {score.by.length ? <div>Faces: {score.by.join(" + ")}</div> : <div>Cliquer “Lancer” pour jeter</div>}
        </div>
      </div>
    );
  }

  // export global
  window.OsseletsLevel3 = OsseletsLevel3;
})();
