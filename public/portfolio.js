(function () {
  const grid = document.getElementById("portfolioGrid");
  if (!grid) return;

  const lang = document.documentElement.lang || "fr";
  const items = (PORTFOLIO_I18N[lang] || PORTFOLIO_I18N.fr);

  function card(item) {
    const img = item.image ? `<div class="site-thumb" style="background-image:url('${item.image}');background-size:cover;background-position:center"></div>` : `<div class="site-thumb"></div>`;
    return `
      <article class="card-site" data-id="${item.id}">
        ${img}
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
