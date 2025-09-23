/* =========================================================
   Fun Facts — cartes + nuage + lot aléatoire
   Dépendances: aucune (vanilla). Charge /facts-data.json.
   ========================================================= */
(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // --- Lang detection -------------------------------------------------------
  const path = (location.pathname.split('/').pop() || 'fun-facts.html').trim();
  const m = path.match(/^(.+?)(?:-(en|de))?\.html?$/i);
  const lang = (m && m[2]) ? m[2] : 'fr';

  const I18N = {
    fr: {
      searchPh: "Rechercher une idée reçue…",
      random: "🎲 Nouveau lot aléatoire",
      source: "Source",
      seeSource: "Voir la source",
      flip: "Retourner",
      myth: "Mythe",
      fact: "Fait vérifié",
      items: (n) => `${n} idées`,
    },
    en: {
      searchPh: "Search a misconception…",
      random: "🎲 New random batch",
      source: "Source",
      seeSource: "See source",
      flip: "Flip",
      myth: "Myth",
      fact: "Verified fact",
      items: (n) => `${n} items`,
    },
    de: {
      searchPh: "Irrtum suchen…",
      random: "🎲 Neuer zufälliger Satz",
      source: "Quelle",
      seeSource: "Quelle öffnen",
      flip: "Umdrehen",
      myth: "Mythos",
      fact: "Geprüfte Tatsache",
      items: (n) => `${n} Einträge`,
    }
  }[lang];

  // Apply UI strings
  document.addEventListener('DOMContentLoaded', () => {
    const s = $("#ff_search"); if (s) s.placeholder = I18N.searchPh;
    const r = $("#ff_random"); if (r) r.textContent = I18N.random;
  });

  // --- Data loader ----------------------------------------------------------
  async function loadFacts() {
    const candidates = [
      "/facts-data.json",
      "/assets/data/facts-data.json",
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, {cache:"no-store"});
        if (res.ok) return await res.json();
      } catch(e) { /* try next */ }
    }
    return null;
  }

  // --- Helpers --------------------------------------------------------------
  const rnd = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const shuffle = arr => arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
  const words = (txt) => (txt||"").trim().split(/\s+/).filter(Boolean);
  const trimWords = (txt, max=30) => {
    const w = words(txt);
    return w.length<=max ? txt : w.slice(0,max).join(" ")+"…";
  };
  const byLang = (obj, fallback) => (obj && (obj[lang]||obj['en']||obj['fr'])) || fallback || "";

  function pickRandomBatch(all, count=9, q="") {
    let pool = all.slice();
    if (q) {
      const t = q.toLowerCase();
      pool = pool.filter(f =>
        (f.title && f.title.toLowerCase().includes(t)) ||
        (f.claim && f.claim.toLowerCase().includes(t)) ||
        (f.truth && f.truth.toLowerCase().includes(t)) ||
        (f.category && f.category.toLowerCase().includes(t))
      );
    }
    return shuffle(pool).slice(0, count);
  }

  // --- Render cards ---------------------------------------------------------
  function renderCards(root, items) {
    root.innerHTML = "";
    for (const f of items) {
      const title = byLang(f.title, f.claim || "—");
      const claim = byLang(f.claim, title);
      const truth = trimWords(byLang(f.truth, ""), 30);
      const cat = byLang(f.category, f.type || "");
      const source = (f.sources && f.sources[0]) ? f.sources[0] : null;

      const card = document.createElement("article");
      card.className = "ff-card";
      card.innerHTML = `
        <div class="inner" aria-live="polite">
          <div class="ff-face ff-front">
            <div class="ff-tags">
              <span class="ff-badge">${I18N.myth}</span>
              ${cat ? `<span class="ff-badge">${cat}</span>` : ""}
            </div>
            <h3 class="h3" style="margin:4px 0 2px">${title}</h3>
            ${claim && claim!==title ? `<p class="muted" style="margin:0">${claim}</p>` : ""}
            <div class="ff-actions">
              <button class="btn" data-act="flip">${I18N.flip}</button>
              ${source ? `<a class="btn linkish" target="_blank" rel="noopener" href="${source.url}">${I18N.seeSource}</a>` : ""}
            </div>
          </div>
          <div class="ff-face ff-back">
            <div class="ff-tags">
              <span class="ff-badge">${I18N.fact}</span>
              ${cat ? `<span class="ff-badge">${cat}</span>` : ""}
            </div>
            <p style="margin:4px 0 8px">${truth || "—"}</p>
            <div class="ff-actions">
              <button class="btn" data-act="flip">${I18N.flip}</button>
              ${source ? `<a class="btn" target="_blank" rel="noopener" href="${source.url}">${I18N.source}</a>` : ""}
            </div>
          </div>
        </div>
      `;
      card.addEventListener("click", (ev) => {
        const bt = ev.target.closest("[data-act='flip']");
        if (!bt) return;
        card.dataset.flipped = card.dataset.flipped === "1" ? "0" : "1";
      });
      root.appendChild(card);
    }
  }

  // --- Render cloud ---------------------------------------------------------
  function renderCloud(box, items) {
    box.innerHTML = "";
    const pad = 12;
    const W = box.clientWidth || box.offsetWidth || 900;
    const H = Math.max(box.clientHeight || 300, 260);
    const used = [];

    const safePlace = (r) => !used.some(u =>
      Math.hypot((u.x+u.r)-(r.x+r.r), (u.y+u.r)-(r.y+r.r)) < (u.r + r.r + 8)
    );

    for (const f of items) {
      const w = rnd(120, 200);
      const h = rnd(60, 100);
      const r = {x:rnd(pad, Math.max(pad, W-w-pad)), y:rnd(pad, Math.max(pad, H-h-pad)), r:Math.min(w,h)/2};
      let tries = 60;
      while (tries-- && !safePlace(r)) {
        r.x = rnd(pad, Math.max(pad, W-w-pad));
        r.y = rnd(pad, Math.max(pad, H-h-pad));
      }
      used.push(r);

      const b = document.createElement("button");
      b.className = "ff-bubble";
      b.style.left = r.x+"px"; b.style.top = r.y+"px";
      b.style.width = w+"px";  b.style.height = h+"px";
      b.innerHTML = `<span>${byLang(f.title, f.claim || "—")}</span>`;
      b.addEventListener("click", () => {
        // scroll to card and flip
        const idx = items.indexOf(f);
        const card = $$(".ff-card")[idx];
        if (card) {
          card.scrollIntoView({behavior:"smooth", block:"center"});
          setTimeout(()=>{ card.dataset.flipped = "1"; }, 300);
        }
      });
      box.appendChild(b);
    }
  }

  // --- Popover (optionnel : pour afficher toutes les sources d’un item) ----
  function mountPopover() {
    const pop = $("#ff_pop");
    if (!pop) return;
    $("#ff_pop_close").addEventListener("click", ()=> pop.classList.remove("show"));
    pop.addEventListener("click", (e)=>{ if(e.target===pop) pop.classList.remove("show"); });
  }

  // --- Mount ---------------------------------------------------------------
  let ALL = [];
  let CURRENT = [];

  function updateCount(n){ const c=$("#ff_count"); if (c) c.textContent = I18N.items(n); }

  function refresh(batch) {
    const cards = $("#ff_cards");
    const cloud = $("#ff_cloud");
    if (!cards || !cloud) return;
    CURRENT = batch;
    renderCards(cards, batch);
    renderCloud(cloud, batch);
    updateCount(batch.length);
  }

  function newRandomBatch(){
    const q = ($("#ff_search")?.value||"").trim();
    refresh(pickRandomBatch(ALL, 9, q));
  }

  async function main() {
    mountPopover();
    const root = $("#ff_root");
    const data = await loadFacts();
    if (!data || !Array.isArray(data.items||data)) {
      // Fallback simple list
      const list = $("#ff_fallback_list");
      if (list) {
        const demo = (data && (data.items||data)) || [];
        demo.slice(0,20).forEach(f=>{
          const li = document.createElement("li");
          li.innerHTML = `<strong>${byLang(f.title, f.claim||"—")}</strong>
            ${f.sources?.[0] ? ` — <a href="${f.sources[0].url}" target="_blank" rel="noopener">source</a>` : ""}`;
          list.appendChild(li);
        });
      }
      root.classList.remove("ff-pending");
      root.classList.add("ff-ready");
      return;
    }

    ALL = data.items || data;

    // Premier lot
    newRandomBatch();

    // Écoutes
    $("#ff_random")?.addEventListener("click", newRandomBatch);
    $("#ff_search")?.addEventListener("input", () => {
      // filtre + nouveau tirage dans le sous-ensemble
      newRandomBatch();
    });

    // Page « montée »
    root.classList.remove("ff-pending");
    root.classList.add("ff-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
