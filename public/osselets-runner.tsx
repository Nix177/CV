/* public/osselets-runner.tsx
   Mini-jeu 1 — Runner 2D : amulettes et “mauvais œil”
   - FIX: logOnce(...args)
   - AudioBus global (Stop musique quand on lance un autre jeu)
   - Amulettes exclusives : [S]peed, [C]leanse (Purify), [W]ard (apotropaïque)
   - Toasts “docu” brefs quand on (dé)active une amulette
*/
(function () {
  const { useEffect, useRef, useState } = React;

  // ---------- AudioBus global ----------
  (function ensureBus () {
    if (!window.AstragalusAudioBus) {
      window.AstragalusAudioBus = {
        _list: [],
        register(a) { if (a && !this._list.includes(a)) this._list.push(a); },
        stopAll()   { this._list.forEach(a=>{ try{ a.pause(); a.currentTime=0; }catch{} }); },
        muteAll(m)  { this._list.forEach(a=>{ try{ a.muted=!!m; }catch{} }); }
      };
    }
  })();

  // ---------- Constantes / Assets ----------
  const WORLD_W = 960, WORLD_H = 540;
  const IMG_BASES = [
    "/assets/games/osselets/audio/img/",
    "/assets/games/osselets/img/"
  ];
  const AUDIO_BASE = "/assets/games/osselets/audio/";
  const AUDIO = { music:"game-music-1.mp3", jump:"jump-sound.mp3", catch:"catch-sound.mp3", ouch:"ouch-sound.mp3" };
  const AMULET_FILES = { speed:"amulette-speed.png", purify:"amulette-purify.png", ward:"amulette-ward.png" };
  const HAZARD = "evil-eye.png";

  // ---------- Utils ----------
  function logOnce(key, ...args) {
    const k = `__once_${key}`;
    if (window[k]) return; window[k] = true; console.warn(...args);
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("img load failed: "+url));
      im.src = encodeURI(url);
    });
  }
  async function loadImageSmart(file) {
    for (const base of IMG_BASES) {
      try { return await loadImage(base + file); } catch {}
    }
    logOnce("img_"+file, "[runner] image introuvable:", file, " (bases:", IMG_BASES, ")");
    return null;
  }
  async function fetchJSON(file) {
    for (const b of IMG_BASES) {
      try { const r = await fetch(b+file, { cache: "no-store" }); if (r.ok) return await r.json(); } catch {}
    }
    logOnce("json_"+file, "[runner] json introuvable:", file);
    return null;
  }
  function loadAudio(file, vol=1, loop=false) {
    try {
      const a = new Audio(AUDIO_BASE + file);
      a.preload="auto"; a.loop=!!loop; a.volume=vol;
      window.AstragalusAudioBus.register(a);
      return a;
    } catch { return null; }
  }

  // ---------- Composant ----------
  function AstragalusRunner() {
    const hostRef = useRef(null);
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    // audio
    const musicRef = useRef(null);
    const sJumpRef = useRef(null);
    const sOkRef   = useRef(null);
    const sOuchRef = useRef(null);
    const [musicOn, setMusicOn] = useState(true);

    // état
    const imgMap   = useRef({});
    const heroAnim = useRef({ clips:{}, origin:[0.5,1], frameSize:[64,64] });
    const tRef     = useRef(0);
    const rafRef   = useRef(0);

    const GROUND_Y = 440;
    const player = useRef({ x:120, y:GROUND_Y-68, w:42, h:68, vx:0, vy:0, onGround:true, facing:1,
                            baseSpeed:3.0, speedMul:1.0, dirt:0, runPhase:0, coyote:0, jumpBuf:0 });
    const inv = useRef({ speed:false, purify:false, ward:false });
    const wardTimer = useRef(0);
    const keys = useRef({});

    const pickups = useRef([]); // {x,y,w,h,file}
    const hazards = useRef([]); // {x,y,w,h,file}

    const [edu, setEdu] = useState(null);  // toasts docu
    const eduSeen = useRef({ speed:false, purify:false, ward:false });

    // stop les autres musiques au montage
    useEffect(()=>{ window.AstragalusAudioBus.stopAll(); },[]);

    // DPR / responsive
    useEffect(() => {
      const cv = canvasRef.current, ctx = cv.getContext("2d"); ctxRef.current = ctx;
      function resize(){
        const w = hostRef.current?.clientWidth || WORLD_W;
        const h = Math.round(w*(WORLD_H/WORLD_W));
        const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio||1));
        cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
        cv.style.width = w+"px"; cv.style.height = h+"px";
        ctx.setTransform(dpr*(w/WORLD_W), 0, 0, dpr*(w/WORLD_W), 0, 0);
      }
      resize(); const ro=new ResizeObserver(resize); hostRef.current && ro.observe(hostRef.current);
      window.addEventListener("resize",resize);
      return ()=>{ ro?.disconnect(); window.removeEventListener("resize",resize); };
    },[]);

    // audio init
    useEffect(()=> {
      try { musicRef.current = loadAudio(AUDIO.music, 0.35, true); if (musicOn) musicRef.current.play().catch(()=>{}); } catch {}
      try { sJumpRef.current  = loadAudio(AUDIO.jump, 0.9, false); } catch {}
      try { sOkRef.current    = loadAudio(AUDIO.catch, 0.8, false); } catch {}
      try { sOuchRef.current  = loadAudio(AUDIO.ouch, 0.8, false); } catch {}
      return ()=>{ try{ musicRef.current?.pause(); }catch{} };
    },[]);
    useEffect(()=>{ const m=musicRef.current; if(!m) return; m.muted=!musicOn; if(musicOn) m.play().catch(()=>{}); else m.pause(); },[musicOn]);

    // charge animations héros
    useEffect(() => {
      let cancelled = false;
      (async () => {
        const anim = await fetchJSON("hero.anim.json");
        if (!anim) return;
        heroAnim.current.origin = anim.origin || [0.5,1];
        heroAnim.current.frameSize = anim.frameSize || [64,64];

        async function loadList(files){ const arr=[]; for(const f of files){ if(!imgMap.current[f]) imgMap.current[f]=await loadImageSmart(f); arr.push({file:f,img:imgMap.current[f]}); } return arr; }
        const clips = {};
        for (const [name, def] of Object.entries(anim.animations||{})) {
          const frames = await loadList(def.files);
          clips[name] = { frames, fps: def.fps||8, loop: !!def.loop };
        }
        heroAnim.current.clips = clips;

        // amulettes + piège
        for (const f of Object.values(AMULET_FILES)) if (!imgMap.current[f]) imgMap.current[f]=await loadImageSmart(f);
        if (!imgMap.current[HAZARD]) imgMap.current[HAZARD]=await loadImageSmart(HAZARD);

        if (!cancelled) loop();
      })();
      return () => { cancelled = true; cancelAnimationFrame(rafRef.current); try{ musicRef.current?.pause(); }catch{} };
    },[]);

    // ours (optionnel)
    const bearAnim = useRef(null);
    useEffect(()=>{ (async()=>{
      const j = await fetchJSON("bear.anim.json");
      if (j?.files) {
        const frames = (await Promise.all(j.files.map((f)=>loadImageSmart(f)))).filter(Boolean);
        if (frames.length) bearAnim.current = { frames, t:0 };
      }
    })(); },[]);

    // input
    useEffect(()=>{
      const onKeyDown = (e) => {
        if (["ArrowLeft","ArrowRight"," ","Space","m","M","p","P","s","S","c","C","w","W"].includes(e.key)) e.preventDefault();
        keys.current[e.key] = true;
        if (e.key===" " || e.key==="Space" || e.key==="ArrowUp") jump();
        if (e.key==="m"||e.key==="M") setMusicOn(v=>!v);
        if (e.key==="s"||e.key==="S") setAmulet("speed");
        if (e.key==="c"||e.key==="C") setAmulet("purify");
        if (e.key==="w"||e.key==="W") setAmulet("ward");
      };
      const onKeyUp = (e)=>{ keys.current[e.key] = false; };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      return ()=>{ window.removeEventListener("keydown",onKeyDown); window.removeEventListener("keyup",onKeyUp); };
    },[]);

    function setAmulet(kind){
      inv.current = { speed:false, purify:false, ward:false, [kind]:true };
      if (kind==="speed"  && !eduSeen.current.speed)  toast("Amulette de **vitesse** : accélère la course (usage rituel, efficacité ‘magique’)."), eduSeen.current.speed=true;
      if (kind==="purify" && !eduSeen.current.purify) toast("Amulette **purificatrice** : “cleanse” contre la souillure/maladie.");
      if (kind==="ward"   && !eduSeen.current.ward)   toast("Amulette **apotropaïque** : écarte le **mauvais œil**.");
    }
    function toast(msg){ const until=performance.now()+4200; setEdu({msg,until}); }

    function jump(){
      const p=player.current;
      if (p.onGround || p.coyote>0){
        p.vy = -12; p.onGround=false; p.coyote=0;
        try{ sJumpRef.current && (sJumpRef.current.currentTime=0, sJumpRef.current.play()); }catch{}
      }
    }

    function spawn(){
      // amulette (pickup)
      if (Math.random() < 0.018) {
        const files = Object.values(AMULET_FILES);
        const file = files[(Math.random()*files.length)|0];
        pickups.current.push({ x: WORLD_W+50, y: 360 + Math.random()*-140, w:40, h:40, file });
      }
      // mauvais œil
      if (Math.random() < 0.014) hazards.current.push({ x: WORLD_W+60, y: 420, w:42, h:42, file:HAZARD });
    }

    function step(dtMs){
      const p=player.current; const g=0.6; const maxVx= (inv.current.speed? 1.6:1.0)*p.baseSpeed;
      p.vx = (keys.current["ArrowRight"]? maxVx : 0) + (keys.current["ArrowLeft"]? -maxVx*0.8 : 0);
      p.x += p.vx; if (p.x<0) p.x=0; if (p.x>WORLD_W-80) p.x=WORLD_W-80;

      // gravité
      p.vy += g; p.y += p.vy;
      if (p.y >= GROUND_Y - p.h) { p.y = GROUND_Y - p.h; p.vy=0; if (!p.onGround) p.coyote=120; p.onGround=true; } else { p.onGround=false; p.coyote=Math.max(0,p.coyote-dtMs); }

      // spawn & défilement
      if (Math.random()<0.05) spawn();
      for (const obj of pickups.current.concat(hazards.current)) obj.x -= 3;

      // collisions
      const me = {x:p.x, y:p.y, w:p.w, h:p.h};
      // pickups
      for (let i=pickups.current.length-1;i>=0;i--){
        const it = pickups.current[i];
        if (overlap(me,it)) {
          pickups.current.splice(i,1);
          try{ sOkRef.current && (sOkRef.current.currentTime=0, sOkRef.current.play()); }catch{}
          if (it.file===AMULET_FILES.speed)  setAmulet("speed");
          if (it.file===AMULET_FILES.purify) setAmulet("purify");
          if (it.file===AMULET_FILES.ward)   setAmulet("ward");
        }
      }
      // hazards
      for (let i=hazards.current.length-1;i>=0;i--){
        const hz = hazards.current[i];
        if (overlap(me,hz)) {
          hazards.current.splice(i,1);
          if (inv.current.ward) { toast("L’amulette apotropaïque te protège !"); }
          else {
            p.baseSpeed = Math.max(2.2, p.baseSpeed*0.92); // ralentit
            try{ sOuchRef.current && (sOuchRef.current.currentTime=0, sOuchRef.current.play()); }catch{}
            toast("Aïe, **mauvais œil** → tu ralentis (essaie [W])");
          }
        }
      }
    }

    function overlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

    function draw(){
      const ctx=ctxRef.current, p=player.current;
      ctx.clearRect(0,0,WORLD_W,WORLD_H);
      // fond
      const g=ctx.createLinearGradient(0,0,0,WORLD_H); g.addColorStop(0,"#0b1f33"); g.addColorStop(1,"#0a1624");
      ctx.fillStyle=g; ctx.fillRect(0,0,WORLD_W,WORLD_H);
      // sol
      ctx.fillStyle="#19385c"; ctx.fillRect(0,GROUND_Y, WORLD_W, WORLD_H-GROUND_Y);

      // pickups/hazards
      for (const arr of [pickups.current, hazards.current]){
        for (const it of arr){
          const img = imgMap.current[it.file];
          if (img) ctx.drawImage(img, it.x, it.y, it.w, it.h);
        }
      }

      // héros (simple : utiliser la 1re frame de l’anim “run” si pas loaded)
      const run = heroAnim.current.clips.run || heroAnim.current.clips.idle;
      const origin = heroAnim.current.origin||[0.5,1]; const fs=heroAnim.current.frameSize||[64,64];
      const fr = run?.frames?.[Math.floor((performance.now()/1000* (run?.fps||6))% (run?.frames?.length||1))];
      if (fr?.img) {
        const dw = 42, dh = 68; const dx = p.x - dw*origin[0], dy = p.y - dh*(origin[1]);
        ctx.drawImage(fr.img, fr.img.sx||0, fr.img.sy||0, fr.img.sw||fr.img.naturalWidth||fs[0], fr.img.sh||fr.img.naturalHeight||fs[1], dx, dy, dw, dh);
      } else {
        ctx.fillStyle="#fff"; ctx.fillRect(p.x, p.y, p.w, p.h);
      }

      // UI amulettes
      ctx.fillStyle="#e2e8f0"; ctx.font="12px ui-sans-serif, system-ui";
      ctx.fillText("[←/→] bouger   [Espace] sauter   [S]peed  [C]leanse  [W]ard   [M]usique", 16, 24);
      const label = inv.current.speed ? "Vitesse" : inv.current.purify ? "Purifier" : inv.current.ward ? "Apotropaïque" : "—";
      ctx.fillText("Amulette active : " + label, 16, 44);

      // toast
      const now=performance.now();
      if (edu && now<edu.until){
        ctx.save();
        ctx.globalAlpha=0.95;
        ctx.fillStyle="#0b3b2e"; ctx.fillRect(16, WORLD_H-88, WORLD_W-32, 64);
        ctx.strokeStyle="#14532d"; ctx.lineWidth=2; ctx.strokeRect(16, WORLD_H-88, WORLD_W-32, 64);
        ctx.fillStyle="#f8fafc"; ctx.font="14px ui-sans-serif, system-ui";
        ctx.fillText(edu.msg.replace(/\*\*/g,""), 24, WORLD_H-50); // affichage simple
        ctx.restore();
      }
    }

    function loop(){
      const now = performance.now(), dt = now - tRef.current; tRef.current = now;
      step(dt);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
        <canvas ref={canvasRef}/>
        <div style="position:absolute;right:12px;bottom:12px;display:flex;gap:8px">
          <button class="btn" onClick={()=>setMusicOn(v=>!v)}>{musicOn?"Musique ON":"Musique OFF"}</button>
          <button class="btn" onClick={()=>window.AstragalusAudioBus.stopAll()}>Stop musique</button>
        </div>
      </div>
    );
  }

  // export
  window.AstragalusRunner = AstragalusRunner;
})();
