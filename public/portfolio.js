function card(it) {
  const LANG = (document.documentElement.getAttribute("lang") || "fr").slice(0,2).toLowerCase();

  // pioche le bloc i18n correspondant à la langue, avec fallback fr -> première entrée
  const L = (it.i18n && (it.i18n[LANG] || it.i18n.fr || Object.values(it.i18n)[0])) || {};

  const title = L.title || it.title || it.name || "Untitled";
  const desc  = L.description || it.description || it.desc || "";
  const url   = L.url || it.url || it.link || "";
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
