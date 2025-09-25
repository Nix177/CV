// public/osselets-runner.tsx
// Runner 2D – Amulettes d’astragale (version robuste + responsive + assets PNG amulettes)

const { useEffect, useRef, useState } = React;

/* -------------------- Chemins & assets -------------------- */
const IMG_BASES = [
  "/assets/games/osselets/audio/img/", // ton emplacement actuel
  "/assets/games/osselets/img/",       // fallback si tu déplaces plus tard
];
const AUDIO_BASE = "/assets/games/osselets/audio/";

// MP3 uniquement
const AUDIO = {
  music: "game-music-1.mp3",
  jump:  "jump-sound.mp3",
  catch: "catch-sound.mp3",
  ouch:  "ouch-sound.mp3",
};

// PNG amulettes (noms EXACTS tels que dans ta capture)
const AMULET_FILES = {
  speed:  "amulette-speed.png",
  purify: "amulette-purify.png",
  ward:   "amulette-ward.png",
};

/* -------------------- Réglages visuels/jeux -------------------- */
const WORLD_W = 960;
const WORLD_H = 540;
const ANIM_SPEED = 0.1;  // 60 % de la vitesse initiale
const HERO_SCALE = 1.5;
const BEAR_SCALE = 1.5;

const GROUND_Y   = 440;  // coord. logique (dans WORLD_H)
const WORLD_LEN  = 4200; // longueur du niveau

/* -------------------- Utils chargement -------------------- */
function logOnce(key:string, ...args:any[]) {
  const k = `__once_${key}`;
  // @ts-ignore
  if (window[k]) return;
  // @ts-ignore
  window[k] = true;
  console.warn(...args);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`img load failed: ${url}`));
    im.src = encodeURI(url);
  });
}

async function loadImageSmart(file: string): Promise<HTMLImageElement | null> {
  for (const base of IMG_BASES) {
    try {
      return await loadImage(base + file);
    } catch {}
  }
  logOnce(`img_${file}`, `[osselets] image introuvable: ${file} (essayé: ${IMG_BASES.map(b=>b+file).join(", ")})`);
  return null;
}

async function fetchJSON<T=any>(file: string): Promise<T | null> {
  for (const base of IMG_BASES) {
    try {
      const r = await fetch(base + file, { cache: "no-store" });
      if (r.ok) return (await r.json()) as T;
    } catch {}
  }
  return null;
}

/* -------------------- Types animation héros -------------------- */
type FrameRect = { image: HTMLImageElement; sx: number; sy: number; sw: number; sh: number };
type Clip = { frames: FrameRect[]; fps: number; loop: boolean; name?: string };
type AnimSet = { [name: string]: Clip };
type HeroAnim = { clips: AnimSet; origin: [number, number]; frameSize: [number, number] };

/* ============================================================ */

function AstragalusRunner() {
  /* ---------- Canvas responsive + DPR ---------- */
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const ctxRef     = useRef<CanvasRenderingContext2D | null>(null);
  const scaleRef   = useRef(1);   // scale visuel (pour adapter 16:9)
  const dprRef     = useRef(1);   // device pixel ratio

  useEffect(() => {
    function resize() {
      const wrap = wrapperRef.current, cv = canvasRef.current;
      if (!wrap || !cv) return;

      const rectW = wrap.clientWidth;
      const targetW = rectW;                // 100% largeur dispo
      const targetH = Math.round(targetW * (WORLD_H / WORLD_W)); // ratio 16:9

      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      dprRef.current = dpr;

      // taille pixel du canvas (attr width/height) = taille CSS * DPR
      cv.width  = Math.floor(targetW * dpr);
      cv.height = Math.floor(targetH * dpr);

      // taille CSS (pour layout)
      cv.style.width  = `${targetW}px`;
      cv.style.height = `${targetH}px`;

      // contexte & transform pour dessiner aux coords logiques (WORLD_W × WORLD_H)
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctxRef.current = ctx;
        ctx.setTransform(0,0,0,0,0,0);     // reset
        const scale = (targetW * dpr) / WORLD_W;
        scaleRef.current = scale;          // utile si besoin
        ctx.setTransform(scale, 0, 0, scale, 0, 0); // on dessine aux coords du monde
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    window.addEventListener("resize", resize);
    return () => { ro.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  /* ---------- UI états ---------- */
  const [inIntro, setInIntro]       = useState(true);
  const [paused, setPaused]         = useState(false);
  const [summaryOpen, setSummaryOpen]= useState(false);
  const [level, setLevel]           = useState(1);
  const [message, setMessage]       = useState("← → bouger | Espace sauter | P pause | H cours | M musique");
  const [historyMode, setHistoryMode]= useState(true);

  // Mobile
  const autoCoarse = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(pointer: coarse)").matches
    : false;
  const [mobileMode, setMobileMode] = useState<boolean>(autoCoarse);
  const [oneButton, setOneButton]   = useState<boolean>(false);
  const onScreenKeys = useRef({ left:false, right:false, jump:false });

  // Audio
  const [musicOn, setMusicOn] = useState(true);
  const musicEl   = useRef<HTMLAudioElement | null>(null);
  const sfxJumpEl = useRef<HTMLAudioElement | null>(null);
  const sfxCatchEl= useRef<HTMLAudioElement | null>(null);
  const sfxOuchEl = useRef<HTMLAudioElement | null>(null);
  const startedOnce = useRef(false);
  function startMusicIfWanted() {
    const el = musicEl.current; if (!el) return;
    el.loop = true; el.volume = 0.35; el.muted = !musicOn;
    if (musicOn) el.play().catch(()=>{});
  }
  function toggleMusic() {
    const el = musicEl.current;
    setMusicOn(v => { const n=!v; if(el){ el.muted=!n; if(n && el.paused) el.play().catch(()=>{});} return n; });
  }
  function playOne(ref: React.MutableRefObject<HTMLAudioElement | null>) {
    const el = ref.current; if(!el) return;
    try{ el.currentTime=0; el.play().catch(()=>{});}catch{}
  }
  useEffect(() => {
    function firstInteract() {
      if (!startedOnce.current) { startedOnce.current = true; startMusicIfWanted(); }
    }
    window.addEventListener("pointerdown", firstInteract, { once: true });
    window.addEventListener("keydown", firstInteract, { once: true });
    return () => {
      window.removeEventListener("pointerdown", firstInteract);
      window.removeEventListener("keydown", firstInteract);
    };
  }, []);

  /* ---------- Héros & animations ---------- */
  const heroAnim = useRef<HeroAnim | null>(null);
  const heroState = useRef<{ name: "idle"|"run"|"jump"; t:number }>({ name: "idle", t: 0 });

  useEffect(() => {
    let canceled = false;
    (async () => {
      const j = await fetchJSON<any>("hero.anim.json");
      if (canceled) return;
      if (!j) { heroAnim.current = null; logOnce("herojson","[osselets] hero.anim.json introuvable"); return; }

      const origin: [number,number] = j.origin ?? [0.5, 1];
      const baseFS: [number,number] = j.frameSize ?? [64,64];
      const clips: AnimSet = {};

      async function buildClip(name:string, def: any): Promise<Clip | null> {
        if (def?.files && Array.isArray(def.files)) {
          const imgs = (await Promise.all(def.files.map((f:string)=>loadImageSmart(f)))).filter(Boolean) as HTMLImageElement[];
          if (!imgs.length) { logOnce(`hero_${name}`, `[osselets] ${name}: 0 frame chargée (files[] manquants ?)`); return null; }
          const frames = imgs.map(im => ({ image: im, sx:0, sy:0, sw: im.naturalWidth, sh: im.naturalHeight }));
          return { frames, fps: Number(def.fps) || 10, loop: def.loop ?? true, name };
        }
        if (def?.rects && def?.src) {
          const img = await loadImageSmart(def.src);
          if (!img) { logOnce(`hero_${name}_src`, `[osselets] ${name}: sprite introuvable: ${def.src}`); return null; }
          const frames = def.rects.map((r:any)=>({ image: img, sx:r.x, sy:r.y, sw:r.w, sh:r.h }));
          if (!frames.length) { logOnce(`hero_${name}_rects`, `[osselets] ${name}: rects[] vide`); return null; }
          return { frames, fps: Number(def.fps) || 10, loop: def.loop ?? true, name };
        }
        if (def?.src && def?.frames) {
          const img = await loadImageSmart(def.src);
          if (!img) { logOnce(`hero_${name}_src2`, `[osselets] ${name}: sprite introuvable: ${def.src}`); return null; }
          const fs: [number,number] = def.frameSize ?? baseFS;
          let fw = fs[0], fh = fs[1];
          if (!def.frameSize) {
            if (img.naturalWidth % def.frames === 0) {
              fw = Math.round(img.naturalWidth / def.frames);
              fh = img.naturalHeight;
            } else { fh = img.naturalHeight; fw = fh; }
          }
          const frames: FrameRect[] = [];
          for (let i=0;i<def.frames;i++){
            const sx = Math.min(img.naturalWidth - fw, Math.round(i*fw));
            frames.push({ image: img, sx, sy:0, sw:fw, sh:fh });
          }
          if (!frames.length) { logOnce(`hero_${name}_frames0`, `[osselets] ${name}: frames=0`); return null; }
          return { frames, fps: Number(def.fps) || 10, loop: def.loop ?? true, name };
        }
        logOnce(`hero_${name}_unknown`, `[osselets] ${name}: format d’anim non reconnu`);
        return null;
      }

      const anims = j.animations ?? {};
      for (const key of Object.keys(anims)) {
        const clip = await buildClip(key, anims[key]);
        if (clip) clips[key] = clip;
      }
      heroAnim.current = { clips, origin, frameSize: baseFS };
      console.info("[osselets] hero clips chargés:", Object.fromEntries(Object.entries(clips).map(([k,c])=>[k, c.frames.length])));
    })();
    return ()=>{ canceled=true; };
  }, []);

  /* ---------- Ours (6 PNG ou bear.anim.json) ---------- */
  const bearAnim = useRef<{ frames: HTMLImageElement[]; t:number }|null>(null);
  useEffect(() => {
    let canceled = false;
    (async () => {
      const j = await fetchJSON<any>("bear.anim.json");
      if (j?.files || (j?.src && (j?.rects || j?.frames))) {
        let frames: HTMLImageElement[] = [];
        if (j.files) {
          frames = (await Promise.all(j.files.map((f:string)=>loadImageSmart(f)))).filter(Boolean) as HTMLImageElement[];
        }
        if (frames.length) { bearAnim.current = { frames, t:0 }; if (!canceled) console.info("[osselets] ours via bear.anim.json:", frames.length,"frames"); return; }
      }
      const withSpace = await Promise.all([1,2,3,4,5,6].map(i=>loadImageSmart(`bear (${i}).png`)));
      let imgs = withSpace.filter(Boolean) as HTMLImageElement[];
      if (!imgs.length) {
        const noSpace = await Promise.all([1,2,3,4,5,6].map(i=>loadImageSmart(`bear(${i}).png`)));
        imgs = noSpace.filter(Boolean) as HTMLImageElement[];
      }
      if (!imgs.length) logOnce("bear_missing","[osselets] frames ours introuvables (bear(1..6).png ou bear (1..6).png)");
      bearAnim.current = imgs.length ? { frames: imgs, t: 0 } : null;
    })();
    return ()=>{ canceled=true; };
  }, []);

  /* ---------- PNG amulettes ---------- */
  const amuletsRef = useRef<{[k in keyof typeof AMULET_FILES]?: HTMLImageElement | null}>({});
  useEffect(() => {
    (async () => {
      amuletsRef.current.speed  = await loadImageSmart(AMULET_FILES.speed);
      amuletsRef.current.purify = await loadImageSmart(AMULET_FILES.purify);
      amuletsRef.current.ward   = await loadImageSmart(AMULET_FILES.ward);
    })();
  }, []);

  /* ---------- Monde & gameplay ---------- */
  const player = useRef({
    x:120, y:GROUND_Y-68, w:42, h:68, vx:0, vy:0, onGround:true, facing:1,
    baseSpeed:3.0, speedMul:1.0, dirt:0, runPhase:0, coyote:0, jumpBuf:0
  });
  const inv = useRef({ speed:false, purify:false, ward:false });
  const wardTimer = useRef(0);
  const keys = useRef<{[k:string]:boolean}>({});

  const bear = useRef({ x:-999, y:GROUND_Y-60, w:64, h:60, vx:0, active:false });
  type Stage = "start"|"speedAmulet"|"bearChase"|"postChase"|"purifyAmulet"|"wardAmulet"|"evilEyeWave"|"end";
  const stage = useRef<Stage>("start");
  const [levelState, setLevelState] = useState(1);
  const levelRef = useRef(levelState); useEffect(()=>{ levelRef.current = levelState; },[levelState]);

  type Eye = { x:number; y:number; vx:number; vy:number; alive:boolean };
  const eyes = useRef<Eye[]>([]);

  const intro = useRef({ step:0, t:0 });

  // clavier
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (["ArrowLeft","ArrowRight"," ","Space","m","M","h","H","p","P"].includes(e.key)) e.preventDefault();
      if (inIntro) { if (e.key==="ArrowRight"){ intro.current.step=Math.min(5,intro.current.step+1); intro.current.t=0; } }
      else if (!summaryOpen) {
        if (e.key==="ArrowLeft") keys.current.left=true;
        if (e.key==="ArrowRight") keys.current.right=true;
        if (e.key===" "||e.key==="Space") keys.current.jump=true;
      }
      if ((e.key==="p"||e.key==="P") && !inIntro && !summaryOpen) setPaused(v=>!v);
      if (e.key==="h"||e.key==="H") setHistoryMode(v=>!v);
      if (e.key==="m"||e.key==="M") toggleMusic();
    }
    function up(e: KeyboardEvent) {
      if (inIntro || summaryOpen) return;
      if (e.key==="ArrowLeft") keys.current.left=false;
      if (e.key==="ArrowRight") keys.current.right=false;
      if (e.key===" "||e.key==="Space") keys.current.jump=false;
    }
    window.addEventListener("keydown",down);
    window.addEventListener("keyup",up);
    return ()=>{ window.removeEventListener("keydown",down); window.removeEventListener("keyup",up); };
  }, [inIntro, summaryOpen]);

  // touch
  function press(name: "left"|"right"|"jump", v:boolean){ onScreenKeys.current[name]=v; }
  function clearTouchKeys(){ onScreenKeys.current={left:false,right:false,jump:false}; }

  // Start / reset
  function startGame(){ setInIntro(false); setSummaryOpen(false); setPaused(false); startMusicIfWanted(); }
  function resetLevel(goIntro=false){
    Object.assign(player.current,{ x:120,y:GROUND_Y-68,vx:0,vy:0,onGround:true,facing:1,speedMul:1.0,dirt:0,runPhase:0,coyote:0,jumpBuf:0 });
    inv.current={speed:false,purify:false,ward:false};
    wardTimer.current=0; stage.current="start";
    bear.current={ x:-999,y:GROUND_Y-60,w:64,h:60,vx:0,active:false };
    eyes.current=[]; heroState.current={name:"idle",t:0};
    setMessage("← → bouger | Espace sauter | P pause | H cours | M musique");
    setSummaryOpen(false); if(goIntro){ setInIntro(true); intro.current={step:0,t:0}; }
  }
  function nextLevel(){ setLevel(l=>l+1); setLevelState(v=>v+1); resetLevel(false); setPaused(false); }

  /* ---------- Boucle ---------- */
  const reqRef = useRef<number | null>(null);
  useEffect(() => {
    const ctx = ctxRef.current || canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let last = performance.now();
    const tick = (t:number) => {
      const dt = Math.min(33, t-last)/16.666; last=t;
      if (!paused) update(dt);
      render(ctx,t);
      reqRef.current = requestAnimationFrame(tick);
    };
    reqRef.current = requestAnimationFrame(tick);
    return ()=>{ if(reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [paused, inIntro, mobileMode]);

  const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

  // update
  function update(dt:number){
    if (inIntro || summaryOpen) {
      if (inIntro){ intro.current.t+=dt; if(intro.current.t>4){ intro.current.t=0; intro.current.step=Math.min(5,intro.current.step+1);} }
      return;
    }
    const p = player.current;

    // Inputs
    const left  = keys.current.left  || onScreenKeys.current.left;
    const right = keys.current.right || onScreenKeys.current.right || (mobileMode && oneButton);
    const jump  = keys.current.jump  || onScreenKeys.current.jump;

    // Horizontal
    let ax=0; if(left){ax-=1;p.facing=-1;} if(right){ax+=1;p.facing=1;}
    const targetVx = ax * p.baseSpeed * p.speedMul;
    p.vx += (targetVx - p.vx) * 0.4;

    // Coyote/buffer
    p.coyote = p.onGround ? 0.12 : Math.max(0, p.coyote - dt*0.016);
    p.jumpBuf = jump ? 0.12 : Math.max(0, p.jumpBuf - dt*0.016);

    // Gravité + saut
    p.vy += 0.8 * dt;
    if (p.jumpBuf>0 && (p.coyote>0 || p.onGround)) { p.vy=-14; p.onGround=false; p.coyote=0; p.jumpBuf=0; playOne(sfxJumpEl); }

    // Intégration
    p.x += (p.vx * dt * 60)/60;
    p.y += (p.vy * dt * 60)/60;

    // Sol
    if (p.y + p.h >= GROUND_Y){ p.y=GROUND_Y-p.h; p.vy=0; if(!p.onGround) p.onGround=true; } else p.onGround=false;

    // Limites
    p.x = clamp(p.x, 0, WORLD_LEN-1);
    p.runPhase += Math.abs(p.vx)*dt*0.4;

    // Bouclier
    if (wardTimer.current>0) wardTimer.current=Math.max(0, wardTimer.current - dt*0.016);

    // Anim héros
    const nextName: "idle"|"run"|"jump" = !p.onGround ? "jump" : (Math.abs(p.vx)>0.5 ? "run" : "idle");
    if (heroState.current.name !== nextName) heroState.current = { name: nextName, t: 0 };
    else heroState.current.t += dt * ANIM_SPEED;

    // Script d'événements
    if (stage.current==="start" && p.x > 900-20) {
      stage.current="speedAmulet"; p.speedMul=1.6; inv.current.speed=true;
      setMessage("Amulette de vitesse trouvée ! → cours !"); playOne(sfxCatchEl);
      setTimeout(()=>{ stage.current="bearChase"; bear.current.active=true; bear.current.x=p.x-300; bear.current.vx=2.8; setMessage("Un ours te poursuit !"); }, 500);
    }
    if (stage.current==="bearChase" && bear.current.active) {
      const d=p.x-bear.current.x, diff=0.2*(levelRef.current-1);
      const desired = d>260?3.2+diff : d<140?2.2+diff : 2.8+diff;
      bear.current.vx += (desired - bear.current.vx)*0.04;
      bear.current.x += (bear.current.vx * dt * 60)/60;
      if (bearAnim.current) bearAnim.current.t += dt * ANIM_SPEED;
      p.dirt = clamp(p.dirt + 0.002*dt, 0, 1);
      if (bear.current.x + bear.current.w > p.x + 10) bear.current.x = p.x - 320;
      if (p.x > 2000){ stage.current="postChase"; bear.current.active=false; p.speedMul=1.2; setMessage("Tu t’es échappé !"); }
    }
    if (stage.current==="postChase" && p.x > 2200-20) {
      stage.current="purifyAmulet"; inv.current.purify=true; playOne(sfxCatchEl);
      const clean=()=>{ player.current.dirt=Math.max(0, player.current.dirt-0.05); if(player.current.dirt>0) requestAnimationFrame(clean); };
      requestAnimationFrame(clean);
      if (historyMode) showHistory("Purification symbolique/amuletique attestée dans l’Antiquité.");
    }
    if ((stage.current==="purifyAmulet"||stage.current==="postChase") && p.x > 3100-20) {
      stage.current="wardAmulet"; inv.current.ward=true; wardTimer.current=10; playOne(sfxCatchEl);
      setMessage("Bouclier apotropaïque (temporaire) !");
    }
    if ((stage.current==="wardAmulet"||stage.current==="purifyAmulet") && p.x > 3200) {
      stage.current="evilEyeWave";
      const n=6+(levelRef.current-1)*4;
      for(let i=0;i<n;i++)
        eyes.current.push({ x:p.x+240+i*90, y:GROUND_Y-100-((i%3)*30), vx:-(2.2+((i%3)*0.4)+0.1*(levelRef.current-1)), vy:0, alive:true });
      setMessage("Vague du ‘mauvais œil’ !");
    }
    if (eyes.current.length){
      for(const e of eyes.current){
        if(!e.alive) continue;
        e.x += (e.vx * dt * 60)/60;
        if (rectOverlap(e.x-10,e.y-6,20,12, p.x,p.y,p.w,p.h)) {
          if (wardTimer.current>0){ e.vx=-e.vx*0.6; e.x+=e.vx*4; e.alive=false; }
          else { p.speedMul=Math.max(0.8,p.speedMul-0.2); setTimeout(()=>p.speedMul=Math.min(1.2,p.speedMul+0.2),1500); e.alive=false; playOne(sfxOuchEl); }
        }
      }
      eyes.current = eyes.current.filter(e=>e.alive && e.x>-100);
      if (eyes.current.length===0 && stage.current==="evilEyeWave") { stage.current="end"; setMessage("Fin de démo — continue jusqu’au bout →"); }
    }
    if (p.x >= WORLD_LEN-80 && !summaryOpen) { setPaused(true); setSummaryOpen(true); }
  }

  function rectOverlap(ax:number,ay:number,aw:number,ah:number, bx:number,by:number,bw:number,bh:number){
    return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
  }

  /* ---------- Rendu ---------- */
  const historyPopup = useRef<{ text:string; until:number }|null>(null);
  function showHistory(text:string){ historyPopup.current={text,until:performance.now()+4200}; }

  function render(ctx:CanvasRenderingContext2D, t:number){
    if (!ctx) return;
    if (inIntro) return renderIntro(ctx,t);

    const p = player.current;
    const camX = Math.max(0, Math.min(WORLD_LEN - WORLD_W, p.x - WORLD_W*0.35));

    // fond
    ctx.clearRect(0,0,WORLD_W,WORLD_H);
    const g=ctx.createLinearGradient(0,0,0,WORLD_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
    ctx.fillStyle=g; ctx.fillRect(0,0,WORLD_W,WORLD_H);

    drawMountains(ctx, camX*0.2);
    drawOliveTrees(ctx, camX*0.5);
    drawFrieze(ctx, camX*0.8);

    ctx.fillStyle="#ede9fe"; ctx.fillRect(0,GROUND_Y,WORLD_W,WORLD_H-GROUND_Y);

    ctx.save(); ctx.translate(-camX,0);
    for(let x=300;x<WORLD_LEN;x+=420) drawColumn(ctx,x,GROUND_Y);

    drawAmulet(ctx, 900,  GROUND_Y-40, "Vitesse", amuletsRef.current.speed);
    drawAmulet(ctx, 2200, GROUND_Y-40, "Purif.",  amuletsRef.current.purify);
    drawAmulet(ctx, 3100, GROUND_Y-40, "Bouclier",amuletsRef.current.ward);

    if (bear.current.active) drawBear(ctx, bear.current.x, bear.current.y);

    for(const e of eyes.current) if(e.alive) drawEvilEye(ctx,e.x,e.y);

    drawHero(ctx, p.x,p.y,p.w,p.h,p.facing,p.dirt,p.runPhase,wardTimer.current);

    ctx.fillStyle="#94a3b8"; ctx.fillRect(WORLD_LEN-40, GROUND_Y-120, 8, 120);
    ctx.restore();

    drawHUD(ctx);

    if (historyMode && historyPopup.current && performance.now()<historyPopup.current.until){
      const txt=historyPopup.current.text; ctx.save(); ctx.globalAlpha=.95;
      ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2;
      const boxW=Math.min(680,WORLD_W-40), x=(WORLD_W-boxW)/2, y=WORLD_H-130;
      ctx.fillRect(x,y,boxW,80); ctx.strokeRect(x,y,boxW,80);
      ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
      wrapText(ctx,txt,x+12,y+26,boxW-24,18); ctx.restore();
    }

    ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
    ctx.fillText(message,16,26); ctx.fillText("P pause | H cours | M musique",16,46);
  }

  function renderIntro(ctx:CanvasRenderingContext2D,_t:number){
    const step=intro.current.step, tt=intro.current.t;
    ctx.clearRect(0,0,WORLD_W,WORLD_H);
    const g=ctx.createLinearGradient(0,0,0,WORLD_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
    ctx.fillStyle=g; ctx.fillRect(0,0,WORLD_W,WORLD_H);
    drawMountains(ctx,0); drawOliveTrees(ctx,0); drawFrieze(ctx,0);

    ctx.save(); ctx.globalAlpha=.92; ctx.fillStyle="#fff"; ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=2;
    ctx.fillRect(40,40,WORLD_W-80,WORLD_H-160); ctx.strokeRect(40,40,WORLD_W-80,WORLD_H-160); ctx.restore();

    ctx.fillStyle="#0f172a"; ctx.font="22px ui-sans-serif, system-ui";
    function center(txt:string,y:number){ ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(txt,WORLD_W/2,y); ctx.textAlign="start"; ctx.textBaseline="alphabetic"; }

    if (step===0){ center("Grèce antique — De l’os à l’amulette",120); ctx.font="14px ui-sans-serif, system-ui"; center("→ pour avancer • puis Start",WORLD_H-72); drawSheepSil(ctx,220,260,480,200); drawTalusGlow(ctx,540,378); center("Astragale (talus) — os du tarse",360); }
    if (step===1){ center("Extraction post-abattage",120); drawSheepSil(ctx,220,260,480,200); const k=Math.min(1,tt/3); const sx=540,sy=378, ex=sx+120,ey=sy-60; drawTalusGlow(ctx,sx,sy,0.25); drawAstragalusIcon(ctx, sx+(ex-sx)*k, sy+(ey-sy)*k, 20); center("L’os est prélevé puis travaillé.",360); }
    if (step===2){ center("Nettoyage & polissage",120); const cx=WORLD_W/2,cy=260; drawAstragalusIcon(ctx,cx,cy,26); for(let i=0;i<8;i++){ const a=(i/8)*Math.PI*2+tt*0.4; ctx.strokeStyle="#a3e635"; ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*36, cy+Math.sin(a)*36); ctx.lineTo(cx+Math.cos(a)*46, cy+Math.sin(a)*46); ctx.stroke(); } center("L’os devient portable.",360); }
    if (step===3){ center("Perçage (suspension)",120); const cx=WORLD_W/2,cy=260; drawAstragalusIcon(ctx,cx,cy,26); ctx.fillStyle="#64748b"; ctx.fillRect(cx-4, cy-60, 8, 36); ctx.beginPath(); ctx.moveTo(cx-8, cy-24); ctx.lineTo(cx+8, cy-24); ctx.lineTo(cx, cy-40); ctx.closePath(); ctx.fill(); ctx.fillStyle="#7c2d12"; ctx.beginPath(); ctx.arc(cx, cy-6, 2, 0, Math.PI*2); ctx.fill(); center("Trou discret pour enfiler un lien.",360); }
    if (step===4){ center("Montage en collier / amulette",120); const cx=WORLD_W/2,cy=260; ctx.strokeStyle="#6b7280"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx-80, cy-30); ctx.quadraticCurveTo(cx, cy-60, cx+80, cy-30); ctx.stroke(); drawAstragalusIcon(ctx,cx,cy,26); center("Clique Start pour jouer →",360); }
    if (step>=5){ center("Prêt ? Clique Start pour jouer.", WORLD_H/2); }
  }

  /* ---------- Primitifs de dessin ---------- */
  function drawColumn(ctx:CanvasRenderingContext2D, baseX:number, groundY:number){
    ctx.save(); ctx.translate(baseX,0);
    ctx.fillStyle="#e5e7eb"; ctx.fillRect(-12, groundY-140, 24, 140);
    ctx.fillStyle="#cbd5e1"; ctx.fillRect(-18, groundY-140, 36, 10); ctx.fillRect(-18, groundY-10, 36, 10);
    ctx.restore();
  }

  function drawAmulet(ctx:CanvasRenderingContext2D, x:number, y:number, label:string, png?:HTMLImageElement|null){
    ctx.save(); ctx.translate(x,y);
    // chaîne / suspension
    ctx.strokeStyle="#6b7280"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-18,-12); ctx.quadraticCurveTo(0,-24-6*Math.sin(performance.now()*0.002),18,-12); ctx.stroke();

    if (png) {
      // Dessine le PNG (64x64 recommandé)
      const s = 1.0;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(png, -32*s, -32*s, 64*s, 64*s);
    } else {
      // Fallback vectoriel
      const grd = ctx.createRadialGradient(0,0,2,0,0,18); grd.addColorStop(0,"rgba(20,184,166,0.8)"); grd.addColorStop(1,"rgba(20,184,166,0)");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2.5; ctx.beginPath(); ctx.ellipse(0,0,14,10,0,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.quadraticCurveTo(0,-6,10,0); ctx.moveTo(-10,0); ctx.quadraticCurveTo(0,6,10,0); ctx.stroke();
    }

    ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(label, 0, 30);
    ctx.restore();
  }

  function drawAmuletMini(ctx:CanvasRenderingContext2D,cx:number,cy:number, png?:HTMLImageElement|null){
    ctx.save(); ctx.translate(cx,cy);
    if (png) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(png, -16, -16, 32, 32);
    } else {
      ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7,0); ctx.quadraticCurveTo(0,-4,7,0); ctx.moveTo(-7,0); ctx.quadraticCurveTo(0,4,7,0); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBear(ctx:CanvasRenderingContext2D, x:number, y:number){
    const ba = bearAnim.current;
    const W0=64, H0=60;
    const Wd = Math.round(W0 * BEAR_SCALE);
    const Hd = Math.round(H0 * BEAR_SCALE);

    ctx.save();
    ctx.translate(x, y + H0); // ancrage au sol

    if (ba && ba.frames.length){
      const fps = 10 * ANIM_SPEED;
      let idx = Math.floor((ba.t||0) * fps) % ba.frames.length;
      if (!isFinite(idx) || idx<0) idx=0;
      const im = ba.frames[idx];
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, 0,0, im.naturalWidth, im.naturalHeight, 0, -Hd, Wd, Hd);
    } else {
      ctx.fillStyle="#78350f"; ctx.fillRect(0, -Hd+20*BEAR_SCALE, Wd, Hd-24*BEAR_SCALE);
      ctx.beginPath(); ctx.arc(Wd-10*BEAR_SCALE, -Hd+26*BEAR_SCALE, 14*BEAR_SCALE, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle="#fde68a"; ctx.fillRect(Wd-6*BEAR_SCALE, -Hd+22*BEAR_SCALE, 3*BEAR_SCALE, 3*BEAR_SCALE);
    }
    ctx.restore();
  }

  function drawEvilEye(ctx:CanvasRenderingContext2D, x:number, y:number){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle="#1d4ed8"; ctx.beginPath(); ctx.ellipse(0,0,14,9,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#93c5fd"; ctx.beginPath(); ctx.ellipse(0,0,9,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#0f172a"; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawHero(ctx:CanvasRenderingContext2D, x:number,y:number,w:number,h:number,facing:number,dirt:number,runPhase:number,wardLeft:number){
    ctx.save();

    const dw = Math.round(w * HERO_SCALE);
    const dh = Math.round(h * HERO_SCALE);
    ctx.translate(x + w/2, y + h); // ancrage bas-centre

    if (wardLeft>0){
      const pct=Math.min(1,wardLeft/10); const rad=44*HERO_SCALE+6*Math.sin(performance.now()*0.006);
      const grd=ctx.createRadialGradient(0,0,10, 0,0,rad);
      grd.addColorStop(0,`rgba(56,189,248,${0.25+0.25*pct})`); grd.addColorStop(1,"rgba(56,189,248,0)");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,rad,0,Math.PI*2); ctx.fill();
    }

    const anim = heroAnim.current;
    const clip = anim?.clips[heroState.current.name];

    if (clip && clip.frames && clip.frames.length) {
      const count = clip.frames.length;
      let fps = Number(clip.fps) || 10;
      let tt = Number(heroState.current.t) || 0;
      let idx = Math.floor(tt * fps);
      if (!isFinite(idx) || idx < 0) idx = 0;
      idx = clip.loop ? (idx % count) : Math.min(idx, count-1);
      const fr = clip.frames[idx] ?? clip.frames[0];

      if (facing<0){ ctx.scale(-1,1); }
      const ox = anim!.origin?.[0] ?? 0.5, oy = anim!.origin?.[1] ?? 1;
      const dx = -ox * dw, dy = -oy * dh;

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fr.image, fr.sx|0, fr.sy|0, fr.sw||fr.image.naturalWidth, fr.sh||fr.image.naturalHeight, dx, dy, dw, dh);
    } else {
      // Fallback vectoriel (ancré bas-centre)
      if (facing<0){ ctx.scale(-1,1); }
      const legA = Math.sin(runPhase*8)*6, legB = Math.sin(runPhase*8+Math.PI)*6;
      ctx.translate(-dw/2, -dh);
      ctx.fillStyle="#1f2937"; ctx.fillRect(10+legA*0.2, dh-16, 8,16); ctx.fillRect(dw-18+legB*0.2, dh-16, 8,16);
      ctx.fillStyle="#92400e"; ctx.fillRect(10+legA*0.2, dh-2, 10,2); ctx.fillRect(dw-18+legB*0.2, dh-2, 10,2);
      ctx.fillStyle="#334155"; ctx.fillRect(8,28,dw-16,14);
      ctx.fillStyle="#e5e7eb"; ctx.beginPath(); ctx.moveTo(12,20); ctx.lineTo(dw-12,20); ctx.lineTo(dw-18,48); ctx.lineTo(18,48); ctx.closePath(); ctx.fill();
      ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=1; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(16+i*8,22); ctx.lineTo(20+i*8,46); ctx.stroke(); }
      ctx.strokeStyle="#eab308"; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(10,36); ctx.lineTo(dw-10,36); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(dw/2-8,22); ctx.quadraticCurveTo(dw/2,18,dw/2+8,22); ctx.stroke();
      ctx.fillStyle="#f8fafc"; ctx.beginPath(); ctx.arc(dw/2,12,8,0,Math.PI*2); ctx.fill();
    }

    if (dirt>0.01){ ctx.globalAlpha=Math.max(0,Math.min(dirt,0.8)); ctx.fillStyle="#9ca3af"; ctx.fillRect(-dw/2,-dh,dw,dh); ctx.globalAlpha=1; }
    ctx.restore();
  }

  function drawMountains(ctx:CanvasRenderingContext2D, off:number){
    ctx.save(); ctx.translate(-off,0);
    for(let x=-200;x<WORLD_W+WORLD_LEN;x+=420){
      ctx.fillStyle="#c7d2fe"; ctx.beginPath(); ctx.moveTo(x,380); ctx.lineTo(x+120,260); ctx.lineTo(x+240,380); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#bfdbfe"; ctx.beginPath(); ctx.moveTo(x+140,380); ctx.lineTo(x+260,280); ctx.lineTo(x+360,380); ctx.closePath(); ctx.fill();
    } ctx.restore();
  }
  function drawOliveTrees(ctx:CanvasRenderingContext2D, off:number){
    ctx.save(); ctx.translate(-off,0);
    for(let x=0;x<WORLD_W+WORLD_LEN;x+=260){ ctx.fillStyle="#a78bfa"; ctx.fillRect(x+40,GROUND_Y-60,8,60);
      ctx.fillStyle="#ddd6fe"; ctx.beginPath(); ctx.ellipse(x+44,GROUND_Y-75,26,16,0,0,Math.PI*2); ctx.fill();
    } ctx.restore();
  }
  function drawFrieze(ctx:CanvasRenderingContext2D, off:number){
    ctx.save(); ctx.translate(-off,0);
    for(let x=0;x<WORLD_W+WORLD_LEN;x+=180){ ctx.strokeStyle="#94a3b8"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,GROUND_Y-10);
      for(let i=0;i<6;i++){ const sx=x+i*24; ctx.lineTo(sx+12,GROUND_Y-18); ctx.lineTo(sx+24,GROUND_Y-10); }
      ctx.stroke();
    } ctx.restore();
  }
  function drawSheepSil(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle="#33415522"; ctx.strokeStyle="#334155"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,h*0.4); ctx.quadraticCurveTo(w*0.2,h*0.1,w*0.55,h*0.1);
    ctx.quadraticCurveTo(w*0.85,h*0.1,w,h*0.3); ctx.quadraticCurveTo(w*0.9,h*0.55,w*0.6,h*0.6);
    ctx.quadraticCurveTo(w*0.35,h*0.65,w*0.15,h*0.6); ctx.quadraticCurveTo(0,h*0.55,0,h*0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#334155"; ctx.fillRect(w*0.2,h*0.6,10,h*0.4); ctx.fillRect(w*0.28,h*0.6,10,h*0.4); ctx.fillRect(w*0.72,h*0.6,10,h*0.4); ctx.fillRect(w*0.8,h*0.6,10,h*0.4);
    ctx.restore();
  }
  function drawTalusGlow(ctx:CanvasRenderingContext2D,x:number,y:number,str=1){
    const grd=ctx.createRadialGradient(x,y,2,x,y,44); grd.addColorStop(0,`rgba(20,184,166,${0.5*str})`); grd.addColorStop(1,"rgba(20,184,166,0)");
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(x,y,44,0,Math.PI*2); ctx.fill();
  }
  function drawAstragalusIcon(ctx:CanvasRenderingContext2D,x:number,y:number,R:number){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(0,0,R,R*0.72,0,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R*0.7,0); ctx.quadraticCurveTo(0,-R*0.38,R*0.7,0);
    ctx.moveTo(-R*0.7,0); ctx.quadraticCurveTo(0,R*0.38,R*0.7,0); ctx.stroke(); ctx.restore();
  }
  function drawHUD(ctx:CanvasRenderingContext2D){
    ctx.save(); ctx.globalAlpha=.95; ctx.fillStyle="#fff"; ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=2;
    ctx.fillRect(12,56,236,62); ctx.strokeRect(12,56,236,62);
    const slots=[{owned:inv.current.speed,label:"Vitesse",png:amuletsRef.current.speed},
                 {owned:inv.current.purify,label:"Purif.",png:amuletsRef.current.purify},
                 {owned:inv.current.ward,label:"Bouclier",png:amuletsRef.current.ward}];
    for(let i=0;i<slots.length;i++){
      const x=20+i*64; ctx.strokeStyle="#cbd5e1"; ctx.strokeRect(x,64,56,48);
      ctx.globalAlpha=slots[i].owned?1:.35; drawAmuletMini(ctx,x+28,88,slots[i].png||undefined); ctx.globalAlpha=1;
      ctx.fillStyle="#334155"; ctx.font="10px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(slots[i].label, x+28, 116);
    }
    ctx.fillStyle = musicOn ? "#16a34a" : "#ef4444"; ctx.beginPath(); ctx.arc(264,70,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#0f172a"; ctx.font="10px ui-sans-serif, system-ui"; ctx.fillText("Musique (M)", 278,74);
    ctx.fillStyle = historyMode ? "#16a34a" : "#ef4444"; ctx.beginPath(); ctx.arc(264,98,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#0f172a"; ctx.fillText("Cours (H)", 278,102);
    ctx.restore();
  }
  function wrapText(ctx:CanvasRenderingContext2D, text:string, x:number,y:number, maxW:number, lh:number){
    const words=text.split(" "); let line=""; for(let n=0;n<words.length;n++){ const test=line+words[n]+" "; if(ctx.measureText(test).width>maxW && n>0){ ctx.fillText(line,x,y); line=words[n]+" "; y+=lh; } else line=test; }
    ctx.fillText(line,x,y);
  }

  /* ---------- UI / JSX ---------- */
  const startBtnStyle: React.CSSProperties = { padding:"12px 18px", border:"1px solid #059669", borderRadius:14, background:"#059669", color:"#fff", cursor:"pointer", boxShadow:"0 6px 14px rgba(5,150,105,.25)", position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)", zIndex:5 };

  function btn(disabled=false){ return ({ padding:"8px 12px", border:"1px solid #e5e7eb", borderRadius:12, background:"#fff", cursor:disabled?"default":"pointer", opacity: disabled ? .5 : 1 }) as React.CSSProperties; }
  function btnDark(){ return ({ padding:"8px 12px", border:"1px solid #111827", borderRadius:12, background:"#111827", color:"#fff", cursor:"pointer" }) as React.CSSProperties; }
  function primaryBtn(disabled=false){ return ({ padding:"10px 14px", border:"1px solid #059669", borderRadius:14, background:"#059669", color:"#fff", cursor:disabled?"default":"pointer", opacity: disabled ? .5 : 1, boxShadow:"0 6px 14px rgba(5,150,105,.25)" }) as React.CSSProperties; }

  function TouchBtn(props:{label:string; onDown:()=>void; onUp:()=>void;}){
    const events = {
      onMouseDown: props.onDown, onMouseUp: props.onUp, onMouseLeave: props.onUp,
      onTouchStart: (e:React.TouchEvent)=>{ e.preventDefault(); props.onDown(); },
      onTouchEnd:   (e:React.TouchEvent)=>{ e.preventDefault(); props.onUp(); },
      onPointerDown:(e:React.PointerEvent)=>{ if(e.pointerType!=="mouse") props.onDown(); },
      onPointerUp:  (e:React.PointerEvent)=>{ if(e.pointerType!=="mouse") props.onUp(); },
    };
    return (
      <button {...events} style={{ pointerEvents:"auto", flex:"1 1 0", padding:"14px 10px", border:"1px solid #e5e7eb", borderRadius:14, background:"#ffffffEE", fontWeight:600 }}>
        {props.label}
      </button>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#fafaf9,#e7e5e4)", color:"#111827"}}>
      <div className="max-w-5xl mx-auto" style={{padding:"16px"}}>
        <div className="mb-2" style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between"}}>
          <h1 className="text-xl sm:text-2xl" style={{fontWeight:600}}>Runner 2D – Amulettes d’astragale</h1>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button onClick={()=>setHistoryMode(v=>!v)} style={btn()}> {historyMode ? "Cours ON" : "Cours OFF"} </button>
            <button onClick={toggleMusic} style={btn()}> {musicOn ? "Musique ON" : "Musique OFF"} </button>
            <button onClick={()=>setPaused(v=>!v)} disabled={inIntro||summaryOpen} style={primaryBtn(inIntro||summaryOpen)}>{paused ? "Lecture" : "Pause"}</button>
            <label style={btn()}>
              <input type="checkbox" checked={mobileMode} onChange={e=>{ setMobileMode(e.target.checked); clearTouchKeys(); }} />
              <span style={{marginLeft:6}}>Mode mobile</span>
            </label>
            {mobileMode && (
              <label style={btn()}>
                <input type="checkbox" checked={oneButton} onChange={e=>setOneButton(e.target.checked)} />
                <span style={{marginLeft:6}}>1 bouton</span>
              </label>
            )}
          </div>
        </div>

        <p className="text-sm" style={{color:"#475569", marginBottom:12}}>
          {inIntro ? "Cinématique d’intro : → pour avancer. Clique Start (dans le cadre) pour lancer le jeu."
                   : "← → bouger • Espace sauter • P pause • H cours • M musique. Sur mobile, active le mode mobile."}
        </p>

        <div className="bg-white" style={{border:"1px solid #e5e7eb", borderRadius:14, padding:12, boxShadow:"0 6px 16px rgba(0,0,0,.05)"}}>
          <div ref={wrapperRef} className="w-full" style={{position:"relative", overflow:"hidden", border:"1px solid #e5e7eb", borderRadius:12}}>
            {/* Canvas responsive (ratio 16:9, net via DPR) */}
            <canvas ref={canvasRef} />

            {inIntro && <button onClick={startGame} style={startBtnStyle}>Start</button>}

            {summaryOpen && (
              <div style={{position:"absolute", inset:0, background:"rgba(255,255,255,.95)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24}}>
                <div style={{width:"min(860px,100%)", background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:16, boxShadow:"0 8px 24px rgba(0,0,0,.08)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <h2 style={{fontWeight:600}}>Fin du niveau {level} ✅</h2>
                    <span style={{fontSize:12, padding:"2px 8px", borderRadius:999, background:"#111827", color:"#fff"}}>Mode amulette</span>
                  </div>
                  <div style={{display:"grid", gap:12, gridTemplateColumns:"1fr 1fr", marginTop:12}}>
                    <div style={{background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:12, padding:12, fontSize:14}}>
                      <h3 style={{fontWeight:600, marginBottom:8}}>Ce que tu as vu</h3>
                      <ul style={{paddingLeft:18, margin:0}}>
                        <li>Astragale = <em>talus</em>, os du tarse postérieur.</li>
                        <li>Usages symboliques/amuletiques (chance, purification, apotropaïque).</li>
                        <li>Fabrication : extraction → nettoyage/polissage → perçage → collier.</li>
                      </ul>
                    </div>
                    <div style={{background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:12, padding:12, fontSize:14}}>
                      <h3 style={{fontWeight:600, marginBottom:8}}>Questions flash</h3>
                      <ol style={{paddingLeft:18, margin:0}}>
                        <li>V/F : l’astragale est un os du tarse.</li>
                        <li>Il s’articule avec : tibia / crâne / humérus.</li>
                        <li>Donne un usage amulette/protection vu dans le niveau.</li>
                        <li>Pourquoi percer l’osselet avant de le porter ?</li>
                      </ol>
                    </div>
                  </div>
                  <div style={{display:"flex", gap:8, justifyContent:"end", marginTop:12}}>
                    <button onClick={()=>{ resetLevel(true); setPaused(false); }} style={btn()}>Revoir la cinématique</button>
                    <button onClick={()=>{ resetLevel(false); setPaused(false); }} style={btnDark()}>Recommencer</button>
                    <button onClick={nextLevel} style={primaryBtn(false)}>Prochain niveau →</button>
                  </div>
                </div>
              </div>
            )}

            {/* Contrôles mobiles */}
            {mobileMode && !inIntro && !summaryOpen && (
              <>
                {!oneButton && (
                  <div style={{position:"absolute", left:12, right:12, bottom:12, display:"flex", gap:12, justifyContent:"space-between", pointerEvents:"none"}}>
                    <TouchBtn label="←" onDown={()=>press("left",true)} onUp={()=>press("left",false)} />
                    <TouchBtn label="Saut" onDown={()=>press("jump",true)} onUp={()=>press("jump",false)} />
                    <TouchBtn label="→" onDown={()=>press("right",true)} onUp={()=>press("right",false)} />
                  </div>
                )}
                {oneButton && (
                  <div onPointerDown={()=>press("jump",true)} onPointerUp={()=>press("jump",false)} style={{position:"absolute", inset:0, pointerEvents:"auto"}} />
                )}
              </>
            )}

            {/* Audio MP3 */}
            <audio ref={musicEl} preload="auto" src={AUDIO_BASE + AUDIO.music} />
            <audio ref={sfxJumpEl} preload="auto" src={AUDIO_BASE + AUDIO.jump} />
            <audio ref={sfxCatchEl} preload="auto" src={AUDIO_BASE + AUDIO.catch} />
            <audio ref={sfxOuchEl} preload="auto" src={AUDIO_BASE + AUDIO.ouch} />
          </div>

          <div style={{fontSize:12, color:"#6b7280", marginTop:8}}>
            Héros via <code>hero.anim.json</code>. Ours via <code>bear.anim.json</code> ou fichiers <code>bear(1..6).png</code>/<code>bear (1..6).png</code>.  
            Amulettes PNG utilisées : <code>{AMULET_FILES.speed}</code>, <code>{AMULET_FILES.purify}</code>, <code>{AMULET_FILES.ward}</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

// Expose
// @ts-ignore
(window as any).AstragalusRunner = AstragalusRunner;
