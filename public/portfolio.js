/* Portfolio – auto-scaffold + overlay propre (pas de sandbox dangereux)
   Lit les données depuis:
   - window.portfolioData
   - window.PORTFOLIO.items
   - window.PORTFOLIO (si c’est un Array)
   - window.PORTFOLIO_ITEMS
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
  const el = (t, a = {}, kids = []) => {
    const e = document.createElement(t);
    for (const [k, v] of Object.entries(a)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const k of [].concat(kids)) e.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
    return e;
  };

  // 1) Assure la présence du markup minimal si la page est vide
  function ensureScaffold() {
    let grid = $("#portfolioGrid");
    if (!grid) {
      const main = $("main") || document.body;
      grid = el("div", { id: "portfolioGrid", class: "grid-cards" });
      main.appendChild(grid);
    }
    let overlay = $("#overlay");
    if (!overlay) {
      overlay = el("div", { id: "overlay", class: "overlay", role:"dialog","aria-modal":"true" }, [
        el("div", { class: "panel" }, [
          el("header", {}, [
            el("strong", { id: "ovlTitle", text: "Aperçu" }),
            el("button", { id: "overlayClose", class: "btn", text: T.close }),
          ]),
          el("iframe", { id: "overlayFrame", title:"Aperçu", sandbox:"allow-scripts allow-popups" })
        ])
      ]);
      (document.body).appendChild(overlay);
    }
  }

  function getData() {
    const c =
      (window.portfolioData && window.portfolioData) ||
      (window.PORTFOLIO && (Array.isArray(window.PORTFOLIO.items) ? window.PORTFOLIO.items : window.PORTFOLIO)) ||
      window.PORTFOLIO_ITEMS ||
      [];
    return Array.isArray(c) ? c : [];
  }

  function card(it) {
    const title = it.title || it.name || "Untitled";
    const desc  = it.description || it.desc || "";
    const url   = it.url || it.link || "";
    const img   = it.image || it.thumbnail || null;
    const tags  = Array.isArray(it.tags) ? it.tags : [];

    const btnPreview = el("button", { class: "btn", type: "button", onClick: () => openOverlay(url, title) }, [T.preview]);
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
      grid.appendChild(el("p", { class: "muted", text: "— (aucun élément)" }));
      return;
    }
    const f = document.createDocumentFragment();
    list.forEach((it) => f.appendChild(card(it)));
    grid.appendChild(f);
  }

  // Overlay + fallback si no-embed
  let blockMsg = null;
  function openOverlay(url, title) {
    const overlay = $("#overlay");
    const frame   = $("#overlayFrame");
    const close   = $("#overlayClose");
    const heading = $("#ovlTitle");
    if (!overlay || !frame || !close || !url) return;

    if (heading) heading.textContent = (title || "Aperçu");

    frame.removeAttribute("src");

    if (!blockMsg) {
      blockMsg = el("div", {
        id: "overlayBlocked",
        class: "muted",
        style: "position:absolute;top:50px;left:12px;right:12px;pointer-events:none;display:none;color:#fff"
      });
      overlay.querySelector(".panel").appendChild(blockMsg);
    }
    blockMsg.style.display = "none";
    blockMsg.textContent = "";

    frame.setAttribute("sandbox", "allow-scripts allow-popups"); // PAS de allow-same-origin
    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    frame.src = url;

    const ticket = Symbol("probe");
    frame.dataset.ticket = String(ticket);
    // si about:blank ou load bloqué → message + propose Visiter
    setTimeout(() => {
      if (frame.dataset.ticket !== String(ticket)) return;
      try {
        const doc = frame.contentDocument;
        if (!doc || doc.location.href === "about:blank") throw new Error("blank");
      } catch {
        blockMsg.textContent = T.blocked + "  ➜  " + (LANG === "fr" ? "Utilisez « Visiter »." : LANG === "de" ? "Bitte «Besuchen» nutzen." : "Use “Visit”.");
        blockMsg.style.display = "block";
      }
    }, 1200);

    close.addEventListener("click", closeOverlay, { once: true });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeOverlay(); }, { once: true });
    document.addEventListener("keydown", (e) => e.key === "Escape" && closeOverlay(), { once: true });
  }

  function closeOverlay() {
    const overlay = $("#overlay");
    const frame   = $("#overlayFrame");
    if (overlay) overlay.style.display = "none";
    if (frame)   frame.removeAttribute("src");
    document.body.style.overflow = "";
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureScaffold();

    // Data absente ? on met un petit échantillon pour éviter le "vide total"
    const data = getData();
    if (!data.length) {
      console.warn("portfolioData introuvable — utilisation d’un exemple minimal.");
      window.portfolioData = [
        { title: "Jeu Osselets", url: "/ai-lab.html", description: "Runner 2D pédagogique", tags: ["JS","Édu"] },
        { title: "Chatbot", url: "/chatbot.html", description: "Assistant pédagogique", tags: ["IA"] }
      ];
    }

    renderGrid(getData());
  });
})();
