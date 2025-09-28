// public/osselets-level3.tsx
// LEVEL 3 — « Rouler les os » (dés 1/3/4/6) avec votre modèle : /assets/games/osselets/level3/3d/astragalus_faces.glb
// 4 astragales clonés, lancer aléatoire, lecture de la face +Y (ancres Face_1/3/4/6).
// Three/GLTFLoader chargés d’abord en LOCAL (vendor/), sinon CDN, version *pinnée*.

;(()=> {
  const { useEffect, useRef, useState } = React;

  const L3_BASE    = "/assets/games/osselets/level3/";
  const MODEL_URL  = L3_BASE + "3d/astragalus_faces.glb";
  const VALUES_URL = L3_BASE + "3d/values.json";

  const W = 960, H = 540, DPR_MAX = 2.5;
  const COUNT = 4, FLOOR_Y = 0, GRAV = -14.5, REST = 0.45, FRIC = 0.92, AFRIC = 0.94, EPS = 0.18, STABLE_MS = 800;

  /* -------------------- Loader Three global (identique L2) -------------------- */
  const VER = "0.158.0";
  const VENDOR_CANDIDATES = [
    "/assets/games/osselets/vendor/",
    "/assets/vendor/",
    "/vendor/",
  ];
  function injectScript(src){
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = () => res(src); s.onerror = (e)=>rej(e||new Event("error"));
      document.head.appendChild(s);
    });
  }
  async function loadFirst(urls, check){
    for (let i=0;i<urls.length;i++){
      try { await injectScript(urls[i]); if (!check || check()) return urls[i]; } catch {}
    }
    throw new Error("loadFirst failed");
  }
  async function ensureThreeGlobal(){
    if (window.__threeGlobalPromise) return window.__threeGlobalPromise;
    window.__threeGlobalPromise = (async () => {
      if (window.THREE && window.THREE.GLTFLoader) return { THREE: window.THREE, GLTFLoader: window.THREE.GLTFLoader };

      const local3 = [], localGL=[];
      for (const base of VENDOR_CANDIDATES){
        local3.push(base + "three.min.js", base + "build/three.min.js");
        localGL.push(base + "GLTFLoader.js", base + "examples/js/loaders/GLTFLoader.js");
      }
      try { await loadFirst(local3, ()=>!!window.THREE); } catch {}
      if (window.THREE){ try { await loadFirst(localGL, ()=>!!window.THREE.GLTFLoader); } catch {} }
      if (window.THREE && window.THREE.GLTFLoader) return { THREE: window.THREE, GLTFLoader: window.THREE.GLTFLoader };

      const cdn3 = [
        `https://unpkg.com/three@${VER}/build/three.min.js`,
        `https://cdn.jsdelivr.net/npm/three@${VER}/build/three.min.js`,
      ];
      const cdnGL = [
        `https://unpkg.com/three@${VER}/examples/js/loaders/GLTFLoader.js`,
        `https://cdn.jsdelivr.net/npm/three@${VER}/examples/js/loaders/GLTFLoader.js`,
      ];
      try { await loadFirst(cdn3, ()=>!!window.THREE); } catch (e){ console.error("[L3] three load fail:", e); }
      if (window.THREE){ try { await loadFirst(cdnGL, ()=>!!window.THREE.GLTFLoader); } catch (e){ console.error("[L3] gltfloader load fail:", e); } }

      if (!(window.THREE && window.THREE.GLTFLoader)) throw new Error("Three/GLTFLoader indisponible");
      return { THREE: window.THREE, GLTFLoader: window.THREE.GLTFLoader };
    })();
    return window.__threeGlobalPromise;
  }

  function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
  const now = ()=> (typeof performance!=="undefined"?performance:Date).now();
  async function getJSON(u){ try{ const r=await fetch(u,{cache:"no-store"}); if(r.ok) return await r.json(); }catch(e){} return null; }

  function extractAnchorsFaces(root){
    const out=[];
    root.traverse((n)=>{
      const nm=(n.name||"").toLowerCase();
      let tag=null;
      if (/^face[_\s-]?1$|^f1$|value[_\s-]?1$|valeur[_\s-]?1$/.test(nm)) tag="1";
      else if (/^face[_\s-]?3$|^f3$|value[_\s-]?3$|valeur[_\s-]?3$/.test(nm)) tag="3";
      else if (/^face[_\s-]?4$|^f4$|value[_\s-]?4$|valeur[_\s-]?4$/.test(nm)) tag="4";
      else if (/^face[_\s-]?6$|^f6$|value[_\s-]?6$|valeur[_\s-]?6$/.test(nm)) tag="6";
      if (tag) out.push({ node:n, tag:tag });
    });
    return out;
  }
  function topFaceByOrientation(anchors, THREE){
    if (!anchors || !anchors.length) return null;
    const up = new THREE.Vector3(0,1,0), y = new THREE.Vector3(0,1,0);
    const q = new THREE.Quaternion();
    let best=null, bestDot=-1e9;
    for (let i=0;i<anchors.length;i++){
      const a=anchors[i];
      a.node.getWorldQuaternion(q);
      const yw = y.clone().applyQuaternion(q).normalize();
      const d = yw.dot(up);
      if (d>bestDot){ bestDot=d; best=a.tag; }
    }
    return best;
  }

  function AstragalusLevel3(){
    const wrapRef   = useRef(null);
    const canvasRef = useRef(null);
    const [ready,setReady] = useState(false);
    const [throwing,setThrowing] = useState(false);
    const [vals,setVals] = useState([]);
    const [msg,setMsg] = useState("Lance 4 astragales (faces 1/3/4/6).");

    // 3D
    const THREEref = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const baseRef = useRef(null);
    const diceRef = useRef([]);  // {root, anchors, vel, angVel, stableSince}
    const reqRef = useRef(0);
    const lastRef = useRef(0);
    const mapRef = useRef(null);

    /* ---------- Resize ---------- */
    useEffect(()=>{
      function onResize(){
        const THREE=THREEref.current; if(!THREE) return;
        const wrap=wrapRef.current, canvas=canvasRef.current, renderer=rendererRef.current, cam=cameraRef.current;
        if (!wrap || !canvas || !renderer || !cam) return;
        const w=Math.max(320, wrap.clientWidth|0), h=Math.round(w*(H/W));
        const dpr=clamp(window.devicePixelRatio||1,1,DPR_MAX);
        renderer.setPixelRatio(dpr);
        renderer.setSize(w,h,false);
        canvas.style.width=w+"px"; canvas.style.height=h+"px";
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
        try { libs = await ensureThreeGlobal(); }
        catch (e){ console.error("[L3] Three/GLTFLoader load fail:", e); setMsg("Three.js/GLTFLoader manquant."); return; }
        if (!libs){ setMsg("Three.js/GLTFLoader manquant."); return; }
        const { THREE } = libs;
        THREEref.current = THREE;

        // Renderer
        const renderer=new THREE.WebGLRenderer({ canvas:canvasRef.current, antialias:true, alpha:true });
        renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        renderer.toneMapping=THREE.ACESFilmicToneMapping;
        rendererRef.current=renderer;

        // Scene/cam
        const scene=new THREE.Scene(); scene.background=new THREE.Color(0xf5f7fb);
        const cam=new THREE.PerspectiveCamera(45,16/9,0.1,100); cam.position.set(6.4,4.7,7.4); cam.lookAt(0,0.7,0);
        sceneRef.current=scene; cameraRef.current=cam;

        scene.add(new THREE.HemisphereLight(0xffffff,0x334466,.8));
        const dir=new THREE.DirectionalLight(0xffffff,1); dir.position.set(4,7,6);
        dir.castShadow=true; dir.shadow.mapSize.set(1024,1024);
        scene.add(dir);

        const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,22), new THREE.MeshStandardMaterial({color:0xeae7ff,roughness:.95,metalness:0}));
        ground.rotation.x=-Math.PI/2; ground.position.y=FLOOR_Y; ground.receiveShadow=true; scene.add(ground);

        const ring=new THREE.Mesh(new THREE.RingGeometry(0.01,8,64), new THREE.MeshBasicMaterial({color:0xdee3ff,transparent:true,opacity:.25,side:THREE.DoubleSide}));
        ring.rotation.x=-Math.PI/2; ring.position.y=FLOOR_Y+0.005; scene.add(ring);

        mapRef.current = await getJSON(VALUES_URL);

        // Modèle
        const loader=new window.THREE.GLTFLoader();
        loader.load(MODEL_URL, (gltf)=>{
          if (cancelled) return;
          const base=gltf.scene || (gltf.scenes && gltf.scenes[0]); if(!base){ setMsg("Modèle vide."); return; }
          base.traverse((o)=>{
            if(o.isMesh){
              if(!o.material || !o.material.isMeshStandardMaterial)
                o.material=new THREE.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
              o.castShadow=true; o.receiveShadow=false;
            }
          });
          // normalisation
          const box=new THREE.Box3().setFromObject(base);
          const s = 1.6/Math.max.apply(null, box.getSize(new THREE.Vector3()).toArray());
          base.scale.setScalar(s);
          box.setFromObject(base);
          base.position.sub(box.getCenter(new THREE.Vector3()));
          baseRef.current=base;

          // clones
          const dice=[];
          for(let i=0;i<COUNT;i++){
            const g=base.clone(true); scene.add(g);
            dice.push({
              root:g,
              anchors: extractAnchorsFaces(g),
              vel:new THREE.Vector3(),
              angVel:new THREE.Vector3(),
              stableSince:0
            });
          }
          diceRef.current=dice;

          layoutDice();
          setReady(true);
          startLoop();
        }, undefined, (err)=>{ console.error("[L3] GLB load error:", err); setMsg("Échec chargement : "+MODEL_URL); });

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

    /* ---------- Physique simple ---------- */
    function layoutDice(){
      const THREE=THREEref.current, dice=diceRef.current; if(!THREE||!dice||!dice.length) return;
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
      const THREE=THREEref.current, dice=diceRef.current; if(!THREE||!dice||!dice.length) return;
      for(let i=0;i<dice.length;i++){
        const d=dice[i];
        d.root.position.set(-3.5 + i*0.6, 2.2 + Math.random()*0.8, -1.8 + Math.random()*3.4);
        d.root.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        d.vel.set(5.2 + Math.random()*2.0, 2.5 + Math.random()*1.2, 1.5 - Math.random()*3.0);
        d.angVel.set( (-1+Math.random()*2)*6.0, (-1+Math.random()*2)*6.0, (-1+Math.random()*2)*6.0 );
        d.stableSince=0; d.root.updateMatrixWorld(true);
      }
      setVals([]); setThrowing(true); setMsg("Lancer ! (attendre l’arrêt)");
    }
    function step(dt){
      const THREE=THREEref.current, dice=diceRef.current; if(!THREE||!dice||!dice.length) return;
      let allStable=true;
      for(let i=0;i<dice.length;i++){
        const d=dice[i];
        d.vel.y += GRAV*dt;
        d.root.position.addScaledVector(d.vel, dt);

        const r=0.75;
        if (d.root.position.y - r <= FLOOR_Y){
          d.root.position.y=FLOOR_Y+r;
          if (d.vel.y<0) d.vel.y = -d.vel.y*REST;
          d.vel.x*=FRIC; d.vel.z*=FRIC; d.angVel.multiplyScalar(AFRIC);
        }
        const X=6.8,Z=4.4;
        if (d.root.position.x<-X){ d.root.position.x=-X; d.vel.x= Math.abs(d.vel.x)*0.6; }
        if (d.root.position.x> X){ d.root.position.x= X; d.vel.x=-Math.abs(d.vel.x)*0.6; }
        if (d.root.position.z<-Z){ d.root.position.z=-Z; d.vel.z= Math.abs(d.vel.z)*0.6; }
        if (d.root.position.z> Z){ d.root.position.z= Z; d.vel.z=-Math.abs(d.vel.z)*0.6; }

        d.root.rotation.x += d.angVel.x*dt;
        d.root.rotation.y += d.angVel.y*dt;
        d.root.rotation.z += d.angVel.z*dt;
        d.vel.multiplyScalar(0.999); d.angVel.multiplyScalar(0.999);
        d.root.updateMatrixWorld(true);

        const speed=d.vel.length()+d.angVel.length();
        if (speed<EPS){ if(!d.stableSince) d.stableSince=now(); } else d.stableSince=0;
        if (!(d.stableSince && (now()-d.stableSince>STABLE_MS))) allStable=false;
      }
      if (throwing && allStable){
        setThrowing(false);
        const out=[]; const map=mapRef.current && mapRef.current.map;
        for(let j=0;j<dice.length;j++){
          const d2=dice[j];
          let tag = topFaceByOrientation(d2.anchors, THREE) || "?";
          if (map && map[tag]!=null) tag=String(map[tag]);
          out.push(tag);
        }
        setVals(out);
        setMsg("Résultat : "+out.join("  "));
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
              <button onClick={()=>{ layoutDice(); setVals([]); setThrowing(false); setMsg("Réinitialisé. Clique « Lancer »."); }} disabled={!ready}
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
              <div style={{position:"absolute", left:12, bottom:12, background:"rgba(255,255,255,.96)", border:"1px solid #e5e7eb", borderRadius:12, padding:"10px 12px"}}>
                <div style={{fontWeight:600, marginBottom:4}}>Tirage</div>
                <div style={{fontSize:14}}>
                  {vals.join("  ")}
                  <span style={{marginLeft:10, color:"#64748b"}}>Somme: {vals.filter((v)=>/^\d+$/.test(v)).map((n)=>+n).reduce((a,b)=>a+b,0)}</span>
                </div>
                <div style={{fontSize:12, color:"#64748b", marginTop:4}}>
                  Catégories : Vénus (1-3-4-6), Canis (1-1-1-1), Senio (≥2 “6”), Trina (triple), Bina (deux paires), Simple (autres).
                </div>
              </div>
            )}
          </div>

          <div style={{fontSize:12, color:"#6b7280", marginTop:8}}>
            Modèle utilisé : <code>astragalus_faces.glb</code> — ancres <code>Face_1/3/4/6</code> (ou variantes). Lecture par orientation (+Y de l’ancre vers le haut).
          </div>
        </div>
      </div>
    );
  }

  // @ts-ignore
  window.AstragalusLevel3 = AstragalusLevel3;
})();
