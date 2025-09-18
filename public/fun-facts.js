/* Fun Facts — Cartes + Nuage (tooltip), randomisation contenu + confettis */
(function () {
  "use strict";

  // ---------- Helpers ----------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rand = (a, b) => Math.random() * (b - a) + a;
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

  const log  = (...args) => console.log("%c[fun-facts]", "color:#08c", ...args);
  const warn = (...args) => console.warn("%c[fun-facts]", "color:#e80", ...args);

  const lang = (document.documentElement.lang || "fr").slice(0, 2);
  const API = "/api/facts";
  const LOCAL_JSON = "/facts-data.json";
  const MAX_TOOLTIP_WORDS = 50;

  // ---------- Source normalisation ----------
  const toStr = (x) => (x == null ? "" : String(x)).trim();
  const niceLabelFromUrl = (u) => (u || "").replace(/^https?:\/\//, "").slice(0, 95);
  function normalizeOneSource(s) {
    if (!s && s !== 0) return null;
    if (typeof s === "string") {
      const href = toStr(s);
      if (!href) return null;
      return { href, label: niceLabelFromUrl(href) };
    }
    if (typeof s === "object") {
      const href = toStr(s.url || s.href || s.link || "");
      if (!href) return null;
      const label = toStr(s.label || s.title || s.name || "") || niceLabelFromUrl(href);
      return { href, label };
    }
    const href = toStr(s);
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

  // ---------- Fetch ----------
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
    if (api.length) return api;
    const loc = await tryLocalJSON();
    if (loc.length) return pickFrom(loc, params);
    return [];
  }

  // ---------- DOM ensure ----------
  function ensureTooltip() {
    let t = $("#ffTooltip");
    if (t) return t;
    t = document.createElement("div");
    t.id = "ffTooltip";
    t.innerHTML = `
      <h4 id="ttTitle">—</h4>
      <div id="ttMeta" class="meta"></div>
      <p id="ttBody"></p>
      <div id="ttSources" class="sources"></div>
    `;
    document.body.appendChild(t);
    return t;
  }
  function hideTooltip(){ const t=$("#ffTooltip"); if(t) t.style.display="none"; }

  function truncateWords(s, maxW) {
    const words = (s||"").split(/\s+/);
    if (words.length <= maxW) return s;
    return words.slice(0, maxW).join(" ") + "…";
  }

  // ---------- CARTES ----------
  let cardsWrap, segFilter, btnNewSet, btnOneFact, btnOneMyth;
  let FILTER = "all";
  let CARDS = [];
  const seenCards = new Set();
  let newSetClicks = 0;

  function passFilter(item) {
    const t = item.type || "unknown";
    return FILTER === "all" || (FILTER === "fact" && t === "fact") || (FILTER === "myth" && t === "myth");
  }

  function sourcesBlock(sources){
    if(!sources?.length) return "";
    const lis = sources.map(s=>`<li><a href="${s.href}" target="_blank" rel="noopener">${s.label||niceLabelFromUrl(s.href)}</a></li>`).join("");
    return `<div class="sources"><strong>Sources :</strong><ul>${lis}</ul></div>`;
  }

  function drawCards(list) {
    CARDS = list.slice();
    if (!cardsWrap) return;
    cardsWrap.innerHTML = "";
    if (!CARDS.length) {
      cardsWrap.innerHTML = `<div style="opacity:.7;padding:1rem 0">Aucun élément à afficher.</div>`;
      return;
    }
    for (const item of CARDS) {
      if (!passFilter(item)) continue;
      const typeLabel = item.type === "fact" ? "⭐ Fait avéré" : item.type === "myth" ? "❓ Mythe" : "💡 Indéterminé";
      const typeClass = item.type === "fact" ? "fact" : item.type === "myth" ? "myth" : "unknown";

      const card = document.createElement("article");
      card.className = "ff-card";
      card.dataset.id = item.id;
      card.innerHTML = `
        <div class="inner">
          <div class="ff-face front">
            <div class="type ${typeClass}">${typeLabel}</div>
            <div class="meta"><span class="badge">${item.category||"Catégorie"}</span></div>
            <div class="title">${item.title||"(sans titre)"}</div>
            <div class="body" style="min-height:56px">${truncateWords(item.body||"", 35)}</div>
            <div class="card-actions">
              <button class="btn ghost flip" aria-label="Retourner la carte">Retourner</button>
            </div>
          </div>
          <div class="ff-face back">
            <div class="type ${typeClass}">Réponse</div>
            <div class="meta"><span class="badge">${item.category||"Catégorie"}</span><span class="badge">${typeLabel.replace(/^[^ ]+ /,'')}</span></div>
            <div class="body">${item.body||""}</div>
            ${sourcesBlock(item.sources)}
            <div class="card-actions">
              <button class="btn ghost flip" aria-label="Revenir au recto">Retourner</button>
            </div>
          </div>
        </div>
      `;
      card.addEventListener("click",(e)=>{
        const btn = e.target.closest(".flip");
        if(!btn) return;
        card.classList.toggle("flipped");
      });
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
    newSetClicks = (newSetClicks + 1) % 3;
    if (newSetClicks === 0 && window.launchConfetti) window.launchConfetti(1200);
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

  // ---------- NUAGE ----------
  let cloud, btnShuffle;
  const bubbles = [];
  let running = true;
  function labelForCategory(s) {
    const w = (s || "").split(/\s+/);
    return (w[0] || "").slice(0, 16) + (w[1] ? " " + w[1].slice(0, 12) : "");
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

    ttBody.textContent = truncateWords(item.body || "", MAX_TOOLTIP_WORDS);

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
    const W = cloud.clientWidth, H = cloud.clientHeight;
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

  async function loadCloud() {
    // on repart sur un vrai nouvel échantillon
    const seen = Array.from(seenCards).join(",");
    const list = await fetchFacts({ lang, n: 18, seen });
    log("Nuage reçu:", list.length);
    cloud.innerHTML = "";
    bubbles.length = 0;
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

  // ---------- Start ----------
  (async function start() {
    cardsWrap   = $("#cards");
    segFilter   = $(".seg");
    btnNewSet   = $("#btnNewSet");
    btnOneMyth  = $("#btnOneMyth");
    btnOneFact  = $("#btnOneFact");
    cloud       = $("#cloud");
    btnShuffle  = $("#btnShuffle");

    document.addEventListener("visibilitychange", () => (running = document.visibilityState === "visible"));
    btnNewSet?.addEventListener("click", newSet);
    btnOneMyth?.addEventListener("click", oneMyth);
    btnOneFact?.addEventListener("click", oneFact);
    segFilter?.addEventListener("click", onFilterClick);
    btnShuffle?.addEventListener("click", loadCloud);

    await loadInitialCards();
    await loadCloud();
    loop();

    log("Connectivité : API utilisée si elle renvoie >0 éléments ; sinon JSON local ; sinon vide.");
  })();
})();
