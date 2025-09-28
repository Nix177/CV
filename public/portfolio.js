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
  function ensureOverlay() {
    // 1) Overlay déjà fourni par portfolio.html
    let ovl = $("#overlay");
    if (!ovl) {
      // 2) Fallback si absent (autres pages)
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

    // Styles inline robustes pour passer devant tout (ne dépend pas de style.css)
    Object.assign(ovl.style, {
      position: "fixed", inset: "0", display: "none", zIndex: "99999",
      alignItems: "center", justifyContent: "center", padding: "18px",
      background: "rgba(0,0,0,.55)"
    });
    const panel = ovl.querySelector(".panel") || ovl.firstElementChild || ovl;
    Object.assign(panel.style, {
      position: "relative", background: "#0b2237", border: "1px solid #ffffff22",
      borderRadius: "12px", width: "min(1100px, 100%)", height: "min(78vh, 100%)", overflow: "hidden", display:"flex", flexDirection:"column"
    });

    const header = panel.querySelector("header") || panel.insertBefore(el("header", {}), panel.firstChild);
    Object.assign(header.style, {
      display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px",
      padding:"10px 12px", borderBottom:"1px solid #ffffff22", color:"#fff"
    });
    let titleEl = $("#ovlTitle", header); if (!titleEl) titleEl = header.appendChild(el("strong",{id:"ovlTitle"}));
    let closeBtn = $("#overlayClose", header); if (!closeBtn) closeBtn = header.appendChild(el("button",{id:"overlayClose", class:"btn"}, T.close));

    let frame = $("#overlayFrame", panel);
    if (!frame) frame = panel.appendChild(el("iframe",{id:"overlayFrame", title:T.preview}));
    Object.assign(frame.style, { width:"100%", height:"100%", flex:"1 1 auto", border:"0", background:"#fff" });
    frame.setAttribute("sandbox","allow-scripts allow-popups");

    return ovl;
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

  function openOverlay(url, title) {
    if (!/^https?:\/\//i.test(url)) { window.open(url, "_blank", "noopener"); return; }

    const ovl = ensureOverlay();
    const panel = ovl.querySelector(".panel") || ovl;
    const frame = $("#overlayFrame", panel);
    const titleEl = $("#ovlTitle", ovl) || $("#pfTitle", ovl) || panel.querySelector("strong");
    const btnClose = $("#overlayClose", ovl) || $("#pfClose", ovl);
    const msg = ensureMsg(ovl);
    const spin = ensureSpinner(ovl);

    if (!frame || !btnClose) return;

    if (titleEl) titleEl.textContent = title || "";
    msg.style.display = "none";
    spin.style.display = "inline-block";

    ovl.style.display = "flex";
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

    const close = () => {
      clearTimeout(timer);
      ovl.style.display = "none";
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
