/* Fun Facts & Myths (FR/EN/DE)
   - Accepte /facts-data.json sous forme {items:[...]} OU [...]
   - Mappe automatiquement: type→kind, category→tag, truth→summary, claim conservé pour l’aperçu
   - Liens Sources cliquables, filtres All/Facts/Myths
*/
(function () {
  "use strict";

  const LANG = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  const L = {
    fr: { title:"Fun Facts", lead:"Sélection de faits et de mythes. Cliquez une carte pour les détails et les sources.",
          filterAll:"Tous", filterFacts:"Faits", filterMyths:"Mythes", sources:"Sources", more:"En savoir plus", empty:"Aucun élément à afficher." },
    en: { title:"Fun Facts", lead:"A selection of facts and myths. Click a card for details and sources.",
          filterAll:"All", filterFacts:"Facts", filterMyths:"Myths", sources:"Sources", more:"Learn more", empty:"Nothing to display." },
    de: { title:"Fun Facts", lead:"Ausgewählte Fakten und Mythen. Karte anklicken für Details und Quellen.",
          filterAll:"Alle", filterFacts:"Fakten", filterMyths:"Mythen", sources:"Quellen", more:"Mehr erfahren", empty:"Keine Einträge vorhanden." },
  }[LANG];

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

  function coerceArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function normalize(raw) {
    return coerceArray(raw)
      .map((it) => {
        const kind = (it.kind || it.type || "").toString().toLowerCase() || "fact";
        const title = it.title || it.claim || "";
        // IMPORTANT : on affiche par défaut la "truth" comme résumé
        const summary = it.summary || it.truth || it.explain || it.text || "";
        const tag = it.tag || it.category || it.domain || it.topic || "";
        const score = typeof it.wow_rating === "number" ? it.wow_rating
                    : typeof it.score === "number" ? it.score
                    : null;
        const sources = Array.isArray(it.sources)
          ? it.sources.map((s) => (typeof s === "string" ? { title: s, url: s } : { title: s.title || s.name || "↗", url: s.url || "" }))
                      .filter((s) => !!s.url)
          : [];
        return { kind, title, summary, claim: it.claim || "", tag, score, sources };
      })
      .filter((x) => x.title && x.summary);
  }

  function badge(text) { return el("span", { class: "badge", text }); }

  function card(item) {
    const icon = item.kind === "myth" ? "❓" : "⭐";
    const head = el("div", { class: "q-head", style: "display:flex;gap:8px;align-items:center" }, [
      el("span", { class: "q-num", text: icon }),
      el("h3", { text: item.title, style: "margin:.2rem 0" }),
      item.tag ? badge(item.tag) : null,
      item.score != null ? badge("★ " + item.score.toFixed(2)) : null,
    ]);

    // Face arrière : on affiche la "truth" (summary) et les sources
    const back = el("div", { class: "q-exp" }, [
      item.claim ? el("p", { class: "muted", text: "• Affirmation : " + item.claim }) : null,
      el("p", { text: item.summary }),
      el("div", { class: "sep" }),
      el("div", {}, [
        el("strong", { text: L.sources + " : " }),
        ...item.sources.map((s, i) =>
          el("a", { href: s.url, target: "_blank", rel: "noopener", style: "margin-right:8px" }, [s.title || L.more + " " + (i + 1)])
        ),
      ]),
    ]);

    const card = el("div", { class: "q-item", style: "cursor:pointer" }, [head, el("div", {}, [back])]);
    card.addEventListener("click", () => card.classList.toggle("flipped"));
    return card;
  }

  function render() {
    const root = $("#factsGrid") || $("#funfacts-root") || $(".answers") || $("main");
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
    const mk = (key, label) => el("button", { class: "btn", type: "button", onClick: () => { FILTER = key; render(); markActive(); }}, [label]);
    bar.innerHTML = "";
    bar.appendChild(el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [ mk("all", L.filterAll), mk("fact", L.filterFacts), mk("myth", L.filterMyths) ]));

    function markActive() {
      bar.querySelectorAll("button").forEach((b) => b.classList.remove("primary"));
      const idx = FILTER === "all" ? 0 : FILTER === "fact" ? 1 : 2;
      const btn = bar.querySelectorAll("button")[idx];
      if (btn) btn.classList.add("primary");
    }
    markActive();
  }

  async function init() {
    // titre/lead si vides
    const h1 = document.querySelector("main h1, .page-head h1, h1");
    if (h1 && !h1.textContent.trim()) h1.textContent = L.title;
    const lead = document.querySelector("#factsLead") || document.querySelector(".muted");
    if (lead && !lead.dataset.ffInit) { lead.textContent = L.lead; lead.dataset.ffInit = "1"; }

    try {
      const r = await fetch("/facts-data.json", { cache: "no-store" });
      const payload = await r.json().catch(() => []);
      DATA = normalize(payload);
    } catch (e) {
      console.error("facts load error:", e);
      DATA = [];
    }
    renderFilters();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
