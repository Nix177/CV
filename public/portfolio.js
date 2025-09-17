/* Portfolio – remplit la grille + overlay avec fallback no-embed.
   Reçoit les données depuis :
   - window.portfolioData (Array)  ✅
   - window.PORTFOLIO.items (Array) ✅
   - window.PORTFOLIO (Array) ✅
   - window.PORTFOLIO_ITEMS (Array) ✅
*/
(function () {
  "use strict";

  const LANG = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  const T = {
    fr: { preview: "Aperçu", visit: "Visiter", close: "Fermer", blocked: "Ce site refuse l’aperçu embarqué." },
    en: { preview: "Preview", visit: "Visit",  close: "Close",  blocked: "This site denies being embedded." },
    de: { preview: "Vorschau", visit: "Besuchen", close: "Schließen", blocked: "Diese Seite untersagt Einbettung." },
  }[LANG] || { preview: "Preview", visit: "Visit", close: "Close", blocked: "Embed blocked." };

  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, a = {}, k = []) => {
    const e = document.createElement(t);
    for (const [kk, vv] of Object.entries(a)) {
      if (kk === "class") e.className = vv;
      else if (kk === "text") e.textContent = vv;
      else if (kk.startsWith("on") && typeof vv === "function") e.addEventListener(kk.slice(2), vv);
      else e.setAttribute(kk, vv);
    }
    for (const c of [].concat(k)) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return e;
  };

  function getData() {
    // tolérance maximale
    const cand =
      window.portfolioData ||
      (window.PORTFOLIO && (Array.isArray(window.PORTFOLIO.items) ? window.PORTFOLIO.items : window.PORTFOLIO)) ||
      window.PORTFOLIO_ITEMS ||
      [];
    return Array.isArray(cand) ? cand : [];
  }

  function card(it) {
    const title = it.title || it.name || "Untitled";
    const desc  = it.description || it.desc || "";
    const url   = it.url || it.link || "";
    const img   = it.image || it.thumbnail || null;
    const tags  = Array.isArray(it.tags) ? it.tags : [];

    const btnPreview = el("button", { class: "btn", type: "button", onClick: () => openOverlay(url) }, [T.preview]);
    const btnVisit   = el("button", { class: "btn", type: "button", onClick: () => url && window.open(url, "_blank", "noopener") }, [T.visit]);

    const tagBar = tags.length
      ? el("div", { style: "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" },
          tags.map((t) => el("span", { class: "badge", text: t })))
      : null;

    return el("div", { class: "card" }, [
      el("div", { style: "display:flex;gap:12px;align-items:center" }, [
        img ? el("img", { src: img, alt: "", style: "width:72px;height:72px;border-radius:12px;object-fit:cover" }) : null,
        el("div", {}, [
          el("h3", { text: title, style: "margin:.2rem 0" }),
          el("p",  { text: desc,  style: "margin:.2rem 0;opacity:.9" })
        ]),
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

  // Overlay d’aperçu (tentative sandbox + fallback no-embed)
  let blockMsg = null;
  function openOverlay(url) {
    const overlay = $("#overlay");
    const frame   = $("#overlayFrame");
    const close   = $("#overlayClose");
    if (!overlay || !frame || !close || !url) return;

    frame.removeAttribute("src");
    if (!blockMsg) {
      blockMsg = el("div", {
        id: "overlayBlocked",
        class: "muted",
        style: "position:absolute;top:8px;left:8px;right:8px;pointer-events:none;display:none"
      });
      overlay.appendChild(blockMsg);
    }
    blockMsg.style.display = "none";
    blockMsg.textContent = "";

    // pas de combo allow-scripts + allow-same-origin
    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    overlay.style.display = "block";
    document.body.style.overflow = "hidden";
    frame.src = url;

    const ticket = Symbol("probe");
    frame.dataset.ticket = String(ticket);
    setTimeout(() => {
      if (frame.dataset.ticket !== String(ticket)) return;
      try {
        const doc = frame.contentDocument;
        if (!doc || doc.location.href === "about:blank") throw new Error("blank");
      } catch {
        blockMsg.textContent = T.blocked + "  ➜  " + (LANG === "fr" ? "Utilisez « Visiter »" : LANG === "de" ? "Bitte «Besuchen» nutzen" : "Use “Visit”");
        blockMsg.style.display = "block";
      }
    }, 1200);

    document.addEventListener("keydown", (e) => e.key === "Escape" && closeOverlay(), { once: true });
  }

  function closeOverlay() {
    const overlay = $("#overlay");
    const frame   = $("#overlayFrame");
    if (overlay) overlay.style.display = "none";
    if (frame)   frame.removeAttribute("src");
    document.body.style.overflow = "";
  }

  function wireOverlay() {
    const close = $("#overlayClose");
    const overlay = $("#overlay");
    if (close) close.textContent = T.close;
    if (close) close.addEventListener("click", closeOverlay);
    if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeOverlay(); });
  }

  document.addEventListener("DOMContentLoaded", () => {
    try { renderGrid(getData()); wireOverlay(); }
    catch (e) { console.error("portfolio init error:", e); }
  });
})();
