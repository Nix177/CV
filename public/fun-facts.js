/* public/fun-facts.js
   Fun Facts — rendu robuste (API -> fallback local), auto-mount, FR/EN/DE
*/
(() => {
  // --------- Utilitaires ----------
  const byId = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) c && n.appendChild(c);
    return n;
  };
  const truncateWords = (txt, max = 30) => {
    const parts = (txt || "").split(/\s+/).filter(Boolean);
    return parts.length <= max ? txt : parts.slice(0, max).join(" ") + "…";
  };
  const pickRandom = (arr, n) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  };

  // --------- Langue & libellés ----------
  const path = location.pathname;
  const lang = /-en\.html$/i.test(path) ? "en" : /-de\.html$/i.test(path) ? "de" : "fr";
  const T = {
    fr: {
      newBatch: "Nouveau lot aléatoire",
      source: "Voir la source",
      flip: "Retourner",
      fallbackTitle: "Liste statique (repli)",
      fallbackMsg: "Si vous voyez ceci, l’API est indisponible. Un repli local s’affiche.",
      myth: "Mythe",
      fact: "Fait vérifié",
    },
    en: {
      newBatch: "New random batch",
      source: "View source",
      flip: "Flip",
      fallbackTitle: "Static list (fallback)",
      fallbackMsg: "If you see this, the API is down. A local fallback is shown.",
      myth: "Myth",
      fact: "Verified fact",
    },
    de: {
      newBatch: "Neuer Zufalls-Satz",
      source: "Quelle anzeigen",
      flip: "Umdrehen",
      fallbackTitle: "Statische Liste (Fallback)",
      fallbackMsg: "Wenn Sie dies sehen, ist die API nicht verfügbar. Lokaler Fallback.",
      myth: "Mythos",
      fact: "Gesicherte Tatsache",
    },
  }[lang];

  // --------- Auto-mount minimal (aucune dépendance au HTML) ----------
  let root = byId("facts-root");
  if (!root) {
    root = el("section", { id: "facts-root", class: "container section" });
    // Privilégier <main> si présent
    (document.querySelector("main") || document.body).appendChild(root);
  }
  // Action bar
  const actions = el("div", { class: "row gap", style: "justify-content:flex-end;margin:10px 0 16px" }, [
    el("button", { id: "btnNewFacts", class: "btn primary" }, [document.createTextNode(T.newBatch)]),
  ]);
  // Grid
  const grid = el("div", { id: "factsGrid", class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;" });
  // Fallback box (cachée par défaut)
  const fallback = el("div", { id: "factsFallback", class: "card pad", style: "display:none" }, [
    el("div", { class: "title", html: T.fallbackTitle }),
    el("p", { class: "muted", html: T.fallbackMsg }),
  ]);

  // Inject
  root.appendChild(actions);
  root.appendChild(fallback);
  root.appendChild(grid);

  // --------- Rendu cartes ----------
  function cardNode(item) {
    // item: { myth, explain, source }
    const head = el("div", { class: "row gap", style: "justify-content:flex-start;margin-bottom:8px" }, [
      el("span", { class: "chip" }, [document.createTextNode(T.myth)]),
      el("span", { class: "chip" }, [document.createTextNode("myth")]),
    ]);
    const foot = el("div", { class: "row gap", style: "flex-wrap:wrap;margin-top:10px" }, [
      el("button", { class: "btn linkish js-flip" }, [document.createTextNode(T.flip)]),
      item.source ? el("a", { class: "btn linkish", href: item.source, target: "_blank", rel: "noopener" }, [document.createTextNode(T.source)]) : null,
    ].filter(Boolean));

    const front = el("div", { class: "card pad face front" }, [
      head,
      el("h3", { class: "h3", html: item.myth || "—" }),
      foot,
    ]);

    const backHead = el("div", { class: "row gap", style: "justify-content:flex-start;margin-bottom:8px" }, [
      el("span", { class: "chip" }, [document.createTextNode(T.fact)]),
      el("span", { class: "chip" }, [document.createTextNode("fact")]),
    ]);
    const backFoot = el("div", { class: "row gap", style: "flex-wrap:wrap;margin-top:10px" }, [
      el("button", { class: "btn linkish js-flip" }, [document.createTextNode(T.flip)]),
      item.source ? el("a", { class: "btn linkish", href: item.source, target: "_blank", rel: "noopener" }, [document.createTextNode(T.source)]) : null,
    ].filter(Boolean));

    const back = el("div", { class: "card pad face back", style: "display:none" }, [
      backHead,
      el("p", { class: "muted", html: truncateWords(item.explain || "—", 30) }),
      backFoot,
    ]);

    const wrapper = el("div", { class: "fact-card" }, [front, back]);

    wrapper.addEventListener("click", (e) => {
      const isFlipBtn = e.target && e.target.classList && e.target.classList.contains("js-flip");
      if (!isFlipBtn) return;
      const showBack = front.style.display !== "none";
      front.style.display = showBack ? "none" : "";
      back.style.display = showBack ? "" : "none";
    });

    return wrapper;
  }

  function render(items, usedFallback = false) {
    grid.innerHTML = "";
    if (usedFallback) {
      fallback.style.display = "";
    } else {
      fallback.style.display = "none";
    }
    items.forEach((it) => grid.appendChild(cardNode(it)));
  }

  // --------- Chargement data ----------
  const N = 9;
  async function fetchFromApi() {
    const url = `/api/facts?lang=${encodeURIComponent(lang)}&n=${N}`;
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!r.ok) throw new Error(`API /api/facts ${r.status}`);
    const data = await r.json();
    if (!data || !Array.isArray(data.items)) throw new Error("API shape invalid");
    return data.items.map((x) => ({
      myth: x.myth || x.claim || x.title || "",
      explain: x.explain || x.answer || x.summary || "",
      source: x.source || x.url || "",
    }));
  }

  async function fetchFromLocal() {
    // Assurez-vous d’avoir: public/assets/data/facts-data.json
    // format: { "items":[ { "myth":"...", "explain":"...", "source":"..." }, ... ] }
    const r = await fetch("/assets/data/facts-data.json", { headers: { "Accept": "application/json" } });
    if (!r.ok) throw new Error(`fallback facts-data.json ${r.status}`);
    const data = await r.json();
    const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
    const picked = pickRandom(items, N).map((x) => ({
      myth: x.myth || x.claim || x.title || "",
      explain: x.explain || x.answer || x.summary || "",
      source: x.source || x.url || "",
    }));
    return picked;
  }

  async function loadBatch() {
    grid.innerHTML = '<div class="muted" style="padding:8px">…</div>';
    try {
      const items = await fetchFromApi();
      render(items, /*usedFallback*/ false);
    } catch (e1) {
      console.warn("[FunFacts] API KO → fallback local", e1);
      try {
        const items = await fetchFromLocal();
        render(items, /*usedFallback*/ true);
      } catch (e2) {
        console.error("[FunFacts] Fallback KO", e2);
        grid.innerHTML = '<div class="muted" style="padding:8px">Impossible de charger des faits pour le moment.</div>';
        fallback.style.display = "";
      }
    }
  }

  // --------- Actions ----------
  byId("btnNewFacts").addEventListener("click", loadBatch);

  // --------- Init ----------
  loadBatch();
})();
