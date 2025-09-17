(function(){
  "use strict";
  const LANG=(document.documentElement.lang||"fr").slice(0,2).toLowerCase();
  const T={fr:{preview:"Aperçu",visit:"Visiter",close:"Fermer",blocked:"Ce site refuse l’aperçu embarqué."},
           en:{preview:"Preview",visit:"Visit",close:"Close",blocked:"This site denies embedding."},
           de:{preview:"Vorschau",visit:"Besuchen",close:"Schließen",blocked:"Diese Seite untersagt Einbettung."}}[LANG]||T.fr;
  const $=(s,r=document)=>r.querySelector(s);
  const el=(t,a={},kids=[])=>{const e=document.createElement(t);for(const[k,v]of Object.entries(a)){if(k==="class")e.className=v;else if(k==="text")e.textContent=v;else if(k.startsWith("on")&&typeof v==="function")e.addEventListener(k.slice(2),v);else e.setAttribute(k,v)}for(const k of[].concat(kids))e.appendChild(typeof k==="string"?document.createTextNode(k):k);return e};

  function getData(){
    return (Array.isArray(window.portfolioData)&&window.portfolioData)
        || (window.PORTFOLIO&&Array.isArray(window.PORTFOLIO.items)&&window.PORTFOLIO.items)
        || (Array.isArray(window.PORTFOLIO)&&window.PORTFOLIO)
        || (Array.isArray(window.PORTFOLIO_ITEMS)&&window.PORTFOLIO_ITEMS)
        || [];
  }

  function card(it){
    const title=it.title||it.name||"Untitled";
    const desc =it.description||it.desc||"";
    const url  =it.url||it.link||"";
    const tags =Array.isArray(it.tags)?it.tags:[];
    const btnPrev=el("button",{class:"btn",onClick:()=>openOverlay(url,title)},[T.preview]);
    const btnGo  =el("button",{class:"btn",onClick:()=>url&&window.open(url,"_blank","noopener")},[T.visit]);

    return el("div",{class:"card"},[
      el("div",{style:"display:flex;gap:12px;align-items:center"},[
        el("div",{},[ el("h3",{text:title,style:"margin:.2rem 0"}), el("p",{text:desc,style:"margin:.2rem 0;opacity:.9"}) ])
      ]),
      tags.length?el("div",{style:"display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"},tags.map(t=>el("span",{class:"badge",text:t}))):null,
      el("div",{style:"display:flex;gap:10px;margin-top:10px"},[btnPrev,btnGo])
    ]);
  }

  function render(){
    const grid=$("#portfolioGrid"); if(!grid) return;
    const data=getData(); grid.innerHTML="";
    if(!data.length){ grid.appendChild(el("p",{class:"muted",text:"— (aucun élément)"})); return; }
    const f=document.createDocumentFragment(); data.forEach(x=>f.appendChild(card(x))); grid.appendChild(f);
  }

  let blockMsg=null;
  function openOverlay(url,title){
    const overlay=$("#overlay"), frame=$("#overlayFrame"), close=$("#overlayClose"), h=$("#ovlTitle");
    if(!overlay||!frame||!close||!url) return;
    if(h) h.textContent=title||"Aperçu";
    frame.removeAttribute("src");
    if(!blockMsg){ blockMsg=el("div",{class:"muted",style:"position:absolute;top:50px;left:12px;right:12px;display:none;color:#fff"}); overlay.querySelector(".panel").appendChild(blockMsg); }
    blockMsg.style.display="none"; blockMsg.textContent="";
    frame.setAttribute("sandbox","allow-scripts allow-popups");
    overlay.style.display="flex"; document.body.style.overflow="hidden"; frame.src=url;

    const ticket=Symbol("probe"); frame.dataset.ticket=String(ticket);
    setTimeout(()=>{ if(frame.dataset.ticket!==String(ticket))return; try{const d=frame.contentDocument;if(!d||d.location.href==="about:blank")throw 0;}catch{blockMsg.textContent=T.blocked+" ➜ "+(LANG==="fr"?"Utilisez « Visiter ».":LANG==="de"?"Bitte «Besuchen» nutzen.":"Use “Visit”."); blockMsg.style.display="block";}},1200);

    close.addEventListener("click",closeOverlay,{once:true});
    overlay.addEventListener("click",e=>{if(e.target===overlay)closeOverlay();},{once:true});
    document.addEventListener("keydown",e=>e.key==="Escape"&&closeOverlay(),{once:true});
  }
  function closeOverlay(){ const o=$("#overlay"), f=$("#overlayFrame"); if(o)o.style.display="none"; if(f)f.removeAttribute("src"); document.body.style.overflow=""; }

  document.addEventListener("DOMContentLoaded",()=>{ render(); });
})();
