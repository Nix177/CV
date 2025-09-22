/* public/portfolio.js
   Rendu du portfolio à partir de public/portfolio-data.js (avec i18n).
   Aperçu = overlay <iframe> sécurisé (sandbox), Visiter = nouvel onglet.
   Vanilla JS, sans dépendances.
*/
(function () {
  "use strict";

  // Langue de la page
  const htmlLang = (document.documentElement.getAttribute("lang") || "fr").slice(0,2).toLowerCase();

  // Libellés
  const T = ({
    fr: { preview:"Aperçu", visit:"Visiter", close:"Fermer", blocked:"Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter »." },
    en: { preview:"Preview", visit:"Visit",  close:"Close",  blocked:"This site denies being embedded. ➜ Use “Visit”." },
    de: { preview:"Vorschau", visit:"Besuchen", close:"Schließen", blocked:"Diese Seite untersagt Einbettung. ➜ «Besuchen» nutzen." }
  })[htmlLang] || { preview:"Aperçu", visit:"Visiter", close:"Fermer", blocked:"Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter »." };

  // Helpers
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
      if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  };

  // Charge les données (quel que soit l’ancien format)
  function loadData() {
    const d = window.portfolioData
      || (window.PORTFOLIO && window.PORTFOLIO.items)
      || window.PORTFOLIO_ITEMS
      || [];
    return Array.isArray(d) ? d : [];
  }

  // Sélectionne titre/desc/url selon la langue (avec fallback)
  function pickI18n(it) {
    const i = it.i18n || {};
    const L = i[htmlLang] || i.fr || Object.values(i)[0] || {};
    return {
      title: L.title || it.title || it.name || "Untitled",
      description: L.description || it.description || it.desc || "",
      url: L.url || it.url || it.link || ""
    };
  }

  // --- Overlay (créé si absent dans la page)
  function ensureOverlay() {
    let ovl = $("#pfOverlay");
    if (ovl) return ovl;

    ovl = el("div", { id:"pfOverlay", class:"overlay", role:"dialog", "aria-modal":"true", "aria-labelledby":"pfTitle" }, [
      el("div", { class:"pf-panel" }, [
        el("div", { class:"pf-head" }, [
          el("strong", { id:"pfTitle", text:"" }),
          el("button", { id:"pfClose", class:"btn" }, T.close)
        ]),
        el("div", { class:"pf-frame" }, [
          el("iframe", { id:"pfFrame", title:T.preview, sandbox:"allow-scripts allow-popups" })
        ]),
        el("div", { id:"pfMsg", class:"muted", style:"display:none;padding:8px 12px" }, T.blocked)
      ])
    ]);
    document.body.appendChild(ovl);
    return ovl;
  }

  function openOverlay(url, title) {
    const ovl = ensureOverlay();
    const frame = $("#pfFrame");
    const titleEl = $("#pfTitle");
    const msg = $("#pfMsg");
    const btnClose = $("#pfClose");

    titleEl.textContent = title || "";
    msg.style.display = "none";
    frame.removeAttribute("src");

    ovl.classList.add("show");
    document.body.style.overflow = "hidden";

    // On ne donne pas allow-same-origin pour éviter les alertes du site cible
    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    frame.src = url;

    const timer = setTimeout(() => { msg.style.display = "block"; }, 2000);

    const close = () => {
      clearTimeout(timer);
      ovl.classList.remove("show");
      document.body.style.overflow = "";
      frame.removeAttribute("src");
      btnClose.removeEventListener("click", close);
      ovl.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onEsc);
    };
    const onBackdrop = (e) => { if (e.target === ovl) close(); };
    const onEsc = (e) => { if (e.key === "Escape") close(); };

    btnClose.addEventListener("click", close);
    ovl.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onEsc);
  }

  // Cartes
  function makeCard(it) {
    const { title, description, url } = pickI18n(it);
    const img  = it.image || it.thumbnail || null;
    const tags = Array.isArray(it.tags) ? it.tags : [];

    const left = el("div", { class:"p-thumb", ...(img ? { style:`background-image:url(${img})` } : {}) });
    const right = el("div", {}, [
      el("h3", { class:"p-title", text:title }),
      description ? el("p", { class:"p-desc", text:description }) : null,
      tags.length ? el("div", { class:"pf-tags" }, tags.map(t => el("span", { class:"badge", text:t }))) : null,
      el("div", { class:"p-actions" }, [
        el("button", { class:"btn linkish", onClick:() => openOverlay(url, title) }, T.preview),
        el("a", { class:"btn primary", href:url, target:"_blank", rel:"noopener" }, T.visit)
      ])
    ]);

    const card = el("div", { class:"p-card" }, [left, right]);
    return card;
  }

  function renderGrid(items) {
    const grid = document.getElementById("portfolioGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    items.forEach(it => frag.appendChild(makeCard(it)));
    grid.appendChild(frag);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderGrid(loadData());
  });
})();
