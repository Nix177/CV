const CONTROLS = [
  ["headScale", "Head scale", 0.65, 1.15, 0.01],
  ["headYaw", "Head yaw", -0.7, 0.7, 0.01],
  ["headPitch", "Head pitch", -0.5, 0.5, 0.01],
  ["mouthGain", "Mouth wave gain", 0.4, 2, 0.05],
  ["eyeBrightness", "Eye brightness", 0.1, 3, 0.05],
  ["leftShoulder", "Left shoulder", -0.7, 0.7, 0.01],
  ["rightShoulder", "Right shoulder", -0.7, 0.7, 0.01],
  ["leftElbow", "Left elbow", -0.2, 1.5, 0.01],
  ["rightElbow", "Right elbow", -0.2, 1.5, 0.01],
  ["robotScale", "Robot scale", 0.75, 1.25, 0.01],
  ["materialRoughness", "Material roughness", 0.05, 0.9, 0.01],
  ["materialMetalness", "Material metalness", 0, 1, 0.01]
];

const RENDER_CONTROLS = [
  ["cameraX", "Camera X", -3, 3, 0.05, 0],
  ["cameraY", "Camera Y", -1, 4, 0.05, 0.82],
  ["cameraZ", "Camera Z", 3.5, 10, 0.05, 8.2],
  ["keyLight", "Key light", 0, 6, 0.05, 2.45],
  ["fillLight", "Fill light", 0, 5, 0.05, 1.15],
  ["rimLight", "Rim light", 0, 6, 0.05, 1.75]
];

const DEBUG_STATES = ["idle", "listening", "thinking", "speaking", "error"];

export class RobotDebugPanel {
  constructor({ container, controller, renderer, onStateChange }) {
    this.container = container;
    this.controller = controller;
    this.renderer = renderer;
    this.onStateChange = onStateChange || ((state) => controller.setState(state));
    this.values = { ...controller.getTuning() };
    this.renderValues = Object.fromEntries(RENDER_CONTROLS.map(([key, , , , , value]) => [key, value]));
  }

  init() {
    if (!this.container) return;
    const grid = document.createElement("div");
    grid.className = "debug-grid";

    const stateControl = document.createElement("div");
    stateControl.className = "debug-control";
    const stateLabel = document.createElement("label");
    stateLabel.htmlFor = "debug-robot-state";
    stateLabel.textContent = "Animation state";
    const stateSelect = document.createElement("select");
    stateSelect.id = "debug-robot-state";
    for (const state of DEBUG_STATES) {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      stateSelect.appendChild(option);
    }
    stateSelect.addEventListener("change", () => {
      this.controller.previewGesture("");
      this.onStateChange(stateSelect.value);
      this.controller.setAudioLevel(stateSelect.value === "speaking" ? 0.62 : 0);
      console.info("Voice robot animation state", stateSelect.value);
    });
    stateControl.append(stateLabel, stateSelect);
    grid.appendChild(stateControl);

    const gestureControl = document.createElement("div");
    gestureControl.className = "debug-control";
    const gestureLabel = document.createElement("label");
    gestureLabel.htmlFor = "debug-robot-gesture";
    gestureLabel.textContent = "Speaking gesture";
    const gestureSelect = document.createElement("select");
    gestureSelect.id = "debug-robot-gesture";
    const naturalOption = document.createElement("option");
    naturalOption.value = "";
    naturalOption.textContent = "Natural sequence";
    gestureSelect.appendChild(naturalOption);
    for (const gesture of this.controller.getGestureNames()) {
      const option = document.createElement("option");
      option.value = gesture;
      option.textContent = gesture;
      gestureSelect.appendChild(option);
    }
    gestureSelect.addEventListener("change", () => {
      this.onStateChange("speaking");
      this.controller.setAudioLevel(0.62);
      this.controller.previewGesture(gestureSelect.value);
      stateSelect.value = "speaking";
      console.info("Voice robot gesture", gestureSelect.value || "natural sequence");
    });
    gestureControl.append(gestureLabel, gestureSelect);
    grid.appendChild(gestureControl);

    const idleActionControl = document.createElement("div");
    idleActionControl.className = "debug-control";
    const idleActionLabel = document.createElement("label");
    idleActionLabel.htmlFor = "debug-robot-idle-action";
    idleActionLabel.textContent = "Idle action";
    const idleActionSelect = document.createElement("select");
    idleActionSelect.id = "debug-robot-idle-action";
    const randomIdleOption = document.createElement("option");
    randomIdleOption.value = "";
    randomIdleOption.textContent = "Random schedule";
    idleActionSelect.appendChild(randomIdleOption);
    for (const action of this.controller.getIdleActionNames()) {
      const option = document.createElement("option");
      option.value = action;
      option.textContent = action;
      idleActionSelect.appendChild(option);
    }
    idleActionSelect.addEventListener("change", () => {
      this.onStateChange("idle");
      this.controller.setAudioLevel(0);
      this.controller.previewGesture("");
      this.controller.previewIdleAction(idleActionSelect.value);
      stateSelect.value = "idle";
      gestureSelect.value = "";
      console.info("Voice robot idle action", idleActionSelect.value || "random schedule");
    });
    idleActionControl.append(idleActionLabel, idleActionSelect);
    grid.appendChild(idleActionControl);

    const hierarchyControl = document.createElement("label");
    hierarchyControl.className = "debug-control";
    const hierarchyToggle = document.createElement("input");
    hierarchyToggle.type = "checkbox";
    hierarchyToggle.id = "debug-robot-hierarchy";
    hierarchyToggle.addEventListener("change", () => {
      this.renderer.setHierarchyVisible(hierarchyToggle.checked);
    });
    hierarchyControl.append(hierarchyToggle, document.createTextNode(" Show pivot hierarchy"));
    grid.appendChild(hierarchyControl);

    for (const [key, label, min, max, step] of CONTROLS) {
      grid.appendChild(this.createRange(key, label, min, max, step, this.values[key], (value) => {
        this.values[key] = value;
        this.controller.setTuning({ [key]: value });
      }));
    }

    for (const [key, label, min, max, step, initial] of RENDER_CONTROLS) {
      grid.appendChild(this.createRange(key, label, min, max, step, initial, (value) => {
        this.renderValues[key] = value;
        this.applyRenderTuning();
      }));
    }

    const actions = document.createElement("div");
    actions.className = "debug-actions";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy values as JSON";
    copy.addEventListener("click", async () => {
      const json = JSON.stringify({ robot: this.values, renderer: this.renderValues }, null, 2);
      try {
        await navigator.clipboard.writeText(json);
        copy.textContent = "Copied";
      } catch {
        window.prompt("Copy robot values", json);
      }
      setTimeout(() => { copy.textContent = "Copy values as JSON"; }, 1400);
    });
    actions.appendChild(copy);
    this.container.replaceChildren(grid, actions);
    console.info("Voice robot hierarchy", this.controller.getDebugInfo());
  }

  createRange(key, label, min, max, step, initial, onInput) {
    const wrapper = document.createElement("div");
    wrapper.className = "debug-control";
    const id = `debug-${key}`;
    const labelElement = document.createElement("label");
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    const input = document.createElement("input");
    input.id = id;
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);
    const output = document.createElement("output");
    output.htmlFor = id;
    output.value = Number(initial).toFixed(2);
    input.addEventListener("input", () => {
      const value = Number(input.value);
      output.value = value.toFixed(2);
      onInput(value);
    });
    wrapper.append(labelElement, input, output);
    return wrapper;
  }

  applyRenderTuning() {
    this.renderer.setCameraPosition({
      x: this.renderValues.cameraX,
      y: this.renderValues.cameraY,
      z: this.renderValues.cameraZ
    });
    this.renderer.setLightIntensity("key", this.renderValues.keyLight);
    this.renderer.setLightIntensity("fill", this.renderValues.fillLight);
    this.renderer.setLightIntensity("rim", this.renderValues.rimLight);
  }
}
