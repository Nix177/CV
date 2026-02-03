/* public/chatbot.js
   Version Streaming + RAG + Multi-Model
*/
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);

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

  function detectLang() {
    const qs = new URLSearchParams(location.search);
    const qlang = (qs.get("lang") || "").slice(0, 2).toLowerCase();
    if (["fr", "en", "de"].includes(qlang)) return qlang;
    const hlang = (document.documentElement.getAttribute("lang") || "fr").split("-")[0].toLowerCase();
    return ["fr", "en", "de"].includes(hlang) ? hlang : "fr";
  }

  function addBubble(text, who = "bot") {
    const logEl = $("#chatLog");
    if (!logEl) return null;
    const line = document.createElement("div");
    line.className = "bubble " + who;
    line.textContent = String(text ?? "");
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
    return line; // Retourne l'élément pour mise à jour stream
  }

  // Envoi avec Streaming
  async function send() {
    const input = $("#chatInput");
    const sendBt = $("#chatSend");
    const range = $("#liberty input:checked"); // Corrected selector for radio
    const concise = $("#concise");
    const providerEl = $("input[name='provider']:checked"); // Nouveau: sélecteur de modèle
    const lang = detectLang();

    const q = (input?.value || "").trim();
    if (!q) return;

    if (input) input.value = "";
    if (sendBt) sendBt.disabled = true;

    addBubble(q, "user");

    // Bulle bot temporaire (vide ou avec curseur)
    const botBubble = addBubble("", "bot");
    botBubble.classList.add("streaming"); // CSS pour effet curseur éventuel

    const payload = {
      message: q,
      liberty: Number(range?.value ?? 2) || 2,
      concise: !!(concise && concise.checked),
      lang,
      provider: providerEl ? providerEl.value : "openai"
    };

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!r.ok) throw new Error("HTTP " + r.status);

      // Lecture du stream
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        botBubble.textContent = fullText;
        // Auto-scroll basique
        const logEl = $("#chatLog");
        if (logEl) logEl.scrollTop = logEl.scrollHeight;
      }

      botBubble.classList.remove("streaming");

    } catch (e) {
      botBubble.textContent += "\n" + I18N[lang].neterr;
      console.error(e);
    } finally {
      if (sendBt) sendBt.disabled = false;
      const logEl = $("#chatLog");
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    }
  }

  function init() {
    const lang = detectLang();
    const input = $("#chatInput");
    const sendBt = $("#chatSend");

    // Message d’accueil
    addBubble(I18N[lang].hello, "bot");

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    sendBt?.addEventListener("click", send);
  }

  init();
})();
