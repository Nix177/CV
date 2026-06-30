/* ============================================================================
 * public/osselets-level2.js - L2 "Ecrire avec les os"
 *
 * Portfolio integration wrapper for the validated astragalus cipher prototype.
 * The actual interactive game lives in /prototypes/astragale-secret-*.html so
 * its 3D/CSS scope stays isolated from the other portfolio games.
 * ==========================================================================*/
(() => {
  "use strict";

  const ROUTES = {
    fr: "/prototypes/astragale-secret-fr.html?embed=1",
    en: "/prototypes/astragale-secret-en.html?embed=1",
    de: "/prototypes/astragale-secret-de.html?embed=1"
  };

  const TITLES = {
    fr: "Ecrire avec les os - Fil et alphabet",
    en: "Write with the bones - Thread and alphabet",
    de: "Mit den Knochen schreiben - Faden und Alphabet"
  };

  function detectLang() {
    const htmlLang = (document.documentElement.lang || "").toLowerCase();
    const path = (location.pathname || "").toLowerCase();
    if (htmlLang.startsWith("de") || path.includes("-de")) return "de";
    if (htmlLang.startsWith("en") || path.includes("-en")) return "en";
    return "fr";
  }

  function ensureStyle() {
    if (document.getElementById("osselets-level2-embed-style")) return;
    const style = document.createElement("style");
    style.id = "osselets-level2-embed-style";
    style.textContent = `
      .osselets-level2-host {
        min-height: 780px;
        background: #f6f7f2;
      }
      .osselets-level2-shell {
        width: 100%;
        min-height: 780px;
        background: #f6f7f2;
      }
      .osselets-level2-frame {
        display: block;
        width: 100%;
        height: clamp(780px, 88vh, 1120px);
        border: 0;
        background: #f6f7f2;
      }
      @media (max-width: 720px) {
        .osselets-level2-host,
        .osselets-level2-shell { min-height: 920px; }
        .osselets-level2-frame { height: min(1120px, 92vh); }
      }
    `;
    document.head.appendChild(style);
  }

  async function mount(rootEl) {
    if (!rootEl) throw new Error("OsseletsLevel2.mount(root): root element missing");

    ensureStyle();
    const lang = detectLang();
    const iframe = document.createElement("iframe");
    const shell = document.createElement("div");

    shell.className = "osselets-level2-shell";
    iframe.className = "osselets-level2-frame";
    iframe.title = TITLES[lang] || TITLES.fr;
    iframe.src = ROUTES[lang] || ROUTES.fr;
    iframe.loading = "eager";
    iframe.referrerPolicy = "same-origin";
    iframe.setAttribute("allow", "fullscreen");

    rootEl.innerHTML = "";
    rootEl.classList.add("osselets-level2-host");
    shell.appendChild(iframe);
    rootEl.appendChild(shell);

    return {
      destroy() {
        iframe.src = "about:blank";
        shell.remove();
        rootEl.classList.remove("osselets-level2-host");
      }
    };
  }

  window.OsseletsLevel2 = { mount };
})();
