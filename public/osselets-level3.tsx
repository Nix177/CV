// public/osselets-level3.tsx
// LEVEL 3 — « Rouler les os » (dés 1/3/4/6) avec votre modèle : /assets/games/osselets/level3/3d/astragalus_faces.glb
// - ESM only (three@0.158.0 + GLTFLoader) → AUCUN double import, pas de <script> ajouté.
// - 4 astragales clonés, lancer aléatoire, lecture de la face « vers le haut » via ancres Face_1/3/4/6.
// - Collisions entre osselets (anti-empilement) + glissement au sol jusqu’à stabilisation sur une face.
// - Score = somme des faces visibles. UI : Lancer / Réinitialiser + affichage tirage & somme.

;(() => {
  const { useEffect, useRef, useState } = React;

  /* -------------------- Chemins & options -------------------- */
  const BASE     = "/assets/games/osselets/level3/";
  const MODEL    = BASE + "3d/astragalus_faces.glb";   // votre modèle
  const VALUESJS = BASE + "3d/values.json";            // optionnel: { "map": {"1":1,"3":3,"4":4,"6":6} }

  /* -------------------- Vue & physique -------------------- */
  const VIEW_W = 960, VIEW_H = 540, DPR_MAX = 2.5;

  const COUNT      = 4;
  const RADIUS     = 0.75;            // rayon approx. « boule » d’osselet
  const FLOOR_Y    = 0.0;
  const GRAV       = -14.5;           // gravité
  const REST       = 0.45;            // restitution sol
  const H_FRICT    = 0.92;            // friction horizontale sol
  const ANG_FRICT  = 0.94;            // friction rotation sol
  const EPS_SPEED  = 0.18;            // seuil quasi immobile
  const STABLE_MS  = 900;             // durée « immobile » pour être stable
  const COLL_E     = 0.25;            // restitution collision osselet/osselet
  const DOT_LOCK   = 0.985;           // face vraiment « vers le haut »
  const EDGE_NUDGE = 0.22;            // micro-nudge si posé sur l’arête

  /* -------------------- Three ESM (version pinnée) -------------------- */
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

  function getFaceAnchors(root:any){
    const out:any[]=[];
    root.traverse((n:any)=>{
      const nm=(n.name||"").toLowerCase();
      let tag="";
      if (/^face[_\s-]?1$|^f1$|^value[_\s-]?1$|^valeur[_\s-]?1$/.test(nm)) tag="1";
      else if (/^face[_\s-]?3$|^f3$|^value[_\s-]?3$|^valeur[_\s-]?3$/.test(nm)) tag="3";
      else if (/^face[_\s-]?4$|^f4$|^value[_\s-]?4$|^valeur[_\s-]?4$/.test(nm)) tag="4";
      else if (/^face[_\s-]?6$|^f6$|^value[_\s-]?6$|^valeur[_\s-]?6$/.test(nm)) tag="6";
      if (tag) out.push({ node:n, tag });
    });
    return out;
  }

  // Retourne {tag, dot} où dot est le cos(angle) entre +Y local de l’ancre et +Y monde
  function faceUpInfo(anchors, THREE){
    if (!anchors || !anchors.length) return { tag:"?", dot:-1 };
    const up = new THREE.Vector3(0,1,0), Y = new THREE.Vector3(0,1,0), q = new THREE.Quaternion();
    let bestTag="?", bestDot=-2;
    for (const a of anchors){
      a.node.getWorldQuaternion(q);
      const yw = Y.clone().applyQuaternion(q).normalize();
      const d  = yw.dot(up);
      if (d>bestDot){ bestDot=d; bestTag=a.tag; }
    }
    return { tag:bestTag, dot:bestDot };
  }

  function AstragalusLevel3(){
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);

    const [ready,setReady]       = useState(false);
    const [throwing,setThrowing] = useState(false);
    const [vals,setVals]         = useState<string[]>([]);
    const [sum,setSum]           = useState<number>(0);
    const [msg,setMsg]           = useState("Lance 4 astragales (faces 1/3/4/6).");

    // 3D refs
    const THREEref     = useRef<any>(null);
    const rendererRef  = useRef<any>(null);
    const sceneRef     = useRef<any>(null);
    const cameraRef    = useRef<any>(null);
    const baseRef      = useRef<any>(null);
    const diceRef      = useRef<any[]>([]);   // {root, anchors, vel:Vec3, angVel:Vec3, stableSince:number}
    const reqRef       = useRef<number>(0);
    const lastRef      = useRef<number>(0);
    const mappingRef   = useRef<any>(null);
    const boundsRef    = useRef({ minX:-6.8, maxX:6.8, minZ:-4.4, maxZ:4.4 });

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

        mappingRef.current = await getJSON(VALUESJS);

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
              anchors:getFaceAnchors(inst),
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
    }

    function collideAndSeparate(){
      const dice=diceRef.current; if(!dice?.length) return;
      for(let i=0;i<dice.length;i++){
        for(let j=i+1;j<dice.length;j++){
          const a=dice[i], b=dice[j];
          const pa=a.root.position, pb=b.root.position;

          // collision 3D (sphère approx) — on résout dans le plan XZ pour éviter l’empilement
          const dx=pb.x-pa.x, dz=pb.z-pa.z, dy=pb.y-pa.y;
          const dist2D=Math.hypot(dx,dz);
          const min=2*RADIUS*0.98;
          if (dist2D < min){
            const nx = (dist2D>1e-6) ? dx/dist2D : 1, nz=(dist2D>1e-6)? dz/dist2D : 0;
            const overlap = (min - dist2D) + 1e-3;

            // séparation horizontale 50/50
            pa.x -= nx*overlap*0.5; pb.x += nx*overlap*0.5;
            pa.z -= nz*overlap*0.5; pb.z += nz*overlap*0.5;

            // échanges des composantes normales (simple restitution)
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

        // murs invisibles (calculés depuis la caméra)
        const b = boundsRef.current;
        if (d.root.position.x < b.minX){ d.root.position.x = b.minX; d.vel.x = Math.abs(d.vel.x)*0.6; }
        if (d.root.position.x > b.maxX){ d.root.position.x = b.maxX; d.vel.x = -Math.abs(d.vel.x)*0.6; }
        if (d.root.position.z < b.minZ){ d.root.position.z = b.minZ; d.vel.z = Math.abs(d.vel.z)*0.6; }
        if (d.root.position.z > b.maxZ){ d.root.position.z = b.maxZ; d.vel.z = -Math.abs(d.vel.z)*0.6; }

        // rotation
        d.root.rotation.x += d.angVel.x*dt;
        d.root.rotation.y += d.angVel.y*dt;
        d.root.rotation.z += d.angVel.z*dt;

        // micro pente pour aider à se coucher (sans se voir)
        if (d.root.position.y <= FLOOR_Y + RADIUS + 0.002){
          d.vel.x += Math.sin(d.root.position.z*0.25)*0.02*dt;
          d.vel.z += Math.sin(d.root.position.x*0.25)*0.02*dt;
        }
      }

      collideAndSeparate();

      // 3) Stabilisation : si quasi immobile mais pas « face vers haut », on pousse un chouïa
      for(const d of dice){
        const speed = d.vel.length() + d.angVel.length();
        const info  = faceUpInfo(d.anchors, THREE);
        if (speed < EPS_SPEED){
          if (d.root.position.y > FLOOR_Y + RADIUS + 1e-3){
            // si encore en l'air, force à glisser vers le bas
            d.vel.y -= 0.2;
            d.stableSince = 0;
          } else if (info.dot < DOT_LOCK){
            // posé, mais sur une arête → micro-torque pour basculer doucement
            d.angVel.x += (Math.random()-.5)*EDGE_NUDGE*dt*60;
            d.angVel.z += (Math.random()-.5)*EDGE_NUDGE*dt*60;
            d.stableSince = 0;
          } else {
            if (!d.stableSince) d.stableSince = now();
          }
        } else {
          d.stableSince = 0;
        }
      }

      // 4) Tous stables ? → calcul du score
      let allStable=true;
      for(const d of dice){
        if (!(d.stableSince && (now()-d.stableSince>STABLE_MS))) { allStable=false; break; }
      }
      if (throwing && allStable){
        setThrowing(false);
        const map = (mappingRef.current && mappingRef.current.map) || { "1":1, "3":3, "4":4, "6":6 };
        const out:string[]=[];
        let s=0;
        for(const d of dice){
          const info = faceUpInfo(d.anchors, THREE);
          const v = map[info.tag] ?? 0;
          out.push(String(info.tag));
          s += v;
        }
        setVals(out); setSum(s);
        setMsg("Résultat !");
      }
    }

    function animate(){
      const r=rendererRef.current, scene=sceneRef.current, cam=cameraRef.current, THREE=THREEref.current;
      let last=lastRef.current||0;
      const loop=(t:number)=>{
        const dt=Math.min(0.05, Math.max(0, (t-last)/1000)); last=t; lastRef.current=t;
        step(dt);
        r.render(scene,cam);
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
              <span style={{marginLeft:10, color:"#64748b"}}>Somme&nbsp;: {sum} — Points&nbsp;: {sum}</span>
            </div>
            <div style={{fontSize:12, color:"#64748b", marginTop:4}}>
              Catégories antiques (indicatif) : Vénus (1-3-4-6), Canis (1-1-1-1), Senio (≥2 × «6»), Trina (triple), Bina (2 paires), Simple (autres).
            </div>
          </div>
        )}

        <div style={{fontSize:12, color:"#6b7280", marginTop:8}}>
          Modèle : <code>astragalus_faces.glb</code> — ancres <code>Face_1/3/4/6</code>. Physique simple avec collisions horizontales et micro-bascules jusqu’à une face bien à plat.
        </div>
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel3 = AstragalusLevel3;
})();
