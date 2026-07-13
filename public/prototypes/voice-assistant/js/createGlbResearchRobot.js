const DEFAULT_MODEL_URL = "/models/robot/robot-voice-assistant.glb";

function loadGltf(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

function requirePart(root, name) {
  const part = root.getObjectByName(name);
  if (!part) throw new Error(`Voice robot part is missing: ${name}`);
  return part;
}

function collectMaterials(root) {
  const materials = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) materials.add(material);
    }
  });
  return materials;
}

function makeMaterialAdapter(THREE, root, leftEye, rightEye, mouthSegments) {
  const allMaterials = collectMaterials(root);
  const eyeMaterials = new Set([leftEye.material, rightEye.material].filter(Boolean));
  const mouthMaterials = new Set(mouthSegments.map((segment) => segment.material).filter(Boolean));
  const mouthGlow = mouthSegments[0]?.material || { emissiveIntensity: 0 };
  const chestGlow = { emissiveIntensity: 0 };

  const applyColor = (material, color, intensity) => {
    if (material.color) material.color.copy(color);
    if (material.emissive) material.emissive.copy(color);
    if ("emissiveIntensity" in material) material.emissiveIntensity = intensity;
    material.needsUpdate = true;
  };

  return {
    mouthGlow,
    chestGlow,
    setSurfaceTuning() {},
    setStatusColor(value, intensity = 1) {
      const color = value instanceof THREE.Color ? value : new THREE.Color(value);
      for (const material of eyeMaterials) applyColor(material, color, intensity);
      for (const material of mouthMaterials) applyColor(material, color, material.emissiveIntensity || 1);
    },
    dispose() {
      const textures = new Set();
      for (const material of allMaterials) {
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
        material.dispose();
      }
      for (const texture of textures) texture.dispose();
    }
  };
}

export async function createGlbResearchRobot(
  THREE = globalThis.THREE,
  modelUrl = DEFAULT_MODEL_URL
) {
  if (!THREE?.GLTFLoader) throw new Error("Three.js GLTFLoader is required for the voice robot.");

  const loader = new THREE.GLTFLoader();
  const gltf = await loadGltf(loader, modelUrl);
  const model = gltf.scene;
  model.name = "VoiceRobotModel";
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });

  const robotRoot = new THREE.Group();
  robotRoot.name = "VoiceRobotRoot";
  robotRoot.add(model);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const modelScale = 7.2 / Math.max(size.y, 0.001);
  model.scale.setScalar(modelScale);
  model.position.set(
    -center.x * modelScale,
    -1 - center.y * modelScale,
    -center.z * modelScale
  );

  const rigRoot = requirePart(model, "RobotRigRoot");
  const torsoRoot = requirePart(model, "TorsoRoot");
  const headYaw = requirePart(model, "HeadYaw");
  const headPitch = requirePart(model, "HeadPitch");
  const leftEyeLight = requirePart(model, "LeftEyeLight");
  const rightEyeLight = requirePart(model, "RightEyeLight");
  const mouthDisplay = requirePart(model, "FaceMouthMask");
  const mouthWaveSegments = Array.from({ length: 12 }, (_, index) => (
    requirePart(model, `MouthWaveSegment${String(index + 1).padStart(2, "0")}`)
  ));
  const mouthVerticalOffset = -0.028;
  mouthDisplay.position.y += mouthVerticalOffset;
  for (const segment of mouthWaveSegments) segment.position.y += mouthVerticalOffset;
  const mouthWaveX = Array.isArray(rigRoot.userData.mouth_x)
    ? rigRoot.userData.mouth_x.map(Number)
    : Array.from({ length: 13 }, (_, index) => -0.025 + index * (0.05 / 12));
  const materials = makeMaterialAdapter(
    THREE,
    model,
    leftEyeLight,
    rightEyeLight,
    mouthWaveSegments
  );

  const parts = {
    robotRoot,
    torsoRoot,
    headYaw,
    headPitch,
    leftEye: leftEyeLight,
    rightEye: rightEyeLight,
    leftEyeLight,
    rightEyeLight,
    mouthDisplay,
    mouthWaveSegments,
    mouthWaveX,
    leftShoulderPivot: requirePart(model, "LeftShoulderPivot"),
    leftElbowPivot: requirePart(model, "LeftElbowPivot"),
    leftWristPivot: requirePart(model, "LeftWristPivot"),
    leftHand: requirePart(model, "Robot_left_hand"),
    rightShoulderPivot: requirePart(model, "RightShoulderPivot"),
    rightElbowPivot: requirePart(model, "RightElbowPivot"),
    rightWristPivot: requirePart(model, "RightWristPivot"),
    rightHand: requirePart(model, "Robot_right_hand")
  };

  return {
    root: robotRoot,
    parts,
    materials,
    animationProfile: {
      headScale: 1,
      mouthAmplitude: 0.021,
      eyeMotionScale: 0.24,
      bodyMotionAmplitude: 0.0018,
      gestureScale: 1,
      statusColors: {
        idle: 0xf0a34a,
        listening: 0xffbd62,
        thinking: 0x72bfd0,
        speaking: 0xf0a34a,
        error: 0xc66b43
      }
    },
    renderProfile: { showGround: false, shadows: false },
    dispose() {
      robotRoot.traverse((object) => object.geometry?.dispose?.());
      materials.dispose();
    }
  };
}
