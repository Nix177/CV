import { RobotMaterials } from "./RobotMaterials.js";

const SIDE = Object.freeze({ left: 1, right: -1 });

function setTransform(object, position, rotation, scale) {
  if (position) object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  if (scale) object.scale.set(...scale);
  return object;
}

function makeMesh(THREE, geometry, material, name, transform = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return setTransform(mesh, transform.position, transform.rotation, transform.scale);
}

function makeChestGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.88, -0.92);
  shape.lineTo(-1.04, 0.46);
  shape.quadraticCurveTo(-0.92, 0.92, -0.58, 1.03);
  shape.lineTo(0.58, 1.03);
  shape.quadraticCurveTo(0.92, 0.92, 1.04, 0.46);
  shape.lineTo(0.88, -0.92);
  shape.quadraticCurveTo(0, -1.08, -0.88, -0.92);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.07,
    bevelThickness: 0.06,
    curveSegments: 8
  });
  geometry.center();
  return geometry;
}

function makeRoundedPanelGeometry(THREE, width = 0.92, height = 0.62, radius = 0.16, depth = 0.12) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 8
  });
  geometry.center();
  return geometry;
}

function addJoint(THREE, group, geometries, materials, name, scale = 1) {
  const joint = makeMesh(THREE, geometries.sphere, materials.brushedMetal, `${name}Joint`, {
    scale: [0.25 * scale, 0.25 * scale, 0.25 * scale]
  });
  const collar = makeMesh(THREE, geometries.torus, materials.titanium, `${name}Collar`, {
    scale: [0.32 * scale, 0.32 * scale, 0.32 * scale]
  });
  group.add(joint, collar);
}

function createHand(THREE, geometries, materials, sideName, sideSign) {
  const hand = new THREE.Group();
  hand.name = `${sideName}Hand`;

  const palm = makeMesh(THREE, geometries.box, materials.ceramicShadow, `${sideName}Palm`, {
    position: [0, -0.17, 0],
    scale: [0.29, 0.31, 0.18]
  });
  const dorsalPlate = makeMesh(THREE, geometries.box, materials.ceramic, `${sideName}DorsalPlate`, {
    position: [0, -0.17, 0.105],
    scale: [0.235, 0.245, 0.035]
  });
  hand.add(palm, dorsalPlate);

  const fingerPivots = [];
  [-0.155, -0.052, 0.052, 0.155].forEach((x, index) => {
    const knuckle = new THREE.Group();
    knuckle.name = `${sideName}Finger${index + 1}Knuckle`;
    knuckle.position.set(x, -0.39, 0.015);

    const joint = makeMesh(THREE, geometries.sphere, materials.titanium, `${sideName}Finger${index + 1}Joint`, {
      scale: [0.043, 0.043, 0.043]
    });
    const proximal = makeMesh(THREE, geometries.cylinder, materials.brushedMetal, `${sideName}Finger${index + 1}Proximal`, {
      position: [0, -0.105, 0],
      scale: [0.034, 0.11, 0.034]
    });
    const distalPivot = new THREE.Group();
    distalPivot.name = `${sideName}Finger${index + 1}DistalPivot`;
    distalPivot.position.set(0, -0.21, 0);
    const distal = makeMesh(THREE, geometries.cylinder, materials.ceramicShadow, `${sideName}Finger${index + 1}Distal`, {
      position: [0, -0.075, 0],
      scale: [0.03, 0.08, 0.03]
    });
    distalPivot.add(distal);
    knuckle.add(joint, proximal, distalPivot);
    hand.add(knuckle);
    fingerPivots.push({ knuckle, distal: distalPivot });
  });

  const thumbPivot = new THREE.Group();
  thumbPivot.name = `${sideName}ThumbPivot`;
  thumbPivot.position.set(-sideSign * 0.255, -0.22, 0.02);
  thumbPivot.rotation.z = -sideSign * 0.68;
  const thumbJoint = makeMesh(THREE, geometries.sphere, materials.titanium, `${sideName}ThumbJoint`, {
    scale: [0.048, 0.048, 0.048]
  });
  const thumb = makeMesh(THREE, geometries.cylinder, materials.brushedMetal, `${sideName}Thumb`, {
    position: [0, -0.115, 0],
    scale: [0.04, 0.125, 0.04]
  });
  thumbPivot.add(thumbJoint, thumb);
  hand.add(thumbPivot);
  hand.userData.fingerPivots = fingerPivots;
  hand.userData.thumbPivot = thumbPivot;
  return hand;
}

function createArm(THREE, geometries, materials, sideName, sideSign) {
  const shoulderPivot = new THREE.Group();
  shoulderPivot.name = `${sideName}ShoulderPivot`;
  shoulderPivot.position.set(sideSign * 0.98, 1.92, 0);
  addJoint(THREE, shoulderPivot, geometries, materials, `${sideName}Shoulder`, 1.02);

  const upperArm = new THREE.Group();
  upperArm.name = `${sideName}UpperArm`;
  shoulderPivot.add(upperArm);

  const upperCore = makeMesh(THREE, geometries.cylinder, materials.titanium, `${sideName}UpperArmCore`, {
    position: [0, -0.48, 0],
    scale: [0.19, 0.5, 0.19]
  });
  const upperShellFront = makeMesh(THREE, geometries.box, materials.ceramic, `${sideName}UpperArmShellFront`, {
    position: [0, -0.45, 0.14],
    rotation: [0.04, 0, -sideSign * 0.04],
    scale: [0.29, 0.72, 0.12]
  });
  const upperShellSide = makeMesh(THREE, geometries.box, materials.ceramicShadow, `${sideName}UpperArmShellSide`, {
    position: [sideSign * 0.16, -0.45, -0.02],
    scale: [0.1, 0.67, 0.25]
  });
  upperArm.add(upperCore, upperShellFront, upperShellSide);

  const elbowPivot = new THREE.Group();
  elbowPivot.name = `${sideName}ElbowPivot`;
  elbowPivot.position.set(0, -0.97, 0);
  addJoint(THREE, elbowPivot, geometries, materials, `${sideName}Elbow`, 0.88);
  upperArm.add(elbowPivot);

  const forearm = new THREE.Group();
  forearm.name = `${sideName}Forearm`;
  elbowPivot.add(forearm);

  const forearmCore = makeMesh(THREE, geometries.forearm, materials.titanium, `${sideName}ForearmCore`, {
    position: [0, -0.43, 0],
    scale: [0.74, 0.82, 0.74]
  });
  const forearmShell = makeMesh(THREE, geometries.box, materials.ceramic, `${sideName}ForearmShell`, {
    position: [0, -0.41, 0.15],
    rotation: [-0.04, 0, sideSign * 0.025],
    scale: [0.29, 0.63, 0.13]
  });
  const forearmRail = makeMesh(THREE, geometries.box, materials.brushedMetal, `${sideName}ForearmRail`, {
    position: [-sideSign * 0.17, -0.42, -0.02],
    scale: [0.055, 0.57, 0.11]
  });
  forearm.add(forearmCore, forearmShell, forearmRail);

  const wristPivot = new THREE.Group();
  wristPivot.name = `${sideName}WristPivot`;
  wristPivot.position.set(0, -0.86, 0);
  addJoint(THREE, wristPivot, geometries, materials, `${sideName}Wrist`, 0.63);
  forearm.add(wristPivot);

  const hand = createHand(THREE, geometries, materials, sideName, sideSign);
  wristPivot.add(hand);

  return { shoulderPivot, upperArm, elbowPivot, forearm, wristPivot, hand };
}

function createEye(THREE, geometries, materials, name, x) {
  const root = new THREE.Group();
  root.name = name;
  root.position.set(x, 0.34, 0.48);

  const socket = makeMesh(THREE, geometries.sphere, materials.blackOptical, `${name}Socket`, {
    scale: [0.1, 0.042, 0.028]
  });
  const light = makeMesh(THREE, geometries.sphere, materials.eyeGlow, `${name}Light`, {
    position: [0, 0, 0.022],
    scale: [0.064, 0.018, 0.016]
  });
  root.add(socket, light);
  return { root, light };
}

function createWaveformMouth(THREE, geometries, materials) {
  const display = new THREE.Group();
  display.name = "MouthDisplay";
  display.position.set(0, 0.09, 0.49);

  const pointCount = 13;
  const xValues = Array.from({ length: pointCount }, (_, index) => -0.22 + index * (0.44 / (pointCount - 1)));
  const segments = [];
  for (let index = 0; index < pointCount - 1; index += 1) {
    const length = xValues[index + 1] - xValues[index];
    const segment = makeMesh(THREE, geometries.box, materials.mouthGlow, `MouthWaveSegment${index + 1}`, {
      position: [(xValues[index] + xValues[index + 1]) / 2, 0, 0],
      scale: [length * 1.04, 0.008, 0.012]
    });
    segments.push(segment);
    display.add(segment);
  }
  return { display, segments, xValues };
}

function createHead(THREE, geometries, materials) {
  const neckPivot = new THREE.Group();
  neckPivot.name = "NeckPivot";
  neckPivot.position.set(0, 2.34, 0);

  const neckColumn = makeMesh(THREE, geometries.cylinder, materials.brushedMetal, "NeckColumn", {
    position: [0, 0.02, 0],
    scale: [0.19, 0.28, 0.19]
  });
  const neckRingTop = makeMesh(THREE, geometries.torus, materials.titanium, "NeckRingTop", {
    position: [0, 0.25, 0],
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.25, 0.25, 0.25]
  });
  const neckRingBottom = neckRingTop.clone();
  neckRingBottom.name = "NeckRingBottom";
  neckRingBottom.position.y = -0.19;
  neckPivot.add(neckColumn, neckRingTop, neckRingBottom);

  for (const sign of [-1, 1]) {
    const actuator = makeMesh(THREE, geometries.cylinder, materials.titanium, `NeckActuator${sign}`, {
      position: [sign * 0.14, 0.01, -0.045],
      rotation: [0, 0, sign * 0.14],
      scale: [0.038, 0.27, 0.038]
    });
    neckPivot.add(actuator);
  }

  const headYaw = new THREE.Group();
  headYaw.name = "HeadYaw";
  headYaw.position.set(0, 0.27, 0);
  neckPivot.add(headYaw);

  const headPitch = new THREE.Group();
  headPitch.name = "HeadPitch";
  headYaw.add(headPitch);

  const skull = new THREE.Group();
  skull.name = "Skull";
  const cranium = makeMesh(THREE, geometries.sphere, materials.ceramic, "Cranium", {
    position: [0, 0.28, -0.035],
    scale: [0.5, 0.46, 0.39]
  });
  const rearBand = makeMesh(THREE, geometries.torus, materials.titanium, "RearCraniumBand", {
    position: [0, 0.29, -0.16],
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.43, 0.43, 0.43]
  });
  skull.add(cranium, rearBand);
  headPitch.add(skull);

  const facePlate = new THREE.Group();
  facePlate.name = "FacePlate";
  const visorFrame = makeMesh(THREE, geometries.facePanel, materials.ceramicShadow, "VisorFrame", {
    position: [0, 0.26, 0.35],
    scale: [1.035, 1.04, 0.82]
  });
  const opticVisor = makeMesh(THREE, geometries.facePanel, materials.blackOptical, "OpticVisor", {
    position: [0, 0.26, 0.405],
    scale: [0.95, 0.92, 0.46]
  });
  const browCap = makeMesh(THREE, geometries.facePanel, materials.ceramic, "BrowCap", {
    position: [0, 0.59, 0.16],
    scale: [0.68, 0.22, 0.64]
  });
  const lowerShell = makeMesh(THREE, geometries.facePanel, materials.ceramicShadow, "LowerHeadShell", {
    position: [0, -0.065, 0.16],
    scale: [0.65, 0.22, 0.62]
  });
  facePlate.add(visorFrame, opticVisor, browCap, lowerShell);
  headPitch.add(facePlate);

  for (const sign of [-1, 1]) {
    const joint = makeMesh(THREE, geometries.cylinder, materials.titanium, `HeadSideJoint${sign}`, {
      position: [sign * 0.46, 0.27, 0.02],
      rotation: [0, 0, Math.PI / 2],
      scale: [0.13, 0.055, 0.13]
    });
    const cover = makeMesh(THREE, geometries.cylinder, materials.ceramicShadow, `HeadSideCover${sign}`, {
      position: [sign * 0.49, 0.27, 0.02],
      rotation: [0, 0, Math.PI / 2],
      scale: [0.1, 0.04, 0.1]
    });
    headPitch.add(joint, cover);
  }

  const leftEye = createEye(THREE, geometries, materials, "LeftEye", SIDE.left * 0.17);
  const rightEye = createEye(THREE, geometries, materials, "RightEye", SIDE.right * 0.17);
  headPitch.add(leftEye.root, rightEye.root);

  const mouth = createWaveformMouth(THREE, geometries, materials);
  headPitch.add(mouth.display);

  const leftStatusLight = makeMesh(THREE, geometries.sphere, materials.chestGlow, "LeftHeadStatus", {
    position: [0.4, 0.07, 0.39],
    scale: [0.025, 0.025, 0.016]
  });
  const rightStatusLight = leftStatusLight.clone();
  rightStatusLight.name = "RightHeadStatus";
  rightStatusLight.position.x = -0.4;
  headPitch.add(leftStatusLight, rightStatusLight);

  return {
    neckPivot,
    headYaw,
    headPitch,
    skull,
    facePlate,
    leftEye: leftEye.root,
    rightEye: rightEye.root,
    leftEyeLight: leftEye.light,
    rightEyeLight: rightEye.light,
    mouthDisplay: mouth.display,
    mouthWaveSegments: mouth.segments,
    mouthWaveX: mouth.xValues,
    leftStatusLight,
    rightStatusLight
  };
}

export function createResearchRobot(THREE = globalThis.THREE) {
  if (!THREE) throw new Error("Three.js is required to create the research robot.");

  const materials = new RobotMaterials(THREE);
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1, 2, 2, 2),
    sphere: new THREE.SphereGeometry(1, 28, 20),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 24, 1),
    forearm: new THREE.CylinderGeometry(0.2, 0.28, 1, 20, 1),
    torus: new THREE.TorusGeometry(1, 0.16, 10, 30),
    chest: makeChestGeometry(THREE),
    facePanel: makeRoundedPanelGeometry(THREE)
  };

  const robotRoot = new THREE.Group();
  robotRoot.name = "RobotRoot";
  robotRoot.position.set(0, -1.14, 0);

  const torsoRoot = new THREE.Group();
  torsoRoot.name = "TorsoRoot";
  robotRoot.add(torsoRoot);

  const waist = makeMesh(THREE, geometries.cylinder, materials.titanium, "WaistCore", {
    position: [0, 0.18, 0],
    scale: [0.68, 0.28, 0.68]
  });
  torsoRoot.add(waist);

  const chestCore = new THREE.Group();
  chestCore.name = "ChestCore";
  const chestCoreBody = makeMesh(THREE, geometries.chest, materials.titanium, "ChestCoreBody", {
    position: [0, 1.28, -0.02],
    scale: [0.8, 0.88, 1.22]
  });
  const spine = makeMesh(THREE, geometries.cylinder, materials.brushedMetal, "SpineActuator", {
    position: [0, 1.22, -0.38],
    scale: [0.16, 0.82, 0.16]
  });
  chestCore.add(chestCoreBody, spine);
  torsoRoot.add(chestCore);

  const chestArmor = new THREE.Group();
  chestArmor.name = "ChestArmor";
  const upperArmor = makeMesh(THREE, geometries.chest, materials.ceramic, "UpperChestArmor", {
    position: [0, 1.49, 0.33],
    scale: [0.77, 0.62, 0.42]
  });
  const sternum = makeMesh(THREE, geometries.box, materials.ceramicShadow, "SternumPlate", {
    position: [0, 1.23, 0.58],
    scale: [0.25, 0.86, 0.09]
  });
  const leftRib = makeMesh(THREE, geometries.box, materials.ceramic, "LeftRibPlate", {
    position: [0.48, 1.13, 0.48],
    rotation: [0, -0.08, -0.09],
    scale: [0.35, 0.7, 0.1]
  });
  const rightRib = leftRib.clone();
  rightRib.name = "RightRibPlate";
  rightRib.position.x = -0.57;
  rightRib.rotation.y = 0.08;
  rightRib.rotation.z = 0.09;

  const chestLightHousing = makeMesh(THREE, geometries.torus, materials.brushedMetal, "ChestLightHousing", {
    position: [0, 1.55, 0.7],
    scale: [0.14, 0.14, 0.14]
  });
  const chestLight = makeMesh(THREE, geometries.cylinder, materials.chestGlow, "ChestLight", {
    position: [0, 1.55, 0.71],
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.075, 0.02, 0.075]
  });

  chestArmor.add(upperArmor, sternum, leftRib, rightRib, chestLightHousing, chestLight);
  torsoRoot.add(chestArmor);

  const leftArm = createArm(THREE, geometries, materials, "Left", SIDE.left);
  const rightArm = createArm(THREE, geometries, materials, "Right", SIDE.right);
  leftArm.shoulderPivot.rotation.z = 0.09;
  rightArm.shoulderPivot.rotation.z = -0.09;
  torsoRoot.add(leftArm.shoulderPivot, rightArm.shoulderPivot);

  const head = createHead(THREE, geometries, materials);
  torsoRoot.add(head.neckPivot);

  const parts = {
    robotRoot,
    torsoRoot,
    chestCore,
    chestArmor,
    chestLight,
    leftShoulderPivot: leftArm.shoulderPivot,
    leftUpperArm: leftArm.upperArm,
    leftElbowPivot: leftArm.elbowPivot,
    leftForearm: leftArm.forearm,
    leftWristPivot: leftArm.wristPivot,
    leftHand: leftArm.hand,
    rightShoulderPivot: rightArm.shoulderPivot,
    rightUpperArm: rightArm.upperArm,
    rightElbowPivot: rightArm.elbowPivot,
    rightForearm: rightArm.forearm,
    rightWristPivot: rightArm.wristPivot,
    rightHand: rightArm.hand,
    ...head
  };

  return {
    root: robotRoot,
    parts,
    materials,
    geometries,
    dispose() {
      robotRoot.traverse((object) => {
        if (object.isMesh && object.geometry && !Object.values(geometries).includes(object.geometry)) {
          object.geometry.dispose();
        }
      });
      for (const geometry of Object.values(geometries)) geometry.dispose();
      materials.dispose();
    }
  };
}
