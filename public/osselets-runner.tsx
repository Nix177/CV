// public/osselets-runner.tsx
// Runner 2D – Amulettes d’astragale (LEVEL 1)
// - Panneau d’intro bien CENTRÉ + bouton Start
// - Screenshot d’accueil optionnel (start-screenshot.webp/png/jpg)
// - MP3 only, amulettes PNG, ours 6 PNG ou bear.anim.json
// - Bulles/toasts pédagogiques, résumé fin de niveau, chaînage niveau suivant

/* global React */
const { useEffect, useRef, useState } = React;

/* -------------------- Chemins & assets -------------------- */
const IMG_BASES = [
  "/assets/games/osselets/audio/img/", // emplacement actuel
  "/assets/games/osselets/img/",       // fallback si déplacé plus tard
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
  const k = "__once_" + key;
  if (window[k]) return;
  window[k] = true;
  console.warn(...args);
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
    try { return await loadImage(base + file); } catch (e) {}
  }
  logOnce(`img_${file}`, `[osselets] image introuvable: ${file} (essayé: ${IMG_BASES.map(b=>b+file).join(", ")})`);
  return null;
}
async function fetchJSON(file) {
  for (const base of IMG_BASES) {
    try {
      const r = await fetch(base + file, { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (e) {}
  }
  return null;
}

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
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro && wrapperRef.current) ro.observe(wrapperRef.current);
    window.addEventListener("resize", resize);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", resize); };
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
    setMusicOn(function(v){
      const n = !v;
      if (el){ el.muted = !n; if (n && el.paused) el.play().catch(()=>{}); }
      return n;
    });
  }
  function playOne(ref){
    const el = ref.current; if(!el) return;
    try{ el.currentTime=0; el.play().catch(()=>{});}catch(e){}
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
      const origin = (j && j.origin) ? j.origin : [0.5, 1];
      const baseFS = (j && j.frameSize) ? j.frameSize : [64,64];
      const clips = {};
      async function buildClip(name, def) {
        if (def && def.files) { // liste de PNG
          const imgs = (await Promise.all(def.files.map((f)=>loadImageSmart(f)))).filter(Boolean);
          if (!imgs.length) return null;
          return { frames: imgs.map(im=>({image:im,sx:0,sy:0,sw:im.naturalWidth,sh:im.naturalHeight})), fps: Number(def.fps)||10, loop: !!def.loop, name };
        }
        if (def && def.src && (def.rects || def.frames)) {
          const img = await loadImageSmart(def.src); if (!img) return null;
          if (def.rects) {
            const frames = def.rects.map((r)=>({ image: img, sx:r.x, sy:r.y, sw:r.w, sh:r.h }));
            return { frames, fps: Number(def.fps)||10, loop: !!def.loop, name };
          } else {
            const fs = def.frameSize || baseFS; const fw = fs[0], fh = fs[1]; const frames=[];
            for (let i=0;i<def.frames;i++){ frames.push({ image:img, sx:i*fw, sy:0, sw:fw, sh:fh }); }
            return { frames, fps: Number(def.fps)||10, loop: !!def.loop, name };
          }
        }
        return null;
      }
      const anims = (j && j.animations) ? j.animations : {};
      for (const key in anims) {
        const clip = await buildClip(key, anims[key]);
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
      if (j && j.files) {
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
  function nextLevel(){ setLevel(function(l){return l+1;}); setLevelState(function(v){return v+1;}); resetLevel(false); setPaused(false); }

  /* ---------- Boucle ---------- */
  const reqRef = useRef(null);
  useEffect(() => {
    const ctx = ctxRef.current || (canvasRef.current ? canvasRef.current.getContext("2d") : null); if (!ctx) return;
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(33, t-last)/16.666; last=t;
      if (!paused) update(dt);
      render(ctx);
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
      setMessage("Amulette de vitesse trouvée ! → cours !");
      playOne(sfxCatchEl);
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
          else { p.speedMul=Math.max(0.8,p.speedMul-0.2); setTimeout(()=>{p.speedMul=Math.min(1.2,p.speedMul+0.2);},1500); e.alive=false; playOne(sfxOuchEl); }
        }
      }
      eyes.current = eyes.current.filter(function(e){ return e.alive && e.x>-100; });
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
    for(let i=0;i<eyes.current.length;i++){ const e = eyes.current[i]; if(e.alive) drawEvilEye(ctx,e.x,e.y); }
    drawHero(ctx, p.x,p.y,p.w,p.h,p.facing,p.dirt,p.runPhase,wardTimer.current);

    ctx.fillStyle="#94a3b8"; ctx.fillRect(WORLD_LEN-40, GROUND_Y-120, 8, 120);

    { // bulles pickup
      const now = performance.now();
      const arr = bubbles.current;
      for (let i=0;i<arr.length;i++){
        const b = arr[i];
        if (now <= b.until) drawPickupBubble(ctx, Math.round(b.x - camX), Math.round(b.y - 70), b.text);
      }
      bubbles.current = arr.filter(b => now <= b.until);
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
    function center(txt,y, size=22){
      ctx.font=`${size}px ui-sans-serif, system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(txt,WORLD_W/2,y); ctx.textAlign="start"; ctx.textBaseline="alphabetic";
    }

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
      for (let i=0;i<words.length;i++){
        const w = words[i];
        const test = cur ? cur + " " + w : w;
        if (ctx.measureText(test).width > (maxW - pad*2) && cur) { out.push(cur); cur = w; } else cur = test;
      }
      if (cur) out.push(cur); return out;
    })();
    const w = Math.max(60, Math.min(maxW, Math.max.apply(null, lines.map(l=>ctx.measureText(l).width)) + pad*2));
    const h = lines.length*16 + pad*2 + 8;

    // bubble box
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    // rounded rect
    ctx.beginPath();
    const r=8; const x0=-w/2, y0=-h, x1=x0+w, y1=y0+h
