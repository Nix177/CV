(function(){
  const IMG = "/assets/games/osselets/audio/img/";
  const SND = "/assets/games/osselets/audio/";

  const loadImage = (src) => new Promise((res, rej) => { const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=src; });
  const loadJSON  = (url) => fetch(url).then(r=>{ if(!r.ok) throw new Error("json"); return r.json(); });

  window.__startMiniJEU1 = async function(){
    const root = document.getElementById("mj1-root");
    const cover = root.parentElement.querySelector(".cover");
    const cta = document.getElementById("mj1-cta");
    root.replaceChildren(); if (cover) cover.remove(); if (cta) cta.remove();

    // stop autres musiques
    (window.__OSSELETS_AUDIO__||{}).stopAll?.();

    const cvs = document.createElement("canvas");
    cvs.style.width="100%"; cvs.style.height="100%"; cvs.style.imageRendering="pixelated";
    root.appendChild(cvs);
    const ctx = cvs.getContext("2d");

    const W = {
      w:1280,h:720, r:1, groundY:0, started:false, paused:false,
      hero:{ x:240, y:0, vx:0, vy:0, onGround:true, scale:1.35, anim:"idle", frame:0, t:0 },
      bear:{ x:1200, y:0, speed:-2.2, frame:0, t:0 },
      items:[],
      input:{left:false, right:false, jump:false},
      edu:""
    };

    const heroCfg = await loadJSON(IMG+"hero.anim.json");
    const heroImgs = new Map();
    const heroFiles = new Set();
    Object.values(heroCfg.animations).forEach(a=>a.files.forEach(f=>heroFiles.add(f)));
    await Promise.all([...heroFiles].map(async f => heroImgs.set(f, await loadImage(IMG+f))));
    const bearImgs = [];
    for (let i=1;i<=6;i++) bearImgs.push(await loadImage(IMG+`bear(${i}).png`));
    const itemImgs = {
      speed:  await loadImage(IMG+"amulette-speed.png"),
      purify: await loadImage(IMG+"amulette-purify.png"),
      ward:   await loadImage(IMG+"amulette-ward.png"),
      eye:    await loadImage(IMG+"evil-eye.png")
    };

    function resize(){
      const r = window.devicePixelRatio||1, rect = root.getBoundingClientRect();
      cvs.width = Math.max(16, rect.width*r); cvs.height = Math.max(16, rect.height*r);
      W.w=cvs.width; W.h=cvs.height; W.r=r; W.groundY = Math.floor(cvs.height*0.82);
    }
    new ResizeObserver(resize).observe(root); resize();

    // items
    W.items = [
      { x: 600,  y: W.groundY-10, kind:"speed"  },
      { x: 980,  y: W.groundY-10, kind:"purify" },
      { x: 1380, y: W.groundY-10, kind:"ward"   },
    ];

    // contrôles
    window.addEventListener("keydown", (e)=>{
      if (e.code==="ArrowLeft")  W.input.left = true;
      if (e.code==="ArrowRight") W.input.right = true;
      if (e.code==="Space")      W.input.jump = true;
      if (e.code==="KeyP")       W.paused = !W.paused;
      if (e.code==="KeyM") {
        const bus = window.__OSSELETS_AUDIO__;
        if (bus?.bgm) bus.stopAll(); else if (W.started) bus?.playBgm?.(SND+"game-music-1.mp3",0.35);
      }
    });
    window.addEventListener("keyup", (e)=>{
      if (e.code==="ArrowLeft")  W.input.left = false;
      if (e.code==="ArrowRight") W.input.right = false;
      if (e.code==="Space")      W.input.jump = false;
    });

    cvs.addEventListener("pointerdown", ()=>{
      if (!W.started) {
        W.started=true;
        (window.__OSSELETS_AUDIO__||{}).playBgm?.(SND+"game-music-1.mp3",0.35);
      }
    });

    function toast(msg){
      W.edu = msg; const until = performance.now()+3200;
      const t = setInterval(()=>{ if(performance.now()>until){ clearInterval(t); W.edu=""; } }, 200);
    }

    function step(){
      if (!W.started || W.paused) return;
      const hero=W.hero;

      const acc=0.5;
      if (W.input.left)  hero.vx -= acc;
      if (W.input.right) hero.vx += acc;
      hero.vx *= 0.9; hero.x += hero.vx;

      if (W.input.jump && hero.onGround) {
        hero.vy = -10.5; hero.onGround=false;
        (window.__OSSELETS_AUDIO__||{}).play?.(SND+"jump-sound.mp3",0.7);
      }
      hero.vy += 0.55; hero.y += hero.vy;
      if (hero.y>=W.groundY){ hero.y=W.groundY; hero.vy=0; hero.onGround=true; }

      const anim = hero.onGround ? (Math.abs(hero.vx)>0.3 ? "run" : "idle") : "jump";
      if (hero.anim!==anim){ hero.anim=anim; hero.frame=0; hero.t=0; }
      const fps = Math.max(2, (heroCfg.animations[anim]?.fps||8) * (anim==="run"?0.6:0.4));
      hero.t += 1; if (hero.t >= 60/fps){ hero.t=0; const L=heroCfg.animations[anim].files.length; hero.frame=(hero.frame+1)%L; }

      const bear=W.bear;
      bear.t+=1; if (bear.t>=6){ bear.t=0; bear.frame=(bear.frame+1)%bearImgs.length; }
      bear.x += bear.speed;

      for (const it of W.items) {
        if (it.taken) continue;
        if (Math.abs(it.x-hero.x)<38 && Math.abs(it.y-hero.y)<54) {
          it.taken = true;
          if (it.kind==="speed")  toast("Vitesse : mobilité et réussite.");
          if (it.kind==="purify") toast("Purification : chasse l’impur.");
          if (it.kind==="ward")   toast("Bouclier : protège du mauvais œil.");
          (window.__OSSELETS_AUDIO__||{}).play?.(SND+"catch-sound.mp3",0.85);
        }
      }
    }

    function draw(){
      ctx.clearRect(0,0,cvs.width,cvs.height);
      ctx.fillStyle="#eef3ff"; ctx.fillRect(0,0,cvs.width,cvs.height);
      ctx.fillStyle="#e8ebfb"; ctx.fillRect(0, Math.floor(cvs.height*0.65), cvs.width, Math.floor(cvs.height*0.35));
      ctx.fillStyle="#cfd6ff"; ctx.fillRect(0, W.groundY, cvs.width, 6);

      for (const it of W.items) if(!it.taken) ctx.drawImage(itemImgs[it.kind], it.x-24, it.y-48, 48, 48);
      const bi = bearImgs[W.bear.frame]; if (bi) ctx.drawImage(bi, W.bear.x-48, W.groundY-96, 96, 96);

      const cfg=heroCfg; const files=cfg.animations[W.hero.anim].files; const f=files[W.hero.frame]; const im=heroImgs.get(f);
      if (im) ctx.drawImage(im, W.hero.x-cfg.frameSize[0]*W.hero.scale/2, W.hero.y-cfg.frameSize[1]*W.hero.scale, cfg.frameSize[0]*W.hero.scale, cfg.frameSize[1]*W.hero.scale);

      if (!W.started) {
        ctx.fillStyle="rgba(255,255,255,.9)"; ctx.fillRect(0,0,cvs.width,cvs.height);
        ctx.fillStyle="#203050"; ctx.font="bold 24px system-ui"; ctx.textAlign="center";
        ctx.fillText("Clique dans le cadre pour démarrer", cvs.width/2, cvs.height/2);
        ctx.textAlign="start";
      }

      if (W.edu) {
        ctx.fillStyle="rgba(255,255,255,.92)"; ctx.fillRect(20,20, 520, 60);
        ctx.strokeStyle="#aac"; ctx.strokeRect(20,20,520,60);
        ctx.fillStyle="#203050"; ctx.font="16px system-ui"; ctx.fillText(W.edu, 28, 56);
      }
    }

    function loop(){ requestAnimationFrame(loop); step(); draw(); }
    loop();

    // démarrer BGM dès que l’utilisateur clique le canvas
    (window.__OSSELETS_AUDIO__||{}).playBgm?.(SND+"game-music-1.mp3",0.35);
  }
})();
