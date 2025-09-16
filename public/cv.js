/* Porte d'accès + vues CV */
(function () {
  const SKEY = "CV_CODE";
  const sel = document.getElementById("viewMode");
  const area = document.getElementById("cvArea");
  const printBtn = document.getElementById("printBtn");
  const hasUI = typeof window.UI === "object" && window.UI && typeof window.UI.setBusy === "function";

  async function verifyCode(code) {
    const r = await fetch("/api/verify?code=" + encodeURIComponent(code));
    const j = await r.json().catch(() => ({}));
    return !!j.ok;
  }

  const getCode = () => sessionStorage.getItem(SKEY) || "";
  const saveCode = (c) => sessionStorage.setItem(SKEY, c);
  const mode = () => sel.value;

  function setModeEnabled(enabled) {
    [...sel.options].forEach((opt) => {
      if (opt.value === "pdf") opt.disabled = false;
      else opt.disabled = !enabled;
    });
  }

  function renderLocked(msg) {
    setModeEnabled(false);
    area.innerHTML = `
      <div class="card pad">
        <h3>Accès protégé</h3>
        <p>Entre le code pour voir le PDF et débloquer les vues interactives du CV.</p>
        <form id="gateForm" class="row gap" style="align-items:end;margin-top:8px">
          <label style="flex:1">Code d’accès
            <input id="cvCode" autocomplete="off" inputmode="text" placeholder="••••••" />
          </label>
          <button class="btn primary" data-busy>Débloquer</button>
        </form>
        ${msg ? `<p class="muted">${msg}</p>` : ""}
      </div>
    `;
    const F = document.getElementById("gateForm");
    const I = document.getElementById("cvCode");
    F.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = F.querySelector("[data-busy]");
      hasUI && window.UI.setBusy(btn, true);
      try {
        const code = (I.value || "").trim();
        if (!code) return;
        const ok = await verifyCode(code);
        if (!ok) return renderLocked("❌ Code invalide. Réessaie.");
        saveCode(code);
        renderUnlocked();
      } finally {
        hasUI && window.UI.setBusy(btn, false);
      }
    });
  }

  function renderPDF() {
    const code = getCode();
    area.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden">
        <iframe title="CV PDF"
          class="pdf-frame"
          style="width:100%;height:min(80vh,1000px);border:0"
          src="/api/cv?code=${encodeURIComponent(code)}#toolbar=1&navpanes=0&statusbar=0">
        </iframe>
      </div>
    `;
  }

  async function renderConstellation() {
    area.innerHTML = `<div class="card pad"><h3>Constellation</h3><div id="constel"></div></div>`;
    const box = document.getElementById("constel");
    const data = await loadCvData();
    box.innerHTML = nodesHTML(data);
    attachCardFlip(box);
  }

  async function renderStory() {
    area.innerHTML = `<div class="card pad"><h3>Storyboard</h3><div id="story"></div></div>`;
    const box = document.getElementById("story");
    const data = await loadCvData();
    box.innerHTML = timelineHTML(data);
  }

  async function loadCvData() {
    if (window.CV_DATA) return window.CV_DATA;
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "./cv-data.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      if (window.CV_DATA) return window.CV_DATA;
    } catch {}
    return [
      { when: "2024–…", what: "Enseignant primaire (remplacements)", where: "FR", tags: ["primaire","didactique"] },
      { when: "2022–2023", what: "Stage de master (CRE/ATE)", where: "HEP Fribourg", tags: ["didactique","ressources","IA"] },
      { when: "2020–2021", what: "Enseignant titulaire 5H", where: "Corminboeuf", tags: ["différenciation"] }
    ];
  }

  function nodesHTML(items) {
    return `
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
        ${items.map(i => `
        <article class="card3d" tabindex="0">
          <div class="inner">
            <div class="face front"><span>🧩</span></div>
            <div class="face back">
              <strong>${esc(i.what)}</strong><br>
              <small class="muted">${esc(i.when)} — ${esc(i.where||"")}</small><br>
              <small>${(i.tags||[]).map(t=>`#${esc(t)}`).join(" ")}</small>
            </div>
          </div>
        </article>`).join("")}
      </div>
    `;
  }

  function timelineHTML(items) {
    return `
      <ul class="timeline">
        ${items.map(i => `
          <li>
            <div class="tl-dot"></div>
            <div class="tl-body">
              <div class="tl-when">${esc(i.when)}</div>
              <div class="tl-what"><strong>${esc(i.what)}</strong></div>
              <div class="tl-where muted">${esc(i.where||"")}</div>
            </div>
          </li>`).join("")}
      </ul>
    `;
  }

  function attachCardFlip(root) {
    root.addEventListener("click", (e) => {
      const c = e.target.closest(".card3d");
      if (c) c.classList.toggle("is-flipped");
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const c = document.activeElement?.closest?.(".card3d");
        if (c) c.classList.toggle("is-flipped");
      }
    });
  }

  const esc = (s) => (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  sel.addEventListener("change", () => {
    const code = getCode();
    if (!code && mode() !== "pdf") {
      renderLocked("Cette vue nécessite le code d’accès.");
      return;
    }
    renderUnlocked();
  });

  document.getElementById("printBtn").addEventListener("click", (e) => {
    e.preventDefault();
    if (mode() === "pdf") {
      const code = getCode();
      if (!code) return renderLocked("Code requis pour ouvrir le PDF.");
      window.open("/api/cv?code=" + encodeURIComponent(code), "_blank", "noopener");
    } else {
      window.print();
    }
  });

  (async function init() {
    const saved = getCode();
    if (saved) {
      const ok = await verifyCode(saved).catch(() => false);
      if (ok) return renderUnlocked();
      sessionStorage.removeItem(SKEY);
    }
    renderLocked();
  })();
})();
