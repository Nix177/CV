/* CV page — porte d’accès + vues: PDF / Constellation / Storyboard / Ruche
   Dépendances optionnelles chargées à la volée :
   - ./cv-data.js (si CV_DATA n’est pas déjà présent)
   - ./beehive.js pour la vue "Ruche"
*/
(function () {
  // --- éléments de la page
  const SKEY = "CV_CODE";
  const sel = document.getElementById("viewMode");   // <select>
  const area = document.getElementById("cvArea");     // conteneur
  const printBtn = document.getElementById("printBtn");
  const hasUI =
    typeof window.UI === "object" &&
    window.UI &&
    typeof window.UI.setBusy === "function";

  // --- utilitaires
  const esc = (s) =>
    (s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const getCode = () => sessionStorage.getItem(SKEY) || "";
  const saveCode = (c) => sessionStorage.setItem(SKEY, c);

  async function verifyCode(code) {
    const r = await fetch("/api/verify?code=" + encodeURIComponent(code));
    const j = await r.json().catch(() => ({}));
    return !!j.ok;
  }

  function setModeEnabled(enabled) {
    if (!sel) return;
    [...sel.options].forEach((opt) => {
      opt.disabled = !enabled; // TOUT est verrouillé tant que le code n'est pas validé
    });
  }

  // ------------------- RENDUS -------------------

  function renderLocked(msg) {
    setModeEnabled(false);
    area.innerHTML = `
      <div class="card pad">
        <h3>Accès protégé</h3>
        <p>Entre le code d’accès pour voir le PDF et débloquer les vues interactives du CV.</p>
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
    // fallback minimal
    return [
      { when: "2024–…", what: "Enseignant primaire (remplacements)", where: "FR", tags: ["primaire", "didactique"] },
      { when: "2022–2023", what: "Stage de master (CRE/ATE)", where: "HEP Fribourg", tags: ["didactique", "IA", "ressources"] },
      { when: "2020–2021", what: "Enseignant titulaire 5H", where: "Corminboeuf", tags: ["différenciation"] }
    ];
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

  function nodesHTML(items) {
    return `
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
        ${items
          .map(
            (i) => `
        <article class="card3d" tabindex="0">
          <div class="inner">
            <div class="face front"><span>🧩</span></div>
            <div class="face back">
              <strong>${esc(i.what)}</strong><br>
              <small class="muted">${esc(i.when)} — ${esc(i.where || "")}</small><br>
              <small>${(i.tags || []).map((t) => `#${esc(t)}`).join(" ")}</small>
            </div>
          </div>
        </article>`
          )
          .join("")}
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

  function timelineHTML(items) {
    return `
      <ul class="timeline">
        ${items
          .map(
            (i) => `
          <li>
            <div class="tl-dot"></div>
            <div class="tl-body">
              <div class="tl-when">${esc(i.when)}</div>
              <div class="tl-what"><strong>${esc(i.what)}</strong></div>
              <div class="tl-where muted">${esc(i.where || "")}</div>
            </div>
          </li>`
          )
          .join("")}
      </ul>
    `;
  }

  async function renderStory() {
    area.innerHTML = `<div class="card pad"><h3>Storyboard</h3><div id="story"></div></div>`;
    const box = document.getElementById("story");
    const data = await loadCvData();
    box.innerHTML = timelineHTML(data);
  }

  // ---- Vue "Ruche" (Beehive) ----
  async function ensureBeehiveScript() {
    if (window.__BEEHIVE_LOADED) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "./beehive.js";
      s.onload = () => {
        window.__BEEHIVE_LOADED = true;
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function renderBeehive() {
    area.innerHTML = `
      <div class="stack">
        <div class="card pad">
          <h3>Ruche & compétences</h3>
          <p class="muted">Stabilise la ruche (<em>santé ≥ 80</em> pendant 15 cycles) pour révéler des infos
          compactes de mon CV. Même logique que sur l’accueil, dans un espace concentré.</p>
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <canvas id="bh_canvas" width="900" height="380"
            style="width:100%;height:auto;display:block;background:rgba(255,255,255,.03)"></canvas>
        </div>

        <div id="bh_unlock" class="card pad hidden">
          <h3>🔓 Bravo !</h3>
          <div id="bh_cvExtract" class="stack"></div>
        </div>

        <div class="card pad grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
          <label>Fleurs (nectar)
            <input type="range" id="bh_flowers" min="0" max="100" value="60" />
          </label>
          <label>Ouvrières %
            <input type="range" id="bh_workers" min="10" max="90" value="65" />
          </label>
          <label>Gardiennes %
            <input type="range" id="bh_guards" min="10" max="60" value="20" />
          </label>
          <label>Météo
            <input type="range" id="bh_weather" min="0" max="100" value="70" />
          </label>
          <div class="row gap" style="grid-column:1/-1">
            <button class="btn primary" id="bh_start" data-busy>▶ Lancer</button>
            <button class="btn" id="bh_step">⟳ +1</button>
            <span class="muted" id="bh_status">Prêt.</span>
          </div>
          <div class="row gap" style="grid-column:1/-1">
            <span>Santé: <strong id="bh_health">0</strong></span>
            <span>Prod: <strong id="bh_prod">0</strong></span>
            <span>Déf: <strong id="bh_def">0</strong></span>
            <span>Streak: <strong id="bh_streak">0</strong>/15</span>
          </div>
        </div>
      </div>
    `;
    // charge le simulateur si besoin (il s'initialise dès qu'il trouve #bh_canvas)
    try {
      await ensureBeehiveScript();
    } catch {
      // au pire : ne bloque pas la page
    }
  }

  // ------------------- ROUTAGE DE VUE -------------------

  function currentMode() {
    return sel?.value || "pdf";
  }

  function renderUnlocked() {
    setModeEnabled(true);
    const m = currentMode();
    if (m === "pdf") return renderPDF();
    if (m === "constellation") return renderConstellation();
    if (m === "beehive") return renderBeehive();
    return renderStory();
  }

  // interactions
  sel?.addEventListener("change", () => {
    const code = getCode();
    if (!code) {
      renderLocked("Cette vue nécessite le code d’accès.");
      return;
    }
    renderUnlocked();
  });

  printBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const code = getCode();
    if (!code) return renderLocked("Code requis pour ouvrir le PDF.");
    // En mode PDF : ouvre le PDF protégé
    if (currentMode() === "pdf") {
      window.open("/api/cv?code=" + encodeURIComponent(code), "_blank", "noopener");
    } else {
      // impression de la vue interactive
      window.print();
    }
  });

  // ------------------- INIT -------------------

  (async function init() {
    // Si un code est déjà stocké, on le revalide
    const saved = getCode();
    if (saved) {
      const ok = await verifyCode(saved).catch(() => false);
      if (ok) {
        // si un hash indique une vue, on la respecte (#story, #constellation, #beehive)
        const h = (location.hash || "").replace("#", "");
        if (h && sel) {
          const opt = [...sel.options].find((o) => o.value === h);
          if (opt) sel.value = h;
        }
        return renderUnlocked();
      }
      sessionStorage.removeItem(SKEY);
    }
    renderLocked();
  })();
})();
