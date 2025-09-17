// public/cv.js
(() => {
  const form = document.getElementById("cv-unlock-form");      // <form id="cv-unlock-form">
  const input = document.getElementById("cv-code");            // <input id="cv-code">
  const state = document.getElementById("cv-state");           // <div id="cv-state">
  const modes = document.getElementById("cv-mode");            // <select id="cv-mode">
  const viewer = document.getElementById("cv-viewer");         // <div id="cv-viewer">

  const KEY = "cvCode";

  function setBusy(b) {
    form?.querySelector("button[type=submit]")?.toggleAttribute("disabled", b);
  }

  async function verify(code) {
    const r = await fetch(`/api/verify?code=${encodeURIComponent(code)}`);
    return r.ok;
  }

  function renderLocked(msg = "Entrez le code d’accès pour afficher le CV.") {
    if (state) state.textContent = msg;
    if (viewer) viewer.innerHTML = "";
    form.style.display = "";
  }

  function renderUnlocked() {
    form.style.display = "none";
    if (state) state.textContent = "Accès accordé — choisissez une visualisation.";
    renderMode();
  }

  function renderMode() {
    const code = localStorage.getItem(KEY) || "";
    const mode = modes?.value || "pdf";
    if (!viewer) return;

    if (mode === "pdf") {
      viewer.innerHTML = `
        <iframe style="width:100%;height:80vh;border:0"
          src="/api/cv?code=${encodeURIComponent(code)}"></iframe>`;
      return;
    }

    if (mode === "timeline") {
      viewer.innerHTML = `
        <div class="cv-timeline">
          <h3>Timeline</h3>
          <ul>
            <li>2024—… Formateur (HEP Fribourg) — usages responsables de l’IA</li>
            <li>2022—23 Stage de master (CRE/ATE) — HEP Fribourg</li>
            <li>2020—21 Enseignant titulaire 5H — Corimbœuf</li>
            <li>2019—… Remplacements divers (FR)</li>
          </ul>
        </div>`;
      return;
    }

    if (mode === "skills") {
      viewer.innerHTML = `
        <div class="cv-skills">
          <h3>Compétences clés</h3>
          <ul>
            <li>Pensée critique, évaluation, guidage progressif</li>
            <li>Didactique de l’informatique (Python, HTML/CSS/JS, Moodle)</li>
            <li>IA responsable, communication claire</li>
          </ul>
        </div>`;
      return;
    }
  }

  // init
  modes?.addEventListener("change", renderMode);
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = (input?.value || "").trim();
    if (!code) return;
    setBusy(true);
    try {
      const ok = await verify(code);
      if (!ok) return renderLocked("Code invalide. Réessayez.");
      localStorage.setItem(KEY, code);
      renderUnlocked();
    } finally {
      setBusy(false);
    }
  });

  // auto-déblocage si code déjà stocké
  const saved = localStorage.getItem(KEY);
  if (saved) {
    verify(saved).then(ok => ok ? renderUnlocked() : renderLocked());
  } else {
    renderLocked();
  }
})();
