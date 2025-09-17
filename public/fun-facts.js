/* Fun Facts (FR) — accepte /facts-data.json sous forme {items:[...]} ou [...] */
(function () {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);
  const el = (t,a={},kids=[])=>{const e=document.createElement(t);for(const[k,v]of Object.entries(a||{})){if(k==="class")e.className=v;else if(k==="text")e.textContent=v;else if(k.startsWith("on")&&typeof v==="function")e.addEventListener(k.slice(2),v);else e.setAttribute(k,v)}for(const c of[].concat(kids))e.appendChild(typeof c==="string"?document.createTextNode(c):c);return e};

  let DATA=[], FILTER="all";

  const L = {
    title:"Fun Facts",
    lead:"Sélection de faits et de mythes. Cliquez une carte pour les sources.",
    filterAll:"Tous", filterFacts:"Faits", filterMyths:"Mythes",
    sources:"Sources", empty:"Aucun élément à afficher."
  };

  function coerceArray(x){ if(!x) return []; if(Array.isArray(x)) return x; if(Array.isArray(x.items)) return x.items; return [] }
  function normalize(raw){
    return coerceArray(raw).map(it=>{
      const kind=(it.kind||it.type||"fact").toString().toLowerCase();
      const title=it.title||it.claim||"";
      const summary=it.summary||it.truth||it.explain||it.text||"";
      const tag=it.tag||it.category||it.domain||"";
      const score=typeof it.score==="number"?it.score:(typeof it.wow_rating==="number"?it.wow_rating:null);
      const sources=Array.isArray(it.sources)?it.sources.map(s=>typeof s==="string"?{title:s,url:s}:{title:s.title||s.name||"↗",url:s.url||""}).filter(s=>!!s.url):[];
      return {kind,title,summary,claim:it.claim||"",tag,score,sources};
    }).filter(x=>x.title&&x.summary);
  }

  function badge(t){return el("span",{class:"badge",text:t})}
  function card(it){
    const head=el("div",{},[
      el("h3",{text:(it.kind==="myth"?"❓ ":"⭐ ")+it.title}),
      it.tag?badge(it.tag):null,
      it.score!=null?badge("★ "+it.score.toFixed(2)):null,
    ]);
    const body=el("div",{},[
      it.claim?el("p",{class:"muted",text:"• Affirmation : "+it.claim}):null,
      el("p",{text:it.summary}),
      el("div",{class:"muted",style:"margin-top:6px"},[
        el("strong",{text:L.sources+" : "}),
        ...it.sources.map((s,i)=>el("a",{href:s.url,target:"_blank",rel:"noopener",style:"margin-right:10px"},[s.title||("↗ "+(i+1))]))
      ])
    ]);
    const card=el("div",{class:"q-item",role:"article"},[head,body]);
    return card;
  }

  function render(){
    const root=$("#factsGrid"); if(!root) return;
    root.innerHTML="";
    const list=FILTER==="all"?DATA:DATA.filter(x=>FILTER==="fact"?x.kind==="fact":x.kind==="myth");
    if(!list.length){ root.appendChild(el("p",{class:"muted",text:L.empty})); return; }
    const f=document.createDocumentFragment(); list.forEach(x=>f.appendChild(card(x))); root.appendChild(f);
  }

  function renderFilters(){
    const bar=$("#factsFilters"); if(!bar) return;
    const mk=(key,label)=>el("button",{class:"btn",type:"button",onClick:()=>{FILTER=key;render();markActive();}},[label]);
    bar.innerHTML=""; bar.appendChild(el("div",{class:"filters"},[mk("all",L.filterAll),mk("fact",L.filterFacts),mk("myth",L.filterMyths)]));
    function markActive(){ bar.querySelectorAll("button").forEach(b=>b.classList.remove("primary")); const idx=FILTER==="all"?0: FILTER==="fact"?1:2; const btn=bar.querySelectorAll("button")[idx]; if(btn) btn.classList.add("primary"); }
    markActive();
  }

  document.addEventListener("DOMContentLoaded", async ()=>{
    try{
      const r=await fetch("/facts-data.json",{cache:"no-store"});
      DATA=normalize(await r.json());
    }catch(e){ console.error("facts load error",e); DATA=[]; }
    $("#factsLead") && ($("#factsLead").textContent=L.lead);
    renderFilters(); render();
  });
})();
