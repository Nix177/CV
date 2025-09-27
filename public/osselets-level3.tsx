(function (global) {
  const { useEffect, useRef, useState } = React;

  /* Musique unique globale */
  function claimGlobalMusic(aud){ const w=window; w.__OSSELETS_MUS__=w.__OSSELETS_MUS__||{current:null}; try{ if(w.__OSSELETS_MUS__.current && w.__OSSELETS_MUS__.current!==aud) w.__OSSELETS_MUS__.current.pause(); }catch{} w.__OSSELETS_MUS__.current=aud; }

  // public/osselets-level3.tsx
  const L3_W = 960, L3_H = 540;

  const L3_AUDIO_BASE = "/assets/games/osselets/audio/";
  const L3_AUDIO = { music:"game-music-1.mp3", good:"catch-sound.mp3", bad:"ouch-sound.mp3" };

  // éventuellement présent :
  const GLB_CANDIDATES = [
    "/assets/games/osselets/3d/astragalus.glb",
    "/assets/games/osselets/level3/3d/astragalus.glb"
  ];

  function rand(arr){ return arr[(Math.random()*arr.length)|0]; }

  function AstragalusLevel3(){
    const hostRef=useRef(null); const canvasRef=useRef(null); const ctxRef=useRef(null);

    // pause toute musique HTML d’un autre niveau (tags marqués)
    useEffect(()=>{ document.querySelectorAll('audio[data-osselets-mus]').forEach(a=>{ try{ a.pause(); }catch{} }); },[]);

    // DPR
    useEffect(()=>{ const cv=canvasRef.current, ctx=cv.getContext("2d"); ctxRef.current=ctx;
      function resize(){ const w=hostRef.current?.clientWidth||L3_W, h=Math.round(w*(L3_H/L3_W)), dpr=Math.max(1,Math.min(2.5,window.devicePixelRatio||1)); cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); cv.style.width=w+"px"; cv.style.height=h+"px"; ctx.setTransform(dpr*(w/L3_W),0,0,dpr*(w/L3_W),0,0); }
      resize(); const ro=new ResizeObserver(resize); hostRef.current && ro.observe(hostRef.current); window.addEventListener("resize",resize);
      return ()=>{ ro.disconnect(); window.removeEventListener("resize",resize); };
    },[]);

    // Audio
    const musRef=useRef(null), goodRef=useRef(null), badRef=useRef(null);
    const [musicOn,setMusicOn]=useState(true);
    useEffect(()=>{ try{ musRef.current=new Audio(L3_AUDIO_BASE+L3_AUDIO.music); goodRef.current=new Audio(L3_AUDIO_BASE+L3_AUDIO.good); badRef.current=new Audio(L3_AUDIO_BASE+L3_AUDIO.bad);}catch{} },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.loop=true; m.volume=0.35; m.muted=!musicOn; if(musicOn){ claimGlobalMusic(m); m.play().catch(()=>{});} else m.pause(); },[musicOn]);
    useEffect(()=>()=>{ try{ if(musRef.current && (window.__OSSELETS_MUS__?.current===musRef.current)) musRef.current.pause(); }catch{} },[]);

    // État jeu
    const [mode,setMode]=useState("jeu"); // "jeu" | "oracle"
    const [rolls,setRolls]=useState([6,4,3,1]);
    const [throwing,setThrowing]=useState(false);
    const [score,setScore]=useState(0);
    const [lastLabel,setLastLabel]=useState("—");
    const [lastMeaning,setLastMeaning]=useState("");

    // 3D viewer (optionnel)
    const [glbUrl,setGlbUrl]=useState<string|null>(null);
    useEffect(()=>{ // charge le web-component <model-viewer>
      if(!customElements.get("model-viewer")){
        const s=document.createElement("script"); s.type="module";
        s.src="https://cdn.jsdelivr.net/npm/@google/model-viewer@3.4.0/dist/model-viewer.min.js";
        document.head.appendChild(s);
      }
      // choisis un GLB si présent (on laisse l’élément gérer l’erreur d’affichage)
      for(const url of GLB_CANDIDATES){ setGlbUrl(url); break; }
    },[]);

    function doRoll(){
      if(throwing) return;
      setThrowing(true);
      const start=performance.now(), dur=700;
      const tick=()=>{ const t=performance.now()-start;
        setRolls([rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6])]);
        if(t<dur) requestAnimationFrame(tick);
        else { const final=[rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6])]; setRolls(final);
          const cat=categorize(final); setLastLabel(cat.label); setLastMeaning(cat.meaning);
          if(mode==="jeu"){ setScore(s=>s+cat.points); try{ (cat.points>0?goodRef:badRef).current?.play(); }catch{} }
          setThrowing(false);
        }
      }; tick();
    }
    function categorize(v:number[]){ const s=[...v].sort((a,b)=>a-b).join("-"); const c:any={}; v.forEach(x=>c[x]=(c[x]||0)+1); const uniq=Object.keys(c).length;
      if(s==="1-3-4-6") return {label:"Vénus",points:10,meaning:"Lancer parfait : harmonie des contraires, réussite."};
      if(s==="1-1-1-1") return {label:"Canis",points:0, meaning:"Le ‘chien’ : échec sur ce coup, persévère."};
      if((c[6]||0)>=2) return {label:"Senio",points:5, meaning:"Signe fort : « six » dominant, avantage."};
      if(Object.values(c).some((n:any)=>n===3)) return {label:"Trina",points:3, meaning:"Trois faces identiques : stabilité, mais rigide."};
      if(uniq===2 && Object.values(c).every((n:any)=>n===2)) return {label:"Bina",points:4, meaning:"Deux paires : équilibre fragile, opportunité."};
      return {label:"Simple",points:1, meaning:"Lecture modérée : avance, observe le prochain tir."};
    }

    // render
    useEffect(()=>{ const ctx=ctxRef.current!; let raf:number;
      function render(){ ctx.clearRect(0,0,L3_W,L3_H);
        const g=ctx.createLinearGradient(0,0,0,L3_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0"); ctx.fillStyle=g; ctx.fillRect(0,0,L3_W,L3_H);
        ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui"; ctx.fillText("Niveau 3 — Rouler les os",16,28);
        ctx.fillStyle="#0b3b2e"; ctx.fillRect(16,44,L3_W-32,300); ctx.strokeStyle="#14532d"; ctx.lineWidth=6; ctx.strokeRect(16,44,L3_W-32,300);
        for(let i=0;i<4;i++){ const cx=120+i*((L3_W-240)/3); drawDie(ctx,cx,190,rolls[i],throwing); }
        drawPanel(ctx);
        raf=requestAnimationFrame(render);
      }
      function drawDie(ctx,cx,cy,val,shaking){ ctx.save(); const rx=46,ry=26; ctx.fillStyle="rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(cx,cy+ry+12,rx*0.9,ry*0.6,0,0,Math.PI*2); ctx.fill();
        const jit=shaking?(Math.random()*3-1.5):0; ctx.translate(jit,jit); const grd=ctx.createLinearGradient(cx-rx,cy-ry,cx+rx,cy+ry); grd.addColorStop(0,"#fefce8"); grd.addColorStop(1,"#fde68a"); ctx.fillStyle=grd; ctx.strokeStyle="#eab308"; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle="#0f172a"; const dot=(dx,dy)=>{ ctx.beginPath(); ctx.arc(cx+dx,cy+dy,4,0,Math.PI*2); ctx.fill(); }; if(val===1){dot(0,0);} if(val===3){dot(-10,-8);dot(0,0);dot(10,8);} if(val===4){dot(-12,-8);dot(12,-8);dot(-12,8);dot(12,8);} if(val===6){dot(-14,-10);dot(0,-10);dot(14,-10);dot(-14,10);dot(0,10);dot(14,10);} ctx.restore(); }
      const zones=useRef([]); function drawBtn(ctx,x,y,w,h,label,cb){ ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label,x+w/2,y+h/2+1); zones.current.push({x,y,w,h,cb}); }
      function wrap(ctx,text,x,y,maxW,lh){ const ws=text.split(/\s+/); let line=""; for(let i=0;i<ws.length;i++){ const t=(line?line+" ":"")+ws[i]; if(ctx.measureText(t).width>maxW && line){ ctx.fillText(line,x,y); line=ws[i]; y+=lh; } else line=t; } if(line) ctx.fillText(line,x,y); }
      function drawPanel(ctx){ const x=L3_W-300,y=44,w=284,h=300; ctx.save(); ctx.fillStyle="#fff"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
        drawBtn(ctx,x+12,y+12,120,30,"Mode: Jeu",()=>setMode("jeu")); drawBtn(ctx,x+142,y+12,130,30,"Mode: Oracle",()=>setMode("oracle"));
        drawBtn(ctx,x+12,y+54,120,36,throwing?"• • •":"Lancer",()=>doRoll()); drawBtn(ctx,x+142,y+54,130,36, musicOn?"Musique ON":"Musique OFF",()=>setMusicOn(v=>!v));
        ctx.fillStyle="#0f172a"; ctx.font="16px ui-sans-serif, system-ui"; ctx.fillText("Résultat :",x+12,y+112); ctx.font="32px ui-sans-serif, system-ui"; ctx.fillStyle="#111827"; ctx.fillText(lastLabel,x+12,y+148);
        ctx.font="12px ui-sans-serif, system-ui"; ctx.fillStyle="#334155"; wrap(ctx,(mode==="oracle"?lastMeaning:"Score : "+score+" pts"),x+12,y+176,w-24,16);
        ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; wrap(ctx,"Exemples : Vénus=1·3·4·6 / Canis=4×1 / Senio=≥2×6 / Bina=deux paires / Trina=triple / Simple=autres.", x+12,y+h-68,w-24,16);
        ctx.restore();
      }
      const el=canvasRef.current; function onClick(ev){ const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L3_W/r.width), my=(ev.clientY-r.top)*(L3_H/r.height); const z=zones.current.find(z=>mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h); zones.current.length=0; if(z) z.cb(); }
      el.addEventListener("click",onClick);
      render(); return ()=>{ cancelAnimationFrame(raf); el.removeEventListener("click",onClick); };
    },[rolls,throwing,mode,lastLabel,lastMeaning,score,musicOn]);

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
        {/* Aperçu 3D (optionnel) */}
        {glbUrl && (
          // @ts-ignore web component
          <model-viewer
            src={glbUrl}
            style={{position:"absolute", right:8, top:8, width:260, height:160, background:"#0b1320", border:"1px solid #163b62", borderRadius:8}}
            camera-controls
            auto-rotate
            ar
            exposure="1.1"
            shadow-intensity="0.6"
            onError={(e:any)=>{ (e.currentTarget as any).style.display="none"; }}
          ></model-viewer>
        )}
        <canvas ref={canvasRef}/>
      </div>
    );
  }

  // @ts-ignore
  (window as any).AstragalusLevel3 = AstragalusLevel3;
  global.AstragalusLevel3 = global.AstragalusLevel3 || AstragalusLevel3;
})(window);
