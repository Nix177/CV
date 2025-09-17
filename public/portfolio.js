/* public/portfolio.js
   - Boutons « Aperçu » et « Visiter » fonctionnels
   - Overlay sécurisé (pas de allow-same-origin)
   - Tolère plusieurs formats de données (portfolioData / PORTFOLIO.items / PORTFOLIO_ITEMS)
*/
(function () {
  "use strict";

  const LANG = (document.documentElement.getAttribute("lang") || "fr").slice(0,2).toLowerCase();
  const T = {
    fr: { preview: "Aperçu", visit: "Visiter", close: "Fermer", blocked: "Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter »." },
    en: { preview: "Preview", visit: "Visit",  close: "Close",  blocked: "This site denies being embedded. ➜ Use “Visit”." },
    de: { preview: "Vorschau", visit: "Besuchen", close: "Schließen", blocked: "Diese Seite untersagt Einbettung. ➜ «Besuchen» nutzen." },
  }[LANG] || { preview: "Aperçu", visit: "Visiter", close: "Fermer", blocked: "Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter »." };

  const $ = (s, r=document) => r.querySelector(s);
  const el = (t, a={}, kids=[]) => {
    const e = document.createElement(t);
    for (const [k,v] of Object.entries(a)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") {
        // ⚠️ correctif : normaliser en lowercase (ex. onClick -> 'click')
        e.addEventListener(k.slice(2).toLowerCase(), v);
      } else e.setAttribute(k, v);
    }
    for (const k of [].concat(kids)) if (k != null) e.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
    return e;
  };

  function getData() {
    const d =
      (Array.isArray(window.portfolioData) && window.portfolioData) ||
      (window.PORTFOLIO && Array.isArray(window.PORTFOLIO.items) && window.PORTFOLIO.items) ||
      (Array.isArray(window.PORTFOLIO) && window.PORTFOLIO) ||
      (Array.isArray(window.PORTFOLIO_ITEMS) && window.PORTFOLIO_ITEMS) ||
      [];
    return Array.isArray(d) ? d : [];
  }

  function ensureFallbackDataOnce() {
    const data = getData();
    if (data.length) return;
    window.portfolioData = [
      { title: "Jeu Osselets", url: "/ai-lab.html", description: "Runner 2D pédagogique", tags: ["JS","Éducation"] },
      { title: "Chatbot", url: "/chatbot.html", description: "Assistant pédagogique", tags: ["IA"] }
    ];
  }

  function card(it) {
    const title = it.title || it.name || "Untitled";
    const desc  = it.description || it.desc || "";
    const url   = it.url || it.link || "";
    const img   = it.image || it.thumbnail || null;
    const tags  = Array.isArray(it.tags) ? it.tags : [];

    const btnPreview = el("button", { class:"btn", type:"button", onClick: () => openOverlay(url, title) }, [T.preview]);
    const btnVisit   = el("button", { class:"btn", type:"button", onClick: () => url && window.open(url, "_blank", "noopener") }, [T.visit]);

    const left = el("div", {}, [
      el("h3", { text: title, style: "margin:.2rem 0" }),
      el("p",  { text: desc,  style: "margin:.2rem 0;opacity:.9" })
    ]);

    const header = el("div", { style:"display:flex;gap:12px;align-items:center" }, [
      img ? el("img", { src: img, alt: "", style:"width:72px;height:72px;border-radius:12px;object-fit:cover" }) : null,
      left
    ]);

    const tagBar = tags.length
      ? el("div", { style:"display:flex;gap:6px;flex-wrap:wrap;margin-top:6px" }, tags.map(t=>el("span",{class:"badge",text:t})))
      : null;

    return el("div", { class:"card" }, [
      header,
      tagBar,
      el("div", { style:"display:flex;gap:10px;margin-top:10px" }, [btnPreview, btnVisit])
    ]);
  }

  function renderGrid(list) {
    const grid = $("#portfolioGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (!list.length) {
      grid.appendChild(el("p", { class:"muted", text:"— (aucun élément)" }));
      return;
    }
    const f = document.createDocumentFragment();
    list.forEach(it => f.appendChild(card(it)));
    grid.appendChild(f);
  }

  // Overlay (sécurisé)
  function openOverlay(url, title) {
    const overlay = $("#overlay");
    const frame   = $("#overlayFrame");
    const close   = $("#overlayClose");
    const heading = $("#ovlTitle") || $("#overlayTitle");
    if (!overlay || !frame || !close || !url) return;

    if (heading) heading.textContent = title || "Aperçu";
    frame.removeAttribute("src");

    // Message "no-embed" si bloqué
    let blockMsg = $("#overlayBlocked");
    if (!blockMsg) {
      blockMsg = el("div", { id:"overlayBlocked", class:"muted",
        style:"position:absolute;top:54px;left:12px;right:12px;display:none;color:#fff" });
      (overlay.querySelector(".panel") || overlay.querySelector(".overlay-inner") || overlay).appendChild(blockMsg);
    }
    blockMsg.style.display = "none";
    blockMsg.textContent = "";

    // PAS de allow-same-origin (évite l’avertissement et réduit les risques)
    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    frame.src = url;

    // Probe : si about:blank ou bloqué par X-Frame-Options/CSP
    const ticket = Symbol("probe");
    frame.dataset.ticket = String(ticket);
    setTimeout(() => {
      if (frame.dataset.ticket !== String(ticket)) return;
      try {
        const d = frame.contentDocument;
        if (!d || d.location.href === "about:blank") throw 0;
      } catch {
        blockMsg.textContent = T.blocked;
        blockMsg.style.display = "block";
      }
    }, 900);

    const closeOverlay = () => {
      overlay.style.display = "none";
      frame.removeAttribute("src");
      document.body.style.overflow = "";
    };
    close.addEventListener("click", closeOverlay, { once:true });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeOverlay(); }, { once:true });
    document.addEventListener("keydown", (e) => e.key === "Escape" && closeOverlay(), { once:true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureFallbackDataOnce();
    renderGrid(getData());
  });
})();
