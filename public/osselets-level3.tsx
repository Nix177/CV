/* public/osselets-level3.tsx
   Mini-jeu 3 — « Rouler les os »
   - 4 clones 3D d’un astragale GLB en fond
   - Catégories (Vénus, Canis, Senio…) + score
   - AudioBus global + bouton Stop musique
*/
(function (global) {
  const { useEffect, useRef, useState } = React;

  // ---------- AudioBus ----------
  (function ensureBus () {
    if (!global.AstragalusAudioBus) {
      global.AstragalusAudioBus = {
        _list: [],
        register(a){ if (a && !this._list.includes(a)) this._list.push(a); },
        stopAll(){ this._list.forEach(a=>{ try{ a.pause(); a.currentTime=0; }catch{} }); },
        muteAll(m){ this._list.forEach(a=>{ try{ a.muted=!!m; }catch{} }); }
      };
    }
  })();

  const L3_W = 960, L3_H = 540;
  const L3_AUDIO_BASE = "/assets/games/osselets/audio/";
  const L3_AUDIO = { music:"game-music-1.mp3", good:"catch-sound.mp3", bad:"ouch-sound.mp3" };

  function rand(arr){ return arr[(Math.random()*arr.length)|0]; }

  function ensureThree() {
    return new Promise((resolve, reject) => {
      if (global.THREE && global.THREE.GLTFLoader && global.THREE.OrbitControls) return resolve(global.THREE);
      const add = (src) => new Promise((res, rej) => { const s=document.createElement("script"); s.src=src; s.onload=()=>res(1); s.onerror=()=>rej(new Error("load fail "+src)); document.head.appendChild(s); });
      (async () => {
        try {
          await add("https://unpkg.com/three@0.149.0/build/three.min.js");
          await add("https://unpkg.com/three@0.149.0/examples/js/controls/OrbitControls.js");
          await add("https://unpkg.com/three@0.149.0/examples/js/loaders/GLTFLoader.js");
          resolve(global.THREE);
        } catch(e){ reject(e); }
      })();
    });
  }
  const GLB_CANDIDATES = [
    "/assets/games/osselets/3d/astragalus.glb",
    "/assets/games/osselets/level3/3d/astragalus.glb",
    "/assets/games/osselets/level2/3d/astragalus.glb",
    "/assets/games/osselets/level2/astragalus.glb",
    "/assets/games/osselets/level2/astragalus holes.glb",
    "/assets/games/osselets/level2/astragalus_holes.glb",
  ];

  function wrap(ctx, text, x,y,maxW,lh){ const words=(text||"").split(/\s+/); let line=""; for(let i=0;i<words.length;i++){ const test=(line?line+" ":"")+words[i]; if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line,x,y); line=words[i]; y+=lh; } else line=test; } if(line) ctx.fillText(line,x,y); }

  function AstragalusLevel3(){
    const hostRef = useRef(null);
    const webglRef= useRef(null);
    const canvasRef=useRef(null);
    const ctxRef   =useRef(null);

    // audio
    const musRef=useRef(null), goodRef=useRef(null), badRef=useRef(null);
    const [musicOn,setMusicOn]=useState(true);
    useEffect(()=>{ global.AstragalusAudioBus.stopAll(); }, []);
    useEffect(()=>{ try{ musRef.current=new Audio(L3_AUDIO_BASE+L3_AUDIO.music); goodRef.current=new Audio(L3_AUDIO_BASE+L3_AUDIO.good); badRef.current=new Audio(L3_AUDIO_BASE+L3_AUDIO.bad);}catch{} 
      if (musRef.current){ musRef.current.loop=true; musRef.current.volume=0.35; global.AstragalusAudioBus.register(musRef.current); if(musicOn) musRef.current.play().catch(()=>{}); }
      if (goodRef.current) global.AstragalusAudioBus.register(goodRef.current);
      if (badRef.current)  global.AstragalusAudioBus.register(badRef.current);
      return ()=>{ try{ musRef.current?.pause(); }catch{} };
    },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.muted=!musicOn; if(musicOn){ try{m.play();}catch{} } else m.pause(); },[musicOn]);

    // DPR
    const sizeRef = useRef({w:L3_W,h:L3_H,dpr:1});
    useEffect(()=>{
      const cv=canvasRef.current, ctx=cv.getContext("2d");
      ctxRef.current=ctx;
      function resize(){
        const w = hostRef.current?.clientWidth || L3_W;
        const h = Math.round(w*(L3_H/L3_W));
        const dpr = Math.max(1, Math.min(2.5, global.devicePixelRatio||1));
        sizeRef.current = { w,h,dpr };
        cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        ctx.setTransform(dpr*(w/L3_W),0,0,dpr*(w/L3_W),0,0);
      }
      resize(); const ro=new ResizeObserver(resize); hostRef.current && ro.observe(hostRef.current);
      global.addEventListener("resize",resize);
      return ()=>{ ro.disconnect(); global.removeEventListener("resize",resize); };
    },[]);

    // état jeu
    const [mode,setMode]=useState("jeu"); // "jeu" | "oracle"
    const [rolls,setRolls]=useState([6,4,3,1]);
    const [throwing,setThrowing]=useState(false);
    const [score,setScore]=useState(0);
    const [lastLabel,setLastLabel]=useState("—");
    const [lastMeaning,setLastMeaning]=useState("");

    // 3D scene
    const threeRef = useRef({ scene:null, camera:null, renderer:null, controls:null, clones:[], animId:0 });
    useEffect(()=>{
      let mounted=true;
      (async ()=>{
        try{
          await ensureThree();
          const THREE=global.THREE;
          const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
          renderer.setPixelRatio(Math.min(2.5, global.devicePixelRatio||1));
          webglRef.current.appendChild(renderer.domElement);

          const scene = new THREE.Scene();
          const camera= new THREE.PerspectiveCamera(40,16/9,0.1,100);
          camera.position.set(0.0,1.1,3.2);

          const plane = new THREE.Mesh(new THREE.PlaneGeometry(6,3.6), new THREE.MeshStandardMaterial({color:0x0b3b2e,metalness:0,roughness:1}));
          plane.rotation.x = -Math.PI/2; plane.position.y=-0.4; scene.add(plane);

          const amb = new THREE.AmbientLight(0xffffff,0.95); scene.add(amb);
          const dir = new THREE.DirectionalLight(0xffffff,0.9); dir.position.set(2,3,4); scene.add(dir);

          const controls = new THREE.OrbitControls(camera, renderer.domElement);
          controls.enablePan=false; controls.enableZoom=false; controls.autoRotate=false;

          function resize3d(){ const {w,h}=sizeRef.current; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
          resize3d();

          const loader = new THREE.GLTFLoader();
          let glb=null, usedPath="";
          for (const p of GLB_CANDIDATES){ try{ glb=await loader.loadAsync(p); usedPath=p; break; }catch(e){ console.warn("[L3] GLB échec:", p); } }
          if (!glb) console.warn("[L3] GLB absent — fallback dodecahedron");

          let base=null;
          if (glb){ base=glb.scene; base.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } }); }
          const spots = [ [-1.5,0], [-0.5,0], [0.5,0], [1.5,0] ];
          const clones=[];
          for (let i=0;i<4;i++){
            const g = base ? base.clone(true) : new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), new THREE.MeshStandardMaterial({color:0xfde68a}));
            const s=1.0; g.scale.set(s,s,s);
            g.position.set(spots[i][0], -0.2, spots[i][1]);
            g.rotation.set(Math.random(), Math.random(), Math.random());
            scene.add(g); clones.push(g);
          }

          threeRef.current = { scene, camera, renderer, controls, clones, animId:0 };

          const loop=()=>{ if(!mounted) return; renderer.render(scene,camera); threeRef.current.animId=requestAnimationFrame(loop); };
          loop();

          const onWinResize=()=>resize3d();
          global.addEventListener("resize", onWinResize);

          return ()=>{ mounted=false; cancelAnimationFrame(threeRef.current.animId); global.removeEventListener("resize", onWinResize); renderer.dispose(); };
        }catch(e){ console.error(e); }
      })();
    },[]);

    // lancer (anime rotations + génère valeurs)
    function doRoll(){
      if (throwing) return;
      setThrowing(true);
      const start=performance.now(), dur=900;
      const clones = threeRef.current.clones||[];
      const targets = clones.map(()=>[ Math.PI*2*(1+Math.random()*2), Math.PI*2*(1+Math.random()*2), Math.PI*2*(1+Math.random()*2) ]);
      const init = clones.map(c=>[c.rotation.x, c.rotation.y, c.rotation.z]);
      const vals = [rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6])];
      const ease = t=> 1 - Math.pow(1-t, 3);
      const tick=()=>{
        const t=Math.min(1,(performance.now()-start)/dur), e=ease(t);
        clones.forEach((c,i)=>{
          c.rotation.x = init[i][0] + (targets[i][0]-init[i][0])*e;
          c.rotation.y = init[i][1] + (targets[i][1]-init[i][1])*e;
          c.rotation.z = init[i][2] + (targets[i][2]-init[i][2])*e;
        });
        if (t<1) requestAnimationFrame(tick);
        else {
          setRolls(vals);
          const cat=categorize(vals); setLastLabel(cat.label); setLastMeaning(cat.meaning);
          if (mode==="jeu"){
            setScore(s=>s + cat.points);
            try{ (cat.points>0 ? goodRef.current : badRef.current)?.play(); }catch{}
          }
          setThrowing(false);
        }
      };
      tick();
    }

    function categorize(v){
      const s = [...v].sort((a,b)=>a-b).join("-");
      const counts={}; v.forEach(x=>{counts[x]=(counts[x]||0)+1;});
      const uniq = Object.keys(counts).length;
      if (s==="1-3-4-6") return { label:"Vénus", points: 10, meaning:"Lancer parfait, harmonie des faces." };
      if (s==="1-1-1-1") return { label:"Canis", points: 0,  meaning:"‘Chien’ : coup malchanceux." };
      if ((counts[6]||0) >= 2) return { label:"Senio", points: 5, meaning:"Le ‘six’ domine." };
      if (Object.values(counts).some(c=>c===3)) return { label:"Trina", points: 3, meaning:"Triple : stabilité." };
      if (uniq===2 && Object.values(counts).every(c=>c===2)) return { label:"Bina", points: 4, meaning:"Deux paires : équilibre fragile." };
      return { label:"Simple", points: 1, meaning:"Lecture modérée." };
    }

    // UI 2D
    useEffect(()=>{
      const ctx = ctxRef.current!; let raf;
      function render(){
        ctx.clearRect(0,0,L3_W,L3_H);

        ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui";
        ctx.fillText("Rouler les os — 3D", 16, 28);

        const xs=[160,320,640,800]; const y=160;
        ctx.fillStyle="#111827"; ctx.font="22px ui-sans-serif, system-ui"; ctx.textAlign="center";
        for(let i=0;i<4;i++) ctx.fillText(String(rolls[i]), xs[i], y);

        const x=L3_W-320, y2=52, w=300, h=260;
        ctx.save(); ctx.fillStyle="rgba(248,250,252,.88)"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5;
        ctx.fillRect(x,y2,w,h); ctx.strokeRect(x,y2,w,h);
        ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
        ctx.fillText("Mode : "+(mode==="jeu"?"Jeu (score)":"Oracle"), x+12, y2+22);
        ctx.fillText("Dernier coup : "+lastLabel, x+12, y2+46);

        ctx.fillStyle="#334155"; ctx.font="12px ui-sans-serif, system-ui";
        wrap(ctx, (mode==="oracle" ? lastMeaning : "Score : "+score+" pts"), x+12, y2+72, w-24, 16);

        zones.current.length=0;
        btn(ctx, x+12,  y2+h-92, 130, 32, throwing?"...":"Lancer", doRoll);
        btn(ctx, x+160, y2+h-92, 130, 32, "Musique "+(musicOn?"ON":"OFF"), ()=>setMusicOn(v=>!v));
        btn(ctx, x+12,  y2+h-48, 130, 32, "Mode "+(mode==="jeu"?"Oracle":"Jeu"), ()=>setMode(m=>m==="jeu"?"oracle":"jeu"));
        btn(ctx, x+160, y2+h-48, 130, 32, "Stop musique", ()=>global.AstragalusAudioBus.stopAll());

        ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui";
        wrap(ctx, "Rappels : Vénus=1·3·4·6 / Canis=4×1 / Senio=≥2×6 / Bina=deux paires / Trina=triple.", x+12, y2+h+10, w-24, 16);

        raf=requestAnimationFrame(render);
      }
      raf=requestAnimationFrame(render);
      return ()=> cancelAnimationFrame(raf);
    },[rolls,throwing,mode,lastLabel,lastMeaning,score,musicOn]);

    const zones = useRef([]);
    function btn(ctx,x,y,w,h,label,cb){ ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label, x+w/2, y+h/2+1); zones.current.push({x,y,w,h,cb}); }
    useEffect(()=>{
      const el=canvasRef.current!;
      function onClick(ev){ const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L3_W/r.width), my=(ev.clientY-r.top)*(L3_H/r.height); const z = zones.current.find(z=> mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h); zones.current.length=0; if(z) z.cb(); }
      el.addEventListener("click", onClick);
      return ()=> el.removeEventListener("click", onClick);
    },[]);

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
        <div ref={webglRef} style={{position:"absolute", inset:0}} aria-hidden="true"></div>
        <canvas ref={canvasRef}/>
      </div>
    );
  }

  global.AstragalusLevel3 = AstragalusLevel3;
})(window);
