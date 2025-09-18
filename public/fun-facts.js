/* Fun Facts — Cartes flip + Nuage (robuste DOM, compat #cloud existant)
   - DOM ready avant d’injecter quoi que ce soit
   - Réutilise #cloud si présent (ne touche pas à ton <aside id="factPanel">)
   - Cartes: flip 3D au clic, dos = résumé ≤ 50 mots + sources
   - Nuage: tooltip lisible (≤ 50 mots + sources), randomisation du contenu
   - Confettis au 3e clic de “Mélanger le nuage”
*/
(function () {
  "use strict";

  // ---------- Utils ----------
  const log = (...a) => console.log("%c[fun-facts]", "color:#08c", ...a);
  const warn = (...a) => console.warn("%c[fun-facts]", "color:#e80", ...a);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
  const lang = (document.documentElement.lang || "fr").slice(0, 2);

  function shortify(text, maxWords = 50) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    const words = t.split(" ");
    if (words.length <= maxWords) return t;
    return words.slice(0, maxWords).join(" ") + "…";
  }

  function toUrlString(x) { try { return String(x || "").trim(); } catch { return ""; } }
  function niceLabelFromUrl(u) { return u ? u.replace(/^https?:\/\//, "").slice(0, 95) : ""; }

  function normalizeOneSource(s) {
    if (!s && s !== 0) return null;
    if (typeof s === "string") {
      const href = toUrlString(s); if (!href) return null;
      return { href, label: niceLabelFromUrl(href) };
    }
    if (typeof s === "object") {
      const href = toUrlString(s.url || s.href || s.link || "");
      if (!href) return null;
      const label = toUrlString(s.label || s.title || s.name || "") || niceLabelFromUrl(href);
      return { href, label };
    }
    const href = toUrlString(s); if (!href) return null;
    return { href, label: niceLabelFromUrl(href) };
  }
  function normalizeSources(arr) {
    if (!arr) return [];
    if (!Array.isArray(arr)) arr = [arr];
    const out = [];
    for (const s of arr) { const v = normalizeOneSource(s); if (v?.href) out.push(v); }
    return out;
  }

  // ---------- Seed minimal ----------
  const SEED = [
    {
      id: "seed:brain10",
      type: "myth",
      category: "Science",
      title: "On n’utilise que 10 % de notre cerveau",
      body: "Faux : l’imagerie cérébrale montre une activité étendue selon les tâches ; le cerveau fonctionne en réseaux.",
      sources: ["https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/"]
    },
    {
      id: "seed:banana-berry",
      type: "fact",
      category: "Nature",
      title: "La banane est une baie (au sens botanique)",
      body: "En botanique, une baie est un fruit charnu issu d’un ovaire unique ; la banane en est un exemple classique.",
      sources: ["https://en.wikipedia.org/wiki/Banana#Botany"]
    }
  ];

  // ---------- Sources de données ----------
  const API = "/api/facts";
  const LOCAL_JSON = "/facts-data.json";

  function normalizeList(list) {
    return (list || []).map((it, i) => ({
      id: it.id || `tmp:${i}:${(it.title || "").slice(0, 40)}`,
      type: it.type || "myth",
      category: it.category || "Général",
      title: it.title || (it.type === "fact" ? "Fait" : "Mythe"),
      body: it.body || "",
      sources: normalizeSources(it.sources),
    }));
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

    return normalizeList(SEED);
  }

  // ---------- CSS (flip + tooltip) ----------
  function injectCSS() {
    const css = `
      /* grid cartes */
      #ff-cards .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
      /* flip card */
      .ff-card{position:relative;height:180px;perspective:1000px}
      .ff-card .inner{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .5s}
      .ff-card.flipped .inner{transform:rotateY(180deg)}
      .ff-face{position:absolute;inset:0;border:1px solid #ffffff1f;border-radius:14px;
               background:rgba(255,255,255,.06);backface-visibility:hidden;padding:12px 14px}
      .ff-face.back{transform:rotateY(180deg)}
      .ff-type{font-size:.85rem;opacity:.9;margin-bottom:6px}
      .ff-title{font-size:1.05rem;margin:6px 0 2px;line-height:1.25}
      .ff-cat{display:inline-block;margin-top:2px;font-size:.8rem;border:1px solid #ffffff2a;
              padding:.1rem .5rem;border-radius:999px;background:rgba(255,255,255,.07)}
      .ff-body{font-size:.95rem;opacity:.95;line-height:1.3}
      .ff-sources{margin-top:.5rem;font-size:.9rem}
      .ff-sources a{color:#cfe2ff;text-decoration:none}
      .ff-sources a:hover{text-decoration:underline}

      /* Nuage + tooltip */
      #ff-cloud{position:relative;min-height:440px;border:1px solid #ffffff22;border-radius:14px;
                background:#081a2d;overflow:hidden}
      .bubble{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:999px;
              background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.86),rgba(255,255,255,.62));
              color:#0b2237;border:1px solid #ffffff66;box-shadow:0 10px 28px rgba(0,0,0,.35);cursor:pointer;
              transition:transform .12s}
      .bubble .emoji{position:absolute;left:10px;top:8px;opacity:.85}
      .bubble .label{font-weight:700;text-align:center;text-shadow:0 1px 0 rgba(255,255,255,.6);pointer-events:none}
      .bubble:hover{transform:scale(1.04)}
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
  }

  // ---------- DOM ----------
  function ensureDOM() {
    const root = $(".container") || $("main") || document.body || document.documentElement;
    if (!root) throw new Error("Root introuvable");

    // Section Cartes (créée si absente)
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
          <span style="opacity:.75">Cliquez une carte pour voir la réponse + sources.</span>
        </div>
        <div class="cards" id="ff-cards-wrap"></div>
      `;
      // Insère en haut du root sans crasher si firstChild est null
      root.insertBefore(cardsSection, root.firstChild || null);
    }

    // Section Nuage : réutilise #cloud s'il existe, sinon crée #ff-cloud
    let cloud = $("#cloud") || $("#ff-cloud");
    if (!cloud) {
      let cloudSection = $("#ff-cloud-section");
      if (!cloudSection) {
        cloudSection = document.createElement("section");
        cloudSection.id = "ff-cloud-section";
        cloudSection.innerHTML = `
          <h2>Nuage de Fun Facts</h2>
          <div class="controls">
            <button id="ff-shuffle" class="btn">Mélanger le nuage</button>
            <span style="opacity:.75">Survolez / cliquez une bulle pour voir le détail (tooltip avec sources).</span>
          </div>
          <div id="ff-cloud"></div>
        `;
        root.appendChild(cloudSection);
      }
      cloud = $("#ff-cloud", cloudSection);
    } else {
      // Si la page fournit déjà ses propres contrôles (#btnShuffle), on les utilisera plus bas
    }

    return {
      root,
      cardsWrap: $("#ff-cards-wrap"),
      filterSeg: $("#ff-filter"),
      btnNew: $("#ff-new"),
      btnOneFact: $("#ff-one-fact"),
      btnOneMyth: $("#ff-one-myth"),
      cloud,
      // Prend aussi des boutons natifs si présents dans ta page
      btnShuffle: $("#ff-shuffle") || $("#btnShuffle"),
    };
  }

  // ---------- Tooltip ----------
  let tooltip;
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
    const t = ensureTooltip();
    const r = el.getBoundingClientRect();
    const pad = 10, tw = t.offsetWidth || 320, th = t.offsetHeight || 120;
    let x = r.left + r.width / 2 - tw / 2;
    x = clamp(x, 8, window.innerWidth - tw - 8);
    let y = r.top - th - pad;
    if (y < 6) y = r.bottom + pad;
    t.style.left = `${x}px`;
    t.style.top = `${y + window.scrollY}px`;
  }
  function showTooltip(item, anchor) {
    const t = ensureTooltip();
    $("#ttTitle", t).textContent = item.title || "—";
    const meta = $("#ttMeta", t); meta.innerHTML = "";
    const c = document.createElement("span"); c.className = "badge"; c.textContent = item.category || "Catégorie";
    const k = document.createElement("span"); k.className = "badge"; k.textContent = item.type === "fact" ? "Fait" : "Mythe";
    meta.appendChild(c); meta.appendChild(k);
    $("#ttBody", t).textContent = shortify(item.body || "", 50);
    const s = $("#ttSources", t); s.innerHTML = "";
    if (item.sources?.length) {
      const h = document.createElement("div"); h.innerHTML = "<strong>Sources :</strong>";
      const ul = document.createElement("ul");
      for (const src of item.sources) {
        const li = document.createElement("li");
        const a = document.createElement("a"); a.href = src.href; a.target = "_blank"; a.rel = "noopener"; a.textContent = src.label || niceLabelFromUrl(src.href);
        li.appendChild(a); ul.appendChild(li);
      }
      s.appendChild(h); s.appendChild(ul);
    }
    t.style.display = "block"; posTooltipAround(anchor);
  }
  function hideTooltip() { if (tooltip) tooltip.style.display = "none"; }

  // ---------- Cartes (flip) ----------
  let CARDS = [];
  let FILTER = "all";
  const seenIds = new Set();

  function passFilter(item) {
    return FILTER === "all" || (FILTER === "fact" && item.type === "fact") || (FILTER === "myth" && item.type === "myth");
  }

  function renderCard(item) {
    const card = document.createElement("article");
    card.className = "ff-card";
    card.dataset.id = item.id;

    const inner = document.createElement("div");
    inner.className = "inner";
    card.appendChild(inner);

    // Face avant
    const front = document.createElement("div");
    front.className = "ff-face front";
    front.innerHTML = `
      <div class="ff-type">${item.type === "fact" ? "⭐ Fait avéré" : "❓ Mythe"}</div>
      <div class="ff-title">${item.title || ""}</div>
      <span class="ff-cat">${item.category || ""}</span>
      <p class="ff-body" style="margin-top:.4rem">${shortify(item.body || "", 28)}</p>
    `;
    // Dos
    const back = document.createElement("div");
    back.className = "ff-face back";
    back.innerHTML = `
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
        const a = document.createElement("a"); a.href = src.href; a.target = "_blank"; a.rel = "noopener"; a.textContent = src.label || niceLabelFromUrl(src.href);
        li.appendChild(a); ul.appendChild(li);
      }
      s.appendChild(h); s.appendChild(ul);
    }

    inner.appendChild(front); inner.appendChild(back);

    // Flip au clic
    card.addEventListener("click", () => card.classList.toggle("flipped"));
    return card;
  }

  function drawCards(list, wrap) {
    wrap.innerHTML = "";
    let count = 0;
    for (const item of list) {
      if (!passFilter(item)) continue;
      wrap.appendChild(renderCard(item));
      count++;
    }
    if (!count) wrap.innerHTML = `<div style="opacity:.7;padding:.8rem 0">Aucun élément à afficher.</div>`;
  }

  // ---------- Nuage ----------
  const bubbles = [];
  let cloudFacts = [];
  let shuffleClicks = 0;
  let lastShuffleAt = 0;

  function labelForCategory(s) {
    const w = String(s || "").split(/\s+/);
    return (w[0] || "").slice(0, 16) + (w[1] ? " " + w[1].slice(0, 12) : "");
  }

  function createBubble(item, cloud) {
    const el = document.createElement("div");
    el.className = "bubble";
    const radius = clamp(60 + (item.title?.length || 18) * 0.8, 60, 120);
    el.style.width = el.style.height = radius + "px";
    el.style.left = Math.random() * Math.max(12, cloud.clientWidth - radius - 12) + "px";
    el.style.top = Math.random() * Math.max(12, cloud.clientHeight - radius - 12) + "px";

    const em = document.createElement("div"); em.className = "emoji"; em.textContent = item.type === "fact" ? "⭐" : "❓";
    const lab = document.createElement("div"); lab.className = "label"; lab.textContent = labelForCategory(item.category || (item.type === "fact" ? "Fait" : "Mythe"));
    el.appendChild(em); el.appendChild(lab);

    el.addEventListener("mouseenter", () => showTooltip(item, el));
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("click", () => showTooltip(item, el));

    cloud.appendChild(el);
    bubbles.push({ el, item });
  }

  // Ne supprime que les bulles, conserve le reste (ex. ton <aside id="factPanel">)
  function clearCloud(cloud) {
    for (const b of bubbles) b.el.remove();
    bubbles.length = 0;
    hideTooltip();
  }

  async function fillCloud(cloud) {
    const list = await fetchFacts({ lang, n: 18, seen: Array.from(seenIds).join(",") });
    list.forEach((x) => seenIds.add(x.id));
    cloudFacts = list.slice();
    clearCloud(cloud);
    for (const f of cloudFacts) createBubble(f, cloud);
    log("Nuage (contenu) :", cloudFacts.length);
  }

  function confettiAt(x, y) {
    const n = 28;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.style.position = "fixed";
      p.style.left = `${x}px`; p.style.top = `${y}px`;
      p.style.width = p.style.height = "6px";
      p.style.background = `hsl(${(Math.random()*360)|0} 90% 60%)`;
      p.style.pointerEvents = "none";
      p.style.zIndex = 99999;
      document.body.appendChild(p);
      const dx = (Math.random() - 0.5) * 240;
      const dy = (Math.random() - 0.5) * 180 - 60;
      const rot = (Math.random() - 0.5) * 720;
      p.animate([
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 }
      ], { duration: 1000 + Math.random() * 400, easing: "cubic-bezier(.2,.7,.2,1)" })
      .finished.then(() => p.remove());
    }
  }

  // ---------- Start (DOM Ready) ----------
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  onReady(async function start() {
    injectCSS();

    const { root, cardsWrap, filterSeg, btnNew, btnOneFact, btnOneMyth, cloud, btnShuffle } = ensureDOM();
    if (!root || !cloud || !cardsWrap) {
      warn("DOM incomplet", { root: !!root, cloud: !!cloud, cardsWrap: !!cardsWrap });
      return;
    }

    // Premières cartes
    const initial = await fetchFacts({ lang, n: 8 });
    initial.forEach((x) => seenIds.add(x.id));
    CARDS = initial.slice();
    drawCards(CARDS, cardsWrap);

    // Filtres cartes
    filterSeg?.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      filterSeg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      FILTER = b.dataset.filter || "all";
      drawCards(CARDS, cardsWrap);
    });

    // Nouveaux lots cartes
    async function newCards(params) {
      const list = await fetchFacts({ lang, n: params?.n || 8, kind: params?.kind, seen: Array.from(seenIds).join(",") });
      list.forEach((x) => seenIds.add(x.id));
      CARDS = list.slice();
      drawCards(CARDS, cardsWrap);
    }
    btnNew?.addEventListener("click", () => newCards({ n: 8 }));
    btnOneFact?.addEventListener("click", () => newCards({ n: 1, kind: "fact" }));
    btnOneMyth?.addEventListener("click", () => newCards({ n: 1, kind: "myth" }));

    // Nuage initial
    await fillCloud(cloud);

    // Randomise le contenu du nuage (pas seulement positions)
    btnShuffle?.addEventListener("click", async (ev) => {
      const now = Date.now();
      shuffleClicks = (now - lastShuffleAt < 2000) ? shuffleClicks + 1 : 1;
      lastShuffleAt = now;

      await fillCloud(cloud);

      if (shuffleClicks >= 3) {
        confettiAt(ev?.clientX || window.innerWidth/2, ev?.clientY || 80);
        shuffleClicks = 0;
      }
    });

    log("Connectivité : API utilisée si elle renvoie >0 éléments ; sinon JSON local ; sinon seed.");
  });
})();
