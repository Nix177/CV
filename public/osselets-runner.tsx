/**  Osselets — Runner niveau 1 (TSX autonome pour Babel Standalone)
 *   - Explications courtes sur les amulettes (toasts + mini-journal)
 *   - "Cours" final auto, plus de bouton / raccourci 'H'
 *   - MP3 uniquement
 *   - Assets attendus (dossier conservé):
 *     /assets/games/osselets/audio/
 *       game-music-1.mp3, jump-sound.mp3, catch-sound.mp3, ouch-sound.mp3
 *     /assets/games/osselets/audio/img/
 *       hero.anim.json (+ frames), bear.anim.json (optionnel) ou bear(1..6).png
 *       amulette-speed.png, amulette-purify.png, amulette-ward.png
 *       evil-eye.png (optionnel)
 */
const AstragalusRunner: React.FC = () => {
  // ---------- CONFIG ----------
  const WORLD_W = 1280;
  const WORLD_H = 720;

  // Pixel-art: on scale up logiquement dans le canvas, mais on garde du « net »
  const CAMERA_PADDING = 200;

  // Réglages sprite (pour « épaissir » le héros / le poser au sol)
  const HERO_SCALE_X = 1.75;
  const HERO_SCALE_Y = 1.6;
  const HERO_FOOT_ADJ_PX = 15; // + vers le bas si "flotte"

  // Animation: on peut ralentir toutes les anims via ce facteur global (<1 = plus lent)
  const ANIM_GLOBAL_SLOWDOWN = 0.7;

  // Physique simple
  const GRAVITY = 2400;
  const JUMP_VY = -900;
  const RUN_SPEED = 280;

  // Amulettes
  const AMULET_PICK_RADIUS = 56;    // distance pour afficher l’infobulle
  const AMULET_CATCH_RADIUS = 40;   // distance collision
  const EDU_TOAST_MS = 5200;

  // Audio
  const PATH = "/assets/games/osselets/audio/";
  const IMG = PATH + "img/";

  // ---------- STATE ----------
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const ctxRef = React.useRef<CanvasRenderingContext2D | null>(null);
  const rAF = React.useRef<number | null>(null);
  const dprRef = React.useRef<number>(1);

  const [ui, setUI] = React.useState({
    paused: false,
    musicOn: true,
    mobile: false
  });

  const [game, setGame] = React.useState({
    started: true,           // rendu déclenché par le bouton "Lancer le jeu" en dehors
    finished: false,
    t0: performance.now(),
    collected: 0
  });

  // Camera
  const camera = React.useRef({ x: 0 });

  // Hero
  type Anim = { name:string; frames: HTMLImageElement[]; fps:number; loop:boolean; t:number; idx:number; };
  const hero = React.useRef({
    x: 120, y: 0,
    vx: 0, vy: 0,
    w: 64, h: 64,
    onGround: false,
    state: "idle" as "idle"|"run"|"jump",
    anims: {} as Record<string, Anim>,
    current: "idle",
    origin: { ox: 0.5, oy: 1.0 }
  });

  // Sol (bande)
  const groundY = WORLD_H - 140;

  // Ennemis (ours)
  const bears = React.useRef<Array<{x:number,y:number, vx:number, anim:Anim, w:number,h:number, alive:boolean}>>([]);

  // Amulettes
  type Amulet = { kind:"speed"|"purify"|"ward"; x:number; y:number; img:HTMLImageElement; got:boolean; };
  const amulets = React.useRef<Amulet[]>([]);

  // Toaster / journal
  const [toast, setToast] = React.useState<{msg:string, until:number} | null>(null);
  const eduLog = React.useRef<string[]>([]);

  // Audio
  const snd = React.useRef({
    music: null as HTMLAudioElement | null,
    jump: null as HTMLAudioElement | null,
    catch: null as HTMLAudioElement | null,
    ouch: null as HTMLAudioElement | null
  });

  // ---------- HELPERS ----------
  function loadImg(src:string){ return new Promise<HTMLImageElement>((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }
  async function loadAnimFromJson(jsonURL:string) {
    const r = await fetch(jsonURL);
    if (!r.ok) throw new Error("anim json not found: "+jsonURL);
    const j = await r.json();
    const origin = { ox: j.origin?.[0] ?? 0.5, oy: j.origin?.[1] ?? 1.0 };
    const anims: Record<string, Anim> = {};
    for(const [name, a] of Object.entries<any>(j.animations || {})) {
      const frames:HTMLImageElement[] = [];
      for(const f of a.files) frames.push(await loadImg(IMG+f));
      anims[name] = { name, frames, fps: (a.fps || 8)*ANIM_GLOBAL_SLOWDOWN, loop: !!a.loop, t:0, idx:0 };
    }
    return { origin, anims };
  }
  async function loadBearAnim(){
    // 1) JSON si dispo, sinon 6 PNG bear(1..6).png
    try{
      const r = await fetch(IMG+"bear.anim.json");
      if (r.ok){
        const j = await r.json();
        const a = j.animations?.run || j.animations?.idle || j.animations?.walk;
        if (!a) throw 0;
        const frames:HTMLImageElement[] = [];
        for(const f of a.files) frames.push(await loadImg(IMG+f));
        return { frames, fps:(a.fps||8)*ANIM_GLOBAL_SLOWDOWN };
      }
    }catch{}
    const frames = await Promise.all([1,2,3,4,5,6].map(n=>loadImg(IMG+`bear(${n}).png`)));
    return { frames, fps: 8*ANIM_GLOBAL_SLOWDOWN };
  }
  function newAnim(name:string, frames:HTMLImageElement[], fps:number, loop:boolean):Anim{
    return { name, frames, fps, loop, t:0, idx:0 };
  }
  function stepAnim(a:Anim, dt:number){
    a.t += dt;
    const len = a.frames.length;
    if (a.fps<=0) return;
    const frameDur = 1/ a.fps;
    while(a.t >= frameDur){
      a.t -= frameDur;
      a.idx++;
      if (a.idx >= len){
        a.idx = a.loop ? 0 : len-1;
      }
    }
  }
  function setHeroAnim(name:string){
    if (hero.current.current !== name) {
      // reset timer pour démarrer à la frame 0
      const a = hero.current.anims[name];
      if (!a) return;
      a.t = 0; a.idx = 0;
      hero.current.current = name;
    }
  }

  function setToast(msg:string){
    const until = performance.now()+EDU_TOAST_MS;
    setToastState({msg, until});
    // mémorise dans le mini-journal (sans doublon immédiat)
    if (!eduLog.current.length || eduLog.current[eduLog.current.length-1] !== msg){
      eduLog.current.push(msg);
      if (eduLog.current.length > 8) eduLog.current.shift();
    }
  }
  function setToastState(v:any){ (setToast as any)(v); }

  // ---------- INIT ----------
  React.useEffect(() => {
    const cvs = document.createElement('canvas');
    canvasRef.current = cvs;
    rootRef.current!.appendChild(cvs);
    const ctx = cvs.getContext('2d')!;
    ctxRef.current = ctx;

    // DPR sizing
    function resize(){
      const pr = rootRef.current!;
      const rect = pr.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      dprRef.current = dpr;
      cvs.style.width = rect.width+"px";
      cvs.style.height = rect.height+"px";
      cvs.width = Math.round(rect.width*dpr);
      cvs.height = Math.round(rect.height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(rootRef.current!);

    // input
    const keys = new Set<string>();
    function onKey(e:KeyboardEvent){ if (e.repeat) return; if (e.type==="keydown") keys.add(e.key.toLowerCase()); else keys.delete(e.key.toLowerCase()); }
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

    // touch (mobile simple)
    let left=false, right=false, jump=false;
    function mobileUpdateFromUI(){
      if (!ui.mobile) { left = right = jump = false; return; }
      // très simple: si mobile est ON, auto-run + tap = jump
      right = true;
    }
    mobileUpdateFromUI();

    // assets
    let running = true;
    (async () => {
      // Hero
      try{
        const {origin, anims} = await loadAnimFromJson(IMG+"hero.anim.json");
        hero.current.origin = { ox: origin.ox, oy: origin.oy };
        hero.current.anims = anims;
      }catch(e){
        console.warn("hero.anim.json introuvable ou invalide — vérifie le chemin/fichier.");
      }

      // Bears
      const b = await loadBearAnim();
      // place 2 ours
      for (let i=0;i<2;i++){
        bears.current.push({
          x: 650 + i*520, y: groundY, vx: -120,
          anim: newAnim("run", b.frames, b.fps, true),
          w: 64, h:64, alive:true
        });
      }

      // Amulets
      const imgSpeed = await loadImg(IMG+"amulette-speed.png");
      const imgPur   = await loadImg(IMG+"amulette-purify.png");
      const imgWard  = await loadImg(IMG+"amulette-ward.png");
      amulets.current = [
        {kind:"speed",  x: 520,  y: groundY-28, img:imgSpeed, got:false},
        {kind:"purify", x: 880,  y: groundY-28, img:imgPur,   got:false},
        {kind:"ward",   x: 1200, y: groundY-28, img:imgWard,  got:false},
      ];

      // Audio
      const a = snd.current;
      a.music = new Audio(PATH+"game-music-1.mp3"); a.music.loop = true; a.music.volume = 0.35;
      a.jump  = new Audio(PATH+"jump-sound.mp3");
      a.catch = new Audio(PATH+"catch-sound.mp3");
      a.ouch  = new Audio(PATH+"ouch-sound.mp3");
      if (ui.musicOn) a.music.play().catch(()=>{ /* user gesture manquante, pas grave */ });

      // position hero au sol
      hero.current.y = groundY;

      tick(performance.now());
    })();

    // loop
    let last = performance.now();
    const tick = (now:number) => {
      if (!running) return;
      const dt = Math.min(1/30, (now-last)/1000);
      last = now;

      if (!ui.paused && game.started && !game.finished){
        // input poll
        const press = (k:string)=> keys.has(k);
        // mobile
        if (ui.mobile){
          // tap pour sauter
          // (on écoute le root pour détecter un tap)
        }

        // move
        let vx = 0;
        if (!ui.mobile){
          if (press("arrowright") || press("d")) vx += RUN_SPEED;
          if (press("arrowleft")  || press("a")) vx -= RUN_SPEED*0.8;
        } else {
          vx = RUN_SPEED; // auto-run
        }
        hero.current.vx = vx;

        // jump
        const wantJump = (!hero.current.onGround ? false :
                          (press(" ") || press("arrowup") || press("w") || jump));
        if (wantJump){
          hero.current.vy = JUMP_VY;
          hero.current.onGround = false;
          snd.current.jump?.play().catch(()=>{});
        }

        // physics
        hero.current.vy += GRAVITY*dt;
        hero.current.x  += hero.current.vx * dt;
        hero.current.y  += hero.current.vy * dt;

        // ground collide
        const heroFeet = hero.current.y + HERO_FOOT_ADJ_PX;
        if (heroFeet >= groundY){
          const dy = heroFeet - groundY;
          hero.current.y -= dy;
          hero.current.vy = 0;
          hero.current.onGround = true;
        }

        // set anim
        if (!hero.current.onGround) setHeroAnim("jump");
        else if (Math.abs(hero.current.vx) > 10) setHeroAnim("run");
        else setHeroAnim("idle");

        // step anims
        const ca = hero.current.anims[hero.current.current];
        if (ca) stepAnim(ca, dt);

        // bears
        for (const b of bears.current){
          if (!b.alive) continue;
          b.x += b.vx * dt;
          stepAnim(b.anim, dt);
          // loop ours
          if (b.x < camera.current.x - 100) { b.x = camera.current.x + WORLD_W + 200; }
          // collision simple
          const dx = (hero.current.x - b.x);
          const dy = (hero.current.y - b.y);
          if (Math.hypot(dx,dy) < 50){
            snd.current.ouch?.play().catch(()=>{});
            // petit recul
            hero.current.vx = -180;
          }
        }

        // amulets proximity + catch
        let collectedNow = 0;
        for (const a of amulets.current){
          if (a.got) continue;
          const dx = hero.current.x - a.x;
          const dy = (hero.current.y - 20) - a.y;
          const d = Math.hypot(dx,dy);
          if (d < AMULET_PICK_RADIUS){
            // petite explication « au contact »
            let tip = "";
            if (a.kind==="speed")  tip = "Vitesse — L’astragale est un os clé de la cheville : il rend le mouvement possible. (course, saut)";
            if (a.kind==="purify") tip = "Purification — Les osselets issus du sacrifice prennent une valeur rituelle et protectrice.";
            if (a.kind==="ward")   tip = "Contre le mauvais œil — L’amulette protège : l’osselet passe du jeu à l’apotropaïque.";
            if (tip) setToast(tip);
          }
          if (d < AMULET_CATCH_RADIUS){
            a.got = true; collectedNow++;
            snd.current.catch?.play().catch(()=>{});
            // journal plus court
            if (a.kind==="speed")  setToast("Tu as pris « Vitesse ». Os talus = mouvement.");
            if (a.kind==="purify") setToast("Tu as pris « Purification ». Osselet rituel.");
            if (a.kind==="ward")   setToast("Tu as pris « Bouclier ». Protection contre le mauvais œil.");
          }
        }
        if (collectedNow>0){
          setGame(g => ({...g, collected: g.collected + collectedNow}));
        }

        // fin de niveau : 3 amulettes collectées
        if (!game.finished && amulets.current.every(a=>a.got)){
          setGame(g => ({...g, finished:true}));
          // petit récap texte s’ajoute tout seul dans l’overlay final
        }

        // caméra suit
        const target = Math.max(0, hero.current.x - (WORLD_W/2));
        const min = camera.current.x - 600, max = camera.current.x + 600;
        const clamped = Math.max(min, Math.min(max, target));
        camera.current.x += (clamped - camera.current.x)*0.08;
      }

      // render
      render();

      rAF.current = requestAnimationFrame(tick);
    };

    // pointer → saut (mobile)
    const onTap = (ev:PointerEvent) => {
      if (!ui.mobile) return;
      // tap = jump si au sol
      if (hero.current.onGround){
        hero.current.vy = JUMP_VY;
        hero.current.onGround = false;
        snd.current.jump?.play().catch(()=>{});
      }
    };
    rootRef.current!.addEventListener('pointerdown', onTap);

    return () => {
      running = false;
      if (rAF.current) cancelAnimationFrame(rAF.current);
      rootRef.current && rootRef.current.removeChild(cvs);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      rootRef.current && rootRef.current.removeEventListener('pointerdown', onTap);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // musique toggle
  React.useEffect(()=> {
    const m = snd.current.music;
    if (!m) return;
    if (ui.musicOn){ m.play().catch(()=>{}); } else { m.pause(); }
  }, [ui.musicOn]);

  // ---------- RENDER ----------
  function render() {
    const ctx = ctxRef.current!;
    const cvs = canvasRef.current!;
    // fond
    ctx.clearRect(0,0,cvs.width, cvs.height);
    // décor simple (bandes)
    drawBackground(ctx);

    // world transform
    ctx.save();
    ctx.translate(-camera.current.x, 0);

    // sol
    ctx.fillStyle = "#e9e0ff";
    ctx.fillRect(camera.current.x, groundY+8, camera.current.x + WORLD_W + 2000, WORLD_H-groundY);

    // amulets
    for (const a of amulets.current){
      if (a.got) continue;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(a.img, Math.round(a.x-16), Math.round(a.y-16), 32, 32);
    }

    // bears
    for (const b of bears.current){
      if (!b.alive) continue;
      const fr = b.anim.frames[b.anim.idx];
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fr, Math.round(b.x-32), Math.round(b.y-64), 64,64);
    }

    // hero
    drawHero(ctx);

    ctx.restore();

    // HUD (toasts)
    drawHUD(ctx);

    // Fin de niveau (cours final)
    if (game.finished) drawEndPanel(ctx);
  }

  function drawBackground(ctx:CanvasRenderingContext2D){
    const w = (rootRef.current?.clientWidth || WORLD_W);
    const h = (rootRef.current?.clientHeight || WORLD_H);
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, "#eef5ff");
    g.addColorStop(1, "#e8eafd");
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
    // silhouettes très soft
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#bcd2ff";
    for (let i=0;i<8;i++){
      const x = (i*220) - (camera.current.x*0.25 % 220);
      const y = 380 + (i%2)*60;
      ctx.beginPath();
      ctx.moveTo(x, y+120);
      ctx.lineTo(x+160, y+120);
      ctx.lineTo(x+80, y);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHero(ctx:CanvasRenderingContext2D){
    const h = hero.current;
    const a = h.anims[h.current];
    if (!a){ // fallback carré si anim manquante
      ctx.fillStyle="#222"; ctx.fillRect(h.x-16, h.y-64, 32,64); return;
    }
    const fr = a.frames[a.idx];
    const ox = h.origin.ox, oy = h.origin.oy;
    const w = Math.round(64*HERO_SCALE_X);
    const hh = Math.round(64*HERO_SCALE_Y);

    ctx.imageSmoothingEnabled = false;
    // flip si on se déplace vers la gauche
    const flip = h.vx < -2;
    ctx.save();
    ctx.translate(Math.round(h.x), Math.round(h.y - HERO_FOOT_ADJ_PX));
    if (flip) ctx.scale(-1,1);
    ctx.drawImage(fr, Math.round((-w*ox)), Math.round((-hh*oy)), w, hh);
    ctx.restore();
  }

  function drawHUD(ctx:CanvasRenderingContext2D){
    // panneau boutons (pause / musique / mobile)
    const pad = 14;
    const btnH = 40;
    const items = [
      { label: ui.musicOn ? "Musique ON" : "Musique OFF", onClick: ()=>setUI(v=>({...v, musicOn:!v.musicOn})) },
      { label: ui.paused ? "Reprendre" : "Pause", onClick: ()=>setUI(v=>({...v, paused:!v.paused})) },
      { label: (ui.mobile ? "Mode mobile ✔" : "Mode mobile"), onClick: ()=>setUI(v=>({...v, mobile:!v.mobile})) },
    ];
    let x = (rootRef.current?.clientWidth || WORLD_W) - 3*(140+8) - pad;
    let y = pad;
    for (const it of items){
      drawButton(ctx, x, y, 140, btnH, it.label, it.onClick);
      x += 148;
    }

    // Toast
    if (toast && performance.now() < toast.until){
      const txt = toast.msg;
      const w = Math.min(600, (rootRef.current?.clientWidth || WORLD_W) - 40);
      const x0 = 20, y0 = 20 + btnH + 10;
      drawToast(ctx, x0, y0, w, txt);
    }
  }

  function drawButton(ctx:CanvasRenderingContext2D, x:number,y:number,w:number,h:number, label:string, onClick:()=>void){
    ctx.save();
    ctx.fillStyle = "#ffffffee";
    ctx.strokeStyle = "#b6c6ea";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x,y,w,h, 10, true, true);
    ctx.fillStyle = "#0b1f33";
    ctx.font = "15px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(label, x+w/2, y+h/2+1);
    ctx.restore();

    // zone cliquable
    attachHotspot(x,y,w,h,onClick);
  }

  // très léger système de hotspots cliquables par frame
  const hotspotFrame: Array<{x:number,y:number,w:number,h:number, cb:()=>void}> = [];
  function attachHotspot(x:number,y:number,w:number,h:number, cb:()=>void){ hotspotFrame.push({x,y,w,h,cb}); }
  React.useEffect(()=>{
    const onClick = (ev:MouseEvent) => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      for (const h of hotspotFrame){
        if (x>=h.x && x<=h.x+h.w && y>=h.y && y<=h.y+h.h){ h.cb(); break; }
      }
      hotspotFrame.length = 0;
    };
    const onMove = () => { hotspotFrame.length = 0; }; // on nettoie entre frames
    rootRef.current?.addEventListener('click', onClick);
    rootRef.current?.addEventListener('mousemove', onMove);
    return () => {
      rootRef.current?.removeEventListener('click', onClick);
      rootRef.current?.removeEventListener('mousemove', onMove);
    };
  });

  function drawToast(ctx:CanvasRenderingContext2D, x:number,y:number,w:number, text:string){
    const pad = 12;
    ctx.save();
    ctx.font = "16px ui-sans-serif, system-ui";
    const lines = wrapText(ctx, text, w-2*pad);
    const h = lines.length*20 + 2*pad;
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.strokeStyle = "#c9d6f5";
    roundRect(ctx, x,y,w,h,12,true,true);
    ctx.fillStyle = "#0b1f33";
    let yy = y+pad+12;
    for (const ln of lines){ ctx.fillText(ln, x+pad, yy); yy += 20; }
    ctx.restore();
  }

  function drawEndPanel(ctx:CanvasRenderingContext2D){
    const W = (rootRef.current?.clientWidth || WORLD_W);
    const H = (rootRef.current?.clientHeight || WORLD_H);
    ctx.save();
    ctx.fillStyle = "rgba(7,15,30,.55)";
    ctx.fillRect(0,0,W,H);

    const boxW = Math.min(720, W-40), boxH = 320;
    const x = (W-boxW)/2, y = (H-boxH)/2;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#c7d5f8";
    roundRect(ctx, x,y,boxW,boxH,16,true,true);

    ctx.fillStyle = "#0b1f33";
    ctx.font = "20px ui-sans-serif, system-ui";
    ctx.fillText("Fin du niveau 1 — Ce qu’on retient", x+18, y+38);

    const bullet = [
      "L’astragale (talus) est l’os clé du pied : il permet la flexion → mouvement.",
      "Prélevé lors d’un sacrifice, l’osselet peut devenir support rituel / protecteur.",
      "Transformé en amulette, il sert aussi d’anti–mauvais œil (apotropaïque)."
    ];
    ctx.font = "16px ui-sans-serif, system-ui";
    let yy = y+72;
    for (const b of bullet){ ctx.fillText("• "+b, x+22, yy); yy += 26; }

    // Mini-journal (ce que le joueur a vu)
    if (eduLog.current.length){
      ctx.font = "14px ui-sans-serif, system-ui";
      ctx.fillStyle = "#243b5a";
      ctx.fillText("Journal des découvertes :", x+22, y+yy-2);
      let y2 = y+yy+18;
      for (const line of eduLog.current.slice(-5)){
        ctx.fillText("– "+line, x+34, y2); y2 += 20;
      }
    }

    // bouton Rejouer
    drawButton(ctx, x+boxW-132, y+boxH-52, 112, 36, "Rejouer", ()=>{
      // reset simple
      hero.current.x = 120; hero.current.y = groundY; hero.current.vx = 0; hero.current.vy = 0; hero.current.onGround = true;
      camera.current.x = 0;
      for (const a of amulets.current) a.got = false;
      setGame(g=>({...g, finished:false, collected:0}));
      setToast("Nouveau départ !");
    });

    ctx.restore();
  }

  // ---------- small gfx helpers ----------
  function roundRect(ctx:CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number, fill:boolean, stroke:boolean){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
  function wrapText(ctx:CanvasRenderingContext2D, text:string, maxW:number){
    const words = text.split(/\s+/); const lines:string[]=[]; let cur="";
    for (const w of words){
      const t = cur ? cur+" "+w : w;
      if (ctx.measureText(t).width > maxW){ if (cur) lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  return <div ref={rootRef} style={{width:"100%", height:"100%", position:"relative"}} aria-label="Osselets Runner LVL 1"/>;
};

// Expose global (monté depuis portfolio.html)
(window as any).AstragalusRunner = AstragalusRunner;
