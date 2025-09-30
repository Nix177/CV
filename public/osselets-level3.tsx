// /osselets-level3.tsx
// LEVEL 3 — « Rouler les os »
// ✔ Score = pour chaque osselet, on prend l’ancre *la plus haute en Y monde*.
// ✔ Reconnaît les ancres 'ventre/dos/bassin/membres' (et aussi Face_1/3/4/6).
// ✔ Valeurs lues depuis /assets/games/osselets/level3/3d/values.json, sinon {ventre:1,bassin:3,membres:4,dos:6}.
// ✔ Force le calcul du résultat après 3s si les osselets ne se stabilisent pas.

;(() => {
  const { useEffect, useRef, useState } = React;

  /* -------------------- Chemins & options -------------------- */
  const BASE     = "/assets/games/osselets/level3/";
  const MODEL    = BASE + "3d/astragalus_faces.glb";
  const CFG_JSON = BASE + "3d/values.json"; // optionnel

  /* -------------------- Vue & physique -------------------- */
  const VIEW_W = 960, VIEW_H = 540, DPR_MAX = 2.5;

  const COUNT      = 4;
  const RADIUS     = 0.75;
  const FLOOR_Y    = 0.0;
  const GRAV       = -14.5;
  const REST       = 0.45;
  const H_FRICT    = 0.92;
  const ANG_FRICT  = 0.94;
  const EPS_SPEED  = 0.18;
  const STABLE_MS  = 900;
  const COLL_E     = 0.25;

  const FORCE_RESULT_MS = 3000; // résultat forcé après 3s

  /* -------------------- Three ESM (pinné) -------------------- */
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;

  async function ensureThreeOnce(){
    if ((window as any).__LxThree) return (window as any).__LxThree;
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    const out = { THREE, GLTFLoader };
    (window as any).__LxThree = out;
    return out;
  }

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const now=()=>performance.now();
  const getJSON=(u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  /* ---------- Détection robuste des ancres de faces ---------- */
  // Retourne tableau d’objets { node, key, alt }
  // - key : "ventre"|"dos"|"bassin"|"membres"|"1"|"3"|"4"|"6"
  // - alt : étiquette lisible (ex. "ventre" ou "1")
  function collectFaceAnchors(root:any){
    const out:any[]=[];
    root.traverse((n:any)=>{
      const nm=(n.name||"").toLowerCase();
      const flat=nm.replace(/[_\s-]+/g,"");

      const push=(key:string,alt:string)=>out.push({node:n, key, alt});

      if (flat.includes("ventre"))   return push("ventre","ventre");
      if (flat.includes("bassin"))   return push("bassin","bassin");
      if (flat.includes("membres"))  return push("membres","membres");
      if (flat.includes("dos"))      return push("dos","dos");

      // compat noms alternatifs Face_1/3/4/6, Value_*, etc.
      if (/face[_\s-]?1|value[_\s-]?1|valeur[_\s-]?1|^f1$/.test(nm)) return push("1","1");
      if (/face[_\s-]?3|value[_\s-]?3|valeur[_\s-]?3|^f3$/.test(nm)) return push("3","3");
      if (/face[_\s-]?4|value[_\s-]?4|valeur[_\s-]?4|^f4$/.test(nm)) return push("4","4");
      if (/face[_\s-]?6|value[_\s-]?6|valeur[_\s-]?6|^f6$/.test(nm)) return push("6","6");
    });
    return out;
  }

  // Choisit l’ancre la plus haute (Y monde max)
  function highestAnchorInfo(anchors:any[], THREE:any){
    if (!anchors || anchors.length===0) return { key:"?", alt:"?", y:-1e9 };
    const world=new THREE.Vector3();
    let best=null, bestY=-1e9;
    for (const a of anchors){
      a.node.getWorldPosition(world);
      if (world.y>bestY){ bestY=world.y; best=a; }
    }
    return { key:best.key, alt:best.alt, y:bestY };
  }

  function AstragalusLevel3(){
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);

    const [ready,setReady]       = useState(false);
    const [throwing,setThrowing] = useState(false);
    const [vals,setVals]         = useState<number[]>([]);
    const [sum,setSum]           = useState<number>(0);
    const [msg,setMsg]           = useState("Lance 4 astragales (1/3/4/6).");

    // 3D refs
    const THREEref     = useRef<any>(null);
    const rendererRef  = useRef<any>(null);
    const sceneRef     = useRef<any>(null);
    const cameraRef    = useRef<any>(null);
    const baseRef      = useRef<any>(null);
    const diceRef      = useRef<any[]>([]); // {root, anchors, vel, angVel, stableSince}
    const reqRef       = useRef<number>(0);
    const lastRef      = useRef<number>(0);
    const cfgRef       = useRef<any>({ values:{ventre:1,bassin:3,membres:4,dos:6}, combos:null, ui:{} });
    const boundsRef    = useRef({ minX:-6.8, maxX:6.8, minZ:-4.4, maxZ:4.4 });
    const deadlineRef  = useRef<number>(0);

    function updateBoundsFromCamera(){
      const THREE=THREEref.current, cam=cameraRef.current; if(!THREE||!cam) return;
      const planeY = FLOOR_Y + RADIUS;
      const camPos = new THREE.Vector3(); cam.getWorldPosition(camPos);
      const ndcs   = [[-1,-1],[1,-1],[1,1],[-1,1]];
      const xs:number[] = [], zs:number[] = [];
      for (const [nx,ny] of ndcs){
        const p = new THREE.Vector3(nx,ny,0.5).unproject(cam);
        const dir = p.sub(camPos);
        if (Math.abs(dir.y) < 1e-4) continue;
        const t = (planeY - camPos.y) / dir.y;
        if (t > 0){
          const hit = camPos.clone().addScaledVector(dir, t);
          xs.push(hit.x); zs.push(hit.z);
        }
      }
      if (xs.length && zs.length){
        const padX=0.08, padZ=0.08;
        const minX=Math.min(...xs), maxX=Math.max(...xs);
        const minZ=Math.min(...zs), maxZ=Math.max(...zs);
        boundsRef.current = {
          minX: minX + (maxX-minX)*padX,
          maxX: maxX - (maxX-minX)*padX,
          minZ: minZ + (maxZ-minZ)*padZ,
          maxZ: maxZ - (maxZ-minZ)*padZ
        };
      }
    }

    /* ---------- Resize ---------- */
    useEffect(()=>{
      function onResize(){
        const THREE=THREEref.current; if(!THREE) return;
        const wrap=wrapRef.current, cv=canvasRef.current, r=rendererRef.current, cam=cameraRef.current;
        if(!wrap||!cv||!r||!cam) return;
        const w=Math.max(320, wrap.clientWidth|0), h=Math.round(w*(VIEW_H/VIEW_W));
        const dpr=clamp(window.devicePixelRatio||1,1,DPR_MAX);
        r.setPixelRatio(dpr);
        r.setSize(w,h,false);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        cam.aspect=w/h; cam.updateProjectionMatrix();
        updateBoundsFromCamera();
      }
      onResize();
      const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener("resize", onResize);
      return ()=>{ if(ro) ro.disconnect(); window.removeEventListener("resize", onResize); };
    },[]);

    /* ---------- Init Three ---------- */
    useEffect(()=>{
      let cancelled=false;
      (async ()=>{
        const { THREE, GLTFLoader } = await ensureThreeOnce();
        THREEref.current=THREE;

        // Renderer
        const cv=canvasRef.current;
        const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:false});
        renderer.setPixelRatio(clamp(window.devicePixelRatio||1,1,DPR_MAX));
        renderer.setSize(VIEW_W,VIEW_H,false);
        renderer.shadowMap.enabled=true;
        renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        rendererRef.current=renderer;

        // Scene/cam
        const scene=new THREE.Scene(); scene.background=new THREE.Color(0xf5f7fb);
        const cam=new THREE.PerspectiveCamera(45,16/9,0.1,100); cam.position.set(6.4,4.7,7.4); cam.lookAt(0,0.7,0);
        sceneRef.current=scene; cameraRef.current=cam;
        updateBoundsFromCamera();

        scene.add(new THREE.HemisphereLight(0xffffff,0x334466,.85));
        const dir=new THREE.DirectionalLight(0xffffff,1); dir.position.set(4,7,6);
        dir.castShadow=true; dir.shadow.mapSize.set(1024,1024); scene.add(dir);

        const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,20), new THREE.MeshStandardMaterial({color:0xeae7ff,roughness:.95,metalness:0}));
        ground.rotation.x=-Math.PI/2; ground.position.y=FLOOR_Y; ground.receiveShadow=true; scene.add(ground);

        const ring=new THREE.Mesh(new THREE.RingGeometry(0.01,8,64), new THREE.MeshBasicMaterial({color:0xdee3ff,transparent:true,opacity:.25,side:THREE.DoubleSide}));
        ring.rotation.x=-Math.PI/2; ring.position.y=FLOOR_Y+0.003; scene.add(ring);

        const cfg = await getJSON(CFG_JSON);
        if (cfg && cfg.values) cfgRef.current.values = cfg.values;

        // Modèle
        const loader = new GLTFLoader();
        loader.load(MODEL, (gltf)=>{
          if (cancelled) return;
          const base=gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!base){ setMsg("Modèle vide."); return; }
          base.traverse((o:any)=>{
            if(o.isMesh){
              if(!o.material || !o.material.isMeshStandardMaterial)
                o.material=new THREE.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
              o.castShadow=true; o.receiveShadow=false;
            }
          });
          baseRef.current=base;
          scene.add(base);

          // créer 4 clones (os)
          const dice:any[]=[];
          for(let i=0;i<COUNT;i++){
            const inst=base.clone(true);
            scene.add(inst);
            dice.push({
              root:inst,
              anchors:collectFaceAnchors(inst),
              vel:new THREE.Vector3(),
              angVel:new THREE.Vector3(),
              stableSince:0
            });
          }
          diceRef.current=dice;
          setReady(true);
          animate();
        }, undefined, (err)=>{ console.error("[L3] GLB load error:", err); setMsg("Échec chargement modèle."); });
      })();
      return ()=>{ cancelled=true; cancelAnimationFrame(reqRef.current||0); };
    },[]);

    /* ---------- Lancer ---------- */
    function throwDice(){
      const THREE=THREEref.current; if(!THREE) return;
      const dice=diceRef.current||[];
      for(let i=0;i<dice.length;i++){
        const d=dice[i];
        d.root.position.set(-3.5 + i*0.6, 2.2 + Math.random()*0.8, -1.8 + Math.random()*3.4);
        d.root.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        d.vel.set(5.2 + Math.random()*2.0, 2.5 + Math.random()*1.2, 1.5 - Math.random()*3.0);
        d.angVel.set( (-1+Math.random()*2)*6.0, (-1+Math.random()*2)*6.0, (-1+Math.random()*2)*6.0 );
        d.stableSince=0; d.root.updateMatrixWorld(true);
      }
      setVals([]); setSum(0); setThrowing(true); setMsg("Lancer ! (attendre l’arrêt)");
      deadlineRef.current = now() + FORCE_RESULT_MS;
    }

    function collideAndSeparate(){
      const dice=diceRef.current; if(!dice?.length) return;
      for(let i=0;i<dice.length;i++){
        for(let j=i+1;j<dice.length;j++){
          const a=dice[i], b=dice[j];
          const pa=a.root.position, pb=b.root.position;

          // collision sphères approx -> résoudre dans XZ
          const dx=pb.x-pa.x, dz=pb.z-pa.z;
          const dist2D=Math.hypot(dx,dz);
          const min=2*RADIUS*0.98;
          if (dist2D < min){
            const nx = (dist2D>1e-6) ? dx/dist2D : 1, nz=(dist2D>1e-6)? dz/dist2D : 0;
            const overlap = (min - dist2D) + 1e-3;

            pa.x -= nx*overlap*0.5; pb.x += nx*overlap*0.5;
            pa.z -= nz*overlap*0.5; pb.z += nz*overlap*0.5;

            const va=a.vel, vb=b.vel;
            const vn = va.x*nx + va.z*nz;
            const wn = vb.x*nx + vb.z*nz;
            const dv = (wn - vn)*COLL_E;
            va.x += nx*dv; va.z += nz*dv;
            vb.x -= nx*dv; vb.z -= nz*dv;
          }
        }
      }
    }

    function step(dt:number){
      const THREE=THREEref.current; if(!THREE) return;
      const dice=diceRef.current||[];
      for(const d of dice){
        // gravité
        d.vel.y += GRAV*dt;

        // intégration
        d.root.position.x += d.vel.x*dt;
        d.root.position.y += d.vel.y*dt;
        d.root.position.z += d.vel.z*dt;

        // sol
        if (d.root.position.y <= FLOOR_Y + RADIUS){
          d.root.position.y = FLOOR_Y + RADIUS;
          if (d.vel.y < 0) d.vel.y = -d.vel.y * REST;
          d.vel.x *= H_FRICT; d.vel.z *= H_FRICT;
          d.angVel.multiplyScalar(ANG_FRICT);
        }

        // murs invisibles
        const b = boundsRef.current;
        if (d.root.position.x < b.minX){ d.root.position.x = b.minX; d.vel.x = Math.abs(d.vel.x)*0.6; }
        if (d.root.position.x > b.maxX){ d.root.position.x = b.maxX; d.vel.x = -Math.abs(d.vel.x)*0.6; }
        if (d.root.position.z < b.minZ){ d.root.position.z = b.minZ; d.vel.z = Math.abs(d.vel.z)*0.6; }
        if (d.root.position.z > b.maxZ){ d.root.position.z = b.maxZ; d.vel.z = -Math.abs(d.vel.z)*0.6; }

        // rotation
        d.root.rotation.x += d.angVel.x*dt;
        d.root.rotation.y += d.angVel.y*dt;
        d.root.rotation.z += d.angVel.z*dt;

        // légère pente “aide à se coucher”
        if (d.root.position.y <= FLOOR_Y + RADIUS + 0.002){
          d.vel.x += Math.sin(d.root.position.z*0.25)*0.02*dt;
          d.vel.z += Math.sin(d.root.position.x*0.25)*0.02*dt;
        }
      }

      collideAndSeparate();

      // Stabilisation ?
      for(const d of dice){
        const speed = d.vel.length() + d.angVel.length();
        if (speed < EPS_SPEED){
          if (!d.stableSince) d.stableSince = now();
        } else {
          d.stableSince = 0;
        }
      }
    }

    // Convertit une clé d’ancre → valeur numérique via config
    function valueForKey(key:string){
      const map = cfgRef.current.values || { ventre:1,bassin:3,membres:4,dos:6 };
      if (key==="1"||key==="3"||key==="4"||key==="6") return parseInt(key,10);
      if (key in map) return map[key];
      return 0;
    }

    function computeResultNow(){
      const THREE=THREEref.current; if(!THREE) return;
      const dice=diceRef.current||[];
      const out:number[]=[];
      let s=0;
      for(const d of dice){
        d.root.updateMatrixWorld(true);
        const info = highestAnchorInfo(d.anchors, THREE); // ← ancre la plus haute
        const v = valueForKey(info.key);
        out.push(v);
        s += v;
      }
      setVals(out); setSum(s); setMsg("Résultat !");
      setThrowing(false);
    }

    function animate(){
      const r=rendererRef.current, scene=sceneRef.current, cam=cameraRef.current;
      let last=lastRef.current||0;
      const loop=(t:number)=>{
        const dt=Math.min(0.05, Math.max(0, (t-last)/1000)); last=t; lastRef.current=t;
        step(dt);
        r.render(scene,cam);

        if (throwing){
          const dice=diceRef.current||[];
          const allStable = dice.every(d => d.stableSince && (now()-d.stableSince>STABLE_MS));
          if (allStable || now() >= deadlineRef.current){
            computeResultNow();
          }
        }

        reqRef.current=requestAnimationFrame(loop);
      };
      reqRef.current=requestAnimationFrame(loop);
    }

    function reset(){
      const dice=diceRef.current||[];
      for(const d of dice){
        d.vel.set(0,0,0); d.angVel.set(0,0,0); d.stableSince=0;
        d.root.position.set(-4+Math.random()*8, 1.5+Math.random()*0.5, -2+Math.random()*4);
        d.root.rotation.set(Math.random(),Math.random(),Math.random());
        d.root.updateMatrixWorld(true);
      }
      setThrowing(false); setVals([]); setSum(0); setMsg("Prêt.");
    }

    return (
      <div ref={wrapRef} style={{position:"relative"}}>
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} style={{display:"block", borderRadius:12}}/>

        <div style={{display:"flex", gap:8, marginTop:10}}>
          <button onClick={throwDice} className="btn">Lancer</button>
          <button onClick={reset} className="btn">Réinitialiser</button>
          {!ready && (
            <div style={{marginLeft:10, color:"#64748b", display:"inline-flex", alignItems:"center", gap:8}}>
              <span className="badge">Chargement…</span>
              <div>
                <div style={{fontWeight:700, marginBottom:6}}>Chargement du modèle 3D…</div>
                <div style={{fontSize:12, color:"#64748b"}}>Modèle : <code>level3/3d/astragalus_faces.glb</code></div>
              </div>
            </div>
          )}
        </div>

        {vals.length>0 && (
          <div style={{position:"absolute", left:12, bottom:12, background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:12, padding:"10px 12px", maxWidth:"min(96%,640px)"}}>
            <div style={{fontWeight:600, marginBottom:4}}>Tirage</div>
            <div style={{fontSize:14}}>
              {vals.join("  ")}
              <span style={{marginLeft:10, color:"#9cc0ff"}}>Somme&nbsp;: {sum}</span>
            </div>
            <div style={{fontSize:12, color:"#9bb2d4", marginTop:4}}>
              Calcul : ancre la plus haute (Y monde) par osselet · valeurs {JSON.stringify(cfgRef.current.values)}.
            </div>
          </div>
        )}

        <div style={{fontSize:12, color:"#6b7280", marginTop:8}}>
          Modèle : <code>astragalus_faces.glb</code> — ancres <code>ventre/dos/bassin/membres</code> (ou <code>Face_1/3/4/6</code>).
        </div>
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel3 = AstragalusLevel3;
})();
