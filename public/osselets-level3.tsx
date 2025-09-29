// Jeu 3 — Rouler les os (faces 1/3/4/6)
// - Utilise THREE global, pas d'import
// - Cadre caméra → bornes dynamiques = plateau toujours visible
// - Score = somme des faces "vers le haut" via ancres Face_1/3/4/6

;(() => {
  const { useEffect, useRef, useState } = React;
  const _THREE = (window as any).THREE;
  const GLTFLoader = (_THREE as any).GLTFLoader;

  const BASE   = "/assets/games/osselets/level3/";
  const MODEL  = BASE + "3d/astragalus_faces.glb";
  const MAPJS  = BASE + "3d/values.json"; // optionnel: {"map":{"1":1,"3":3,"4":4,"6":6}}

  const W=960, H=540, DPR_MAX=2.5;

  const COUNT=4, R=0.75, YFLOOR=0;
  const GRAV=-14.5, REST=0.45, HFR=0.92, AFR=0.94;
  const EPS=0.18, STABLE=900, COLL_E=0.25, DOT_LOCK=0.985, NUDGE=0.22;

  const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
  const now=()=>performance.now();

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
    const up = new _THREE.Vector3(0,1,0), Y = new _THREE.Vector3(0,1,0), q = new _THREE.Quaternion();
    let best={"tag":"?", "dot":-2};
    for(const a of anchors){
      a.node.getWorldQuaternion(q);
      const yw = Y.clone().applyQuaternion(q).normalize();
      const d = yw.dot(up);
      if (d > best.dot) best={tag:a.tag, dot:d};
    }
    return best;
  }

  function AstragalusLevel3(){
    const wrapRef = useRef<HTMLDivElement|null>(null);
    const canvasRef = useRef<HTMLCanvasElement|null>(null);

    const [ready,setReady]=useState(false);
    const [throwing,setThrowing]=useState(false);
    const [vals,setVals]=useState<string[]>([]);
    const [sum,setSum]=useState(0);

    // 3D
    const rendererRef=useRef<any>(null);
    const sceneRef=useRef<any>(null);
    const cameraRef=useRef<any>(null);
    const diceRef=useRef<any[]>([]);
    const boundsRef=useRef({minX:-6.8,maxX:6.8,minZ:-4.4,maxZ:4.4});
    const lastRef=useRef(0); const rafRef=useRef<number>(0);
    const mapRef=useRef<Record<string,number>>({"1":1,"3":3,"4":4,"6":6});

    function updateBoundsFromCamera(){
      const cam=cameraRef.current; if(!cam) return;
      const camPos=new _THREE.Vector3(); cam.getWorldPosition(camPos);
      const planeY=YFLOOR+R;
      const xs:number[]=[], zs:number[]=[];
      const ndcs=[[-1,-1],[1,-1],[1,1],[-1,1]];
      for(const [nx,ny] of ndcs){
        const p = new _THREE.Vector3(nx,ny,0.5).unproject(cam);
        const dir=p.sub(camPos);
        if (Math.abs(dir.y)<1e-4) continue;
        const t=(planeY - camPos.y)/dir.y;
        if (t>0){ const hit=camPos.clone().addScaledVector(dir,t); xs.push(hit.x); zs.push(hit.z); }
      }
      if (xs.length&&zs.length){
        const px=0.08,pz=0.08;
        const minX=Math.min(...xs), maxX=Math.max(...xs);
        const minZ=Math.min(...zs), maxZ=Math.max(...zs);
        boundsRef.current={
          minX: minX+(maxX-minX)*px,
          maxX: maxX-(maxX-minX)*px,
          minZ: minZ+(maxZ-minZ)*pz,
          maxZ: maxZ-(maxZ-minZ)*pz
        };
      }
    }

    // Resize
    useEffect(()=>{
      function onResize(){
        const cv=canvasRef.current, r=rendererRef.current, cam=cameraRef.current, wrap=wrapRef.current;
        if(!cv||!r||!cam||!wrap) return;
        const w=Math.max(320, (wrap.clientWidth|0)), h=Math.round(w*(H/W));
        const dpr=clamp(window.devicePixelRatio||1,1,DPR_MAX);
        r.setPixelRatio(dpr); r.setSize(w,h,false);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        cam.aspect=w/h; cam.updateProjectionMatrix();
        updateBoundsFromCamera();
      }
      onResize();
      const ro = (window as any).ResizeObserver ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener('resize', onResize);
      return ()=>{ ro?.disconnect(); window.removeEventListener('resize', onResize); };
    },[]);

    // Init
    useEffect(()=>{
      let cancelled=false;
      (async()=>{
        // fetch mapping (optionnel)
        try{
          const res=await fetch(MAPJS,{cache:"no-store"});
          if (res.ok){ const j=await res.json(); if (j?.map) mapRef.current=j.map; }
        }catch{}

        const cv=canvasRef.current!;
        const r=new _THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:false});
        r.setPixelRatio(clamp(window.devicePixelRatio||1,1,DPR_MAX));
        r.setSize(W,H,false);
        r.shadowMap.enabled=true;
        r.shadowMap.type=_THREE.PCFSoftShadowMap;
        rendererRef.current=r;

        const scene=new _THREE.Scene(); scene.background=new _THREE.Color(0xf5f7fb);
        const cam=new _THREE.PerspectiveCamera(45, W/H, 0.1, 100);
        cam.position.set(6.2, 4.9, 7.6);
        cam.lookAt(0, 0.7, 0);
        sceneRef.current=scene; cameraRef.current=cam;

        // lights + sol/repère
        scene.add(new _THREE.HemisphereLight(0xffffff,0x334466,.85));
        const dir=new _THREE.DirectionalLight(0xffffff,1); dir.position.set(4,7,6);
        dir.castShadow=true; dir.shadow.mapSize.set(1024,1024); scene.add(dir);

        const ground=new _THREE.Mesh(new _THREE.PlaneGeometry(40,22), new _THREE.MeshStandardMaterial({color:0xeae7ff,roughness:.95,metalness:0}));
        ground.rotation.x=-Math.PI/2; ground.position.y=YFLOOR; ground.receiveShadow=true; scene.add(ground);

        const ring=new _THREE.Mesh(new _THREE.RingGeometry(0.01,8.2,64), new _THREE.MeshBasicMaterial({color:0xdee3ff,transparent:true,opacity:.25,side:_THREE.DoubleSide}));
        ring.rotation.x=-Math.PI/2; ring.position.y=YFLOOR+0.003; scene.add(ring);

        updateBoundsFromCamera();

        // modèle + clones
        const loader=new GLTFLoader();
        loader.load(MODEL,(gltf:any)=>{
          if (cancelled) return;
          const base=gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!base) return;
          base.traverse((o:any)=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false;
            if(!o.material || !o.material.isMeshStandardMaterial) o.material=new _THREE.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
          }});

          const dice:any[]=[];
          for(let i=0;i<COUNT;i++){
            const inst=base.clone(true); scene.add(inst);
            dice.push({ root:inst, anchors:getFaceAnchors(inst), vel:new _THREE.Vector3(), angVel:new _THREE.Vector3(), tStable:0 });
          }
          diceRef.current=dice;
          setReady(true);
          animate();
        }, undefined, (e:any)=>console.warn("[L3] load error", e));
      })();
      return ()=>{ cancelled=true; cancelAnimationFrame(rafRef.current); };
    },[]);

    function collideAndSeparate(){
      const dice=diceRef.current;
      for(let i=0;i<dice.length;i++){
        for(let j=i+1;j<dice.length;j++){
          const a=dice[i], b=dice[j];
          const dx=b.root.position.x - a.root.position.x;
          const dz=b.root.position.z - a.root.position.z;
          const dist=Math.hypot(dx,dz), min=2*R*0.98;
          if (dist<min){
            const nx=dist>1e-6?dx/dist:1, nz=dist>1e-6?dz/dist:0;
            const push=(min-dist)+1e-3;
            a.root.position.x -= nx*push*0.5; a.root.position.z -= nz*push*0.5;
            b.root.position.x += nx*push*0.5; b.root.position.z += nz*push*0.5;
            // restitution tangentielle simple
            const av=a.vel, bv=b.vel;
            const an = av.x*nx + av.z*nz, bn = bv.x*nx + bv.z*nz;
            const dv = (bn - an)*COLL_E;
            av.x += nx*dv; av.z += nz*dv;
            bv.x -= nx*dv; bv.z -= nz*dv;
          }
        }
      }
    }

    function step(dt:number){
      const b=boundsRef.current, dice=diceRef.current;

      for(const d of dice){
        // gravité
        d.vel.y += GRAV*dt;
        // intégration
        d.root.position.x += d.vel.x*dt;
        d.root.position.y += d.vel.y*dt;
        d.root.position.z += d.vel.z*dt;
        // sol
        if (d.root.position.y <= YFLOOR + R){
          d.root.position.y = YFLOOR + R;
          if (d.vel.y < 0) d.vel.y = -d.vel.y*REST;
          d.vel.x *= HFR; d.vel.z *= HFR; d.angVel.multiplyScalar(AFR);
        }
        // murs dynamiques
        if (d.root.position.x < b.minX){ d.root.position.x=b.minX; d.vel.x = Math.abs(d.vel.x)*0.6; }
        if (d.root.position.x > b.maxX){ d.root.position.x=b.maxX; d.vel.x = -Math.abs(d.vel.x)*0.6; }
        if (d.root.position.z < b.minZ){ d.root.position.z=b.minZ; d.vel.z = Math.abs(d.vel.z)*0.6; }
        if (d.root.position.z > b.maxZ){ d.root.position.z=b.maxZ; d.vel.z = -Math.abs(d.vel.z)*0.6; }

        // rotation
        d.root.rotation.x += d.angVel.x*dt;
        d.root.rotation.y += d.angVel.y*dt;
        d.root.rotation.z += d.angVel.z*dt;

        // aide à se coucher
        if (d.root.position.y <= YFLOOR + R + 0.002){
          d.vel.x += Math.sin(d.root.position.z*0.25)*0.02*dt;
          d.vel.z += Math.sin(d.root.position.x*0.25)*0.02*dt;
        }
      }

      collideAndSeparate();

      // stabilisation + score
      for(const d of dice){
        const speed = d.vel.length() + d.angVel.length();
        const info  = faceUpInfo(d.anchors);
        if (speed < EPS){
          if (d.root.position.y > YFLOOR + R + 1e-3) { d.vel.y -= 0.2; d.tStable=0; }
          else if (info.dot < DOT_LOCK){ d.angVel.x += (Math.random()-.5)*NUDGE*dt*60; d.angVel.z += (Math.random()-.5)*NUDGE*dt*60; d.tStable=0; }
          else { if (!d.tStable) d.tStable = now(); }
        } else d.tStable = 0;
      }

      if (throwing){
        const all = dice.every(d => d.tStable && (now()-d.tStable > STABLE));
        if (all){
          setThrowing(false);
          const out:string[]=[]; let s=0;
          for(const d of dice){
            const info=faceUpInfo(d.anchors);
            const v=mapRef.current[String(info.tag)] ?? 0;
            out.push(String(info.tag)); s+=v;
          }
          setVals(out); setSum(s);
        }
      }
    }

    function animate(){
      const r=rendererRef.current, s=sceneRef.current, c=cameraRef.current;
      const loop=(t:number)=>{
        const dt=Math.min(0.05, Math.max(0, (t - lastRef.current)/1000)); lastRef.current=t;
        step(dt);
        r.render(s,c);
        rafRef.current=requestAnimationFrame(loop);
      };
      rafRef.current=requestAnimationFrame(loop);
    }

    function throwDice(){
      const dice=diceRef.current;
      // positions de départ centrées (dans les bornes dynamiques)
      const b=boundsRef.current;
      for(let i=0;i<dice.length;i++){
        const d=dice[i];
        d.root.position.set(
          (b.minX+b.maxX)/2 - 2 + i*1.2,
          2.2 + Math.random()*0.8,
          (b.minZ+b.maxZ)/2 - 1 + Math.random()*2
        );
        d.root.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
        d.vel.set(5.2 + Math.random()*2.0, 2.5 + Math.random()*1.2, 1.5 - Math.random()*3.0);
        d.angVel.set( (-1+Math.random()*2)*6.0, (-1+Math.random()*2)*6.0, (-1+Math.random()*2)*6.0 );
        d.tStable=0;
      }
      setVals([]); setSum(0); setThrowing(true);
    }
    function reset(){
      const dice=diceRef.current, b=boundsRef.current;
      for(const d of dice){
        d.vel.set(0,0,0); d.angVel.set(0,0,0); d.tStable=0;
        d.root.position.set(
          (b.minX+b.maxX)/2 - 2 + Math.random()*4,
          1.6 + Math.random()*0.6,
          (b.minZ+b.maxZ)/2 - 1 + Math.random()*2
        );
        d.root.rotation.set(Math.random(),Math.random(),Math.random());
      }
      setVals([]); setSum(0); setThrowing(false);
    }

    return (
      <div ref={wrapRef} style={{position:"relative"}}>
        <canvas ref={canvasRef} width={W} height={H} style={{display:"block", borderRadius:12}}/>
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
        <div style={{fontSize:12, color:"#6b7280", marginTop:8}}>
          Modèle : <code>astragalus_faces.glb</code> — ancres <code>Face_1/3/4/6</code>. Les limites s’adaptent à la caméra pour garder tout le plateau visible.
        </div>
      </div>
    );
  }

  // @ts-ignore
  (window as any).AstragalusLevel3 = AstragalusLevel3;
})();
