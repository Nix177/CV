export class RobotAudioController {
  constructor({ noiseGate = 0.018, gain = 5.2, attack = 0.5, release = 0.16 } = {}) {
    this.noiseGate = noiseGate;
    this.gain = gain;
    this.attack = attack;
    this.release = release;
    this.analyser = null;
    this.samples = null;
    this.level = 0;
    this.manualLevel = null;
    this.createdAnalyser = false;
  }

  connectAudioNode(audioNode) {
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
      this.samples = new Float32Array(this.analyser.fftSize);
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
    }

    target = target ?? 0;
    const smoothing = target > this.level ? this.attack : this.release;
    this.level += (target - this.level) * smoothing;
    if (target === 0 && this.level < 0.003) this.level = 0;
    return this.level;
  }

  dispose() {
    if (this.createdAnalyser) this.analyser?.disconnect();
    this.analyser = null;
    this.samples = null;
  }
}
