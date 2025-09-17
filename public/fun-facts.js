/* Fun Facts — Cartes + Nuage (robuste : auto-crée les sections si absentes)
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

  // ---------- API & Fallbacks ----------
  const API = "/api/facts";
  const LOCAL_JSON = "/facts-data.json";
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

  // ---------- DOM (auto-injection si nécessaire) ----------
  function ensureDOM(){
    const root = $(".container") || $("main") || document.body;

    // ====== Cartes ======
    let cardsSection = $("#ff-cards-section");
    let cards = $("#cards");
    let controls = $("#ff-cards-controls");
    let seg = $(".seg");

    if (!cards || !controls){
      // crée la section Cartes complète
      cardsSection = cardsSection || document.createElement("section");
      cardsSection.id = "ff-cards-section";

      // titre
      if (!cardsSection.querySelector("h2")){
        const h2 = document.createElement("h2");
        h2.textContent = "Cartes";
        cardsSection.appendChild(h2);
      }

      // contrôles
      controls = document.createElement("div");
      controls.className = "controls";
      controls.id = "ff-cards-controls";
      controls.innerHTML = `
        <button id="btnNewSet" class="btn">Nouveau lot aléatoire</button>
        <button id="btnOneFact" class="btn ghost">Un fait</button>
        <button id="btnOneMyth" class="btn ghost">Un mythe</button>
        <div class="seg" role="tablist" aria-label="Filtre type">
          <button class="active" data-filter="all" aria-selected="true">Tout</button>
          <button data-filter="fact">Fait avéré</button>
          <button data-filter="myth">Mythe</button>
        </div>
        <span style="opacity:.75">Sources toujours cliquables.</span>
      `;
      cardsSection.appendChild(controls);

      // grille cartes
      cards = document.createElement("div");
      cards.id = "cards";
      cards.className = "cards";
      cardsSection.appendChild(cards);

      // insère au début du root (avant le nuage si possible)
      const cloudSection = $("#ff-cloud-section");
      root.insertBefore(cardsSection, cloudSection || root.firstChild);
    }

    // ====== Nuage ======
    let cloudSection = $("#ff-cloud-section");
    let cloud = $("#cloud");
    let panel = $("#factPanel");
    let shuffleBtn = $("#btnShuffle");

    if (!cloud){
      cloudSection = cloudSection || document.createElement("section");
      cloudSection.id = "ff-cloud-section";

      const h2 = document.createElement("h2");
      h2.textContent = "Nuage de Fun Facts";
      cloudSection.appendChild(h2);

      const controls2 = document.createElement("div");
      controls2.className = "controls";
      controls2.innerHTML = `
        <button id="btnShuffle" class="btn">Mélanger le nuage</button>
        <span style="opacity:.75">Survolez / cliquez une bulle pour voir le détail.</span>
      `;
      cloudSection.appendChild(controls2);

      cloud = document.createElement("div");
      cloud.id = "cloud";
      cloud.className = "cloud-wrap";
      cloudSection.appendChild(cloud);

      panel = document.createElement("aside");
      panel.id = "factPanel";
      panel.className = "fact-panel";
      panel.setAttribute("role","dialog");
      panel.setAttribute("aria-modal","false");
      panel.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center">
          <h3 id="fpTitle">—</h3>
          <button id="fpClose" class="btn close-x">✕</button>
        </div>
        <div id="fpMeta" class="meta"></div>
        <p id="fpBody"></p>
        <div id="fpSources" class="sources"></div>
      `;
      cloud.appendChild(panel);

      root.appendChild(cloudSection);
    }

    // retourne les références (toujours valides après injection)
    return {
      cardsWrap: $("#cards"),
      segFilter: $(".seg"),
      btnNewSet: $("#btnNewSet"),
      btnOneFact: $("#btnOneFact"),
      btnOneMyth: $("#btnOneMyth"),
      cloud: $("#cloud"),
      btnShuffle: $("#btnShuffle"),
      panel: $("#factPanel"),
      fpTitle: $("#fpTitle"),
      fpMeta: $("#fpMeta"),
      fpBody: $("#fpBody"),
      fpSources: $("#fpSources"),
      fpClose: $("#fpClose")
    };
  }

  // références DOM (remplies dans start())
  let cardsWrap, segFilter, btnNewSet, btnOneFact, btnOneMyth;
  let cloud, btnShuffle, panel, fpTitle, fpMeta, fpBody, fpSources, fpClose;

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
    if (!cardsWrap) return;               // sécurité
    CARDS = list.slice();                 // copie pour re-filtrer
    cardsWrap.innerHTML = "";             // <-- ne plantera plus
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
    const list = await fetchFacts({ lang, kind:"fact", withLocal:"1", n: 1, seen: Array.from(seenCards).join(",") });
    list.forEach(x=> seenCards.add(x.id));
    drawCards(list);
  }

  function onFilterClick(e){
    const btn = e.target.closest("button");
    if(!btn) return;
    segFilter?.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    FILTER = btn.dataset.filter || "all";
    drawCards(CARDS);
  }

  // ---------- Nuage ----------
  function labelForCategory(s){
    const w = (s||"").split(/\s+/);
    return (w[0]||"").slice(0,16) + (w[1] ? " " + w[1].slice(0,12) : "");
  }

  function createBubble(item){
    if (!cloud) return;
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
    if (!panel) return;
    const it = b.item;
    panel.style.display = "block";
    if (fpTitle) fpTitle.textContent = it.title || "(sans titre)";
    if (fpBody)  fpBody.textContent  = it.body || "";

    if (fpMeta){
      fpMeta.innerHTML = "";
      const cat = document.createElement("span");
      cat.className = "badge"; cat.textContent = it.category || "Catégorie";
      fpMeta.appendChild(cat);
      const kind = document.createElement("span");
      kind.className = "badge " + (it.type==="fact" ? "t-true" : it.type==="myth" ? "t-myth" : "t-unknown");
      kind.textContent = it.type==="fact" ? "Fait" : it.type==="myth" ? "Mythe" : "Indéterminé";
      fpMeta.appendChild(kind);
    }

    if (fpSources){
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
  }

  function loop(){
    if (!cloud) return;
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
    const list = await fetchFacts({ lang, n: 20, seen: Array.from(seenCloud).join(",") });
    const subset = list.slice(0,18);
    subset.forEach(x=> seenCloud.add(x.id));
    CLOUD = subset;
    subset.forEach(createBubble);
  }

  function shuffleCloud(){
    if (!cloud) return;
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

  // ---------- Start ----------
  (async function start(){
    // 1) S'assure que la page a les bons conteneurs
    const refs = ensureDOM();
    cardsWrap  = refs.cardsWrap;
    segFilter  = refs.segFilter;
    btnNewSet  = refs.btnNewSet;
    btnOneFact = refs.btnOneFact;
    btnOneMyth = refs.btnOneMyth;

    cloud      = refs.cloud;
    btnShuffle = refs.btnShuffle;
    panel      = refs.panel;
    fpTitle    = refs.fpTitle;
    fpMeta     = refs.fpMeta;
    fpBody     = refs.fpBody;
    fpSources  = refs.fpSources;
    fpClose    = refs.fpClose;

    // 2) Brancher les événements (si les éléments existent)
    fpClose?.addEventListener("click", ()=> panel.style.display = "none");
    btnNewSet?.addEventListener("click", newSet);
    btnOneMyth?.addEventListener("click", oneMyth);
    btnOneFact?.addEventListener("click", oneFact);
    segFilter?.addEventListener("click", onFilterClick);
    btnShuffle?.addEventListener("click", shuffleCloud);
    document.addEventListener("visibilitychange", ()=> (running = document.visibilityState==="visible"));

    // 3) Charger les données initiales
    await loadInitialCards();
    await loadInitialCloud();
    loop();
  })();

})();
