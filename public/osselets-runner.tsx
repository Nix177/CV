/* public/osselets-runner.tsx
   Mini-jeu 1 — Runner 2D : amulettes & “mauvais œil”
   - Bus audio global commun aux 3 jeux
   - Avertissements Babel OK en dev (précompiler pour prod)
   - Fix React: hooks uniquement dans le composant; aucune promesse rendue
   - UI clavier : ←/→, Espace, S (NIKĒ), C (Katharsis), W (Apotropaïon), M (musique ON/OFF)
   - Assets: /assets/games/osselets/audio/..., /assets/games/osselets/audio/img/...
*/
(function (global) {
  const { useEffect, useRef, useState } = React;

  // ---------- Bus audio commun ----------
  if (!global.AstragalusAudioBus) {
    global.AstragalusAudioBus = {
      _list: [],
      register(a) { if (a && !this._list.includes(a)) this._list.push(a); },
      stopAll()   { this._list.forEach(a=>{ try{ a.pause(); a.currentTime=0; }catch{} }); },
      muteAll(m)  { this._list.forEach(a=>{ try{ a.muted=!!m; }catch{} }); }
    };
  }

  // ---------- Constantes ----------
  const W = 960, H = 540, GROUND_Y = 440;
  const IMG_BASES = ["/assets/games/osselets/audio/img/","/assets/games/osselets/img/"];
  const ABASE = "/assets/games/osselets/audio/";
  const AU = { music:"game-music-1.mp3", jump:"jump-sound.mp3", catch:"catch-sound.mp3", ouch:"ouch-sound.mp3" };
  const FILES = {
    amulets: { speed:"amulette-speed.png", purify:"amulette-purify.png", ward:"amulette-ward.png" },
    hazard: "evil-eye.png",
    start:  "start-screenshot.webp" // évite 404 si pré-chargé par l’écran d’attente
  };

  // ---------- Utils ----------
  function logOnce(key, ...args){ const k="__once_"+key; if(global[k]) return; global[k]=1; console.warn(...args); }
  function loadImage(url){ return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>rej(new Error("img "+url)); im.src=encodeURI(url); }); }
  async function loadImageSmart(file){
    for(const b of IMG_BASES){ try{ return await loadImage(b+file);}catch{} }
    logOnce("img_"+file,"[runner] image introuvable:",file,"bases:",IMG_BASES);
    return null;
  }
  async function fetchJSON(file){
    for(const b of IMG_BASES){ try{ const r=await fetch(b+file,{cache:"no-store"}); if(r.ok) return await r.json(); }catch{} }
    logOnce("json_"+file,"[runner] json introuvable:",file); return null;
  }
  function loadAudio(file,vol=1,loop=false){ try{ const a=new Audio(ABASE+file); a.preload="auto"; a.loop=!!loop; a.volume=vol; global.AstragalusAudioBus.register(a); return a; }catch{ return null; } }

  // ---------- Composant ----------
  function AstragalusRunner(){
    const hostRef = useRef(null);
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    // audio
    const musRef = useRef(null), sJumpRef=useRef(null), sOkRef=useRef(null), sOuchRef=useRef(null);
    const [musicOn,setMusicOn]=useState(true);

    // état jeu
    const imgMap=useRef({});
    const heroAnim=useRef({ clips:{}, origin:[0.5,1], frameSize:[64,64] });
    const rafRef=useRef(0);
    const tRef=useRef(0);

    const player=useRef({ x:120, y:GROUND_Y-68, w:42, h:68, vx:0, vy:0, onGround:true, facing:1, baseSpeed:3, speedMul:1, dirt:0, runPhase:0, coyote:0, jumpBuf:0 });
    const inv=useRef({ speed:false, purify:false, ward:false });
    const keys=useRef({});
    const pickups=useRef([]); // {x,y,w,h,file,kind}
    const hazards=useRef([]); // {x,y,w,h,file}

    const [edu,setEdu]=useState(null);  // toast docu
    const eduSeen=useRef({ speed:false, purify:false, ward:false });

    // stop musique précédente
    useEffect(()=>{ global.AstragalusAudioBus.stopAll(); },[]);

    // DPR / responsive
    useEffect(()=>{
      const cv=canvasRef.current, ctx=cv.getContext("2d"); ctxRef.current=ctx;
      function resize(){
        const w=hostRef.current?.clientWidth||W, h=Math.round(w*(H/W));
        const dpr=Math.max(1,Math.min(2.5,global.devicePixelRatio||1));
        cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
        cv.style.width=w+"px"; cv.style.height=h+"px";
        ctx.setTransform(dpr*(w/W),0,0,dpr*(w/W),0,0);
      }
      resize(); const ro=global.ResizeObserver?new ResizeObserver(resize):null; ro?.observe(hostRef.current);
      const onR=()=>resize(); global.addEventListener("resize",onR);
      return ()=>{ ro?.disconnect(); global.removeEventListener("resize",onR); };
    },[]);

    // audio
    useEffect(()=>{
      try{ musRef.current=loadAudio(AU.music,0.35,true); if(musicOn) musRef.current?.play().catch(()=>{});}catch{}
      try{ sJumpRef.current=loadAudio(AU.jump,0.9,false);}catch{}
      try{ sOkRef.current=loadAudio(AU.catch,0.9,false);}catch{}
      try{ sOuchRef.current=loadAudio(AU.ouch,0.8,false);}catch{}
      return ()=>{ try{ musRef.current?.pause(); }catch{} };
    },[]);
    useEffect(()=>{ const m=musRef.current; if(!m) return; m.muted=!musicOn; if(musicOn){ m.play?.().catch(()=>{});} else m.pause?.(); },[musicOn]);

    // charge sprites + anims
    useEffect(()=>{
      let cancelled=false;
      (async()=>{
        // précharge screenshot d’attente (évite 404 s’il est référencé)
        await loadImageSmart(FILES.start).catch(()=>{});
        const anim=await fetchJSON("hero.anim.json"); if(!anim) return;
        heroAnim.current.origin=anim.origin||[0.5,1];
        heroAnim.current.frameSize=anim.frameSize||[64,64];
        async function loadList(files){ const out=[]; for(const f of files){ if(!imgMap.current[f]) imgMap.current[f]=await loadImageSmart(f); out.push({file:f,img:imgMap.current[f]}); } return out; }
        const clips={}; for(const [name,def] of Object.entries(anim.animations||{})){ const frames=await loadList(def.files||[]); clips[name]={frames,fps:def.fps||8,loop:!!def.loop}; }
        heroAnim.current.clips=clips;

        // icônes (amulettes + piège)
        for(const f of Object.values(FILES.amulets)){ if(!imgMap.current[f]) imgMap.current[f]=await loadImageSmart(f); }
        if(!imgMap.current[FILES.hazard]) imgMap.current[FILES.hazard]=await loadImageSmart(FILES.hazard);

        if(!cancelled) loop();
      })();
      return ()=>{ cancelled=true; cancelAnimationFrame(rafRef.current); try{ musRef.current?.pause(); }catch{} };
    },[]);

    // input
    useEffect(()=>{
      const kd=(e)=>{ const k=e.key; if(["ArrowLeft","ArrowRight"," ","Space","ArrowUp","m","M","s","S","c","C","w","W"].includes(k)) e.preventDefault(); keys.current[k]=true;
        if(k===" "||k==="Space"||k==="ArrowUp") jump();
        if(k==="m"||k==="M") setMusicOn(v=>!v);
        if(k==="s"||k==="S") setAmulet("speed");
        if(k==="c"||k==="C") setAmulet("purify");
        if(k==="w"||k==="W") setAmulet("ward");
      };
      const ku=(e)=>{ keys.current[e.key]=false; };
      global.addEventListener("keydown",kd); global.addEventListener("keyup",ku);
      return ()=>{ global.removeEventListener("keydown",kd); global.removeEventListener("keyup",ku); };
    },[]);

    function toast(msg){ setEdu({msg,until:performance.now()+4200}); }
    function setAmulet(kind){
      inv.current={ speed:false, purify:false, ward:false, [kind]:true };
      if(kind==="speed"  && !eduSeen.current.speed ){ toast("**NIKĒ** — amulette de **vitesse** (élan de victoire)."); eduSeen.current.speed=true; }
      if(kind==="purify" && !eduSeen.current.purify){ toast("**Katharsis** — amulette **purificatrice** contre la souillure."); eduSeen.current.purify=true; }
      if(kind==="ward"   && !eduSeen.current.ward  ){ toast("**Apotropaïon** — **écarte le mauvais œil** (protection)."); eduSeen.current.ward=true; }
    }
    function jump(){
      const p=player.current;
      if(p.onGround||p.coyote>0){ p.vy=-12; p.onGround=false; p.coyote=0; try{ const s=sJumpRef.current; if(s){ s.currentTime=0; s.play().catch(()=>{});} }catch{} }
    }

    function spawn(){
      // pickups amulettes
      if(Math.random()<0.018){
        const arr=Object.values(FILES.amulets); const file=arr[(Math.random()*arr.length)|0];
        pickups.current.push({x:W+30,y:360+(Math.random()*120|0),w:40,h:40,file,kind:file.includes("speed")?"speed":file.includes("purify")?"purify":"ward"});
      }
      // pièges “evil eye”
      if(Math.random()<0.012){
        hazards.current.push({x:W+30,y:380+(Math.random()*110|0),w:44,h:44,file:FILES.hazard});
      }
    }

    function step(dt){
      const ctx=ctxRef.current, p=player.current;

      // input horizontal
      const left=keys.current["ArrowLeft"], right=keys.current["ArrowRight"];
      const target = (right?1:0) - (left?1:0);
      const maxSpeed = p.baseSpeed * (inv.current.speed ? 1.75 : 1.0) * (p.dirt>0 ? 0.6 : 1.0);
      p.vx += (target*maxSpeed - p.vx) * 0.4;
      p.facing = p.vx>=0 ? 1 : -1;

      // gravité + sol
      p.vy += 0.6; p.y += p.vy; if(p.y>GROUND_Y-p.h){ p.y=GROUND_Y-p.h; p.vy=0; if(!p.onGround) p.coyote=5; p.onGround=true; } else { p.onGround=false; if(p.coyote>0) p.coyote--; }
      p.x = Math.max(40, Math.min(W-40, p.x + p.vx));

      // spawns & déplacement objets
      if((Math.random()*100|0)===0) spawn();
      pickups.current.forEach(o=>o.x -= 3.2);
      hazards.current.forEach(o=>o.x -= 3.0);

      // collisions
      function hit(a,b){ return Math.abs((a.x+a.w*0.5)-(b.x+b.w*0.5))<(a.w+b.w)*0.5 && Math.abs((a.y+a.h*0.5)-(b.y+b.h*0.5))<(a.h+b.h)*0.5; }
      pickups.current = pickups.current.filter(o=>{
        if(hit({x:p.x,y:p.y,w:p.w,h:p.h},o)){
          if(o.kind==="purify"){ p.dirt=Math.max(0,p.dirt-1); }
          inv.current={ speed:false,purify:false,ward:false,[o.kind]:true };
          try{ const s=sOkRef.current; s && (s.currentTime=0, s.play().catch(()=>{})); }catch{}
          if(o.kind==="speed") toast("**NIKĒ** : accélération **temporaire** (croyance propitiatoire).");
          if(o.kind==="purify") toast("**Katharsis** : purification / nettoyage contre la **maladie**.");
          if(o.kind==="ward")   toast("**Apotropaïon** : protection contre le **mauvais œil**.");
          return false;
        }
        return o.x>-80;
      });
      hazards.current = hazards.current.filter(o=>{
        if(hit({x:p.x,y:p.y,w:p.w,h:p.h},o)){
          if(!inv.current.ward){ p.dirt=(p.dirt||0)+1; try{ const s=sOuchRef.current; s && (s.currentTime=0, s.play().catch(()=>{})); }catch{} toast("⚠️ **Mauvais œil** — effet négatif sans amulette **apotropaïque**."); }
          return false;
        }
        return o.x>-80;
      });

      // rendu
      ctx.clearRect(0,0,W,H);
      // fond
      const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0b2334"); g.addColorStop(1,"#0a1b2a"); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#0f2a42"; ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);

      // joueur (anim approximative: idle/run/jump)
      const clips=heroAnim.current.clips;
      let clip = p.onGround ? (Math.abs(p.vx)>0.2 ? clips.run : clips.idle) : clips.jump;
      const now=tRef.current+=dt; const origin=heroAnim.current.origin; const fs=heroAnim.current.frameSize;
      if(clip && clip.frames.length){
        const idx = Math.floor((now/1000)*(clip.fps||8)) % clip.frames.length;
        const fr = clip.frames[idx]?.img;
        if(fr){
          ctx.save(); ctx.translate(p.x, p.y+p.h); ctx.scale(p.facing,1);
          const ox=fs[0]*origin[0], oy=fs[1]*origin[1];
          ctx.drawImage(fr, -ox, -oy, fs[0], fs[1]);
          ctx.restore();
        }
      }

      // objets
      function drawIcon(o){
        const im=imgMap.current[o.file]; if(!im) return;
        ctx.drawImage(im, o.x-o.w*0.5, o.y-o.h*0.5, o.w, o.h);
      }
      pickups.current.forEach(drawIcon);
      hazards.current.forEach(drawIcon);

      // HUD
      ctx.fillStyle="#cfe2ff"; ctx.font="16px system-ui,Segoe UI,Roboto,Arial";
      ctx.fillText("←/→ • S/C/W = amulettes • Espace = sauter • M = musique", 16, 24);
      ctx.fillText(`Effets : ${inv.current.speed?"Vitesse ":""}${inv.current.purify?"Purification ":""}${inv.current.ward?"Protection ":""}${p.dirt?`| Malus×${p.dirt}`:""}`, 16, 46);

      if(edu && performance.now()<edu.until){
        ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(20,H-130,W-40,90);
        ctx.fillStyle="#e6f1ff"; ctx.font="18px system-ui,Segoe UI,Roboto,Arial"; ctx.fillText("💡 Info", 30, H-100);
        ctx.font="16px system-ui,Segoe UI,Roboto,Arial"; wrap(ctx, edu.msg, 30, H-78, W-60, 18);
      }
    }

    function wrap(ctx, text, x,y,w,lh){ const words=(text||"").split(/\s+/); let line=""; for(const wd of words){ const t=(line?line+" ":"")+wd; if(ctx.measureText(t).width>w && line){ ctx.fillText(line,x,y); line=wd; y+=lh; } else line=t; } if(line) ctx.fillText(line,x,y); }

    function loop(){
      const t=performance.now(); const dt=t-(tRef.time||t); tRef.time=t;
      step(dt);
      rafRef.current=requestAnimationFrame(loop);
    }

    return (
      <div ref={hostRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", border:"1px solid #224", borderRadius:"12px", overflow:"hidden"}}>
        <canvas ref={canvasRef} width={W} height={H} aria-label="Runner 2D" />
        <div style={{position:"absolute", inset:"auto 12px 12px auto", display:"flex", gap:"8px"}}>
          <button onClick={()=>setMusicOn(v=>!v)} className="btn">Musique: {musicOn?"ON":"OFF"}</button>
          <button onClick={()=>{ try{ global.AstragalusAudioBus.stopAll(); }catch{} }} className="btn">Stop musique</button>
        </div>
      </div>
    );
  }

  // Montage auto si un container existe déjà
  function mountRunner(){
    const el=document.getElementById("osselets-runner"); if(!el) return;
    ReactDOM.createRoot(el).render(React.createElement(AstragalusRunner));
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", mountRunner);
  else mountRunner();

})(window);
