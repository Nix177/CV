const VALID_STATES = new Set(["idle", "listening", "thinking", "speaking", "error"]);

const SPEECH_GESTURES = Object.freeze([
  Object.freeze({
    name: "speaking_neutral",
    timing: Object.freeze({ rise: 0.48, hold: 0.58, return: 0.82 }),
    headYaw: 0.012,
    headPitch: -0.012,
    leftShoulderX: -0.05,
    rightShoulderX: -0.05,
    leftShoulderZ: 0.025,
    rightShoulderZ: -0.025,
    leftElbow: 0.08,
    rightElbow: 0.08,
    leftElbowZ: -0.2,
    rightElbowZ: 0.2,
    leftWrist: -0.03,
    rightWrist: 0.03,
    leftFingers: 0.1,
    rightFingers: 0.1
  }),
  Object.freeze({
    name: "explain_right",
    timing: Object.freeze({ rise: 0.52, hold: 0.68, return: 0.88 }),
    headYaw: 0.026,
    headPitch: -0.018,
    leftShoulderX: -0.025,
    rightShoulderX: -0.12,
    leftShoulderZ: 0.015,
    rightShoulderZ: -0.12,
    leftElbow: 0.06,
    rightElbow: 0.13,
    leftElbowZ: -0.08,
    rightElbowZ: 2.02,
    leftWrist: -0.02,
    rightWrist: 0.18,
    leftFingers: 0.08,
    rightFingers: 0.2
  }),
  Object.freeze({
    name: "explain_left",
    timing: Object.freeze({ rise: 0.52, hold: 0.68, return: 0.88 }),
    headYaw: -0.026,
    headPitch: -0.012,
    leftShoulderX: -0.12,
    rightShoulderX: -0.025,
    leftShoulderZ: 0.12,
    rightShoulderZ: -0.015,
    leftElbow: 0.13,
    rightElbow: 0.06,
    leftElbowZ: -2.02,
    rightElbowZ: 0.08,
    leftWrist: -0.18,
    rightWrist: 0.02,
    leftFingers: 0.2,
    rightFingers: 0.08
  }),
  Object.freeze({
    name: "explain_two_hands",
    timing: Object.freeze({ rise: 0.58, hold: 0.72, return: 0.94 }),
    headYaw: 0,
    headPitch: -0.022,
    leftShoulderX: -0.09,
    rightShoulderX: -0.09,
    leftShoulderZ: 0.12,
    rightShoulderZ: -0.11,
    leftElbow: 0.14,
    rightElbow: 0.14,
    leftElbowZ: -2.05,
    rightElbowZ: 1.48,
    leftWrist: -0.2,
    rightWrist: 0.08,
    leftFingers: 0.16,
    rightFingers: 0.2
  }),
  Object.freeze({
    name: "emphasis",
    timing: Object.freeze({ rise: 0.4, hold: 0.42, return: 0.92 }),
    headYaw: 0.018,
    headPitch: -0.035,
    leftShoulderX: -0.03,
    rightShoulderX: -0.14,
    leftShoulderZ: 0.01,
    rightShoulderZ: -0.1,
    leftElbow: 0.05,
    rightElbow: 0.12,
    leftElbowZ: -0.05,
    rightElbowZ: 2.32,
    leftWrist: -0.02,
    rightWrist: 0.24,
    leftFingers: 0.08,
    rightFingers: 0.13
  }),
  Object.freeze({
    name: "present_information",
    timing: Object.freeze({ rise: 0.5, hold: 0.74, return: 0.9 }),
    headYaw: -0.018,
    headPitch: 0.004,
    leftShoulderX: -0.1,
    rightShoulderX: -0.04,
    leftShoulderZ: 0.1,
    rightShoulderZ: -0.02,
    leftElbow: 0.11,
    rightElbow: 0.07,
    leftElbowZ: -1.82,
    rightElbowZ: 0.32,
    leftWrist: -0.25,
    rightWrist: 0.04,
    leftFingers: 0.12,
    rightFingers: 0.09
  }),
  Object.freeze({
    name: "acknowledge",
    timing: Object.freeze({ rise: 0.34, hold: 0.34, return: 0.68 }),
    headYaw: 0.012,
    headPitch: 0.055,
    leftShoulderX: -0.025,
    rightShoulderX: -0.025,
    leftShoulderZ: 0.01,
    rightShoulderZ: -0.01,
    leftElbow: 0.07,
    rightElbow: 0.07,
    leftElbowZ: -0.12,
    rightElbowZ: 0.12,
    leftWrist: -0.02,
    rightWrist: 0.02,
    leftFingers: 0.1,
    rightFingers: 0.1
  })
]);

const SPEECH_GESTURES_BY_NAME = new Map(SPEECH_GESTURES.map((gesture) => [gesture.name, gesture]));

const IDLE_ACTIONS = Object.freeze([
  Object.freeze({
    name: "look_left",
    timing: Object.freeze({ rise: 0.52, hold: 0.62, return: 0.68 }),
    headYaw: -0.12,
    headPitch: -0.006,
    eyeX: -0.024,
    eyeY: 0.003,
    leftShoulderX: -0.004,
    rightShoulderX: 0.002,
    leftShoulderZ: 0.003,
    rightShoulderZ: 0.001,
    torsoLean: -0.002
  }),
  Object.freeze({
    name: "look_right",
    timing: Object.freeze({ rise: 0.48, hold: 0.58, return: 0.72 }),
    headYaw: 0.115,
    headPitch: 0.004,
    eyeX: 0.023,
    eyeY: 0.002,
    leftShoulderX: 0.002,
    rightShoulderX: -0.004,
    leftShoulderZ: -0.001,
    rightShoulderZ: -0.003,
    torsoLean: 0.002
  }),
  Object.freeze({
    name: "shoulder_roll",
    timing: Object.freeze({ rise: 0.55, hold: 0.24, return: 0.82 }),
    headYaw: -0.018,
    headPitch: -0.012,
    eyeX: -0.004,
    eyeY: 0.002,
    leftShoulderX: -0.026,
    rightShoulderX: 0.006,
    leftShoulderZ: 0.024,
    rightShoulderZ: 0.004,
    torsoLean: -0.004
  }),
  Object.freeze({
    name: "check_left_fingers",
    timing: Object.freeze({ rise: 0.74, hold: 0.9, return: 0.92 }),
    headYaw: -0.062,
    headPitch: 0.025,
    eyeX: -0.015,
    eyeY: -0.004,
    leftShoulderX: -0.074,
    rightShoulderX: -0.004,
    leftShoulderZ: 0.068,
    rightShoulderZ: -0.002,
    leftElbow: 0.1,
    rightElbow: 0.01,
    leftElbowZ: -1.48,
    rightElbowZ: 0,
    leftWrist: -0.2,
    rightWrist: 0,
    leftFingers: 0.15,
    rightFingers: 0.08,
    torsoLean: -0.005
  }),
  Object.freeze({
    name: "touch_chin",
    timing: Object.freeze({ rise: 0.78, hold: 0.76, return: 0.96 }),
    headYaw: 0.022,
    headPitch: 0.05,
    eyeX: 0.007,
    eyeY: -0.005,
    leftShoulderX: -0.004,
    rightShoulderX: -0.1,
    leftShoulderZ: 0.002,
    rightShoulderZ: -0.088,
    leftElbow: 0.01,
    rightElbow: 0.1,
    leftElbowZ: 0,
    rightElbowZ: 2.22,
    leftWrist: 0,
    rightWrist: 0.27,
    leftFingers: 0.08,
    rightFingers: 0.25,
    torsoLean: 0.006
  }),
  Object.freeze({
    name: "touch_right_cheek",
    timing: Object.freeze({ rise: 0.82, hold: 0.68, return: 1 }),
    headYaw: 0.045,
    headPitch: 0.012,
    eyeX: 0.013,
    eyeY: 0.003,
    leftShoulderX: -0.003,
    rightShoulderX: -0.112,
    leftShoulderZ: 0.002,
    rightShoulderZ: -0.102,
    leftElbow: 0.01,
    rightElbow: 0.09,
    leftElbowZ: 0,
    rightElbowZ: 2.38,
    leftWrist: 0,
    rightWrist: 0.31,
    leftFingers: 0.08,
    rightFingers: 0.22,
    torsoLean: 0.006
  })
]);

const IDLE_ACTION_DELAY = Object.freeze({ min: 12, max: 26 });
const IDLE_INTERACTION_DELAY = Object.freeze({ min: 8, max: 16 });

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

function easeInOutCubic(value) {
  const amount = clamp(value, 0, 1);
  return amount < 0.5
    ? 4 * amount * amount * amount
    : 1 - Math.pow(-2 * amount + 2, 3) / 2;
}

function stagedGestureAmount(age, delay, timing) {
  const localAge = age - delay;
  if (localAge <= 0) return 0;
  if (localAge < timing.rise) return easeInOutCubic(localAge / timing.rise);
  if (localAge < timing.rise + timing.hold) return 1;
  const returnAge = localAge - timing.rise - timing.hold;
  if (returnAge < timing.return) return 1 - easeInOutCubic(returnAge / timing.return);
  return 0;
}

export class RobotAnimator {
  constructor(robot) {
    this.robot = robot;
    this.parts = robot.parts;
    this.materials = robot.materials;
    this.profile = {
      headScale: 0.88,
      mouthAmplitude: 0.082,
      eyeMotionScale: 1,
      bodyMotionAmplitude: 0.012,
      gestureScale: 1,
      statusColors: {
        idle: 0x55cfe5,
        listening: 0x55cfe5,
        thinking: 0xd1a15b,
        speaking: 0x55cfe5,
        error: 0xb7792d
      },
      ...robot.animationProfile,
      statusColors: {
        idle: 0x55cfe5,
        listening: 0x55cfe5,
        thinking: 0xd1a15b,
        speaking: 0x55cfe5,
        error: 0xb7792d,
        ...robot.animationProfile?.statusColors
      }
    };
    this.state = "idle";
    this.previousState = "idle";
    this.pointer = { x: 0, y: 0 };
    this.audioLevel = 0;
    this.audioSpectrum = new Float32Array(this.parts.mouthWaveX?.length || 0);
    this.speechEnergy = 0;
    this.reducedMotion = false;
    this.elapsed = 0;
    this.activeGesture = null;
    this.activeGestureStartedAt = 0;
    this.activeGestureIntensity = 1;
    this.nextGestureAt = 0;
    this.gestureCursor = Math.floor(Math.random() * SPEECH_GESTURES.length);
    this.forcedGestureName = "";
    this.activeIdleAction = null;
    this.idleActionStartedAt = -1;
    this.lastIdleActionName = "";
    this.nextIdleActionAt = 7 + Math.random() * 7;
    this.idleMotionPhase = {
      head: Math.random() * Math.PI * 2,
      eyes: Math.random() * Math.PI * 2,
      leftShoulder: Math.random() * Math.PI * 2,
      rightShoulder: Math.random() * Math.PI * 2,
      wrists: Math.random() * Math.PI * 2
    };
    this.returnToIdleStartedAt = -1;
    this.nextBlinkAt = 1.8 + Math.random() * 2.4;
    this.blinkStartedAt = -1;
    this.wavePoints = new Float32Array(this.parts.mouthWaveX?.length || 0);
    this.eyeBasePositions = {
      left: { x: this.parts.leftEye.position.x, y: this.parts.leftEye.position.y },
      right: { x: this.parts.rightEye.position.x, y: this.parts.rightEye.position.y }
    };
    this.eyeOpenScaleY = {
      left: this.parts.leftEyeLight.scale.y,
      right: this.parts.rightEyeLight.scale.y
    };
    this.torsoBaseY = this.parts.torsoRoot.position.y;
    this.torsoBaseRotation = {
      x: this.parts.torsoRoot.rotation.x,
      y: this.parts.torsoRoot.rotation.y,
      z: this.parts.torsoRoot.rotation.z
    };
    this.waveSegmentBase = (this.parts.mouthWaveSegments || []).map((segment) => ({
      x: segment.position.x,
      y: segment.position.y,
      z: segment.position.z,
      scaleX: segment.scale.x,
      scaleY: segment.scale.y,
      rotationZ: segment.rotation.z
    }));
    this.tuning = {
      headScale: this.profile.headScale,
      headYaw: 0,
      headPitch: 0,
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
    if (!VALID_STATES.has(state) || state === this.state) return;
    this.previousState = this.state;
    if (state === "idle" && this.state === "speaking") {
      this.interruptIdleAction(false);
      this.state = "returning_to_idle";
      this.returnToIdleStartedAt = this.elapsed;
      this.activeGesture = null;
      this.activeGestureIntensity = 1;
      this.forcedGestureName = "";
      return;
    }
    this.state = state;
    if (state === "speaking") {
      this.interruptIdleAction(false);
      this.activeGesture = null;
      this.activeGestureIntensity = 1;
      this.nextGestureAt = this.elapsed + 0.55;
    } else if (state === "idle") {
      this.interruptIdleAction(true);
    } else {
      this.interruptIdleAction(false);
      this.activeGesture = null;
      this.forcedGestureName = "";
    }
  }

  setPointerTarget(x, y) {
    const nextX = clamp(Number(x) || 0, -1, 1);
    const nextY = clamp(Number(y) || 0, -1, 1);
    if (Math.hypot(nextX - this.pointer.x, nextY - this.pointer.y) > 0.025) {
      this.notifyInteraction();
    }
    this.pointer.x = nextX;
    this.pointer.y = nextY;
  }

  notifyInteraction() {
    if (this.state === "idle" || this.state === "returning_to_idle") {
      this.interruptIdleAction(true);
    }
  }

  interruptIdleAction(withCooldown) {
    this.activeIdleAction = null;
    this.idleActionStartedAt = -1;
    if (withCooldown) {
      this.scheduleNextIdleAction(IDLE_INTERACTION_DELAY.min, IDLE_INTERACTION_DELAY.max);
    } else {
      this.nextIdleActionAt = Number.POSITIVE_INFINITY;
    }
  }

  scheduleNextIdleAction(minDelay = IDLE_ACTION_DELAY.min, maxDelay = IDLE_ACTION_DELAY.max) {
    this.nextIdleActionAt = this.elapsed + minDelay + Math.random() * (maxDelay - minDelay);
  }

  updateIdleAction(elapsed) {
    if (this.state !== "idle") return null;
    if (!this.activeIdleAction && elapsed >= this.nextIdleActionAt) {
      const choices = IDLE_ACTIONS.filter((action) => action.name !== this.lastIdleActionName);
      this.activeIdleAction = choices[Math.floor(Math.random() * choices.length)] || IDLE_ACTIONS[0];
      this.idleActionStartedAt = elapsed;
    }
    if (!this.activeIdleAction) return null;

    const age = Math.max(0, elapsed - this.idleActionStartedAt);
    const timing = this.activeIdleAction.timing;
    const totalDuration = timing.rise + timing.hold + timing.return + 0.28;
    if (age >= totalDuration) {
      this.lastIdleActionName = this.activeIdleAction.name;
      this.activeIdleAction = null;
      this.idleActionStartedAt = -1;
      this.scheduleNextIdleAction();
      return null;
    }
    return { action: this.activeIdleAction, age };
  }

  getCurrentIdleActionName() {
    return this.activeIdleAction?.name || "none";
  }

  getIdleActionNames() {
    return IDLE_ACTIONS.map((action) => action.name);
  }

  previewIdleAction(name) {
    const action = IDLE_ACTIONS.find((candidate) => candidate.name === name);
    if (!action) {
      this.interruptIdleAction(true);
      return;
    }
    this.state = "idle";
    this.activeGesture = null;
    this.forcedGestureName = "";
    this.activeIdleAction = action;
    this.idleActionStartedAt = this.elapsed;
    this.nextIdleActionAt = Number.POSITIVE_INFINITY;
  }

  setAudioLevel(level) {
    this.audioLevel = clamp(Number(level) || 0, 0, 1);
  }

  setAudioSpectrum(values) {
    if (!values?.length || this.audioSpectrum.length === 0) return;
    for (let index = 0; index < this.audioSpectrum.length; index += 1) {
      const sourceIndex = Math.round(index / Math.max(1, this.audioSpectrum.length - 1) * (values.length - 1));
      this.audioSpectrum[index] = clamp(Number(values[sourceIndex]) || 0, 0, 1);
    }
  }

  previewGesture(name) {
    this.forcedGestureName = SPEECH_GESTURES_BY_NAME.has(name) ? name : "";
    this.activeGesture = null;
    if (this.forcedGestureName) this.state = "speaking";
  }

  getGestureNames() {
    return SPEECH_GESTURES.map((gesture) => gesture.name);
  }

  getCurrentGestureName() {
    return this.forcedGestureName || this.activeGesture?.name || "return_to_rest";
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
  }

  setTuning(patch) {
    Object.assign(this.tuning, patch);
    this.parts.robotRoot.scale.setScalar(this.tuning.robotScale);
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
    if (this.state === "returning_to_idle" && elapsed - this.returnToIdleStartedAt >= 1.05) {
      this.previousState = "returning_to_idle";
      this.state = "idle";
      this.returnToIdleStartedAt = -1;
      if (!Number.isFinite(this.nextIdleActionAt)) this.scheduleNextIdleAction(7, 14);
    }
    const motion = this.reducedMotion ? 0.22 : 1;
    const transition = 1 - Math.pow(0.001, Math.max(0.001, delta));
    const { parts } = this;

    const targetSpeechEnergy = this.state === "speaking"
      ? smoothstep(0.018, 0.34, this.audioLevel)
      : 0;
    const energyRate = targetSpeechEnergy > this.speechEnergy ? 12 : 3.6;
    this.speechEnergy = lerp(
      this.speechEnergy,
      targetSpeechEnergy,
      1 - Math.exp(-delta * energyRate)
    );
    const idleActionFrame = this.updateIdleAction(elapsed);

    let stateYaw = 0;
    let statePitch = 0;
    let eyeOffsetX = 0;
    let eyeOffsetY = 0;
    let eyeIntensity = 0.95;
    let chestIntensity = 0.72;
    let statusColor = this.profile.statusColors.idle;
    let torsoLean = Math.sin(elapsed * 0.48) * 0.006 * motion;
    let torsoTurn = Math.sin(elapsed * 0.19 + this.idleMotionPhase.head) * 0.0035 * motion;
    let torsoPitch = Math.sin(elapsed * 0.16 + this.idleMotionPhase.leftShoulder) * 0.0025 * motion;
    let leftShoulderX = -0.052 + this.tuning.leftShoulder;
    let rightShoulderX = -0.042 + this.tuning.rightShoulder;
    let leftShoulderZ = 0.045;
    let rightShoulderZ = -0.035;
    let leftElbow = this.tuning.leftElbow + 0.035;
    let rightElbow = this.tuning.rightElbow + 0.012;
    let leftElbowZ = -0.028;
    let rightElbowZ = 0.018;
    let leftWristZ = -0.022;
    let rightWristZ = 0.016;
    let leftFingerCurl = 0.1;
    let rightFingerCurl = 0.08;

    if (this.state === "idle" || this.state === "returning_to_idle") {
      const idleBlend = this.state === "returning_to_idle"
        ? smoothstep(0, 1.05, elapsed - this.returnToIdleStartedAt)
        : 1;
      const returnAge = this.state === "returning_to_idle"
        ? Math.max(0, elapsed - this.returnToIdleStartedAt)
        : 0;
      const shoulderSettle = this.state === "returning_to_idle"
        ? Math.exp(-returnAge * 3.2) * Math.sin(returnAge * 8.2) * motion
        : 0;
      stateYaw = (
        Math.sin(elapsed * 0.23 + this.idleMotionPhase.head) * 0.014
        + Math.sin(elapsed * 0.071 + 1.4 + this.idleMotionPhase.head * 0.37) * 0.008
      ) * motion * idleBlend;
      statePitch = Math.sin(elapsed * 0.17 + 0.8 + this.idleMotionPhase.head) * 0.009 * motion * idleBlend;
      eyeOffsetX = Math.sin(elapsed * 0.31 + 0.45 + this.idleMotionPhase.eyes) * 0.005 * motion * idleBlend;
      eyeOffsetY = Math.sin(elapsed * 0.19 + this.idleMotionPhase.eyes * 0.61) * 0.0025 * motion * idleBlend;
      leftShoulderX += Math.sin(elapsed * 0.21 + 0.2 + this.idleMotionPhase.leftShoulder) * 0.005 * motion * idleBlend
        + shoulderSettle * 0.009;
      rightShoulderX += Math.sin(elapsed * 0.18 + 1.7 + this.idleMotionPhase.rightShoulder) * 0.0045 * motion * idleBlend
        - shoulderSettle * 0.006;
      leftShoulderZ += Math.sin(elapsed * 0.16 + 0.9 + this.idleMotionPhase.leftShoulder) * 0.0035 * motion * idleBlend
        + shoulderSettle * 0.004;
      rightShoulderZ += Math.sin(elapsed * 0.14 + 2.2 + this.idleMotionPhase.rightShoulder) * 0.003 * motion * idleBlend
        + shoulderSettle * 0.0025;
      leftWristZ += Math.sin(elapsed * 0.13 + 0.6 + this.idleMotionPhase.wrists) * 0.018 * motion * idleBlend;
      rightWristZ += Math.sin(elapsed * 0.11 + 2.1 + this.idleMotionPhase.wrists * 0.73) * 0.016 * motion * idleBlend;
      leftElbow += Math.sin(elapsed * 0.15 + this.idleMotionPhase.leftShoulder) * 0.012 * motion * idleBlend;
      rightElbow += Math.sin(elapsed * 0.13 + this.idleMotionPhase.rightShoulder) * 0.01 * motion * idleBlend;
      leftElbowZ += Math.sin(elapsed * 0.11 + this.idleMotionPhase.wrists) * 0.012 * motion * idleBlend;
      rightElbowZ += Math.sin(elapsed * 0.095 + this.idleMotionPhase.wrists * 0.7) * 0.01 * motion * idleBlend;
      leftFingerCurl += Math.sin(elapsed * 0.09) * 0.015 * motion * idleBlend;
      rightFingerCurl += Math.sin(elapsed * 0.083 + 1.2) * 0.014 * motion * idleBlend;

      if (idleActionFrame) {
        const { action, age } = idleActionFrame;
        const headAmount = stagedGestureAmount(age, 0.04, action.timing) * motion;
        const shoulderAmount = stagedGestureAmount(age, 0, action.timing) * motion;
        const elbowAmount = stagedGestureAmount(age, 0.1, action.timing) * motion;
        const wristAmount = stagedGestureAmount(age, 0.18, action.timing) * motion;
        const fingerAmount = stagedGestureAmount(age, 0.24, action.timing) * motion;
        const cheekTouch = action.name === "touch_right_cheek";
        const touchAdjustment = cheekTouch
          ? Math.sin(age * 8.5) * 0.012 * Math.min(wristAmount, fingerAmount)
          : 0;
        const leftArmLift = clamp(Math.abs(action.leftElbowZ || 0) / 2.4, 0, 1);
        const rightArmLift = clamp(Math.abs(action.rightElbowZ || 0) / 2.4, 0, 1);

        stateYaw += action.headYaw * headAmount;
        statePitch += action.headPitch * headAmount;
        eyeOffsetX += action.eyeX * headAmount;
        eyeOffsetY += action.eyeY * headAmount;
        torsoLean += (action.torsoLean + (rightArmLift - leftArmLift) * 0.01) * shoulderAmount;
        torsoTurn += (rightArmLift - leftArmLift) * 0.012 * shoulderAmount;
        torsoPitch -= Math.max(leftArmLift, rightArmLift) * 0.004 * shoulderAmount;
        leftShoulderX += (action.leftShoulderX - leftArmLift * 0.009) * shoulderAmount;
        rightShoulderX += (action.rightShoulderX - rightArmLift * 0.009) * shoulderAmount;
        leftShoulderZ += (action.leftShoulderZ + leftArmLift * 0.025) * shoulderAmount;
        rightShoulderZ += (action.rightShoulderZ - rightArmLift * 0.025) * shoulderAmount;
        leftElbow += (action.leftElbow || 0) * elbowAmount;
        rightElbow += (action.rightElbow || 0) * elbowAmount;
        leftElbowZ = (action.leftElbowZ || 0) * elbowAmount;
        rightElbowZ = (action.rightElbowZ || 0) * elbowAmount;
        leftWristZ += (action.leftWrist || 0) * wristAmount;
        rightWristZ += ((action.rightWrist || 0) + touchAdjustment) * wristAmount;
        if (Number.isFinite(action.leftFingers)) {
          leftFingerCurl = lerp(leftFingerCurl, action.leftFingers, fingerAmount);
        }
        if (Number.isFinite(action.rightFingers)) {
          rightFingerCurl = lerp(rightFingerCurl, action.rightFingers, fingerAmount);
        }
      }
    } else if (this.state === "listening") {
      stateYaw = 0.065;
      statePitch = 0.085;
      eyeIntensity = 1.8;
      chestIntensity = 1.05;
      statusColor = this.profile.statusColors.listening;
      leftShoulderX -= 0.02;
      rightShoulderX -= 0.02;
      leftShoulderZ += 0.004;
      rightShoulderZ += 0.002;
      torsoTurn += 0.008 * motion;
      torsoLean -= 0.004 * motion;
    } else if (this.state === "thinking") {
      const thoughtPulse = 0.5 + Math.sin(elapsed * 0.82) * 0.5;
      stateYaw = -0.07 + Math.sin(elapsed * 0.58) * 0.018 * motion;
      statePitch = -0.035;
      eyeOffsetX = Math.sin(elapsed * 0.7) * 0.017 * motion;
      eyeOffsetY = 0.008;
      eyeIntensity = 1.2 + thoughtPulse * 0.35;
      chestIntensity = 0.82 + thoughtPulse * 0.32;
      rightShoulderX -= 0.12 * motion;
      rightShoulderZ -= 0.012 * motion;
      rightElbow += 0.3 * motion;
      rightElbowZ = 0.18 * motion;
      rightWristZ = 0.08 * motion;
      rightFingerCurl = 0.34 * motion;
      torsoTurn -= 0.012 * motion;
      torsoLean += 0.006 * motion;
      statusColor = this.profile.statusColors.thinking;
    } else if (this.state === "speaking") {
      eyeIntensity = 1.35 + this.speechEnergy * 0.55;
      chestIntensity = 0.95 + this.speechEnergy * 0.75;
      statusColor = this.profile.statusColors.speaking;
      const speakingShoulderMotion = (0.42 + this.speechEnergy * 0.58) * motion;
      leftShoulderX += Math.sin(elapsed * 0.63 + 0.4) * 0.0032 * speakingShoulderMotion;
      rightShoulderX += Math.sin(elapsed * 0.57 + 1.8) * 0.0028 * speakingShoulderMotion;
      leftShoulderZ += Math.sin(elapsed * 0.49 + 0.7) * 0.0026 * speakingShoulderMotion;
      rightShoulderZ += Math.sin(elapsed * 0.43 + 2.1) * 0.0022 * speakingShoulderMotion;
      leftElbow += Math.sin(elapsed * 0.52 + 0.5) * 0.008 * speakingShoulderMotion;
      rightElbow += Math.sin(elapsed * 0.47 + 1.6) * 0.007 * speakingShoulderMotion;
      leftWristZ += Math.sin(elapsed * 0.56 + 0.2) * 0.009 * speakingShoulderMotion;
      rightWristZ += Math.sin(elapsed * 0.51 + 1.9) * 0.008 * speakingShoulderMotion;
      torsoLean += Math.sin(elapsed * 0.36 + 0.8) * 0.0035 * speakingShoulderMotion;
      torsoTurn += Math.sin(elapsed * 0.31 + 1.7) * 0.005 * speakingShoulderMotion;

      let gesture = null;
      let gestureAge = 0;
      if (this.forcedGestureName) {
        gesture = SPEECH_GESTURES_BY_NAME.get(this.forcedGestureName);
        gestureAge = gesture.timing.rise + 0.27;
      } else {
        if (this.activeGesture) {
          const totalDuration = this.activeGesture.timing.rise
            + this.activeGesture.timing.hold
            + this.activeGesture.timing.return
            + 0.27;
          gestureAge = elapsed - this.activeGestureStartedAt;
          if (gestureAge >= totalDuration) {
            this.activeGesture = null;
            this.nextGestureAt = elapsed + 0.85 + Math.random() * 1.25;
          }
        }
        if (!this.activeGesture && elapsed >= this.nextGestureAt && this.speechEnergy > 0.06) {
          const step = 1 + Math.floor(Math.random() * (SPEECH_GESTURES.length - 1));
          this.gestureCursor = (this.gestureCursor + step) % SPEECH_GESTURES.length;
          this.activeGesture = SPEECH_GESTURES[this.gestureCursor];
          this.activeGestureIntensity = 0.86 + Math.random() * 0.18;
          this.activeGestureStartedAt = elapsed;
          gestureAge = 0;
        }
        gesture = this.activeGesture;
        if (gesture) gestureAge = elapsed - this.activeGestureStartedAt;
      }

      if (gesture) {
        const variation = this.forcedGestureName ? 1 : this.activeGestureIntensity;
        const intensity = (0.84 + this.speechEnergy * 0.16)
          * motion
          * this.profile.gestureScale
          * variation;
        const headAmount = stagedGestureAmount(gestureAge, 0.04, gesture.timing) * intensity;
        const shoulderAmount = stagedGestureAmount(gestureAge, 0, gesture.timing) * intensity;
        const elbowAmount = stagedGestureAmount(gestureAge, 0.1, gesture.timing) * intensity;
        const wristAmount = stagedGestureAmount(gestureAge, 0.18, gesture.timing) * intensity;
        const fingerAmount = stagedGestureAmount(gestureAge, 0.26, gesture.timing) * intensity;

        stateYaw = gesture.headYaw * headAmount;
        statePitch = gesture.headPitch * headAmount;
        const leftArmLift = clamp(Math.abs(gesture.leftElbowZ) / 2.35, 0, 1);
        const rightArmLift = clamp(Math.abs(gesture.rightElbowZ) / 2.35, 0, 1);
        torsoLean += (
          (gesture.rightElbow - gesture.leftElbow) * 0.012
          + (rightArmLift - leftArmLift) * 0.012
        ) * shoulderAmount;
        torsoTurn += (rightArmLift - leftArmLift) * 0.018 * shoulderAmount;
        torsoPitch -= Math.max(leftArmLift, rightArmLift) * 0.006 * shoulderAmount;
        leftShoulderX += (gesture.leftShoulderX - leftArmLift * 0.012) * shoulderAmount;
        rightShoulderX += (gesture.rightShoulderX - rightArmLift * 0.012) * shoulderAmount;
        leftShoulderZ += (gesture.leftShoulderZ + leftArmLift * 0.026) * shoulderAmount;
        rightShoulderZ += (gesture.rightShoulderZ - rightArmLift * 0.026) * shoulderAmount;
        leftElbow += gesture.leftElbow * elbowAmount;
        rightElbow += gesture.rightElbow * elbowAmount;
        leftElbowZ = gesture.leftElbowZ * elbowAmount;
        rightElbowZ = gesture.rightElbowZ * elbowAmount;
        leftWristZ = gesture.leftWrist * wristAmount;
        rightWristZ = gesture.rightWrist * wristAmount;
        leftFingerCurl = lerp(0.08, gesture.leftFingers, fingerAmount);
        rightFingerCurl = lerp(0.08, gesture.rightFingers, fingerAmount);
      }
    } else if (this.state === "error") {
      statePitch = 0.06;
      eyeIntensity = 0.48;
      chestIntensity = 0.48;
      leftFingerCurl = 0.12;
      rightFingerCurl = 0.12;
      statusColor = this.profile.statusColors.error;
    }

    const bodyMotion = this.state === "listening" ? 0.35 : 1;
    const idleBreath = Math.sin(elapsed * 1.18)
      * this.profile.bodyMotionAmplitude
      * motion
      * bodyMotion;
    parts.torsoRoot.position.y = lerp(
      parts.torsoRoot.position.y,
      this.torsoBaseY + idleBreath,
      transition * 0.28
    );
    parts.torsoRoot.rotation.x = lerp(
      parts.torsoRoot.rotation.x,
      this.torsoBaseRotation.x + torsoPitch,
      transition * 0.22
    );
    parts.torsoRoot.rotation.y = lerp(
      parts.torsoRoot.rotation.y,
      this.torsoBaseRotation.y + torsoTurn,
      transition * 0.22
    );
    parts.torsoRoot.rotation.z = lerp(
      parts.torsoRoot.rotation.z,
      this.torsoBaseRotation.z + torsoLean,
      transition * 0.25
    );

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

    eyeOffsetX *= this.profile.eyeMotionScale;
    eyeOffsetY *= this.profile.eyeMotionScale;
    parts.leftEye.position.x = lerp(
      parts.leftEye.position.x,
      this.eyeBasePositions.left.x + eyeOffsetX,
      transition * 0.42
    );
    parts.rightEye.position.x = lerp(
      parts.rightEye.position.x,
      this.eyeBasePositions.right.x + eyeOffsetX,
      transition * 0.42
    );
    parts.leftEye.position.y = lerp(
      parts.leftEye.position.y,
      this.eyeBasePositions.left.y + eyeOffsetY,
      transition * 0.42
    );
    parts.rightEye.position.y = lerp(
      parts.rightEye.position.y,
      this.eyeBasePositions.right.y + eyeOffsetY,
      transition * 0.42
    );

    parts.leftShoulderPivot.rotation.x = lerp(parts.leftShoulderPivot.rotation.x, leftShoulderX, transition * 0.3);
    parts.rightShoulderPivot.rotation.x = lerp(parts.rightShoulderPivot.rotation.x, rightShoulderX, transition * 0.3);
    parts.leftShoulderPivot.rotation.z = lerp(parts.leftShoulderPivot.rotation.z, leftShoulderZ, transition * 0.26);
    parts.rightShoulderPivot.rotation.z = lerp(parts.rightShoulderPivot.rotation.z, rightShoulderZ, transition * 0.26);
    parts.leftElbowPivot.rotation.x = lerp(parts.leftElbowPivot.rotation.x, leftElbow, transition * 0.34);
    parts.rightElbowPivot.rotation.x = lerp(parts.rightElbowPivot.rotation.x, rightElbow, transition * 0.34);
    parts.leftElbowPivot.rotation.z = lerp(parts.leftElbowPivot.rotation.z, leftElbowZ, transition * 0.32);
    parts.rightElbowPivot.rotation.z = lerp(parts.rightElbowPivot.rotation.z, rightElbowZ, transition * 0.32);
    parts.leftWristPivot.rotation.z = lerp(parts.leftWristPivot.rotation.z, leftWristZ, transition * 0.3);
    parts.rightWristPivot.rotation.z = lerp(parts.rightWristPivot.rotation.z, rightWristZ, transition * 0.3);
    this.updateHand(parts.leftHand, leftFingerCurl, transition);
    this.updateHand(parts.rightHand, rightFingerCurl, transition);

    this.materials.setStatusColor(statusColor, eyeIntensity * this.tuning.eyeBrightness);
    this.materials.chestGlow.emissiveIntensity = chestIntensity * this.tuning.eyeBrightness;
    this.updateMouthWave(elapsed, transition);
    this.updateBlink(elapsed, motion);
  }

  updateHand(hand, curl, transition) {
    const amount = clamp(curl, 0, 0.65);
    for (const [index, finger] of (hand.userData.fingerPivots || []).entries()) {
      const stagger = 1 + index * 0.035;
      finger.knuckle.rotation.x = lerp(finger.knuckle.rotation.x, amount * stagger, transition * 0.32);
      finger.distal.rotation.x = lerp(finger.distal.rotation.x, amount * 0.72 * stagger, transition * 0.34);
    }
    if (hand.userData.thumbPivot) {
      const side = hand.name.startsWith("Left") ? 1 : -1;
      const base = -side * 0.68;
      hand.userData.thumbPivot.rotation.z = lerp(
        hand.userData.thumbPivot.rotation.z,
        base + side * amount * 0.22,
        transition * 0.3
      );
    }
  }

  updateMouthWave(elapsed, transition) {
    const segments = this.parts.mouthWaveSegments || [];
    const xValues = this.parts.mouthWaveX || [];
    if (segments.length === 0 || xValues.length < 2) return;

    let amplitude = 0;
    let glow = 0.42;
    if (this.state === "speaking") {
      amplitude = this.profile.mouthAmplitude * this.speechEnergy * this.tuning.mouthGain;
      glow = 0.55 + this.speechEnergy * 1.65;
    }

    for (let index = 0; index < xValues.length; index += 1) {
      const normalized = index / (xValues.length - 1);
      const envelope = Math.sin(normalized * Math.PI);
      let target = 0;
      if (this.state === "speaking") {
        const spectrum = this.audioSpectrum[index] || 0;
        const spectralShape = 0.28 + spectrum * 0.92;
        const primary = Math.sin(elapsed * 8.4 + index * 0.88);
        const secondary = Math.sin(elapsed * 3.1 - index * 1.31) * 0.22;
        target = (primary + secondary)
          * amplitude
          * spectralShape
          * envelope;
      } else if (this.state === "thinking") {
        target = Math.sin(elapsed * 1.7) * this.profile.mouthAmplitude * 0.04;
        glow = 0.58;
      }
      this.wavePoints[index] = lerp(this.wavePoints[index], target, transition * 0.72);
    }

    for (let index = 0; index < segments.length; index += 1) {
      const x1 = xValues[index];
      const x2 = xValues[index + 1];
      const y1 = this.wavePoints[index];
      const y2 = this.wavePoints[index + 1];
      const deltaX = x2 - x1;
      const deltaY = y2 - y1;
      const segment = segments[index];
      const base = this.waveSegmentBase[index];
      const baseLength = Math.max(Math.abs(x2 - x1), 0.0001);
      segment.position.set(
        (x1 + x2) / 2,
        base.y + (y1 + y2) / 2,
        base.z
      );
      segment.rotation.z = base.rotationZ + Math.atan2(deltaY, deltaX);
      segment.scale.x = base.scaleX * (Math.hypot(deltaX, deltaY) / baseLength);
      segment.scale.y = base.scaleY;
    }

    this.materials.mouthGlow.emissiveIntensity = glow * this.tuning.eyeBrightness;
  }

  updateBlink(elapsed, motion) {
    if (this.state === "error" || motion < 0.5) {
      this.setBlinkAmount(0);
      return;
    }

    if (elapsed >= this.nextBlinkAt && this.blinkStartedAt < 0) {
      this.blinkStartedAt = elapsed;
      this.nextBlinkAt = elapsed + 3.2 + Math.random() * 3.7;
    }

    if (this.blinkStartedAt >= 0) {
      const progress = (elapsed - this.blinkStartedAt) / 0.16;
      const amount = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      this.setBlinkAmount(clamp(amount, 0, 1));
      if (progress >= 1) this.blinkStartedAt = -1;
    } else {
      this.setBlinkAmount(0);
    }
  }

  setBlinkAmount(amount) {
    this.parts.leftEyeLight.scale.y = lerp(this.eyeOpenScaleY.left, 0.0025, amount);
    this.parts.rightEyeLight.scale.y = lerp(this.eyeOpenScaleY.right, 0.0025, amount);
  }
}
