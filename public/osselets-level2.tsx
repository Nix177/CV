(function (global) {
  const { useEffect, useRef, useState } = React;
// public/osselets-level2.tsx
// Niveau 2 — « Écrire avec les os » : fil qui traverse 24 trous (alphabet grec)
// ➜ Ajout : rendu 3D de l’astragale (GLB) en arrière-plan + projection des ancres de trous.

const L2_W = 960, L2_H = 540;
const L2_AUDIO_BASE = "/assets/games/osselets/audio/";
const L2_AUDIO = { music:"game-music-1.mp3", ok:"catch-sound.mp3", bad:"ouch-sound.mp3" };

const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];
const GREEK_LATIN = ["A","B","G","D","E","Z","Ē","Th","I","K","L","M","N","X","O","P","R","S","T","Y","Ph","Ch","Ps","Ō"];

// Puzzles (identiques à ta version)
const PUZZLES = [
  { title:"ΝΙΚΗ", latin:"NIKĒ",   seq:[12,8,9,6],         tip:"Victoire : gravé sur des astragales, lié à la chance/protection." },
  { title:"ΕΛΠΙΣ", latin:"ELPIS", seq:[4,10,15,8,17],     tip:"Espoir : message positif porté par l’amulette." },
  { title:"ΤΥΧΗ", latin:"TYCHĒ",  seq:[18,19,21,6],       tip:"Bonne fortune : souhait propitiatoire." }
];

// --- Loader Three.js (UMD) + GLTFLoader injectés dynamiquement (no change to HTML) ---
function ensureThree() {
  return new Promise((resolve, reject) => {
    if (window.THREE && window.THREE.GLTFLoader && window.THREE.OrbitControls) return resolve(window.THREE);
    const add = (src) => new Promise((res, rej) => { const s=document.createElement("script"); s.src=src; s.onload=()=>res(1); s.onerror=()=>rej(new Error("load fail "+src)); document.head.appendChild(s); });
    (async () => {
      try {
        await add("https://unpkg.com/three@0.149.0/build/three.min.js");
        await add("https://unpkg.com/three@0.149.0/examples/js/controls/OrbitControls.js");
        await add("https://unpkg.com/three@0.149.0/examples/js/loaders/GLTFLoader.js");
        resolve(window.THREE);
      } catch(e){ reject(e); }
    })();
  });
}
const GLB_CANDIDATES = [
  "/assets/games/osselets/3d/astragalus.glb",
  "/assets/games/osselets/level2/3d/astragalus.glb",
  "/assets/games/osselets/level2/astragalus.glb",
];

// Audio helpers
function l2LoadAudio(src){ try{ const a=new Audio(L2_AUDIO_BASE+src); a.preload="auto"; return a; }catch{ return null; } }
function l2Wrap(ctx, text, x,y,maxW, lh){ const words=text.split(/\s+/); let line=""; for(let i=0;i<words.length;i++){ const test=(line?line+" ":"")+words[i]; if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line,x,y); line=words[i]; y+=lh; } else line=test; } if(line) ctx.fillText(line,x,y); }

function AstragalusLevel2(){
  const hostRef    = useRef(null);
  const webglRef   = useRef(null);
  const canvasRef  = useRef(null);
  const ctxRef     = useRef(null);

  // Audio
  const musRef  = useRef(null), sOkRef=useRef(null), sBadRef=useRef(null);
  const [musicOn,setMusicOn] = useState(true);
  useEffect(()=>{ musRef.current=l2LoadAudio(L2_AUDIO.music); sOkRef.current=l2LoadAudio(L2_AUDIO.ok); sBadRef.current=l2LoadAudio(L2_AUDIO.bad); },[]);
  useEffect(()=>{ const m=musRef.current; if(!m) return; m.loop=true; m.volume=0.35; m.muted=!musicOn; if(musicOn) m.play().catch(()=>{}); else m.pause(); },[musicOn]);

  // Canvas DPR/responsive
  const sizeRef = useRef({w:L2_W, h:L2_H, dpr:1});
  useEffect(() => {
    const cv = canvasRef.current!, ctx = cv.getContext("2d")!;
    ctxRef.current = ctx;
    function resize(){
      const w = hostRef.current?.clientWidth || L2_W;
      const h = Math.round(w*(L2_H/L2_W));
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio||1));
      sizeRef.current = {w,h,dpr};
      cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
      cv.style.width=w+"px"; cv.style.height=h+"px";
      ctx.setTransform(dpr*(w/L2_W),0,0,dpr*(w/L2_W),0,0);
    }
    resize(); const ro=new ResizeObserver(resize); hostRef.current && ro.observe(hostRef.current);
    window.addEventListener("resize",resize);
    return ()=>{ ro.disconnect(); window.removeEventListener("resize",resize); };
  },[]);

  // ---------- 3D scene (Three.js) ----------
  const threeRef = useRef({ scene:null, camera:null, renderer:null, controls:null, model:null, anchors:[], animId:0 });
  const holes    = useRef([]); // [{x,y,label,index}]
  function setFallbackHoles(){
    // ellipse régulière (comme ta version d’origine) si pas d’ancres GLB
    const cx=L2_W*0.5, cy=L2_H*0.54; const rx=260, ry=120; const offset=-Math.PI/2;
    holes.current = [];
    for (let i=0;i<24;i++){
      const ring = i%2, t = offset + (i/24)*Math.PI*2 + (ring?0.08:-0.08);
      const rxf = rx*(ring?0.92:1), ryf= ry*(ring?0.92:1);
      holes.current.push({ x: cx + Math.cos(t)*rxf, y: cy + Math.sin(t)*ryf, label:GREEK[i], index:i });
    }
  }
  // ancre → index (ordre canonique par faces : ventre, dos, bassin, membres)
  const anchorOrder = [];
  ["ventre","dos","bassin","membres"].forEach(face=>{
    for(let i=1;i<=6;i++){ anchorOrder.push(`Hole_${face}_${String(i).padStart(2,"0")}`); }
  });

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try{
        await ensureThree();
        const THREE = window.THREE;
        // renderer
        const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
        renderer.setPixelRatio(Math.min(2.5, window.devicePixelRatio||1));
        webglRef.current.appendChild(renderer.domElement);

        // scene + camera + light
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 16/9, 0.1, 100);
        camera.position.set(0.8, 0.5, 2.2);

        const amb = new THREE.AmbientLight(0xffffff, 0.9); scene.add(amb);
        const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(2,3,4); scene.add(dir);

        // controls (douce rotation autorot)
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enablePan=false; controls.enableZoom=false; controls.autoRotate=true; controls.autoRotateSpeed=0.6;

        // size
        function resize3d(){
          const { w,h } = sizeRef.current;
          renderer.setSize(w, h, false);
          camera.aspect = w/h; camera.updateProjectionMatrix();
        }
        resize3d();

        // load GLB (avec fallbacks)
        const loader = new THREE.GLTFLoader();
        let loaded=null;
        for (const p of GLB_CANDIDATES){
          try{ loaded = await loader.loadAsync(p); break; }catch{}
        }
        if (!loaded){ console.warn("[L2] GLB introuvable — fallback 2D"); setFallbackHoles(); }

        let model=null, anchors=[];
        if (loaded){
          model = loaded.scene;
          model.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });
          const s=1.1; model.scale.set(s,s,s);
          scene.add(model);
          // récupérer ancres
          anchors = anchorOrder.map(name => model.getObjectByName(name)).filter(Boolean);
          if (anchors.length!==24){
            console.warn(`[L2] Ancres incomplètes (${anchors.length}/24) — fallback cercle`);
            anchors.length = 0;
          }
        }

        threeRef.current = { scene, camera, renderer, controls, model, anchors, animId:0 };

        // animation loop + projection ancres -> coords 2D
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

        // resize hook
        const onWinResize = ()=>{ resize3d(); };
        window.addEventListener("resize", onWinResize);

        // cleanup
        return ()=>{ mounted=false; cancelAnimationFrame(threeRef.current.animId); window.removeEventListener("resize", onWinResize); renderer.dispose(); };
      }catch(e){ console.error(e); setFallbackHoles(); }
    })();
  },[]);

  // ---------- Gameplay identique : suivre la séquence de lettres ----------
  const [pIndex,setPIndex] = useState(0);
  const cur = () => PUZZLES[pIndex];
  const progress = useRef(0);
  const pathPts  = useRef([]);
  const [toast,setToast] = useState("Trace le fil : "+cur().title+" ("+cur().latin+")");
  const [done,setDone] = useState(false);

  function holeAt(x,y){ return holes.current.find(h=> (x-h.x)**2+(y-h.y)**2 <= 18*18 ); }

  useEffect(()=>{
    const cv = canvasRef.current!;
    const state = { dragging:false, dragPt:null, lastHover:null };

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
      if (!state.dragging) return;
      state.dragging=false;
      const seq = cur().seq;
      const near = holeAt(state.dragPt.x, state.dragPt.y);
      if (near && near.index === seq[progress.current]){
        progress.current++;
        if (sOkRef.current){ try{sOkRef.current.currentTime=0; sOkRef.current.play();}catch{} }
        if (progress.current>=seq.length){ setDone(true); setToast("Bravo ! Tu as écrit « "+cur().title+" » ("+cur().latin+")."); }
        else setToast("OK. Suivant : "+GREEK[seq[progress.current]]+" ("+GREEK_LATIN[seq[progress.current]]+")");
      } else {
        if (sBadRef.current){ try{sBadRef.current.currentTime=0; sBadRef.current.play();}catch{} }
        setToast("Essaie encore : cherche "+GREEK[seq[progress.current]]+" ("+GREEK_LATIN[seq[progress.current]]+").");
      }
    }

    cv.addEventListener("pointerdown",onDown);
    cv.addEventListener("pointermove",onMove);
    window.addEventListener("pointerup",onUp);
    return ()=>{ cv.removeEventListener("pointerdown",onDown); cv.removeEventListener("pointermove",onMove); window.removeEventListener("pointerup",onUp); };
  },[pIndex,done]);

  function resetPuzzle(nextIdx=pIndex){
    progress.current=0; pathPts.current.length=0; setDone(false); setPIndex(nextIdx);
    setToast("Trace le fil : "+PUZZLES[nextIdx].title+" ("+PUZZLES[nextIdx].latin+")");
  }

  // --- Rendu 2D (UI + fil + lettres) — fond transparent pour laisser voir le WebGL derrière
  useEffect(()=>{
    const ctx = ctxRef.current!;
    let raf;
    function draw(){
      ctx.clearRect(0,0,L2_W,L2_H);

      // titre
      ctx.fillStyle="#0f172a"; ctx.font="18px ui-sans-serif, system-ui";
      ctx.fillText("Niveau 2 — Écrire avec les os (3D)", 16, 28);

      // lettres + trous
      // si on a des trous (projétés ou fallback), dessine
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

      // panneau droit
      const x=L2_W-300, y=52, w=284, h=200;
      ctx.save(); ctx.fillStyle="rgba(248,250,252,.85)"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5;
      ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
      ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
      ctx.fillText("Mot cible", x+12, y+22);
      ctx.font="18px ui-sans-serif, system-ui"; ctx.fillStyle="#0b3b2e";
      ctx.fillText(cur().title+" ("+cur().latin+")", x+12, y+48);
      ctx.font="12px ui-sans-serif, system-ui"; ctx.fillStyle="#334155"; l2Wrap(ctx, "Indice : "+cur().tip, x+12, y+76, w-24, 16);
      ctx.restore();

      // footer / commandes
      const y2=y+h+12;
      const btn = (bx, label, cb) => { ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5; ctx.fillRect(bx,y2,116,30); ctx.strokeRect(bx,y2,116,30); ctx.fillStyle="#0f172a"; ctx.font="13px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label, bx+58, y2+15); zones.current.push({x:bx,y:y2,w:116,h:30,cb}); };
      zones.current.length=0;
      btn(x,    "Réinitialiser", ()=>resetPuzzle(pIndex));
      btn(x+124,"Mot suivant",   ()=>resetPuzzle((pIndex+1)%PUZZLES.length));
      btn(x+248,"Musique "+(musicOn?"ON":"OFF"), ()=>setMusicOn(v=>!v));

      // toast
      ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui"; l2Wrap(ctx, toast||"", 16, L2_H-48, L2_W-32, 18);

      raf=requestAnimationFrame(draw);
    }
    raf=requestAnimationFrame(draw);
    return ()=> cancelAnimationFrame(raf);
  },[pIndex,done,toast,musicOn]);

  // zones cliquables (panneau)
  const zones = useRef([]);
  useEffect(()=>{
    const el = canvasRef.current!;
    function onClick(ev){
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
      <div ref={webglRef} style={{position:"absolute", inset:0}} aria-hidden="true"></div>
      <canvas ref={canvasRef} />
    </div>
  );
}

// @ts-ignore
(window as any).AstragalusLevel2 = AstragalusLevel2;
global.AstragalusLevel2 = global.AstragalusLevel2 || AstragalusLevel2;
})(window);
