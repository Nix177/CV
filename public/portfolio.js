/* public/portfolio.js
   Renders the portfolio grid from public/portfolio-data.js (i18n-aware).
   Keeps behaviour: Preview (overlay iframe, sandbox) + Visit (new tab).
   Vanilla, no deps. No inline sizing (CSS controls everything).
*/
(function () {
  "use strict";

  const htmlLang = (document.documentElement.getAttribute("lang") || "fr")
    .slice(0,2).toLowerCase();

  const T = ({
    fr: { preview:"Aperçu", visit:"Visiter", close:"Fermer",
          blocked:"Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter »." },
    en: { preview:"Preview", visit:"Visit", close:"Close",
          blocked:"This site denies being embedded. ➜ Use “Visit”." },
    de: { preview:"Vorschau", visit:"Besuchen", close:"Schließen",
          blocked:"Diese Seite untersagt Einbettung. ➜ «Besuchen» nutzen." }
  })[htmlLang] || {
    preview:"Aperçu", visit:"Visiter", close:"Fermer",
    blocked:"Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter »."
  };

  const $  = (s, r=document) => r.querySelector(s);
  const el = (tag, attrs={}, children=[]) => {
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  };

  // ---- data
  function loadData() {
    const d = (window.portfolioData || (window.PORTFOLIO && window.PORTFOLIO.items) || window.PORTFOLIO_ITEMS || []);
    return Array.isArray(d) ? d : [];
  }
  function pickI18n(it) {
    const i = it.i18n || {};
    const L = i[htmlLang] || i.fr || Object.values(i)[0] || {};
    const title = L.title || it.title || it.name || "Untitled";
    const description = L.description || it.description || it.desc || "";
    const url = (L.url || it.url || it.link || "");
    return { title, description, url };
  }

  // ---- overlay
  function resetInlineSizing() {
    const o = $("#overlay"), f = $("#overlayFrame");
    const d = $("#ovlDialog"), b = $("#ovlBody");
    [o,f,d,b].forEach(x => { if (x) { x.removeAttribute("style"); }});
  }
  function openOverlay(url, title) {
    const overlay = $("#overlay");
    const dialog  = $("#ovlDialog");
    const frame   = $("#overlayFrame");
    const ovlTitle = $("#ovlTitle");
    const ovlMsg   = $("#ovlMsg");
    const btnClose = $("#btnClose");

    // purge any legacy inline styles so CSS wins
    resetInlineSizing();

    ovlTitle.textContent = title || "";
    ovlMsg.style.display = "none";
    frame.removeAttribute("src");

    overlay.style.display = "flex";          // (layout is fully CSS-driven)
    document.body.style.overflow = "hidden";

    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    frame.src = url;

    const timer = setTimeout(() => { ovlMsg.style.display = "block"; }, 2000);

    const close = () => {
      clearTimeout(timer);
      overlay.style.display = "none";
      document.body.style.overflow = "";
      frame.removeAttribute("src");
      btnClose.removeEventListener("click", close);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onEsc);
    };
    const onBackdrop = (e) => { if (e.target === overlay) close(); };
    const onEsc = (e) => { if (e.key === "Escape") close(); };

    btnClose.addEventListener("click", close);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onEsc);
  }

  // ---- cards
  function makeCard(it) {
    const { title, description, url } = pickI18n(it);
    const img  = it.image || it.thumbnail || null;
    const tags = Array.isArray(it.tags) ? it.tags : [];

    const head = el("div", { class:"pf-head" }, [
      img ? el("img", { class:"pf-thumb", src: img, alt:"" }) : null,
      el("div", {}, [
        el("h3", { class:"pf-title", text:title }),
        description ? el("p", { class:"pf-desc", text:description }) : null
      ])
    ]);

    const tagBar = tags.length
      ? el("div", { class:"pf-tags" }, tags.map(t => el("span", { class:"badge", text:t })))
      : null;

    const actions = el("div", { class:"pf-actions" }, [
      el("button", { class:"btn", onClick: () => openOverlay(url, title) }, T.preview),
      el("button", { class:"btn", onClick: () => url && window.open(url, "_blank", "noopener") }, T.visit)
    ]);

    return el("div", { class:"card pf-card" }, [head, tagBar, actions]);
  }

  function renderGrid(list) {
    const grid = $("#portfolioGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (!list.length) {
      grid.appendChild(el("p", { class:"muted", text:"(Aucun projet pour le moment.)" }));
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach(it => frag.appendChild(makeCard(it)));
    grid.appendChild(frag);
  }

  function initOverlayTexts() {
    const close = $("#btnClose");
    const msg   = $("#ovlMsg");
    if (close) close.textContent = T.close;
    if (msg)   msg.textContent   = T.blocked;
  }

  document.addEventListener("DOMContentLoaded", () => {
    initOverlayTexts();
    renderGrid(loadData());
  });
})();
