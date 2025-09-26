(function (global) {
  const { useEffect, useRef, useState } = React;
// public/osselets-level3.tsx
// Niveau 3 — « Rouler les os » : lancers d’astragales (jeu + oracle)

/* ---------- Config ---------- */
const L3_W = 960, L3_H = 540;

/* ---------- Audio (optionnels) ---------- */
const L3_AUDIO_BASE = "/assets/games/osselets/audio/";
const L3_AUDIO = {
  music: "game-music-1.mp3",
  good:  "catch-sound.mp3",
  bad:   "ouch-sound.mp3"
};

function rand<T>(arr:T[]) { return arr[(Math.random()*arr.length)|0]; }

function AstragalusLevel3(){
  const hostRef = useRef<HTMLDivElement|null>(null);
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D|null>(null);

  // DPR / responsive
  useEffect(()=>{
    const cv=canvasRef.current!, ctx=cv.getContext("2d")!;
    ctxRef.current=ctx;
    function resize(){
      const w = hostRef.current?.clientWidth || L3_W;
      const h = Math.round(w*(L3_H/L3_W));
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio||1));
      cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
      cv.style.width=w+"px"; cv.style.height=h+"px";
      ctx.setTransform(dpr*(w/L3_W),0,0,dpr*(w/L3_W),0,0);
    }
    resize(); const ro=new ResizeObserver(resize); hostRef.current && ro.observe(hostRef.current);
    window.addEventListener("resize",resize);
    return ()=>{ ro.disconnect(); window.removeEventListener("resize",resize); };
  },[]);

  // Audio
  const musRef = useRef<HTMLAudioElement|null>(null);
  const goodRef= useRef<HTMLAudioElement|null>(null);
  const badRef = useRef<HTMLAudioElement|null>(null);
  const [musicOn,setMusicOn]=useState(true);
  useEffect(()=>{ try{ musRef.current=new Audio(L3_AUDIO_BASE+L3_AUDIO.music); goodRef.current=new Audio(L3_AUDIO_BASE+L3_AUDIO.good); badRef.current=new Audio(L3_AUDIO_BASE+L3_AUDIO.bad);}catch{} },[]);
  useEffect(()=>{ const m=musRef.current; if(!m) return; m.loop=true; m.volume=0.35; m.muted=!musicOn; if(musicOn) m.play().catch(()=>{}); else m.pause(); },[musicOn]);

  // État
  const [mode,setMode] = useState<"jeu"|"oracle">("jeu");
  const [rolls,setRolls] = useState<number[]>([6,4,3,1]);
  const [throwing,setThrowing] = useState(false);
  const [score,setScore] = useState(0);
  const [lastLabel,setLastLabel] = useState("—");
  const [lastMeaning,setLastMeaning] = useState<string>("");

  // Lancer (animation courte)
  function doRoll(){
    if (throwing) return;
    setThrowing(true);
    const start=performance.now(); const dur=700;
    const tick=()=>{
      const t=performance.now()-start;
      setRolls([rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6])]);
      if (t<dur) requestAnimationFrame(tick);
      else {
        const final = [rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6]),rand([1,3,4,6])];
        setRolls(final); const cat = categorize(final); setLastLabel(cat.label); setLastMeaning(cat.meaning);
        if (mode==="jeu"){
          setScore(s=>s + cat.points);
          if (cat.points>0) try{ goodRef.current?.play(); }catch{}
          else try{ badRef.current?.play(); }catch{}
        }
        setThrowing(false);
      }
    };
    tick();
  }

  // Catégories simplifiées
  function categorize(v:number[]){
    const s = [...v].sort((a,b)=>a-b).join("-");
    const counts:Record<number,number> = {};
    v.forEach(x=>{counts[x]=(counts[x]||0)+1;});
    const uniq = Object.keys(counts).length;

    // Vénus (1,3,4,6 une fois chacun)
    if (s==="1-3-4-6") return { label:"Vénus", points: 10, meaning:"Lancer parfait : harmonie des contraires, réussite." };

    // Canis (les 4 sur 1)
    if (s==="1-1-1-1") return { label:"Canis", points: 0, meaning:"Le ‘chien’ : échec sur ce coup, persévère." };

    // Senio (plusieurs 6)
    if ((counts[6]||0) >= 2) return { label:"Senio", points: 5, meaning:"Signe fort : ‘six’ dominant, avantage." };

    // Trina (un triple)
    if (Object.values(counts).some(c=>c===3)) return { label:"Trina", points: 3, meaning:"Trois faces identiques : stabilité, mais rigide." };

    // Bina (deux paires)
    if (uniq===2 && Object.values(counts).every(c=>c===2)) return { label:"Bina", points: 4, meaning:"Deux paires : équilibre fragile, opportunité." };

    // Simple (autres)
    return { label:"Simple", points: 1, meaning:"Lecture modérée : avance, observe le prochain tir." };
  }

  // Render loop
  useEffect(()=>{
    const ctx = ctxRef.current!; let raf:number;
    function render(){
      ctx.clearRect(0,0,L3_W,L3_H);
      // fond
      const g=ctx.createLinearGradient(0,0,0,L3_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
      ctx.fillStyle=g; ctx.fillRect(0,0,L3_W,L3_H);

      // titre
      ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui";
      ctx.fillText("Niveau 3 — Rouler les os", 16, 28);

      // tapis
      ctx.fillStyle="#0b3b2e"; ctx.fillRect(16, 44, L3_W-32, 300);
      ctx.strokeStyle="#14532d"; ctx.lineWidth=6; ctx.strokeRect(16, 44, L3_W-32, 300);

      // dessiner 4 astragales stylisés
      for(let i=0;i<4;i++){
        const cx = 120 + i*((L3_W-240)/3);
        drawAstragalusDie(ctx, cx, 190, rolls[i], throwing);
      }

      // panneau droite
      drawPanel(ctx);

      raf=requestAnimationFrame(render);
    }
    raf=requestAnimationFrame(render);
    return ()=> cancelAnimationFrame(raf);
  },[rolls,throwing,mode,lastLabel,lastMeaning,score,musicOn]);

  function drawAstragalusDie(ctx:CanvasRenderingContext2D, cx:number, cy:number, val:number, shaking:boolean){
    ctx.save();
    const rx=46, ry=26;
    // ombre
    ctx.fillStyle="rgba(0,0,0,.18)";
    ctx.beginPath(); ctx.ellipse(cx, cy+ry+12, rx*0.9, ry*0.6, 0, 0, Math.PI*2); ctx.fill();

    // corps os
    const jitter = shaking ? (Math.random()*3-1.5) : 0;
    ctx.translate(jitter, jitter);
    const grd=ctx.createLinearGradient(cx-rx,cy-ry,cx+rx,cy+ry);
    grd.addColorStop(0,"#fefce8"); grd.addColorStop(1,"#fde68a");
    ctx.fillStyle=grd; ctx.strokeStyle="#eab308"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill(); ctx.stroke();

    // face / marque (stylisation 1,3,4,6)
    ctx.fillStyle="#0f172a";
    const dot=(dx:number,dy:number)=>{ ctx.beginPath(); ctx.arc(cx+dx,cy+dy,4,0,Math.PI*2); ctx.fill(); };
    if (val===1) { dot(0,0); }
    if (val===3) { dot(-10,-8); dot(0,0); dot(10,8); }
    if (val===4) { dot(-12,-8); dot(12,-8); dot(-12,8); dot(12,8); }
    if (val===6) { dot(-14,-10); dot(0,-10); dot(14,-10); dot(-14,10); dot(0,10); dot(14,10); }

    ctx.restore();
  }

  // Panneau de droite (contrôles)
  const zones = useRef<{x:number,y:number,w:number,h:number,cb:()=>void}[]>([]);
  useEffect(()=>{
    const el = canvasRef.current!;
    function onClick(ev:MouseEvent){
      const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L3_W/r.width), my=(ev.clientY-r.top)*(L3_H/r.height);
      const z = zones.current.find(z=> mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h);
      zones.current.length=0;
      if (z) z.cb();
    }
    el.addEventListener("click", onClick);
    return ()=> el.removeEventListener("click", onClick);
  },[]);

  function drawPanel(ctx:CanvasRenderingContext2D){
    const x=L3_W-300, y=44, w=284, h=300;
    ctx.save();
    ctx.fillStyle="#ffffff"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2;
    ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);

    // mode
    drawBtn(ctx, x+12,y+12, 120,30, mode==="jeu"?"Mode: Jeu":"Mode: Jeu", ()=> setMode("jeu"));
    drawBtn(ctx, x+142,y+12, 130,30, mode==="oracle"?"Mode: Oracle":"Mode: Oracle", ()=> setMode("oracle"));

    // lancer / musique
    drawBtn(ctx, x+12,y+54, 120,36, throwing?"• • •":"Lancer", ()=> doRoll());
    drawBtn(ctx, x+142,y+54, 130,36, musicOn?"Musique ON":"Musique OFF", ()=> setMusicOn(v=>!v));

    // résultat
    ctx.fillStyle="#0f172a"; ctx.font="16px ui-sans-serif, system-ui";
    ctx.fillText("Résultat :", x+12, y+112);
    ctx.font="32px ui-sans-serif, system-ui"; ctx.fillStyle="#111827";
    ctx.fillText(lastLabel, x+12, y+148);

    // interprétation / score
    ctx.font="12px ui-sans-serif, system-ui"; ctx.fillStyle="#334155";
    wrap(ctx, (mode==="oracle" ? lastMeaning : "Score : "+score+" pts"), x+12, y+176, w-24, 16);

    // rappel combinaisons
    ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui";
    wrap(ctx, "Exemples (simplifiés) : Vénus=1·3·4·6 / Canis=4×1 / Senio=≥2 faces 6 / Bina=deux paires / Trina=triple / Simple=autres.", x+12, y+h-68, w-24, 16);
    ctx.restore();
  }
  function drawBtn(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,label:string,cb:()=>void){
    ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5;
    ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
    ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(label, x+w/2, y+h/2+1);
    zones.current.push({x,y,w,h,cb});
  }
  function wrap(ctx:CanvasRenderingContext2D, text:string, x:number,y:number,maxW:number,lh:number){
    const words=text.split(/\s+/); let line=""; for(let i=0;i<words.length;i++){
      const test=(line?line+" ":"")+words[i]; if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line,x,y); line=words[i]; y+=lh; } else line=test;
    } if(line) ctx.fillText(line,x,y);
  }

  return (
    <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
      <canvas ref={canvasRef}/>
    </div>
  );
}

// @ts-ignore
(window as any).AstragalusLevel3 = AstragalusLevel3;
// expose
global.AstragalusLevel3 = global.AstragalusLevel3 || AstragalusLevel3;
})(window);
