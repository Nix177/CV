// Jeu 3 — Rouler les os (faces 1/3/4/6)
// - Aucun import/ESM. Utilise window.THREE (CDN).
// - Attente robuste de GLTFLoader (window.GLTFLoader ou window.THREE.GLTFLoader).
// - Caméra ORTHO responsive qui garde tout le plateau visible + "murs" implicites via bornes ; pseudo-physique légère.
// - Score = somme des faces vers le haut via ancres Face_1/3/4/6 (ou variantes).

;(()=>{
  const { useEffect, useRef, useState } = React;
  const T = (window as any).THREE as any;

  const BASE  = "/assets/games/osselets/level3/";
  const GLB   = BASE + "3d/astragalus_faces.glb";
  const MAPJS = BASE + "3d/values.json"; // optionnel

  const W=960,H=540,DPR_MAX=2.5;

  const COUNT=4, R=0.75, YFLOOR=0;
  const GRAV=-14.5, REST=0.45, HFR=0.92, AFR=0.94;
  const EPS=0.18, STABLE_MS=900, COLL_E=0.25, DOT_LOCK=0.985, NUDGE=0.22;

  const RING_OUTER=8.2, FRAME_PAD=1.1; // frustum cible

  const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
  const now=()=>performance.now();

  function getGLTFLoaderCtor(maxTries = 60, delay = 100): Promise<any> {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const tick = () => {
        const w = window as any;
        const THREE = w.THREE;
        let Ctor = THREE?.GLTFLoader || w.GLTFLoader;
        if (typeof Ctor === "function") {
          if (THREE && !THREE.GLTFLoader) THREE.GLTFLoader = Ctor; // normalisation
          return resolve(Ctor);
        }
        if (++tries >= maxTries) {
          return reject(new Error("GLTFLoader non trouvé (ni window.THREE.GLTFLoader ni window.GLTFLoader)."));
        }
        setTimeout(tick, delay);
      };
      tick();
    });
  }

  function getFaceAnchors(root:any){
    const out:any[]=[];
    root.traverse((n:any)=>{
      const s=(n.name||"").toLowerCase();
      let tag="";
      if (/^(face[_\s-]?1|f1|value[_\s-]?1|valeur[_\s-]?1)$/.test(s)) tag="1";
      else if (/^(face[_\s-]?3|f3|value[_\s-]?3|valeur[_\s-]?3)$/.test(s)) tag="3";
      else if (/^(face[_\s-]?4|f4|value[_\s-]?4|valeur[_\s-]?4)$/.test(s)) tag="4";
      else if (/^(face[_\s-]?6|f6|value[_\s-]?6|valeur[_\s-]?6)$/.test(s)) tag="6";
      if (tag) out.push({ node:n, tag });
    });
    return out;
  }
  function faceUpInfo(anchors:any[]){
    if (!anchors?.length) return { tag:"?", dot:-1 };
    const up=new T.Vector3(0,1,0), Y=new T.Vector3(0,1,0), q=new T.Quaternion();
    let best={tag:"?", dot:-2};
    for(const a of anchors){
      a.node.getWorldQuaternion(q);
      const yw=Y.clone().applyQuaternion(q).normalize();
      const d=yw.dot(up);
      if (d>best.dot) best={tag:a.tag, dot:d};
    }
    return best;
  }

  function AstragalusLevel3(){
    const wrapRef=useRef<HTMLDivElement|null>(null);
    const cvRef  =useRef<HTMLCanvasElement|null>(null);

    const rendererRef=useRef<any>(null);
    const sceneRef   =useRef<any>(null);
    const camRef     =useRef<any>(null);

    const diceRef    =useRef<any[]>([]);
    const boundsRef  =useRef({minX:-6.8,maxX:6.8,minZ:-4.4,maxZ:4.4});

    const rafRef     =useRef(0);
    const lastRef    =useRef(0);
    const valueMap   =useRef<Record<string,number>>({"1":1,"3":3,"4":4,"6":6});

    const [ready,setReady]=useState(false);
    const [throwing,setThrowing]=useState(false);
    const [vals,setVals]=useState<string[]>([]);
    const [sum,setSum]=useState(0);

    // --- cadrage ORTHO qui garde tout le plateau visible ---
    function frameCamera(){
      const cam=camRef.current!, wrap=wrapRef.current!, r=rendererRef.current!;
      const w=Math.max(320,(wrap.clientWidth|0)), h=Math.round(w*(H/W));
      const dpr=clamp(window.devicePixelRatio||1,1,DPR_MAX);
      r.setPixelRatio(dpr); r.setSize(w,h,false);

      const aspect=w/h, range=RING_OUTER*FRAME_PAD;
      cam.left=-range*aspect; cam.right=range*aspect; cam.top=range; cam.bottom=-range;
      cam.near=0.1; cam.far=100; cam.updateProjectionMatrix();
      cam.position.set(0,16,12); cam.lookAt(0,0.7,0);

      const padX=0.08, padZ=0.08;
      boundsRef.current={
        minX: cam.left*(1-padX),
        maxX: cam.right*(1-padX),
        minZ: cam.bottom*(1-padZ),
        maxZ: cam.top*(1-padZ)
      };
    }

    // --- Resize observer ---
    useEffect(()=>{
      const onResize=()=>{ if(rendererRef.current && camRef.current && wrapRef.current) frameCamera(); };
      onResize();
      const ro=(window as any).ResizeObserver ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener('resize', onResize);
      return ()=>{ ro?.disconnect(); window.removeEventListener('resize', onResize); };
    },[]);

    // --- Init 3D / chargement modèle ---
    useEffect(()=>{
      let cancelled=false;
      (async()=>{
        if (!T) { console.warn("[L3] THREE absent"); return; }

        // mapping optionnel (externe)
        try{ const r=await fetch(MAPJS,{cache:"no-store"}); if(r.ok){ const j=await r.json(); if(j?.map) valueMap.current=j.map; } }catch{}

        const cv=cvRef.current!;
        const renderer=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:false});
        renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap||renderer.shadowMap.type;
        rendererRef.current=renderer;

        const scene=new T.Scene(); scene.background=new T.Color(0xf5f7fb);
        const cam=new T.OrthographicCamera(-10,10,10,-10,0.1,100);
        sceneRef.current=scene; camRef.current=cam;
        frameCamera();

        scene.add(new T.HemisphereLight(0xffffff,0x334466,.85));
        const dir=new T.DirectionalLight(0xffffff,1); dir.position.set(4,7,6);
        dir.castShadow=true; dir.shadow.mapSize?.set?.(1024,1024); scene.add(dir);

        const ground=new T.Mesh(new T.PlaneGeometry(40,22), new T.MeshStandardMaterial({color:0xeae7ff,roughness:.95,metalness:0}));
        ground.rotation.x=-Math.PI/2; ground.position.y=YFLOOR; ground.receiveShadow=true; scene.add(ground);

        const ring=new T.Mesh(new T.RingGeometry(0.01,RING_OUTER,64), new T.MeshBasicMaterial({color:0xdee3ff,transparent:true,opacity:.25,side:T.DoubleSide}));
        ring.rotation.x=-Math.PI/2; ring.position.y=YFLOOR+0.003; scene.add(ring);

        const GLTF = await getGLTFLoaderCtor(); // ← robust
        const loader = new GLTF();
        loader.load(GLB,(gltf:any)=>{
          if(cancelled) return;
          const base=gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!base) return;

          base.traverse((o:any)=>{ if(o.isMesh){
            o.castShadow=true; o.receiveShadow=false;
            if(!o.material || !o.material.isMeshStandardMaterial) o.material=new T.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
          }});

          const dice:any[]=[];
          for(let i=0;i<COUNT;i++){
            const inst=base.clone(true); scene.add(inst);
            dice.push({ root:inst, anchors:getFaceAnchors(inst), vel:new T.Vector3(), angVel:new T.Vector3(), tStable:0 });
          }
          diceRef.current=dice;
          setReady(true);
          animate();
        }, undefined, (e:any)=>console.warn("[L3] GLB load error", e));
      })();

      return ()=>{ 
        cancelled=true; 
        cancelAnimationFrame(rafRef.current);
        try{ rendererRef.current?.dispose?.(); }catch{}
      };
    },[]);

    // --- collisions simplifiées ---
    function collideAndSeparate(){
      const dice=diceRef.current;
      for(let i=0;i<dice.length;i++){
        for(let j=i+1;j<dice.length;j++){
          const a=dice[i], b=dice[j];
          const dx=b.root.position.x-a.root.position.x;
          const dz=b.root.position.z-a.root.position.z;
          const dist=Math.hypot(dx,dz), min=2*R*0.98;
          if(dist<min){
            const nx=dist>1e-6?dx/dist:1, nz=dist>1e-6?dz/dist:0;
            const push=(min-dist)+1e-3;
            a.root.position.x -= nx*push*0.5; a.root.position.z -= nz*push*0.5;
            b.root.position.x += nx*push*0.5; b.root.position.z += nz*push*0.5;

            const an=a.vel.x*nx+a.vel.z*nz, bn=b.vel.x*nx+b.vel.z*nz;
            const dv=(bn-an)*COLL_E;
            a.vel.x+=nx*dv; a.vel.z+=nz*dv;
            b.vel.x-=nx*dv; b.vel.z-=nz*dv;
          }
        }
      }
    }

    // --- step / intégration ---
    function step(dt:number){
      const b=boundsRef.current, dice=diceRef.current;

      for(const d of dice){
        d.vel.y += GRAV*dt;

        d.root.position.x += d.vel.x*dt;
        d.root.position.y += d.vel.y*dt;
        d.root.position.z += d.vel.z*dt;

        if (d.root.position.y <= YFLOOR + R){
          d.root.position.y = YFLOOR + R;
          if (d.vel.y < 0) d.vel.y = -d.vel.y*REST;
          d.vel.x *= HFR; d.vel.z *= HFR; d.angVel.multiplyScalar(AFR);
        }

        if (d.root.position.x < b.minX){ d.root.position.x=b.minX; d.vel.x=Math.abs(d.vel.x)*0.6; }
        if (d.root.position.x > b.maxX){ d.root.position.x=b.maxX; d.vel.x=-Math.abs(d.vel.x)*0.6; }
        if (d.root.position.z < b.minZ){ d.root.position.z=b.minZ; d.vel.z=Math.abs(d.vel.z)*0.6; }
        if (d.root.position.z > b.maxZ){ d.root.position.z=b.maxZ; d.vel.z=-Math.abs(d.vel.z)*0.6; }

        d.root.rotation.x += d.angVel.x*dt;
        d.root.rotation.y += d.angVel.y*dt;
        d.root.rotation.z += d.angVel.z*dt;

        if (d.root.position.y <= YFLOOR + R + 0.002){
          d.vel.x += Math.sin(d.root.position.z*0.25)*0.02*dt;
          d.vel.z += Math.sin(d.root.position.x*0.25)*0.02*dt;
        }
      }

      collideAndSeparate();

      for(const d of dice){
        const speed=d.vel.length()+d.angVel.length();
        const info=faceUpInfo(d.anchors);
        if (speed < EPS){
          if (d.root.position.y > YFLOOR + R + 1e-3){ d.vel.y -= 0.2; d.tStable=0; }
          else if (info.dot < DOT_LOCK){ d.angVel.x += (Math.random()-.5)*NUDGE*dt*60; d.angVel.z += (Math.random()-.5)*NUDGE*dt*60; d.tStable=0; }
          else { if (!d.tStable) d.tStable=now(); }
        } else d.tStable=0;
      }

      if (throwing){
        const all=dice.every(d=>d.tStable && (now()-d.tStable>STABLE_MS));
        if (all){
          setThrowing(false);
          const out:string[]=[]; let s=0;
          for(const d of dice){
            const info=faceUpInfo(d.anchors);
            const v=valueMap.current[String(info.tag)] ?? 0;
            out.push(String(info.tag)); s+=v;
          }
          setVals(out); setSum(s);
        }
      }
    }

    // --- loop ---
    function animate(){
      const r=rendererRef.current!, s=sceneRef.current!, c=camRef.current!;
      const loop=(t:number)=>{
        const dt=Math.min(0.05, Math.max(0,(t-lastRef.current)/1000)); lastRef.current=t;
        step(dt);
        r.render(s,c);
        rafRef.current=requestAnimationFrame(loop);
      };
      rafRef.current=requestAnimationFrame(loop);
    }

    // --- UI ---
    function throwDice(){
      const dice=diceRef.current, b=boundsRef.current;
      for(let i=0;i<dice.length;i++){
        const d=dice[i];
        d.root.position.set((b.minX+b.maxX)/2 - 2 + i*1.2, 2.2 + Math.random()*0.8, (b.minZ+b.maxZ)/2 - 1 + Math.random()*2);
        d.root.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
        d.vel.set(5.2 + Math.random()*2.0, 2.5 + Math.random()*1.2, 1.5 - Math.random()*3.0);
        d.angVel.set((-1+Math.random()*2)*6.0, (-1+Math.random()*2)*6.0, (-1+Math.random()*2)*6.0);
        d.tStable=0;
      }
      setVals([]); setSum(0); setThrowing(true);
    }
    function reset(){
      const dice=diceRef.current, b=boundsRef.current;
      for(const d of dice){
        d.vel.set(0,0,0); d.angVel.set(0,0,0); d.tStable=0;
        d.root.position.set((b.minX+b.maxX)/2 - 2 + Math.random()*4, 1.6 + Math.random()*0.6, (b.minZ+b.maxZ)/2 - 1 + Math.random()*2);
        d.root.rotation.set(Math.random(),Math.random(),Math.random());
      }
      setVals([]); setSum(0); setThrowing(false);
    }

    return (
      <div ref={wrapRef} style={{position:"relative"}}>
        <canvas ref={cvRef} width={W} height={H} style={{display:"block", borderRadius:12}}/>
        <div style={{display:"flex", gap:8, marginTop:10}}>
          <button className="btn" onClick={throwDice}>Lancer</button>
          <button className="btn" onClick={reset}>Réinitialiser</button>
          {!ready && <span className="badge" style={{marginLeft:8}}>Chargement…</span>}
        </div>
        {vals.length>0 && (
          <div style={{position:"absolute", left:12, bottom:12, background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:12, padding:"10px 12px"}}>
            <div style={{fontWeight:700, marginBottom:4}}>Tirage : {vals.join("  ")}</div>
            <div style={{fontSize:14}}>Somme&nbsp;: {sum} — <b>Points&nbsp;: {sum}</b></div>
          </div>
        )}
      </div>
    );
  }

  (window as any).AstragalusLevel3 = AstragalusLevel3;
})();
