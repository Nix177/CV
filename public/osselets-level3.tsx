// osselets-level3.tsx  —  Jeu 3 : « Rouler les os » (4 astragales, faces 1/3/4/6)
// Objectif : fonctionner sans <script> GLTFLoader, sans CORS unpkg, sans JSX.
// -> Three + GLTFLoader chargés via import() dynamique (esm.sh), 100% encapsulé.

;(() => {
  const { useEffect, useRef, useState } = (window as any).React;

  // ----------------- Config & assets -----------------
  const VIEW_W = 960, VIEW_H = 540, DPR_MAX = 2.5;
  const COUNT = 4;          // nb. d'osselets
  const R = 0.75;           // rayon approx.
  const FLOOR_Y = 0.0;
  const GRAV = -14.5, REST = 0.45, HFR = 0.92, AFR = 0.94;
  const EPS = 0.18, STABLE_MS = 900, COLL_E = 0.25, DOT_LOCK = 0.985, NUDGE = 0.22;
  const RING_OUTER = 8.2, FRAME_PAD = 1.1;

  const BASE = "/assets/games/osselets/level3/";
  const GLB  = BASE + "3d/astragalus_faces.glb";
  const MAP  = BASE + "3d/values.json"; // optionnel { "map": { "1":1, "3":3, "4":4, "6":6 } }

  // Three version (esm.sh a les bons headers CORS)
  const THREE_VER = "0.149.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;

  const clamp = (n:number, a:number, b:number)=>Math.max(a, Math.min(b, n));
  const now   = ()=>performance.now();

  // Cache partagé inter-jeux (si tu ajoutes L2 plus tard avec la même stratégie)
  async function ensureThreeOnce(): Promise<{THREE:any, GLTFLoader:any}> {
    const w = window as any;
    if (w.__OsseletsThree) return w.__OsseletsThree;
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    w.__OsseletsThree = { THREE, GLTFLoader };
    return w.__OsseletsThree;
  }

  function getFaceAnchors(root:any, THREE:any){
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
  function faceUpInfo(anchors:any[], THREE:any){
    if (!anchors?.length) return { tag:"?", dot:-1 };
    const up=new THREE.Vector3(0,1,0), Y=new THREE.Vector3(0,1,0), q=new THREE.Quaternion();
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
    // DOM
    const wrapRef = useRef<any>(null);
    const cvRef   = useRef<any>(null);

    // 3D
    const THREEref   = useRef<any>(null);
    const renderer   = useRef<any>(null);
    const scene      = useRef<any>(null);
    const camera     = useRef<any>(null);

    // Jeu
    const diceRef    = useRef<any[]>([]);
    const boundsRef  = useRef({minX:-6.8,maxX:6.8,minZ:-4.4,maxZ:4.4});
    const mapRef     = useRef<any>({"1":1,"3":3,"4":4,"6":6});

    // Anim
    const reqRef     = useRef<number>(0);
    const lastRef    = useRef<number>(0);

    // UI
    const [ready,setReady] = useState(false);
    const [throwing,setThrowing] = useState(false);
    const [vals,setVals] = useState<string[]>([]);
    const [sum,setSum]   = useState(0);

    function frameCamera(){
      const THREE=THREEref.current; if(!THREE) return;
      const cam=camera.current, r=renderer.current, wrap=wrapRef.current;
      if(!cam || !r || !wrap) return;
      const w=Math.max(320,(wrap.clientWidth|0)), h=Math.round(w*(VIEW_H/VIEW_W));
      const dpr=clamp(window.devicePixelRatio||1,1,DPR_MAX);
      r.setPixelRatio(dpr); r.setSize(w,h,false);

      // Ortho qui cadre tout le plateau
      const aspect=w/h, range=RING_OUTER*FRAME_PAD;
      cam.left=-range*aspect; cam.right=range*aspect; cam.top=range; cam.bottom=-range;
      cam.near=0.1; cam.far=100; cam.updateProjectionMatrix();
      cam.position.set(0,16,12); cam.lookAt(0,0.7,0);

      const padX=0.08, padZ=0.08;
      boundsRef.current = {
        minX: cam.left*(1-padX),
        maxX: cam.right*(1-padX),
        minZ: cam.bottom*(1-padZ),
        maxZ: cam.top*(1-padZ),
      };
    }

    // Resize
    useEffect(()=>{
      const onResize=()=>frameCamera();
      onResize();
      const ro = (window as any).ResizeObserver ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener('resize', onResize);
      return ()=>{ ro?.disconnect(); window.removeEventListener('resize', onResize); };
    },[]);

    // Init
    useEffect(()=>{
      let canceled=false;
      (async()=>{
        const { THREE, GLTFLoader } = await ensureThreeOnce();
        THREEref.current = THREE;

        // Renderer & scene
        const cv=cvRef.current;
        const r=new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:false});
        r.shadowMap.enabled=true; r.shadowMap.type=THREE.PCFSoftShadowMap;
        r.setPixelRatio(clamp(window.devicePixelRatio||1,1,DPR_MAX));
        r.setSize(VIEW_W,VIEW_H,false);
        renderer.current=r;

        const sc=new THREE.Scene(); sc.background=new THREE.Color(0xf5f7fb);
        scene.current=sc;
        const cam=new THREE.OrthographicCamera(-10,10,10,-10,0.1,100);
        camera.current=cam; frameCamera();

        sc.add(new THREE.HemisphereLight(0xffffff,0x334466,.85));
        const dir=new THREE.DirectionalLight(0xffffff,1); dir.position.set(4,7,6);
        dir.castShadow=true; dir.shadow.mapSize?.set?.(1024,1024); sc.add(dir);

        const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,22), new THREE.MeshStandardMaterial({color:0xeae7ff,roughness:.95,metalness:0}));
        ground.rotation.x=-Math.PI/2; ground.position.y=FLOOR_Y; ground.receiveShadow=true; sc.add(ground);

        const ring=new THREE.Mesh(new THREE.RingGeometry(0.01,RING_OUTER,64), new THREE.MeshBasicMaterial({color:0xdee3ff,transparent:true,opacity:.25,side:THREE.DoubleSide}));
        ring.rotation.x=-Math.PI/2; ring.position.y=FLOOR_Y+0.003; sc.add(ring);

        // mapping (facultatif)
        try{ const res=await fetch(MAP,{cache:"no-store"}); if(res.ok){ const j=await res.json(); if(j?.map) mapRef.current=j.map; } }catch{}

        // Modèle
        const loader=new GLTFLoader();
        loader.load(GLB,(gltf:any)=>{
          if (canceled) return;
          const base=gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!base) return;

          base.traverse((o:any)=>{ if(o.isMesh){
            o.castShadow=true; o.receiveShadow=false;
            if(!o.material || !o.material.isMeshStandardMaterial) o.material=new THREE.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
          }});

          // 4 osselets (clones)
          const dice:any[]=[];
          for(let i=0;i<COUNT;i++){
            const inst=base.clone(true); sc.add(inst);
            dice.push({ root:inst, anchors:getFaceAnchors(inst,THREE), vel:new THREE.Vector3(), angVel:new THREE.Vector3(), tStable:0 });
          }
          diceRef.current=dice;

          setReady(true);
          animate();
        }, undefined, (e:any)=>console.warn("[L3] GLB load error", e));
      })();

      return ()=>{ canceled=true; cancelAnimationFrame(reqRef.current); try{ renderer.current?.dispose?.(); }catch{} };
    },[]);

    // Collisions (approx sphères, dans le plan XZ)
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

    // Step
    function step(dt:number){
      const THREE=THREEref.current; if(!THREE) return;
      const b=boundsRef.current, dice=diceRef.current;

      for(const d of dice){
        d.vel.y += GRAV*dt;
        d.root.position.x += d.vel.x*dt;
        d.root.position.y += d.vel.y*dt;
        d.root.position.z += d.vel.z*dt;

        if (d.root.position.y <= FLOOR_Y + R){
          d.root.position.y = FLOOR_Y + R;
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

        if (d.root.position.y <= FLOOR_Y + R + 0.002){
          d.vel.x += Math.sin(d.root.position.z*0.25)*0.02*dt;
          d.vel.z += Math.sin(d.root.position.x*0.25)*0.02*dt;
        }
      }

      collideAndSeparate();

      for(const d of dice){
        const speed=d.vel.length()+d.angVel.length();
        const info=faceUpInfo(d.anchors, THREE);
        if (speed < EPS){
          if (d.root.position.y > FLOOR_Y + R + 1e-3){ d.vel.y -= 0.2; d.tStable=0; }
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
            const info=faceUpInfo(d.anchors, THREE);
            const v = (mapRef.current && mapRef.current[String(info.tag)]) ?? 0;
            out.push(String(info.tag)); s+=v;
          }
          setVals(out); setSum(s);
        }
      }
    }

    function animate(){
      const r=renderer.current, sc=scene.current, cam=camera.current;
      const loop=(t:number)=>{
        const dt=Math.min(0.05, Math.max(0,(t-(lastRef.current||t))/1000)); lastRef.current=t;
        step(dt);
        r.render(sc,cam);
        reqRef.current=requestAnimationFrame(loop);
      };
      reqRef.current=requestAnimationFrame(loop);
    }

    // UI
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

    // Pas de JSX (évite erreurs TS/--jsx). On construit l’arbre à la main.
    const controls = (ready
      ? [
          (window as any).React.createElement("button", { key:"l", className:"btn", onClick:() => throwDice() }, "Lancer"),
          (window as any).React.createElement("button", { key:"r", className:"btn", onClick:() => reset() }, "Réinitialiser"),
        ]
      : [(window as any).React.createElement("span", { key:"c", className:"badge", style:{marginLeft:8} }, "Chargement…")]
    );

    const resultBox = (vals.length>0
      ? (window as any).React.createElement(
          "div",
          { style:{
              position:"absolute", left:12, bottom:12,
              background:"#0b2237cc", border:"1px solid #ffffff22",
              borderRadius:12, padding:"10px 12px"
            }},
          (window as any).React.createElement("div",{style:{fontWeight:700, marginBottom:4}}, "Tirage : " + vals.join("  ")),
          (window as any).React.createElement("div",{style:{fontSize:14}}, `Somme : ${sum} — `, (window as any).React.createElement("b", null, `Points : ${sum}`))
        )
      : null
    );

    return (window as any).React.createElement(
      "div", { ref:wrapRef, style:{position:"relative"} },
      (window as any).React.createElement("canvas", { ref:cvRef, width:VIEW_W, height:VIEW_H, style:{display:"block", borderRadius:12} }),
      (window as any).React.createElement("div", { style:{display:"flex", gap:8, marginTop:10} }, ...controls),
      resultBox
    );
  }

  (window as any).AstragalusLevel3 = AstragalusLevel3;
})();
