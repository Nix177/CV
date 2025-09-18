<script>
/* Chatbot front — FR/EN/DE + liberté + concision
   - Fige la langue de session (sessionStorage.botLang) si l’utilisateur écrit en EN/DE
     ou si un bouton data-force-lang est cliqué (FR | EN | DE).
   - Envoie liberty (0/1/2), concise (bool), lang ("fr"|"en"|"de") au backend.
   - Enter envoie (Shift+Enter = nouvelle ligne).
*/

(() => {
  "use strict";

  // ------- Helpers -------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const log = (...a) => console.log("%c[chatbot]", "color:#0af", ...a);
  const warn = (...a) => console.warn("%c[chatbot]", "color:#fa0", ...a);

  // ------- UI refs -------
  const logEl = $("#chatLog");
  const input = $("#chatInput");
  const sendBt = $("#chatSend");
  const libertyRange = $("#liberty");            // <input type="range" id="liberty" min="0" max="2">
  const conciseCk = $("#concise");               // <input type="checkbox" id="concise">
  const libertyBadge = $("#libertyBadge");       // petit badge 0/1/2 à côté du slider
  const langBtns = $$("[data-force-lang]");      // boutons FR/EN/DE éventuels

  // ------- State -------
  // Langue par défaut : sessionStorage ? HTML lang ? "fr"
  const pageLang = (document.documentElement.lang || "fr").slice(0,2).toLowerCase();
  if (!sessionStorage.getItem("botLang")) {
    sessionStorage.setItem("botLang", pageLang);
  }
  // Par défaut : liberté=2, concision décochée
  if (!localStorage.getItem("botLiberty")) {
    localStorage.setItem("botLiberty", "2");
  }
  if (!localStorage.getItem("botConcise")) {
    localStorage.setItem("botConcise", "0");
  }

  // ------- UI init -------
  function uiInit() {
    // Slider
    if (libertyRange) {
      libertyRange.min = "0";
      libertyRange.max = "2";
      libertyRange.step = "1";
      libertyRange.value = localStorage.getItem("botLiberty") || "2";
      updateLibertyBadge();
      libertyRange.addEventListener("input", () => {
        localStorage.setItem("botLiberty", libertyRange.value);
        updateLibertyBadge();
      });
    }
    // Concision
    if (conciseCk) {
      conciseCk.checked = localStorage.getItem("botConcise") === "1" ? true : false;
      conciseCk.addEventListener("change", () => {
        localStorage.setItem("botConcise", conciseCk.checked ? "1" : "0");
      });
    }
    // Boutons de langue
    langBtns.forEach(b => {
      b.addEventListener("click", () => {
        const L = (b.getAttribute("data-force-lang") || "").toLowerCase();
        if (["fr","en","de"].includes(L)) {
          sessionStorage.setItem("botLang", L);
          addBubble(
            L === "fr" ? "✅ Langue fixée sur français." :
            L === "en" ? "✅ Language set to English." :
                         "✅ Sprache auf Deutsch gesetzt.",
            "sys"
          );
        }
      });
    });
    // Envoyer : bouton + Enter
    sendBt?.addEventListener("click", ask);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
    });

    // Message d’intro
    addBubble(
      sessionLang() === "en" ? 
      "Hello! Ask a question about the candidate. (Liberty: 0 factual, 1 prudent, 2 interpretative with marked deductions.)"
      : sessionLang() === "de" ?
      "Hallo! Stellen Sie eine Frage zum Kandidaten. (Freiheit: 0 faktisch, 1 vorsichtig, 2 interpretativ mit gekennzeichneten Schlussfolgerungen.)"
      :
      "Bonjour ! Posez une question sur le candidat. (Liberté : 0 factuel, 1 prudent, 2 interprétatif avec déductions signalées.)",
      "bot"
    );
  }

  function sessionLang() {
    return (sessionStorage.getItem("botLang") || pageLang || "fr").slice(0,2);
  }

  function updateLibertyBadge() {
    if (!libertyBadge) return;
    const v = libertyRange ? Number(libertyRange.value) : 2;
    libertyBadge.textContent = String(v);
    libertyBadge.setAttribute("data-level", String(v));
  }

  // ------- Langue : heuristique légère (une fois) -------
  function resolveLang(text) {
    if (!text || text.length < 2) return sessionLang();
    const t = text.trim();
    // très simple : si présence de ' der die das ' etc.
    const deck = /(^|\s)(der|die|das|und|ist|im|mit|eine|einen|nicht)(\s|[,.!?;:])/i;
    const enck = /(^|\s)(the|and|is|in|with|can|what|which|does)(\s|[,.!?;:])/i;
    const frck = /(^|\s)(le|la|les|est|avec|peut|quoi|quelles|des)(\s|[,.!?;:])/i;

    if (enck.test(t)) return "en";
    if (deck.test(t)) return "de";
    if (frck.test(t)) return "fr";

    // sinon on garde la session
    return sessionLang();
  }

  // ------- Chat UI -------
  function addBubble(text, who = "bot") {
    if (!logEl) return;
    const line = document.createElement("div");
    line.className = "bubble " + who;
    line.textContent = String(text || "");
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ------- ASK -------
  async function ask() {
    const q = input?.value?.trim();
    if (!q) return;
    addBubble(q, "user");
    input.value = "";

    // figer la langue de la session si rien de fixé
    const L = sessionStorage.getItem("botLang") || resolveLang(q);
    sessionStorage.setItem("botLang", L);

    const liberty = Number(localStorage.getItem("botLiberty") || (libertyRange ? libertyRange.value : 2)) || 2;
    const concise = localStorage.getItem("botConcise") === "1" ? true : false;

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: {"content-type":"application/json"},
        body: JSON.stringify({
          message: q,
          liberty,
          concise,
          lang: L
        })
      });
      const json = await r.json();
      if (!json?.ok) {
        warn("server error", json);
        addBubble("— erreur serveur —", "sys");
        return;
      }
      const content = json?.answer?.content || "(no content)";
      addBubble(content, "bot");
    } catch(e) {
      warn("fetch error", e);
      addBubble("— connexion impossible —", "sys");
    }
  }

  // ------- LET’S GO -------
  uiInit();

})();
</script>
