// Theme + outils globaux + téléchargement CV protégé + flip cards
(function () {
  const KEY = "theme";
  const R = document.documentElement;
  const saved = localStorage.getItem(KEY);
  if (saved) R.setAttribute("data-theme", saved);
  else R.setAttribute("data-theme", "dark");

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toggle-theme]");
    if (!t) return;
    const next = R.getAttribute("data-theme") === "light" ? "dark" : "light";
    R.setAttribute("data-theme", next);
    localStorage.setItem(KEY, next);
  });
})();

window.UI = {
  setBusy(btn, on) {
    if (!btn) return;
    if (on) {
      btn.dataset._label = btn.textContent;
      btn.classList.add("is-busy");
      btn.textContent = "";
    } else {
      btn.classList.remove("is-busy");
      if (btn.dataset._label) btn.textContent = btn.dataset._label;
    }
  },

  async guardedDownload() {
    let code =
      sessionStorage.getItem("CV_CODE") ||
      prompt("Code pour télécharger le CV :");
    if (!code) return;
    const r = await fetch("/api/verify?code=" + encodeURIComponent(code));
    const { ok } = await r.json().catch(() => ({ ok: false }));
    if (!ok) {
      alert("Code invalide.");
      return;
    }
    sessionStorage.setItem("CV_CODE", code);
    const a = document.createElement("a");
    a.href = "/api/cv?code=" + encodeURIComponent(code);
    a.rel = "noopener";
    a.click();
  },

  initFlipGrid(selector) {
    const grid = document.querySelector(selector);
    if (!grid) return;
    grid.addEventListener("click", (e) => {
      const c = e.target.closest(".card3d");
      if (c) c.classList.toggle("is-flipped");
    });
    grid.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const c = document.activeElement?.closest?.(".card3d");
        if (c) c.classList.toggle("is-flipped");
      }
    });
  },
};

// bouton “Télécharger le CV”
document.addEventListener("click", (e) => {
  const dl = e.target.closest("#dlCvBtn");
  if (!dl) return;
  e.preventDefault();
  window.UI.guardedDownload();
});
