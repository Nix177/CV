/* public/portfolio.js
   Portfolio grid + Preview overlay (sécurisé)
   - Rendu depuis public/portfolio-data.js (ou variables globales équivalentes)
   - Bouton "Aperçu" -> overlay <iframe sandbox>, message si X-Frame-Options bloque
   - AUCUNE dépendance supplémentaire.
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
    blocked:"Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter ».",
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
  function toAbsoluteUrl(url) {
    try { return new URL(url, location.href).toString(); }
    catch { return url; }
  }

  // Préfère #pfOverlay (aligne avec style.css), sinon #overlay
  function getOverlayElements() {
    // Variante stylée par le CSS: #pfOverlay + .show + échelle iframe
    let ovl = $("#pfOverlay");
    if (ovl) {
      const panel = ovl.querySelector(".pf-panel") || ovl.querySelector(".panel") || ovl;
      const head  = ovl.querySelector(".pf-head")  || ovl.querySelector("header");
      const frameWrap = ovl.querySelector(".pf-frame");
      let frame = $("#pfFrame", ovl) || ovl.querySelector("iframe");
      let title = $("#pfTitle", ovl) || (head && head.querySelector("strong"));
      let close = $("#pfClose", ovl) || (head && head.querySelector("button"));

      // petits correctifs si markup simplifié
      if (!frame && panel) frame = panel.appendChild(el("iframe", { id:"pfFrame" }));
      if (frame) {
        frame.setAttribute("title", T.preview);
        frame.setAttribute("sandbox","allow-scripts allow-popups");
      }
      return { kind:"pf", ovl, panel, frame, title, close };
    }

    // Fallback générique: #overlay
    ovl = $("#overlay");
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
    }
    const panel = ovl.querySelector(".panel") || ovl;
    const frame = $("#overlayFrame", ovl) || panel.querySelector("iframe");
    const title = $("#ovlTitle", ovl) || panel.querySelector("strong");
    const close = $("#overlayClose", ovl) || panel.querySelector("button");
    // Styles inline robustes
    Object.assign(ovl.style, {
      position:"fixed", inset:"0", zIndex:"99999",
      alignItems:"center", justifyContent:"center", padding:"18px",
      background:"rgba(0,0,0,.55)"
    });
    Object.assign(panel.style, {
      position:"relative", background:"#0b2237", border:"1px solid #ffffff22",
      borderRadius:"12px", width:"min(1100px, 100%)", height:"min(78vh, 100%)",
      overflow:"hidden", display:"flex", flexDirection:"column"
    });
    if (frame) Object.assign(frame.style, { width:"100%", height:"100%", flex:"1 1 auto", border:0, background:"#fff" });

    return { kind:"overlay", ovl, panel, frame, title, close };
  }

  function ensureMsg(ovl) {
    let msg = $("#pfMsg", ovl);
    if (!msg) {
      const host = ovl.querySelector(".pf-panel, .panel") || ovl;
      msg = el("div", { id:"pfMsg", class:"muted", style:"display:none;padding:8px 12px;color:#e6f1ff" }, T.blocked);
      host.appendChild(msg);
    }
    return msg;
  }

  function ensureSpinner(ovl) {
    let sp = $("#pfSpin", ovl);
    if (!sp) {
      sp = el("div", { id:"pfSpin", style:"position:absolute;inset:auto 12px 12px auto;background:#0b1f33;color:#e6f1ff;border:1px solid #ffffff33;border-radius:10px;padding:6px 10px;display:none" }, T.loading);
      (ovl.querySelector(".pf-panel, .panel") || ovl).appendChild(sp);
    }
    return sp;
  }

  function openOverlay(url, title) {
    if (!url) return;
    url = toAbsoluteUrl(url);

    const { kind, ovl, frame, title: titleEl, close } = getOverlayElements();
    if (!ovl || !frame || !close) return;

    const msg  = ensureMsg(ovl);
    const spin = ensureSpinner(ovl);

    if (titleEl) titleEl.textContent = title || "";
    msg.style.display = "none";
    spin.style.display = "inline-block";

    // Affiche selon le type d’overlay
    if (kind === "pf") {
      ovl.classList.add("show");           // correspond à #pfOverlay.show { display:flex; }
    } else {
      ovl.style.setProperty("display", "flex", "important");
    }
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

    const closeAll = () => {
      clearTimeout(timer);
      if (kind === "pf") ovl.classList.remove("show");
      else ovl.style.setProperty("display", "none", "important");
      document.body.style.overflow = "";
      frame.removeAttribute("src");
      close.removeEventListener("click", closeAll);
      ovl.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onEsc);
    };
    const onBackdrop = (e) => { if (e.target === ovl) closeAll(); };
    const onEsc = (e) => { if (e.key === "Escape") closeAll(); };

    close.addEventListener("click", closeAll);
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
