function resampleTo16k(input, inputRate) {
  if (inputRate === 16000) return input;
  const ratio = inputRate / 16000;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor];
    output[index] = sum / Math.max(1, end - start);
  }
  return output;
}

function encodePcm16Base64(floatSamples) {
  const bytes = new Uint8Array(floatSamples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < floatSamples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, floatSamples[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }

  let binary = "";
  const step = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += step) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + step));
  }
  return btoa(binary);
}

export class MicrophoneCapture {
  constructor({ onChunk, onError } = {}) {
    this.onChunk = onChunk;
    this.onError = onError;
    this.stream = null;
    this.context = null;
    this.source = null;
    this.worklet = null;
    this.silentGain = null;
    this.active = false;
  }

  async start() {
    if (this.active) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is unavailable");

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.context = new AudioContextClass({ latencyHint: "interactive" });
      await this.context.audioWorklet.addModule("/prototypes/voice-assistant/pcm-capture-worklet.js");
      this.source = this.context.createMediaStreamSource(this.stream);
      this.worklet = new AudioWorkletNode(this.context, "pcm-capture-processor");
      this.silentGain = this.context.createGain();
      this.silentGain.gain.value = 0;
      this.worklet.port.onmessage = (event) => {
        if (!this.active) return;
        const samples = resampleTo16k(event.data, this.context.sampleRate);
        this.onChunk?.(encodePcm16Base64(samples));
      };
      this.source.connect(this.worklet);
      this.worklet.connect(this.silentGain);
      this.silentGain.connect(this.context.destination);
      this.active = true;
    } catch (error) {
      await this.stop();
      this.onError?.(error);
      throw error;
    }
  }

  async stop() {
    this.active = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    this.worklet?.disconnect();
    this.silentGain?.disconnect();
    if (this.context && this.context.state !== "closed") await this.context.close();
    this.stream = null;
    this.context = null;
    this.source = null;
    this.worklet = null;
    this.silentGain = null;
  }
}
