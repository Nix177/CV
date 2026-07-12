function decodePcm16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768;
  }
  return samples;
}

export class PcmAudioPlayer {
  constructor({ sampleRate = 24000, onStart, onIdle, onError } = {}) {
    this.sampleRate = sampleRate;
    this.onStart = onStart;
    this.onIdle = onIdle;
    this.onError = onError;
    this.context = null;
    this.gainNode = null;
    this.analyser = null;
    this.activeSources = new Set();
    this.nextStartTime = 0;
    this.volume = 0.8;
    this.muted = false;
    this.playing = false;
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio API is unavailable");
      this.context = new AudioContextClass({ latencyHint: "interactive" });
      this.gainNode = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.18;
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      this.applyVolume();
    }
    if (this.context.state === "suspended" || this.context.state === "interrupted") {
      this.context.resume().catch((error) => this.onError?.(error));
    }
    return this.context;
  }

  async enqueue(base64) {
    if (!base64) return;
    try {
      const context = await this.ensureContext();
      const samples = decodePcm16(base64);
      if (!samples.length) return;

      const buffer = context.createBuffer(1, samples.length, this.sampleRate);
      buffer.copyToChannel(samples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);

      const startAt = Math.max(context.currentTime + 0.025, this.nextStartTime);
      this.nextStartTime = startAt + buffer.duration;
      this.activeSources.add(source);
      if (!this.playing) {
        this.playing = true;
        this.onStart?.();
      }

      source.onended = () => {
        this.activeSources.delete(source);
        source.disconnect();
        if (this.activeSources.size === 0 && this.playing) {
          this.playing = false;
          this.nextStartTime = 0;
          this.onIdle?.();
        }
      };
      source.start(startAt);
    } catch (error) {
      this.onError?.(error);
    }
  }

  setVolume(value) {
    this.volume = Math.min(1, Math.max(0, Number(value) || 0));
    this.applyVolume();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.applyVolume();
  }

  applyVolume() {
    if (!this.gainNode || !this.context) return;
    this.gainNode.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.012);
  }

  getAnalyserNode() {
    return this.analyser;
  }

  interrupt() {
    for (const source of this.activeSources) {
      try { source.stop(); } catch { /* Source may already be stopped. */ }
    }
    this.activeSources.clear();
    this.nextStartTime = 0;
    if (this.playing) {
      this.playing = false;
      this.onIdle?.();
    }
  }

  async dispose() {
    this.interrupt();
    this.gainNode?.disconnect();
    this.analyser?.disconnect();
    await this.context?.close();
  }
}
