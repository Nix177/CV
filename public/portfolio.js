// Rendu des cartes Portfolio + Aperçu sécurisé dans un overlay (iframe).
(function(){
  const lang = document.documentElement.lang || "fr";
  const T = {
    fr: { visit: "Visiter", preview: "Aperçu", title: "Portfolio" },
    en: { visit: "Visit",  preview: "Preview", title: "Portfolio" },
    de: { visit: "Besuchen", preview: "Vorschau", title: "Portfolio" }
  }[lang] || T_fr;

  const list = (window.PORTFOLIO && window.PORTFOLIO[lang]) || [];
  const mount = document.getElementById("portfolioList");
  if (!mount) return;

  // Build overlay once
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="overlay-inner">
      <div class="overlay-bar">
        <strong>${T.title}</strong>
        <div class="row gap">
          <button class="btn" data-overlay-close>✕</button>
        </div>
      </div>
      <iframe id="previewFrame" referrerpolicy="no-referrer"></iframe>
    </div>`;
  document.body.appendChild(overlay);
  const frame = overlay.querySelector("#previewFrame");

  function openPreview(url){
    frame.src = url;
    overlay.classList.add("show");
  }
  function closePreview(){
    frame.src = "about:blank";
    overlay.classList.remove("show");
  }
  overlay.addEventListener("click", e=>{
    if (e.target.hasAttribute("data-overlay-close") || e.target === overlay) closePreview();
  });

  // Render cards
  mount.innerHTML = list.map(p => `
    <article class="port-card">
      <div class="port-meta">
        ${p.icon ? `<img class="port-icon" src="${p.icon}" alt="">` : ""}
        <h3>${p.title}</h3>
      </div>
      <p class="muted">${p.desc||""}</p>
      <div class="row gap">
        <button class="btn" data-visit="${encodeURIComponent(p.url)}">${T.visit}</button>
        <button class="btn ghost" data-preview="${encodeURIComponent(p.url)}">${T.preview}</button>
      </div>
    </article>
  `).join("");

  // Delegated actions
  mount.addEventListener("click", e=>{
    const v = e.target.closest("[data-visit]"); if (v) {
      const url = decodeURIComponent(v.getAttribute("data-visit"));
      window.open(url, "_blank", "noopener");
      return;
    }
    const p = e.target.closest("[data-preview]"); if (p) {
      const url = decodeURIComponent(p.getAttribute("data-preview"));
      openPreview(url);
    }
  });
})();
