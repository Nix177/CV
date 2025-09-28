/* public/osselets-level2.tsx
   Mini-jeu 2 — « Écrire avec les os » (fil + alphabet grec)
   - Charge strictement /assets/games/osselets/level2/3d/astragalus.glb
     (24 trous : Hole_ventre_01..06, etc.).
   - Projette ces ancres en 2D ; fallback cercle 2D si le GLB ou les ancres
     sont absents.
   - Utilise un loader Three partagé (mise en cache + fallback CDN).
*/
(function (global) {
  const { useEffect, useRef, useState } = React;

  // -------- AudioBus partagé --------
  if (!global.AstragalusAudioBus) {
    global.AstragalusAudioBus = {
      _list: [], register(a){ if(a && !this._list.includes(a)) this._list.push(a); },
      stopAll(){ this._list.forEach(a=>{ try{ a.pause(); a.currentTime=0; }catch{} }); },
      muteAll(m){ this._list.forEach(a=>{ try{ a.muted=!!m; }catch{} }); }
    };
  }

  // -------- Loader Three (mémo + fallbacks CDN) --------
  function ensureThree(){
    if (global.__THREE_PROMISE__) return global.__THREE_PROMISE__;
    global.__THREE_PROMISE__ = new Promise(async (res,rej)=>{
      if (global.THREE && global.THREE.GLTFLoader && global.THREE.OrbitControls) return res(global.THREE);
      const add = (src)=>new Promise((r,j)=>{ const s=document.createElement("script"); s.src=src; s.onload=()=>r(1); s.onerror=()=>j(new Error("load "+src)); document.head.appendChild(s); });
      async function tryAll(urls){ for(const u of urls){ try{ await add(u); return true; }catch(e){ /* next */ } } return false; }
      const base = "0.149.0";
      const ok = await tryAll([
        `https://unpkg.com/three@${base}/build/three.min.js`,
        `https://cdn.jsdelivr.net/npm/three@${base}/build/three.min.js`
      ]);
      if (!ok) return rej(new Error("three failed"));
      const ok2 = await tryAll([
        `https://unpkg.com/three@${base}/examples/js/controls/OrbitControls.js`,
        `https://cdn.jsdelivr.net/npm/three@${base}/examples/js/controls/OrbitControls.js`
      ]);
      const ok3 = await tryAll([
        `https://unpkg.com/three@${base}/examples/js/loaders/GLTFLoader.js`,
        `https://cdn.jsdelivr.net/npm/three@${base}/examples/js/loaders/GLTFLoader.js`
      ]);
      if (!(ok2 && ok3)) return rej(new Error("examples failed"));
      res(global.THREE);
    });
    return global.__THREE_PROMISE__;
  }

  // -------- Config & données --------
  const L2_W=960, L2_H=540;
  const ABASE="/assets/games/osselets/audio/";
  const AU = { music:"game-music-1.mp3", ok:"catch-sound.mp3", bad:"ouch-sound.mp3" };
  // Le modèle GLB N’EST PAS fallbacké : on utilise uniquement celui-ci, fourni par le musée.
  const GLB_CANDIDATES=[
    "/assets/games/osselets/level2/3d/astragalus.glb"
  ];
  const GREEK=["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];
  const PUZ=[ {title:"ΝΙΚΗ",latin:"NIKĒ",seq:[12,8,9,6],tip:"Victoire : souhait propitiatoire."},
              {title:"ΕΛΠΙΣ",latin:"ELPIS",seq:[4,10,15,8,17],tip:"Espoir : message positif."},
              {title:"ΤΥΧΗ",latin:"TYCHĒ",seq:[18,19,21,6],tip:"Bonne fortune."} ];

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
      resize(); const ro=window.ResizeObserver? new ResizeObserver(resize):null; ro?.observe(hostRef.current); global.addEventListener("resize",resize);
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

    // 3D + projection des ancres
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
          for(const p of GLB_CANDIDATES){ try{ glb=await loader.loadAsync(p); used=p; break; }catch(e){ /* next */ } }
          if(!glb){ console.warn("[L2] Aucun GLB — fallback cercle"); fallbackHoles(); }
          else console.log("[L2] GLB chargé:", used);

          let anchors=[];
          if(glb){
            const model=glb.scene; model.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });
            const s=1.1; model.scale.set(s,s,s); scene.add(model);
            const order=[]; ["ventre","dos","bassin","membres"].forEach(face=>{ for(let i=1;i<=6;i++) order.push(`Hole_${face}_${String(i).padStart(2,"0")}`); });
            anchors = order.map(n=>model.getObjectByName(n)).filter(Boolean);
            if(anchors.length!==24){ console.warn(`[L2] Ancres ${anchors.length}/24 — fallback cercle`); anchors.length=0; }
          }

          const v=new THREE.Vector3();
          function loop(){
            if(!mounted) return;
            ctrls.update(); renderer.render(scene,camera);
            if(anchors.length===24){
              const {w,h}=sizeRef.current, sx=L2_W/w, sy=L2_H/h;
              holes.current = anchors.map((n,i)=>{ n.getWorldPosition(v); v.project(camera); const px=(v.x*0.5+0.5)*w, py=(-v.y*0.5+0.5)*h; return {x:px*sx, y:py*sy, label:GREEK[i], index=i}; });
            } else if (holes.current.length!==24){ fallbackHoles(); }
            requestAnimationFrame(loop);
          }
          loop();

          const onR=()=>resize3d(); global.addEventListener("resize",onR);
          return ()=>{ mounted=false; global.removeEventListener("resize",onR); renderer.dispose(); };
        }catch(e){ console.error(e); fallbackHoles(); }
      })();
    },[]);

    // puzzles
    const [pi,setPi]=useState(0); const PUZref=useRef(PUZ); const cur=()=>PUZref.current[pi];
    const progress=useRef(0), path=useRef([]); const [toast,setToast]=useState("Trace le fil : "+cur().title+" ("+cur().latin+")");
    function at(x,y){ return holes.current.find(h => (x-h.x)**2+(y-h.y)**2 <= 18*18); }

    useEffect(()=>{
      const cv=canvasRef.current;
      const state={drag:false,pt:null};
      const mm=ev=>{ const r=cv.getBoundingClientRect(); return { x:(ev.clientX-r.left)*(L2_W/r.width), y:(ev.clientY-r.top)*(L2_H/r.height) }; };
      const down=ev=>{ const {x,y}=mm(ev); const h=at(x,y); if(h){ state.drag=true; state.pt={x:h.x,y:h.y}; path.current=[{x:h.x,y:h.y}]; progress.current=0; setToast("Suis les lettres…"); } };
      const move=ev=>{ if(!state.drag) return; const {x,y}=mm(ev); state.pt={x,y}; if(path.current.length===0) path.current.push({x,y}); else path.current[path.current.length-1]={x,y}; };
      const up=()=>{ if(!state.drag) return; state.drag=false; const seq=cur().seq; const near=at(state.pt.x,state.pt.y);
        if(near && near.index===seq[progress.current]){ progress.current++; try{ okRef.current&&(okRef.current.currentTime=0, okRef.current.play()); }catch{}; if(progress.current>=seq.length){ setToast("Bravo ! Mot : "+cur().title+" (“"+cur().latin+"”)"); progress.current=0; } }
        else { try{ badRef.current&&(badRef.current.currentTime=0, badRef.current.play()); }catch{}; setToast("Raté… recommence au premier trou !"); progress.current=0; }
      };
      cv.addEventListener("pointerdown",down); cv.addEventListener("pointermove",move); global.addEventListener("pointerup",up);
      return ()=>{ cv.removeEventListener("pointerdown",down); cv.removeEventListener("pointermove",move); global.removeEventListener("pointerup",up); };
    },[pi]);

    // rendu 2D
    useEffect(()=>{
      const ctx=ctxRef.current; let raf;
      function draw(){
        ctx.clearRect(0,0,L2_W,L2_H);
        // fond
        const g=ctx.createLinearGradient(0,0,0,L2_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
        ctx.fillStyle=g; ctx.fillRect(0,0,L2_W,L2_H);

        // tapis 3D (ou 2D)
        ctx.fillStyle="#0b3b2e"; ctx.fillRect(16, 44, L2_W-32, 300);
        ctx.strokeStyle="#14532d"; ctx.lineWidth=6; ctx.strokeRect(16, 44, L2_W-32, 300);

        // trous projetés
        ctx.fillStyle="#fde68a"; ctx.strokeStyle="#eab308";
        holes.current.forEach((h,i)=>{
          ctx.beginPath(); ctx.arc(h.x,h.y,12,0,Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(GREEK[i], h.x, h.y); ctx.fillStyle="#fde68a";
        });

        // chemin en cours
        if(path.current.length>1){ ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(path.current[0].x, path.current[0].y); for(const p of path.current) ctx.lineTo(p.x,p.y); ctx.stroke(); }

        // panneau droit
        const x=L2_W-320, y=44, w=300, h=300; ctx.save();
        ctx.fillStyle="#f8fafc"; ctx.fillRect(x,y,w,h); ctx.strokeStyle="#94a3b8"; ctx.strokeRect(x,y,w,h);
        ctx.fillStyle="#0f172a"; ctx.font="16px ui-sans-serif, system-ui"; ctx.fillText("Mot : "+cur().title+" (“"+cur().latin+"”)", x+12, y+28);
        ctx.font="13px ui-sans-serif, system-ui"; wrap(ctx, "Principe : passe dans le trou N d’une face et ressors par le trou N de la face opposée (ventre↔dos, bassin↔membres).", x+12, y+48, w-24, 18);
        ctx.font="12px ui-sans-serif, system-ui"; wrap(ctx, "Indice : "+cur().tip, x+12, y+h-64, w-24, 16);

        // boutons
        zones.current.length=0;
        btn(ctx,x+8,y+h-92,132,32,"Réinitialiser",()=>{ path.current.length=0; progress.current=0; setToast("Trace le fil : "+cur().title+" ("+cur().latin+")"); });
        btn(ctx,x+156,y+h-92,132,32,"Mot suivant",()=>{ const n=(pi+1)%PUZ.length; path.current.length=0; progress.current=0; setPi(n); setToast("Trace le fil : "+PUZ[n].title+" ("+PUZ[n].latin+")"); });
        btn(ctx,x+8,y+h-48,132,32,"Musique "+(musicOn?"ON":"OFF"),()=>setMusicOn(v=>!v));
        btn(ctx,x+156,y+h-48,132,32,"Stop musique",()=>global.AstragalusAudioBus.stopAll());

        // toast bas
        ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui"; wrap(ctx,toast||"",16,L2_H-48,L2_W-32,18);

        raf=requestAnimationFrame(draw);
      }
      raf=requestAnimationFrame(draw);
      return ()=> cancelAnimationFrame(raf);
    },[pi,toast,musicOn]);

    // zones cliquables
    const zones = useRef([]); // {x,y,w,h,cb}
    function btn(ctx,x,y,w,h,label,cb){ ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label, x+w/2, y+h/2+1); zones.current.push({x,y,w,h,cb}); }
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
