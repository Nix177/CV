// public/osselets-runner.tsx
// Runner 2D – Amulettes d’astragale (LEVEL 1) — version enrichie & pédagogique
// - Start panel centré + bouton Start
// - 10 amulettes & passifs : speed / purify / ward / oracle / prosperity / pleisto / nikeDash / kleros / tyche / symbolon(A/B)
// - Contexte de jeu = analogie historique (toasts courts déclenchés au bon moment)
// - Porte Symbolon (A+B), mur friable (Nikê dash), ours (Vitesse), salissure (Purify), vague « mauvais œil » (Ward)
// - Checkpoints (autels), score simple, bus audio local (boutons Musique ON/OFF)

// ⚠️ Le code reste vanilla (React via Babel in-page), aucun build requis pour tester.

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

// PNG amulettes (les autres sont dessinées en vectoriel)
const AMULET_FILES = {
  speed:  "amulette-speed.png",
  purify: "amulette-purify.png",
  ward:   "amulette-ward.png",
};

// Screenshot d’accueil (optionnel) recherché avant Start
const START_SCREENSHOT_CANDIDATES = ["start-screenshot.webp","start-screenshot.png","start-screenshot.jpg"];

/* -------------------- Réglages visuels/jeux -------------------- */
const WORLD_W = 960, WORLD_H = 540;
const ANIM_SPEED = 0.10;
const HERO_SCALE_X = 1.70, HERO_SCALE_Y = 1.50, HERO_FOOT_ADJ_PX = 12;
const BEAR_SCALE = 1.5;
const GROUND_Y  = 440;
const WORLD_LEN = 4300;

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
    try {
      const r = await fetch(base + file, { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (e) {}
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
  const [inIntro, setInIntro]         = useState(true);
  const [paused, setPaused]           = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [level, setLevel]             = useState(1);
  const [message, setMessage]         = useState("← → bouger | Espace sauter | S/C/W activer | O/P/L/D/K autres amulettes | P pause | M musique");

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
        if (def && def.files) {
          const imgs = (await Promise.all(def.files.map((f)=>loadImageSmart(f)))).filter(Boolean);
          if (!imgs.length) return null;
          return { frames: imgs.map(im=>({image:im,sx:0,sy:0,sw:im.naturalWidth,sh:im.naturalHeight})), fps: Number(def.fps)||10, loop: !!def.loop, name };
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
  const player = useRef({
    x:120, y:GROUND_Y-68, w:42, h:68, vx:0, vy:0, onGround:true, facing:1,
    baseSpeed:3.0, speedMul:1.0, dirt:0, runPhase:0, coyote:0, jumpBuf:0
  });
  const keys = useRef({});
  const [levelState, setLevelState] = useState(1);
  const levelRef = useRef(levelState); useEffect(()=>{ levelRef.current = levelState; },[levelState]);

  // Santé / score / invulnérabilité
  const hp = useRef(3);
  const invul = useRef(0);
  const score = useRef(0);
  const scoreMul = useRef(1);

  // Inventaire & actifs
  const inv = useRef({
    speed:false, purify:false, ward:false,
    oracle:false, prosperity:false, pleisto:false, nikeDash:false, kleros:false,
    symbolonA:false, symbolonB:false, tycheCharges:0
  });
  const active = useRef({ name:null, until:0 });   // une seule amulette active à la fois
  const wardTimer = useRef(0);                     // bouclier Ward (visuel)
  const oracleTimer = useRef(0);                   // outlines & léger slow
  const pleistoTimer = useRef(0);                  // super-saut
  const prosperityTimer = useRef(0);               // score x2
  const dashTimer = useRef(0);                     // ruée courte
  const klerosTimer = useRef(0);                   // durées internes

  // Bear & vagues d’yeux
  const bear = useRef({ x:-999, y:GROUND_Y-60, w:64, h:60, vx:0, active:false });
  const eyes = useRef([]);
  const stage = useRef("start");

  // Checkpoints & obstacles
  const checkpoint = useRef({ x:120, y:GROUND_Y-68 });
  const gates = useRef({ symbolonLocked:true, fragileWall:true }); // porte & mur
  const coins = useRef(
    // petites récompenses avant/après Prospérité
    [0,1,2,3,4,5,6,7].map(i=>({x:2520+i*24, y:GROUND_Y-70-(i%2?8:0), taken:false}))
  );

  // ===== Nouvel overlay éducatif court (toasts) =====
  const [edu, setEdu] = useState(null);
  const eduLog = useRef([]);
  function pushEdu(msg, ms=5200){
    const until = performance.now()+ms; setEdu({msg, until});
    if (!eduLog.current.length || eduLog.current[eduLog.current.length-1] !== msg){
      eduLog.current.push(msg); if (eduLog.current.length>8) eduLog.current.shift();
    }
  }
  const eduSeen = useRef({
    speed:false, purify:false, ward:false, oracle:false, prosperity:false, pleisto:false, nikeDash:false, kleros:false, tyche:false, symbolon:false
  });

  // --- Pickups scénarisés (x coord) ---
  const PICKUPS = useRef([
    { x:  900, type:"speed",     label:"Vitesse",    png:"speed"   },
    { x: 1400, type:"kleros",    label:"Klêros",     png:null      },
    { x: 1800, type:"oracle",    label:"Oracle",     png:null      },
    { x: 2000, type:"purify",    label:"Purif.",     png:"purify"  },
    { x: 2300, type:"symbolonA", label:"Symbolon A", png:null      },
    { x: 2550, type:"prosperity",label:"Prosp.",     png:null      },
    { x: 2900, type:"symbolonB", label:"Symbolon B", png:null      },
    { x: 3050, type:"altar",     label:"Autel",      png:null      }, // checkpoint pédagogique
    { x: 3100, type:"ward",      label:"Bouclier",   png:"ward"    },
    { x: 3300, type:"tyche",     label:"Tychê",      png:null      },
    { x: 3600, type:"pleisto",   label:"Saut+",      png:null      },
    { x: 3900, type:"nikeDash",  label:"Nikê",       png:null      },
  ]);

  // Intro / messages contextuels
  const intro = useRef({ step:0, t:0 });

  // clavier
  useEffect(() => {
    function down(e) {
      if (["ArrowLeft","ArrowRight"," ","Space","m","M","p","P","s","S","c","C","w","W","o","O","p","P","l","L","d","D","k","K"].includes(e.key)) e.preventDefault();
      if (inIntro) {
        if (e.key==="ArrowRight"){ intro.current.step=Math.min(5,intro.current.step+1); intro.current.t=0; }
      } else if (!summaryOpen) {
        if (e.key==="ArrowLeft") keys.current.left=true;
        if (e.key==="ArrowRight") keys.current.right=true;
        if (e.key===" "||e.key==="Space") keys.current.jump=true;

        // Activation d’amulette (exclusif)
        if (e.key==="s"||e.key==="S") tryActivate("speed");
        if (e.key==="c"||e.key==="C") tryActivate("purify");
        if (e.key==="w"||e.key==="W") tryActivate("ward");
        if (e.key==="o"||e.key==="O") tryActivate("oracle");
        if (e.key==="p"||e.key==="P") tryActivate("prosperity");
        if (e.key==="l"||e.key==="L") tryActivate("pleisto");
        if (e.key==="d"||e.key==="D") tryActivate("nikeDash");
        if (e.key==="k"||e.key==="K") tryActivate("kleros");
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
    Object.assign(inv.current, { speed:false,purify:false,ward:false,oracle:false,prosperity:false,pleisto:false,nikeDash:false,kleros:false,symbolonA:false,symbolonB:false,tycheCharges:0 });
    wardTimer.current=0; oracleTimer.current=0; pleistoTimer.current=0; prosperityTimer.current=0; dashTimer.current=0; klerosTimer.current=0;
    active.current={name:null,until:0};
    bear.current={ x:-999,y:GROUND_Y-60,w:64,h:60,vx:0,active:false };
    eyes.current=[]; stage.current="start";
    checkpoint.current={x:120,y:GROUND_Y-68}; gates.current={symbolonLocked:true, fragileWall:true};
    coins.current.forEach(c=>c.taken=false);
    hp.current=3; invul.current=0; score.current=0; scoreMul.current=1;
    eduLog.current.length=0;
    setEdu(null);
    setMessage("← → bouger | Espace sauter | S/C/W activer | O/P/L/D/K autres amulettes | P pause | M musique");
    setSummaryOpen(false); if(goIntro){ setInIntro(true); intro.current={step:0,t:0}; }
  }
  function nextLevel(){ setLevel(l=>l+1); setLevelState(v=>v+1); resetLevel(false); setPaused(false); }

  /* ---------- Activation d’amulette (exclusif + toasts) ---------- */
  const DUR = { speed:8, purify:6, ward:8, oracle:6, prosperity:10, pleisto:8, nikeDash:0.35, kleros:0.1 };
  function tryActivate(name){
    if (!inv.current[name]){
      pushEdu("Trouve d’abord cette amulette (cherche le pendentif plus loin).");
      return;
    }
    // Exclusivité : suspension des effets en cours
    active.current = { name, until: performance.now() + DUR[name]*1000 };
    if (name!=="ward") wardTimer.current = 0;        // ward géré à part
    if (name!=="oracle") oracleTimer.current = 0;
    if (name!=="pleisto") pleistoTimer.current = 0;
    if (name!=="prosperity") { prosperityTimer.current = 0; scoreMul.current=1; }
    if (name!=="nikeDash") dashTimer.current = 0;
    if (name!=="kleros") klerosTimer.current = 0;

    switch(name){
      case "speed":
        player.current.speedMul=1.6;
        pushEdu("NIKÊ (victoire) — l’astragale (talus) est l’os du mouvement : ici, il te donne l’élan pour distancer l’ours (appuie S).");
        break;
      case "purify":
        player.current.dirt = Math.max(0, player.current.dirt-0.35);
        pushEdu("KATHARSIS — comme l’os poli/apaisé après le sacrifice, tu effaces la souillure (Soin/Nettoyage) (C).");
        break;
      case "ward":
        wardTimer.current = DUR.ward;
        pushEdu("APOTROPAÏON — amulette contre le « mauvais œil ». Tant que l’aura tient, les yeux rebondissent (W).");
        break;
      case "oracle":
        oracleTimer.current = DUR.oracle;
        pushEdu("MANTIS (oracle) — certains osselets servaient à la divination : tu ‘vois’ les pièges un court instant (O).");
        break;
      case "prosperity":
        prosperityTimer.current = DUR.prosperity; scoreMul.current=2;
        pushEdu("EUPHORÍA (abondance) — l’osselet votif porte chance à la maisonnée : points x2 temporairement (P).");
        break;
      case "pleisto":
        pleistoTimer.current = DUR.pleisto;
        pushEdu("PLEISTOBOLINDA — ‘lancer le plus haut’ : ton saut gagne en hauteur et contrôle (L).");
        break;
      case "nikeDash":
        dashTimer.current = DUR.nikeDash; player.current.vx += 10; invul.current = Math.max(invul.current, 0.5);
        pushEdu("NIKÊ gravée — une ruée courte perce les obstacles friables (D).");
        // briser le mur si on est proche
        if (Math.abs(player.current.x-3960) < 80) gates.current.fragileWall=false, addBubble(3960,GROUND_Y-120,"Mur brisé !");
        break;
      case "kleros":
        // tirage d’un boon de 8 s (hors ward pour l’équilibre ici)
        const pool = ["speed","oracle","prosperity","pleisto"];
        const pick = pool[Math.floor(Math.random()*pool.length)];
        active.current={ name:pick, until: performance.now() + DUR[pick]*1000 };
        if (pick==="speed") player.current.speedMul=1.6;
        if (pick==="oracle") oracleTimer.current = DUR.oracle;
        if (pick==="prosperity") { prosperityTimer.current = DUR.prosperity; scoreMul.current=2; }
        if (pick==="pleisto") pleistoTimer.current = DUR.pleisto;
        pushEdu("KLÊROS — tirage au sort bienveillant : une faveur des osselets s’applique au hasard.");
        break;
    }
    playOne(sfxCatchEl);
  }

  /* ---------- Boucle ---------- */
  const reqRef = useRef(null);
  useEffect(() => {
    const ctx = ctxRef.current || (canvasRef.current ? canvasRef.current.getContext("2d") : null); if (!ctx) return;
    let last = performance.now();
    const tick = (t) => {
      let dtms = t-last; if (dtms>66) dtms=66; last=t;
      // léger slow sous Oracle
      const slow = oracleTimer.current>0 ? 0.85 : 1.0;
      const dt = (dtms/16.666) * slow;

      if (!paused) update(dt, dtms/1000);
      render(ctx);
      reqRef.current = requestAnimationFrame(tick);
    };
    reqRef.current = requestAnimationFrame(tick);
    return ()=>{ if(reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [paused, inIntro, mobileMode]);

  // update
  function update(dt /*frames*/, dtSecs){
    if (inIntro || summaryOpen) {
      if (inIntro){ intro.current.t+=dt; if(intro.current.t>4){ intro.current.t=0; intro.current.step=Math.min(5,intro.current.step+1);} }
    return; }

    const p = player.current;

    // Expiration d’effet actif
    if (active.current.name && performance.now() > active.current.until){
      if (active.current.name==="speed") p.speedMul=1.2; // léger reste après la course
      active.current.name=null;
    }
    // Timers
    if (wardTimer.current>0) wardTimer.current = Math.max(0, wardTimer.current - dtSecs);
    if (oracleTimer.current>0) oracleTimer.current = Math.max(0, oracleTimer.current - dtSecs);
    if (pleistoTimer.current>0) pleistoTimer.current = Math.max(0, pleistoTimer.current - dtSecs);
    if (prosperityTimer.current>0){ prosperityTimer.current = Math.max(0, prosperityTimer.current - dtSecs); if (prosperityTimer.current===0) scoreMul.current=1; }
    if (dashTimer.current>0) dashTimer.current = Math.max(0, dashTimer.current - dtSecs);
    if (invul.current>0) invul.current = Math.max(0, invul.current - dtSecs);

    // Inputs
    const left  = keys.current.left  || onScreenKeys.current.left;
    const right = keys.current.right || onScreenKeys.current.right || (mobileMode && oneButton);
    const jump  = keys.current.jump  || onScreenKeys.current.jump;

    // Horizontal
    let ax=0; if(left){ax-=1;p.facing=-1;} if(right){ax+=1;p.facing=1;}
    const targetVx = ax * p.baseSpeed * p.speedMul + (dashTimer.current>0 ? 6 : 0);
    p.vx += (targetVx - p.vx) * 0.4;

    // Coyote/buffer
    p.coyote = p.onGround ? 0.12 : Math.max(0, p.coyote - dt*0.016);
    p.jumpBuf = jump ? 0.12 : Math.max(0, p.jumpBuf - dt*0.016);

    // Gravité + saut (boost sous Pleistobolinda)
    p.vy += 0.8 * dt;
    const jumpPower = pleistoTimer.current>0 ? -17.5 : -14;
    if (p.jumpBuf>0 && (p.coyote>0 || p.onGround)) { p.vy=jumpPower; p.onGround=false; p.coyote=0; p.jumpBuf=0; playOne(sfxJumpEl); }

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

    // ---- PÉDAGO : toasts d’approche des pickups (une fois) ----
    const near = (X, px=80)=>Math.abs(p.x-X)<px;
    if (!eduSeen.current.speed  && near(900))  { eduSeen.current.speed  = true; pushEdu("Vitesse — talus = os du mouvement. Les athlètes portaient des talismans : active-la (S) quand l’ours arrive."); }
    if (!eduSeen.current.kleros && near(1400)) { eduSeen.current.kleros = true; pushEdu("Klêros — tirage au sort : parfois on ‘demande’ la chance aux osselets."); }
    if (!eduSeen.current.oracle && near(1800)) { eduSeen.current.oracle = true; pushEdu("Oracle — divination : voir un danger à l’avance peut sauver !"); }
    if (!eduSeen.current.purify && near(2000)) { eduSeen.current.purify = true; pushEdu("Purification — l’osselet travaillé devient ‘propre’ et portable (C pour nettoyer)."); }
    if (!eduSeen.current.symbolon && near(2300)) { eduSeen.current.symbolon = true; pushEdu("Symbolon — deux moitiés à réunir : cherche A puis B pour ouvrir la porte plus loin."); }
    if (!eduSeen.current.prosperity && near(2550)) { eduSeen.current.prosperity = true; pushEdu("Prospérité — offrande/bonheur domestique : points x2 pendant un court moment (P)."); }
    if (!eduSeen.current.ward   && near(3100)) { eduSeen.current.ward   = true; pushEdu("Apotropaïque — contre le ‘mauvais œil’. Active (W) pendant la vague d’yeux."); }
    if (!eduSeen.current.tyche  && near(3300)) { eduSeen.current.tyche  = true; pushEdu("Tychê — une deuxième chance si tu te fais toucher : charge sauvegardée automatiquement."); }
    if (!eduSeen.current.pleisto&& near(3600)) { eduSeen.current.pleisto= true; pushEdu("Pleistobolinda — ‘lancer haut’ : saut plus puissant (L)."); }
    if (!eduSeen.current.nikeDash&& near(3900)){ eduSeen.current.nikeDash= true; pushEdu("Nikê gravée — dash court (D) : utile pour briser un mur léger."); }

    // ---- Pickups (collision simple) ----
    for (const pk of PICKUPS.current){
      if (pk.taken) continue;
      if (Math.abs(p.x - pk.x) < 20 && Math.abs((p.y+p.h) - GROUND_Y) < 24){
        pk.taken = true;
        switch(pk.type){
          case "speed": inv.current.speed=true; addBubble(pk.x, GROUND_Y-80,"Vitesse obtenue"); break;
          case "purify": inv.current.purify=true; addBubble(pk.x, GROUND_Y-80,"Purification obtenue"); break;
          case "ward": inv.current.ward=true; addBubble(pk.x, GROUND_Y-80,"Bouclier obtenu"); break;
          case "oracle": inv.current.oracle=true; addBubble(pk.x, GROUND_Y-80,"Oracle obtenu"); break;
          case "prosperity": inv.current.prosperity=true; addBubble(pk.x, GROUND_Y-80,"Prospérité obtenue"); break;
          case "pleisto": inv.current.pleisto=true; addBubble(pk.x, GROUND_Y-80,"Saut+ obtenu"); break;
          case "nikeDash": inv.current.nikeDash=true; addBubble(pk.x, GROUND_Y-80,"Dash obtenu"); break;
          case "kleros": inv.current.kleros=true; addBubble(pk.x, GROUND_Y-80,"Klêros obtenu"); break;
          case "symbolonA": inv.current.symbolonA=true; addBubble(pk.x, GROUND_Y-80,"Symbolon A"); break;
          case "symbolonB": inv.current.symbolonB=true; addBubble(pk.x, GROUND_Y-80,"Symbolon B"); break;
          case "tyche": inv.current.tycheCharges=(inv.current.tycheCharges||0)+1; addBubble(pk.x,GROUND_Y-80,"Tychê +1"); break;
          case "altar": checkpoint.current={ x:pk.x, y:GROUND_Y-68 }; addBubble(pk.x,GROUND_Y-80,"Autel : checkpoint posé"); break;
        }
        playOne(sfxCatchEl);
      }
    }

    // ---- Script d'événements (flow scénarisé) ----

    // Démarrage poursuite ours quand on dépasse 1000
    if (stage.current==="start" && p.x > 1000) {
      stage.current="bearChase"; bear.current.active=true; bear.current.x=p.x-300; bear.current.vx=2.8;
      setMessage("Un ours te poursuit ! Active Vitesse (S).");
    }

    // Poursuite de l’ours
    if (stage.current==="bearChase" && bear.current.active) {
      const d=p.x-bear.current.x, diff=0.2*(levelRef.current-1);
      const desired = d>260?3.2+diff : d<140?2.2+diff : 2.8+diff;
      bear.current.vx += (desired - bear.current.vx)*0.04;
      bear.current.x += (bear.current.vx * dt * 60)/60;
      if (bearAnim.current) bearAnim.current.t += dt * ANIM_SPEED;
      p.dirt = clamp(p.dirt + 0.002*dt, 0, 1);

      // Si l’ours rattrape (et pas invulnérable) → dégât
      if (bear.current.x + bear.current.w > p.x && invul.current<=0){
        damage(1, "Tu as été rattrapé ! Tychê peut te sauver une fois.");
        bear.current.x = p.x - 320; // le replace pour ne pas boucler
      }
      if (p.x > 2000){ stage.current="postChase"; bear.current.active=false; if (active.current.name==="speed") player.current.speedMul=1.2; setMessage("Tu t’es échappé !"); }
    }

    // Porte Symbolon (se déverrouille avec A & B)
    if (gates.current.symbolonLocked && inv.current.symbolonA && inv.current.symbolonB){
      gates.current.symbolonLocked=false; addBubble(3050,GROUND_Y-120,"Les deux moitiés concordent !");
    }

    // Vague du « mauvais œil » après 3200
    if ((stage.current==="postChase"||stage.current==="start") && p.x > 3200 && !eyes.current.length) {
      stage.current="evilEyeWave";
      const n=6+(levelRef.current-1)*4;
      for(let i=0;i<n;i++)
        eyes.current.push({ x:p.x+240+i*90, y:GROUND_Y-100-((i%3)*30), vx:-(2.2+((i%3)*0.4)+0.1*(levelRef.current-1)), vy:0, alive:true });
      setMessage("Vague du ‘mauvais œil’ ! Active Ward (W).");
    }

    // Mouvements des yeux + collisions
    if (eyes.current.length){
      for(let i=0;i<eyes.current.length;i++){
        const e = eyes.current[i]; if(!e.alive) continue;
        e.x += (e.vx * dt * 60)/60;
        if (rectOverlap(e.x-10,e.y-6,20,12, p.x,p.y,p.w,p.h)) {
          if (wardTimer.current>0){ e.vx=-e.vx*0.6; e.x+=e.vx*4; e.alive=false; }
          else {
            // sans Ward : dégâts + malus léger
            if (invul.current<=0) damage(1, "Touché par le ‘mauvais œil’ !");
            p.speedMul=Math.max(0.9,p.speedMul-0.2);
            setTimeout(function(){p.speedMul=Math.min(1.2,p.speedMul+0.2);},1200);
            e.alive=false; playOne(sfxOuchEl);
          }
        }
      }
      eyes.current = eyes.current.filter(e=> e.alive && e.x>-100);
      if (eyes.current.length===0 && stage.current==="evilEyeWave") { stage.current="endFlow"; setMessage("Fin de démo — continue jusqu’au bout →"); }
    }

    // Pièces (score x2 sous Prospérité)
    for (const c of coins.current){
      if (!c.taken && Math.abs(p.x-c.x)<16 && Math.abs((p.y+p.h)-GROUND_Y)<20){
        c.taken=true; const add = 10 * (scoreMul.current||1); score.current+=add; addBubble(c.x,GROUND_Y-70,`+${add} pts`);
        playOne(sfxCatchEl);
      }
    }

    // Fin
    if (p.x >= WORLD_LEN-80 && !summaryOpen) { setPaused(true); setSummaryOpen(true); }
  }

  function damage(dmg, why=""){
    if (invul.current>0) return;
    // Tychê ? (2e chance)
    if (inv.current.tycheCharges>0){
      inv.current.tycheCharges--; invul.current=1.2;
      addBubble(player.current.x, player.current.y-40, "Tychê te sauve !");
      pushEdu("Tychê — la ‘chance’ te remet sur pied : tu repars un peu en arrière, invulnérable un instant.");
      player.current.x -= 80; player.current.vx = 0; return;
    }
    hp.current = Math.max(0, hp.current - dmg);
    invul.current = 1.0;
    if (hp.current<=0){
      // Respawn au checkpoint
      addBubble(player.current.x, player.current.y-40, why || "Tu as été mis à terre !");
      player.current.x = checkpoint.current.x; player.current.y = checkpoint.current.y;
      player.current.vx=0; player.current.vy=0; player.current.onGround=true; hp.current=2;
      setMessage("Reprise au dernier autel (checkpoint).");
    }
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

    // Pickups visibles
    for (const pk of PICKUPS.current){
      if (pk.taken) continue;
      if (pk.type==="altar") { drawAltar(ctx, pk.x, GROUND_Y-12); continue; }
      const png = pk.png && amuletsRef.current[pk.png];
      drawAmulet(ctx, pk.x,  GROUND_Y-40, pk.label, png, pk.type);
    }

    // Porte Symbolon
    if (gates.current.symbolonLocked){
      ctx.fillStyle="#7c3aed"; ctx.fillRect(3040, GROUND_Y-120, 10, 120);
      ctx.fillStyle="#1e293b"; ctx.font="11px ui-sans-serif, system-ui"; ctx.save(); ctx.translate(3055,GROUND_Y-124); ctx.rotate(-Math.PI/2);
      ctx.fillText("Porte — Symbolon A+B", 0, 0); ctx.restore();
    }

    // Mur friable (Nikê dash)
    if (gates.current.fragileWall){
      ctx.fillStyle="#f59e0b"; ctx.fillRect(3960, GROUND_Y-120, 8, 120);
      ctx.fillStyle="#1e293b"; ctx.font="11px ui-sans-serif, system-ui"; ctx.save(); ctx.translate(3976,GROUND_Y-124); ctx.rotate(-Math.PI/2);
      ctx.fillText("Mur friable (D)", 0, 0); ctx.restore();
    }

    // collisions douces avec les barrières
    if (gates.current.symbolonLocked && p.x+p.w > 3040-2 && p.x < 3050) player.current.x = 3040-2-p.w;
    if (gates.current.fragileWall && p.x+p.w > 3960-2 && p.x < 3970) player.current.x = 3960-2-p.w;

    if (bear.current.active) drawBear(ctx, bear.current.x, bear.current.y);
    for(let i=0;i<eyes.current.length;i++){ const e = eyes.current[i]; if(e.alive) drawEvilEye(ctx,e.x,e.y, oracleTimer.current>0); }
    drawHero(ctx, p.x,p.y,p.w,p.h,p.facing,p.dirt,p.runPhase,wardTimer.current);

    // Pièces
    for (const c of coins.current){
      if (!c.taken) drawCoin(ctx, c.x, c.y);
    }

    // Arrivée
    ctx.fillStyle="#94a3b8"; ctx.fillRect(WORLD_LEN-40, GROUND_Y-120, 8, 120);

    // bulles pickup
    {
      const now = performance.now();
      const arr = bubbles.current;
      for (let i=0;i<arr.length;i++){
        const b = arr[i];
        if (now <= b.until) drawPickupBubble(ctx, Math.round(b.x - camX), Math.round(b.y - 70), b.text);
      }
      bubbles.current = arr.filter(b=> now <= b.until);
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
    else {
      // dessin vectoriel simple selon type
      ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.ellipse(0,0,14,10,0,0,Math.PI*2); ctx.stroke();
      ctx.save(); ctx.translate(0,0);
      ctx.font="bold 12px ui-sans-serif, system-ui"; ctx.fillStyle="#111827"; ctx.textAlign="center";
      const map = { oracle:"O", prosperity:"×2", pleisto:"↑", nikeDash:"↠", kleros:"?", symbolonA:"A", symbolonB:"B", tyche:"★" };
      ctx.fillText(map[type]||"",0,4);
      ctx.restore();
    }
    ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(label, 0, 30);
    ctx.restore();
  }

  function drawAltar(ctx, x, y){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle="#fde68a"; ctx.fillRect(-14,-12,28,12);
    ctx.fillStyle="#b45309"; ctx.fillRect(-18,-14,36,4);
    ctx.fillStyle="#111827"; ctx.font="10px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText("Autel",0,-18);
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
    const widths = lines.map(l=> ctx.measureText(l).width);
    const w = Math.max(60, Math.min(maxW, (widths.length ? Math.max.apply(null, widths) : 0) + pad*2));
    const h = lines.length*16 + pad*2 + 8;

    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    const r=8; const x0=-w/2, y0=-h, x1=x0+w, y1=y0+h;
    ctx.beginPath();
    ctx.moveTo(x0+r,y0);
    ctx.arcTo(x1,y0,x1,y1,r);
    ctx.arcTo(x1,y1,x0,y1,r);
    ctx.arcTo(x0,y1,x0,y0,r);
    ctx.arcTo(x0,y0,x1,y0,r);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // tail
    ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(0, 10); ctx.lineTo(8, -2); ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#0f172a";
    let yy = y0 + pad + 12;
    for (let i=0;i<lines.length;i++) { ctx.fillText(lines[i], x0 + pad, yy); yy += 16; }
    ctx.restore();
  }

  function drawAmuletMini(ctx,cx,cy, png, type){
    ctx.save(); ctx.translate(cx,cy);
    if (png) { ctx.imageSmoothingEnabled = false; ctx.drawImage(png, -16, -16, 32, 32); }
    else {
      ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.stroke();
      ctx.font="bold 10px ui-sans-serif, system-ui"; ctx.fillStyle="#111827"; ctx.textAlign="center";
      const map = { oracle:"O", prosperity:"×2", pleisto:"↑", nikeDash:"↠", kleros:"?", symbolonA:"A", symbolonB:"B", tyche:"★" };
      ctx.fillText(map[type]||"",0,3);
    }
    ctx.restore();
  }

  function drawBear(ctx, x, y){
    const ba = bearAnim.current; const W0=64, H0=60; const Wd = Math.round(W0 * BEAR_SCALE), Hd = Math.round(H0 * BEAR_SCALE);
    ctx.save(); ctx.translate(x, y + H0); // ancrage au sol
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

  function drawCoin(ctx, x, y){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle="#fcd34d"; ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#b45309"; ctx.stroke();
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
    // invulnérabilité blink
    if (invul.current>0){ ctx.globalAlpha = 0.6 + 0.4*Math.sin(performance.now()*0.02); }
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
    // Barres & inventaire
    ctx.save(); ctx.globalAlpha=.95; ctx.fillStyle="#fff"; ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=2;
    ctx.fillRect(12,56,420,62); ctx.strokeRect(12,56,420,62);

    const slots=[
      {key:"speed",label:"Vit.", png:amuletsRef.current.speed, owned:inv.current.speed},
      {key:"purify",label:"Purif.", png:amuletsRef.current.purify, owned:inv.current.purify},
      {key:"ward",label:"Boucl.", png:amuletsRef.current.ward, owned:inv.current.ward},
      {key:"oracle",label:"Oracle", png:null, owned:inv.current.oracle},
      {key:"prosperity",label:"×2", png:null, owned:inv.current.prosperity},
      {key:"pleisto",label:"Saut+", png:null, owned:inv.current.pleisto},
      {key:"nikeDash",label:"Dash", png:null, owned:inv.current.nikeDash},
      {key:"kleros",label:"Klêros", png:null, owned:inv.current.kleros},
    ];
    for(let i=0;i<slots.length;i++){
      const x=20+i*50; ctx.strokeStyle="#cbd5e1"; ctx.strokeRect(x,64,46,48);
      ctx.globalAlpha=slots[i].owned?1:.35; drawAmuletMini(ctx,x+23,88, slots[i].png, slots[i].key); ctx.globalAlpha=1;
      ctx.fillStyle="#334155"; ctx.font="10px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(slots[i].label, x+23, 114);
    }

    // Timers actifs
    ctx.fillStyle="#0f172a"; ctx.font="10px ui-sans-serif, system-ui"; ctx.textAlign="left";
    let info="";
    if (active.current.name){
      const remain = Math.max(0, active.current.until - performance.now());
      info = `${active.current.name} ${(remain/1000).toFixed(1)}s`;
    }
    if (wardTimer.current>0) info = `ward ${(wardTimer.current).toFixed(1)}s`;
    if (oracleTimer.current>0) info = `oracle ${(oracleTimer.current).toFixed(1)}s`;
    if (pleistoTimer.current>0) info = `pleisto ${(pleistoTimer.current).toFixed(1)}s`;
    if (prosperityTimer.current>0) info = `×2 ${(prosperityTimer.current).toFixed(1)}s`;
    if (dashTimer.current>0) info = `dash ${(dashTimer.current).toFixed(1)}s`;
    if (info){ ctx.fillText(info, 440, 84); }

    // Santé
    ctx.fillStyle="#ef4444";
    for(let i=0;i<3;i++){
      ctx.globalAlpha = i < hp.current ? 1 : .25;
      ctx.beginPath(); ctx.arc(460+i*16, 110, 6, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;

    // Score
    ctx.fillStyle="#0f172a"; ctx.fillText(`Score: ${score.current|0}`, 520, 84);
    // Musique
    ctx.fillStyle = musicOn ? "#16a34a" : "#ef4444"; ctx.beginPath(); ctx.arc(520,110,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#0f172a"; ctx.fillText("Musique (M)", 536,114);
    ctx.restore();

    // Panneau fin (overlay DOM plus bas)
    if (summaryOpen) {
      const W = WORLD_W, H = WORLD_H;
      ctx.save(); ctx.fillStyle="rgba(255,255,255,.95)"; ctx.fillRect(0,0,W,H); ctx.restore();
    }
  }

  function drawEduToast(ctx, text){
    const pad=12, boxW=Math.min(760,WORLD_W-40), x=20, y=20+40; // sous la barre
    ctx.save(); ctx.globalAlpha=.98; ctx.fillStyle="#ffffff"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2;
    ctx.fillRect(x,y,boxW,82); ctx.strokeRect(x,y,boxW,82);
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
          {inIntro
            ? "Jeu de découverte des usages de l’astragale (amulette, rite, protection, tirage, oracle)."
            : "← → bouger • S/C/W activer Vitesse/Purifier/Bouclier • O Oracle • P Prospérité • L Saut+ • D Dash • K Klêros • Espace sauter • P pause • M musique."}
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
                        <li>Usages : <strong>NIKÊ</strong> (élan), <strong>Katharsis</strong> (purification), <strong>Apotropaïon</strong> (protection), <strong>Klêros</strong> (tirage), <strong>Mantis</strong> (oracle), <strong>Euphoría</strong> (abondance).</li>
                        {eduLog.current.slice(-4).map((t,i)=> <li key={i} style={{opacity:.85}}>{t}</li>)}
                      </ul>
                    </div>
                    <div style={{background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:12, padding:12, fontSize:14}}>
                      <h3 style={{fontWeight:600, marginBottom:8}}>Questions flash</h3>
                      <ol style={{paddingLeft:18, margin:0}}>
                        <li>V/F : l’astragale appartient au tarse.</li>
                        <li>Pourquoi percer l’osselet ?</li>
                        <li>Quel usage protège du « mauvais œil » ?</li>
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
