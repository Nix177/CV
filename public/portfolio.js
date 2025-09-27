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

  // --- Overlay : réutilise l'existant (#overlay) sinon crée un fallback compatible
  function ensureOverlay() {
    // 1) Overlay natif défini dans la page (portfolio.html) :
    //    <div id="overlay" class="overlay"> ... <iframe id="overlayFrame"> ... <button id="overlayClose">
    let ovl = $("#overlay");
    if (ovl) return ovl;

    // 2) Si absent (p.ex. autres variantes), on crée un overlay minimal compatible
    ovl = el("div", { id:"overlay", class:"overlay", role:"dialog", "aria-modal":"true", "aria-labelledby":"ovlTitle" }, [
      el("div", { class:"panel" }, [
        el("header", {}, [
          el("strong", { id:"ovlTitle", text:"" }),
          el("button", { id:"overlayClose", class:"btn" }, T.close)
        ]),
        el("iframe", { id:"overlayFrame", title:T.preview, sandbox:"allow-scripts allow-popups" })
      ])
    ]);
    document.body.appendChild(ovl);
    return ovl;
  }

  function ensureBlockedMsg(ovl) {
    // Ajoute un petit message si la cible bloque l’embed (X-Frame-Options)
    let msg = $("#pfMsg", ovl);
    if (!msg) {
      const panel = ovl.querySelector(".panel") || ovl;
      msg = el("div", { id:"pfMsg", class:"muted", style:"display:none;padding:8px 12px" }, T.blocked);
      panel.appendChild(msg);
    }
    return msg;
  }

  function openOverlay(url, title) {
    const ovl = ensureOverlay();
    // Supporte les deux schémas d'IDs (#overlayFrame/#overlayClose ou #pfFrame/#pfClose)
    const frame = $("#overlayFrame", ovl) || $("#pfFrame", ovl);
    const titleEl = $("#ovlTitle", ovl) || $("#pfTitle", ovl) || ovl.querySelector("strong");
    const btnClose = $("#overlayClose", ovl) || $("#pfClose", ovl);
    const msg = ensureBlockedMsg(ovl);

    if (!frame || !btnClose) return; // garde-fou

    if (titleEl) titleEl.textContent = title || "";
    if (msg) msg.style.display = "none";

    // Affiche l’overlay (ne dépend plus d’une classe CSS)
    ovl.style.display = "flex";
    ovl.style.alignItems = "center";
    ovl.style.justifyContent = "center";
    document.body.style.overflow = "hidden";

    // (re)charge l’iframe
    frame.removeAttribute("src");
    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    frame.src = url;

    // Si rien n'apparaît au bout de 2s, on montre le message "bloqué"
    const timer = setTimeout(() => { if (msg) msg.style.display = "block"; }, 2000);

    const close = () => {
      clearTimeout(timer);
      ovl.style.display = "";          // cache l’overlay
      document.body.style.overflow = "";
      frame.removeAttribute("src");    // stoppe le chargement
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
