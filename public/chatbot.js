/* public/chatbot.js
   Version Streaming + RAG + Multi-Model
*/
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);

  const I18N = {
    fr: {
      hello: "Bonjour ! Posez une question sur le candidat.",
      exportTitle: "Conversation avec le chatbot de Nicolas Tuor",
      exportDate: "Exporté le",
      exportNote: "Copie locale créée à votre demande. Nicolas Tuor ne reçoit ni ne conserve ce fichier.",
      user: "Vous",
      assistant: "Assistant",
      provider: "Fournisseur",
      neterr: "— connexion impossible —",
      serv: "— erreur serveur —"
    },
    en: {
      hello: "Hello! Ask a question about the candidate.",
      exportTitle: "Conversation with Nicolas Tuor's chatbot",
      exportDate: "Exported on",
      exportNote: "Local copy created at your request. Nicolas Tuor does not receive or retain this file.",
      user: "You",
      assistant: "Assistant",
      provider: "Provider",
      neterr: "— connection error —",
      serv: "— server error —"
    },
    de: {
      hello: "Hallo! Stellen Sie eine Frage zum Kandidaten.",
      exportTitle: "Gespräch mit Nicolas Tuors Chatbot",
      exportDate: "Exportiert am",
      exportNote: "Lokale Kopie auf Ihren Wunsch. Nicolas Tuor erhält oder speichert diese Datei nicht.",
      user: "Sie",
      assistant: "Assistent",
      provider: "Anbieter",
      neterr: "— Verbindungsfehler —",
      serv: "— Serverfehler —"
    }
  };

  let recordedTurns = [];
  let activeRecordedTurn = null;

  function isRecordingEnabled() {
    return Boolean($("#chatConsent")?.checked);
  }

  function syncDownloadButton() {
    const button = $("#chatDownload");
    if (button) button.disabled = !isRecordingEnabled() || recordedTurns.length === 0;
  }

  function clearRecordedConversation() {
    recordedTurns = [];
    activeRecordedTurn = null;
    syncDownloadButton();
  }

  function startRecordedTurn(question, providerEl) {
    if (!isRecordingEnabled()) return null;
    const providerName = providerEl?.parentElement?.textContent?.trim() || providerEl?.value || "";
    const turn = { question, answer: "", provider: providerName, at: Date.now() };
    recordedTurns.push(turn);
    activeRecordedTurn = turn;
    syncDownloadButton();
    return turn;
  }

  function updateRecordedAnswer(turn, answer) {
    if (!turn || !isRecordingEnabled() || !recordedTurns.includes(turn)) return;
    turn.answer = String(answer || "");
  }

  function downloadRecordedConversation() {
    if (!isRecordingEnabled() || !recordedTurns.length) return;
    const lang = detectLang();
    const copy = I18N[lang];
    const locale = lang === "de" ? "de-CH" : lang === "en" ? "en-GB" : "fr-CH";
    const lines = [
      `# ${copy.exportTitle}`,
      "",
      `${copy.exportDate}: ${new Date().toLocaleString(locale)}`,
      "",
      `_${copy.exportNote}_`,
      ""
    ];
    recordedTurns.forEach((turn, index) => {
      lines.push(`## ${index + 1}. ${copy.user}`, "", turn.question, "");
      if (turn.provider) lines.push(`_${copy.provider}: ${turn.provider}_`, "");
      lines.push(`### ${copy.assistant}`, "", turn.answer || "-", "");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conversation-chatbot-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function detectLang() {
    const qs = new URLSearchParams(location.search);
    const qlang = (qs.get("lang") || "").slice(0, 2).toLowerCase();
    if (["fr", "en", "de"].includes(qlang)) return qlang;
    const hlang = (document.documentElement.getAttribute("lang") || "fr").split("-")[0].toLowerCase();
    return ["fr", "en", "de"].includes(hlang) ? hlang : "fr";
  }

  function appendInlineMarkdown(container, source) {
    const text = String(source || "");
    const tokenPattern = /(\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\))/g;
    let cursor = 0;
    let match;

    while ((match = tokenPattern.exec(text))) {
      if (match.index > cursor) container.append(document.createTextNode(text.slice(cursor, match.index)));

      if (match[2]) {
        const strong = document.createElement("strong");
        strong.textContent = match[2];
        container.append(strong);
      } else {
        let url;
        try {
          url = new URL(match[4], location.href);
        } catch {
          url = null;
        }

        if (url && ["http:", "https:"].includes(url.protocol)) {
          const link = document.createElement("a");
          link.textContent = match[3];
          link.href = url.href;
          link.rel = "noopener noreferrer";
          if (url.origin !== location.origin) link.target = "_blank";
          container.append(link);
        } else {
          container.append(document.createTextNode(match[3]));
        }
      }

      cursor = tokenPattern.lastIndex;
    }

    if (cursor < text.length) container.append(document.createTextNode(text.slice(cursor)));
  }

  function renderMarkdown(container, markdown) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const fragment = document.createDocumentFragment();
    let paragraphLines = [];
    let activeList = null;

    const flushParagraph = () => {
      if (!paragraphLines.length) return;
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, paragraphLines.join(" "));
      fragment.append(paragraph);
      paragraphLines = [];
    };
    const closeList = () => { activeList = null; };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        closeList();
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      const unordered = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+\.\s+(.+)$/);

      if (heading) {
        flushParagraph();
        closeList();
        const level = Math.min(5, heading[1].length + 2);
        const title = document.createElement(`h${level}`);
        appendInlineMarkdown(title, heading[2]);
        fragment.append(title);
      } else if (unordered || ordered) {
        flushParagraph();
        const tagName = ordered ? "OL" : "UL";
        if (!activeList || activeList.tagName !== tagName) {
          activeList = document.createElement(tagName.toLowerCase());
          fragment.append(activeList);
        }
        const item = document.createElement("li");
        appendInlineMarkdown(item, (unordered || ordered)[1]);
        activeList.append(item);
      } else {
        closeList();
        paragraphLines.push(line);
      }
    }

    flushParagraph();
    container.replaceChildren(fragment);
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
  async function send(questionOverride = "") {
    const input = $("#chatInput");
    const sendBt = $("#chatSend");
    const range = $("#liberty input:checked"); // Corrected selector for radio
    const concise = $("#concise");
    const providerEl = $("input[name='provider']:checked"); // Nouveau: sélecteur de modèle
    const lang = detectLang();

    const q = (questionOverride || input?.value || "").trim();
    if (!q) return;
    const recordedTurn = startRecordedTurn(q, providerEl);

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

    let fullText = "";
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        botBubble.textContent = fullText;
        updateRecordedAnswer(recordedTurn, fullText);
        // Auto-scroll basique
        const logEl = $("#chatLog");
        if (logEl) logEl.scrollTop = logEl.scrollHeight;
      }

      botBubble.classList.remove("streaming");
      renderMarkdown(botBubble, fullText);

    } catch (e) {
      const errorText = `${fullText}${fullText ? "\n" : ""}${I18N[lang].neterr}`;
      botBubble.textContent = errorText;
      updateRecordedAnswer(recordedTurn, errorText);
      console.error(e);
    } finally {
      if (activeRecordedTurn === recordedTurn) activeRecordedTurn = null;
      syncDownloadButton();
      if (sendBt) sendBt.disabled = false;
      const logEl = $("#chatLog");
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    }
  }

  async function updateProviderLabels() {
    const openaiLabel = document.querySelector("[data-model-label='openai']");
    const googleLabel = document.querySelector("[data-model-label='google']");
    if (!openaiLabel && !googleLabel) return;

    try {
      const r = await fetch("/api/chat?meta=1", { headers: { accept: "application/json" } });
      if (!r.ok) return;
      const meta = await r.json();
      const openaiModel = String(meta?.models?.openai || "").trim();
      const googleModel = String(meta?.models?.google || "").trim();
      if (openaiLabel && openaiModel) openaiLabel.textContent = `OpenAI (${openaiModel})`;
      if (googleLabel && googleModel) googleLabel.textContent = `Google Gemini (${googleModel})`;
    } catch {
      // Static pages and local previews can run without the serverless API.
    }
  }

  function init() {
    const lang = detectLang();
    const input = $("#chatInput");
    const sendBt = $("#chatSend");
    const consent = $("#chatConsent");
    const download = $("#chatDownload");

    // Message d’accueil
    updateProviderLabels();

    addBubble(I18N[lang].hello, "bot");

    if (consent) {
      consent.checked = false;
      consent.addEventListener("change", () => {
        if (!consent.checked) clearRecordedConversation();
        else syncDownloadButton();
      });
    }
    download?.addEventListener("click", downloadRecordedConversation);
    syncDownloadButton();

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    sendBt?.addEventListener("click", () => send());

    document.querySelectorAll("[data-chat-question]").forEach((button) => {
      button.addEventListener("click", () => {
        const question = (button.getAttribute("data-chat-question") || button.textContent || "").trim();
        if (input) input.value = question;
        send(question);
      });
    });
  }

  init();
})();
