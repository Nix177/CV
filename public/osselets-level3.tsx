/* public/osselets-level3.tsx
   Mini-jeu 3 — « Rouler les os »
   - Charge /assets/games/osselets/level3/3d/astragalus_faces.glb
   - Utilise des ancres de faces (Face_1/3/4/6, variantes tolérées) pour orienter chaque clone vers +Y
   - Loader Three partagé (mémo + fallbacks), fallback 2D si GLB absent
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

  // -------- Loader Three partagé --------
  function ensureThree(){
    if (global.__THREE_PROMISE__) return global.__THREE_PROMISE__;
    global.__THREE_PROMISE__ = new Promise(async (res,rej)=>{
      if (global.THREE && global.THREE.GLTFLoader && global.THREE.OrbitControls) return res(global.THREE);
      const add=(src)=>new Promise((r,j)=>{ const s=document.createElement("script"); s.src=src; s.onload=()=>r(1); s.onerror=()=>j(new Error("load "+src)); document.head.appendChild(s); });
      async function tryAll(urls){ for(const u of urls){ try{ await add(u); return true; }catch{} } return false; }
      const v="0.149.0";
      if(!(await tryAll([`https://unpkg.com/three@${v}/build/three.min.js`,`https://cdn.jsdelivr.net/npm/three@${v}/build/three.min.js`]))) return rej(new Error("three failed"));
      if(!(await tryAll([`https://unpkg.com/three@${v}/examples/js/controls/OrbitControls.js`,`https://cdn.jsdelivr.net/npm/three@${v}/examples/js/controls/OrbitControls.js`]))) return rej(new Error("controls failed"));
      if(!(await tryAll([`https://unpkg.com/three@${v}/examples/js/loaders/GLTFLoader.js`,`https://cdn.jsdelivr.net/npm/three@${v}/examples/js/loaders/GLTFLoader.js`]))) return rej(new Error("loader failed"));
      res(global.THREE);
    });
    return global.__THREE_PROMISE__;
  }

  // -------- Config --------
  const L3_W=960, L3_H=540;
  const ABASE="/assets/games/osselets/audio/";
  const AU={ music:"game-music-1.mp3", good:"catch-sound.mp3", bad:"ouch-sound.mp3" };
  const GLB_PREFERRED="/assets/games/osselets/level3/3d/astragalus_faces.glb";
  const GLB_FALLBACKS=["/assets/games/osselets/3d/astragalus.glb","/assets/games/osselets/level2/3d/astragalus.glb"];

  function rand(arr){ return arr[(Math.random()*arr.length)|0]; }
  function wrap(ctx, text, x,y,w,lh){ const words=(text||"").split(/\s+/); let line=""; for(let i=0;i<words.length;i++){ const t=(line?line+" ":"")+words[i]; if(ctx.measureText(t).width>w && line){ ctx.fillText(line,x,y); line=words[i]; y+=lh; } else line=t; } if(line) ctx.fillText(line,x,y); }

  function AstragalusLevel3(){
    const hostRef=useRef(null), webglRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);

    // audio
    const musRef=useRef(null), goodRef=useRef(null), badRef=useRef(null);
    const [musicOn,setMusicOn]=useState(true);
    useEffect(()=>{ global.AstragalusAudioBus.stopAll(); },[]);
    useEffect(()=>{ try{ musRef.current=new Audio(ABASE+AU.music); musRef.current.loop=true; musRef.current.volume=0.35; global.AstragalusAudioBus.register(musRef.current); if(musicOn) musRef.current.play().catch(()=>{}); }catch{} try{ goodRef.current=new Audio(ABASE+AU.good); global.AstragalusAudioBus.register(goodRef.current);}catch{} try{ badRef.current=new Audio(ABASE+AU.bad); global.AstragalusAudioBus.register(badRef.current);}catch{} return ()=>{ try{ musRef.current?.pause(); }catch{} }; },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.muted=!musicOn; if(musicOn){ try{m.play();}catch{} } else m.pause(); },[musicOn]);

    // state
    const [mode,setMode]=useState("jeu"); // "jeu"|"oracle"
    const [rolls,setRolls]=useState([6,4,3,1]);
    const [throwing,setThrowing]=useState(false);
    const [score,setScore]=useState(0);
    const [lastLabel,setLastLabel]=useState("—");
    const [lastMeaning,setLastMeaning]=useState("");

    // DPR / responsive
    useEffect(()=>{
      const cv=canvasRef.current, ctx=cv.getContext("2d"); ctxRef.current=ctx;
      function resize(){ const w=hostRef.current?.clientWidth||L3_W, h=Math.round(w*(L3_H/L3_W)), dpr=Math.max(1,Math.min(2.5,global.devicePixelRatio||1)); cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); cv.style.width=w+"px"; cv.style.height=h+"px"; ctx.setTransform(dpr*(w/L3_W),0,0,dpr*(w/L3_W),0,0); }
      resize(); const ro=window.ResizeObserver?new ResizeObserver(resize):null; ro?.observe(hostRef.current); global.addEventListener("resize",resize);
      return ()=>{ ro?.disconnect(); global.removeEventListener("resize",resize); };
    },[]);

    // 3D scene
    const threeRef = useRef({ scene:null, camera:null, renderer:null, controls:null, base:null, clones:[], facesMap:null, animId:0 });
    useEffect(()=>{
      let mounted=true;
      (async()=>{
        try{
          await ensureThree(); const THREE=global.THREE;
          const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(2.5,global.devicePixelRatio||1)); webglRef.current.appendChild(renderer.domElement);
          const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(40,16/9,0.1,100); camera.position.set(0.0,1.1,3.2);

          const plane=new THREE.Mesh(new THREE.PlaneGeometry(6,3.6), new THREE.MeshStandardMaterial({color:0x0b3b2e,metalness:0,roughness:1})); plane.rotation.x=-Math.PI/2; plane.position.y=-0.4; scene.add(plane);
          scene.add(new THREE.AmbientLight(0xffffff,0.95)); const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(2,3,4); scene.add(dl);

          const ctrls=new THREE.OrbitControls(camera,renderer.domElement); ctrls.enablePan=false; ctrls.enableZoom=false; ctrls.autoRotate=false;
          function resize3d(){ const w=hostRef.current?.clientWidth||L3_W, h=Math.round(w*(L3_H/L3_W)); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); } resize3d();

          const loader=new THREE.GLTFLoader();
          let glb=null, used="";
          try { glb = await loader.loadAsync(GLB_PREFERRED); used=GLB_PREFERRED; }
          catch { for (const p of GLB_FALLBACKS){ try{ glb=await loader.loadAsync(p); used=p; break; }catch{} } }
          if (!glb) console.warn("[L3] GLB faces introuvable — fallback 2D");
          else console.log("[L3] GLB chargé:", used);

          const base = glb ? glb.scene : null;
          if (base) base.traverse((o)=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });

          // récupérer une ancre de face
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
        }catch(e){ console.error(e); }
      })();
    },[]);

    // aligne un clone sur la face tirée (ancre vers +Y)
    function orientToFace(clone, faceVal){
      const THREE=global.THREE; const facesMap=threeRef.current.facesMap; if (!facesMap || !facesMap[faceVal]) return;
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
        const vals=[rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6])];
        setRolls(vals);
        // oriente en live si on a la 3D
        const clones=threeRef.current.clones||[];
        for (let i=0;i<Math.min(vals.length, clones.length); i++) orientToFace(clones[i], vals[i]);
        if (t<dur) requestAnimationFrame(tick); else { setThrowing(false); scoreRound(vals); }
      }; tick();
    }

    function scoreRound(vals){
      const counts={}; vals.forEach(v=>counts[v]=(counts[v]||0)+1); const uniq=Object.keys(counts).length;
      let res={ label:"Simple", points:1, meaning:"Lecture modérée : observe le prochain tir." };
      if (vals.sort().join(",")==="1,3,4,6") res={label:"Vénus", points:6, meaning:"Jet parfait (1·3·4·6) — chance et bon augure."};
      else if (counts[6]>=2)               res={label:"Senio", points:4, meaning:"Plusieurs 6 — puissance / excès selon contexte."};
      else if (Object.values(counts).some(c=>c===3)) res={label:"Trina", points:3, meaning:"Triple — stabilité mais rigidité."};
      else if (uniq===2 && Object.values(counts).every(c=>c===2)) res={label:"Bina", points:4, meaning:"Deux paires — équilibre fragile."};
      setScore(s=>s+res.points); setLastLabel(res.label); setLastMeaning(res.meaning);
      try{ (res.points>=4?goodRef:badRef).current?.play(); }catch{}
    }

    // render 2D UI
    useEffect(()=>{
      const ctx=ctxRef.current; let raf;
      function render(){
        ctx.clearRect(0,0,L3_W,L3_H);
        const g=ctx.createLinearGradient(0,0,0,L3_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
        ctx.fillStyle=g; ctx.fillRect(0,0,L3_W,L3_H);

        ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui"; ctx.fillText("Niveau 3 — Rouler les os",16,28);
        ctx.fillStyle="#0b3b2e"; ctx.fillRect(16, 44, L3_W-32, 300); ctx.strokeStyle="#14532d"; ctx.lineWidth=6; ctx.strokeRect(16, 44, L3_W-32, 300);

        // pips stylisés (fallback visuel si 3D absente)
        for(let i=0;i<4;i++){ const cx=120+i*((L3_W-240)/3); drawDie(ctx,cx,190,rolls[i],throwing); }

        // panneau
        drawPanel(ctx);

        raf=requestAnimationFrame(render);
      }
      function drawDie(ctx,cx,cy,val,shake){ ctx.save(); const rx=46, ry=26; ctx.fillStyle="rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(cx,cy+ry+12, rx*0.9, ry*0.6, 0, 0, Math.PI*2); ctx.fill(); const j=shake?(Math.random()*3-1.5):0; ctx.translate(j,j); const grd=ctx.createLinearGradient(cx-46,cy-26,cx+46,cy+26); grd.addColorStop(0,"#fefce8"); grd.addColorStop(1,"#fde68a"); ctx.fillStyle=grd; ctx.strokeStyle="#eab308"; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle="#0f172a"; const map={1:[[0,0]],3:[[-16,-8],[0,0],[16,8]],4:[[-16,-8],[-16,8],[16,-8],[16,8]],6:[[-16,-10],[-16,0],[-16,10],[16,-10],[16,0],[16,10]]}; (map[val]||[]).forEach(p=>{ ctx.beginPath(); ctx.arc(cx+p[0], cy+p[1], 5, 0, Math.PI*2); ctx.fill(); }); ctx.restore(); }
      function drawPanel(ctx){ const x=L3_W-300, y=44, w=284, h=300; ctx.save(); ctx.fillStyle="#f8fafc"; ctx.fillRect(x,y,w,h); ctx.strokeStyle="#94a3b8"; ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="16px ui-sans-serif, system-ui"; ctx.fillText("Résultat : "+lastLabel, x+12, y+28); ctx.font="12px ui-sans-serif, system-ui"; wrap(ctx, lastMeaning||"—", x+12, y+50, w-24, 16); ctx.font="12px ui-sans-serif, system-ui"; wrap(ctx, "Ex. : Vénus = 1·3·4·6 / Canis = 4×1 / Senio = ≥2 faces 6 / Bina = deux paires / Trina = triple / Simple = autres.", x+12, y+h-68, w-24, 16); zones.current.length=0; btn(ctx,x+8,y+h-92,132,32, throwing?"…":"Lancer",()=>doRoll()); btn(ctx,x+156,y+h-92,120,32, "Mode: "+(mode==="jeu"?"Jeu":"Oracle"),()=>setMode(m=>m==="jeu"?"oracle":"jeu")); btn(ctx,x+8,y+h-48,132,32, "Musique "+(musicOn?"ON":"OFF"),()=>setMusicOn(v=>!v)); btn(ctx,x+156,y+h-48,120,32, "Stop musique",()=>global.AstragalusAudioBus.stopAll()); ctx.restore(); }
      const zones=useRef?useRef([]):{current:[]}; function btn(ctx,x,y,w,h,label,cb){ ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label, x+w/2, y+h/2+1); zones.current.push({x,y,w,h,cb}); }
      const el=canvasRef.current; function onClick(ev){ const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L3_W/r.width), my=(ev.clientY-r.top)*(L3_H/r.height); const z=zones.current.find(z=> mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h); zones.current.length=0; if(z) z.cb(); }
      el.addEventListener("click",onClick); render(); return ()=>{ el.removeEventListener("click",onClick); cancelAnimationFrame(raf); };
    },[rolls,throwing,mode,lastLabel,lastMeaning,score,musicOn]);

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
        <div ref={webglRef} style={{position:"absolute", inset:0}} aria-hidden="true"></div>
        <canvas ref={canvasRef}/>
      </div>
    );
  }

  global.AstragalusLevel3 = AstragalusLevel3;
})(window);
/* public/osselets-level3.tsx
   Mini-jeu 3 — « Rouler les os »
   - Charge /assets/games/osselets/level3/3d/astragalus_faces.glb
   - Utilise des ancres de faces (Face_1/3/4/6, variantes tolérées) pour orienter chaque clone vers +Y
   - Loader Three partagé (mémo + fallbacks), fallback 2D si GLB absent
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

  // -------- Loader Three partagé --------
  function ensureThree(){
    if (global.__THREE_PROMISE__) return global.__THREE_PROMISE__;
    global.__THREE_PROMISE__ = new Promise(async (res,rej)=>{
      if (global.THREE && global.THREE.GLTFLoader && global.THREE.OrbitControls) return res(global.THREE);
      const add=(src)=>new Promise((r,j)=>{ const s=document.createElement("script"); s.src=src; s.onload=()=>r(1); s.onerror=()=>j(new Error("load "+src)); document.head.appendChild(s); });
      async function tryAll(urls){ for(const u of urls){ try{ await add(u); return true; }catch{} } return false; }
      const v="0.149.0";
      if(!(await tryAll([`https://unpkg.com/three@${v}/build/three.min.js`,`https://cdn.jsdelivr.net/npm/three@${v}/build/three.min.js`]))) return rej(new Error("three failed"));
      if(!(await tryAll([`https://unpkg.com/three@${v}/examples/js/controls/OrbitControls.js`,`https://cdn.jsdelivr.net/npm/three@${v}/examples/js/controls/OrbitControls.js`]))) return rej(new Error("controls failed"));
      if(!(await tryAll([`https://unpkg.com/three@${v}/examples/js/loaders/GLTFLoader.js`,`https://cdn.jsdelivr.net/npm/three@${v}/examples/js/loaders/GLTFLoader.js`]))) return rej(new Error("loader failed"));
      res(global.THREE);
    });
    return global.__THREE_PROMISE__;
  }

  // -------- Config --------
  const L3_W=960, L3_H=540;
  const ABASE="/assets/games/osselets/audio/";
  const AU={ music:"game-music-1.mp3", good:"catch-sound.mp3", bad:"ouch-sound.mp3" };
  const GLB_PREFERRED="/assets/games/osselets/level3/3d/astragalus_faces.glb";
  const GLB_FALLBACKS=["/assets/games/osselets/3d/astragalus.glb","/assets/games/osselets/level2/3d/astragalus.glb"];

  function rand(arr){ return arr[(Math.random()*arr.length)|0]; }
  function wrap(ctx, text, x,y,w,lh){ const words=(text||"").split(/\s+/); let line=""; for(let i=0;i<words.length;i++){ const t=(line?line+" ":"")+words[i]; if(ctx.measureText(t).width>w && line){ ctx.fillText(line,x,y); line=words[i]; y+=lh; } else line=t; } if(line) ctx.fillText(line,x,y); }

  function AstragalusLevel3(){
    const hostRef=useRef(null), webglRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);

    // audio
    const musRef=useRef(null), goodRef=useRef(null), badRef=useRef(null);
    const [musicOn,setMusicOn]=useState(true);
    useEffect(()=>{ global.AstragalusAudioBus.stopAll(); },[]);
    useEffect(()=>{ try{ musRef.current=new Audio(ABASE+AU.music); musRef.current.loop=true; musRef.current.volume=0.35; global.AstragalusAudioBus.register(musRef.current); if(musicOn) musRef.current.play().catch(()=>{}); }catch{} try{ goodRef.current=new Audio(ABASE+AU.good); global.AstragalusAudioBus.register(goodRef.current);}catch{} try{ badRef.current=new Audio(ABASE+AU.bad); global.AstragalusAudioBus.register(badRef.current);}catch{} return ()=>{ try{ musRef.current?.pause(); }catch{} }; },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.muted=!musicOn; if(musicOn){ try{m.play();}catch{} } else m.pause(); },[musicOn]);

    // state
    const [mode,setMode]=useState("jeu"); // "jeu"|"oracle"
    const [rolls,setRolls]=useState([6,4,3,1]);
    const [throwing,setThrowing]=useState(false);
    const [score,setScore]=useState(0);
    const [lastLabel,setLastLabel]=useState("—");
    const [lastMeaning,setLastMeaning]=useState("");

    // DPR / responsive
    useEffect(()=>{
      const cv=canvasRef.current, ctx=cv.getContext("2d"); ctxRef.current=ctx;
      function resize(){ const w=hostRef.current?.clientWidth||L3_W, h=Math.round(w*(L3_H/L3_W)), dpr=Math.max(1,Math.min(2.5,global.devicePixelRatio||1)); cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); cv.style.width=w+"px"; cv.style.height=h+"px"; ctx.setTransform(dpr*(w/L3_W),0,0,dpr*(w/L3_W),0,0); }
      resize(); const ro=window.ResizeObserver?new ResizeObserver(resize):null; ro?.observe(hostRef.current); global.addEventListener("resize",resize);
      return ()=>{ ro?.disconnect(); global.removeEventListener("resize",resize); };
    },[]);

    // 3D scene
    const threeRef = useRef({ scene:null, camera:null, renderer:null, controls:null, base:null, clones:[], facesMap:null, animId:0 });
    useEffect(()=>{
      let mounted=true;
      (async()=>{
        try{
          await ensureThree(); const THREE=global.THREE;
          const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(2.5,global.devicePixelRatio||1)); webglRef.current.appendChild(renderer.domElement);
          const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(40,16/9,0.1,100); camera.position.set(0.0,1.1,3.2);

          const plane=new THREE.Mesh(new THREE.PlaneGeometry(6,3.6), new THREE.MeshStandardMaterial({color:0x0b3b2e,metalness:0,roughness:1})); plane.rotation.x=-Math.PI/2; plane.position.y=-0.4; scene.add(plane);
          scene.add(new THREE.AmbientLight(0xffffff,0.95)); const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(2,3,4); scene.add(dl);

          const ctrls=new THREE.OrbitControls(camera,renderer.domElement); ctrls.enablePan=false; ctrls.enableZoom=false; ctrls.autoRotate=false;
          function resize3d(){ const w=hostRef.current?.clientWidth||L3_W, h=Math.round(w*(L3_H/L3_W)); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); } resize3d();

          const loader=new THREE.GLTFLoader();
          let glb=null, used="";
          try { glb = await loader.loadAsync(GLB_PREFERRED); used=GLB_PREFERRED; }
          catch { for (const p of GLB_FALLBACKS){ try{ glb=await loader.loadAsync(p); used=p; break; }catch{} } }
          if (!glb) console.warn("[L3] GLB faces introuvable — fallback 2D");
          else console.log("[L3] GLB chargé:", used);

          const base = glb ? glb.scene : null;
          if (base) base.traverse((o)=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });

          // récupérer une ancre de face
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
        }catch(e){ console.error(e); }
      })();
    },[]);

    // aligne un clone sur la face tirée (ancre vers +Y)
    function orientToFace(clone, faceVal){
      const THREE=global.THREE; const facesMap=threeRef.current.facesMap; if (!facesMap || !facesMap[faceVal]) return;
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
        const vals=[rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6])];
        setRolls(vals);
        // oriente en live si on a la 3D
        const clones=threeRef.current.clones||[];
        for (let i=0;i<Math.min(vals.length, clones.length); i++) orientToFace(clones[i], vals[i]);
        if (t<dur) requestAnimationFrame(tick); else { setThrowing(false); scoreRound(vals); }
      }; tick();
    }

    function scoreRound(vals){
      const counts={}; vals.forEach(v=>counts[v]=(counts[v]||0)+1); const uniq=Object.keys(counts).length;
      let res={ label:"Simple", points:1, meaning:"Lecture modérée : observe le prochain tir." };
      if (vals.sort().join(",")==="1,3,4,6") res={label:"Vénus", points:6, meaning:"Jet parfait (1·3·4·6) — chance et bon augure."};
      else if (counts[6]>=2)               res={label:"Senio", points:4, meaning:"Plusieurs 6 — puissance / excès selon contexte."};
      else if (Object.values(counts).some(c=>c===3)) res={label:"Trina", points:3, meaning:"Triple — stabilité mais rigidité."};
      else if (uniq===2 && Object.values(counts).every(c=>c===2)) res={label:"Bina", points:4, meaning:"Deux paires — équilibre fragile."};
      setScore(s=>s+res.points); setLastLabel(res.label); setLastMeaning(res.meaning);
      try{ (res.points>=4?goodRef:badRef).current?.play(); }catch{}
    }

    // render 2D UI
    useEffect(()=>{
      const ctx=ctxRef.current; let raf;
      function render(){
        ctx.clearRect(0,0,L3_W,L3_H);
        const g=ctx.createLinearGradient(0,0,0,L3_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
        ctx.fillStyle=g; ctx.fillRect(0,0,L3_W,L3_H);

        ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui"; ctx.fillText("Niveau 3 — Rouler les os",16,28);
        ctx.fillStyle="#0b3b2e"; ctx.fillRect(16, 44, L3_W-32, 300); ctx.strokeStyle="#14532d"; ctx.lineWidth=6; ctx.strokeRect(16, 44, L3_W-32, 300);

        // pips stylisés (fallback visuel si 3D absente)
        for(let i=0;i<4;i++){ const cx=120+i*((L3_W-240)/3); drawDie(ctx,cx,190,rolls[i],throwing); }

        // panneau
        drawPanel(ctx);

        raf=requestAnimationFrame(render);
      }
      function drawDie(ctx,cx,cy,val,shake){ ctx.save(); const rx=46, ry=26; ctx.fillStyle="rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(cx,cy+ry+12, rx*0.9, ry*0.6, 0, 0, Math.PI*2); ctx.fill(); const j=shake?(Math.random()*3-1.5):0; ctx.translate(j,j); const grd=ctx.createLinearGradient(cx-46,cy-26,cx+46,cy+26); grd.addColorStop(0,"#fefce8"); grd.addColorStop(1,"#fde68a"); ctx.fillStyle=grd; ctx.strokeStyle="#eab308"; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle="#0f172a"; const map={1:[[0,0]],3:[[-16,-8],[0,0],[16,8]],4:[[-16,-8],[-16,8],[16,-8],[16,8]],6:[[-16,-10],[-16,0],[-16,10],[16,-10],[16,0],[16,10]]}; (map[val]||[]).forEach(p=>{ ctx.beginPath(); ctx.arc(cx+p[0], cy+p[1], 5, 0, Math.PI*2); ctx.fill(); }); ctx.restore(); }
      function drawPanel(ctx){ const x=L3_W-300, y=44, w=284, h=300; ctx.save(); ctx.fillStyle="#f8fafc"; ctx.fillRect(x,y,w,h); ctx.strokeStyle="#94a3b8"; ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="16px ui-sans-serif, system-ui"; ctx.fillText("Résultat : "+lastLabel, x+12, y+28); ctx.font="12px ui-sans-serif, system-ui"; wrap(ctx, lastMeaning||"—", x+12, y+50, w-24, 16); ctx.font="12px ui-sans-serif, system-ui"; wrap(ctx, "Ex. : Vénus = 1·3·4·6 / Canis = 4×1 / Senio = ≥2 faces 6 / Bina = deux paires / Trina = triple / Simple = autres.", x+12, y+h-68, w-24, 16); zones.current.length=0; btn(ctx,x+8,y+h-92,132,32, throwing?"…":"Lancer",()=>doRoll()); btn(ctx,x+156,y+h-92,120,32, "Mode: "+(mode==="jeu"?"Jeu":"Oracle"),()=>setMode(m=>m==="jeu"?"oracle":"jeu")); btn(ctx,x+8,y+h-48,132,32, "Musique "+(musicOn?"ON":"OFF"),()=>setMusicOn(v=>!v)); btn(ctx,x+156,y+h-48,120,32, "Stop musique",()=>global.AstragalusAudioBus.stopAll()); ctx.restore(); }
      const zones=useRef?useRef([]):{current:[]}; function btn(ctx,x,y,w,h,label,cb){ ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label, x+w/2, y+h/2+1); zones.current.push({x,y,w,h,cb}); }
      const el=canvasRef.current; function onClick(ev){ const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L3_W/r.width), my=(ev.clientY-r.top)*(L3_H/r.height); const z=zones.current.find(z=> mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h); zones.current.length=0; if(z) z.cb(); }
      el.addEventListener("click",onClick); render(); return ()=>{ el.removeEventListener("click",onClick); cancelAnimationFrame(raf); };
    },[rolls,throwing,mode,lastLabel,lastMeaning,score,musicOn]);

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
        <div ref={webglRef} style={{position:"absolute", inset:0}} aria-hidden="true"></div>
        <canvas ref={canvasRef}/>
      </div>
    );
  }

  global.AstragalusLevel3 = AstragalusLevel3;
})(window);
