/* Fun Facts — Cartes + Nuage (sources Wikipedia via /api/facts)
   - Cartes (haut) : nouveau lot, "Un fait", "Un mythe", filtre fact/myth/tout
   - Nuage (bas) : bulles animées, pause au survol, panneau latéral lisible
   - Anti-doublon : paramètre `seen` et Set côté client
   - Fallback : facts-data.json puis petits exemples embarqués
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const rand = (a,b)=> Math.random()*(b-a)+a;
  const pick = arr => arr[(Math.random()*arr.length)|0];

  // ---------- DOM ----------
  const cardsWrap   = $("#cards");
  const segFilter   = $(".seg");
  const btnNewSet   = $("#btnNewSet");
  const btnOneFact  = $("#btnOneFact");
  const btnOneMyth  = $("#btnOneMyth");

  const cloud       = $("#cloud");
  const btnShuffle  = $("#btnShuffle");
  const panel       = $("#factPanel");
  const fpTitle     = $("#fpTitle");
  const fpMeta      = $("#fpMeta");
  const fpBody      = $("#fpBody");
  const fpSources   = $("#fpSources");
  const fpClose     = $("#fpClose");

  // ---------- API & Fallbacks ----------
  const API = "/api/facts";
  const LOCAL_JSON = "/facts-data.json";

  // mini-fallback en dernier recours
  const TINY_FALLBACK = [
    {
      id:"local:brain10", type:"myth", category:"Science",
      title:"On n’utilise que 10 % de notre cerveau.",
      body:"Faux : l’imagerie cérébrale montre une activation étendue selon les tâches ; le cerveau fonctionne en réseaux.",
      sources:["https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/"]
    },
    {
      id:"local:honey", type:"fact", category:"Alimentation",
      title:"Le miel peut se conserver des millénaires.",
      body:"Des pots comestibles ont été retrouvés dans des tombes antiques.",
      sources:["https://www.nationalgeographic.com/history/article/131219-ancient-egypt-honey-tombs-beekeeping"]
    }
  ];

  const lang = (document.documentElement.lang || "fr").slice(0,2);

  async function fetchFacts(params){
    try{
      const qs = new URLSearchParams(params||{}).toString();
      const r = await fetch(`${API}?${qs}`, { headers:{ "x-ff": "1" }});
      if (!r.ok) throw 0;
      const json = await r.json();
      if (!Array.isArray(json)) throw 0;
      return normalizeList(json);
    }catch{
      // fallback: fichier local
      try{
        const r = await fetch(LOCAL_JSON);
        if (!r.ok) throw 0;
        const json = await r.json();
        const arr = Array.isArray(json) ? json : (json.items || []);
        return normalizeList(arr);
      }catch{
        return TINY_FALLBACK.slice();
      }
    }
  }

  function normalizeList(list){
    return (list||[]).map((it, i)=>{
      const id = it.id || `tmp:${i}:${(it.title||"").slice(0,40)}`;
      const type = it.type || "myth";
      const category = it.category || (type==="fact"?"Général":"Général");
      const title = it.title || (type==="fact"?"Fait":"Mythe");
      const body  = it.body  || "";
      const sources = Array.isArray(it.sources) ? it.sources : [];
      return { id, type, category, title, body, sources };
    });
  }

  // ---------- State ----------
  let FILTER = "all";            // cards filter
  let CARDS = [];                // cartes actuellement affichées
  let CLOUD = [];                // données du nuage
  const seenCards = new Set();   // ids déjà tirés pour cartes
  const seenCloud = new Set();   // ids déjà tirés pour nuage
  const bubbles   = [];          // objets animés {el,item,r,x,y,vx,vy,paused}
  let running = true;

  // ---------- Cartes ----------
  function passFilter(item){
    const t = item.type || "unknown";
    return (FILTER==="all") || (FILTER==="fact" && t==="fact") || (FILTER==="myth" && t==="myth");
  }

  function drawCards(list){
    CARDS = list.slice(); // keep copy (pour réfiltrer plus tard)
    cardsWrap.innerHTML = "";
    for(const item of CARDS){
      if(!passFilter(item)) continue;
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.id = item.id;

      const type = document.createElement("div");
      type.className = "type " + (item.type||"unknown");
      type.innerHTML = item.type==="fact" ? "⭐ Fait avéré" : item.type==="myth" ? "❓ Mythe" : "💡 Indéterminé";
      card.appendChild(type);

      const meta = document.createElement("div");
      meta.className = "meta";
      const cat = document.createElement("span");
      cat.className="badge";
      cat.textContent = item.category || "Catégorie";
      meta.appendChild(cat);
      card.appendChild(meta);

      const h = document.createElement("div");
      h.className="title";
      h.textContent = item.title || "(sans titre)";
      card.appendChild(h);

      const p = document.createElement("div");
      p.className="body";
      p.textContent = item.body || "";
      card.appendChild(p);

      if (Array.isArray(item.sources) && item.sources.length){
        const s = document.createElement("div");
        s.className="sources";
        const ul = document.createElement("ul");
        ul.style.margin = ".3rem 0 0 .9rem";
        item.sources.forEach(url=>{
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = url; a.target="_blank"; a.rel="noopener";
          a.textContent = url.replace(/^https?:\/\//,"").slice(0,95);
          li.appendChild(a); ul.appendChild(li);
        });
        const title = document.createElement("div");
        title.innerHTML = "<strong>Sources :</strong>";
        s.appendChild(title); s.appendChild(ul);
        card.appendChild(s);
      }

      cardsWrap.appendChild(card);
    }
  }

  async function loadInitialCards(){
    // 1er lot
    const list = await fetchFacts({ lang, n: 8 });
    list.forEach(x=> seenCards.add(x.id));
    drawCards(list);
  }

  async function newSet(){
    const list = await fetchFacts({ lang, n: 8, seen: Array.from(seenCards).join(",") });
    list.forEach(x=> seenCards.add(x.id));
    drawCards(list);
  }

  async function oneMyth(){
    const list = await fetchFacts({ lang, kind:"myth", n: 1, seen: Array.from(seenCards).join(",") });
    list.forEach(x=> seenCards.add(x.id));
    drawCards(list);
  }

  async function oneFact(){
    // kind=fact + withLocal=1 → l'API mélange quelques "faits" sûrs (local) avec le pool
    const list = await fetchFacts({ lang, kind:"fact", withLocal:"1", n: 1, seen: Array.from(seenCards).join(",") });
    list.forEach(x=> seenCards.add(x.id));
    drawCards(list);
  }

  function onFilterClick(e){
    const btn = e.target.closest("button");
    if(!btn) return;
    segFilter.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    FILTER = btn.dataset.filter || "all";
    drawCards(CARDS); // re-filtre depuis l'état courant
  }

  // ---------- Nuage ----------
  function labelForCategory(s){
    const w = (s||"").split(/\s+/);
    return (w[0]||"").slice(0,16) + (w[1] ? " " + w[1].slice(0,12) : "");
  }

  function createBubble(item){
    const el = document.createElement("div");
    el.className = "bubble";
    el.setAttribute("role","button");
    el.setAttribute("aria-label", item.title || "fun fact");

    const r = Math.max(56, Math.min(110, 70 + (item.title?.length||20)/4));
    el.style.width = el.style.height = r + "px";
    el.style.left = rand(10, cloud.clientWidth - r - 10) + "px";
    el.style.top  = rand(10, cloud.clientHeight - r - 10) + "px";

    const em = document.createElement("div");
    em.className = "emoji";
    em.textContent = item.type==="fact" ? "⭐" : (item.type==="myth" ? "❓" : "💡");
    el.appendChild(em);

    const lab = document.createElement("div");
    lab.className = "label";
    lab.textContent = labelForCategory(item.category || (item.type==="fact"?"Fait":"Mythe"));
    el.appendChild(lab);

    cloud.appendChild(el);

    const bub = {
      el, item, r,
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
      vx: rand(-0.4,0.4) || 0.3,
      vy: rand(-0.35,0.35) || -0.25,
      paused:false
    };
    const open = ()=> openPanel(bub);
    el.addEventListener("mouseenter", ()=>{ bub.paused = true; el.classList.add("paused"); open(); });
    el.addEventListener("mouseleave", ()=>{ bub.paused = false; el.classList.remove("paused"); });
    el.addEventListener("click", open);

    bubbles.push(bub);
  }

  function openPanel(b){
    const it = b.item;
    panel.style.display = "block";
    fpTitle.textContent = it.title || "(sans titre)";
    fpBody.textContent  = it.body || "";

    // meta
    fpMeta.innerHTML = "";
    const cat = document.createElement("span");
    cat.className = "badge"; cat.textContent = it.category || "Catégorie";
    fpMeta.appendChild(cat);
    const kind = document.createElement("span");
    kind.className = "badge " + (it.type==="fact" ? "t-true" : it.type==="myth" ? "t-myth" : "t-unknown");
    kind.textContent = it.type==="fact" ? "Fait" : it.type==="myth" ? "Mythe" : "Indéterminé";
    fpMeta.appendChild(kind);

    // sources
    fpSources.innerHTML = "";
    if (Array.isArray(it.sources) && it.sources.length){
      const h = document.createElement("div");
      h.innerHTML = "<strong>Sources :</strong>";
      fpSources.appendChild(h);
      const ul = document.createElement("ul");
      ul.style.margin = ".3rem 0 0 .9rem";
      for (const s of it.sources){
        const li = document.createElement("li");
        const a = document.createElement("a"); a.href=s; a.target="_blank"; a.rel="noopener";
        a.textContent = s.replace(/^https?:\/\//,"").slice(0,90);
        li.appendChild(a); ul.appendChild(li);
      }
      fpSources.appendChild(ul);
    }
  }

  function loop(){
    const W = cloud.clientWidth, H = cloud.clientHeight;
    if (running){
      for (const b of bubbles){
        if (b.paused) continue;
        b.x += b.vx; b.y += b.vy;
        if (b.x <= 6 || b.x + b.r >= W-6) b.vx *= -1;
        if (b.y <= 6 || b.y + b.r >= H-6) b.vy *= -1;
        b.el.style.left = b.x + "px"; b.el.style.top = b.y + "px";
      }
    }
    requestAnimationFrame(loop);
  }

  async function loadInitialCloud(){
    // un lot à part pour le nuage (18 env.)
    const list = await fetchFacts({ lang, n: 20, seen: Array.from(seenCloud).join(",") });
    const subset = list.slice(0,18);
    subset.forEach(x=> seenCloud.add(x.id));
    CLOUD = subset;
    // draw
    subset.forEach(createBubble);
  }

  function shuffleCloud(){
    const W = cloud.clientWidth, H = cloud.clientHeight;
    bubbles.forEach(b=>{
      b.x = rand(10, W - b.r - 10);
      b.y = rand(10, H - b.r - 10);
      b.vx = rand(-0.5,0.5)||0.35;
      b.vy = rand(-0.45,0.45)||-0.25;
      b.el.style.left = b.x + "px";
      b.el.style.top  = b.y + "px";
    });
  }

  // ---------- Events ----------
  fpClose?.addEventListener("click", ()=> panel.style.display = "none");
  btnNewSet?.addEventListener("click", newSet);
  btnOneMyth?.addEventListener("click", oneMyth);
  btnOneFact?.addEventListener("click", oneFact);
  segFilter?.addEventListener("click", onFilterClick);
  btnShuffle?.addEventListener("click", shuffleCloud);

  // pause quand l’onglet est masqué
  document.addEventListener("visibilitychange", ()=> (running = document.visibilityState==="visible"));

  // ---------- Start ----------
  (async function start(){
    await loadInitialCards();
    await loadInitialCloud();
    loop();
  })();

})();
