/* global React, ReactDOM */
(() => {
  // ⚠️ verrouille l’instance React pour éviter “invalid hook call” (#321)
  // @ts-ignore
  const ReactGlobal = (window as any).React;
  // @ts-ignore
  const React = ReactGlobal;
  // @ts-ignore
  const { useRef, useEffect, useMemo, useState } = React;

  const IMG = "/assets/games/osselets/audio/img/";
  const SND = "/assets/games/osselets/audio/";

  function getAudioBus() {
    const w = window as any;
    if (!w.__OSSELETS_AUDIO__) {
      w.__OSSELETS_AUDIO__ = {
        bgm: null as HTMLAudioElement | null,
        sfx: new Map<string, HTMLAudioElement>(),
        stopAll() {
          if (this.bgm) { try { this.bgm.pause(); this.bgm.currentTime = 0; } catch {} this.bgm = null; }
          for (const a of this.sfx.values()) { try { a.pause(); a.currentTime=0; } catch {} }
          this.sfx.clear();
        },
        playBgm(url:string, volume=0.35) {
          if (this.bgm) { try { this.bgm.pause(); } catch {} }
          const a = new Audio(url); a.loop = true; a.volume = volume; this.bgm = a;
          a.play().catch(()=>{ /* bloqué par navigateur → sera OK après interaction */ });
          return a;
        },
        play(url:string, volume=0.9) {
          const a = new Audio(url); a.volume = volume;
          a.play().catch(()=>{});
          this.sfx.set(url, a); a.addEventListener("ended", ()=>this.sfx.delete(url));
          return a;
        }
      };
    }
    return w.__OSSELETS_AUDIO__;
  }

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=src; });

  const loadJSON = (url: string) => fetch(url).then(r => { if(!r.ok) throw new Error("json"); return r.json(); });

  type Anim = { files:string[]; fps:number; loop:boolean; };
  type HeroCfg = { origin:[number,number]; frameSize:[number,number]; animations:Record<string,Anim> };

  function AstragalusRunner() {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement|null>(null);
    const [ready, setReady] = useState(false);
    const [ended, setEnded] = useState<{ title:string; lines:string[] } | null>(null);
    const [eduMsg, setEduMsg] = useState<string>("");

    const assets = useRef<any>({ heroCfg:null as HeroCfg|null, heroImgs:new Map<string,HTMLImageElement>(), bearImgs:[] as HTMLImageElement[], items:new Map<string,HTMLImageElement>() });
    const world = useRef<any>({
      t:0, w:1280, h:720, pxRatio:1,
      groundY:0,
      started:false,
      hero:{ x:240, y:0, vx:0, vy:0, onGround:true, scale:1.35, anim:"idle", frame:0, frameTime:0 },
      bear:{ x:1200, y:0, speed:-2.2, frame:0, ft:0 },
      items:[] as Array<{x:number;y:number;kind:"speed"|"purify"|"ward";taken?:boolean}>,
      eyes:[] as Array<{x:number;y:number;vx:number}>,
      input:{left:false,right:false,jump:false},
      paused:false
    });

    function setToast(msg:string){
      if(!msg) return;
      setEduMsg(msg);
      const until = performance.now()+3200;
      const id = setInterval(()=>{ if(performance.now()>until){ clearInterval(id); setEduMsg(""); } }, 200);
    }

    useEffect(() => {
      const bus = getAudioBus();
      bus.stopAll();

      const wrap = wrapRef.current!;
      wrap.style.position = "absolute";
      wrap.style.inset = "0";
      wrap.style.display = "grid";
      wrap.style.placeItems = "stretch";

      const cvs = document.createElement("canvas");
      cvs.style.width = "100%";
      cvs.style.height = "100%";
      cvs.style.imageRendering = "pixelated";
      wrap.appendChild(cvs);
      canvasRef.current = cvs;

      const ctx = cvs.getContext("2d")!;
      const onResize = () => {
        const r = window.devicePixelRatio || 1;
        const rect = wrap.getBoundingClientRect();
        cvs.width = Math.max(16, Math.floor(rect.width * r));
        cvs.height = Math.max(16, Math.floor(rect.height * r));
        world.current.pxRatio = r;
        world.current.w = cvs.width;
        world.current.h = cvs.height;
        world.current.groundY = Math.floor(cvs.height * 0.82);
      };
      onResize();
      const ro = new ResizeObserver(onResize);
      ro.observe(wrap);

      const onKey = (e:KeyboardEvent) => {
        const d = world.current.input;
        if (e.type === "keydown") {
          if (e.code==="ArrowLeft")  d.left = true;
          if (e.code==="ArrowRight") d.right = true;
          if (e.code==="Space")      d.jump = true;
          if (e.code==="KeyP")       world.current.paused = !world.current.paused;
          if (e.code==="KeyM") {
            // toggle musique
            const playing = !!getAudioBus().bgm;
            if (playing) bus.stopAll(); else if (world.current.started) bus.playBgm(SND+"game-music-1.mp3",0.35);
          }
        } else {
          if (e.code==="ArrowLeft")  d.left = false;
          if (e.code==="ArrowRight") d.right = false;
          if (e.code==="Space")      d.jump = false;
        }
      };
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKey);

      let raf = 0;
      const loop = () => { raf = requestAnimationFrame(loop); if(!ready || world.current.paused) return; step(); render(); };

      (async () => {
        const heroCfg:HeroCfg = await loadJSON(IMG + "hero.anim.json");
        assets.current.heroCfg = heroCfg;
        const files = new Set<string>();
        Object.values(heroCfg.animations).forEach(a => a.files.forEach(f => files.add(f)));
        await Promise.all([...files].map(async f => { assets.current.heroImgs.set(f, await loadImage(IMG+f)); }));
        for (let i=1;i<=6;i++) assets.current.bearImgs.push(await loadImage(IMG + `bear(${i}).png`));
        assets.current.items.set("speed",  await loadImage(IMG+"amulette-speed.png"));
        assets.current.items.set("purify", await loadImage(IMG+"amulette-purify.png"));
        assets.current.items.set("ward",   await loadImage(IMG+"amulette-ward.png"));
        assets.current.items.set("eye",    await loadImage(IMG+"evil-eye.png"));
        const wy = world.current.groundY;
        world.current.items = [
          { x: 600,  y: wy-10, kind:"speed"  },
          { x: 980,  y: wy-10, kind:"purify" },
          { x: 1380, y: wy-10, kind:"ward"   },
        ];
        setReady(true);
        loop();
      })().catch(console.error);

      // clic pour démarrer (déclenche aussi la musique)
      cvs.addEventListener("pointerdown", ()=>{
        if (!world.current.started) {
          world.current.started = true;
          getAudioBus().playBgm(SND+"game-music-1.mp3",0.35);
        }
      });

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKey);
        try { wrap.removeChild(cvs); } catch {}
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    const step = () => {
      const W = world.current;
      if (!W.started) return; // attendre clic Start in-canvas

      const hero = W.hero;
      const acc = 0.5;
      if (W.input.left)  hero.vx -= acc;
      if (W.input.right) hero.vx += acc;
      hero.vx *= 0.9;
      hero.x += hero.vx;

      if (W.input.jump && hero.onGround) {
        hero.vy = -10.5; hero.onGround=false;
        getAudioBus().play(SND+"jump-sound.mp3",0.7);
      }
      hero.vy += 0.55; hero.y += hero.vy;
      const gy = W.groundY;
      if (hero.y >= gy) { hero.y = gy; hero.vy=0; hero.onGround=true; }

      const cfg = assets.current.heroCfg as HeroCfg;
      const anim = hero.onGround ? (Math.abs(hero.vx)>0.3 ? "run" : "idle") : "jump";
      if (hero.anim!==anim) { hero.anim=anim; hero.frame=0; hero.frameTime=0; }
      const fps = Math.max(2, (cfg.animations[anim]?.fps ?? 8) * (anim==="run" ? 0.6 : 0.4));
      hero.frameTime += 1;
      if (hero.frameTime >= 60/fps) {
        hero.frameTime = 0;
        const len = cfg.animations[anim]?.files.length || 1;
        hero.frame = Math.min(len-1, (hero.frame+1) % len);
      }

      const bear=W.bear;
      bear.ft += 1; if (bear.ft>=6) { bear.ft=0; bear.frame=(bear.frame+1)%assets.current.bearImgs.length; }
      bear.x += bear.speed;

      for (const it of W.items) {
        if (it.taken) continue;
        if (Math.abs(it.x-hero.x)<38 && Math.abs(it.y-hero.y)<54) {
          it.taken = true;
          let msg="";
          if (it.kind==="speed")  { msg="Amulette de vitesse : symbole de mobilité et de réussite."; getAudioBus().play(SND+"catch-sound.mp3",0.8); }
          if (it.kind==="purify") { msg="Amulette de purification : chasse l’impur lors du rite.";     getAudioBus().play(SND+"catch-sound.mp3",0.8); }
          if (it.kind==="ward")   { msg="Amulette-bouclier : protège du « mauvais œil ».";            getAudioBus().play(SND+"catch-sound.mp3",0.8); }
          setToast(msg);
        }
      }

      if (!ended && hero.x > 2100) {
        setEnded({
          title:"Fin du niveau 1",
          lines:[
            "• L’astragale sert d’amulette (vitesse, protection, purification).",
            "• Les rituels structurent l’action et marquent le passage.",
            "• Prochain niveau : montage de l’amulette (ficelle + perles)."
          ]
        });
      }
    };

    const render = () => {
      const cvs = canvasRef.current!; const ctx = cvs.getContext("2d")!;
      const W = world.current;
      ctx.clearRect(0,0,cvs.width,cvs.height);

      ctx.fillStyle="#eef3ff"; ctx.fillRect(0,0,cvs.width,cvs.height);
      ctx.fillStyle="#e8ebfb"; ctx.fillRect(0, Math.floor(cvs.height*0.65), cvs.width, Math.floor(cvs.height*0.35));
      ctx.fillStyle="#cfd6ff"; ctx.fillRect(0, W.groundY, cvs.width, 6);

      // items
      for (const it of W.items) {
        if (it.taken) continue;
        const img = assets.current.items.get(it.kind);
        if (img) ctx.drawImage(img, it.x-24, it.y-48, 48, 48);
      }

      // ours
      const bi = assets.current.bearImgs[W.bear.frame];
      if (bi) ctx.drawImage(bi, W.bear.x-48, W.groundY-96, 96, 96);

      // héros
      const cfg = assets.current.heroCfg as HeroCfg;
      if (cfg) {
        const f = cfg.animations[W.hero.anim]?.files[W.hero.frame];
        const im = f && assets.current.heroImgs.get(f);
        if (im) ctx.drawImage(im, W.hero.x - cfg.frameSize[0]*W.hero.scale/2, W.hero.y - cfg.frameSize[1]*W.hero.scale, cfg.frameSize[0]*W.hero.scale, cfg.frameSize[1]*W.hero.scale);
      }

      // overlay "cliquer pour démarrer"
      if (!W.started) {
        ctx.fillStyle="rgba(255,255,255,.9)";
        ctx.fillRect(0,0,cvs.width,cvs.height);
        ctx.fillStyle="#203050";
        ctx.font="bold 24px system-ui"; ctx.textAlign="center";
        ctx.fillText("Clique dans le cadre pour démarrer", cvs.width/2, cvs.height/2);
        ctx.textAlign="start";
      }

      if (eduMsg) {
        const pad=10, maxW=Math.min(520, cvs.width-40);
        ctx.font="16px system-ui"; ctx.fillStyle="rgba(255,255,255,.92)";
        ctx.fillRect(20,20, maxW, 60);
        ctx.strokeStyle="#aac"; ctx.strokeRect(20,20,maxW,60);
        ctx.fillStyle="#203050"; ctx.fillText(eduMsg, 28, 56);
      }

      if (ended) {
        ctx.fillStyle="rgba(255,255,255,.85)"; ctx.fillRect(0,0,cvs.width,cvs.height);
        ctx.fillStyle="#203050"; ctx.font="bold 28px system-ui"; ctx.fillText(ended.title, 40, 60);
        ctx.font="18px system-ui"; let y=100; for (const L of ended.lines){ ctx.fillText(L, 40, y); y+=26; }
        const bW=230,bH=44, bx=40, by=y+40;
        ctx.fillStyle="#0b1f33"; ctx.fillRect(bx,by,bW,bH);
        ctx.fillStyle="#e6f1ff"; ctx.font="16px system-ui"; ctx.fillText("Niveau suivant →", bx+20, by+28);
        cvs.onclick = (ev:any) => {
          const r = cvs.getBoundingClientRect();
          const mx = (ev.clientX-r.left)*(cvs.width/r.width);
          const my = (ev.clientY-r.top)*(cvs.height/r.height);
          if (mx>=bx && mx<=bx+bW && my>=by && my<=by+bH) {
            const w:any = window; if (w.__OSSELETS_GOTO_LEVEL) w.__OSSELETS_GOTO_LEVEL(2);
          }
        };
      } else {
        cvs.onclick = null;
      }
    };

    return <div ref={wrapRef} />;
  }

  (window as any).AstragalusRunner = AstragalusRunner;
})();
