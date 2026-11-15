import * as THREE from 'three';

export interface NormalizedWorldClone {
  clonedScene: THREE.Object3D;
  normScale: number;
  normalizedRadius: number;
  clonedMaterials: THREE.Material[];
}

export interface ClonedMaterialEntry {
  material: THREE.Material;
  baseColor: THREE.Color | null;
  baseEmissive: THREE.Color | null;
}

export interface NormalizedHardwareClone {
  clonedScene: THREE.Group;
  normalizedMaxDim: number;
  normalizedHeight: number;
  clonedMaterials: ClonedMaterialEntry[];
}

/**
 * Clones a GLTF world scene and all of its materials, resets any leftover transforms,
 * forces full visibility/opacity, and normalizes the model's visual diameter
 * to `targetRadius * 2` based strictly on the GLTF mesh bounds.
 */
export function createNormalizedWorldClone(
  sourceScene: THREE.Object3D,
  gl: THREE.WebGLRenderer,
  targetRadius: number,
  allowFade: boolean
): NormalizedWorldClone {
  const clone = sourceScene.clone(true);

  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.visible = true;
  clone.updateMatrixWorld(true);

  const materials: THREE.Material[] = [];
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();

  clone.traverse((child) => {
    child.visible = true;

    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.visible = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const cloneSingleMaterial = (mat: THREE.Material): THREE.Material => {
        const m = mat.clone();
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) {
          std.map.colorSpace = THREE.SRGBColorSpace;
          std.map.anisotropy = maxAnisotropy;
        }
        if (std.normalMap) {
          std.normalMap.anisotropy = maxAnisotropy;
        }
        if (std.roughnessMap) {
          std.roughnessMap.anisotropy = maxAnisotropy;
        }
        m.visible = true;
        m.opacity = 1;
        m.transparent = allowFade;
        m.depthWrite = true;
        m.needsUpdate = true;
        materials.push(m);
        return m;
      };

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(cloneSingleMaterial);
      } else if (mesh.material) {
        mesh.material = cloneSingleMaterial(mesh.material);
      }
    }
  });

  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const normScale = (targetRadius * 2) / maxDim;

  clone.scale.setScalar(normScale);
  clone.position.set(-center.x * normScale, -center.y * normScale, -center.z * normScale);
  clone.updateMatrixWorld(true);

  return {
    clonedScene: clone,
    normScale,
    normalizedRadius: targetRadius,
    clonedMaterials: materials,
  };
}

/**
 * Clones a hardware GLTF scene and all its materials, applies `modelRotation` and `modelScale`,
 * normalizes its largest dimension to `targetMaxDim * modelScale`, centers X/Z at 0,
 * and rests its lowest point on `y = 0`.
 */
export function createNormalizedHardwareClone(
  sourceScene: THREE.Object3D,
  gl: THREE.WebGLRenderer,
  targetMaxDim: number,
  modelRotation: [number, number, number],
  modelScale: number
): NormalizedHardwareClone {
  const rawClone = sourceScene.clone(true);
  rawClone.position.set(0, 0, 0);
  rawClone.rotation.set(0, 0, 0);
  rawClone.scale.set(1, 1, 1);
  rawClone.visible = true;

  const materials: ClonedMaterialEntry[] = [];
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();

  rawClone.traverse((child) => {
    child.visible = true;

    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.visible = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const cloneSingleMaterial = (mat: THREE.Material): THREE.Material => {
        const m = mat.clone();
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) {
          std.map.colorSpace = THREE.SRGBColorSpace;
          std.map.anisotropy = maxAnisotropy;
        }
        if (std.normalMap) {
          std.normalMap.anisotropy = maxAnisotropy;
        }
        if (std.roughnessMap) {
          std.roughnessMap.anisotropy = maxAnisotropy;
        }
        m.visible = true;
        m.opacity = 1;
        m.transparent = false;
        m.depthWrite = true;
        m.needsUpdate = true;

        materials.push({
          material: m,
          baseColor: std.color ? std.color.clone() : null,
          baseEmissive: std.emissive ? std.emissive.clone() : null,
        });
        return m;
      };

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(cloneSingleMaterial);
      } else if (mesh.material) {
        mesh.material = cloneSingleMaterial(mesh.material);
      }
    }
  });

  // Apply modelRotation inside an orientation wrapper before measuring bounds
  const rotatedGroup = new THREE.Group();
  rotatedGroup.rotation.set(modelRotation[0], modelRotation[1], modelRotation[2]);
  rotatedGroup.add(rawClone);
  rotatedGroup.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(rotatedGroup);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const finalScale = (targetMaxDim / maxDim) * (modelScale || 1);

  const rootGroup = new THREE.Group();
  rotatedGroup.scale.setScalar(finalScale);
  // Center X and Z at 0, and rest the lowest point (box.min.y) on y = 0
  rotatedGroup.position.set(
    -center.x * finalScale,
    -box.min.y * finalScale,
    -center.z * finalScale
  );
  rootGroup.add(rotatedGroup);
  rootGroup.updateMatrixWorld(true);

  return {
    clonedScene: rootGroup,
    normalizedMaxDim: targetMaxDim * (modelScale || 1),
    normalizedHeight: size.y * finalScale,
    clonedMaterials: materials,
  };
}

/**
 * Converts latitude and longitude (in degrees) with body offsets into a 3D point on a sphere of radius `r`.
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number,
  latOffset = 0,
  lonOffset = 0
): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(lat + latOffset);
  const lonRad = THREE.MathUtils.degToRad(lon + lonOffset);

  const cosLat = Math.cos(latRad);
  const x = radius * cosLat * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * cosLat * Math.cos(lonRad);

  return new THREE.Vector3(x, y, z);
}
