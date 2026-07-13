export class RobotAudioController {
  constructor({ noiseGate = 0.018, gain = 5.2, attack = 0.5, release = 0.16 } = {}) {
    this.noiseGate = noiseGate;
    this.gain = gain;
    this.attack = attack;
    this.release = release;
    this.analyser = null;
    this.samples = null;
    this.frequencySamples = null;
    this.spectrum = new Float32Array(13);
    this.level = 0;
    this.manualLevel = null;
    this.manualPhase = 0;
    this.createdAnalyser = false;
  }

  connectAssistantAudioNode(audioNode) {
    if (!audioNode) return;

    if (typeof audioNode.getFloatTimeDomainData === "function") {
      this.analyser = audioNode;
      this.createdAnalyser = false;
    } else if (audioNode.context?.createAnalyser) {
      this.analyser = audioNode.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;
      audioNode.connect(this.analyser);
      this.createdAnalyser = true;
    }

    if (this.analyser) {
      this.analyser.fftSize = Math.max(256, this.analyser.fftSize || 512);
      this.analyser.smoothingTimeConstant = 0.24;
      this.samples = new Float32Array(this.analyser.fftSize);
      this.frequencySamples = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  setAudioLevel(level) {
    this.manualLevel = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : null;
  }

  update() {
    let target = this.manualLevel;

    if (target == null && this.analyser && this.samples) {
      this.analyser.getFloatTimeDomainData(this.samples);
      let sum = 0;
      for (let index = 0; index < this.samples.length; index += 1) {
        sum += this.samples[index] * this.samples[index];
      }
      const rms = Math.sqrt(sum / this.samples.length);
      target = rms <= this.noiseGate ? 0 : Math.min(1, (rms - this.noiseGate) * this.gain);
      this.updateSpectrumFromAnalyser(target);
    } else if (target != null) {
      this.updateManualSpectrum(target);
    } else {
      this.decaySpectrum();
    }

    target = target ?? 0;
    const smoothing = target > this.level ? this.attack : this.release;
    this.level += (target - this.level) * smoothing;
    if (target === 0 && this.level < 0.003) this.level = 0;
    return this.level;
  }

  getSpectrum() {
    return this.spectrum;
  }

  updateSpectrumFromAnalyser(level) {
    if (!this.frequencySamples || typeof this.analyser?.getByteFrequencyData !== "function") {
      this.decaySpectrum();
      return;
    }

    this.analyser.getByteFrequencyData(this.frequencySamples);
    const sampleRate = this.analyser.context?.sampleRate || 48000;
    const nyquist = sampleRate * 0.5;
    const minFrequency = 90;
    const maxFrequency = Math.min(5200, nyquist * 0.82);

    for (let index = 0; index < this.spectrum.length; index += 1) {
      const startRatio = index / this.spectrum.length;
      const endRatio = (index + 1) / this.spectrum.length;
      const startFrequency = minFrequency * Math.pow(maxFrequency / minFrequency, startRatio);
      const endFrequency = minFrequency * Math.pow(maxFrequency / minFrequency, endRatio);
      const startBin = Math.max(1, Math.floor(startFrequency / nyquist * this.frequencySamples.length));
      const endBin = Math.max(startBin + 1, Math.ceil(endFrequency / nyquist * this.frequencySamples.length));
      let total = 0;
      let count = 0;
      for (let bin = startBin; bin < Math.min(endBin, this.frequencySamples.length); bin += 1) {
        total += this.frequencySamples[bin];
        count += 1;
      }
      const average = count ? total / count / 255 : 0;
      const lowFrequencyEmphasis = index < 5 ? 1.12 - index * 0.025 : 1;
      const target = level > 0
        ? Math.min(1, Math.pow(average, 0.72) * lowFrequencyEmphasis)
        : 0;
      const smoothing = target > this.spectrum[index] ? 0.44 : 0.14;
      this.spectrum[index] += (target - this.spectrum[index]) * smoothing;
    }
  }

  updateManualSpectrum(level) {
    this.manualPhase += 0.19;
    for (let index = 0; index < this.spectrum.length; index += 1) {
      const contour = 0.48
        + Math.sin(this.manualPhase + index * 0.71) * 0.22
        + Math.sin(this.manualPhase * 0.57 - index * 1.13) * 0.12;
      const target = Math.max(0, Math.min(1, contour * level * 1.45));
      const smoothing = target > this.spectrum[index] ? 0.42 : 0.13;
      this.spectrum[index] += (target - this.spectrum[index]) * smoothing;
    }
  }

  decaySpectrum() {
    for (let index = 0; index < this.spectrum.length; index += 1) {
      this.spectrum[index] *= 0.84;
      if (this.spectrum[index] < 0.002) this.spectrum[index] = 0;
    }
  }

  dispose() {
    if (this.createdAnalyser) this.analyser?.disconnect();
    this.analyser = null;
    this.samples = null;
    this.frequencySamples = null;
    this.spectrum.fill(0);
  }
}
