import { createResearchRobot } from "./createResearchRobot.js";
import { createGlbResearchRobot } from "./createGlbResearchRobot.js";
import { RobotStateController } from "./RobotStateController.js";
import { RobotRenderer } from "./RobotRenderer.js";
import { RobotDebugPanel } from "./RobotDebugPanel.js";
import { RagRetriever } from "./RagRetriever.js";
import { PcmAudioPlayer } from "./PcmAudioPlayer.js";
import { MicrophoneCapture } from "./MicrophoneCapture.js";
import { GeminiLiveClient } from "./GeminiLiveClient.js";
import { I18N, getLanguageFromUrl } from "./i18n.js";

function normalizeTranscriptText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function mergeTranscriptText(current, incoming) {
  const left = normalizeTranscriptText(current);
  const right = normalizeTranscriptText(incoming);
  if (!left) return right;
  if (!right || left.endsWith(right)) return left;
  if (right.startsWith(left)) return right;

  const leftLower = left.toLocaleLowerCase();
  const rightLower = right.toLocaleLowerCase();
  for (let size = Math.min(left.length, right.length); size >= 3; size -= 1) {
    if (leftLower.slice(-size) === rightLower.slice(0, size)) {
      return normalizeTranscriptText(left + right.slice(size));
    }
  }

  return `${left} ${right}`.replace(/\s+([.,!?;:])/g, "$1");
}

export class VoiceAssistantApp {
  constructor() {
    this.lang = getLanguageFromUrl();
    this.robot = null;
    this.robotController = null;
    this.robotRenderer = null;
    this.debugPanel = null;
    this.retriever = new RagRetriever();
    this.audioPlayer = null;
    this.microphone = null;
    this.liveClient = null;
    this.recording = false;
    this.turnComplete = false;
    this.debugMode = this.isLocalDebugMode();
    this.conversationTurns = [];
    this.activeConversationTurn = null;
    this.transcriptRenderQueued = false;
    this.elements = {};
  }

  async init() {
    this.collectElements();
    await this.initRobot();
    this.initAudioAndLiveClient();
    this.bindInterface();
    this.applyLanguage(this.lang);
    this.setState("idle");

    try {
      await this.retriever.load();
      this.elements.sourceStatus.textContent = I18N[this.lang].sourceReady;
    } catch (error) {
      console.error("RAG source loading failed", error);
      this.elements.sourceStatus.textContent = I18N[this.lang].noSource;
    }
  }

  collectElements() {
    const byId = (id) => document.getElementById(id);
    this.elements = {
      viewport: byId("robotViewport"),
      fallback: byId("robotFallback"),
      stateLabel: byId("stateLabel"),
      questionEcho: byId("questionEcho"),
      sourceStatus: byId("sourceStatus"),
      suggestions: byId("suggestions"),
      form: byId("assistantForm"),
      input: byId("assistantInput"),
      mic: byId("micButton"),
      stopRecording: byId("stopRecordingButton"),
      stopSpeaking: byId("stopSpeakingButton"),
      volume: byId("volumeControl"),
      mute: byId("muteControl"),
      reducedMotion: byId("reducedMotionControl"),
      conversationConsent: byId("conversationConsent"),
      downloadConversation: byId("downloadConversation"),
      conversationTranscript: byId("conversationTranscript"),
      transcriptEmpty: byId("transcriptEmpty"),
      transcriptEntries: byId("transcriptEntries"),
      compatibility: byId("compatibilityNote"),
      debugPanel: byId("robotDebugPanel"),
      debug: byId("robotDebugControls")
    };
  }

  async initRobot() {
    try {
      try {
        this.robot = await createGlbResearchRobot(globalThis.THREE);
      } catch (error) {
        console.warn("GLB voice robot unavailable; using procedural fallback", error);
        this.robot = createResearchRobot(globalThis.THREE);
      }
      this.robotController = new RobotStateController(this.robot);
      this.robotRenderer = new RobotRenderer({
        THREE: globalThis.THREE,
        container: this.elements.viewport,
        robot: this.robot,
        controller: this.robotController,
        fallback: this.elements.fallback
      });
      this.robotRenderer.init();
      if (this.debugMode) {
        this.elements.debugPanel.hidden = false;
        this.debugPanel = new RobotDebugPanel({
          container: this.elements.debug,
          controller: this.robotController,
          renderer: this.robotRenderer,
          onStateChange: (state) => this.setState(state)
        });
        this.debugPanel.init();
      }
    } catch (error) {
      console.error("Robot creation failed", error);
      this.elements.fallback.hidden = false;
    }
  }

  initAudioAndLiveClient() {
    this.audioPlayer = new PcmAudioPlayer({
      onStart: () => {
        this.setState("speaking");
        this.elements.stopSpeaking.disabled = false;
      },
      onIdle: () => {
        this.elements.stopSpeaking.disabled = true;
        if (this.turnComplete && !this.recording) this.setState("idle");
      },
      onError: (error) => this.handleError(error)
    });

    this.microphone = new MicrophoneCapture({
      onChunk: (base64) => this.liveClient.sendAudioChunk(base64),
      onError: (error) => this.handleError(error, true)
    });

    this.liveClient = new GeminiLiveClient({
      retriever: this.retriever,
      onAudio: (base64) => this.audioPlayer.enqueue(base64),
      onInputTranscript: (text) => {
        if (!this.isConversationRecordingEnabled()) return;
        this.appendUserTranscript(text);
        if (this.activeConversationTurn?.user) {
          this.elements.questionEcho.textContent = this.activeConversationTurn.user;
        }
      },
      onOutputTranscript: (text) => this.appendAssistantTranscript(text),
      onRag: (result) => {
        this.setState("thinking");
        this.elements.sourceStatus.textContent = result.sources?.length
          ? I18N[this.lang].sourceUsed.replace("{sources}", result.sources.join(" + "))
          : I18N[this.lang].noSource;
      },
      onTurnComplete: () => {
        this.turnComplete = true;
        this.finalizeConversationTurn();
        if (!this.audioPlayer.playing && !this.recording) this.setState("idle");
      },
      onInterrupted: () => {
        this.audioPlayer.interrupt();
        this.finalizeConversationTurn();
        if (this.recording) this.setState("listening");
      },
      onError: (error) => this.handleError(error),
      onConnection: (status) => {
        if (status === "connecting") this.setState("thinking", I18N[this.lang].connecting);
      }
    });
  }

  bindInterface() {
    const notifyRobotInteraction = () => this.robotController?.notifyInteraction();
    document.addEventListener("pointerdown", notifyRobotInteraction, { passive: true });
    document.addEventListener("keydown", notifyRobotInteraction);

    this.elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const question = this.elements.input.value.trim();
      if (question) this.askText(question);
    });
    this.elements.input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      const question = this.elements.input.value.trim();
      if (question) this.askText(question);
    });

    this.elements.mic.addEventListener("click", () => this.startRecording());
    this.elements.stopRecording.addEventListener("click", () => this.stopRecording());
    this.elements.stopSpeaking.addEventListener("click", () => this.stopSpeaking());
    this.elements.volume.addEventListener("input", () => this.audioPlayer.setVolume(this.elements.volume.value));
    this.elements.mute.addEventListener("change", () => this.audioPlayer.setMuted(this.elements.mute.checked));
    this.elements.reducedMotion.addEventListener("change", () => {
      this.robotController?.setReducedMotion(this.elements.reducedMotion.checked);
    });
    this.elements.conversationConsent.addEventListener("change", () => {
      this.setConversationRecording(this.elements.conversationConsent.checked);
    });
    this.elements.downloadConversation.addEventListener("click", () => this.downloadConversation());

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.elements.reducedMotion.checked = reduced;
    this.robotController?.setReducedMotion(reduced);
    this.setConversationRecording(false);

    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.addEventListener("click", () => this.changeLanguage(button.dataset.lang));
    });

    window.addEventListener("beforeunload", () => this.dispose(), { once: true });
  }

  async ensureLiveSession() {
    await this.audioPlayer.ensureContext();
    const analyser = this.audioPlayer.getAnalyserNode();
    if (analyser) this.robotController?.connectAssistantAudioNode(analyser);
    this.liveClient.setTranscriptionEnabled(this.isConversationRecordingEnabled());
    await this.liveClient.connect(this.lang);
  }

  async askText(question) {
    this.stopSpeaking();
    if (this.recording) await this.stopRecording(false);
    this.turnComplete = false;
    if (this.isConversationRecordingEnabled()) this.beginConversationTurn(question);
    this.elements.questionEcho.textContent = question;
    this.elements.input.value = "";
    this.setState("thinking");
    try {
      await this.ensureLiveSession();
      await this.liveClient.sendText(question);
    } catch (error) {
      this.handleError(error);
    }
  }

  async startRecording() {
    if (this.recording) return;
    this.stopSpeaking();
    this.turnComplete = false;
    if (this.isConversationRecordingEnabled()) this.beginConversationTurn();
    this.elements.questionEcho.textContent = "…";
    try {
      await this.ensureLiveSession();
      await this.microphone.start();
      this.recording = true;
      this.elements.mic.disabled = true;
      this.elements.stopRecording.disabled = false;
      this.setState("listening");
    } catch (error) {
      this.handleError(error, true);
    }
  }

  async stopRecording(signalEnd = true) {
    if (!this.recording && !this.microphone.active) return;
    await this.microphone.stop();
    this.recording = false;
    this.elements.mic.disabled = false;
    this.elements.stopRecording.disabled = true;
    if (signalEnd) this.liveClient.endAudio();
    this.setState("thinking");
  }

  stopSpeaking() {
    const wasPlaying = Boolean(this.audioPlayer?.playing);
    if (wasPlaying) this.liveClient?.suppressCurrentOutput();
    this.audioPlayer?.interrupt();
    if (wasPlaying) this.finalizeConversationTurn();
    this.elements.stopSpeaking.disabled = true;
    if (!this.recording) this.setState("idle");
  }

  setState(state, customLabel = "") {
    document.body.dataset.state = state;
    this.robotController?.setState(state);
    this.elements.stateLabel.textContent = customLabel || I18N[this.lang][state] || state;
    document.querySelectorAll("[data-state-indicator]").forEach((indicator) => {
      indicator.setAttribute("aria-current", String(indicator.dataset.stateIndicator === state));
    });
  }

  isLocalDebugMode() {
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    return localHosts.has(location.hostname) && new URLSearchParams(location.search).get("debug") === "1";
  }

  async changeLanguage(lang) {
    if (!I18N[lang] || lang === this.lang) return;
    if (this.recording) await this.stopRecording(false);
    this.stopSpeaking();
    this.liveClient.close();
    this.lang = lang;
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState({}, "", url);
    this.applyLanguage(lang);
    this.setState("idle");
  }

  applyLanguage(lang) {
    const copy = I18N[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = copy[element.dataset.i18n];
      if (typeof value === "string") element.textContent = value;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const value = copy[element.dataset.i18nPlaceholder];
      if (typeof value === "string") element.placeholder = value;
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      const value = copy[element.dataset.i18nAriaLabel];
      if (typeof value === "string") element.setAttribute("aria-label", value);
    });
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
    });
    this.elements.questionEcho.textContent = copy.questionPlaceholder;
    this.elements.sourceStatus.textContent = this.retriever.ready ? copy.sourceReady : copy.connecting;
    this.updateNavigation(lang);
    this.renderSuggestions(copy.questions);
    this.renderTranscript();
  }

  updateNavigation(lang) {
    const suffix = lang === "fr" ? "" : `-${lang}`;
    const routes = {
      home: `/index${suffix}.html`,
      cv: `/cv${suffix}.html`,
      portfolio: `/portfolio${suffix}.html`,
      chatbot: `/chatbot${suffix}.html`,
      lab: "/lab.html"
    };
    document.querySelectorAll("[data-nav-route]").forEach((link) => {
      const href = routes[link.dataset.navRoute];
      if (href) link.setAttribute("href", href);
    });
  }

  isConversationRecordingEnabled() {
    return Boolean(this.elements.conversationConsent?.checked);
  }

  setConversationRecording(enabled) {
    const active = Boolean(enabled);
    this.elements.conversationConsent.checked = active;
    this.liveClient?.setTranscriptionEnabled(active);
    this.elements.conversationTranscript.hidden = !active;
    if (!active) {
      this.conversationTurns = [];
      this.activeConversationTurn = null;
      this.elements.transcriptEntries.replaceChildren();
    }
    this.renderTranscript();
  }

  beginConversationTurn(question = "") {
    if (!this.isConversationRecordingEnabled()) return null;
    this.finalizeConversationTurn();
    const turn = {
      user: normalizeTranscriptText(question),
      assistant: "",
      at: Date.now()
    };
    this.conversationTurns.push(turn);
    this.activeConversationTurn = turn;
    this.scheduleTranscriptRender();
    return turn;
  }

  appendUserTranscript(text) {
    if (!this.isConversationRecordingEnabled()) return;
    const turn = this.activeConversationTurn || this.beginConversationTurn();
    if (!turn) return;
    turn.user = mergeTranscriptText(turn.user, text);
    this.scheduleTranscriptRender();
  }

  appendAssistantTranscript(text) {
    if (!this.isConversationRecordingEnabled()) return;
    const turn = this.activeConversationTurn || this.beginConversationTurn();
    if (!turn) return;
    turn.assistant = mergeTranscriptText(turn.assistant, text);
    this.scheduleTranscriptRender();
  }

  finalizeConversationTurn() {
    const turn = this.activeConversationTurn;
    if (!turn) return;
    if (!turn.user && !turn.assistant) {
      const index = this.conversationTurns.indexOf(turn);
      if (index >= 0) this.conversationTurns.splice(index, 1);
    }
    this.activeConversationTurn = null;
    this.scheduleTranscriptRender();
  }

  scheduleTranscriptRender() {
    if (this.transcriptRenderQueued) return;
    this.transcriptRenderQueued = true;
    requestAnimationFrame(() => {
      this.transcriptRenderQueued = false;
      this.renderTranscript();
    });
  }

  renderTranscript() {
    const enabled = this.isConversationRecordingEnabled();
    this.elements.conversationTranscript.hidden = !enabled;
    if (!enabled) {
      this.elements.downloadConversation.disabled = true;
      return;
    }

    const turns = this.conversationTurns.filter((turn) => turn.user || turn.assistant);
    this.elements.transcriptEmpty.hidden = turns.length > 0;
    const copy = I18N[this.lang];
    const locale = this.lang === "de" ? "de-CH" : this.lang === "en" ? "en-GB" : "fr-CH";
    const entries = turns.map((turn) => {
      const article = document.createElement("article");
      article.className = "transcript-turn";
      const time = document.createElement("time");
      time.dateTime = new Date(turn.at).toISOString();
      time.textContent = new Date(turn.at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      article.append(time);
      if (turn.user) article.append(this.createTranscriptLine(copy.transcriptUser, turn.user, "user"));
      if (turn.assistant) article.append(this.createTranscriptLine(copy.transcriptAssistant, turn.assistant, "assistant"));
      return article;
    });
    this.elements.transcriptEntries.replaceChildren(...entries);
    this.elements.downloadConversation.disabled = turns.length === 0;
  }

  createTranscriptLine(label, text, role) {
    const line = document.createElement("p");
    line.className = `transcript-line transcript-${role}`;
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    line.append(strong, document.createTextNode(text));
    return line;
  }

  downloadConversation() {
    const turns = this.conversationTurns.filter((turn) => turn.user || turn.assistant);
    if (!this.isConversationRecordingEnabled() || !turns.length) return;
    const copy = I18N[this.lang];
    const locale = this.lang === "de" ? "de-CH" : this.lang === "en" ? "en-GB" : "fr-CH";
    const lines = [
      `# ${copy.exportVoiceTitle}`,
      "",
      `${copy.exportDate}: ${new Date().toLocaleString(locale)}`,
      "",
      `_${copy.exportPrivacyNote}_`,
      ""
    ];
    turns.forEach((turn, index) => {
      lines.push(`## ${index + 1}. ${copy.transcriptUser}`, "", turn.user || "-", "");
      lines.push(`### ${copy.transcriptAssistant}`, "", turn.assistant || "-", "");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conversation-assistant-vocal-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  renderSuggestions(questions) {
    const buttons = questions.map((question) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = question;
      button.addEventListener("click", () => this.askText(question));
      return button;
    });
    this.elements.suggestions.replaceChildren(...buttons);
  }

  handleError(error, microphoneError = false) {
    console.error("Voice assistant error", error);
    this.finalizeConversationTurn();
    this.setState("error");
    const rawMessage = String(error?.message || "").toLowerCase();
    if (/429|quota|rate limit/.test(rawMessage)) {
      this.elements.sourceStatus.textContent = I18N[this.lang].liveQuota;
    } else if (/not configured|missing.*key|token error.*503/.test(rawMessage)) {
      this.elements.sourceStatus.textContent = I18N[this.lang].liveNotConfigured;
    } else {
      this.elements.sourceStatus.textContent = I18N[this.lang].liveUnavailable;
    }
    if (microphoneError) this.elements.compatibility.textContent = I18N[this.lang].micUnavailable;
    this.elements.mic.disabled = false;
    this.elements.stopRecording.disabled = true;
    this.recording = false;
  }

  async dispose() {
    // Mark the Live socket as an intentional close before async cleanup starts.
    this.liveClient?.close();
    await this.microphone?.stop();
    await this.audioPlayer?.dispose();
    this.robotRenderer?.dispose();
    this.robotController?.dispose();
  }
}
