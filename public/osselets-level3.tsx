/* public/osselets-level3.tsx
   Mini-jeu 3 — « Rouler les os »
   - Charge /assets/games/osselets/level3/3d/astragalus_faces.glb
   - Ancres de faces (Face_1/3/4/6, variantes tolérées) → oriente la face tirée vers +Y
   - Catégories : Vénus (1-3-4-6), Canis (1-1-1-1), Senio (≥2 six), Trina (triple), Bina (deux paires), Simple
   - EXPORT: window.AstragalusLevel3 (le montage est géré par portfolio.html)
*/
(function (global) {
  const { useEffect, useRef, useState } = React;

  // -------- AudioBus --------
  if (!global.AstragalusAudioBus) {
    global.AstragalusAudioBus = {
      _list: [], register(a){ if(a && !this._list.includes(a)) this._list.push(a); },
      stopAll(){ this._list.forEach(a=>{ try{ a.pause(); a.currentTime=0; }catch{} }); },
      muteAll(m){ this._list.forEach(a=>{ try{ a.muted=!!m; }catch{} }); }
    };
  }

  // -------- Loader Three (tolérant) --------
  async function ensureThreeSoft(){
    if (global.__THREE_PROMISE__) return global.__THREE_PROMISE__;
    global.__THREE_PROMISE__ = (async ()=>{
      if (global.THREE && global.THREE.GLTFLoader && global.THREE.OrbitControls) return global.THREE;
      const add=(src)=>new Promise((res)=>{ const s=document.createElement("script"); s.src=src; s.onload=()=>res(true); s.onerror=()=>res(false); document.head.appendChild(s); });
      async function tryAny(list){ for(const u of list){ if(await add(u)) return true; } return false; }
      const v="0.149.0";
      const okCore = await tryAny([`https://unpkg.com/three@${v}/build/three.min.js`,`https://cdn.jsdelivr.net/npm/three@${v}/build/three.min.js`]);
      if (!okCore) return null;
      const okCtrl = await tryAny([`https://unpkg.com/three@${v}/examples/js/controls/OrbitControls.js`,`https://cdn.jsdelivr.net/npm/three@${v}/examples/js/controls/OrbitControls.js`]);
      const okGLTF = await tryAny([`https://unpkg.com/three@${v}/examples/js/loaders/GLTFLoader.js`,`https://cdn.jsdelivr.net/npm/three@${v}/examples/js/loaders/GLTFLoader.js`]);
      if (!(okCtrl && okGLTF)) return null;
      return global.THREE;
    })();
    return global.__THREE_PROMISE__;
  }

  // -------- Config --------
  const W=960,H=540;
  const ABASE="/assets/games/osselets/audio/";
  const AU={ music:"game-music-1.mp3", good:"catch-sound.mp3", bad:"ouch-sound.mp3" };
  const GLB_PREFERRED="/assets/games/osselets/level3/3d/astragalus_faces.glb";
  const GLB_FALLBACKS=["/assets/games/osselets/3d/astragalus.glb","/assets/games/osselets/level2/3d/astragalus.glb"];
  function randFace(){ return [1,3,4,6][(Math.random()*4)|0]; }
  function wrap(ctx, text, x,y,w,lh){ const words=(text||"").split(/\s+/); let line=""; for(const wd of words){ const t=(line?line+" ":"")+wd; if(ctx.measureText(t).width>w && line){ ctx.fillText(line,x,y); line=wd; y+=lh; } else line=t; } if(line) ctx.fillText(line,x,y); }

  function AstragalusLevel3(){
    const hostRef=useRef(null), webglRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);
    const musRef=useRef(null), goodRef=useRef(null), badRef=useRef(null);
    const [musicOn,setMusicOn]=useState(true);
    const [mode,setMode]=useState("jeu"); // "jeu"|"oracle"
    const [rolls,setRolls]=useState([6,4,3,1]);
    const [throwing,setThrowing]=useState(false);
    const [score,setScore]=useState(0);
    const [lastLabel,setLastLabel]=useState("—");
    const [lastMeaning,setLastMeaning]=useState("");

    // coupe musique d’autres jeux
    useEffect(()=>{ global.AstragalusAudioBus.stopAll(); },[]);

    // DPR
    useEffect(()=>{
      const cv=canvasRef.current, ctx=cv.getContext("2d"); ctxRef.current=ctx;
      function resize(){ const w=hostRef.current?.clientWidth||W, h=Math.round(w*(H/W)), dpr=Math.max(1,Math.min(2.5,global.devicePixelRatio||1)); cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); cv.style.width=w+"px"; cv.style.height=h+"px"; ctx.setTransform(dpr*(w/W),0,0,dpr*(w/W),0,0); }
      resize(); const ro=global.ResizeObserver?new ResizeObserver(resize):null; ro?.observe(hostRef.current); const onR=()=>resize(); global.addEventListener("resize",onR);
      return ()=>{ ro?.disconnect(); global.removeEventListener("resize",onR); };
    },[]);

    // audio
    useEffect(()=>{ try{ musRef.current=new Audio(ABASE+AU.music); musRef.current.loop=true; musRef.current.volume=0.35; global.AstragalusAudioBus.register(musRef.current); if(musicOn) musRef.current.play().catch(()=>{});}catch{} try{ goodRef.current=new Audio(ABASE+AU.good); global.AstragalusAudioBus.register(goodRef.current);}catch{} try{ badRef.current=new Audio(ABASE+AU.bad); global.AstragalusAudioBus.register(badRef.current);}catch{} return ()=>{ try{ musRef.current?.pause(); }catch{} }; },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.muted=!musicOn; if(musicOn){ m.play?.().catch(()=>{});} else m.pause?.(); },[musicOn]);

    // 3D
    const threeRef = useRef({ scene:null, camera:null, renderer:null, controls:null, base:null, clones:[], facesMap:null, animId:0 });
    useEffect(()=>{
      let mounted=true;
      (async()=>{
        const THREE=await ensureThreeSoft();
        if(!THREE){ console.warn("[L3] Pas de Three → fallback 2D"); return; }

        const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(2.5,global.devicePixelRatio||1)); webglRef.current.appendChild(renderer.domElement);
        const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(40,16/9,0.1,100); camera.position.set(0.0,1.1,3.2);
        const plane=new THREE.Mesh(new THREE.PlaneGeometry(6,3.6), new THREE.MeshStandardMaterial({color:0x0b3b2e,metalness:0,roughness:1})); plane.rotation.x=-Math.PI/2; plane.position.y=-0.4; scene.add(plane);
        scene.add(new THREE.AmbientLight(0xffffff,0.95)); const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(2,3,4); scene.add(dl);
        const ctrls=new THREE.OrbitControls(camera,renderer.domElement); ctrls.enablePan=false; ctrls.enableZoom=false;

        function resize3d(){ const w=hostRef.current?.clientWidth||W, h=Math.round(w*(H/W)); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
        resize3d();

        const loader=new THREE.GLTFLoader();
        let glb=null, used="";
        try { glb = await loader.loadAsync(GLB_PREFERRED); used=GLB_PREFERRED; }
        catch { for (const p of GLB_FALLBACKS){ try{ glb=await loader.loadAsync(p); used=p; break; }catch{} } }
        if (!glb) console.warn("[L3] GLB faces introuvable — fallback 2D");
        else console.log("[L3] GLB chargé:", used);

        const base = glb ? glb.scene : null;
        if (base) base.traverse((o)=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });

        // map d’ancres de face
        function findFaceNode(root, val){
          const tries = [`Face_${val}`,`face_${val}`,`FACE_${val}`,`Value_${val}`,`Valeur_${val}`,`${val}`];
          for (const n of tries){ const obj=root.getObjectByName(n); if (obj) return obj; }
          let found=null; root.traverse((o)=>{ if(!found && typeof o.name==="string"){ const m=o.name.match(/(?:Face|Value|Valeur|face)?[_-]?([0-9])\b/); if(m && Number(m[1])===val) found=o; } });
          return found;
        }
        const facesMap = base ? { 1:findFaceNode(base,1), 3:findFaceNode(base,3), 4:findFaceNode(base,4), 6:findFaceNode(base,6) } : null;

        const spots=[[-1.5,0],[-0.5,0],[0.5,0],[1.5,0]], clones=[];
        for(let i=0;i<4;i++){
          const g = base ? base.clone(true) : new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), new THREE.MeshStandardMaterial({color:0xfde68a}));
          g.position.set(spots[i][0], -0.2, spots[i][1]);
          g.rotation.set(Math.random(),Math.random(),Math.random());
          scene.add(g); clones.push(g);
        }

        threeRef.current = { scene, camera, renderer, controls:ctrls, base, clones, facesMap, animId:0 };
        const loop=()=>{ if(!mounted) return; renderer.render(scene,camera); threeRef.current.animId=requestAnimationFrame(loop); }; loop();

        const onR=()=>resize3d(); global.addEventListener("resize",onR);
        return ()=>{ mounted=false; cancelAnimationFrame(threeRef.current.animId); global.removeEventListener("resize",onR); renderer.dispose(); };
      })();
    },[]);

    // oriente un clone sur la face tirée (ancre → +Y)
    function orientToFace(clone, faceVal){
      const THREE=global.THREE; const facesMap=threeRef.current.facesMap; if (!THREE || !facesMap || !facesMap[faceVal]) return;
      const anchor = clone.getObjectByName(facesMap[faceVal].name); if (!anchor) return;
      const saved = clone.quaternion.clone(); clone.quaternion.identity(); clone.updateMatrixWorld(true);
      const v0=new THREE.Vector3(), pA=new THREE.Vector3(), pC=new THREE.Vector3(); anchor.getWorldPosition(pA); clone.getWorldPosition(pC); v0.copy(pA).sub(pC).normalize();
      const target=new THREE.Vector3(0,1,0); const q=new THREE.Quaternion().setFromUnitVectors(v0,target); clone.quaternion.copy(q.multiply(saved)); clone.updateMatrixWorld(true);
    }

    function doRoll(){
      if (throwing) return; setThrowing(true);
      const start=performance.now(), dur=700;
      const tick=()=>{
        const t=performance.now()-start;
        const vals=[randFace(),randFace(),randFace(),randFace()];
        setRolls(vals);
        const clones=threeRef.current.clones||[];
        for (let i=0;i<Math.min(vals.length, clones.length); i++) orientToFace(clones[i], vals[i]);
        if (t<dur) requestAnimationFrame(tick); else { setThrowing(false); scoreRound(vals); }
      }; tick();
    }

    function scoreRound(vals){
      const v=vals.slice().sort((a,b)=>a-b);
      const counts=v.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{});
      const uniq=Object.keys(counts).length;
      let res={ label:"Simple", points:1, meaning:"Tir normal. Réessaie pour un meilleur présage." };
      if (v.join(",")==="1,1,1,1")                res={label:"Canis", points:0, meaning:"Quatre ‘1’ — coup faible. Patience !"};
      else if (v.join(",")==="1,3,4,6")           res={label:"Vénus", points:6, meaning:"Jet parfait (1-3-4-6) — bon augure !"};
      else if ((counts[6]||0)>=2)                 res={label:"Senio", points:4, meaning:"Plusieurs ‘6’ — puissance (parfois excès)."};
      else if (Object.values(counts).some(c=>c===3)) res={label:"Trina", points:3, meaning:"Triple — stabilité mais rigidité."};
      else if (uniq===2 && Object.values(counts).every(c=>c===2)) res={label:"Bina", points:4, meaning:"Deux paires — équilibre fragile."};

      setScore(s=>s+res.points); setLastLabel(res.label); setLastMeaning(res.meaning);
      try{ (res.points>=4?goodRef:badRef).current?.play().catch(()=>{}); }catch{}
      if(res.label==="Vénus" && global.launchConfetti){ try{ global.launchConfetti(1200); }catch{} }
    }

    // rendu 2D
    useEffect(()=>{
      const ctx=ctxRef.current; let raf;
      function render(){
        ctx.clearRect(0,0,W,H);
        const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0b2334"); g.addColorStop(1,"#0a1b2a"); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

        ctx.fillStyle="#cfe2ff"; ctx.font="18px system-ui,Segoe UI,Roboto,Arial";
        ctx.fillText("Rouler les os — 4 astragales (faces 1/3/4/6)", 16, 28);
        ctx.font="16px system-ui,Segoe UI,Roboto,Arial";
        ctx.fillText("But : comprendre les faces et les catégories antiques (Vénus, Canis, Senio, Trina, Bina).", 16, 50);

        ctx.font="22px system-ui,Segoe UI,Roboto,Arial"; ctx.fillText(`Tirage : ${rolls.join("  ")}`, 16, H-116);
        ctx.font="18px system-ui,Segoe UI,Roboto,Arial"; ctx.fillText(`Catégorie : ${lastLabel}`, 16, H-86);
        if(mode==="oracle"){ ctx.font="16px system-ui,Segoe UI,Roboto,Arial"; wrap(ctx, `Oracle : ${lastMeaning}`, 16, H-62, W-32, 18); }
        ctx.textAlign="right"; ctx.font="18px system-ui,Segoe UI,Roboto,Arial"; ctx.fillText(`Score : ${score}`, W-16, 28);
        ctx.textAlign="left";

        raf=requestAnimationFrame(render);
      }
      render();
      return ()=>cancelAnimationFrame(raf);
    },[rolls,lastLabel,lastMeaning,mode,score]);

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", border:"1px solid #224", borderRadius:"12px", overflow:"hidden"}}>
        <div ref={webglRef} aria-hidden="true" style={{position:"absolute", inset:0}} />
        <canvas ref={canvasRef} width={W} height={H} aria-label="Rouler les os" />
        <div style={{position:"absolute", inset:"auto 12px 12px auto", display:"flex", gap:"8px", flexWrap:"wrap"}}>
          <button className="btn" onClick={doRoll} disabled={throwing}>{throwing?"…":"Lancer"}</button>
          <button className="btn" onClick={()=>setMode(m=>m==="jeu"?"oracle":"jeu")}>Mode : {mode==="jeu"?"Jeu":"Oracle"}</button>
          <button className="btn" onClick={()=>setMusicOn(v=>!v)}>Musique: {musicOn?"ON":"OFF"}</button>
          <button className="btn" onClick={()=>{ try{ global.AstragalusAudioBus.stopAll(); }catch{} }}>Stop musique</button>
        </div>
      </div>
    );
  }

  // EXPORT pour le script de montage de portfolio.html
  global.AstragalusLevel3 = AstragalusLevel3;

})(window);
