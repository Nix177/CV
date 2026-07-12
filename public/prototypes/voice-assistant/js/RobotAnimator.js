const VALID_STATES = new Set(["idle", "listening", "thinking", "speaking", "error"]);

function lerp(current, target, amount) {
  return current + (target - current) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class RobotAnimator {
  constructor(robot) {
    this.robot = robot;
    this.parts = robot.parts;
    this.materials = robot.materials;
    this.state = "idle";
    this.pointer = { x: 0, y: 0 };
    this.audioLevel = 0;
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
    const motion = this.reducedMotion ? 0.2 : 1;
    const transition = 1 - Math.pow(0.001, Math.max(0.001, delta));
    const { parts } = this;

    const idleBreath = Math.sin(elapsed * 1.18) * 0.012 * motion;
    const speakingNod = this.state === "speaking" ? Math.sin(elapsed * 3.2) * 0.016 * motion : 0;
    parts.torsoRoot.position.y = lerp(parts.torsoRoot.position.y, idleBreath, transition * 0.28);
    parts.torsoRoot.rotation.z = lerp(parts.torsoRoot.rotation.z, Math.sin(elapsed * 0.48) * 0.006 * motion, transition * 0.2);

    let stateYaw = 0;
    let statePitch = 0;
    let eyeIntensity = 1.25;
    let chestIntensity = 0.78;
    let shoulderLift = 0;
    let jawTarget = 0;
    let statusColor = 0x55cfe5;

    if (this.state === "listening") {
      statePitch = 0.105;
      eyeIntensity = 2.25;
      chestIntensity = 1.15;
      shoulderLift = 0.025;
    } else if (this.state === "thinking") {
      stateYaw = Math.sin(elapsed * 0.72) * 0.13 * motion;
      statePitch = -0.045 + Math.sin(elapsed * 0.95) * 0.025 * motion;
      eyeIntensity = 1.35 + Math.sin(elapsed * 2) * 0.3;
      chestIntensity = 0.9 + Math.sin(elapsed * 2.4) * 0.55;
      shoulderLift = 0.055;
      statusColor = 0xd6a65e;
    } else if (this.state === "speaking") {
      statePitch = speakingNod;
      eyeIntensity = 2.0;
      chestIntensity = 1.25 + this.audioLevel * 0.7;
      shoulderLift = Math.sin(elapsed * 1.8) * 0.045 * motion;
      jawTarget = Math.max(this.audioLevel, this.tuning.jawOpening);
    } else if (this.state === "error") {
      statePitch = 0.075;
      eyeIntensity = 1.1;
      chestIntensity = 0.75;
      statusColor = 0xdf785e;
    }

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
    parts.jawPivot.rotation.x = lerp(parts.jawPivot.rotation.x, jawAngle, transition * (jawAngle > parts.jawPivot.rotation.x ? 0.92 : 0.48));

    parts.leftShoulderPivot.rotation.x = lerp(
      parts.leftShoulderPivot.rotation.x,
      -0.045 - shoulderLift + this.tuning.leftShoulder,
      transition * 0.3
    );
    parts.rightShoulderPivot.rotation.x = lerp(
      parts.rightShoulderPivot.rotation.x,
      -0.045 + shoulderLift + this.tuning.rightShoulder,
      transition * 0.3
    );
    parts.leftElbowPivot.rotation.x = lerp(parts.leftElbowPivot.rotation.x, this.tuning.leftElbow, transition * 0.3);
    parts.rightElbowPivot.rotation.x = lerp(parts.rightElbowPivot.rotation.x, this.tuning.rightElbow, transition * 0.3);

    this.materials.setStatusColor(statusColor, eyeIntensity * this.tuning.eyeBrightness);
    this.materials.chestGlow.emissiveIntensity = chestIntensity * this.tuning.eyeBrightness;
    this.updateBlink(elapsed, motion);
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
