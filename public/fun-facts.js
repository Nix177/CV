/* Fun Facts — cartes (flip) + nuage (tooltip) — no-DOM-mutation
   - N'utilise que les conteneurs déjà présents:
     Cartes: #cards (+ #btnNewSet, #btnOneFact, #btnOneMyth, #cardsFilter)
     Nuage : #cloud (+ #btnShuffle)
   - Fallback: API -> facts-data.json -> seed
*/
(function () {
  "use strict";

  // ---------------------- Utils & logs ----------------------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const log  = (...a)=>console.log("%c[fun-facts]","color:#08c",...a);
  const warn = (...a)=>console.warn("%c[fun-facts]","color:#e80",...a);
  const rand = (a,b)=>Math.random()*(b-a)+a;
  const shuffle = (arr)=>arr.sort(()=>Math.random()-0.5);
  const lang = (document.documentElement.lang||"fr").slice(0,2);

  // CSS minimal pour le flip + tooltip (pas de layout)
  (function injectCSS(){
    const css = `
      /* Flip */
      .ff-flip{ perspective:1000px; cursor:pointer }
      .ff-flip .ff-inner{ position:relative; transform-style:preserve-3d; transition:transform .35s ease }
      .ff-flip.is-flipped .ff-inner{ transform:rotateY(180deg) }
      .ff-flip .ff-face{ backface-visibility:hidden; position:relative }
      .ff-flip .ff-back{ transform:rotateY(180deg) }
      .ff-type{ font-size:.85rem; opacity:.9; margin-bottom:6px }
      .ff-title{ font-size:1rem; line-height:1.25; margin:4px 0 6px }
      .ff-body{ font-size:.95rem; line-height:1.35; opacity:.95 }
      .ff-badge{ display:inline-block; font-size:.75rem; padding:.15rem .45rem; border-radius:999px;
                 background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); margin-right:6px }
      .ff-sources ul{ margin:.2rem 0 0 1rem }
      .ff-sources a{ color:#93c5fd; text-decoration:none }
      .ff-sources a:hover{ text-decoration:underline }

      /* Tooltip nuage */
      #ffTooltip{ position:absolute; z-index:9999; display:none;
        max-width:min(560px,88vw); background:rgba(15,23,42,.98); color:#e5e7eb;
        border:1px solid rgba(255,255,255,.15); border-radius:12px; padding:12px 14px;
        box-shadow:0 14px 28px rgba(0,0,0,.45) }
      #ffTooltip h4{ margin:0 0 6px 0; font-size:1rem }
      #ffTooltip .meta{ margin-bottom:6px }
      #ffTooltip .ff-badge{ margin-right:6px }
      #ffTooltip p{ margin:6px 0; font-size:.95rem; line-height:1.35 }
    `;
    const st = document.createElement("style");
    st.textContent = css; document.head.appendChild(st);
  })();

  // ---------------------- Sources normalisées ----------------------
  const toStr = (x)=>{ try{return String(x||"").trim();}catch{return "";} };
  const niceLabel = (u)=> u.replace(/^https?:\/\//,"").slice(0,90);

  function normOneSource(s){
    if (s==null) return null;
    if (typeof s==="string"){
      const href = toStr(s); if(!href) return null;
      return { href, label:niceLabel(href) };
    }
    if (typeof s==="object"){
      const href = toStr(s.url || s.href || s.link || "");
      if(!href) return null;
      const label = toStr(s.label || s.title || s.name || "") || niceLabel(href);
      return { href, label };
    }
    const href = toStr(s); if(!href) return null;
    return { href, label:niceLabel(href) };
  }
  function normSources(arr){
    if (!arr) return [];
    if (!Array.isArray(arr)) arr=[arr];
    const out=[]; for(const s of arr){ const v=normOneSource(s); if(v) out.push(v); }
    return out;
  }

  // ---------------------- Seed minimal ----------------------
  const SEED = [
    { id:"seed:brain10", type:"myth", category:"Science",
      title:"On n’utilise que 10 % de notre cerveau.",
      body:"Faux : l’imagerie cérébrale montre une activité étendue selon les tâches ; le cerveau fonctionne en réseaux.",
      sources:["https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/"] },
    { id:"seed:honey", type:"fact", category:"Alimentation",
      title:"Le miel peut se conserver des millénaires.",
      body:"Des pots comestibles ont été retrouvés dans des tombes antiques égyptiennes.",
      sources:["https://www.nationalgeographic.com/history/article/131219-ancient-egypt-honey-tombs-beekeeping"] }
  ];

  // ---------------------- Fetch layer ----------------------
  const API = "/api/facts";
  const LOCAL_JSON = "/facts-data.json";

  function normalizeList(list){
    return (list||[]).map((it,i)=>({
      id: it.id || `tmp:${i}:${(it.title||"").slice(0,40)}`,
      type: it.type || "myth",
      category: it.category || "Général",
      title: it.title || (it.type==="fact"?"Fait":"Mythe"),
      body: it.body || "",
      sources: normSources(it.sources)
    }));
  }

  async function tryAPI(params){
    try{
      const qs  = new URLSearchParams(params||{}).toString();
      const url = `${API}?${qs}`;
      log("Fetch API:", url);
      const r = await fetch(url, { headers:{ "x-ff":"1" }});
      if(!r.ok) throw new Error(`API ${r.status}`);
      const json = await r.json();
      if(!Array.isArray(json)) throw new Error("API non-array");
      const n = normalizeList(json);
      log(`→ API OK (${n.length} items)`); return n;
    }catch(e){ warn("API fallback:", e?.message||e); return []; }
  }

  async function tryLocalJSON(){
    try{
      log("Fetch JSON local:", LOCAL_JSON);
      const r = await fetch(LOCAL_JSON);
      if(!r.ok) throw new Error(`JSON ${r.status}`);
      const json = await r.json();
      const arr  = Array.isArray(json) ? json : (json.items||[]);
      const n    = normalizeList(arr);
      log(`→ JSON local OK (${n.length} items)`); return n;
    }catch(e){ warn("JSON local fallback:", e?.message||e); return []; }
  }

  function pickFrom(list, params={}){
    let out = list.slice();
    const n    = Number(params.n)||undefined;
    const kind = params.kind;
    const seen = new Set((params.seen||"").split(",").filter(Boolean));
    if (kind) out = out.filter(x=>x.type===kind);
    if (seen.size) out = out.filter(x=>!seen.has(x.id));
    shuffle(out); if (n) out = out.slice(0,n);
    return out;
  }

  async function fetchFacts(params){
    const api = await tryAPI(params);
    if (api.length) return api;
    const loc = await tryLocalJSON();
    if (loc.length) return pickFrom(loc, params);
    return normalizeList(SEED);
  }

  // ---------------------- CARTES (haut) ----------------------
  const cardsWrap   = $("#cards");
  const btnNewSet   = $("#btnNewSet");
  const btnOneFact  = $("#btnOneFact");
  const btnOneMyth  = $("#btnOneMyth");
  const cardsFilter = $("#cardsFilter");

  let CARDS = [];
  const seenCards = new Set();
  let FILTER = "all";

  const passFilter = (it)=>{
    const t = it.type||"unknown";
    return FILTER==="all" || (FILTER==="fact"&&t==="fact") || (FILTER==="myth"&&t==="myth");
  };

  function renderSources(container, sources){
    if (!container) return;
    container.innerHTML = "";
    if (!Array.isArray(sources) || !sources.length) return;
    const title = document.createElement("div");
    title.innerHTML = "<strong>Sources :</strong>";
    const ul = document.createElement("ul"); ul.style.margin=".2rem 0 0 1rem";
    for(const s of sources){
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href=s.href; a.target="_blank"; a.rel="noopener"; a.textContent=s.label||s.href;
      li.appendChild(a); ul.appendChild(li);
    }
    container.appendChild(title); container.appendChild(ul);
  }

  function drawCards(list){
    if (!cardsWrap) return;
    CARDS = list.slice();
    cardsWrap.innerHTML = "";
    if (!CARDS.length){
      cardsWrap.innerHTML = `<div style="opacity:.7;padding:.6rem 0">Aucun élément à afficher.</div>`;
      return;
    }
    for (const it of CARDS){
      if (!passFilter(it)) continue;

      const art = document.createElement("article");
      art.className = "ff-flip"; art.dataset.id = it.id;

      const inner = document.createElement("div");
      inner.className = "ff-inner";

      // FACE AVANT
      const front = document.createElement("div");
      front.className = "ff-face ff-front";
      const type = document.createElement("div");
      type.className = "ff-type";
      type.textContent = it.type==="fact"?"⭐ Fait avéré":it.type==="myth"?"❓ Mythe":"💡 Indéterminé";
      const meta = document.createElement("div");
      const cat  = document.createElement("span");
      cat.className = "ff-badge"; cat.textContent = it.category||"Catégorie";
      meta.appendChild(cat);
      const h = document.createElement("div");
      h.className = "ff-title"; h.textContent = it.title || "(sans titre)";
      front.appendChild(type); front.appendChild(meta); front.appendChild(h);

      // FACE ARRIÈRE
      const back = document.createElement("div");
      back.className = "ff-face ff-back";
      const backTitle = document.createElement("div");
      backTitle.className = "ff-title";
      backTitle.textContent = it.type==="myth" ? "Explication" : "Détail";
      const body = document.createElement("div");
      body.className = "ff-body"; body.textContent = it.body || "";
      const src = document.createElement("div");
      src.className = "ff-sources"; renderSources(src, it.sources);
      back.appendChild(backTitle); back.appendChild(body); back.appendChild(src);

      inner.appendChild(front); inner.appendChild(back); art.appendChild(inner);

      // Interactions (hover + click)
      art.addEventListener("mouseenter", ()=> art.classList.add("is-flipped"));
      art.addEventListener("mouseleave", ()=> art.classList.remove("is-flipped"));
      art.addEventListener("click", ()=> art.classList.toggle("is-flipped"));

      cardsWrap.appendChild(art);
    }
  }

  async function loadInitialCards(){
    if (!cardsWrap) return;
    const list = await fetchFacts({ lang, n: 8 });
    log("Cartes initiales reçues:", list.length);
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
    const list = await fetchFacts({ lang, kind:"fact", n: 1, seen: Array.from(seenCards).join(",") });
    log("Un fait:", list.length);
    list.forEach(x=> seenCards.add(x.id));
    drawCards(list);
  }
  function onFilterClick(e){
    const btn = e.target.closest("button"); if(!btn) return;
    cardsFilter?.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    FILTER = btn.dataset.filter || "all";
    drawCards(CARDS);
  }

  // ---------------------- NUAGE (bas) ----------------------
  const cloud      = $("#cloud");
  const btnShuffle = $("#btnShuffle");
  const bubbles = [];
  let running = true;

  // tooltip
  let tooltip;
  function ensureTooltip(){
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.id = "ffTooltip";
    tooltip.innerHTML = `
      <h4 id="ttTitle">—</h4>
      <div id="ttMeta" class="meta"></div>
      <p id="ttBody"></p>
      <div id="ttSources" class="ff-sources"></div>
    `;
    document.body.appendChild(tooltip);
    return tooltip;
  }
  function truncateWords(s, max=50){
    const w = (s||"").split(/\s+/);
    if (w.length<=max) return s||"";
    return w.slice(0,max).join(" ")+"…";
  }
  function posTooltipAround(el){
    const t = ensureTooltip();
    const r = el.getBoundingClientRect();
    const pad = 10;
    const tw = t.offsetWidth || 360;
    const th = t.offsetHeight|| 120;
    let x = r.left + r.width/2 - tw/2;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    let y = r.top - th - pad;
    if (y<6) y = r.bottom + pad;
    t.style.left = `${x}px`;
    t.style.top  = `${y + window.scrollY}px`;
  }
  function showTooltip(item, anchor){
    const t = ensureTooltip();
    const ttTitle   = $("#ttTitle", t);
    const ttMeta    = $("#ttMeta", t);
    const ttBody    = $("#ttBody", t);
    const ttSources = $("#ttSources", t);

    ttTitle.textContent = item.title || "(sans titre)";
    ttMeta.innerHTML = "";
    const c = document.createElement("span"); c.className="ff-badge"; c.textContent=item.category||"Catégorie";
    ttMeta.appendChild(c);
    const k = document.createElement("span"); k.className="ff-badge";
    k.textContent = item.type==="fact"?"Fait":"Mythe"; ttMeta.appendChild(k);

    ttBody.textContent = truncateWords(item.body||"", 50);

    ttSources.innerHTML = "";
    if (item.sources?.length){
      const ul = document.createElement("ul"); ul.style.margin=".2rem 0 0 1rem";
      for (const s of item.sources){
        const li=document.createElement("li");
        const a=document.createElement("a"); a.href=s.href; a.target="_blank"; a.rel="noopener";
        a.textContent=s.label||niceLabel(s.href);
        li.appendChild(a); ul.appendChild(li);
      }
      const h=document.createElement("div"); h.innerHTML="<strong>Sources :</strong>";
      ttSources.appendChild(h); ttSources.appendChild(ul);
    }

    t.style.display="block"; posTooltipAround(anchor);
  }
  function hideTooltip(){ if(tooltip) tooltip.style.display="none"; }

  function labelForCategory(s){
    const w=(s||"").split(/\s+/);
    return (w[0]||"").slice(0,16) + (w[1]?" "+w[1].slice(0,12):"");
  }

  function createBubble(item){
    if (!cloud) return;
    const el = document.createElement("div");
    el.className="bubble";
    const r = Math.max(56, Math.min(110, 70 + ((item.title?.length||20)/4)));
    el.style.width = el.style.height = r+"px";
    el.style.left = rand(10, Math.max(12, cloud.clientWidth  - r - 10))+"px";
    el.style.top  = rand(10, Math.max(12, cloud.clientHeight - r - 10))+"px";

    const emoji = document.createElement("div"); emoji.className="emoji";
    emoji.textContent = item.type==="fact"?"⭐":item.type==="myth"?"❓":"💡";
    const lab = document.createElement("div"); lab.className="label";
    lab.textContent = labelForCategory(item.category || (item.type==="fact"?"Fait":"Mythe"));
    el.appendChild(emoji); el.appendChild(lab);
    cloud.appendChild(el);

    const bub = { el, item, r,
      x:parseFloat(el.style.left), y:parseFloat(el.style.top),
      vx:rand(-0.4,0.4)||0.3, vy:rand(-0.35,0.35)||-0.25,
      paused:false
    };
    const show = ()=>{ bub.paused=true; el.classList.add("paused"); showTooltip(item, el); };
    const hide = ()=>{ bub.paused=false; el.classList.remove("paused"); hideTooltip(); };
    el.addEventListener("mouseenter", show);
    el.addEventListener("mouseleave", hide);
    el.addEventListener("click", show);
    bubbles.push(bub);
  }

  function loop(){
    if (!cloud) return;
    const W=cloud.clientWidth, H=cloud.clientHeight;
    for (const b of bubbles){
      if (b.paused) continue;
      b.x += b.vx; b.y += b.vy;
      if (b.x<=6 || b.x+b.r>=W-6) b.vx*=-1;
      if (b.y<=6 || b.y+b.r>=H-6) b.vy*=-1;
      b.el.style.left=b.x+"px"; b.el.style.top=b.y+"px";
    }
    requestAnimationFrame(loop);
  }

  async function loadInitialCloud(){
    if (!cloud) return;
    const list = await fetchFacts({ lang, n: 18 });
    log("Nuage reçu:", list.length);
    if (!list.length){ return; }
    list.forEach(createBubble);
  }
  function shuffleCloud(){
    if (!cloud) return;
    const W=cloud.clientWidth, H=cloud.clientHeight;
    bubbles.forEach(b=>{
      b.x = rand(10, Math.max(12, W - b.r - 10));
      b.y = rand(10, Math.max(12, H - b.r - 10));
      b.vx = rand(-0.5,0.5)||0.35;
      b.vy = rand(-0.45,0.45)||-0.25;
      b.el.style.left=b.x+"px"; b.el.style.top=b.y+"px";
    });
    hideTooltip();
  }

  // ---------------------- Wiring ----------------------
  (async function start(){
    document.addEventListener("visibilitychange", ()=> (running = document.visibilityState==="visible"));

    // Cartes
    btnNewSet?.addEventListener("click", newSet);
    btnOneFact?.addEventListener("click", oneFact);
    btnOneMyth?.addEventListener("click", oneMyth);
    cardsFilter?.addEventListener("click", (e)=>{
      const btn = e.target.closest("button"); if(!btn) return;
      cardsFilter.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      FILTER = btn.dataset.filter || "all";
      drawCards(CARDS);
    });

    // Nuage
    btnShuffle?.addEventListener("click", shuffleCloud);

    await loadInitialCards();
    await loadInitialCloud();
    loop();

    log("Connectivité : API utilisée si elle renvoie >0 éléments ; sinon JSON local ; sinon seed.");
  })();
})();
