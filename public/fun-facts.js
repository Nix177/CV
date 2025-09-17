/* Fun Facts — Idées reçues & faits avérés
   - charge facts-data.json
   - recherche/filtre/tri/pagination
   - tirage aléatoire avec "bubbles" (canvas), confetti et popover
   - i18n FR/EN/DE (UI), FR en "vous", DE en "Sie"
*/
(function(){
  const hasUI = typeof window.UI?.setBusy === "function";

  // --- i18n (UI only)
  const LOCALES = {
    fr: {
      title: "Fun Facts — Idées reçues & faits avérés",
      lead: "Une sélection ludique pour rappeler qu’il y a toujours quelque chose à apprendre.",
      search: "Recherche",
      type: "Type",
      cat: "Catégorie",
      sort: "Trier",
      sort_pop_desc: "Popularité ↓",
      sort_pop_asc: "Popularité ↑",
      sort_wow_desc: "Wow ↓",
      sort_wow_asc: "Wow ↑",
      n: "Aléatoire : N",
      random_btn: "🎲 Surprenez-moi",
      top_myths: "Top 50 — Idées reçues",
      top_facts: "50 faits avérés",
      sources: "Sources",
      view_source: "Voir la source",
      prev: "◀",
      next: "▶",
      random_title: "Sélection aléatoire — Visualisation"
    },
    en: {
      title: "Fun Facts — Misconceptions & Verified facts",
      lead: "A playful selection to remind us there's always more to learn.",
      search: "Search",
      type: "Type",
      cat: "Category",
      sort: "Sort",
      sort_pop_desc: "Popularity ↓",
      sort_pop_asc: "Popularity ↑",
      sort_wow_desc: "Wow ↓",
      sort_wow_asc: "Wow ↑",
      n: "Random: N",
      random_btn: "🎲 Surprise me",
      top_myths: "Top 50 — Common misconceptions",
      top_facts: "50 verified facts",
      sources: "Sources",
      view_source: "View source",
      prev: "◀",
      next: "▶",
      random_title: "Random selection — Visualization"
    },
    de: {
      title: "Fun Facts — Irrtümer & bewiesene Fakten",
      lead: "Eine spielerische Auswahl – man lernt nie aus.",
      search: "Suche",
      type: "Typ",
      cat: "Kategorie",
      sort: "Sortieren",
      sort_pop_desc: "Popularität ↓",
      sort_pop_asc: "Popularität ↑",
      sort_wow_desc: "Wow ↓",
      sort_wow_asc: "Wow ↑",
      n: "Zufall: N",
      random_btn: "🎲 Überraschen Sie mich",
      top_myths: "Top 50 — Weitverbreitete Irrtümer",
      top_facts: "50 bewiesene Fakten",
      sources: "Quellen",
      view_source: "Quelle ansehen",
      prev: "◀",
      next: "▶",
      random_title: "Zufallsauswahl — Visualisierung"
    }
  };

  function getLang() {
    const u = (document.documentElement.lang || "fr").toLowerCase();
    if (u.startsWith("de")) return "de";
    if (u.startsWith("en")) return "en";
    return "fr";
  }
  const LANG = getLang();
  const T = LOCALES[LANG];

  // --- DOM
  const titleEl = document.getElementById("ff_title");
  const leadEl = document.getElementById("ff_lead");
  const form = document.getElementById("ff_form");
  const qEl = document.getElementById("q");
  const typeEl = document.getElementById("type");
  const catEl = document.getElementById("cat");
  const sortEl = document.getElementById("sort");
  const nEl = document.getElementById("n");
  const btnRandom = document.getElementById("btn_random");
  const gridMyths = document.getElementById("grid_myths");
  const gridFacts = document.getElementById("grid_facts");
  const pgmPrev = document.getElementById("pgm_prev");
  const pgmNext = document.getElementById("pgm_next");
  const pgmLbl = document.getElementById("pgm_lbl");
  const pgfPrev = document.getElementById("pgf_prev");
  const pgfNext = document.getElementById("pgf_next");
  const pgfLbl = document.getElementById("pgf_lbl");
  const canvas = document.getElementById("ff_canvas");
  const seedLbl = document.getElementById("seed_lbl");
  const hTopMyths = document.getElementById("h_top_myths");
  const hTopFacts = document.getElementById("h_top_facts");
  const hRandom = document.getElementById("h_random");

  // labels
  document.getElementById("lbl_search").textContent = T.search;
  document.getElementById("lbl_type").textContent = T.type;
  document.getElementById("lbl_cat").textContent = T.cat;
  document.getElementById("lbl_sort").textContent = T.sort;
  document.getElementById("lbl_n").textContent = T.n;
  titleEl.textContent = T.title;
  leadEl.textContent = T.lead;
  hTopMyths.textContent = T.top_myths;
  hTopFacts.textContent = T.top_facts;
  hRandom.textContent = T.random_title;
  btnRandom.textContent = T.random_btn;

  // --- State
  const S = {
    items: [],
    myths: [],
    facts: [],
    pageMyths: 1,
    pageFacts: 1,
    pageSize: 10,
    bubbles: [],
    rngSeed: null
  };

  // --- Utils
  const esc = (s)=> (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

  // deterministic RNG for reproducible draws
  function mulberry32(a){ return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function seededShuffle(arr, seed){
    const rnd = mulberry32(seed|0);
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(rnd()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  // --- Fetch data
  init();
  async function init(){
    try{
      const r = await fetch("./facts-data.json");
      const j = await r.json();
      S.items = Array.isArray(j.items) ? j.items : [];
    } catch {
      S.items = [];
    }
    // Top up to 100 (50/50) with placeholders
    topUpPlaceholders(100);

    S.myths = S.items.filter(x=>x.type==="myth").sort((a,b)=>b.popularity-a.popularity).slice(0,50);
    S.facts = S.items.filter(x=>x.type==="fact").sort((a,b)=>b.popularity-a.popularity).slice(0,50);

    renderPages();
    attachEvents();
    // if URL has #random=seed-123-N6
    parseHashAndMaybeDraw();
  }

  function topUpPlaceholders(target){
    const need = Math.max(0, target - S.items.length);
    if (!need) return;
    let needMyth = Math.max(0, 50 - S.items.filter(i=>i.type==="myth").length);
    let needFact = Math.max(0, 50 - S.items.filter(i=>i.type==="fact").length);
    const CATS = ["Science","Histoire","Santé","Langue","Culture","Technologie","Nature","Géographie"];
    let idx = 1;
    while(needMyth>0 || needFact>0){
      const cat = CATS[(idx-1)%CATS.length];
      if (needMyth>0){
        S.items.push({
          id: `myth-todo-${idx}`, type:"myth", category: cat,
          title: "TODO — Idée reçue", claim: "TODO",
          truth: "TODO — À compléter.",
          sources: [], popularity: Math.random()*0.7+0.2, wow_rating: Math.random()*0.6+0.2
        });
        needMyth--; idx++;
      }
      if (needFact>0){
        const c2 = CATS[(idx-1)%CATS.length];
        S.items.push({
          id: `fact-todo-${idx}`, type:"fact", category: c2,
          title: "TODO — Fait avéré", claim: "TODO",
          truth: "TODO — À compléter.",
          sources: [], popularity: Math.random()*0.7+0.2, wow_rating: Math.random()*0.6+0.2
        });
        needFact--; idx++;
      }
    }
  }

  // --- Rendering pagination
  function renderPages(){
    renderList(S.myths, S.pageMyths, gridMyths, pgmLbl);
    renderList(S.facts, S.pageFacts, gridFacts, pgfLbl);
  }

  function renderList(list, page, into, lbl){
    const totalPages = Math.max(1, Math.ceil(list.length / S.pageSize));
    page = clamp(page, 1, totalPages);
    if (into === gridMyths) S.pageMyths = page;
    if (into === gridFacts) S.pageFacts = page;

    const start = (page-1)*S.pageSize;
    const slice = list.slice(start, start + S.pageSize);

    into.innerHTML = slice.map(cardHTML).join("");
    // attach flip handlers
    into.querySelectorAll(".ff-card").forEach(card=>{
      card.addEventListener("click", (e)=>{
        if (e.target.closest("a")) return; // keep link clickable
        card.classList.toggle("is-flipped");
      });
      card.addEventListener("keydown", (e)=>{
        if (e.key === "Enter") card.classList.toggle("is-flipped");
      });
      card.setAttribute("tabindex","0");
    });
    lbl.textContent = `${page}/${totalPages}`;
  }

  function iconFor(cat, type){
    const m = {Science:"🧪", Histoire:"🏛️", Santé:"🩺", Langue:"🗣️", Culture:"🎭", Technologie:"🛰️", Nature:"🌿", Géographie:"🌍"};
    return type==="myth" ? "❓" : (m[cat]||"⭐");
  }

  function cardHTML(it){
    const title = localize(it, "title");
    const claim = localize(it, "claim");
    const truth = localize(it, "truth");
    const srcs = (it.sources||[]).map(s=>`<a class="btn chip" target="_blank" rel="noopener" href="${esc(s.url)}">${esc(T.view_source)}</a>`).join(" ");
    return `
      <article class="ff-card" aria-label="${esc(title)}">
        <div class="inner">
          <div class="face front">
            <div class="row gap" style="justify-content:space-between;align-items:center">
              <span style="font-size:1.4rem">${iconFor(it.category, it.type)}</span>
              <span class="ff-badge">${esc(it.type==="myth"?"Myth":"Fact")}</span>
            </div>
            <h3 style="margin:.2rem 0">${esc(title)}</h3>
            <div class="ff-badges">
              <span class="ff-badge">${esc(it.category||"")}</span>
              <span class="ff-badge">★ ${(it.popularity||0).toFixed(2)}</span>
              <span class="ff-badge">✨ ${(it.wow_rating||0).toFixed(2)}</span>
            </div>
            <p class="muted" style="margin-top:6px">${esc(claim||"")}</p>
            <p class="muted" style="margin-top:auto">${esc(T.sources)} · ${(it.sources||[]).length}</p>
          </div>
          <div class="face back">
            <h4>${esc(title)}</h4>
            <p class="muted">${esc(claim||"")}</p>
            <p>${esc(truth||"")}</p>
            <div class="row gap" style="margin-top:auto">${srcs}</div>
          </div>
        </div>
      </article>
    `;
  }

  function localize(it, key){
    const lo = it.lang_overrides?.[LANG];
    return lo?.[key] ?? it[key];
  }

  // --- Filters/search/sort apply (not paginated sections, but can be used later if needed)
  form.addEventListener("input", ()=>{
    // re-order by sort for top lists (the filtering inputs are mostly for random draw context)
    const sort = sortEl.value;
    const cmp = {
      pop_desc:(a,b)=>b.popularity-a.popularity,
      pop_asc:(a,b)=>a.popularity-b.popularity,
      wow_desc:(a,b)=>b.wow_rating-a.wow_rating,
      wow_asc:(a,b)=>a.wow_rating-b.wow_rating
    }[sort] || ((a,b)=>b.popularity-a.popularity);
    S.myths.sort(cmp);
    S.facts.sort(cmp);
    S.pageMyths = 1; S.pageFacts = 1;
    renderPages();
  });

  // pagers
  pgmPrev.onclick = ()=>{S.pageMyths=Math.max(1,S.pageMyths-1);renderPages();};
  pgmNext.onclick = ()=>{S.pageMyths+=1;renderPages();};
  pgfPrev.onclick = ()=>{S.pageFacts=Math.max(1,S.pageFacts-1);renderPages();};
  pgfNext.onclick = ()=>{S.pageFacts+=1;renderPages();};

  // --- RANDOM DRAW + BUBBLES
  function parseHashAndMaybeDraw(){
    const m = (location.hash||"").match(/#random=seed-(\d+)-N(\d+)/);
    if (m){
      S.rngSeed = +m[1]; const N = clamp(+m[2]||6,3,12);
      nEl.value = N;
      doRandom(N, S.rngSeed);
    }
  }

  btnRandom.addEventListener("click", async ()=>{
    const N = clamp(+nEl.value||6, 3, 12);
    const seed = Math.floor(Math.random()*1e9);
    location.hash = `random=seed-${seed}-N${N}`;
    await doRandom(N, seed);
  });

  async function doRandom(N, seed){
    hasUI && UI.setBusy(btnRandom, true);
    seedLbl.textContent = `Seed ${seed} · N=${N}`;
    announce((LANG==="fr")?`Tirage de ${N} éléments…`:(LANG==="de")?`Ziehung von ${N} Elementen…`:`Drawing ${N} items…`);

    // Slot-machine text animation (700–1200ms)
    await animateSlot(["🤯","🧠","🌍","🧪","🛰️","🐙","🍌","⚡"], 900);

    // compute candidate pool based on controls (type/cat/search)
    const pool = filterPool();
    const ordered = seededShuffle(pool, seed);
    const pick = ordered.slice(0, N);

    // render bubbles
    renderBubbles(pick);
    confetti();

    hasUI && UI.setBusy(btnRandom, false);
  }

  function filterPool(){
    const q = (qEl.value||"").toLowerCase();
    const tp = typeEl.value; // all/myth/fact
    const cat = catEl.value; // all or name
    const list = S.items.filter(it=>{
      if (tp!=="all" && it.type!==tp) return false;
      if (cat!=="all" && it.category!==cat) return false;
      if (q){
        const title = (localize(it,"title")||"").toLowerCase();
        const claim = (localize(it,"claim")||"").toLowerCase();
        const truth = (localize(it,"truth")||"").toLowerCase();
        if (!(title.includes(q)||claim.includes(q)||truth.includes(q))) return false;
      }
      return true;
    });
    return list;
  }

  // slot machine animation
  function animateSlot(labels, dur=900){
    return new Promise(resolve=>{
      const start = performance.now();
      const id = setInterval(()=>{
        seedLbl.textContent = labels[Math.floor(Math.random()*labels.length)];
        if (performance.now()-start>dur){ clearInterval(id); resolve(); }
      }, 80);
    }).then(()=>{ seedLbl.textContent = seedLbl.textContent.replace(/.$/,""); });
  }

  // bubbles canvas
  const ctx = canvas.getContext("2d");
  function renderBubbles(items){
    const W = canvas.width, H = canvas.height;
    // build nodes
    const nodes = items.map((it,i)=>{
      const r = 30 + Math.round((it.wow_rating||0.5)*40);
      return {
        it, x: 80 + Math.random()*(W-160), y: 80 + Math.random()*(H-160),
        vx: (Math.random()-0.5)*2, vy:(Math.random()-0.5)*2, r
      };
    });
    S.bubbles = nodes;
    // animate
    let raf;
    function step(){
      ctx.clearRect(0,0,W,H);
      // physics
      for (let i=0;i<nodes.length;i++){
        const a = nodes[i];
        // mild gravity-like drift
        a.vy += 0.02;
        // repel neighbors
        for (let j=i+1;j<nodes.length;j++){
          const b = nodes[j];
          const dx = b.x-a.x, dy = b.y-a.y;
          const d2 = dx*dx+dy*dy, d=Math.sqrt(d2);
          const min = a.r+b.r+4;
          if (d<min && d>0.0001){
            const nx=dx/d, ny=dy/d;
            const push = (min-d)*0.02;
            a.vx -= nx*push; a.vy -= ny*push;
            b.vx += nx*push; b.vy += ny*push;
          }
        }
        // walls
        a.x += a.vx; a.y += a.vy;
        a.vx *= 0.995; a.vy *= 0.995;
        if (a.x<a.r){a.x=a.r; a.vx*=-0.9;}
        if (a.x>W-a.r){a.x=W-a.r; a.vx*=-0.9;}
        if (a.y<a.r){a.y=a.r; a.vy*=-0.9;}
        if (a.y>H-a.r){a.y=H-a.r; a.vy*=-0.9;}
      }
      // draw
      for (const n of nodes){
        // circle
        ctx.beginPath();
        ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,.25)";
        ctx.stroke();
        // title
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const t = (localize(n.it,"title")||"").slice(0,28);
        wrapText(ctx, t, n.x, n.y, n.r*1.6, 16);
      }
      raf = requestAnimationFrame(step);
    }
    cancelAnimationFrame(raf);
    step();

    // click → popover
    canvas.onclick = (e)=>{
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX-rect.left) * (canvas.width/rect.width);
      const my = (e.clientY-rect.top) * (canvas.height/rect.height);
      const hit = nodes.find(n=> (mx-n.x)**2 + (my-n.y)**2 <= n.r**2);
      if (hit){ openPopover(hit.it); }
    };
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight){
    const words = text.split(" ");
    let line = "", yy=y-(lineHeight/2);
    const lines=[];
    for (let w of words){
      const test = line ? line+" "+w : w;
      if (ctx.measureText(test).width > maxWidth){
        lines.push(line); line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    const offset = (lines.length-1)*lineHeight/2;
    lines.forEach((ln,i)=> ctx.fillText(ln, x, y - offset + i*lineHeight));
  }

  // popover
  const pop = document.getElementById("ff_pop");
  const popTitle = document.getElementById("pop_title");
  const popClaim = document.getElementById("pop_claim");
  const popTruth = document.getElementById("pop_truth");
  const popSources = document.getElementById("pop_sources");
  const popClose = document.getElementById("pop_close");
  popClose.onclick = ()=> pop.classList.remove("show");
  pop.addEventListener("click", (e)=>{ if (e.target===pop) pop.classList.remove("show"); });

  function openPopover(it){
    popTitle.textContent = localize(it,"title") || "";
    popClaim.textContent = localize(it,"claim") || "";
    popTruth.textContent = localize(it,"truth") || "";
    popSources.innerHTML = (it.sources||[]).map(s=>`<a class="btn chip" target="_blank" rel="noopener" href="${esc(s.url)}">${esc(T.view_source)}</a>`).join(" ");
    pop.classList.add("show");
  }

  // confetti (simple DOM)
  function confetti(){
    const ctn = document.body;
    for (let i=0;i<40;i++){
      const p = document.createElement("div");
      p.style.position="fixed"; p.style.left=(Math.random()*100)+"vw"; p.style.top=(-10)+"px";
      p.style.width="6px"; p.style.height="10px"; p.style.background=`hsl(${Math.random()*360},90%,60%)`;
      p.style.opacity="0.9"; p.style.transform=`rotate(${Math.random()*180}deg)`;
      p.style.transition="transform 1.2s linear, top 1.2s linear, opacity .3s ease 1s";
      ctn.appendChild(p);
      requestAnimationFrame(()=>{
        p.style.top=(90+Math.random()*10)+"vh";
        p.style.transform+=` translateY(${80+Math.random()*20}vh) rotate(${Math.random()*720}deg)`;
        setTimeout(()=>{ p.style.opacity="0"; setTimeout(()=>p.remove(), 300); }, 1100);
      });
    }
  }

  // aria-live announce
  function announce(msg){
    const el = document.getElementById("ff_announce");
    el.textContent = msg;
  }

})();
