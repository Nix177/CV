(function(){
  const IMG = "/assets/games/osselets/audio/img/";
  const SND = "/assets/games/osselets/audio/";

  const loadImage = (src) => new Promise((res, rej) => { const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=src; });

  window.__startMiniJEU2 = async function(){
    const root = document.getElementById("mj2-root");
    root.replaceChildren();

    const cvs = document.createElement("canvas");
    cvs.style.width="100%"; cvs.style.height="100%"; cvs.style.imageRendering="pixelated";
    root.appendChild(cvs);
    const ctx = cvs.getContext("2d");

    const W = {
      bar:{ x: 180, y: 320, w: 560, h: 12 },
      order:["speed","purify","ward"],
      placed:[],
      items:[], dragging:{idx:-1, dx:0, dy:0}, done:false
    };

    const speed  = await loadImage(IMG+"amulette-speed.png");
    const purify = await loadImage(IMG+"amulette-purify.png");
    const ward   = await loadImage(IMG+"amulette-ward.png");
    W.items = [
      { kind:"speed",  img:speed,  x:120, y:120, w:64, h:64 },
      { kind:"purify", img:purify, x:240, y:120, w:64, h:64 },
      { kind:"ward",   img:ward,   x:360, y:120, w:64, h:64 },
    ];

    function resize(){ const r=window.devicePixelRatio||1, rc=root.getBoundingClientRect(); cvs.width=Math.max(16,rc.width*r); cvs.height=Math.max(16,rc.height*r); }
    new ResizeObserver(resize).observe(root); resize();

    let down=false;
    cvs.addEventListener("pointerdown",(e)=>{
      const R=cvs.getBoundingClientRect(); const x=(e.clientX-R.left)*(cvs.width/R.width), y=(e.clientY-R.top)*(cvs.height/R.height);
      for (let i=W.items.length-1;i>=0;i--){
        const it=W.items[i]; if (x>=it.x&&x<=it.x+it.w&&y>=it.y&&y<=it.y+it.h){ W.dragging={idx:i, dx:x-it.x, dy:y-it.y}; break; }
      }
      down=true;
    });
    cvs.addEventListener("pointermove",(e)=>{
      if(!down) return;
      const R=cvs.getBoundingClientRect(); const x=(e.clientX-R.left)*(cvs.width/R.width), y=(e.clientY-R.top)*(cvs.height/R.height);
      if (W.dragging.idx>=0){ const it=W.items[W.dragging.idx]; it.x=x-W.dragging.dx; it.y=y-W.dragging.dy; }
    });
    cvs.addEventListener("pointerup",()=>{
      down=false;
      if (W.dragging.idx>=0){
        const it=W.items[W.dragging.idx], b=W.bar;
        if (it.x+it.w/2>=b.x && it.x+it.w/2<=b.x+b.w && it.y+it.h/2>=b.y-24 && it.y+it.h/2<=b.y+24) {
          const idx=W.placed.length; const expected=W.order[idx];
          if (it.kind===expected) {
            (window.__OSSELETS_AUDIO__||{}).play?.(SND+"catch-sound.mp3",0.85);
            W.placed.push(it.kind);
            const slots=[b.x + b.w*0.2, b.x + b.w*0.5, b.x + b.w*0.8];
            it.x=Math.floor(slots[idx]-it.w/2); it.y=b.y - it.h/2 - 6;
            if (W.placed.length===W.order.length) W.done=true;
          } else {
            (window.__OSSELETS_AUDIO__||{}).play?.(SND+"ouch-sound.mp3",0.7);
          }
        }
      }
      W.dragging={idx:-1,dx:0,dy:0};
    });

    function draw(){
      ctx.clearRect(0,0,cvs.width,cvs.height);
      ctx.fillStyle="#f8fbff"; ctx.fillRect(0,0,cvs.width,cvs.height);
      ctx.fillStyle="#c5d3ff"; ctx.fillRect(W.bar.x, W.bar.y, W.bar.w, W.bar.h);

      for (const it of W.items) ctx.drawImage(it.img, it.x, it.y, it.w, it.h);
      ctx.fillStyle="#203050"; ctx.font="18px system-ui"; ctx.fillText("Monte l’amulette : Vitesse → Purification → Bouclier", 24, 36);

      if (W.done) {
        ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.fillRect(0,0,cvs.width,cvs.height);
        ctx.fillStyle="#203050"; ctx.font="bold 26px system-ui"; ctx.fillText("Amulette montée !", 40, 70);
        ctx.font="18px system-ui";
        ctx.fillText("• Ordre et gestes : le rite structure l’action.", 40, 110);
        ctx.fillText("• Symbole : l’objet porte un sens partagé.", 40, 136);
      }
    }
    function loop(){ requestAnimationFrame(loop); draw(); }
    loop();
  };
})();
