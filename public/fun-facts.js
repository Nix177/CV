/* Fun Facts (FR) — IA + fallback local, rendu ludique, sources cliquables */
(function () {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);
  const el = (t,a={},kids=[])=>{const e=document.createElement(t);
    for(const[k,v] of Object.entries(a||{})){ if(k==="class")e.className=v; else if(k==="text")e.textContent=v;
      else if(k.startsWith("on")&&typeof v==="function") e.addEventListener(k.slice(2),v); else e.setAttribute(k,v); }
    for(const c of[].concat(kids)) e.appendChild(typeof c==="string"?document.createTextNode(c):c);
    return e;
  };
  const status = $("#ffStatus");
  const grid = $("#factsGrid");

  function setStatus(t){ if(status) status.textContent=t||""; }

  function normalize(list){
    return (list||[]).map(it=>{
      const kind=(it.kind||it.type||"fact").toLowerCase();
      const title=it.title||it.claim||"";
      const summary=it.summary||it.truth||it.explain||"";
      const tag=it.tag||it.category||"";
      const sources=Array.isArray(it.sources)? it.sources.map(s=>typeof s==="string"?{title:s,url:s}:{title:s.title||s.name||"↗",url:s.url||""}).filter(s=>!!s.url) : [];
      return {kind,title,summary,tag,sources};
    }).filter(x=>x.title && x.summary);
  }

  function card(item){
    const head = el("div",{},[
      el("h3",{text:(item.kind==="myth"?"❓ ":"⭐ ")+item.title}),
      item.tag ? el("span",{class:"badge",text:item.tag}) : null
    ]);
    const face = el("div",{class:"face"},[ head, el("p",{class:"muted",text:"Survolez / touchez pour retourner"} ) ]);
    const back = el("div",{class:"back"},[
      el("p",{text:item.summary}),
      el("div",{class:"sources",style:"margin-top:8px"},[
        el("strong",{text:"Sources : "}),
        ...item.sources.map((s,i)=> el("a",{href:s.url,target:"_blank",rel:"noopener"},[s.title || ("↗ "+(i+1))]))
      ])
    ]);
    const inner = el("div",{class:"inner"},[face,back]);
    return el("div",{class:"card flip"},[inner]);
  }

  function render(list){
    if(!grid) return;
    grid.innerHTML = "";
    if(!list.length){ grid.appendChild(el("p",{class:"muted",text:"— Rien à afficher"})); return; }
    const f=document.createDocumentFragment();
    list.forEach(x=>f.appendChild(card(x)));
    grid.appendChild(f);
  }

  // ---------- IA ----------
  async function askAI(kind="mixed", count=3){
    setStatus("… génération IA");
    const prompts = {
      mixed: `Génère ${count} éléments JSON STRICT sans texte hors JSON.
Chacun: { "kind":"fact|myth", "title":"...", "summary":"...", "tag":"...", "sources":[{"title":"...","url":"https://..."}] }.
Thème: culture générale, éducation, science légère. Toujours fournir 1+ source(s) fiables. Réponds UNIQUEMENT par un tableau JSON.`,
      fact: `Génère 1 "fact" JSON STRICT avec le schéma { "kind":"fact", "title":"...", "summary":"...", "tag":"...", "sources":[{"title":"...","url":"https://..."}] }.`,
      myth: `Génère 1 "myth" JSON STRICT { "kind":"myth", "title":"...", "summary":"(la vérité)", "tag":"...", "sources":[{"title":"...","url":"https://..."}] }.`,
    };
    const question = prompts[kind] || prompts.mixed;
    try{
      const r = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ question, lang:"fr" })
      });
      const j = await r.json().catch(()=>({}));
      const raw = j.answer || "";
      // essaie d'extraire le JSON
      const jsonText = (raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/) || [raw])[0];
      const data = JSON.parse(jsonText);
      const items = Array.isArray(data) ? data : [data];
      const norm = normalize(items);
      if (!norm.length) throw 0;
      render(norm);
      setStatus("ok");
    }catch(e){
      console.warn("AI facts failed, fallback local", e);
      setStatus("IA indisponible — fallback local");
      await loadLocal();
    }
  }

  async function loadLocal(){
    try{
      const r = await fetch("/facts-data.json", { cache:"no-store" });
      const payload = await r.json().catch(()=>[]);
      const arr = Array.isArray(payload) ? payload : (Array.isArray(payload.items) ? payload.items : []);
      // tire 3 au hasard
      const shuffled = arr.sort(()=>Math.random()-0.5).slice(0,3);
      render(normalize(shuffled));
    }catch{
      render([]);
    }
  }

  document.addEventListener("DOMContentLoaded", async ()=>{
    await loadLocal(); // affichage initial (local)
    $("#btnRandomBatch")?.addEventListener("click", ()=> askAI("mixed", 3));
    $("#btnOneFact")?.addEventListener("click", ()=> askAI("fact", 1));
    $("#btnOneMyth")?.addEventListener("click", ()=> askAI("myth", 1));
  });
})();
