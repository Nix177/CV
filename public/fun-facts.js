/* Fun Facts — version "no-DOM-mutation"
   - N'utilise QUE les conteneurs existants:
     * Cartes:   #cards (+ #btnNewSet, #btnOneFact, #btnOneMyth, #cardsFilter)
     * Nuage:    #cloud (optionnel)
   - Connexion: API /api/facts  -> sinon /facts-data.json  -> sinon seed local
   - Sources: normalisées (string ou objet), clickables
*/
(function () {
  "use strict";

  // ----------------------- Utils & logs -----------------------
  const log  = (...a) => console.log("%c[fun-facts]", "color:#08c", ...a);
  const warn = (...a) => console.warn("%c[fun-facts]", "color:#e80", ...a);
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

  const lang = (document.documentElement.lang || "fr").slice(0, 2);

  // ----------------------- Normalisation sources -----------------------
  const toUrl = (x)=>{ try{return String(x||"").trim();}catch{return "";} };
  const niceLabel = (u)=> u.replace(/^https?:\/\//,"").slice(0,95);

  function normOneSource(s){
    if (s==null) return null;
    if (typeof s === "string"){
      const href = toUrl(s); if (!href) return null;
      return { href, label:niceLabel(href) };
    }
    if (typeof s === "object"){
      const href = toUrl(s.url || s.href || s.link || "");
      if (!href) return null;
      const label = toUrl(s.label || s.title || s.name || "") || niceLabel(href);
      return { href, label };
    }
    const href = toUrl(s); if (!href) return null;
    return { href, label:niceLabel(href) };
  }
  function normSources(arr){
    if (!arr) return [];
    if (!Array.isArray(arr)) arr=[arr];
    const out=[]; for(const s of arr){ const v=normOneSource(s); if(v) out.push(v); }
    return out;
  }

  // ----------------------- Fallback seed -----------------------
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

  // ----------------------- Fetch layer -----------------------
  const API = "/api/facts";
  const LOCAL_JSON = "/facts-data.json";

  function normalizeList(list){
    return (list||[]).map((it,i)=>{
      const id = it.id || `tmp:${i}:${(it.title||"").slice(0,40)}`;
      return ({
        id,
        type: it.type || "myth",
        category: it.category || "Général",
        title: it.title || (it.type==="fact"?"Fait":"Mythe"),
        body: it.body || "",
        sources: normSources(it.sources)
      });
    });
  }

  async function tryAPI(params){
    try{
      const qs  = new URLSearchParams(params||{}).toString();
      const url = `${API}?${qs}`;
      log("Fetch API:", url);
      const r = await fetch(url, { headers:{ "x-ff":"1" }});
      if (!r.ok) throw new Error(`API ${r.status}`);
      const json = await r.json();
      if (!Array.isArray(json)) throw new Error("API non-array");
      const n = normalizeList(json);
      log(`→ API OK (${n.length} items)`);
      return n;
    }catch(e){ warn("API fallback:", e?.message||e); return []; }
  }

  async function tryLocalJSON(){
    try{
      log("Fetch JSON local:", LOCAL_JSON);
      const r = await fetch(LOCAL_JSON);
      if (!r.ok) throw new Error(`JSON ${r.status}`);
      const json = await r.json();
      const arr  = Array.isArray(json) ? json : (json.items||[]);
      const n    = normalizeList(arr);
      log(`→ JSON local OK (${n.length} items)`);
      return n;
    }catch(e){ warn("JSON local fallback:", e?.message||e); return []; }
  }

  function pickFrom(list, params={}){
    let out = list.slice();
    const n    = Number(params.n)||undefined;
    const kind = params.kind;
    const seen = new Set((params.seen||"").split(",").filter(Boolean));
    if (kind) out = out.filter(x=>x.type===kind);
    if (seen.size) out = out.filter(x=>!seen.has(x.id));
    shuffle(out);
    if (n) out = out.slice(0,n);
    return out;
  }

  async function fetchFacts(params){
    const api = await tryAPI(params);
    if (api.length) return api;
    const loc = await tryLocalJSON();
    if (loc.length) return pickFrom(loc, params);
    return normalizeList(SEED);
  }

  // ----------------------- Cartes (haut) -----------------------
  const cardsWrap   = $("#cards");           // EXISTANT
  const btnNewSet   = $("#btnNewSet");       // optionnel
  const btnOneFact  = $("#btnOneFact");      // optionnel
  const btnOneMyth  = $("#btnOneMyth");      // optionnel
  const cardsFilter = $("#cardsFilter");     // optionnel (groupe de boutons data-filter)

  let CARDS = [];
  const seenCards = new Set();
  let FILTER = "all";

  function passFilter(it){
    const t = it.type||"unknown";
    return FILTER==="all" || (FILTER==="fact" && t==="fact") || (FILTER==="myth" && t==="myth");
  }

  function renderSources(container, sources){
    if (!container) return;
    container.innerHTML = "";
    if (!Array.isArray(sources) || !sources.length) return;
    const title = document.createElement("div");
    title.innerHTML = "<strong>Sources :</strong>";
    const ul = document.createElement("ul");
    ul.style.margin = ".2rem 0 0 1rem";
    for (const s of sources){
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = s.href; a.target = "_blank"; a.rel = "noopener";
      a.textContent = s.label || s.href;
      li.appendChild(a); ul.appendChild(li);
    }
    container.appendChild(title); container.appendChild(ul);
  }

  function drawCards(list){
    CARDS = list.slice();
    if (!cardsWrap) return;
    cardsWrap.innerHTML = "";
    if (!CARDS.length){
      cardsWrap.innerHTML = `<div style="opacity:.7;padding:.6rem 0">Aucun élément à afficher.</div>`;
      return;
    }
    for (const it of CARDS){
      if (!passFilter(it)) continue;

      const wrap = document.createElement("article");
      wrap.className = "flip";
      wrap.dataset.id = it.id;

      const inner = document.createElement("div"); inner.className = "inner";
      const front = document.createElement("div"); front.className = "face front";
      const back  = document.createElement("div"); back.className  = "face back";

      // FRONT
      const type = document.createElement("div");
      type.className = "type";
      type.textContent = it.type==="fact" ? "⭐ Fait avéré" : it.type==="myth" ? "❓ Mythe" : "💡 Indéterminé";
      const meta = document.createElement("div"); meta.className="meta";
      const cat = document.createElement("span"); cat.className="badge"; cat.textContent = it.category||"Catégorie";
      meta.appendChild(cat);
      const h = document.createElement("div"); h.className="title"; h.textContent=it.title||"(sans titre)";
      front.appendChild(type); front.appendChild(meta); front.appendChild(h);

      // BACK
      const backTitle = document.createElement("div");
      backTitle.className="title"; backTitle.textContent= it.type==="myth" ? "Explication" : "Détail";
      const body = document.createElement("div"); body.className="body"; body.textContent = it.body||"";
      const src  = document.createElement("div"); src.className="sources"; renderSources(src, it.sources);
      back.appendChild(backTitle); back.appendChild(body); back.appendChild(src);

      inner.appendChild(front); inner.appendChild(back); wrap.appendChild(inner);
      // clic = flip (utile mobile)
      wrap.addEventListener("click", ()=> wrap.classList.toggle("is-flipped"));
      cardsWrap.appendChild(wrap);
    }
  }

  async function loadInitialCards(){
    if (!cardsWrap) return; // si pas de conteneur, on ne fait rien
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

  // ----------------------- Nuage (bas, EXISTANT) -----------------------
  // On ne crée rien. Si #cloud existe, on l’alimente. Sinon on n’y touche pas.
  const cloud = $("#cloud");
  const bubbles = [];
  let running = true;

  function labelForCategory(s){
    const w = (s||"").split(/\s+/);
    return (w[0]||"").slice(0,16) + (w[1] ? " " + w[1].slice(0,12) : "");
  }

  function createBubble(item){
    if (!cloud) return;
    const el = document.createElement("div");
    el.className="bubble";
    const r = Math.max(56, Math.min(110, 70 + ((item.title?.length||20)/4)));
    el.style.width=el.style.height= r+"px";
    el.style.left = Math.random()*(Math.max(12, cloud.clientWidth  - r - 10)) + "px";
    el.style.top  = Math.random()*(Math.max(12, cloud.clientHeight - r - 10)) + "px";

    const em = document.createElement("div"); em.className="emoji";
    em.textContent = item.type==="fact"?"⭐":item.type==="myth"?"❓":"💡";
    const lab = document.createElement("div"); lab.className="label"; lab.textContent = labelForCategory(item.category || (item.type==="fact"?"Fait":"Mythe"));
    el.appendChild(em); el.appendChild(lab);
    cloud.appendChild(el);

    const bub = { el, r, x:parseFloat(el.style.left), y:parseFloat(el.style.top), vx:(Math.random()-.5)*0.8, vy:(Math.random()-.5)*0.7, paused:false };

    const stop = ()=>{ bub.paused=true; el.classList.add("paused"); };
    const go   = ()=>{ bub.paused=false; el.classList.remove("paused"); };

    el.addEventListener("mouseenter", stop);
    el.addEventListener("mouseleave", go);
    el.addEventListener("click", stop);

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
        b.el.style.left = b.x+"px"; b.el.style.top = b.y+"px";
      }
    }
    requestAnimationFrame(loop);
  }

  async function loadInitialCloud(){
    if (!cloud) return; // s'il n'existe pas, on ne fait rien
    const list = await fetchFacts({ lang, n: 18 });
    log("Nuage reçu:", list.length);
    list.forEach(createBubble);
  }

  // ----------------------- Wiring -----------------------
  (async function start(){
    // Cartes (haut)
    if (btnNewSet)  btnNewSet.addEventListener("click", newSet);
    if (btnOneMyth) btnOneMyth.addEventListener("click", oneMyth);
    if (btnOneFact) btnOneFact.addEventListener("click", oneFact);
    if (cardsFilter) cardsFilter.addEventListener("click", onFilterClick);

    document.addEventListener("visibilitychange", ()=> (running = document.visibilityState==="visible"));

    await loadInitialCards();  // n'agit que si #cards est présent
    await loadInitialCloud();  // n'agit que si #cloud est présent
    loop();

    log("Connectivité : API utilisée si elle renvoie >0 éléments ; sinon JSON local ; sinon seed.");
  })();
})();
