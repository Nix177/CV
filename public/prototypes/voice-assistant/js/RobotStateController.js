import { RobotAnimator } from "./RobotAnimator.js";
import { RobotAudioController } from "./RobotAudioController.js";

export class RobotStateController {
  constructor(robot) {
    this.robot = robot;
    this.animator = new RobotAnimator(robot);
    this.audio = new RobotAudioController();
    this.state = "idle";
  }

  setState(state) {
    this.state = state;
    this.animator.setState(state);
  }

  connectAssistantAudioNode(audioNode) {
    this.audio.connectAssistantAudioNode(audioNode);
  }

  setAudioLevel(level) {
    this.audio.setAudioLevel(level);
  }

  previewGesture(name) {
    this.animator.previewGesture(name);
  }

  getGestureNames() {
    return this.animator.getGestureNames();
  }

  getCurrentGestureName() {
    return this.animator.getCurrentGestureName();
  }

  previewIdleAction(name) {
    this.animator.previewIdleAction(name);
  }

  getIdleActionNames() {
    return this.animator.getIdleActionNames();
  }

  getDebugInfo() {
    const pivots = [
      "torsoRoot",
      "headYaw",
      "headPitch",
      "leftShoulderPivot",
      "leftElbowPivot",
      "leftWristPivot",
      "rightShoulderPivot",
      "rightElbowPivot",
      "rightWristPivot"
    ];
    return {
      rigType: "rigid-transform hierarchy",
      hasSkinWeights: false,
      meshNames: Object.values(this.robot.parts)
        .filter((part) => part?.isMesh)
        .map((part) => part.name),
      pivots: pivots.map((key) => ({
        key,
        name: this.robot.parts[key]?.name || "missing",
        parent: this.robot.parts[key]?.parent?.name || "none"
      })),
      gesture: this.getCurrentGestureName(),
      idleAction: this.animator.getCurrentIdleActionName()
    };
  }

  setPointerTarget(x, y) {
    this.animator.setPointerTarget(x, y);
  }

  notifyInteraction() {
    this.animator.notifyInteraction();
  }

  setReducedMotion(enabled) {
    this.animator.setReducedMotion(enabled);
  }

  setTuning(patch) {
    this.animator.setTuning(patch);
  }

  getTuning() {
    return this.animator.getTuning();
  }

  update(delta, elapsed) {
    this.animator.setAudioLevel(this.audio.update());
    this.animator.setAudioSpectrum(this.audio.getSpectrum());
    this.animator.update(delta, elapsed);
  }

  dispose() {
    this.audio.dispose();
    this.robot.dispose();
  }
}
