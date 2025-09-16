/* Beehive Simulator — homepage + vue CV "ruche"
   Débloque un extrait du CV quand la santé est stable. */
(function () {
  const g = {
    ctx: null,
    bees: [],
    nectar: 0,
    health: 50,
    prod: 0,
    def: 0,
    streak: 0,
    running: false,
    unlocked: false,
  };

  function qs(id){ return document.getElementById(id); }

  const canvas = qs("bh_canvas");
  if (!canvas) return; // pas sur cette page
  const ctx = canvas.getContext("2d");
  g.ctx = ctx;

  // UI elems
  const $flowers = qs("bh_flowers");
  const $workers = qs("bh_workers");
  const $guards  = qs("bh_guards");
  const $weather = qs("bh_weather");
  const $start   = qs("bh_start");
  const $step    = qs("bh_step");
  const $status  = qs("bh_status");
  const $health  = qs("bh_health");
  const $prod    = qs("bh_prod");
  const $def     = qs("bh_def");
  const $streak  = qs("bh_streak");
  const $unlock  = qs("bh_unlock");
  const $cvExtract = qs("bh_cvExtract");

  const hasUI = typeof window.UI === "object" && window.UI?.setBusy;

  // Bees
  function resetBees() {
    g.bees = Array.from({length: 60}, () => ({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      a: Math.random()*Math.PI*2,
      s: 1+Math.random()*1.2
    }));
  }

  function stepLogic() {
    const flowers = +$flowers.value;
    const workers = +$workers.value;
    const guards  = +$guards.value;
    const weather = +$weather.value;

    // normalisation
    const tot = workers + guards;
    const W = workers / tot;
    const G = guards  / tot;

    // production : dépend fleurs & workers & météo
    const production = Math.max(0, (flowers/100) * (0.6 + 0.8*W) * (0.6 + 0.8*weather/100));
    // défense : dépend guards et météo (météo mauvaise => plus de menaces)
    const threat = (1 - weather/100) * 0.6 + (1 - flowers/100) * 0.4;
    const defense = Math.max(0, G * (0.7 + 0.6*weather/100)) - threat*0.25;

    // maj métriques
    g.prod = +(production*100).toFixed(1);
    g.def  = +(defense*100).toFixed(1);

    // santé = santé + prod - pènalités défense
    let delta = (production*1.1) - (Math.max(0, threat - defense) * 0.9);
    // ratio équilibré : bonus léger
    const balanceBonus = 1 - Math.abs(W - 0.75); // optimum vers 75% ouvrières
    delta += (balanceBonus - 0.25) * 0.2;

    g.health = Math.max(0, Math.min(100, g.health + delta*6));
    g.nectar = Math.max(0, Math.min(100, g.nectar + production*5));

    // Streak stable si health >= 80
    if (g.health >= 80) g.streak++; else g.streak = Math.max(0, g.streak-1);

    $health.textContent = g.health.toFixed(0);
    $prod.textContent   = g.prod.toFixed(0);
    $def.textContent    = g.def.toFixed(0);
    $streak.textContent = g.streak;

    if (!g.unlocked && g.streak >= 15) {
      g.unlocked = true;
      $unlock.classList.remove("hidden");
      $status.textContent = "Ruche stable !";
      showCvExtract();
    }
  }

  function showCvExtract() {
    // Utilise CV_DATA si dispo, sinon un fallback
    const data = (window.CV_DATA && Array.isArray(window.CV_DATA)) ? window.CV_DATA : [
      { when:"2024–…", what:"Enseignant primaire (remplacements)", where:"FR", tags:["primaire","didactique"] },
      { when:"2022–2023", what:"Stage de master (CRE/ATE)", where:"HEP Fribourg", tags:["didactique","IA","ressources"] },
      { when:"2020–2021", what:"Enseignant 5H", where:"Corminboeuf", tags:["différenciation"] }
    ];

    $cvExtract.innerHTML = data.slice(0,5).map(i => `
      <div class="card pad">
        <div class="muted">${escapeHTML(i.when)} — ${escapeHTML(i.where||"")}</div>
        <strong>${escapeHTML(i.what)}</strong>
        <div class="muted">${(i.tags||[]).map(t=>`#${escapeHTML(t)}`).join(" ")}</div>
      </div>
    `).join("");
  }

  function loopDraw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // fond léger
    ctx.fillStyle = "rgba(255,255,255,.03)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // nectar bar
    ctx.fillStyle = "#2bd4ff";
    ctx.fillRect(0, canvas.height-10, (g.nectar/100)*canvas.width, 10);

    // bees
    for (const b of g.bees) {
      // zigzag
      b.a += (Math.random() - .5) * 0.6;
      b.x += Math.cos(b.a) * b.s*1.8;
      b.y += Math.sin(b.a) * b.s*1.8;

      if (b.x<0) b.x=canvas.width; if (b.x>canvas.width) b.x=0;
      if (b.y<0) b.y=canvas.height; if (b.y>canvas.height) b.y=0;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.fillStyle = "rgba(255,214,10,.9)";
      ctx.beginPath();
      ctx.ellipse(0,0,5,3,0,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    if (g.running) requestAnimationFrame(loopDraw);
  }

  function step() {
    stepLogic();
  }

  function start() {
    g.running = true;
    g.unlocked = false;
    g.streak = 0;
    g.nectar = 20;
    g.health = 55;
    resetBees();
    if (hasUI) UI.setBusy($start, false);
    $status.textContent = "Simulation en cours…";
    loopDraw();
  }

  // events
  $start.addEventListener("click", () => {
    hasUI && UI.setBusy($start, true);
    start();
  });
  $step.addEventListener("click", step);

  // première init
  resetBees();
  loopDraw();

  function escapeHTML(s){return (s||"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));}
})();
