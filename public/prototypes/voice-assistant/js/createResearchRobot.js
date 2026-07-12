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

function addJoint(THREE, group, geometries, materials, name, scale = 1) {
  const joint = makeMesh(THREE, geometries.sphere, materials.brushedMetal, `${name}Joint`, {
    scale: [0.25 * scale, 0.25 * scale, 0.25 * scale]
  });
  const collar = makeMesh(THREE, geometries.torus, materials.titanium, `${name}Collar`, {
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.32 * scale, 0.32 * scale, 0.32 * scale]
  });
  group.add(joint, collar);
}

function createHand(THREE, geometries, materials, sideName, sideSign) {
  const hand = new THREE.Group();
  hand.name = `${sideName}Hand`;

  const palm = makeMesh(THREE, geometries.box, materials.ceramicShadow, `${sideName}Palm`, {
    position: [0, -0.19, 0],
    scale: [0.31, 0.36, 0.2]
  });
  hand.add(palm);

  for (let index = 0; index < 3; index += 1) {
    const finger = makeMesh(THREE, geometries.cylinder, materials.brushedMetal, `${sideName}Finger${index + 1}`, {
      position: [sideSign * (index - 1) * 0.085, -0.48, 0.015],
      rotation: [0, 0, sideSign * (index - 1) * 0.04],
      scale: [0.038, 0.18, 0.038]
    });
    hand.add(finger);
  }

  const thumb = makeMesh(THREE, geometries.cylinder, materials.brushedMetal, `${sideName}Thumb`, {
    position: [-sideSign * 0.25, -0.28, 0.02],
    rotation: [0, 0, -sideSign * 0.78],
    scale: [0.045, 0.14, 0.045]
  });
  hand.add(thumb);
  return hand;
}

function createArm(THREE, geometries, materials, sideName, sideSign) {
  const shoulderPivot = new THREE.Group();
  shoulderPivot.name = `${sideName}ShoulderPivot`;
  shoulderPivot.position.set(sideSign * 1.13, 1.92, 0);
  addJoint(THREE, shoulderPivot, geometries, materials, `${sideName}Shoulder`, 1.16);

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
    scale: [0.34, 0.72, 0.12]
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
  const eye = new THREE.Group();
  eye.name = name;
  eye.position.set(x, 0.31, 0.48);

  const socket = makeMesh(THREE, geometries.cylinder, materials.blackOptical, `${name}Socket`, {
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.105, 0.075, 0.105]
  });
  const lens = makeMesh(THREE, geometries.sphere, materials.eyeGlow, `${name}Lens`, {
    position: [0, 0, 0.078],
    scale: [0.045, 0.045, 0.03]
  });
  const rim = makeMesh(THREE, geometries.torus, materials.brushedMetal, `${name}Rim`, {
    position: [0, 0, 0.085],
    scale: [0.075, 0.075, 0.075]
  });
  eye.add(socket, lens, rim);
  return eye;
}

function createEyeShutter(THREE, geometries, materials, name, x) {
  const shutter = new THREE.Group();
  shutter.name = name;
  shutter.position.set(x, 0.31, 0.595);

  const upper = makeMesh(THREE, geometries.box, materials.ceramicShadow, `${name}Upper`, {
    position: [0, 0.145, 0],
    scale: [0.145, 0.045, 0.022]
  });
  const lower = makeMesh(THREE, geometries.box, materials.ceramicShadow, `${name}Lower`, {
    position: [0, -0.145, 0],
    scale: [0.145, 0.045, 0.022]
  });
  shutter.add(upper, lower);
  shutter.userData.openY = 0.145;
  return shutter;
}

function createHead(THREE, geometries, materials) {
  const neckPivot = new THREE.Group();
  neckPivot.name = "NeckPivot";
  neckPivot.position.set(0, 2.36, 0);

  const neckColumn = makeMesh(THREE, geometries.cylinder, materials.brushedMetal, "NeckColumn", {
    position: [0, 0.03, 0],
    scale: [0.22, 0.27, 0.22]
  });
  const neckRingTop = makeMesh(THREE, geometries.torus, materials.titanium, "NeckRingTop", {
    position: [0, 0.24, 0],
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.28, 0.28, 0.28]
  });
  const neckRingBottom = neckRingTop.clone();
  neckRingBottom.name = "NeckRingBottom";
  neckRingBottom.position.y = -0.18;
  neckPivot.add(neckColumn, neckRingTop, neckRingBottom);

  for (let index = -1; index <= 1; index += 2) {
    const actuator = makeMesh(THREE, geometries.cylinder, materials.titanium, `NeckActuator${index}`, {
      position: [index * 0.17, 0.02, -0.04],
      rotation: [0, 0, index * 0.18],
      scale: [0.045, 0.26, 0.045]
    });
    neckPivot.add(actuator);
  }

  const headYaw = new THREE.Group();
  headYaw.name = "HeadYaw";
  headYaw.position.set(0, 0.25, 0);
  neckPivot.add(headYaw);

  const headPitch = new THREE.Group();
  headPitch.name = "HeadPitch";
  headYaw.add(headPitch);

  const skull = new THREE.Group();
  skull.name = "Skull";
  const cranium = makeMesh(THREE, geometries.sphere, materials.ceramic, "Cranium", {
    position: [0, 0.28, -0.02],
    scale: [0.54, 0.44, 0.43]
  });
  const rearBand = makeMesh(THREE, geometries.torus, materials.titanium, "RearCraniumBand", {
    position: [0, 0.28, -0.13],
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.49, 0.49, 0.49]
  });
  skull.add(cranium, rearBand);
  headPitch.add(skull);

  const facePlate = new THREE.Group();
  facePlate.name = "FacePlate";
  const faceCore = makeMesh(THREE, geometries.box, materials.titanium, "FaceCore", {
    position: [0, 0.23, 0.29],
    scale: [0.68, 0.52, 0.19]
  });
  const brow = makeMesh(THREE, geometries.box, materials.ceramic, "BrowPlate", {
    position: [0, 0.52, 0.39],
    scale: [0.7, 0.14, 0.13]
  });
  const cheekLeft = makeMesh(THREE, geometries.box, materials.ceramic, "LeftCheekPlate", {
    position: [0.29, 0.14, 0.4],
    rotation: [0, 0.08, -0.08],
    scale: [0.18, 0.29, 0.11]
  });
  const cheekRight = cheekLeft.clone();
  cheekRight.name = "RightCheekPlate";
  cheekRight.position.x = -0.34;
  cheekRight.rotation.y = -0.08;
  cheekRight.rotation.z = 0.08;
  const lowerMask = makeMesh(THREE, geometries.box, materials.ceramicShadow, "LowerFaceMask", {
    position: [0, -0.015, 0.39],
    scale: [0.46, 0.12, 0.1]
  });
  facePlate.add(faceCore, brow, cheekLeft, cheekRight, lowerMask);
  headPitch.add(facePlate);

  const leftEye = createEye(THREE, geometries, materials, "LeftEye", SIDE.left * 0.17);
  const rightEye = createEye(THREE, geometries, materials, "RightEye", SIDE.right * 0.17);
  const leftEyeShutter = createEyeShutter(THREE, geometries, materials, "LeftEyeShutter", SIDE.left * 0.17);
  const rightEyeShutter = createEyeShutter(THREE, geometries, materials, "RightEyeShutter", SIDE.right * 0.17);
  headPitch.add(leftEye, rightEye, leftEyeShutter, rightEyeShutter);

  const jawPivot = new THREE.Group();
  jawPivot.name = "JawPivot";
  jawPivot.position.set(0, -0.04, 0.28);
  headPitch.add(jawPivot);

  const mechanicalJaw = new THREE.Group();
  mechanicalJaw.name = "MechanicalJaw";
  const jawBar = makeMesh(THREE, geometries.box, materials.brushedMetal, "JawBar", {
    position: [0, -0.14, 0.16],
    scale: [0.44, 0.09, 0.11]
  });
  const jawGuard = makeMesh(THREE, geometries.box, materials.ceramicShadow, "JawGuard", {
    position: [0, -0.16, 0.24],
    scale: [0.31, 0.07, 0.08]
  });
  const jawHingeLeft = makeMesh(THREE, geometries.cylinder, materials.titanium, "JawHingeLeft", {
    position: [0.33, -0.07, 0.05],
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.075, 0.08, 0.075]
  });
  const jawHingeRight = jawHingeLeft.clone();
  jawHingeRight.name = "JawHingeRight";
  jawHingeRight.position.x = -0.33;
  mechanicalJaw.add(jawBar, jawGuard, jawHingeLeft, jawHingeRight);
  jawPivot.add(mechanicalJaw);

  return {
    neckPivot,
    headYaw,
    headPitch,
    skull,
    facePlate,
    leftEye,
    rightEye,
    leftEyeShutter,
    rightEyeShutter,
    jawPivot,
    mechanicalJaw
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
    chest: makeChestGeometry(THREE)
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
  const waistRing = makeMesh(THREE, geometries.torus, materials.brushedMetal, "WaistRing", {
    position: [0, 0.35, 0],
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.72, 0.72, 0.72]
  });
  torsoRoot.add(waist, waistRing);

  const chestCore = new THREE.Group();
  chestCore.name = "ChestCore";
  const chestCoreBody = makeMesh(THREE, geometries.chest, materials.titanium, "ChestCoreBody", {
    position: [0, 1.28, -0.02],
    scale: [0.93, 0.88, 1.22]
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
    scale: [0.9, 0.62, 0.42]
  });
  const sternum = makeMesh(THREE, geometries.box, materials.ceramicShadow, "SternumPlate", {
    position: [0, 1.23, 0.58],
    scale: [0.25, 0.86, 0.09]
  });
  const leftRib = makeMesh(THREE, geometries.box, materials.ceramic, "LeftRibPlate", {
    position: [0.57, 1.13, 0.48],
    rotation: [0, -0.08, -0.09],
    scale: [0.44, 0.7, 0.1]
  });
  const rightRib = leftRib.clone();
  rightRib.name = "RightRibPlate";
  rightRib.position.x = -0.57;
  rightRib.rotation.y = 0.08;
  rightRib.rotation.z = 0.09;

  const chestLightHousing = makeMesh(THREE, geometries.torus, materials.brushedMetal, "ChestLightHousing", {
    position: [0, 1.55, 0.7],
    scale: [0.22, 0.22, 0.22]
  });
  const chestLight = makeMesh(THREE, geometries.cylinder, materials.chestGlow, "ChestLight", {
    position: [0, 1.55, 0.71],
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.14, 0.025, 0.14]
  });

  chestArmor.add(upperArmor, sternum, leftRib, rightRib, chestLightHousing, chestLight);
  torsoRoot.add(chestArmor);

  const markingBars = [0.76, 0.88, 1.0].map((y, index) => makeMesh(
    THREE,
    geometries.box,
    materials.marking,
    `TechnicalMarking${index + 1}`,
    { position: [-0.62 + index * 0.045, y, 0.6], scale: [0.18 - index * 0.025, 0.018, 0.018] }
  ));
  chestArmor.add(...markingBars);

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
