/* public/osselets-level2.tsx
   Mini-jeu 2 — « Écrire avec les os » (astragale percé / fil)
   - Charge level2/3d/astragalus.glb (trous Hole_<face>_<nn>), projette 2D → 24 points
   - Fallback cercle si modèle/ancres absents
   - UI: Mot grec + translittération + indice ; Réinitialiser / Mot suivant / Musique / Stop musique
   - Loader Three tolérant: ne JETTE PAS "examples failed" → simple fallback 2D
*/
(function (global) {
  const { useEffect, useRef, useState } = React;

  // -------- Bus audio partagé --------
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
      // si déjà présent (y compris examples) → OK
      if (global.THREE && global.THREE.GLTFLoader && global.THREE.OrbitControls) return global.THREE;
      // charge three, puis tente controls + loader; si échec => on rendra null (fallback 2D)
      const add=(src)=>new Promise((r)=>(Object.assign(document.createElement("script"),{src,onload:()=>r(true),onerror:()=>r(false)})&&document.head.appendChild(document.scripts[document.scripts.length-1]?.previousSibling||document.head.appendChild(document.createElement('script')))));
    })(); // on remplace ci-dessus par une version robuste juste après pour clarté
    // version robuste claire :
    global.__THREE_PROMISE__ = (async ()=>{
      const add=(src)=>new Promise((res)=>{ const s=document.createElement("script"); s.src=src; s.onload=()=>res(true); s.onerror=()=>res(false); document.head.appendChild(s); });
      async function tryAny(list){ for(const u of list){ if(await add(u)) return true; } return false; }
      const v="0.149.0";
      const core = await tryAny([`https://unpkg.com/three@${v}/build/three.min.js`,`https://cdn.jsdelivr.net/npm/three@${v}/build/three.min.js`]);
      if (!core) return null;
      const okCtrl = await tryAny([`https://unpkg.com/three@${v}/examples/js/controls/OrbitControls.js`,`https://cdn.jsdelivr.net/npm/three@${v}/examples/js/controls/OrbitControls.js`]);
      const okGLTF = await tryAny([`https://unpkg.com/three@${v}/examples/js/loaders/GLTFLoader.js`,`https://cdn.jsdelivr.net/npm/three@${v}/examples/js/loaders/GLTFLoader.js`]);
      if (!(okCtrl && okGLTF)) { console.warn("[L2] Three examples indisponibles → fallback 2D"); return null; }
      return global.THREE;
    })();
    return global.__THREE_PROMISE__;
  }

  // -------- Config --------
  const W=960,H=540;
  const ABASE="/assets/games/osselets/audio/";
  const AU = { music:"game-music-1.mp3", ok:"catch-sound.mp3", bad:"ouch-sound.mp3" };
  const GLB_CANDIDATES=[
    "/assets/games/osselets/level2/3d/astragalus.glb",
    "/assets/games/osselets/level2/astragalus.glb",
    "/assets/games/osselets/3d/astragalus.glb"
  ];
  const FACES=["ventre","dos","bassin","membres"]; // ordre pédagogique (Aristote) :contentReference[oaicite:2]{index=2}
  const GREEK=["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];
  const LATN =["A","B","G","D","E","Z","Ē","Th","I","K","L","M","N","X","O","P","R","S","T","Y","Ph","Ch","Ps","Ō"];
  // petits puzzles par défaut; on peut en ajouter via level2/3d/letters.json
  const PUZ=[ {title:"ΝΙΚΗ",latin:"NIKĒ",seq:[12,8,9,6],tip:"Victoire / souhait propitiatoire."},
              {title:"ΕΛΠΙΣ",latin:"ELPIS",seq:[4,10,15,8,17],tip:"Espoir, présage favorable."},
              {title:"ΤΥΧΗ",latin:"TYCHĒ",seq:[18,19,21,6],tip:"Bonne fortune."} ];

  function wrap(ctx, text, x,y,w,lh){ const words=(text||"").split(/\s+/); let line=""; for(const wd of words){ const t=(line?line+" ":"")+wd; if(ctx.measureText(t).width>w && line){ ctx.fillText(line,x,y); line=wd; y+=lh; } else line=t; } if(line) ctx.fillText(line,x,y); }
  function loadA(f){ try{ const a=new Audio(ABASE+f); a.preload="auto"; return a; }catch{ return null; } }

  function Level2(){
    const hostRef=useRef(null), webglRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);
    const musRef=useRef(null), okRef=useRef(null), badRef=useRef(null);
    const [musicOn,setMusicOn]=useState(true);

    // coupe les autres musiques
    useEffect(()=>{ global.AstragalusAudioBus.stopAll(); },[]);

    // DPR
    const sizeRef=useRef({w:W,h:H,dpr:1});
    useEffect(()=>{
      const cv=canvasRef.current, ctx=cv.getContext("2d"); ctxRef.current=ctx;
      function resize(){
        const w=hostRef.current?.clientWidth||W, h=Math.round(w*(H/W));
        const dpr=Math.max(1,Math.min(2.5,global.devicePixelRatio||1));
        sizeRef.current={w,h,dpr};
        cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        ctx.setTransform(dpr*(w/W),0,0,dpr*(w/W),0,0);
      }
      resize(); const ro=global.ResizeObserver?new ResizeObserver(resize):null; ro?.observe(hostRef.current);
      const onR=()=>resize(); global.addEventListener("resize",onR);
      return ()=>{ ro?.disconnect(); global.removeEventListener("resize",onR); };
    },[]);

    // audio
    useEffect(()=>{
      musRef.current=loadA(AU.music); okRef.current=loadA(AU.ok); badRef.current=loadA(AU.bad);
      if(musRef.current){ musRef.current.loop=true; musRef.current.volume=0.35; global.AstragalusAudioBus.register(musRef.current); musicOn && musRef.current.play().catch(()=>{}); }
      if(okRef.current)  global.AstragalusAudioBus.register(okRef.current);
      if(badRef.current) global.AstragalusAudioBus.register(badRef.current);
      return ()=>{ try{ musRef.current?.pause(); }catch{} };
    },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.muted=!musicOn; if(musicOn){ m.play?.().catch(()=>{});} else m.pause?.(); },[musicOn]);

    // points (trous projetés)
    const holes=useRef([]); // {x,y,label,index}
    function fallbackHoles(){
      const cx=W*0.5, cy=H*0.54, rx=260, ry=120, off=-Math.PI/2; holes.current=[];
      for(let i=0;i<24;i++){ const ring=i%2, t=off+(i/24)*Math.PI*2+(ring?0.08:-0.08), rxf=rx*(ring?0.92:1), ryf=ry*(ring?0.92:1); holes.current.push({x:cx+Math.cos(t)*rxf, y:cy+Math.sin(t)*ryf, label:GREEK[i], index:i}); }
    }

    // 3D + projection
    useEffect(()=>{
      let mounted=true;
      (async()=>{
        const THREE = await ensureThreeSoft(); // peut renvoyer null → fallback
        if(!THREE){ fallbackHoles(); return; }

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
        for(const p of GLB_CANDIDATES){ try{ glb=await loader.loadAsync(p); used=p; break; }catch{} }
        if(!glb){ console.warn("[L2] Aucun GLB — fallback cercle"); fallbackHoles(); return; }
        else console.log("[L2] GLB trous chargé:", used);

        const model=glb.scene; model.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });
        scene.add(model);

        const order=[]; FACES.forEach(face=>{ for(let i=1;i<=6;i++) order.push(`Hole_${face}_${String(i).padStart(2,"0")}`); });
        let anchors = order.map(n=>model.getObjectByName(n));
        if(anchors.some(a=>!a)){ console.warn("[L2] Ancres manquantes → fallback cercle"); fallbackHoles(); anchors=[]; }

        const v=new THREE.Vector3();
        function loop(){
          if(!mounted) return;
          ctrls.update(); renderer.render(scene,camera);
          if(anchors.length===24){
            const {w,h}=sizeRef.current, sx=W/w, sy=H/h;
            holes.current = anchors.map((n,i)=>{ n.getWorldPosition(v); v.project(camera); const px=(v.x*0.5+0.5)*w, py=(-v.y*0.5+0.5)*h; return {x:px*sx, y:py*sy, label:GREEK[i], index:i}; });
          } else if (holes.current.length!==24){ fallbackHoles(); }
          requestAnimationFrame(loop);
        }
        loop();

        const onR=()=>resize3d(); global.addEventListener("resize",onR);
        return ()=>{ global.removeEventListener("resize",onR); renderer.dispose(); };
      })();
      return ()=>{ mounted=false; };
    },[]);

    // puzzles (peut lire level2/3d/letters.json si dispo pour surcharger)
    const [puz,setPuz]=useState(PUZ[0]);
    useEffect(()=>{ (async()=>{
      try{
        const r=await fetch("/assets/games/osselets/level2/3d/letters.json",{cache:"no-store"});
        if(r.ok){ const j=await r.json().catch(()=>null); if(j?.puzzles?.length){ setPuz(j.puzzles[0]); } }
      }catch{}
    })(); },[]);

    function nextWord(){
      try{ okRef.current && (okRef.current.currentTime=0, okRef.current.play().catch(()=>{})); }catch{}
      setPuz(prev=>{
        const i=Math.max(0, PUZ.findIndex(p=>p.title===prev.title));
        return PUZ[(i+1)%PUZ.length];
      });
    }

    // rendu 2D
    useEffect(()=>{
      const ctx=ctxRef.current; let raf;
      function render(){
        const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0b2334"); g.addColorStop(1,"#0a1b2a");
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

        // tapis / zones
        ctx.fillStyle="#0e2a44"; ctx.fillRect(0, H-120, W, 120);
        ctx.fillStyle="#cfe2ff"; ctx.font="18px system-ui,Segoe UI,Roboto,Arial";
        ctx.fillText("Écrire avec les os — Fil & trous (24 lettres / 4 faces opposées)", 16, 28);
        ctx.font="16px system-ui,Segoe UI,Roboto,Arial";
        ctx.fillText("Règle : entrer par un trou d’une face et ressortir par le **même numéro** sur la face **opposée**.", 16, 50);

        // points / lettres
        const pts=holes.current;
        for(const h of pts){
          ctx.beginPath(); ctx.arc(h.x, h.y, 10, 0, Math.PI*2); ctx.fillStyle="#103a5f"; ctx.fill(); ctx.strokeStyle="#1c5a8d"; ctx.lineWidth=2; ctx.stroke();
          ctx.fillStyle="#e6f1ff"; ctx.font="14px system-ui,Segoe UI,Roboto,Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(h.label, h.x, h.y);
        }

        // fil (chemin du mot)
        if(Array.isArray(puz?.seq)){
          ctx.beginPath();
          for(let i=0;i<puz.seq.length;i++){
            const h=pts[puz.seq[i]]; if(!h) continue;
            (i===0)?ctx.moveTo(h.x,h.y):ctx.lineTo(h.x,h.y);
          }
          ctx.strokeStyle="#7dd3fc"; ctx.lineWidth=3; ctx.stroke();
        }

        // cartouche mot
        ctx.textAlign="left"; ctx.textBaseline="alphabetic"; ctx.fillStyle="#cfe2ff";
        ctx.font="22px system-ui,Segoe UI,Roboto,Arial"; ctx.fillText(`Mot : ${puz?.title||"—"}  (${puz?.latin||"—"})`, 16, H-78);
        ctx.font="16px system-ui,Segoe UI,Roboto,Arial"; wrap(ctx, `Indice : ${puz?.tip||"—"}`, 16, H-52, W-32, 18);

        raf=requestAnimationFrame(render);
      }
      render();
      return ()=>cancelAnimationFrame(raf);
    },[puz]);

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", border:"1px solid #224", borderRadius:"12px", overflow:"hidden"}}>
        <div ref={webglRef} aria-hidden="true" style={{position:"absolute", inset:0}} />
        <canvas ref={canvasRef} width={W} height={H} aria-label="Écrire avec les os" />
        <div style={{position:"absolute", inset:"auto 12px 12px auto", display:"flex", gap:"8px", flexWrap:"wrap"}}>
          <button className="btn" onClick={()=>setPuz(PUZ[0])}>Réinitialiser</button>
          <button className="btn" onClick={nextWord}>Mot suivant</button>
          <button className="btn" onClick={()=>setMusicOn(v=>!v)}>Musique: {musicOn?"ON":"OFF"}</button>
          <button className="btn" onClick={()=>{ try{ global.AstragalusAudioBus.stopAll(); }catch{} }}>Stop musique</button>
        </div>
      </div>
    );
  }

  function mountL2(){
    const el=document.getElementById("osselets-level2"); if(!el) return;
    ReactDOM.createRoot(el).render(React.createElement(Level2));
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", mountL2);
  else mountL2();

})(window);
