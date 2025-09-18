<script>
/* Fun Facts — Cartes flip + Nuage (robuste)
   - Attente DOM & body, container auto si absent
   - Cartes: flip 3D au clic (dos = réponse ≤50 mots + sources)
   - Nuage: tooltip lisible (résumé ≤50 mots + sources), contenu réellement randomisé
   - Confettis au 3e clic de “Mélanger le nuage”
*/
(function () {
  "use strict";

  // ---------- Log ----------
  const log  = (...a) => console.log("%c[fun-facts]", "color:#08c", ...a);
  const warn = (...a) => console.warn("%c[fun-facts]", "color:#e80", ...a);

  // ---------- Helpers ----------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
  const clamp   = (n, a, b) => Math.max(a, Math.min(b, n));
  const lang    = (document.documentElement.lang || "fr").slice(0, 2);

  function shortify(text, maxWords = 50) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    const w = t.split(" ");
    return (w.length <= maxWords) ? t : w.slice(0, maxWords).join(" ") + "…";
  }

  // --- URLs / sources normalisées ---
  const toUrl = (x) => { try { return String(x || "").trim(); } catch { return ""; } };
  const nice  = (u) => u ? u.replace(/^https?:\/\//, "").slice(0, 95) : "";

  function oneSrc(s) {
    if (!s && s !== 0) return null;
    if (typeof s === "string") {
      const href = toUrl(s); if (!href) return null;
      return { href, label: nice(href) };
    }
    if (typeof s === "object") {
      const href = toUrl(s.url || s.href || s.link || ""); if (!href) return null;
      const label = toUrl(s.label || s.title || s.name || "") || nice(href);
      return { href, label };
    }
    const href = toUrl(s); if (!href) return null;
    return { href, label: nice(href) };
  }
  function normSources(arr) {
    if (!arr) return [];
    if (!Array.isArray(arr)) arr = [arr];
    const out = [];
    for (const s of arr) { const v = oneSrc(s); if (v?.href) out.push(v); }
    return out;
  }

  // ---------- Fallback minimal ----------
  const SEED = [
    {
      id: "seed:brain10",
      type: "myth",
      category: "Science",
      title: "On n’utilise que 10 % de notre cerveau",
      body:
        "Faux : l’imagerie cérébrale montre une activité étendue selon les tâches ; le cerveau fonctionne en réseaux.",
      sources: [
        "https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/",
      ],
    },
    {
      id: "seed:banana-berry",
      type: "fact",
      category: "Nature",
      title: "La banane est une baie (au sens botanique)",
      body:
        "En botanique, une baie est un fruit charnu issu d’un ovaire unique ; la banane en est un exemple classique.",
      sources: [
        "https://en.wikipedia.org/wiki/Banana#Botany",
      ],
    },
  ];

  // ---------- Fetch ----------
  const API        = "/api/facts";
  const LOCAL_JSON = "/facts-data.json";

  function normList(list) {
    return (list || []).map((it, i) => ({
      id: it.id || `tmp:${i}:${(it.title || "").slice(0, 40)}`,
      type: it.type || "myth",
      category: it.category || "Général",
      title: it.title || (it.type === "fact" ? "Fait" : "Mythe"),
      body: it.body || "",
      sources: normSources(it.sources),
    }));
  }

  async function tryAPI(params) {
    try {
      const qs = new URLSearchParams(params || {}).toString();
      const url = `${API}?${qs}`;
      log("Fetch API:", url);
      const r = await fetch(url, { headers: { "x-ff": "1" } });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const j = await r.json();
      if (!Array.isArray(j)) throw new Error("API non-array");
      const n = normList(j);
      log(`→ API OK (${n.length})`);
      return n;
    } catch (e) {
      warn("API fallback:", e?.message || e);
      return [];
    }
  }
  async function tryLocal() {
    try {
      log("Fetch JSON local:", LOCAL_JSON);
      const r = await fetch(LOCAL_JSON, { cache: "no-store" });
      if (!r.ok) throw new Error(`JSON ${r.status}`);
      const j = await r.json();
      const arr = Array.isArray(j) ? j : (j.items || []);
      const n = normList(arr);
      log(`→ JSON local OK (${n.length})`);
      return n;
    } catch (e) {
      warn("JSON fallback:", e?.message || e);
      return [];
    }
  }
  // Sous-sélection côté client si on passe par le JSON local
  function pick(list, params = {}) {
    let out = list.slice();
    const n    = Number(params.n) || undefined;
    const kind = params.kind;
    const seen = new Set((params.seen || "").split(",").filter(Boolean));
    if (kind) out = out.filter((x) => x.type === kind);
    if (seen.size) out = out.filter((x) => !seen.has(x.id));
    shuffle(out);
    if (n) out = out.slice(0, n);
    return out;
  }
  async function fetchFacts(params) {
    const a = await tryAPI(params); if (a.length) return a;
    const b = await tryLocal();     if (b.length) return pick(b, params);
    return normList(SEED);
  }

  // ---------- Attente DOM & container ----------
  async function domReady() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      if (document.body) return;
    }
    await new Promise(res => document.addEventListener("DOMContentLoaded", res, { once:true }));
    let tries = 0;
    while (!document.body && tries < 120) { // ~2s
      await new Promise(r => setTimeout(r, 16));
      tries++;
    }
  }
  function ensureRoot() {
    let root = $(".container") || $("main.container") || $("main") || document.body;
    if (!root) {
      if (!document.body) {
        const b = document.createElement("body");
        document.documentElement.appendChild(b);
      }
      root = document.createElement("main");
      root.className = "container";
      document.body.appendChild(root);
      log("→ container fabriqué");
    }
    return root;
  }

  // ---------- CSS (flip + nuage + tooltip) ----------
  (function injectCSS() {
    const css = `
      /* --- Cartes --- */
      #ff-cards .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
      .ff-card{position:relative;height:190px;perspective:1000px}
      .ff-card .inner{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .5s}
      .ff-card.flipped .inner{transform:rotateY(180deg)}
      .ff-face{position:absolute;inset:0;border:1px solid #ffffff1f;border-radius:14px;
               background:rgba(255,255,255,.06);backface-visibility:hidden;padding:12px 14px}
      .ff-face.back{transform:rotateY(180deg)}
      .ff-type{font-size:.85rem;opacity:.9;margin-bottom:6px}
      .ff-title{font-size:1.05rem;margin:6px 0 2px;line-height:1.25}
      .ff-cat{display:inline-block;margin-top:2px;font-size:.8rem;border:1px solid #ffffff2a;
              padding:.1rem .5rem;border-radius:999px;background:rgba(255,255,255,.07)}
      .ff-body{font-size:.95rem;opacity:.95;line-height:1.32}
      .ff-sources{margin-top:.5rem;font-size:.9rem}
      .ff-sources a{color:#cfe2ff;text-decoration:none}
      .ff-sources a:hover{text-decoration:underline}

      /* --- Nuage --- */
      #ff-cloud{position:relative;min-height:440px;border:1px solid #ffffff22;border-radius:14px;
                background:#081a2d;overflow:hidden}
      .bubble{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:999px;
              background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.86),rgba(255,255,255,.62));
              color:#0b2237;border:1px solid #ffffff66;box-shadow:0 10px 28px rgba(0,0,0,.35);cursor:pointer;
              transition:transform .12s}
      .bubble .emoji{position:absolute;left:10px;top:8px;opacity:.85}
      .bubble .label{font-weight:700;text-align:center;text-shadow:0 1px 0 rgba(255,255,255,.6);pointer-events:none}
      .bubble:hover{transform:scale(1.04)}
      .bubble.paused{outline:2px solid rgba(255,255,255,.35);z-index:3}

      /* --- Tooltip --- */
      #ffTooltip{position:absolute;z-index:9999;display:none;max-width:min(520px,85vw);
                 background:rgba(6,12,22,.96);color:#e5e7eb;border:1px solid #ffffff2a;border-radius:12px;
                 padding:12px 14px;box-shadow:0 14px 40px rgba(0,0,0,.5)}
      #ffTooltip h4{margin:0 0 6px 0;font-size:1rem}
      #ffTooltip .badge{display:inline-block;font-size:.75rem;padding:.1rem .45rem;border-radius:999px;
                        background:rgba(255,255,255,.08);border:1px solid #ffffff2a;margin-right:6px}
      #ffTooltip p{margin:.4rem 0 .2rem;line-height:1.35}
      #ffTooltip .sources ul{margin:.2rem 0 0 1rem}
      #ffTooltip .sources a{color:#93c5fd;text-decoration:none}
      #ffTooltip .sources a:hover{text-decoration:underline}
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // ---------- DOM ----------
  function ensureDOM() {
    const root = ensureRoot();

    // Cartes
    let cardsSection = $("#ff-cards");
    if (!cardsSection) {
      cardsSection = document.createElement("section");
      cardsSection.id = "ff-cards";
      cardsSection.innerHTML = `
        <h2>Cartes</h2>
        <div class="controls">
          <div class="seg" id="ff-filter" role="tablist" aria-label="Filtre">
            <button class="active" data-filter="all">Tout</button>
            <button data-filter="fact">Fait avéré</button>
            <button data-filter="myth">Mythe</button>
          </div>
          <button id="ff-new" class="btn">Nouveau lot aléatoire</button>
          <button id="ff-one-fact" class="btn ghost">Un fait</button>
          <button id="ff-one-myth" class="btn ghost">Un mythe</button>
          <span style="opacity:.75">Cliquer sur une carte pour voir la réponse + sources.</span>
        </div>
        <div class="cards" id="ff-cards-wrap"></div>
      `;
      if (root.firstChild) root.insertBefore(cardsSection, root.firstChild);
      else root.appendChild(cardsSection);
    }

    // Nuage
    let cloudSection = $("#ff-cloud-section");
    if (!cloudSection) {
      cloudSection = document.createElement("section");
      cloudSection.id = "ff-cloud-section";
      cloudSection.innerHTML = `
        <h2>Nuage de Fun Facts</h2>
        <div class="controls">
          <button id="ff-shuffle" class="btn">Mélanger le nuage</button>
          <span style="opacity:.75">Survolez / cliquez une bulle pour voir le détail.</span>
        </div>
        <div id="ff-cloud"></div>
      `;
      root.appendChild(cloudSection);
    }

    // Nettoie d’éventuels vieux nuages doublons
    const clouds = $$("#ff-cloud, .cloud-wrap, #cloud");
    if (clouds.length > 1) {
      for (let i = 0; i < clouds.length - 1; i++) clouds[i].remove();
    }

    return {
      cardsWrap  : $("#ff-cards-wrap"),
      filterSeg  : $("#ff-filter"),
      btnNew     : $("#ff-new"),
      btnOneFact : $("#ff-one-fact"),
      btnOneMyth : $("#ff-one-myth"),
      cloud      : $("#ff-cloud"),
      btnShuffle : $("#ff-shuffle"),
    };
  }

  // ---------- State ----------
  let CARDS = [];
  let FILTER = "all";
  const seenIds = new Set();

  const bubbles = [];
  let tooltip;
  let shuffleClicks = 0;
  let lastShuffleAt = 0;

  // ---------- Tooltip ----------
  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.id = "ffTooltip";
    tooltip.innerHTML = `
      <h4 id="ttTitle">—</h4>
      <div class="meta" id="ttMeta"></div>
      <p id="ttBody"></p>
      <div class="sources" id="ttSources"></div>
    `;
    document.body.appendChild(tooltip);
    return tooltip;
  }
  function posTooltipAround(el) {
    const t  = ensureTooltip();
    const r  = el.getBoundingClientRect();
    const pad= 10;
    const tw = t.offsetWidth || 320;
    const th = t.offsetHeight || 120;
    let x = r.left + r.width / 2 - tw / 2;
    x = clamp(x, 8, window.innerWidth - tw - 8);
    let y = r.top - th - pad;
    if (y < 6) y = r.bottom + pad;
    t.style.left = `${x}px`;
    t.style.top  = `${y + window.scrollY}px`;
  }
  function showTooltip(item, anchor) {
    const t = ensureTooltip();
    $("#ttTitle", t).textContent = item.title || "—";
    const meta = $("#ttMeta", t);
    meta.innerHTML = "";
    const c = document.createElement("span");
    c.className = "badge"; c.textContent = item.category || "Catégorie";
    const k = document.createElement("span");
    k.className = "badge"; k.textContent = item.type === "fact" ? "Fait" : "Mythe";
    meta.appendChild(c); meta.appendChild(k);

    $("#ttBody", t).textContent = shortify(item.body || "", 50);

    const s = $("#ttSources", t);
    s.innerHTML = "";
    if (item.sources?.length) {
      const h = document.createElement("div"); h.innerHTML = "<strong>Sources :</strong>";
      const ul = document.createElement("ul");
      for (const src of item.sources) {
        const li = document.createElement("li");
        const a  = document.createElement("a");
        a.href = src.href; a.target = "_blank"; a.rel = "noopener";
        a.textContent = src.label || nice(src.href);
        li.appendChild(a); ul.appendChild(li);
      }
      s.appendChild(h); s.appendChild(ul);
    }

    t.style.display = "block";
    posTooltipAround(anchor);
  }
  function hideTooltip() { if (tooltip) tooltip.style.display = "none"; }

  // ---------- Cartes ----------
  function passFilter(item) {
    return FILTER === "all" ||
           (FILTER === "fact" && item.type === "fact") ||
           (FILTER === "myth" && item.type === "myth");
  }
  function renderCard(item) {
    const card  = document.createElement("article");
    card.className = "ff-card"; card.dataset.id = item.id;

    const inner = document.createElement("div");
    inner.className = "inner"; card.appendChild(inner);

    const front = document.createElement("div");
    front.className = "ff-face front";
    front.innerHTML = `
      <div class="ff-type">${item.type === "fact" ? "⭐ Fait avéré" : "❓ Mythe"}</div>
      <div class="ff-title">${item.title || ""}</div>
      <span class="ff-cat">${item.category || ""}</span>
      <p class="ff-body" style="margin-top:.4rem">${shortify(item.body || "", 28)}</p>
    `;

    const back  = document.createElement("div");
    back.className  = "ff-face back";
    back.innerHTML  = `
      <div class="ff-type">${item.type === "fact" ? "Réponse : fait avéré" : "Réponse : mythe réfuté"}</div>
      <div class="ff-title">${item.title || ""}</div>
      <p class="ff-body">${shortify(item.body || "", 50)}</p>
      <div class="ff-sources"></div>
    `;
    const s = $(".ff-sources", back);
    if (s && item.sources?.length) {
      const h = document.createElement("div"); h.innerHTML = "<strong>Sources :</strong>";
      const ul = document.createElement("ul"); ul.style.margin = ".2rem 0 0 1rem";
      for (const src of item.sources) {
        const li = document.createElement("li");
        const a  = document.createElement("a");
        a.href = src.href; a.target = "_blank"; a.rel = "noopener";
        a.textContent = src.label || nice(src.href);
        li.appendChild(a); ul.appendChild(li);
      }
      s.appendChild(h); s.appendChild(ul);
    }

    inner.appendChild(front); inner.appendChild(back);
    card.addEventListener("click", () => card.classList.toggle("flipped"));
    return card;
  }
  function drawCards(list, wrap) {
    wrap.innerHTML = "";
    let count = 0;
    for (const it of list) {
      if (!passFilter(it)) continue;
      wrap.appendChild(renderCard(it));
      count++;
    }
    if (!count) {
      wrap.innerHTML = `<div style="opacity:.7;padding:.8rem 0">Aucun élément à afficher.</div>`;
    }
  }

  // ---------- Nuage ----------
  function labelCat(s) {
    const w = String(s || "").split(/\s+/);
    return (w[0] || "").slice(0, 16) + (w[1] ? " " + w[1].slice(0, 12) : "");
  }
  function createBubble(item, cloud) {
    const el = document.createElement("div");
    el.className = "bubble";
    const radius = clamp(60 + (item.title?.length || 18) * 0.8, 60, 120);
    el.style.width = el.style.height = radius + "px";
    el.style.left  = Math.random() * Math.max(12, cloud.clientWidth  - radius - 12) + "px";
    el.style.top   = Math.random() * Math.max(12, cloud.clientHeight - radius - 12) + "px";

    const em  = document.createElement("div");
    em.className = "emoji"; em.textContent = item.type === "fact" ? "⭐" : "❓";
    const lab = document.createElement("div");
    lab.className = "label"; lab.textContent = labelCat(item.category || (item.type === "fact" ? "Fait" : "Mythe"));

    el.appendChild(em); el.appendChild(lab);

    el.addEventListener("mouseenter", () => { el.classList.add("paused");  showTooltip(item, el); });
    el.addEventListener("mouseleave", () => { el.classList.remove("paused"); hideTooltip(); });
    el.addEventListener("click",      () => { el.classList.add("paused");  showTooltip(item, el); });

    cloud.appendChild(el);
    bubbles.push({ el, item, r: radius,
                   x: parseFloat(el.style.left), y: parseFloat(el.style.top),
                   vx: (Math.random() - .5) * .8, vy: (Math.random() - .5) * .7 });
  }
  function clearCloud(cloud) {
    bubbles.splice(0, bubbles.length);
    cloud.innerHTML = "";
    hideTooltip();
  }
  async function fillCloud(cloud) {
    const list = await fetchFacts({ lang, n: 18, seen: Array.from(seenIds).join(",") });
    list.forEach(x => seenIds.add(x.id));
    clearCloud(cloud);
    for (const f of list) createBubble(f, cloud);
    log("Nuage: contenu", list.length);
  }
  function loop() {
    const cloud = $("#ff-cloud");
    if (!cloud) return requestAnimationFrame(loop);
    const W = cloud.clientWidth, H = cloud.clientHeight;
    for (const b of bubbles) {
      if (b.el.classList.contains("paused")) continue;
      b.x += b.vx; b.y += b.vy;
      if (b.x <= 6 || b.x + b.r >= W - 6) b.vx *= -1;
      if (b.y <= 6 || b.y + b.r >= H - 6) b.vy *= -1;
      b.el.style.left = b.x + "px";
      b.el.style.top  = b.y + "px";
    }
    requestAnimationFrame(loop);
  }

  function confettiAt(x, y) {
    const n = 28;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.style.position = "fixed"; p.style.left = `${x}px`; p.style.top = `${y}px`;
      p.style.width = p.style.height = "6px";
      p.style.background = `hsl(${Math.random()*360|0} 90% 60%)`;
      p.style.pointerEvents = "none"; p.style.zIndex = 99999;
      document.body.appendChild(p);
      const dx = (Math.random() - .5) * 240;
      const dy = (Math.random() - .5) * 180 - 60;
      const rot= (Math.random() - .5) * 720;
      p.animate([{ transform:"translate(0,0) rotate(0)", opacity:1 },
                 { transform:`translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity:0 }],
                 { duration: 1000 + Math.random()*400, easing:"cubic-bezier(.2,.7,.2,1)" })
       .finished.then(() => p.remove());
    }
  }

  // ---------- Start ----------
  (async function start() {
    await domReady();
    const { cardsWrap, filterSeg, btnNew, btnOneFact, btnOneMyth, cloud, btnShuffle } = ensureDOM();

    // Cartes (premier lot)
    const initial = await fetchFacts({ lang, n: 8 });
    initial.forEach(x => seenIds.add(x.id));
    CARDS = initial.slice();
    drawCards(CARDS, cardsWrap);

    // Filtres cartes
    filterSeg?.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      filterSeg.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      FILTER = b.dataset.filter || "all";
      drawCards(CARDS, cardsWrap);
    });

    // Nouveaux lots
    async function newCards(params) {
      const list = await fetchFacts({ lang, n: params?.n || 8, kind: params?.kind, seen: Array.from(seenIds).join(",") });
      list.forEach(x => seenIds.add(x.id));
      CARDS = list.slice();
      drawCards(CARDS, cardsWrap);
    }
    btnNew?.addEventListener("click", () => newCards({ n: 8 }));
    btnOneFact?.addEventListener("click", () => newCards({ n: 1, kind: "fact" }));
    btnOneMyth?.addEventListener("click", () => newCards({ n: 1, kind: "myth" }));

    // Nuage initial + animation
    await fillCloud(cloud);
    loop();

    // Randomise CONTENU (re-fetch), confettis au 3e clic coup-sur-coup
    let lastClick = 0, streak = 0;
    btnShuffle?.addEventListener("click", async (ev) => {
      const now = Date.now();
      streak = (now - lastClick < 1600) ? streak + 1 : 1;
      lastClick = now;
      await fillCloud(cloud);
      if (streak >= 3) { confettiAt(ev.clientX || innerWidth/2, ev.clientY || 80); streak = 0; }
    });

    log("Connectivité : API si >0 ; sinon JSON local ; sinon seed.");
  })();
})();
</script>
