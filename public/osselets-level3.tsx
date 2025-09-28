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

  /* -------------------- Utils -------------------- */
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const now   = ()=> (typeof performance!=="undefined"?performance:Date).now();
  async function getJSON(u){ try{ const r=await fetch(u,{cache:"no-store"}); if(r.ok) return await r.json(); }catch{} return null; }

  function extractFaceAnchors(root){
    const out=[]; // {node, tag: "1"|"3"|"4"|"6"}
    root.traverse((n)=>{
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
      }
      onResize();
      const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener("resize", onResize);
      return ()=>{ if(ro) ro.disconnect(); window.removeEventListener("resize", onResize); };
    },[]);

    /* ---------- Init ---------- */
    useEffect(()=>{
      let cancelled=false;
      (async ()=>{
        let libs=null;
        try { libs = await ensureThreeOnce(); }
        catch (e){ console.error("[L3] import three ESM:", e); setMsg("Three.js/GLTFLoader manquant."); return; }
        const { THREE, GLTFLoader } = libs; THREEref.current = THREE;

        // Renderer
        const renderer=new THREE.WebGLRenderer({ canvas:canvasRef.current, antialias:true, alpha:true });
        renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        renderer.toneMapping=THREE.ACESFilmicToneMapping;
        rendererRef.current=renderer;

        // Scene/cam
        const scene=new THREE.Scene(); scene.background=new THREE.Color(0xf5f7fb);
        const cam=new THREE.PerspectiveCamera(45,16/9,0.1,100); cam.position.set(6.4,4.7,7.4); cam.lookAt(0,0.7,0);
        sceneRef.current=scene; cameraRef.current=cam;

        scene.add(new THREE.HemisphereLight(0xffffff,0x334466,.85));
        const dir=new THREE.DirectionalLight(0xffffff,1); dir.position.set(4,7,6);
        dir.castShadow=true; dir.shadow.mapSize.set(1024,1024); scene.add(dir);

        const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,22), new THREE.MeshStandardMaterial({color:0xeae7ff,roughness:.95,metalness:0}));
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
          // normalisation
          const box=new THREE.Box3().setFromObject(base);
          const s = 1.6/Math.max(...box.getSize(new THREE.Vector3()).toArray());
          base.scale.setScalar(s);
          box.setFromObject(base);
          base.position.sub(box.getCenter(new THREE.Vector3()));
          baseRef.current=base;

          // clones
          const dice:any[]=[];
          for(let i=0;i<COUNT;i++){
            const g=base.clone(true); scene.add(g);
            dice.push({
              root:g,
              anchors: extractFaceAnchors(g),
              vel:new THREE.Vector3(),
              angVel:new THREE.Vector3(),
              stableSince:0
            });
          }
          diceRef.current=dice;

          layoutDice();
          setReady(true);
          startLoop();
        }, undefined, (err)=>{ console.error("[L3] GLB load error:", err); setMsg("Échec chargement du modèle."); });

        function startLoop(){
          lastRef.current=now();
          function frame(){
            if (cancelled) return;
            const t=now(), dt=Math.min(32, t-lastRef.current)/1000; lastRef.current=t;
            step(dt);
            renderer.render(scene,cameraRef.current);
            reqRef.current=requestAnimationFrame(frame);
          }
          frame();
        }
      })();

      return ()=>{ cancelled=true; if(reqRef.current) cancelAnimationFrame(reqRef.current); };
    },[]);

    /* ---------- Physique & collisions ---------- */
    function layoutDice(){
      const THREE=THREEref.current, dice=diceRef.current; if(!THREE||!dice?.length) return;
      for(let i=0;i<dice.length;i++){
        const d=dice[i];
        d.root.position.set(-2.2 + i*1.5, 0.82, (i%2===0)? -0.6 : 0.7);
        d.root.rotation.set(0, i*0.6, 0);
        d.vel.set(0,0,0); d.angVel.set(0,0,0);
        d.stableSince=now();
        d.root.updateMatrixWorld(true);
      }
    }

    function randomThrow(){
      const THREE=THREEref.current, dice=diceRef.current; if(!THREE||!dice?.length) return;
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
            const vaN = va.x*nx + va.z*nz;
            const vbN = vb.x*nx + vb.z*nz;
            const m    = (vaN + vbN)/2;
            const aImp = (m - vaN)*(1+COLL_E);
            const bImp = (m - vbN)*(1+COLL_E);
            va.x += aImp*nx; va.z += aImp*nz;
            vb.x += bImp*nx; vb.z += bImp*nz;

            // la pièce la plus haute reçoit une petite impulsion verticale négative pour « glisser »
            if (Math.abs(dy) < RADIUS*1.3){
              if (pa.y > pb.y) a.vel.y -= 0.4; else b.vel.y -= 0.4;
            }
          }
        }
      }
    }

    function step(dt:number){
      const THREE=THREEref.current, dice=diceRef.current; if(!THREE||!dice?.length) return;

      // 1) Intégration + interaction sol
      for(const d of dice){
        d.vel.y += GRAV*dt;
        d.root.position.addScaledVector(d.vel, dt);

        // sol (plan)
        if (d.root.position.y - RADIUS <= FLOOR_Y){
          d.root.position.y = FLOOR_Y + RADIUS;
          if (d.vel.y < 0) d.vel.y = -d.vel.y * REST;
          d.vel.x *= H_FRICT; d.vel.z *= H_FRICT;
          d.angVel.multiplyScalar(ANG_FRICT);
        }

        // murs invisibles
        const X=6.8,Z=4.4;
        if (d.root.position.x<-X){ d.root.position.x=-X; d.vel.x= Math.abs(d.vel.x)*0.6; }
        if (d.root.position.x> X){ d.root.position.x= X; d.vel.x=-Math.abs(d.vel.x)*0.6; }
        if (d.root.position.z<-Z){ d.root.position.z=-Z; d.vel.z= Math.abs(d.vel.z)*0.6; }
        if (d.root.position.z> Z){ d.root.position.z= Z; d.vel.z=-Math.abs(d.vel.z)*0.6; }

        // rotation
        d.root.rotation.x += d.angVel.x*dt;
        d.root.rotation.y += d.angVel.y*dt;
        d.root.rotation.z += d.angVel.z*dt;

        // micro pente pour aider à se coucher (sans se voir)
        if (d.root.position.y <= FLOOR_Y + RADIUS + 0.002){
          d.vel.x += Math.sin(d.root.position.z*0.25)*0.02*dt;
          d.vel.z += Math.sin(d.root.position.x*0.25)*0.02*dt;
        }

        d.vel.multiplyScalar(0.999); d.angVel.multiplyScalar(0.999);
        d.root.updateMatrixWorld(true);
      }

      // 2) Collisions entre osselets (anti-empilement)
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
        const res:string[]=[];
        let s=0;
        for(const d of dice){
          const info = faceUpInfo(d.anchors, THREE);
          const val  = map[String(info.tag)] ?? "?";
          res.push(String(val));
          if (typeof val==="number" || /^\d+$/.test(String(val))) s += Number(val);
        }
        setVals(res); setSum(s);
        setMsg("Résultat : " + res.join("  "));
      }
    }

    /* ---------- UI ---------- */
    return (
      <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#f8fafc,#eef2ff)", color:"#0f172a"}}>
        <div className="max-w-5xl mx-auto" style={{padding:"16px"}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:8}}>
            <h1 className="text-xl sm:text-2xl" style={{fontWeight:700}}>Rouler les os — Vénus, Canis, Senio…</h1>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              <button onClick={()=>{ if(ready) randomThrow(); }} disabled={!ready}
                style={{padding:"10px 14px", border:"1px solid #2563eb", background:"#2563eb", color:"#fff", borderRadius:12, cursor:ready?"pointer":"default", boxShadow:"0 6px 16px rgba(37,99,235,.25)"}}>
                Lancer
              </button>
              <button onClick={()=>{ layoutDice(); setVals([]); setSum(0); setThrowing(false); setMsg("Réinitialisé. Clique « Lancer »."); }} disabled={!ready}
                style={{padding:"8px 12px", border:"1px solid #e5e7eb", background:"#fff", borderRadius:12, cursor:ready?"pointer":"default"}}>
                Réinitialiser
              </button>
            </div>
          </div>

          <p className="text-sm" style={{color:"#475569", marginBottom:12}}>{msg}</p>

          <div ref={wrapRef} style={{position:"relative", border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden", background:"#fff"}}>
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
              <div style={{position:"absolute", left:12, bottom:12, background:"rgba(255,255,255,.96)", border:"1px solid #e5e7eb", borderRadius:12, padding:"10px 12px", maxWidth:"min(96%,640px)"}}>
                <div style={{fontWeight:600, marginBottom:4}}>Tirage</div>
                <div style={{fontSize:14}}>
                  {vals.join("  ")}
                  <span style={{marginLeft:10, color:"#64748b"}}>Somme&nbsp;: {sum}</span>
                </div>
                <div style={{fontSize:12, color:"#64748b", marginTop:4}}>
                  Catégories antiques (indicatif) : Vénus (1-3-4-6), Canis (1-1-1-1), Senio (≥2 × «6»), Trina (triple), Bina (2 paires), Simple (autres).
                </div>
              </div>
            )}
          </div>

          <div style={{fontSize:12, color:"#6b7280", marginTop:8}}>
            Modèle : <code>astragalus_faces.glb</code> — ancres <code>Face_1/3/4/6</code> (ou variantes). Lecture par orientation (+Y de l’ancre vers le haut). Anti-empilement par collisions horizontales et micro-bascules jusqu’à une face bien à plat.
          </div>
        </div>
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel3 = AstragalusLevel3;
})();
