/* Fun Facts — FR — cartes + nuage lisible */
(function () {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);
  const el = (t,a={},kids=[])=>{const e=document.createElement(t);
    for(const[k,v] of Object.entries(a||{})){
      if(k==="class")e.className=v;
      else if(k==="text")e.textContent=v;
      else if(k.startsWith("on")&&typeof v==="function")e.addEventListener(k.slice(2),v);
      else e.setAttribute(k,v);
    }
    for(const c of[].concat(kids)) if(c!=null) e.appendChild(typeof c==="string"?document.createTextNode(c):c);
    return e;
  };
  const status = $("#ffStatus");
  const grid = $("#factsGrid");
  const cloud = $("#factsCloud");

  const STOP = new Set("le la les un une des du de d’ d' et ou en au aux avec pour par dans sur sous entre vers chez comme selon que qui quoi est sont était étaient peut peuvent".split(/\s+/));

  function setStatus(t){ if(status) status.textContent=t||""; }

  // ---------- Normalisation
  function normalize(list){
    return (list||[]).map(it=>{
      const kind=(it.kind||it.type||"fact").toLowerCase();
      const title=String(it.title||it.claim||"").trim();
      const summary=String(it.summary||it.truth||it.explain||"").trim();
      const tag=String(it.tag||it.category||"").trim();
      const sources=Array.isArray(it.sources)? it.sources.map(s=>typeof s==="string"?{title:s,url:s}:{title:s.title||s.name||"↗",url:s.url||""}).filter(s=>!!s.url) : [];
      return {kind,title,summary,tag,sources};
    }).filter(x=>x.title && x.summary);
  }

  // ---------- Cartes recto/verso
  function card(item){
    const head = el("div",{},[
      el("h3",{text:(item.kind==="myth"?"❓ ":"⭐ ")+item.title}),
      item.tag ? el("span",{class:"badge",text:item.tag}) : null
    ]);
    const face = el("div",{class:"face"},[ head, el("p",{class:"muted",text:"Survolez / touchez pour retourner"}) ]);
    const back = el("div",{class:"back"},[
      el("p",{text:item.summary}),
      el("div",{class:"sources"},[
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
    const data = normalize(list);
    if(!data.length){ grid.appendChild(el("p",{class:"muted",text:"— Rien à afficher"})); return; }
    const f=document.createDocumentFragment();
    data.forEach(x=>f.appendChild(card(x)));
    grid.appendChild(f);
  }

  // ---------- IA
  async function askAI(kind="mixed", count=3){
    setStatus("… génération IA");
    const prompts = {
      mixed: `Génère ${count} éléments JSON STRICT, rien d'autre que du JSON.
Chaque item: { "kind":"fact|myth", "title":"court", "summary":"expliqué en 2-3 phrases", "tag":"mot-clé", "sources":[{"title":"...","url":"https://..."}] }.
Thème: culture générale/éducation/sciences. Sources fiables. Réponds UNIQUEMENT avec un tableau JSON.`,
      fact: `Génère 1 JSON STRICT pour un "fact" (structure identique).`,
      myth: `Génère 1 JSON STRICT pour un "myth" (summary corrige le mythe).`
    };
    const question = prompts[kind] || prompts.mixed;
    try{
      const r = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ question, lang:"fr" })
      });
      const j = await r.json().catch(()=>({}));
      const raw = j.answer || "";
      const jsonText = (raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/) || [raw])[0];
      const data = JSON.parse(jsonText);
      const items = Array.isArray(data) ? data : [data];
      const norm = normalize(items);
      if (!norm.length) throw 0;
      render(norm);
      setStatus("ok");
      FACTS_CACHE = norm.concat(FACTS_CACHE).slice(0, 80);
      buildCloudSample();
    }catch(e){
      console.warn("AI facts failed, fallback", e);
      setStatus("IA indisponible — fallback local");
      const three = (await loadLocalAll()).sort(()=>Math.random()-0.5).slice(0,3);
      render(three);
    }
  }

  // ---------- Local
  let FACTS_CACHE = [];
  async function loadLocalAll(){
    try{
      const r = await fetch("/facts-data.json", { cache:"no-store" });
      const payload = await r.json().catch(()=>[]);
      const arr = Array.isArray(payload) ? payload : (Array.isArray(payload.items) ? payload.items : []);
      const norm = normalize(arr);
      FACTS_CACHE = FACTS_CACHE.length ? FACTS_CACHE : norm.slice();
      return norm;
    }catch{ return []; }
  }

  // ---------- Helpers nuage
  function keyword(item){
    if (item.tag) return item.tag;
    const words = (item.title||"")
      .replace(/[^\p{L}\p{N}\s'-]/gu," ")
      .split(/\s+/)
      .filter(w=>w && w.length>=4 && !STOP.has(w.toLowerCase()));
    return (words[0] || (item.title||"").split(/\s+/)[0] || "Info").slice(0,18);
  }
  function shorten(s,n){ s=String(s||""); return s.length>n? s.slice(0,n-1)+"…" : s; }

  // ---------- Nuage de bulles (lisible)
  function buildCloudSample(){
    if(!cloud) return;
    cloud.innerHTML = "";
    const src = FACTS_CACHE.length ? FACTS_CACHE : [];
    const pick = src.slice().sort(()=>Math.random()-0.5).slice(0, 16); // 16 bulles

    const w = cloud.clientWidth, h = cloud.clientHeight;
    pick.forEach((it)=>{
      const size = Math.floor(90 + Math.random()*60);     // 90–150px
      const fs = Math.max(12, Math.min(18, Math.round(size*0.16)));
      const x = Math.max(6, Math.floor(Math.random()*(w - size - 6)));
      const y = Math.max(6, Math.floor(Math.random()*(h - size - 6)));
      const dx = (Math.random()<.5?-1:1)*Math.floor(12 + Math.random()*40);
      const dy = (Math.random()<.5?-1:1)*Math.floor(10 + Math.random()*28);
      const dur = (12 + Math.random()*10).toFixed(1)+"s";
      const label = (it.kind==="myth"?"❓ ":"⭐ ") + keyword(it);

      const b = el("div",{class:"bubble",
        style:`left:${x}px;top:${y}px;width:${size}px;height:${size}px;--dx:${dx}px;--dy:${dy}px;animation-duration:${dur};--fs:${fs}px`},[
        el("div",{class:"title",text: label }),
        el("div",{class:"details"},[
          el("div",{text: shorten(it.title, 120)}),
          el("div",{style:"margin:.35rem 0", text: it.summary }),
          el("div",{class:"sources"},[
            el("strong",{text:"Sources : "}),
            ...it.sources.slice(0,2).map((s,i)=> el("a",{href:s.url,target:"_blank",rel:"noopener"},[s.title || ("↗ "+(i+1))]))
          ])
        ])
      ]);

      // Survol : premier plan (pause gérée en CSS)
      b.addEventListener("mouseenter", ()=> b.style.zIndex = 30);
      b.addEventListener("mouseleave", ()=> b.style.zIndex = "");

      cloud.appendChild(b);
    });
  }

  // ---------- Bootstrap
  document.addEventListener("DOMContentLoaded", async ()=>{
    const all = await loadLocalAll();
    render(all.sort(()=>Math.random()-0.5).slice(0,3));
    buildCloudSample();

    $("#btnRandomBatch")?.addEventListener("click", ()=> askAI("mixed",3));
    $("#btnOneFact")?.addEventListener("click", ()=> askAI("fact",1));
    $("#btnOneMyth")?.addEventListener("click", ()=> askAI("myth",1));
    $("#cloudShuffle")?.addEventListener("click", buildCloudSample);

    let raf=null;
    window.addEventListener("resize", ()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(buildCloudSample); });
  });
})();
