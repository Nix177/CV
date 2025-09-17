/* CV — accès protégé (FR/EN/DE)
   - Formulaire code d’accès
   - Vérifie /api/verify (GET ?code=... puis POST {code} si besoin)
   - Si OK, embarque /api/cv?code=...
   - Mémorise l’accès + le code pour rechargements (localStorage)
   - Évite l’avertissement sandbox (pas de allow-scripts + allow-same-origin)
*/
(function () {
  "use strict";

  const LS_OK   = "cv_access_ok_v1";
  const LS_CODE = "cv_access_code_v1";

  const LANG = (document.documentElement.getAttribute("lang") || "fr")
    .toLowerCase()
    .slice(0, 2);

  const TMAP = {
    fr: {
      title: "CV — Nicolas Tuor",
      label: "Code d’accès",
      placeholder: "Saisissez le code…",
      unlock: "Déverrouiller",
      wrong: "Code invalide.",
      ok: "Accès accordé.",
      printing: "Imprimer/PDF",
      pdfMode: "PDF protégé",
      loading: "Chargement du PDF…",
    },
    en: {
      title: "CV — Nicolas Tuor",
      label: "Access code",
      placeholder: "Enter the code…",
      unlock: "Unlock",
      wrong: "Invalid code.",
      ok: "Access granted.",
      printing: "Print/PDF",
      pdfMode: "Protected PDF",
      loading: "Loading PDF…",
    },
    de: {
      title: "Lebenslauf — Nicolas Tuor",
      label: "Zugangscode",
      placeholder: "Code eingeben…",
      unlock: "Entsperren",
      wrong: "Ungültiger Code.",
      ok: "Zugang gewährt.",
      printing: "Drucken/PDF",
      pdfMode: "Geschütztes PDF",
      loading: "PDF wird geladen…",
    },
  };
  const T = TMAP[LANG] || TMAP.fr;

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const k of [].concat(kids)) e.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
    return e;
  };

  function ensureUI() {
    const main = $("main") || document.body;

    // panneau verrouillé
    if (!$("#cv-locked")) {
      const panel = el("section", { id: "cv-locked", style: "margin:16px 0" }, [
        el("div", { class: "card", style: "max-width:560px" }, [
          el("h2", { text: T.title, style: "margin-top:0" }),
          el("label", { for: "cv-code", text: T.label }),
          el("div", { style: "display:flex;gap:8px;margin-top:.4rem" }, [
            el("input", {
              id: "cv-code",
              type: "password",
              placeholder: T.placeholder,
              autocomplete: "off",
              style:
                "flex:1;padding:.6rem .8rem;border-radius:10px;border:1px solid #ffffff25;background:#ffffff10;color:inherit;outline:none;",
            }),
            el("button", { id: "cv-unlock", class: "btn primary", text: T.unlock }),
          ]),
          el("small", { id: "cv-msg", style: "display:block;margin-top:.6rem;opacity:.9" }),
        ]),
      ]);
      main.insertBefore(panel, main.firstChild);
    }

    // panneau déverrouillé
    if (!$("#cv-unlocked")) {
      const unlocked = el("section", { id: "cv-unlocked", style: "display:none;margin:16px 0" }, [
        el("div", { class: "card" }, [
          el("div", { id: "cv-viewbar", style: "display:flex;gap:8px;align-items:center;margin-bottom:8px" }, [
            el("span", { text: T.pdfMode }),
            el("span", { id: "cv-loading", text: " · " + T.loading, style: "opacity:.8" }),
          ]),
          el("iframe", {
            id: "cv-frame",
            title: "CV PDF",
            // ⚠️ pas de allow-scripts + allow-same-origin en même temps
            sandbox: "allow-same-origin", // suffisant pour un PDF
            style: "width:100%;height:75vh;border:1px solid #ffffff22;border-radius:12px;background:#0b2237",
          }),
        ]),
      ]);
      const locked = $("#cv-locked");
      (locked?.parentNode || document.body).insertBefore(unlocked, locked?.nextSibling || null);
    }
  }

  function setMsg(msg, ok = false) {
    const m = $("#cv-msg");
    if (!m) return;
    m.textContent = msg || "";
    m.style.color = ok ? "#48e39f" : "";
  }

  async function verifyCode(code) {
    // 1) GET ?code
    try {
      const r = await fetch(`/api/verify?code=${encodeURIComponent(code)}`, { method: "GET" });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j && (j.ok === true || j.status === "ok")) return true;
      }
    } catch {}
    // 2) POST {code}
    try {
      const r = await fetch(`/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j && (j.ok === true || j.status === "ok")) return true;
      }
    } catch {}
    // 3) GET avec header alternatif (au cas où l’API l’attend)
    try {
      const r = await fetch(`/api/verify`, { headers: { "x-cv-code": code } });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j && (j.ok === true || j.status === "ok")) return true;
      }
    } catch {}
    return false;
  }

  function showUnlocked(code) {
    const locked = $("#cv-locked");
    const unlocked = $("#cv-unlocked");
    if (locked) locked.style.display = "none";
    if (unlocked) unlocked.style.display = "";

    const i = $("#cv-frame");
    const loading = $("#cv-loading");
    if (loading) loading.style.display = "";
    if (i) {
      i.src = `/api/cv?code=${encodeURIComponent(code)}`;
      i.addEventListener(
        "load",
        () => {
          if (loading) loading.style.display = "none";
        },
        { once: true }
      );
    }
  }

  async function handleUnlock(code) {
    if (!code || code.trim().length < 3) {
      setMsg(T.wrong);
      return;
    }
    const ok = await verifyCode(code.trim());
    if (!ok) {
      setMsg(T.wrong);
      return;
    }
    localStorage.setItem(LS_OK, "1");
    localStorage.setItem(LS_CODE, code.trim());
    setMsg(T.ok, true);
    showUnlocked(code.trim());
  }

  function wire() {
    const btn = $("#cv-unlock");
    const inp = $("#cv-code");
    if (btn) btn.addEventListener("click", () => handleUnlock(inp && inp.value));
    if (inp) inp.addEventListener("keydown", (e) => e.key === "Enter" && handleUnlock(inp.value));
  }

  function boot() {
    ensureUI();
    wire();

    const ok = localStorage.getItem(LS_OK) === "1";
    const codeStored = localStorage.getItem(LS_CODE) || "";
    const qs = new URLSearchParams(location.search);
    const codeQ = (qs.get("code") || "").trim();

    if (ok && (codeQ || codeStored)) {
      showUnlocked(codeQ || codeStored);
    } else {
      const locked = $("#cv-locked");
      if (locked) locked.style.display = "";
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
