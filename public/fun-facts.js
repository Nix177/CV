/* Fun Facts & Myths (FR/EN/DE)
   - Charge /facts-data.json
   - Affiche uniquement les vrais items (PLUS de placeholders "TODO")
   - Filtres : Tous / Faits / Mythes
   - Cartes cliquables (flip) + liens Sources (ouvrent dans un nouvel onglet)
   - “Vous/Sie” pour FR/DE
*/

(function () {
  "use strict";

  const LANG = (document.documentElement.getAttribute("lang") || "fr")
    .toLowerCase()
    .slice(0, 2);

  const L = {
    fr: {
      title: "Fun Facts",
      lead: "Sélection de faits et de mythes triés par thème. Cliquez pour retourner la carte et consulter les sources.",
      filterAll: "Tous",
      filterFacts: "Faits",
      filterMyths: "Mythes",
      sources: "Sources",
      more: "En savoir plus",
      empty: "Aucun élément à afficher.",
    },
    en: {
      title: "Fun Facts",
      lead:
        "A selection of facts and myths by theme. Click a card to flip and view the sources.",
      filterAll: "All",
      filterFacts: "Facts",
      filterMyths: "Myths",
      sources: "Sources",
      more: "Learn more",
      empty: "Nothing to display.",
    },
    de: {
      title: "Fun Facts",
      lead:
        "Ausgewählte Fakten und Mythen nach Thema. Klicken Sie auf eine Karte, um sie umzudrehen und die Quellen zu sehen.",
      filterAll: "Alle",
      filterFacts: "Fakten",
      filterMyths: "Mythen",
      sources: "Quellen",
      more: "Mehr erfahren",
      empty: "Keine Einträge vorhanden.",
    },
  }[LANG] || L_fr();

  function L_fr() {
    return L.fr;
  }

  // ------- DOM helpers -------
  const $ = (sel, root = document) => root.querySelector(sel);

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
  }

  // ------- State -------
  let DATA = [];
  let FILTER = "all"; // 'all' | 'fact' | 'myth'

  function normalizeItems(raw) {
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
              .map((s) =>
                typeof s === "string" ? { title: s, url: s } : { title: s.title || s.name || "↗", url: s.url || "" }
              )
              .filter((s) => !!s.url)
          : [],
      }))
      // on élimine les entrées vides (ex.- "TODO")
      .filter((x) => x.title && x.summary);
  }

  // ------- Rendering -------
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

    const back = el("div", { class: "q-exp" }, [
      el("p", { text: item.summary }),
      el("div", { class: "sep" }),
      el("div", {}, [
        el("strong", { text: L.sources + " : " }),
        ...item.sources.map((s, i) =>
          el(
            "a",
            {
              href: s.url,
              target: "_blank",
              rel: "noopener",
              style: "margin-right:8px",
            },
            [s.title || L.more + " " + (i + 1)]
          )
        ),
      ]),
    ]);

    const body = el("div", {}, [back]);

    const card = el("div", { class: "q-item", style: "cursor:pointer" }, [head, body]);
    card.addEventListener("click", () => {
      card.classList.toggle("flipped");
    });
    return card;
  }

  function render() {
    const root = $("#factsGrid") || $(".answers") || $("#funfacts-root") || document.body;
    if (!root) return;

    root.innerHTML = "";

    const list =
      FILTER === "all" ? DATA : DATA.filter((x) => (FILTER === "fact" ? x.kind === "fact" : x.kind === "myth"));

    if (!list.length) {
      root.appendChild(el("p", { class: "muted", text: L.empty }));
      return;
    }

    const frag = document.createDocumentFragment();
    list.forEach((it) => frag.appendChild(card(it)));
    root.appendChild(frag);
  }

  function renderFilters() {
    const bar =
      $("#factsFilters") ||
      el("div", { id: "factsFilters", style: "display:flex;gap:8px;flex-wrap:wrap;margin:10px 0" });

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

    const wrap = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [
      mk("all", L.filterAll),
      mk("fact", L.filterFacts),
      mk("myth", L.filterMyths),
    ]);

    bar.innerHTML = "";
    bar.appendChild(wrap);

    const parent = $("#factsFilters") || $("#filters") || $(".wrap") || document.body;
    if (!$("#factsFilters")) parent.insertBefore(bar, parent.firstChild);

    function markActive() {
      bar.querySelectorAll("button").forEach((b) => b.classList.remove("primary"));
      const idx = FILTER === "all" ? 0 : FILTER === "fact" ? 1 : 2;
      const btn = bar.querySelectorAll("button")[idx];
      if (btn) btn.classList.add("primary");
    }
    markActive();
  }

  // ------- Events (exposé pour la lisibilité de l’erreur précédente) -------
  function attachEvents() {
    // Rien à brancher ici au-delà des filtres/click cartes (déjà fait),
    // la fonction existe pour éviter "ReferenceError: attachEvents is not defined".
  }

  // ------- Boot -------
  async function init() {
    // Titre/intro si présents
    const h1 = document.querySelector("main h1, .page-head h1, h1");
    if (h1 && !h1.textContent.trim()) h1.textContent = L.title;

    const lead = document.querySelector("#factsLead") || document.querySelector(".muted");
    if (lead && !lead.textContent.trim()) lead.textContent = L.lead;

    try {
      const r = await fetch("/facts-data.json", { cache: "no-store" });
      const raw = (await r.json().catch(() => [])) || [];
      DATA = normalizeItems(raw);
    } catch (e) {
      console.error("facts load error:", e);
      DATA = [];
    }

    renderFilters();
    render();
    attachEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
