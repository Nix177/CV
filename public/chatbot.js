/* public/chatbot.js
   Version stable + i18n automatique :
   - Enter envoie (Shift+Enter = nouvelle ligne)
   - Bouton Envoyer
   - Liberté 0/1/2 + "réponses concises"
   - Détecte la langue (fr/en/de) depuis <html lang=".."> ou ?lang=
   - Envoie { message, liberty, concise, lang } à /api/chat
*/
(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (s, r = document) => r.querySelector(s);

  // I18N minimal (greeting + erreurs réseau)
  const I18N = {
    fr: {
      hello: "Bonjour ! Posez une question sur le candidat.",
      neterr: "— connexion impossible —",
      serv: "— erreur serveur —"
    },
    en: {
      hello: "Hello! Ask a question about the candidate.",
      neterr: "— connection error —",
      serv: "— server error —"
    },
    de: {
      hello: "Hallo! Stellen Sie eine Frage zum Kandidaten.",
      neterr: "— Verbindungsfehler —",
      serv: "— Serverfehler —"
    }
  };

  // Détection de langue : ?lang=... prioritaire, sinon <html lang="...">
  function detectLang() {
    const qs = new URLSearchParams(location.search);
    const qlang = (qs.get("lang") || "").slice(0, 2).toLowerCase();
    if (["fr", "en", "de"].includes(qlang)) return qlang;

    const hlang = (document.documentElement.getAttribute("lang") || "fr")
      .split("-")[0].toLowerCase();
    return ["fr", "en", "de"].includes(hlang) ? hlang : "fr";
  }

  // Bubbles
  function addBubble(text, who = "bot") {
    const logEl = $("#chatLog");
    if (!logEl) return;
    const line = document.createElement("div");
    line.className = "bubble " + who;
    line.textContent = String(text ?? "");
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Envoi
  async function send() {
    const input = $("#chatInput");
    const range = $("#liberty");
    const concise = $("#concise");
    const lang = detectLang();

    const q = (input?.value || "").trim();
    if (!q) return;

    addBubble(q, "user");
    if (input) input.value = "";

    const checkedLib = $("#liberty input:checked");
    const payload = {
      message: q,
      liberty: Number(checkedLib?.value ?? 2) || 2,   // 0/1/2
      concise: !!(concise && concise.checked),
      lang
    };

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Réponse robuste
      let txt = I18N[lang].serv;
      if (r.ok) {
        const json = await r.json().catch(() => null);
        if (json?.answer?.content) {
          txt = String(json.answer.content);
        } else if (typeof json === "string") {
          txt = json;
        } else if (json?.answer?.role && json?.answer?.content) {
          txt = String(json.answer.content);
        }
      }
      addBubble(txt, "bot");
    } catch (e) {
      addBubble(I18N[lang].neterr, "sys");
    }
  }

  // Init
  function init() {
    const lang = detectLang();
    const range = $("#liberty");
    const concise = $("#concise");
    const input = $("#chatInput");
    const sendBt = $("#chatSend");

    // Valeurs par défaut : liberté = 2, "réponses concises" décoché
    if (range) range.value = "2";
    if (concise) concise.checked = false;

    // Message d’accueil localisé
    addBubble(I18N[lang].hello, "bot");

    // Enter = envoyer (Shift+Enter = nouvelle ligne)
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });

    sendBt?.addEventListener("click", send);
  }

  init();
})();
