/* Fun Facts — Cartes + Nuage (debug + fallback garanti + sources robustes)
   - Log détaillé (API / JSON / seed)
   - Affiche toujours quelque chose (seed embarqué si besoin)
   - Accepte sources en string ou object ({url|href|link, label|title|name})
   - Cartes (haut) + Nuage (bas) + panneau latéral lisible
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const rand = (a,b)=> Math.random()*(b-a)+a;

  const log  = (...args)=> console.log("%c[fun-facts]", "color:#08c", ...args);
  const warn = (...args)=> console.warn("%c[fun-facts]", "color:#e80", ...args);
  const err  = (...args)=> console.error("%c[fun-facts]", "color:#f44", ...args);

  // --- URL helpers ---
  function toUrlString(x){
    try { return String(x || "").trim(); } catch { return ""; }
  }
  function niceLabelFromUrl(u){
    if (!u) return "";
    return u.replace(/^https?:\/\//, "").slice(0, 95);
  }

  // Normalise une entrée de source quelconque vers { href, label }
  function normalizeOneSource(s){
    if (!s && s !== 0) return null;

    if (typeof s === "string"){
      const href = toUrlString(s);
      if (!href) return null;
      return { href, label: niceLabelFromUrl(href) };
    }

    // objet
    if (typeof s === "object"){
      const href = toUrlString(s.url || s.href || s.link || "");
      if (!href) return null;
      const label = toUrlString(s.label || s.title || s.name || "") || niceLabelFromUrl(href);
      return { href, label };
    }

    // nombre/bool -> string
    const href = toUrlString(s);
    if (!href) return null;
    return { href, label: niceLabelFromUrl(href) };
  }

  function normalizeSources(arr){
    if (!arr) return [];
    if (!Array.isArray(arr)) arr = [arr];
    const out = [];
    for (const s of arr){
      const v = normalizeOneSource(s);
      if (v && v.href) out.push(v);
    }
    return out;
  }

  // ---------- Seed embarqué (toujours dispo) ----------
  const SEED = [
    {
      id:"seed:brain10", type:"myth", category:"Science",
      title:"On n’utilise que 10 % de notre cerveau.",
      body:"Faux : l’imagerie cérébrale montre que l’activité varie selon les tâches ; le cerveau fonctionne en réseaux et diverses zones sont sollicitées.",
      sources:["https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/"]
    },
    {
      id:"seed:honey", type:"fact", category:"Alimentation",
      title:"Le miel peut se conserver des millénaires.",
      body:"Des pots comestibles ont été retrouvés dans des tombes antiques égyptiennes.",
      sources:["https://www.nationalgeographic.com/history/article/131219-ancient-egypt-honey-tombs-beekeeping"]
    },
    {
      id:"seed:sharks", type:"fact", category:"Nature",
      title:"Les requins sont plus anciens que les arbres.",
      body:"Des fossiles de requins datent de ~450 Ma ; les arbres modernes d’environ ~360 Ma.",
      sources:["https://ocean.si.edu/ocean-life/sharks-rays/evolution-sharks"]
    },
    {
      id:"seed:wall", type:"myth", category:"Géographie",
      title:"La Grande Muraille est visible depuis l’espace à l’œil nu.",
      body:"En général non : elle est étroite et suit les reliefs ; sa visibilité est très improbable sans aide optique.",
      sources:["https://en.wikipedia.org/wiki/Great_Wall_of_China#Visibility_from_space"]
    }
  ];

  // ---------- Config requêtes ----------
  const API = "/api/facts";
  const LOCAL_JSON = "/facts-data.json";  // place-le bien dans /public
  const lang = (document.documentElement.lang || "fr").slice(0,2);

  function normalizeList(list){
    return (list||[]).map((it, i)=>{
      const id = it.id || `tmp:${i}:${(it.title||"").slice(0,40)}`;
      const type = it.type || "myth";
      const category = it.category || "Général";
      const title = it.title || (type==="fact"?"Fait":"Mythe");
      const body  = it.body  || "";
      const sources = normalizeSources(it.sources);
      return { id, type, category, title, body, sources };
    });
  }

  async function tryAPI(params){
    try{
      const qs  = new URLSearchParams(params||{}).toString();
      const url = `${API}?${qs}`;
      log("Fetch API:", url);
      const r = await fetch(url, { headers:{ "x-ff": "1" }});
      if (!r.ok) throw new Error(`API status ${r.status}`);
      const json = await r.json();
      if (!Array.isArray(json)) throw new Error("API non-array");
      const n = normalizeList(json);
      log(`→ API OK (${n.length} items)`);
      return n;
    }catch(e){
      warn("API fallback:", e?.message || e);
      return [];
    }
  }

  async function tryLocalJSON(){
    try{
      log("Fetch JSON local:", LOCAL_JSON);
      const r = await fetch(LOCAL_JSON);
      if (!r.ok) throw new Error(`JSON status ${r.status}`);
      const json = await r.json();
      const arr = Array.isArray(json) ? json : (json.items || []);
      const n = normalizeList(arr);
      log(`→ JSON local OK (${n.length} items)`);
      return n;
    }catch(e){
      warn("JSON local fallback:", e?.message || e);
      return [];
    }
  }

  async function fetchFacts(params){
    const api = await tryAPI(params);
    if (api.length) return api;

    const loc = await tryLocalJSON();
    if (loc.length) return loc;

    log("→ Seed embarqué utilisé");
    return normalizeList(SEED);
  }

  // ---------- DOM (auto-crée si manquant) ----------
  function ensureDOM(){
    const root = $(".container") || $("main") || document.body;

    // CARTES
    let cardsSection = $("#ff-cards-section");
    if (!cardsSection){
      cardsSection = document.createElement("section");
      cardsSection.id = "ff-cards-section";
      cardsSection.innerHTML = `
        <h2>Cartes</h2>
        <div class="controls" id="ff-cards-controls">
          <button id="btnNewSet" class="btn">Nouveau lot aléatoire</button>
          <button id="btnOneFact" class="btn ghost">Un fait</button>
          <button id="btnOneMyth" class="btn ghost">Un mythe</button>
          <div class="seg" role="tablist" aria-label="Filtre type">
            <button class="active" data-filter="all" aria-selected="true">Tout</button>
            <button data-filter="fact">Fait avéré</button>
            <button data-filter="myth">Mythe</button>
          </div>
          <span style="opacity:.75">Sources toujours cliquables.</span>
        </div>
        <div id="cards" class="cards"></div>
      `;
      root.insertBefore(cardsSection, root.firstChild);
    }

    // NUAGE
    let cloudSection = $("#ff-cloud-section");
    if (!cloudSection){
      cloudSection = document.createElement("section");
      cloudSection.id = "ff-cloud-section";
      cloudSection.innerHTML = `
        <h2>Fun Facts</h2>
        <div class="controls">
          <button id="btnShuffle" class="btn">Mélanger le nuage</button>
          <span style="opacity:.75">Survolez / cliquez une bulle pour voir le détail.</span>
        </div>
        <div id="cloud" class="cloud-wrap">
          <aside id="factPanel" class="fact-panel" role="dialog" aria-modal="false">
            <div style="display:flex;gap:8px;align-items:center">
              <h3 id="fpTitle">—</h3>
              <button id="fpClose" class="btn close-x">✕</button>
            </div>
            <div id="fpMeta" class="meta"></div>
            <p id="fpBody"></p>
            <div id="fpSources" class="sources"></div>
          </aside>
        </div>
      `;
      root.appendChild(cloudSection);
    }

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

  // ---------- Réfs DOM ----------
  let cardsWrap, segFilter, btnNewSet, btnOneFact, btnOneMyth;
  let cloud, btnShuffle, panel, fpTitle, fpMeta, fpBody, fpSources, fpClose;

  // ---------- State ----------
  let FILTER = "all";
  let CARDS = [];
  let CLOUD = [];
  const seenCards = new Set();
  const seenCloud = new Set();
  const bubbles   = [];
  let running = true;

  // ---------- Cartes ----------
  function passFilter(item){
    const t = item.type || "unknown";
    return (FILTER==="all") || (FILTER==="fact" && t==="fact") || (FILTER==="myth" && t==="myth");
  }

  function drawEmpty(target, msg){
    if (!target) return;
    target.innerHTML = `<div style="opacity:.7;padding:1rem 0">${msg}</div>`;
  }

  function renderSources(container, sources){
    if (!container) return;
    container.innerHTML = "";
    if (!Array.isArray(sources) || !sources.length) return;

    const title = document.createElement("div");
    title.innerHTML = "<strong>Sources :</strong>";
    container.appendChild(title);

    const ul = document.createElement("ul");
    ul.style.margin = ".3rem 0 0 .9rem";

    for (const s of sources){
      // s = {href, label}
      if (!s || !s.href) continue;
      const li = document.createElement("li");
      const a  = document.createElement("a");
      a.href = s.href; a.target = "_blank"; a.rel = "noopener";
      a.textContent = s.label || niceLabelFromUrl(s.href);
      li.appendChild(a);
      ul.appendChild(li);
    }
    container.appendChild(ul);
  }

  function drawCards(list){
    CARDS = list.slice();
    if (!cardsWrap) return;
    cardsWrap.innerHTML = "";
    if (!CARDS.length){
      drawEmpty(cardsWrap, "Aucun élément à afficher.");
      return;
    }

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
        renderSources(s, item.sources);
        card.appendChild(s);
      }

      cardsWrap.appendChild(card);
    }
  }

  async function loadInitialCards(){
    const list = await fetchFacts({ lang, n: 8 });
    log("Cartes initiales reçues:", list.length);
    if (!list.length) warn("⚠ Liste vide — seed affiché");
    list.forEach(x=> seenCards.add(x.id));
    drawCards(list);
  }

  async function newSet(){
    const list = await fetchFacts({ lang, n: 8, seen: Array.from(seenCards).join(",") });
    log("Nouveau lot:", list.length);
    list.forEach(x=> seenCards.add(x.id));
    drawCards(list);
  }

  async function oneMyth(){
    const list = await fetchFacts({ lang, kind:"myth", n: 1, seen: Array.from(seenCards).join(",") });
    log("Un mythe:", list.length);
    list.forEach(x=> seenCards.add(x.id));
    drawCards(list);
  }

  async function oneFact(){
    const list = await fetchFacts({ lang, kind:"fact", withLocal:"1", n: 1, seen: Array.from(seenCards).join(",") });
    log("Un fait:", list.length);
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
      renderSources(fpSources, it.sources);
    }
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
    log("Nuage reçu:", list.length);
    const subset = (list.length ? list : normalizeList(SEED)).slice(0,18);
    subset.forEach(x=> seenCloud.add(x.id));
    CLOUD = subset;
    cloud.innerHTML = cloud.innerHTML; // conserve le panel
    if (!subset.length){
      const empty = document.createElement("div");
      empty.style.opacity = ".7"; empty.style.padding = "1rem 0";
      empty.textContent = "Aucun élément pour le nuage.";
      cloud.appendChild(empty);
      return;
    }
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
    const refs = ensureDOM();
    ({cardsWrap, segFilter, btnNewSet, btnOneFact, btnOneMyth,
      cloud, btnShuffle, panel, fpTitle, fpMeta, fpBody, fpSources, fpClose} = refs);

    fpClose?.addEventListener("click", ()=> panel.style.display = "none");
    btnNewSet?.addEventListener("click", newSet);
    btnOneMyth?.addEventListener("click", oneMyth);
    btnOneFact?.addEventListener("click", oneFact);
    segFilter?.addEventListener("click", onFilterClick);
    btnShuffle?.addEventListener("click", shuffleCloud);
    document.addEventListener("visibilitychange", ()=> (running = document.visibilityState==="visible"));

    await loadInitialCards();
    await loadInitialCloud();
    loop();
  })();

})();
