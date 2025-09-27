/* public/osselets-runner.tsx
   Runner 2D — Amulettes d’astragale (Mini-jeu 1)
   - Fix de logOnce
   - AudioBus global pour stop musique quand on lance un autre jeu
   - Zéro dépendance externe ; rendu canvas, sprites via hero.anim.json
*/
(function () {
  const { useEffect, useRef, useState } = React;

  // ---------- AudioBus global (partagé entre jeux) ----------
  (function ensureBus () {
    if (!window.AstragalusAudioBus) {
      window.AstragalusAudioBus = {
        _list: [],
        register(a) { if (a && !this._list.includes(a)) this._list.push(a); },
        stopAll() { this._list.forEach(a=>{ try{ a.pause(); a.currentTime=0; }catch{} }); },
        muteAll(muted) { this._list.forEach(a=>{ try{ a.muted = !!muted; }catch{} }); }
      };
    }
  })();

  // ---------- Constantes / Assets ----------
  const WORLD_W = 960, WORLD_H = 540;
  const IMG_BASES = [
    "/assets/games/osselets/audio/img/",   // chemin actuel
    "/assets/games/osselets/img/"          // fallback si tu changes plus tard
  ];
  const AUDIO_BASE = "/assets/games/osselets/audio/";

  const AUDIO = {
    music: "game-music-1.mp3",
    jump:  "jump-sound.mp3",
    catch: "catch-sound.mp3",
    ouch:  "ouch-sound.mp3",
  };

  const AMULETS = ["amulette-speed.png", "amulette-purify.png", "amulette-ward.png"];
  const HAZARD  = "evil-eye.png";

  // ---------- Utils ----------
  function logOnce(key, ...args) {
    const k = `__once_${key}`;
    if (window[k]) return;
    window[k] = true;
    console.warn(...args);
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
  async function fetchJSONSmart(file) {
    for (const b of IMG_BASES) {
      try { const r = await fetch(b+file, {cache:"no-store"}); if (r.ok) return await r.json(); } catch {}
    }
    logOnce("json_"+file, "[runner] json introuvable:", file);
    return null;
  }
  function loadAudio(file, vol=1, loop=false) {
    try {
      const a = new Audio(AUDIO_BASE + file);
      a.preload="auto";
      a.loop = !!loop;
      a.volume = vol;
      window.AstragalusAudioBus.register(a);
      return a;
    } catch { return null; }
  }

  // ---------- Runner component ----------
  function AstragalusRunner() {
    const hostRef   = useRef(null);
    const canvasRef = useRef(null);
    const ctxRef    = useRef(null);

    // audio
    const musicRef = useRef(null);
    const sJumpRef = useRef(null);
    const sOkRef   = useRef(null);
    const sOuchRef = useRef(null);
    const [musicOn, setMusicOn] = useState(true);

    // game state
    const imgMap = useRef({});
    const heroAnim = useRef({ clips:{}, origin:[0.5,1], frameSize:[64,64] });
    const tRef = useRef(0);
    const rafRef = useRef(0);

    const state = useRef({
      x:120, y:440, vy:0, onGround:true,
      scroll:0,
      anim:"run", frame:0,
      pickups:[], hazards:[],
      score:0, lives:3, started:false, gameOver:false
    });

    // DPR / responsive
    useEffect(() => {
      const cv = canvasRef.current;
      const ctx = cv.getContext("2d");
      ctxRef.current = ctx;
      function resize(){
        const w = hostRef.current?.clientWidth || WORLD_W;
        const h = Math.round(w*(WORLD_H/WORLD_W));
        const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio||1));
        cv.width = Math.round(w*dpr);
        cv.height= Math.round(h*dpr);
        cv.style.width = w+"px";
        cv.style.height= h+"px";
        ctx.setTransform(dpr*(w/WORLD_W),0,0,dpr*(w/WORLD_W),0,0);
      }
      resize();
      const ro = new ResizeObserver(resize);
      hostRef.current && ro.observe(hostRef.current);
      window.addEventListener("resize", resize);
      return () => { ro.disconnect(); window.removeEventListener("resize", resize); };
    }, []);

    // load assets
    useEffect(() => {
      let cancelled = false;
      (async () => {
        // stop autres musiques
        window.AstragalusAudioBus.stopAll();

        // sons
        musicRef.current = loadAudio(AUDIO.music, 0.35, true);
        sJumpRef.current = loadAudio(AUDIO.jump,  1, false);
        sOkRef.current   = loadAudio(AUDIO.catch, 1, false);
        sOuchRef.current = loadAudio(AUDIO.ouch,  1, false);

        if (musicOn && musicRef.current) { try{ await musicRef.current.play(); }catch{} }

        // hero anim json
        const anim = await fetchJSONSmart("hero.anim.json");
        if (!anim) return;
        heroAnim.current.origin = anim.origin || [0.5,1];
        heroAnim.current.frameSize = anim.frameSize || [64,64];

        // charge les images référencées
        async function loadList(files) {
          const arr = [];
          for (const f of files) {
            if (!imgMap.current[f]) imgMap.current[f] = await loadImageSmart(f);
            arr.push({ file:f, img: imgMap.current[f] });
          }
          return arr;
        }
        const clips = {};
        for (const [name, def] of Object.entries(anim.animations||{})) {
          const frames = await loadList(def.files);
          clips[name] = { frames, fps: def.fps||8, loop: !!def.loop };
        }
        heroAnim.current.clips = clips;

        // charge amulettes + hazard
        for (const f of AMULETS) if (!imgMap.current[f]) imgMap.current[f] = await loadImageSmart(f);
        if (!imgMap.current[HAZARD]) imgMap.current[HAZARD] = await loadImageSmart(HAZARD);

        if (!cancelled) loop();
      })();
      return () => { cancelled = true; cancelAnimationFrame(rafRef.current);
        // stop musique de ce jeu
        try{ musicRef.current && musicRef.current.pause(); }catch{} };
    }, []);

    // music toggle
    useEffect(() => {
      const m = musicRef.current;
      if (!m) return;
      m.muted = !musicOn;
      if (musicOn) { try{ m.play(); }catch{} } else { try{ m.pause(); }catch{} }
    }, [musicOn]);

    // input
    useEffect(() => {
      const onKey = (e) => {
        if (e.key === " " || e.code === "Space" || e.key === "ArrowUp") doJump();
      };
      const onClick = () => doJump();
      window.addEventListener("keydown", onKey);
      canvasRef.current.addEventListener("pointerdown", onClick);
      return () => { window.removeEventListener("keydown", onKey); canvasRef.current && canvasRef.current.removeEventListener("pointerdown", onClick); };
    }, []);

    function doJump(){
      const s = state.current;
      if (!s.started || s.gameOver) return;
      if (s.onGround) {
        s.vy = -12;
        s.onGround = false;
        s.anim = "jump";
        try{ sJumpRef.current?.play(); }catch{}
      }
    }

    // spawning
    function spawn() {
      const s = state.current;
      // amulette
      if (Math.random() < 0.015) {
        const file = AMULETS[(Math.random()*AMULETS.length)|0];
        s.pickups.push({ x: s.scroll + WORLD_W + 50, y: 380 + Math.random()*-140, w:40, h:40, file });
      }
      // hazard
      if (Math.random() < 0.012) {
        s.hazards.push({ x: s.scroll + WORLD_W + 60, y: 420, w:42, h:42, file:HAZARD });
      }
    }

    function rectsOverlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

    function drawHero(ctx, s, dt) {
      const anim = heroAnim.current;
      const clip = anim.clips[s.anim] || anim.clips["run"];
      if (!clip) return;
      const speed = clip.fps / 60;
      s.frame += speed * (dt*60);
      const idx = (clip.loop ? Math.floor(s.frame) % clip.frames.length : Math.min(clip.frames.length-1, Math.floor(s.frame)));
      const fr = clip.frames[idx];
      const im = fr.img;
      if (!im) return;
      const [fw,fh] = anim.frameSize;
      const ox = anim.origin[0], oy = anim.origin[1];
      const scaleX = 1.7, scaleY = 1.5;

      const drawX = s.x - fw*scaleX*ox;
      const drawY = s.y - fh*scaleY*oy;

      ctx.drawImage(im, drawX, drawY, fw*scaleX, fh*scaleY);

      if (s.anim === "jump" && idx >= clip.frames.length-1) {
        // rester sur la dernière frame de jump pendant l’ascension/descente
      } else if (s.anim === "jump" && s.onGround) {
        s.anim = "run"; s.frame = 0;
      }
    }

    function loop() {
      const s = state.current;
      const ctx = ctxRef.current;
      const now = performance.now();
      const prev = tRef.current || now;
      const dt = Math.min(0.033, (now - prev) / 1000);
      tRef.current = now;

      // start au premier frame pour éviter l’écran vide
      if (!s.started) s.started = true;

      // update
      spawn();
      s.scroll += 220 * dt;

      // gravité
      s.vy += 36 * dt;
      s.y += s.vy;
      if (s.y >= 440) { s.y = 440; s.vy = 0; s.onGround = true; }

      // collisions
      const heroBox = { x:s.x-18, y:s.y-54, w:36, h:54 };
      // pickups
      s.pickups.forEach(p => p.x -= 220*dt);
      for (let i=s.pickups.length-1; i>=0; i--) {
        const p = s.pickups[i];
        const box = { x:p.x-20, y:p.y-20, w:40, h:40 };
        if (rectsOverlap(heroBox, box)) {
          s.pickups.splice(i,1);
          s.score += 10;
          try{ sOkRef.current?.play(); }catch{}
        } else if (p.x < -60) {
          s.pickups.splice(i,1);
        }
      }
      // hazards
      s.hazards.forEach(h => h.x -= 250*dt);
      for (let i=s.hazards.length-1; i>=0; i--) {
        const h = s.hazards[i];
        const box = { x:h.x-20, y:h.y-20, w:40, h:40 };
        if (rectsOverlap(heroBox, box)) {
          s.hazards.splice(i,1);
          s.lives -= 1;
          try{ sOuchRef.current?.play(); }catch{}
          if (s.lives <= 0) { s.gameOver = true; }
        } else if (h.x < -60) {
          s.hazards.splice(i,1);
        }
      }

      // draw
      ctx.clearRect(0,0,WORLD_W,WORLD_H);

      // ciel
      ctx.fillStyle = "#071528"; ctx.fillRect(0,0,WORLD_W,WORLD_H);
      // sol
      ctx.fillStyle = "#0b3b2e"; ctx.fillRect(0, 460, WORLD_W, 80);
      // strip défilant
      ctx.strokeStyle = "#114d40"; ctx.lineWidth=2;
      for (let x = - (s.scroll % 48); x < WORLD_W; x += 48) {
        ctx.beginPath(); ctx.moveTo(x, 462); ctx.lineTo(x+24, 470); ctx.stroke();
      }

      // pickups
      s.pickups.forEach(p=>{
        const im = imgMap.current[p.file];
        if (im) ctx.drawImage(im, p.x-20, p.y-20, 40, 40);
      });
      // hazards
      s.hazards.forEach(h=>{
        const im = imgMap.current[h.file];
        if (im) ctx.drawImage(im, h.x-20, h.y-20, 40, 40);
      });

      // hero
      drawHero(ctx, s, dt);

      // HUD
      ctx.fillStyle="#e6f1ff"; ctx.font="16px ui-sans-serif, system-ui";
      ctx.fillText("Score: "+s.score, 16, 28);
      ctx.fillText("Vies: "+s.lives, 16, 50);
      ctx.fillText("Espace/Tap: Sauter", 16, 72);

      if (s.gameOver) {
        ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle="#fff"; ctx.font="24px ui-sans-serif, system-ui";
        ctx.fillText("Game Over — clique pour rejouer", WORLD_W/2-200, WORLD_H/2);
        canvasRef.current.style.cursor="pointer";
        canvasRef.current.onclick = ()=>{
          Object.assign(s, { x:120, y:440, vy:0, onGround:true, scroll:0, anim:"run", frame:0, pickups:[], hazards:[], score:0, lives:3, started:true, gameOver:false });
          canvasRef.current.onclick = null;
        };
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
        <div style="position:absolute; right:10px; top:10px; z-index:2; display:flex; gap:8px">
          <button class="btn" onClick={()=>{ setMusicOn(v=>!v); }}>{ "Musique " + (musicOn? "ON":"OFF") }</button>
          <button class="btn" onClick={()=>{ window.AstragalusAudioBus.stopAll(); }}>Stop musique</button>
        </div>
        <canvas ref={canvasRef}></canvas>
      </div>
    );
  }

  // expose global
  window.AstragalusRunner = AstragalusRunner;
})();
