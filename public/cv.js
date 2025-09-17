/* CV — accès protégé (FR/EN/DE)
   - Affiche un panneau de déverrouillage (code d’accès) si l’accès n’est pas validé
   - Vérifie via /api/verify?code=... (GET) → { ok: true/false }
   - Une fois validé, embarque le PDF via /api/cv?code=...
   - Persiste l’accès en localStorage (STORAGE_KEY)
   - S’adapte à la page (crée les conteneurs si absents)
*/

(function () {
  "use strict";

  const STORAGE_KEY = "cv_access_ok_v1";

  const LANG = (document.documentElement.getAttribute("lang") || "fr")
    .toLowerCase()
    .slice(0, 2);

  const T = {
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
  }[LANG] || T_fr();

  function T_fr() {
    return T.fr;
  }

  // ------- DOM helpers -------
  const $ = (sel, root = document) => root.querySelector(sel);

  function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }

  // ------- UI scaffolding -------
  function ensureScaffolding() {
    // zone principale (au début du <main> si présent)
    const main = $("main") || document.body;

    // Panneau "verrouillé" (formulaire)
    let locked = $("#cv-locked");
    if (!locked) {
      locked = createEl("section", { id: "cv-locked", style: "margin: 16px 0;" }, [
        createEl("div", { class: "card", style: "max-width:560px" }, [
          createEl("h2", { text: T.title, style: "margin-top:0" }),
          createEl("label", { for: "cv-code", text: T.label }),
          createEl("div", { style: "display:flex; gap:8px; margin:.4rem 0 0" }, [
            createEl("input", {
              id: "cv-code",
              type: "password",
              autocomplete: "off",
              placeholder: T.placeholder,
              style:
                "flex:1; padding:.6rem .8rem; border-radius:10px; border:1px solid #ffffff25; background:#ffffff10; color:inherit; outline:none;",
            }),
            createEl("button", { id: "cv-unlock", class: "btn primary", text: T.unlock }),
          ]),
          createEl("small", { id: "cv-msg", style: "display:block; margin-top:.6rem; opacity:.9" }),
        ]),
      ]);
      main.insertBefore(locked, main.firstChild);
    }

    // Zone "déverrouillée" (PDF embarqué)
    let unlocked = $("#cv-unlocked");
    if (!unlocked) {
      unlocked = createEl("section", { id: "cv-unlocked", style: "display:none; margin:16px 0" }, [
        createEl("div", { class: "card" }, [
          createEl("div", { id: "cv-viewbar", style: "display:flex; gap:8px; align-items:center; margin-bottom:8px" }, [
            createEl("span", { text: T.pdfMode }),
            createEl("span", { id: "cv-loading", text: " · " + T.loading, style: "opacity:.8" }),
          ]),
          createEl("iframe", {
            id: "cv-frame",
            title: "CV PDF",
            style:
              "width:100%; height:75vh; border:1px solid #ffffff22; border-radius:12px; background:#0b2237",
            sandbox: "allow-same-origin allow-scripts allow-forms",
          }),
        ]),
      ]);
      main.insertBefore(unlocked, locked.nextSibling);
    }
  }

  // ------- Logic -------
  async function verifyCode(code) {
    try {
      const r = await fetch(`/api/verify?code=${encodeURIComponent(code)}`, { method: "GET" });
      if (!r.ok) return false;
      const j = await r.json().catch(() => ({}));
      return !!j.ok;
    } catch {
      return false;
    }
  }

  function setLockedUI(state, msg, ok = false) {
    const m = $("#cv-msg");
    if (!m) return;
    m.textContent = msg || "";
    m.style.color = ok ? "#48e39f" : "";
  }

  function revealPDF(code) {
    const locked = $("#cv-locked");
    const unlocked = $("#cv-unlocked");
    if (locked) locked.style.display = "none";
    if (unlocked) unlocked.style.display = "";

    const iframe = $("#cv-frame");
    const loading = $("#cv-loading");
    if (loading) loading.style.display = "";

    if (iframe) {
      // charge via l’API protégée
      iframe.src = `/api/cv?code=${encodeURIComponent(code)}`;
      iframe.addEventListener(
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
      setLockedUI(false, T.wrong);
      return;
    }
    const ok = await verifyCode(code.trim());
    if (!ok) {
      setLockedUI(false, T.wrong);
      return;
    }
    localStorage.setItem(STORAGE_KEY, "1");
    setLockedUI(true, T.ok, true);
    revealPDF(code.trim());
  }

  function hookEvents() {
    const btn = $("#cv-unlock");
    const inp = $("#cv-code");
    if (btn) btn.addEventListener("click", () => handleUnlock(inp && inp.value));
    if (inp)
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleUnlock(inp.value);
      });
  }

  function initFromStorageOrQuery() {
    const hasOk = localStorage.getItem(STORAGE_KEY) === "1";
    const q = new URLSearchParams(location.search);
    const codeQ = q.get("code");

    if (hasOk && codeQ) {
      revealPDF(codeQ);
      return;
    }
    if (hasOk && !codeQ) {
      // Si déjà validé mais pas de code dans l’URL, on affiche l’UI déverrouillée
      // avec une tentative de chargement par défaut (l’API refusera sans code, mais l’UI est visible).
      revealPDF("");
      return;
    }
    // Sinon, formulaire visible
    const locked = $("#cv-locked");
    if (locked) locked.style.display = "";
  }

  // ------- Boot -------
  document.addEventListener("DOMContentLoaded", () => {
    ensureScaffolding();
    hookEvents();
    initFromStorageOrQuery();
  });
})();
