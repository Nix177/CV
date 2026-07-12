const VALID_STATES = new Set(["idle", "listening", "thinking", "speaking", "error"]);

function lerp(current, target, amount) {
  return current + (target - current) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(min, max, value) {
  const normalized = clamp((value - min) / Math.max(0.0001, max - min), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

export class RobotAnimator {
  constructor(robot) {
    this.robot = robot;
    this.parts = robot.parts;
    this.materials = robot.materials;
    this.state = "idle";
    this.pointer = { x: 0, y: 0 };
    this.audioLevel = 0;
    this.speechEnergy = 0;
    this.reducedMotion = false;
    this.elapsed = 0;
    this.nextBlinkAt = 2.8;
    this.blinkStartedAt = -1;
    this.tuning = {
      headScale: 0.82,
      headYaw: 0,
      headPitch: 0,
      jawOpening: 0,
      jawMaxAngle: 0.34,
      mouthGain: 1,
      eyeBrightness: 1,
      leftShoulder: 0,
      rightShoulder: 0,
      leftElbow: 0.12,
      rightElbow: 0.12,
      robotScale: 1,
      materialRoughness: 0.36,
      materialMetalness: 0.42
    };
    this.setTuning({});
  }

  setState(state) {
    if (VALID_STATES.has(state)) this.state = state;
  }

  setPointerTarget(x, y) {
    this.pointer.x = clamp(Number(x) || 0, -1, 1);
    this.pointer.y = clamp(Number(y) || 0, -1, 1);
  }

  setAudioLevel(level) {
    this.audioLevel = clamp(Number(level) || 0, 0, 1);
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
  }

  setTuning(patch) {
    Object.assign(this.tuning, patch);
    const scale = this.tuning.robotScale;
    this.parts.robotRoot.scale.setScalar(scale);
    this.parts.headPitch.scale.setScalar(this.tuning.headScale);
    this.materials.setSurfaceTuning({
      roughness: this.tuning.materialRoughness,
      metalness: this.tuning.materialMetalness
    });
  }

  getTuning() {
    return { ...this.tuning };
  }

  update(delta, elapsed) {
    this.elapsed = elapsed;
    const motion = this.reducedMotion ? 0.22 : 1;
    const transition = 1 - Math.pow(0.001, Math.max(0.001, delta));
    const { parts } = this;

    const targetSpeechEnergy = this.state === "speaking"
      ? smoothstep(0.025, 0.36, this.audioLevel)
      : 0;
    const energyRate = targetSpeechEnergy > this.speechEnergy ? 11 : 3.8;
    this.speechEnergy = lerp(
      this.speechEnergy,
      targetSpeechEnergy,
      1 - Math.exp(-delta * energyRate)
    );

    let stateYaw = 0;
    let statePitch = 0;
    let eyeIntensity = 1.25;
    let chestIntensity = 0.78;
    let statusColor = 0x55cfe5;
    let torsoLean = Math.sin(elapsed * 0.48) * 0.006 * motion;
    let jawTarget = 0;
    let leftShoulderX = -0.045 + this.tuning.leftShoulder;
    let rightShoulderX = -0.045 + this.tuning.rightShoulder;
    let leftShoulderZ = 0.09;
    let rightShoulderZ = -0.09;
    let leftElbow = this.tuning.leftElbow;
    let rightElbow = this.tuning.rightElbow;
    let leftWristZ = 0;
    let rightWristZ = 0;

    if (this.state === "listening") {
      statePitch = 0.105;
      eyeIntensity = 2.25;
      chestIntensity = 1.15;
      leftShoulderX -= 0.025;
      rightShoulderX -= 0.025;
    } else if (this.state === "thinking") {
      const thoughtPulse = 0.5 + Math.sin(elapsed * 0.82) * 0.5;
      stateYaw = Math.sin(elapsed * 0.72) * 0.1 * motion;
      statePitch = -0.045 + Math.sin(elapsed * 0.95) * 0.022 * motion;
      eyeIntensity = 1.35 + Math.sin(elapsed * 2) * 0.3;
      chestIntensity = 0.9 + Math.sin(elapsed * 2.4) * 0.55;
      rightShoulderX -= thoughtPulse * 0.055 * motion;
      rightElbow += thoughtPulse * 0.12 * motion;
      statusColor = 0xd6a65e;
    } else if (this.state === "speaking") {
      const phrasePhase = elapsed * 1.18;
      const rightGesture = Math.pow(Math.max(0, Math.sin(phrasePhase)), 2) * this.speechEnergy * motion;
      const leftGesture = Math.pow(Math.max(0, -Math.sin(phrasePhase)), 2) * this.speechEnergy * motion * 0.72;

      stateYaw = Math.sin(elapsed * 0.7) * 0.025 * this.speechEnergy * motion;
      statePitch = (
        -0.012
        + Math.sin(elapsed * 2.25) * 0.025
        + Math.sin(elapsed * 5.1) * 0.006 * this.audioLevel
      ) * this.speechEnergy * motion;
      eyeIntensity = 1.8 + this.speechEnergy * 0.65;
      chestIntensity = 1.05 + this.speechEnergy * 0.95;
      torsoLean += (rightGesture - leftGesture) * 0.012;
      jawTarget = Math.max(this.audioLevel * 0.38, this.tuning.jawOpening);

      rightShoulderX -= rightGesture * 0.24;
      leftShoulderX -= leftGesture * 0.2;
      rightShoulderZ -= rightGesture * 0.055;
      leftShoulderZ += leftGesture * 0.045;
      rightElbow += rightGesture * 0.5;
      leftElbow += leftGesture * 0.42;
      rightWristZ = rightGesture * 0.1;
      leftWristZ = -leftGesture * 0.08;
    } else if (this.state === "error") {
      statePitch = 0.075;
      eyeIntensity = 1.1;
      chestIntensity = 0.75;
      statusColor = 0xdf785e;
    }

    const bodyMotion = this.state === "listening" ? 0.35 : 1;
    const idleBreath = Math.sin(elapsed * 1.18) * 0.012 * motion * bodyMotion;
    parts.torsoRoot.position.y = lerp(parts.torsoRoot.position.y, idleBreath, transition * 0.28);
    parts.torsoRoot.rotation.z = lerp(parts.torsoRoot.rotation.z, torsoLean, transition * 0.25);

    const pointerYaw = this.pointer.x * 0.15 * motion;
    const pointerPitch = -this.pointer.y * 0.09 * motion;
    parts.headYaw.rotation.y = lerp(
      parts.headYaw.rotation.y,
      pointerYaw + stateYaw + this.tuning.headYaw,
      transition * 0.5
    );
    parts.headPitch.rotation.x = lerp(
      parts.headPitch.rotation.x,
      pointerPitch + statePitch + this.tuning.headPitch,
      transition * 0.46
    );

    const jawAngle = clamp(jawTarget, 0, 1) * this.tuning.jawMaxAngle;
    parts.jawPivot.rotation.x = lerp(
      parts.jawPivot.rotation.x,
      jawAngle,
      transition * (jawAngle > parts.jawPivot.rotation.x ? 0.88 : 0.42)
    );

    parts.leftShoulderPivot.rotation.x = lerp(parts.leftShoulderPivot.rotation.x, leftShoulderX, transition * 0.3);
    parts.rightShoulderPivot.rotation.x = lerp(parts.rightShoulderPivot.rotation.x, rightShoulderX, transition * 0.3);
    parts.leftShoulderPivot.rotation.z = lerp(parts.leftShoulderPivot.rotation.z, leftShoulderZ, transition * 0.26);
    parts.rightShoulderPivot.rotation.z = lerp(parts.rightShoulderPivot.rotation.z, rightShoulderZ, transition * 0.26);
    parts.leftElbowPivot.rotation.x = lerp(parts.leftElbowPivot.rotation.x, leftElbow, transition * 0.34);
    parts.rightElbowPivot.rotation.x = lerp(parts.rightElbowPivot.rotation.x, rightElbow, transition * 0.34);
    parts.leftWristPivot.rotation.z = lerp(parts.leftWristPivot.rotation.z, leftWristZ, transition * 0.3);
    parts.rightWristPivot.rotation.z = lerp(parts.rightWristPivot.rotation.z, rightWristZ, transition * 0.3);

    this.materials.setStatusColor(statusColor, eyeIntensity * this.tuning.eyeBrightness);
    this.materials.chestGlow.emissiveIntensity = chestIntensity * this.tuning.eyeBrightness;
    this.updateMouthWave(elapsed, transition);
    this.updateBlink(elapsed, motion);
  }

  updateMouthWave(elapsed, transition) {
    const bars = this.parts.mouthWaveBars || [];
    const center = (bars.length - 1) / 2;
    let glow = 0.42;

    for (let index = 0; index < bars.length; index += 1) {
      const distance = center > 0 ? Math.abs(index - center) / center : 0;
      let targetHeight = 0.012;

      if (this.state === "speaking") {
        const wave = 0.35 + Math.abs(Math.sin(elapsed * 10.5 + index * 0.82)) * 0.65;
        const faceShape = 1 - distance * 0.22;
        targetHeight += this.speechEnergy * (0.018 + wave * 0.052) * faceShape * this.tuning.mouthGain;
        glow = 0.55 + this.speechEnergy * 1.85;
      } else if (this.state === "listening") {
        targetHeight = 0.014 + (0.5 + Math.sin(elapsed * 3.2 + index * 0.36) * 0.5) * 0.007;
        glow = 0.85;
      } else if (this.state === "thinking") {
        targetHeight = 0.013 + (0.5 + Math.sin(elapsed * 4.1 - index * 0.58) * 0.5) * 0.009;
        glow = 0.72;
      }

      bars[index].scale.y = lerp(bars[index].scale.y, targetHeight, transition * 0.78);
    }

    this.materials.mouthGlow.emissiveIntensity = glow * this.tuning.eyeBrightness;
  }

  updateBlink(elapsed, motion) {
    if (this.state === "error" || motion < 0.5) {
      this.setShutterAmount(0);
      return;
    }

    if (elapsed >= this.nextBlinkAt && this.blinkStartedAt < 0) {
      this.blinkStartedAt = elapsed;
      this.nextBlinkAt = elapsed + 3.2 + Math.random() * 3.7;
    }

    if (this.blinkStartedAt >= 0) {
      const progress = (elapsed - this.blinkStartedAt) / 0.18;
      const amount = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      this.setShutterAmount(clamp(amount, 0, 1));
      if (progress >= 1) this.blinkStartedAt = -1;
    } else {
      this.setShutterAmount(0);
    }
  }

  setShutterAmount(amount) {
    for (const shutter of [this.parts.leftEyeShutter, this.parts.rightEyeShutter]) {
      const openY = shutter.userData.openY || 0.145;
      if (shutter.children[0]) shutter.children[0].position.y = lerp(openY, 0.045, amount);
      if (shutter.children[1]) shutter.children[1].position.y = lerp(-openY, -0.045, amount);
    }
  }
}
