/* Portfolio – remplit la grille, gère l’overlay d’aperçu (sandbox), visites en nouvel onglet.
   IDs requis dans le HTML :
   - #portfolioGrid (grille des cartes)
   - #overlay, #overlayFrame, #overlayClose (aperçu embarqué)
   Données attendues : window.PORTFOLIO (Array) ou window.portfolioData (Array)
   Élément d’un item (tolérant) : { title, url, description, tags:[], image }
*/

(function () {
  "use strict";

  const LANG = (document.documentElement.getAttribute("lang") || "fr")
    .toLowerCase()
    .slice(0, 2);

  const T = {
    fr: { preview: "Aperçu", visit: "Visiter", close: "Fermer" },
    en: { preview: "Preview", visit: "Visit", close: "Close" },
    de: { preview: "Vorschau", visit: "Besuchen", close: "Schließen" },
  }[LANG] || { preview: "Preview", visit: "Visit", close: "Close" };

  const $ = (sel, root = document) => root.querySelector(sel);

  function getData() {
    const cand =
      (window.PORTFOLIO && (Array.isArray(window.PORTFOLIO.items) ? window.PORTFOLIO.items : window.PORTFOLIO)) ||
      window.portfolioData ||
      [];
    return Array.isArray(cand) ? cand : [];
  }

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
  }

  function card(item) {
    const title = item.title || item.name || item.slug || "Untitled";
    const desc = item.description || item.desc || "";
    const url = item.url || item.link || "";
    const img = item.image || item.thumbnail || null;
    const tags = Array.isArray(item.tags) ? item.tags : [];

    const btnPreview = el(
      "button",
      { class: "btn", type: "button", onClick: () => openOverlay(url) },
      [T.preview]
    );
    const btnVisit = el(
      "button",
      {
        class: "btn",
        type: "button",
        onClick: () => {
          if (!url) return;
          window.open(url, "_blank", "noopener");
        },
      },
      [T.visit]
    );

    const tagBar =
      tags.length > 0
        ? el(
            "div",
            { style: "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" },
            tags.map((t) => el("span", { class: "badge", text: t }))
          )
        : null;

    return el("div", { class: "card" }, [
      el("div", { style: "display:flex;gap:12px;align-items:center" }, [
        img ? el("img", { src: img, alt: "", style: "width:72px;height:72px;border-radius:12px;object-fit:cover" }) : null,
        el("div", {}, [el("h3", { text: title, style: "margin:.2rem 0" }), el("p", { text: desc, style: "margin:.2rem 0;opacity:.9" })]),
      ]),
      tagBar,
      el("div", { style: "display:flex;gap:10px;margin-top:10px" }, [btnPreview, btnVisit]),
    ]);
  }

  function renderGrid(list) {
    const grid = $("#portfolioGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (!list.length) {
      grid.appendChild(el("p", { text: "—" }));
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((it) => frag.appendChild(card(it)));
    grid.appendChild(frag);
  }

  // ------- Overlay preview -------
  function openOverlay(url) {
    const overlay = $("#overlay");
    const frame = $("#overlayFrame");
    const close = $("#overlayClose");
    if (!overlay || !frame || !close) return;
    if (!url) return;

    // tente un embed sandbox ; beaucoup de sites interdisent l’embed (X-Frame-Options)
    frame.removeAttribute("src");
    frame.setAttribute("sandbox", "allow-forms allow-scripts allow-same-origin");
    frame.src = url;

    overlay.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  function closeOverlay() {
    const overlay = $("#overlay");
    const frame = $("#overlayFrame");
    if (overlay) overlay.style.display = "none";
    if (frame) frame.removeAttribute("src");
    document.body.style.overflow = "";
  }

  function wireOverlay() {
    const close = $("#overlayClose");
    const overlay = $("#overlay");
    if (close) close.textContent = T.close;
    if (close) close.addEventListener("click", closeOverlay);
    if (overlay)
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeOverlay();
      });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeOverlay();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      renderGrid(getData());
      wireOverlay();
    } catch (e) {
      console.error("portfolio init error:", e);
    }
  });
})();
