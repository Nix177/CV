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
    ctx.fillRect(-6, player.h-2, player.w+12, 6);
    // corps
    ctx.fillStyle = "hsl(200,90%,60%)";
    ctx.fillRect(0,0,player.w,player.h);
    // yeux
    ctx.fillStyle = "#001928";
    ctx.fillRect(8,12,6,6);
    ctx.fillRect(player.w-14,12,6,6);
    ctx.restore();
  }

  // PHYSICS & COLLISIONS
  function aabb(a,b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function stepPhysics(){
    // input
    if (keys.left) player.vx -= C.MOVE;
    if (keys.right) player.vx += C.MOVE;
    if (player.onGround && keys.up){ player.vy = -C.JUMP; player.onGround = false; }

    // clamp
    player.vx = Math.max(-C.MAXVX, Math.min(C.MAXVX, player.vx));
    player.vy = Math.max(-C.MAXVY, Math.min(C.MAXVY, player.vy));

    // apply
    player.vy += C.G;
    player.x += player.vx;
    player.y += player.vy;
    player.vx *= C.FRICT;

    // collide with platforms
    player.onGround = false;
    for (const p of S.plats){
      // vertical
      if (player.x + player.w > p.x && player.x < p.x+p.w){
        // falling onto
        if (player.y + player.h > p.y && player.y + player.h - player.vy <= p.y){
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        }
        // hitting from below
        if (player.y < p.y + p.h && player.y - player.vy >= p.y + p.h){
          player.y = p.y + p.h;
          player.vy = 0.2;
        }
      }
      // horizontal
      if (player.y + player.h > p.y && player.y < p.y + p.h){
        if (player.x + player.w > p.x && player.x < p.x){
          player.x = p.x - player.w; player.vx = 0;
        } else if (player.x < p.x+p.w && player.x + player.w > p.x+p.w){
          player.x = p.x + p.w; player.vx = 0;
        }
      }
    }

    // coins
    for (const c of S.coins){
      if (!c.got){
        const dx = (player.x + player.w/2) - c.x;
        const dy = (player.y + player.h/2) - c.y;
        if (dx*dx + dy*dy < (player.w/2 + c.r)*(player.w/2 + c.r)){
          c.got = true;
          S.score += 10;
        }
      }
    }

    // gates
    for (const g of S.gates){
      if (g.open) continue;
      const boxP = { x:player.x, y:player.y, w:player.w, h:player.h };
      const boxG = { x:g.x-10, y:g.y, w:g.w+20, h:g.h };
      if (aabb(boxP, boxG)){
        // Freeze & ask
        askQuestion(g);
        break;
      }
    }

    // fall out
    if (player.y > C.H + 100){
      S.lives -= 1;
      if (S.lives <= 0){
        // reset full
        resetWorld();
      } else {
        // respawn on safe platform
        Object.assign(player, {x: 140, y: 500, vx:0, vy:0, onGround:false});
      }
    }
  }

  // CAMERA
  function cameraX(){
    const center = player.x - C.W/2 + player.w/2;
    return Math.max(0, Math.min(center, 1800 - C.W + 100)); // clamp world width
  }

  // LOOP
  function loop(){
    if (!S.playing) return;
    if (!S.paused) stepPhysics();

    const camx = cameraX();
    // draw
    drawParallax(camx);

    // platforms
    for (const p of S.plats) drawPlatform(p, camx);
    // coins
    for (const c of S.coins) drawCoin(c, camx);
    // gates
    for (const g of S.gates) drawGate(g, camx);
    // player
    drawPlayer(camx);

    // HUD
    hudTitle.textContent = S.title;
    hudScore.textContent = `★ ${S.score}`;
    hudGate.textContent = `Portes: ${S.gatesOpen}/${S.gates.length}`;
    hudLife.textContent = `Vies: ${S.lives}`;

    requestAnimationFrame(loop);
  }

  // QUESTIONS
  function askQuestion(gate){
    S.paused = true;
    overlay.classList.add("show");
    const q = S.facts[gate.idx];
    qTitle.textContent = `Porte ${gate.idx+1} — Quiz`;
    qText.textContent = q?.q || "…";
    qMsg.textContent = "";
    qChoices.innerHTML = "";
    (q?.choices || []).forEach(choice=>{
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = choice;
      b.addEventListener("click", ()=>{
        const ok = (choice === q.answer);
        if (ok){
          qMsg.innerHTML = `<span class="gh-success">✅ Correct</span>`;
          gate.open = true;
          S.gatesOpen = S.gates.filter(x=>x.open).length;
          S.score += 25;
        } else {
          qMsg.innerHTML = `<span class="gh-fail">❌ ${S.lang==="fr"?"Réponse attendue":"Correct answer"}: ${q.answer}</span>`;
          S.lives -= 1;
        }
      });
      qChoices.appendChild(b);
    });

    qExplain.onclick = ()=>{
      qMsg.textContent = q?.explain || (S.lang==="fr" ? "Explication indisponible." : "Explanation unavailable.");
    };
    qClose.onclick = ()=>{
      overlay.classList.remove("show");
      S.paused = false;
    };
  }

  // SEED GENERATION
  async function generateSeed(age, topic, lang){
    try{
      statusEl.textContent = lang==="fr" ? "Génération en cours…" : (lang==="de" ? "Wird erstellt…" : "Generating…");
      const r = await fetch("/api/history-seed", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ age, topic, lang, count: 3 })
      });
      const j = await r.json();
      return j && j.title ? j : fallbackSeed(age, topic, lang);
    }catch(e){
      return fallbackSeed(age, topic, lang);
    } finally {
      statusEl.textContent = "Prêt.";
    }
  }

  function fallbackSeed(age, topic, lang){
    const t = topic || (lang==="fr" ? "Révolution française" : lang==="de" ? "Französische Revolution" : "French Revolution");
    const title = lang==="fr" ? `1789 — ${t}` : (lang==="de" ? `1789 — ${t}` : `1789 — ${t}`);
    const intro = (lang==="fr")
      ? "Vous explorez Paris en 1789. Pour franchir chaque porte, répondez correctement aux questions liées aux événements de la Révolution."
      : (lang==="de")
      ? "Sie erkunden Paris im Jahr 1789. Beantworten Sie die Fragen richtig, um jede Tür zu öffnen."
      : "You explore Paris in 1789. Answer correctly to open each gate.";
    const facts = [
      { q: (lang==="fr"?"Quelle date est associée à la prise de la Bastille ?":"Which date is linked to the Storming of the Bastille?"),
        choices: (lang==="de"?["14. Juli 1789", "4. Juli 1776", "1. Januar 1800"]:(lang==="fr"?["14 juillet 1789","4 juillet 1776","1er janvier 1800"]:["July 14, 1789","July 4, 1776","January 1, 1800"])),
        answer: (lang==="fr"?"14 juillet 1789": lang==="de"?"14. Juli 1789":"July 14, 1789"),
        explain: (lang==="fr"?"La Bastille est prise le 14 juillet 1789, symbole du début de la Révolution.": lang==="de"?"Die Bastille wurde am 14. Juli 1789 gestürmt — Symbol des Revolutionsbeginns.":"The Bastille was stormed on July 14, 1789 — symbol of the Revolution’s start.")
      },
      { q: (lang==="fr"?"Quel texte fondateur est adopté en août 1789 ?":"Which foundational text was adopted in August 1789?"),
        choices: (lang==="de"?["Erklärung der Menschen- und Bürgerrechte","Magna Carta","Code Napoléon"]:(lang==="fr"?["Déclaration des droits de l’homme et du citoyen","Magna Carta","Code Napoléon"]:["Declaration of the Rights of Man and of the Citizen","Magna Carta","Napoleonic Code"])),
        answer: (lang==="fr"?"Déclaration des droits de l’homme et du citoyen": lang==="de"?"Erklärung der Menschen- und Bürgerrechte":"Declaration of the Rights of Man and of the Citizen"),
        explain: (lang==="fr"?"Adoptée en août 1789, elle affirme des libertés et des droits fondamentaux.": lang==="de"?"Im August 1789 verabschiedet, bekräftigt sie Grundrechte und -freiheiten.":"Adopted in August 1789, it asserts fundamental rights and liberties.")
      },
      { q: (lang==="fr"?"Qui était roi de France au début de la Révolution ?":"Who was King of France at the start of the Revolution?"),
        choices: (lang==="de"?["Ludwig XVI","Karl X","Napoleon I"]:(lang==="fr"?["Louis XVI","Charles X","Napoléon Ier"]:["Louis XVI","Charles X","Napoleon I"])),
        answer: (lang==="fr"?"Louis XVI": lang==="de"?"Ludwig XVI":"Louis XVI"),
        explain: (lang==="fr"?"Louis XVI règne jusqu’en 1792 ; la monarchie est ensuite abolie.": lang==="de"?"Ludwig XVI regierte bis 1792; danach wurde die Monarchie abgeschafft.":"Louis XVI reigned until 1792; the monarchy was then abolished.")
      }
    ];
    return { title, intro, facts, badges:[{label:t},{label:`Âge ${age}`} ] };
  }

  // START
  async function startGame(seed){
    S.title = seed.title || "—";
    S.intro = seed.intro || "";
    S.facts = seed.facts || [];
    S.bgHue = 205 + Math.floor(Math.random()*50);
    // badges
    badges.innerHTML = (seed.badges||[]).map(b=>`<span class="gh-badge">🏷️ ${escapeHTML(b.label||"")}</span>`).join("");
    introEl.textContent = seed.intro || "";
    resetWorld();
    S.playing = true; S.paused = false;
    loop();
  }

  // FORM submit
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = form.querySelector("[data-busy]");
    hasUI && UI.setBusy(btn, true);
    try{
      const fd = new FormData(form);
      const age = +(fd.get("age") || 12);
      const topic = (fd.get("topic") || "Révolution française").trim();
      const lang = (fd.get("lang") || "fr");
      S.lang = lang;
      const seed = await generateSeed(age, topic, lang);
      await startGame(seed);
    } finally {
      hasUI && UI.setBusy(btn, false);
    }
  });

  function escapeHTML(s){return (s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
})();
