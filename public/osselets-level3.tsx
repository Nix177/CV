/* public/osselets-level3.tsx
   Mini-jeu 3 — Rouler les os (Vénus, Canis, Senio…)
   - Utilise un astragale SANS trous : /assets/games/osselets/level3/3d/astragalus_faces.glb
   - Aligne visuellement la face tirée (1/3/4/6) vers le haut via des ANCRES de faces
*/
(function (global) {
  const { useEffect, useRef, useState } = React;

  // ---------- AudioBus ----------
  if (!global.AstragalusAudioBus) {
    global.AstragalusAudioBus = {
      _list: [], register(a){ if(a && !this._list.includes(a)) this._list.push(a); },
      stopAll(){ this._list.forEach(a=>{ try{ a.pause(); a.currentTime=0; }catch{} }); },
      muteAll(m){ this._list.forEach(a=>{ try{ a.muted=!!m; }catch{} }); }
    };
  }

  const L3_W=960, L3_H=540;
  const ABASE="/assets/games/osselets/audio/";
  const AU={ music:"game-music-1.mp3", good:"catch-sound.mp3", bad:"ouch-sound.mp3" };

  const GLB_PREFERRED = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
  const GLB_FALLBACKS = [
    "/assets/games/osselets/3d/astragalus.glb",
    "/assets/games/osselets/level2/astragalus.glb",
    "/assets/games/osselets/level2/3d/astragalus.glb"
  ];

  const rand=(arr:number[])=>arr[(Math.random()*arr.length)|0];
  function wrap(ctx, text, x,y,w,lh){ const words=(text||"").split(/\s+/); let line=""; for(let i=0;i<words.length;i++){ const t=(line?line+" ":"")+words[i]; if(ctx.measureText(t).width>w && line){ ctx.fillText(line,x,y); line=words[i]; y+=lh; } else line=t; } if(line) ctx.fillText(line,x,y); }
  function ensureThree(){ return new Promise((res,rej)=>{ if(global.THREE&&global.THREE.GLTFLoader&&global.THREE.OrbitControls) return res(global.THREE); const add=src=>new Promise((r,j)=>{ const s=document.createElement("script"); s.src=src; s.onload=()=>r(1); s.onerror=()=>j(new Error("load "+src)); document.head.appendChild(s); }); (async()=>{ try{ await add("https://unpkg.com/three@0.149.0/build/three.min.js"); await add("https://unpkg.com/three@0.149.0/examples/js/controls/OrbitControls.js"); await add("https://unpkg.com/three@0.149.0/examples/js/loaders/GLTFLoader.js"); res(global.THREE);}catch(e){rej(e)}})(); }); }

  function AstragalusLevel3(){
    const hostRef=useRef<HTMLDivElement>(null), webglRef=useRef<HTMLDivElement>(null), canvasRef=useRef<HTMLCanvasElement>(null), ctxRef=useRef<CanvasRenderingContext2D|null>(null);

    // audio
    const musRef=useRef<HTMLAudioElement|null>(null), goodRef=useRef<HTMLAudioElement|null>(null), badRef=useRef<HTMLAudioElement|null>(null);
    const [musicOn,setMusicOn]=useState(true);
    useEffect(()=>{ global.AstragalusAudioBus.stopAll(); },[]);
    useEffect(()=>{ try{ musRef.current=new Audio(ABASE+AU.music); musRef.current.loop=true; musRef.current.volume=0.35; global.AstragalusAudioBus.register(musRef.current); if(musicOn) musRef.current.play().catch(()=>{}); }catch{} try{ goodRef.current=new Audio(ABASE+AU.good); global.AstragalusAudioBus.register(goodRef.current);}catch{} try{ badRef.current=new Audio(ABASE+AU.bad); global.AstragalusAudioBus.register(badRef.current);}catch{} return ()=>{ try{ musRef.current?.pause(); }catch{} }; },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.muted=!musicOn; if(musicOn){ try{m.play();}catch{} } else m.pause(); },[musicOn]);

    // DPR
    const sizeRef=useRef({w:L3_W,h:L3_H,dpr:1});
    useEffect(()=>{
      const cv=canvasRef.current!, ctx=cv.getContext("2d")!; ctxRef.current=ctx;
      function resize(){ const w=hostRef.current?.clientWidth||L3_W, h=Math.round(w*(L3_H/L3_W)); const dpr=Math.max(1,Math.min(2.5,global.devicePixelRatio||1)); sizeRef.current={w,h,dpr}; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); cv.style.width=w+"px"; cv.style.height=h+"px"; ctx.setTransform(dpr*(w/L3_W),0,0,dpr*(w/L3_W),0,0); }
      resize(); const ro=(window as any).ResizeObserver?new ResizeObserver(resize):null; if(ro&&hostRef.current) ro.observe(hostRef.current); global.addEventListener("resize",resize);
      return ()=>{ ro?.disconnect(); global.removeEventListener("resize",resize); };
    },[]);

    // état jeu
    const [mode,setMode]=useState<"jeu"|"oracle">("jeu");
    const [rolls,setRolls]=useState<number[]>([6,4,3,1]);
    const [throwing,setThrowing]=useState(false);
    const [score,setScore]=useState(0);
    const [lastLabel,setLastLabel]=useState("—");
    const [lastMeaning,setLastMeaning]=useState("");

    // 3D scene
    const threeRef = useRef<any>({ scene:null, camera:null, renderer:null, controls:null, base:null, clones:[], facesMap:null, animId:0 });
    useEffect(()=>{
      let mounted=true;
      (async()=>{
        try{
          await ensureThree(); const THREE=global.THREE;
          const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(2.5,global.devicePixelRatio||1)); webglRef.current!.appendChild(renderer.domElement);
          const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(40,16/9,0.1,100); camera.position.set(0.0,1.1,3.2);

          const plane=new THREE.Mesh(new THREE.PlaneGeometry(6,3.6), new THREE.MeshStandardMaterial({color:0x0b3b2e,metalness:0,roughness:1})); plane.rotation.x=-Math.PI/2; plane.position.y=-0.4; scene.add(plane);
          scene.add(new THREE.AmbientLight(0xffffff,0.95)); const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(2,3,4); scene.add(dl);

          const ctrls=new THREE.OrbitControls(camera,renderer.domElement); ctrls.enablePan=false; ctrls.enableZoom=false; ctrls.autoRotate=false;

          function resize3d(){ const {w,h}=sizeRef.current; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); } resize3d();

          const loader=new THREE.GLTFLoader();
          let glb=null, used="";
          try { glb = await loader.loadAsync(GLB_PREFERRED); used=GLB_PREFERRED; }
          catch { for (const p of GLB_FALLBACKS){ try{ glb=await loader.loadAsync(p); used=p; break; }catch{} } }
          if (!glb) console.warn("[L3] GLB faces introuvable — fallback dodecahedron");
          else console.log("[L3] GLB chargé:", used);

          const base = glb ? glb.scene : null;
          if (base) base.traverse((o:any)=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });

          // Ancre de faces → map {1,3,4,6: Object3D}
          function findFaceNode(root:any, val:number){
            const targetNames = [
              `Face_${val}`, `face_${val}`, `FACE_${val}`,
              `Value_${val}`, `Valeur_${val}`,
              `${val}`
            ];
            for (const n of targetNames){
              const obj = root.getObjectByName(n);
              if (obj) return obj;
            }
            // recherche floue: noeuds qui finissent par _<val>
            let found=null;
            root.traverse((o:any)=>{ if(!found && typeof o.name==="string" && /(?:Face|Value|Valeur|face)?[_-]?([0-9])\b/.test(o.name)){ const m=o.name.match(/([0-9])\b/); if (m && Number(m[1])===val) found=o; } });
            return found;
          }
          const facesMap = base ? { 1:findFaceNode(base,1), 3:findFaceNode(base,3), 4:findFaceNode(base,4), 6:findFaceNode(base,6) } : null;

          const spots=[[-1.5,0],[-0.5,0],[0.5,0],[1.5,0]], clones:any[]=[];
          for(let i=0;i<4;i++){
            const g = base ? base.clone(true) : new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), new THREE.MeshStandardMaterial({color:0xfde68a}));
            g.position.set(spots[i][0], -0.2, spots[i][1]);
            g.rotation.set(Math.random(),Math.random(),Math.random());
            scene.add(g); clones.push(g);
          }

          threeRef.current = { scene, camera, renderer, controls:ctrls, base, clones, facesMap, animId:0 };

          const loop=()=>{ if(!mounted) return; renderer.render(scene,camera); threeRef.current.animId=requestAnimationFrame(loop); };
          loop();

          const onR=()=>resize3d(); global.addEventListener("resize",onR);
          return ()=>{ mounted=false; cancelAnimationFrame(threeRef.current.animId); global.removeEventListener("resize",onR); renderer.dispose(); };
        }catch(e){ console.error(e); }
      })();
    },[]);

    // Aligner une face: faire pointer l’ancre choisie vers +Y
    function orientToFace(clone:any, faceVal:number){
      const THREE=global.THREE;
      const facesMap=threeRef.current.facesMap;
      if (!facesMap || !facesMap[faceVal]) return; // pas d’ancres → on laisse la rotation aléatoire
      const anchor = clone.getObjectByName(facesMap[faceVal].name);
      if (!anchor) return;

      // Fixer temporairement la rotation pour mesurer le vecteur “ancre”
      const savedQ = clone.quaternion.clone();
      clone.quaternion.identity();
      clone.updateMatrixWorld(true);

      const v0 = new THREE.Vector3();
      const pA = new THREE.Vector3();
      const pC = new THREE.Vector3();
      anchor.getWorldPosition(pA);
      clone.getWorldPosition(pC);
      v0.copy(pA).sub(pC).normalize();       // direction de l’ancre dans l’orientation neutre

      // Quaternion qui amène v0 à +Y
      const up = new THREE.Vector3(0,1,0);
      const qTarget = new THREE.Quaternion().setFromUnitVectors(v0, up);

      // Restaurer la rotation initiale et slerp vers la cible
      clone.quaternion.copy(savedQ);
      const startQ = clone.quaternion.clone();
      const t0 = performance.now(); const dur = 400 + Math.random()*200;
      const tick=()=>{
        const t = Math.min(1, (performance.now()-t0)/dur);
        clone.quaternion.copy(startQ).slerp(qTarget, t);
        if (t<1) requestAnimationFrame(tick);
      };
      tick();
    }

    function categorize(v:number[]){
      const s=[...v].sort((a,b)=>a-b).join("-"); const c:any={}; v.forEach(x=>c[x]=(c[x]||0)+1); const uniq=Object.keys(c).length;
      if (s==="1-3-4-6") return {label:"Vénus", points:10, meaning:"Lancer parfait, harmonie des faces."};
      if (s==="1-1-1-1") return {label:"Canis", points:0,  meaning:"‘Chien’ : malchance."};
      if ((c[6]||0)>=2)  return {label:"Senio", points:5,  meaning:"Le ‘six’ domine."};
      if (Object.values(c).some((n:any)=>n===3)) return {label:"Trina", points:3, meaning:"Triple : stabilité."};
      if (uniq===2 && Object.values(c).every((n:any)=>n===2)) return {label:"Bina", points:4, meaning:"Deux paires."};
      return {label:"Simple", points:1, meaning:"Lecture modérée."};
    }

    function doRoll(){
      if (throwing) return;
      setThrowing(true);

      const clones=threeRef.current.clones||[];
      const vals=[rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6])];

      // Roulis rapide + orientation finale
      const start=performance.now(), dur=900;
      const init=clones.map((c:any)=>c.quaternion.clone());
      const target=clones.map((c:any)=>{ const q=new global.THREE.Quaternion(); q.setFromEuler(new global.THREE.Euler(Math.random()*6,Math.random()*6,Math.random()*6)); return q; });
      const ease=(t:number)=>1-Math.pow(1-t,3);

      const spinTick=()=>{
        const t=Math.min(1,(performance.now()-start)/dur), e=ease(t);
        clones.forEach((c:any,i:number)=>{ c.quaternion.copy(init[i]).slerp(target[i], e); });
        if (t<1) requestAnimationFrame(spinTick);
        else {
          // Oriente vraiment chaque clone sur la face tirée
          clones.forEach((c:any,i:number)=> orientToFace(c, vals[i]));
          setRolls(vals);
          const cat=categorize(vals); setLastLabel(cat.label); setLastMeaning(cat.meaning);
          if (mode==="jeu"){
            setScore(s=>s+cat.points);
            try{ (cat.points>0 ? goodRef.current : badRef.current)?.play(); }catch{}
          }
          setThrowing(false);
        }
      };
      spinTick();
    }

    // UI 2D
    const zones=useRef<any[]>([]);
    function btn(ctx:any,x:number,y:number,w:number,h:number,label:string,cb:Function){ ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label,x+w/2,y+h/2+1); zones.current.push({x,y,w,h,cb}); }
    useEffect(()=>{
      const ctx=ctxRef.current!; let raf:number;
      function draw(){
        ctx.clearRect(0,0,L3_W,L3_H);
        ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui"; ctx.fillText("Rouler les os — 3D (faces)",16,28);

        const xs=[160,320,640,800], y=160; ctx.fillStyle="#111827"; ctx.font="22px ui-sans-serif, system-ui"; ctx.textAlign="center"; for(let i=0;i<4;i++) ctx.fillText(String(rolls[i]), xs[i], y);

        const x=L3_W-320, y2=52, w=300, h=260;
        ctx.save(); ctx.fillStyle="rgba(248,250,252,.88)"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y2,w,h); ctx.strokeRect(x,y2,w,h);
        ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
        ctx.fillText("Mode : "+(mode==="jeu"?"Jeu (score)":"Oracle"), x+12, y2+22);
        ctx.fillText("Dernier coup : "+lastLabel, x+12, y2+46);
        ctx.fillStyle="#334155"; ctx.font="12px ui-sans-serif, system-ui"; wrap(ctx, (mode==="oracle"? lastMeaning : "Score : "+score+" pts"), x+12, y2+72, w-24, 16);
        zones.current.length=0;
        btn(ctx, x+12,  y2+h-92, 130, 32, throwing?"...":"Lancer", doRoll);
        btn(ctx, x+160, y2+h-92, 130, 32, "Musique "+(musicOn?"ON":"OFF"), ()=>setMusicOn(v=>!v));
        btn(ctx, x+12,  y2+h-48, 130, 32, "Mode "+(mode==="jeu"?"Oracle":"Jeu"), ()=>setMode(m=>m==="jeu"?"oracle":"jeu"));
        btn(ctx, x+160, y2+h-48, 130, 32, "Stop musique", ()=>global.AstragalusAudioBus.stopAll());
        ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; wrap(ctx, "Rappels : Vénus=1·3·4·6 / Canis=4×1 / Senio=≥2×6 / Bina=deux paires / Trina=triple.", x+12, y2+h+10, w-24, 16);
        raf=requestAnimationFrame(draw);
      }
      raf=requestAnimationFrame(draw);
      return ()=> cancelAnimationFrame(raf);
    },[rolls,throwing,mode,lastLabel,lastMeaning,score,musicOn]);

    useEffect(()=>{
      const el=canvasRef.current!;
      function onClick(ev:MouseEvent){ const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L3_W/r.width), my=(ev.clientY-r.top)*(L3_H/r.height); const z=zones.current.find(z=> mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h); zones.current.length=0; if(z) z.cb(); }
      el.addEventListener("click", onClick); return ()=> el.removeEventListener("click", onClick);
    },[]);

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
        <div ref={webglRef} style={{position:"absolute", inset:0}} aria-hidden="true"></div>
        <canvas ref={canvasRef}/>
      </div>
    );
  }

  (global as any).AstragalusLevel3 = AstragalusLevel3;
})(window);
