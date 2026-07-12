export class RobotMaterials {
  constructor(THREE) {
    this.THREE = THREE;

    this.ceramic = new THREE.MeshPhysicalMaterial({
      color: 0xdfdbcf,
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.22,
      clearcoatRoughness: 0.46
    });

    this.ceramicShadow = new THREE.MeshStandardMaterial({
      color: 0xb9bbb7,
      roughness: 0.48,
      metalness: 0.08
    });

    this.titanium = new THREE.MeshStandardMaterial({
      color: 0x23282e,
      roughness: 0.3,
      metalness: 0.82
    });

    this.brushedMetal = new THREE.MeshStandardMaterial({
      color: 0x7a858c,
      roughness: 0.4,
      metalness: 0.88
    });

    this.blackOptical = new THREE.MeshPhysicalMaterial({
      color: 0x05080a,
      roughness: 0.12,
      metalness: 0.52,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08
    });

    this.eyeGlow = new THREE.MeshStandardMaterial({
      color: 0x12333b,
      emissive: 0x24a9c1,
      emissiveIntensity: 1.15,
      roughness: 0.18,
      metalness: 0.05
    });

    this.chestGlow = new THREE.MeshStandardMaterial({
      color: 0x62d6ea,
      emissive: 0x1c9db8,
      emissiveIntensity: 0.9,
      roughness: 0.24,
      metalness: 0.18
    });

    this.marking = new THREE.MeshStandardMaterial({
      color: 0x374047,
      roughness: 0.62,
      metalness: 0.44
    });
  }

  setSurfaceTuning({ roughness, metalness } = {}) {
    const surfaces = [this.ceramic, this.ceramicShadow, this.titanium, this.brushedMetal];
    for (const material of surfaces) {
      if (Number.isFinite(roughness)) material.roughness = roughness;
      if (Number.isFinite(metalness)) material.metalness = metalness;
      material.needsUpdate = true;
    }
  }

  setStatusColor(color, intensity = 1) {
    const value = color instanceof this.THREE.Color ? color : new this.THREE.Color(color);
    this.eyeGlow.color.copy(value);
    this.eyeGlow.emissive.copy(value);
    this.eyeGlow.emissiveIntensity = intensity;
    this.chestGlow.color.copy(value);
    this.chestGlow.emissive.copy(value);
  }

  dispose() {
    for (const material of Object.values(this)) {
      if (material && typeof material.dispose === "function") material.dispose();
    }
  }
}
