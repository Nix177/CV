(function () {
  const grid = document.getElementById("portfolioGrid");
  if (!grid) return;

  const lang = document.documentElement.lang || "fr";
  const items = (PORTFOLIO_I18N[lang] || PORTFOLIO_I18N.fr);

  const faviconFrom = (url) => {
    try {
      const u = new URL(url);
      // 1) icône du domaine si dispo
      return `${u.origin}/favicon.ico`;
    } catch {
      // 2) service de fallback (optionnel) :
      return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
    }
  };

  function card(item) {
    const icon = item.icon && item.icon.trim() ? item.icon : faviconFrom(item.url);
    const imgBG = item.image ? `background-image:url('${item.image}');background-size:cover;background-position:center` : "";
    return `
      <article class="card-site" data-id="${item.id}">
        <div class="site-thumb" style="${imgBG}">
          <img class="site-icon" alt="" src="${icon}" onerror="this.style.display='none'">
        </div>
        <div class="site-body">
          <h3 class="site-title">${item.title}</h3>
          <p class="site-desc">${item.desc}</p>
        </div>
        <div class="site-actions">
          <a class="btn" href="${item.url}" target="_blank" rel="noopener">Visiter</a>
          <button class="btn ghost" data-preview="${item.url}">Aperçu</button>
        </div>
      </article>
    `;
  }

  grid.innerHTML = items.map(card).join("");

  // overlay
  const overlay = document.getElementById("overlay");
  const frame = document.getElementById("overlayFrame");
  const title = document.getElementById("overlayTitle");
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preview]");
    if (!btn) return;
    const url = btn.getAttribute("data-preview");
    const card = btn.closest(".card-site");
    title.textContent = card.querySelector(".site-title").textContent;
    frame.src = url; // si X-Frame-Options bloque, l’iframe restera vide
    overlay.classList.add("open");
  });
  document.getElementById("overlayClose").addEventListener("click", () => {
    frame.src = "about:blank";
    overlay.classList.remove("open");
  });
})();
