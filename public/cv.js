(function(){
  const modeSel = document.getElementById("viewMode");
  const area = document.getElementById("cvArea");
  const printBtn = document.getElementById("printBtn");

  function renderPDF() {
    area.innerHTML = `
      <iframe title="CV PDF" style="width:100%;height:80vh;border:0;background:#111"
        src="./CV_Nicolas_Tuor.pdf#view=FitH"></iframe>
    `;
  }

  function renderConstellation() {
    area.innerHTML = `<canvas id="cvCanvas" class="cv-canvas"></canvas><div id="hint" class="muted" style="margin-top:8px">Survolez un nœud</div>`;
    const canvas = document.getElementById("cvCanvas");
    const ctx = canvas.getContext("2d");
    function resize(){ canvas.width=area.clientWidth; canvas.height=540; }
    resize(); window.addEventListener("resize", resize);

    // positionnement radial
    const R = 220, cx = canvas.width/2, cy = canvas.height/2;
    const nodes = CV_SKILLS.map((s,i) => {
      const a = (i / CV_SKILLS.length) * Math.PI*2;
      const r = R - (s.weight*16);
      return { ...s, x: cx + r*Math.cos(a), y: cy + r*Math.sin(a) };
    });

    function draw(highlight) {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      // liens
      ctx.strokeStyle = "rgba(150,180,255,.35)"; ctx.lineWidth = 1.2;
      CV_LINKS.forEach(([a,b])=>{
        const na = nodes.find(n=>n.id===a), nb = nodes.find(n=>n.id===b);
        if(!na||!nb) return;
        ctx.beginPath(); ctx.moveTo(na.x,na.y); ctx.lineTo(nb.x,nb.y); ctx.stroke();
      });
      // nœuds
      nodes.forEach(n=>{
        const r = 8 + n.weight*2;
        const isH = highlight && highlight.id===n.id;
        ctx.beginPath();
        ctx.fillStyle = isH ? "#00c2ff" : "rgba(255,255,255,.85)";
        ctx.globalAlpha = 1;
        ctx.arc(n.x,n.y,r,0,Math.PI*2);
        ctx.fill();
        ctx.font = (isH? "700":"600")+" 14px Inter,ui-sans-serif";
        ctx.fillStyle = isH ? "#00c2ff" : "rgba(220,235,255,.85)";
        ctx.textAlign="center"; ctx.fillText(n.label, n.x, n.y - r - 8);
      });
    }
    draw(null);

    // interaction
    const hint = document.getElementById("hint");
    canvas.addEventListener("mousemove", (e)=>{
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = nodes.find(n => Math.hypot(n.x-mx, n.y-my) < 14);
      draw(hit||null);
      hint.textContent = hit ? `${hit.label} — groupe: ${hit.group}` : "Survolez un nœud";
    });
  }

  function renderStory() {
    area.innerHTML = `
      <div class="story" id="story"></div>
      <div class="buttons" style="justify-content:center;margin-top:10px">
        <button class="btn" id="prevStep">◀ Précédent</button>
        <button class="btn primary" id="nextStep">Suivant ▶</button>
      </div>
    `;
    const wrap = document.getElementById("story");
    let idx = 0;
    function draw(){
      wrap.innerHTML = `
        <div class="card-step"><h4>${CV_STEPS[idx].title}</h4><p>${CV_STEPS[idx].body}</p></div>
        <div class="card-step"><h4>Evidence</h4><p>Exemples d'élèves, captures, extraits de code, grilles d'évaluation.</p></div>
      `;
    }
    draw();
    document.getElementById("prevStep").onclick = ()=>{ idx = (idx-1+CV_STEPS.length)%CV_STEPS.length; draw(); };
    document.getElementById("nextStep").onclick = ()=>{ idx = (idx+1)%CV_STEPS.length; draw(); };
  }

  function render() {
    const m = modeSel.value;
    if (m === "pdf") renderPDF();
    else if (m === "constellation") renderConstellation();
    else renderStory();
  }

  modeSel.addEventListener("change", render);
  printBtn.addEventListener("click", ()=>window.print());
  render(); // init
})();
