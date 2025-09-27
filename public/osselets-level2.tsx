(function (global) {
  const { useEffect, useRef, useState } = React;

  /* Musique unique globale */
  function claimGlobalMusic(aud){ const w=window; w.__OSSELETS_MUS__=w.__OSSELETS_MUS__||{current:null}; try{ if(w.__OSSELETS_MUS__.current && w.__OSSELETS_MUS__.current!==aud) w.__OSSELETS_MUS__.current.pause(); }catch{} w.__OSSELETS_MUS__.current=aud; }

  // public/osselets-level2.tsx
  const L2_W = 960, L2_H = 540;

  const L2_AUDIO_BASE = "/assets/games/osselets/audio/";
  const L2_AUDIO = { music:"game-music-1.mp3", ok:"catch-sound.mp3", bad:"ouch-sound.mp3" };

  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];
  const GREEK_LATIN = ["A","B","G","D","E","Z","Ē","Th","I","K","L","M","N","X","O","P","R","S","T","Y","Ph","Ch","Ps","Ō"];
  const PUZZLES = [
    { title:"ΝΙΚΗ", latin:"NIKĒ", seq:[12,8,9,6], tip:"Victoire : gravé sur des astragales, lié à la chance/protection." },
    { title:"ΕΛΠΙΣ", latin:"ELPIS", seq:[4,10,15,8,17], tip:"Espoir : message positif porté par l’amulette." },
    { title:"ΤΥΧΗ", latin:"TYCHĒ", seq:[18,19,21,6], tip:"Bonne fortune : souhait propitiatoire." }
  ];

  function l2LoadAudio(src){ try{ const a=new Audio(L2_AUDIO_BASE+src); a.preload="auto"; return a; }catch{return null;} }
  function l2Wrap(ctx,text,x,y,maxW,lh){ const w=text.split(/\s+/); let line=""; for(let i=0;i<w.length;i++){ const t=(line?line+" ":"")+w[i]; if(ctx.measureText(t).width>maxW && line){ ctx.fillText(line,x,y); line=w[i]; y+=lh; } else line=t; } if(line) ctx.fillText(line,x,y); }

  function AstragalusLevel2(){
    const hostRef=useRef(null); const canvasRef=useRef(null); const ctxRef=useRef(null);

    // Audio
    const musRef=useRef(null); const sOkRef=useRef(null); const sBadRef=useRef(null);
    const [musicOn,setMusicOn]=useState(true);
    useEffect(()=>{ musRef.current=l2LoadAudio(L2_AUDIO.music); sOkRef.current=l2LoadAudio(L2_AUDIO.ok); sBadRef.current=l2LoadAudio(L2_AUDIO.bad); },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.loop=true; m.volume=0.35; m.muted=!musicOn; if(musicOn){ claimGlobalMusic(m); m.play().catch(()=>{});} else m.pause(); },[musicOn]);
    useEffect(()=>()=>{ try{ if(musRef.current && (window.__OSSELETS_MUS__?.current===musRef.current)) musRef.current.pause(); }catch{} },[]);

    // DPR/responsive
    useEffect(()=>{ const cv=canvasRef.current, ctx=cv.getContext("2d"); ctxRef.current=ctx;
      function resize(){ const w=hostRef.current?.clientWidth||L2_W, h=Math.round(w*(L2_H/L2_W)), dpr=Math.max(1,Math.min(2.5,window.devicePixelRatio||1)); cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); cv.style.width=w+"px"; cv.style.height=h+"px"; ctx.setTransform(dpr*(w/L2_W),0,0,dpr*(w/L2_W),0,0); }
      resize(); const ro=new ResizeObserver(resize); hostRef.current && ro.observe(hostRef.current); window.addEventListener("resize",resize);
      return ()=>{ ro.disconnect(); window.removeEventListener("resize",resize); };
    },[]);

    // géométrie trous
    const holes=useRef([]); function recompute(){ const cx=L2_W*0.5, cy=L2_H*0.54, rx=260, ry=120, off=-Math.PI/2; holes.current=[]; for(let i=0;i<24;i++){ const ring=i%2, t=off+(i/24)*Math.PI*2+(ring?0.08:-0.08); const rxf=rx*(ring?0.92:1), ryf=ry*(ring?0.92:1); holes.current.push({x:cx+Math.cos(t)*rxf,y:cy+Math.sin(t)*ryf,label:GREEK[i],index:i}); } }
    useEffect(()=>{ recompute(); },[]);

    // puzzle state
    const [pIndex,setPIndex]=useState(0); const cur=()=>PUZZLES[pIndex];
    const progress=useRef(0); const pathPts=useRef([]); const [toast,setToast]=useState<string|null>("Trace le fil en suivant les lettres : "+cur().title+" ("+cur().latin+")"); const [done,setDone]=useState(false);

    // interaction
    const dragging=useRef(false); const dragPt=useRef(null);
    function holeAt(x:number,y:number){ return holes.current.find(h=> (x-h.x)**2+(y-h.y)**2 <= 18*18 ); }
    useEffect(()=>{ const cv=canvasRef.current;
      function XY(ev:PointerEvent){ const r=cv.getBoundingClientRect(); return {x:(ev.clientX-r.left)*(L2_W/r.width), y:(ev.clientY-r.top)*(L2_H/r.height)}; }
      const onDown=(ev:PointerEvent)=>{ ev.preventDefault(); if(done) return; const {x,y}=XY(ev); const h=holeAt(x,y); if(!h) return; const need=cur().seq[0]; if(progress.current===0 && h.index===need){ dragging.current=true; dragPt.current={x:h.x,y:h.y}; pathPts.current=[{x:h.x,y:h.y}]; setToast("Bien ! Maintenant : "+GREEK[cur().seq[1]]+" ("+GREEK_LATIN[cur().seq[1]]+")"); } };
      const onMove=(ev:PointerEvent)=>{ if(!dragging.current||done) return; const {x,y}=XY(ev); dragPt.current={x,y}; };
      const onUp=(ev:PointerEvent)=>{ if(!dragging.current||done) return; const {x,y}=XY(ev); const h=holeAt(x,y), seq=cur().seq, step=progress.current;
        if(h && h.index===seq[step+1]){ pathPts.current.push({x:h.x,y:h.y}); progress.current++; try{ sOkRef.current && (sOkRef.current.currentTime=0, sOkRef.current.play()); }catch{} if(progress.current===seq.length-1){ dragging.current=false; dragPt.current=null; setDone(true); setToast("Bravo ! Tu as écrit « "+cur().title+" » ("+cur().latin+")."); } else setToast("OK. Suivant : "+GREEK[seq[step+2]]+" ("+GREEK_LATIN[seq[step+2]]+")"); }
        else { try{ sBadRef.current && (sBadRef.current.currentTime=0, sBadRef.current.play()); }catch{} setToast("Essaie encore : cherche "+GREEK[seq[step+1]]+" ("+GREEK_LATIN[seq[step+1]]+")."); }
      };
      cv.addEventListener("pointerdown",onDown); cv.addEventListener("pointermove",onMove); window.addEventListener("pointerup",onUp);
      return ()=>{ cv.removeEventListener("pointerdown",onDown); cv.removeEventListener("pointermove",onMove); window.removeEventListener("pointerup",onUp); };
    },[pIndex,done]);

    function resetPuzzle(nextIdx=pIndex){ progress.current=0; pathPts.current.length=0; dragging.current=false; dragPt.current=null; setDone(false); setPIndex(nextIdx); setToast("Trace le fil : "+PUZZLES[nextIdx].title+" ("+PUZZLES[nextIdx].latin+")"); }

    // loop
    useEffect(()=>{ const ctx=ctxRef.current; let raf:number;
      function draw(){ ctx.clearRect(0,0,L2_W,L2_H);
        const g=ctx.createLinearGradient(0,0,0,L2_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0"); ctx.fillStyle=g; ctx.fillRect(0,0,L2_W,L2_H);
        ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui"; ctx.fillText("Niveau 2 — Écrire avec les os",16,28);
        drawAstra(ctx); drawHoles(ctx); drawThread(ctx); drawLegend(ctx);
        raf=requestAnimationFrame(draw);
      }
      function drawAstra(ctx){ const cx=L2_W*0.5,cy=L2_H*0.54,rx=280,ry=140; ctx.save(); ctx.fillStyle="rgba(0,0,0,.08)"; ctx.beginPath(); ctx.ellipse(cx,cy+14,rx*0.95,ry*0.6,0,0,Math.PI*2); ctx.fill(); const grd=ctx.createLinearGradient(cx-rx,cy-ry,cx+rx,cy+ry); grd.addColorStop(0,"#fefce8"); grd.addColorStop(1,"#fde68a"); ctx.fillStyle=grd; ctx.strokeStyle="#eab308"; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1.5; ctx.globalAlpha=.35; ctx.beginPath(); ctx.ellipse(cx,cy,rx*0.86,ry*0.82,0,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx,cy,rx*0.68,ry*0.64,0,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; ctx.restore(); }
      function drawHoles(ctx){ ctx.save(); for(const h of holes.current){ ctx.fillStyle="#111827"; ctx.beginPath(); ctx.arc(h.x,h.y,10,0,Math.PI*2); ctx.fill(); ctx.strokeStyle="#fde68a"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(h.x,h.y,14,0,Math.PI*2); ctx.stroke(); ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(h.label,h.x,h.y-18); } ctx.restore(); }
      function drawThread(ctx){ if(!pathPts.current.length) return; ctx.save(); ctx.lineWidth=4; ctx.strokeStyle="#10b981"; ctx.beginPath(); ctx.moveTo(pathPts.current[0].x,pathPts.current[0].y); for(let i=1;i<pathPts.current.length;i++) ctx.lineTo(pathPts.current[i].x,pathPts.current[i].y); if(dragPt.current) ctx.lineTo(dragPt.current.x,dragPt.current.y); ctx.stroke(); ctx.restore(); const a=pathPts.current[0], b=pathPts.current[pathPts.current.length-1]; if(a){ ctx.fillStyle="#059669"; ctx.beginPath(); ctx.arc(a.x,a.y,6,0,Math.PI*2); ctx.fill(); } if(b){ ctx.fillStyle="#34d399"; ctx.beginPath(); ctx.arc(b.x,b.y,6,0,Math.PI*2); ctx.fill(); } }
      const zones=useRef([]); function drawBtn(ctx,x,y,w,h,label,cb){ ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label,x+w/2,y+h/2+1); zones.current.push({x,y,w,h,cb}); }
      function drawLegend(ctx){ ctx.save(); ctx.fillStyle="#fff"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2; ctx.fillRect(16,L2_H-140,L2_W-32,124); ctx.strokeRect(16,L2_H-140,L2_W-32,124); ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui"; l2Wrap(ctx, (toast||""), 26,L2_H-112,L2_W-52,18); ctx.fillStyle="#111827"; ctx.fillRect(L2_W-180,L2_H-136,160,24); ctx.fillStyle="#fff"; ctx.font="12px ui-sans-serif, system-ui"; ctx.fillText("Mot : "+cur().title+" ("+cur().latin+")",L2_W-172,L2_H-119); drawBtn(ctx,22,L2_H-44,150,32,"Réinitialiser",()=>resetPuzzle(pIndex)); drawBtn(ctx,182,L2_H-44,150,32,"Mot suivant",()=>resetPuzzle((pIndex+1)%PUZZLES.length)); drawBtn(ctx,342,L2_H-44,170,32, musicOn?"Musique ON":"Musique OFF", ()=>setMusicOn(v=>!v)); if(done) drawBtn(ctx,L2_W-170,L2_H-44,150,32,"Poursuivre →",()=>resetPuzzle((pIndex+1)%PUZZLES.length)); ctx.restore(); ctx.fillStyle="#64748b"; ctx.font="12px ui-sans-serif, system-ui"; l2Wrap(ctx,"Indice : "+cur().tip,26,L2_H-62,L2_W-200,16); }
      const el=canvasRef.current; const zonesRef=zones; function onClick(ev:MouseEvent){ const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L2_W/r.width), my=(ev.clientY-r.top)*(L2_H/r.height); const z=zonesRef.current.find(z=> mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h); zonesRef.current.length=0; if(z) z.cb(); }
      el.addEventListener("click",onClick);
      draw(); return ()=>{ cancelAnimationFrame(raf); el.removeEventListener("click",onClick); };
    },[pIndex,done,musicOn]);

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
        <canvas ref={canvasRef}/>
      </div>
    );
  }

  // @ts-ignore
  (window as any).AstragalusLevel2 = AstragalusLevel2;
  global.AstragalusLevel2 = global.AstragalusLevel2 || AstragalusLevel2;
})(window);
