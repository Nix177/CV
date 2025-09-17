<script>
(() => {
  const root = document.querySelector('.bee-sim');
  if(!root) return;

  // Canvas bees
  const canvas = document.getElementById('bee-canvas');
  const ctx = canvas.getContext('2d', { alpha:true });
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  function fit(){
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * DPR;
    canvas.height = rect.height * DPR;
  }
  new ResizeObserver(fit).observe(canvas); fit();

  let bees=[];
  function spawnBees(n=26){
    bees = Array.from({length:n}, ()=>({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      v: .6 + Math.random()*1.1,
      a: Math.random()*Math.PI*2,
      r: 2 + Math.random()*1.4
    }));
  }
  spawnBees();

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // hint hex mesh
    ctx.globalAlpha = .07;
    ctx.strokeStyle = '#a5b4fc'; ctx.lineWidth=1;
    const s=74*DPR, h=Math.sin(Math.PI/3)*s;
    for(let y=-h; y<canvas.height+h; y+=h){
      for(let x=0, j=0; x<canvas.width+s; x+=s*.75, j++){
        const cx = x + (j%2? s*.375 : 0);
        hex(cx,y,s*.5);
      }
    }
    ctx.globalAlpha=1;

    // bees
    for(const b of bees){
      b.a += (Math.random()-.5)*.3;
      b.x += Math.cos(b.a)*b.v*DPR*1.4;
      b.y += Math.sin(b.a)*b.v*DPR*1.4;
      if(b.x<-10||b.x>canvas.width+10||b.y<-10||b.y>canvas.height+10){ b.x=Math.random()*canvas.width; b.y=Math.random()*canvas.height; }
      // body
      ctx.beginPath(); ctx.fillStyle='#f59e0b';
      ctx.arc(b.x,b.y,b.r*DPR,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#0b1324'; ctx.fillRect(b.x-b.r*DPR, b.y-1*DPR, b.r*2*DPR, 1*DPR);
      // wings
      ctx.globalAlpha=.6; ctx.fillStyle='#dbeafe';
      ctx.beginPath(); ctx.ellipse(b.x+1.6*DPR,b.y-1.4*DPR,1.5*DPR,2*DPR,.6,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(b.x-1.2*DPR,b.y-1.5*DPR,1.4*DPR,1.8*DPR,-.6,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    requestAnimationFrame(draw);
  }
  function hex(cx,cy,r){
    ctx.beginPath();
    for(let i=0;i<6;i++){ const a=Math.PI/3*i; const x=cx+r*Math.cos(a); const y=cy+r*Math.sin(a); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.closePath(); ctx.stroke();
  }
  draw();

  // Simulation
  const state = {
    day: 1, honey: 0, health: 100,
    sliders: { forage: 40, nurse: 30, build: 30 },
    running: false
  };

  const el = (sel,rootEl=document) => rootEl.querySelector(sel);
  const forage = el('#forage'), nurse=el('#nurse'), build=el('#build');
  const outDay = el('#day'), outHoney=el('#honey'), outHealth=el('#health');
  const btnPlay=el('#play'), btnStep=el('#step'), btnReset=el('#reset');
  const log = el('.log');

  function syncSliders(){
    const total = (+forage.value) + (+nurse.value) + (+build.value);
    if(total!==100){
      // normalise
      const f = (+forage.value)/total, n=(+nurse.value)/total, b=(+build.value)/total;
      forage.value = Math.round(f*100);
      nurse.value  = Math.round(n*100);
      build.value  = 100 - forage.value - nurse.value;
    }
    state.sliders = { forage:+forage.value, nurse:+nurse.value, build:+build.value };
  }
  [forage,nurse,build].forEach(r => r.addEventListener('input', syncSliders));
  syncSliders();

  function tick(){
    // production simple : miel augmente avec forage, santé maintenue par nurse, construction augmente la « capacité » (bonus miel)
    const { forage:f, nurse:n, build:b } = state.sliders;
    const base = f * .18;
    const bonus = (b/100) * (2 + Math.min(8, state.day*.2)); // bonus qui progresse légèrement
    const upkeep = 0.6 + (n/100)*1.4;

    state.honey = Math.max(0, state.honey + base + bonus - .4);
    state.health = Math.max(0, Math.min(100, state.health + (n-35)*.06 - (f-45)*.035));

    // événements simples
    if(Math.random()<.25){
      const r = Math.random();
      if(r<.34){ pushLog('🌦️ Petite averse : -2 miel'); state.honey = Math.max(0, state.honey-2); }
      else if(r<.66){ pushLog('🌸 Floraison ! +4 miel'); state.honey += 4; }
      else { pushLog('🦠 Maladie évitée grâce aux nourrices'); state.health = Math.min(100, state.health+3); }
    }

    state.day++;
    refresh();
  }
  function refresh(){
    outDay.textContent   = state.day;
    outHoney.textContent = Math.round(state.honey);
    outHealth.textContent= Math.round(state.health);
  }
  function pushLog(msg){
    const p = document.createElement('div'); p.textContent = `Jour ${state.day}: ${msg}`;
    log.prepend(p);
  }

  let loop;
  btnPlay.addEventListener('click', ()=>{
    state.running = !state.running;
    btnPlay.textContent = state.running ? 'Pause' : '▶︎ Jouer';
    btnStep.disabled = state.running;
    if(state.running){
      loop = setInterval(tick, 900);
    }else{
      clearInterval(loop);
    }
  });
  btnStep.addEventListener('click', tick);
  btnReset.addEventListener('click', ()=>{
    clearInterval(loop); state.running=false; btnPlay.textContent='▶︎ Jouer'; btnStep.disabled=false;
    state.day=1; state.honey=0; state.health=100; log.innerHTML='';
    refresh();
  });

  refresh();
})();
</script>
