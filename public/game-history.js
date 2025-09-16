/* Histoire Aventure — Platformer IA
   - Un appel à /api/history-seed pour générer titre/intro/questions (fallback intégré si API indisponible).
   - Plateformer canvas simple, 3 portes "quiz" à franchir.
   - Physique légère, parallax, HUD, overlay QCM avec explication.
*/
(function(){
  const C = {
    W: 1280, H: 720,
    G: 0.7, MOVE: 0.9, JUMP: 15,
    FRICT: 0.86,
    MAXVX: 8, MAXVY: 22,
    COIN_N: 12
  };

  const S = {
    playing: false,
    paused: false,
    title: "—",
    intro: "",
    facts: [],
    gates: [],   // {x,y,w,h, idx, open}
    coins: [],   // {x,y,r,got}
    plats: [],   // {x,y,w,h}
    bgHue: 210,
    score: 0,
    gatesOpen: 0,
    lives: 3,
    lang: "fr"
  };

  // DOM
  const canvas = document.getElementById("gh_canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const form = document.getElementById("gh_form");
  const statusEl = document.getElementById("gh_status");
  const hudTitle = document.getElementById("hud_title");
  const hudScore = document.getElementById("hud_score");
  const hudGate = document.getElementById("hud_gate");
  const hudLife = document.getElementById("hud_life");
  const badges = document.getElementById("gh_badges");
  const introEl = document.getElementById("gh_intro");

  // Overlay QCM
  const overlay = document.getElementById("gh_overlay");
  const qTitle = document.getElementById("q_title");
  const qText = document.getElementById("q_text");
  const qChoices = document.getElementById("q_choices");
  const qMsg = document.getElementById("q_msg");
  const qExplain = document.getElementById("q_explain");
  const qClose = document.getElementById("q_close");

  const hasUI = typeof window.UI?.setBusy === "function";

  // INPUT
  const keys = { left:false, right:false, up:false };
  window.addEventListener("keydown", e=>{
    if (["ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
    if (e.code === "ArrowLeft") keys.left = true;
    if (e.code === "ArrowRight") keys.right = true;
    if (e.code === "Space") keys.up = true;
    if (e.code === "KeyP") S.paused = !S.paused;
  });
  window.addEventListener("keyup", e=>{
    if (e.code === "ArrowLeft") keys.left = false;
    if (e.code === "ArrowRight") keys.right = false;
    if (e.code === "Space") keys.up = false;
  });

  // PLAYER
  const player = { x:140, y:500, w:36, h:54, vx:0, vy:0, onGround:false };

  // WORLD
  function resetWorld() {
    S.score = 0; S.gatesOpen = 0; S.lives = 3;
    Object.assign(player, { x:140, y:500, vx:0, vy:0, onGround:false });
    // Platforms (simple parcours)
    S.plats = [
      {x:0, y:660, w:1800, h:60},  // sol
      {x:320, y:540, w:200, h:22},
      {x:600, y:480, w:180, h:22},
      {x:860, y:430, w:180, h:22},
      {x:1120,y:570, w:200, h:22},
      {x:1420,y:520, w:220, h:22},
      {x:1720,y:470, w:220, h:22}
    ];
    // Coins
    S.coins = [];
    for (let i=0;i<C.COIN_N;i++){
      S.coins.push({x: 260 + i*120, y: 420 - (i%3)*60, r:10, got:false});
    }
    // Gates (3 portes à passer)
    S.gates = [
      {x: 780, y: 660-120, w: 38, h:120, idx: 0, open:false},
      {x: 1280, y: 660-120, w: 38, h:120, idx: 1, open:false},
      {x: 1750, y: 660-120, w: 38, h:120, idx: 2, open:false}
    ];
  }

  // RENDER helpers
  function drawParallax(camx){
    const grd = ctx.createLinearGradient(0,0,0,C.H);
    grd.addColorStop(0, `hsl(${S.bgHue}, 50%, 12%)`);
    grd.addColorStop(1, `hsl(${S.bgHue}, 35%, 6%)`);
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,C.W,C.H);

    // distant silhouettes
    ctx.save();
    ctx.translate(-camx*0.2, 0);
    ctx.fillStyle = "rgba(255,255,255,.06)";
    for (let i=0;i<12;i++){
      const x = i*300 + 80;
      ctx.fillRect(x, 520, 160, 140);
      ctx.fillRect(x+120, 560, 80, 100);
    }
    ctx.restore();

    // middle layer
    ctx.save();
    ctx.translate(-camx*0.5, 0);
    ctx.fillStyle = "rgba(255,255,255,.08)";
    for (let i=0;i<10;i++){
      ctx.fillRect(i*260+40, 580, 220, 80);
    }
    ctx.restore();
  }

  function drawPlatform(p, camx){
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(Math.floor(p.x - camx), p.y, p.w, p.h);
  }

  function drawGate(g, camx){
    const x = Math.floor(g.x - camx), y = g.y;
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle = g.open ? "rgba(140,240,167,.9)" : "rgba(255,180,120,.9)";
    // pilier
    ctx.fillRect(0, 0, g.w, g.h);
    // symbole
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(6, 8, g.w-12, 22);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("?", g.w/2, 19);
    ctx.restore();
  }

  function drawCoin(c, camx){
    if (c.got) return;
    const x = Math.floor(c.x - camx), y = c.y;
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle = "#ffd12b";
    ctx.beginPath();
    ctx.arc(0,0,c.r,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(camx){
    const x = Math.floor(player.x - camx), y = player.y;
    ctx.save();
    ctx.translate(x,y);
    // ombre
    ctx.fillStyle = "rgba(0,0,0,.35)";
