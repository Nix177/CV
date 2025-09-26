// public/osselets-level2.tsx
// Niveau 2 — « Écrire avec les os » : fil qui traverse des trous numérotés (alphabet grec, 24 lettres)

const { useEffect, useRef, useState } = React;

/* ---------- Config visuelle ---------- */
const L2_W = 960, L2_H = 540;
const ANIM_SPEED_L2 = 0.08;

/* ---------- Audio (optionnels) ---------- */
const L2_AUDIO_BASE = "/assets/games/osselets/audio/";
const L2_AUDIO = {
  music: "game-music-1.mp3",
  ok:    "catch-sound.mp3",
  bad:   "ouch-sound.mp3"
};

/* ---------- Alphabet (24) + puzzles ---------- */
const GREEK = [
  "Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ",
  "Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"
];
const GREEK_LATIN = [
  "A","B","G","D","E","Z","Ē","Th","I","K","L","M",
  "N","X","O","P","R","S","T","Y","Ph","Ch","Ps","Ō"
];

// Puzzles : chaque mot est une liste d'indices (0..23) dans l'alphabet ci-dessus
const PUZZLES = [
  { title:"ΝΙΚΗ", latin:"NIKĒ",    seq:[12,8,9,6], tip:"Victoire : gravé sur des astragales, lié à la chance/protection." },
  { title:"ΕΛΠΙΣ", latin:"ELPIS",  seq:[4,10,15,8,17], tip:"Espoir : message positif porté par l’amulette." },
  { title:"ΤΥΧΗ", latin:"TYCHĒ",   seq:[18,19,21,6], tip:"Bonne fortune : souhait propitiatoire." }
];

/* ---------- Helpers internes ---------- */
function l2LoadAudio(src:string): HTMLAudioElement | null {
  try { const a=new Audio(L2_AUDIO_BASE+src); a.preload="auto"; return a; } catch { return null; }
}
function l2Wrap(ctx:CanvasRenderingContext2D, text:string, x:number,y:number,maxW:number, lh:number){
  const words = text.split(/\s+/); let line=""; for(let i=0;i<words.length;i++){
    const test = (line?line+" ":"")+words[i]; if (ctx.measureText(test).width>maxW && line){
      ctx.fillText(line,x,y); line=words[i]; y+=lh;
    } else line=test;
  } if (line) ctx.fillText(line,x,y);
}

function AstragalusLevel2(){
  const hostRef = useRef<HTMLDivElement|null>(null);
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D|null>(null);

  // Audio
  const musRef  = useRef<HTMLAudioElement|null>(null);
  const sOkRef  = useRef<HTMLAudioElement|null>(null);
  const sBadRef = useRef<HTMLAudioElement|null>(null);
  const [musicOn,setMusicOn] = useState(true);
  useEffect(()=>{ musRef.current = l2LoadAudio(L2_AUDIO.music); sOkRef.current=l2LoadAudio(L2_AUDIO.ok); sBadRef.current=l2LoadAudio(L2_AUDIO.bad); },[]);
  useEffect(()=>{ const m=musRef.current; if(!m) return; m.loop=true; m.volume=0.35; m.muted=!musicOn; if(musicOn) m.play().catch(()=>{}); else m.pause(); },[musicOn]);

  // Canvas DPR/responsive
  useEffect(() => {
    const cv = canvasRef.current!, ctx = cv.getContext("2d")!;
    ctxRef.current = ctx;
    function resize(){
      const w = hostRef.current?.clientWidth || L2_W;
      const h = Math.round(w*(L2_H/L2_W));
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio||1));
      cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
      cv.style.width=w+"px"; cv.style.height=h+"px";
      ctx.setTransform(dpr*(w/L2_W),0,0,dpr*(w/L2_W),0,0);
    }
    resize(); const ro=new ResizeObserver(resize); hostRef.current && ro.observe(hostRef.current);
    window.addEventListener("resize",resize);
    return ()=>{ ro.disconnect(); window.removeEventListener("resize",resize); };
  },[]);

  // Géométrie de l’astragale (ellipse + 24 trous sur 2 rangées décalées)
  const holes = useRef<{x:number,y:number,label:string,index:number}[]>([]);
  function recomputeHoles(){
    const cx=L2_W*0.5, cy=L2_H*0.54;
    const rx=260, ry=120;
    const offset = -Math.PI/2; // commence en haut
    holes.current = [];
    for (let i=0;i<24;i++){
      const ring = i%2; // alternance léger décalage
      const t = offset + (i/24)*Math.PI*2 + (ring?0.08:-0.08);
      const rxf = rx*(ring?0.92:1), ryf = ry*(ring?0.92:1);
      holes.current.push({ x: cx + Math.cos(t)*rxf, y: cy + Math.sin(t)*ryf, label: GREEK[i], index:i });
    }
  }
  useEffect(()=>{ recomputeHoles(); },[]);

  // État du puzzle
  const [pIndex,setPIndex] = useState(0);
  const cur = () => PUZZLES[pIndex];
  const progress = useRef(0); // position dans seq
  const pathPts = useRef<{x:number,y:number}[]>([]);
  const [toast,setToast] = useState<string| null>("Trace le fil en suivant les lettres : "+cur().title+" ("+cur().latin+")");
  const [done,setDone] = useState(false);

  // Interaction
  const dragging = useRef(false);
  const dragPt   = useRef<{x:number,y:number} | null>(null);
  function holeAt(x:number,y:number){ return holes.current.find(h=> (x-h.x)**2+(y-h.y)**2 <= 18*18 ); }

  useEffect(()=>{
    const cv = canvasRef.current!;
    function getXY(ev: PointerEvent){ const r=cv.getBoundingClientRect(); return { x:(ev.clientX-r.left)*(L2_W/r.width), y:(ev.clientY-r.top)*(L2_H/r.height) }; }

    const onDown=(ev:PointerEvent)=>{ ev.preventDefault(); if(done) return;
      const {x,y}=getXY(ev); const h = holeAt(x,y); if(!h) return;
      // doit commencer par la 1ère lettre attendue
      const needIndex = cur().seq[0];
      if (progress.current===0 && h.index===needIndex){
        dragging.current=true; dragPt.current={x:h.x,y:h.y}; pathPts.current=[{x:h.x,y:h.y}];
        setToast("Bien ! Maintenant : "+GREEK[cur().seq[1]]+" ("+GREEK_LATIN[cur().seq[1]]+")");
      }
    };
    const onMove=(ev:PointerEvent)=>{ if(!dragging.current||done) return;
      const {x,y}=getXY(ev); dragPt.current={x,y};
    };
    const onUp=(ev:PointerEvent)=>{ if(!dragging.current||done) return;
      const {x,y}=getXY(ev); const h = holeAt(x,y); const seq=cur().seq; const step=progress.current;
      if (h && h.index === seq[step+1]){ // bon suivant
        pathPts.current.push({x:h.x,y:h.y});
        progress.current++;
        if (sOkRef.current){ try{sOkRef.current.currentTime=0; sOkRef.current.play();}catch{} }
        if (progress.current === seq.length-1){
          dragging.current=false; dragPt.current=null; setDone(true);
          setToast("Bravo ! Tu as écrit « "+cur().title+" » ("+cur().latin+").");
        } else {
          setToast("OK. Suivant : "+GREEK[seq[step+2]]+" ("+GREEK_LATIN[seq[step+2]]+")");
        }
      } else {
        // erreur
        if (sBadRef.current){ try{sBadRef.current.currentTime=0; sBadRef.current.play();}catch{} }
        setToast("Essaie encore : cherche "+GREEK[seq[step+1]]+" ("+GREEK_LATIN[seq[step+1]]+").");
      }
    };
    cv.addEventListener("pointerdown",onDown); cv.addEventListener("pointermove",onMove); window.addEventListener("pointerup",onUp);
    return ()=>{ cv.removeEventListener("pointerdown",onDown); cv.removeEventListener("pointermove",onMove); window.removeEventListener("pointerup",onUp); };
  },[pIndex,done]);

  // Reset puzzle
  function resetPuzzle(nextIdx = pIndex){
    progress.current=0; pathPts.current.length=0; dragging.current=false; dragPt.current=null; setDone(false);
    setPIndex(nextIdx);
    setToast("Trace le fil : "+PUZZLES[nextIdx].title+" ("+PUZZLES[nextIdx].latin+")");
  }

  // Render loop
  useEffect(()=>{
    const ctx = ctxRef.current!;
    let raf:number, last=performance.now();
    function draw(t:number){
      const dt=Math.min(33,t-last)/16.666; last=t;

      ctx.clearRect(0,0,L2_W,L2_H);
      // fond
      const g=ctx.createLinearGradient(0,0,0,L2_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
      ctx.fillStyle=g; ctx.fillRect(0,0,L2_W,L2_H);

      // cartouche titre
      ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui";
      ctx.fillText("Niveau 2 — Écrire avec les os", 16, 28);

      // astra (forme)
      drawAstragalus(ctx);

      // trous + lettres
      drawHoles(ctx);

      // tracé du fil
      drawThread(ctx);

      // tips/legend
      drawLegend(ctx);

      raf=requestAnimationFrame(draw);
    }
    raf=requestAnimationFrame(draw);
    return ()=> cancelAnimationFrame(raf);
  },[pIndex,done]);

  function drawAstragalus(ctx:CanvasRenderingContext2D){
    const cx=L2_W*0.5, cy=L2_H*0.54, rx=280, ry=140;
    ctx.save();
    // ombre
    ctx.fillStyle="rgba(0,0,0,.08)";
    ctx.beginPath(); ctx.ellipse(cx, cy+14, rx*0.95, ry*0.6, 0, 0, Math.PI*2); ctx.fill();

    // corps os (style ivoire)
    const grd = ctx.createLinearGradient(cx-rx,cy-ry, cx+rx,cy+ry);
    grd.addColorStop(0,"#fefce8"); grd.addColorStop(1,"#fde68a");
    ctx.fillStyle=grd; ctx.strokeStyle="#eab308"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();

    // rainures décor
    ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1.5; ctx.globalAlpha=0.35;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx*0.86,ry*0.82,0,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx,cy,rx*0.68,ry*0.64,0,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=1;
    ctx.restore();
  }

  function drawHoles(ctx:CanvasRenderingContext2D){
    ctx.save();
    for(const h of holes.current){
      // trou
      ctx.fillStyle="#111827"; ctx.beginPath(); ctx.arc(h.x,h.y,10,0,Math.PI*2); ctx.fill();
      // cercle clair
      ctx.strokeStyle="#fde68a"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(h.x,h.y,14,0,Math.PI*2); ctx.stroke();
      // lettre
      ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center";
      ctx.fillText(h.label, h.x, h.y-18);
    }
    ctx.restore();
  }

  function drawThread(ctx:CanvasRenderingContext2D){
    if (!pathPts.current.length) return;
    ctx.save(); ctx.lineWidth=4; ctx.strokeStyle="#10b981";
    ctx.beginPath(); ctx.moveTo(pathPts.current[0].x, pathPts.current[0].y);
    for(let i=1;i<pathPts.current.length;i++) ctx.lineTo(pathPts.current[i].x, pathPts.current[i].y);
    if (dragPt.current) ctx.lineTo(dragPt.current.x, dragPt.current.y);
    ctx.stroke();
    ctx.restore();

    // départ/arrivée marqués
    const a = pathPts.current[0], b = pathPts.current[pathPts.current.length-1];
    if (a){ ctx.fillStyle="#059669"; ctx.beginPath(); ctx.arc(a.x,a.y,6,0,Math.PI*2); ctx.fill(); }
    if (b){ ctx.fillStyle="#34d399"; ctx.beginPath(); ctx.arc(b.x,b.y,6,0,Math.PI*2); ctx.fill(); }
  }

  function drawLegend(ctx:CanvasRenderingContext2D){
    // zone d’info
    ctx.save();
    ctx.fillStyle="#ffffff"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2;
    ctx.fillRect(16,L2_H-140, L2_W-32, 124); ctx.strokeRect(16,L2_H-140, L2_W-32, 124);
    ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
    const str = toast ?? "";
    l2Wrap(ctx, str, 26, L2_H-112, L2_W-52, 18);

    // puzzle badge
    ctx.fillStyle="#111827"; ctx.fillRect(L2_W-180, L2_H-136, 160, 24);
    ctx.fillStyle="#fff"; ctx.font="12px ui-sans-serif, system-ui";
    ctx.fillText("Mot : "+cur().title+" ("+cur().latin+")", L2_W-172, L2_H-119);

    // boutons
    drawBtn(ctx, 22, L2_H-44, 150, 32, "Réinitialiser", ()=> resetPuzzle(pIndex));
    drawBtn(ctx, 182, L2_H-44, 150, 32, "Mot suivant", ()=> resetPuzzle((pIndex+1)%PUZZLES.length));
    drawBtn(ctx, 342, L2_H-44, 170, 32, musicOn ? "Musique ON" : "Musique OFF", ()=> setMusicOn(v=>!v));
    if (done) drawBtn(ctx, L2_W-170, L2_H-44, 150, 32, "Poursuivre →", ()=> resetPuzzle((pIndex+1)%PUZZLES.length));

    ctx.restore();

    // Tip discret
    ctx.fillStyle="#64748b"; ctx.font="12px ui-sans-serif, system-ui";
    l2Wrap(ctx, "Indice : "+cur().tip, 26, L2_H-62, L2_W-200, 16);
  }

  // hotzones cliquables simples par frame
  const zones = useRef<{x:number,y:number,w:number,h:number, cb:()=>void}[]>([]);
  function drawBtn(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,label:string,cb:()=>void){
    ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5;
    ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
    ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(label, x+w/2, y+h/2+1);
    zones.current.push({x,y,w,h,cb});
  }
  useEffect(()=>{
    const el = canvasRef.current!;
    function onClick(ev:MouseEvent){
      const r=el.getBoundingClientRect(); const mx=(ev.clientX-r.left)*(L2_W/r.width), my=(ev.clientY-r.top)*(L2_H/r.height);
      const z = zones.current.find(z=> mx>=z.x && mx<=z.x+z.w && my>=z.y && my<=z.y+z.h);
      zones.current.length=0;
      if (z) z.cb();
    }
    el.addEventListener("click", onClick);
    return ()=> el.removeEventListener("click", onClick);
  },[]);

  return (
    <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
      <canvas ref={canvasRef}/>
    </div>
  );
}

// @ts-ignore
(window as any).AstragalusLevel2 = AstragalusLevel2;
