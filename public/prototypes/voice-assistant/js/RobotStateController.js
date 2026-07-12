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

  connectAudioNode(audioNode) {
    this.audio.connectAudioNode(audioNode);
  }

  setAudioLevel(level) {
    this.audio.setAudioLevel(level);
  }

  setPointerTarget(x, y) {
    this.animator.setPointerTarget(x, y);
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
    this.animator.update(delta, elapsed);
  }

  dispose() {
    this.audio.dispose();
    this.robot.dispose();
  }
}
