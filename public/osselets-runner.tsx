// public/osselets-runner.tsx
// Runner 2D – Amulettes d’astragale (LEVEL 1)
// - Panneau d’intro bien CENTRÉ + bouton Start
// - Screenshot d’accueil optionnel (start-screenshot.webp/png/jpg)
// - MP3 only, amulettes PNG, ours 6 PNG ou bear.anim.json
// - Bulles/toasts pédagogiques, résumé fin de niveau, chainage niveau suivant

const { useEffect, useRef, useState } = React;

/* -------------------- Chemins & assets -------------------- */
const IMG_BASES = [
  "/assets/games/osselets/audio/img/", // emplacement actuel
  "/assets/games/osselets/img/",       // fallback si tu déplaces plus tard
];
const AUDIO_BASE = "/assets/games/osselets/audio/";

const AUDIO = { // MP3 uniquement
  music: "game-music-1.mp3",
  jump:  "jump-sound.mp3",
  catch: "catch-sound.mp3",
  ouch:  "ouch-sound.mp3",
};

// PNG amulettes
const AMULET_FILES = {
  speed:  "amulette-speed.png",
  purify: "amulette-purify.png",
  ward:   "amulette-ward.png",
};

// Screenshot d’accueil (optionnel) recherché avant Start
const START_SCREENSHOT_CANDIDATES = [
  "start-screenshot.webp",
  "start-screenshot.png",
  "start-screenshot.jpg",
];

/* -------------------- Réglages visuels/jeux -------------------- */
const WORLD_W = 960;
const WORLD_H = 540;

// Animations plus lentes (tes valeurs)
const ANIM_SPEED = 0.10;

// “Épaisseur” du héros + correction du flottement (tes valeurs)
const HERO_SCALE_X = 1.70;     // largeur visuelle
const HERO_SCALE_Y = 1.50;     // hauteur visuelle
const HERO_FOOT_ADJ_PX = 12;   // + vers le bas

const BEAR_SCALE = 1.5;

const GROUND_Y  = 440;
const WORLD_LEN = 4200;

/* -------------------- Utils chargement -------------------- */
function logOnce(key, ...args) {
  const k = `__once_${key}`;
  if (window[k]) return; window[k] = true; console.warn(...args);
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`img load failed: ${url}`));
    im.src = encodeURI(url);
  });
}
async function loadImageSmart(file) {
  for (const base of IMG_BASES) {
    try { return await loadImage(base + file); } catch {}
  }
  logOnce(`img_${file}`, `[osselets] image introuvable: ${file} (essayé: ${IMG_BASES.map(b=>b+file).join(", ")})`);
  return null;
}
async function fetchJSON(file) {
  for (const base of IMG_BASES) {
    try { const r = await fetch(base + file, { cache: "no-store" }); if (r.ok) return await r.json(); } catch {}
  }
  return null;
}

/* -------------------- Types “douces” (compat TSX) -------------------- */
// (on laisse volontairement les types légers pour Babel in-browser)
/// <reference path="" />
/** @typedef {{ image: HTMLImageElement, sx:number, sy:number, sw:number, sh:number }} FrameRect */
/** @typedef {{ frames: FrameRect[], fps:number, loop:boolean, name?:string }} Clip */

/* ============================================================ */

function AstragalusRunner() {
  /* ---------- Canvas responsive + DPR ---------- */
  const wrapperRef = useRef(null);
  const canvasRef  = useRef(null);
  const ctxRef     = useRef(null);

  useEffect(() => {
    function resize() {
      const wrap = wrapperRef.current, cv = canvasRef.current; if (!wrap || !cv) return;
      const rectW = wrap.clientWidth, targetW = rectW, targetH = Math.round(targetW * (WORLD_H / WORLD_W));
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      cv.width  = Math.floor(targetW * dpr);
      cv.height = Math.floor(targetH * dpr);
      cv.style.width  = `${targetW}px`;
      cv.style.height = `${targetH}px`;
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctxRef.current = ctx;
        ctx.setTransform(0,0,0,0,0,0);
        const scale = (targetW * dpr) / WORLD_W;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    window.addEventListener("resize", resize);
    return () => { ro.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  /* ---------- UI états ---------- */
  const [inIntro, setInIntro]         = useState(true);
  const [paused, setPaused]           = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [level, setLevel]             = useState(1);
  const [message, setMessage]         = useState("← → bouger | Espace sauter | P pause | M musique");

  // Mobile auto
  const autoCoarse = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false;
  const [mobileMode, setMobileMode]  = useState(!!autoCoarse);
  const [oneButton, setOneButton]    = useState(false);
  const onScreenKeys = useRef({ left:false, right:false, jump:false });

  // Audio
  const [musicOn, setMusicOn] = useState(true);
  const musicEl   = useRef(null);
  const sfxJumpEl = useRef(null);
  const sfxCatchEl= useRef(null);
  const sfxOuchEl = useRef(null);
  const startedOnce = useRef(false);

  // --- Pickup bubbles (mini speech balloons) ---
  const bubbles = useRef([]);
  function addBubble(worldX, worldY, text, ms=2200){
    bubbles.current.push({ x:worldX, y:worldY, text, until: performance.now()+ms });
  }

  function startMusicIfWanted(){
    const el = musicEl.current; if(!el) return;
    el.loop = true; el.volume = 0.35; el.muted = !musicOn;
    if (musicOn) el.play().catch(()=>{});
  }
  function toggleMusic(){
    const el = musicEl.current;
    setMusicOn(v=>{
      const n = !v;
      if (el){ el.muted = !n; if (n && el.paused) el.play().catch(()=>{}); }
      return n;
    });
  }
  function playOne(ref){
    const el = ref.current; if(!el) return;
    try{ el.currentTime=0; el.play().catch(()=>{});}catch{}
  }
  useEffect(() => {
    function firstInteract(){ if (!startedOnce.current) { startedOnce.current = true; startMusicIfWanted(); } }
    window.addEventListener("pointerdown", firstInteract, { once: true });
    window.addEventListener("keydown", firstInteract, { once: true });
    return () => {
      window.removeEventListener("pointerdown", firstInteract);
      window.removeEventListener("keydown", firstInteract);
    };
  }, []);

  /* ---------- Screenshot d’accueil (optionnel) ---------- */
  const startShotRef = useRef(null);
  useEffect(() => { (async ()=>{
    for (const name of START_SCREENSHOT_CANDIDATES) {
      const im = await loadImageSmart(name);
      if (im) { startShotRef.current = im; break; }
    }
  })(); }, []);

  /* ---------- Héros & animations ---------- */
  const heroAnim = useRef(null);
  const heroState = useRef({ name: "idle", t: 0 });

  useEffect(() => {
    let canceled = false;
    (async () => {
      const j = await fetchJSON("hero.anim.json"); if (canceled) return;
      if (!j) { heroAnim.current = null; logOnce("herojson","[osselets] hero.anim.json introuvable"); return; }
      const origin = j.origin ?? [0.5, 1];
      const baseFS = j.frameSize ?? [64,64];
      const clips = {};
      async function buildClip(name, def) {
        if (def?.files) { // liste de PNG
          const imgs = (await Promise.all(def.files.map((f)=>loadImageSmart(f)))).filter(Boolean);
          if (!imgs.length) return null;
          return { frames: imgs.map(im=>({image:im,sx:0,sy:0,sw:im.naturalWidth,sh:im.naturalHeight})), fps: Number(def.fps)||10, loop: !!def.loop, name };
        }
        if (def?.src && (def?.rects || def?.frames)) {
          const img = await loadImageSmart(def.src); if (!img) return null;
          if (def.rects) {
            const frames = def.rects.map((r)=>({ image: img, sx:r.x, sy:r.y, sw:r.w, sh:r.h }));
            return { frames, fps: Number(def.fps)||10, loop: !!def.loop, name };
          } else {
            const fs = def.frameSize ?? baseFS; const fw = fs[0], fh = fs[1]; const frames=[];
            for (let i=0;i<def.frames;i++){ frames.push({ image:img, sx:i*fw, sy:0, sw:fw, sh:fh }); }
            return { frames, fps: Number(def.fps)||10, loop: !!def.loop, name };
          }
        }
        return null;
      }
      for (const key of Object.keys(j.animations ?? {})) {
        const clip = await buildClip(key, j.animations[key]);
        if (clip) clips[key] = clip;
      }
      heroAnim.current = { clips, origin, frameSize: baseFS };
    })();
    return ()=>{ canceled=true; };
  }, []);

  /* ---------- Ours (6 PNG ou bear.anim.json) ---------- */
  const bearAnim = useRef(null);
  useEffect(() => {
    let canceled = false;
    (async () => {
      const j = await fetchJSON("bear.anim.json");
      if (j?.files) {
        const frames = (await Promise.all(j.files.map((f)=>loadImageSmart(f)))).filter(Boolean);
        if (frames.length) { bearAnim.current = { frames, t:0 }; return; }
      }
      const withSpace = await Promise.all([1,2,3,4,5,6].map(i=>loadImageSmart(`bear (${i}).png`)));
      let imgs = withSpace.filter(Boolean);
      if (!imgs.length) { const noSpace = await Promise.all([1,2,3,4,5,6].map(i=>loadImageSmart(`bear(${i}).png`))); imgs = noSpace.filter(Boolean); }
      bearAnim.current = imgs.length ? { frames: imgs, t: 0 } : null;
    })();
    return ()=>{ canceled=true; };
  }, []);

  /* ---------- PNG amulettes ---------- */
  const amuletsRef = useRef({});
  useEffect(() => { (async () => {
    amuletsRef.current.speed  = await loadImageSmart(AMULET_FILES.speed);
    amuletsRef.current.purify = await loadImageSmart(AMULET_FILES.purify);
    amuletsRef.current.ward   = await loadImageSmart(AMULET_FILES.ward);
  })(); }, []);

  /* ---------- Monde & gameplay ---------- */
  const player = useRef({ x:120, y:GROUND_Y-68, w:42, h:68, vx:0, vy:0, onGround:true, facing:1,
                          baseSpeed:3.0, speedMul:1.0, dirt:0, runPhase:0, coyote:0, jumpBuf:0 });
  const inv = useRef({ speed:false, purify:false, ward:false });
  const wardTimer = useRef(0);
  const keys = useRef({});

  const bear = useRef({ x:-999, y:GROUND_Y-60, w:64, h:60, vx:0, active:false });
  const stage = useRef("start");
  const [levelState, setLevelState] = useState(1);
  const levelRef = useRef(levelState); useEffect(()=>{ levelRef.current = levelState; },[levelState]);

  const eyes = useRef([]);
  const intro = useRef({ step:0, t:0 });

  // ===== Nouvel overlay éducatif court (toasts) =====
  const [edu, setEdu] = useState(null);
  const eduLog = useRef([]);
  function pushEdu(msg, ms=4800){
    const until = performance.now()+ms; setEdu({msg, until});
    if (!eduLog.current.length || eduLog.current[eduLog.current.length-1] !== msg){
      eduLog.current.push(msg); if (eduLog.current.length>8) eduLog.current.shift();
    }
  }
  const eduSeen = useRef({ speed:false, purify:false, ward:false });

  // clavier
  useEffect(() => {
    function down(e) {
      if (["ArrowLeft","ArrowRight"," ","Space","m","M","p","P"].includes(e.key)) e.preventDefault();
      if (inIntro) {
        if (e.key==="ArrowRight"){ intro.current.step=Math.min(5,intro.current.step+1); intro.current.t=0; }
      } else if (!summaryOpen) {
        if (e.key==="ArrowLeft") keys.current.left=true;
        if (e.key==="ArrowRight") keys.current.right=true;
        if (e.key===" "||e.key==="Space") keys.current.jump=true;
      }
      if ((e.key==="p"||e.key==="P") && !inIntro && !summaryOpen) setPaused(v=>!v);
      if (e.key==="m"||e.key==="M") toggleMusic();
    }
    function up(e) {
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
  function press(name, v){ onScreenKeys.current[name]=v; }
  function clearTouchKeys(){ onScreenKeys.current={left:false,right:false,jump:false}; }

  // Start / reset
  function startGame(){ setInIntro(false); setSummaryOpen(false); setPaused(false); startMusicIfWanted(); }
  function resetLevel(goIntro=false){
    Object.assign(player.current,{ x:120,y:GROUND_Y-68,vx:0,vy:0,onGround:true,facing:1,speedMul:1.0,dirt:0,runPhase:0,coyote:0,jumpBuf:0 });
    inv.current={speed:false,purify:false,ward:false};
    wardTimer.current=0; stage.current="start";
    bear.current={ x:-999,y:GROUND_Y-60,w:64,h:60,vx:0,active:false };
    eyes.current=[]; heroState.current={name:"idle",t:0};
    eduSeen.current={speed:false,purify:false,ward:false}; eduLog.current.length=0; setEdu(null);
    setMessage("← → bouger | Espace sauter | P pause | M musique");
    setSummaryOpen(false); if(goIntro){ setInIntro(true); intro.current={step:0,t:0}; }
  }
  function nextLevel(){ setLevel(l=>l+1); setLevelState(v=>v+1); resetLevel(false); setPaused(false); }

  /* ---------- Boucle ---------- */
  const reqRef = useRef(null);
  useEffect(() => {
    const ctx = ctxRef.current || canvasRef.current?.getContext("2d"); if (!ctx) return;
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(33, t-last)/16.666; last=t;
      if (!paused) update(dt);
      render(ctx,t);
      reqRef.current = requestAnimationFrame(tick);
    };
    reqRef.current = requestAnimationFrame(tick);
    return ()=>{ if(reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [paused, inIntro, mobileMode]);

  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

  // update
  function update(dt){
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
    const nextName = !p.onGround ? "jump" : (Math.abs(p.vx)>0.5 ? "run" : "idle");
    if (heroState.current.name !== nextName) heroState.current = { name: nextName, t: 0 };
    else heroState.current.t += dt * ANIM_SPEED;

    // ===== Explications courtes à l’approche des amulettes =====
    if (!eduSeen.current.speed  && Math.abs(p.x-900)  < 80) { eduSeen.current.speed  = true; pushEdu("Vitesse — l’astragale (talus) est l’os clé de la cheville : il permet le mouvement (course, saut)."); }
    if (!eduSeen.current.purify && Math.abs(p.x-2200) < 80) { eduSeen.current.purify = true; pushEdu("Purification — l’osselet issu d’un sacrifice peut devenir support rituel et protecteur."); }
    if (!eduSeen.current.ward   && Math.abs(p.x-3100) < 80) { eduSeen.current.ward   = true; pushEdu("Bouclier — amulette apotropaïque : protège contre le « mauvais œil »."); }

    // Script d'événements (flux)
    if (stage.current==="start" && p.x > 900-20) {
      stage.current="speedAmulet"; p.speedMul=1.6; inv.current.speed=true;
      addBubble(900, GROUND_Y-80, "Vitesse ↑");
      setMessage("Amulette de vitesse trouvée ! → cours !"); playOne(sfxCatchEl);
    }
    if (stage.current==="speedAmulet") {
      stage.current="bearChase"; bear.current.active=true; bear.current.x=p.x-300; bear.current.vx=2.8;
      setMessage("Un ours te poursuit !");
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
      addBubble(2200, GROUND_Y-80, "Purification");
      const clean=()=>{ player.current.dirt=Math.max(0, player.current.dirt-0.05); if(player.current.dirt>0) requestAnimationFrame(clean); };
      requestAnimationFrame(clean);
      pushEdu("Purification — nettoyage/polissage : l’os devient portable et “pur”.");
    }
    if ((stage.current==="purifyAmulet"||stage.current==="postChase") && p.x > 3100-20) {
      stage.current="wardAmulet"; inv.current.ward=true; wardTimer.current=10; playOne(sfxCatchEl);
      addBubble(3100, GROUND_Y-80, "Bouclier");
      setMessage("Bouclier apotropaïque (temporaire) !");
      pushEdu("Bouclier — porté au cou, l’osselet devient amulette contre l’envie/le mauvais œil.");
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

  function rectOverlap(ax,ay,aw,ah, bx,by,bw,bh){
    return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
  }

  /* ---------- Rendu ---------- */
  function drawCover(ctx, img){
    const canvasRatio = WORLD_W / WORLD_H, imgRatio = img.naturalWidth / img.naturalHeight;
    let sx=0, sy=0, sw=img.naturalWidth, sh=img.naturalHeight;
    if (imgRatio > canvasRatio) { sh = img.naturalHeight; sw = sh * canvasRatio; sx = (img.naturalWidth - sw)/2; }
    else { sw = img.naturalWidth; sh = sw / canvasRatio; sy = (img.naturalHeight - sh)/2; }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, sx,sy,sw,sh, 0,0, WORLD_W,WORLD_H);
  }

  function render(ctx){
    if (!ctx) return;
    if (inIntro) return renderIntro(ctx);

    const p = player.current;
    const camX = Math.max(0, Math.min(WORLD_LEN - WORLD_W, p.x - WORLD_W*0.35));

    ctx.clearRect(0,0,WORLD_W,WORLD_H);
    const g=ctx.createLinearGradient(0,0,0,WORLD_H); g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
    ctx.fillStyle=g; ctx.fillRect(0,0,WORLD_W,WORLD_H);

    drawMountains(ctx, camX*0.2); drawOliveTrees(ctx, camX*0.5); drawFrieze(ctx, camX*0.8);
    ctx.fillStyle="#ede9fe"; ctx.fillRect(0,GROUND_Y,WORLD_W,WORLD_H-GROUND_Y);

    ctx.save(); ctx.translate(-camX,0);
    for(let x=300;x<WORLD_LEN;x+=420) drawColumn(ctx,x,GROUND_Y);

    drawAmulet(ctx, 900,  GROUND_Y-40, "Vitesse", amuletsRef.current.speed || undefined);
    drawAmulet(ctx, 2200, GROUND_Y-40, "Purif.",  amuletsRef.current.purify || undefined);
    drawAmulet(ctx, 3100, GROUND_Y-40, "Bouclier",amuletsRef.current.ward || undefined);

    if (bear.current.active) drawBear(ctx, bear.current.x, bear.current.y);
    for(const e of eyes.current) if(e.alive) drawEvilEye(ctx,e.x,e.y);
    drawHero(ctx, p.x,p.y,p.w,p.h,p.facing,p.dirt,p.runPhase,wardTimer.current);

    ctx.fillStyle="#94a3b8"; ctx.fillRect(WORLD_LEN-40, GROUND_Y-120, 8, 120);

    { // bulles pickup
      const now = performance.now();
      for (const b of bubbles.current) {
        if (now <= b.until) drawPickupBubble(ctx, Math.round(b.x - camX), Math.round(b.y - 70), b.text);
      }
      bubbles.current = bubbles.current.filter(b => now <= b.until);
    }
    ctx.restore();

    // HUD
    drawHUD(ctx);

    // Message principal
    ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
    ctx.fillText(message,16,26);

    // Toast éducatif
    if (edu && performance.now() < edu.until) drawEduToast(ctx, edu.msg);
  }

  function renderIntro(ctx){
    const step=intro.current.step;

    // screenshot si dispo, sinon fond
    ctx.clearRect(0,0,WORLD_W,WORLD_H);
    const shot = startShotRef.current;
    if (shot) drawCover(ctx, shot);
    else { const g=ctx.createLinearGradient(0,0,0,WORLD_H); g.addColorStop(0,"#0b1021"); g.addColorStop(1,"#0b0f18"); ctx.fillStyle=g; ctx.fillRect(0,0,WORLD_W,WORLD_H); }

    // Panneau d’intro CENTRÉ
    const pad = 40;
    const panelH = Math.min(420, WORLD_H - 2*pad);
    const panelY = Math.round((WORLD_H - panelH) / 2);
    ctx.save(); ctx.globalAlpha=.92; ctx.fillStyle="#fff"; ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=2;
    ctx.fillRect(pad, panelY, WORLD_W-2*pad, panelH); ctx.strokeRect(pad, panelY, WORLD_W-2*pad, panelH); ctx.restore();

    ctx.fillStyle="#0f172a";
    function center(txt,y, size=22){ ctx.font=`${size}px ui-sans-serif, system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(txt,WORLD_W/2,y); ctx.textAlign="start"; ctx.textBaseline="alphabetic"; }

    const yTitle = panelY + 56;
    const yBody  = panelY + Math.round(panelH * 0.60);

    if (step===0){ center("Grèce antique — De l’os à l’amulette", yTitle); center("→ pour avancer • puis Start", panelY + panelH - 36, 14); }
    if (step===1){ center("Extraction post-abattage", yTitle); center("L’os est prélevé puis travaillé.", yBody); }
    if (step===2){ center("Nettoyage & polissage", yTitle); center("L’os devient portable.", yBody); }
    if (step===3){ center("Perçage (suspension)", yTitle); center("Trou discret pour enfiler un lien.", yBody); }
    if (step>=4){ center("Montage en amulette", yTitle); center("Clique Start pour jouer →", yBody); }
  }

  /* ---------- Primitifs de dessin ---------- */
  function drawColumn(ctx, baseX, groundY){
    ctx.save(); ctx.translate(baseX,0);
    ctx.fillStyle="#e5e7eb"; ctx.fillRect(-12, groundY-140, 24, 140);
    ctx.fillStyle="#cbd5e1"; ctx.fillRect(-18, groundY-140, 36, 10); ctx.fillRect(-18, groundY-10, 36, 10);
    ctx.restore();
  }
  function drawAmulet(ctx, x, y, label, png){
    ctx.save(); ctx.translate(x,y);
    ctx.strokeStyle="#6b7280"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-18,-12); ctx.quadraticCurveTo(0,-24-6*Math.sin(performance.now()*0.002),18,-12); ctx.stroke();
    if (png) { ctx.imageSmoothingEnabled = false; ctx.drawImage(png, -32, -32, 64, 64); }
    else { ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2.5; ctx.beginPath(); ctx.ellipse(0,0,14,10,0,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.quadraticCurveTo(0,-6,10,0); ctx.moveTo(-10,0); ctx.quadraticCurveTo(0,6,10,0); ctx.stroke(); }
    ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(label, 0, 30);
    ctx.restore();
  }

  function drawPickupBubble(ctx, x, y, text){
    ctx.save();
    ctx.translate(x, y);
    ctx.font = "12px ui-sans-serif, system-ui";
    const pad = 6, maxW = 200;
    const lines = (function wrapLines(){
      const words = text.split(/\s+/), out=[]; let cur = "";
      for (const w of words){
        const test = cur ? cur + " " + w : w;
        if (ctx.measureText(test).width > (maxW - pad*2) && cur) { out.push(cur); cur = w; } else cur = test;
      }
      if (cur) out.push(cur); return out;
    })();
    const w = Math.max(60, Math.min(maxW, Math.max(...lines.map(l=>ctx.measureText(l).width)) + pad*2));
    const h = lines.length*16 + pad*2 + 8;

    // bubble box
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    // rounded rect
    ctx.beginPath();
    const r=8; const x0=-w/2, y0=-h, x1=x0+w, y1=y0+h;
    ctx.moveTo(x0+r,y0);
    ctx.arcTo(x1,y0,x1,y1,r);
    ctx.arcTo(x1,y1,x0,y1,r);
    ctx.arcTo(x0,y1,x0,y0,r);
    ctx.arcTo(x0,y0,x1,y0,r);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // tail
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(0, 10);
    ctx.lineTo(8, -2);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // text
    ctx.fillStyle = "#0f172a";
    let yy = y0 + pad + 12;
    for (const ln of lines) { ctx.fillText(ln, x0 + pad, yy); yy += 16; }
    ctx.restore();
  }
  function drawAmuletMini(ctx,cx,cy, png){
    ctx.save(); ctx.translate(cx,cy);
    if (png) { ctx.imageSmoothingEnabled = false; ctx.drawImage(png, -16, -16, 32, 32); }
    else { ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7,0); ctx.quadraticCurveTo(0,-4,7,0); ctx.moveTo(-7,0); ctx.quadraticCurveTo(0,4,7,0); ctx.stroke(); }
    ctx.restore();
  }
  function drawBear(ctx, x, y){
    const ba = bearAnim.current; const W0=64, H0=60; const Wd = Math.round(W0 * BEAR_SCALE), Hd = Math.round(H0 * BEAR_SCALE);
    ctx.save(); ctx.translate(x, y + H0); // ancrage au sol
    if (ba && ba.frames.length){
      const fps = 10 * ANIM_SPEED; let idx = Math.floor((ba.t||0) * fps) % ba.frames.length; if (!isFinite(idx) || idx<0) idx=0;
      const im = ba.frames[idx]; ctx.imageSmoothingEnabled = false; ctx.drawImage(im, 0,0, im.naturalWidth, im.naturalHeight, 0, -Hd, Wd, Hd);
    } else {
      ctx.fillStyle="#78350f"; ctx.fillRect(0, -Hd+20*BEAR_SCALE, Wd, Hd-24*BEAR_SCALE);
      ctx.beginPath(); ctx.arc(Wd-10*BEAR_SCALE, -Hd+26*BEAR_SCALE, 14*BEAR_SCALE, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle="#fde68a"; ctx.fillRect(Wd-6*BEAR_SCALE, -Hd+22*BEAR_SCALE, 3*BEAR_SCALE, 3*BEAR_SCALE);
    }
    ctx.restore();
  }
  function drawEvilEye(ctx, x, y){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle="#1d4ed8"; ctx.beginPath(); ctx.ellipse(0,0,14,9,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#93c5fd"; ctx.beginPath(); ctx.ellipse(0,0,9,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#0f172a"; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function drawHero(ctx, x,y,w,h,facing,dirt,runPhase,wardLeft){
    ctx.save();
    const dw = Math.round(w * HERO_SCALE_X), dh = Math.round(h * HERO_SCALE_Y);
    ctx.translate(x + w/2, y + h); // ancrage bas-centre
    if (wardLeft>0){
      const pct=Math.min(1,wardLeft/10); const rad=44*HERO_SCALE_Y+6*Math.sin(performance.now()*0.006);
      const grd=ctx.createRadialGradient(0,0,10, 0,0,rad);
      grd.addColorStop(0,`rgba(56,189,248,${0.25+0.25*pct})`); grd.addColorStop(1,"rgba(56,189,248,0)");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,rad,0,Math.PI*2); ctx.fill();
    }
    const anim = heroAnim.current; const clip = anim?.clips?.[heroState.current.name];
    if (clip && clip.frames && clip.frames.length) {
      const count = clip.frames.length; let fps = Number(clip.fps) || 10; let tt = Number(heroState.current.t) || 0;
      let idx = Math.floor(tt * fps); if (!isFinite(idx) || idx < 0) idx = 0; idx = clip.loop ? (idx % count) : Math.min(idx, count-1);
      const fr = clip.frames[idx] ?? clip.frames[0];
      if (facing<0){ ctx.scale(-1,1); }
      const ox = anim?.origin?.[0] ?? 0.5, oy = anim?.origin?.[1] ?? 1;
      const dx = -ox * dw, dy = -oy * dh + HERO_FOOT_ADJ_PX; // ↓ corrige le “flottement”
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fr.image, fr.sx|0, fr.sy|0, fr.sw||fr.image.naturalWidth, fr.sh||fr.image.naturalHeight, dx, dy, dw, dh);
    } else {
      if (facing<0){ ctx.scale(-1,1); }
      const legA = Math.sin(runPhase*8)*6, legB = Math.sin(runPhase*8+Math.PI)*6;
      ctx.translate(-dw/2, -dh+HERO_FOOT_ADJ_PX);
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

  function drawMountains(ctx, off){
    ctx.save(); ctx.translate(-off,0);
    for(let x=-200;x<WORLD_W+WORLD_LEN;x+=420){
      ctx.fillStyle="#c7d2fe"; ctx.beginPath(); ctx.moveTo(x,380); ctx.lineTo(x+120,260); ctx.lineTo(x+240,380); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#bfdbfe"; ctx.beginPath(); ctx.moveTo(x+140,380); ctx.lineTo(x+260,280); ctx.lineTo(x+360,380); ctx.closePath(); ctx.fill();
    } ctx.restore();
  }
  function drawOliveTrees(ctx, off){
    ctx.save(); ctx.translate(-off,0);
    for(let x=0;x<WORLD_W+WORLD_LEN;x+=260){ ctx.fillStyle="#a78bfa"; ctx.fillRect(x+40,GROUND_Y-60,8,60);
      ctx.fillStyle="#ddd6fe"; ctx.beginPath(); ctx.ellipse(x+44,GROUND_Y-75,26,16,0,0,Math.PI*2); ctx.fill();
    } ctx.restore();
  }
  function drawFrieze(ctx, off){
    ctx.save(); ctx.translate(-off,0);
    for(let x=0;x<WORLD_W+WORLD_LEN;x+=180){ ctx.strokeStyle="#94a3b8"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,GROUND_Y-10);
      for(let i=0;i<6;i++){ const sx=x+i*24; ctx.lineTo(sx+12,GROUND_Y-18); ctx.lineTo(sx+24,GROUND_Y-10); }
      ctx.stroke();
    } ctx.restore();
  }

  function drawHUD(ctx){
    // Inventaire amulettes
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
    // Indicateur musique
    ctx.fillStyle = musicOn ? "#16a34a" : "#ef4444"; ctx.beginPath(); ctx.arc(264,70,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#0f172a"; ctx.font="10px ui-sans-serif, system-ui"; ctx.fillText("Musique (M)", 278,74);
    ctx.restore();

    // Panneau fin (le vrai contenu est en overlay DOM plus bas)
    if (summaryOpen) {
      const W = WORLD_W, H = WORLD_H;
      ctx.save(); ctx.fillStyle="rgba(255,255,255,.95)"; ctx.fillRect(0,0,W,H); ctx.restore();
    }
  }

  function drawEduToast(ctx, text){
    const pad=12, boxW=Math.min(680,WORLD_W-40), x=20, y=20+40; // sous la barre
    ctx.save(); ctx.globalAlpha=.98; ctx.fillStyle="#ffffff"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2;
    ctx.fillRect(x,y,boxW,80); ctx.strokeRect(x,y,boxW,80);
    ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
    wrapText(ctx,text,x+12,y+26,boxW-24,18); ctx.restore();
  }

  function wrapText(ctx, text, x,y, maxW, lh){
    const words=text.split(" "); let line="";
    for(let n=0;n<words.length;n++){
      const test=line+words[n]+" ";
      if(ctx.measureText(test).width>maxW && n>0){ ctx.fillText(line,x,y); line=words[n]+" "; y+=lh; } else line=test;
    }
    ctx.fillText(line,x,y);
  }

  /* ---------- UI / JSX ---------- */
  const startBtnStyle = {
    padding:"12px 18px", border:"1px solid #059669", borderRadius:14, background:"#059669",
    color:"#fff", cursor:"pointer", boxShadow:"0 6px 14px rgba(5,150,105,.25)",
    position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)", zIndex:5
  };
  const btn = (disabled=false)=>({ padding:"8px 12px", border:"1px solid #e5e7eb", borderRadius:12, background:"#fff", cursor:disabled?"default":"pointer", opacity: disabled ? .5 : 1 });
  const btnDark = ()=>({ padding:"8px 12px", border:"1px solid #111827", borderRadius:12, background:"#111827", color:"#fff", cursor:"pointer" });
  const primaryBtn = (disabled=false)=>({ padding:"10px 14px", border:"1px solid #059669", borderRadius:14, background:"#059669", color:"#fff", cursor:disabled?"default":"pointer", opacity: disabled ? .5 : 1, boxShadow:"0 6px 14px rgba(5,150,105,.25)" });

  function TouchBtn(props){ // simple large
    const events = {
      onMouseDown: props.onDown, onMouseUp: props.onUp, onMouseLeave: props.onUp,
      onTouchStart: (e)=>{ e.preventDefault(); props.onDown(); },
      onTouchEnd:   (e)=>{ e.preventDefault(); props.onUp(); },
      onPointerDown:(e)=>{ if(e.pointerType!=="mouse") props.onDown(); },
      onPointerUp:  (e)=>{ if(e.pointerType!=="mouse") props.onUp(); },
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
          {inIntro ? "Jeu de découverte des usages de l’astragale (amulette, rite, protection)."
                   : "← → bouger • Espace sauter • P pause • M musique. Sur mobile, active le mode mobile."}
        </p>

        <div className="bg-white" style={{border:"1px solid #e5e7eb", borderRadius:14, padding:12, boxShadow:"0 6px 16px rgba(0,0,0,.05)"}}>
          <div ref={wrapperRef} className="w-full" style={{position:"relative", overflow:"hidden", border:"1px solid #e5e7eb", borderRadius:12}}>
            <canvas ref={canvasRef} />

            {inIntro && <button onClick={startGame} style={startBtnStyle}>Start</button>}

            {summaryOpen && (
              <div style={{position:"absolute", inset:0, background:"rgba(255,255,255,.95)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24}}>
                <div style={{width:"min(860px,100%)", background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:16, boxShadow:"0 8px 24px rgba(0,0,0,.08)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <h2 style={{fontWeight:600}}>Fin du niveau {level} ✅</h2>
                    <span style={{fontSize:12, padding:"2px 8px", borderRadius:999, background:"#111827", color:"#fff"}}>Synthèse</span>
                  </div>
                  <div style={{display:"grid", gap:12, gridTemplateColumns:"1fr 1fr", marginTop:12}}>
                    <div style={{background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:12, padding:12, fontSize:14}}>
                      <h3 style={{fontWeight:600, marginBottom:8}}>Ce que tu as vu</h3>
                      <ul style={{paddingLeft:18, margin:0}}>
                        <li>Astragale = <em>talus</em>, os clé du mouvement (pied/cheville).</li>
                        <li>De l’os au bijou : nettoyage, polissage, perçage → suspension.</li>
                        <li>Usages amulétistes : purification & apotropaïsme (mauvais œil).</li>
                        {eduLog.current.slice(-3).map((t,i)=> <li key={i} style={{opacity:.85}}>{t}</li>)}
                      </ul>
                    </div>
                    <div style={{background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:12, padding:12, fontSize:14}}>
                      <h3 style={{fontWeight:600, marginBottom:8}}>Questions flash</h3>
                      <ol style={{paddingLeft:18, margin:0}}>
                        <li>V/F : l’astragale appartient au tarse.</li>
                        <li>Pourquoi percer l’osselet ?</li>
                        <li>Donne un usage protecteur évoqué dans le niveau.</li>
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
          </div>
        </div>
      </div>
    </div>
  );
}

// @ts-ignore
window.AstragalusRunner = AstragalusRunner;
