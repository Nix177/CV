/* Fun Facts — Cartes compactes + Nuage avec tooltip
   - Tirage aléatoire sur fallback JSON (boutons efficaces)
   - Tooltip lisible sur les bulles (titre + corps + sources cliquables)
   - Police réduite pour les cartes
   - Nettoyage d’un éventuel nuage dupliqué
*/
(function () {
  "use strict";

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rand = (a, b) => Math.random() * (b - a) + a;
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

  const log = (...args) => console.log("%c[fun-facts]", "color:#08c", ...args);
  const warn = (...args) => console.warn("%c[fun-facts]", "color:#e80", ...args);

  const lang = (document.documentElement.lang || "fr").slice(0, 2);

  // Injecte un style compact pour les cartes
  (function injectCSS() {
    const css = `
      #ff-cards-section .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
      #ff-cards-section .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px 12px}
      #ff-cards-section .card .type{font-size:.8rem;opacity:.9;margin-bottom:6px}
      #ff-cards-section .card .title{font-size:1rem;line-height:1.25;margin:4px 0 6px}
      #ff-cards-section .card .body{font-size:.9rem;line-height:1.3;opacity:.95}
      #ff-cards-section .badge{display:inline-block;font-size:.75rem;padding:.15rem .45rem;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);margin-right:6px}
      #ff-cloud-section .cloud-wrap{position:relative;min-height:420px;border:1px dashed rgba(255,255,255,.15);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(0,0,0,.04))}
      .bubble{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:999px;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.85),rgba(255,255,255,.6));border:1px solid rgba(255,255,255,.4);box-shadow:0 8px 18px rgba(0,0,0,.25);cursor:pointer;transition:transform .15s ease}
      .bubble .emoji{position:absolute;top:6px;left:8px;font-size:16px;opacity:.9}
      .bubble .label{font-weight:600;opacity:.9;text-align:center;padding:0 10px}
      .bubble.paused{outline:2px solid rgba(255,255,255,.35);z-index:3}
      /* Tooltip */
      #ffTooltip{position:absolute;max-width:min(520px,85vw);z-index:9999;background:rgba(15,23,42,.98);color:#e5e7eb;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:12px 14px;box-shadow:0 12px 28px rgba(0,0,0,.45);display:none}
      #ffTooltip h4{margin:0 0 6px 0;font-size:1rem}
      #ffTooltip .meta{margin-bottom:6px}
      #ffTooltip .badge{display:inline-block;font-size:.7rem;padding:.1rem .4rem;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);margin-right:6px}
      #ffTooltip p{margin:6px 0 6px 0;font-size:.9rem;line-height:1.3}
      #ffTooltip .sources ul{margin:.2rem 0 0 1rem}
      #ffTooltip .sources a{color:#93c5fd;text-decoration:none}
      #ffTooltip .sources a:hover{text-decoration:underline}
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // ---------- Normalisation sources ----------
  function toUrlString(x) {
    try {
      return String(x || "").trim();
    } catch {
      return "";
    }
  }
  function niceLabelFromUrl(u) {
    if (!u) return "";
    return u.replace(/^https?:\/\//, "").slice(0, 95);
  }
  function normalizeOneSource(s) {
    if (!s && s !== 0) return null;
    if (typeof s === "string") {
      const href = toUrlString(s);
      if (!href) return null;
      return { href, label: niceLabelFromUrl(href) };
    }
    if (typeof s === "object") {
      const href = toUrlString(s.url || s.href || s.link || "");
      if (!href) return null;
      const label =
        toUrlString(s.label || s.title || s.name || "") || niceLabelFromUrl(href);
      return { href, label };
    }
    const href = toUrlString(s);
    if (!href) return null;
    return { href, label: niceLabelFromUrl(href) };
  }
  function normalizeSources(arr) {
    if (!arr) return [];
    if (!Array.isArray(arr)) arr = [arr];
    const out = [];
    for (const s of arr) {
      const v = normalizeOneSource(s);
      if (v && v.href) out.push(v);
    }
    return out;
  }

  // ---------- Seed minimal ----------
  const SEED = [
    {
      id: "seed:brain10",
      type: "myth",
      category: "Science",
      title: "On n’utilise que 10 % de notre cerveau.",
      body:
        "Faux : l’imagerie cérébrale montre que l’activité varie selon les tâches ; le cerveau fonctionne en réseaux.",
      sources: [
        "https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/",
      ],
    },
    {
      id: "seed:honey",
      type: "fact",
      category: "Alimentation",
      title: "Le miel peut se conserver des millénaires.",
      body:
        "Des pots comestibles ont été retrouvés dans des tombes antiques égyptiennes.",
      sources: [
        "https://www.nationalgeographic.com/history/article/131219-ancient-egypt-honey-tombs-beekeeping",
      ],
    },
  ];

  // ---------- Fetch ----------
  const API = "/api/facts";
  const LOCAL_JSON = "/facts-data.json";

  function normalizeList(list) {
    return (list || []).map((it, i) => {
      const id = it.id || `tmp:${i}:${(it.title || "").slice(0, 40)}`;
      const type = it.type || "myth";
      const category = it.category || "Général";
      const title = it.title || (type === "fact" ? "Fait" : "Mythe");
      const body = it.body || "";
      const sources = normalizeSources(it.sources);
      return { id, type, category, title, body, sources };
    });
  }

  async function tryAPI(params) {
    try {
      const qs = new URLSearchParams(params || {}).toString();
      const url = `${API}?${qs}`;
      log("Fetch API:", url);
      const r = await fetch(url, { headers: { "x-ff": "1" } });
      if (!r.ok) throw new Error(`API status ${r.status}`);
      const json = await r.json();
      if (!Array.isArray(json)) throw new Error("API non-array");
      const n = normalizeList(json);
      log(`→ API OK (${n.length} items)`);
      return n;
    } catch (e) {
      warn("API fallback:", e?.message || e);
      return [];
    }
  }

  async function tryLocalJSON() {
    try {
      log("Fetch JSON local:", LOCAL_JSON);
      const r = await fetch(LOCAL_JSON);
      if (!r.ok) throw new Error(`JSON status ${r.status}`);
      const json = await r.json();
      const arr = Array.isArray(json) ? json : json.items || [];
      const n = normalizeList(arr);
      log(`→ JSON local OK (${n.length} items)`);
      return n;
    } catch (e) {
      warn("JSON local fallback:", e?.message || e);
      return [];
    }
  }

  // Sélection client-side quand on est en fallback JSON
  function pickFrom(list, params = {}) {
    let out = list.slice();
    const n = Number(params.n) || undefined;
    const kind = params.kind;
    const seen = new Set((params.seen || "").split(",").filter(Boolean));
    if (kind) out = out.filter((x) => x.type === kind);
    if (seen.size) out = out.filter((x) => !seen.has(x.id));
    shuffle(out);
    if (n) out = out.slice(0, n);
    return out;
  }

  async function fetchFacts(params) {
    const api = await tryAPI(params);
    if (api.length) return api; // l'API donne déjà le sous-ensemble

    const loc = await tryLocalJSON();
    if (loc.length) return pickFrom(loc, params);

    return normalizeList(SEED);
  }

  // ---------- DOM ----------
  function ensureDOM() {
    const root = $(".container") || $("main") || document.body;

    // Section Cartes
    let cardsSection = $("#ff-cards-section");
    if (!cardsSection) {
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

    // Section Nuage (évite les doublons)
    let cloudSection = $("#ff-cloud-section");
    if (!cloudSection) {
      cloudSection = document.createElement("section");
      cloudSection.id = "ff-cloud-section";
      cloudSection.innerHTML = `
        <h2>Fun Facts</h2>
        <div class="controls">
          <button id="btnShuffle" class="btn">Mélanger le nuage</button>
          <span style="opacity:.75">Survolez / cliquez une bulle pour le détail.</span>
        </div>
        <div id="cloud" class="cloud-wrap"></div>
      `;
      root.appendChild(cloudSection);
    }

    // S'il existe des .cloud-wrap en double (hérités), on garde le premier
    const allClouds = $$(".cloud-wrap");
    if (allClouds.length > 1) {
      for (let i = 1; i < allClouds.length; i++) {
        allClouds[i].remove();
      }
    }

    return {
      cardsWrap: $("#cards"),
      segFilter: $(".seg"),
      btnNewSet: $("#btnNewSet"),
      btnOneFact: $("#btnOneFact"),
      btnOneMyth: $("#btnOneMyth"),
      cloud: $("#cloud"),
      btnShuffle: $("#btnShuffle"),
    };
  }

  // ---------- Réfs & State ----------
  let cardsWrap, segFilter, btnNewSet, btnOneFact, btnOneMyth, cloud, btnShuffle;
  let FILTER = "all";
  let CARDS = [];
  const seenCards = new Set();

  const bubbles = [];
  let running = true;
  let tooltip;

  // ---------- Cartes ----------
  function passFilter(item) {
    const t = item.type || "unknown";
    return FILTER === "all" || (FILTER === "fact" && t === "fact") || (FILTER === "myth" && t === "myth");
  }

  function drawEmpty(target, msg) {
    if (!target) return;
    target.innerHTML = `<div style="opacity:.7;padding:1rem 0">${msg}</div>`;
  }

  function renderSourcesBlock(container, sources) {
    if (!container) return;
    container.innerHTML = "";
    if (!Array.isArray(sources) || !sources.length) return;
    const title = document.createElement("div");
    title.innerHTML = "<strong>Sources :</strong>";
    const ul = document.createElement("ul");
    ul.style.margin = ".2rem 0 0 1rem";
    for (const s of sources) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = s.href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = s.label || niceLabelFromUrl(s.href);
      li.appendChild(a);
      ul.appendChild(li);
    }
    container.appendChild(title);
    container.appendChild(ul);
  }

  function drawCards(list) {
    CARDS = list.slice();
    if (!cardsWrap) return;
    cardsWrap.innerHTML = "";
    if (!CARDS.length) {
      drawEmpty(cardsWrap, "Aucun élément à afficher.");
      return;
    }
    for (const item of CARDS) {
      if (!passFilter(item)) continue;
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.id = item.id;

      const type = document.createElement("div");
      type.className = "type " + (item.type || "unknown");
      type.textContent = item.type === "fact" ? "⭐ Fait avéré" : item.type === "myth" ? "❓ Mythe" : "💡 Indéterminé";
      card.appendChild(type);

      const meta = document.createElement("div");
      meta.className = "meta";
      const cat = document.createElement("span");
      cat.className = "badge";
      cat.textContent = item.category || "Catégorie";
      meta.appendChild(cat);
      card.appendChild(meta);

      const h = document.createElement("div");
      h.className = "title";
      h.textContent = item.title || "(sans titre)";
      card.appendChild(h);

      const p = document.createElement("div");
      p.className = "body";
      p.textContent = item.body || "";
      card.appendChild(p);

      if (Array.isArray(item.sources) && item.sources.length) {
        const s = document.createElement("div");
        s.className = "sources";
        renderSourcesBlock(s, item.sources);
        card.appendChild(s);
      }

      cardsWrap.appendChild(card);
    }
  }

  async function loadInitialCards() {
    const list = await fetchFacts({ lang, n: 8 });
    log("Cartes initiales reçues:", list.length);
    list.forEach((x) => seenCards.add(x.id));
    drawCards(list);
  }

  async function newSet() {
    const list = await fetchFacts({ lang, n: 8, seen: Array.from(seenCards).join(",") });
    log("Nouveau lot:", list.length);
    list.forEach((x) => seenCards.add(x.id));
    drawCards(list);
  }

  async function oneMyth() {
    const list = await fetchFacts({ lang, kind: "myth", n: 1, seen: Array.from(seenCards).join(",") });
    log("Un mythe:", list.length);
    list.forEach((x) => seenCards.add(x.id));
    drawCards(list);
  }

  async function oneFact() {
    const list = await fetchFacts({ lang, kind: "fact", n: 1, seen: Array.from(seenCards).join(",") });
    log("Un fait:", list.length);
    list.forEach((x) => seenCards.add(x.id));
    drawCards(list);
  }

  function onFilterClick(e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    segFilter?.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    FILTER = btn.dataset.filter || "all";
    drawCards(CARDS);
  }

  // ---------- Tooltip ----------
  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.id = "ffTooltip";
    tooltip.innerHTML = `
      <h4 id="ttTitle">—</h4>
      <div id="ttMeta" class="meta"></div>
      <p id="ttBody"></p>
      <div id="ttSources" class="sources"></div>
    `;
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function positionTooltipAround(el, preferTop = true) {
    const t = ensureTooltip();
    const r = el.getBoundingClientRect();
    const pad = 10;
    const tw = t.offsetWidth || 320;
    const th = t.offsetHeight || 120;

    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));

    let y = preferTop ? r.top - th - pad : r.bottom + pad;
    if (y < 4) y = r.bottom + pad;
    if (y + th > window.innerHeight - 4) y = Math.max(4, r.top - th - pad);

    t.style.left = `${x}px`;
    t.style.top = `${y + window.scrollY}px`;
  }

  function showTooltipFor(item, anchorEl) {
    const t = ensureTooltip();
    const ttTitle = $("#ttTitle", t);
    const ttMeta = $("#ttMeta", t);
    const ttBody = $("#ttBody", t);
    const ttSources = $("#ttSources", t);

    ttTitle.textContent = item.title || "(sans titre)";
    ttMeta.innerHTML = "";
    const c = document.createElement("span");
    c.className = "badge";
    c.textContent = item.category || "Catégorie";
    ttMeta.appendChild(c);
    const k = document.createElement("span");
    k.className = "badge";
    k.textContent = item.type === "fact" ? "Fait" : item.type === "myth" ? "Mythe" : "Indéterminé";
    ttMeta.appendChild(k);

    ttBody.textContent = item.body || "";

    ttSources.innerHTML = "";
    if (item.sources?.length) {
      const h = document.createElement("div");
      h.innerHTML = "<strong>Sources :</strong>";
      const ul = document.createElement("ul");
      ul.style.margin = ".2rem 0 0 1rem";
      for (const s of item.sources) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = s.href;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = s.label || niceLabelFromUrl(s.href);
        li.appendChild(a);
        ul.appendChild(li);
      }
      ttSources.appendChild(h);
      ttSources.appendChild(ul);
    }

    t.style.display = "block";
    positionTooltipAround(anchorEl, true);
  }

  function hideTooltip() {
    if (tooltip) tooltip.style.display = "none";
  }

  // ---------- Nuage ----------
  function labelForCategory(s) {
    const w = (s || "").split(/\s+/);
    return (w[0] || "").slice(0, 16) + (w[1] ? " " + w[1].slice(0, 12) : "");
  }

  function createBubble(item) {
    if (!cloud) return;
    const el = document.createElement("div");
    el.className = "bubble";
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", item.title || "fun fact");

    const r = Math.max(56, Math.min(110, 70 + ((item.title?.length || 20) / 4)));
    el.style.width = el.style.height = r + "px";
    el.style.left = rand(10, Math.max(12, cloud.clientWidth - r - 10)) + "px";
    el.style.top = rand(10, Math.max(12, cloud.clientHeight - r - 10)) + "px";

    const em = document.createElement("div");
    em.className = "emoji";
    em.textContent = item.type === "fact" ? "⭐" : item.type === "myth" ? "❓" : "💡";
    el.appendChild(em);

    const lab = document.createElement("div");
    lab.className = "label";
    lab.textContent = labelForCategory(item.category || (item.type === "fact" ? "Fait" : "Mythe"));
    el.appendChild(lab);

    cloud.appendChild(el);

    const bub = {
      el,
      item,
      r,
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
      vx: rand(-0.4, 0.4) || 0.3,
      vy: rand(-0.35, 0.35) || -0.25,
      paused: false,
    };

    const show = () => {
      bub.paused = true;
      el.classList.add("paused");
      showTooltipFor(item, el);
    };
    const hide = () => {
      bub.paused = false;
      el.classList.remove("paused");
      hideTooltip();
    };

    el.addEventListener("mouseenter", show);
    el.addEventListener("mouseleave", hide);
    el.addEventListener("click", show);

    bubbles.push(bub);
  }

  function loop() {
    if (!cloud) return;
    const W = cloud.clientWidth,
      H = cloud.clientHeight;
    if (running) {
      for (const b of bubbles) {
        if (b.paused) continue;
        b.x += b.vx;
        b.y += b.vy;
        if (b.x <= 6 || b.x + b.r >= W - 6) b.vx *= -1;
        if (b.y <= 6 || b.y + b.r >= H - 6) b.vy *= -1;
        b.el.style.left = b.x + "px";
        b.el.style.top = b.y + "px";
      }
    }
    requestAnimationFrame(loop);
  }

  async function loadInitialCloud() {
    const list = await fetchFacts({ lang, n: 18 });
    log("Nuage reçu:", list.length);
    if (!list.length) {
      const empty = document.createElement("div");
      empty.style.opacity = ".7";
      empty.style.padding = "1rem 0";
      empty.textContent = "Aucun élément pour le nuage.";
      cloud.appendChild(empty);
      return;
    }
    list.forEach(createBubble);
  }

  function shuffleCloud() {
    if (!cloud) return;
    const W = cloud.clientWidth,
      H = cloud.clientHeight;
    bubbles.forEach((b) => {
      b.x = rand(10, Math.max(12, W - b.r - 10));
      b.y = rand(10, Math.max(12, H - b.r - 10));
      b.vx = rand(-0.5, 0.5) || 0.35;
      b.vy = rand(-0.45, 0.45) || -0.25;
      b.el.style.left = b.x + "px";
      b.el.style.top = b.y + "px";
    });
    hideTooltip();
  }

  // ---------- Start ----------
  (async function start() {
    const refs = ensureDOM();
    ({ cardsWrap, segFilter, btnNewSet, btnOneFact, btnOneMyth, cloud, btnShuffle } = refs);

    document.addEventListener("visibilitychange", () => (running = document.visibilityState === "visible"));
    btnNewSet?.addEventListener("click", newSet);
    btnOneMyth?.addEventListener("click", oneMyth);
    btnOneFact?.addEventListener("click", oneFact);
    segFilter?.addEventListener("click", onFilterClick);
    btnShuffle?.addEventListener("click", shuffleCloud);

    await loadInitialCards();
    await loadInitialCloud();
    loop();

    // Log de connexion/fallback
    log("Connectivité : API utilisée si elle renvoie >0 éléments ; sinon JSON local ; sinon seed.");
  })();
})();
