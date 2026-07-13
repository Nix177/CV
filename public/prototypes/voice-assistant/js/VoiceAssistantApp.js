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
        if (text.trim()) this.elements.questionEcho.textContent = text.trim();
      },
      onRag: (result) => {
        this.setState("thinking");
        this.elements.sourceStatus.textContent = result.sources?.length
          ? I18N[this.lang].sourceUsed.replace("{sources}", result.sources.join(" + "))
          : I18N[this.lang].noSource;
      },
      onTurnComplete: () => {
        this.turnComplete = true;
        if (!this.audioPlayer.playing && !this.recording) this.setState("idle");
      },
      onInterrupted: () => {
        this.audioPlayer.interrupt();
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

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.elements.reducedMotion.checked = reduced;
    this.robotController?.setReducedMotion(reduced);

    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.addEventListener("click", () => this.changeLanguage(button.dataset.lang));
    });

    window.addEventListener("beforeunload", () => this.dispose(), { once: true });
  }

  async ensureLiveSession() {
    await this.audioPlayer.ensureContext();
    const analyser = this.audioPlayer.getAnalyserNode();
    if (analyser) this.robotController?.connectAssistantAudioNode(analyser);
    await this.liveClient.connect(this.lang);
  }

  async askText(question) {
    this.stopSpeaking();
    if (this.recording) await this.stopRecording(false);
    this.turnComplete = false;
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
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
    });
    this.elements.questionEcho.textContent = copy.questionPlaceholder;
    this.elements.sourceStatus.textContent = this.retriever.ready ? copy.sourceReady : copy.connecting;
    this.renderSuggestions(copy.questions);
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
