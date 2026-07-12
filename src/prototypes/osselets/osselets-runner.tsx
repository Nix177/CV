/* global React */
const { useEffect, useRef, useState } = React;

/* -------------------- Chemins & assets -------------------- */
const IMG_BASES = [
  "/assets/games/osselets/audio/img/", // emplacement actuel (héros/ours/amulettes)
  "/assets/games/osselets/img/",       // fallback si déplacé plus tard
];
const AUDIO_BASE = "/assets/games/osselets/audio/";
const OSSELET_IMG_DIR = "osselets/";   // pour le mini-jeu (images 2D d'osselets)

const AUDIO = { // MP3 uniquement
  music: "game-music-1.mp3",
  jump:  "jump-sound.mp3",
  catch: "catch-sound.mp3",
  ouch:  "ouch-sound.mp3",
};

const AMULET_FILES = { // PNG existants
  speed:  "amulette-speed.png",
  purify: "amulette-purify.png",
  ward:   "amulette-ward.png",
};

// Screenshot d’accueil optionnel
const START_SCREENSHOT_CANDIDATES = ["start-screenshot.webp","start-screenshot.png","start-screenshot.jpg"];

/* -------------------- Réglages visuels/jeux -------------------- */
const WORLD_W = 960, WORLD_H = 540;
const ANIM_SPEED = 0.10;
const HERO_SCALE_X = 1.70, HERO_SCALE_Y = 1.50, HERO_FOOT_ADJ_PX = 12;
const BEAR_SCALE = 1.5;
const GROUND_Y  = 440;
const WORLD_LEN_L1 = 4200; // longueur niveau 1
const WORLD_LEN_L2 = 4600; // longueur niveau 2

/* -------------------- Utils chargement -------------------- */
function logOnce(key, ...args) { const k = "__once_" + key; if (window[k]) return; window[k] = true; console.warn(...args); }
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("img load failed: " + url));
    im.src = encodeURI(url);
  });
}
async function loadImageSmart(file) {
  for (const base of IMG_BASES) {
    try { return await loadImage(base + file); } catch (e) {}
  }
  logOnce("img_" + file, "[osselets] image introuvable: " + file + " (essayé: " + IMG_BASES.map(b=>b+file).join(", ") + ")");
  return null;
}
async function fetchJSON(file) {
  for (const base of IMG_BASES) {
    try { const r = await fetch(base + file, { cache: "no-store" }); if (r.ok) return await r.json(); } catch (e) {}
  }
  return null;
}
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

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
  const [level, setLevel]             = useState(1);      // 1 ou 2
  const [inIntro, setInIntro]         = useState(true);
  const [paused, setPaused]           = useState(false);  // pause logique (hors modals)
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [message, setMessage]         = useState("← → bouger | Espace sauter | S/C/W (LVL1) • O (LVL2) | P pause | M musique");

  const WORLD_LEN = level===1 ? WORLD_LEN_L1 : WORLD_LEN_L2;

  // Fenêtre pédagogique (met en pause)
  const [learnModal, setLearnModal] = useState(null); // {title, body, key}
  const modalBlocks = !!learnModal || summaryOpen || inIntro;

  // Mobile
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

  function startMusicIfWanted(){
    const el = musicEl.current; if(!el) return;
    el.loop = true; el.volume = 0.35; el.muted = !musicOn;
    if (musicOn) el.play().catch(()=>{});
  }
  function toggleMusic(){
    const el = musicEl.current;
    setMusicOn(v=>{
      const n=!v; if (el){ el.muted = !n; if (n && el.paused) el.play().catch(()=>{}); }
      return n;
    });
  }
  function playOne(ref){ const el = ref.current; if (!el) return; try{ el.currentTime=0; el.play().catch(()=>{});}catch(e){} }

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
    for (const name of START_SCREENSHOT_CANDIDATES) { const im = await loadImageSmart(name); if (im) { startShotRef.current = im; break; } }
  })(); }, []);

  /* ---------- Héros & animations ---------- */
  const heroAnim = useRef(null);
  const heroState = useRef({ name: "idle", t: 0 });

  useEffect(() => {
    let canceled = false;
    (async () => {
      const j = await fetchJSON("hero.anim.json"); if (canceled) return;
      if (!j) { heroAnim.current = null; logOnce("herojson","[osselets] hero.anim.json introuvable"); return; }
      const origin = j.origin || [0.5, 1];
      const baseFS = j.frameSize || [64,64];
      const clips = {};
      async function buildClip(name, def) {
        if (def && def.files) {
          const imgs = (await Promise.all(def.files.map(loadImageSmart))).filter(Boolean);
          if (!imgs.length) return null;
          return { frames: imgs.map(im=>({image:im,sx:0,sy:0,sw:im.naturalWidth,sh:im.naturalHeight})), fps: Number(def.fps)||10, loop: !!def.loop, name };
        } return null;
      }
      const anims = j.animations || {};
      for (const key in anims) { const clip = await buildClip(key, anims[key]); if (clip) clips[key] = clip; }
      heroAnim.current = { clips, origin, frameSize: baseFS };
    })();
    return ()=>{ canceled=true; };
  }, []);

  /* ---------- Ours ---------- */
  const bearAnim = useRef(null);
  useEffect(() => {
    let canceled = false;
    (async () => {
      const j = await fetchJSON("bear.anim.json");
      if (j && j.files) {
        const frames = (await Promise.all(j.files.map(loadImageSmart))).filter(Boolean);
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

  /* ---------- Mini-jeu osselets (placeholder assets) ---------- */
  const osseletsRef = useRef({ imgs: [] });
  useEffect(() => { (async () => {
    // Charge 1..5 + shadow si présent (non bloquant)
    const arr = [];
    for (let i=1;i<=5;i++){ const im = await loadImageSmart(OSSELET_IMG_DIR + `osselet (${i}).png`); if (im) arr.push(im); }
    const shadow = await loadImageSmart(OSSELET_IMG_DIR + "osselet-shadow.png");
    osseletsRef.current = { imgs: arr, shadow };
  })(); }, []);

  /* ---------- Monde & gameplay ---------- */
  const player = useRef({ x:120, y:GROUND_Y-68, w:42, h:68, vx:0, vy:0, onGround:true, facing:1,
                          baseSpeed:3.0, speedMul:1.0, dirt:0, runPhase:0, coyote:0, jumpBuf:0 });
  const keys = useRef({});
  const inv = useRef({ speed:false, purify:false, ward:false, oracle:false });
  const active = useRef({ name:null, until:0 });
  const wardTimer = useRef(0);
  const oracleTimer = useRef(0);
  const stage = useRef("intro"); // machine d’états du niveau
  const bear = useRef({ x:-999, y:GROUND_Y-60, w:64, h:60, vx:0, active:false, until:0 });
  const eyes = useRef([]);
  const miasmas = useRef([]);    // {x,w}
  const intermittents = useRef([]); // obstacles intermittents (LVL2)

  // HUD/edu
  const [edu, setEdu] = useState(null);
  const eduLog = useRef([]);
  function pushEdu(msg, ms=5200){ const until = performance.now()+ms; setEdu({msg, until}); eduLog.current.push(msg); if (eduLog.current.length>8) eduLog.current.shift(); }

  // Intro
  const intro = useRef({ step:0, t:0 });

  // clavier
  useEffect(() => {
    function down(e) {
      if (["ArrowLeft","ArrowRight"," ","Space","m","M","p","P","s","S","c","C","w","W","o","O","Enter"].includes(e.key)) e.preventDefault();
      if (inIntro) {
        if (e.key==="ArrowRight"){ intro.current.step=Math.min(5,intro.current.step+1); intro.current.t=0; }
        if (e.key==="Enter"){ setInIntro(false); }
        return;
      }
      if (learnModal || summaryOpen) return; // modals bloquent les inputs

      if (e.key==="ArrowLeft") keys.current.left=true;
      if (e.key==="ArrowRight") keys.current.right=true;
      if (e.key===" "||e.key==="Space") keys.current.jump=true;

      // Activations (selon niveau)
      if (level===1){
        if (e.key==="s"||e.key==="S") tryActivate("speed");
        if (e.key==="c"||e.key==="C") tryActivate("purify");
        if (e.key==="w"||e.key==="W") tryActivate("ward");
      } else if (level===2){
        if (e.key==="o"||e.key==="O") tryActivate("oracle");
        // on laisse C/W si on veut réviser (optionnel)
        if (e.key==="c"||e.key==="C") tryActivate("purify");
        if (e.key==="w"||e.key==="W") tryActivate("ward");
      }

      if ((e.key==="p"||e.key==="P")) setPaused(v=>!v);
      if (e.key==="m"||e.key==="M") toggleMusic();
    }
    function up(e) {
      if (inIntro || learnModal || summaryOpen) return;
      if (e.key==="ArrowLeft") keys.current.left=false;
      if (e.key==="ArrowRight") keys.current.right=false;
      if (e.key===" "||e.key==="Space") keys.current.jump=false;
    }
    window.addEventListener("keydown",down);
    window.addEventListener("keyup",up);
    return ()=>{ window.removeEventListener("keydown",down); window.removeEventListener("keyup",up); };
  }, [inIntro, learnModal, summaryOpen, level]);

  // touch
  function press(name, v){ onScreenKeys.current[name]=v; }
  function clearTouchKeys(){ onScreenKeys.current={left:false,right:false,jump:false}; }

  // Start / reset
  function softResetForLevel(){
    Object.assign(player.current,{ x:120,y:GROUND_Y-68,vx:0,vy:0,onGround:true,facing:1,speedMul:1.0,dirt:0,runPhase:0,coyote:0,jumpBuf:0 });
    eyes.current=[]; miasmas.current=[]; intermittents.current=[];
    wardTimer.current=0; oracleTimer.current=0; active.current={name:null,until:0};
    bear.current={ x:-999,y:GROUND_Y-60,w:64,h:60,vx:0,active:false, until:0 };
    stage.current="intro"; setMessage(level===1
      ? "← → bouger • Espace sauter • S/C/W pour activer les amulettes apprises"
      : "← → bouger • Espace sauter • O (Oracle) pour révéler les pièges intermittents");
    setLearnModal(null); setEdu(null); eduLog.current.length=0;
  }
  useEffect(()=>{ softResetForLevel(); setInIntro(true); }, [level]);

  function startGame(){ setInIntro(false); setSummaryOpen(false); setPaused(false); startMusicIfWanted(); }

  function tryActivate(name){
    if (!inv.current[name]){ pushEdu("Tu n’as pas encore cette amulette — avance pour la trouver."); return; }
    const now = performance.now();
    const DUR = { speed:8, purify:0.4, ward:8, oracle:6 };
    active.current = { name, until: now + (DUR[name]||0)*1000 };
    if (name==="speed") player.current.speedMul=1.6;
    if (name==="purify") player.current.dirt = Math.max(0, player.current.dirt-0.6);
    if (name==="ward")  wardTimer.current = DUR.ward;
    if (name==="oracle") oracleTimer.current = DUR.oracle;
  }

  /* ---------- Script d’événements & pickups ---------- */
  const pickups = useRef([]); // {x,type,label,pngKey,taken}
  function setupPickups(){
    pickups.current.length=0; miasmas.current.length=0; intermittents.current.length=0;
    if (level===1){
      // INTRODUCTION : on présente chaque amulette (pause pédagogique)
      pickups.current.push({x:900, type:"speed",   label:"Vitesse", pngKey:"speed"});
      // petite zone de miasme juste avant la purification pour "sentir" le malus
      miasmas.current.push({ x:1950, w:140 });
      pickups.current.push({x:2000, type:"purify", label:"Purif.",  pngKey:"purify"});
      pickups.current.push({x:3100, type:"ward",   label:"Bouclier",pngKey:"ward"});

      // DEUXIÈME MOITIÉ : défi d’usage au bon moment
      // vague d’yeux après 3200 (Ward), ours 7s vers 3400 (Speed), miasme vers 3600 (Purify)
      miasmas.current.push({ x:3600, w:160 });
    } else {
      // LVL2 : on introduit Oracle (amulettes LVL1 restent si tu veux les réviser)
      pickups.current.push({x:900, type:"oracle",  label:"Oracle",  pngKey:null});
      // quelques miasmes et yeux
      miasmas.current.push({ x:1850, w:120 });
      miasmas.current.push({ x:2780, w:120 });
      // obstacles intermittents (piliers qui apparaissent/disparaissent)
      intermittents.current.push({ x:2100, y:GROUND_Y-60, w:24, h:60, t:0 });
      intermittents.current.push({ x:2450, y:GROUND_Y-60, w:24, h:60, t:0 });
      intermittents.current.push({ x:3180, y:GROUND_Y-60, w:24, h:60, t:0 });
    }
  }
  useEffect(setupPickups, [level]);

  /* ---------- Boucle ---------- */
  const reqRef = useRef(null);
  useEffect(() => {
    const ctx = ctxRef.current || (canvasRef.current ? canvasRef.current.getContext("2d") : null); if (!ctx) return;
    let last = performance.now();
    const tick = (t) => {
      let dtms = t-last; if (dtms>66) dtms=66; last=t;
      // slow léger sous Oracle
      const slow = oracleTimer.current>0 ? 0.88 : 1.0;
      const dt = (dtms/16.666) * slow;
      if (!paused && !modalBlocks) update(dt, dtms/1000);
      render(ctx);
      reqRef.current = requestAnimationFrame(tick);
    };
    reqRef.current = requestAnimationFrame(tick);
    return ()=>{ if(reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [paused, inIntro, modalBlocks, level]);

  function update(dt, dtSecs){
    const p = player.current;

    // expiration effets
    if (active.current.name && performance.now() > active.current.until){
      if (active.current.name==="speed") p.speedMul=1.2;
      active.current.name = null;
    }
    if (wardTimer.current>0) wardTimer.current = Math.max(0, wardTimer.current - dtSecs);
    if (oracleTimer.current>0) oracleTimer.current = Math.max(0, oracleTimer.current - dtSecs);

    // Inputs
    const left  = keys.current.left  || onScreenKeys.current.left;
    const right = keys.current.right || onScreenKeys.current.right || (mobileMode && oneButton);
    const jump  = keys.current.jump  || onScreenKeys.current.jump;

    let ax=0; if(left){ax-=1;p.facing=-1;} if(right){ax+=1;p.facing=1;}
    const dash = 0;
    const targetVx = ax * p.baseSpeed * p.speedMul + dash;
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

    // Anim héros
    const nextName = !p.onGround ? "jump" : (Math.abs(p.vx)>0.5 ? "run" : "idle");
    if (heroState.current.name !== nextName) heroState.current = { name: nextName, t: 0 };
    else heroState.current.t += dt * ANIM_SPEED;

    // --- Pickups (déclenchent modals d’apprentissage) ---
    for (const pk of pickups.current){
      if (pk.taken) continue;
      if (Math.abs(p.x - pk.x) < 18 && Math.abs((p.y+p.h) - GROUND_Y) < 26){
        pk.taken = true; playOne(sfxCatchEl);
        if (pk.type==="speed"){ inv.current.speed = true; setLearnModal({ title: "NIKÊ — Vitesse", key:"S", body: "Le talus (astragale) = os du mouvement. Active-la avec S pour distancer un danger." }); }
        if (pk.type==="purify"){ inv.current.purify = true; setLearnModal({ title: "KATHARSIS — Purification", key:"C", body: "Polissage/rituel : l’os devient ‘propre’. Active C pour dissiper la salissure (maladie/miasme)." }); }
        if (pk.type==="ward"){ inv.current.ward = true; setLearnModal({ title: "APOTROPAÏON — Bouclier", key:"W", body: "Amulette contre le ‘mauvais œil’. Active W pour repousser les yeux malveillants." }); }
        if (pk.type==="oracle"){ inv.current.oracle = true; setLearnModal({ title: "MANTIS — Oracle", key:"O", body: "Divination par osselets : révèle les pièges intermittents. Active O pour les voir à l’avance." }); }
      }
    }

    // --- Miasmes : salissent progressivement si on traverse sans Purify ---
    for (const mz of miasmas.current){
      if (p.x+p.w > mz.x && p.x < mz.x + mz.w) {
        p.speedMul = Math.max(0.8, p.speedMul - 0.008);
        player.current.dirt = Math.min(0.9, player.current.dirt + 0.004);
      }
    }

    // --- LVL1 : séquences "utiliser au bon moment" ---
    if (level===1){
      // ours 7s : démarre vers x>3400 si pas déjà actif
      if (!bear.current.active && p.x > 3400) {
        bear.current.active = true; bear.current.x = p.x - 300; bear.current.vx = 2.8; bear.current.until = performance.now() + 7000;
        setMessage("Un ours te poursuit 7s ! Utilise S (vitesse).");
      }
      if (bear.current.active){
        // poursuite serrée
        const d=p.x-bear.current.x;
        const desired = d>260?3.2 : d<140?2.2 : 2.8;
        bear.current.vx += (desired - bear.current.vx)*0.04;
        bear.current.x += bear.current.vx * dt * (60/60);
        if (bearAnim.current) bearAnim.current.t += dt * ANIM_SPEED;
        // touche ?
        if (bear.current.x + bear.current.w > p.x){
          // petit knock + salissure
          p.x += 8; p.vx = Math.max(p.vx, 1.0); player.current.dirt = Math.min(1, player.current.dirt + 0.05); playOne(sfxOuchEl);
        }
        if (performance.now() > bear.current.until){ bear.current.active=false; setMessage("Il repart au loin."); }
      }
      // vague d’yeux à 3200 si pas déjà lancée
      if (stage.current!=="eyesWave" && p.x > 3200){
        stage.current="eyesWave";
        const n=8;
        for(let i=0;i<n;i++)
          eyes.current.push({ x:p.x+220+i*90, y:GROUND_Y-100-((i%3)*30), vx:-(2.4+((i%3)*0.3)), vy:0, alive:true });
        setMessage("Vague du ‘mauvais œil’ ! Active W pour t’en protéger.");
      }
    }

    // --- LVL2 : obstacles intermittents (révélés par Oracle) ---
    if (level===2){
      // oscillation apparition/disparition
      for (const ob of intermittents.current){ ob.t += dt; }
      // contact avec obstacles (quand "on" est en phase visible)
      for (const ob of intermittents.current){
        const visible = Math.sin(ob.t*1.2) > 0; // apparaît/disparaît
        if (visible){
          if (rectOverlap(ob.x, ob.y, ob.w, ob.h, p.x, p.y, p.w, p.h)){
            // petit bump et dirty
            p.x -= 12; p.vx = 0; player.current.dirt = Math.min(1, player.current.dirt + 0.04); playOne(sfxOuchEl);
          }
        }
      }
      // quelques yeux qui passent parfois
      if (stage.current!=="eyesLoop" && p.x>1800){ stage.current="eyesLoop"; setMessage("Obstacles intermittents — O pour prévoir, W contre les yeux, C pour nettoyer."); }
      if (stage.current==="eyesLoop" && Math.random()<0.03){
        eyes.current.push({ x:player.current.x+300, y:GROUND_Y-100-(Math.random()*40|0), vx:-2.6, vy:0, alive:true });
      }
    }

    // yeux collisions
    for (const e of eyes.current){
      if(!e.alive) continue;
      e.x += e.vx * dt * (60/60);
      if (rectOverlap(e.x-10,e.y-6,20,12, p.x,p.y,p.w,p.h)) {
        if (wardTimer.current>0){ e.vx=-e.vx*0.6; e.x+=e.vx*4; e.alive=false; }
        else { p.speedMul=Math.max(0.9,p.speedMul-0.2); setTimeout(()=>{p.speedMul=Math.min(1.2,p.speedMul+0.2);},1200); e.alive=false; playOne(sfxOuchEl); }
      }
    }
    eyes.current = eyes.current.filter(e=> e.alive && e.x>-120);

    // Fin
    if (p.x >= WORLD_LEN-80 && !summaryOpen) { setPaused(true); setSummaryOpen(true); }
  }

  function rectOverlap(ax,ay,aw,ah, bx,by,bw,bh){ return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by; }

  /* ---------- Rendu ---------- */
  function drawCover(ctx, img){
    const canvasRatio = WORLD_W / WORLD_H, imgRatio = img.naturalWidth / img.naturalHeight;
    let sx=0, sy=0, sw=img.naturalWidth, sh=img.naturalHeight;
    if (imgRatio > canvasRatio) { sh = img.naturalHeight; sw = sh * canvasRatio; sx = (img.naturalWidth - sw)/2; }
    else { sw = img.naturalWidth; sh = sw / canvasRatio; sy = (img.naturalHeight - sh)/2; }
    ctx.imageSmoothingEnabled = true; ctx.drawImage(img, sx,sy,sw,sh, 0,0, WORLD_W,WORLD_H);
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

    // miasmes (zones maladie)
    ctx.fillStyle="rgba(16,185,129,.18)";
    for (const mz of miasmas.current){ ctx.fillRect(mz.x,GROUND_Y-12,mz.w,12); }

    // obstacles intermittents (LVL2)
    if (level===2){
      for (const ob of intermittents.current){
        const visible = Math.sin(ob.t*1.2) > 0;
        ctx.globalAlpha = visible ? 1 : (oracleTimer.current>0 ? 0.65 : 0.15);
        ctx.fillStyle = visible ? "#f59e0b" : "#9ca3af";
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        if (oracleTimer.current>0){ ctx.strokeStyle="#9333ea"; ctx.lineWidth=2; ctx.strokeRect(ob.x-2, ob.y-2, ob.w+4, ob.h+4); }
        ctx.globalAlpha = 1;
      }
    }

    // pick-ups visibles
    for (const pk of pickups.current){
      if (pk.taken) continue;
      const png = pk.pngKey && amuletsRef.current[pk.pngKey];
      drawAmulet(ctx, pk.x,  GROUND_Y-40, pk.label, png, pk.type);
    }

    if (bear.current.active) drawBear(ctx, bear.current.x, bear.current.y);
    for(const e of eyes.current){ if(e.alive) drawEvilEye(ctx,e.x,e.y, oracleTimer.current>0); }
    drawHero(ctx, p.x,p.y,p.w,p.h,p.facing,p.dirt,p.runPhase,wardTimer.current);

    // arrivée
    ctx.fillStyle="#94a3b8"; ctx.fillRect(WORLD_LEN-40, GROUND_Y-120, 8, 120);

    ctx.restore();

    // HUD
    drawHUD(ctx);

    // Message
    ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui"; ctx.fillText(message,16,26);

    // Toast éducatif
    if (edu && performance.now() < edu.until) drawEduToast(ctx, edu.msg);
  }

  function renderIntro(ctx){
    // screenshot si dispo, sinon fond
    ctx.clearRect(0,0,WORLD_W,WORLD_H);
    const shot = startShotRef.current;
    if (shot) drawCover(ctx, shot);
    else { const g=ctx.createLinearGradient(0,0,0,WORLD_H); g.addColorStop(0,"#0b1021"); g.addColorStop(1,"#0b0f18"); ctx.fillStyle=g; ctx.fillRect(0,0,WORLD_W,WORLD_H); }

    // Panneau d’intro centré (court)
    const pad = 40, panelH = Math.min(360, WORLD_H - 2*pad), panelY = Math.round((WORLD_H - panelH) / 2);
    ctx.save(); ctx.globalAlpha=.92; ctx.fillStyle="#fff"; ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=2;
    ctx.fillRect(pad, panelY, WORLD_W-2*pad, panelH); ctx.strokeRect(pad, panelY, WORLD_W-2*pad, panelH); ctx.restore();
    ctx.fillStyle="#0f172a";
    const title = level===1 ? "LVL 1 — Vitesse, Purification, Bouclier" : "LVL 2 — Oracle (voir l’invisible)";
    centerText(ctx, title, panelY+56, 22);
    centerText(ctx, "→ Start pour jouer", panelY + panelH - 36, 14);
  }
  function centerText(ctx, txt, y, size=22){ ctx.font=`${size}px ui-sans-serif, system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(txt,WORLD_W/2,y); ctx.textAlign="start"; ctx.textBaseline="alphabetic"; }

  /* ---------- Primitifs & dessins ---------- */
  function drawColumn(ctx, baseX, groundY){
    ctx.save(); ctx.translate(baseX,0);
    ctx.fillStyle="#e5e7eb"; ctx.fillRect(-12, groundY-140, 24, 140);
    ctx.fillStyle="#cbd5e1"; ctx.fillRect(-18, groundY-140, 36, 10); ctx.fillRect(-18, groundY-10, 36, 10);
    ctx.restore();
  }
  function drawAmulet(ctx, x, y, label, png, type){
    ctx.save(); ctx.translate(x,y);
    ctx.strokeStyle="#6b7280"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-18,-12); ctx.quadraticCurveTo(0,-24-6*Math.sin(performance.now()*0.002),18,-12); ctx.stroke();
    if (png) { ctx.imageSmoothingEnabled = false; ctx.drawImage(png, -32, -32, 64, 64); }
    else { // simple picto si pas de png (oracle)
      ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2.5; ctx.beginPath(); ctx.ellipse(0,0,14,10,0,0,Math.PI*2); ctx.stroke();
      ctx.font="bold 12px ui-sans-serif, system-ui"; ctx.fillStyle="#111827"; ctx.textAlign="center"; ctx.fillText(type==="oracle"?"O":"",0,4);
    }
    ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(label, 0, 30);
    ctx.restore();
  }
  function drawBear(ctx, x, y){
    const ba = bearAnim.current; const W0=64, H0=60; const Wd = Math.round(W0 * BEAR_SCALE), Hd = Math.round(H0 * BEAR_SCALE);
    ctx.save(); ctx.translate(x, y + H0);
    if (ba && ba.frames && ba.frames.length){
      const fps = 10 * ANIM_SPEED; let idx = Math.floor((ba.t||0) * fps) % ba.frames.length; if (!isFinite(idx) || idx<0) idx=0;
      const im = ba.frames[idx]; ctx.imageSmoothingEnabled = false; ctx.drawImage(im, 0,0, im.naturalWidth, im.naturalHeight, 0, -Hd, Wd, Hd);
    } else {
      ctx.fillStyle="#78350f"; ctx.fillRect(0, -Hd+20*BEAR_SCALE, Wd, Hd-24*BEAR_SCALE);
      ctx.beginPath(); ctx.arc(Wd-10*BEAR_SCALE, -Hd+26*BEAR_SCALE, 14*BEAR_SCALE, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle="#fde68a"; ctx.fillRect(Wd-6*BEAR_SCALE, -Hd+22*BEAR_SCALE, 3*BEAR_SCALE, 3*BEAR_SCALE);
    }
    ctx.restore();
  }
  function drawEvilEye(ctx, x, y, outlined=false){
    ctx.save(); ctx.translate(x,y);
    if (outlined){ ctx.strokeStyle="#9333ea"; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(0,0,16,11,0,0,Math.PI*2); ctx.stroke(); }
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
      const pct=Math.min(1,wardLeft/8); const rad=44*HERO_SCALE_Y+6*Math.sin(performance.now()*0.006);
      const grd=ctx.createRadialGradient(0,0,10, 0,0,rad);
      grd.addColorStop(0,`rgba(56,189,248,${0.25+0.25*pct})`); grd.addColorStop(1,"rgba(56,189,248,0)");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,rad,0,Math.PI*2); ctx.fill();
    }
    const anim = heroAnim.current; const clip = anim && anim.clips ? anim.clips[heroState.current.name] : null;
    if (clip && clip.frames && clip.frames.length) {
      const count = clip.frames.length; let fps = Number(clip.fps) || 10; let tt = Number(heroState.current.t) || 0;
      let idx = Math.floor(tt * fps); if (!isFinite(idx) || idx < 0) idx = 0; idx = clip.loop ? (idx % count) : Math.min(idx, count-1);
      const fr = clip.frames[idx] || clip.frames[0];
      if (facing<0){ ctx.scale(-1,1); }
      const ox = anim && anim.origin ? anim.origin[0] : 0.5, oy = anim && anim.origin ? anim.origin[1] : 1;
      const dx = -ox * dw, dy = -oy * dh + HERO_FOOT_ADJ_PX;
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
    ctx.save(); ctx.globalAlpha=.95; ctx.fillStyle="#fff"; ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=2;
    const barW = level===1 ? 200 : 260;
    ctx.fillRect(12,56,barW,62); ctx.strokeRect(12,56,barW,62);

    const slots = level===1
      ? [
          {key:"speed",label:"Vit.", png:amuletsRef.current.speed,  owned:inv.current.speed},
          {key:"purify",label:"Purif.", png:amuletsRef.current.purify, owned:inv.current.purify},
          {key:"ward",label:"Boucl.", png:amuletsRef.current.ward, owned:inv.current.ward},
        ]
      : [
          {key:"oracle",label:"Oracle", png:null, owned:inv.current.oracle},
          {key:"purify",label:"Purif.", png:amuletsRef.current.purify, owned:inv.current.purify},
          {key:"ward",label:"Boucl.", png:amuletsRef.current.ward, owned:inv.current.ward},
        ];

    for(let i=0;i<slots.length;i++){
      const x=20+i*64; ctx.strokeStyle="#cbd5e1"; ctx.strokeRect(x,64,56,48);
      drawAmuletMini(ctx,x+28,88, slots[i].png, slots[i].key, slots[i].owned);
      ctx.fillStyle="#334155"; ctx.font="10px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(slots[i].label, x+28, 116);
    }

    // Timers
    ctx.fillStyle="#0f172a"; ctx.font="10px ui-sans-serif, system-ui"; ctx.textAlign="left";
    let info="";
    if (wardTimer.current>0) info = `Bouclier ${(wardTimer.current).toFixed(1)}s`;
    if (oracleTimer.current>0) info = `Oracle ${(oracleTimer.current).toFixed(1)}s`;
    if (info){ ctx.fillText(info, 12+barW+12, 84); }

    // Musique
    ctx.fillStyle = musicOn ? "#16a34a" : "#ef4444"; ctx.beginPath(); ctx.arc(12+barW+12,110,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#0f172a"; ctx.fillText("Musique (M)", 12+barW+26,114);
    ctx.restore();

    // Summary overlay: rempli par le DOM
    if (summaryOpen) { const W = WORLD_W, H = WORLD_H; ctx.save(); ctx.fillStyle="rgba(255,255,255,.95)"; ctx.fillRect(0,0,W,H); ctx.restore(); }
  }
  function drawAmuletMini(ctx,cx,cy, png, type, owned){
    ctx.save(); ctx.translate(cx,cy); ctx.globalAlpha = owned ? 1 : .35;
    if (png) { ctx.imageSmoothingEnabled = false; ctx.drawImage(png, -16, -16, 32, 32); }
    else {
      ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.stroke();
      ctx.font="bold 10px ui-sans-serif, system-ui"; ctx.fillStyle="#111827"; ctx.textAlign="center"; ctx.fillText(type==="oracle"?"O":"",0,3);
    }
    ctx.restore();
  }
  function drawEduToast(ctx, text){
    const pad=12, boxW=Math.min(760,WORLD_W-40), x=20, y=20+40;
    ctx.save(); ctx.globalAlpha=.98; ctx.fillStyle="#ffffff"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2;
    ctx.fillRect(x,y,boxW,82); ctx.strokeRect(x,y,boxW,82);
    ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui"; wrapText(ctx,text,x+12,y+26,boxW-24,18); ctx.restore();
  }
  function wrapText(ctx, text, x,y, maxW, lh){
    const words=text.split(" "); let line="";
    for(let n=0;n<words.length;n++){ const test=line+words[n]+" "; if(ctx.measureText(test).width>maxW && n>0){ ctx.fillText(line,x,y); line=words[n]+" "; y+=lh; } else line=test; }
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

  return (
    <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#fafaf9,#e7e5e4)", color:"#111827"}}>
      <div className="max-w-5xl mx-auto" style={{padding:"16px"}}>
        <div className="mb-2" style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between"}}>
          <h1 className="text-xl sm:text-2xl" style={{fontWeight:600}}>Runner 2D – Amulettes d’astragale</h1>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button onClick={toggleMusic} style={btn()}> {musicOn ? "Musique ON" : "Musique OFF"} </button>
            <button onClick={()=>setPaused(v=>!v)} disabled={inIntro||summaryOpen||!!learnModal} style={primaryBtn(inIntro||summaryOpen||!!learnModal)}>{paused ? "Lecture" : "Pause"}</button>
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
          {inIntro
            ? (level===1
                ? "Niveau 1 : découvre Vitesse (S), Purification (C) et Bouclier (W)."
                : "Niveau 2 : découvre Oracle (O) et anticipe les obstacles intermittents.")
            : "← → bouger • Espace sauter • S/C/W (LVL1) • O (LVL2) • P pause • M musique"}
        </p>

        <div className="bg-white" style={{border:"1px solid #e5e7eb", borderRadius:14, padding:12, boxShadow:"0 6px 16px rgba(0,0,0,.05)"}}>
          <div ref={wrapperRef} className="w-full" style={{position:"relative", overflow:"hidden", border:"1px solid #e5e7eb", borderRadius:12}}>
            <canvas ref={canvasRef} />

            {/* Bouton Start bien visible en bas */}
            {inIntro && <button onClick={startGame} style={startBtnStyle}>Start</button>}

            {/* Fenêtre pédagogique (met le jeu en pause) */}
            {learnModal && (
              <div style={{position:"absolute", inset:0, background:"rgba(255,255,255,.96)", display:"flex", alignItems:"center", justifyContent:"center", padding:24, zIndex:6}}>
                <div style={{width:"min(720px,100%)", background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:16, boxShadow:"0 8px 24px rgba(0,0,0,.08)"}}>
                  <h3 style={{fontWeight:700, fontSize:18, marginBottom:8}}>{learnModal.title}</h3>
                  <p style={{margin:"8px 0 12px", color:"#334155"}}>{learnModal.body}</p>
                  <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
                    <button onClick={()=>setLearnModal(null)} style={primaryBtn(false)}>OK, reprendre (touche {learnModal.key})</button>
                  </div>
                </div>
              </div>
            )}

            {/* Résumé de fin */}
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
                        {level===1 ? (
                          <>
                            <li><strong>Vitesse</strong> (NIKÊ) : accélérer pour échapper au danger (ours).</li>
                            <li><strong>Purification</strong> (KATHARSIS) : retirer miasmes/maladie.</li>
                            <li><strong>Bouclier</strong> (APOTROPAÏON) : contre le « mauvais œil ».</li>
                          </>
                        ) : (
                          <>
                            <li><strong>Oracle</strong> (MANTIS) : révéler l’invisible (pièges intermittents).</li>
                            <li>Revoir : Purify (C) et Ward (W) si besoin.</li>
                          </>
                        )}
                        {eduLog.current.slice(-4).map((t,i)=> <li key={i} style={{opacity:.85}}>{t}</li>)}
                      </ul>
                    </div>
                    <div style={{background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:12, padding:12, fontSize:14}}>
                      <h3 style={{fontWeight:600, marginBottom:8}}>Questions flash</h3>
                      <ol style={{paddingLeft:18, margin:0}}>
                        {level===1 ? (
                          <>
                            <li>Quel os est l’« astragale » ?</li>
                            <li>Pourquoi percer un osselet ?</li>
                            <li>Contre quoi protège le bouclier ?</li>
                          </>
                        ) : (
                          <>
                            <li>À quoi sert l’Oracle en jeu ?</li>
                            <li>Comment repérer un piège intermittent sans Oracle ?</li>
                          </>
                        )}
                      </ol>
                    </div>
                  </div>
                  <div style={{display:"flex", gap:8, justifyContent:"end", marginTop:12}}>
                    <button onClick={()=>{ setSummaryOpen(false); softResetForLevel(); }} style={btnDark()}>Recommencer le niveau</button>
                    {level===1
                      ? <button onClick={()=>{ setSummaryOpen(false); setLevel(2); }} style={primaryBtn(false)}>Niveau suivant →</button>
                      : <button onClick={()=>{ setSummaryOpen(false); setLevel(1); }} style={primaryBtn(false)}>Retour niveau 1</button>}
                  </div>
                </div>
              </div>
            )}

            {/* Contrôles tactiles */}
            {mobileMode && !inIntro && !summaryOpen && !learnModal && (
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
            Osselets 2D (mini-jeu) : <code>/assets/games/osselets/audio/img/osselets/osselet (1..5).png</code> (+ <code>osselet-shadow.png</code> optionnel).
          </div>
        </div>
      </div>
    </div>
  );

  function TouchBtn(props){
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
}

// @ts-ignore
window.AstragalusRunner = AstragalusRunner;
