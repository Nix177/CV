// public/osselets-level3.tsx
// LEVEL 3 — Astragalus 3D (dés 1/3/4/6)
// - Charge : /assets/games/osselets/level3/3d/astragalus_faces.glb
// - Duplique 4 osselets, “lance”, laisse rebondir, puis lit la face supérieure
// - Détermination de la face "haut" par ORIENTATION de l’ancre (Y local -> +Y monde)

;(() => {
  const { useEffect, useRef, useState } = React;

  const L3_BASE = "/assets/games/osselets/level3/";
  const MODEL_URL_L3 = L3_BASE + "3d/astragalus_faces.glb";
  const VALUES_URL_L3 = L3_BASE + "3d/values.json";

  const W3 = 960, H3 = 540, DPR3_MAX = 2.5;

  const COUNT = 4;
  const FLOOR_Y = 0;
  const GRAV = -14.5;
  const REST = 0.45;
  const FRIC = 0.92;
  const AFRIC = 0.94;
  const EPS = 0.18;
  const STABLE_MS = 800;

  /* -------------------- Utils -------------------- */
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function now(){ return (typeof performance!=="undefined" ? performance : Date).now(); }
  async function getJSON(u){ try{ const r=await fetch(u,{cache:"no-store"}); if(r.ok) return await r.json(); }catch{} return null; }

  /*  Orientation-based “up face”.
      On choisit l’ancre dont l’axe +Y le plus aligné sur +Y monde (dot max).
  */
  function findTopByOrientation(anchors, THREE){
    if (!anchors?.length) return null;
    const upWorld = new THREE.Vector3(0,1,0);
    let bestTag=null, bestDot=-1e9;
    const q = new THREE.Quaternion();
    const y = new THREE.Vector3(0,1,0);
    for (const a of anchors){
      a.node.getWorldQuaternion(q);
      const yWorld = y.clone().applyQuaternion(q).normalize();
      const d = yWorld.dot(upWorld);
      if (d > bestDot){ bestDot = d; bestTag = a.tag; }
    }
    return bestTag;
  }

  function extractAnchorsFaces(root){
    const out=[];
    root.traverse(n=>{
      const nm=(n.name||"").toLowerCase();
      let tag=null;
      if (/^face[_\s-]?1$|^f1$|value[_\s-]?1$|valeur[_\s-]?1$/.test(nm)) tag="1";
      else if (/^face[_\s-]?3$|^f3$|value[_\s-]?3$|valeur[_\s-]?3$/.test(nm)) tag="3";
      else if (/^face[_\s-]?4$|^f4$|value[_\s-]?4$|valeur[_\s-]?4$/.test(nm)) tag="4";
      else if (/^face[_\s-]?6$|^f6$|value[_\s-]?6$|valeur[_\s-]?6$/.test(nm)) tag="6";
      if (tag) out.push({ node:n, tag });
    });
    return out;
  }

  /* -------------------- Component -------------------- */
  function AstragalusLevel3(){
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);

    const [ready, setReady] = useState(false);
    const [throwing, setThrowing] = useState(false);
    const [vals, setVals] = useState([]);
    const [msg, setMsg] = useState("Lance 4 astragales (faces 1/3/4/6) et lis la face vers le haut.");

    // 3D refs
    const THREEref = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const modelRef = useRef(null);
    const diceRef = useRef([]); // {root, anchors, vel, angVel, stableSince}
    const lastRef = useRef(0);
    const reqRef = useRef(0);
    const mapRef = useRef(null);

    /* ------------- Resize ------------- */
    useEffect(()=>{
      function onResize(){
        const THREE = window.THREE; if(!THREE) return;
        const wrap=wrapRef.current, canvas=canvasRef.current, renderer=rendererRef.current, cam=cameraRef.current;
        if (!wrap || !canvas || !renderer || !cam) return;
        const w = Math.max(320, wrap.clientWidth|0);
        const h = Math.round(w * (H3/W3));
        const dpr = clamp(window.devicePixelRatio||1, 1, DPR3_MAX);
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        canvas.style.width=w+"px"; canvas.style.height=h+"px";
        cam.aspect = w/h; cam.updateProjectionMatrix();
      }
      onResize();
      const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener("resize", onResize);
      return ()=>{ if (ro) ro.disconnect(); window.removeEventListener("resize", onResize); };
    }, []);

    /* ------------- Init 3D ------------- */
    useEffect(()=>{
      const THREE = window.THREE;
      const GLTFLoader = THREE?.GLTFLoader || window.GLTFLoader;
      if (!THREE || !GLTFLoader){
        setMsg("Three.js ou GLTFLoader manquant.");
        return;
      }
      THREEref.current = THREE;

      // Renderer
      const canvas = canvasRef.current;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      rendererRef.current = renderer;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf5f7fb);
      sceneRef.current = scene;

      // Camera
      const cam = new THREE.PerspectiveCamera(45, 16/9, 0.1, 100);
      cam.position.set(6.4, 4.7, 7.4);
      cam.lookAt(0, 0.7, 0);
      cameraRef.current = cam;

      // Lights
      const hemi = new THREE.HemisphereLight(0xffffff, 0x334466, .7); scene.add(hemi);
      const dir  = new THREE.DirectionalLight(0xffffff, 1.0);
      dir.position.set(4,7,6);
      dir.castShadow = true;
      dir.shadow.mapSize.set(1024,1024);
      dir.shadow.camera.near=0.5; dir.shadow.camera.far=30;
      scene.add(dir);

      // Ground
      const groundGeo = new THREE.PlaneGeometry(40, 22);
      const groundMat = new THREE.MeshStandardMaterial({ color:0xeae7ff, roughness:.95, metalness:0 });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI/2;
      ground.position.y = FLOOR_Y;
      ground.receiveShadow = true;
      scene.add(ground);

      // soft vignette
      const ringGeo = new THREE.RingGeometry(0.01, 8.0, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color:0xdee3ff, transparent:true, opacity:0.25, side:THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x=-Math.PI/2; ring.position.y=FLOOR_Y+0.005;
      scene.add(ring);

      let cancelled=false;

      (async ()=>{
        mapRef.current = await getJSON(VALUES_URL_L3);

        const loader = new GLTFLoader();
        loader.load(MODEL_URL_L3, (gltf)=>{
          if (cancelled) return;
          const base = gltf.scene || gltf.scenes[0];
          if (!base){ setMsg("Modèle 3D vide."); return; }

          // normalise matière/échelle
          base.traverse((o)=>{
            if (o.isMesh){
              if (!o.material || !o.material.isMeshStandardMaterial){
                o.material = new THREE.MeshStandardMaterial({ color:0xf7efe7, roughness:0.6, metalness:0.05 });
              }else{
                o.material.metalness = clamp(o.material.metalness||0, 0, 0.15);
                o.material.roughness = clamp(o.material.roughness||0.6, 0.35, 1.0);
              }
              o.castShadow = true;
            }
          });
          // échelle/centre
          const box = new THREE.Box3().setFromObject(base);
          const size = box.getSize(new THREE.Vector3());
          const s = 1.6 / Math.max(size.x, size.y, size.z);
          base.scale.setScalar(s);
          box.setFromObject(base);
          const c = box.getCenter(new THREE.Vector3());
          base.position.sub(c);
          modelRef.current = base;

          // Crée les dés
          const dice=[];
          for (let i=0;i<COUNT;i++){
            const g = base.clone(true);
            scene.add(g);
            const anchors = extractAnchorsFaces(g);
            dice.push({
              root:g,
              anchors,
              vel:new THREE.Vector3(),
              angVel:new THREE.Vector3(),
              stableSince:0
            });
          }
          diceRef.current = dice;

          layoutDice();
          setReady(true);
          startLoop();
        },
        undefined,
        (err)=>{ console.error(err); setMsg("Échec chargement modèle : " + MODEL_URL_L3); });
      })();

      function startLoop(){
        lastRef.current = now();
        function frame(){
          const t=now();
          const dt = Math.min(32, t-lastRef.current)/1000;
          lastRef.current = t;
          step(dt);
          renderer.render(scene, cameraRef.current);
          reqRef.current = requestAnimationFrame(frame);
        }
        frame();
      }

      function cleanup(){
        cancelled=true;
        if (reqRef.current) cancelAnimationFrame(reqRef.current);
        renderer.dispose();
        scene.traverse((o)=>{
          if (o.isMesh){
            o.geometry?.dispose?.();
            if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose?.());
            else o.material?.dispose?.();
          }
        });
      }
      return cleanup;
    }, []);

    /* ------------- Simulation ------------- */
    function layoutDice(){
      const THREE = THREEref.current;
      const dice = diceRef.current;
      if (!THREE || !dice?.length) return;
      for (let i=0;i<dice.length;i++){
        const d=dice[i];
        d.root.position.set(-2.2 + i*1.5, 0.82, (i%2===0)? -0.6 : 0.7);
        d.root.rotation.set(0, i*0.6, 0);
        d.vel.set(0,0,0); d.angVel.set(0,0,0);
        d.stableSince = now();
        d.root.updateMatrixWorld(true);
      }
    }

    function randomThrow(){
      const THREE = THREEref.current;
      const dice = diceRef.current;
      if (!THREE || !dice?.length) return;
      for (let i=0;i<dice.length;i++){
        const d=dice[i];
        d.root.position.set(-3.5 + i*0.6, 2.2 + Math.random()*0.8, -1.8 + Math.random()*3.4);
        d.root.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        d.vel.set(5.2 + Math.random()*2.0, 2.5 + Math.random()*1.2, 1.5 - Math.random()*3.0);
        d.angVel.set(
          (-1+Math.random()*2)*6.0,
          (-1+Math.random()*2)*6.0,
          (-1+Math.random()*2)*6.0
        );
        d.stableSince = 0;
        d.root.updateMatrixWorld(true);
      }
      setVals([]); setThrowing(true);
      setMsg("Lancer ! (attendre l’arrêt)");
    }

    function step(dt){
      const THREE = THREEref.current, dice=diceRef.current;
      if (!THREE || !dice?.length) return;

      let allStable = true;
      for (let i=0;i<dice.length;i++){
        const d = dice[i];
        d.vel.y += GRAV * dt;

        d.root.position.addScaledVector(d.vel, dt);

        // Sol
        const r = 0.75;
        if (d.root.position.y - r <= FLOOR_Y){
          d.root.position.y = FLOOR_Y + r;
          if (d.vel.y < 0) d.vel.y = -d.vel.y * REST;
          d.vel.x *= FRIC; d.vel.z *= FRIC;
          d.angVel.multiplyScalar(AFRIC);
        }

        // murs
        const X=6.8,Z=4.4;
        if (d.root.position.x<-X){ d.root.position.x=-X; d.vel.x= Math.abs(d.vel.x)*0.6; }
        if (d.root.position.x> X){ d.root.position.x= X; d.vel.x=-Math.abs(d.vel.x)*0.6; }
        if (d.root.position.z<-Z){ d.root.position.z=-Z; d.vel.z= Math.abs(d.vel.z)*0.6; }
        if (d.root.position.z> Z){ d.root.position.z= Z; d.vel.z=-Math.abs(d.vel.z)*0.6; }

        // rotation + amortissement
        d.root.rotation.x += d.angVel.x * dt;
        d.root.rotation.y += d.angVel.y * dt;
        d.root.rotation.z += d.angVel.z * dt;
        d.vel.multiplyScalar(0.999);
        d.angVel.multiplyScalar(0.999);

        d.root.updateMatrixWorld(true);

        // stabilité
        const speed = d.vel.length() + d.angVel.length();
        if (speed < EPS){ if (!d.stableSince) d.stableSince = now(); }
        else d.stableSince = 0;

        if (!(d.stableSince && (now()-d.stableSince>STABLE_MS))) allStable = false;
      }

      if (throwing && allStable){
        setThrowing(false);

        const out=[];
        const map = mapRef.current;
        for (let i=0;i<dice.length;i++){
          const d=dice[i];
          const tag = findTopByOrientation(d.anchors, THREE) || "?";
          // mapping optionnel
          let v = tag;
          if (map?.map && map.map[tag] != null) v = String(map.map[tag]);
          // heuristiques si pas mappé
          const t=String(v).toLowerCase();
          if (t==="up"||t==="top") v="1";
          else if (t==="down"||t==="bottom") v="6";
          else if (/1|one|venus/.test(t)) v="1";
          else if (/3|trina|three/.test(t)) v="3";
          else if (/4|quater|four/.test(t)) v="4";
          else if (/6|senio|bina|six/.test(t)) v="6";
          out.push(v);
        }
        setVals(out);
        setMsg("Résultat : " + out.join("  "));
      }
    }

    /* ------------- UI ------------- */
    return (
      <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#f8fafc,#eef2ff)", color:"#0f172a"}}>
        <div className="max-w-5xl mx-auto" style={{padding:"16px"}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:8}}>
            <h1 className="text-xl sm:text-2xl" style={{fontWeight:700}}>Rouler les os — Vénus, Canis, Senio…</h1>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              <button onClick={()=> ready && randomThrow()} disabled={!ready}
                style={{padding:"10px 14px", border:"1px solid #2563eb", background:"#2563eb", color:"#fff", borderRadius:12, cursor:ready?"pointer":"default", boxShadow:"0 6px 16px rgba(37,99,235,.25)"}}>
                Lancer
              </button>
              <button onClick={()=>{ layoutDice(); setVals([]); setThrowing(false); setMsg("Réinitialisé. Clique « Lancer »."); }}
                disabled={!ready}
                style={{padding:"8px 12px", border:"1px solid #e5e7eb", background:"#fff", borderRadius:12, cursor:ready?"pointer":"default"}}>
                Réinitialiser
              </button>
            </div>
          </div>

          <p className="text-sm" style={{color:"#475569", marginBottom:12}}>{msg}</p>

          <div ref={wrapRef} className="w-full" style={{position:"relative", border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden", background:"#fff"}}>
            <canvas ref={canvasRef} />

            {!ready && (
              <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center", background:"linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.92))"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Chargement du modèle 3D…</div>
                  <div style={{fontSize:12, color:"#64748b"}}>Modèle : <code>level3/3d/astragalus_faces.glb</code></div>
                </div>
              </div>
            )}

            {vals.length>0 && (
              <div style={{position:"absolute", left:12, bottom:12, background:"rgba(255,255,255,.96)", border:"1px solid #e5e7eb", borderRadius:12, padding:"10px 12px"}}>
                <div style={{fontWeight:600, marginBottom:4}}>Tirage</div>
                <div style={{fontSize:14}}>
                  {vals.join("  ")}
                  <span style={{marginLeft:10, color:"#64748b"}}>Somme: {vals.filter(v=>/^\d+$/.test(v)).map(Number).reduce((a,b)=>a+b,0)}</span>
                </div>
                <div style={{fontSize:12, color:"#64748b", marginTop:4}}>
                  Catégories : Vénus (1-3-4-6), Canis (1-1-1-1), Senio (≥2 “6”), Trina (triple), Bina (deux paires), Simple (autres).
                </div>
              </div>
            )}
          </div>

          <div style={{fontSize:12, color:"#6b7280", marginTop:8}}>
            Modèle utilisé : <code>astragalus_faces.glb</code> — ancres <code>Face_1/3/4/6</code> (ou variantes). Détermination par orientation (+Y de l’ancre vers le haut).
          </div>
        </div>
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel3 = AstragalusLevel3;
})();
