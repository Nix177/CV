/* public/portfolio.js
   Portfolio grid + Preview overlay (sécurisé)
   - Rendu depuis public/portfolio-data.js (ou variables globales équivalentes)
   - Bouton "Aperçu" -> overlay #pfOverlay <iframe sandbox>, message si X-Frame-Options/CSP bloque
   - AUCUNE dépendance supplémentaire. Ne touche qu’aux aperçus.
*/
(function () {
  "use strict";

  // -------- Langue --------
  const htmlLang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  const T = ({
    fr: {
      preview: "Aperçu", visit: "Visiter", close: "Fermer",
      blocked: "Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter ».",
      loading: "Chargement de l’aperçu…"
    },
    en: {
      preview: "Preview", visit: "Visit", close: "Close",
      blocked: "This site denies being embedded. ➜ Use “Visit”.",
      loading: "Loading preview…"
    },
    de: {
      preview: "Vorschau", visit: "Besuchen", close: "Schließen",
      blocked: "Diese Seite untersagt Einbettung. ➜ «Besuchen» nutzen.",
      loading: "Vorschau wird geladen…"
    }
  })[htmlLang] || {
    preview: "Aperçu", visit: "Visiter", close: "Fermer",
    blocked: "Ce site refuse l’aperçu embarqué. ➜ Utilisez « Visiter ».",
    loading: "Chargement de l’aperçu…"
  };

  // -------- Helpers --------
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      // ⬇️ FIX: normaliser le nom d'événement en minuscules
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
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

  // -------- Overlay / Aperçu (UNIQUEMENT #pfOverlay) --------
  function toAbsoluteUrl(url) {
    try { return new URL(url, location.href).toString(); }
    catch { return url; }
  }

  function getPfOverlay() {
    let ovl = $("#pfOverlay");
    if (!ovl) {
      // Fallback si markup absent : on construit celui attendu par le CSS
      ovl = el("div", { id: "pfOverlay", class: "overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "pfTitle" }, [
        el("div", { class: "pf-panel" }, [
          el("header", { class: "pf-head" }, [
            el("strong", { id: "pfTitle", text: "" }),
            el("button", { id: "pfClose", class: "btn" }, T.close)
          ]),
          el("div", { class: "pf-frame" }, [
            el("iframe", { id: "pfFrame", title: T.preview, sandbox: "allow-scripts allow-popups allow-same-origin" })
          ]),
          el("div", { id: "pfMsg", class: "muted", style: "display:none;padding:8px 12px" }, T.blocked)
        ])
      ]);
      document.body.appendChild(ovl);
    }

    const frame = $("#pfFrame", ovl) || ovl.querySelector("iframe");
    const title = $("#pfTitle", ovl) || ovl.querySelector("strong");
    const close = $("#pfClose", ovl) || ovl.querySelector("button");

    if (frame) {
      frame.setAttribute("title", T.preview);
      frame.setAttribute("sandbox", "allow-scripts allow-popups allow-same-origin");
      Object.assign(frame.style, { width: "100%", height: "100%", border: "0", background: "#fff" });
    }
    return { ovl, frame, title, close };
  }

  function ensureMsg(ovl) {
    let msg = $("#pfMsg", ovl);
    if (!msg) {
      const host = ovl.querySelector(".pf-panel, .panel") || ovl;
      msg = el("div", { id: "pfMsg", class: "muted", style: "display:none;padding:8px 12px" }, T.blocked);
      host.appendChild(msg);
    }
    return msg;
  }

  function ensureSpinner(ovl) {
    let sp = $("#pfSpin", ovl);
    if (!sp) {
      sp = el("div", { id: "pfSpin", style: "position:absolute;inset:auto 12px 12px auto;background:#0b1f33;color:#e6f1ff;border:1px solid #ffffff33;border-radius:10px;padding:6px 10px;display:none" }, T.loading);
      (ovl.querySelector(".pf-panel, .panel") || ovl).appendChild(sp);
    }
    return sp;
  }

  function openOverlay(url, title) {
    if (!url) return;
    url = toAbsoluteUrl(url);

    const { ovl, frame, title: titleEl, close } = getPfOverlay();
    if (!ovl || !frame || !close) return;

    const msg = ensureMsg(ovl);
    const spin = ensureSpinner(ovl);

    if (titleEl) titleEl.textContent = title || "";
    msg.style.display = "none";
    spin.style.display = "inline-block";

    ovl.classList.add("show");       // ton CSS affiche #pfOverlay quand .show est présent
    document.body.style.overflow = "hidden";

    // (re)charge l’iframe
    frame.removeAttribute("src");
    frame.setAttribute("sandbox", "allow-scripts allow-popups allow-same-origin");

    let loaded = false;
    const onLoad = () => { loaded = true; spin.style.display = "none"; };
    frame.addEventListener("load", onLoad, { once: true });
    frame.src = url;

    // Si toujours pas chargé après 2s, on affiche le message "refusé"
    const timer = setTimeout(() => {
      if (!loaded) { msg.style.display = "block"; spin.style.display = "none"; }
    }, 2000);

    const closeAll = () => {
      clearTimeout(timer);
      ovl.classList.remove("show");
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
    const img = it.image || it.thumbnail || null;
    const tags = Array.isArray(it.tags) ? it.tags : [];
    const extraImages = Array.isArray(it.extraImages) ? it.extraImages : [];
    const hasGallery = extraImages.length > 0;
    const hasUrl = url && url.length > 0;

    const left = el("div", { class: "p-thumb", ...(img ? { style: `background-image:url(${img})` } : {}) });

    // Actions : Aperçu/Visiter seulement si URL existe
    const actionsChildren = [];
    if (hasUrl) {
      actionsChildren.push(
        el("button", { class: "btn linkish", onClick: () => openOverlay(url, title) }, T.preview),
        el("a", { class: "btn primary", href: url, target: "_blank", rel: "noopener" }, T.visit)
      );
    }
    // Liens additionnels (ex. Rover + Bras)
    if (Array.isArray(it.extraLinks)) {
      it.extraLinks.forEach(l => {
        actionsChildren.push(
          el("a", { class: "btn", href: l.url, target: "_blank", rel: "noopener", style: "font-size:0.85em;padding:6px 10px;background:rgba(255,255,255,0.05)" }, l.label)
        );
      });
    }

    // Galerie d'images pour les entrées avec extraImages
    const galleryEl = hasGallery ? el("div", { class: "p-gallery" }, [
      // Image principale
      el("img", { src: img, alt: title + " - résultat", class: "p-gallery-img", onClick: () => openImageModal(img, title + " - résultat") }),
      // Images supplémentaires
      ...extraImages.map((imgSrc, i) => {
        const labels = ["Blender", "ComfyUI", "PrusaSlicer"];
        const label = labels[i] || `Image ${i + 1}`;
        return el("img", { src: imgSrc, alt: title + " - " + label, class: "p-gallery-img", onClick: () => openImageModal(imgSrc, title + " - " + label) });
      })
    ]) : null;

    const right = el("div", {}, [
      el("h3", { class: "p-title", text: title }),
      description ? el("p", { class: "p-desc", text: description }) : null,
      tags.length ? el("div", { class: "pf-tags" }, tags.map(t => el("span", { class: "badge", text: t }))) : null,
      // Galerie d'images si présente
      galleryEl,
      // Actions (Aperçu/Visiter) seulement si pertinentes
      actionsChildren.length > 0 ? el("div", { class: "p-actions" }, actionsChildren) : null
    ].filter(Boolean));

    return el("div", { class: "p-card" + (hasGallery ? " has-gallery" : "") }, [left, right]);
  }

  // -------- Modal image plein écran --------
  function openImageModal(src, alt) {
    const existing = document.getElementById("imgModal");
    if (existing) existing.remove();

    const modal = el("div", { id: "imgModal", class: "overlay show", style: "cursor:zoom-out" }, [
      el("img", { src, alt, style: "max-width:95vw;max-height:95vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5)" })
    ]);

    const closeModal = () => {
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 100);
    };

    modal.addEventListener("click", closeModal);
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", onEsc);
      }
    });

    document.body.appendChild(modal);
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

    // Filet de sécurité : autres markups avec data-preview-url
    document.addEventListener("click", (e) => {
      const n = e.target.closest?.("[data-preview-url]");
      if (!n) return;
      e.preventDefault();
      openOverlay(n.getAttribute("data-preview-url"), n.getAttribute("data-title") || "");
    }, { passive: false });
  });
})();
