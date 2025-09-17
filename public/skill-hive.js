<script>
/* Skill Hive – JS no-deps */
(() => {
  const HIVE_MIN_UNLOCK = 5;      // nb d’alvéoles à « récolter » avant de débloquer le CTA
  const hive = document.querySelector('.skill-hive');
  if (!hive) return;

  // ---------- Canvas bees background ----------
  const canvas = document.getElementById('hive-bg');
  const ctx = canvas.getContext('2d', { alpha:true });
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let bees = [];
  let raf = 0;

  function resize(){
    const rect = hive.getBoundingClientRect();
    canvas.width  = Math.floor(rect.width  * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }
  function spawnBees(){
    const n = 20;
    bees = Array.from({length:n}, (_,i)=>({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      v: 0.6 + Math.random()*0.7,
      a: Math.random()*Math.PI*2,
      r: 2.2 + Math.random()*1.3
    }));
  }
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // hex pattern hint
    ctx.globalAlpha = 0.07;
    const size = 72 * DPR;
    const h = Math.sin(Math.PI/3)*size;
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 1;
    for(let y = -h; y < canvas.height + h; y += h){
      for(let x = 0, j = 0; x < canvas.width + size; x += size*0.75, j++){
        const cx = x + (j%2? size*0.375 : 0);
        hex(cx, y, size*0.5);
      }
    }
    ctx.globalAlpha = 1;

    // bees
    for(const b of bees){
      b.a += (Math.random()-.5)*0.3;
      b.x += Math.cos(b.a)*b.v*DPR*1.5;
      b.y += Math.sin(b.a)*b.v*DPR*1.5;
      if(b.x< -10|| b.x>canvas.width+10 || b.y<-10 || b.y>canvas.height+10){
        b.x = Math.random()*canvas.width; b.y = Math.random()*canvas.height;
      }
      // body
      ctx.beginPath();
      ctx.fillStyle = '#f59e0b';
      ctx.arc(b.x, b.y, b.r*DPR, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(b.x - b.r*DPR, b.y-1.2*DPR, (b.r*2*DPR), 1.2*DPR); // bande
      // wings
      ctx.globalAlpha = .6;
      ctx.beginPath(); ctx.fillStyle = '#e0f2fe';
      ctx.ellipse(b.x+1.5*DPR, b.y-1.6*DPR, 1.5*DPR, 2*DPR, .5,0,Math.PI*2); ctx.fill();
      ctx.ellipse(b.x-1.2*DPR, b.y-1.8*DPR, 1.4*DPR, 1.8*DPR, -.5,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(draw);
  }
  function hex(cx, cy, r){
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const a = Math.PI/3*i;
      const x = cx + r*Math.cos(a);
      const y = cy + r*Math.sin(a);
      (i? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    }
    ctx.closePath(); ctx.stroke();
  }
  const resizeObs = new ResizeObserver(()=>{ resize(); spawnBees(); });
  resizeObs.observe(hive);
  resize(); spawnBees(); draw();

  // ---------- Game logic ----------
  const toast = hive.querySelector('.toast');
  const fill  = hive.querySelector('.fill');
  const counter = hive.querySelector('[data-counter]');
  const unlockBtn = hive.querySelector('#hive-unlock');

  let scored = 0;
  function updateProgress(){
    const pct = Math.min(100, Math.round((scored / HIVE_MIN_UNLOCK) * 100));
    fill.style.width = pct + '%';
    counter.textContent = `${scored}/${HIVE_MIN_UNLOCK}`;
    unlockBtn.disabled = scored < HIVE_MIN_UNLOCK;
  }
  function notify(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(notify._t);
    notify._t = setTimeout(()=>toast.classList.remove('show'), 1400);
  }

  // handle hex flips & mini-actions
  hive.querySelectorAll('.hex').forEach(hex => {
    const ok    = hex.querySelector('[data-ok]');
    const skip  = hex.querySelector('[data-skip]');
    hex.addEventListener('click', (e)=>{
      // évite que boutons recliquent le flip
      if((e.target.closest('button'))) return;
      hex.classList.toggle('flipped');
    });
    ok?.addEventListener('click', e=>{
      e.stopPropagation();
      if(hex.dataset.done === '1'){ notify('Déjà collecté 🧉'); return; }
      hex.dataset.done = '1';
      scored++;
      updateProgress();
      notify('Nectar collecté !');
    });
    skip?.addEventListener('click', e=>{
      e.stopPropagation();
      notify('Pas grave — essayez une autre alvéole 🐝');
    });
  });

  unlockBtn.addEventListener('click', ()=>{
    // laisse toi connecter ça à ce que tu veux (ex: scroll vers CV / ouvrir modal / etc.)
    window.location.href = '/portfolio';
  });

  updateProgress();

  // nettoyage
  window.addEventListener('pagehide', ()=> cancelAnimationFrame(raf));
})();
</script>
