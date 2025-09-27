/* global React */
(() => {
  // verrou React
  // @ts-ignore
  const ReactGlobal = (window as any).React;
  // @ts-ignore
  const React = ReactGlobal;
  // @ts-ignore
  const { useRef, useEffect, useState } = React;

  const IMG = "/assets/games/osselets/audio/img/";
  const SND = "/assets/games/osselets/audio/";
  function getAudioBus(){ return (window as any).__OSSELETS_AUDIO__ || { play(){}, playBgm(){}, stopAll(){} }; }
  function loadImage(src:string){ return new Promise<HTMLImageElement>((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=src; }); }

  function AstragalusLevel2(){
    const rootRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    const [done, setDone]   = useState(false);

    const state = useRef<any>({
      order:["speed","purify","ward"],
      placed:[] as string[],
      dragging:null as {kind:string,dx:number,dy:number}|null,
      items:[] as Array<{kind:"speed"|"purify"|"ward";x:number;y:number;w:number;h:number;img:HTMLImageElement}>,
      bar:{ x: 160, y: 300, w: 520, h: 12 }
    });

    useEffect(()=>{
      getAudioBus().stopAll();
      const el = rootRef.current!; el.style.position="absolute"; el.style.inset="0"; el.style.display="grid";
      (async ()=>{
        const speed  = await loadImage(IMG+"amulette-speed.png");
        const purify = await loadImage(IMG+"amulette-purify.png");
        const ward   = await loadImage(IMG+"amulette-ward.png");
        const items  = [{kind:"speed",img:speed},{kind:"purify",img:purify},{kind:"ward",img:ward}]
          .map((o,i)=>({ ...o, x: 120+i*120, y: 120, w:64, h:64 }));
        state.current.items = items as any;
        setReady(true);
      })();
    },[]);

    useEffect(()=>{
      if (!ready) return;
      const div=rootRef.current!;
      const cvs=document.createElement("canvas");
      cvs.style.width="100%"; cvs.style.height="100%"; cvs.style.imageRendering="pixelated";
      div.appendChild(cvs);
      const ctx=cvs.getContext("2d")!;
      const onResize=()=>{ const r=window.devicePixelRatio||1; const rc=div.getBoundingClientRect(); cvs.width=Math.max(16,rc.width*r); cvs.height=Math.max(16,rc.height*r); };
      onResize(); const ro=new ResizeObserver(onResize); ro.observe(div);

      let isDown=false, pickIdx=-1;
      cvs.addEventListener("pointerdown",(e)=>{
        const R=cvs.getBoundingClientRect(); const x=(e.clientX-R.left)*(cvs.width/R.width); const y=(e.clientY-R.top)*(cvs.height/R.height);
        const st=state.current; pickIdx=st.items.findIndex(it => x>=it.x && x<=it.x+it.w && y>=it.y && y<=it.y+it.h);
        isDown=true; if(pickIdx>=0) st.dragging={kind:st.items[pickIdx].kind, dx:x-st.items[pickIdx].x, dy:y-st.items[pickIdx].y};
      });
      cvs.addEventListener("pointermove",(e)=>{
        if(!isDown) return; const R=cvs.getBoundingClientRect(); const x=(e.clientX-R.left)*(cvs.width/R.width); const y=(e.clientY-R.top)*(cvs.height/R.height);
        const st=state.current; if(st.dragging && pickIdx>=0){ st.items[pickIdx].x=x-st.dragging.dx; st.items[pickIdx].y=y-st.dragging.dy; }
      });
      cvs.addEventListener("pointerup",()=>{
        isDown=false; const st=state.current;
        if(st.dragging && pickIdx>=0){
          const it=st.items[pickIdx]; const b=st.bar;
          if (it.x+it.w/2>=b.x && it.x+it.w/2<=b.x+b.w && it.y+it.h/2>=b.y-24 && it.y+it.h/2<=b.y+24) {
            const idx=st.placed.length; const expected=st.order[idx];
            if (it.kind===expected) {
              (getAudioBus()).play(SND+"catch-sound.mp3",0.85);
              st.placed.push(it.kind);
              const slots=[b.x + b.w*0.2, b.x + b.w*0.5, b.x + b.w*0.8];
              it.x=Math.floor(slots[idx]-it.w/2); it.y=b.y - it.h/2 - 6;
              if (st.placed.length===st.order.length) setDone(true);
            } else {
              (getAudioBus()).play(SND+"ouch-sound.mp3",0.7);
            }
          }
        }
        st.dragging=null; pickIdx=-1;
      });

      let raf=0; const loop=()=>{ raf=requestAnimationFrame(loop); draw(); }; loop();

      function draw(){
        const st=state.current;
        ctx.clearRect(0,0,cvs.width,cvs.height);
        ctx.fillStyle="#f8fbff"; ctx.fillRect(0,0,cvs.width,cvs.height);
        ctx.fillStyle="#c5d3ff"; ctx.fillRect(st.bar.x, st.bar.y, st.bar.w, st.bar.h);
        for (const it of st.items) { if (it.img) ctx.drawImage(it.img, it.x, it.y, it.w, it.h); }
        ctx.fillStyle="#203050"; ctx.font="18px system-ui, Segoe UI";
        ctx.fillText("Monte l’amulette : Vitesse → Purification → Bouclier", 24, 36);

        if (done) {
          ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.fillRect(0,0,cvs.width,cvs.height);
          ctx.fillStyle="#203050"; ctx.font="bold 26px system-ui"; ctx.fillText("Amulette montée !", 40, 70);
          ctx.font="18px system-ui";
          ctx.fillText("• Ordre et gestes : un rite organise l’action.", 40, 110);
          ctx.fillText("• Symbole : l’objet porte un sens partagé.", 40, 136);
          const bx=40,by=170,bw=220,bh=44;
          ctx.fillStyle="#0b1f33"; ctx.fillRect(bx,by,bw,bh);
          ctx.fillStyle="#e6f1ff"; ctx.font="16px system-ui"; ctx.fillText("Niveau 3 →", bx+20, by+28);
          cvs.onclick=(ev:any)=>{
            const R=cvs.getBoundingClientRect(); const mx=(ev.clientX-R.left)*(cvs.width/R.width); const my=(ev.clientY-R.top)*(cvs.height/R.height);
            if (mx>=bx && mx<=bx+bw && my>=by && my<=by+bh) { const w:any=window; if (w.__OSSELETS_GOTO_LEVEL) w.__OSSELETS_GOTO_LEVEL(3); }
          };
        } else cvs.onclick=null;
      }

      return ()=>{ cancelAnimationFrame(raf); ro.disconnect(); try{ div.removeChild(cvs);}catch{} };
    },[ready,done]);

    return <div ref={rootRef}/>;
  }

  (window as any).AstragalusLevel2 = AstragalusLevel2;
})();
