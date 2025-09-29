/* public/portfolio.js
   Portfolio grid + Preview overlay (sécurisé)
   - Rendu depuis public/portfolio-data.js (ou variables globales équivalentes)
   - Bouton "Aperçu" -> overlay <iframe sandbox>, message si X-Frame-Options bloque
   - AUCUNE dépendance supplémentaire. Compatible avec portfolio.html présent.
*/
(function () {
  "use strict";

  // -------- Langue --------
  const htmlLang = (document.documentElement.getAttribute("lang") || "fr").slice(0,2).toLowerCase();
  const T = ({
    fr: { preview:"Aperçu", visit:"Visiter", close:"Fermer",
          blocked:"Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter ».",
          loading:"Chargement de l’aperçu…" },
    en: { preview:"Preview", visit:"Visit", close:"Close",
          blocked:"This site denies being embedded. ➜ Use “Visit”.",
          loading:"Loading preview…" },
    de: { preview:"Vorschau", visit:"Besuchen", close:"Schließen",
          blocked:"Diese Seite untersagt Einbettung. ➜ «Besuchen» nutzen.",
          loading:"Vorschau wird geladen…" }
  })[htmlLang] || {
    preview:"Aperçu", visit:"Visiter", close:"Fermer",
    blocked:"Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter »." ,
    loading:"Chargement de l’aperçu…"
  };

  // -------- Helpers --------
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

  // -------- Données --------
  function loadData() {
    const d = (window.portfolioData)
      || (window.PORTFOLIO && window.PORTFOLIO.items)
      || window.PORTFOLIO_ITEMS
      || [];
    return Array.isArray(d) ? d : [];
  }
  function pickI18n(it) {
    const i = it.i18n || {};
    const L = i[htmlLang] || i.fr || Object.values(i)[0] || {};
    return {
      title: L.title || it.title || it.name || "Untitled",
      description: L.description || it.description || it.desc || "",
      url: L.url || it.url || it.link || ""
    };
  }

  // -------- Overlay / Aperçu --------

  // Localise l'overlay existant (#overlay/*) OU la variante (#pfOverlay/*)
  function findExistingOverlay() {
    // overlay principal
    let ovl = $("#overlay");
    let panel = ovl?.querySelector(".panel") || null;
    let frame = ovl ? ($("#overlayFrame", ovl) || null) : null;
    let close = ovl ? ($("#overlayClose", ovl) || null) : null;
    let title = ovl ? ($("#ovlTitle", ovl) || null) : null;

    // sinon, variante "pf*"
    if (!ovl) {
      ovl = $("#pfOverlay");
      panel = ovl?.querySelector(".panel") || null;
      frame = ovl ? ($("#pfFrame", ovl) || null) : null;
      close = ovl ? ($("#pfClose", ovl) || null) : null;
      title = ovl ? ($("#pfTitle", ovl) || null) : null;
    }

    return { ovl, panel, frame, close, title };
  }

  function ensureOverlay() {
    let { ovl, panel, frame, close, title } = findExistingOverlay();

    // Crée un overlay minimal si aucun n'est présent
    if (!ovl) {
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
      panel = ovl.querySelector(".panel");
      frame = $("#overlayFrame", ovl);
      close = $("#overlayClose", ovl);
      title = $("#ovlTitle", ovl);
    }

    // Styles inline robustes
    ovl.style.position = "fixed";
    ovl.style.inset = "0";
    // utilise !important pour outrepasser un éventuel display:none !important du CSS global
    ovl.style.setProperty("display", "none", "important");
    ovl.style.zIndex = "99999";
    ovl.style.alignItems = "center";
    ovl.style.justifyContent = "center";
    ovl.style.padding = "18px";
    ovl.style.background = "rgba(0,0,0,.55)";

    if (panel) {
      panel.style.position = "relative";
      panel.style.background = "#0b2237";
      panel.style.border = "1px solid #ffffff22";
      panel.style.borderRadius = "12px";
      panel.style.width = "min(1100px, 100%)";
      panel.style.height = "min(78vh, 100%)";
      panel.style.overflow = "hidden";
      panel.style.display = "flex";
      panel.style.flexDirection = "column";
    }

    const header = panel?.querySelector("header") || panel?.insertBefore(el("header", {}), panel.firstChild);
    if (header) {
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.gap = "10px";
      header.style.padding = "10px 12px";
      header.style.borderBottom = "1px solid #ffffff22";
      header.style.color = "#fff";
    }

    if (!title && header) title = header.appendChild(el("strong", { id:"ovlTitle" }));
    if (!close && header) close = header.appendChild(el("button", { id:"overlayClose", class:"btn" }, T.close));
    if (!frame && panel) frame = panel.appendChild(el("iframe", { id:"overlayFrame", title:T.preview }));

    if (frame) {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.flex = "1 1 auto";
      frame.style.border = "0";
      frame.style.background = "#fff";
      frame.setAttribute("sandbox","allow-scripts allow-popups");
    }

    return { ovl, panel, frame, close, title };
  }

  function ensureMsg(ovl) {
    let msg = $("#pfMsg", ovl);
    if (!msg) {
      const panel = ovl.querySelector(".panel") || ovl;
      msg = el("div", { id:"pfMsg", class:"muted", style:"display:none;padding:8px 12px;color:#e6f1ff" }, T.blocked);
      panel.appendChild(msg);
    }
    return msg;
  }

  function ensureSpinner(ovl) {
    let sp = $("#pfSpin", ovl);
    if (!sp) {
      sp = el("div", { id:"pfSpin", style:"position:absolute;inset:auto 12px 12px auto;background:#0b1f33;color:#e6f1ff;border:1px solid #ffffff33;border-radius:10px;padding:6px 10px;display:none" }, T.loading);
      (ovl.querySelector(".panel") || ovl).appendChild(sp);
    }
    return sp;
  }

  function toAbsoluteUrl(url) {
    try {
      // accepte relatif et absolu
      return new URL(url, location.href).toString();
    } catch {
      return url;
    }
  }

  function openOverlay(url, title) {
    if (!url) return;

    // Autorise relative -> résolue en absolu, garde absolu tel quel
    url = toAbsoluteUrl(url);

    const { ovl, panel, frame, close, title: titleEl } = ensureOverlay();
    const msg = ensureMsg(ovl);
    const spin = ensureSpinner(ovl);

    if (!frame || !close) return;

    if (titleEl) titleEl.textContent = title || "";
    msg.style.display = "none";
    spin.style.display = "inline-block";

    // affiche avec priorité (important) pour contrer un display:none !important
    ovl.style.setProperty("display", "flex", "important");
    document.body.style.overflow = "hidden";

    // reset & (re)charge
    frame.removeAttribute("src");
    frame.setAttribute("sandbox","allow-scripts allow-popups");

    let loaded = false;
    const onLoad = () => { loaded = true; spin.style.display="none"; };
    frame.addEventListener("load", onLoad, { once:true });
    frame.src = url;

    const timer = setTimeout(() => {
      if (!loaded) { msg.style.display = "block"; spin.style.display = "none"; }
    }, 2000);

    const closeOvl = () => {
      clearTimeout(timer);
      ovl.style.setProperty("display", "none", "important");
      document.body.style.overflow = "";
      frame.removeAttribute("src");
      close.removeEventListener("click", closeOvl);
      ovl.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onEsc);
    };
    const onBackdrop = (e) => { if (e.target === ovl) closeOvl(); };
    const onEsc = (e) => { if (e.key === "Escape") closeOvl(); };

    close.addEventListener("click", closeOvl);
    ovl.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onEsc);
  }

  // -------- Cartes --------
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

    return el("div", { class:"p-card" }, [left, right]);
  }

  function renderGrid(items) {
    const grid = document.getElementById("portfolioGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    items.forEach(it => frag.appendChild(makeCard(it)));
    grid.appendChild(frag);
  }

  // -------- Boot --------
  document.addEventListener("DOMContentLoaded", () => {
    renderGrid(loadData());

    // Filet de sécurité : si un autre markup déclare data-preview-url
    document.addEventListener("click", (e) => {
      const n = e.target.closest?.("[data-preview-url]");
      if (!n) return;
      e.preventDefault();
      openOverlay(n.getAttribute("data-preview-url"), n.getAttribute("data-title") || "");
    }, { passive:false });
  });
})();
