/* Fun Facts / Myths (FR/EN/DE)
   - Charge /facts-data.json (ou <script id="facts-data" type="application/json">)
   - Affiche cartes, filtres All/Facts/Myths
   - Liens sources cliquables (target=_blank rel=noopener)
   - Plus aucun "TODO"
*/
(function () {
  "use strict";

  const LANG = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();

  const LMAP = {
    fr: {
      title: "Fun Facts",
      lead: "Sélection de faits et de mythes triés par thème. Cliquez une carte pour voir les sources.",
      filterAll: "Tous",
      filterFacts: "Faits",
      filterMyths: "Mythes",
      sources: "Sources",
      more: "En savoir plus",
      empty: "Aucun élément à afficher.",
    },
    en: {
      title: "Fun Facts",
      lead: "A selection of facts and myths by theme. Click a card to view sources.",
      filterAll: "All",
      filterFacts: "Facts",
      filterMyths: "Myths",
      sources: "Sources",
      more: "Learn more",
      empty: "Nothing to display.",
    },
    de: {
      title: "Fun Facts",
      lead: "Ausgewählte Fakten und Mythen nach Thema. Klicken Sie auf eine Karte, um die Quellen zu sehen.",
      filterAll: "Alle",
      filterFacts: "Fakten",
      filterMyths: "Mythen",
      sources: "Quellen",
      more: "Mehr erfahren",
      empty: "Keine Einträge vorhanden.",
    },
  };
  const L = LMAP[LANG] || LMAP.fr;

  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, a = {}, k = []) => {
    const e = document.createElement(t);
    for (const [kk, vv] of Object.entries(a || {})) {
      if (kk === "class") e.className = vv;
      else if (kk === "text") e.textContent = vv;
      else if (kk.startsWith("on") && typeof vv === "function") e.addEventListener(kk.slice(2), vv);
      else e.setAttribute(kk, vv);
    }
    for (const c of [].concat(k)) if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return e;
  };

  let DATA = [];
  let FILTER = "all";

  function normalize(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((it) => ({
        kind: (it.kind || it.type || "").toString().toLowerCase() || "fact",
        title: it.title || it.claim || "",
        summary: it.summary || it.explain || it.text || "",
        tag: it.tag || it.domain || it.topic || "",
        score: typeof it.score === "number" ? it.score : null,
        sources: Array.isArray(it.sources)
          ? it.sources
              .map((s) => (typeof s === "string" ? { title: s, url: s } : { title: s.title || s.name || "↗", url: s.url || "" }))
              .filter((s) => !!s.url)
          : [],
      }))
      .filter((x) => x.title && x.summary);
  }

  function badge(text) {
    return el("span", { class: "badge", text });
  }

  function card(item) {
    const icon = item.kind === "myth" ? "❓" : "⭐";
    const head = el("div", { class: "q-head", style: "display:flex;gap:8px;align-items:center" }, [
      el("span", { class: "q-num", text: icon }),
      el("h3", { text: item.title, style: "margin:.2rem 0" }),
      item.tag ? badge(item.tag) : null,
      item.score != null ? badge("★ " + item.score.toFixed(2)) : null,
    ]);

    const srcs =
      item.sources.length > 0
        ? el(
            "div",
            {},
            [
              el("strong", { text: L.sources + " : " }),
              ...item.sources.map((s, i) =>
                el(
                  "a",
                  { href: s.url, target: "_blank", rel: "noopener", style: "margin-right:8px" },
                  [s.title || L.more + " " + (i + 1)]
                )
              ),
            ]
          )
        : null;

    const back = el("div", { class: "q-exp" }, [el("p", { text: item.summary }), el("div", { class: "sep" }), srcs]);

    const card = el("div", { class: "q-item", style: "cursor:pointer" }, [
      head,
      el("div", {}, [back]),
    ]);
    card.addEventListener("click", () => card.classList.toggle("flipped"));
    return card;
  }

  function render() {
    const root = $("#factsGrid") || $("#funfacts-root") || $(".answers") || $("main") || document.body;
    if (!root) return;
    root.innerHTML = "";

    const list = FILTER === "all" ? DATA : DATA.filter((x) => (FILTER === "fact" ? x.kind === "fact" : x.kind === "myth"));
    if (!list.length) {
      root.appendChild(el("p", { class: "muted", text: L.empty }));
      return;
    }
    const f = document.createDocumentFragment();
    list.forEach((it) => f.appendChild(card(it)));
    root.appendChild(f);
  }

  function renderFilters() {
    let bar = $("#factsFilters");
    if (!bar) {
      bar = el("div", { id: "factsFilters", style: "display:flex;gap:8px;flex-wrap:wrap;margin:10px 0" });
      const parent = $("main") || document.body;
      parent.insertBefore(bar, parent.firstChild);
    }
    const mk = (key, label) =>
      el(
        "button",
        {
          class: "btn",
          type: "button",
          onClick: () => {
            FILTER = key;
            render();
            markActive();
          },
        },
        [label]
      );
    bar.innerHTML = "";
    bar.appendChild(el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [
      mk("all", L.filterAll), mk("fact", L.filterFacts), mk("myth", L.filterMyths)
    ]));

    function markActive() {
      bar.querySelectorAll("button").forEach((b) => b.classList.remove("primary"));
      const idx = FILTER === "all" ? 0 : FILTER === "fact" ? 1 : 2;
      const btn = bar.querySelectorAll("button")[idx];
      if (btn) btn.classList.add("primary");
    }
    markActive();
  }

  function parseInlineJson() {
    try {
      const tag = document.getElementById("facts-data");
      if (!tag) return null;
      const j = JSON.parse(tag.textContent || "null");
      return j;
    } catch {
      return null;
    }
  }

  async function loadData() {
    // 1) via fichier
    try {
      const r = await fetch("/facts-data.json", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j)) return j;
        if (j && Array.isArray(j.items)) return j.items;
      }
    } catch {}
    // 2) via <script id="facts-data">
    const inline = parseInlineJson();
    if (inline) return inline;
    return [];
  }

  function attachEvents() {
    // placeholder (conserve le nom pour éviter ReferenceError)
  }

  async function init() {
    // titre / lead si vides
    const h1 = document.querySelector("main h1, .page-head h1, h1");
    if (h1 && !h1.textContent.trim()) h1.textContent = L.title;
    const lead = document.querySelector("#factsLead") || document.querySelector(".muted");
    if (lead && !lead.textContent.trim()) lead.textContent = L.lead;

    const raw = await loadData();
    DATA = normalize(raw);
    renderFilters();
    render();
    attachEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
