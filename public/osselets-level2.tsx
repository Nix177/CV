/* public/osselets-level2.tsx
   Mini-jeu 2 — Écrire avec les os (fil + alphabet)
   - Utilise l’astragale GLB (avec trous) si trouvé
   - Projette 24 ancres Hole_<face>_<nn> → lettres
   - Fallback cercle 2D si pas d’ancres
   - AudioBus global + bouton Stop
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

  const L2_W=960, L2_H=540;
  const ABASE="/assets/games/osselets/audio/";
  const AU = { music:"game-music-1.mp3", ok:"catch-sound.mp3", bad:"ouch-sound.mp3" };

  const GREEK=["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];
  const LATN =["A","B","G","D","E","Z","Ē","Th","I","K","L","M","N","X","O","P","R","S","T","Y","Ph","Ch","Ps","Ō"];
  const PUZ=[ {title:"ΝΙΚΗ",latin:"NIKĒ",seq:[12,8,9,6],tip:"Victoire : souhait propitiatoire."},
              {title:"ΕΛΠΙΣ",latin:"ELPIS",seq:[4,10,15,8,17],tip:"Espoir : message positif."},
              {title:"ΤΥΧΗ",latin:"TYCHĒ",seq:[18,19,21,6],tip:"Bonne fortune."} ];

  // -------- Three UMD loader --------
  function ensureThree(){
    return new Promise((res,rej)=>{
      if (global.THREE && global.THREE.GLTFLoader && global.THREE.OrbitControls) return res(global.THREE);
      const add=src=>new Promise((r,j)=>{ const s=document.createElement("script"); s.src=src; s.onload=()=>r(1); s.onerror=()=>j(new Error("load "+src)); document.head.appendChild(s); });
      (async()=>{ try{
        await add("https://unpkg.com/three@0.149.0/build/three.min.js");
        await add("https://unpkg.com/three@0.149.0/examples/js/controls/OrbitControls.js");
        await add("https://unpkg.com/three@0.149.0/examples/js/loaders/GLTFLoader.js");
        res(global.THREE);
      }catch(e){ rej(e);} })();
    });
  }
  const GLB_CANDIDATES=[
    "/assets/games/osselets/3d/astragalus.glb",
    "/assets/games/osselets/level2/astragalus.glb",
    "/assets/games/osselets/level2/3d/astragalus.glb",
    "/assets/games/osselets/level2/astragalus holes.glb",
    "/assets/games/osselets/level2/astragalus_holes.glb",
  ];

  function wrap(ctx, text, x,y,w,lh){ const words=(text||"").split(/\s+/); let line=""; for (let i=0;i<words.length;i++){ const t=(line?line+" ":"")+words[i]; if (ctx.measureText(t).width>w && line){ ctx.fillText(line,x,y); line=words[i]; y+=lh; } else line=t; } if(line) ctx.fillText(line,x,y); }
  function loadA(f){ try{ const a=new Audio(ABASE+f); a.preload="auto"; return a; }catch{return null;} }

  function AstragalusLevel2(){
    const hostRef=useRef(null), webglRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);
    const musRef=useRef(null), okRef=useRef(null), badRef=useRef(null);
    const [musicOn,setMusicOn]=useState(true);

    // coupe autres musiques au montage
    useEffect(()=>{ global.AstragalusAudioBus.stopAll(); },[]);

    // DPR
    const sizeRef=useRef({w:L2_W,h:L2_H,dpr:1});
    useEffect(()=>{
      const cv=canvasRef.current, ctx=cv.getContext("2d"); ctxRef.current=ctx;
      function resize(){
        const w=hostRef.current?.clientWidth||L2_W, h=Math.round(w*(L2_H/L2_W));
        const dpr=Math.max(1,Math.min(2.5,global.devicePixelRatio||1));
        sizeRef.current={w,h,dpr};
        cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        ctx.setTransform(dpr*(w/L2_W),0,0,dpr*(w/L2_W),0,0);
      }
      resize(); const ro=window.ResizeObserver?new ResizeObserver(resize):null; if(ro&&hostRef.current) ro.observe(hostRef.current);
      global.addEventListener("resize",resize);
      return ()=>{ ro?.disconnect(); global.removeEventListener("resize",resize); };
    },[]);

    // audio
    useEffect(()=>{
      musRef.current=loadA(AU.music); okRef.current=loadA(AU.ok); badRef.current=loadA(AU.bad);
      if(musRef.current){ musRef.current.loop=true; musRef.current.volume=0.35; global.AstragalusAudioBus.register(musRef.current); if(musicOn) musRef.current.play().catch(()=>{}); }
      if(okRef.current)  global.AstragalusAudioBus.register(okRef.current);
      if(badRef.current) global.AstragalusAudioBus.register(badRef.current);
      return ()=>{ try{ musRef.current?.pause(); }catch{} };
    },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.muted=!musicOn; if(musicOn){ try{m.play();}catch{} } else m.pause(); },[musicOn]);

    // 3D + projection anchres
    const holes=useRef([]); // {x,y,label,index}
    function fallbackHoles(){
      const cx=L2_W*0.5, cy=L2_H*0.54, rx=260, ry=120, off=-Math.PI/2; holes.current=[];
      for(let i=0;i<24;i++){ const ring=i%2, t=off+(i/24)*Math.PI*2+(ring?0.08:-0.08), rxf=rx*(ring?0.92:1), ryf=ry*(ring?0.92:1); holes.current.push({x:cx+Math.cos(t)*rxf, y:cy+Math.sin(t)*ryf, label:GREEK[i], index:i}); }
    }

    useEffect(()=>{
      let mounted=true;
      (async()=>{
        try{
          await ensureThree();
          const THREE=global.THREE;
          const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
          renderer.setPixelRatio(Math.min(2.5,global.devicePixelRatio||1));
          webglRef.current.appendChild(renderer.domElement);

          const scene=new THREE.Scene();
          const camera=new THREE.PerspectiveCamera(40,16/9,0.1,100); camera.position.set(0.8,0.5,2.2);
          scene.add(new THREE.AmbientLight(0xffffff,0.95));
          const dl=new THREE.DirectionalLight(0xffffff,0.85); dl.position.set(2,3,4); scene.add(dl);

          const ctrls=new THREE.OrbitControls(camera,renderer.domElement); ctrls.enablePan=false; ctrls.enableZoom=false; ctrls.autoRotate=true; ctrls.autoRotateSpeed=0.7;

          function resize3d(){ const {w,h}=sizeRef.current; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
          resize3d();

          const loader=new THREE.GLTFLoader();
          let glb=null, used="";
          for(const p of GLB_CANDIDATES){ try{ glb=await loader.loadAsync(p); used=p; break; }catch(e){ console.warn("[L2] GLB échec:", p); } }
          if(!glb){ console.warn("[L2] Aucun GLB — fallback cercle"); fallbackHoles(); }
          else console.log("[L2] GLB chargé:", used);

          let anchors=[];
          if(glb){
            const model=glb.scene; model.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });
            const s=1.1; model.scale.set(s,s,s); scene.add(model);
            const order=[]; ["ventre","dos","bassin","membres"].forEach(face=>{ for(let i=1;i<=6;i++) order.push(`Hole_${face}_${String(i).padStart(2,"0")}`); });
            anchors = order.map(n=>model.getObjectByName(n)).filter(Boolean);
            if(anchors.length!==24){ console.warn(`[L2] Anchres ${anchors.length}/24 — fallback cercle`); anchors.length=0; }
          }

          const v=new THREE.Vector3();
          function loop(){
            if(!mounted) return;
            ctrls.update(); renderer.render(scene,camera);
            if(anchors.length===24){
              const {w,h}=sizeRef.current, sx=L2_W/w, sy=L2_H/h;
              holes.current = anchors.map((n,i)=>{ n.getWorldPosition(v); v.project(camera); const px=(v.x*0.5+0.5)*w, py=(-v.y*0.5+0.5)*h; return {x:px*sx, y:py*sy, label:GREEK[i], index:i}; });
            } else if (holes.current.length!==24){ fallbackHoles(); }
            requestAnimationFrame(loop);
          }
          loop();

          const onR=()=>resize3d(); global.addEventListener("resize",onR);
          return ()=>{ mounted=false; global.removeEventListener("resize",onR); renderer.dispose(); };
        }catch(e){ console.error(e); fallbackHoles(); }
      })();
    },[]);

    // gameplay
    const [pi,setPi]=useState(0); const cur=()=>PUZ[pi];
    const progress=useRef(0), path=useRef([]); const [toast,setToast]=useState("Trace le fil : "+cur().title+" ("+cur().latin+")");
    function at(x,y){ return holes.current.find(h => (x-h.x)**2+(y-h.y)**2 <= 18*18); }

    useEffect(()=>{
      const cv=canvasRef.current;
      const state={drag:false,pt:null};
      const mm=ev=>{ const r=cv.getBoundingClientRect(); return { x:(ev.clientX-r.left)*(L2_W/r.width), y:(ev.clientY-r.top)*(L2_H/r.height) }; };
      const down=ev=>{ const {x,y}=mm(ev); const h=at(x,y); if(h){ state.drag=true; state.pt={x:h.x,y:h.y}; path.current=[{x:h.x,y:h.y}]; progress.current=0; setToast("Suis les lettres…"); } };
      const move=ev=>{ if(!state.drag) return; const {x,y}=mm(ev); state.pt={x,y}; if(path.current.length===0) path.current.push({x,y}); else path.current[path.current.length-1]={x,y}; };
      const up=()=>{ if(!state.drag) return; state.drag=false; const seq=cur().seq; const near=at(state.pt.x,state.pt.y);
        if(near && near.index===seq[progress.current]){ progress.current++; try{ okRef.current&&(okRef.current.currentTime=0, okRef.current.play()); }catch{}; if(progress.current>=seq.length) setToast("Bravo ! « "+cur().title+" » ("+cur().latin+")"); else setToast("OK, suivant : "+GREEK[seq[progress.current]]+" ("+LATN[seq[progress.current]]+")"); }
        else { try{ badRef.current&&(badRef.current.currentTime=0, badRef.current.play()); }catch{}; setToast("Essaie encore : "+GREEK[seq[progress.current]]+" ("+LATN[seq[progress.current]]+")"); } };
      cv.addEventListener("pointerdown",down); cv.addEventListener("pointermove",move); global.addEventListener("pointerup",up);
      return ()=>{ cv.removeEventListener("pointerdown",down); cv.removeEventListener("pointermove",move); global.removeEventListener("pointerup",up); };
    },[pi]);

    const zones=useRef([]);
    function btn(ctx,x,y,w,h,label,cb){ ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label,x+w/2,y+h/2+1); zones.current.push({x,y,w,h,cb}); }
    useEffect(()=>{
      const ctx=ctxRef.current; let raf;
      function draw(){
        ctx.clearRect(0,0,L2_W,L2_H);
        ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui"; ctx.fillText("Écrire avec les os — 3D",16,28);

        for(const h of holes.current){ ctx.fillStyle="#1e293b"; ctx.beginPath(); ctx.arc(h.x,h.y,10,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#f8fafc"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(h.label,h.x,h.y-18); }

        if (path.current.length>0){ ctx.strokeStyle="#ef4444"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(path.current[0].x,path.current[0].y); for(let i=1;i<path.current.length;i++) ctx.lineTo(path.current[i].x,path.current[i].y); ctx.stroke(); }

        const x=L2_W-310,y=52,w=296,h=230;
        ctx.save(); ctx.fillStyle="rgba(248,250,252,.88)"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
        ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui"; ctx.fillText("Mot cible",x+12,y+22);
        ctx.font="18px ui-sans-serif, system-ui"; ctx.fillStyle="#0b3b2e"; ctx.fillText(PUZ[pi].title+" ("+PUZ[pi].latin+")",x+12,y+48);
        ctx.font="12px ui-sans-serif, system-ui"; ctx.fillStyle="#334155"; wrap(ctx,"Indice : "+PUZ[pi].tip,x+12,y+76,w-24,16);
        ctx.restore();

        zones.current.length=0;
        btn(ctx,x+8,y+h-92,132,32,"Réinitialiser",()=>{ path.current.length=0; progress.current=0; setToast("Trace le fil : "+PUZ[pi].title+" ("+PUZ[pi].latin+")"); });
        btn(ctx,x+156,y+h-92,132,32,"Mot suivant",()=>{ const n=(pi+1)%PUZ.length; path.current.length=0; progress.current=0; setPi(n); setToast("Trace le fil : "+PUZ[n].title+" ("+PUZ[n].latin+")"); });
        btn(ctx,x+8,y+h-48,132,32,"Musique "+(musicOn?"ON":"OFF"),()=>setMusicOn(v=>!v));
        btn(ctx,x+156,y+h-48,132,32,"Stop musique",()=>global.AstragalusAudioBus.stopAll());

        ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui"; wrap(ctx,toast||"",16,L2_H-48,L2_W-32,18);

        raf=requestAnimationFrame(draw);
      }
      raf=requestAnimationFrame(draw);
      return ()=> cancelAnimationFrame(raf);
    },[pi,toast,musicOn]);

    useEffect(()=>{
      const el=canvasRef.current;
      function onClick(ev){ const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L2_W/r.width), my=(ev.clientY-r.top)*(L2_H/r.height); const z=zones.current.find(z=> mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h); zones.current.length=0; if(z) z.cb(); }
      el.addEventListener("click",onClick);
      return ()=> el.removeEventListener("click",onClick);
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
