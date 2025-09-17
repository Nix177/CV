/* Fun Facts — Nuage avec panneau latéral lisible
 * - Bubbles DOM animées (RAf) + collisions bord
 * - Survol/Click -> panneau large (titre, détail, sources cliquables)
 * - La bulle survolée est mise en pause (reprend à la sortie)
 * - Bouton "Mélanger", filtre Fait/Mythe/Tout
 */
(function(){
  "use strict";

  const cloud = document.getElementById("cloud");
  const panel = document.getElementById("factPanel");
  const fpTitle = document.getElementById("fpTitle");
  const fpMeta  = document.getElementById("fpMeta");
  const fpBody  = document.getElementById("fpBody");
  const fpSrc   = document.getElementById("fpSources");
  const fpClose = document.getElementById("fpClose");
  const btnShuffle = document.getElementById("btnShuffle");
  const seg = document.querySelector(".seg");
  const fpOpen = document.getElementById("fpOpen");

  const FURL = "/facts-data.json";

  // Fallback de démo au cas où
  const FALLBACK = [
    {
      id:"brain10", type:"myth", category:"Science",
      title:"On n’utilise que 10 % de notre cerveau",
      body:"Faux : l’imagerie cérébrale montre une activation étendue selon les tâches ; le cerveau fonctionne en réseaux.",
      sources:["https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/"]
    },
    {
      id:"honey", type:"fact", category:"Alimentation",
      title:"Le miel peut se conserver des millénaires",
      body:"Des pots comestibles ont été retrouvés dans des tombes antiques.",
      sources:["https://www.nationalgeographic.com/history/article/131219-ancient-egypt-honey-tombs-beekeeping"]
    }
  ];

  /** @type {Array<{id:string,type:'fact'|'myth'|'unknown',category:string,title:string,body:string,sources?:string[]}>} */
  let DATA = [];

  // Chargement des données
  fetch(FURL)
    .then(r=> r.ok ? r.json() : FALLBACK)
    .catch(()=>FALLBACK)
    .then(json=>{
      // json peut être { items: [...] } ou un tableau direct
      DATA = Array.isArray(json) ? json : (json.items || FALLBACK);
      initCloud();
    });

  // ---------- Nuage ----------
  const bubbles = [];
  let running = true;
  let filter = "all";

  function rand(a,b){ return Math.random()*(b-a)+a; }

  function colorForType(t){
    if (t==="fact") return "#22c55e";
    if (t==="myth") return "#ef4444";
    return "#f59e0b";
  }

  function labelForCategory(s){
    // raccourci visuel : un mot (ou 2) max
    const w = (s||"").split(/\s+/);
    return (w[0]||"").slice(0,16) + (w[1] ? " " + w[1].slice(0,12) : "");
  }

  function createBubble(item, i){
    const el = document.createElement("div");
    el.className = "bubble";
    const r = Math.max(56, Math.min(110, 70 + (item.title?.length||20)/4));
    el.style.width = el.style.height = r + "px";
    el.style.left = rand(10, cloud.clientWidth - r - 10) + "px";
    el.style.top  = rand(10, cloud.clientHeight - r - 10) + "px";

    // mini-emoji selon type
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
      el, item,
      r,
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
      vx: rand(-0.4,0.4) || 0.3,
      vy: rand(-0.35,0.35) || -0.25,
      paused:false
    };
    // Interactions
    const open = ()=> openPanel(bub);
    el.addEventListener("mouseenter", ()=>{ bub.paused = true; el.classList.add("paused"); open(); });
    el.addEventListener("mouseleave", ()=>{ bub.paused = false; el.classList.remove("paused"); /* on ne ferme pas le panneau */ });
    el.addEventListener("click", open);

    bubbles.push(bub);
  }

  function applyFilter(){
    for (const b of bubbles){
      const t = b.item.type || "unknown";
      const show = (filter==="all") || (filter==="fact" && t==="fact") || (filter==="myth" && t==="myth");
      b.el.style.display = show ? "" : "none";
    }
  }

  function initCloud(){
    cloud.style.position = "relative";
    cloud.style.userSelect = "none";

    // créer les bulles
    bubbles.splice(0,bubbles.length);
    cloud.querySelectorAll(".bubble").forEach(n=>n.remove());

    for (let i=0;i<DATA.length;i++){
      // on ne montre qu'un résumé sur la bulle → la fiche longue est dans le panneau
      createBubble(DATA[i], i);
    }
    applyFilter();
    loop();
  }

  function loop(){
    const W = cloud.clientWidth;
    const H = cloud.clientHeight;
    if (running){
      for (const b of bubbles){
        if (b.paused || b.el.style.display==="none") continue;
        b.x += b.vx;
        b.y += b.vy;
        // rebond bord
        if (b.x <= 6 || b.x + b.r >= W-6) b.vx *= -1;
        if (b.y <= 6 || b.y + b.r >= H-6) b.vy *= -1;
        b.el.style.left = b.x + "px";
        b.el.style.top  = b.y + "px";
      }
    }
    requestAnimationFrame(loop);
  }

  // ---------- Panneau détaillé ----------
  function openPanel(b){
    const it = b.item;
    panel.style.display = "block";
    fpTitle.textContent = it.title || "(sans titre)";
    fpBody.textContent  = it.body || "";
    // meta badges
    fpMeta.innerHTML = "";
    const cat = document.createElement("span");
    cat.className = "badge";
    cat.textContent = it.category || "Catégorie";
    fpMeta.appendChild(cat);
    const kind = document.createElement("span");
    kind.className = "badge " + (it.type==="fact" ? "t-true" : it.type==="myth" ? "t-myth" : "t-unknown");
    kind.textContent = it.type==="fact" ? "Fait" : it.type==="myth" ? "Mythe" : "Indéterminé";
    fpMeta.appendChild(kind);

    // sources
    fpSrc.innerHTML = "";
    if (Array.isArray(it.sources) && it.sources.length){
      const h = document.createElement("div");
      h.innerHTML = "<strong>Sources :</strong>";
      fpSrc.appendChild(h);
      const ul = document.createElement("ul");
      ul.style.margin = ".3rem 0 0 .9rem";
      for (const s of it.sources){
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = s; a.target="_blank"; a.rel="noopener";
        a.textContent = s.replace(/^https?:\/\//,"").slice(0,70);
        li.appendChild(a);
        ul.appendChild(li);
      }
      fpSrc.appendChild(ul);
    }

    // lien "ouvrir"
    if (fpOpen) fpOpen.href = "/fun-facts";
  }
  fpClose.addEventListener("click", ()=> panel.style.display="none");

  // ---------- UI ----------
  btnShuffle?.addEventListener("click", ()=>{
    const W = cloud.clientWidth, H = cloud.clientHeight;
    bubbles.forEach(b=>{
      b.x = rand(10, W - b.r - 10);
      b.y = rand(10, H - b.r - 10);
      b.vx = rand(-0.5,0.5)||0.35;
      b.vy = rand(-0.45,0.45)||-0.25;
    });
  });

  seg?.addEventListener("click", (e)=>{
    const btn = e.target.closest("button");
    if (!btn) return;
    seg.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.filter || "all";
    applyFilter();
  });

  // pause quand l’onglet est masqué
  document.addEventListener("visibilitychange", ()=> (running = document.visibilityState==="visible"));
})();
