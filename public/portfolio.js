/* Portfolio – remplit la grille, overlay d’aperçu avec fallback si embed refusé.
   IDs requis :
   - #portfolioGrid, #overlay, #overlayFrame, #overlayClose
   Données : window.PORTFOLIO.items ou window.portfolioData (Array)
*/
(function () {
  "use strict";

  const LANG = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  const T = {
    fr: { preview: "Aperçu", visit: "Visiter", close: "Fermer", blocked: "Ce site refuse l’aperçu embarqué." },
    en: { preview: "Preview", visit: "Visit", close: "Close", blocked: "This site denies being embedded." },
    de: { preview: "Vorschau", visit: "Besuchen", close: "Schließen", blocked: "Diese Seite untersagt Einbettung." },
  }[LANG] || { preview: "Preview", visit: "Visit", close: "Close", blocked: "Embed blocked." };

  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, a = {}, k = []) => {
    const e = document.createElement(t);
    for (const [k2, v] of Object.entries(a)) {
      if (k2 === "class") e.className = v;
      else if (k2 === "text") e.textContent = v;
      else if (k2.startsWith("on") && typeof v === "function") e.addEventListener(k2.slice(2), v);
      else e.setAttribute(k2, v);
    }
    for (const c of [].concat(k)) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return e;
  };

  function getData() {
    const d =
      (window.PORTFOLIO && (Array.isArray(window.PORTFOLIO.items) ? window.PORTFOLIO.items : window.PORTFOLIO)) ||
      window.portfolioData ||
      [];
    return Array.isArray(d) ? d : [];
  }

  function card(it) {
    const title = it.title || it.name || "Untitled";
    const desc = it.description || it.desc || "";
    const url = it.url || it.link || "";
    const img = it.image || it.thumbnail || null;
    const tags = Array.isArray(it.tags) ? it.tags : [];

    const btnPreview = el("button", { class: "btn", type: "button", onClick: () => openOverlay(url) }, [T.preview]);
    const btnVisit = el(
      "button",
      { class: "btn", type: "button", onClick: () => url && window.open(url, "_blank", "noopener") },
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
      grid.appendChild(el("p", { class: "muted", text: "—" }));
      return;
    }
    const f = document.createDocumentFragment();
    list.forEach((it) => f.appendChild(card(it)));
    grid.appendChild(f);
  }

  // --- Overlay preview with fallback ---
  let blockMsg = null;
  function openOverlay(url) {
    const overlay = $("#overlay");
    const frame = $("#overlayFrame");
    const close = $("#overlayClose");
    if (!overlay || !frame || !close || !url) return;

    // Nettoyage
    frame.removeAttribute("src");
    if (!blockMsg) {
      blockMsg = el("div", {
        id: "overlayBlocked",
        class: "muted",
        style: "position:absolute;top:8px;left:8px;right:8px;pointer-events:none;display:none",
      });
      overlay.appendChild(blockMsg);
    }
    blockMsg.style.display = "none";
    blockMsg.textContent = "";

    // Sandbox sans warning : PAS de combo allow-scripts + allow-same-origin
    // Pour l’aperçu externe, on autorise juste scripts + popups.
    frame.setAttribute("sandbox", "allow-scripts allow-popups");

    // Lancement
    overlay.style.display = "block";
    document.body.style.overflow = "hidden";
    frame.src = url;

    // Fallback si embed refusé (X-Frame-Options / CSP) → affiche message
    const ticket = Symbol("probe");
    frame.dataset.ticket = String(ticket);
    setTimeout(() => {
      if (frame.dataset.ticket !== String(ticket)) return;
      // Si about:blank ou pas d’event 'load' reçu, on suppose blocage
      try {
        // cross-origin : accéder à contentDocument lèvera, on ignore
        const doc = frame.contentDocument;
        if (!doc || doc.location.href === "about:blank") throw new Error("blank");
      } catch {
        blockMsg.textContent = T.blocked + "  ➜  " + (LANG === "fr" ? "Utilisez « Visiter »" : LANG === "de" ? "Bitte «Besuchen» nutzen" : "Use “Visit”");
        blockMsg.style.display = "block";
      }
    }, 1300);

    // Fermer via Escape
    const onKey = (e) => e.key === "Escape" && closeOverlay();
    document.addEventListener("keydown", onKey, { once: true });
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
