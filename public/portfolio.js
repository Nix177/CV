// public/portfolio.js
import { PORTFOLIO_ITEMS } from "./portfolio-data.js";

(function () {
  const grid = document.getElementById("portfolioGrid") || document.getElementById("portfolioList");
  const overlay = document.getElementById("previewOverlay");
  const frame = document.getElementById("previewFrame");
  const closeBtn = document.getElementById("previewClose");

  if (!grid) return;

  function card(item) {
    return `
    <article class="card">
      <div class="card-body">
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
        <div class="card-actions">
          <a class="btn" href="${item.url}" target="_blank" rel="noopener">Visiter</a>
          ${item.embed ? `<button class="btn linkish" data-preview="${item.embed}">Aperçu</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  grid.innerHTML = PORTFOLIO_ITEMS.map(card).join("");

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preview]");
    if (!btn) return;
    e.preventDefault();
    const src = btn.getAttribute("data-preview");
    if (!overlay || !frame) return;
    overlay.style.display = "block";
    frame.src = src;
  });

  closeBtn?.addEventListener("click", () => {
    overlay.style.display = "none";
    frame.src = "about:blank";
  });
})();
