(function(){
  const modeSel = document.getElementById("viewMode");
  const area = document.getElementById("cvArea");
  const printBtn = document.getElementById("printBtn");
  const lang = document.documentElement.lang || "fr";
  const DATA = CV_I18N[lang] || CV_I18N.fr;

  function renderPDF() {
    area.innerHTML = `<iframe title="CV PDF" style="width:100%;height:80vh;border:0;background:#111" src="./CV_Nicolas_Tuor.pdf#view=FitH"></iframe>`;
  }

  function renderConstellation() {
    area.innerHTML = `<canvas id="cvCanvas" class="cv-canvas"></canvas><div id="hint" class="muted" style="margin-top:8px">${lang==='fr'?'Survolez un nœud':'Hover a node'}</div>`;
    const canvas = document.getElementById("cvCanvas"); const ctx = canvas.getContext("2d");
    function resize(){ canvas.width=area.clientWidth; canvas.height=540; } resize(); window.addEventListener("resize", resize);

    const R = 220, cx = canvas.width/2, cy = canvas.height/2;
    const nodes = DATA.skills.map((s,i)=>{ const a=(i/DATA.skills.length)*Math.PI*2; const r=R-(s.weight*16); return {...s,x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)}; });

    function draw(highlight){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle="rgba(150,180,255,.35)"; ctx.lineWidth=1.2;
      const links=[["didactique","eval"],["didactique","guidage"],["didactique","primaire"],["ia","python"],["ia","web"],["ia","moodle"],["critique","ia"],["primaire","com"],["eval","com"]];
      links.forEach(([a,b])=>{ const na=nodes.find(n=>n.id===a), nb=nodes.find(n=>n.id===b); if(!na||!nb) return; ctx.beginPath(); ctx.moveTo(na.x,na.y); ctx.lineTo(nb.x,nb.y); ctx.stroke(); });
      nodes.forEach(n=>{ const r=8+n.weight*2; const isH=highlight&&highlight.id===n.id; ctx.beginPath(); ctx.fillStyle=isH?"#00c2ff":"rgba(255,255,255,.85)"; ctx.arc(n.x,n.y,r,0,Math.PI*2); ctx.fill();
        ctx.font=(isH?"700":"700")+" 14px Inter"; ctx.fillStyle=isH?"#00c2ff":"rgba(220,235,255,.85)"; ctx.textAlign="center"; ctx.fillText(n.label,n.x,n.y-r-8); });
    }
    draw(null);
    const hint=document.getElementById("hint");
    canvas.addEventListener("mousemove",(e)=>{ const rect=canvas.getBoundingClientRect(); const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      const hit=nodes.find(n=>Math.hypot(n.x-mx,n.y-my)<14); draw(hit||null); hint.textContent=hit?`${hit.label}`:(lang==='fr'?'Survolez un nœud':'Hover a node'); });
  }

  function renderStory() {
    area.innerHTML = `<div class="story" id="story"></div>
      <div class="buttons" style="justify-content:center;margin-top:10px">
        <button class="btn" id="prevStep">◀ ${lang==='fr'?'Précédent':'Prev'}</button>
        <button class="btn primary" id="nextStep">${lang==='fr'?'Suivant':'Next'} ▶</button>
      </div>`;
    const wrap=document.getElementById("story"); let idx=0;
    function draw(){ wrap.innerHTML=`<div class="card-step"><h4>${DATA.steps[idx].title}</h4><p>${DATA.steps[idx].body}</p></div>
      <div class="card-step"><h4>${lang==='fr'?'Évidence':'Evidence'}</h4><p>${lang==='fr'?'Exemples d\'élèves, captures, extraits de code, grilles d\'évaluation.':'Student examples, screenshots, code snippets, rubrics.'}</p></div>`; }
    draw(); document.getElementById("prevStep").onclick=()=>{idx=(idx-1+DATA.steps.length)%DATA.steps.length;draw();};
    document.getElementById("nextStep").onclick=()=>{idx=(idx+1)%DATA.steps.length;draw();};
  }

  function render(){ const m=modeSel.value; if(m==='pdf')renderPDF(); else if(m==='constellation')renderConstellation(); else renderStory(); }
  modeSel.addEventListener('change',render); printBtn.addEventListener('click',()=>window.print()); render();
})();
