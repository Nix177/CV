/* Fun Facts v4 — cartes + nuage + tooltips
   - Attend le DOM ET document.body
   - Crée <main class="container"> si absent
   - Jamais d'insertBefore sans fallback
*/
(function(){
  "use strict";

  const V = "v4.0";
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const rand = (a,b)=>Math.random()*(b-a)+a;
  const shuffle=(a)=>a.sort(()=>Math.random()-0.5);
  const log = (...x)=>console.log("%c[fun-facts "+V+"]","color:#08c",...x);
  const warn= (...x)=>console.warn("%c[fun-facts "+V+"]","color:#e80",...x);

  const lang = (document.documentElement.lang||"fr").slice(0,2);
  const API = "/api/facts";
  const LOCAL_JSON="/facts-data.json";

  async function domReady(){
    if(document.readyState==="complete"||document.readyState==="interactive"){
      if(document.body) return;
    }
    await new Promise(res=>document.addEventListener("DOMContentLoaded",res,{once:true}));
    // Attendre body si besoin (certains frameworks le créent tard)
    let tries=0;
    while(!document.body && tries<120){ // ~2s max
      await new Promise(r=>setTimeout(r,16));
      tries++;
    }
  }

  function ensureRoot(){
    let root = $(".container") || $("main.container") || $("main") || document.body;
    if(!root){
      // on crée le body si vraiment absent (cas extrême)
      if(!document.body){
        const b=document.createElement("body");
        document.documentElement.appendChild(b);
      }
      root = document.createElement("main");
      root.className = "container";
      document.body.appendChild(root);
      log("→ container fabriqué");
    }
    return root;
  }

  // -------- normalisation sources --------
  const toUrl = (x)=>{ try{ return String(x||"").trim(); } catch{return "";} };
  const label  = (u)=>u?u.replace(/^https?:\/\//,"").slice(0,95):"";
  function oneSrc(s){
    if(!s&&s!==0) return null;
    if(typeof s==="string"){ const href=toUrl(s); if(!href) return null; return {href,label:label(href)}; }
    if(typeof s==="object"){
      const href=toUrl(s.url||s.href||s.link||""); if(!href) return null;
      const l = toUrl(s.label||s.title||s.name||"") || label(href);
      return {href,label:l};
    }
    const href=toUrl(s); if(!href) return null; return {href,label:label(href)};
  }
  function normSources(arr){ if(!arr) return []; if(!Array.isArray(arr)) arr=[arr]; const o=[]; for(const s of arr){ const v=oneSrc(s); if(v&&v.href) o.push(v);} return o; }

  const SEED = [
    { id:"seed:brain10", type:"myth", category:"Science",
      title:"On n’utilise que 10 % de notre cerveau.",
      body:"Faux : l’imagerie cérébrale montre que l’activité varie selon les tâches ; le cerveau fonctionne en réseaux.",
      sources:["https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/"] },
    { id:"seed:honey", type:"fact", category:"Alimentation",
      title:"Le miel peut se conserver des millénaires.",
      body:"Des pots comestibles ont été retrouvés dans des tombes antiques égyptiennes.",
      sources:["https://www.nationalgeographic.com/history/article/131219-ancient-egypt-honey-tombs-beekeeping"] }
  ];

  function normList(list){
    return (list||[]).map((it,i)=>({
      id: it.id || `tmp:${i}:${(it.title||"").slice(0,40)}`,
      type: it.type || "myth",
      category: it.category || "Général",
      title: it.title || (it.type==="fact" ? "Fait" : "Mythe"),
      body: it.body || "",
      sources: normSources(it.sources)
    }));
  }

  async function tryAPI(params){
    try{
      const qs=new URLSearchParams(params||{}).toString();
      const url=`${API}?${qs}`;
      log("Fetch API:",url);
      const r=await fetch(url,{headers:{"x-ff":"1"}});
      if(!r.ok) throw new Error("API "+r.status);
      const j=await r.json();
      if(!Array.isArray(j)) throw new Error("API non-array");
      const n=normList(j); log("→ API OK",n.length);
      return n;
    }catch(e){ warn("API fallback:",e?.message||e); return []; }
  }
  async function tryLocal(){
    try{
      log("Fetch JSON local:",LOCAL_JSON);
      const r=await fetch(LOCAL_JSON,{cache:"no-store"});
      if(!r.ok) throw new Error("JSON "+r.status);
      const j=await r.json();
      const arr=Array.isArray(j)?j:(j.items||[]);
      const n=normList(arr); log("→ JSON local OK",n.length);
      return n;
    }catch(e){ warn("JSON fallback:",e?.message||e); return []; }
  }
  function pick(list, params={}){
    let out=list.slice();
    const n=Number(params.n)||undefined;
    const kind=params.kind;
    const seen=new Set((params.seen||"").split(",").filter(Boolean));
    if(kind) out=out.filter(x=>x.type===kind);
    if(seen.size) out=out.filter(x=>!seen.has(x.id));
    shuffle(out); if(n) out=out.slice(0,n);
    return out;
  }
  async function fetchFacts(params){
    const a=await tryAPI(params); if(a.length) return a;
    const b=await tryLocal();     if(b.length) return pick(b,params);
    return normList(SEED);
  }

  // -------- DOM creation (sûre) --------
  function ensureDOM(){
    const root = ensureRoot();

    // CARTES
    let cardsSection=$("#ff-cards-section");
    if(!cardsSection){
      cardsSection=document.createElement("section");
      cardsSection.id="ff-cards-section";
      cardsSection.innerHTML=`
        <h2>Cartes</h2>
        <div class="controls" id="ff-cards-controls">
          <div class="seg" role="tablist">
            <button class="active" data-filter="all">Tout</button>
            <button data-filter="fact">Fait avéré</button>
            <button data-filter="myth">Mythe</button>
            <button id="btnNewSet" class="btn">Nouveau lot aléatoire</button>
            <button id="btnOneFact" class="btn ghost">Un fait</button>
            <button id="btnOneMyth" class="btn ghost">Un mythe</button>
          </div>
        </div>
        <div id="cards" class="cards"></div>`;
      if(root.firstChild) root.insertBefore(cardsSection, root.firstChild);
      else root.appendChild(cardsSection);
    }

    // NUAGE
    let cloudSection=$("#ff-cloud-section");
    if(!cloudSection){
      cloudSection=document.createElement("section");
      cloudSection.id="ff-cloud-section";
      cloudSection.innerHTML=`
        <h2>Nuage de Fun Facts</h2>
        <div class="controls">
          <button id="btnShuffle" class="btn">Mélanger le nuage</button>
          <span style="opacity:.75">Survolez / cliquez une bulle pour le détail (tooltip avec sources).</span>
        </div>
        <div id="cloud" class="cloud-wrap" aria-live="polite"></div>`;
      root.appendChild(cloudSection);
    }

    const allClouds=$$(".cloud-wrap"); // nettoie éventuels doublons
    if(allClouds.length>1){ for(let i=1;i<allClouds.length;i++) allClouds[i].remove(); }

    return {
      cardsWrap: $("#cards"),
      segFilter: $("#ff-cards-controls .seg"),
      btnNewSet: $("#btnNewSet"),
      btnOneFact: $("#btnOneFact"),
      btnOneMyth: $("#btnOneMyth"),
      cloud: $("#cloud"),
      btnShuffle: $("#btnShuffle"),
    };
  }

  // -------- état + rendu --------
  let refs, cardsWrap, segFilter, btnNewSet, btnOneFact, btnOneMyth, cloud, btnShuffle;
  let FILTER="all"; let CARDS=[]; const seen=new Set();
  const bubbles=[]; let running=true; let tooltip;

  // cartes
  const pass = (it)=> FILTER==="all" || (FILTER==="fact"&&it.type==="fact") || (FILTER==="myth"&&it.type==="myth");
  const short = (s)=> (s||"").split(/\s+/).slice(0,50).join(" ");

  function sourcesEl(list){
    const wrap=document.createElement("div"); if(!list?.length) return wrap;
    const h=document.createElement("div"); h.innerHTML="<strong>Sources :</strong>";
    const ul=document.createElement("ul"); ul.style.margin=".2rem 0 0 1rem";
    for(const s of list){
      const li=document.createElement("li");
      const a=document.createElement("a"); a.href=s.href; a.target="_blank"; a.rel="noopener"; a.textContent=s.label||label(s.href);
      li.appendChild(a); ul.appendChild(li);
    }
    wrap.appendChild(h); wrap.appendChild(ul);
    return wrap;
  }

  function drawCards(list){
    CARDS=list.slice(); cardsWrap.innerHTML="";
    if(!CARDS.length){ cardsWrap.innerHTML='<div style="opacity:.7;padding:1rem 0">Aucun élément à afficher.</div>'; return; }

    for(const it of CARDS){
      if(!pass(it)) continue;
      const card=document.createElement("article"); card.className="card";
      const front=document.createElement("div"); front.className="card-face card-front";
      front.innerHTML = `
        <div class="type">${it.type==="fact"?"⭐ Fait avéré":"❓ Mythe"}</div>
        <div class="meta"><span class="badge">${it.category||"Catégorie"}</span></div>
        <div class="title">${it.title||"(sans titre)"}</div>`;
      const back=document.createElement("div"); back.className="card-face card-back";
      back.innerHTML = `
        <div class="answer"><strong>Réponse${it.type==="myth"?" (mythe réfuté)":""}</strong></div>
        <p>${short(it.body)}</p>`;
      back.appendChild(sourcesEl(it.sources));
      card.appendChild(front); card.appendChild(back);
      card.addEventListener("click",()=>card.classList.toggle("flipped"));
      cardsWrap.appendChild(card);
    }
  }

  async function loadCards(){ const list=await fetchFacts({lang,n:8}); log("Cartes:",list.length); list.forEach(x=>seen.add(x.id)); drawCards(list); }
  async function newSet(){  const list=await fetchFacts({lang,n:8,seen:[...seen].join(",")}); log("Nouveau lot:",list.length); list.forEach(x=>seen.add(x.id)); drawCards(list); }
  async function oneMyth(){ const list=await fetchFacts({lang,kind:"myth",n:1,seen:[...seen].join(",")}); log("Un mythe:",list.length); list.forEach(x=>seen.add(x.id)); drawCards(list); }
  async function oneFact(){ const list=await fetchFacts({lang,kind:"fact",n:1,seen:[...seen].join(",")});  log("Un fait:",list.length);  list.forEach(x=>seen.add(x.id)); drawCards(list); }
  function onFilter(e){ const b=e.target.closest("button"); if(!b) return; $$("#ff-cards-controls .seg button").forEach(x=>x.classList.remove("active")); b.classList.add("active"); FILTER=b.dataset.filter||"all"; drawCards(CARDS); }

  // tooltip
  function ensureTooltip(){
    if(tooltip) return tooltip;
    tooltip=document.createElement("div");
    tooltip.id="ffTooltip";
    tooltip.style.cssText="position:absolute;max-width:min(520px,85vw);z-index:9999;background:rgba(15,23,42,.98);color:#e5e7eb;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:12px 14px;box-shadow:0 12px 28px rgba(0,0,0,.45);display:none";
    tooltip.innerHTML='<h4 id="ttTitle">—</h4><div id="ttMeta" class="meta"></div><p id="ttBody"></p><div id="ttSources" class="sources"></div>';
    document.body.appendChild(tooltip);
    return tooltip;
  }
  function placeTooltip(el){
    const t=ensureTooltip(); const r=el.getBoundingClientRect(); const pad=10;
    const tw=t.offsetWidth||320, th=t.offsetHeight||120;
    let x=r.left + r.width/2 - tw/2; x=Math.max(8, Math.min(window.innerWidth-tw-8, x));
    let y=r.top - th - pad; if(y<4) y=r.bottom + pad; if(y+th>window.innerHeight-4) y=Math.max(4, r.top - th - pad);
    t.style.left = x+"px"; t.style.top = (y+window.scrollY)+"px";
  }
  function showTip(item, anchor){
    const t=ensureTooltip();
    $("#ttTitle",t).textContent=item.title||"(sans titre)";
    const m=$("#ttMeta",t); m.innerHTML="";
    const c=document.createElement("span"); c.className="badge"; c.textContent=item.category||"Catégorie"; m.appendChild(c);
    const k=document.createElement("span"); k.className="badge"; k.textContent=item.type==="fact"?"Fait":"Mythe"; m.appendChild(k);
    $("#ttBody",t).textContent=short(item.body);
    const s=$("#ttSources",t); s.innerHTML=""; s.appendChild(sourcesEl(item.sources));
    t.style.display="block"; placeTooltip(anchor);
  }
  function hideTip(){ if(tooltip) tooltip.style.display="none"; }

  // nuage
  function labelCat(s){ const w=(s||"").split(/\s+/); return (w[0]||"").slice(0,16)+(w[1]?" "+w[1].slice(0,12):""); }
  function createBubble(item){
    const el=document.createElement("div"); el.className="bubble"; el.setAttribute("role","button"); el.setAttribute("aria-label",item.title||"fun fact");
    const r=Math.max(56, Math.min(110, 70+((item.title?.length||20)/4)));
    el.style.width=el.style.height=r+"px"; el.style.left=rand(10, Math.max(12, cloud.clientWidth - r - 10))+"px"; el.style.top=rand(10, Math.max(12, cloud.clientHeight - r - 10))+"px";
    const em=document.createElement("div"); em.className="emoji"; em.textContent=item.type==="fact"?"⭐":item.type==="myth"?"❓":"💡"; el.appendChild(em);
    const lab=document.createElement("div"); lab.className="label"; lab.textContent=labelCat(item.category|| (item.type==="fact"?"Fait":"Mythe")); el.appendChild(lab);
    cloud.appendChild(el);

    const b={el,item,r,x:parseFloat(el.style.left),y:parseFloat(el.style.top),vx:rand(-.4,.4)||.3,vy:rand(-.35,.35)||-.25,paused:false};
    const show=()=>{b.paused=true; el.classList.add("paused"); showTip(item,el);};
    const hide=()=>{b.paused=false;el.classList.remove("paused"); hideTip();};
    el.addEventListener("mouseenter",show); el.addEventListener("mouseleave",hide); el.addEventListener("click",show);
    bubbles.push(b);
  }
  function loop(){
    const W=cloud.clientWidth,H=cloud.clientHeight;
    for(const b of bubbles){ if(b.paused) continue; b.x+=b.vx; b.y+=b.vy; if(b.x<=6||b.x+b.r>=W-6) b.vx*=-1; if(b.y<=6||b.y+b.r>=H-6) b.vy*=-1; b.el.style.left=b.x+"px"; b.el.style.top=b.y+"px"; }
    requestAnimationFrame(loop);
  }
  async function loadCloud(){ const list=await fetchFacts({lang,n:18}); log("Nuage:",list.length); if(!list.length){ const d=document.createElement("div"); d.style.opacity=".7"; d.style.padding="1rem 0"; d.textContent="Aucun élément pour le nuage."; cloud.appendChild(d); return; } list.forEach(createBubble); }
  function shuffleCloud(){ const W=cloud.clientWidth,H=cloud.clientHeight; for(const b of bubbles){ b.x=rand(10,Math.max(12,W-b.r-10)); b.y=rand(10,Math.max(12,H-b.r-10)); b.vx=rand(-.5,.5)||.35; b.vy=rand(-.45,.45)||-.25; b.el.style.left=b.x+"px"; b.el.style.top=b.y+"px"; } hideTip(); }

  // start
  (async function start(){
    console.log("[fun-facts]",V,"readyState=",document.readyState);
    await domReady();
    refs=ensureDOM();
    if(!refs){ warn("root introuvable — abandon"); return; }
    ({cardsWrap,segFilter,btnNewSet,btnOneFact,btnOneMyth,cloud,btnShuffle}=refs);

    document.addEventListener("visibilitychange",()=>{ /* animation pas critique ici */ });
    btnNewSet?.addEventListener("click",newSet);
    btnOneMyth?.addEventListener("click",oneMyth);
    btnOneFact?.addEventListener("click",oneFact);
    segFilter?.addEventListener("click",onFilter);
    btnShuffle?.addEventListener("click",shuffleCloud);

    await loadCards();
    await loadCloud();
    loop();

    log("Connectivité : API si >0 ; sinon JSON local ; sinon seed.");
  })();
})();
