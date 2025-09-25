// osselets-runner.tsx — version mobile + audio + sprites optionnels
// Ce composant est monté par le HTML de ton portfolio (bouton #osselets-start). :contentReference[oaicite:1]{index=1}

const { useEffect, useRef, useState } = React;

/** Répertoires d’assets (mets tes fichiers là, voir liste plus bas) */
const ASSETS = {
  img: "/assets/games/osselets/img/",
  audio: "/assets/games/osselets/audio/",
};

/** Fichiers audio (mets .mp3 et si possible .ogg pour une boucle parfaite) */
const AUDIO = {
  music: { ogg: "game-music-1.ogg", mp3: "game-music-1.mp3" },
  jump: { ogg: "jump-sound.ogg", mp3: "jump-sound.mp3" },
  catch: { ogg: "catch-sound.ogg", mp3: "catch-sound.mp3" },
  ouch: { ogg: "ouch-sound.ogg", mp3: "ouch-sound.mp3" },
};

/** Sprites optionnels : si absents → rendu vectoriel de secours */
const SPRITES = {
  hero: "hero.png",              // spritesheet 64x64 (idle/run/jump)
  bear: "bear.png",              // spritesheet 64x64 (run)
  eye: "evil-eye.png",           // 32x32 (clignement)
  amuSpeed: "amulet-speed.png",  // 32x32 (pulse)
  amuPurify: "amulet-purify.png",
  amuWard: "amulet-ward.png",
};

type ImgDict = { [k: string]: HTMLImageElement | null };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = url;
  });
}

function AstragalusRunner() {
  // --- Canvas & loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reqRef = useRef<number | null>(null);
  const W = 960, H = 540;
  const GROUND_Y = 440;
  const WORLD_LEN = 4200;

  // --- UI / flow
  const [inIntro, setInIntro] = useState(true);
  const [paused, setPaused] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [level, setLevel] = useState(1);
  const [message, setMessage] = useState("← → bouger | Espace sauter | P pause | H cours | M musique");
  const [historyMode, setHistoryMode] = useState(true);

  // --- Mobile support (autodetect + switch)
  const autoCoarse = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(pointer: coarse)").matches
    : false;
  const [mobileMode, setMobileMode] = useState<boolean>(autoCoarse);
  const [oneButton, setOneButton] = useState<boolean>(false); // auto-run + tap = jump
  const onScreenKeys = useRef({ left:false, right:false, jump:false });

  // --- Audio
  const [musicOn, setMusicOn] = useState(true);
  const musicEl = useRef<HTMLAudioElement | null>(null);
  const sfxJumpEl = useRef<HTMLAudioElement | null>(null);
  const sfxCatchEl = useRef<HTMLAudioElement | null>(null);
  const sfxOuchEl = useRef<HTMLAudioElement | null>(null);

  function startMusicIfWanted() {
    const el = musicEl.current;
    if (!el) return;
    el.loop = true;
    el.volume = 0.35;
    el.muted = !musicOn;
    if (musicOn) el.play().catch(()=>{});
  }
  function toggleMusic() {
    const el = musicEl.current;
    setMusicOn(v => {
      const n = !v;
      if (el) {
        el.muted = !n;
        if (n && el.paused) el.play().catch(()=>{});
      }
      return n;
    });
  }
  function playOne(ref: React.MutableRefObject<HTMLAudioElement | null>) {
    const el = ref.current;
    if (!el) return;
    try { el.currentTime = 0; el.play().catch(()=>{}); } catch {}
  }

  // --- Assets images (optionnels)
  const [spritesReady, setSpritesReady] = useState(false);
  const images = useRef<ImgDict>({});

  useEffect(() => {
    let canceled = false;
    const entries = Object.entries(SPRITES);
    Promise.all(
      entries.map(([key, file]) => loadImage(ASSETS.img + file).then(img => [key, img]).catch(()=>[key,null]))
    ).then((pairs) => {
      if (canceled) return;
      const dict: ImgDict = {};
      pairs.forEach(([k, im]) => (dict[k as string] = im as HTMLImageElement | null));
      images.current = dict;
      setSpritesReady(true);
    });
    return () => { canceled = true; };
  }, []);

  // --- Player & world
  const player = useRef({
    x: 120, y: GROUND_Y - 68, w: 42, h: 68,
    vx:0, vy:0, onGround:true, facing:1,
    baseSpeed: 3.0, speedMul: 1.0, dirt: 0, runPhase: 0,
    coyote: 0, jumpBuf: 0
  });
  const inv = useRef({ speed:false, purify:false, ward:false });
  const wardTimer = useRef(0);
  const keys = useRef<{[k:string]:boolean}>({});

  const AMULET1_X = 900, CHASE_END_X=2000, AMULET2_X=2200, AMULET3_X=3100, EVIL_WAVE_START_X=3200;
  type Eye = { x:number; y:number; vx:number; vy:number; alive:boolean };
  const eyes = useRef<Eye[]>([]);
  const bear = useRef({ x:-999, y:GROUND_Y-60, w:64, h:60, vx:0, active:false });
  type Stage = "start"|"speedAmulet"|"bearChase"|"postChase"|"purifyAmulet"|"wardAmulet"|"evilEyeWave"|"end";
  const stage = useRef<Stage>("start");
  const levelRef = useRef(level);
  useEffect(()=>{ levelRef.current = level; },[level]);

  // --- Intro steps
  const intro = useRef({ step:0, t:0 });

  // --- Input clavier
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (["ArrowLeft","ArrowRight"," ","Space","m","M","h","H","p","P"].includes(e.key)) e.preventDefault();
      if (inIntro) {
        if (e.key === "ArrowRight") { intro.current.step = Math.min(5, intro.current.step+1); intro.current.t=0; }
      } else if (!summaryOpen) {
        if (e.key==="ArrowLeft") keys.current.left = true;
        if (e.key==="ArrowRight") keys.current.right = true;
        if (e.key===" "||e.key==="Space") keys.current.jump = true;
      }
      if ((e.key==="p"||e.key==="P") && !inIntro && !summaryOpen) setPaused(v=>!v);
      if (e.key==="h"||e.key==="H") setHistoryMode(v=>!v);
      if (e.key==="m"||e.key==="M") toggleMusic();
    }
    function up(e: KeyboardEvent) {
      if (inIntro || summaryOpen) return;
      if (e.key==="ArrowLeft") keys.current.left = false;
      if (e.key==="ArrowRight") keys.current.right = false;
      if (e.key===" "||e.key==="Space") keys.current.jump = false;
    }
    window.addEventListener("keydown",down);
    window.addEventListener("keyup",up);
    return ()=>{ window.removeEventListener("keydown",down); window.removeEventListener("keyup",up); };
  }, [inIntro, summaryOpen]);

  // --- Mobile on-screen buttons (touch + mouse, multi-touch friendly)
  function press(name: "left"|"right"|"jump", v:boolean) {
    onScreenKeys.current[name] = v;
  }
  function clearTouchKeys() { onScreenKeys.current = {left:false,right:false,jump:false}; }

  // --- Start / reset
  function startGame() {
    setInIntro(false);
    setSummaryOpen(false);
    setPaused(false);
    startMusicIfWanted();
  }
  function resetLevel(goIntro=false) {
    const p = player.current;
    Object.assign(p, { x:120, y:GROUND_Y-68, vx:0, vy:0, onGround:true, facing:1, speedMul:1.0, dirt:0, runPhase:0, coyote:0, jumpBuf:0 });
    inv.current = { speed:false, purify:false, ward:false };
    wardTimer.current = 0;
    stage.current = "start";
    bear.current = { x:-999, y:GROUND_Y-60, w:64, h:60, vx:0, active:false };
    eyes.current = [];
    setMessage("← → bouger | Espace sauter | P pause | H cours | M musique");
    setSummaryOpen(false);
    if (goIntro) { setInIntro(true); intro.current={step:0,t:0}; }
  }
  function nextLevel() { setLevel(l=>l+1); resetLevel(false); setPaused(false); }

  // --- Game loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let last = performance.now();

    const tick = (t:number) => {
      const dt = Math.min(33, t-last)/16.666; last = t;
      if (!paused) update(dt);
      render(ctx, t);
      reqRef.current = requestAnimationFrame(tick);
    };
    reqRef.current = requestAnimationFrame(tick);
    return ()=>{ if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [paused, inIntro, mobileMode, spritesReady]);

  // --- Helpers
  const clamp = (n:number,a:number,b:number) => Math.max(a, Math.min(b,n));
  const nowMs = () => performance.now();

  // --- History popup
  const historyPopup = useRef<{ text:string; until:number }|null>(null);
  function showHistory(text:string){ historyPopup.current = { text, until: nowMs()+4200 }; }

  // --- Update
  function update(dt:number) {
    if (inIntro || summaryOpen) {
      if (inIntro) {
        intro.current.t += dt;
        if (intro.current.t > 4) { intro.current.t=0; intro.current.step = Math.min(5, intro.current.step+1); }
      }
      return;
    }

    const p = player.current;
    // Inputs combinés (clavier + écran)
    const left  = keys.current.left  || onScreenKeys.current.left;
    const right = keys.current.right || onScreenKeys.current.right || (mobileMode && oneButton); // auto-run en one-button
    const jump  = keys.current.jump  || onScreenKeys.current.jump;

    // Axe horizontal
    let ax = 0;
    if (left)  { ax -= 1; p.facing = -1; }
    if (right) { ax += 1; p.facing =  1; }
    const targetVx = ax * p.baseSpeed * p.speedMul;
    p.vx += (targetVx - p.vx) * 0.4;

    // Coyote/jump buffer
    p.coyote = p.onGround ? 0.12 : Math.max(0, p.coyote - dt*0.016);
    p.jumpBuf = jump ? 0.12 : Math.max(0, p.jumpBuf - dt*0.016);
    // Gravité
    p.vy += 0.8 * dt;
    // Saut si possible
    if (p.jumpBuf>0 && (p.coyote>0 || p.onGround)) {
      p.vy = -14; p.onGround = false; p.coyote=0; p.jumpBuf=0; playOne(sfxJumpEl);
    }

    // Intégration
    p.x += (p.vx * dt * 60)/60;
    p.y += (p.vy * dt * 60)/60;

    // Sol
    if (p.y + p.h >= GROUND_Y) { p.y = GROUND_Y - p.h; p.vy=0; if(!p.onGround) p.onGround=true; }
    else { p.onGround=false; }

    // Limites
    p.x = clamp(p.x, 0, WORLD_LEN-1);
    p.runPhase += Math.abs(p.vx) * dt * 0.4;

    // Bouclier
    if (wardTimer.current>0) wardTimer.current = Math.max(0, wardTimer.current - dt*0.016);

    // Script d’événements
    if (stage.current==="start" && p.x > AMULET1_X-20) {
      stage.current="speedAmulet"; p.speedMul=1.6; inv.current.speed=true;
      setMessage("Amulette de vitesse trouvée ! → cours !");
      playOne(sfxCatchEl);
      setTimeout(()=>{ stage.current="bearChase"; bear.current.active=true; bear.current.x=p.x-300; bear.current.vx=2.8; setMessage("Un ours te poursuit !"); }, 500);
    }
    if (stage.current==="bearChase" && bear.current.active) {
      const d = p.x - bear.current.x; const diff=0.2*(levelRef.current-1);
      const desired = d>260?3.2+diff : d<140?2.2+diff : 2.8+diff;
      bear.current.vx += (desired - bear.current.vx) * 0.04;
      bear.current.x += (bear.current.vx * dt * 60)/60;
      p.dirt = clamp(p.dirt + 0.002*dt, 0, 1);
      if (bear.current.x + bear.current.w > p.x + 10) bear.current.x = p.x - 320;
      if (p.x > CHASE_END_X) { stage.current="postChase"; bear.current.active=false; p.speedMul=1.2; setMessage("Tu t’es échappé !"); }
    }
    if (stage.current==="postChase" && p.x > AMULET2_X-20) {
      stage.current="purifyAmulet"; inv.current.purify=true; playOne(sfxCatchEl);
      const clean=()=>{ player.current.dirt=Math.max(0, player.current.dirt-0.05); if(player.current.dirt>0) requestAnimationFrame(clean); };
      requestAnimationFrame(clean);
      if (historyMode) showHistory("Purification symbolique/amuletique attestée dans l’Antiquité.");
    }
    if ((stage.current==="purifyAmulet" || stage.current==="postChase") && p.x > AMULET3_X-20) {
      stage.current="wardAmulet"; inv.current.ward=true; wardTimer.current=10; playOne(sfxCatchEl);
      setMessage("Bouclier apotropaïque (temporaire) !");
    }
    if ((stage.current==="wardAmulet" || stage.current==="purifyAmulet") && p.x > EVIL_WAVE_START_X) {
      stage.current="evilEyeWave";
      const n = 6 + (levelRef.current-1)*4;
      for(let i=0;i<n;i++){
        eyes.current.push({ x:p.x+240+i*90, y:GROUND_Y-100-((i%3)*30), vx:-(2.2+((i%3)*0.4)+0.1*(levelRef.current-1)), vy:0, alive:true });
      }
      setMessage("Vague du ‘mauvais œil’ !");
    }
    if (eyes.current.length){
      for(const e of eyes.current){
        if(!e.alive) continue;
        e.x += (e.vx * dt * 60)/60;
        if (rectOverlap(e.x-10, e.y-6, 20, 12, p.x, p.y, p.w, p.h)) {
          if (wardTimer.current>0){ e.vx = -e.vx*0.6; e.x += e.vx*4; e.alive=false; }
          else { p.speedMul=Math.max(0.8, p.speedMul-0.2); setTimeout(()=>p.speedMul=Math.min(1.2, p.speedMul+0.2),1500); e.alive=false; playOne(sfxOuchEl); }
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

  // --- Render
  function render(ctx:CanvasRenderingContext2D, t:number){
    if (inIntro) return renderIntro(ctx,t);

    const p = player.current;
    const camX = clamp(p.x - W*0.35, 0, WORLD_LEN - W);

    ctx.clearRect(0,0,W,H);
    // Ciel
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

    // Décors (vectoriels simples)
    drawMountains(ctx, camX*0.2);
    drawOliveTrees(ctx, camX*0.5);
    drawFrieze(ctx, camX*0.8);

    // Sol
    ctx.fillStyle="#ede9fe"; ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);

    ctx.save(); ctx.translate(-camX,0);
    // Colonnes + amulettes
    for(let x=300;x<WORLD_LEN;x+=420) drawColumn(ctx,x,GROUND_Y);
    drawAmulet(ctx, AMULET1_X, GROUND_Y-40, "Vitesse", images.current.amuSpeed);
    drawAmulet(ctx, AMULET2_X, GROUND_Y-40, "Purif.", images.current.amuPurify);
    drawAmulet(ctx, AMULET3_X, GROUND_Y-40, "Bouclier", images.current.amuWard);

    // Ours
    if (bear.current.active) drawBear(ctx, bear.current.x, bear.current.y, images.current.bear);

    // Projectiles
    for(const e of eyes.current) if (e.alive) drawEvilEye(ctx, e.x, e.y, images.current.eye);

    // Héros
    drawHero(ctx, p.x, p.y, p.w, p.h, p.facing, p.dirt, p.runPhase, wardTimer.current, images.current.hero);

    // Fin
    ctx.fillStyle="#94a3b8"; ctx.fillRect(WORLD_LEN-40, GROUND_Y-120, 8, 120);
    ctx.restore();

    // HUD
    drawHUD(ctx);

    // Popup histoire
    if (historyMode && historyPopup.current && nowMs() < historyPopup.current.until) {
      const txt = historyPopup.current.text;
      ctx.save(); ctx.globalAlpha=0.95; ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2;
      const boxW = Math.min(680, W-40); const x=(W-boxW)/2; const y=H-130;
      ctx.fillRect(x,y,boxW,80); ctx.strokeRect(x,y,boxW,80);
      ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
      wrapText(ctx, txt, x+12, y+26, boxW-24, 18);
      ctx.restore();
    }

    // Messages
    ctx.fillStyle="#0f172a"; ctx.font="14px ui-sans-serif, system-ui";
    ctx.fillText(message, 16, 26);
    ctx.fillText("P pause | H cours | M musique", 16, 46);
  }

  // --- Intro render
  function renderIntro(ctx:CanvasRenderingContext2D, _t:number){
    const step = intro.current.step, tt=intro.current.t;
    ctx.clearRect(0,0,W,H);
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#f8fafc"); g.addColorStop(1,"#e2e8f0");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    drawMountains(ctx,0); drawOliveTrees(ctx,0); drawFrieze(ctx,0);

    // panneau
    ctx.save(); ctx.globalAlpha=0.92; ctx.fillStyle="#fff"; ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=2;
    ctx.fillRect(40,40,W-80,H-160); ctx.strokeRect(40,40,W-80,H-160); ctx.restore();

    ctx.fillStyle="#0f172a"; ctx.font="22px ui-sans-serif, system-ui";
    function center(txt:string,y:number){ ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(txt,W/2,y); ctx.textAlign="start"; ctx.textBaseline="alphabetic"; }

    if (step===0){ center("Grèce antique — De l’os à l’amulette",120); ctx.font="14px ui-sans-serif, system-ui"; center("→ pour avancer • puis Start",H-72); drawSheepSil(ctx,220,260,480,200); drawTalusGlow(ctx,540,378); center("Astragale (talus) — os du tarse",360); }
    if (step===1){ center("Extraction post-abattage",120); drawSheepSil(ctx,220,260,480,200); const k=Math.min(1,tt/3); const sx=540,sy=378, ex=sx+120,ey=sy-60; drawTalusGlow(ctx,sx,sy,0.25); drawAstragalusIcon(ctx, sx+(ex-sx)*k, sy+(ey-sy)*k, 20); center("L’os est prélevé puis travaillé.",360); }
    if (step===2){ center("Nettoyage & polissage",120); const cx=W/2,cy=260; drawAstragalusIcon(ctx,cx,cy,26); for(let i=0;i<8;i++){ const a=(i/8)*Math.PI*2+tt*0.4; ctx.strokeStyle="#a3e635"; ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*36, cy+Math.sin(a)*36); ctx.lineTo(cx+Math.cos(a)*46, cy+Math.sin(a)*46); ctx.stroke(); } center("L’os devient portable.",360); }
    if (step===3){ center("Perçage (suspension)",120); const cx=W/2,cy=260; drawAstragalusIcon(ctx,cx,cy,26); ctx.fillStyle="#64748b"; ctx.fillRect(cx-4, cy-60, 8, 36); ctx.beginPath(); ctx.moveTo(cx-8, cy-24); ctx.lineTo(cx+8, cy-24); ctx.lineTo(cx, cy-40); ctx.closePath(); ctx.fill(); ctx.fillStyle="#7c2d12"; ctx.beginPath(); ctx.arc(cx, cy-6, 2, 0, Math.PI*2); ctx.fill(); center("Trou discret pour enfiler un lien.",360); }
    if (step===4){ center("Montage en collier / amulette",120); const cx=W/2,cy=260; ctx.strokeStyle="#6b7280"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx-80, cy-30); ctx.quadraticCurveTo(cx, cy-60, cx+80, cy-30); ctx.stroke(); drawAstragalusIcon(ctx,cx,cy,26); center("Clique Start pour jouer →",360); }
    if (step>=5){ center("Prêt ? Clique Start pour jouer.", H/2); }
  }

  // --- Drawing primitives (sprites si dispo, sinon vectoriel)
  function drawColumn(ctx:CanvasRenderingContext2D, baseX:number, groundY:number){
    ctx.save(); ctx.translate(baseX,0);
    ctx.fillStyle="#e5e7eb"; ctx.fillRect(-12, groundY-140, 24, 140);
    ctx.fillStyle="#cbd5e1"; ctx.fillRect(-18, groundY-140, 36, 10); ctx.fillRect(-18, groundY-10, 36, 10);
    ctx.restore();
  }
  function drawAmulet(ctx:CanvasRenderingContext2D, x:number, y:number, label:string, sprite:HTMLImageElement|null|undefined){
    const t = performance.now()*0.002;
    ctx.save(); ctx.translate(x,y);
    if (sprite){ ctx.drawImage(sprite, -16, -16, 32, 32); }
    else {
      ctx.strokeStyle="#6b7280"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-18,-12); ctx.quadraticCurveTo(0,-24-6*Math.sin(t),18,-12); ctx.stroke();
      const grd = ctx.createRadialGradient(0,0,2,0,0,18); grd.addColorStop(0,`rgba(20,184,166,0.8)`); grd.addColorStop(1,"rgba(20,184,166,0)");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2.5; ctx.beginPath(); ctx.ellipse(0,0,14,10,0,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.quadraticCurveTo(0,-6,10,0); ctx.moveTo(-10,0); ctx.quadraticCurveTo(0,6,10,0); ctx.stroke();
    }
    ctx.fillStyle="#0f172a"; ctx.font="12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(label, 0, 30);
    ctx.restore();
  }
  function drawBear(ctx:CanvasRenderingContext2D, x:number, y:number, sprite:HTMLImageElement|null|undefined){
    ctx.save(); ctx.translate(x,y);
    if (sprite){ ctx.drawImage(sprite, 0, 0, 64, 60); }
    else {
      ctx.fillStyle="#78350f"; ctx.fillRect(0,20,64,36);
      ctx.beginPath(); ctx.arc(54,26,14,0,Math.PI*2); ctx.fill();
      ctx.fillRect(6,56,10,12); ctx.fillRect(26,56,10,12); ctx.fillRect(46,56,10,12);
      ctx.fillStyle="#fde68a"; ctx.fillRect(60,22,3,3);
    }
    ctx.restore();
  }
  function drawEvilEye(ctx:CanvasRenderingContext2D, x:number, y:number, sprite:HTMLImageElement|null|undefined){
    ctx.save(); ctx.translate(x,y);
    if (sprite){ ctx.drawImage(sprite, -16, -16, 32, 32); }
    else {
      ctx.fillStyle="#1d4ed8"; ctx.beginPath(); ctx.ellipse(0,0,14,9,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#93c5fd"; ctx.beginPath(); ctx.ellipse(0,0,9,6,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#0f172a"; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  function drawHero(ctx:CanvasRenderingContext2D, x:number,y:number,w:number,h:number,facing:number,dirt:number,runPhase:number,wardLeft:number, sprite:HTMLImageElement|null|undefined){
    ctx.save(); ctx.translate(x,y);
    // Bouclier
    if (wardLeft>0){ const pct=Math.min(1,wardLeft/10); const rad=44+6*Math.sin(performance.now()*0.006);
      const grd = ctx.createRadialGradient(w/2,h/2,10, w/2,h/2,rad);
      grd.addColorStop(0,`rgba(56,189,248,${0.25+0.25*pct})`); grd.addColorStop(1,"rgba(56,189,248,0)");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(w/2,h/2,rad,0,Math.PI*2); ctx.fill();
    }
    // Flip
    if (facing<0){ ctx.scale(-1,1); ctx.translate(-w,0); }
    if (sprite){ ctx.drawImage(sprite, 2, 0, w, h); }
    else {
      // fallback vectoriel (idem version précédente, compacté)
      const legA = Math.sin(runPhase*8)*6, legB = Math.sin(runPhase*8+Math.PI)*6;
      ctx.fillStyle="#1f2937"; ctx.fillRect(10+legA*0.2, h-16, 8,16); ctx.fillRect(w-18+legB*0.2, h-16, 8,16);
      ctx.fillStyle="#92400e"; ctx.fillRect(10+legA*0.2, h-2, 10,2); ctx.fillRect(w-18+legB*0.2, h-2, 10,2);
      ctx.fillStyle="#334155"; ctx.fillRect(8,28,w-16,14);
      ctx.fillStyle="#e5e7eb"; ctx.beginPath(); ctx.moveTo(12,20); ctx.lineTo(w-12,20); ctx.lineTo(w-18,48); ctx.lineTo(18,48); ctx.closePath(); ctx.fill();
      ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=1; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(16+i*8,22); ctx.lineTo(20+i*8,46); ctx.stroke(); }
      ctx.strokeStyle="#eab308"; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(10,36); ctx.lineTo(w-10,36); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w/2-8,22); ctx.quadraticCurveTo(w/2,18,w/2+8,22); ctx.stroke();
      if (inv.current.speed || inv.current.purify || inv.current.ward) {
        ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.ellipse(w/2,26,5,3.5,0,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w/2-3.5,26); ctx.quadraticCurveTo(w/2,24.5,w/2+3.5,26);
        ctx.moveTo(w/2-3.5,26); ctx.quadraticCurveTo(w/2,27.5,w/2+3.5,26); ctx.stroke();
      }
      ctx.fillStyle="#f8fafc"; ctx.beginPath(); ctx.arc(w/2,12,8,0,Math.PI*2); ctx.fill();
      if (dirt>0.01){ ctx.globalAlpha=Math.max(0,Math.min(dirt,0.8)); ctx.fillStyle="#9ca3af"; ctx.fillRect(-4,-4,w+8,h+8); ctx.globalAlpha=1; }
    }
    ctx.restore();
  }
  function drawMountains(ctx:CanvasRenderingContext2D, off:number){
    ctx.save(); ctx.translate(-off,0);
    for(let x=-200;x<W+WORLD_LEN;x+=420){
      ctx.fillStyle="#c7d2fe"; ctx.beginPath(); ctx.moveTo(x,380); ctx.lineTo(x+120,260); ctx.lineTo(x+240,380); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#bfdbfe"; ctx.beginPath(); ctx.moveTo(x+140,380); ctx.lineTo(x+260,280); ctx.lineTo(x+360,380); ctx.closePath(); ctx.fill();
    } ctx.restore();
  }
  function drawOliveTrees(ctx:CanvasRenderingContext2D, off:number){
    ctx.save(); ctx.translate(-off,0);
    for(let x=0;x<W+WORLD_LEN;x+=260){ ctx.fillStyle="#a78bfa"; ctx.fillRect(x+40,GROUND_Y-60,8,60);
      ctx.fillStyle="#ddd6fe"; ctx.beginPath(); ctx.ellipse(x+44,GROUND_Y-75,26,16,0,0,Math.PI*2); ctx.fill();
    } ctx.restore();
  }
  function drawFrieze(ctx:CanvasRenderingContext2D, off:number){
    ctx.save(); ctx.translate(-off,0);
    for(let x=0;x<W+WORLD_LEN;x+=180){ ctx.strokeStyle="#94a3b8"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,GROUND_Y-10);
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
    ctx.save(); ctx.globalAlpha=0.95; ctx.fillStyle="#fff"; ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=2;
    ctx.fillRect(12,56,236,62); ctx.strokeRect(12,56,236,62);
    const slots=[{owned:inv.current.speed,label:"Vitesse"},{owned:inv.current.purify,label:"Purif."},{owned:inv.current.ward,label:"Bouclier"}];
    for(let i=0;i<slots.length;i++){ const x=20+i*64; ctx.strokeStyle="#cbd5e1"; ctx.strokeRect(x,64,56,48);
      ctx.globalAlpha=slots[i].owned?1:0.35; drawAmuletMini(ctx,x+28,88); ctx.globalAlpha=1;
      ctx.fillStyle="#334155"; ctx.font="10px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.fillText(slots[i].label, x+28, 116);
    }
    // Indicateurs
    ctx.fillStyle = musicOn ? "#16a34a" : "#ef4444"; ctx.beginPath(); ctx.arc(264,70,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#0f172a"; ctx.font="10px ui-sans-serif, system-ui"; ctx.fillText("Musique (M)", 278,74);
    ctx.fillStyle = historyMode ? "#16a34a" : "#ef4444"; ctx.beginPath(); ctx.arc(264,98,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#0f172a"; ctx.fillText("Cours (H)", 278,102);
    ctx.restore();
  }
  function drawAmuletMini(ctx:CanvasRenderingContext2D,cx:number,cy:number){
    ctx.save(); ctx.translate(cx,cy); ctx.fillStyle="#fff7ed"; ctx.strokeStyle="#7c2d12"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7,0); ctx.quadraticCurveTo(0,-4,7,0); ctx.moveTo(-7,0); ctx.quadraticCurveTo(0,4,7,0); ctx.stroke(); ctx.restore();
  }
  function wrapText(ctx:CanvasRenderingContext2D, text:string, x:number,y:number, maxW:number, lh:number){
    const words=text.split(" "); let line=""; for(let n=0;n<words.length;n++){ const test=line+words[n]+" "; const w=ctx.measureText(test).width;
      if (w>maxW && n>0){ ctx.fillText(line,x,y); line=words[n]+" "; y+=lh; } else line=test;
    } ctx.fillText(line,x,y);
  }

  // --- JSX
  return (
    <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#fafaf9,#e7e5e4)", color:"#111827"}}>
      <div className="max-w-5xl mx-auto" style={{padding:"16px"}}>
        <div className="mb-2" style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between"}}>
          <h1 className="text-xl sm:text-2xl" style={{fontWeight:600}}>Runner 2D – Amulettes d’astragale</h1>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button onClick={()=>setHistoryMode(v=>!v)} className="btn" style={btn()}>
              {historyMode ? "Cours ON" : "Cours OFF"}
            </button>
            <button onClick={toggleMusic} className="btn" style={btn()}>
              {musicOn ? "Musique ON" : "Musique OFF"}
            </button>
            <button onClick={()=>setPaused(v=>!v)} disabled={inIntro||summaryOpen} className="btn" style={primaryBtn(inIntro||summaryOpen)}>
              {paused ? "Lecture" : "Pause"}
            </button>
            <label className="btn" style={btn()}>
              <input type="checkbox" checked={mobileMode} onChange={e=>{ setMobileMode(e.target.checked); clearTouchKeys(); }} />
              <span style={{marginLeft:6}}>Mode mobile</span>
            </label>
            {mobileMode && (
              <label className="btn" style={btn()}>
                <input type="checkbox" checked={oneButton} onChange={e=>setOneButton(e.target.checked)} />
                <span style={{marginLeft:6}}>1 bouton</span>
              </label>
            )}
          </div>
        </div>

        <p className="text-sm" style={{color:"#475569", marginBottom:12}}>
          {inIntro
            ? "Cinématique d’intro : → pour avancer. Clique Start (dans le cadre) pour lancer le jeu."
            : "← → bouger • Espace sauter • P pause • H cours • M musique. Sur mobile, active le mode mobile ci-dessus."}
        </p>

        <div className="bg-white" style={{border:"1px solid #e5e7eb", borderRadius:14, padding:12, boxShadow:"0 6px 16px rgba(0,0,0,.05)"}}>
          <div className="w-full" style={{position:"relative", overflow:"hidden", border:"1px solid #e5e7eb", borderRadius:12}}>
            <canvas ref={canvasRef} width={W} height={H} style={{width:"100%", height:"100%", imageRendering:"pixelated"}} />

            {/* START overlay dans le canvas */}
            {inIntro && (
              <div style={{position:"absolute", inset:0, display:"flex", alignItems:"end", justifyContent:"center", paddingBottom:16, pointerEvents:"none"}}>
                <button onClick={startGame} style={{...primaryBtn(false), pointerEvents:"auto", padding:"10px 16px", borderRadius:14}}>
                  Start
                </button>
              </div>
            )}

            {/* Résumé de fin de niveau */}
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

            {/* Contrôles à l’écran (mode mobile) */}
            {mobileMode && !inIntro && !summaryOpen && (
              <>
                {!oneButton && (
                  <div style={{position:"absolute", left:12, right:12, bottom:12, display:"flex", gap:12, justifyContent:"space-between", pointerEvents:"none"}}>
                    <TouchBtn label="←"
                      onDown={()=>press("left",true)} onUp={()=>press("left",false)} />
                    <TouchBtn label="Saut"
                      onDown={()=>press("jump",true)} onUp={()=>press("jump",false)} />
                    <TouchBtn label="→"
                      onDown={()=>press("right",true)} onUp={()=>press("right",false)} />
                  </div>
                )}
                {oneButton && (
                  <div onPointerDown={()=>press("jump",true)} onPointerUp={()=>press("jump",false)}
                       style={{position:"absolute", inset:"0 0 0 0", pointerEvents:"auto"}} />
                )}
              </>
            )}

            {/* AUDIO avec <source> pour .ogg + .mp3 */}
            <audio ref={musicEl} preload="auto">
              <source src={ASSETS.audio + AUDIO.music.ogg} type="audio/ogg"/>
              <source src={ASSETS.audio + AUDIO.music.mp3} type="audio/mpeg"/>
            </audio>
            <audio ref={sfxJumpEl} preload="auto">
              <source src={ASSETS.audio + AUDIO.jump.ogg} type="audio/ogg"/>
              <source src={ASSETS.audio + AUDIO.jump.mp3} type="audio/mpeg"/>
            </audio>
            <audio ref={sfxCatchEl} preload="auto">
              <source src={ASSETS.audio + AUDIO.catch.ogg} type="audio/ogg"/>
              <source src={ASSETS.audio + AUDIO.catch.mp3} type="audio/mpeg"/>
            </audio>
            <audio ref={sfxOuchEl} preload="auto">
              <source src={ASSETS.audio + AUDIO.ouch.ogg} type="audio/ogg"/>
              <source src={ASSETS.audio + AUDIO.ouch.mp3} type="audio/mpeg"/>
            </audio>
          </div>

          <div style={{fontSize:12, color:"#6b7280", marginTop:8}}>
            Option sprites : si tu ajoutes des images dans <code>/assets/games/osselets/img/</code>, le jeu les utilisera automatiquement. Sinon rendu vectoriel.
          </div>
        </div>
      </div>
    </div>
  );
}

/** Boutons UI (styles inline pour ne pas dépendre de Tailwind) */
function btn(disabled=false){ return ({ padding:"8px 12px", border:"1px solid #e5e7eb", borderRadius:12, background:"#fff", cursor:disabled?"default":"pointer", opacity:disabled?.5:1 }) as React.CSSProperties; }
function btnDark(){ return ({ padding:"8px 12px", border:"1px solid #111827", borderRadius:12, background:"#111827", color:"#fff", cursor:"pointer" }) as React.CSSProperties; }
function primaryBtn(disabled=false){ return ({ padding:"10px 14px", border:"1px solid #059669", borderRadius:14, background:"#059669", color:"#fff", cursor:disabled?"default":"pointer", opacity:disabled?.5:1, boxShadow:"0 6px 14px rgba(5,150,105,.25)" }) as React.CSSProperties; }

/** Bouton tactile réutilisable */
function TouchBtn(props:{label:string; onDown:()=>void; onUp:()=>void;}){
  const events = {
    onMouseDown: props.onDown, onMouseUp: props.onUp, onMouseLeave: props.onUp,
    onTouchStart: (e:React.TouchEvent)=>{ e.preventDefault(); props.onDown(); },
    onTouchEnd: (e:React.TouchEvent)=>{ e.preventDefault(); props.onUp(); },
    onPointerDown: (e:React.PointerEvent)=>{ if(e.pointerType!=="mouse") props.onDown(); },
    onPointerUp: (e:React.PointerEvent)=>{ if(e.pointerType!=="mouse") props.onUp(); },
  };
  return (
    <button {...events}
      style={{ pointerEvents:"auto", flex:"1 1 0", padding:"14px 10px", border:"1px solid #e5e7eb", borderRadius:14, background:"#ffffffEE", fontWeight:600 }}>
      {props.label}
    </button>
  );
}

// Expose pour le script HTML (montage au clic sur #osselets-start) :contentReference[oaicite:2]{index=2}
// @ts-ignore
(window as any).AstragalusRunner = AstragalusRunner;
