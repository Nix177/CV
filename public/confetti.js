// Mini confettis (sans dépendance)
(() => {
  const canvas = document.getElementById("confetti");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, pieces = [], running = false, tEnd = 0;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize); resize();

  function spawn(n=220){
    pieces = [];
    for(let i=0;i<n;i++){
      pieces.push({
        x: Math.random()*W, y: -20 - Math.random()*H*0.5,
        r: 4+Math.random()*4, vy: 2+Math.random()*3, vx: -1+Math.random()*2,
        rot: Math.random()*Math.PI, vr: -0.1+Math.random()*0.2,
        col: `hsl(${Math.random()*360},90%,60%)`
      });
    }
  }

  function step(){
    if (!running) return;
    ctx.clearRect(0,0,W,H);
    const now = performance.now();
    for(const p of pieces){
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.r, -p.r, p.r*2, p.r*2);
      ctx.restore();
    }
    if (now > tEnd || pieces.every(p => p.y > H+20)){ canvas.style.display = "none"; running = false; return; }
    requestAnimationFrame(step);
  }

  window.launchConfetti = (ms=1000) => {
    spawn();
    canvas.style.display = "block";
    running = true;
    tEnd = performance.now() + ms;
    step();
  };
})();
