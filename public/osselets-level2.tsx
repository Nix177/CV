/* public/osselets-level2.tsx
   Mini-jeu 2 — « Écrire avec les os »
   - Rendu 3D GLB (astragale avec trous) derrière
   - Projection des 24 ancres Hole_<face>_<nn> → positions 2D des lettres
   - Fallback cercle 2D si ancres manquantes
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

  const L2_W = 960, L2_H = 540;
  const L2_AUDIO_BASE = "/assets/games/osselets/audio/";
  const L2_AUDIO = { music:"game-music-1.mp3", ok:"catch-sound.mp3", bad:"ouch-sound.mp3" };

  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];
  const GREEK_LATIN = ["A","B","G","D","E","Z","Ē","Th","I","K","L","M","N","X","O","P","R","S","T","Y","Ph","Ch","Ps","Ō"];

  const PUZZLES = [
    { title:"ΝΙΚΗ", latin:"NIKĒ",   seq:[12,8,9,6],         tip:"Victoire : souhait propitiatoire." },
    { title:"ΕΛΠΙΣ", latin:"ELPIS", seq:[4,10,15,8,17],     tip:"Espoir : message positif." },
    { title:"ΤΥΧΗ", latin:"TYCHĒ",  seq:[18,19,21,6],       tip:"Bonne fortune." }
  ];

  // ----- Three loader (UMD) -----
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
    "/assets/games/osselets/level2/3d/astragalus.glb",
    "/assets/games/osselets/level2/astragalus.glb",
    "/assets/games/osselets/level2/astragalus holes.glb",
    "/assets/games/osselets/level2/astragalus_holes.glb",
  ];

  // helpers
  function wrap(ctx, text, x,y,maxW,lh){ const words=(text||"").split(/\s+/); let line=""; for(let i=0;i<words.length;i++){ const test=(line?line+" ":"")+words[i]; if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line,x,y); line=words[i]; y+=lh; } else line=test; } if(line) ctx.fillText(line,x,y); }
  function loadAudio(file){ try{ const a=new Audio(L2_AUDIO_BASE+file); a.preload="auto"; return a; }catch{return null;} }

  function AstragalusLevel2(){
    const hostRef   = useRef(null);
    const webglRef  = useRef(null);
    const canvasRef = useRef(null);
    const ctxRef    = useRef(null);

    // audio
    const musRef=useRef(null), okRef=useRef(null), badRef=useRef(null);
    const [musicOn,setMusicOn] = useState(true);

    // start: coupe autres musiques
    useEffect(()=>{ global.AstragalusAudioBus.stopAll(); }, []);

    // DPR canvas
    const sizeRef = useRef({w:L2_W,h:L2_H,dpr:1});
    useEffect(()=>{
      const cv=canvasRef.current, ctx=cv.getContext("2d");
      ctxRef.current=ctx;
      function resize(){
        const w = hostRef.current?.clientWidth || L2_W;
        const h = Math.round(w*(L2_H/L2_W));
        const dpr = Math.max(1, Math.min(2.5, global.devicePixelRatio||1));
        sizeRef.current = { w,h,dpr };
        cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        ctx.setTransform(dpr*(w/L2_W),0,0,dpr*(w/L2_W),0,0);
      }
      resize();
      const ro=new ResizeObserver(resize); hostRef.current && ro.observe(hostRef.current);
      global.addEventListener("resize",resize);
      return ()=>{ ro.disconnect(); global.removeEventListener("resize",resize); };
    },[]);

    // audio load
    useEffect(()=>{
      musRef.current = loadAudio(L2_AUDIO.music);
      okRef.current  = loadAudio(L2_AUDIO.ok);
      badRef.current = loadAudio(L2_AUDIO.bad);
      if (musRef.current){ musRef.current.loop=true; musRef.current.volume=0.35; global.AstragalusAudioBus.register(musRef.current); }
      if (okRef.current)  global.AstragalusAudioBus.register(okRef.current);
      if (badRef.current) global.AstragalusAudioBus.register(badRef.current);
      if (musRef.current && musicOn){ try{ musRef.current.play(); }catch{} }
      return ()=>{ try{ musRef.current?.pause(); }catch{} };
    },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.muted=!musicOn; if(musicOn){ try{m.play();}catch{} } else m.pause(); },[musicOn]);

    // 3D scene + anchors projection
    const threeRef = useRef({ scene:null, camera:null, renderer:null, controls:null, anchors:[], animId:0 });
    const holes = useRef([]); // {x,y,label,index}

    function setFallbackHoles(){
      const cx=L2_W*0.5, cy=L2_H*0.54; const rx=260, ry=120; const offset=-Math.PI/2;
      holes.current = [];
      for (let i=0;i<24;i++){
        const ring = i%2, t = offset + (i/24)*Math.PI*2 + (ring?0.08:-0.08);
        const rxf = rx*(ring?0.92:1), ryf= ry*(ring?0.92:1);
        holes.current.push({ x: cx + Math.cos(t)*rxf, y: cy + Math.sin(t)*ryf, label:GREEK[i], index:i });
      }
    }

    useEffect(()=>{
      let mounted=true;
      (async ()=>{
        try{
          await ensureThree();
          const THREE = global.THREE;
          const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
          renderer.setPixelRatio(Math.min(2.5, global.devicePixelRatio||1));
          webglRef.current.appendChild(renderer.domElement);

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(40, 16/9, 0.1, 100);
          camera.position.set(0.8, 0.5, 2.2);

          const amb = new THREE.AmbientLight(0xffffff, 0.95); scene.add(amb);
          const dir = new THREE.DirectionalLight(0xffffff, 0.85); dir.position.set(2,3,4); scene.add(dir);

          const controls = new THREE.OrbitControls(camera, renderer.domElement);
          controls.enablePan=false; controls.enableZoom=false; controls.autoRotate=true; controls.autoRotateSpeed=0.7;

          function resize3d(){
            const {w,h}=sizeRef.current;
            renderer.setSize(w,h,false);
            camera.aspect=w/h; camera.updateProjectionMatrix();
          }
          resize3d();

          // charge GLB
          const loader = new THREE.GLTFLoader();
          let glb=null, usedPath="";
          for (const p of GLB_CANDIDATES){
            try{ glb = await loader.loadAsync(p); usedPath=p; break; }catch(e){ console.warn("[L2] GLB échec:", p); }
          }
          if (!glb){ console.warn("[L2] Aucun GLB trouvé — fallback 2D"); setFallbackHoles(); }
          else { console.log("[L2] GLB chargé:", usedPath); }

          let anchors=[];
          if (glb){
            const model = glb.scene;
            model.traverse(o=>{ if (o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });
            const s=1.1; model.scale.set(s,s,s);
            scene.add(model);

            const names=[];
            ["ventre","dos","bassin","membres"].forEach(face=>{
              for(let i=1;i<=6;i++) names.push(`Hole_${face}_${String(i).padStart(2,"0")}`);
            });
            anchors = names.map(n => model.getObjectByName(n)).filter(Boolean);
            if (anchors.length!==24){
              console.warn(`[L2] Anchors incomplètes (${anchors.length}/24) — fallback cercle`);
              anchors.length=0;
            }
          }

          threeRef.current = { scene, camera, renderer, controls, anchors, animId:0 };

          const v = new THREE.Vector3();
          const loop = ()=>{
            if (!mounted) return;
            controls.update();
            renderer.render(scene, camera);

            if (anchors.length===24){
              const { w,h } = sizeRef.current;
              const scaleX = L2_W / w, scaleY = L2_H / h;
              holes.current = anchors.map((node, i)=>{
                node.getWorldPosition(v); v.project(camera);
                const sx = ( v.x * 0.5 + 0.5) * w;
                const sy = (-v.y * 0.5 + 0.5) * h;
                return { x: sx*scaleX, y: sy*scaleY, label: GREEK[i], index:i };
              });
            } else if (holes.current.length!==24){
              setFallbackHoles();
            }
            threeRef.current.animId = requestAnimationFrame(loop);
          };
          loop();

          const onWinResize = ()=> resize3d();
          global.addEventListener("resize", onWinResize);

          return ()=>{ mounted=false; cancelAnimationFrame(threeRef.current.animId); global.removeEventListener("resize", onWinResize); renderer.dispose(); };
        } catch(e){ console.error(e); setFallbackHoles(); }
      })();
    },[]);

    // gameplay : dessine un mot en reliant la séquence
    const [pIndex,setPIndex]=useState(0);
    const cur = () => PUZZLES[pIndex];
    const progress = useRef(0);
    const pathPts  = useRef([]);
    const [toast,setToast]=useState("Trace le fil : "+cur().title+" ("+cur().latin+")");
    const [done,setDone]=useState(false);

    function holeAt(x,y){ return holes.current.find(h=> (x-h.x)**2+(y-h.y)**2 <= 18*18 ); }

    useEffect(()=>{
      const cv=canvasRef.current!;
      const state = { dragging:false, dragPt:null };

      function mm(ev){ const r=cv.getBoundingClientRect(); return { x:(ev.clientX-r.left)*(L2_W/r.width), y:(ev.clientY-r.top)*(L2_H/r.height) }; }
      function onDown(ev){
        const {x,y}=mm(ev); const h=holeAt(x,y);
        if (h){ state.dragging=true; state.dragPt={x:h.x,y:h.y}; pathPts.current=[{x:h.x,y:h.y}]; progress.current=0; setDone(false); setToast("Suis les lettres…"); }
      }
      function onMove(ev){
        if (!state.dragging) return;
        const {x,y}=mm(ev); state.dragPt={x,y};
        if (pathPts.current.length===0) pathPts.current.push({x,y}); else pathPts.current[pathPts.current.length-1]={x,y};
      }
      function onUp(){
        if (!state.dragging) return; state.dragging=false;
        const seq = cur().seq;
        const near = holeAt(state.dragPt.x, state.dragPt.y);
        if (near && near.index === seq[progress.current]){
          progress.current++;
          try{ okRef.current && (okRef.current.currentTime=0, okRef.current.play()); }catch{}
          if (progress.current>=seq.length){ setDone(true); setToast("Bravo ! « "+cur().title+" » ("+cur().latin+")"); }
          else setToast("OK, suivant : "+GREEK[seq[progress.current]]+" ("+GREEK_LATIN[seq[progress.current]]+")");
        } else {
          try{ badRef.current && (badRef.current.currentTime=0, badRef.current.play()); }catch{}
          setToast("Essaie encore : "+GREEK[seq[progress.current]]+" ("+GREEK_LATIN[seq[progress.current]]+")");
        }
      }

      cv.addEventListener("pointerdown",onDown);
      cv.addEventListener("pointermove",onMove);
      global.addEventListener("pointerup",onUp);
      return ()=>{ cv.removeEventListener("pointerdown",onDown); cv.removeEventListener("pointermove",onMove); global.removeEventListener("pointerup",onUp); };
    },[pIndex,done]);

    function resetPuzzle(next=pIndex){
      progress.current=0; pathPts.current.length=0; setDone(false); setPIndex(next);
      setToast("Trace le fil : "+PUZZLES[next].title+" ("+PUZZLES[next].latin+")");
    }

    // rendu 2D UI
    const zones = useRef([]);
    function btn(ctx,x,y,w,h,label,cb){ ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label, x+w/2, y+h/2+1); zones.current.push({x,y,w,h,cb}); }

    useEffect(()=>{
      const ctx = ctxRef.current!; let raf;
      function draw(){
        ctx.clearRect(0,0,L2_W,L2_H);

        // titre
        ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui";
        ctx.fillText("Écrire avec les os — 3D", 16, 28);

        // trous + lettres
        for (const h of holes.current){
          ctx.fillStyle="#1e293b"; ctx.beginPath(); ctx.arc(h.x, h.y, 10, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle="#f8fafc"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(h.label, h.x, h.y-18);
        }

        // fil
        if (pathPts.current.length>0){
          ctx.strokeStyle="#ef4444"; ctx.lineWidth=3; ctx.beginPath();
          ctx.moveTo(pathPts.current[0].x, pathPts.current[0].y);
          for (let i=1;i<pathPts.current.length;i++) ctx.lineTo(pathPts.current[i].x, pathPts.current[i].y);
          ctx.stroke();
        }

        // panneau
        const x=L2_W-310, y=52, w=296, h=230;
        ctx.save(); ctx.fillStyle="rgba(248,250,252,.88)"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5;
        ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
        ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
        ctx.fillText("Mot cible", x+12, y+22);
        ctx.font="18px ui-sans-serif, system-ui"; ctx.fillStyle="#0b3b2e";
        ctx.fillText(cur().title+" ("+cur().latin+")", x+12, y+48);
        ctx.font="12px ui-sans-serif, system-ui"; ctx.fillStyle="#334155"; wrap(ctx, "Indice : "+cur().tip, x+12, y+76, w-24, 16);
        ctx.restore();

        zones.current.length=0;
        btn(ctx, x+8,  y+h-92, 132, 32, "Réinitialiser", ()=>resetPuzzle(pIndex));
        btn(ctx, x+156,y+h-92, 132, 32, "Mot suivant",   ()=>resetPuzzle((pIndex+1)%PUZZLES.length));
        btn(ctx, x+8,  y+h-48, 132, 32, "Musique "+(musicOn?"ON":"OFF"), ()=>setMusicOn(v=>!v));
        btn(ctx, x+156,y+h-48, 132, 32, "Stop musique", ()=>global.AstragalusAudioBus.stopAll());

        // toast
        ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui"; wrap(ctx, toast||"", 16, L2_H-48, L2_W-32, 18);

        raf=requestAnimationFrame(draw);
      }
      raf=requestAnimationFrame(draw);
      return ()=> cancelAnimationFrame(raf);
    },[pIndex,done,toast,musicOn]);

    // click zones
    useEffect(()=>{
      const el = canvasRef.current!;
      function onClick(ev){
        const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L2_W/r.width), my=(ev.clientY-r.top)*(L2_H/r.height);
        const z = zones.current.find(z=> mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h);
        zones.current.length=0; if (z) z.cb();
      }
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

  global.AstragalusLevel2 = AstragalusLevel2;
})(window);
