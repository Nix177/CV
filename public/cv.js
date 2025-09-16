<script>
(function(){
  const modeSel = document.getElementById("viewMode");
  const area    = document.getElementById("cvArea");
  const printBtn= document.getElementById("printBtn");
  const lang = document.documentElement.lang || "fr";
  const L = {
    fr:{ ask:"Entrer le code pour accéder au PDF :", bad:"Code invalide.", dl:"Télécharger le PDF" },
    en:{ ask:"Enter the code to access the PDF:",    bad:"Invalid code.",   dl:"Download PDF" },
    de:{ ask:"Code für den PDF-Zugriff eingeben:",   bad:"Ungültiger Code.",dl:"PDF herunterladen" }
  }[lang] || L_fr;

  function renderPDFLocked(){
    area.innerHTML = `<form id="cvGate" class="stack" style="max-width:420px">
        <label>${L.ask}<input id="cvCode" type="password" autocomplete="off"></label>
        <button class="btn primary" data-busy>${L.dl}</button>
      </form>
      <p class="muted">${lang==="fr"?"Les autres vues restent accessibles ci-dessous.":"Other views remain available."}</p>`;
    const form = document.getElementById("cvGate");
    form.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const btn = form.querySelector("[data-busy]"); window.UI.setBusy(btn,true);
      try{
        const code = document.getElementById("cvCode").value.trim();
        const r = await fetch("/api/verify?code="+encodeURIComponent(code));
        const { ok } = await r.json();
        if(!ok) return alert(L.bad);
        sessionStorage.setItem("CV_CODE", code);
        const a=document.createElement("a"); a.href="/api/cv?code="+encodeURIComponent(code); a.click();
      } finally { window.UI.setBusy(btn,false); }
    });
  }

  function renderConstellation(){
    area.innerHTML = `<canvas id="cvCanvas" class="cv-canvas"></canvas>
                      <div class="muted" style="margin-top:8px">${lang==='fr'?'Survolez un nœud':'Hover a node'}</div>`;
    const DATA = (window.CV_I18N||{} )[lang] || (window.CV_I18N||{} ).fr;
    const canvas = document.getElementById("cvCanvas"), ctx = canvas.getContext("2d");
    function resize(){ canvas.width=area.clientWidth; canvas.height=540; } resize(); addEventListener("resize", resize);

    const R = 220, cx = canvas.width/2, cy = canvas.height/2;
    const nodes = DATA.skills.map((s,i)=>{ const a=(i/DATA.skills.length)*Math.PI*2; const r=R-(s.weight*16); return {...s,x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)}; });

    function draw(hi){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle="rgba(150,180,255,.35)"; ctx.lineWidth=1.2;
      const links=[["didactique","eval"],["didactique","guidage"],["didactique","primaire"],["ia","python"],["ia","web"],["ia","moodle"],["critique","ia"],["primaire","com"],["eval","com"]];
      links.forEach(([a,b])=>{ const A=nodes.find(n=>n.id===a), B=nodes.find(n=>n.id===b); if(!A||!B) return; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke(); });
      nodes.forEach(n=>{ const r=8+n.weight*2; const H=hi&&hi.id===n.id; ctx.beginPath(); ctx.fillStyle=H?"#00c2ff":"rgba(255,255,255,.85)"; ctx.arc(n.x,n.y,r,0,Math.PI*2); ctx.fill();
        ctx.font="700 14px Inter"; ctx.fillStyle=H?"#00c2ff":"rgba(220,235,255,.85)"; ctx.textAlign="center"; ctx.fillText(n.label,n.x,n.y-r-8); });
    } draw(null);

    canvas.addEventListener("mousemove",(e)=>{ const b=canvas.getBoundingClientRect(), mx=e.clientX-b.left, my=e.clientY-b.top;
      draw(nodes.find(n=>Math.hypot(n.x-mx,n.y-my)<14)||null); });
  }

  function renderStory(){
    const DATA = (window.CV_I18N||{} )[lang] || (window.CV_I18N||{} ).fr;
    let i=0;
    area.innerHTML = `<div class="story" id="story"></div>
      <div class="buttons" style="justify-content:center;margin-top:10px">
        <button id="prev" class="btn">◀ ${lang==='fr'?'Précédent':lang==='de'?'Zurück':'Prev'}</button>
        <button id="next" class="btn primary">${lang==='fr'?'Suivant':lang==='de'?'Weiter':'Next'} ▶</button>
      </div>`;
    const box = document.getElementById("story");
    const draw=()=>{ box.innerHTML=`<div class="card-step"><h4>${DATA.steps[i].title}</h4><p>${DATA.steps[i].body}</p></div>
                                     <div class="card-step"><h4>${lang==='fr'?'Évidence':lang==='de'?'Belege':'Evidence'}</h4>
                                     <p>${lang==='fr'?'Exemples, captures, extraits.':'Examples, screenshots, snippets.'}</p></div>`; };
    draw(); document.getElementById("prev").onclick=()=>{ i=(i-1+DATA.steps.length)%DATA.steps.length; draw(); };
           document.getElementById("next").onclick=()=>{ i=(i+1)%DATA.steps.length; draw(); };
  }

  function render(){
    const v = modeSel.value;
    if(v==='pdf') renderPDFLocked();
    else if(v==='constellation') renderConstellation();
    else renderStory();
  }
  modeSel.addEventListener("change", render);
  printBtn.addEventListener("click", ()=>window.print());
  render();
})();
</script>
